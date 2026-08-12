/**
 * 공급 세기 — **DB 없이 돈다.** 표를 주입받는 순수 함수다.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { countSupply, type SupplyCond, type SupplyTables } from './supply.js';
import type { Squad } from './types.js';

/** 편성 12 · 출격 7. A~L 열두 명 */
const IDS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'];
const SQUAD: Squad = {
	roster: IDS.map((identityId) => ({ identityId, egoIds: [] })),
	field: IDS.slice(0, 7),
};

const T: SupplyTables = {
	axisTag: new Map([['COMBUSTION', new Set(['A', 'B', 'H'])]]),
	axisSkill: new Map([['COMBUSTION', new Set(['A', 'I'])]]),
	association: new Map([['DAWN', new Set(['A', 'B', 'C', 'J'])]]),
	unitKeyword: new Map([['BLOODFIEND', new Set(['K'])]]),
	sin: new Map([['wrath', new Set(['A', 'B', 'C', 'D'])]]),
	attackType: new Map([['slash', new Set(['E'])]]),
	skillKind: new Map([['counter', new Set(['F'])]]),
	minusCoin: new Set(['G', 'L']),
};

const cond = (o: Partial<SupplyCond> = {}): SupplyCond => ({
	refKind: 'axis', refId: 'COMBUSTION', scope: 'field', supply: 'tag', slot: null, ...o,
});

test('scope=field 는 출격 7인만 센다', () => {
	// A · B 는 출격, H 는 대기라 안 센다
	assert.equal(countSupply(T, SQUAD, cond()), 2);
});

test('scope=roster 는 편성 12인을 센다', () => {
	assert.equal(countSupply(T, SQUAD, cond({ scope: 'roster' })), 3);
});

test('scope=waiting 은 편성에서 출격을 뺀 자리만 센다', () => {
	assert.equal(countSupply(T, SQUAD, cond({ scope: 'waiting' })), 1);
});

test('supply=skill 은 태그가 아니라 스킬 표를 본다', () => {
	// 태그는 A·B·H 인데 스킬은 A·I 다. 출격에 든 것은 A 하나
	assert.equal(countSupply(T, SQUAD, cond({ supply: 'skill' })), 1);
});

test('supply=any 는 둘 중 큰 쪽이다', () => {
	assert.equal(countSupply(T, SQUAD, cond({ supply: 'any' })), 2);
});

test('소속을 센다', () => {
	assert.equal(countSupply(T, SQUAD, cond({ refKind: 'association', refId: 'DAWN' })), 3);
});

test('유닛 키워드를 센다 — 편성에만 있으면 출격에선 0 이다', () => {
	assert.equal(countSupply(T, SQUAD, cond({ refKind: 'unit_keyword', refId: 'BLOODFIEND' })), 0);
	assert.equal(
		countSupply(T, SQUAD, cond({ refKind: 'unit_keyword', refId: 'BLOODFIEND', scope: 'roster' })),
		1,
	);
});

test('공명은 죄악과 같은 표를 본다 — 묻는 것만 다르다', () => {
	assert.equal(countSupply(T, SQUAD, cond({ refKind: 'resonance', refId: 'wrath' })), 4);
	assert.equal(countSupply(T, SQUAD, cond({ refKind: 'sin', refId: 'wrath' })), 4);
});

test('공격 타입 · 스킬 종류 · 빼기 코인', () => {
	assert.equal(countSupply(T, SQUAD, cond({ refKind: 'attack_type', refId: 'slash' })), 1);
	assert.equal(countSupply(T, SQUAD, cond({ refKind: 'skill_kind', refId: 'counter' })), 1);
	assert.equal(countSupply(T, SQUAD, cond({ refKind: 'coin', refId: 'minus' })), 1);
});

test('자리는 출격 인원이 그 번호까지 찼는가다', () => {
	// 출격 7인이므로 7번까지 있다
	const slot7 = cond({ refKind: 'deployment', refId: 'slot7', scope: 'slot', slot: 7 });
	assert.equal(countSupply(T, SQUAD, slot7), 1);
	const five: Squad = { ...SQUAD, field: IDS.slice(0, 5) };
	assert.equal(countSupply(T, five, slot7), 0);
	assert.equal(
		countSupply(T, five, cond({ refKind: 'deployment', refId: 'slot5', scope: 'slot', slot: 5 })),
		1,
	);
});

test('셀 방법이 없으면 -1 이다 — 0 과 갈라야 한다', () => {
	// 0 은 「없다」라 배제 근거가 되고, -1 은 「모른다」라 배제하면 안 된다
	assert.equal(countSupply(T, SQUAD, cond({ refKind: 'other', refId: '지령 대상이 사망했으면' })), -1);
	assert.equal(countSupply(T, SQUAD, cond({ refKind: 'enemy_state', refId: 'X' })), -1);
	assert.equal(countSupply(T, SQUAD, cond({ refId: 'NOT_AN_AXIS' })), -1);
});
