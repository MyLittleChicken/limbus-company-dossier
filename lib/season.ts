/**
 * 시즌 표기.
 *
 * 값이 한 축이 아니다 — 통상 · 시즌 번호 · 발푸르기스 회차 · 콜라보가 한 열에 섞여 있다.
 * 숫자를 그대로 내면 「시즌 0」·「시즌 9103」 같은 말이 나온다.
 *
 * ```
 * 0      통상
 * 1~8    시즌 N
 * 91NN   발푸르기스의 밤 — 뒤 두 자리가 회차
 * 8000   콜라보 — 명일방주 「선의의 순례」. 표본이 1 건이라 상수로 다룬다
 * ```
 *
 * **목록과 상세가 같은 말을 하도록 한 곳에 둔다.** 목록(`components/unit-list.tsx`)이 쓰던
 * 것을 여기로 옮겼다.
 */
export function seasonLabel(raw: number | null | undefined): string | null {
	if (raw === null || raw === undefined) return null;
	const n = String(raw);
	if (n === '0') return '통상';
	if (n === '8000') return '콜라보';
	if (n.startsWith('91') && n.length === 4) return `발푸르기스의 밤 ${Number(n.slice(2))}회`;
	return `시즌 ${n}`;
}
