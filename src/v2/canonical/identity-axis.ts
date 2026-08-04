/**
 * 인격이 가진 축.
 *
 * 세 경로를 한 관계로 통일한다.
 *   keyword         identity_keyword → axis
 *   special_status  identity_status → status_category → axis
 *   ego_granted     **저작 2행.** 아래 표를 보라
 */
import type { Meta } from './meta.js';

const EVIDENCE = 'docs/superpowers/specs/2026-08-03-mechanic-axis-graph-design.md';

/**
 * **E.G.O 장착이 축을 주는 경우는 저작이다.**
 *
 * `ego_status` 로 유도하면 안 된다 — 그것은 「이 E.G.O 가 다루는 상태」지
 * 「장착하면 그 인격이 이 축을 갖는다」가 아니다. 실측하면 `ego_status` 로 축을
 * 주는 E.G.O 가 94종인데 「인격으로 취급됨」이 명시된 것은 2종뿐이다.
 *
 * 반례 — 20705 홀리데이는 「부여하는 화상·출혈·진동·파열·침잠 위력 **+1**」인
 * 증폭기인데 `ego_status` 로는 축 7개를 전부 받는다. 어느 축의 인격도 아니다.
 *
 * 새 메카닉이 나오면 행이 는다. 게임이 「인격으로 취급됨」을 명시하므로 판별은 쉽다.
 */
export const EGO_GRANTED: Record<string, string[]> = {
	// 착영휘도 — 「이 인격은 [Laceration], [Breath]을 부여하는 인격으로 취급됨」
	'20509': ['LACERATION', 'BREATH'],
	// 엄숙한 애도 — 「이 인격은 [Vibration], [Sinking]을 부여하는 인격으로 취급됨」
	'20109': ['VIBRATION', 'SINKING'],
};

export interface IdentityAxisInput {
	identityKeyword: Array<{ identityId: string; keywordId: string }>;
	identityStatus: Array<{ identityId: string; statusId: string }>;
	statusCategory: Array<{ statusId: string; category: string }>;
	axisIds: string[];
}

export interface IdentityAxisRow {
	identityId: string;
	axisId: string;
	source: string;
	egoId: string | null;
}

export function buildIdentityAxis(input: IdentityAxisInput, meta: Meta): IdentityAxisRow[] {
	const axes = new Set(input.axisIds);
	const seen = new Set<string>();
	const rows: IdentityAxisRow[] = [];
	const push = (identityId: string, axisId: string, source: string) => {
		const key = `${identityId}|${axisId}|${source}`;
		if (seen.has(key)) return;
		seen.add(key);
		rows.push({ identityId, axisId, source, egoId: null });
	};

	// ── keyword 경로 ───────────────────────────────────────────
	// keyword.id 를 대문자화하면 축 id 다. mj 가 특수 키워드 파생과
	// 「~로만 취급됨」을 이미 반영해 담았으므로 그대로 옮긴다
	for (const k of input.identityKeyword) {
		const axisId = k.keywordId.toUpperCase();
		if (!axes.has(axisId)) continue;
		push(k.identityId, axisId, 'keyword');
	}

	// ── special_status 경로 ────────────────────────────────────
	// 홍매화(특수 출혈) → LACERATION. 게임이 부모 축으로 취급한다
	const statusToAxis = new Map<string, string>();
	for (const s of input.statusCategory) {
		if (axes.has(s.category)) statusToAxis.set(s.statusId, s.category);
	}
	for (const s of input.identityStatus) {
		const axisId = statusToAxis.get(s.statusId);
		if (axisId === undefined) continue;
		push(s.identityId, axisId, 'special_status');
	}

	// ── 축이 하나도 없는 인격을 기록한다 ─────────────────────────
	// 실측 5인격(10201·10205·10305·10903·11206). E.G.O 없이는 축 프로파일이 빈다
	const withAxis = new Set(rows.map((r) => r.identityId));
	const allIds = new Set([
		...input.identityKeyword.map((k) => k.identityId),
		...input.identityStatus.map((s) => s.identityId),
	]);
	for (const id of [...allIds].sort()) {
		if (withAxis.has(id)) continue;
		meta.gap('identity', id, 'axis', '축이 하나도 없다 — E.G.O 없이는 트리거에 안 걸린다', EVIDENCE);
	}

	return rows;
}
