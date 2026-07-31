import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCoinTokens } from './tokens.js';

test('토큰이 없으면 빈 배열이다', () => {
	assert.deepEqual(parseCoinTokens('그냥 문장'), []);
});

test('토큰 하나를 뽑는다', () => {
	assert.deepEqual(parseCoinTokens('[OnSucceedAttack] 무언가'), [
		{ token: 'OnSucceedAttack', ordinal: 0, amount: null },
	]);
});

test('토큰 여러 개를 순서대로 뽑는다', () => {
	assert.deepEqual(parseCoinTokens('[OnSucceedAttack] Inflict 3 [Sinking]'), [
		{ token: 'OnSucceedAttack', ordinal: 0, amount: null },
		{ token: 'Sinking', ordinal: 1, amount: 3 },
	]);
});

test('수치는 토큰 바로 앞에서 찾는다', () => {
	assert.deepEqual(parseCoinTokens('Inflict 1 [Combustion]'), [
		{ token: 'Combustion', ordinal: 0, amount: 1 },
	]);
});

test('토큰 앞에 숫자가 없으면 amount 는 null 이다', () => {
	assert.deepEqual(parseCoinTokens('Gain [Poise]'), [
		{ token: 'Poise', ordinal: 0, amount: null },
	]);
});

test('앞 토큰의 수치가 뒤 토큰으로 새지 않는다', () => {
	assert.deepEqual(parseCoinTokens('Inflict 3 [Sinking] then gain [Haste]'), [
		{ token: 'Sinking', ordinal: 0, amount: 3 },
		{ token: 'Haste', ordinal: 1, amount: null },
	]);
});

test('같은 토큰이 두 번 나오면 둘 다 담는다', () => {
	assert.deepEqual(parseCoinTokens('[Burn] and 2 [Burn]'), [
		{ token: 'Burn', ordinal: 0, amount: null },
		{ token: 'Burn', ordinal: 1, amount: 2 },
	]);
});

test('숫자만 든 대괄호는 토큰이 아니다', () => {
	assert.deepEqual(parseCoinTokens('[3] 무언가'), []);
});

test('공백·밑줄·하이픈이 든 토큰도 받는다', () => {
	assert.deepEqual(parseCoinTokens('[Defense Level Up]'), [
		{ token: 'Defense Level Up', ordinal: 0, amount: null },
	]);
});

test('실제 문자열을 분해한다', () => {
	assert.deepEqual(
		parseCoinTokens('[OnSucceedAttackHead] Inflict 2 [Vibration] Potency'),
		[
			{ token: 'OnSucceedAttackHead', ordinal: 0, amount: null },
			{ token: 'Vibration', ordinal: 1, amount: 2 },
		],
	);
});
