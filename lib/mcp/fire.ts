import type { GiftVerdict } from '@/lib/engine/v2/types';

/**
 * 기프트 켜짐 세 값(설계 §6.2).
 *
 *   on        켜짐이 확정 — 모든 조건이 확정 충족
 *   possible  못 켠다는 근거는 없으나 런타임 조건 · 판정 불가(unknown) 가 남음
 *   off       못 켠다 — 막는 조건이 확정 미충족
 *
 * 엔진의 `fireable` 은 「못 켠다는 근거가 없다」라서 판정 불가도 `true` 다. boolean 하나로
 * 내리면 「모른다」가 「켜진다」로 읽힌다(반목표). 그래서 셋으로 편다.
 */
export type FireState = 'on' | 'possible' | 'off';

export interface Fire {
	state: FireState;
	/** 판정 행이 아예 없는 기프트. 화면처럼 켜짐으로 두지 않는다 */
	reason?: 'no-judgement-data';
}

export function fireState(v: GiftVerdict | undefined): Fire {
	if (v === undefined) return { state: 'possible', reason: 'no-judgement-data' };
	if (!v.fireable) return { state: 'off' };
	// 조건이 하나도 없는 판정(total 0)은 「셀 것이 없다」라 확정이 아니다 — possible
	if (v.total > 0 && v.certain === v.total) return { state: 'on' };
	return { state: 'possible' };
}
