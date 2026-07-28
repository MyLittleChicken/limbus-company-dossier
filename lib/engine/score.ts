import { activation } from './dsl';
import { contextOf, withGift, type Gift, type RunState } from './state';
import { EFFECT_W, TARGET_FACTOR } from './tuning';

/**
 * 상태 점수와 한계 효용.
 *
 * ```
 * Score(state)          = Σ 보유 기프트 Σ 효과  가중치 × 대상계수 × 활성도
 * MarginalValue(gift)   = Score(state ∪ {gift}) − Score(state)
 * ```
 *
 * **시너지를 엣지로 저장하지 않는다**(마스터북 §3.3). 공급 기프트를 넣으면 상태 공급이 올라
 * 기존 수요 기프트의 활성도가 함께 오르고, 그 상승분이 한계 효용에 그대로 잡힌다.
 * 시너지는 저장된 사실이 아니라 상태에서 창발하는 결과다.
 *
 * **절대 점수로 줄 세우지 않는다**(§13). 이미 충분히 갖춘 능력은 한계 효용이 낮고,
 * 평범한 기프트라도 덱의 빈 곳을 메우면 높다.
 */

export interface Contribution {
	giftId: number;
	name: string;
	effectType: string;
	value: number;
	activation: number;
	evidence: string[];
}

export interface StateScore {
	total: number;
	contributions: Contribution[];
}

function baseValue(effectType: string, target: string): number {
	return (EFFECT_W[effectType] ?? 0) * (TARGET_FACTOR[target] ?? 0.3);
}

export function scoreState(state: RunState): StateScore {
	const ctx = contextOf(state);
	const contributions: Contribution[] = [];
	let total = 0;

	for (const gift of state.owned) {
		for (const { unit, condition } of gift.effects) {
			const act = activation(condition, ctx);
			const value = baseValue(unit.type, unit.target) * act.value;
			total += value;
			contributions.push({
				giftId: gift.id,
				name: gift.name,
				effectType: unit.type,
				value,
				activation: act.value,
				evidence: act.evidence,
			});
		}
	}
	return { total, contributions };
}

export interface Marginal {
	delta: number;
	/** 이 기프트 자신이 낸 값 */
	own: number;
	/** 이 기프트를 넣어 기존 기프트가 더 켜진 만큼 */
	synergy: Array<{ giftId: number; name: string; lift: number }>;
	evidence: string[];
}

export function marginalValue(state: RunState, gift: Gift): Marginal {
	// 이미 보유한 기프트는 추가 가치가 없다. 중복 보유를 가정하지 않는다.
	if (state.owned.some((g) => g.id === gift.id)) {
		return { delta: 0, own: 0, synergy: [], evidence: [] };
	}

	const before = scoreState(state);
	const after = scoreState(withGift(state, gift));

	const sum = (list: Contribution[]) => {
		const m = new Map<number, number>();
		for (const c of list) m.set(c.giftId, (m.get(c.giftId) ?? 0) + c.value);
		return m;
	};
	const b = sum(before.contributions);
	const a = sum(after.contributions);

	const names = new Map<number, string>();
	for (const c of after.contributions) names.set(c.giftId, c.name);

	const synergy: Marginal['synergy'] = [];
	for (const [id, value] of a) {
		if (id === gift.id) continue;
		const lift = value - (b.get(id) ?? 0);
		// 미세한 증감은 노이즈다. 근거로 보여줄 값만 남긴다.
		if (lift > 0.01) synergy.push({ giftId: id, name: names.get(id) ?? String(id), lift });
	}
	synergy.sort((x, y) => y.lift - x.lift);

	const own = a.get(gift.id) ?? 0;
	const evidence = [
		...new Set(after.contributions.filter((c) => c.giftId === gift.id).flatMap((c) => c.evidence)),
	];

	return { delta: after.total - before.total, own, synergy, evidence };
}

/** 모든 조건이 켜졌을 때의 값. 미래 가치 판정에 쓴다. */
export function ceiling(gift: Gift): number {
	return gift.effects.reduce((s, e) => s + baseValue(e.unit.type, e.unit.target), 0);
}

/** 이 기프트가 페이오프에 필요로 하는 상태들. */
export function neededStatuses(gift: Gift): Set<string> {
	const set = new Set<string>();
	const walk = (c: Gift['effects'][number]['condition']): void => {
		if (c.op === 'HAS_STATUS' || c.op === 'SKILL_SUPPLIES') set.add(c.status);
		if (c.op === 'AND') c.conditions.forEach(walk);
	};
	for (const e of gift.effects) walk(e.condition);
	return set;
}

/** 이 기프트가 공급하는 상태들. */
export function suppliedStatuses(gift: Gift): Set<string> {
	const set = new Set<string>();
	for (const e of gift.effects) {
		if (e.unit.status && (e.unit.type === 'INFLICT_POTENCY' || e.unit.type === 'INFLICT_COUNT')) {
			set.add(e.unit.status);
		}
	}
	return set;
}
