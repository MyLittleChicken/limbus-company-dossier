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

/**
 * 키워드가 쓰는 말 → 공급 표가 쓰는 말.
 *
 * **둘이 다르다.** `gift.keyword_id` 는 `Hit`·`Penetrate` 인데
 * `skill.attack_type` 은 `blunt`·`pierce` 다. 소문자로만 바꿔 찾으면 둘은
 * 영영 안 만나고, `?? 0` 이 삼켜 예외도 안 난다 — 공격 타입 기프트 60건 중
 * 35건이 조용히 `fit = 0` 이 된다(실측 2026-08-17).
 */
const ATTACK_TYPE_OF = new Map([
	['SLASH', 'slash'],
	['PENETRATE', 'pierce'],
	['HIT', 'blunt'],
]);

/** 이 키워드가 무엇을 재는 말인가. 어휘 밖·`None`·null 은 `none` 이다 */
export type KeywordKind = 'axis' | 'attack' | 'none';

/** 키워드 하나의 갈래. **어휘를 아는 곳을 이 파일 하나로 묶는다** */
export function keywordKindOf(keywordId: string | null): KeywordKind {
	if (keywordId === null) return 'none';
	const k = keywordId.toUpperCase();
	if (AXES.has(k)) return 'axis';
	if (ATTACK_TYPE_OF.has(k)) return 'attack';
	return 'none';
}

/**
 * 이 키워드가 **공급 표의 어느 열쇠**를 보는가. 축은 대문자 그대로, 공격
 * 타입은 소문자로 바뀐 말이다(Hit → blunt). 어휘 밖이면 null.
 *
 * 호출자가 「이 카드의 키워드가 이 덱의 주력인가」를 물으려면 이 다리가
 * 필요하다 — 다리를 밖에서 다시 놓으면 `Hit`/`blunt` 를 또 어긋나게 짝짓는다.
 */
export function supplyKeyOf(keywordId: string | null): string | null {
	if (keywordId === null) return null;
	const k = keywordId.toUpperCase();
	if (AXES.has(k)) return k;
	return ATTACK_TYPE_OF.get(k) ?? null;
}

/** 이 키워드를 잴 수 있나 — 축이거나 공격 타입이면 잰다 */
export function inVocabulary(keywordId: string | null): boolean {
	return keywordKindOf(keywordId) !== 'none';
}

/**
 * 0~1. **분모는 둘 다 「출격 인원」이다** — 「출격 7명 중 몇 명이 이것을 대나」.
 *
 * **최댓값으로 나누면 안 된다**(2026-08-18 에 고침). 그전에는 「그 갈래에서 이
 * 덱이 가장 많이 가진 수」로 나눴는데, 그 자는 주력이 뚜렷한 덱에서만 맞는다.
 * 공급이 평평하거나 낮은 갈래에서는 한 명짜리 축도 1.0 이 되어 「이 덱과
 * 맞는다」가 거짓이 된다 — 실측: 참격 덱의 축 공급이 `BREATH 3 · LACERATION 3
 * · COMBUSTION 3` 이라 화상 기프트가 3/3 = 1.0 을 받고 「확실히 좋다」에 들어갔고,
 * 방향미정 덱은 축 최댓값이 1 이라 **한 명짜리 축이 1.0** 이 됐다. 사람은 그런
 * 카드를 당연히 낮게 매기므로, 부호를 못 박으라고 만든 무더기가 거꾸로
 * `w_적합` 을 0 쪽으로 끌어내린다.
 *
 * 출격 인원은 덱과 무관한 고정된 자라 그런 부풀림이 없다. 두 갈래가 같은 자를
 * 쓴다는 것(저울추 하나로 덮는다)은 그대로 지켜진다.
 */
export function fitOfKeyword(keywordId: string | null, supply: DeckSupply): number {
	// 출격이 없으면 잴 것이 없다. 0 으로 나누지 않는다
	if (supply.fieldSize <= 0) return 0;

	const kind = keywordKindOf(keywordId);
	const key = supplyKeyOf(keywordId);
	if (key === null) return 0; // 'None' 그리고 어휘 밖 — 범용이다. 등급 항이 값을 낸다

	const have = kind === 'axis'
		? supply.axis.get(key) ?? 0
		: supply.attackType.get(key) ?? 0;
	return have / supply.fieldSize;
}

/**
 * 키워드를 사람이 읽는 말로.
 *
 * **`'None'` 은 문자열이다.** `canonical.gift.keyword_id` 에 JSON `null` 이
 * 아니라 글자 그대로 `None` 이 들어 있는 행이 있고(적재 때 파이썬 `None` 이
 * 글자로 굳은 것으로 보인다), 그대로 두면 판정 페이지에도 진단 줄에도 「None」이
 * 뜬다. 사람이 볼 자리는 다 여기를 거친다 — 뿌리(적재)는 이 PR 밖이다.
 */
export function keywordLabel(k: string | null): string {
	return k === null || k === 'None' ? '키워드 없음' : k;
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
