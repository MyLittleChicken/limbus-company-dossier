/**
 * 적합도 셈 — **DB 를 모른다.** 덱 공급을 주입받는 순수 함수다.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fitOfKeyword, inVocabulary, tierOf } from './fit.js';
import type { DeckSupply } from './types.js';

/** 화상 6 · 출혈 2 · 참격 5 · 타격 1 인 덱 */
const SUPPLY: DeckSupply = {
	axis: new Map([['COMBUSTION', 6], ['LACERATION', 2]]),
	// **공급 표의 말을 쓴다.** load.ts 의 SQL 이 skill.attack_type 을 그대로
	// 소문자로 내므로 blunt·pierce·slash 다. 여기서 hit·penetrate 를 쓰면
	// 고정물이 코드의 버그를 그대로 따라가 서로를 확인해 준다
	attackType: new Map([['slash', 5], ['blunt', 1]]),
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
	// Hit 은 공급 표에서 blunt 다. 소문자로만 바꾸면 영영 못 찾는다
	assert.equal(fitOfKeyword('Hit', SUPPLY), 1 / 5);
	// Penetrate 는 pierce 인데 이 덱엔 없다
	assert.equal(fitOfKeyword('Penetrate', SUPPLY), 0);
});

test('키워드의 말과 공급 표의 말이 다르다 — 다리를 놓는다', () => {
	// 이 검사가 없으면 고정물이 코드의 버그를 따라가 둘이 함께 틀린다
	const onlyPierce: DeckSupply = { axis: new Map(), attackType: new Map([['pierce', 3]]) };
	assert.equal(fitOfKeyword('Penetrate', onlyPierce), 1);
	assert.equal(fitOfKeyword('Hit', onlyPierce), 0);
});

test('어휘에 든 키워드인지 답한다', () => {
	assert.equal(inVocabulary('Combustion'), true);
	assert.equal(inVocabulary('Hit'), true);
	assert.equal(inVocabulary('None'), false);
	assert.equal(inVocabulary(null), false);
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
