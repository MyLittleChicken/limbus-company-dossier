import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import * as z from 'zod';
import { canonical } from '@/lib/db-canonical';
import { LOCALES, type Locale } from '@/lib/locale';
import { activeCapabilities, Profile } from '@/lib/engine/v2/profile';
import type { GiftVerdict } from '@/lib/engine/v2/types';
import { judgeGifts, recommendForSquadDetailed } from '@/lib/queries/canonical/recommend';
import { listAxisLabels } from '@/lib/queries/canonical/list';
import { listSins } from '@/lib/queries/canonical/gifts';
import { localeRows, nameOf } from '@/lib/queries/canonical/locale';
import { sinnerOf } from '@/lib/deck-code/layout';
import { DECK_CODE_MAX, deckInputShape, resolveDeck, type DeckInputArgs, type ResolvedDeck } from '../deck';
import { envelopeShape, fail, ok } from '../envelope';
import { engineData } from '../axes';
import { fireState, type FireState } from '../fire';
import { siteUrl } from '../site-url';

/**
 * 엔진 판정 도구 — 덱을 직접 넘겨 판정을 받는다(설계 §6.2).
 *
 *   decode_deck_code  덱 코드 → 편성 순서 · 출격/대기 · 장착 E.G.O      (단정)
 *   analyze_deck      편성이 공급하는 축. tag · skill 두 층을 따로 센다  (단정)
 *   check_gifts       기프트 켜짐 on · possible · off + 절 근거 + 연쇄    (단정, 강화 0단계)
 *   score_packs       팩 점수                                              (참고 — provisional)
 *
 * 출격 = 편성 순서 앞 7(덱 해석은 `../deck.ts`). 모든 응답에 `field` · `waiting` 을 실어
 * 에이전트가 어느 출격 가정으로 셌는지 보게 한다.
 */

const MAX_GIFTS = 50;
/** 보유 기프트 상한. 런 하나에 이만큼 넘게 들 일이 없다 — 입력 폭주만 막는다 */
const MAX_HELD = 200;
const TOP_GIFTS = 5;

export const STAGE_NOTE = '판정은 강화 0단계 절 기준';
export const PROVISIONAL_REASON = '저울추(적합 2 · 등급 3 · 전용 0.25)가 LLM 초안 표본에서 나왔고 사람 검토 전이다';

/** 숫자 id 입력. 숫자나 숫자 문자열 둘 다 받는다 — 응답의 기프트 id 는 늘 number */
const idInput = z.union([z.number().int(), z.string().regex(/^\d+$/)]);

const localeShape = {
	locale: z.enum(LOCALES).optional().describe("'ko' | 'en'. 기본 ko"),
};

const deployOut = {
	field: z.array(z.number()).describe('출격 인격 id, 편성 순서대로'),
	waiting: z.array(z.number()).describe('대기 인격 id, 편성 순서대로'),
	deployNote: z.string().describe('출격을 어떻게 정했나'),
};

const stateSchema = z.enum(['on', 'possible', 'off']);

const reasonSchema = z.looseObject({
	triggerId: z.string(),
	refKind: z.string(),
	refId: z.string(),
	verdict: z.enum(['satisfied', 'unsatisfied', 'unknown']),
	certainty: z.enum(['certain', 'possible']),
	have: z.number(),
	need: z.number().nullable(),
	denominator: z.string().nullable(),
	blocking: z.boolean(),
});

const DECK_INPUT_NOTE =
	'덱은 deckCode(게임 덱 코드) 또는 identityIds(편성 순서대로, 최대 12) 중 하나로 준다. ' +
	'출격은 편성 순서 1..7, 나머지는 대기(최대 5) — deployedIds 를 주면 그것이 우선한다. ' +
	'identityIds 와 함께 egoIds(장착 E.G.O)를 주면 E.G.O 장착 조건이 셈에 든다.';

function deployNote(args: { deployedIds?: unknown[] | undefined }, deck: ResolvedDeck): string {
	return args.deployedIds !== undefined
		? `출격은 deployedIds 로 정했다(${deck.field.length}명). 나머지 ${deck.waiting.length}명이 대기.`
		: `출격 = 편성 순서 1..${deck.field.length}, 나머지 ${deck.waiting.length}명이 대기 (2026-11-23 게임 편성창 대조).`;
}

type IdentityTexts = Array<{ locale: string; name: string; title: string | null }>;

/** 인격 이름은 `title` 이다(`name` 은 수감자 이름). 두 줄 이름을 한 줄로 편다 */
function identityName(rows: IdentityTexts, locale: Locale): { name: string | null; fellBack: boolean } {
	const pick = rows.find((r) => r.locale === locale) ?? rows.find((r) => r.locale === 'en');
	if (!pick) return { name: null, fellBack: false };
	return { name: (pick.title ?? pick.name).replace(/\s+/g, ' ').trim(), fellBack: pick.locale !== locale };
}

interface LoadedDeck {
	deck: ResolvedDeck;
	names: Map<number, { name: string | null; fellBack: boolean }>;
}

type Checked<T> = { ok: true; value: T } | { ok: false; result: CallToolResult };

/**
 * 덱을 풀고, 편성 인격 · 장착 E.G.O 가 DB 에 있는지 본다.
 *
 * 형식만 맞는 없는 id 를 그대로 엔진에 넘기면 축이 0 으로 세어져 「공급 없음」이 성공처럼
 * 보인다. 없는 것은 실패로 돌려준다.
 */
async function loadDeck(args: DeckInputArgs, locale: Locale): Promise<Checked<LoadedDeck>> {
	const r = await resolveDeck(args);
	if (!r.ok) return { ok: false, result: fail(r.reason) };
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
	if (missing.length > 0) return { ok: false, result: fail(`없는 인격 id: ${missing.join(', ')}`) };
	const foundEgo = new Set(egos.map((e) => e.id));
	const missingEgo = deck.egoIds.filter((id) => !foundEgo.has(String(id)));
	if (missingEgo.length > 0) return { ok: false, result: fail(`없는 E.G.O id: ${missingEgo.join(', ')}`) };

	const names = new Map(identities.map((i) => [Number(i.id), identityName(i.texts, locale)]));
	return { ok: true, value: { deck, names } };
}

/** 기프트 이름(강화 0단계 문구). 없는 id 는 Map 에 없다 */
async function giftNames(ids: string[], locale: Locale): Promise<Map<string, { name: string | null; fellBack: boolean }>> {
	if (ids.length === 0) return new Map();
	const rows = await canonical.gift.findMany({
		where: { id: { in: ids } },
		select: { id: true, stages: { where: { level: 0 }, include: { texts: localeRows(locale) } } },
	});
	return new Map(rows.map((g) => {
		const n = nameOf(g.stages[0]?.texts ?? [], locale);
		return [g.id, { name: n?.name ?? null, fellBack: n?.fellBack ?? false }];
	}));
}

const uniq = <T>(xs: T[]): T[] => [...new Set(xs)];

/** 보유 기프트 id 를 검사해 문자열로. 없는 id 가 있으면 실패 */
async function heldOf(ids: Array<number | string> | undefined, locale: Locale): Promise<Checked<string[]>> {
	const held = uniq((ids ?? []).map((x) => String(Number(x))));
	if (held.length === 0) return { ok: true, value: [] };
	const names = await giftNames(held, locale);
	const missing = held.filter((id) => !names.has(id));
	if (missing.length > 0) return { ok: false, result: fail(`없는 보유 기프트 id: ${missing.join(', ')}`) };
	return { ok: true, value: held };
}

/**
 * 축 이름표. `listAxisLabels` 의 키워드 · 특수 · 소속과 `listSins` 의 죄악에서 찾는다.
 * 엔진의 키워드 축 id 는 대문자(`axis:COMBUSTION`)이고 이름표 id 는 `Combustion` 이라
 * 대소문자를 무시하고 맞춘다. 못 찾으면 null — 이름을 지어내지 않는다.
 */
async function axisLabeler(locale: Locale): Promise<(refKind: string, refId: string) => string | null> {
	const [labels, sins] = await Promise.all([listAxisLabels(locale), listSins(locale)]);
	const up = (s: string) => s.toUpperCase();
	const keyword = new Map(labels.keywords.map((k) => [up(k.id), k.text?.name ?? null]));
	const mechanic = new Map(labels.mechanics.map((m) => [up(m.id), m.text?.name ?? null]));
	const association = new Map(labels.associations.map((a) => [a.id, a.text?.name ?? null]));
	const sin = new Map(sins.map((s) => [String(s.id), s.text?.name ?? null]));
	return (refKind, refId) => {
		switch (refKind) {
			case 'axis': return keyword.get(up(refId)) ?? mechanic.get(up(refId)) ?? null;
			case 'association': return association.get(refId) ?? null;
			case 'sin':
			case 'resonance': return sin.get(refId) ?? null;
			default: return null;
		}
	};
}

/** analyze_deck 의 보유 게이트 단서. 보유를 주면 check_gifts · score_packs 와 같은 공급이 된다 */
function gateNote(held: string[]): string {
	return held.length > 0
		? `보유 기프트 ${held.length}개로 gift_held 게이트를 열었다. 같은 덱 · 보유면 check_gifts · score_packs 와 같은 공급이다.`
		: 'heldGiftIds 를 안 줘서 gift_held(기프트 보유) 게이트 행은 닫힌 채 셌다.';
}

const STATE_RANK: Record<FireState, number> = { on: 0, possible: 1, off: 2 };

export function registerEngineTools(server: McpServer): void {
	server.registerTool(
		'decode_deck_code',
		{
			title: '덱 코드 풀기',
			description:
				'게임 덱 코드를 편성 순서대로 푼다 — 인격 id · 이름 · 수감자 · 장착 E.G.O id · 출격/대기. ' +
				'덱 코드에 출격 칸은 따로 없고 편성 순서 1..7 이 출격, 나머지가 대기다(게임 편성창과 대조). ' +
				'잘못된 코드는 isError 로 어느 단계에서 실패했는지 준다.',
			inputSchema: { deckCode: z.string().min(1).max(DECK_CODE_MAX).describe('게임 덱 코드'), ...localeShape },
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
			annotations: { readOnlyHint: true, openWorldHint: false },
		},
		async (args) => {
			const locale = args.locale ?? 'ko';
			const loaded = await loadDeck({ deckCode: args.deckCode }, locale);
			if (!loaded.ok) return loaded.result;
			const { deck, names } = loaded.value;
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
			);
		},
	);

	server.registerTool(
		'analyze_deck',
		{
			title: '덱 축 공급',
			description:
				'편성이 공급하는 축(키워드 · 죄악 · 공명 · 소속 · 메카닉 · 공격 유형 …)을 센다. 단정. ' +
				'두 층을 섞지 않는다: tag(인격 취급 — 「화상 인격 N명」 같은 인원 조건이 센다)는 편성 · 출격 · 대기 세 분모로, ' +
				'skill(스킬 취급 — 「화상을 부여하는 스킬 사용 시」 같은 조건)은 출격 인원으로 준다. ' +
				"affects 가 'both' 인 능력은 정의상 두 층 모두에 미치므로 tag 와 skill 양쪽에 센다(중복 계산이 아니다). " +
				'E.G.O 장착 · 소속 인원 · 기프트 보유(heldGiftIds) 같은 게이트를 연 뒤 센다. ' + DECK_INPUT_NOTE,
			inputSchema: {
				...deckInputShape,
				heldGiftIds: z.array(idInput).max(MAX_HELD).optional().describe('런 중 보유 기프트 id — gift_held 게이트를 연다. 저장하지 않는다'),
				...localeShape,
			},
			outputSchema: envelopeShape({
				...deployOut,
				gateNote: z.string().describe('기프트 보유 게이트를 열었나'),
				supply: z.array(z.object({
					refKind: z.string().describe('axis · sin · resonance · association · unit_keyword · attack_type · skill_kind · coin'),
					refId: z.string(),
					label: z.string().nullable(),
					tag: z.object({ roster: z.number(), field: z.number(), waiting: z.number() }),
					skill: z.object({ field: z.number() }),
				})),
			}),
			annotations: { readOnlyHint: true, openWorldHint: false },
		},
		async (args) => {
			const locale = args.locale ?? 'ko';
			const loaded = await loadDeck(args, locale);
			if (!loaded.ok) return loaded.result;
			const { deck } = loaded.value;
			const held = await heldOf(args.heldGiftIds, locale);
			if (!held.ok) return held.result;
			const [data, label] = await Promise.all([engineData(), axisLabeler(locale)]);

			// 보유를 Profile · activeCapabilities 양쪽에 같이 넘긴다 — 판정 도구와 같은 공급이 되게
			const profile = new Profile(deck.squad, data.capabilities, held.value);
			// 스킬 취급 — 게이트를 연 능력 중 affects 가 skill · both 인 것, 출격 인격만
			const fieldSet = new Set(deck.squad.field);
			const skillBy = new Map<string, Set<string>>();
			for (const c of activeCapabilities(deck.squad, data.capabilities, held.value)) {
				if (c.affects !== 'skill' && c.affects !== 'both') continue;
				if (!fieldSet.has(c.identityId)) continue;
				const key = `${c.refKind}|${c.refId}`;
				const set = skillBy.get(key);
				if (set === undefined) skillBy.set(key, new Set([c.identityId]));
				else set.add(c.identityId);
			}

			const keys = uniq(data.capabilities.map((c) => `${c.refKind}|${c.refId}`));
			const supply = keys
				.map((k) => {
					const [refKind = '', refId = ''] = k.split('|');
					return {
						refKind,
						refId,
						label: label(refKind, refId),
						tag: {
							roster: profile.count(refKind, refId, 'roster'),
							field: profile.count(refKind, refId, 'field'),
							waiting: profile.count(refKind, refId, 'waiting'),
						},
						skill: { field: skillBy.get(k)?.size ?? 0 },
					};
				})
				.filter((s) => s.tag.roster > 0 || s.skill.field > 0)
				.sort((a, b) =>
					b.tag.field - a.tag.field || b.tag.roster - a.tag.roster || b.skill.field - a.skill.field
					|| a.refKind.localeCompare(b.refKind) || a.refId.localeCompare(b.refId));

			const axes = supply.filter((s) => s.refKind === 'axis' && s.tag.field > 0)
				.map((s) => `${s.label ?? s.refId} ${s.tag.field}`);
			return ok(
				{ field: deck.field, waiting: deck.waiting, deployNote: deployNote(args, deck), gateNote: gateNote(held.value), supply },
				`편성 ${deck.order.length} · 출격 ${deck.field.length} · 대기 ${deck.waiting.length}. ` +
				`출격 기준 키워드 축(tag): ${axes.length > 0 ? axes.join(', ') : '없음'}. 공급 항목 ${supply.length}개.`,
			);
		},
	);

	server.registerTool(
		'check_gifts',
		{
			title: '기프트 켜짐 판정',
			description:
				'기프트 id 들이 이 편성에서 켜지는지 판정한다. 단정. state 는 세 값: ' +
				'on(모든 조건 확정 충족) · possible(못 켠다는 근거는 없으나 전투 중 조건 · 판정 불가가 남음) · off(막는 조건이 확정 미충족, reasons 에 근거). ' +
				"판정 데이터가 없는 기프트는 possible + reason 'no-judgement-data'. " +
				'판정은 강화 0단계 절만 본다. heldGiftIds(런 중 보유 기프트)를 주면 그것이 켜는 연쇄 깊이(chainDepth)와 보유 게이트까지 본다. ' +
				DECK_INPUT_NOTE,
			inputSchema: {
				...deckInputShape,
				giftIds: z.array(idInput).min(1).max(MAX_GIFTS).describe(`판정할 기프트 id, 최대 ${MAX_GIFTS}`),
				heldGiftIds: z.array(idInput).max(MAX_HELD).optional().describe('런 중 보유 기프트 id. 저장하지 않는다'),
				...localeShape,
			},
			outputSchema: envelopeShape({
				...deployOut,
				stageNote: z.string(),
				gifts: z.array(z.object({
					id: z.number(),
					name: z.string().nullable(),
					fellBack: z.boolean(),
					state: stateSchema,
					reason: z.literal('no-judgement-data').optional(),
					grade: z.enum(['A', 'B', 'C']).nullable().describe('A 전부 판정 가능 · B 일부 · C 판정 불가. 판정 데이터가 없으면 null'),
					decidable: z.number(),
					satisfied: z.number(),
					certain: z.number(),
					total: z.number(),
					reasons: z.array(reasonSchema),
					chainDepth: z.number().nullable().describe('보유 기프트가 이것을 켜는 홉 수. 없으면 null'),
				})),
			}),
			annotations: { readOnlyHint: true, openWorldHint: false },
		},
		async (args) => {
			const locale = args.locale ?? 'ko';
			const loaded = await loadDeck(args, locale);
			if (!loaded.ok) return loaded.result;
			const { deck } = loaded.value;
			const held = await heldOf(args.heldGiftIds, locale);
			if (!held.ok) return held.result;

			const ids = uniq(args.giftIds.map((x) => String(Number(x))));
			const names = await giftNames(ids, locale);
			const missing = ids.filter((id) => !names.has(id));
			if (missing.length > 0) return fail(`없는 기프트 id: ${missing.join(', ')}`);

			const { verdicts, chainDepth } = await judgeGifts({ squad: deck.squad, heldGiftIds: held.value, data: await engineData() });
			const gifts = ids.map((id) => {
				const v: GiftVerdict | undefined = verdicts.get(id);
				const fire = fireState(v);
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
					reasons: (v?.reasons ?? []).map((r) => ({ ...r })),
					chainDepth: chainDepth.get(id) ?? null,
				};
			});
			const tally = (s: FireState) => gifts.filter((g) => g.state === s).length;
			return ok(
				{ field: deck.field, waiting: deck.waiting, deployNote: deployNote(args, deck), stageNote: STAGE_NOTE, gifts },
				`기프트 ${gifts.length}개: on ${tally('on')} · possible ${tally('possible')} · off ${tally('off')}. ${STAGE_NOTE}.`,
			);
		},
	);

	server.registerTool(
		'score_packs',
		{
			title: '팩 점수 (참고)',
			description:
				'층 · 난이도 · 보유 기프트로 후보 팩마다 점수를 준다. **참고값이다(provisional)** — 저울추가 사람 검토 전이라 ' +
				'순위를 사실처럼 단정하지 말 것. 점수 = (fit 덱 적합도 + fusion 합성 도달) × live 켜짐 비율. ' +
				'rankable 이 false 면 편성이 축을 공급하지 않아 점수가 전부 0 이고 팩 id 순이다. ' +
				'topGifts 는 팩 기프트 중 보유하지 않은 것을 켜짐(on → possible → off) 순으로 5개. ' + DECK_INPUT_NOTE,
			inputSchema: {
				...deckInputShape,
				floor: z.number().int().min(1).max(15).describe('층 1–15'),
				difficulty: z.enum(['normal', 'hard']).default('hard').describe('기본 hard'),
				heldGiftIds: z.array(idInput).max(MAX_HELD).optional().describe('런 중 보유 기프트 id. 저장하지 않는다'),
				...localeShape,
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
					siteUrl: z.string(),
					topGifts: z.array(z.object({
						id: z.number(),
						name: z.string().nullable(),
						state: stateSchema,
						reason: z.literal('no-judgement-data').optional(),
					})),
				})),
			}),
			annotations: { readOnlyHint: true, openWorldHint: false },
		},
		async (args) => {
			const locale = args.locale ?? 'ko';
			const difficulty = args.difficulty ?? 'hard';
			const loaded = await loadDeck(args, locale);
			if (!loaded.ok) return loaded.result;
			const { deck } = loaded.value;
			const held = await heldOf(args.heldGiftIds, locale);
			if (!held.ok) return held.result;

			// 캐시한 엔진 데이터를 넘기고, 점수와 **같은 판정**(verdicts)으로 topGifts 의 켜짐을 낸다.
			// PackLine 은 「판정 없음」과 「조건 0개」를 못 가리므로 verdicts 를 직접 본다
			const data = await engineData();
			const { recommendation: rec, verdicts } = await recommendForSquadDetailed(locale, {
				squad: deck.squad, floor: args.floor, difficulty, heldGiftIds: held.value, data,
			});

			const packs = rec.packs.map((p) => {
				const topGifts = p.gifts
					.filter((g) => !g.owned)
					.map((g, i) => ({ g, i, fire: fireState(verdicts.get(String(g.id))) }))
					.sort((a, b) => STATE_RANK[a.fire.state] - STATE_RANK[b.fire.state] || a.i - b.i)
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
					score: p.score,
					fit: p.fit,
					live: p.live,
					fusion: p.fusion,
					siteUrl: siteUrl(locale, 'packs', p.id),
					topGifts,
				};
			});
			const top = packs.slice(0, 3).map((p) => `${p.name ?? p.id} ${p.score.toFixed(2)}`).join(', ');
			return ok(
				{
					field: deck.field, waiting: deck.waiting, deployNote: deployNote(args, deck),
					provisional: true as const, provisionalReason: PROVISIONAL_REASON,
					floor: args.floor, difficulty, rankable: rec.rankable, packs,
				},
				`참고값(provisional) — ${args.floor}층 ${difficulty} 후보 팩 ${packs.length}개. ` +
				(rec.rankable ? `상위: ${top || '없음'}.` : '편성이 축을 공급하지 않아 순위를 매길 수 없다(팩 id 순).'),
			);
		},
	);
}
