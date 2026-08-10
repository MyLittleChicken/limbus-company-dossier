import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildAxisGrant, type AxisGrantInput } from './axis-grant.js';
import { Meta } from './meta.js';

function input(): AxisGrantInput {
	return {
		axisGrant: [
			// 제한 — 10916 은 화상·진동으로만
			{ id: '1091603:COMBUSTION', sourceKind: 'passive', sourceId: '1091603', mode: 'restrict',
				targetKind: 'self', targetId: '10916', axisId: 'COMBUSTION', affects: 'both',
				gateKind: 'always', gateRef: '', gateMin: null },
			{ id: '1091603:VIBRATION', sourceKind: 'passive', sourceId: '1091603', mode: 'restrict',
				targetKind: 'self', targetId: '10916', axisId: 'VIBRATION', affects: 'both',
				gateKind: 'always', gateRef: '', gateMin: null },
			// 부여 — 소속 단위. DAWN 인격 둘에게 각각 간다
			{ id: '9282:VIBRATION', sourceKind: 'gift', sourceId: '9282', mode: 'add',
				targetKind: 'association', targetId: 'DAWN', axisId: 'VIBRATION', affects: 'both',
				gateKind: 'roster_count', gateRef: 'DAWN', gateMin: 3 },
			// 부여 — 인격 하나 전용이면서 E.G.O 장착이 조건이다.
			// 10916 을 대상으로 두어 제한이 부여를 이기는지 본다
			{ id: '2050911:BREATH', sourceKind: 'ego_passive', sourceId: '2050911', mode: 'add',
				targetKind: 'self', targetId: '10916', axisId: 'BREATH', affects: 'both',
				gateKind: 'ego_equipped', gateRef: '20509', gateMin: null },
			// 같은 조건인데 제한이 없는 인격 — 살아남아야 한다
			{ id: '2050911:LACERATION', sourceKind: 'ego_passive', sourceId: '2050911', mode: 'add',
				targetKind: 'self', targetId: '11001', axisId: 'LACERATION', affects: 'both',
				gateKind: 'ego_equipped', gateRef: '20509', gateMin: null },
			// 축이 아닌 것 — 조용히 버리지 않고 결손으로 남아야 한다
			{ id: 'zz:NOT_AN_AXIS', sourceKind: 'passive', sourceId: 'zz', mode: 'add',
				targetKind: 'self', targetId: '10916', axisId: 'NOT_AN_AXIS', affects: 'both',
				gateKind: 'always', gateRef: '', gateMin: null },
			// self 인데 대상이 없다 — 결손으로 남고 버려져야 한다
			{ id: 'ww:BREATH', sourceKind: 'passive', sourceId: 'ww', mode: 'add',
				targetKind: 'self', targetId: '', axisId: 'BREATH', affects: 'both',
				gateKind: 'always', gateRef: '', gateMin: null },
		],
		axisIds: ['COMBUSTION', 'VIBRATION', 'BREATH', 'LACERATION'],
		identityIds: ['10916', '11001', '11002'],
		identityAssociation: [
			{ identityId: '11001', associationId: 'DAWN' },
			{ identityId: '11002', associationId: 'DAWN' },
		],
		identityUnitKeyword: [],
	};
}

test('제한은 restrict 행으로 나온다', () => {
	const { restrict } = buildAxisGrant(input(), new Meta());
	assert.deepEqual(restrict.sort((a, b) => a.axisId.localeCompare(b.axisId)), [
		{ identityId: '10916', axisId: 'COMBUSTION', affects: 'both', sourceId: '1091603' },
		{ identityId: '10916', axisId: 'VIBRATION', affects: 'both', sourceId: '1091603' },
	]);
});

test('소속 단위 부여는 그 소속 인격 전부로 펴진다', () => {
	const { granted } = buildAxisGrant(input(), new Meta());
	const dawn = granted.filter((g) => g.gateRef === 'DAWN');
	assert.deepEqual(dawn.map((g) => g.identityId).sort(), ['11001', '11002']);
	assert.equal(dawn[0]?.gateKind, 'roster_count');
	assert.equal(dawn[0]?.gateMin, 3);
});

test('E.G.O 장착형은 적힌 인격 하나에만 걸린다', () => {
	const { granted } = buildAxisGrant(input(), new Meta());
	const ego = granted.filter((g) => g.gateRef === '20509');
	// 10916 도 후보였으나 제한이 지운다. 11001 만 남는다
	assert.deepEqual(ego.map((g) => g.identityId), ['11001']);
	assert.equal(ego[0]?.gateKind, 'ego_equipped');
});

test('제한은 부여보다 세다 — 제한 밖의 축은 granted 에서도 빠진다', () => {
	// 10916 은 화상·진동으로만인데 2050911 이 호흡을 주려 한다. 남으면 안 된다
	const { granted } = buildAxisGrant(input(), new Meta());
	assert.equal(granted.some((g) => g.identityId === '10916' && g.axisId === 'BREATH'), false);
});

test("target_kind='self' 인데 대상이 없으면 결손으로 남고 버려진다", () => {
	const meta = new Meta();
	const { granted } = buildAxisGrant(input(), meta);
	assert.equal(granted.some((g) => g.axisId === 'BREATH' && g.gateKind === 'always'), false);
	assert.ok(meta.gaps.some((g) => g.entityId === 'ww:BREATH' && g.field === 'target_id'));
});

test('모르는 축은 조용히 버리지 않고 결손으로 남는다', () => {
	const meta = new Meta();
	buildAxisGrant(input(), meta);
	assert.ok(meta.gaps.some((g) => g.entity === 'axis_grant' && g.entityId === 'zz:NOT_AN_AXIS'));
});

test('저작이 실물을 앞질러도 던지지 않고 결손으로 남는다', () => {
	const i = input();
	i.axisGrant.push({
		id: 'qq:COMBUSTION', sourceKind: 'passive', sourceId: 'qq', mode: 'restrict',
		targetKind: 'self', targetId: '99999', axisId: 'COMBUSTION', affects: 'both',
		gateKind: 'always', gateRef: '', gateMin: null,
	});
	const meta = new Meta();
	const { restrict } = buildAxisGrant(i, meta);
	assert.equal(restrict.some((r) => r.identityId === '99999'), false);
	assert.ok(meta.gaps.some((g) => g.entityId === 'qq:COMBUSTION'));
});
