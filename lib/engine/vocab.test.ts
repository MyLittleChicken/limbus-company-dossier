import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mapTrigger, refineAffiliation } from './vocab';

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
	assert.deepEqual(c, {
		op: 'COUNT_AFFILIATION',
		affiliation: 'Dawn Office',
		atLeast: 3,
		scope: 'unknown',
	});
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

// Task 3 — 소속 조건의 인원수와 판정 범위를 설명문에서 읽는다.
// 실측한 실제 문구를 그대로 쓴다(2026-07-28, gift_description 전수).

const base = { op: 'COUNT_AFFILIATION', affiliation: 'x', atLeast: 3, scope: 'unknown' } as const;

test('출격 인원 표지를 출전으로 읽는다', () => {
	const c = refineAffiliation(base, '턴 시작시, 엄지 소속 인격이 3인 이상일 때 발동 (출격 인원을 기준으로 함)');
	assert.equal(c.scope, 'deployed');
	assert.equal(c.atLeast, 3);
});

test('편성 인원 표지를 편성으로 읽는다', () => {
	const c = refineAffiliation(base, '턴 시작시, 새벽 사무소 소속 인격이 3인 이상일 때 발동 (편성 인원을 기준으로 함)');
	assert.equal(c.scope, 'deck');
});

test('대기 인원 포함은 편성이다', () => {
	const c = refineAffiliation(base, '편성된 피쿼드호 소속 인격이 3인 이상일 때 발동 (대기 인원 포함)');
	assert.equal(c.scope, 'deck');
});

test('대기 인원 제외는 출전이다', () => {
	const c = refineAffiliation(base, '... 5인 이상이면 ... (E.G.O 스킬 제외. 대기 인원 제외)');
	assert.equal(c.scope, 'deployed');
});

test('인원수를 설명문에서 읽는다', () => {
	assert.equal(refineAffiliation(base, '약지 소속 인격이 2인 이상일 때 발동 (출격 인원을 기준으로 함)').atLeast, 2);
	assert.equal(refineAffiliation(base, '중지 소속 인격이 4인 이상 있다면, 스테이지 시작 시').atLeast, 4);
});

test('표지가 없으면 unknown 을 유지한다', () => {
	const c = refineAffiliation(base, '중지 소속 인격이 3인 이상이면, 대신 기본 위력 +1');
	assert.equal(c.scope, 'unknown');
	assert.equal(c.atLeast, 3);
});

test('인원수가 없으면 기존 값을 유지한다', () => {
	assert.equal(refineAffiliation(base, '소속 인격이 있으면').atLeast, 3);
});
