/**
 * 골든 검증 — 실제 편성으로 판정이 맞는지 본다.
 *
 * 단위 테스트는 변환기가 규칙대로 도는지만 본다. 이 테스트는 **적재된 DB 로
 * 실제 편성을 판정해 알려진 답과 맞는지** 확인한다.
 *
 * 편성은 화상·진동 덱이다.
 *   10216 새벽 사무소 해결사 파우스트 · 11216 대표 그레고르 · 11009 해결사 싱클레어
 *   10916 거미집 엄지 아비 로쟈 · 10716 엄지 제자 히스클리프 · 10512 동부 엄지 카포 뫼르소
 *
 * 주의: refId 는 nullable 이 아니다. 「참조 대상 없음」은 null 이 아니라 빈 문자열 '' 이다.
 */
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { PrismaClient } from '../generated/client.js';
import { NO_DB, canonicalReachable } from './db-available.js';

const prisma = new PrismaClient();
/** CI 는 DB 를 쓰지 않는다. 없으면 건너뛰되 건너뛴 사실은 보고에 남는다 */
const DB = { skip: (await canonicalReachable(prisma)) ? false : NO_DB };
const SQUAD = ['10216', '11216', '11009', '10916', '10716', '10512'];

// 테스트 프로세스 종료 전 커넥션을 정리한다 — 안 하면 프로세스가 안 끝나거나
// 다른 테스트 파일과 커넥션 풀을 놓고 충돌할 수 있다
after(async () => {
	await prisma.$disconnect();
});

test('편성의 축 프로파일(무조건) — 화상 6 · 진동 5', DB, async () => {
	// **ego_id 칸은 게이트 재설계(Task 6)로 없어졌다.** 지금은 gate_kind·gate_ref·
	// gate_min 셋으로 조건을 적는다 — `gate_kind = 'always'` 가 옛 `ego_id = ''`
	// 자리다(무조건 부여). 이 검사는 그 무조건 행만 세는 raw 층 검사라 게이트
	// 평가(roster_count 등 충족 여부 판단)는 하지 않는다 — 그건 `Profile.count`
	// 의 몫이고 lib/engine/v2/axis-grant-golden.test.ts 의 「덱 A — 축 공급
	// 실측」이 잰다(같은 편성인데 VIBRATION 이 6 이다).
	//
	// 여기서 VIBRATION 이 5 인 이유: 11009 는 keyword 로 VIBRATION 을 안 갖고
	// `granted`(9282, DAWN 소속 3인 이상 게이트)로만 갖는데, 그 게이트가
	// `roster_count` 라 무조건이 아니다 — 그래서 이 raw 셈에서는 빠진다.
	// `Profile.count` 는 이 편성의 DAWN 인원이 3 을 채운다고 실제로 평가해 6 을 낸다.
	const rows = await prisma.$queryRaw<Array<{ axis_id: string; n: bigint }>>`
		SELECT axis_id, count(DISTINCT identity_id)::bigint AS n
		FROM canonical.identity_axis
		WHERE identity_id = ANY(${SQUAD}) AND gate_kind = 'always'
		GROUP BY 1 ORDER BY 2 DESC
	`;
	const m = Object.fromEntries(rows.map((r) => [r.axis_id, Number(r.n)]));
	assert.equal(m['COMBUSTION'], 6);
	assert.equal(m['VIBRATION'], 5);
	assert.equal(m['LACERATION'], undefined);
});

test('착영휘도를 이 편성의 10512 가 껴도 축이 안 는다 — 전용 대상이 아니다', DB, async () => {
	// **옛 가정이 틀렸다.** 예전엔 「10512 하나가 착영휘도로 두 축(출혈·호흡)을
	// 얻는다」고 적혀 있었는데, ADR-08 재조사로 착영휘도(2050911)는 「검계
	// 우두머리 뫼르소(10508) 전용 상시 효과」임이 드러났다(설계 1068행). 이
	// 편성의 10512(동부 엄지 카포 뫼르소)는 같은 수감자의 다른 인격일 뿐 대상이
	// 아니다 — app.axisGrant 가 대상을 10508 하나로 콕 집는다. 그래서 20509 를
	// 껴도 이 편성엔 아무 축도 안 붙는다. 대상이 실제로 반응하는 골든은
	// lib/engine/v2/axis-grant-golden.test.ts 의 「덱 C」다(10508 로 확인).
	//
	// 10916 도 호흡이 없다 — 패시브 1091603 이 화상·진동으로만 제한한다.
	const rows = await prisma.$queryRaw<Array<{ axis_id: string; n: bigint }>>`
		SELECT axis_id, count(DISTINCT identity_id)::bigint AS n
		FROM canonical.identity_axis
		WHERE identity_id = ANY(${SQUAD})
		  AND (gate_kind = 'always' OR (gate_kind = 'ego_equipped' AND gate_ref = '20509'))
		GROUP BY 1
	`;
	const m = Object.fromEntries(rows.map((r) => [r.axis_id, Number(r.n)]));
	assert.equal(m['LACERATION'], undefined, '전용 대상이 아니라 안 생긴다');
	assert.equal(m['BREATH'], undefined, '10916 은 화상·진동으로만 제한된다');
	assert.equal(m['COMBUSTION'], 6, '무관한 축은 그대로다');
});

test('편성 판정이 분기 없는 조인 하나로 끝난다 — v_identity_capability', DB, async () => {
	// 이 뷰가 「RDB 구조만으로 푼다」의 증거물이다. CASE 도 ref_kind 별 특례도 없다.
	// ego_id 칸은 없어졌다 — `gate_kind <> 'ego_equipped'` 가 옛 `ego_id = ''`
	// 자리다(E.G.O 장착 조건이 아닌 모든 것. roster_count 등 다른 게이트는 포함한다).
	const rows = await prisma.$queryRaw<Array<{ backed: bigint; hit: bigint }>>`
		SELECT count(*) FILTER (WHERE n IS NOT NULL)::bigint AS backed,
		       count(*) FILTER (WHERE n > 0)::bigint AS hit
		FROM (
			SELECT (SELECT count(DISTINCT ic.identity_id)
			          FROM canonical.v_identity_capability ic
			         WHERE ic.ref_kind = tr.ref_kind AND ic.ref_id = tr.ref_id
			           AND ic.gate_kind <> 'ego_equipped' AND ic.identity_id = ANY(${SQUAD})) AS n
			  FROM canonical.trigger_ref tr
			 WHERE EXISTS (SELECT 1 FROM canonical.v_identity_capability ic
			                WHERE ic.ref_kind = tr.ref_kind AND ic.ref_id = tr.ref_id)
		) x
	`;
	// 150 중 116 이 어휘로 닿는다. hit 은 이 PR 이전(옛 `ego_granted_axis` 시절) 67
	// 이었는데 63 으로 줄었다. **채널(affects) 탓이 아니다** — 이 SQL 은 `affects` 를
	// 아예 읽지 않고, 채널 좁히기가 걸리는 10104 는 이 SQUAD 에 없다. 실제 원인은
	// `special_status` 출처가 300 → 13(BULLET 전용)으로 좁혀진 데이터 변화다 —
	// 10916 은 `Breath` 상태(category=BREATH)를 갖지만 제한(1091603 「화상·진동으로만」)
	// 이 걸린 인격이라 옛 special_status 경로였다면 과대(BREATH 부여)로 잡혔을
	// 자리다. 좁히면서 10916 이 BREATH 를 더는 안 갖게 됐고, BREATH 를 가리키는
	// trigger_ref 가 정확히 4행(`Allies have Poise` · `Allies have Poise Skill` ·
	// `Poise E.G.O Skill Used` · `Poise Skill Used`)이라 67-63=4 와 실측이 맞아떨어진다
	// (2026-08-10, DB 대조로 확인)
	assert.equal(Number(rows[0]?.backed ?? 0n), 116);
	assert.equal(Number(rows[0]?.hit ?? 0n), 63);
});

test('검계 살수 파우스트는 출혈·호흡 인격이다 — mj 의 keyword 가 홍매화를 이미 담는다', DB, async () => {
	// **special_status 기대는 지금 틀렸다.** identity-axis.ts 가 special_status
	// 경로를 BULLET 하나로 좁힌 뒤(2026-08-10, c70f267) LACERATION 은 더 이상
	// special_status 를 거치지 않는다 — mj 의 `identity_keyword` 가 홍매화(특수
	// 출혈)를 이미 Laceration 키워드로 반영해 담았으므로 keyword 경로 하나로 닿는다.
	const rows = await prisma.identityAxis.findMany({
		where: { identityId: '10208' },
		select: { axisId: true, source: true },
	});
	const axes = [...new Set(rows.map((r) => r.axisId))].sort();
	assert.deepEqual(axes, ['BREATH', 'LACERATION']);
	assert.ok(
		rows.every((r) => r.source === 'keyword'),
		'지금은 keyword 경로 하나로 닿아야 한다(special_status 는 BULLET 전용)',
	);
});

test('소속 트리거가 상태가 아니라 소속을 가리킨다 — 오매칭 방지', DB, async () => {
	const dawn = await prisma.triggerRef.findMany({ where: { triggerId: 'Dawn Office Identities' } });
	assert.deepEqual(dawn.map((r) => [r.refKind, r.refId]), [['association', 'DAWN']]);
	const fanatic = await prisma.triggerRef.findMany({ where: { triggerId: 'N Corp. Fanatic Identities' } });
	assert.deepEqual(fanatic.map((r) => [r.refKind, r.refId]), [['association', 'N_CORP_FNATIC']]);
});

test('Trigger Tremor Burst 는 VIBRATION 이다 — 최장일치가 축을 못 찾으면 내려간다', DB, async () => {
	const r = await prisma.triggerRef.findMany({ where: { triggerId: 'Trigger Tremor Burst' } });
	assert.deepEqual(r.map((x) => [x.refKind, x.refId]), [['axis', 'VIBRATION']]);
});

test('축을 가리키는 트리거가 43종이다', DB, async () => {
	const n = await prisma.triggerRef.count({ where: { refKind: 'axis' } });
	assert.equal(n, 43);
});

test('gift_trigger_param 이 채워졌다 — min_count 69 · denominator 59 · slot 60', DB, async () => {
	// 예전 이 테스트는 0 을 고정하는 트립와이어였다. 채우면 깨지도록 두었고,
	// 실제로 깨져서 여기로 왔다 — 「채웠다」가 기록에 남는 방식이다
	const rows = await prisma.giftTriggerParam.groupBy({ by: ['kind'], _count: { _all: true } });
	const m = Object.fromEntries(rows.map((r) => [r.kind, r._count._all]));
	assert.deepEqual(m, { min_count: 69, denominator: 59, slot: 60 });
});

test('진혼이 실제로 판정된다 — 화상 6인 ≥ 5인, 분모는 출전', DB, async () => {
	// 설계가 처음부터 예시로 든 자리다. 트리거·임계값·분모가 다 있어야 답이 나온다.
	// ego_id 대신 gate_kind <> 'ego_equipped' 를 쓴다(위 검사와 같은 이유)
	const rows = await prisma.$queryRaw<Array<{ need: number; have: bigint; denom: string }>>`
		SELECT p.value::int AS need, d.value AS denom,
		       (SELECT count(DISTINCT ic.identity_id)
		          FROM canonical.v_identity_capability ic
		          JOIN canonical.trigger_ref tr ON tr.trigger_id = p.trigger_id
		               AND tr.ref_kind = ic.ref_kind AND tr.ref_id = ic.ref_id
		         WHERE ic.gate_kind <> 'ego_equipped' AND ic.identity_id = ANY(${SQUAD})) AS have
		  FROM canonical.gift_trigger_param p
		  JOIN canonical.gift_trigger_param d
		    ON d.gift_id = p.gift_id AND d.trigger_id = p.trigger_id AND d.kind = 'denominator'
		 WHERE p.gift_id = '9088' AND p.kind = 'min_count'
	`;
	assert.equal(rows.length, 1);
	assert.equal(rows[0]?.need, 5);
	assert.equal(rows[0]?.denom, 'field');
	assert.equal(Number(rows[0]?.have ?? 0n), 6);
	assert.ok(Number(rows[0]?.have ?? 0n) >= (rows[0]?.need ?? 0), '발동해야 한다');
});

test('같은 편성에서 미달하는 기프트가 있다 — 게이트가 실제로 거른다', DB, async () => {
	// 9090 피안개는 출혈 5인을 요구한다. 이 화상·진동 편성에는 출혈 인격이 없다
	const rows = await prisma.$queryRaw<Array<{ need: number; have: bigint }>>`
		SELECT p.value::int AS need,
		       (SELECT count(DISTINCT ic.identity_id)
		          FROM canonical.v_identity_capability ic
		          JOIN canonical.trigger_ref tr ON tr.trigger_id = p.trigger_id
		               AND tr.ref_kind = ic.ref_kind AND tr.ref_id = ic.ref_id
		         WHERE ic.gate_kind <> 'ego_equipped' AND ic.identity_id = ANY(${SQUAD})) AS have
		  FROM canonical.gift_trigger_param p
		 WHERE p.gift_id = '9090' AND p.kind = 'min_count'
	`;
	assert.equal(rows[0]?.need, 5);
	assert.equal(Number(rows[0]?.have ?? 0n), 0);
});
