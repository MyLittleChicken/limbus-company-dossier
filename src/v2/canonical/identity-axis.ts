/**
 * 인격이 가진 축.
 *
 * 세 경로를 한 관계로 통일한다.
 *   keyword         identity_keyword → axis
 *   special_status   identity_status → status_category → axis (**BULLET 하나만**)
 *   granted          app.axis_grant 의 add 행 (Task 3 의 buildAxisGrant 가 편 것)
 *
 * **`keyword` 가 대부분의 축에서 정본이다.** `keyword.id` 를 대문자화하면 축 id 이고,
 * mj 가 특수 키워드 파생과 「~로만 취급됨」을 이미 반영해 담았다. 제한 패시브를 가진
 * 인격 넷을 전수 대조해 확인했다(2026-08-10).
 *
 *   10109 「출혈로만」              keyword = Laceration
 *   10916 「화상·진동으로만」       keyword = Combustion, Vibration
 *   11109 「출혈로만」              keyword = Laceration
 *   10415 「화상·출혈·호흡으로만」  keyword = Breath, Combustion, Laceration
 *
 * **`special_status` 를 통째로 없앴다가 되살렸다(2026-08-10).** 처음엔 `keyword` 의
 * 진상위집합이라 보태는 것이 0 이라고 적었는데, 그건 **축** 이 아니라 **인격** 기준으로
 * 잰 결과였다 — 「`keyword` 가 없는 다섯 인격은 `special_status` 도 비어 있어 구제되지
 * 않는다」는 맞지만, 「모든 축이 keyword 로 표현된다」는 확인하지 않았다. 실제로
 * `canonical.keyword` 어휘 12종(Breath·Burst·Charge·Combustion·Hit·Laceration·None·
 * Penetrate·Random·Sinking·Slash·Vibration)은 축 8종 중 일곱만 담는다. **BULLET(가속)은
 * 없다** — 가속탄은 부여 키워드가 아니라 자원 계열이라 게임이 애초에 keyword 어휘에
 * 넣지 않았다. `special_status` 를 완전히 없애면 BULLET 을 가진 인격이 13명에서 0명이
 * 되고 트리거 2종(Allies have Ammo Skill · Ammo Skill Used)·기프트 8개가 근거를 잃는다
 * (실측, `identity_status`→`status_category`='BULLET' 인 인격 13명).
 *
 * 그래서 규칙을 좁힌다: **`keyword` 어휘가 표현할 수 없는 축에 한해서만**
 * `special_status` 를 쓴다. 어느 축이 그런지는 코드가 매번 어휘와 대조해 가려낸다
 * (`keywordVocabulary` 를 대문자화해 축과 겹치는 것을 뺀 나머지) — 지금은 BULLET
 * 하나지만, 다음에 axis 가 늘거나 keyword 어휘가 늘면 이 교집합이 자동으로 갱신된다.
 * `keyword` 로 표현되는 나머지 일곱 축에는 여전히 `special_status` 를 안 쓴다 —
 * 얹으면 과대 34짝이 생겨(실측) 게임의 「…으로만 취급됨」이 무너진다.
 *
 * 세 경로 전부에 `restrict` 를 건다. mj 가 앞으로도 반영해 준다는 보장은 없고,
 * 제한은 최종 방어선이어야 한다.
 *
 * **제한의 사정거리도 같은 잣대로 좁힌다(2026-08-10, 사용자 확정).** 「…을 부여하는
 * 인격으로만 취급됨」은 부여 키워드(=`keyword` 어휘가 표현하는 축)에 대한 말이지
 * 인격의 축 전체에 대한 말이 아니다. 10916 로쟈는 「화상·진동으로만」(1091603)이지만
 * 동시에 `AccelBullet` 을 39회 굴리는 가속탄 인격이다 — BULLET 은 어휘 밖이라 제한이
 * 안 닿고, 로쟈는 여전히 BULLET 을 가져야 한다. `restrictScope`(=`keywordAxes`, 여기
 * 이 함수가 계산하는 값)를 `applyRestrict` 에 그대로 넘겨 이 사정거리를 강제한다.
 */
import type { Meta } from './meta.js';
import { applyRestrict, type AxisRestrictRow, type GrantedAxisRow } from './axis-grant.js';

const EVIDENCE = 'docs/superpowers/specs/2026-08-10-axis-grant-design.md';

export interface IdentityAxisInput {
	identityKeyword: Array<{ identityId: string; keywordId: string }>;
	/**
	 * 제한이 미치는 축(= `keyword` 가 표현하는 축). `buildAxisGrant` 에 넘기는
	 * `restrictScope` 와 같은 값이어야 한다 — special_status 를 쓸지 가르는
	 * 잣대와도 같다. load-canonical.ts 한 곳에서 계산해 둘 다에 넘긴다
	 */
	restrictScope: Set<string>;
	identityStatus: Array<{ identityId: string; statusId: string }>;
	statusCategory: Array<{ statusId: string; category: string }>;
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

	// keyword 어휘가 표현 가능한 축 — special_status 를 쓸지, 제한이 미칠지를
	// 가르는 같은 잣대다(load-canonical.ts 가 계산해 넘긴다)
	const keywordAxes = input.restrictScope;

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

	// ── special_status 경로 — keyword 어휘가 못 담는 축만(지금은 BULLET 하나) ──
	meta.gap('identity_axis', '*', 'special_status',
		'keyword 어휘 12종이 축 8종 중 BULLET 을 표현하지 못한다(가속탄은 부여 키워드가 ' +
		'아니라 자원 계열이다). 그 축만 identity_status → status_category 로 보강한다. ' +
		'나머지 일곱은 keyword 가 정본이고 그 경로를 쓰면 게임의 「…으로만 취급됨」이 무너진다',
		EVIDENCE);
	const categoryOf = new Map(input.statusCategory.map((s) => [s.statusId, s.category]));
	const seenSpecial = new Set<string>();
	const fromSpecialStatus: GrantedAxisRow[] = [];
	for (const s of input.identityStatus) {
		const axisId = categoryOf.get(s.statusId);
		if (axisId === undefined || !axes.has(axisId)) continue;
		if (keywordAxes.has(axisId)) continue; // keyword 가 정본인 축은 여기서 안 늘린다
		const key = `${s.identityId}|${axisId}`;
		if (seenSpecial.has(key)) continue; // 같은 인격이 같은 축의 상태를 여럿 가질 수 있다(예: Bullet · BulletLament)
		seenSpecial.add(key);
		fromSpecialStatus.push({
			identityId: s.identityId, axisId, affects: 'both',
			gateKind: 'always', gateRef: '', gateMin: null,
		});
	}

	// 제한은 세 경로 모두에 건다. granted 는 buildAxisGrant 가 이미 걸었지만
	// 두 번 걸어도 결과가 같다(교집합은 멱등이다) — 여기서도 걸어 최종
	// 방어선으로 삼는다. restrictScope 밖의 축(BULLET)은 세 경로 다 손대지 않는다
	const keyword = applyRestrict(fromKeyword, input.restrict, input.restrictScope);
	const specialStatus = applyRestrict(fromSpecialStatus, input.restrict, input.restrictScope);
	const granted = applyRestrict(input.granted, input.restrict, input.restrictScope);

	const seen = new Set<string>();
	const rows: IdentityAxisRow[] = [];
	const push = (r: GrantedAxisRow, source: string): void => {
		const key = `${r.identityId}|${r.axisId}|${source}|${r.gateKind}|${r.gateRef}`;
		if (seen.has(key)) return;
		seen.add(key);
		rows.push({ ...r, source });
	};
	for (const r of keyword) push(r, 'keyword');
	for (const r of specialStatus) push(r, 'special_status');
	for (const r of granted) push(r, 'granted');

	// ── 축이 하나도 없는 인격을 기록한다 ─────────────────────────
	// granted 는 세지 않는다 — 결손의 뜻이 「조건 없이는 트리거에 안 걸린다」다
	const withAxis = new Set(
		rows.filter((r) => r.source === 'keyword' || r.source === 'special_status').map((r) => r.identityId),
	);
	for (const id of [...input.identityIds].sort()) {
		if (withAxis.has(id)) continue;
		meta.gap('identity', id, 'axis', '축이 하나도 없다 — 조건 없이는 트리거에 안 걸린다', EVIDENCE);
	}

	return rows;
}
