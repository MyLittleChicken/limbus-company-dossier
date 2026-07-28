import { SOFT, SUPPLY_K } from './tuning';
import type { EvalContext } from './state';
import type { Condition } from './vocab';

/**
 * 조건 평가기.
 *
 * 한 값이 아니라 **세 값**으로 답한다(마스터북 §11).
 *   - `ratio` 충족 정도. 5명 필요한데 4명이면 0.8. 발동하지 않아도 "한 명 차이"를 표현한다.
 *   - `rate` 발동 빈도. 전투 중 실제로 얼마나 켜지는가.
 *   - `evidence` 무엇이 그 조건을 충족시켰는가. **추천 이유가 여기서 나온다.**
 *
 * 이유를 따로 지어내지 않는다(§20). 설명은 평가가 남긴 근거를 옮긴 것이어야 한다.
 */

export interface Evaluation {
	ratio: number;
	rate: number;
	evidence: string[];
}

const clamp = (x: number, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, x));

export function evaluate(condition: Condition, ctx: EvalContext): Evaluation {
	switch (condition.op) {
		case 'ALWAYS':
			return { ratio: 1, rate: 1, evidence: [] };

		case 'AND': {
			const parts = condition.conditions.map((c) => evaluate(c, ctx));
			return {
				// 가장 약한 고리가 전체를 정한다
				ratio: Math.min(...parts.map((p) => p.ratio)),
				rate: parts.reduce((a, p) => a * p.rate, 1),
				evidence: parts.flatMap((p) => p.evidence),
			};
		}

		case 'COUNT_AFFILIATION': {
			// 소속 조건의 판정 범위가 기프트마다 다르다(편성 기준 · 출격 기준). 원본 토큰에
			// 그 구분이 없으므로 **둘 중 큰 쪽**을 쓴다. 정밀화는 설명문 파싱이 필요하다.
			const inDeck = ctx.affiliation.deck[condition.affiliation] ?? 0;
			const inField = ctx.affiliation.deployed[condition.affiliation] ?? 0;
			const have = Math.max(inDeck, inField);
			const ratio = clamp(have / condition.atLeast);
			return {
				ratio,
				rate: 1,
				evidence:
					have > 0 ? [`${condition.affiliation} ${have}명 (필요 ${condition.atLeast})`] : [],
			};
		}

		case 'RESONANCE': {
			// 공명은 인격 스킬의 죄악 분포로 판정한다. 기프트의 색 속성과 무관하다.
			const have = ctx.sinSupply[condition.sin] ?? 0;
			// 완전 공명은 같은 죄악이 더 많이 필요하다
			const need = condition.absolute ? 5 : 3;
			const ratio = clamp(have / need);
			return {
				ratio,
				rate: ratio >= 1 ? 0.8 : ratio * 0.8,
				evidence: have > 0 ? [`${condition.sin} 스킬 ${have}명 (필요 ${need})`] : [],
			};
		}

		case 'ANY_RESONANCE': {
			// 죄악을 가리지 않으므로 가장 두꺼운 축으로 판정한다.
			const best = Math.max(0, ...Object.values(ctx.sinSupply));
			const need = condition.absolute ? 5 : 3;
			const ratio = clamp(best / need);
			return {
				ratio,
				rate: ratio >= 1 ? 0.8 : ratio * 0.8,
				evidence: best > 0 ? [`최다 죄악 스킬 ${best}명 (필요 ${need})`] : [],
			};
		}

		case 'SKILL_SUPPLIES': {
			const supply = ctx.statusSupply[condition.status] ?? 0;
			return {
				ratio: supply > 0 ? 1 : 0,
				rate: supply <= 0 ? 0 : supply / (supply + SUPPLY_K),
				evidence: supply > 0 ? [`${condition.status} 공급 ${supply}명`] : [],
			};
		}

		case 'SIN_SKILL': {
			// 죄악은 인격 스킬 분포로 판정한다. 기프트의 색 속성과 무관하다.
			const n = ctx.sinSupply[condition.sin] ?? 0;
			return {
				ratio: n > 0 ? 1 : 0,
				rate: n <= 0 ? 0 : n / (n + SUPPLY_K),
				evidence: n > 0 ? [`${condition.sin} 스킬 ${n}명`] : [],
			};
		}

		case 'ATTACK_TYPE_USED': {
			const n = ctx.atkTypes[condition.atkType] ?? 0;
			return {
				ratio: n > 0 ? 1 : 0,
				rate: n <= 0 ? 0 : n / (n + SUPPLY_K),
				evidence: n > 0 ? [`${condition.atkType} 스킬 ${n}명`] : [],
			};
		}

		case 'HAS_STATUS': {
			// 적이 상태를 갖고 있으려면 우리가 그 상태를 부여할 수 있어야 한다.
			const supply = ctx.statusSupply[condition.status] ?? 0;
			return {
				ratio: supply > 0 ? 1 : 0,
				rate: supply <= 0 ? 0 : supply / (supply + SUPPLY_K),
				evidence: supply > 0 ? [`${condition.status} 부여 가능 ${supply}명`] : [],
			};
		}

		case 'SITUATIONAL':
			return { ratio: 1, rate: condition.rate, evidence: [] };
	}
}

/** 충족도 → 계수. 미달은 제곱으로 깎아 한 명 차이가 확실히 손해가 되게 한다. */
export function softStep(ratio: number): number {
	return ratio >= 1 ? SOFT.full : ratio * ratio * SOFT.partial;
}

/** 효과가 실제로 켜지는 정도. `[0,1]`. */
export function activation(condition: Condition, ctx: EvalContext): Evaluation & { value: number } {
	const e = evaluate(condition, ctx);
	return { ...e, value: softStep(e.ratio) * e.rate };
}
