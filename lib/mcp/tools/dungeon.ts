import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import * as z from 'zod';
import { canonical } from '@/lib/db-canonical';
import { cacheReference } from '@/lib/query-cache';
import type { Named } from '@/lib/queries/shared';
import {
	GIFT_TIERS,
	NO_KEYWORD,
	getGift,
	listCurseBlessingGiftIds,
	listGiftsUnpaged,
	listKeywords,
	type GiftFilter,
} from '@/lib/queries/canonical/gifts';
import { listPacks } from '@/lib/queries/canonical/packs';
import { getPack } from '@/lib/queries/canonical/detail';
import { floorBounds } from '@/lib/queries/canonical/floor-range';
import { getDungeon, listFloorPacks, listStatusesUnpaged } from '@/lib/queries/canonical/reference';
import {
	READ_ONLY,
	cleanText,
	cursorArg,
	idArg,
	localeArg,
	packIdArg,
	pageShape,
	queryArg,
	toId,
	toPackId,
} from '../args';
import { defineTool, ToolInputError, type ToolCtx } from '../define-tool';
import { envelopeShape, fail, ok } from '../envelope';
import { paginate } from '../page';
import { siteUrl } from '../site-url';

/**
 * 거울 던전 조회 도구 — 기프트 · 팩 · 층 · 던전 · 상태(설계 §6.1).
 *
 * 질의 함수(`lib/queries/canonical/*`)는 화면용이다. 여기서 에이전트용 모양으로 편다(§6.3):
 *   - 출력은 **명시 매핑**이다 — 아이콘 · 스프라이트 · 아트는 처음부터 옮기지 않는다. 링크는 `siteUrl`.
 *   - `{ text: { name, fellBack } }` 를 `{ name, fellBack }` 로 편다 — 목록 행을 짧게.
 *   - id 형식: 기프트 id 는 number, 팩 id 는 string. 입력은 number · 숫자 문자열 둘 다 받는다.
 *   - 목록은 커서 페이지(`paginate`). 커서 범위(scope)에 `ctx.dataVersion` 을 넣어 데이터가
 *     바뀌면 이전 커서를 거절한다. 세부는 `get_*` 가 준다.
 *   - 중첩 참조(팩 안의 기프트, 기프트 안의 팩)에는 siteUrl 을 일부러 안 단다 — id 로 get_* 를 부르면 있다.
 */

// ── 공통 ─────────────────────────────────────────────────────────

const NESTED_NOTE = '중첩된 기프트 · 팩 참조에는 siteUrl 이 없다 — 그 id 로 get_gift · get_pack 을 부르면 siteUrl 이 있다.';

/** 이름이 어느 로케일에도 없으면 `name: null` — 문자열을 지어내지 않는다. */
const flat = (t: Named | null | undefined) => ({ name: t?.name ?? null, fellBack: t?.fellBack ?? false });

/** 커서 범위 — 도구 이름 + 정규화된 필터 + 데이터 판. 판이 바뀌면 이전 커서는 「다른 질의」다. */
const scopeOf = (tool: string, filters: Record<string, unknown>, ctx: ToolCtx) =>
	JSON.stringify({ tool, ...filters, dataVersion: ctx.dataVersion });

const pageSummary = (what: string, total: number, shown: number, next: string | null) =>
	`${what} ${total}개 중 ${shown}개${next ? ' — 다음 페이지는 nextCursor' : ''}.`;

/** 강화 단계 표기 — 게임이 카드에 찍는 그대로. */
const STAGE_LABEL: Record<number, string> = { 0: '0', 1: '+', 2: '++' };

// ── 키워드 어휘 ───────────────────────────────────────────────────

/**
 * 공격 유형 키워드 → 엔진 축 표기. 엔진은 `attack_type:slash · pierce · blunt` 로 쓰고
 * 기프트 키워드 id 는 `Slash · Penetrate · Hit` 이다(실측, v_identity_capability).
 */
const ATTACK_TYPE_AXIS: Readonly<Record<string, string>> = { Slash: 'slash', Penetrate: 'pierce', Hit: 'blunt' };

/**
 * 기프트 키워드 어휘 — 입력 정규화와 출력 `axisRef` 를 한 곳에서.
 *
 * 받는 표기(대소문자 무시): 키워드 id(`Combustion`) · 엔진 축 표기(`axis:COMBUSTION` ·
 * `attack_type:slash`) · ko/en 이름(`화상` · `Burn`) · 접두어 뒤 이름(`axis:burn`) · `none`.
 * 키워드 없음(`None` 행 · `범용` · `Keywordless`)은 `none` 으로 모은다 — `listGifts` 의 `none` 은
 * `None` 행과 null 둘 다 본다.
 */
export const keywordVocab = cacheReference(async () => {
	const [ko, en, axes] = await Promise.all([
		listKeywords('ko'),
		listKeywords('en'),
		canonical.axis.findMany({ select: { id: true } }),
	]);
	const axisIds = new Set(axes.map((a) => a.id));
	const enName = new Map(en.map((k) => [k.id, k.text?.name ?? null]));
	const axisRefOf = (id: string): string | null => {
		if (axisIds.has(id.toUpperCase())) return `axis:${id.toUpperCase()}`;
		const attack = ATTACK_TYPE_AXIS[id];
		return attack ? `attack_type:${attack}` : null;
	};
	const entries = ko.map((k) => ({
		id: k.id,
		axisRef: axisRefOf(k.id),
		ko: k.text?.name ?? null,
		en: enName.get(k.id) ?? null,
	}));
	const aliases = new Map<string, string>();
	const add = (alias: string | null, target: string) => {
		if (!alias) return;
		const key = alias.trim().toLowerCase();
		if (key && !aliases.has(key)) aliases.set(key, target);
	};
	add(NO_KEYWORD, NO_KEYWORD);
	for (const e of entries) {
		const target = e.id === 'None' ? NO_KEYWORD : e.id;
		for (const alias of [e.id, e.axisRef, e.ko, e.en]) add(alias, target);
	}
	return {
		entries,
		axisRef: Object.fromEntries(entries.map((e) => [e.id, e.axisRef])) as Record<string, string | null>,
		aliases,
	};
}, 60_000);

type KeywordVocab = Awaited<ReturnType<typeof keywordVocab>>;

/** 키워드 필터 값 하나 → `listGifts` 가 받는 값. 모르면 `ToolInputError` + 받는 값 목록. */
export function normalizeGiftKeyword(raw: string, vocab: KeywordVocab): string {
	const key = raw.trim().toLowerCase();
	const hit = vocab.aliases.get(key) ?? (key.includes(':') ? vocab.aliases.get(key.slice(key.indexOf(':') + 1)) : undefined);
	if (hit) return hit;
	const accepted = vocab.entries
		.filter((e) => e.id !== 'None')
		.map((e) => `${e.id}(${[e.axisRef, e.ko, e.en].filter(Boolean).join(' · ')})`)
		.join(', ');
	throw new ToolInputError(
		`모르는 키워드: '${raw}'. 받는 값 (대소문자 무관): ${accepted}, 그리고 'none'(키워드 없음 · 범용 · Keywordless).`,
	);
}

/** 키워드 객체 — id · 이름(fellBack 포함) · 엔진 축 표기. id 가 없으면 null. */
const keywordOf = (vocab: KeywordVocab) => (id: string | null, t: Named | null | undefined) =>
	id === null ? null : { id, ...flat(t), axisRef: vocab.axisRef[id] ?? null };

// ── 저주 · 축복 ──────────────────────────────────────────────────

const curseBlessing = cacheReference(listCurseBlessingGiftIds, 60_000);

const CURSE_NOTE =
	'저주로 얻고 조건을 채우면 축복으로 바뀌는 기프트 무리다. 저주 쪽은 설명문(「기프트가 변경」)으로 가린 확정이다(거울 던전만). ' +
	'축복 쪽과 짝(pairGuess)은 「저주 id + 1 이면서 3 등급 · 키워드 없음」 규칙으로 가린 추정(inferred)이다 — ' +
	'게임 데이터에 둘을 잇는 값은 없다 (pair inferred from id + 1, not in data).';

// ── 층 ───────────────────────────────────────────────────────────

/**
 * floor 필터. 표기를 못 읽은 구간(floorFrom/To null)은 그 층을 포함하는지 알 수 없어 빼되,
 * 조용히 빼지 않고 그 수와 표기를 note 에 적는다. floor 가 없으면 아무것도 빼지 않는다.
 * 읽는 규칙은 `floor-range.ts` 하나다(추천의 `rangeCovers` 와 같다).
 */
export function filterByFloor<G extends { difficulty: string; range: string; floorFrom: number | null; floorTo: number | null }>(
	groups: G[],
	floor: number | undefined,
): { groups: G[]; note: string | null } {
	if (floor === undefined) return { groups, note: null };
	const unreadable = groups.filter((g) => g.floorFrom === null || g.floorTo === null);
	const note = unreadable.length
		? `구간 표기를 못 읽어 floor 필터에서 뺀 구간 ${unreadable.length}개: ` +
			unreadable.map((g) => `${g.difficulty} '${g.range}'`).join(', ')
		: null;
	return {
		groups: groups.filter(
			(g) => g.floorFrom !== null && g.floorTo !== null && g.floorFrom <= floor && floor <= g.floorTo,
		),
		note,
	};
}

// ── 출력 모양 ─────────────────────────────────────────────────────

const NAME = {
	name: z.string().nullable(),
	fellBack: z.boolean().describe('요청 로케일 문구가 없어 영어로 대신했다'),
};

const KEYWORD = z
	.object({
		id: z.string().describe("키워드 id. 'None' = 키워드 없음(범용)"),
		...NAME,
		axisRef: z
			.string()
			.nullable()
			.describe("엔진 축 표기 (analyze_deck · list_identities 의 keyword 와 같다, 예 'axis:COMBUSTION' · 'attack_type:slash'). 축이 아니면 null"),
	})
	.nullable();

const GIFT_ROW = z.object({
	id: z.number().describe('기프트 id → get_gift'),
	...NAME,
	tier: z.string().describe("등급 '1'~'5' · 'EX'"),
	keyword: KEYWORD,
	enhanceable: z.boolean(),
	hardOnly: z.boolean().describe('하드 난이도 전용'),
	mdCost: z.number().nullable().describe('상점 가격'),
	packCount: z.number().describe('이 기프트가 풀에 든 팩 수'),
	exclusiveCount: z.number().describe('전용 팩 수 (0 = 범용 풀)'),
	siteUrl: z.string(),
});

const PACK_REF = z.object({ id: z.string().describe('팩 id → get_pack'), ...NAME });
const GIFT_REF = z.object({ id: z.number().describe('기프트 id → get_gift'), ...NAME });
const PACK_GIFT = GIFT_REF.extend({
	tier: z.string(),
	keywordId: z.string().nullable().describe('키워드 id — 이름 · axisRef 는 distribution.keyword 에'),
});
const FLOOR = z.object({
	difficulty: z.string().describe("'normal' | 'hard'"),
	range: z.string().describe("층 구간 표기 — '1' · '6-10'"),
});

const PACK_ROW = z.object({
	id: z.string().describe('팩 id → get_pack'),
	...NAME,
	category: z.string(),
	variant: z.string().nullable(),
	chapter: z.number().nullable(),
	superposition: z.boolean().nullable(),
	extreme: z.boolean().nullable(),
	giftCount: z.number().describe('기프트 풀 크기'),
	exclusiveCount: z.number().describe('전용 기프트 수'),
	bossCount: z.number(),
	floors: z.array(FLOOR).describe('등장 층 · 난이도'),
	siteUrl: z.string(),
});

const STATUS_ROW = z.object({
	id: z.string(),
	buffType: z.string().nullable().describe("'Positive' | 'Negative' | 'Neutral'"),
	...NAME,
	desc: z.string().nullable().describe('설명. 없으면 null (결손 그대로)'),
});

// ── 등록 ─────────────────────────────────────────────────────────

export function registerDungeonTools(server: McpServer): void {
	// ── list_gifts ──
	defineTool(
		server,
		'list_gifts',
		{
			title: 'E.G.O 기프트 목록',
			description:
				'거울 던전(Mirror Dungeon) E.G.O 기프트(gift) 요약 목록 — 사이트 기프트 목록과 같은 범위. ' +
				'행: id(number) · 이름 · 등급(tier) · 키워드(keyword {id, name, axisRef}) · 강화 가능(enhanceable) · 하드 전용(hardOnly) · ' +
				'가격(mdCost) · 팩 수(packCount · exclusiveCount) · siteUrl. 50개씩 커서 페이지(nextCursor). ' +
				'강화 단계별 효과 문구 · 등장 팩 · 합성 레시피는 get_gift(id) 로 본다. ' +
				"필터: q(이름·설명 부분 일치), tiers(['1'..'5','EX']), keywords — 키워드 id('Combustion' · 'Laceration' · 'Vibration' · " +
				"'Burst' · 'Sinking' · 'Breath' · 'Charge' · 'Slash' · 'Penetrate' · 'Hit' · 'Random'), 엔진 축 표기('axis:COMBUSTION' · " +
				"'attack_type:slash'), ko/en 이름('화상' · 'Burn') 모두 받는다(대소문자 무관). 'none' = 키워드 없음. 모르는 값은 isError + 받는 값 목록. " +
				"enhanceable, hardOnly, pool('exclusive' 전용 팩 기프트 | 'general' 범용).",
			inputSchema: {
				locale: localeArg,
				q: queryArg.optional().describe('이름 · 설명 부분 일치 (대소문자 무시)'),
				tiers: z.array(z.enum(GIFT_TIERS)).max(20).optional().describe("등급 '1'~'5' · 'EX' (여럿이면 OR)"),
				keywords: z
					.array(z.string().max(64))
					.max(20)
					.optional()
					.describe("키워드 (여럿이면 OR) — id · axisRef · ko/en 이름. 'none' = 키워드 없음"),
				enhanceable: z.boolean().optional(),
				hardOnly: z.boolean().optional(),
				pool: z.enum(['exclusive', 'general']).optional(),
				cursor: cursorArg,
			},
			outputSchema: envelopeShape(pageShape(GIFT_ROW)),
			annotations: READ_ONLY,
		},
		async ({ locale, q, tiers, keywords, enhanceable, hardOnly, pool, cursor }, ctx) => {
			const vocab = await keywordVocab();
			const filter: Omit<GiftFilter, 'page'> = {
				q: cleanText(q),
				tiers: [...new Set(tiers ?? [])].sort(),
				keywords: [...new Set((keywords ?? []).map((k) => normalizeGiftKeyword(k, vocab)))].sort(),
				enhanceable,
				hardOnly,
				pool,
			};
			const kw = keywordOf(vocab);
			// 화면 질의(`listGifts`)와 같은 where · 정렬을 한 번에 읽는다.
			const rows = (await listGiftsUnpaged(locale, filter)).map((g) => ({
				id: g.id,
				...flat(g.text),
				tier: g.tier,
				keyword: kw(g.keywordId, g.keyword),
				enhanceable: g.enhanceable,
				hardOnly: g.hardOnly,
				mdCost: g.mdCost,
				packCount: g.packCount,
				exclusiveCount: g.exclusiveCount,
				siteUrl: siteUrl(locale, 'gifts', g.id),
			}));
			const { items, nextCursor, total } = paginate(rows, cursor, scopeOf('list_gifts', { locale, ...filter }, ctx));
			return ok({ items, total, nextCursor }, pageSummary('기프트', total, items.length, nextCursor), ctx);
		},
	);

	// ── get_gift ──
	defineTool(
		server,
		'get_gift',
		{
			title: 'E.G.O 기프트 상세',
			description:
				'E.G.O 기프트 하나의 상세. 강화 단계(stages: 0 · + · ++)별 이름과 효과 문구(desc), ' +
				'전용 팩(exclusivePacks)과 기프트 풀에 든 팩(packs — 팩 id 는 get_pack 으로), ' +
				'합성 레시피(recipes — 재료 기프트 id 는 get_gift 로)와 이 기프트를 재료로 쓰는 기프트(usedIn), ' +
				'저주·축복(curse/blessing) 무리와 짝 추정(curseBlessing), siteUrl. id 는 list_gifts · get_pack · search 에서 얻는다. ' +
				`${NESTED_NOTE} 없는 id 면 isError.`,
			inputSchema: { id: idArg.describe('기프트 id (예 9001 또는 "9001")'), locale: localeArg },
			outputSchema: envelopeShape({
				id: z.number(),
				...NAME,
				tier: z.string(),
				keyword: KEYWORD,
				enhanceable: z.boolean(),
				hardOnly: z.boolean(),
				mdCost: z.number().nullable(),
				stages: z
					.array(
						z.object({
							level: z.number().describe('0 · 1 · 2'),
							label: z.string().describe("'0' · '+' · '++'"),
							name: z.string().nullable(),
							desc: z.string().nullable(),
							fellBack: z.boolean(),
						}),
					)
					.describe('강화 단계별 문구. 강화 불가 기프트는 0 단계 하나'),
				exclusivePacks: z.array(PACK_REF).describe('이 기프트가 전용으로 나오는 팩'),
				packs: z.array(PACK_REF).describe('이 기프트가 풀에 든 팩'),
				recipes: z
					.array(
						z.object({
							id: z.string(),
							slots: z.array(
								z.object({
									count: z.number(),
									options: z.array(GIFT_REF).describe('이 칸에 넣을 수 있는 재료 (하나 고른다)'),
								}),
							),
						}),
					)
					.describe('이 기프트를 만드는 합성(fusion) 레시피'),
				usedIn: z.array(GIFT_REF).describe('이 기프트를 재료로 쓰는 합성 결과물'),
				curseBlessing: z
					.object({
						role: z.enum(['curse', 'blessing']).describe('이 기프트가 저주 쪽인가 축복 쪽인가'),
						inferred: z.boolean().describe('true = 이 기프트의 무리 소속이 추정이다 (축복 쪽)'),
						curseIds: z.array(z.number()).describe('저주 기프트 — 설명문으로 가린 확정'),
						blessingIds: z.array(z.number()).describe('축복 기프트 — 추정 (저주 id + 1 · 3 등급 · 키워드 없음)'),
						pairGuess: z
							.object({ curseId: z.number(), blessingId: z.number(), inferred: z.literal(true) })
							.nullable()
							.describe('이 기프트의 짝 추정 (저주 id + 1 규칙). 규칙에 맞는 짝이 없으면 null'),
						note: z.string(),
					})
					.nullable()
					.describe('저주·축복 기프트면 그 무리, 아니면 null'),
				siteUrl: z.string(),
			}),
			annotations: READ_ONLY,
		},
		async ({ id, locale }, ctx) => {
			const gid = toId(id);
			const [g, cb, vocab] = await Promise.all([getGift(gid, locale), curseBlessing(), keywordVocab()]);
			if (!g) return fail(`없는 id: 기프트 ${gid} — list_gifts 나 search 로 id 를 찾으세요`);
			const ref = (x: { id: number; text: Named | null }) => ({ id: x.id, ...flat(x.text) });
			const packRef = (x: { id: string; text: Named | null }) => ({ id: x.id, ...flat(x.text) });
			const stage0 = g.stages.find((st) => st.level === 0) ?? g.stages[0];
			const role = cb.curse.includes(g.id) ? 'curse' : cb.blessing.includes(g.id) ? 'blessing' : null;
			const pair = cb.pairs.find((p) => p.curseId === g.id || p.blessingId === g.id);
			const data = {
				id: g.id,
				...flat(stage0?.text),
				tier: g.tier,
				keyword: keywordOf(vocab)(g.keywordId, g.keyword),
				enhanceable: g.enhanceable,
				hardOnly: g.hardOnly,
				mdCost: g.mdCost,
				stages: g.stages.map((st) => ({
					level: st.level,
					label: STAGE_LABEL[st.level] ?? String(st.level),
					name: st.text?.name ?? null,
					desc: st.text?.desc ?? null,
					fellBack: st.text?.fellBack ?? false,
				})),
				exclusivePacks: g.exclusivePacks.map(packRef),
				packs: g.packs.map(packRef),
				recipes: g.recipes.map((rc) => ({
					id: rc.id,
					slots: rc.slots.map((sl) => ({ count: sl.count, options: sl.options.map(ref) })),
				})),
				usedIn: g.usedIn.map(ref),
				curseBlessing: role === null
					? null
					: {
						role,
						inferred: role === 'blessing',
						curseIds: cb.curse,
						blessingIds: cb.blessing,
						pairGuess: pair ? { curseId: pair.curseId, blessingId: pair.blessingId, inferred: true as const } : null,
						note: CURSE_NOTE,
					},
				siteUrl: siteUrl(locale, 'gifts', g.id),
			};
			const label = data.stages.map((st) => st.label).join('/');
			return ok(data, `기프트 ${g.id} ${data.name ?? '(이름 없음)'} — 등급 ${g.tier}, 단계 ${label}, 팩 ${data.packs.length}곳.`, ctx);
		},
	);

	// ── list_packs ──
	defineTool(
		server,
		'list_packs',
		{
			title: '테마 팩 목록',
			description:
				'거울 던전 테마 팩(theme pack) 요약 목록. 행: id(string) · 이름 · 분류(category: keyword · sin · canto · ' +
				'attack_type · event · extreme · railway · walpurgis) · 기프트 풀 크기(giftCount · exclusiveCount) · ' +
				'보스 수 · 등장 층(floors) · siteUrl. 50개씩 커서 페이지. 팩의 기프트 목록 · 보스는 get_pack(id). ' +
				'층별로 어떤 팩이 나오는지는 list_floor_packs. q 는 팩 이름 검색 (한글 초성 검색 가능).',
			inputSchema: {
				locale: localeArg,
				q: queryArg.optional().describe('팩 이름 검색 (ko · en 이름 모두, 한글 초성 가능)'),
				cursor: cursorArg,
			},
			outputSchema: envelopeShape(pageShape(PACK_ROW)),
			annotations: READ_ONLY,
		},
		async ({ locale, q, cursor }, ctx) => {
			const query = cleanText(q);
			const rows = (await listPacks(locale, { q: query })).map((p) => ({
				id: p.id,
				...flat(p.text),
				category: p.category,
				variant: p.variant,
				chapter: p.chapter,
				superposition: p.superposition,
				extreme: p.extreme,
				giftCount: p.giftCount,
				exclusiveCount: p.exclusiveCount,
				bossCount: p.bossCount,
				floors: p.floors.map((f) => ({ difficulty: f.difficulty, range: f.range })),
				siteUrl: siteUrl(locale, 'packs', p.id),
			}));
			const { items, nextCursor, total } = paginate(rows, cursor, scopeOf('list_packs', { locale, q: query }, ctx));
			return ok({ items, total, nextCursor }, pageSummary('팩', total, items.length, nextCursor), ctx);
		},
	);

	// ── get_pack ──
	defineTool(
		server,
		'get_pack',
		{
			title: '테마 팩 상세',
			description:
				'테마 팩 하나의 상세. 등장 층 · 난이도(floors), 보스 조우(bosses — 적 이름 · 수), ' +
				'전용 기프트(exclusiveGifts)와 기프트 풀(gifts — 전부, 최소 필드 {id, name, tier, keywordId}; 각 id 는 get_gift 로), ' +
				'풀 크기(giftCount · exclusiveGiftCount), 풀의 등급 · 키워드 분포(distribution — 키워드 id ↔ 이름 · axisRef 사전 겸), siteUrl. ' +
				`id 는 list_packs · list_floor_packs · get_gift 에서 얻는다. ${NESTED_NOTE} 없는 id 면 isError.`,
			inputSchema: { id: packIdArg.describe("팩 id (예 '1101' 또는 1101)"), locale: localeArg },
			outputSchema: envelopeShape({
				id: z.string(),
				...NAME,
				category: z.string(),
				variant: z.string().nullable(),
				chapter: z.number().nullable(),
				superposition: z.boolean().nullable(),
				extreme: z.boolean().nullable(),
				floorLength: z.number().nullable(),
				floors: z.array(FLOOR),
				bosses: z.array(
					z.object({
						encounterId: z.string(),
						targets: z.array(
							z.object({
								groupIndex: z.number().describe('웨이브(wave) 차례'),
								index: z.number(),
								name: z.string(),
								count: z.number().nullable().describe('등장 수. 원본에 없으면 null'),
							}),
						),
					}),
				),
				giftCount: z.number().describe('기프트 풀 크기 (= gifts 길이)'),
				exclusiveGiftCount: z.number().describe('전용 기프트 수 (= exclusiveGifts 길이)'),
				exclusiveGifts: z.array(PACK_GIFT).describe('이 팩 전용 기프트'),
				gifts: z.array(PACK_GIFT).describe('이 팩의 기프트 풀 전부 (등급 · id 순)'),
				distribution: z.object({
					tier: z.array(z.object({ tier: z.string(), count: z.number() })).describe('풀의 등급별 수 (많은 순)'),
					keyword: z
						.array(z.object({ keyword: KEYWORD, count: z.number() }))
						.describe('풀의 키워드별 수 (많은 순). keyword null = 키워드 칸이 비었다'),
				}),
				siteUrl: z.string(),
			}),
			annotations: READ_ONLY,
		},
		async ({ id, locale }, ctx) => {
			const packId = toPackId(id);
			const [p, vocab] = await Promise.all([getPack(packId, locale), keywordVocab()]);
			if (!p) return fail(`없는 id: 팩 ${packId} — list_packs 나 search 로 id 를 찾으세요`);
			const kw = keywordOf(vocab);
			type Row = (typeof p.gifts)[number];
			const gift = (g: Row) => ({ id: g.id, ...flat(g.text), tier: g.tier, keywordId: g.keywordId });

			// 분포 — 질의의 tally 와 같은 순서(많은 순, 같으면 처음 나온 차례). 키워드는 id 로 묶는다.
			const tally = <K>(keyOf: (g: Row) => K) => {
				const counts = new Map<K, { count: number; first: Row }>();
				for (const g of p.gifts) {
					const k = keyOf(g);
					const e = counts.get(k);
					if (e) e.count += 1;
					else counts.set(k, { count: 1, first: g });
				}
				return [...counts.entries()].sort((a, b) => b[1].count - a[1].count);
			};
			const distribution = {
				tier: tally((g) => g.tier).map(([tier, e]) => ({ tier, count: e.count })),
				keyword: tally((g) => g.keywordId).map(([, e]) => ({ keyword: kw(e.first.keywordId, e.first.keyword), count: e.count })),
			};

			const data = {
				id: p.id,
				...flat(p.text),
				category: p.category,
				variant: p.variant,
				chapter: p.chapter,
				superposition: p.superposition,
				extreme: p.extreme,
				floorLength: p.floorLength,
				floors: p.floors.map((f) => ({ difficulty: f.difficulty, range: f.range })),
				bosses: p.bosses.map((b) => ({
					encounterId: b.encounterId,
					targets: b.targets.map((t) => ({
						groupIndex: t.groupIndex,
						index: t.index,
						name: t.text.name,
						count: t.count,
					})),
				})),
				giftCount: p.gifts.length,
				exclusiveGiftCount: p.exclusiveGifts.length,
				exclusiveGifts: p.exclusiveGifts.map(gift),
				gifts: p.gifts.map(gift),
				distribution,
				siteUrl: siteUrl(locale, 'packs', p.id),
			};
			const floors = data.floors.map((f) => `${f.difficulty} ${f.range}`).join(', ') || '없음';
			return ok(
				data,
				`팩 ${p.id} ${data.name ?? '(이름 없음)'} — 기프트 풀 ${data.giftCount} (전용 ${data.exclusiveGiftCount}), 등장 층 ${floors}.`,
				ctx,
			);
		},
	);

	// ── list_floor_packs ──
	defineTool(
		server,
		'list_floor_packs',
		{
			title: '층별 등장 팩',
			description:
				'거울 던전 층(floor) · 난이도(difficulty)별로 등장할 수 있는 테마 팩. 구간 표기는 hard 1 · 2 · 3 · 4 · 5 · 6-10 · 11-15, ' +
				'normal 1–5. floor 를 주면 그 층을 포함하는 구간만, difficulty 를 주면 그 난이도만. ' +
				'구간 표기를 못 읽으면 floorFrom/floorTo 가 null 이고, floor 필터에서 빠진 수를 note 에 적는다. ' +
				'팩 id(string) 는 get_pack 으로 상세(기프트 풀 · 보스 · siteUrl)를 본다. 페이지 없음 (전체 구간이 한 번에).',
			inputSchema: {
				locale: localeArg,
				floor: z.number().int().min(1).max(15).optional().describe('층 번호 1–15'),
				difficulty: z.enum(['normal', 'hard']).optional(),
			},
			outputSchema: envelopeShape({
				groups: z.array(
					z.object({
						difficulty: z.string(),
						range: z.string(),
						floorFrom: z.number().nullable().describe('구간 시작 층. 표기를 못 읽으면 null'),
						floorTo: z.number().nullable().describe('구간 끝 층. 표기를 못 읽으면 null'),
						packs: z.array(PACK_REF),
					}),
				),
				note: z.string().nullable().describe('floor 필터에서 표기를 못 읽어 뺀 구간이 있으면 그 수와 표기'),
			}),
			annotations: READ_ONLY,
		},
		async ({ locale, floor, difficulty }, ctx) => {
			const byDifficulty = (await listFloorPacks(locale))
				.map((g) => ({
					difficulty: g.difficulty as string,
					range: g.range,
					...floorBounds(g.range),
					packs: g.packs.map((p) => ({ id: p.id, ...flat(p.text) })),
				}))
				.filter((g) => difficulty === undefined || g.difficulty === difficulty);
			const { groups, note } = filterByFloor(byDifficulty, floor);
			const packCount = groups.reduce((n, g) => n + g.packs.length, 0);
			return ok(
				{ groups, note },
				`구간 ${groups.length}개 · 팩 ${packCount}건${floor ? ` (층 ${floor})` : ''}${difficulty ? ` [${difficulty}]` : ''}.` +
					(note ? ` ${note}` : ''),
				ctx,
			);
		},
	);

	// ── get_dungeon ──
	defineTool(
		server,
		'get_dungeon',
		{
			title: '거울 던전 구성 · 은총',
			description:
				'현재 거울 던전(Mirror Dungeon) 판의 구성 — 판(version 예 MD7) · 이름 · 전체 층 수(totalFloors) · ' +
				'기본 층 수(baseFloors, normal 의 층 수) · 은총(grace — 별빛 강화) 목록(비용 cost · 강화 단계별 효과 descs). 인자는 locale 뿐.',
			inputSchema: { locale: localeArg },
			outputSchema: envelopeShape({
				version: z.string(),
				...NAME,
				totalFloors: z.number(),
				baseFloors: z.number(),
				graces: z.array(
					z.object({
						id: z.string(),
						cost: z.number(),
						...NAME,
						descs: z.array(z.string()).describe('강화 단계별 효과 (한 단계의 여러 효과는 · 로 이음)'),
					}),
				),
			}),
			annotations: READ_ONLY,
		},
		async ({ locale }, ctx) => {
			const d = await getDungeon(locale);
			if (!d) return fail('거울 던전 데이터가 적재되어 있지 않다');
			const data = {
				version: d.version,
				...flat(d.text),
				totalFloors: d.totalFloors,
				baseFloors: d.baseFloors,
				graces: d.graces.map((g) => ({ id: g.id, cost: g.cost, name: g.name, fellBack: g.fellBack, descs: g.descs })),
			};
			return ok(data, `거울 던전 ${d.version} ${data.name ?? ''} — ${d.totalFloors}층, 은총 ${d.graces.length}종.`, ctx);
		},
	);

	// ── list_statuses ──
	defineTool(
		server,
		'list_statuses',
		{
			title: '상태 · 키워드 설명',
			description:
				'상태 효과(status · buff/debuff)와 키워드의 이름 · 설명 사전. 기프트 · 스킬 문구에 나오는 상태(예 화상 Burn · 출혈 Bleed · ' +
				'진동 Tremor · 파열 Rupture · 침잠 Sinking · 호흡 Poise · 충전 Charge)의 뜻을 찾을 때. ' +
				"q 는 이름 · 설명 검색(한글 초성 가능), buffTypes 는 'Positive' · 'Negative' · 'Neutral'. 50개씩 커서 페이지.",
			inputSchema: {
				locale: localeArg,
				q: queryArg.optional().describe('이름 · 설명 검색'),
				buffTypes: z.array(z.enum(['Positive', 'Negative', 'Neutral'])).max(20).optional(),
				cursor: cursorArg,
			},
			outputSchema: envelopeShape(pageShape(STATUS_ROW)),
			annotations: READ_ONLY,
		},
		async ({ locale, q, buffTypes, cursor }, ctx) => {
			const filter = { q: cleanText(q), buffTypes: [...new Set(buffTypes ?? [])].sort() };
			// 화면 질의(`listStatuses`)와 같은 필터 · 차례를 쪽 없이 한 번에.
			const rows = (await listStatusesUnpaged(locale, filter)).map((st) => ({
				id: st.id,
				buffType: st.buffType,
				name: st.text?.name ?? null,
				fellBack: st.text?.fellBack ?? false,
				desc: st.text?.desc ?? null,
			}));
			const { items, nextCursor, total } = paginate(rows, cursor, scopeOf('list_statuses', { locale, ...filter }, ctx));
			return ok({ items, total, nextCursor }, pageSummary('상태', total, items.length, nextCursor), ctx);
		},
	);
}
