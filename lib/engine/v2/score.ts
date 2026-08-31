/**
 * 팩 점수 — 설계 5절 + 값 모형(3단계, `2026-08-17-gift-score-design.md`).
 *
 * ```
 * 점수 = (값 V + 합성 도달 C) × 켜짐 L
 * V    = w_적합 · fit + w_등급 · tier + w_전용 · [전용]     ← 합이다. 곱이 아니다
 * ```
 *
 * **DB 를 모른다.** `Profile` 과 `evaluateGifts` 가 낸 것을 받아 셈만 한다.
 * 순수 함수라 검사가 DB 없이 돌고, 저울추가 코드로 잠긴다
 * (ADR-08 「규칙은 코드 · 사실은 데이터」).
 *
 * **반-감쇠 저울추가 셋이다** — 확정 1.0 / 가능 0.5, 연쇄 1홉 1.0 / 2홉 0.5,
 * 합성 도달 1.0 / 0.5 / 0.25(`fusion.ts` `reachOf`). 셋 다 같은 규칙이고(한 단계
 * 멀어지면 반) 실측에서 나온다. 값의 저울추 셋(적합·등급·전용)은 `weights.ts`
 * 에 있고 **표본에서 나온 수다** — 여기서 지어내지 않는다. 옛 「전용이면 fit 을
 * 반으로」는 죽었다: 전용은 이제 제 저울추를 가진 별도 항이다(설계 §4.3).
 * **이 헤더는 새 저울추를 만들지 않는다는 제약을 감사하는 자리다 — 저울추를
 * 늘릴 때는 이 수를 함께 고친다.**
 */
// 값 import 는 확장자를 뺀다 — tsc 는 .js 를 풀지만 번들러는 못 푼다
import { reachOf } from './fusion';
import type { Recipe } from './fusion.js';
import type { RefVerdict } from './types.js';
import { RANK_WEIGHTS, type RankWeights } from './weights';

/** 한 단계 불확실해지거나 한 홉 멀어지면 반. 이 파일의 저울추 전부다 */
const HALF = 0.5;

/**
 * 덱이 축과 공격 타입을 얼마나 공급하나.
 *
 * **`axis` 와 `attack_type` 둘만 본다.** `Profile` 은 죄악 · 공명 · 코인 · 스킬
 * 갈래 · 소속 · 유닛 키워드까지 여덟을 함께 내는데(PR-A 실측), 부여 어휘는
 * 축 + 공격 타입까지만 넓힌다(설계 §2.3) — 죄악은 「그 기프트가 그 죄악을
 * 키운다」는 보장이 약하다.
 */
export interface AxisSupply {
	/** 축 id → 인원 */
	counts: Map<string, number>;
	/** 최대 인원. **0 이면 축을 하나도 공급하지 않는 덱이다** */
	max: number;
	/** 공격 타입(`slash` · `pierce` · `blunt`) → 인원 */
	attackType: Map<string, number>;
	/**
	 * 출격 인원 — `fitOf` 의 분모다. **덱과 무관한 고정된 자여야 한다**(설계
	 * §4.3). 표에서 되계산할 수 없으므로(아무도 안 대는 축이 있으면 표의 합이
	 * 인원과 다르다) 따로 들고 다닌다.
	 */
	fieldSize: number;
}

export function axisSupplyOf(
	rows: ReadonlyArray<{ refKind: string; refId: string; count: number }>,
	fieldSize: number,
): AxisSupply {
	const counts = new Map<string, number>();
	const attackType = new Map<string, number>();
	for (const r of rows) {
		if (r.refKind === 'axis') counts.set(r.refId, Math.max(counts.get(r.refId) ?? 0, r.count));
		if (r.refKind === 'attack_type') {
			attackType.set(r.refId, Math.max(attackType.get(r.refId) ?? 0, r.count));
		}
	}
	const values = [...counts.values()];
	return {
		counts,
		max: values.length > 0 ? Math.max(...values) : 0,
		attackType,
		fieldSize,
	};
}

/** 축 키워드 일곱. `keywordId` 는 첫 글자만 대문자라 대문자로 맞춰 본다 */
const AXES = new Set([
	'COMBUSTION', 'LACERATION', 'BURST', 'BREATH', 'VIBRATION', 'SINKING', 'CHARGE',
]);

/**
 * 키워드가 쓰는 말 → 공급 표가 쓰는 말.
 *
 * **둘이 다르다.** `gift.keyword_id` 는 `Hit`·`Penetrate` 인데 `skill.attack_type`
 * 은 `blunt`·`pierce` 다. 소문자로만 바꿔 찾으면 둘은 영영 안 만나고, `?? 0` 이
 * 삼켜 예외도 안 난다 — 공격 타입 기프트 60건 중 35건이 조용히 `fit = 0` 이
 * 된다(실측 2026-08-17). `scripts/rank/fit.ts` 와 같은 다리다 — 표본과 엔진이
 * 다른 다리를 쓰면 골든이 거짓말이 된다.
 */
const ATTACK_TYPE_OF = new Map([
	['SLASH', 'slash'],
	['PENETRATE', 'pierce'],
	['HIT', 'blunt'],
]);

/**
 * 이 키워드가 내 덱에 얼마나 맞나. 0~1.
 *
 * **분모는 출격 인원이다 — 최댓값 정규화가 아니다**(설계 §4.3, 2026-08-18 결정).
 * 「그 갈래에서 가장 많이 가진 수」로 나누면 공급이 평평한 덱에서 한 명짜리
 * 축도 1.0 이 된다 — 실측: 방향미정 덱은 축 최댓값이 1 이라 모든 키워드가
 * 「완벽히 맞는다」로 잡혔고, 하필 그 덱이 `w_등급` 을 정하는 유일한 덱이라
 * 저울추가 통째로 어긋났다. **여기를 최댓값 정규화로 되돌리면 회귀다.**
 *
 * **전용을 곱하지 않는다.** 옛 모형은 `fit × (전용 ? 1 : 0.5)` 라 키워드 없는
 * 전용 기프트가 전용 여부를 아예 못 보였다. 전용은 `valueOf` 의 별도 항이다.
 *
 * 어휘 밖(`None` · `Random` · null)은 0 이다 — 범용이고, 등급 항이 값을 낸다.
 */
export function fitOf(keywordId: string | null, supply: AxisSupply): number {
	// `> 0` 의 부정형이다 — `<= 0` 은 NaN 을 그냥 통과시켜 적합도가 NaN 이 된다
	if (keywordId === null || !(supply.fieldSize > 0)) return 0;
	const k = keywordId.toUpperCase();
	if (AXES.has(k)) return (supply.counts.get(k) ?? 0) / supply.fieldSize;
	const attack = ATTACK_TYPE_OF.get(k);
	if (attack !== undefined) return (supply.attackType.get(attack) ?? 0) / supply.fieldSize;
	return 0;
}

/**
 * 등급을 0~1 로 편다. `fit` 과 같은 자로 재야 저울추를 견줄 수 있다.
 *
 * EX(등급 없음)는 1.0 이다 — 5등급 위이지만 5등급도 2건뿐이라 갈라 봐야
 * 표본이 안 나온다(설계 §4.4).
 */
export function tierOf(tier: number | null): number {
	if (tier === null) return 1;
	return Math.min(1, Math.max(0, (tier - 1) / 4));
}

/**
 * 기프트 하나의 값. **곱이 아니라 합이다**(설계 §2.4).
 *
 * 곱이면 적합도가 0 일 때 등급이 무엇이든 0 이라, 「범용 5등급이 화상 2등급보다
 * 위일 수 있다」가 원리적으로 불가능해진다. 「이 편성에서 안 켜진다」(`L`)만
 * 성격이 달라 곱인 채로 남는다 — `scorePack` 이 그렇게 조립한다.
 *
 * `WEIGHT_SUM` 으로 나눠 0~1 로 편다. 양수 배는 짝의 순서를 안 바꾸므로
 * 표본 골든과 어긋나지 않고, `PackScore.fit` 의 「0~1」 계약이 지켜진다.
 */
export function valueOf(
	gift: { keywordId: string | null; tier: number | null; exclusive: boolean },
	supply: AxisSupply,
	w: RankWeights = RANK_WEIGHTS,
): number {
	const sum = w.fit + w.tier + w.exclusive;
	if (!(sum > 0)) return 0;
	return (
		(w.fit * fitOf(gift.keywordId, supply) +
			w.tier * tierOf(gift.tier) +
			w.exclusive * (gift.exclusive ? 1 : 0)) / sum
	);
}

/** 점수가 보는 기프트 하나. **id 를 안 받는다** — 셈에 필요 없다 */
export interface ScoreGift {
	keywordId: string | null;
	/** 게임이 매긴 등급 1~5. EX 는 null — `tierOf` 가 1.0 으로 편다 */
	tier: number | null;
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
	/**
	 * 후보 기프트의 평균 **값**(적합 + 등급 + 전용의 저울 합). 0~1.
	 *
	 * 칸 이름은 `fit` 그대로다 — 화면이 이 모양에 매여 있다(설계 §5 PR-B).
	 * 옛 뜻(순수 적합도)에서 값으로 넓어졌다.
	 */
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
	 * 옛 조건은 「축 공급이 있는가」였다 — 적합도만으로는 축 없는 덱의 순서가
	 * 거짓말이라서다. 값 모형에서는 등급·전용 항이 축 없이도 순서를 만들고,
	 * 그 순서는 표본이 검증했다(방향미정 덱이 `w_등급` 을 정했다). 그래서
	 * 조건이 「출격 인원이 있는가」로 넓어진다 — 출격이 없으면 잴 것이 없다.
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
	const rankable = supply.fieldSize > 0;
	if (pool.length === 0) {
		return { fit: 0, live: 0, fusion: 0, score: 0, candidates: 0, rankable };
	}

	const fit = pool.reduce((s, g) => s + valueOf(g, supply), 0) / pool.length;

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
