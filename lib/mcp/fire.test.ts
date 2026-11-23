import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Ability } from '@/lib/engine/v2/ability.js';
import type { GiftVerdict, Reason } from '@/lib/engine/v2/types';
import { fireState, supplyDoubt, type SupplyDoubtInput } from './fire';

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

// ── 하향(엔진 공급이 놓쳤을 수 있는 미충족) ──

test('의심 가는 조건 하나로만 죽은 독립 능력 → possible + reason, 엔진 fireable=false 도 덮는다', () => {
	const reasons = [r('0/0/0', 'unsatisfied')];
	const f = fireState(v({ fireable: false, reasons }), [ab(0)], () => 'skill-supply-incomplete');
	assert.equal(f.state, 'possible');
	assert.equal(f.reason, 'skill-supply-incomplete');
	assert.equal(f.abilities[0]!.state, 'possible');
	assert.equal(f.abilities[0]!.reason, 'skill-supply-incomplete');
});

test('의심 없는 죽은 그룹이 하나라도 있으면 off 그대로', () => {
	const reasons = [r('0/0/0', 'unsatisfied'), r('0/1/0', 'unsatisfied')];
	const doubt = (x: Reason) => (x.triggerId === '0/0/0' ? 'ego-not-judged' as const : null);
	const f = fireState(v({ fireable: false, reasons }), [ab(0)], doubt);
	assert.equal(f.state, 'off');
	assert.equal(f.reason, undefined);
});

test('partial 의 off 능력이 하향되면 on, 기프트 reason 은 바뀐 까닭', () => {
	const reasons = [r('0/0/0', 'satisfied'), r('1/0/0', 'unsatisfied')];
	const f = fireState(v({ reasons }), [ab(0), ab(1)], (x) => (x.triggerId === '1/0/0' ? 'ego-not-judged' : null));
	assert.equal(f.state, 'on');
	assert.equal(f.reason, 'ego-not-judged');
});

test('doubt 가 상태를 안 바꾸면 기프트 reason 없음', () => {
	const reasons = [r('0/0/0', 'satisfied')];
	const doubt = (x: Reason) => (x.verdict === 'unsatisfied' ? 'ego-not-judged' as const : null);
	assert.equal(fireState(v({ reasons }), [ab(0)], doubt).reason, undefined);
});

test('확정 충족이 과대 공급 의심뿐이면 on → possible + skill-supply-overcount, 기프트 reason 도', () => {
	const reasons = [r('0/0/0', 'satisfied')];
	const f = fireState(v({ reasons }), [ab(0)], () => 'skill-supply-overcount');
	assert.equal(f.state, 'possible');
	assert.equal(f.reason, 'skill-supply-overcount');
});

test('기프트 reason 은 상태를 바꾼 독립 능력의 것 (첫 능력 아님)', () => {
	// 0 은 on(과대 의심 없음) · 1 은 강화 절 하향(상태 무관) · 2 는 off 에서 하향된 독립 능력
	const reasons = [r('1/0/0', 'satisfied'), r('2/0/0', 'unsatisfied')];
	const doubt = (x: Reason) => (x.triggerId === '1/0/0' ? 'skill-supply-overcount' as const : x.triggerId === '2/0/0' ? 'ego-not-judged' as const : null);
	const f = fireState(v({ reasons }), [ab(0, { unconditional: true }), ab(1, { refines: 0 }), ab(2)], doubt);
	assert.equal(f.state, 'on', 'partial(2 off) → on');
	assert.equal(f.reason, 'ego-not-judged');
});

// ── supplyDoubt — 문턱 상한 검사 ──

const base = (over: Partial<SupplyDoubtInput>): SupplyDoubtInput => ({
	verdict: 'unsatisfied', have: 0, need: 1, op: 'has', supply: 'skill',
	pool: new Set(['a', 'b', 'c']), tag: new Set(), skill: new Set(),
	egoTag: new Set(), egoSkill: new Set(), restricted: undefined, ...over,
});

test('supplyDoubt: 스킬 미충족 + 모집단에 그 축 tag 인격 → skill-supply-incomplete (10110 · 9041 꼴)', () =>
	assert.equal(supplyDoubt(base({ tag: new Set(['a']) })), 'skill-supply-incomplete'));

test('supplyDoubt 반례: tag 인격이 이미 스킬 공급으로 세어졌으면 extra 0 → 의심 없음', () =>
	assert.equal(supplyDoubt(base({ op: 'gte', have: 1, need: 2, tag: new Set(['a']), skill: new Set(['a']) })), null));

test('supplyDoubt 반례: need 미도달(have 2 + extra 0 < 5, 9165 꼴 · have 0 + extra 1 < 3) → 의심 없음', () => {
	assert.equal(supplyDoubt(base({ op: 'gte', have: 2, need: 5, tag: new Set(['a', 'b']), skill: new Set(['a', 'b']) })), null);
	assert.equal(supplyDoubt(base({ op: 'gte', have: 0, need: 3, tag: new Set(['a']) })), null);
});

test('supplyDoubt: eq 는 하향하지 않는다', () =>
	assert.equal(supplyDoubt(base({ op: 'eq', tag: new Set(['a']) })), null));

test('supplyDoubt: 모집단 밖의 tag 인격은 안 센다', () =>
	assert.equal(supplyDoubt(base({ tag: new Set(['z']) })), null));

test('supplyDoubt: E.G.O 가 그 층을 열고 엔진 표에 없으면 ego-not-judged, 이미 있으면 없음', () => {
	assert.equal(supplyDoubt(base({ egoSkill: new Set(['a']) })), 'ego-not-judged');
	assert.equal(supplyDoubt(base({ op: 'gte', have: 1, need: 2, skill: new Set(['a']), egoSkill: new Set(['a']) })), null);
	assert.equal(supplyDoubt(base({ supply: 'tag', egoSkill: new Set(['a']) })), null, '층이 다르면 안 연다');
});

test('supplyDoubt: 충족이 axis_restrict 인격 덕분에만 문턱을 넘으면 overcount, 빼도 넘으면 없음', () => {
	assert.equal(supplyDoubt(base({ verdict: 'satisfied', have: 1, skill: new Set(['a']), restricted: new Set(['a']) })), 'skill-supply-overcount');
	assert.equal(supplyDoubt(base({ verdict: 'satisfied', have: 2, skill: new Set(['a', 'b']), restricted: new Set(['a']) })), null);
	assert.equal(supplyDoubt(base({ verdict: 'satisfied', supply: 'tag', have: 1, tag: new Set(['a']), restricted: new Set(['a']) })), null, 'tag 층은 안 본다');
});
