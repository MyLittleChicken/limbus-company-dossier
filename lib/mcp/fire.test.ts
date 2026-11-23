import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { GiftVerdict } from '@/lib/engine/v2/types';
import { fireState } from './fire';

const v = (over: Partial<GiftVerdict>): GiftVerdict => ({
	giftId: '9001', grade: 'A', decidable: 0, satisfied: 0, certain: 0, total: 0,
	reasons: [], fireable: true, ...over,
});

test('판정 없음 → possible + no-judgement-data', () =>
	assert.deepEqual(fireState(undefined), { state: 'possible', reason: 'no-judgement-data' }));

test('fireable false → off', () => assert.equal(fireState(v({ fireable: false })).state, 'off'));

test('전부 확정 충족 → on', () =>
	assert.equal(fireState(v({ fireable: true, total: 2, certain: 2, satisfied: 2 })).state, 'on'));

test('가능이 남으면 possible', () =>
	assert.equal(fireState(v({ fireable: true, total: 2, certain: 1, satisfied: 2 })).state, 'possible'));

// ── 계획 밖 보강 ──

test('fireable false 면 확정 충족 수와 무관하게 off', () =>
	assert.deepEqual(fireState(v({ fireable: false, total: 2, certain: 2, satisfied: 2 })), { state: 'off' }));

test('조건이 없는 판정(total 0)은 on 이 아니라 possible, reason 없음', () =>
	assert.deepEqual(fireState(v({ fireable: true, total: 0, certain: 0 })), { state: 'possible' }));

test('판정 불가가 남으면(decidable < total) possible', () =>
	assert.equal(fireState(v({ fireable: true, total: 3, decidable: 2, satisfied: 2, certain: 2 })).state, 'possible'));
