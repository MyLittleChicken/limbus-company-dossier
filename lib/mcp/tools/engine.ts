import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import * as z from 'zod';
import { canonical } from '@/lib/db-canonical';
import type { Locale } from '@/lib/locale';
import { activeCapabilities } from '@/lib/engine/v2/profile';
import type { EngineData } from '@/lib/engine/v2/load';
import type { Reason, Squad } from '@/lib/engine/v2/types';
import { judgeGifts, rangeCovers, recommendForSquadDetailed } from '@/lib/queries/canonical/recommend';
import { identityName, listAxisLabels } from '@/lib/queries/canonical/list';
import { listSins } from '@/lib/queries/canonical/gifts';
import { localeRows, nameOf } from '@/lib/queries/canonical/locale';
import { sinnerOf } from '@/lib/deck-code/layout';
import { DECK_CODE_MAX, deckInputShape, deployCaveat, resolveDeck, type DeckInputArgs, type ResolvedDeck } from '../deck';
import { envelopeShape, ok } from '../envelope';
import { defineTool, ToolInputError } from '../define-tool';
import { idArg, localeArg, READ_ONLY, toId } from '../args';
import { engineData } from '../axes';
import { FIRE_RANK, fireState, type Doubt, type FireState } from '../fire';
import { siteUrl } from '../site-url';

/**
 * 엔진 판정 도구 — 덱을 직접 넘겨 판정을 받는다(설계 §6.2).
 *
 *   decode_deck_code  덱 코드 → 편성 순서 · 출격/대기 · 장착 E.G.O               (단정)
 *   analyze_deck      편성이 공급하는 것 — 엔진 공급 표(check_gifts 가 세는 수) 그대로 (단정)
 *   check_gifts       기프트 켜짐 on · partial · possible · off + 능력(절) 단위 근거  (단정, 강화 0단계)
 *   score_packs       팩 점수                                                       (참고 — provisional)
 *
 * 출격 = 편성 순서 앞 7(덱 해석은 `../deck.ts`). 모든 응답에 `field` · `waiting` 을 실어
 * 에이전트가 어느 출격 가정으로 셌는지 보게 한다.
 *
 * **무엇이 무엇에 드나**(리뷰 R1#3 정정). 판정(`evaluateGifts`)은 엔진 공급 표만 본다 —
 * 장착 E.G.O · 보유 기프트 게이트를 보지 않는다. E.G.O 는 analyze_deck 의 `gated` 와
 * score_packs 적합도(`Profile`)에만 들고, check_gifts 의 heldGiftIds 는 연쇄 깊이에만 쓴다.
 */

const MAX_GIFTS = 50;
/** 보유 기프트 상한. 런 하나에 이만큼 넘게 들 일이 없다 — 입력 폭주만 막는다 */
const MAX_HELD = 200;
const TOP_GIFTS = 5;
/** 1위와 이만큼 이하로 차이 나면 사실상 동점이다 — 저울추가 사람 검토 전이라 */
const NEAR_TIE = 0.01;

export const STAGE_NOTE = '판정은 강화 0단계 절 기준';
/** 스킬 공급의 한계(엔진 그대로 — MCP 는 고지하고 off 만 하향한다) */
export const SKILL_SUPPLY_NOTE =
	'스킬 공급(skill)은 코인 토큰 기준 — 스킬 효과 · 특수 변형(SinkingWhite · FusionVibration 등) 일부를 놓쳐 과소, ' +
	'소수 인격(10109 · 11109)은 축 제한(axis_restrict)이 미적용이라 과대일 수 있다';
export const STATE_NOTE =
	'on = 편성(진입 시점) 조건 확정 충족 — 전투 중 발동 조건은 범위 밖. ' +
	'partial = 켜지는 능력이 있으나 다른 능력(또는 강화 절)은 확정 미충족. ' +
	'possible = 켜지는 길이 전투 중 조건 · 판정 불가 · 조건 결손에만 기댐. off = 막는 조건이 확정 미충족. ' +
	"reason 'skill-supply-incomplete' · 'ego-not-judged' = 엔진은 미충족이라 했으나 스킬 공급 누락 · 장착 E.G.O 미판정일 수 있어 off 를 possible 로 낮춘 것. " +
	SKILL_SUPPLY_NOTE;
export const PROVISIONAL_REASON = '저울추(적합 2 · 등급 3 · 전용 0.25)가 LLM 초안 표본에서 나왔고 사람 검토 전이다';

const deployOut = {
	field: z.array(z.number()).describe('출격 인격 id, 편성 순서대로'),
	waiting: z.array(z.number()).describe('대기 인격 id, 편성 순서대로'),
	deployNote: z.string().describe('출격을 어떻게 정했나 (8–11인이면 미대조 단서 포함)'),
};

const fireSchema = z.enum(['on', 'partial', 'possible', 'off']);

const reasonSchema = z.looseObject({
	triggerId: z.string().describe('`능력/그룹/번호` — 능력 ordinal · 조건 그룹 · 그룹 안 순번'),
	refKind: z.string(),
	refId: z.string(),
	label: z.string().nullable().describe('refId 의 이름. 없으면 null'),
	verdict: z.enum(['satisfied', 'unsatisfied', 'unknown']),
	certainty: z.enum(['certain', 'possible']),
	have: z.number().describe('이 편성에서 센 수 (analyze_deck 의 같은 칸과 같다)'),
	need: z.number().nullable(),
	denominator: z.string().nullable().describe('roster · field · waiting. 문턱이 없으면 null'),
	blocking: z.boolean().describe('true = 독립 능력의 조건이라 켜짐을 막을 수 있다. false = 강화 절 조건이라 막지 않는다'),
});

const DECK_INPUT_NOTE =
	'덱은 deckCode(게임 덱 코드) 또는 identityIds(편성 순서대로, 최대 12) 중 하나로 준다. ' +
	'출격은 편성 순서 1..7, 나머지는 대기(최대 5) — deployedIds 를 주면 그것이 우선한다. ' +
	'E.G.O(덱 코드 또는 egoIds)는 analyze_deck 공급(gated)과 score_packs 적합도에만 든다 — check_gifts 판정은 E.G.O 를 보지 않는다.';

function deployNote(args: { deployedIds?: unknown[] | undefined }, deck: ResolvedDeck): string {
	if (args.deployedIds !== undefined) {
		return `출격은 deployedIds 로 정했다(${deck.field.length}명). 나머지 ${deck.waiting.length}명이 대기.`;
	}
	const base = `출격 = 편성 순서 1..${deck.field.length}, 나머지 ${deck.waiting.length}명이 대기 (2026-11-23 게임 편성창 대조).`;
	const caveat = deployCaveat(deck.order.length);
	return caveat ? `${base} ${caveat}` : base;
}

interface LoadedDeck {
	deck: ResolvedDeck;
	names: Map<number, { name: string | null; fellBack: boolean }>;
}

/**
 * 덱을 풀고, 편성 인격 · 장착 E.G.O 가 DB 에 있는지 본다. 잘못이면 `ToolInputError`.
 *
 * 형식만 맞는 없는 id 를 그대로 엔진에 넘기면 축이 0 으로 세어져 「공급 없음」이 성공처럼
 * 보인다. 없는 것은 실패로 돌려준다.
 */
async function loadDeck(args: DeckInputArgs, locale: Locale): Promise<LoadedDeck> {
	const r = await resolveDeck(args);
	if (!r.ok) throw new ToolInputError(r.reason);
	const deck = r.value;

	const [identities, egos] = await Promise.all([
		canonical.identity.findMany({
			where: { id: { in: deck.order.map(String) } },
			include: { texts: localeRows(locale) },
		}),
		deck.egoIds.length > 0
			? canonical.ego.findMany({ where: { id: { in: deck.egoIds.map(String) } }, select: { id: true } })
			: Promise.resolve([] as Array<{ id: string }>),
	]);
	const found = new Set(identities.map((i) => i.id));
	const missing = deck.order.filter((id) => !found.has(String(id)));
	if (missing.length > 0) throw new ToolInputError(`없는 인격 id: ${missing.join(', ')}`);
	const foundEgo = new Set(egos.map((e) => e.id));
	const missingEgo = deck.egoIds.filter((id) => !foundEgo.has(String(id)));
	if (missingEgo.length > 0) throw new ToolInputError(`없는 E.G.O id: ${missingEgo.join(', ')}`);

	// 인격 이름은 `title`(목록 질의와 같은 규칙 — canonical/list.ts)
	const names = new Map(identities.map((i) => [Number(i.id), identityName(i.texts, locale) ?? { name: null, fellBack: false }]));
	return { deck, names };
}

interface GiftName { name: string | null; fellBack: boolean; domain: string }

/** 기프트 이름(강화 0단계 문구)과 영역. 없는 id 는 Map 에 없다 */
async function giftNames(ids: string[], locale: Locale): Promise<Map<string, GiftName>> {
	if (ids.length === 0) return new Map();
	const rows = await canonical.gift.findMany({
		where: { id: { in: ids } },
		select: { id: true, domain: true, stages: { where: { level: 0 }, include: { texts: localeRows(locale) } } },
	});
	return new Map(rows.map((g) => {
		const n = nameOf(g.stages[0]?.texts ?? [], locale);
		return [g.id, { name: n?.name ?? null, fellBack: n?.fellBack ?? false, domain: g.domain }];
	}));
}

const uniq = <T>(xs: T[]): T[] => [...new Set(xs)];
const idStrings = (xs: Array<number | string> | undefined): string[] => uniq((xs ?? []).map((x) => String(toId(x))));

/**
 * 거울 던전 기프트 id 를 검사해 이름표와 함께 준다.
 * 없는 id · 스토리 던전 기프트는 `ToolInputError` — 판정 · 보유 모두 거울 던전 런의 일이다.
 */
async function mirrorGifts(ids: string[], locale: Locale, what: string): Promise<Map<string, GiftName>> {
	const names = await giftNames(ids, locale);
	const missing = ids.filter((id) => !names.has(id));
	if (missing.length > 0) throw new ToolInputError(`없는 ${what} id: ${missing.join(', ')}`);
	const story = ids.filter((id) => names.get(id)!.domain !== 'mirror_dungeon');
	if (story.length > 0) throw new ToolInputError(`거울 던전 기프트가 아니다(스토리 던전): ${story.join(', ')}`);
	return names;
}

type Labeler = (refKind: string, refId: string) => string | null;

/**
 * 이름표. `listAxisLabels` 의 키워드 · 특수 · 소속과 `listSins` 의 죄악에서 찾는다.
 * 엔진의 키워드 축 id 는 대문자(`COMBUSTION`)이고 이름표 id 는 `Combustion` 이라
 * 대소문자를 무시하고 맞춘다. 공격 유형(slash · pierce · blunt)은 키워드 Slash · Penetrate · Hit 다.
 * 못 찾으면 null — 이름을 지어내지 않는다.
 */
async function labeler(locale: Locale): Promise<Labeler> {
	const [labels, sins] = await Promise.all([listAxisLabels(locale), listSins(locale)]);
	const up = (s: string) => s.toUpperCase();
	const keyword = new Map(labels.keywords.map((k) => [up(k.id), k.text?.name ?? null]));
	const mechanic = new Map(labels.mechanics.map((m) => [up(m.id), m.text?.name ?? null]));
	const association = new Map(labels.associations.map((a) => [a.id, a.text?.name ?? null]));
	const sin = new Map(sins.map((s) => [String(s.id), s.text?.name ?? null]));
	const attack: Record<string, string> = { slash: 'SLASH', pierce: 'PENETRATE', blunt: 'HIT' };
	return (refKind, refId) => {
		switch (refKind) {
			case 'axis': return keyword.get(up(refId)) ?? mechanic.get(up(refId)) ?? null;
			case 'association': return association.get(refId) ?? null;
			case 'sin':
			case 'resonance': return sin.get(refId) ?? null;
			case 'attack_type': return keyword.get(attack[refId] ?? '') ?? null;
			default: return null;
		}
	};
}

const withLabel = (label: Labeler) => (r: Reason) => ({ ...r, label: label(r.refKind, r.refId) });

const countsSchema = z.object({ roster: z.number(), field: z.number(), waiting: z.number() });
type Counts = z.infer<typeof countsSchema>;

/** 엔진 공급 표의 refKind 와 `SupplyTables` 칸. analyze_deck 이 이 순서로 낸다 */
const TABLES = [
	['association', 'association'],
	['unit_keyword', 'unitKeyword'],
	['sin', 'sin'],
	['attack_type', 'attackType'],
	['skill_kind', 'skillKind'],
] as const;

/** 편성 게이트(전투 밖에서 정해지는 것). status_held 는 전투 중 상태라 여기 없다 */
const SQUAD_GATES = new Set(['ego_equipped', 'roster_count', 'gift_held']);

/**
 * 엔진 공급 표로 센다 — `countSupply`(lib/engine/v2/supply.ts)와 같은 표 · 같은 모집단.
 * 그래서 같은 덱이면 check_gifts reasons 의 `have` 와 같은 수가 나온다.
 */
function supplyOf(squad: Squad, data: EngineData, held: string[], label: Labeler) {
	const roster = squad.roster.map((r) => r.identityId);
	const fieldSet = new Set(squad.field);
	const pools = {
		roster,
		field: squad.field.filter((id) => roster.includes(id)),
		waiting: roster.filter((id) => !fieldSet.has(id)),
	};
	const counts = (set: Set<string> | undefined): Counts => ({
		roster: set ? pools.roster.filter((id) => set.has(id)).length : 0,
		field: set ? pools.field.filter((id) => set.has(id)).length : 0,
		waiting: set ? pools.waiting.filter((id) => set.has(id)).length : 0,
	});
	const t = data.supply;

	// 편성 게이트로 더 열리는 축. 층마다 엔진 표에 이미 있는 인격은 빼고 더한 몫만
	const active = activeCapabilities(squad, data.capabilities, held);
	const gatedTag = new Map<string, Set<string>>();
	const gatedSkill = new Map<string, Set<string>>();
	const add = (m: Map<string, Set<string>>, k: string, id: string) => {
		const s = m.get(k) ?? new Set<string>();
		s.add(id);
		m.set(k, s);
	};
	for (const c of active) {
		if (c.refKind !== 'axis' || !SQUAD_GATES.has(c.gateKind)) continue;
		if ((c.affects === 'tag' || c.affects === 'both') && !t.axisTag.get(c.refId)?.has(c.identityId)) add(gatedTag, c.refId, c.identityId);
		if ((c.affects === 'skill' || c.affects === 'both') && !t.axisSkill.get(c.refId)?.has(c.identityId)) add(gatedSkill, c.refId, c.identityId);
	}

	type Gated = { tag: Counts; skill: Counts };
	const rows: Array<{ refKind: string; refId: string; label: string | null; tag: Counts; skill: Counts | null; gated: Gated | null }> = [];
	const axisIds = uniq([...t.axisTag.keys(), ...t.axisSkill.keys(), ...gatedTag.keys(), ...gatedSkill.keys()]).sort();
	for (const refId of axisIds) {
		rows.push({
			refKind: 'axis', refId, label: label('axis', refId),
			tag: counts(t.axisTag.get(refId)), skill: counts(t.axisSkill.get(refId)),
			gated: { tag: counts(gatedTag.get(refId)), skill: counts(gatedSkill.get(refId)) },
		});
	}
	for (const [refKind, key] of TABLES) {
		for (const [refId, set] of [...t[key]].sort(([a], [b]) => a.localeCompare(b))) {
			rows.push({ refKind, refId, label: label(refKind, refId), tag: counts(set), skill: null, gated: null });
		}
	}
	rows.push({ refKind: 'coin', refId: 'minus', label: null, tag: counts(t.minusCoin), skill: null, gated: null });

	const any = (c: Counts | null | undefined) => c != null && c.roster > 0;
	const supply = rows.filter((r) => any(r.tag) || any(r.skill) || any(r.gated?.tag) || any(r.gated?.skill));

	// 전투 중 상태가 있어야 붙는 축 — 단정할 수 없어 공급에 안 넣고 따로 보인다
	const inRoster = new Set(roster);
	const battleOnly = data.capabilities
		.filter((c) => c.gateKind === 'status_held' && inRoster.has(c.identityId))
		.map((c) => ({
			identityId: Number(c.identityId), refKind: c.refKind, refId: c.refId,
			label: label(c.refKind, c.refId), layer: c.affects, statusId: c.gateRef,
		}));
	return { supply, battleOnly };
}

/** 조건 모집단 — `countSupply` 의 poolOf 와 같다 */
function poolOf(squad: Squad, scope: string): Set<string> {
	const roster = squad.roster.map((r) => r.identityId);
	if (scope === 'roster') return new Set(roster);
	if (scope === 'waiting') return new Set(roster.filter((id) => !squad.field.includes(id)));
	return new Set(squad.field);
}

/**
 * 하향 판단(fire.ts `Doubt`) — 엔진이 확정 미충족이라 한 axis 조건을 엔진 공급이 놓쳤을 수 있나.
 *
 *   ego-not-judged           모집단 인격의 장착 E.G.O 게이트(ego_equipped, 층이 맞는 것)가 그 축을 연다
 *   skill-supply-incomplete  supply=skill 인데 모집단에 그 축의 인격 취급(identity_axis always) 인격이 있다
 */
function doubtFor(squad: Squad, data: EngineData): (giftId: string) => Doubt {
	const egoOpen = activeCapabilities(squad, data.capabilities).filter((c) => c.gateKind === 'ego_equipped' && c.refKind === 'axis');
	return (giftId) => (r) => {
		if (r.verdict !== 'unsatisfied' || r.refKind !== 'axis') return null;
		const m = /^(\d+)\/(\d+)\/(\d+)$/.exec(r.triggerId);
		if (!m) return null;
		const cond = data.abilityConds.get(giftId)?.get(m[1]!)?.find((c) => c.group === Number(m[2]) && c.idx === Number(m[3]));
		if (!cond) return null;
		const pool = poolOf(squad, cond.scope);
		const layerOk = (affects: string) => affects === 'both' || cond.supply === 'any' || affects === cond.supply;
		if (egoOpen.some((c) => c.refId === cond.refId && pool.has(c.identityId) && layerOk(c.affects))) return 'ego-not-judged';
		if (cond.supply === 'skill' && [...pool].some((id) => data.supply.axisTag.get(cond.refId)?.has(id))) return 'skill-supply-incomplete';
		return null;
	};
}

const r3 = (x: number) => Math.round(x * 1000) / 1000;

export function registerEngineTools(server: McpServer): void {
	defineTool(
		server,
		'decode_deck_code',
		{
			title: '덱 코드 풀기',
			description:
				'게임 덱 코드를 편성 순서대로 푼다 — 인격 id · 이름 · 수감자 · 장착 E.G.O id · 출격/대기. ' +
				'덱 코드에 출격 칸은 따로 없고 편성 순서 1..7 이 출격, 나머지가 대기다(게임 편성창과 대조). ' +
				'잘못된 코드는 isError 로 어느 단계에서 실패했는지 준다.',
			inputSchema: { deckCode: z.string().min(1).max(DECK_CODE_MAX).describe('게임 덱 코드'), locale: localeArg },
			outputSchema: envelopeShape({
				order: z.array(z.object({
					position: z.number().describe('편성 순서 1부터'),
					identityId: z.number(),
					name: z.string().nullable(),
					fellBack: z.boolean(),
					sinnerId: z.number(),
					egoIds: z.array(z.number()),
					role: z.enum(['field', 'waiting']),
				})),
				...deployOut,
			}),
			annotations: READ_ONLY,
		},
		async (args, ctx) => {
			const locale = args.locale;
			const { deck, names } = await loadDeck({ deckCode: args.deckCode }, locale);
			const fieldSet = new Set(deck.field);
			const order = deck.order.map((id, i) => ({
				position: i + 1,
				identityId: id,
				name: names.get(id)?.name ?? null,
				fellBack: names.get(id)?.fellBack ?? false,
				sinnerId: sinnerOf(id),
				egoIds: (deck.squad.roster[i]?.egoIds ?? []).map(Number),
				role: fieldSet.has(id) ? 'field' as const : 'waiting' as const,
			}));
			return ok(
				{ order, field: deck.field, waiting: deck.waiting, deployNote: deployNote({}, deck) },
				`편성 ${deck.order.length} · 출격 ${deck.field.length} · 대기 ${deck.waiting.length}. ` +
				`출격: ${order.filter((o) => o.role === 'field').map((o) => o.name ?? o.identityId).join(', ')}`,
				ctx,
			);
		},
	);

	defineTool(
		server,
		'analyze_deck',
		{
			title: '덱 공급',
			description:
				'편성이 공급하는 것을 엔진 공급 표 그대로 센다 — check_gifts 조건 판정이 세는 수와 같다. 단정. ' +
				'세 분모(roster 편성 · field 출격 · waiting 대기)로 준다. ' +
				'키워드 축(axis)은 층을 섞지 않는다: tag(인격 취급 — 게임이 그 인격을 그 축으로 분류, 「화상 인격 N명」류)와 ' +
				'skill(스킬 취급 — 스킬 코인이 실제로 그 상태를 부여, 「화상을 부여하는 스킬」류)이 따로다. ' +
				'한 인격이 두 층 모두에 들 수 있다(정의상 양쪽에 미치는 것 — 중복 계산이 아니다). ' +
				'gated.tag · gated.skill 은 E.G.O 장착 · 소속 인원 같은 편성 게이트로 각 층에 더 열리는 몫이다 — score_packs 적합도는 tag+gated.tag 를 쓰고, check_gifts 판정은 gated 를 안 본다. ' +
				SKILL_SUPPLY_NOTE + '. ' +
				'sin 은 스킬 죄악이며 공명(resonance) 조건도 이 수를 센다. ' +
				'battleOnly 는 전투 중 상태가 있어야 붙는 축으로 단정이 아니라 공급에 넣지 않았다. ' + DECK_INPUT_NOTE,
			inputSchema: {
				...deckInputShape,
				heldGiftIds: z.array(idArg).max(MAX_HELD).optional().describe('런 중 보유 기프트 id — gift_held 게이트를 연다. 저장하지 않는다'),
				locale: localeArg,
			},
			outputSchema: envelopeShape({
				...deployOut,
				gateNote: z.string().describe('기프트 보유 게이트에 대해'),
				supply: z.array(z.object({
					refKind: z.string().describe('axis · association · unit_keyword · sin · attack_type · skill_kind · coin'),
					refId: z.string(),
					label: z.string().nullable(),
					tag: countsSchema,
					skill: countsSchema.nullable().describe('axis 만. 스킬 취급(coin_token)'),
					gated: z.object({ tag: countsSchema, skill: countsSchema }).nullable().describe('axis 만. 편성 게이트로 각 층에 더 열린 몫'),
				})),
				battleOnly: z.array(z.object({
					identityId: z.number(),
					refKind: z.string(),
					refId: z.string(),
					label: z.string().nullable(),
					layer: z.string().describe('tag · skill · both'),
					statusId: z.string().describe('있어야 하는 전투 중 상태'),
				})),
			}),
			annotations: READ_ONLY,
		},
		async (args, ctx) => {
			const locale = args.locale;
			const { deck } = await loadDeck(args, locale);
			const heldIds = idStrings(args.heldGiftIds);
			if (heldIds.length > 0) await mirrorGifts(heldIds, locale, '보유 기프트');
			const [data, label] = await Promise.all([engineData(ctx.dataVersion), labeler(locale)]);
			const { supply, battleOnly } = supplyOf(deck.squad, data, heldIds, label);

			const heldGates = data.capabilities.filter((c) => c.gateKind === 'gift_held').length;
			const gateNote = heldGates === 0
				? 'gift_held(기프트 보유) 게이트 행이 현재 데이터에 0개라 heldGiftIds 는 공급을 바꾸지 않는다.'
				: heldIds.length > 0
					? `보유 기프트 ${heldIds.length}개로 gift_held 게이트(${heldGates}행)를 열었다.`
					: `heldGiftIds 를 안 줘서 gift_held 게이트 ${heldGates}행은 닫힌 채 셌다.`;

			const axes = supply.filter((s) => s.refKind === 'axis' && s.tag.field > 0)
				.map((s) => `${s.label ?? s.refId} ${s.tag.field}`);
			return ok(
				{ field: deck.field, waiting: deck.waiting, deployNote: deployNote(args, deck), gateNote, supply, battleOnly },
				`편성 ${deck.order.length} · 출격 ${deck.field.length} · 대기 ${deck.waiting.length}. ` +
				`출격 기준 키워드 축(tag): ${axes.length > 0 ? axes.join(', ') : '없음'}. 공급 항목 ${supply.length}개.`,
				ctx,
			);
		},
	);

	defineTool(
		server,
		'check_gifts',
		{
			title: '기프트 켜짐 판정',
			description:
				'거울 던전 기프트 id 들이 이 편성에서 켜지는지 능력(절) 단위로 판정한다. 단정. state 는 넷: ' +
				'on(독립 능력 하나가 무조건이거나 모든 조건 그룹이 확정 충족 — 편성(진입 시점) 조건 기준, 전투 중 발동 조건은 범위 밖) · ' +
				'partial(켜지는 능력이 있으나 다른 능력 · 강화 절은 확정 미충족) · ' +
				'possible(켜지는 길이 전투 중 조건 · 판정 불가 · 조건 결손에만 기댐) · off(막는 조건이 확정 미충족). ' +
				"판정 데이터가 없는 기프트는 possible + reason 'no-judgement-data'. " +
				'abilities[].reasons 의 triggerId 는 `능력/그룹/번호`(그룹끼리 AND · 그룹 안 OR), blocking=false 는 강화 절 조건이라 켜짐을 막지 않는다. ' +
				"detail 기본 'brief' 는 on 능력의 근거를 생략하고 나머지는 충족 안 된 근거만 준다(전부는 'full'). " +
				"엔진이 미충족이라 했어도 스킬 공급 누락 · 장착 E.G.O 미판정일 수 있으면 off 대신 possible + reason('skill-supply-incomplete' · 'ego-not-judged'). " +
				SKILL_SUPPLY_NOTE + '. ' +
				'판정은 강화 0단계 절만 본다. heldGiftIds 는 연쇄 깊이(chainDepth)에만 쓴다. 스토리 던전 기프트는 받지 않는다. ' +
				DECK_INPUT_NOTE,
			inputSchema: {
				...deckInputShape,
				giftIds: z.array(idArg).min(1).max(MAX_GIFTS).describe(`판정할 거울 던전 기프트 id, 최대 ${MAX_GIFTS}`),
				heldGiftIds: z.array(idArg).max(MAX_HELD).optional().describe('런 중 보유 기프트 id — 연쇄 깊이에만 쓴다. 저장하지 않는다'),
				detail: z.enum(['brief', 'full']).default('brief')
					.describe("brief(기본): on 능력의 근거는 생략, 나머지 능력은 충족 안 된 근거만. full: 근거 전부"),
				locale: localeArg,
			},
			outputSchema: envelopeShape({
				...deployOut,
				stageNote: z.string(),
				stateNote: z.string(),
				gifts: z.array(z.object({
					id: z.number(),
					name: z.string().nullable(),
					fellBack: z.boolean(),
					state: fireSchema,
					reason: z.enum(['no-judgement-data', 'skill-supply-incomplete', 'ego-not-judged']).optional(),
					grade: z.enum(['A', 'B', 'C']).nullable().describe('A 전부 판정 가능 · B 일부 · C 판정 불가. 판정 데이터가 없으면 null'),
					decidable: z.number(),
					satisfied: z.number(),
					certain: z.number(),
					total: z.number(),
					abilities: z.array(z.object({
						ordinal: z.number(),
						refines: z.number().nullable().describe('강화 절이면 원 능력 ordinal. 독립이면 null'),
						unconditional: z.boolean(),
						state: z.enum(['on', 'possible', 'off']),
						missingConditions: z.literal(true).optional().describe('무조건이 아닌데 조건 0개 — 결손이라 막지 않는다'),
						reason: z.enum(['skill-supply-incomplete', 'ego-not-judged']).optional().describe('off 를 possible 로 낮춘 까닭'),
						reasons: z.array(reasonSchema),
						omittedReasons: z.number().optional().describe('brief 에서 생략한 근거 수(충족된 것)'),
					})),
					chainDepth: z.number().nullable().describe('보유 기프트가 이것을 켜는 홉 수. 없으면 null'),
				})),
			}),
			annotations: READ_ONLY,
		},
		async (args, ctx) => {
			const locale = args.locale;
			const { deck } = await loadDeck(args, locale);
			const heldIds = idStrings(args.heldGiftIds);
			if (heldIds.length > 0) await mirrorGifts(heldIds, locale, '보유 기프트');
			const ids = idStrings(args.giftIds);
			const names = await mirrorGifts(ids, locale, '기프트');

			const [data, label] = await Promise.all([engineData(ctx.dataVersion), labeler(locale)]);
			const { verdicts, chainDepth } = await judgeGifts({ squad: deck.squad, heldGiftIds: heldIds, data });
			const lab = withLabel(label);
			const doubt = doubtFor(deck.squad, data);
			const brief = args.detail === 'brief';
			const gifts = ids.map((id) => {
				const v = verdicts.get(id);
				const fire = fireState(v, data.abilities.get(id) ?? [], doubt(id));
				return {
					id: Number(id),
					name: names.get(id)?.name ?? null,
					fellBack: names.get(id)?.fellBack ?? false,
					state: fire.state,
					...(fire.reason ? { reason: fire.reason } : {}),
					grade: v?.grade ?? null,
					decidable: v?.decidable ?? 0,
					satisfied: v?.satisfied ?? 0,
					certain: v?.certain ?? 0,
					total: v?.total ?? 0,
					abilities: fire.abilities.map((a) => {
						if (!brief) return { ...a, reasons: a.reasons.map(lab) };
						// brief — on 능력은 근거 전부 생략, 나머지는 막는 · 남은(충족 안 된) 근거만
						const kept = a.state === 'on' ? [] : a.reasons.filter((r) => r.verdict !== 'satisfied');
						const omitted = a.reasons.length - kept.length;
						return { ...a, reasons: kept.map(lab), ...(omitted > 0 ? { omittedReasons: omitted } : {}) };
					}),
					chainDepth: chainDepth.get(id) ?? null,
				};
			});
			const tally = (s: FireState) => gifts.filter((g) => g.state === s).length;
			return ok(
				{
					field: deck.field, waiting: deck.waiting, deployNote: deployNote(args, deck),
					stageNote: STAGE_NOTE, stateNote: STATE_NOTE, gifts,
				},
				`기프트 ${gifts.length}개: on ${tally('on')} · partial ${tally('partial')} · possible ${tally('possible')} · off ${tally('off')}. ${STAGE_NOTE}.`,
				ctx,
			);
		},
	);

	defineTool(
		server,
		'score_packs',
		{
			title: '팩 점수 (참고)',
			description:
				'층 · 난이도 · 보유 기프트로 후보 팩마다 점수를 준다. **참고값이다(provisional)** — 저울추가 사람 검토 전이라 ' +
				'순위를 사실처럼 단정하지 말 것. 점수 = (fit 덱 적합도 + fusion 합성 도달) × live 켜짐 비율, 소수 셋째 자리 반올림. ' +
				`1위와 ${NEAR_TIE} 이하 차이면 nearTie: true — 사실상 동점이다. ` +
				'rankable 이 false 면 편성이 축을 공급하지 않아 점수가 전부 0 이고 팩 id 순이다. ' +
				'난이도마다 유효 층이 다르다(normal 은 1–5층) — 밖이면 오류. ' +
				'topGifts 는 팩 기프트 중 보유하지 않은 것을 켜짐(on → partial → possible → off) 순으로 5개. ' +
				'보유 기프트는 후보에서 빠지고 합성 · 연쇄 셈에 든다. ' + DECK_INPUT_NOTE,
			inputSchema: {
				...deckInputShape,
				floor: z.number().int().min(1).max(15).describe('층 1–15 (normal 은 1–5)'),
				difficulty: z.enum(['normal', 'hard']).default('hard').describe('기본 hard'),
				heldGiftIds: z.array(idArg).max(MAX_HELD).optional().describe('런 중 보유 기프트 id. 저장하지 않는다'),
				locale: localeArg,
			},
			outputSchema: envelopeShape({
				...deployOut,
				provisional: z.literal(true),
				provisionalReason: z.string(),
				floor: z.number(),
				difficulty: z.enum(['normal', 'hard']),
				rankable: z.boolean(),
				packs: z.array(z.object({
					id: z.string(),
					name: z.string().nullable(),
					score: z.number(),
					fit: z.number(),
					live: z.number(),
					fusion: z.number(),
					nearTie: z.boolean().describe(`1위와 ${NEAR_TIE} 이하 차이 (1위는 2위가 그렇다면 true)`),
					siteUrl: z.string(),
					topGifts: z.array(z.object({
						id: z.number(),
						name: z.string().nullable(),
						state: fireSchema,
						reason: z.enum(['no-judgement-data', 'skill-supply-incomplete', 'ego-not-judged']).optional(),
					})),
				})),
			}),
			annotations: READ_ONLY,
		},
		async (args, ctx) => {
			const locale = args.locale;
			const difficulty = args.difficulty;
			const { deck } = await loadDeck(args, locale);
			const heldIds = idStrings(args.heldGiftIds);
			if (heldIds.length > 0) await mirrorGifts(heldIds, locale, '보유 기프트');

			const ranges = await canonical.floorPack.findMany({ where: { difficulty }, distinct: ['floorRange'], select: { floorRange: true } });
			const valid = Array.from({ length: 15 }, (_, i) => i + 1).filter((f) => ranges.some((r) => rangeCovers(r.floorRange, f)));
			if (!valid.includes(args.floor)) {
				const span = valid.length > 0 ? `${valid[0]}–${valid[valid.length - 1]}층` : '없음';
				throw new ToolInputError(`${difficulty} 난이도에 ${args.floor}층이 없다 — 유효 층: ${span}`);
			}

			// 캐시한 엔진 데이터를 넘기고, 점수와 **같은 판정**(verdicts)으로 topGifts 의 켜짐을 낸다
			const data = await engineData(ctx.dataVersion);
			const { recommendation: rec, verdicts } = await recommendForSquadDetailed(locale, {
				squad: deck.squad, floor: args.floor, difficulty, heldGiftIds: heldIds, data,
			});

			const doubt = doubtFor(deck.squad, data);
			const scored = rec.packs.map((p) => {
				const topGifts = p.gifts
					.filter((g) => !g.owned)
					.map((g, i) => ({ g, i, fire: fireState(verdicts.get(String(g.id)), data.abilities.get(String(g.id)) ?? [], doubt(String(g.id))) }))
					.sort((a, b) => FIRE_RANK[a.fire.state] - FIRE_RANK[b.fire.state] || a.i - b.i)
					.slice(0, TOP_GIFTS)
					.map(({ g, fire }) => ({
						id: g.id,
						name: g.name,
						state: fire.state,
						...(fire.reason ? { reason: fire.reason } : {}),
					}));
				return {
					id: p.id,
					name: p.name,
					score: r3(p.score),
					fit: r3(p.fit),
					live: r3(p.live),
					fusion: r3(p.fusion),
					siteUrl: siteUrl(locale, 'packs', p.id),
					topGifts,
				};
			});
			const topScore = scored[0]?.score ?? 0;
			const near = (s: number) => rec.rankable && topScore - s <= NEAR_TIE + 1e-9;
			const packs = scored.map((p, i) => ({
				...p,
				nearTie: rec.rankable && (i === 0 ? scored.length > 1 && near(scored[1]!.score) : near(p.score)),
			}));

			const top = packs.slice(0, 3).map((p) => `${p.name ?? p.id} ${p.score.toFixed(3)}${p.nearTie ? '≈' : ''}`).join(', ');
			return ok(
				{
					field: deck.field, waiting: deck.waiting, deployNote: deployNote(args, deck),
					provisional: true as const, provisionalReason: PROVISIONAL_REASON,
					floor: args.floor, difficulty, rankable: rec.rankable, packs,
				},
				`참고값(provisional) — ${args.floor}층 ${difficulty} 후보 팩 ${packs.length}개. ` +
				(rec.rankable ? `상위: ${top || '없음'} (≈ 는 1위와 사실상 동점).` : '편성이 축을 공급하지 않아 순위를 매길 수 없다(팩 id 순).'),
				ctx,
			);
		},
	);
}
