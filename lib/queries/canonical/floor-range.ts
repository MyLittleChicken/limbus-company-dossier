/**
 * 층 구간 표기 — `floor_pack.floor_range` 의 `"1"` · `"6-10"`.
 *
 * 원본 표기가 단일 층과 구간으로 섞여 있다. 문자열로 비교하면 3층이 `6-10` 에 안 걸린다 —
 * 양끝을 펴서 본다. **읽는 규칙은 여기 하나다** — 추천(`recommend.ts` 의 `rangeCovers`)과
 * MCP `list_floor_packs` 가 같은 표기를 같게 읽는다.
 *
 * 읽는 것은 `n` 과 `a-b`(앞뒤 공백 허용) 뿐이다. 그 밖(`1-` · `B1` · `6~10` · 빈 문자열 ·
 * `1-5-7`)은 양끝을 지어내지 않고 null — 어느 층도 포함하지 않는다.
 */
export function floorBounds(range: string): { floorFrom: number | null; floorTo: number | null } {
	const m = /^\s*(\d+)\s*(?:-\s*(\d+)\s*)?$/.exec(range);
	if (!m) return { floorFrom: null, floorTo: null };
	const from = Number(m[1]);
	return { floorFrom: from, floorTo: m[2] === undefined ? from : Number(m[2]) };
}

/** 구간이 그 층을 포함하나. 표기를 못 읽으면 false. */
export function floorRangeCovers(range: string, floor: number): boolean {
	const { floorFrom, floorTo } = floorBounds(range);
	return floorFrom !== null && floorTo !== null && floorFrom <= floor && floor <= floorTo;
}
