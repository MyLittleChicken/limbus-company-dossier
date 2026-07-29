import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ok, err, memoryKv } from './kv';

test('ok 는 값을 담는다', () => {
	const r = ok(42);
	assert.equal(r.ok, true);
	if (r.ok) assert.equal(r.value, 42);
});

test('err 는 사유를 담는다', () => {
	const r = err('quota');
	assert.equal(r.ok, false);
	if (!r.ok) assert.equal(r.reason, 'quota');
});

test('memoryKv 는 쓴 값을 돌려준다', () => {
	const kv = memoryKv();
	assert.equal(kv.getItem('a'), null);
	kv.setItem('a', '1');
	assert.equal(kv.getItem('a'), '1');
});

test('memoryKv 는 던지도록 설정할 수 있다', () => {
	const kv = memoryKv({ throwOnSet: true });
	assert.throws(() => kv.setItem('a', '1'));
});
