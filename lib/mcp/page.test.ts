import { test } from 'node:test';
import assert from 'node:assert/strict';
import { paginate } from './page';

const SCOPE = JSON.stringify({ locale: 'ko', sinnerId: 1 });

test('paginate 는 커서로 이어진다', () => {
	const a = paginate([1, 2, 3], undefined, SCOPE, 2);
	assert.deepEqual(a.items, [1, 2]);
	assert.equal(a.total, 3);
	const b = paginate([1, 2, 3], a.nextCursor!, SCOPE, 2);
	assert.deepEqual(b.items, [3]);
	assert.equal(b.nextCursor, null);
});

test('paginate 기본 크기는 50', () => {
	const rows = Array.from({ length: 120 }, (_, i) => i);
	const a = paginate(rows, undefined, SCOPE);
	assert.equal(a.items.length, 50);
	const c = paginate(rows, paginate(rows, a.nextCursor!, SCOPE).nextCursor!, SCOPE);
	assert.deepEqual(c.items, rows.slice(100));
	assert.equal(c.nextCursor, null);
});

test('빈 목록은 빈 페이지 · 커서 없음', () => {
	assert.deepEqual(paginate([], undefined, SCOPE), { items: [], nextCursor: null, total: 0 });
});

test('잘못된 커서는 처음부터 주지 않고 오류를 던진다', () => {
	assert.throws(() => paginate([1, 2, 3], 'garbage!!', SCOPE), /잘못된 커서/);
	assert.throws(() => paginate([1, 2, 3], Buffer.from('o:-1:abcdefgh').toString('base64url'), SCOPE), /잘못된 커서/);
	assert.throws(() => paginate([1, 2, 3], Buffer.from('o:1').toString('base64url'), SCOPE), /잘못된 커서/);
});

test('다른 질의(scope)의 커서는 오류다', () => {
	const a = paginate([1, 2, 3], undefined, SCOPE, 2);
	const other = JSON.stringify({ locale: 'ko', sinnerId: 2 });
	assert.throws(() => paginate([1, 2, 3], a.nextCursor!, other, 2), /이 커서는 다른 질의의 것이다/);
});
