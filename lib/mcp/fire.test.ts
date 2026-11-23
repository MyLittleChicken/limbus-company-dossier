import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Ability } from '@/lib/engine/v2/ability.js';
import type { GiftVerdict, Reason } from '@/lib/engine/v2/types';
import { fireState } from './fire';

const v = (over: Partial<GiftVerdict>): GiftVerdict => ({
	giftId: '9001', grade: 'A', decidable: 0, satisfied: 0, certain: 0, total: 0,
	reasons: [], fireable: true, ...over,
});
const ab = (ordinal: number, over: Partial<Ability> = {}): Ability => ({
	giftId: '9001', level: 0, ordinal, unconditional: false, refines: null, ...over,
});
const r = (triggerId: string, verdict: Reason['verdict'], blocking = true): Reason => ({
	triggerId, refKind: 'axis', refId: 'COMBUSTION', verdict, certainty: 'certain',
	have: verdict === 'satisfied' ? 1 : 0, need: 1, denominator: 'field', blocking,
});

test('판정 없음 → possible + no-judgement-data', () =>
	assert.deepEqual(fireState(undefined), { state: 'possible', reason: 'no-judgement-data', abilities: [] }));

test('fireable false → off (엔진 그대로)', () =>
	assert.equal(fireState(v({ fireable: false, reasons: [r('0/0/0', 'unsatisfied')] }), [ab(0)]).state, 'off'));

test('무조건 절이 있으면 on', () => {
	const f = fireState(v({}), [ab(0, { unconditional: true })]);
	assert.equal(f.state, 'on');
	assert.equal(f.abilities[0]!.state, 'on');
});

test('모든 그룹에 확정 충족 조건이 있으면 on (그룹 안은 OR)', () => {
	const reasons = [r('0/0/0', 'unsatisfied'), r('0/0/1', 'satisfied'), r('0/1/0', 'satisfied')];
	assert.equal(fireState(v({ reasons }), [ab(0)]).state, 'on');
});

test('on 인 독립 능력 + 다른 독립 능력 확정 미충족 → partial', () => {
	const reasons = [r('0/0/0', 'satisfied'), r('1/0/0', 'unsatisfied')];
	const f = fireState(v({ reasons }), [ab(0), ab(1)]);
	assert.equal(f.state, 'partial');
	assert.deepEqual(f.abilities.map((a) => a.state), ['on', 'off']);
});

test('강화 절이 확정 미충족이어도 partial', () => {
	const reasons = [r('1/0/0', 'unsatisfied', false)];
	const f = fireState(v({ reasons }), [ab(0, { unconditional: true }), ab(1, { refines: 0 })]);
	assert.equal(f.state, 'partial');
});

test('unknown 에만 기대면 possible', () => {
	const reasons = [r('0/0/0', 'unknown'), r('0/1/0', 'satisfied')];
	const f = fireState(v({ reasons }), [ab(0)]);
	assert.equal(f.state, 'possible');
	assert.equal(f.abilities[0]!.state, 'possible');
});

test('결손(무조건이 아닌데 조건 0개)은 possible + missingConditions', () => {
	const f = fireState(v({}), [ab(0)]);
	assert.equal(f.state, 'possible');
	assert.equal(f.abilities[0]!.missingConditions, true);
});

test('독립 능력이 possible 이고 다른 것이 off 면 partial 이 아니라 possible', () => {
	const reasons = [r('0/0/0', 'unknown'), r('1/0/0', 'unsatisfied')];
	assert.equal(fireState(v({ reasons }), [ab(0), ab(1)]).state, 'possible');
});

test('능력별 reasons 는 자기 ordinal 것만', () => {
	const reasons = [r('0/0/0', 'satisfied'), r('1/0/0', 'satisfied'), r('1/1/0', 'satisfied')];
	const f = fireState(v({ reasons }), [ab(1), ab(0)]);
	assert.deepEqual(f.abilities.map((a) => [a.ordinal, a.reasons.length]), [[0, 1], [1, 2]]);
});
