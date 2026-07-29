import { test } from 'node:test';
import assert from 'node:assert/strict';
import { memoryKv } from './kv';
import { emptyDeck, SCHEMA_VERSION } from './schema';
import { readDecks, writeDecks, KEY_DECKS, KEY_SCHEMA } from './decks';

test('빈 저장소는 빈 목록', () => {
	const r = readDecks(memoryKv());
	assert.equal(r.ok, true);
	if (r.ok) assert.deepEqual(r.value, []);
});

test('쓴 것을 그대로 읽는다', () => {
	const kv = memoryKv();
	const decks = [emptyDeck('a', 'id-a')];
	assert.equal(writeDecks(kv, decks).ok, true);
	const r = readDecks(kv);
	assert.equal(r.ok, true);
	if (r.ok) assert.equal(r.value[0]?.name, 'a');
});

test('쓰기가 스키마 버전을 남긴다', () => {
	const kv = memoryKv();
	writeDecks(kv, []);
	assert.equal(kv.getItem(KEY_SCHEMA), String(SCHEMA_VERSION));
});

test('버전이 다르면 버리지 않고 실패로 알린다', () => {
	const kv = memoryKv();
	kv.setItem(KEY_SCHEMA, '99');
	kv.setItem(KEY_DECKS, '[]');
	const r = readDecks(kv);
	assert.equal(r.ok, false);
	if (!r.ok) assert.match(r.reason, /버전/);
});

test('깨진 JSON 을 실패로 알린다', () => {
	const kv = memoryKv();
	kv.setItem(KEY_SCHEMA, String(SCHEMA_VERSION));
	kv.setItem(KEY_DECKS, '{{{');
	assert.equal(readDecks(kv).ok, false);
});

test('읽기가 실패해도 저장분을 건드리지 않는다', () => {
	// 이 계층은 지운 적이 없다. 저장분이 사라지는 경로는 **화면이 빈 목록 위에 덮어쓰는 것**
	// 뿐이며(07-recommendation-system 4.2), 그래서 DeckEditor 가 읽기 실패 시 쓰기를 잠근다.
	const kv = memoryKv();
	kv.setItem(KEY_SCHEMA, '0');
	kv.setItem(KEY_DECKS, '[{"id":"a"},{"id":"b"}]');
	assert.equal(readDecks(kv).ok, false);
	assert.equal(kv.getItem(KEY_DECKS), '[{"id":"a"},{"id":"b"}]');

	// 잠그지 않으면 이렇게 사라진다 — 잠금이 지키는 것이 무엇인지 고정해 둔다.
	writeDecks(kv, [emptyDeck('새 덱', 'new')]);
	assert.equal(kv.getItem(KEY_DECKS)?.includes('"a"'), false);
});

test('10개를 넘으면 쓰지 않는다', () => {
	const kv = memoryKv();
	const many = Array.from({ length: 11 }, (_, i) => emptyDeck(`d${i}`, `id-${i}`));
	const r = writeDecks(kv, many);
	assert.equal(r.ok, false);
});

test('저장소가 던지면 실패로 돌려준다', () => {
	const r = writeDecks(memoryKv({ throwOnSet: true }), []);
	assert.equal(r.ok, false);
	if (!r.ok) assert.match(r.reason, /저장/);
});
