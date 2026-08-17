/**
 * 격자 탐색으로 저울추를 찾는다.
 *
 * **학습 라이브러리를 안 쓴다.** 저울추가 셋뿐이라 값 범위를 잘게 훑으면
 * 되고, 그래야 결과가 결정적이며 「왜 이 숫자인가」를 「표본 60개 중 55개를
 * 맞혔다」로 답할 수 있다.
 *
 * **DB 를 모른다.** 값 셈을 함수로 주입받아, 표본이 오기 전에도 검사가 돈다.
 */
import { fitOfKeyword, tierOf } from './fit.js';
import type { DeckSupply, GiftCard } from './types.js';
import type { Pair } from './pairs.js';

export interface Weights {
	fit: number;
	tier: number;
	exclusive: number;
}

/**
 * 기프트 하나의 값. **곱이 아니라 합이다.**
 *
 * 곱이면 적합도가 0 일 때 등급이 무엇이든 0 이라, 「범용 5등급이 화상
 * 2등급보다 위일 수 있다」가 원리적으로 불가능해진다.
 *
 * **전용은 적합도에 곱하지 않고 따로 더한다.** 곱하면 키워드 없는 전용
 * 기프트가 전용 여부를 아예 못 보인다.
 */
export function valueOf(card: GiftCard, supply: DeckSupply, w: Weights): number {
	return w.fit * fitOfKeyword(card.keywordId, supply)
		+ w.tier * tierOf(card.tier)
		+ w.exclusive * (card.exclusive ? 1 : 0);
}

export interface Scored {
	giftId: string;
	deck: string;
	value: number;
}

/**
 * 제약을 몇 개나 지켰나.
 *
 * **값이 같으면 안 지킨 것이다** — 순서를 만들지 못했다는 뜻이고, 그것을
 * 지킨 것으로 세면 「전부 0점」인 저울추가 만점을 받는다.
 */
export function agreementOf(
	pairs: Pair[],
	value: (deck: string, giftId: string) => number,
): { hit: number; total: number } {
	let hit = 0;
	for (const p of pairs) {
		if (value(p.deck, p.hi) > value(p.deck, p.lo)) hit += 1;
	}
	return { hit, total: pairs.length };
}

/** 훑을 값. 0 은 「이 항을 안 쓴다」다 */
const SCALE = [0, 0.25, 0.5, 0.75, 1, 1.5, 2, 3];

/**
 * 격자를 훑어 가장 많이 맞히는 저울추를 고른다.
 *
 * **같은 점수면 저울추 합이 작은 쪽을 고른다.** 항을 덜 쓰고 같은 성적을
 * 내면 그쪽이 설명하기 쉽고, 표본에 억지로 맞춘 것일 가능성도 낮다.
 */
export function searchWeights(
	pairs: Pair[],
	value: (deck: string, giftId: string, w: Weights) => number,
	scale: readonly number[] = SCALE,
): { best: Weights; hit: number; total: number } {
	let best: Weights = { fit: 0, tier: 0, exclusive: 0 };
	let bestHit = -1;
	let bestSum = Number.POSITIVE_INFINITY;

	for (const fit of scale) {
		for (const tier of scale) {
			for (const exclusive of scale) {
				const w = { fit, tier, exclusive };
				const { hit } = agreementOf(pairs, (d, g) => value(d, g, w));
				const sum = fit + tier + exclusive;
				if (hit > bestHit || (hit === bestHit && sum < bestSum)) {
					best = w;
					bestHit = hit;
					bestSum = sum;
				}
			}
		}
	}
	return { best, hit: Math.max(0, bestHit), total: pairs.length };
}
