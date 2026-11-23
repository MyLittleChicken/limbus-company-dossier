import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import * as z from 'zod';
import { canonical } from '@/lib/db-canonical';
import type { EngineData } from '@/lib/engine/v2/load';
import { cacheReference } from '@/lib/query-cache';
import { getEgo, getIdentity } from '@/lib/queries/canonical/detail';
import { listKeywords, listSins } from '@/lib/queries/canonical/gifts';
import { listAxisLabels, listEgosFull, listIdentitiesFull, listSinners } from '@/lib/queries/canonical/list';
import { searchAll, type SearchHit } from '@/lib/queries/canonical/reference';
import { READ_ONLY, cleanText, cursorArg, idArg, localeArg, pageShape, queryArg, toId } from '../args';
import { engineData, type IdentityAxes } from '../axes';
import { ToolInputError, defineTool, type ToolCtx } from '../define-tool';
import { envelopeShape, fail, ok } from '../envelope';
import { paginate } from '../page';
import { stripMedia } from '../shape';
import { siteUrl, type SiteKind } from '../site-url';

/**
 * 조회 도구 — 검색 · 인격 · E.G.O · 어휘(설계 §6.1, 계획 Task 3).
 *
 * 목록은 요약 행 + 커서 페이지(50), 세부는 `get_*`. 질의 함수(화면용) 결과에서 이미지를
 * 빼고(`stripMedia`) `siteUrl` 을 붙인다. id 는 인격 · E.G.O · 기프트 number, 팩 string.
 */

// ── 공통 조각 ────────────────────────────────────────────────────

/** 숫자 또는 숫자 문자열. 범위는 handler 가 본다(문구를 고칠 수 있게 쓰려고). */
const intArg = z.union([z.number().int(), z.string().regex(/^-?\d{1,6}$/)]);

function intIn(name: string, v: number | string | undefined, min: number, max: number): number | undefined {
	if (v === undefined) return undefined;
	const n = Number(v);
	if (n < min || n > max) throw new ToolInputError(`${name} 는 ${min}–${max}: ${v}`);
	return n;
}

const named = z
	.looseObject({ name: z.string(), fellBack: z.boolean() })
	.nullable()
	.describe('{ name, fellBack } — 없으면 null');

const described = z
	.looseObject({ name: z.string(), desc: z.string().nullable(), fellBack: z.boolean() })
	.nullable();

const pageSummary = (what: string, total: number, shown: number, next: string | null) =>
	`${what} ${total}건 중 ${shown}건${next ? ' — 더 있다(nextCursor)' : ''}.`;

/** 커서 범위 — 정규화된 필터 값 + 데이터 판. 판이 바뀌면 이전 커서는 「다른 질의」로 거절된다. */
const scopeOf = (ctx: ToolCtx, filters: Record<string, unknown>) =>
	JSON.stringify({ v: ctx.dataVersion, ...filters });

// ── 축 ───────────────────────────────────────────────────────────

/**
 * 엔진 축 값의 표기. 종류마다 값의 대소문자가 정해져 있다(실측):
 * 소문자 — sin · resonance · attack_type · skill_kind · coin, 대문자 — axis · association · unit_keyword.
 */
const LOWER_KINDS: ReadonlySet<string> = new Set(['sin', 'resonance', 'attack_type', 'skill_kind', 'coin']);
const UPPER_KINDS: ReadonlySet<string> = new Set(['axis', 'association', 'unit_keyword']);

/**
 * 축 값 정규화. 접두어가 없으면 키워드 축(`axis:`)으로 본다.
 * `VIBRATION` · `Vibration` · `axis:vibration` → `axis:VIBRATION`, `SIN:Gluttony` → `sin:gluttony`,
 * `association:atl` → `association:ATL`. 모르는 종류는 접두어만 소문자로 하고 값은 그대로.
 */
export function normalizeAxisRef(raw: string): string {
	const s = raw.trim();
	const at = s.indexOf(':');
	const kind = at < 0 ? 'axis' : s.slice(0, at).trim().toLowerCase();
	const value = (at < 0 ? s : s.slice(at + 1)).trim();
	if (LOWER_KINDS.has(kind)) return `${kind}:${value.toLowerCase()}`;
	if (UPPER_KINDS.has(kind)) return `${kind}:${value.toUpperCase()}`;
	return `${kind}:${value}`;
}

interface AxisIndex {
	layers: Map<string, IdentityAxes>;
	/** 어느 인격에든 어느 층에든 있는 축 값 */
	known: Set<string>;
}

const axisIndexCache = new WeakMap<EngineData, AxisIndex>();

/**
 * 인격의 두 층 축 — **엔진 `supply` 표에서만** 낸다. 엔진(`countSupply`)이 조건을 세는 출처와 같다.
 *
 *   axis:X         tag = supply.axisTag(identity_axis) · skill = supply.axisSkill(coin_token — 스킬이 실제로 주는가)
 *   sin:X          supply.sin            ┐
 *   resonance:X    supply.sin (공명 판정) │ 엔진이 층을 가르지 않는다 → 두 층 같다
 *   association:X  supply.association     │
 *   unit_keyword:X supply.unitKeyword     │
 *   attack_type:X  supply.attackType      │
 *   skill_kind:X   supply.skillKind       │
 *   coin:minus     supply.minusCoin       ┘ (coin:plus · single 은 엔진이 안 쓰므로 없다)
 *
 * capability(v_identity_capability) 로 내면 skill 층 축이 60 인격, resonance 가 16 짝 어긋난다.
 */
function axisIndex(engine: EngineData): AxisIndex {
	const hit = axisIndexCache.get(engine);
	if (hit) return hit;
	const t = engine.supply;
	const tag = new Map<string, Set<string>>();
	const skill = new Map<string, Set<string>>();
	const put = (into: Map<string, Set<string>>, id: string, v: string) => {
		let set = into.get(id);
		if (!set) into.set(id, (set = new Set()));
		set.add(v);
	};
	const both = (kind: string, m: Map<string, Set<string>>) => {
		for (const [v, ids] of m) for (const id of ids) { put(tag, id, `${kind}:${v}`); put(skill, id, `${kind}:${v}`); }
	};
	for (const [v, ids] of t.axisTag) for (const id of ids) put(tag, id, `axis:${v}`);
	for (const [v, ids] of t.axisSkill) for (const id of ids) put(skill, id, `axis:${v}`);
	both('sin', t.sin);
	both('resonance', t.sin);
	both('association', t.association);
	both('unit_keyword', t.unitKeyword);
	both('attack_type', t.attackType);
	both('skill_kind', t.skillKind);
	for (const id of t.minusCoin) { put(tag, id, 'coin:minus'); put(skill, id, 'coin:minus'); }

	const layers = new Map<string, IdentityAxes>();
	const known = new Set<string>();
	for (const id of new Set([...tag.keys(), ...skill.keys()])) {
		const a = { tag: [...(tag.get(id) ?? [])].sort(), skill: [...(skill.get(id) ?? [])].sort() };
		layers.set(id, a);
		for (const v of [...a.tag, ...a.skill]) known.add(v);
	}
	const index = { layers, known };
	axisIndexCache.set(engine, index);
	return index;
}

function identityLayers(index: AxisIndex, identityId: string): IdentityAxes {
	const a = index.layers.get(identityId);
	return a ? { tag: [...a.tag], skill: [...a.skill] } : { tag: [], skill: [] };
}

const keywordAxesOnly = (values: string[]) => values.filter((v) => v.startsWith('axis:'));

/** 키워드 어휘 중 공격 유형인 셋 — 축 값은 `attack_type:` 이다(detail.ts 의 ATK_KEYWORD 와 같은 짝). */
const ATK_KEYWORD: Record<string, string> = { Slash: 'slash', Penetrate: 'pierce', Hit: 'blunt' };

const labelKey = (s: string) => s.normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim();

interface VocabIndex {
	/** 이름 · id · 축 값(소문자) → 축 값 */
	refs: Map<string, string>;
	/** 죄악 id · ko/en 이름(소문자) → 죄악 id */
	sins: Map<string, string>;
	/** 키워드 id → 축 값 (없으면 null) */
	keywordRef: (id: string) => string | null;
	/** 오류 문구에 싣는 받을 수 있는 값 요약 */
	keywordHint: string;
	sinHint: string;
}

/** 데이터 판마다 한 번 — ko · en 어휘를 함께 읽어 이름으로도 축 값을 찾는다. */
const vocabIndex = cacheReference(async (version: string): Promise<VocabIndex> => {
	const [engine, kwKo, kwEn, sinKo, sinEn, lbKo, lbEn] = await Promise.all([
		engineData(version),
		listKeywords('ko'),
		listKeywords('en'),
		listSins('ko'),
		listSins('en'),
		listAxisLabels('ko'),
		listAxisLabels('en'),
	]);
	const { known } = axisIndex(engine);
	const refs = new Map<string, string>();
	const add = (label: string | null | undefined, ref: string | null) => {
		if (!label || !ref || !known.has(ref)) return;
		const k = labelKey(label);
		if (!refs.has(k)) refs.set(k, ref);
	};
	const keywordRef = (id: string): string | null => {
		const atk = ATK_KEYWORD[id];
		const ref = atk ? `attack_type:${atk}` : normalizeAxisRef(id);
		return known.has(ref) ? ref : null;
	};
	for (const v of known) add(v, v);
	for (const k of [...kwKo, ...kwEn]) {
		const ref = keywordRef(k.id);
		add(k.id, ref);
		add(k.text?.name, ref);
	}
	for (const lb of [lbKo, lbEn]) {
		for (const m of lb.mechanics) {
			const ref = normalizeAxisRef(m.id);
			add(m.id, ref);
			add(m.text?.name, ref);
		}
		for (const a of lb.associations) {
			const ref = `association:${a.id}`;
			add(a.id, ref);
			add(a.text?.name, ref);
		}
	}
	const sins = new Map<string, string>();
	for (const s of [...sinKo, ...sinEn]) {
		sins.set(labelKey(s.id), s.id);
		if (s.text) sins.set(labelKey(s.text.name), s.id);
		add(s.id, `sin:${s.id}`);
		add(s.text?.name, `sin:${s.id}`);
	}

	const enName = new Map(kwEn.map((k) => [k.id, k.text?.name]));
	const keywordHint = kwKo
		.filter((k) => keywordRef(k.id))
		.map((k) => `${k.id}(${[k.text?.name, enName.get(k.id)].filter(Boolean).join('/')})`)
		.join(' · ');
	const sinEnName = new Map(sinEn.map((s) => [s.id, s.text?.name]));
	const sinHint = sinKo.map((s) => `${s.id}(${s.text?.name ?? ''}/${sinEnName.get(s.id) ?? ''})`).join(' · ');
	return { refs, sins, keywordRef, keywordHint, sinHint };
}, 24 * 60 * 60_000);

/** keyword 인자 → 축 값. 「종류:값」이면 정규화해 확인하고, 아니면 id · ko/en 이름 사전에서 찾는다. */
function resolveKeyword(v: VocabIndex, raw: string): string {
	const found = v.refs.get(labelKey(raw.includes(':') ? normalizeAxisRef(raw) : raw));
	if (found) return found;
	throw new ToolInputError(
		`모르는 keyword: 「${raw}」 — 받는 값: 키워드 ${v.keywordHint} · 탄환(Bullet/Ammo) · ` +
			'죄악 이름 · 소속 이름(list_vocab.axisLabels.associations) · 또는 axisRef(axis:VIBRATION · sin:wrath · association:ATL)',
	);
}

function resolveSin(v: VocabIndex, raw: string): string {
	const id = v.sins.get(labelKey(raw));
	if (id) return id;
	throw new ToolInputError(`모르는 sin: 「${raw}」 — 받는 값: ${v.sinHint}`);
}

// ── search ───────────────────────────────────────────────────────

const SEARCH_KIND: Record<SearchHit['kind'], { site: SiteKind; tool: string }> = {
	identity: { site: 'identities', tool: 'get_identity' },
	ego: { site: 'egos', tool: 'get_ego' },
	gift: { site: 'gifts', tool: 'get_gift' },
	pack: { site: 'packs', tool: 'get_pack' },
};

function registerSearch(server: McpServer): void {
	defineTool(
		server,
		'search',
		{
			title: '통합 검색',
			description:
				'인격(identity) · E.G.O · 기프트(gift) · 테마 팩(pack)을 이름으로 한 번에 찾는다(기프트는 설명문도). ' +
				'한글 초성 검색(예: "ㄷㅂ")과 조합 중인 글자도 걸린다. 종류마다 최대 8건. ' +
				'각 결과 { kind, id(인격 · E.G.O · 기프트는 number, 팩은 string), name, fellBack, meta, detailTool, siteUrl } — ' +
				'세부는 detailTool(get_identity · get_ego · get_gift · get_pack)에 id 를 넘긴다. ' +
				'meta 는 종류별 짧은 표지(인격: 성급을 0 개수로, E.G.O: 등급, 기프트: 등급, 팩: 분류). ' +
				'수감자 이름(이상 · 파우스트 …)은 여기서 찾지 말고 list_vocab.sinners 에서 id 를 얻어 list_identities(sinnerId) · list_egos(sinnerId) 로.',
			inputSchema: {
				query: queryArg.describe('검색어 (ko/en 이름 둘 다 본다). 한 글자 이상 또는 초성 두 개 이상'),
				locale: localeArg,
			},
			outputSchema: envelopeShape({
				hits: z.array(
					z.object({
						kind: z.enum(['identity', 'ego', 'gift', 'pack']),
						id: z.union([z.number(), z.string()]).describe('인격 · E.G.O · 기프트는 number, 팩은 string'),
						name: z.string().nullable(),
						fellBack: z.boolean(),
						meta: z.string(),
						detailTool: z.string(),
						siteUrl: z.string(),
					}),
				),
			}),
			annotations: READ_ONLY,
		},
		async ({ query, locale }, ctx) => {
			const q = cleanText(query);
			if (q === undefined) throw new ToolInputError('검색어가 비었다 — query 에 이름 일부를 넣으세요');
			const hits = (await searchAll(q, locale)).map((h) => ({
				kind: h.kind,
				id: h.kind === 'pack' ? h.id : Number(h.id),
				name: h.name,
				fellBack: h.fellBack,
				meta: h.meta,
				detailTool: SEARCH_KIND[h.kind].tool,
				siteUrl: siteUrl(locale, SEARCH_KIND[h.kind].site, h.id),
			}));
			const counts = (['identity', 'ego', 'gift', 'pack'] as const)
				.map((k) => [k, hits.filter((h) => h.kind === k).length] as const)
				.filter(([, n]) => n > 0)
				.map(([k, n]) => `${k} ${n}`);
			return ok(
				{ hits },
				hits.length ? `「${q}」 ${hits.length}건 (${counts.join(' · ')}).` : `「${q}」에 걸린 것이 없다.`,
				ctx,
			);
		},
	);
}

// ── 동기화 단계 ──────────────────────────────────────────────────

const uptieArg = z
	.union([z.number().int().min(1).max(9), z.string().regex(/^[1-9]$/), z.literal('all')])
	.optional()
	.describe("동기화(uptie) 단계. 생략하면 그 인격/E.G.O 의 최고 단계 하나만, 'all' 이면 모든 단계. 최고보다 크면 최고로 맞춘다");

const uptieShape = z
	.object({
		shown: z.union([z.number(), z.literal('all')]).describe('응답에 담은 단계'),
		max: z.number().describe('이 대상의 최고 단계'),
	})
	.describe('어느 동기화 단계를 줬나');

type Staged = { uptie: number };
/** 단계 행은 바뀔 때만 있다 — 단계 n 의 모습은 n 이하 중 마지막 행이다. */
const lastAtOrBelow = <T extends Staged>(rows: readonly T[], n: number): T | undefined =>
	rows.filter((r) => r.uptie <= n).at(-1);

function pickUptie(sel: number | string | undefined, max: number): number | 'all' {
	if (sel === 'all') return 'all';
	return sel === undefined ? max : Math.min(Number(sel), max);
}

type IdentityDetail = NonNullable<Awaited<ReturnType<typeof getIdentity>>>;
type EgoDetail = NonNullable<Awaited<ReturnType<typeof getEgo>>>;

function identityAtUptie(d: IdentityDetail, shown: number | 'all'): IdentityDetail {
	if (shown === 'all') return d;
	const skills = d.skills.flatMap((s) => {
		const st = lastAtOrBelow(s.stages, shown);
		return st ? [{ ...s, stages: [st] }] : [];
	});
	const speed = lastAtOrBelow(d.speeds, shown);
	/*
		패시브 행은 「그 단계에서 켜져 있는 패시브」의 전체 목록이다 — 1101602 는 1·2·3 단계에 모두
		행이 있고, 1101604(라 무아송)는 1·2 단계에만 있다가 3 단계에서 1101614(같은 이름)로 바뀐다.
		그래서 갈래(battle · supporter)마다 n 이하 중 가장 높은 단계 L 을 찾고 L 의 행만 남긴다.
	*/
	const levelOf = new Map<string, number>();
	for (const p of d.passives) {
		if (p.uptie <= shown && p.uptie > (levelOf.get(p.kind) ?? 0)) levelOf.set(p.kind, p.uptie);
	}
	const passives = d.passives.filter((p) => p.uptie === levelOf.get(p.kind));
	return { ...d, skills, speeds: speed ? [speed] : [], passives };
}

function egoAtUptie(d: EgoDetail, shown: number | 'all'): EgoDetail {
	if (shown === 'all') return d;
	const skills = d.skills.flatMap((s) => {
		const st = lastAtOrBelow(s.stages, shown);
		return st ? [{ ...s, stages: [st] }] : [];
	});
	return { ...d, skills };
}

const maxOf = (values: number[]) => (values.length ? Math.max(...values) : 1);

/** 최상위 `text` 를 `name` · `fellBack` 으로 편다. 나머지는 `stripMedia` 만. */
function flattenTop<T extends { text: { name: string; fellBack: boolean } | null }>(d: T) {
	const { text, ...rest } = d;
	return { name: text?.name ?? null, fellBack: text?.fellBack ?? false, ...(stripMedia(rest) as Record<string, unknown>) };
}

const placeholderNote =
	'본문의 [Id] 자리표시(예: [Sinking])는 상태 id 다 — statuses 는 본문에 나오는 상태의 { id, name } 만 담고, 설명문은 list_statuses 에 있다.';

/** 본문에 나오는 상태 — 이름만. 설명문은 list_statuses 가 준다(상세 응답 크기를 1/4 줄인다). */
const compactStatuses = (rows: ReadonlyArray<{ id: string; text: { name: string; fellBack: boolean } | null }>) =>
	rows.map((s) => ({ id: s.id, name: s.text?.name ?? null, fellBack: s.text?.fellBack ?? false }));

const statusRow = z.object({ id: z.string(), name: z.string().nullable(), fellBack: z.boolean() });

// ── 인격 ─────────────────────────────────────────────────────────

const axesShape = z.object({
	tag: z.array(z.string()).describe('인격 취급 — 「진동 인격 N인」 같은 인격 수 조건에 드는 축'),
	skill: z.array(z.string()).describe('스킬 취급 — 「진동을 부여하는 스킬 사용 시」 같은 조건에 드는 축. 엔진 공급 표(코인 토큰 기준)라 코인 아닌 스킬 효과·특수 변형(예: 특수 침잠) 일부를 놓치고, 소수 인격(10109·11109)은 제한 미적용으로 과대일 수 있다'),
});

const keywordRow = z.object({ id: z.string(), name: z.string().nullable(), fellBack: z.boolean(), axisRef: z.string().nullable() });
const namedRow = z.object({ id: z.string(), name: z.string().nullable(), fellBack: z.boolean() });

type Txt = { name: string; fellBack: boolean; desc?: string | null } | null;
/** `{ id, text: { name, fellBack } }` → `{ id, name, fellBack }`. */
const flatName = (text: Txt) => ({ name: text?.name ?? null, fellBack: text?.fellBack ?? false });
const flatDesc = (text: Txt) => ({ ...flatName(text), desc: text?.desc ?? null });

function registerIdentityTools(server: McpServer): void {
	defineTool(
		server,
		'list_identities',
		{
			title: '인격 목록',
			description:
				'인격(identity) 요약 목록을 커서 페이지(50건)로 준다. 행 { id, sinnerId, name, fellBack, star, season, sins, axes: { tag, skill }, siteUrl }. ' +
				'행의 axes 는 키워드 축(axis:*)만 담는다 — 죄악 · 소속 · 공격 유형 등 전체 축은 get_identity. ' +
				'축은 두 층이다: tag(인격 취급 — 게임이 그 인격을 그 축으로 분류) · skill(스킬 취급 — 스킬이 실제로 그 상태를 준다). ' +
				'섞지 말 것 — 예: 10104 는 VIBRATION 이 skill 에만 있다. 엔진 판정(check_gifts 등)과 같은 출처다. ' +
				'필터: sinnerId(1–12, list_vocab.sinners) · star(1–3) · sin(스킬 죄악 — id 또는 ko/en 이름) · season · ' +
				"keyword + axisLayer(기본 'tag'). keyword 는 키워드 id · ko/en 이름(Vibration · 진동 · Tremor) · axisRef(axis:VIBRATION · sin:wrath · association:ATL) · " +
				'소속/죄악 이름을 받는다(대소문자 무관). 모르는 값은 받을 수 있는 값과 함께 오류. 빈 문자열 필터는 없는 것으로 친다. ' +
				'세부(스킬 · 패시브 · 내성 · 속도)는 get_identity 에 id 를 넘긴다.',
			inputSchema: {
				locale: localeArg,
				sinnerId: intArg.optional().describe('수감자 id 1–12 (list_vocab.sinners)'),
				star: intArg.optional().describe('성급 1–3'),
				sin: z.string().max(40).optional().describe('스킬 죄악 — wrath · 분노 · Wrath …'),
				keyword: z.string().max(80).optional().describe('축 — VIBRATION · 진동 · Tremor · axis:VIBRATION · sin:gluttony · association:ATL …'),
				axisLayer: z.enum(['tag', 'skill']).default('tag').describe("keyword 를 볼 층. 기본 'tag'. 'skill' 은 엔진 코인 토큰 기준이라 스킬 효과·특수 변형 일부 누락이 있다"),
				season: intArg.optional().describe('시즌 번호 (0 = 상시, 9xxx = 발푸르기스 등)'),
				cursor: cursorArg,
			},
			outputSchema: envelopeShape({
				...pageShape(
					z.object({
						id: z.number(),
						sinnerId: z.number(),
						name: z.string().nullable(),
						fellBack: z.boolean(),
						star: z.number(),
						season: z.number().nullable(),
						sins: z.array(z.string()),
						axes: axesShape,
						siteUrl: z.string(),
					}),
				),
			}),
			annotations: READ_ONLY,
		},
		async (args, ctx) => {
			const { locale, axisLayer } = args;
			const sinnerId = intIn('sinnerId', args.sinnerId, 1, 12);
			const star = intIn('star', args.star, 1, 3);
			const season = args.season === undefined ? undefined : Number(args.season);
			const [rows, engine, vocab] = await Promise.all([
				listIdentitiesFull(locale),
				engineData(ctx.dataVersion),
				vocabIndex(ctx.dataVersion),
			]);
			const sinRaw = cleanText(args.sin);
			const kwRaw = cleanText(args.keyword);
			const sin = sinRaw === undefined ? undefined : resolveSin(vocab, sinRaw);
			const ref = kwRaw === undefined ? undefined : resolveKeyword(vocab, kwRaw);
			const index = axisIndex(engine);
			const filtered = rows.filter(
				(r) =>
					(sinnerId === undefined || r.sinnerId === sinnerId) &&
					(star === undefined || r.star === star) &&
					(season === undefined || r.season === season) &&
					(sin === undefined || r.sins.includes(sin)) &&
					(ref === undefined || identityLayers(index, r.id)[axisLayer].includes(ref)),
			);
			const scope = scopeOf(ctx, { locale, sinnerId, star, sin, ref, axisLayer: ref ? axisLayer : undefined, season });
			const page = paginate(filtered, cleanText(args.cursor), scope);
			const items = page.items.map((r) => {
				const axes = identityLayers(index, r.id);
				return {
					id: Number(r.id),
					sinnerId: r.sinnerId,
					name: r.text?.name ?? null,
					fellBack: r.text?.fellBack ?? false,
					star: r.star,
					season: r.season,
					sins: r.sins,
					axes: { tag: keywordAxesOnly(axes.tag), skill: keywordAxesOnly(axes.skill) },
					siteUrl: siteUrl(locale, 'identities', r.id),
				};
			});
			return ok(
				{ items, total: page.total, nextCursor: page.nextCursor },
				pageSummary('인격', page.total, items.length, page.nextCursor) + (ref ? ` 축 ${ref} (${axisLayer} 층).` : ''),
				ctx,
			);
		},
	);

	defineTool(
		server,
		'get_identity',
		{
			title: '인격 상세',
			description:
				'인격 하나의 세부. name · fellBack · 기본 정보(sinnerId · sinner 이름 · rarity = 성급 · season · releaseDate · hpBase · hpPerLevel · defCorrection · breakSection = 흐트러짐 구간), ' +
				'resists(공격 유형별 내성) · speeds(속도) · affiliations(소속) · statuses(본문에 나오는 상태) · keywords(기믹 키워드, axisRef 포함) · ' +
				'passives · skills(stages · 코인 coins 설명) · sinNames/atkNames(죄악 · 공격 유형 이름표) · ' +
				'axes { tag, skill }(엔진 판정에 쓰이는 전체 축, 두 층) · uptie { shown, max } · siteUrl. ' +
				"기본은 최고 동기화 단계 하나만 준다(skills · speeds · passives) — 단계별 변화가 필요하면 uptie: 'all' 또는 숫자. " +
				`${placeholderNote} id 는 list_identities · search 의 id. 수감자 이름은 list_vocab.sinners. 없는 id 면 isError.`,
			inputSchema: { id: idArg.describe('인격 id (예: 10101)'), locale: localeArg, uptie: uptieArg },
			outputSchema: envelopeShape({
				id: z.number(),
				name: z.string().nullable().describe('인격 이름'),
				fellBack: z.boolean(),
				sinnerId: z.number(),
				sinner: named,
				rarity: z.number().describe('성급 1–3'),
				season: z.number().nullable(),
				releaseDate: z.string().nullable().describe('출시일 (ISO 8601)'),
				hpBase: z.number().nullable(),
				hpPerLevel: z.number().nullable(),
				defCorrection: z.number().nullable(),
				breakSection: z.array(z.number()).describe('흐트러짐 구간 (길이가 인격마다 다르다)'),
				resists: z.array(z.looseObject({ atkType: z.string(), value: z.number() })),
				speeds: z.array(z.looseObject({ uptie: z.number(), min: z.number(), max: z.number() })),
				affiliations: z.array(namedRow),
				statuses: z.array(statusRow).describe('본문에 나오는 상태 { id, name } — 설명문은 list_statuses'),
				keywords: z.array(keywordRow),
				sinNames: z.record(z.string(), z.string()),
				atkNames: z.record(z.string(), z.string()),
				passives: z.array(
					z.looseObject({ id: z.string(), kind: z.string(), uptie: z.number(), name: z.string().nullable(), desc: z.string().nullable(), fellBack: z.boolean() }),
				),
				skills: z.array(
					z.looseObject({ id: z.number(), stages: z.array(z.looseObject({ uptie: z.number() })) }),
				),
				axes: axesShape,
				uptie: uptieShape,
				siteUrl: z.string(),
			}),
			annotations: READ_ONLY,
		},
		async ({ id, locale, uptie }, ctx) => {
			const n = toId(id);
			const [full, engine, vocab] = await Promise.all([
				getIdentity(n, locale),
				engineData(ctx.dataVersion),
				vocabIndex(ctx.dataVersion),
			]);
			if (!full) return fail(`없는 id: 인격 ${id} — list_identities 나 search 로 id 를 확인하세요`);
			const max = maxOf([...full.skills.flatMap((s) => s.stages.map((st) => st.uptie)), ...full.speeds.map((s) => s.uptie)]);
			const shown = pickUptie(uptie, max);
			const detail = identityAtUptie(full, shown);
			const data = {
				...flattenTop(detail),
				statuses: compactStatuses(detail.statuses),
				affiliations: stripMedia(detail.affiliations.map((a) => ({ id: a.id, ...flatName(a.text) }))),
				keywords: detail.keywords.map((k) => ({ id: k.id, ...flatName(k.text), axisRef: vocab.keywordRef(k.id) })),
				passives: stripMedia(detail.passives.map(({ text, ...p }) => ({ ...p, ...flatDesc(text) }))),
				axes: identityLayers(axisIndex(engine), String(detail.id)),
				uptie: { shown, max },
				siteUrl: siteUrl(locale, 'identities', detail.id),
			};
			return ok(
				data,
				`인격 ${detail.id} ${detail.text?.name ?? '(이름 없음)'}${detail.sinner ? ` · ${detail.sinner.name}` : ''} · ${detail.rarity}성 · ` +
					`동기화 ${shown === 'all' ? `전 단계(최고 ${max})` : `${shown}/${max}`} · 스킬 ${detail.skills.length} · 패시브 ${detail.passives.length}.`,
				ctx,
			);
		},
	);
}

// ── E.G.O ────────────────────────────────────────────────────────

const EGO_RANKS = ['ZAYIN', 'TETH', 'HE', 'WAW', 'ALEPH'] as const;

function registerEgoTools(server: McpServer): void {
	defineTool(
		server,
		'list_egos',
		{
			title: 'E.G.O 목록',
			description:
				'E.G.O 요약 목록을 커서 페이지(50건)로 준다(컷신 전용은 뺀다). ' +
				'행 { id, sinnerId, name, fellBack, rank, sin, attackType, season, keywords, siteUrl }. ' +
				'rank 는 ZAYIN · TETH · HE · WAW · ALEPH, sin 은 각성 죄악 하나, keywords 는 상태에서 뽑은 기믹 키워드 id(인격의 키워드와 유래가 다르다). ' +
				'필터: sinnerId(1–12, list_vocab.sinners) · rank(대소문자 무관) · sin(id 또는 ko/en 이름). 모르는 값은 오류. ' +
				'세부(비용 · 내성 · 스킬 · 침식 확률)는 get_ego 에 id 를 넘긴다.',
			inputSchema: {
				locale: localeArg,
				sinnerId: intArg.optional().describe('수감자 id 1–12'),
				rank: z.string().max(10).optional().describe('ZAYIN · TETH · HE · WAW · ALEPH (대소문자 무관)'),
				sin: z.string().max(40).optional().describe('각성 죄악 — wrath · 분노 · Wrath …'),
				cursor: cursorArg,
			},
			outputSchema: envelopeShape({
				...pageShape(
					z.object({
						id: z.number(),
						sinnerId: z.number(),
						name: z.string().nullable(),
						fellBack: z.boolean(),
						rank: z.string().nullable(),
						sin: z.string().nullable(),
						attackType: z.string().nullable(),
						season: z.number().nullable(),
						keywords: z.array(z.string()),
						siteUrl: z.string(),
					}),
				),
			}),
			annotations: READ_ONLY,
		},
		async (args, ctx) => {
			const { locale } = args;
			const sinnerId = intIn('sinnerId', args.sinnerId, 1, 12);
			const rank = cleanText(args.rank)?.toUpperCase();
			if (rank !== undefined && !(EGO_RANKS as readonly string[]).includes(rank)) {
				throw new ToolInputError(`모르는 rank: 「${args.rank}」 — 받는 값: ${EGO_RANKS.join(' · ')}`);
			}
			const [rows, vocab] = await Promise.all([listEgosFull(locale), vocabIndex(ctx.dataVersion)]);
			const sinRaw = cleanText(args.sin);
			const sin = sinRaw === undefined ? undefined : resolveSin(vocab, sinRaw);
			const filtered = rows.filter(
				(r) =>
					(sinnerId === undefined || r.sinnerId === sinnerId) &&
					(rank === undefined || r.rank === rank) &&
					(sin === undefined || r.sin === sin),
			);
			const page = paginate(filtered, cleanText(args.cursor), scopeOf(ctx, { locale, sinnerId, rank, sin }));
			const items = page.items.map((r) => ({
				id: Number(r.id),
				sinnerId: r.sinnerId,
				name: r.text?.name ?? null,
				fellBack: r.text?.fellBack ?? false,
				rank: r.rank,
				sin: r.sin,
				attackType: r.attackType,
				season: r.season,
				keywords: r.keywords,
				siteUrl: siteUrl(locale, 'egos', r.id),
			}));
			return ok(
				{ items, total: page.total, nextCursor: page.nextCursor },
				pageSummary('E.G.O', page.total, items.length, page.nextCursor),
				ctx,
			);
		},
	);

	defineTool(
		server,
		'get_ego',
		{
			title: 'E.G.O 상세',
			description:
				'E.G.O 하나의 세부. name · fellBack · sinnerId · sinner · rank · season · releaseDate · awakenAffinity/awakenAtkType(각성 죄악 · 공격 유형) · ' +
				'corrosionAffinity/corrosionAtkType(침식) · extractable · maxThreadspin · costs(죄악 자원 소모 { sin, amount }) · resists(죄악별 내성) · ' +
				'statuses · keywords(axisRef 포함) · corrosion(정신력 sp 별 침식 확률) · skills(role = 각성/침식, stages · coins) · passives · sinNames/atkNames · uptie { shown, max } · siteUrl. ' +
				"기본은 최고 단계 하나만 준다 — 단계별 변화가 필요하면 uptie: 'all' 또는 숫자. " +
				`${placeholderNote} id 는 list_egos · search 의 id. 없는 id 와 컷신 전용(목록에 없는) E.G.O 는 isError.`,
			inputSchema: { id: idArg.describe('E.G.O id (예: 20101)'), locale: localeArg, uptie: uptieArg },
			outputSchema: envelopeShape({
				id: z.number(),
				name: z.string().nullable().describe('E.G.O 이름'),
				fellBack: z.boolean(),
				sinnerId: z.number(),
				sinner: named,
				rank: z.string().nullable(),
				season: z.number().nullable(),
				releaseDate: z.string().nullable().describe('출시일 (ISO 8601)'),
				awakenAffinity: z.string().nullable(),
				awakenAtkType: z.string().nullable(),
				corrosionAffinity: z.string().nullable(),
				corrosionAtkType: z.string().nullable(),
				extractable: z.boolean(),
				maxThreadspin: z.number().nullable(),
				costs: z.array(z.looseObject({ sin: z.string(), amount: z.number() })),
				resists: z.array(z.looseObject({ sin: z.string(), value: z.number() })),
				statuses: z.array(statusRow).describe('본문에 나오는 상태 { id, name } — 설명문은 list_statuses'),
				keywords: z.array(keywordRow),
				corrosion: z
					.array(z.looseObject({ sp: z.number(), probability: z.number() }))
					.describe('정신력(SP −45..45)별 침식 확률'),
				sinNames: z.record(z.string(), z.string()),
				atkNames: z.record(z.string(), z.string()),
				skills: z.array(
					z.looseObject({
						id: z.number(),
						role: z.string(),
						stages: z.array(z.looseObject({ uptie: z.number() })),
					}),
				),
				passives: z.array(z.object({ index: z.number(), name: z.string().nullable(), desc: z.string().nullable(), fellBack: z.boolean() })),
				uptie: uptieShape,
				siteUrl: z.string(),
			}),
			annotations: READ_ONLY,
		},
		async ({ id, locale, uptie }, ctx) => {
			const n = toId(id);
			// 컷신 전용(presentationOnly)은 플레이할 수 없어 목록에 없다 — 상세도 없는 id 로 친다.
			const row = await canonical.ego.findUnique({ where: { id: String(n) }, select: { presentationOnly: true } });
			const [full, vocab] = await Promise.all([
				row && !row.presentationOnly ? getEgo(n, locale) : Promise.resolve(null),
				vocabIndex(ctx.dataVersion),
			]);
			if (!full) return fail(`없는 id: E.G.O ${id} — list_egos 나 search 로 id 를 확인하세요`);
			const max = maxOf(full.skills.flatMap((s) => s.stages.map((st) => st.uptie)));
			const shown = pickUptie(uptie, max);
			const detail = egoAtUptie(full, shown);
			const data = {
				...flattenTop(detail),
				statuses: compactStatuses(detail.statuses),
				keywords: detail.keywords.map((k) => ({ id: k.id, ...flatName(k.text), axisRef: vocab.keywordRef(k.id) })),
				passives: stripMedia(detail.passives.map((p) => ({ index: p.index, ...flatDesc(p.text) }))),
				uptie: { shown, max },
				siteUrl: siteUrl(locale, 'egos', detail.id),
			};
			return ok(
				data,
				`E.G.O ${detail.id} ${detail.text?.name ?? '(이름 없음)'}${detail.sinner ? ` · ${detail.sinner.name}` : ''} · ${detail.rank ?? '등급 없음'} · ` +
					`단계 ${shown === 'all' ? `전부(최고 ${max})` : `${shown}/${max}`} · 스킬 ${detail.skills.length}.`,
				ctx,
			);
		},
	);
}

// ── 어휘 ─────────────────────────────────────────────────────────

const vocabRow = z.object({ id: z.string(), name: z.string().nullable(), fellBack: z.boolean() });
const vocabAxisRow = vocabRow.extend({
	axisRef: z
		.string()
		.nullable()
		.describe('엔진 축 값 — list_identities 의 keyword 필터와 axes 에 쓰인다. 그런 축이 없으면 null'),
});

type Text = { name: string; fellBack: boolean } | null;
const flat = (text: Text) => ({ name: text?.name ?? null, fellBack: text?.fellBack ?? false });

function registerVocab(server: McpServer): void {
	defineTool(
		server,
		'list_vocab',
		{
			title: 'id ↔ 이름 사전',
			description:
				'다른 도구 응답의 id 를 이름으로 풀 사전을 한 번에 준다. ' +
				'sinners(수감자 id → 이름; list_* 의 sinnerId) · keywords(기믹 키워드 · 공격 유형) · sins(죄악 7) · ' +
				'axisLabels { associations(소속), mechanics(특수: 탄환 · 보호) }. ' +
				'keywords · sins · associations · mechanics 행의 axisRef 는 엔진 축 값(axis:VIBRATION · attack_type:slash · sin:wrath · association:ATL)이며 ' +
				'list_identities 의 keyword 필터와 axes 에 그대로 쓰인다. 대화 처음에 한 번 불러 두면 된다.',
			inputSchema: { locale: localeArg },
			outputSchema: envelopeShape({
				sinners: z.array(vocabRow.extend({ id: z.number() })),
				keywords: z.array(vocabAxisRow),
				sins: z.array(vocabAxisRow),
				axisLabels: z.object({
					associations: z.array(vocabAxisRow),
					mechanics: z.array(vocabAxisRow),
				}),
			}),
			annotations: READ_ONLY,
		},
		async ({ locale }, ctx) => {
			const [sinners, keywords, sins, labels, vocab] = await Promise.all([
				listSinners(locale),
				listKeywords(locale),
				listSins(locale),
				listAxisLabels(locale),
				vocabIndex(ctx.dataVersion),
			]);
			const known = (ref: string) => vocab.refs.get(labelKey(ref)) ?? null;
			const data = {
				sinners: sinners.map((s) => ({ id: s.id, ...flat(s.text) })),
				keywords: keywords.map((k) => ({ id: k.id, ...flat(k.text), axisRef: vocab.keywordRef(k.id) })),
				sins: sins.map((s) => ({ id: s.id, ...flat(s.text), axisRef: known(`sin:${s.id}`) })),
				axisLabels: {
					associations: labels.associations.map((a) => ({ id: a.id, ...flat(a.text), axisRef: known(`association:${a.id}`) })),
					mechanics: labels.mechanics.map((m) => ({ id: m.id, ...flat(m.text), axisRef: known(normalizeAxisRef(m.id)) })),
				},
			};
			return ok(
				data,
				`수감자 ${data.sinners.length} · 키워드 ${data.keywords.length} · 죄악 ${data.sins.length} · 소속 ${data.axisLabels.associations.length} · 특수 ${data.axisLabels.mechanics.length}.`,
				ctx,
			);
		},
	);
}

/** 조회 도구 — search · list_identities · get_identity · list_egos · get_ego · list_vocab. */
export function registerCatalogTools(server: McpServer): void {
	registerSearch(server);
	registerIdentityTools(server);
	registerEgoTools(server);
	registerVocab(server);
}
