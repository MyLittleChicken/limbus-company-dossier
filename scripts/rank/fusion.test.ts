/**
 * 합성 관계: 결과물 판정과 재료 판정을 못 박는다.
 *
 * 고정물은 실제 데이터의 모양을 본뜬다 — 진혼(9088) 꼴로 레시피 2개·재료
 * 3~4개, 달의 기억(9083) 꼴로 선택지형 칸 1개 + 단일 칸 3개, 요리 비법
 * 전서(9157) 꼴로 재료이자 결과물인 중간 기프트를 만든다.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fusionRolesOf } from './fusion.js';
import type { Recipe } from './fusion.js';

/** 진혼 꼴 — 결과물 하나에 레시피 둘, 재료 3~4개 */
const REQUIEM = '9088';
const requiemRecipes: Recipe[] = [
	{ result: REQUIEM, slots: [['9001'], ['9002'], ['9003']] },
	{ result: REQUIEM, slots: [['9001'], ['9004'], ['9005'], ['9006']] },
];

/** 달의 기억 꼴 — 선택지형 칸 1개(후보 7) + 단일 칸 3개 */
const MOON = '9083';
const moonRecipe: Recipe = {
	result: MOON,
	slots: [['9105', '9110', '9116', '9121', '9126', '9131', '9136'], ['9142'], ['9147'], ['9152']],
};

/** 요리 비법 전서 꼴 — 재료이자 결과물인 중간 기프트 */
const COOKBOOK = '9157';
const midRecipes: Recipe[] = [
	{ result: COOKBOOK, slots: [['9201'], ['9202']] }, // 9157 자체도 합성으로 나온다
	{ result: '9200', slots: [['9157'], ['9203']] }, // 9157 이 다른 상위의 재료로도 쓰인다
];

test('결과물은 madeOnly 다', () => {
	const roles = fusionRolesOf(requiemRecipes);
	assert.equal(roles.get(REQUIEM)?.madeOnly, true);
});

test('재료는 madeOnly 가 아니다 — 재료 자체가 다른 레시피의 결과물이 아닌 한', () => {
	const roles = fusionRolesOf(requiemRecipes);
	assert.equal(roles.get('9001')?.madeOnly, false);
});

test('재료는 makes 에 상위와 함께 필요한 재료를 담는다', () => {
	const roles = fusionRolesOf(requiemRecipes);
	const role = roles.get('9002');
	assert.equal(role?.makes.length, 1);
	assert.equal(role?.makes[0]?.result, REQUIEM);
	// 9002 는 첫 레시피(9001·9002·9003)에만 있다 — 함께 필요한 건 9001·9003
	// 다들 단일 칸이라 칸마다 길이 1짜리 배열이다
	assert.deepEqual(role?.makes[0]?.withOthers, [['9001'], ['9003']]);
});

test('자기 자신은 withOthers 에 안 들어간다', () => {
	const roles = fusionRolesOf(requiemRecipes);
	for (const [gift, role] of roles) {
		for (const m of role.makes) {
			for (const slot of m.withOthers) {
				assert.ok(!slot.includes(gift), `${gift} 가 자기 자신의 withOthers 에 있다`);
			}
		}
	}
});

test('레시피가 여럿인 결과물은 makes 에 한 번만 잡힌다', () => {
	// 9001 은 두 레시피 모두에 있다 — makes 에는 진혼이 한 번만, withOthers 는
	// 처음 등장한 레시피(첫 번째) 기준으로 적는다.
	const roles = fusionRolesOf(requiemRecipes);
	const role = roles.get('9001');
	assert.equal(role?.makes.length, 1);
	assert.deepEqual(role?.makes[0]?.withOthers, [['9002'], ['9003']]);
});

test('둘째 레시피에만 있는 재료는 그 레시피 기준으로 withOthers 를 적는다', () => {
	// 9004 는 둘째 레시피(9001·9004·9005·9006)에만 있다
	const roles = fusionRolesOf(requiemRecipes);
	const role = roles.get('9004');
	assert.equal(role?.makes.length, 1);
	assert.deepEqual(role?.makes[0]?.withOthers, [['9001'], ['9005'], ['9006']]);
});

test('선택지형 칸의 후보 전부가 재료로 잡힌다', () => {
	const roles = fusionRolesOf([moonRecipe]);
	for (const candidate of ['9105', '9110', '9116', '9121', '9126', '9131', '9136']) {
		const role = roles.get(candidate);
		assert.equal(role?.madeOnly, false);
		assert.equal(role?.makes.length, 1);
		assert.equal(role?.makes[0]?.result, MOON);
	}
});

test('자기가 선택지형 칸에 있으면 그 칸이 통째로 빠진다', () => {
	const roles = fusionRolesOf([moonRecipe]);
	const role = roles.get('9105');
	// 다른 칸(단일 칸 셋)만 담고, 같은 칸의 나머지 여섯 후보는 안 담는다 —
	// 9110 이 어디에도 없어야 한다(펴서 담았다면 여기 섞여 들어온다)
	assert.deepEqual(role?.makes[0]?.withOthers, [['9142'], ['9147'], ['9152']]);
});

test('선택지형 칸은 한 덩어리로 남는다 — 펴지지 않는다', () => {
	// 9142 입장에서는 선택지형 칸 중 "어느 하나"가 함께 필요하다 — 그 칸을
	// 펴서 다른 단일 칸들과 섞으면 「9개 다 필요」로 잘못 읽힌다. 칸 하나가
	// 배열 하나로 남아야 「셋 다 필요」와 「일곱 중 하나」가 구별된다.
	const roles = fusionRolesOf([moonRecipe]);
	const role = roles.get('9142');
	assert.deepEqual(role?.makes[0]?.withOthers, [
		['9105', '9110', '9116', '9121', '9126', '9131', '9136'],
		['9147'],
		['9152'],
	]);
});

test('재료이면서 동시에 결과물인 중간 기프트는 둘 다로 답한다', () => {
	const roles = fusionRolesOf(midRecipes);
	const role = roles.get(COOKBOOK);
	assert.equal(role?.madeOnly, true); // 9201·9202 로 합성된 결과물이기도 하다
	assert.equal(role?.makes.length, 1);
	assert.equal(role?.makes[0]?.result, '9200'); // 9200 의 재료이기도 하다
	assert.deepEqual(role?.makes[0]?.withOthers, [['9203']]);
});

test('레시피에 안 나오는 기프트는 맵에 없다', () => {
	// madeOnly:false·makes:[] 를 기본값으로 채워도 맞지만, 맵의 부재로
	// "레시피에 한 번도 안 나온다"를 드러내는 쪽으로 정했다 — fusion.ts 주석 참조.
	const roles = fusionRolesOf(requiemRecipes);
	assert.equal(roles.get('9999'), undefined);
});

test('같은 입력이면 같은 답 — makes 와 withOthers 정렬로 순서가 안 흔들린다', () => {
	const shuffled: Recipe[] = [requiemRecipes[1]!, requiemRecipes[0]!];
	const a = fusionRolesOf(requiemRecipes);
	const b = fusionRolesOf(shuffled);
	// 9002 는 첫 레시피에만 있으니 레시피 순서를 바꿔도 결과가 같다
	assert.deepEqual(a.get('9002'), b.get('9002'));
	assert.deepEqual(a.get(REQUIEM), b.get(REQUIEM));
});

test('결합된 전체 목록에서도 결과물·재료·중간 기프트가 함께 맞는다', () => {
	const roles = fusionRolesOf([...requiemRecipes, moonRecipe, ...midRecipes]);
	assert.equal(roles.get(REQUIEM)?.madeOnly, true);
	assert.equal(roles.get(MOON)?.madeOnly, true);
	assert.equal(roles.get(COOKBOOK)?.madeOnly, true);
	assert.equal(roles.get(COOKBOOK)?.makes[0]?.result, '9200');
	assert.equal(roles.size, new Set([
		REQUIEM, '9001', '9002', '9003', '9004', '9005', '9006',
		MOON, '9105', '9110', '9116', '9121', '9126', '9131', '9136', '9142', '9147', '9152',
		COOKBOOK, '9201', '9202', '9200', '9203',
	]).size);
});
