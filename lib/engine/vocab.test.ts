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
// Task 4 리뷰 — 설명문 전체 훑기가 무관한 문단의 표지를 소속 조건 것으로 오인함을 발견,
// 소속의 한국어 이름이 실제로 나오는 줄로 범위를 좁혔다(9216·9730·9740·9795·9253 실측).
// 실측한 실제 문구를 그대로 쓴다(2026-07-28, gift_description 전수).

const base = { op: 'COUNT_AFFILIATION', affiliation: 'x', atLeast: 3, scope: 'unknown' } as const;

test('출격 인원 표지를 출전으로 읽는다', () => {
	const c = refineAffiliation(base, '턴 시작시, 엄지 소속 인격이 3인 이상일 때 발동 (출격 인원을 기준으로 함)', '엄지');
	assert.equal(c.scope, 'deployed');
	assert.equal(c.atLeast, 3);
});

test('편성 인원 표지를 편성으로 읽는다', () => {
	const c = refineAffiliation(
		base,
		'턴 시작시, 새벽 사무소 소속 인격이 3인 이상일 때 발동 (편성 인원을 기준으로 함)',
		'새벽 사무소',
	);
	assert.equal(c.scope, 'deck');
});

test('대기 인원 포함은 편성이다', () => {
	const c = refineAffiliation(base, '편성된 피쿼드호 소속 인격이 3인 이상일 때 발동 (대기 인원 포함)', '피쿼드호');
	assert.equal(c.scope, 'deck');
});

test('대기 인원 제외는 출전이다', () => {
	const c = refineAffiliation(base, '중지 소속 인격이 5인 이상이면 (E.G.O 스킬 제외. 대기 인원 제외)', '중지');
	assert.equal(c.scope, 'deployed');
});

test('인원수를 설명문에서 읽는다', () => {
	assert.equal(
		refineAffiliation(base, '약지 소속 인격이 2인 이상일 때 발동 (출격 인원을 기준으로 함)', '약지').atLeast,
		2,
	);
	assert.equal(
		refineAffiliation(base, '중지 소속 인격이 4인 이상 있다면, 스테이지 시작 시', '중지').atLeast,
		4,
	);
});

test('표지가 없으면 unknown 을 유지한다', () => {
	const c = refineAffiliation(base, '중지 소속 인격이 3인 이상이면, 대신 기본 위력 +1', '중지');
	assert.equal(c.scope, 'unknown');
	assert.equal(c.atLeast, 3);
});

test('인원수가 없으면 기존 값을 유지한다', () => {
	assert.equal(refineAffiliation(base, '소속 인격이 있으면', '중지').atLeast, 3);
});

test('공격 가중치가 1인 스킬은 인원수로 안 읽는다', () => {
	// "1인" 이 사람 헤아림이 아니라 계사(copula) 인 경우 — 같은 줄에 소속 이름이 있어도
	// `N인 이상` 정규식 자체가 안 걸려야 한다.
	const c = refineAffiliation(base, '중지 소속 인격이 사용하는 공격 가중치가 1인 스킬 사용 시', '중지');
	assert.equal(c.scope, 'unknown');
	assert.equal(c.atLeast, 3);
});

test('이름이 나오는 줄로 범위를 좁힌다 — 다른 줄의 표지를 빌려오지 않는다', () => {
	// 9216 재현: 첫 문단은 화상 스킬 보유자 게이트("5인 이상", "대기 인원 제외")이고
	// 리우 협회는 전혀 다른(인원수 없는) 문단에서만 나온다. 소속 조건은 무관한 이 표지를
	// 빌려오면 안 되고 기존 값을 유지해야 한다.
	const desc = [
		'화상 위력 또는 화상 횟수 또는 특수 화상을 부여하는 공격 스킬을 보유한 인격이 5인 이상이면, 이번 전투 동안 발동 (E.G.O 스킬 제외. 대기 인원 제외)',
		'',
		'리우 협회 소속 인격의 기본 공격 스킬의 더하기 코인 위력 +2',
	].join('\n');
	const c = refineAffiliation(base, desc, '리우 협회');
	assert.equal(c.scope, 'unknown');
	assert.equal(c.atLeast, 3);
});

test('이름이 나오는 줄에 인원수가 없으면 그 줄의 판정 범위 표지도 빌려오지 않는다', () => {
	// 9253 재현: "대기 인원 포함" 은 소속 이름과 같은 줄에 있지만, "N인 이상" 형태의 인원수
	// 게이트가 아니라 "1명당" 배율 문장이다. 표지가 있어도 인원수가 없으면 통째로 기존 값을
	// 유지해야 한다(범위만 취하고 atLeast 는 예전 값을 쓰는 절충을 허용하지 않는다).
	const desc = '자신을 제외한 라만차랜드 소속 인격 1명당 최종 위력 +1 (최대 4, 120%, 대기 인원 포함)';
	const c = refineAffiliation(base, desc, '라만차랜드');
	assert.equal(c.scope, 'unknown');
	assert.equal(c.atLeast, 3);
});

test('9270 — 같은 줄의 중첩 임계값 중 첫 매치를 쓴다(무해함을 확인)', () => {
	// 실제 설명문 구조: 소속 이름이 있는 줄은 "3인 이상" 하나뿐이고, "5인 이상" 은 다음
	// 불릿(소속 이름 없음)에 있다 — 이름 없는 줄이라 후보에서 자동으로 빠진다.
	const desc = [
		'중지 소속 인격이 사용하는 기본 스킬의 기본 위력 +1',
		'- 턴 시작 시 중지 소속 인격이 3인 이상이면, 대신 기본 위력 +1',
		'- 5인 이상이면, 대신 기본 위력 +2',
	].join('\n');
	const c = refineAffiliation(base, desc, '중지');
	assert.equal(c.scope, 'unknown');
	assert.equal(c.atLeast, 3);
});

test('한국어 이름이 없으면(undefined) 기존 값을 유지한다', () => {
	const c = refineAffiliation(base, '중지 소속 인격이 3인 이상일 때 발동 (출격 인원을 기준으로 함)', undefined);
	assert.equal(c.scope, 'unknown');
	assert.equal(c.atLeast, 3);
});
