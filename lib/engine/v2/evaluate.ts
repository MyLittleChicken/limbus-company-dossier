/**
 * 설계 16절 3·4단계 — 트리거를 판정하고 기프트에 등급을 매긴다.
 *
 * **결합을 접지 않는다(결정 2).** 실측으로 291/451 이 「일부만 판정 가능」이고,
 * 거기서 AND 를 가정하면 과소, OR 를 가정하면 과대가 된다. 「5개 중 3개 충족」이
 * 사용자에게 가장 정확한 답이다.
 *
 * **판정 불가를 목록에서 빼지 않는다(결정 4).** 98/451 을 감추면 사용자가 존재를
 * 모른다. 등급 C 로 표시만 하고 점수에서 뺀다.
 */
import { judgeGift, type Ability, type AbilityCond } from './ability.js';
import type { Profile } from './profile.js';
import type { SupplyTables } from './supply.js';
import type { GiftVerdict, Reason, RefVerdict, Squad, TriggerParam, TriggerRef } from './types.js';

/**
 * 공명의 기본 임계. **게임 규칙이지 우리 데이터가 아니다** — 어느 출처에도
 * 구조화돼 있지 않아 여기 상수로 둔다. `gift_trigger_param` 에 그 기프트만의
 * 임계가 있으면 그쪽이 이긴다.
 */
const RESONANCE_MIN = 3;

/** 죄악 일곱. `Any Resonance` 는 이 중 **최댓값**을 봐야 해서 조인으로는 안 닿는다 */
const SINS = ['wrath', 'lust', 'sloth', 'gluttony', 'gloom', 'pride', 'envy'];

/**
 * 「누구에게 적용되는가」를 말하는 참조. 켜짐의 조건이 아니다.
 *
 * 게이트가 없는 기프트에서만 쓰인다 — 게이트가 있으면 게이트 짝만 막고
 * 나머지는 전부 안 막는다(수혜 대상이든 적용 범위든).
 */
const SCOPE_KINDS = new Set(['association', 'unit_keyword']);

/** 옛 판정이 보는 것. 대조가 끝나면 이 타입과 함께 사라진다 */
export interface LegacyEvaluateInput {
	squad: Squad;
	profile: Profile;
	/** giftId → triggerId[] */
	giftTriggers: Map<string, string[]>;
	/** triggerId → 참조들 */
	refsByTrigger: Map<string, TriggerRef[]>;
	params: TriggerParam[];
}

export interface EvaluateInput extends LegacyEvaluateInput {
	/** 절 단위 능력. 이쪽으로 판정한다 */
	abilities: Map<string, Ability[]>;
	abilityConds: Map<string, Map<string, AbilityCond[]>>;
	supply: SupplyTables;
}

/** `(giftId, triggerId)` 의 임계값과 분모 */
interface Gate {
	need: number | null;
	denominator: string | null;
	slots: number[];
}

function gatesOf(params: TriggerParam[]): Map<string, Gate> {
	const out = new Map<string, Gate>();
	const at = (k: string): Gate => {
		const g = out.get(k) ?? { need: null, denominator: null, slots: [] };
		out.set(k, g);
		return g;
	};
	for (const p of params) {
		const g = at(`${p.giftId}|${p.triggerId}`);
		// **tier 0 이 입장 게이트다.** 실측 다단 6건이 전부 오름차순이므로
		// 윗단은 강화 조건이지 발동 조건이 아니다
		if (p.kind === 'min_count' && p.tier === 0) g.need = Number(p.value);
		if (p.kind === 'denominator') g.denominator = p.value;
		if (p.kind === 'slot') g.slots = p.slots;
	}
	return out;
}

/** 게이트가 붙은 (기프트, 트리거) 짝. 이 짝만 발동을 막을 수 있다 */
function gateKeysOf(params: readonly TriggerParam[]): Set<string> {
	const out = new Set<string>();
	for (const p of params) {
		if (p.kind === 'gate') out.add(`${p.giftId}|${p.triggerId}`);
	}
	return out;
}

/**
 * 참조 하나를 판정한다.
 *
 * `have` 는 근거로 그대로 낸다 — 「몇 명이 있는지」가 「되는지 안 되는지」보다
 * 사용자에게 쓸모가 크다.
 */
function judge(
	ref: TriggerRef,
	gate: Gate,
	profile: Profile,
	squad: Squad,
	/** 이 기프트의 자리 한정. 비어 있으면 편성 전체로 본다 */
	scope: readonly number[],
): { verdict: RefVerdict; have: number; need: number | null } {
	if (ref.evaluability === 'always') return { verdict: 'satisfied', have: 0, need: null };
	if (ref.evaluability === 'runtime' || ref.evaluability === 'unclassified') {
		return { verdict: 'unknown', have: 0, need: null };
	}
	// 참조 대상이 없으면 셀 것이 없다. 등급 규칙이 이것을 C 로 몬다
	if (ref.refKind === 'none') return { verdict: 'unknown', have: 0, need: null };

	const denom = gate.denominator ?? 'field';

	// 배치 — 출전 **순서**가 슬롯 번호다. 요구 슬롯 중 하나라도 차 있으면 켜진다
	if (ref.refKind === 'deployment') {
		if (gate.slots.length === 0) return { verdict: 'unknown', have: 0, need: null };
		const filled = gate.slots.filter((s) => s >= 1 && s <= squad.field.length).length;
		return { verdict: filled > 0 ? 'satisfied' : 'unsatisfied', have: filled, need: 1 };
	}

	// 공명 — `Any Resonance` 는 refId 가 비어 있어 죄악별 최댓값을 봐야 한다
	const have = ref.refKind === 'resonance' && ref.refId === ''
		? Math.max(...SINS.map((s) =>
			scope.length > 0
				? profile.countInSlots('resonance', s, scope)
				: profile.count('resonance', s, denom)))
		// **자리 한정이 있으면 그 자리 인격만 센다**(설계 2.4). 분모 지정보다 우선한다 —
		// 「1·2번 자리」가 「출전 전체」보다 좁은 한정이기 때문이다
		: scope.length > 0
			? profile.countInSlots(ref.refKind, ref.refId, scope)
			: profile.count(ref.refKind, ref.refId, denom);

	const need = gate.need ?? (ref.refKind === 'resonance' ? RESONANCE_MIN : 1);
	return { verdict: have >= need ? 'satisfied' : 'unsatisfied', have, need };
}

/**
 * 절 단위 판정 — 이것이 현행이다.
 *
 * **`GiftVerdict` 모양을 그대로 낸다.** `score.ts` 와 화면이 그 모양에 매여
 * 있어, 판정만 갈아끼우고 나머지는 안 건드린다.
 */
export function evaluateGifts(input: EvaluateInput): GiftVerdict[] {
	const out: GiftVerdict[] = [];

	/**
	 * **절을 가진 기프트 전부를 돈다.** 옛 판정은 `giftTriggers` 를 돌았는데
	 * 트리거가 0개인 기프트는 아예 판정되지 않았다. 절 모형에서는 그런
	 * 기프트도 「능력이 없으니 판정 보류」로 명시적으로 답한다.
	 */
	const giftIds = [...new Set([...input.abilities.keys(), ...input.giftTriggers.keys()])].sort();

	for (const giftId of giftIds) {
		const abilities = input.abilities.get(giftId) ?? [];
		const condsByAbility = input.abilityConds.get(giftId) ?? new Map<string, AbilityCond[]>();
		const { fireable, reasons } = judgeGift({
			tables: input.supply, squad: input.squad, abilities, condsByAbility,
		});

		const decidable = reasons.filter((r) => r.verdict !== 'unknown').length;
		const satisfied = reasons.filter((r) => r.verdict === 'satisfied').length;
		const certain = reasons.filter(
			(r) => r.verdict === 'satisfied' && r.certainty === 'certain',
		).length;
		// 조건이 하나도 없는 기프트는 C 다 — 「전부 판정 가능」이 아니라 「셀 것이 없다」
		const grade = reasons.length > 0 && decidable === reasons.length ? 'A'
			: decidable > 0 ? 'B' : 'C';

		out.push({
			giftId, grade, decidable, satisfied, certain,
			total: reasons.length, reasons, fireable,
		});
	}
	return out;
}

/**
 * **폐기됨** — 절 모형(`evaluateGifts`)이 대신한다.
 *
 * 지우지 않는 이유는 `scripts/verdict-diff.ts` 가 옛 판정과 새 판정을 나란히
 * 재기 때문이다. 그 대조가 끝나면 지운다.
 */
export function evaluateGiftsLegacy(input: LegacyEvaluateInput): GiftVerdict[] {
	const gates = gatesOf(input.params);
	const gateKeys = gateKeysOf(input.params);
	const out: GiftVerdict[] = [];

	for (const [giftId, triggerIds] of input.giftTriggers) {
		/**
		 * **자리 범위를 먼저 모은다.** 자리 조건은 독립 효과가 아니라 다른 조건에
		 * 씌우는 한정자다 — 「[편성 1번, 2번 인격 전용 효과] 파열 … 을 부여하는
		 * 공격 스킬」이 한 문장이기 때문이다.
		 *
		 * **이것은 추론이다**(설계 2.5). `gift_effect` 와 `gift_trigger` 를 잇는
		 * 표가 없어 어느 조건이 어느 효과를 켜는지 데이터가 답하지 않는다.
		 */
		const scope: number[] = [];
		for (const triggerId of triggerIds) {
			const g = gates.get(`${giftId}|${triggerId}`);
			if (g !== undefined && g.slots.length > 0) scope.push(...g.slots);
		}

		const reasons: Reason[] = [];
		for (const triggerId of triggerIds) {
			const gate = gates.get(`${giftId}|${triggerId}`)
				?? { need: null, denominator: null, slots: [] };
			for (const ref of input.refsByTrigger.get(triggerId) ?? []) {
				const j = judge(ref, gate, input.profile, input.squad, scope);
				reasons.push({
					triggerId, refKind: ref.refKind, refId: ref.refId,
					verdict: j.verdict,
					// **불충족은 언제나 확정이다** — 편성에 없으면 전투 중에도 안 생긴다.
					// 충족 쪽만 roster_gated 에서 「가능」으로 내려간다
					certainty: j.verdict === 'satisfied' && ref.evaluability === 'roster_gated'
						? 'possible' : 'certain',
					have: j.have, need: j.need,
					denominator: j.need === null ? null : gate.denominator ?? 'field',
					// 아래에서 게이트 유무에 따라 덮는다 — 여기서는 타입이 요구해 초기화만 한다
					blocking: false,
				});
			}
		}

		/**
		 * 이 기프트에 게이트가 있는가. 있으면 게이트만 막고, 없으면 적용 범위를
		 * 뺀 나머지가 막는다.
		 */
		const hasGate = triggerIds.some((t) => gateKeys.has(`${giftId}|${t}`));
		for (const r of reasons) {
			r.blocking = hasGate
				? gateKeys.has(`${giftId}|${r.triggerId}`)
				: !SCOPE_KINDS.has(r.refKind);
		}

		const decidable = reasons.filter((r) => r.verdict !== 'unknown').length;
		const satisfied = reasons.filter((r) => r.verdict === 'satisfied').length;
		const certain = reasons.filter(
			(r) => r.verdict === 'satisfied' && r.certainty === 'certain',
		).length;
		// 참조가 하나도 없는 기프트는 C 다 — 「전부 판정 가능」이 아니라 「셀 것이 없다」
		const grade = reasons.length > 0 && decidable === reasons.length ? 'A'
			: decidable > 0 ? 'B' : 'C';
		// 막을 수 있는 근거가 확정 미충족일 때만 죽는다 — 막지 않는 근거는
		// reasons·satisfied·grade 에 그대로 남되 fireable 은 깎지 않는다
		const fireable = !reasons.some(
			(r) => r.blocking && r.verdict === 'unsatisfied' && r.certainty === 'certain',
		);

		out.push({
			giftId, grade, decidable, satisfied, certain,
			total: reasons.length, reasons, fireable,
		});
	}
	return out;
}
