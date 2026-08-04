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

const prisma = new PrismaClient();
const SQUAD = ['10216', '11216', '11009', '10916', '10716', '10512'];

// 테스트 프로세스 종료 전 커넥션을 정리한다 — 안 하면 프로세스가 안 끝나거나
// 다른 테스트 파일과 커넥션 풀을 놓고 충돌할 수 있다
after(async () => {
	await prisma.$disconnect();
});

test('편성의 축 프로파일 — 화상 6 · 진동 5', async () => {
	const rows = await prisma.$queryRaw<Array<{ axis_id: string; n: bigint }>>`
		SELECT axis_id, count(DISTINCT identity_id)::bigint AS n
		FROM canonical.identity_axis
		WHERE identity_id = ANY(${SQUAD})
		GROUP BY 1 ORDER BY 2 DESC
	`;
	const m = Object.fromEntries(rows.map((r) => [r.axis_id, Number(r.n)]));
	assert.equal(m['COMBUSTION'], 6);
	assert.equal(m['VIBRATION'], 5);
});

test('검계 살수 파우스트는 출혈·호흡 인격이다 — 홍매화가 LACERATION 으로 닿는다', async () => {
	const rows = await prisma.identityAxis.findMany({
		where: { identityId: '10208' },
		select: { axisId: true, source: true },
	});
	const axes = [...new Set(rows.map((r) => r.axisId))].sort();
	assert.deepEqual(axes, ['BREATH', 'LACERATION']);
	assert.ok(
		rows.some((r) => r.axisId === 'LACERATION' && r.source === 'special_status'),
		'홍매화 경로가 있어야 한다',
	);
});

test('소속 트리거가 상태가 아니라 소속을 가리킨다 — 오매칭 방지', async () => {
	const dawn = await prisma.triggerRef.findMany({ where: { triggerId: 'Dawn Office Identities' } });
	assert.deepEqual(dawn.map((r) => [r.refKind, r.refId]), [['association', 'DAWN']]);
	const fanatic = await prisma.triggerRef.findMany({ where: { triggerId: 'N Corp. Fanatic Identities' } });
	assert.deepEqual(fanatic.map((r) => [r.refKind, r.refId]), [['association', 'N_CORP_FNATIC']]);
});

test('Trigger Tremor Burst 는 VIBRATION 이다 — 최장일치가 축을 못 찾으면 내려간다', async () => {
	const r = await prisma.triggerRef.findMany({ where: { triggerId: 'Trigger Tremor Burst' } });
	assert.deepEqual(r.map((x) => [x.refKind, x.refId]), [['axis', 'VIBRATION']]);
});

test('축을 가리키는 트리거가 43종이다', async () => {
	const n = await prisma.triggerRef.count({ where: { refKind: 'axis' } });
	assert.equal(n, 43);
});

test('gift_trigger_param 은 비어 있다 — 저작 전이다', async () => {
	// 정량자는 이 계획의 범위 밖이다. 비어 있음을 명시적으로 고정해,
	// 나중에 채웠을 때 이 테스트가 깨져 「채웠다」는 사실이 드러나게 한다
	const n = await prisma.giftTriggerParam.count();
	assert.equal(n, 0);
});
