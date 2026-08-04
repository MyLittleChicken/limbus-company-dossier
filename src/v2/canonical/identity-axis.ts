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
	/** E.G.O 는 인격이 아니라 **수감자**에 딸린다. 장착 가능한 인격을 여기서 편다 */
	identity: Array<{ id: string; sinnerId: number }>;
	ego: Array<{ id: string; sinnerId: number }>;
}

export interface IdentityAxisRow {
	identityId: string;
	axisId: string;
	source: string;
	egoId: string;
}

export function buildIdentityAxis(input: IdentityAxisInput, meta: Meta): IdentityAxisRow[] {
	const axes = new Set(input.axisIds);
	const seen = new Set<string>();
	const rows: IdentityAxisRow[] = [];
	const push = (identityId: string, axisId: string, source: string, egoId = '') => {
		const key = `${identityId}|${axisId}|${source}|${egoId}`;
		if (seen.has(key)) return;
		seen.add(key);
		rows.push({ identityId, axisId, source, egoId });
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

	// ── ego_granted 경로 ───────────────────────────────────────
	// **조건부 행이다.** E.G.O 는 수감자에 딸리므로 그 수감자의 인격 전부가
	// 장착 후보다. 실제로 축을 갖는지는 편성의 E.G.O 선택에 달렸고, 그 조건을
	// `egoId` 가 진다 — 소비자는 `source='ego_granted' AND ego_id IN (장착분)`
	// 으로 거른다. 무조건 축으로 세면 20509 를 안 낀 이상까지 출혈 인격이 된다.
	const bySinner = new Map<number, string[]>();
	for (const i of input.identity) {
		const list = bySinner.get(i.sinnerId);
		if (list === undefined) bySinner.set(i.sinnerId, [i.id]);
		else list.push(i.id);
	}
	const egoSinner = new Map(input.ego.map((e) => [e.id, e.sinnerId]));
	for (const [egoId, axisIds] of Object.entries(EGO_GRANTED)) {
		const sinnerId = egoSinner.get(egoId);
		if (sinnerId === undefined) {
			// 저작 표가 실물을 앞질렀다. 조용히 넘기면 축이 통째로 빈다
			meta.gap('ego', egoId, 'axis', 'EGO_GRANTED 에 있으나 ego 에 없다', EVIDENCE);
			continue;
		}
		for (const identityId of bySinner.get(sinnerId) ?? []) {
			for (const axisId of axisIds) {
				if (!axes.has(axisId)) continue;
				push(identityId, axisId, 'ego_granted', egoId);
			}
		}
	}

	// ── 축이 하나도 없는 인격을 기록한다 ─────────────────────────
	// 실측 5인격(10201·10205·10305·10903·11206). E.G.O 없이는 축 프로파일이 빈다
	// ego_granted 는 세지 않는다 — 결손의 뜻이 「E.G.O 없이는 트리거에 안 걸린다」다
	const withAxis = new Set(
		rows.filter((r) => r.source !== 'ego_granted').map((r) => r.identityId),
	);
	// 인격 전수를 본다. keyword·status 를 가진 인격만 보면 **둘 다 없는 인격**이
	// 검사에서 빠진다 — 축이 없다는 사실을 가장 확실히 아는 쪽이 그쪽이다
	const allIds = new Set(input.identity.map((i) => i.id));
	for (const id of [...allIds].sort()) {
		if (withAxis.has(id)) continue;
		meta.gap('identity', id, 'axis', '축이 하나도 없다 — E.G.O 없이는 트리거에 안 걸린다', EVIDENCE);
	}

	return rows;
}
