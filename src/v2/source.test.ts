import { test } from 'node:test';
import assert from 'node:assert/strict';
import { indexRows, str, num, bool, arr, strArr } from './source.js';

test('indexRows 는 id 를 열쇠로 하는 맵을 만든다', () => {
	const m = indexRows([
		{ id: '1001', payload: { name: 'The Forgotten' } },
		{ id: '1002', payload: { name: 'Sound of a Star' } },
	]);
	assert.equal(m.size, 2);
	assert.deepEqual(m.get('1001'), { name: 'The Forgotten' });
});

test('indexRows 는 뒤에 온 것이 이긴다 — 중복은 원본 결함이므로 감춘다', () => {
	const m = indexRows([
		{ id: 'x', payload: { v: 1 } },
		{ id: 'x', payload: { v: 2 } },
	]);
	assert.deepEqual(m.get('x'), { v: 2 });
});

test('str 는 문자열만 돌려주고 나머지는 null 이다', () => {
	assert.equal(str({ a: 'hi' }, 'a'), 'hi');
	assert.equal(str({ a: '' }, 'a'), null, '빈 문자열은 값이 없는 것으로 본다');
	assert.equal(str({ a: 3 }, 'a'), null);
	assert.equal(str({}, 'a'), null);
	assert.equal(str({ a: null }, 'a'), null);
});

test('num 은 숫자와 숫자 문자열을 받는다 — tier 가 "2" 와 2 로 갈린다', () => {
	assert.equal(num({ a: 3 }, 'a'), 3);
	assert.equal(num({ a: '3' }, 'a'), 3);
	assert.equal(num({ a: 'x' }, 'a'), null);
	assert.equal(num({}, 'a'), null);
});

test('bool 은 true 만 true 다 — 키가 없으면 false', () => {
	assert.equal(bool({ a: true }, 'a'), true);
	assert.equal(bool({ a: false }, 'a'), false);
	assert.equal(bool({}, 'a'), false);
	assert.equal(bool({ a: 'true' }, 'a'), false, '문자열은 불리언이 아니다');
});

test('arr 는 배열이 아니면 빈 배열이다', () => {
	assert.deepEqual(arr({ a: [1, 2] }, 'a'), [1, 2]);
	assert.deepEqual(arr({ a: null }, 'a'), []);
	assert.deepEqual(arr({}, 'a'), []);
});

test('strArr 는 원소를 문자열로 정규화한다 — 팩 id 가 숫자와 문자열로 갈린다', () => {
	assert.deepEqual(strArr({ a: [1014, '1015'] }, 'a'), ['1014', '1015']);
	assert.deepEqual(strArr({ a: [1, null, 2] }, 'a'), ['1', '2'], 'null 은 버린다');
});
