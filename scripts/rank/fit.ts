/**
 * 적합도 — 「이 기프트가 내 덱을 얼마나 키우나」.
 *
 * **부여만 잰다.** 요구(「화상 인격 5인 필요」)는 엔진의 `L`(켜짐)이 이미
 * 재고 있어, 여기서 또 세면 같은 것을 두 번 센다.
 *
 * **`lib/engine/v2/score.ts` 의 `fitOf` 를 다시 쓴 것이다.** 엔진을 안
 * 건드리기로 했으므로 빌려오지 않는다. 저울추가 정해지면 그때 엔진 쪽을
 * 이 모양으로 맞춘다(PR-B).
 */
import type { DeckSupply } from './types.js';

/** 축 키워드 일곱. `keywordId` 는 첫 글자만 대문자라 대문자로 맞춰 본다 */
const AXES = new Set(['COMBUSTION', 'LACERATION', 'BURST', 'BREATH',
	'VIBRATION', 'SINKING', 'CHARGE']);

/** 공격 타입 셋. `keywordId` 에 축과 섞여 들어 있다 */
const ATTACK_TYPES = new Set(['SLASH', 'PENETRATE', 'HIT']);

/** 그 갈래에서 이 덱이 가장 많이 가진 수. 0 이면 나누지 않는다 */
function maxOf(m: Map<string, number>): number {
	const vs = [...m.values()];
	return vs.length > 0 ? Math.max(...vs) : 0;
}

/**
 * 0~1. **분모는 둘 다 「그 덱이 가장 많이 가진 것」이다.**
 *
 * 공격 타입만 인원으로 나누면 축과 다른 자가 되어 저울추 하나로 못 덮는다.
 */
export function fitOfKeyword(keywordId: string | null, supply: DeckSupply): number {
	if (keywordId === null) return 0;
	const k = keywordId.toUpperCase();

	if (AXES.has(k)) {
		const max = maxOf(supply.axis);
		return max === 0 ? 0 : (supply.axis.get(k) ?? 0) / max;
	}
	if (ATTACK_TYPES.has(k)) {
		const max = maxOf(supply.attackType);
		return max === 0 ? 0 : (supply.attackType.get(k.toLowerCase()) ?? 0) / max;
	}
	// 'None' 그리고 어휘 밖 — 범용 기프트다. 등급 항이 값을 낸다
	return 0;
}

/**
 * 등급을 0~1 로 편다. `fit` 과 같은 자로 재야 저울추를 견줄 수 있다.
 *
 * EX(등급 없음)는 1.0 이다 — 5등급 위이지만 5등급도 2건뿐이라 갈라 봐야
 * 표본이 안 나온다.
 */
export function tierOf(tier: number | null): number {
	if (tier === null) return 1;
	return Math.min(1, Math.max(0, (tier - 1) / 4));
}
