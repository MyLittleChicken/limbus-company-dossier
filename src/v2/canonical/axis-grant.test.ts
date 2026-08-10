import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
	buildAxisGrant, applyRestrict,
	type AxisGrantInput, type GrantedAxisRow, type AxisRestrictRow,
} from './axis-grant.js';
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
		// 이 표본의 네 축 전부가 keyword 로 표현된다고 가정한다 — 제한이 평소처럼 걸린다
		restrictScope: new Set(['COMBUSTION', 'VIBRATION', 'BREATH', 'LACERATION']),
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

// applyRestrict 는 채널별로 좁혀야 한다 — .some() 은 한 채널만 막혔을 때
// 원본 'both' 를 통째로 살려 막힌 채널로 새어나간다.

// 아래 넷은 restrictScope 가 두 축(BREATH·COMBUSTION) 모두를 담아 사정거리
// 안이라고 가정한다 — 기존 채널별 좁히기 동작을 그대로 지킨다
const CHANNEL_SCOPE = new Set(['BREATH', 'COMBUSTION']);

test("제한이 tag 하나뿐이고 부여가 both 인데 축이 제한 밖이면 affects 가 skill 로 좁혀진다", () => {
	const granted: GrantedAxisRow[] = [
		{ identityId: '10916', axisId: 'BREATH', affects: 'both', gateKind: 'always', gateRef: '', gateMin: null },
	];
	const restrict: AxisRestrictRow[] = [
		{ identityId: '10916', axisId: 'COMBUSTION', affects: 'tag', sourceId: 'x' },
	];
	const out = applyRestrict(granted, restrict, CHANNEL_SCOPE);
	assert.deepEqual(out, [
		{ identityId: '10916', axisId: 'BREATH', affects: 'skill', gateKind: 'always', gateRef: '', gateMin: null },
	]);
});

test("같은 상황에서 축이 제한 안이면 both 그대로 남는다", () => {
	const granted: GrantedAxisRow[] = [
		{ identityId: '10916', axisId: 'COMBUSTION', affects: 'both', gateKind: 'always', gateRef: '', gateMin: null },
	];
	const restrict: AxisRestrictRow[] = [
		{ identityId: '10916', axisId: 'COMBUSTION', affects: 'tag', sourceId: 'x' },
	];
	const out = applyRestrict(granted, restrict, CHANNEL_SCOPE);
	assert.deepEqual(out, [
		{ identityId: '10916', axisId: 'COMBUSTION', affects: 'both', gateKind: 'always', gateRef: '', gateMin: null },
	]);
});

test("제한이 both 이고 축이 제한 밖이면 행이 사라진다", () => {
	const granted: GrantedAxisRow[] = [
		{ identityId: '10916', axisId: 'BREATH', affects: 'both', gateKind: 'always', gateRef: '', gateMin: null },
	];
	const restrict: AxisRestrictRow[] = [
		{ identityId: '10916', axisId: 'COMBUSTION', affects: 'both', sourceId: 'x' },
	];
	const out = applyRestrict(granted, restrict, CHANNEL_SCOPE);
	assert.deepEqual(out, []);
});

// ── restrictScope — 제한의 사정거리(2026-08-10, 사용자 확정) ────────────────
// 「…을 부여하는 인격으로만 취급됨」은 keyword 어휘가 표현하는 축에 대한 말이다.
// BULLET(가속탄)처럼 어휘 밖의 축은 제한과 무관한 별도 사실이라 손대면 안 된다.

test('restrictScope 밖의 축은 제한이 있어도 살아남는다 — 10916 의 BULLET', () => {
	const granted: GrantedAxisRow[] = [
		{ identityId: '10916', axisId: 'BULLET', affects: 'both', gateKind: 'always', gateRef: '', gateMin: null },
	];
	const restrict: AxisRestrictRow[] = [
		{ identityId: '10916', axisId: 'COMBUSTION', affects: 'both', sourceId: '1091603' },
		{ identityId: '10916', axisId: 'VIBRATION', affects: 'both', sourceId: '1091603' },
	];
	// BULLET 은 scope 밖 — keyword 어휘에 없다
	const out = applyRestrict(granted, restrict, new Set(['COMBUSTION', 'VIBRATION']));
	assert.deepEqual(out, granted);
});

test('restrictScope 안의 축은 지금처럼 지워진다', () => {
	const granted: GrantedAxisRow[] = [
		{ identityId: '10916', axisId: 'BREATH', affects: 'both', gateKind: 'always', gateRef: '', gateMin: null },
	];
	const restrict: AxisRestrictRow[] = [
		{ identityId: '10916', axisId: 'COMBUSTION', affects: 'both', sourceId: '1091603' },
	];
	// BREATH 도 COMBUSTION 도 scope 안 — 제한이 평소대로 BREATH 를 지운다
	const out = applyRestrict(granted, restrict, new Set(['COMBUSTION', 'VIBRATION', 'BREATH']));
	assert.deepEqual(out, []);
});

test('채널별 좁히기가 restrictScope 안에서 그대로 동작한다', () => {
	const granted: GrantedAxisRow[] = [
		{ identityId: '10916', axisId: 'BREATH', affects: 'both', gateKind: 'always', gateRef: '', gateMin: null },
	];
	const restrict: AxisRestrictRow[] = [
		{ identityId: '10916', axisId: 'COMBUSTION', affects: 'tag', sourceId: 'x' },
	];
	const out = applyRestrict(granted, restrict, new Set(['COMBUSTION', 'BREATH']));
	assert.deepEqual(out, [
		{ identityId: '10916', axisId: 'BREATH', affects: 'skill', gateKind: 'always', gateRef: '', gateMin: null },
	]);
});
