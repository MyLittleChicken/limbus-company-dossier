import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mapTrigger } from './vocab';

// 실제 소속 id — `affiliation.id` 값 자체가 영문 소속명이다(별칭 표를 거치지 않는 경우).
// 2026-07-28 `select a.id, at.name from affiliation a join affiliation_text at
// on at."affiliationId"=a.id and at.locale='ko'` 로 확인했다. 짐작값이 아니다.
const AFFILIATIONS = new Set(['Dawn Office', 'The Thumb']);

test('소속 토큰이 조건이 된다', () => {
	const c = mapTrigger('Dawn Office Identities', AFFILIATIONS);
	assert.equal(c?.op, 'COUNT_AFFILIATION');
	assert.deepEqual(c, { op: 'COUNT_AFFILIATION', affiliation: 'Dawn Office', atLeast: 3 });
});

test('소속 목록에 없는 토큰은 조건이 아니다', () => {
	assert.equal(mapTrigger('Nonexistent Identities', AFFILIATIONS), null);
});
