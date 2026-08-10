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
 * (축 전체에서 `restrictScope`—keyword 어휘를 대문자화해 축과 겹치는 것—를 뺀
 * 나머지) — 지금은 BULLET 하나지만, 다음에 axis 가 늘거나 keyword 어휘가 늘면
 * 이 교집합이 자동으로 갱신된다.
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

	// **키는 PK(`identityId|axisId|source|gateKind|gateRef`)와 같고 `affects` 는
	// 안 들었다.** PK 를 바꾸는 것은 DDL 변경(재적재 위험)이라 이 PR 범위 밖이다.
	// 대신 같은 키에 `affects` 가 다른 두 행이 들어오면(조용히 하나로 접힐 자리)
	// 결손으로 남기고 먼저 온 행을 유지한다 — 지금 데이터에선 안 일어난다
	const seen = new Map<string, string>();
	const rows: IdentityAxisRow[] = [];
	const push = (r: GrantedAxisRow, source: string): void => {
		const key = `${r.identityId}|${r.axisId}|${source}|${r.gateKind}|${r.gateRef}`;
		const keptAffects = seen.get(key);
		if (keptAffects !== undefined) {
			if (keptAffects !== r.affects) {
				meta.gap('identity_axis', key, 'affects_collision',
					`같은 키(identityId|axisId|source|gateKind|gateRef)인데 affects 가 다른 ` +
					`두 행이 들어왔다 — 먼저 온 '${keptAffects}' 를 남기고 '${r.affects}' 는 ` +
					`버렸다. PK 가 affects 를 포함하지 않아 조용히 하나로 접힐 수 있는 자리다`,
					EVIDENCE);
			}
			return;
		}
		seen.set(key, r.affects);
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

	// ── 9073 엔도르핀 키트 — 어느 쪽으로도 단정하지 않는다 ─────────────────
	// 조건이 「스킬 효과로 호흡 위력을 획득할 때마다」라 스킬 층을 묻는데,
	// 기프트 조건에 어느 층을 묻는지 적을 칸(supply)이 없다. 엔진이 공급을
	// 태그 층에서만 세므로 이 기프트의 판정을 신뢰할 수 없다.
	// 10916 은 호흡 인격이 아니지만 스킬 1091606 이 Breath 5 를 준다
	// (coin_token, uptie 1~5 전부). fireable 을 이 코드가 정하면 그 답이
	// 틀렸을 때 골든으로 굳는다 — 그래서 값을 매기지 않고 결손으로 남긴다
	meta.gap('gift', '9073', 'supply',
		'조건이 「스킬 효과로 호흡 위력을 획득할 때마다」라 스킬 층을 묻는데 기프트 조건에 ' +
		'어느 층을 묻는지 적을 칸(supply)이 없다. 엔진이 공급을 태그 층에서만 세므로 이 ' +
		'기프트의 판정을 신뢰할 수 없다. 10916 은 호흡 인격이 아니지만 스킬 1091606 이 ' +
		'Breath 5 를 준다',
		EVIDENCE);

	// ── 취급 문형 전수 조사에서 걸러낸 것들 — 축이 아니라 다른 차원이다 ──────
	meta.gap('passive', '*', 'effect',
		'패시브 효과를 상태와 잇는 구조화된 표가 없다. passive 는 id·conditions[]·cond_type ' +
		'뿐이고 효과는 passive_text 산문에만 있다. 축 부여·제한 출처 9건만 저작으로 건졌다',
		EVIDENCE);
	meta.gap('gift', '9280', 'association_grant',
		'소속 자체를 바꾸는 효과를 담을 자리가 없다 — 「검계 소속 인격을 제외한 편성 순서가 ' +
		'가장 빠른 S사 소속 인격 1인을 검계 소속으로 취급」',
		EVIDENCE);
	meta.gap('gift', '9841', 'association_grant',
		'소속 자체를 바꾸는 효과를 담을 자리가 없다 — 「편성 순서가 가장 빠른 자신의 기본 ' +
		'스킬로 차원 균열을 부여하는 인격 중 W사 소속이 아닌 인격 1인을 W사 소속으로 취급함」',
		EVIDENCE);
	for (const id of ['1021504', '1061404']) {
		meta.gap('passive', id, 'skill_kind_grant',
			'스킬 분류를 바꾸는 효과를 담을 자리가 없다 — 「기본 공격 스킬과 합 가능 반격 스킬이 ' +
			'충전 횟수를 얻는 스킬로 취급됨」', EVIDENCE);
	}

	// ── 9282 날개 모양 양초 — 게이트가 논리곱인데 한쪽만 적힌다 ────────────
	// 원문은 「날개 모양 양초를 보유」 그리고 「새벽 사무소 소속 인격이 3인 이상」
	// 이다(AND). `gate_kind` 가 행당 하나뿐이라 `roster_count` 만 적었고, 기프트
	// 보유 조건(gift_held)은 담을 칸이 없다 — 기프트를 뽑지 않아도 DAWN 인원만
	// 3인을 채우면 축이 붙는다(실측 순증 1짝: 11009 VIBRATION). 게이트를
	// 배열로 넓히는 것은 기프트 능력 PR 의 몫이라 지금은 결손으로만 남긴다
	meta.gap('gift', '9282', 'gate_conjunction',
		'발동 조건이 「날개 모양 양초 보유」 AND 「새벽 사무소 소속 3인 이상」인데 ' +
		'gate_kind 는 행당 하나뿐이라 roster_count 만 적었다. 기프트를 보유하지 ' +
		'않아도 편성 인원만 차면 축이 붙는다(실측 순증 1짝: 11009 VIBRATION). ' +
		'게이트를 배열로 넓히는 것은 기프트 능력 PR 의 몫이다',
		EVIDENCE);

	// ── coin_token 의 스킬 공급 과대 — 이번 조사에서 새로 알게 된 것 ────────
	// 키워드 인격 판정은 「그 키워드를 부여/획득하는 공격 스킬 보유」이고 강화·추가·
	// 변신 형태 스킬은 「보유」 판정에서 제외된다. coin_token 은 그 구분 없이 모든
	// 스킬의 코인 토큰을 담으므로 여기서 공급을 세면 과대 계산이다. 다음 PR(기프트
	// 능력)의 몫이라 지금은 결손으로만 남긴다
	meta.gap('coin_token', '*', 'skill_possession',
		'플레이어 검증 자료에 따르면 키워드 인격 판정은 「그 키워드를 부여/획득하는 ' +
		'공격 스킬 보유」이고 강화·추가·변신 형태 스킬은 「보유」 판정에서 제외된다. ' +
		'coin_token 은 그 구분 없이 모든 스킬의 코인 토큰을 담으므로 스킬 공급을 여기서 ' +
		'세면 과대 계산이다. 실측으로 스킬은 주는데 태그가 아닌 짝이 21건 있고 일부가 ' +
		'이 때문이다(10916 로쟈의 호흡은 추가 스킬에서 나온다). 출처: 나무위키 Limbus ' +
		'Company/키워드 · 림버스 마이너 갤러리 「판정이 헷갈리는 인격에 대한 정리본」' +
		'(2026-08-10 확인)',
		EVIDENCE);

	return rows;
}
