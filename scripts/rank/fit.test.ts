/**
 * 적합도 셈 — **DB 를 모른다.** 덱 공급을 주입받는 순수 함수다.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fitOfKeyword, inVocabulary, keywordKindOf, supplyKeyOf, tierOf } from './fit.js';
import type { DeckSupply } from './types.js';

/** 출격 7인 중 화상 6 · 출혈 2 · 참격 5 · 타격 1 인 덱 */
const SUPPLY: DeckSupply = {
	axis: new Map([['COMBUSTION', 6], ['LACERATION', 2]]),
	// **공급 표의 말을 쓴다.** load.ts 의 SQL 이 skill.attack_type 을 그대로
	// 소문자로 내므로 blunt·pierce·slash 다. 여기서 hit·penetrate 를 쓰면
	// 고정물이 코드의 버그를 그대로 따라가 서로를 확인해 준다
	attackType: new Map([['slash', 5], ['blunt', 1]]),
	fieldSize: 7,
};

test('축 키워드는 출격 인원으로 나눈다', () => {
	assert.equal(fitOfKeyword('Combustion', SUPPLY), 6 / 7);
	assert.equal(fitOfKeyword('Laceration', SUPPLY), 2 / 7);
});

test('덱에 없는 축은 0 이다', () => {
	assert.equal(fitOfKeyword('Sinking', SUPPLY), 0);
});

test('공격 타입도 같은 자로 나눈다 — 출격 인원이다', () => {
	// 두 갈래가 다른 자를 쓰면 저울추 하나로 못 덮는다
	assert.equal(fitOfKeyword('Slash', SUPPLY), 5 / 7);
	// Hit 은 공급 표에서 blunt 다. 소문자로만 바꾸면 영영 못 찾는다
	assert.equal(fitOfKeyword('Hit', SUPPLY), 1 / 7);
	// Penetrate 는 pierce 인데 이 덱엔 없다
	assert.equal(fitOfKeyword('Penetrate', SUPPLY), 0);
});

test('축과 공격 타입이 같은 수면 같은 적합도다', () => {
	const same: DeckSupply = {
		axis: new Map([['COMBUSTION', 4]]),
		attackType: new Map([['slash', 4]]),
		fieldSize: 7,
	};
	assert.equal(fitOfKeyword('Combustion', same), fitOfKeyword('Slash', same));
});

test('공급이 평평해도 1.0 이 안 된다 — 최댓값으로 나누면 안 된다', () => {
	/**
	 * 회귀 검사. 분모가 「그 갈래의 최댓값」이던 때에는 세 축이 3·3·3 이면
	 * 전부 3/3 = 1.0 이 되어 참격 덱의 화상 기프트가 「확실히 좋다」로 들어갔다.
	 * 출격으로 나누면 3/7 이라 곁다리로 남는다.
	 */
	const flat: DeckSupply = {
		axis: new Map([['BREATH', 3], ['LACERATION', 3], ['COMBUSTION', 3]]),
		attackType: new Map([['slash', 7]]),
		fieldSize: 7,
	};
	assert.equal(fitOfKeyword('Combustion', flat), 3 / 7);
	assert.ok(fitOfKeyword('Combustion', flat) < 0.5, '평평한 공급이 「맞는다」로 읽힌다');
	assert.equal(fitOfKeyword('Slash', flat), 1);
});

test('한 명짜리 축이 1.0 이 되면 안 된다 — 방향미정 덱이 노이즈원이 된다', () => {
	const scattered: DeckSupply = {
		axis: new Map([['VIBRATION', 1]]),
		attackType: new Map([['blunt', 3]]),
		fieldSize: 7,
	};
	assert.equal(fitOfKeyword('Vibration', scattered), 1 / 7);
});

test('키워드의 말과 공급 표의 말이 다르다 — 다리를 놓는다', () => {
	// 이 검사가 없으면 고정물이 코드의 버그를 따라가 둘이 함께 틀린다
	const onlyPierce: DeckSupply = {
		axis: new Map(), attackType: new Map([['pierce', 3]]), fieldSize: 3,
	};
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
	const empty: DeckSupply = { axis: new Map(), attackType: new Map(), fieldSize: 7 };
	assert.equal(fitOfKeyword('Combustion', empty), 0);
	assert.equal(fitOfKeyword('Slash', empty), 0);
});

test('출격이 0 이면 0 이다 — 0 으로 나누지 않는다', () => {
	const noField: DeckSupply = {
		axis: new Map([['COMBUSTION', 3]]), attackType: new Map(), fieldSize: 0,
	};
	assert.equal(fitOfKeyword('Combustion', noField), 0);
});

test('키워드 갈래를 답한다 — why 가 「축」인지 「공격 타입」인지 가른다', () => {
	assert.equal(keywordKindOf('Combustion'), 'axis');
	assert.equal(keywordKindOf('Slash'), 'attack');
	assert.equal(keywordKindOf('Hit'), 'attack');
	assert.equal(keywordKindOf('None'), 'none');
	assert.equal(keywordKindOf(null), 'none');
});

test('공급 표의 열쇠를 답한다 — Hit 은 blunt 다', () => {
	assert.equal(supplyKeyOf('Combustion'), 'COMBUSTION');
	assert.equal(supplyKeyOf('Hit'), 'blunt');
	assert.equal(supplyKeyOf('Penetrate'), 'pierce');
	assert.equal(supplyKeyOf('None'), null);
});

test('등급을 0~1 로 편다', () => {
	assert.equal(tierOf(1), 0);
	assert.equal(tierOf(3), 0.5);
	assert.equal(tierOf(5), 1);
	// EX 는 등급이 없다. 5등급 위이지만 5등급도 2건뿐이라 갈라 봐야 표본이 안 나온다
	assert.equal(tierOf(null), 1);
});
