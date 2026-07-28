import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SCHEMA_VERSION, emptyDeck, parseDeck } from './schema';

test('스키마 버전은 1', () => {
	assert.equal(SCHEMA_VERSION, 1);
});

test('빈 덱은 수감자 12칸을 갖는다', () => {
	const d = emptyDeck('테스트');
	assert.equal(d.slots.length, 12);
	assert.deepEqual(d.slots.map((s) => s.sinnerId), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
	assert.equal(d.slots.every((s) => s.identityId === null), true);
	assert.deepEqual(d.deployed, []);
});

test('정상 덱을 통과시킨다', () => {
	const d = emptyDeck('a');
	d.slots[0]!.identityId = 10101;
	d.slots[0]!.egos.ZAYIN = 20101;
	d.deployed = [1];
	const r = parseDeck(JSON.parse(JSON.stringify(d)));
	assert.equal(r.ok, true);
});

test('칸 수가 12가 아니면 거부한다', () => {
	const d = emptyDeck('a');
	d.slots.pop();
	const r = parseDeck(JSON.parse(JSON.stringify(d)));
	assert.equal(r.ok, false);
});

test('출전이 7을 넘으면 거부한다', () => {
	const d = emptyDeck('a');
	d.deployed = [1, 2, 3, 4, 5, 6, 7, 8];
	const r = parseDeck(JSON.parse(JSON.stringify(d)));
	assert.equal(r.ok, false);
});

test('덱이 아닌 값을 거부한다', () => {
	assert.equal(parseDeck(null).ok, false);
	assert.equal(parseDeck({ name: 'x' }).ok, false);
});

test('수감자 id 가 범위를 벗어나면 거부한다', () => {
	const d = emptyDeck('a');
	d.slots[0]!.sinnerId = 0;
	const r = parseDeck(JSON.parse(JSON.stringify(d)));
	assert.equal(r.ok, false);
});

test('수감자 id 가 중복되면 거부한다', () => {
	const d = emptyDeck('a');
	d.slots[1]!.sinnerId = 1;
	const r = parseDeck(JSON.parse(JSON.stringify(d)));
	assert.equal(r.ok, false);
});

test('출전에 정수가 아닌 값이 있으면 거부한다', () => {
	const d = emptyDeck('a');
	d.deployed = ['x' as unknown as number];
	const r = parseDeck(JSON.parse(JSON.stringify(d)));
	assert.equal(r.ok, false);
});

test('출전 id 가 범위를 벗어나면 거부한다', () => {
	const d = emptyDeck('a');
	d.deployed = [13];
	const r = parseDeck(JSON.parse(JSON.stringify(d)));
	assert.equal(r.ok, false);
});

test('출전 id 가 중복되면 거부한다', () => {
	const d = emptyDeck('a');
	d.deployed = [1, 1];
	const r = parseDeck(JSON.parse(JSON.stringify(d)));
	assert.equal(r.ok, false);
});

test('E.G.O 등급이 아닌 키를 거부한다', () => {
	const d = emptyDeck('a');
	(d.slots[0]!.egos as Record<string, number>)['bogusKey'] = 1;
	const r = parseDeck(JSON.parse(JSON.stringify(d)));
	assert.equal(r.ok, false);
});

test('E.G.O id 가 정수가 아니면 거부한다', () => {
	const d = emptyDeck('a');
	(d.slots[0]!.egos as unknown as Record<string, unknown>)['ZAYIN'] = 'not-a-number';
	const r = parseDeck(JSON.parse(JSON.stringify(d)));
	assert.equal(r.ok, false);
});

test('통과한 값은 입력을 그대로 참조하지 않고 새로 조립한다', () => {
	const d = emptyDeck('a');
	d.slots[0]!.identityId = 10101;
	d.slots[0]!.egos.ZAYIN = 20101;
	d.deployed = [1];
	const input = JSON.parse(JSON.stringify(d));
	const r = parseDeck(input);
	assert.equal(r.ok, true);
	if (r.ok) {
		assert.notEqual(r.value, input);
		assert.notEqual(r.value.slots, input.slots);
	}
});
