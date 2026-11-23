import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as z from 'zod';
import { cleanText, cursorArg, idArg, localeArg, packIdArg, pageShape, queryArg, READ_ONLY, toId, toPackId } from './args';

test('localeArg 기본 ko · 그 밖은 거절', () => {
	assert.equal(localeArg.parse(undefined), 'ko');
	assert.equal(localeArg.parse('en'), 'en');
	assert.equal(localeArg.safeParse('ja').success, false);
});

test('cursorArg 는 128 자 상한 · 생략 가능', () => {
	assert.equal(cursorArg.parse(undefined), undefined);
	assert.equal(cursorArg.safeParse('a'.repeat(128)).success, true);
	assert.equal(cursorArg.safeParse('a'.repeat(129)).success, false);
});

test('idArg: 양의 정수 ≤ 999999999 또는 1–9 자리 숫자 문자열', () => {
	for (const ok of [1, 999_999_999, '10101', '0', '123456789']) assert.equal(idArg.safeParse(ok).success, true, String(ok));
	for (const bad of [0, -1, 1.5, 1_000_000_000, '', '1234567890', '12a', ' 1', '1e3']) assert.equal(idArg.safeParse(bad).success, false, String(bad));
	assert.equal(toId('10101'), 10101);
	assert.equal(toId(10101), 10101);
});

test('packIdArg: [\\w-]{1,32} 문자열 또는 양의 정수 → 문자열', () => {
	for (const ok of ['1129', 'md-pack_1', 1129]) assert.equal(packIdArg.safeParse(ok).success, true, String(ok));
	for (const bad of ['', 'a'.repeat(33), 'a b', '../x', 0, -3]) assert.equal(packIdArg.safeParse(bad).success, false, String(bad));
	assert.equal(toPackId(1129), '1129');
	assert.equal(toPackId('1129'), '1129');
});

test('queryArg: 100 자 상한 · 제어문자 거절', () => {
	assert.equal(queryArg.safeParse('화상 ㅎㅅ').success, true);
	assert.equal(queryArg.safeParse('a'.repeat(101)).success, false);
	assert.equal(queryArg.safeParse('a\u0000b').success, false);
	assert.equal(queryArg.safeParse('a\nb').success, false);
});

test('cleanText: 빈 값 · 공백은 undefined, 나머지는 trim', () => {
	assert.equal(cleanText(undefined), undefined);
	assert.equal(cleanText(''), undefined);
	assert.equal(cleanText('   '), undefined);
	assert.equal(cleanText('  화상 '), '화상');
});

test('READ_ONLY · pageShape 모양', () => {
	assert.deepEqual(READ_ONLY, { readOnlyHint: true, openWorldHint: false });
	const s = z.object(pageShape(z.object({ id: z.number() })));
	assert.equal(s.safeParse({ items: [{ id: 1 }], total: 1, nextCursor: null }).success, true);
	assert.equal(s.safeParse({ items: [], total: -1, nextCursor: null }).success, false);
	assert.equal(s.safeParse({ items: [], total: 0 }).success, false);
});
