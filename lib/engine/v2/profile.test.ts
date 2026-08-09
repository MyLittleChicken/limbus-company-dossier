import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Profile } from './profile.js';
import type { Capability, Squad } from './types.js';

/** 출전 순서가 곧 자리 번호다 — 1번이 A, 2번이 B, 3번이 C */
const SQUAD: Squad = {
	roster: [
		{ identityId: 'A', egoIds: [] },
		{ identityId: 'B', egoIds: [] },
		{ identityId: 'C', egoIds: [] },
	],
	field: ['A', 'B', 'C'],
};

const CAPS: Capability[] = [
	{ identityId: 'A', refKind: 'axis', refId: 'COMBUSTION', egoId: '' },
	{ identityId: 'B', refKind: 'axis', refId: 'COMBUSTION', egoId: '' },
	// 파열은 3번 자리에만 있다 — 이 덱의 함정이다
	{ identityId: 'C', refKind: 'axis', refId: 'BURST', egoId: '' },
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
