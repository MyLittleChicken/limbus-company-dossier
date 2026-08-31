/**
 * 기프트 값의 저울추 셋 — 표본에서 나온 값이다. 지어낸 수가 아니다.
 *
 * 출처: 순위 표본 304판정(2026-08-31, LLM 초안 — `src/v2/authored/gift-rank.jsonl`)
 * 을 격자 탐색으로 맞춘 결과다(`scripts/fit-weights.ts`).
 *
 * ```
 * 전체 정확도        80.3% (1,957/2,437짝)
 * 엇갈린 무더기      69.2% (229/331)   ← 표본이 실제로 정한 것
 * 갈래별 확인        축 덱 10개 전부 이 저울추로 수렴 · 확인 72~95%
 * ```
 *
 * **비율만 뜻이 있다.** 격자 탐색은 순서 제약을 세므로 저울추를 다 같이 몇 배
 * 해도 결과가 같다 — 몫으로는 적합 38% · 등급 57% · 전용 5%다.
 *
 * **덱 11(방향미정)을 빼고 맞추면 3 · 1.5 로 뒤집힌다**(확인 52.1%). `w_등급` 은
 * 적합도가 없는 덱에서만 정해지므로, 표본을 다시 짤 때 그런 덱을 빼면 이 값의
 * 근거가 사라진다. 사람 판정이 초안을 대체하면 이 수는 다시 나온다 —
 * `docs/superpowers/specs/2026-08-17-gift-score-design-결과.md`.
 */
export interface RankWeights {
	fit: number;
	tier: number;
	exclusive: number;
}

export const RANK_WEIGHTS: RankWeights = { fit: 2, tier: 3, exclusive: 0.25 };

/**
 * 항 셋의 합. `valueOf` 가 이것으로 나눠 값을 0~1 로 편다 — `PackScore.fit` 의
 * 「0~1」 계약을 지키기 위해서다. 양수 배는 순서를 안 바꾸므로 골든과 어긋나지
 * 않는다.
 */
export const WEIGHT_SUM = RANK_WEIGHTS.fit + RANK_WEIGHTS.tier + RANK_WEIGHTS.exclusive;
