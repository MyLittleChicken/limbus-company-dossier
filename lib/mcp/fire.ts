import type { Ability } from '@/lib/engine/v2/ability.js';
import type { GiftVerdict, Reason } from '@/lib/engine/v2/types';

/**
 * 기프트 켜짐 — 능력(절) 단위로 본 뒤 기프트로 접는다(설계 §6.2, 리뷰 R1#2 · R2#3).
 *
 * 엔진의 절 규칙(`lib/engine/v2/ability.ts`)을 그대로 따른다.
 *
 *   기프트 켜질 수 있다 = refines=null(독립) 능력 중 하나라도         ordinal 간 OR
 *     능력 = unconditional 이거나 모든 group 이 충족                  group 간 AND
 *       group = 조건 중 하나라도 충족                                 group 내 OR
 *
 * 엔진의 `fireable` 은 「못 켠다는 근거가 없다」(unknown 도 true)라 boolean 하나로 내리면
 * 「모른다」가 「켜진다」로 읽힌다. 그래서 상태를 나눈다.
 *
 * 능력 하나
 *   on        무조건이거나, 모든 group 에 확정 충족 조건이 있다
 *   off       어떤 group 의 조건이 전부 확정 미충족
 *   possible  그 밖 — group 이 unknown(전투 중 · 문턱 없음 · 셀 수 없음)에만 기대거나,
 *             무조건이 아닌데 조건이 0개(결손)
 *
 * 기프트
 *   off       엔진 fireable=false 그대로
 *   on        on 인 독립 능력이 있고, 다른 능력(독립 · 강화 절)에 off 가 없다
 *   partial   on 인 독립 능력이 있으나 다른 능력(독립 · 강화 절)이 확정 미충족
 *             (예: 9001 — 기본 효과 on, 분노 공명 효과 off)
 *   possible  on 인 독립 능력이 없다 — 켜지는 길이 unknown · 결손에만 기댄다
 *   판정 행 없음 → possible + no-judgement-data (저작 보류이지 무조건이 아니다)
 *
 * 판정은 편성(진입 시점) 조건만이다 — 전투 중 발동 조건은 범위 밖.
 */
export type FireState = 'on' | 'partial' | 'possible' | 'off';
export type AbilityState = 'on' | 'possible' | 'off';

export interface AbilityFire {
	ordinal: number;
	/** 강화판이면 원 능력의 ordinal. 독립이면 null */
	refines: number | null;
	unconditional: boolean;
	state: AbilityState;
	/** 무조건이 아닌데 조건이 0개 — 조건을 못 뽑은 결손이라 막지 않는다 */
	missingConditions?: true;
	/** 이 능력의 조건 판정. triggerId 가 `능력/그룹/번호` */
	reasons: Reason[];
}

export interface Fire {
	state: FireState;
	/** 판정 행이 아예 없는 기프트. 켜짐으로 두지 않는다 */
	reason?: 'no-judgement-data';
	abilities: AbilityFire[];
}

/** `triggerId` = `ordinal/group/idx` (ability.ts 의 judgeGift). 모양이 다르면 null */
function parseTrigger(id: string): { ordinal: number; group: number } | null {
	const m = /^(\d+)\/(\d+)\/\d+$/.exec(id);
	return m ? { ordinal: Number(m[1]), group: Number(m[2]) } : null;
}

export function abilityState(a: Ability, reasons: readonly Reason[]): { state: AbilityState; missingConditions?: true } {
	if (a.unconditional) return { state: 'on' };
	if (reasons.length === 0) return { state: 'possible', missingConditions: true };
	const groups = new Map<number, Reason[]>();
	for (const r of reasons) {
		const g = parseTrigger(r.triggerId)?.group ?? -1;
		groups.set(g, [...(groups.get(g) ?? []), r]);
	}
	const gs = [...groups.values()];
	if (gs.some((g) => g.every((r) => r.verdict === 'unsatisfied'))) return { state: 'off' };
	if (gs.every((g) => g.some((r) => r.verdict === 'satisfied' && r.certainty === 'certain'))) return { state: 'on' };
	return { state: 'possible' };
}

/**
 * @param v          엔진 판정(`evaluateGifts`). 없으면 판정 행 없음
 * @param abilities  그 기프트의 능력(`EngineData.abilities.get(giftId)`, 강화 0단계)
 */
export function fireState(v: GiftVerdict | undefined, abilities: readonly Ability[] = []): Fire {
	if (v === undefined) return { state: 'possible', reason: 'no-judgement-data', abilities: [] };

	const byOrdinal = new Map<number, Reason[]>();
	for (const r of v.reasons) {
		const o = parseTrigger(r.triggerId)?.ordinal;
		if (o === undefined) continue;
		byOrdinal.set(o, [...(byOrdinal.get(o) ?? []), r]);
	}
	const fires: AbilityFire[] = [...abilities]
		.sort((a, b) => a.ordinal - b.ordinal)
		.map((a) => {
			const reasons = byOrdinal.get(a.ordinal) ?? [];
			return { ordinal: a.ordinal, refines: a.refines, unconditional: a.unconditional, ...abilityState(a, reasons), reasons };
		});

	if (!v.fireable) return { state: 'off', abilities: fires };
	const onIndependent = fires.some((f) => f.refines === null && f.state === 'on');
	if (!onIndependent) return { state: 'possible', abilities: fires };
	return { state: fires.some((f) => f.state === 'off') ? 'partial' : 'on', abilities: fires };
}

/** 정렬용 순위. 작을수록 앞 */
export const FIRE_RANK: Record<FireState, number> = { on: 0, partial: 1, possible: 2, off: 3 };
