import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import * as z from 'zod';
import { canonical } from '@/lib/db-canonical';
import { getEgo, getIdentity } from '@/lib/queries/canonical/detail';
import { listKeywords, listSins } from '@/lib/queries/canonical/gifts';
import { listAxisLabels, listEgosFull, listIdentitiesFull, listSinners } from '@/lib/queries/canonical/list';
import { searchAll, type SearchHit } from '@/lib/queries/canonical/reference';
import { axesOf, engineData, identityAxes } from '../axes';
import { currentSnapshotId, envelopeShape, fail, ok } from '../envelope';
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

const READ_ONLY = { readOnlyHint: true, openWorldHint: false } as const;

const localeArg = z
	.enum(['ko', 'en'])
	.default('ko')
	.describe("표시 로케일 'ko' | 'en' (기본 ko). 문구가 없으면 다른 로케일로 폴백하고 fellBack: true");

const cursorArg = z
	.string()
	.optional()
	.describe('직전 응답의 nextCursor 를 그대로. 필터를 바꾸면 cursor 없이 처음부터');

/** 숫자 id. 목록은 문자열('10101'), 세부는 숫자로 나오므로 둘 다 받는다. */
const idArg = (what: string) =>
	z.union([z.number().int().positive(), z.string().regex(/^\d+$/)]).describe(what);

/** 화면용 질의 결과 → 에이전트용. 이미지 · 아이콘 · 화면 링크 · 애셋 경로 값이 하나도 남지 않는다. */
const shapeOut = <T>(value: T): Record<string, unknown> => stripMedia(value) as Record<string, unknown>;

/** 빈 문자열 · 공백뿐인 필터는 없는 것으로 친다. */
const present = (v: string | undefined): string | undefined => {
	const t = v?.trim();
	return t ? t : undefined;
};

/**
 * 커서 범위. 정규화된 필터 값 + 스냅샷 id — 같은 뜻의 다른 표기는 같은 범위이고,
 * 스냅샷이 바뀌면 이전 커서는 「다른 질의」로 거절된다(행 차례가 바뀌었을 수 있다).
 */
const scopeOf = async (filters: Record<string, unknown>) =>
	JSON.stringify({ snapshotId: await currentSnapshotId(), ...filters });

const named = z
	.looseObject({ name: z.string(), fellBack: z.boolean() })
	.nullable()
	.describe('{ name, fellBack } — 없으면 null');

const described = z
	.looseObject({ name: z.string(), desc: z.string().nullable(), fellBack: z.boolean() })
	.nullable();

const pageShape = {
	total: z.number().describe('필터에 걸린 전체 수'),
	nextCursor: z.string().nullable().describe('다음 페이지 커서. null 이면 끝'),
};

const pageSummary = (what: string, total: number, shown: number, next: string | null) =>
	`${what} ${total}건 중 ${shown}건${next ? ' — 더 있다(nextCursor)' : ''}.`;

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

const keywordAxesOnly = (values: string[]) => values.filter((v) => v.startsWith('axis:'));

// ── search ───────────────────────────────────────────────────────

const SEARCH_KIND: Record<SearchHit['kind'], { site: SiteKind; tool: string }> = {
	identity: { site: 'identities', tool: 'get_identity' },
	ego: { site: 'egos', tool: 'get_ego' },
	gift: { site: 'gifts', tool: 'get_gift' },
	pack: { site: 'packs', tool: 'get_pack' },
};

function registerSearch(server: McpServer): void {
	server.registerTool(
		'search',
		{
			title: '통합 검색',
			description:
				'인격(identity) · E.G.O · 기프트(gift) · 테마 팩(pack)을 이름으로 한 번에 찾는다(기프트는 설명문도). ' +
				'한글 초성 검색(예: "ㄷㅂ")과 조합 중인 글자도 걸린다. 종류마다 최대 8건. ' +
				'각 결과 { kind, id(인격 · E.G.O · 기프트는 number, 팩은 string), name, fellBack, meta, detailTool, siteUrl } — 세부는 detailTool(get_identity · get_ego · get_gift · get_pack)에 id 를 넘긴다. ' +
				'meta 는 종류별 짧은 표지(인격: 성급을 0 개수로, E.G.O: 등급, 기프트: 등급, 팩: 분류).',
			inputSchema: {
				query: z.string().min(1).describe('검색어 (ko/en 이름 둘 다 본다)'),
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
		async ({ query, locale }) => {
			const hits = (await searchAll(query, locale)).map((h) => ({
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
				hits.length ? `「${query}」 ${hits.length}건 (${counts.join(' · ')}).` : `「${query}」에 걸린 것이 없다.`,
			);
		},
	);
}

// ── 인격 ─────────────────────────────────────────────────────────

const axesShape = z.object({
	tag: z.array(z.string()).describe('인격 취급 — 「진동 인격 N인」 같은 인격 수 조건에 드는 축'),
	skill: z.array(z.string()).describe('스킬 취급 — 「진동을 부여하는 스킬 사용 시」 같은 조건에 드는 축'),
});

function registerIdentityTools(server: McpServer): void {
	server.registerTool(
		'list_identities',
		{
			title: '인격 목록',
			description:
				'인격(identity) 요약 목록을 커서 페이지(50건)로 준다. 행 { id, sinnerId, name, fellBack, star, season, sins, axes: { tag, skill }, siteUrl }. ' +
				'행의 axes 는 키워드 축(axis:*)만 담는다 — 죄악 · 소속 · 공격 유형 등 전체 축은 get_identity. ' +
				'축은 두 층이다: tag(인격 취급) · skill(스킬 취급). 섞지 말 것 — 예: 10104 는 VIBRATION 이 skill 에만 있다. ' +
				'필터: sinnerId(list_vocab.sinners) · star(1–3) · sin(wrath·lust·sloth·gluttony·gloom·pride·envy, 스킬 죄악) · season · ' +
				"keyword + axisLayer(기본 'tag'). keyword 는 list_vocab 의 id 나 axisRef(`Vibration` · `VIBRATION` · `axis:VIBRATION` 모두 같다); " +
				'`sin:gluttony` · `association:ATL` 처럼 다른 종류의 축 값도 받는다(대소문자 무관). 빈 문자열 필터는 없는 것으로 친다. ' +
				'세부(스킬 · 패시브 · 내성 · 속도)는 get_identity 에 id 를 넘긴다.',
			inputSchema: {
				locale: localeArg,
				sinnerId: z.number().int().optional().describe('수감자 id (1–12)'),
				star: z.number().int().min(1).max(3).optional().describe('성급 1–3'),
				sin: z.string().optional().describe('스킬 죄악 (소문자 id, 예: gluttony)'),
				keyword: z.string().optional().describe('축 값 — VIBRATION · axis:VIBRATION · sin:gluttony …'),
				axisLayer: z.enum(['tag', 'skill']).default('tag').describe("keyword 를 볼 층. 기본 'tag'"),
				season: z.number().int().optional().describe('시즌 번호 (0 = 상시, 9xxx = 발푸르기스 등)'),
				cursor: cursorArg,
			},
			outputSchema: envelopeShape({
				items: z.array(
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
				...pageShape,
			}),
			annotations: READ_ONLY,
		},
		async ({ locale, sinnerId, star, sin, keyword, axisLayer, season, cursor }) => {
			const [rows, engine] = await Promise.all([listIdentitiesFull(locale), engineData()]);
			const axisMap = identityAxes(engine.capabilities);
			const sinLc = present(sin)?.toLowerCase();
			const kw = present(keyword);
			const ref = kw === undefined ? undefined : normalizeAxisRef(kw);
			const filtered = rows.filter(
				(r) =>
					(sinnerId === undefined || r.sinnerId === sinnerId) &&
					(star === undefined || r.star === star) &&
					(season === undefined || r.season === season) &&
					(sinLc === undefined || r.sins.includes(sinLc)) &&
					(ref === undefined || axesOf(axisMap, r.id)[axisLayer].includes(ref)),
			);
			const scope = await scopeOf({ locale, sinnerId, star, sin: sinLc, ref, axisLayer: ref ? axisLayer : undefined, season });
			const page = paginate(filtered, present(cursor), scope);
			const items = page.items.map((r) => {
				const axes = axesOf(axisMap, r.id);
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
				pageSummary('인격', page.total, items.length, page.nextCursor) +
					(ref ? ` 축 ${ref} (${axisLayer} 층).` : ''),
			);
		},
	);

	server.registerTool(
		'get_identity',
		{
			title: '인격 상세',
			description:
				'인격 하나의 세부. 기본 정보(sinnerId · sinner 이름 · rarity = 성급 · season · releaseDate · hpBase · hpPerLevel · defCorrection · breakSection = 흐트러짐 구간), ' +
				'resists(공격 유형별 내성) · speeds(동기화 단계별 속도) · affiliations(소속) · statuses(본문에 나오는 상태) · keywords(기믹 키워드) · ' +
				'passives · skills(동기화 단계 stages · 코인 coins 설명 포함) · sinNames/atkNames(죄악 · 공격 유형 이름표) · ' +
				'axes { tag, skill }(엔진 판정에 쓰이는 전체 축, 두 층) · siteUrl. ' +
				'id 는 list_identities · search 의 id. 수감자 이름은 list_vocab.sinners. 없는 id 면 isError.',
			inputSchema: { id: idArg('인격 id (예: 10101)'), locale: localeArg },
			outputSchema: envelopeShape({
				id: z.number(),
				sinnerId: z.number(),
				sinner: named,
				rarity: z.number().describe('성급 1–3'),
				season: z.number().nullable(),
				releaseDate: z.string().nullable().describe('출시일 (ISO 8601)'),
				hpBase: z.number().nullable(),
				hpPerLevel: z.number().nullable(),
				defCorrection: z.number().nullable(),
				breakSection: z.array(z.number()).describe('흐트러짐 구간 (길이가 인격마다 다르다)'),
				text: named.describe('인격 이름'),
				resists: z.array(z.looseObject({ atkType: z.string(), value: z.number() })),
				speeds: z.array(z.looseObject({ uptie: z.number(), min: z.number(), max: z.number() })),
				affiliations: z.array(z.looseObject({ id: z.string(), text: named })),
				statuses: z.array(z.looseObject({ id: z.string(), text: described })),
				keywords: z.array(z.looseObject({ id: z.string(), text: named })),
				sinNames: z.record(z.string(), z.string()),
				atkNames: z.record(z.string(), z.string()),
				passives: z.array(z.looseObject({ id: z.string(), text: described })),
				skills: z.array(
					z.looseObject({ id: z.number(), stages: z.array(z.looseObject({ uptie: z.number() })) }),
				),
				axes: axesShape,
				siteUrl: z.string(),
			}),
			annotations: READ_ONLY,
		},
		async ({ id, locale }) => {
			const [detail, engine] = await Promise.all([getIdentity(Number(id), locale), engineData()]);
			if (!detail) return fail(`없는 id: 인격 ${id} — list_identities 나 search 로 id 를 확인하세요`);
			const axes = axesOf(identityAxes(engine.capabilities), String(detail.id));
			const data = { ...shapeOut(detail), axes, siteUrl: siteUrl(locale, 'identities', detail.id) };
			return ok(
				data,
				`인격 ${detail.id} ${detail.text?.name ?? '(이름 없음)'}${detail.sinner ? ` · ${detail.sinner.name}` : ''} · ${detail.rarity}성 · 스킬 ${detail.skills.length} · 패시브 ${detail.passives.length}.`,
			);
		},
	);
}

// ── E.G.O ────────────────────────────────────────────────────────

function registerEgoTools(server: McpServer): void {
	server.registerTool(
		'list_egos',
		{
			title: 'E.G.O 목록',
			description:
				'E.G.O 요약 목록을 커서 페이지(50건)로 준다(컷신 전용은 뺀다). ' +
				'행 { id, sinnerId, name, fellBack, rank, sin, attackType, season, keywords, siteUrl }. ' +
				'rank 는 ZAYIN · TETH · HE · WAW · ALEPH, sin 은 각성 죄악 하나, keywords 는 상태에서 뽑은 기믹 키워드 id(인격의 키워드와 유래가 다르다). ' +
				'필터: sinnerId(list_vocab.sinners) · rank · sin. 세부(비용 · 내성 · 스킬 · 침식 확률)는 get_ego 에 id 를 넘긴다.',
			inputSchema: {
				locale: localeArg,
				sinnerId: z.number().int().optional().describe('수감자 id (1–12)'),
				rank: z.string().optional().describe('ZAYIN · TETH · HE · WAW · ALEPH'),
				sin: z.string().optional().describe('각성 죄악 (소문자 id, 예: wrath)'),
				cursor: cursorArg,
			},
			outputSchema: envelopeShape({
				items: z.array(
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
				...pageShape,
			}),
			annotations: READ_ONLY,
		},
		async ({ locale, sinnerId, rank, sin, cursor }) => {
			const rows = await listEgosFull(locale);
			const rankUc = present(rank)?.toUpperCase();
			const sinLc = present(sin)?.toLowerCase();
			const filtered = rows.filter(
				(r) =>
					(sinnerId === undefined || r.sinnerId === sinnerId) &&
					(rankUc === undefined || r.rank === rankUc) &&
					(sinLc === undefined || r.sin === sinLc),
			);
			const scope = await scopeOf({ locale, sinnerId, rank: rankUc, sin: sinLc });
			const page = paginate(filtered, present(cursor), scope);
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
			);
		},
	);

	server.registerTool(
		'get_ego',
		{
			title: 'E.G.O 상세',
			description:
				'E.G.O 하나의 세부. sinnerId · sinner · rank · season · releaseDate · awakenAffinity/awakenAtkType(각성 죄악 · 공격 유형) · ' +
				'corrosionAffinity/corrosionAtkType(침식) · extractable · maxThreadspin · costs(죄악 자원 소모 { sin, amount }) · resists(죄악별 내성) · ' +
				'statuses · keywords · corrosion(정신력 sp 별 침식 확률) · skills(role = 각성/침식, stages · coins) · passives · sinNames/atkNames · siteUrl. ' +
				'id 는 list_egos · search 의 id. 없는 id 와 컷신 전용(목록에 없는) E.G.O 는 isError.',
			inputSchema: { id: idArg('E.G.O id (예: 20101)'), locale: localeArg },
			outputSchema: envelopeShape({
				id: z.number(),
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
				text: named.describe('E.G.O 이름'),
				costs: z.array(z.looseObject({ sin: z.string(), amount: z.number() })),
				resists: z.array(z.looseObject({ sin: z.string(), value: z.number() })),
				statuses: z.array(z.looseObject({ id: z.string(), text: described })),
				keywords: z.array(z.looseObject({ id: z.string(), text: named })),
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
				passives: z.array(z.looseObject({ index: z.number(), text: described })),
				siteUrl: z.string(),
			}),
			annotations: READ_ONLY,
		},
		async ({ id, locale }) => {
			// 컷신 전용(presentationOnly)은 플레이할 수 없어 목록에 없다 — 상세도 없는 id 로 친다.
			const row = await canonical.ego.findUnique({ where: { id: String(Number(id)) }, select: { presentationOnly: true } });
			const detail = row && !row.presentationOnly ? await getEgo(Number(id), locale) : null;
			if (!detail) return fail(`없는 id: E.G.O ${id} — list_egos 나 search 로 id 를 확인하세요`);
			const data = { ...shapeOut(detail), siteUrl: siteUrl(locale, 'egos', detail.id) };
			return ok(
				data,
				`E.G.O ${detail.id} ${detail.text?.name ?? '(이름 없음)'}${detail.sinner ? ` · ${detail.sinner.name}` : ''} · ${detail.rank ?? '등급 없음'} · 스킬 ${detail.skills.length}.`,
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
	server.registerTool(
		'list_vocab',
		{
			title: 'id ↔ 이름 사전',
			description:
				'다른 도구 응답의 id 를 이름으로 풀 사전을 한 번에 준다. ' +
				'sinners(수감자 id → 이름; list_* 의 sinnerId) · keywords(기믹 키워드 · 공격 유형) · sins(죄악 7) · ' +
				'axisLabels { associations(소속), mechanics(특수: 탄환 · 보호) }. ' +
				'keywords · sins · associations · mechanics 행의 axisRef 는 엔진 축 값(axis:VIBRATION · sin:wrath · association:ATL)이며 ' +
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
		async ({ locale }) => {
			const [sinners, keywords, sins, labels, engine] = await Promise.all([
				listSinners(locale),
				listKeywords(locale),
				listSins(locale),
				listAxisLabels(locale),
				engineData(),
			]);
			const known = new Set(engine.capabilities.map((c) => `${c.refKind}:${c.refId}`));
			const withRef = (id: string, text: Text, ref: string) => ({
				id,
				...flat(text),
				axisRef: known.has(ref) ? ref : null,
			});
			const data = {
				sinners: sinners.map((s) => ({ id: s.id, ...flat(s.text) })),
				keywords: keywords.map((k) => withRef(k.id, k.text, normalizeAxisRef(k.id))),
				sins: sins.map((s) => withRef(s.id, s.text, `sin:${s.id}`)),
				axisLabels: {
					associations: labels.associations.map((a) => withRef(a.id, a.text, `association:${a.id}`)),
					mechanics: labels.mechanics.map((m) => withRef(m.id, m.text, normalizeAxisRef(m.id))),
				},
			};
			return ok(
				data,
				`수감자 ${data.sinners.length} · 키워드 ${data.keywords.length} · 죄악 ${data.sins.length} · 소속 ${data.axisLabels.associations.length} · 특수 ${data.axisLabels.mechanics.length}.`,
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
