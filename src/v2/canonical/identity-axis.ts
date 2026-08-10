/**
 * 인격이 가진 축.
 *
 * 두 경로를 한 관계로 통일한다.
 *   keyword  identity_keyword → axis
 *   granted  app.axis_grant 의 add 행 (Task 3 의 buildAxisGrant 가 편 것)
 *
 * **`keyword` 가 정본이다.** `keyword.id` 를 대문자화하면 축 id 이고, mj 가
 * 특수 키워드 파생과 「~로만 취급됨」을 이미 반영해 담았다. 제한 패시브를 가진
 * 인격 넷을 전수 대조해 확인했다(2026-08-10).
 *
 *   10109 「출혈로만」              keyword = Laceration
 *   10916 「화상·진동으로만」       keyword = Combustion, Vibration
 *   11109 「출혈로만」              keyword = Laceration
 *   10415 「화상·출혈·호흡으로만」  keyword = Breath, Combustion, Laceration
 *
 * **`special_status` 경로는 없앴다.** `identity_status → status_category → axis`
 * 로 축을 유도하면 게임의 제한이 무너진다. 전수로 재면 그 경로는 `keyword` 의
 * 진상위집합이라(겹침 266 = keyword 전부) 보태는 것이 0 이고 과대 34짝만
 * 만들었다. `keyword` 가 없는 다섯 인격은 `special_status` 도 비어 있어 이
 * 경로로 구제되지도 않는다. `identity_status` 표 자체는 남는다 — 출처가 말한
 * 사실이고, 축을 그것에서 유도하지 않을 뿐이다.
 *
 * 그래도 `restrict` 를 여기서 한 번 더 건다. mj 가 앞으로도 반영해 준다는
 * 보장은 없고, 제한은 최종 방어선이어야 한다.
 */
import type { Meta } from './meta.js';
import { applyRestrict, type AxisRestrictRow, type GrantedAxisRow } from './axis-grant.js';

const EVIDENCE = 'docs/superpowers/specs/2026-08-10-axis-grant-design.md';

export interface IdentityAxisInput {
	identityKeyword: Array<{ identityId: string; keywordId: string }>;
	axisIds: string[];
	identityIds: string[];
	granted: GrantedAxisRow[];
	restrict: AxisRestrictRow[];
}

export interface IdentityAxisRow {
	identityId: string;
	axisId: string;
	source: string;
	affects: string;
	gateKind: string;
	gateRef: string;
	gateMin: number | null;
}

export function buildIdentityAxis(input: IdentityAxisInput, meta: Meta): IdentityAxisRow[] {
	const axes = new Set(input.axisIds);

	// ── keyword 경로 ───────────────────────────────────────────
	const fromKeyword: GrantedAxisRow[] = [];
	for (const k of input.identityKeyword) {
		const axisId = k.keywordId.toUpperCase();
		if (!axes.has(axisId)) continue;
		fromKeyword.push({
			identityId: k.identityId, axisId, affects: 'both',
			gateKind: 'always', gateRef: '', gateMin: null,
		});
	}

	// 제한은 keyword 에도 건다. granted 는 buildAxisGrant 가 이미 걸었지만
	// 두 번 걸어도 결과가 같다(교집합은 멱등이다) — 여기서도 걸어 최종
	// 방어선으로 삼는다
	const keyword = applyRestrict(fromKeyword, input.restrict);
	const granted = applyRestrict(input.granted, input.restrict);

	const seen = new Set<string>();
	const rows: IdentityAxisRow[] = [];
	const push = (r: GrantedAxisRow, source: string): void => {
		const key = `${r.identityId}|${r.axisId}|${source}|${r.gateKind}|${r.gateRef}`;
		if (seen.has(key)) return;
		seen.add(key);
		rows.push({ ...r, source });
	};
	for (const r of keyword) push(r, 'keyword');
	for (const r of granted) push(r, 'granted');

	// ── 축이 하나도 없는 인격을 기록한다 ─────────────────────────
	// granted 는 세지 않는다 — 결손의 뜻이 「조건 없이는 트리거에 안 걸린다」다
	const withAxis = new Set(rows.filter((r) => r.source === 'keyword').map((r) => r.identityId));
	for (const id of [...input.identityIds].sort()) {
		if (withAxis.has(id)) continue;
		meta.gap('identity', id, 'axis', '축이 하나도 없다 — 조건 없이는 트리거에 안 걸린다', EVIDENCE);
	}

	return rows;
}
