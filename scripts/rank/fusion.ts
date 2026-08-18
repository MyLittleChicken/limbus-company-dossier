/**
 * 합성 관계: 이 기프트가 무엇을 만드는 재료인가.
 *
 * 거울 던전에서 상위 기프트(진혼 9088·달의 기억 9083)는 합성으로만 나온다 —
 * 집을 수 없다. 그리고 하위(재료) 기프트를 집는 데엔 상위를 만들려는 목적이
 * 있다 — 「재에서 재로」를 집는 이유는 그 자체 효과가 아니라 진혼으로 가는
 * 길인 경우가 많다. 사람이 하위 기프트를 판정하려면 무엇을 만드는 재료인지
 * 알아야 한다. 이 파일은 그 관계만 답하는 순수 함수다 — 값 판단은 안 한다.
 */

export interface Recipe {
	result: string;
	/**
	 * 칸의 배열. 칸마다 후보가 여럿일 수 있다(선택지형 칸) — 그중 **하나만**
	 * 들어간다. 예: 달의 기억은 슬롯0 이 일곱 후보 중 하나, 슬롯1~3 은 단일이다.
	 */
	slots: string[][];
}

export interface FusionRole {
	/** 어떤 레시피의 결과물이면 참. 호출자는 이것을 보고 후보에서 뺀다 */
	madeOnly: boolean;
	/** 이 기프트가 재료로 쓰이는 상위들. 재료가 아니면 빈 배열 */
	makes: Array<{
		result: string;
		/** 그 레시피에서 함께 필요한 다른 재료. 자기 자신과 같은 칸의 형제 후보는 안 담는다 */
		withOthers: string[];
	}>;
}

/**
 * 레시피 목록에서 기프트별 합성 역할을 뽑는다.
 *
 * **레시피가 없는 기프트는 맵에 안 넣는다.** `madeOnly: false · makes: []` 를
 * 기본값으로 돌려줘도 맞지만, 그러면 무한한 기프트 전체에 대해 항목을 만들
 * 근거가 없다 — 호출자가 `map.get(id) ?? { madeOnly: false, makes: [] }` 로
 * 기본값을 채우는 쪽이 "이 기프트가 레시피에 한 번도 안 나온다"는 사실을
 * 맵의 부재로 드러내 더 정직하다.
 */
export function fusionRolesOf(recipes: Recipe[]): Map<string, FusionRole> {
	const madeOnly = new Set<string>();

	// 재료 기프트 → (결과물 → 함께 필요한 재료 집합).
	// 결과물이 같은 레시피가 여럿이어도(진혼처럼) 재료마다 "처음 등장한
	// 레시피"의 withOthers 만 남긴다 — 뒤 레시피에서 같은 재료가 다시 나와도
	// 무시한다. 재료가 레시피마다 다를 수 있으므로 이건 레시피 단위가 아니라
	// (결과물, 재료) 쌍 단위로 판단해야 한다.
	const makesByGift = new Map<string, Map<string, Set<string>>>();

	for (const recipe of recipes) {
		madeOnly.add(recipe.result);

		for (let i = 0; i < recipe.slots.length; i++) {
			const slot = recipe.slots[i] ?? [];
			for (const gift of slot) {
				let byResult = makesByGift.get(gift);
				if (!byResult) {
					byResult = new Map();
					makesByGift.set(gift, byResult);
				}
				if (byResult.has(recipe.result)) continue; // 이 재료는 이 결과물에서 이미 첫 등장을 기록했다

				// 다른 칸의 후보 전부가 "함께 필요한 것" — 선택지형 칸이면 그중
				// 하나만 실제로 쓰이지만, 어느 것인지는 이 함수의 관심사가 아니다.
				// 같은 칸(i)의 형제 후보는 뺀다 — 그건 대안이지 동반이 아니다.
				const others = new Set<string>();
				for (let j = 0; j < recipe.slots.length; j++) {
					if (j === i) continue;
					for (const other of recipe.slots[j] ?? []) others.add(other);
				}
				others.delete(gift); // 같은 기프트가 다른 칸에도 후보로 있을 경우의 방어

				byResult.set(recipe.result, others);
			}
		}
	}

	const allGifts = new Set<string>([...madeOnly, ...makesByGift.keys()]);
	const roles = new Map<string, FusionRole>();
	for (const gift of allGifts) {
		const byResult = makesByGift.get(gift);
		const makes = byResult
			? [...byResult.entries()]
					.map(([result, others]) => ({ result, withOthers: [...others].sort() }))
					.sort((a, b) => a.result.localeCompare(b.result))
			: [];
		roles.set(gift, { madeOnly: madeOnly.has(gift), makes });
	}
	return roles;
}
