/**
 * 가중치와 상수.
 *
 * **코드가 아니라 데이터로 다뤄야 하는 값이다**(마스터북 §19). 지금은 상수로 두되
 * 한 곳에 모아 두어, 이후 가중치 프로파일을 DB로 옮길 때 옮길 대상이 여기 하나가 되게 한다.
 *
 * 값은 튜닝 대상이며 근거는 골든 테스트다. 숫자를 바꾸면 골든을 다시 돌려 회귀를 본다.
 */

/** 효과 유형별 기본 가중치. 없는 유형은 0 — 조용히 통과시키지 않는다. */
export const EFFECT_W: Record<string, number> = {
	DAMAGE_ADD: 1.0,
	DAMAGE_FIXED: 0.8,
	DAMAGE_TAKEN_DOWN: 0.9,
	SKILL_POWER: 1.1,
	COIN_POWER: 0.9,
	OFFENSE_LEVEL: 0.7,
	DEFENSE_LEVEL: 0.5,
	SPEED: 0.6,
	HEAL_HP: 0.7,
	HEAL_SP: 0.6,
	SHIELD: 0.6,
	INFLICT_POTENCY: 1.0,
	INFLICT_COUNT: 1.1,
	INFLICT_DEBUFF: 0.6,
	GAIN_STATUS: 0.8,
	CONSUME_STATUS: 0.4,
	TRIGGER_EXTRA: 1.0,
	RESOURCE: 0.5,
	ECONOMY: 0.4,
	BUFF_GENERIC: 0.5,
	DEBUFF_GENERIC: 0.5,
	UNCLASSIFIED: 0.3,
};

/** 적용 대상 범위 계수. 전체에 걸리는 효과가 자신에게만 걸리는 것보다 크다. */
export const TARGET_FACTOR: Record<string, number> = {
	ALL_ALLIES: 1.0,
	DEPLOYED: 0.9,
	ALL_ENEMIES: 0.9,
	TARGET: 0.6,
	ACTOR: 0.5,
	SELF: 0.3,
};

/**
 * 상태 공급 포화 상수.
 *
 * 공급이 늘수록 발동 빈도가 오르되 선형이 아니다. `supply / (supply + K)` 로 포화시킨다.
 * K 를 키우면 "조금 공급"의 가치가 낮아진다.
 */
export const SUPPLY_K = 4;

/** 조건 충족도 → 가치 계수. 미달은 제곱으로 깎아 "한 명 차이"가 확실히 손해가 되게 한다. */
export const SOFT = { full: 1.0, partial: 0.35 };

/** 상황성 트리거(합 승리·적중·배치 위치)의 기본 발동 빈도. */
export const SITUATIONAL_RATE = 0.5;

/** 팩 점수 항목별 가중치. 전투 상성 항은 데이터가 없어 두지 않는다. */
export const PACK_W = {
	immediate: 1.0,
	fusionProgress: 0.6,
	universal: 0.5,
	exclusiveOpportunity: 0.25,
	futureOption: 0.4,
	redundancyPenalty: 0.5,
};

/**
 * 층별 가중치 배수(마스터북 §19).
 * 초반은 합성 재료·미래 확장이, 후반은 즉시 강화가 무겁다.
 */
export const FLOOR_PHASE = {
	early: { immediate: 0.8, fusionProgress: 1.4, universal: 1.1, futureOption: 1.4 },
	mid: { immediate: 1.0, fusionProgress: 1.0, universal: 1.0, futureOption: 1.0 },
	late: { immediate: 1.4, fusionProgress: 0.6, universal: 0.9, futureOption: 0.4 },
} as const;

export type FloorPhase = keyof typeof FLOOR_PHASE;

/** 층 → 국면. hard 15층 기준이다. */
export function phaseOf(floor: number): FloorPhase {
	if (floor <= 5) return 'early';
	if (floor <= 10) return 'mid';
	return 'late';
}

/** 미래 가치 관련성 바닥. 덱이 굴리지 않는 축의 페이오프를 0으로 만들지는 않는다. */
export const FUTURE_RELEVANCE_FLOOR = 0.2;
