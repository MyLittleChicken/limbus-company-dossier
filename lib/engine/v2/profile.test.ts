import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Profile } from './profile';
import type { Capability, Squad } from './types';

/** 출전 순서가 곧 자리 번호다 — 1번이 A, 2번이 B, 3번이 C */
const SQUAD: Squad = {
	roster: [
		{ identityId: 'A', egoIds: ['20509'] },
		{ identityId: 'B', egoIds: [] },
		{ identityId: 'C', egoIds: [] },
	],
	field: ['A', 'B', 'C'],
};

/** 조건 없이 붙는 능력. `affects` 는 기본 `both` 다 */
const always = (
	identityId: string,
	refKind: string,
	refId: string,
	affects = 'both',
): Capability => ({ identityId, refKind, refId, gateKind: 'always', gateRef: '', gateMin: null, affects });

const CAPS: Capability[] = [
	always('A', 'axis', 'COMBUSTION'),
	always('B', 'axis', 'COMBUSTION'),
	// 파열은 3번 자리에만 있다 — 이 덱의 함정이다
	always('C', 'axis', 'BURST'),
];

test('자리 범위로 세면 그 자리 인격만 걸린다', () => {
	const p = new Profile(SQUAD, CAPS);
	assert.equal(p.count('axis', 'BURST'), 1);
	// 1·2번 자리에는 파열이 없다. 전체로는 있어도 여기서는 0 이다
	assert.equal(p.countInSlots('axis', 'BURST', [1, 2]), 0);
	assert.equal(p.countInSlots('axis', 'BURST', [3]), 1);
});

test('자리 범위 안의 것은 정상으로 센다', () => {
	const p = new Profile(SQUAD, CAPS);
	assert.equal(p.countInSlots('axis', 'COMBUSTION', [1, 2]), 2);
	assert.equal(p.countInSlots('axis', 'COMBUSTION', [1]), 1);
});

test('편성보다 큰 자리 번호는 없는 자리다 — 지어내지 않는다', () => {
	const p = new Profile(SQUAD, CAPS);
	assert.equal(p.countInSlots('axis', 'COMBUSTION', [4, 5]), 0);
	// 있는 자리와 없는 자리가 섞이면 있는 것만 센다
	assert.equal(p.countInSlots('axis', 'COMBUSTION', [1, 9]), 1);
});

test('빈 자리 목록은 0 이다', () => {
	const p = new Profile(SQUAD, CAPS);
	assert.equal(p.countInSlots('axis', 'COMBUSTION', []), 0);
});

test('없는 갈래는 0 이다', () => {
	const p = new Profile(SQUAD, CAPS);
	assert.equal(p.countInSlots('sin', 'wrath', [1, 2, 3]), 0);
});

// ── 게이트: 조건이 실제로 충족됐을 때만 능력이 산다 ──────────────

test('always 는 언제나 센다', () => {
	const p = new Profile(SQUAD, [always('A', 'axis', 'COMBUSTION')]);
	assert.equal(p.count('axis', 'COMBUSTION', 'field'), 1);
});

test('ego_equipped 는 그 E.G.O 를 낀 인격만 센다', () => {
	const caps: Capability[] = [
		{ identityId: 'A', refKind: 'axis', refId: 'BREATH', gateKind: 'ego_equipped', gateRef: '20509', gateMin: null, affects: 'both' },
		{ identityId: 'B', refKind: 'axis', refId: 'BREATH', gateKind: 'ego_equipped', gateRef: '20509', gateMin: null, affects: 'both' },
	];
	const p = new Profile(SQUAD, caps);
	assert.equal(p.count('axis', 'BREATH', 'field'), 1);
});

test('gift_held 는 그 기프트를 보유해야 켜진다', () => {
	const caps: Capability[] = [
		{ identityId: 'A', refKind: 'axis', refId: 'VIBRATION', gateKind: 'gift_held', gateRef: '9282', gateMin: null, affects: 'both' },
	];
	assert.equal(new Profile(SQUAD, caps).count('axis', 'VIBRATION', 'field'), 0);
	assert.equal(new Profile(SQUAD, caps, ['9282']).count('axis', 'VIBRATION', 'field'), 1);
});

test('roster_count 는 그 소속 인원이 문턱을 넘어야 켜진다', () => {
	// A·B·C 가 전부 DAWN 이면 3명 → 켜진다. 둘뿐이면 안 켜진다
	const dawn3 = [always('A', 'association', 'DAWN'), always('B', 'association', 'DAWN'), always('C', 'association', 'DAWN')];
	const dawn2 = [always('A', 'association', 'DAWN'), always('B', 'association', 'DAWN')];
	const gated: Capability = { identityId: 'A', refKind: 'axis', refId: 'VIBRATION', gateKind: 'roster_count', gateRef: 'DAWN', gateMin: 3, affects: 'both' };
	assert.equal(new Profile(SQUAD, [...dawn3, gated]).count('axis', 'VIBRATION', 'field'), 1);
	assert.equal(new Profile(SQUAD, [...dawn2, gated]).count('axis', 'VIBRATION', 'field'), 0);
});

test('status_held 는 전투 중에만 아는 조건이라 세지 않는다', () => {
	const caps: Capability[] = [
		{ identityId: 'A', refKind: 'axis', refId: 'COMBUSTION', gateKind: 'status_held', gateRef: 'HeatRay', gateMin: null, affects: 'both' },
	];
	assert.equal(new Profile(SQUAD, caps).count('axis', 'COMBUSTION', 'field'), 0);
});

// ── 채널: 인격 취급(tag)과 스킬 취급(skill)이 갈린다 ──────────────

test('affects=skill 인 능력은 인격 수 셈에 안 잡힌다', () => {
	// 10104(개화 E.G.O::동백 이상)의 실제 모양 — VIBRATION 은 skill 전용이다
	const caps: Capability[] = [always('A', 'axis', 'VIBRATION', 'skill')];
	assert.equal(new Profile(SQUAD, caps).count('axis', 'VIBRATION', 'field'), 0);
});

test('affects=tag 와 both 는 잡힌다', () => {
	const tagCaps: Capability[] = [always('A', 'axis', 'VIBRATION', 'tag')];
	const bothCaps: Capability[] = [always('A', 'axis', 'VIBRATION', 'both')];
	assert.equal(new Profile(SQUAD, tagCaps).count('axis', 'VIBRATION', 'field'), 1);
	assert.equal(new Profile(SQUAD, bothCaps).count('axis', 'VIBRATION', 'field'), 1);
});

test('같은 인격이 tag 행과 skill 행을 함께 가져도 한 번만 세어진다', () => {
	const caps: Capability[] = [
		always('A', 'axis', 'VIBRATION', 'tag'),
		always('A', 'axis', 'VIBRATION', 'skill'),
	];
	assert.equal(new Profile(SQUAD, caps).count('axis', 'VIBRATION', 'field'), 1);
});

// countInSlots 도 같은 규칙을 따른다
test('countInSlots 도 skill 전용 행을 빼고 센다', () => {
	const caps: Capability[] = [always('A', 'axis', 'VIBRATION', 'skill')];
	assert.equal(new Profile(SQUAD, caps).countInSlots('axis', 'VIBRATION', [1]), 0);
});
