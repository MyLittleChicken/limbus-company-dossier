import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mapTrigger } from './vocab';

// Task 2b — 탄환·보호 배선. 실측(2026-07-28, gift_token 전수)으로 확인한 실제 토큰만 쓴다.
//
// `select token, count(*) from gift_token where token ~ '^(Allies|Enemies) with ' group by 1`
// 결과: `Allies with HP Condition`(22) · `Enemies with SP Condition`(17) ·
// `Allies with SP Condition`(11) · `Allies with Speed Condition`(6) ·
// `Enemies with Speed Condition`(6) · `Enemies with Shield`(3) · `Enemies with HP Condition`(3) ·
// `Allies with Shield`(2). "Condition" 이 아닌 것은 Shield 뿐이라 catch-all 을 좁혀도(실은
// 순서만 바꿔도) 다른 토큰은 건드리지 않는다 — `HP/SP/Speed Condition` 은 애초에 별도 갈래다.

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

test('Ammo Skill Used 가 탄환 공급 조건이 된다', () => {
	const c = mapTrigger('Ammo Skill Used', new Set());
	assert.equal(c?.op, 'SKILL_SUPPLIES');
	if (c?.op === 'SKILL_SUPPLIES') assert.equal(c.status, 'ammo');
});

test('Allies have Ammo Skill 도 탄환 공급 조건이 된다', () => {
	const c = mapTrigger('Allies have Ammo Skill', new Set());
	assert.equal(c?.op, 'SKILL_SUPPLIES');
	if (c?.op === 'SKILL_SUPPLIES') assert.equal(c.status, 'ammo');
});

test('Allies with Shield 가 보호 보유 조건이 된다', () => {
	const c = mapTrigger('Allies with Shield', new Set());
	assert.equal(c?.op, 'HAS_STATUS');
	if (c?.op === 'HAS_STATUS') assert.equal(c.status, 'protection');
});

test('Enemies with Shield 도 보호 보유 조건이 된다', () => {
	const c = mapTrigger('Enemies with Shield', new Set());
	assert.equal(c?.op, 'HAS_STATUS');
	if (c?.op === 'HAS_STATUS') {
		assert.equal(c.status, 'protection');
		assert.equal(c.side, 'enemy');
	}
});

test('catch-all 이 삼키던 Condition 계열 with 토큰은 그대로 상황성이다', () => {
	// Step 1 실측 — Shield 가 아닌, 실제로 존재하는 토큰(가장 건수가 많은 것)을 고른다.
	const c = mapTrigger('Allies with HP Condition', new Set());
	assert.equal(c?.op, 'SITUATIONAL');
});

test('Guard Skill Used 는 보호와 무관하게 남는다', () => {
	const c = mapTrigger('Guard Skill Used', new Set());
	assert.equal(c?.op, 'SITUATIONAL');
});
