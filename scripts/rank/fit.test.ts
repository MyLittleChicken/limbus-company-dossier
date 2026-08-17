/**
 * 적합도 셈 — **DB 를 모른다.** 덱 공급을 주입받는 순수 함수다.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fitOfKeyword, tierOf } from './fit.js';
import type { DeckSupply } from './types.js';

/** 화상 6 · 출혈 2 · 참격 5 · 타격 1 인 덱 */
const SUPPLY: DeckSupply = {
	axis: new Map([['COMBUSTION', 6], ['LACERATION', 2]]),
	attackType: new Map([['slash', 5], ['hit', 1]]),
};

test('축 키워드는 최대 축 공급으로 나눈다', () => {
	assert.equal(fitOfKeyword('Combustion', SUPPLY), 1);
	assert.equal(fitOfKeyword('Laceration', SUPPLY), 2 / 6);
});

test('덱에 없는 축은 0 이다', () => {
	assert.equal(fitOfKeyword('Sinking', SUPPLY), 0);
});

test('공격 타입은 최대 타입 공급으로 나눈다 — 인원이 아니다', () => {
	// 분모를 인원으로 두면 축과 다른 자가 되어 저울추 하나로 못 덮는다
	assert.equal(fitOfKeyword('Slash', SUPPLY), 1);
	assert.equal(fitOfKeyword('Hit', SUPPLY), 1 / 5);
	assert.equal(fitOfKeyword('Penetrate', SUPPLY), 0);
});

test('키워드가 없거나 None 이면 0 이다', () => {
	assert.equal(fitOfKeyword(null, SUPPLY), 0);
	assert.equal(fitOfKeyword('None', SUPPLY), 0);
});

test('공급이 비면 0 이다 — 0 으로 나누지 않는다', () => {
	const empty: DeckSupply = { axis: new Map(), attackType: new Map() };
	assert.equal(fitOfKeyword('Combustion', empty), 0);
	assert.equal(fitOfKeyword('Slash', empty), 0);
});

test('등급을 0~1 로 편다', () => {
	assert.equal(tierOf(1), 0);
	assert.equal(tierOf(3), 0.5);
	assert.equal(tierOf(5), 1);
	// EX 는 등급이 없다. 5등급 위이지만 5등급도 2건뿐이라 갈라 봐야 표본이 안 나온다
	assert.equal(tierOf(null), 1);
});
