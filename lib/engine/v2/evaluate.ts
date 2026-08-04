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
import type { Profile } from './profile.js';
import type { GiftVerdict, Reason, RefVerdict, Squad, TriggerParam, TriggerRef } from './types.js';

/**
 * 공명의 기본 임계. **게임 규칙이지 우리 데이터가 아니다** — 어느 출처에도
 * 구조화돼 있지 않아 여기 상수로 둔다. `gift_trigger_param` 에 그 기프트만의
 * 임계가 있으면 그쪽이 이긴다.
 */
const RESONANCE_MIN = 3;

/** 죄악 일곱. `Any Resonance` 는 이 중 **최댓값**을 봐야 해서 조인으로는 안 닿는다 */
const SINS = ['wrath', 'lust', 'sloth', 'gluttony', 'gloom', 'pride', 'envy'];

export interface EvaluateInput {
	squad: Squad;
	profile: Profile;
	/** giftId → triggerId[] */
	giftTriggers: Map<string, string[]>;
	/** triggerId → 참조들 */
	refsByTrigger: Map<string, TriggerRef[]>;
	params: TriggerParam[];
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
		? Math.max(...SINS.map((s) => profile.count('resonance', s, denom)))
		: profile.count(ref.refKind, ref.refId, denom);

	const need = gate.need ?? (ref.refKind === 'resonance' ? RESONANCE_MIN : 1);
	return { verdict: have >= need ? 'satisfied' : 'unsatisfied', have, need };
}

export function evaluateGifts(input: EvaluateInput): GiftVerdict[] {
	const gates = gatesOf(input.params);
	const out: GiftVerdict[] = [];

	for (const [giftId, triggerIds] of input.giftTriggers) {
		const reasons: Reason[] = [];
		for (const triggerId of triggerIds) {
			const gate = gates.get(`${giftId}|${triggerId}`)
				?? { need: null, denominator: null, slots: [] };
			for (const ref of input.refsByTrigger.get(triggerId) ?? []) {
				const j = judge(ref, gate, input.profile, input.squad);
				reasons.push({
					triggerId, refKind: ref.refKind, refId: ref.refId,
					verdict: j.verdict,
					// **불충족은 언제나 확정이다** — 편성에 없으면 전투 중에도 안 생긴다.
					// 충족 쪽만 roster_gated 에서 「가능」으로 내려간다
					certainty: j.verdict === 'satisfied' && ref.evaluability === 'roster_gated'
						? 'possible' : 'certain',
					have: j.have, need: j.need,
					denominator: j.need === null ? null : gate.denominator ?? 'field',
				});
			}
		}

		const decidable = reasons.filter((r) => r.verdict !== 'unknown').length;
		const satisfied = reasons.filter((r) => r.verdict === 'satisfied').length;
		const certain = reasons.filter(
			(r) => r.verdict === 'satisfied' && r.certainty === 'certain',
		).length;
		// 참조가 하나도 없는 기프트는 C 다 — 「전부 판정 가능」이 아니라 「셀 것이 없다」
		const grade = reasons.length > 0 && decidable === reasons.length ? 'A'
			: decidable > 0 ? 'B' : 'C';

		out.push({ giftId, grade, decidable, satisfied, certain, total: reasons.length, reasons });
	}
	return out;
}
