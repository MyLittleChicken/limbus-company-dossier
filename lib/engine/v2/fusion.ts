/**
 * 합성 도달 — 설계 4절.
 *
 * **층이 서로 이어지는 자리다.** 1층에서 「공장 자동화」를 골라 귀신 들린 신발을
 * 얻었으면 2층의 「사랑할 수 없는」이 갑자기 값어치가 생긴다 — 둘을 합쳐 서릿발
 * 발자국이 되고, 그것은 `gift_pack` 에 없어 합성이 유일한 경로다.
 *
 * **런 이력은 필요 없다.** 이미 보유를 입력받으므로 「보유 + 이 팩으로 재료가
 * 얼마나 모이나」로 좁혀진다.
 *
 * **DB 를 모른다.** 순수 함수라 검사가 DB 없이 돈다.
 */

/** 한 단계 멀어지면 반. `score.ts` 의 것과 같은 규칙이다 */
const HALF = 0.5;

/**
 * 레시피 하나.
 *
 * `slots` 의 한 원소가 한 칸이고, 그 안의 배열이 **그 칸을 채울 수 있는 재료들**이다.
 * 대개 하나지만 선택지형 칸이 실측 1건 있다 — `material_id` 가 null 이고
 * `fusion_slot_option` 이 후보 7종을 담는다.
 */
export interface Recipe {
	giftId: string;
	slots: ReadonlyArray<ReadonlyArray<string>>;
}

/**
 * 이 레시피에 얼마나 가까운가. 0 또는 `0.5 ** 모자란칸수`.
 *
 * **모자란 칸 수만큼 반씩 깎는다** — 완성 1.0, 하나 모자람 0.5, 둘 모자람 0.25,
 * 셋 모자람 0.125. 레시피가 최대 4칸이므로 0.125 까지 난다.
 * 새 저울추가 아니라 「한 단계 멀어지면 반」의 거듭제곱이다.
 *
 * **하나도 안 모였으면 0 이다.** 거듭제곱을 끝까지 밀면 재료 넷짜리에서 0.0625 가
 * 남는데, 그건 「가깝다」가 아니라 「아무 관계 없다」이므로 0 으로 끊는다.
 */
export function reachOf(recipe: Recipe, have: ReadonlySet<string>): number {
	if (recipe.slots.length === 0) return 0;
	let filled = 0;
	for (const options of recipe.slots) {
		// 선택지형 칸은 하나라도 있으면 찬 것으로 센다
		if (options.some((m) => have.has(m))) filled += 1;
	}
	if (filled === 0) return 0;
	const missing = recipe.slots.length - filled;
	return HALF ** missing;
}
