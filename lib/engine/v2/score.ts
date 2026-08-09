/**
 * 팩 점수 — 설계 5절.
 *
 * ```
 * 점수 = 적합도 F × 켜짐 L
 * ```
 *
 * **DB 를 모른다.** `Profile` 과 `evaluateGifts` 가 낸 것을 받아 셈만 한다.
 * 순수 함수라 검사가 DB 없이 돌고, 저울추가 코드로 잠긴다
 * (ADR-08 「규칙은 코드 · 사실은 데이터」).
 *
 * **저울추가 둘뿐이다** — 확정 1.0 / 가능 0.5, 연쇄 1홉 1.0 / 2홉 0.5.
 * 같은 규칙이고(한 단계 멀어지면 반) 나머지는 전부 실측값에서 나온다.
 */
import { reachOf, type Recipe } from './fusion.js';
import type { RefVerdict } from './types.js';

/** 한 단계 불확실해지거나 한 홉 멀어지면 반. 이 파일의 저울추 전부다 */
const HALF = 0.5;

/**
 * 덱이 축을 얼마나 공급하나.
 *
 * **`refKind === 'axis'` 만 본다.** `Profile` 은 죄악 · 공명 · 코인 · 스킬 갈래 ·
 * 소속 · 유닛 키워드 · 공격 타입까지 여덟을 함께 내는데(PR-A 실측), 그중 가장 큰
 * 값으로 나누면 축의 차이가 뭉개진다.
 */
export interface AxisSupply {
	/** 축 id → 인원 */
	counts: Map<string, number>;
	/** 최대 인원. **0 이면 축을 하나도 공급하지 않는 덱이다** */
	max: number;
}

export function axisSupplyOf(
	rows: ReadonlyArray<{ refKind: string; refId: string; count: number }>,
): AxisSupply {
	const counts = new Map<string, number>();
	for (const r of rows) {
		if (r.refKind !== 'axis') continue;
		counts.set(r.refId, Math.max(counts.get(r.refId) ?? 0, r.count));
	}
	const values = [...counts.values()];
	return { counts, max: values.length > 0 ? Math.max(...values) : 0 };
}

/**
 * 이 키워드가 내 덱에 얼마나 맞나. 0~1.
 *
 * 축 id 는 키워드 id 의 대문자다(`Combustion` → `COMBUSTION`). 다리 표가 따로
 * 없고 필요도 없다 — `canonical/squad.ts` 와 같은 판정이다.
 *
 * **축이 아닌 키워드는 0 이다.** 키워드 표에 공격 타입 3종(`Slash` · `Penetrate` ·
 * `Hit`)과 `Random` · `None` 이 섞여 있다.
 *
 * **범용은 반으로 친다**(설계 3.2). 아무 팩에서나 얻을 수 있는 것은 이 팩을 고를
 * 이유가 못 된다 — 팩당 전용이 3~7개(5~9%)이고 나머지 90%는 어디서나 나온다.
 * 아무 편성에서나 켜지는 조건이 변별을 죽인 것과 같은 구조다.
 */
export function fitOf(
	keywordId: string | null,
	supply: AxisSupply,
	exclusive: boolean,
): number {
	if (keywordId === null || supply.max === 0) return 0;
	const axis = (supply.counts.get(keywordId.toUpperCase()) ?? 0) / supply.max;
	return axis * (exclusive ? 1 : HALF);
}

/** 점수가 보는 기프트 하나. **id 를 안 받는다** — 셈에 필요 없다 */
export interface ScoreGift {
	keywordId: string | null;
	/**
	 * 전체 **발동 조건** 수. `gift_effect` 가 아니라 트리거 참조다 — 한 기프트가
	 * 조건마다 다른 효과를 갖는다.
	 */
	total: number;
	/** 그중 충족한 발동 조건 수 (확정·가능 합) */
	satisfied: number;
	reasons: ReadonlyArray<{ verdict: RefVerdict; certainty: 'certain' | 'possible' }>;
	/** 보유 기프트가 이걸 켜 주는가. 몇 홉인지 */
	chainDepth: number | null;
	/** 이미 보유한 기프트인가. 후보에서 뺀다 */
	owned: boolean;
	/**
	 * 이 편성에서 켜질 수 있나. **false 면 F · L · C 어디에도 안 들어간다**(설계 2.2).
	 *
	 * 목록에서 빼는 것이 아니라 **점수에서** 빼는 것이다. 왜 빠졌는지 볼 수 없으면
	 * 판정을 검증할 수 없으므로 근거 모달은 그대로 보여준다.
	 */
	fireable: boolean;
	/** 이 팩에서만 얻을 수 있나. 범용은 반으로 친다 */
	exclusive: boolean;
}

/**
 * 이 기프트에서 살아 있는 발동 조건의 무게.
 *
 * **연쇄는 편성이 못 켜는 몫까지만 센다.** 안 그러면 편성으로 이미 전부 켜진
 * 기프트에 연쇄가 덧붙어 `L` 이 1 을 넘고, 「발동 조건 중 몇 %가 사나」라는
 * 정의와 어긋난다. 연쇄는 편성이 못 켜는 것을 보유가 대신 켜 주는 경우다.
 */
export function liveOf(gift: ScoreGift): number {
	let live = 0;
	for (const r of gift.reasons) {
		if (r.verdict !== 'satisfied') continue;
		live += r.certainty === 'certain' ? 1 : HALF;
	}
	const unmet = gift.total - gift.satisfied;
	if (unmet > 0 && gift.chainDepth !== null) {
		live += Math.min(gift.chainDepth <= 1 ? 1 : HALF, unmet);
	}
	return live;
}

/**
 * 합성으로 얻는 몫.
 *
 * **`F` 와 같은 분모(후보 기프트 수)를 쓴다.** 둘을 더해야 하고, 레시피 수로
 * 나누면 큰 팩이 유리해지기 때문이다.
 *
 * **레시피 전부를 훑는다.** 도달이 0 이면 안 더해지므로 실질적으로 이 팩이
 * 기여하는 것만 남는다.
 */
export function fusionOf(input: {
	recipes: ReadonlyArray<Recipe>;
	/** 결과물 기프트 id → 그 기프트의 fit. 덱과 안 맞으면 0 이다 */
	resultFit: ReadonlyMap<string, number>;
	/** 보유 ∪ 이 팩의 기프트 */
	have: ReadonlySet<string>;
	/** 이미 보유한 기프트. 결과물을 이미 갖고 있으면 안 센다 */
	owned: ReadonlySet<string>;
	candidates: number;
}): number {
	if (input.candidates === 0) return 0;
	let sum = 0;
	for (const r of input.recipes) {
		// 이미 가진 것을 또 만들 이유가 없다
		if (input.owned.has(r.giftId)) continue;
		const fit = input.resultFit.get(r.giftId) ?? 0;
		if (fit === 0) continue;
		sum += reachOf(r, input.have) * fit;
	}
	return sum / input.candidates;
}

/**
 * 팩 하나의 점수.
 *
 * **곱이지 합이 아니다(설계 5.1).** 두 축이 다른 질문에 답하므로 합으로 하면
 * 한쪽이 0 이어도 다른 쪽이 메운다 — 덱과 전혀 안 맞는 팩은 켜짐이 높아도
 * 고를 이유가 없다. 실측으로 「내쉬어진 한숨」이 켜짐 최고(0.568)이면서
 * 적합도 최하(0.052)다.
 */
export interface PackScore {
	/** 후보 기프트의 평균 적합도. 0~1 */
	fit: number;
	/** 후보 기프트의 전체 발동 조건 중 살아 있는 비율. 0~1 */
	live: number;
	/** 합성으로 얻는 몫. `fit` 과 같은 분모다 */
	fusion: number;
	/** `(fit + fusion) × live`. **순위를 매길 수 없으면 0 이다** */
	score: number;
	/** 보유를 뺀 기프트 수 */
	candidates: number;
	/**
	 * 이 점수로 순위를 매겨도 되나.
	 *
	 * 축을 하나도 공급하지 않는 덱은 적합도가 전부 0 이라 순서가 무의미하다.
	 * **0 점을 매겨 늘어놓으면 그 순서가 거짓말이 된다** — 화면이 「순위를 매길
	 * 수 없다」고 적고 등급 분포만 낸다.
	 */
	rankable: boolean;
}

export function scorePack(
	gifts: ReadonlyArray<ScoreGift>,
	supply: AxisSupply,
	/** `fusionOf` 가 낸 값. 호출자가 미리 셈해 넘긴다 — 레시피가 팩 밖의 것이라서다 */
	fusion = 0,
): PackScore {
	// 보유는 다시 못 얻고, 켜질 수 없는 것은 고를 이유가 없다
	const pool = gifts.filter((g) => !g.owned && g.fireable);
	const rankable = supply.max > 0;
	if (pool.length === 0) {
		return { fit: 0, live: 0, fusion: 0, score: 0, candidates: 0, rankable };
	}

	const fit = pool.reduce((s, g) => s + fitOf(g.keywordId, supply, g.exclusive), 0) / pool.length;

	// 발동 조건이 없는 기프트는 분모에서 빠진다. 0 으로 세지 않는다
	const total = pool.reduce((s, g) => s + g.total, 0);
	const live = total > 0 ? pool.reduce((s, g) => s + liveOf(g), 0) / total : 0;

	return {
		fit,
		live,
		fusion,
		// **안쪽은 합, 바깥은 곱**(설계 5절). F 와 C 는 둘 다 「이 팩에서 무엇을
		// 얻나」를 답하고, L 은 「그것이 내 편성에서 도나」라 성격이 다르다
		score: rankable ? (fit + fusion) * live : 0,
		candidates: pool.length,
		rankable,
	};
}
