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

test('ego_granted 는 저작 2행이다 — ego_status 로 유도하지 않는다', () => {
	// 20705 홀리데이는 ego_status 로 축 7개를 주지만 「부여하는 위력 +1」인 증폭기다.
	// 어느 축의 인격도 아니므로 표에 없어야 한다
	assert.deepEqual(Object.keys(EGO_GRANTED).sort(), ['20109', '20509']);
	// noUncheckedIndexedAccess — 키 존재는 위 줄에서 이미 확인했다
	assert.deepEqual(EGO_GRANTED['20509']!.sort(), ['BREATH', 'LACERATION']);
});
