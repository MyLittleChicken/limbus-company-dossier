import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Profile, denominatorsOf, activeCapabilities } from './profile';
import { evaluateGifts } from './evaluate';
import type { Capability, Squad, TriggerParam, TriggerRef } from './types';

const SQUAD: Squad = {
	roster: [
		{ identityId: 'A', egoIds: [] },
		{ identityId: 'B', egoIds: [] },
		{ identityId: 'C', egoIds: [] },
		{ identityId: 'D', egoIds: [] },
		{ identityId: 'E', egoIds: [] },
		{ identityId: 'F', egoIds: [] },
		// 대기 둘
		{ identityId: 'W1', egoIds: [] },
		{ identityId: 'W2', egoIds: ['20509'] },
	],
	field: ['A', 'B', 'C', 'D', 'E', 'F'],
};

const burn = (id: string): Capability =>
	({ identityId: id, refKind: 'axis', refId: 'COMBUSTION', egoId: '' });

const CAPS: Capability[] = [
	...['A', 'B', 'C', 'D', 'E'].map(burn),
	// 대기 인원도 화상이다 — 분모를 틀리면 6으로 세어진다
	burn('W1'),
	// 조건부. W2 가 착영휘도를 꼈으므로 유효하다
	{ identityId: 'W2', refKind: 'axis', refId: 'LACERATION', egoId: '20509' },
	// A 는 안 꼈으므로 무효여야 한다
	{ identityId: 'A', refKind: 'axis', refId: 'LACERATION', egoId: '20509' },
	...['A', 'B', 'C'].map((id) => ({ identityId: id, refKind: 'resonance', refId: 'wrath', egoId: '' })),
];

const REFS = new Map<string, TriggerRef[]>([
	['BurnRoster', [{ triggerId: 'BurnRoster', refKind: 'axis', refId: 'COMBUSTION', evaluability: 'roster' }]],
	['BurnRun', [{ triggerId: 'BurnRun', refKind: 'axis', refId: 'COMBUSTION', evaluability: 'runtime' }]],
	['AnyReso', [{ triggerId: 'AnyReso', refKind: 'resonance', refId: '', evaluability: 'roster_gated' }]],
	['Deploy', [{ triggerId: 'Deploy', refKind: 'deployment', refId: '', evaluability: 'roster_gated' }]],
	['Nothing', [{ triggerId: 'Nothing', refKind: 'none', refId: '', evaluability: 'runtime' }]],
]);

function run(giftTriggers: Map<string, string[]>, params: TriggerParam[] = []) {
	const profile = new Profile(SQUAD, CAPS);
	return evaluateGifts({ squad: SQUAD, profile, giftTriggers, refsByTrigger: REFS, params });
}

test('분모 — 출전 5인 · 편성 6인 · 대기 1인', () => {
	const p = new Profile(SQUAD, CAPS);
	assert.equal(p.count('axis', 'COMBUSTION', 'field'), 5);
	assert.equal(p.count('axis', 'COMBUSTION', 'roster'), 6);
	assert.equal(p.count('axis', 'COMBUSTION', 'waiting'), 1);
});

test('조건부 축 — 장착한 인격에만 붙는다', () => {
	const active = activeCapabilities(SQUAD, CAPS);
	const lac = active.filter((c) => c.refId === 'LACERATION').map((c) => c.identityId);
	assert.deepEqual(lac, ['W2']);
});

test('편성에 없는 출전은 분모에서 뺀다', () => {
	const d = denominatorsOf({ roster: SQUAD.roster, field: ['A', 'ZZZ'] });
	assert.deepEqual([...d.field], ['A']);
	assert.equal(d.waiting.size, 7);
});

test('임계값 5 · 출전 분모 — 5/5 로 충족한다', () => {
	const v = run(new Map([['g1', ['BurnRoster']]]), [
		{ giftId: 'g1', triggerId: 'BurnRoster', kind: 'min_count', tier: 0, value: '5', slots: [] },
		{ giftId: 'g1', triggerId: 'BurnRoster', kind: 'denominator', tier: 0, value: 'field', slots: [] },
	])[0];
	assert.equal(v?.grade, 'A');
	assert.equal(v?.satisfied, 1);
	assert.equal(v?.reasons[0]?.have, 5);
	assert.equal(v?.reasons[0]?.need, 5);
});

test('같은 임계도 분모가 편성이면 6/6 이 아니라 6 ≥ 5 로 여유가 생긴다', () => {
	const v = run(new Map([['g1', ['BurnRoster']]]), [
		{ giftId: 'g1', triggerId: 'BurnRoster', kind: 'min_count', tier: 0, value: '6', slots: [] },
		{ giftId: 'g1', triggerId: 'BurnRoster', kind: 'denominator', tier: 0, value: 'roster', slots: [] },
	])[0];
	assert.equal(v?.reasons[0]?.have, 6);
	assert.equal(v?.reasons[0]?.verdict, 'satisfied');
	// 같은 임계 6 을 출전으로 세면 미달이다 — 분모가 답을 가른다
	const w = run(new Map([['g2', ['BurnRoster']]]), [
		{ giftId: 'g2', triggerId: 'BurnRoster', kind: 'min_count', tier: 0, value: '6', slots: [] },
		{ giftId: 'g2', triggerId: 'BurnRoster', kind: 'denominator', tier: 0, value: 'field', slots: [] },
	])[0];
	assert.equal(w?.reasons[0]?.verdict, 'unsatisfied');
});

test('다단 임계 — tier 0 이 입장 게이트다', () => {
	const v = run(new Map([['g1', ['BurnRoster']]]), [
		{ giftId: 'g1', triggerId: 'BurnRoster', kind: 'min_count', tier: 0, value: '5', slots: [] },
		{ giftId: 'g1', triggerId: 'BurnRoster', kind: 'min_count', tier: 1, value: '10', slots: [] },
	])[0];
	assert.equal(v?.reasons[0]?.need, 5);
	assert.equal(v?.reasons[0]?.verdict, 'satisfied');
});

test('등급 A — 참조 전부가 판정 가능하다', () => {
	assert.equal(run(new Map([['g1', ['BurnRoster']]]))[0]?.grade, 'A');
});

test('등급 B — 결합을 접지 않고 N/M 을 그대로 낸다', () => {
	const v = run(new Map([['g1', ['BurnRoster', 'BurnRun']]]))[0];
	assert.equal(v?.grade, 'B');
	assert.equal(v?.total, 2);
	assert.equal(v?.decidable, 1);
	assert.equal(v?.satisfied, 1);
});

test('등급 C — 편성으로는 모른다. 목록에서 빼지 않는다', () => {
	const v = run(new Map([['g1', ['BurnRun', 'Nothing']]]))[0];
	assert.equal(v?.grade, 'C');
	assert.equal(v?.decidable, 0);
	assert.equal(v?.total, 2);
});

test('참조가 없는 기프트는 A 가 아니라 C 다', () => {
	const v = run(new Map([['g1', []]]))[0];
	assert.equal(v?.grade, 'C');
	assert.equal(v?.total, 0);
});

test('Any 공명 — 죄악별 최댓값을 본다. 기본 임계 3', () => {
	const v = run(new Map([['g1', ['AnyReso']]]))[0];
	assert.equal(v?.reasons[0]?.have, 3);
	assert.equal(v?.reasons[0]?.need, 3);
	assert.equal(v?.reasons[0]?.verdict, 'satisfied');
});

test('배치 — 요구 슬롯이 출전 범위 안이면 켜진다', () => {
	const v = run(new Map([['g1', ['Deploy']]]), [
		{ giftId: 'g1', triggerId: 'Deploy', kind: 'slot', tier: 0, value: null, slots: [1, 2, 3] },
	])[0];
	assert.equal(v?.reasons[0]?.verdict, 'satisfied');
	// 슬롯 7·8 은 출전 6인을 넘어 비어 있다
	const w = run(new Map([['g2', ['Deploy']]]), [
		{ giftId: 'g2', triggerId: 'Deploy', kind: 'slot', tier: 0, value: null, slots: [7, 8] },
	])[0];
	assert.equal(w?.reasons[0]?.verdict, 'unsatisfied');
});

test('임계값이 없으면 「하나라도 있으면」으로 본다', () => {
	const v = run(new Map([['g1', ['BurnRoster']]]))[0];
	assert.equal(v?.reasons[0]?.need, 1);
	assert.equal(v?.reasons[0]?.verdict, 'satisfied');
});

test('roster_gated 충족은 확정이 아니라 가능이다', () => {
	const refs = new Map([['Gated', [
		{ triggerId: 'Gated', refKind: 'axis', refId: 'COMBUSTION', evaluability: 'roster_gated' },
	]]]);
	const profile = new Profile(SQUAD, CAPS);
	const v = evaluateGifts({
		squad: SQUAD, profile, giftTriggers: new Map([['g1', ['Gated']]]),
		refsByTrigger: refs, params: [],
	})[0];
	assert.equal(v?.grade, 'A');
	assert.equal(v?.satisfied, 1);
	assert.equal(v?.certain, 0);
	assert.equal(v?.reasons[0]?.certainty, 'possible');
});

test('roster_gated 불충족은 확정이다 — 편성에 없으면 전투 중에도 안 생긴다', () => {
	const refs = new Map([['Gated', [
		{ triggerId: 'Gated', refKind: 'axis', refId: 'SINKING', evaluability: 'roster_gated' },
	]]]);
	const profile = new Profile(SQUAD, CAPS);
	const v = evaluateGifts({
		squad: SQUAD, profile, giftTriggers: new Map([['g1', ['Gated']]]),
		refsByTrigger: refs, params: [],
	})[0];
	assert.equal(v?.reasons[0]?.verdict, 'unsatisfied');
	assert.equal(v?.reasons[0]?.certainty, 'certain');
});
