/**
 * 순위 표본이 쓰는 타입. **DB 를 모른다.**
 *
 * `lib/engine/v2` 의 타입을 안 빌려온다 — 이 PR 은 엔진을 한 줄도 안 건드리고,
 * 빌려오면 엔진 타입이 바뀔 때 여기가 따라 움직인다.
 */

/** 4단 바구니. 3 이 가장 좋다 */
export type Bucket = 0 | 1 | 2 | 3;

/** 한 덱이 무엇을 얼마나 공급하나 */
export interface DeckSupply {
	/** 축 id(대문자) → 인원 */
	axis: Map<string, number>;
	/** 공격 타입(소문자) → 인원 */
	attackType: Map<string, number>;
	/**
	 * 출격 인원 수. **적합도의 분모다.**
	 *
	 * 위 두 표의 최댓값으로 나누면 공급이 평평한 덱에서 한 명짜리 축도 1.0 이
	 * 되어 「맞는다」가 거짓이 된다(`fit.ts` 참조). 덱과 무관한 고정된 자가
	 * 필요해서 인원을 따로 들고 다닌다 — 표에서 되계산할 수 없는 값이다
	 * (아무도 안 대는 축이 있으면 표의 합은 인원과 다르다).
	 */
	fieldSize: number;
}

/** 페이지가 보여 줄 기프트 하나 */
export interface GiftCard {
	giftId: string;
	name: string;
	/** 설명문 전문. **이름과 등급만으로는 얼마나 센지 알 수 없다** */
	desc: string;
	tier: number | null;
	keywordId: string | null;
	exclusive: boolean;
	/** 이 덱에서 켜지나. 저울추 셈은 참인 것만 센다 */
	fireable: boolean;
}

/** 사람이 매긴 한 줄 */
export interface RankRow {
	deck: string;
	giftId: string;
	bucket: Bucket;
}

/** 덱 하나 */
export interface DeckSpec {
	/** 'A' · 'B' · 'C' */
	id: string;
	name: string;
	/** 편성 12인. 앞 7인이 출격이다 */
	roster: string[];
	supply: DeckSupply;
}
