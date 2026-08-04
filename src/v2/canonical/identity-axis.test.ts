import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildIdentityAxis, EGO_GRANTED, type IdentityAxisInput } from './identity-axis.js';
import { Meta } from './meta.js';

function input(): IdentityAxisInput {
	return {
		identityKeyword: [
			{ identityId: '10208', keywordId: 'Laceration' },
			{ identityId: '10208', keywordId: 'Breath' },
		],
		identityStatus: [
			// 홍매화 — 특수 출혈. status_category 로 LACERATION 에 닿는다
			{ identityId: '10208', statusId: 'RedApricotBlossom' },
			// 축이 아닌 상태는 무시된다
			{ identityId: '10208', statusId: 'Binding' },
		],
		statusCategory: [
			{ statusId: 'RedApricotBlossom', category: 'LACERATION' },
			{ statusId: 'Binding', category: 'IGNORE_CHECED_CORRECTION_EXCLUSION' },
		],
		axisIds: ['COMBUSTION', 'LACERATION', 'VIBRATION', 'BURST', 'SINKING', 'BREATH', 'CHARGE', 'BULLET'],
		// 20509 착영휘도는 수감자 5(이상). 같은 수감자 인격 둘 · 다른 수감자 하나
		identity: [
			{ id: '10208', sinnerId: 5 },
			{ id: '10508', sinnerId: 5 },
			{ id: '10109', sinnerId: 1 },
		],
		ego: [
			{ id: '20509', sinnerId: 5 },
			// 20705 홀리데이 — 증폭기. EGO_GRANTED 에 없으므로 행이 없어야 한다
			{ id: '20705', sinnerId: 7 },
		],
	};
}

test('키워드 경로 — 대문자 축으로 옮긴다', () => {
	const rows = buildIdentityAxis(input(), new Meta());
	const kw = rows.filter((r) => r.source === 'keyword').map((r) => r.axisId).sort();
	assert.deepEqual(kw, ['BREATH', 'LACERATION']);
});

test('특수 상태 경로 — 홍매화가 LACERATION 으로 닿는다', () => {
	const rows = buildIdentityAxis(input(), new Meta());
	const sp = rows.filter((r) => r.source === 'special_status');
	assert.deepEqual(sp.map((r) => r.axisId), ['LACERATION']);
});

test('축이 아닌 상태는 행을 만들지 않는다', () => {
	const rows = buildIdentityAxis(input(), new Meta());
	assert.equal(rows.filter((r) => r.axisId === 'IGNORE_CHECED_CORRECTION_EXCLUSION').length, 0);
});

test('ego_granted — 같은 수감자 인격 전부에 행이 선다', () => {
	const rows = buildIdentityAxis(input(), new Meta());
	const eg = rows
		.filter((r) => r.source === 'ego_granted')
		.map((r) => `${r.identityId}|${r.axisId}|${r.egoId}`)
		.sort();
	// 수감자 5 인격 둘 × 착영휘도 축 둘
	assert.deepEqual(eg, [
		'10208|BREATH|20509',
		'10208|LACERATION|20509',
		'10508|BREATH|20509',
		'10508|LACERATION|20509',
	]);
});

test('ego_granted — 다른 수감자 인격에는 안 선다', () => {
	const rows = buildIdentityAxis(input(), new Meta());
	assert.equal(rows.filter((r) => r.identityId === '10109').length, 0);
});

test('ego_granted 는 저작 표에 있는 E.G.O 만 만든다 — ego_status 로 유도하지 않는다', () => {
	// 20705 홀리데이는 ego_status 로 축 7개를 주지만 「부여하는 위력 +1」인 증폭기다.
	// 어느 축의 인격도 아니므로 행이 없어야 한다
	const rows = buildIdentityAxis(input(), new Meta());
	assert.equal(rows.filter((r) => r.egoId === '20705').length, 0);
	assert.deepEqual(Object.keys(EGO_GRANTED).sort(), ['20109', '20509']);
});

test('ego_granted 는 축 결손 판정에 안 들어간다', () => {
	// 10508 은 keyword·special_status 가 없다. 착영휘도로 축을 받아도
	// 「E.G.O 없이는 트리거에 안 걸린다」는 그대로여야 한다
	const meta = new Meta();
	buildIdentityAxis(input(), meta);
	assert.equal(meta.gaps.filter((g) => g.entityId === '10508' && g.field === 'axis').length, 1);
});

test('EGO_GRANTED 에 있으나 ego 에 없으면 결손으로 남는다', () => {
	const meta = new Meta();
	const i = input();
	i.ego = i.ego.filter((e) => e.id !== '20509');
	const rows = buildIdentityAxis(i, meta);
	assert.equal(rows.filter((r) => r.source === 'ego_granted').length, 0);
	assert.equal(meta.gaps.filter((g) => g.entityId === '20509').length, 1);
});
