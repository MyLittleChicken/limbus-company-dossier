import { test } from 'node:test';
import assert from 'node:assert/strict';
import { reachOf, type Recipe } from './fusion.js';

/** 서릿발 발자국 = 귀신 들린 신발 + 얼어붙은 아우성. 실제 레시피다 */
const FROST: Recipe = { giftId: '9410', slots: [['9408'], ['9409']] };

test('재료가 다 있으면 완성이다', () => {
	assert.equal(reachOf(FROST, new Set(['9408', '9409'])), 1);
});

test('한 개 모자라면 반이다', () => {
	assert.equal(reachOf(FROST, new Set(['9408'])), 0.5);
	assert.equal(reachOf(FROST, new Set(['9409'])), 0.5);
});

test('둘 모자라면 4분의 1 — 한 단계 멀어지면 반이다', () => {
	const three: Recipe = { giftId: 'X', slots: [['a'], ['b'], ['c']] };
	assert.equal(reachOf(three, new Set(['a'])), 0.25);
	assert.equal(reachOf(three, new Set(['a', 'b'])), 0.5);
	assert.equal(reachOf(three, new Set(['a', 'b', 'c'])), 1);
});

test('하나도 없으면 0 이다 — 반의 거듭제곱으로 안 내려간다', () => {
	assert.equal(reachOf(FROST, new Set()), 0);
	const three: Recipe = { giftId: 'X', slots: [['a'], ['b'], ['c']] };
	assert.equal(reachOf(three, new Set()), 0);
});

test('선택지형 칸은 하나라도 있으면 찬 것이다', () => {
	// 실측 1건. material_id 가 null 이고 fusion_slot_option 이 후보를 담는다
	const opt: Recipe = { giftId: 'Y', slots: [['p', 'q', 'r'], ['s']] };
	assert.equal(reachOf(opt, new Set(['q', 's'])), 1);
	assert.equal(reachOf(opt, new Set(['r'])), 0.5);
});

test('칸이 없는 레시피는 0 이다 — 지어내지 않는다', () => {
	assert.equal(reachOf({ giftId: 'Z', slots: [] }, new Set(['a'])), 0);
});
