import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildVocab, buildKeywordLookup, keywordIdOf, type VocabInput } from './vocab.js';
import { Meta } from './meta.js';

function input(): VocabInput {
	return {
		categoryKo: new Map<string, Record<string, unknown>>([
			['Combustion', { id: 'Combustion', name: '화상' }],
			['None', { id: 'None', name: '범용' }],
		]),
		categoryEn: new Map<string, Record<string, unknown>>([
			['Combustion', { id: 'Combustion', name: 'Burn' }],
			['None', { id: 'None', name: 'Keywordless' }],
		]),
		categoryJa: new Map<string, Record<string, unknown>>([
			['Combustion', { id: 'Combustion', name: '火傷' }],
			['None', { id: 'None', name: '汎用' }],
		]),
		assets: new Map<string, Record<string, unknown>>([
			['9001', { triggers: ['Always', 'Clash Win'], effects: ['Deal More Damage'] }],
			['9002', { triggers: ['Always'], effects: [] }],
		]),
	};
}

test('키워드가 사전에서 나온다', () => {
	const v = buildVocab(input(), new Meta());
	assert.deepEqual(v.keyword.map((k) => k.id).sort(), ['Combustion', 'None']);
});

test('keyword.order 가 원본 EgoGiftCategory 등장 순서를 담는다', () => {
	const i = input();
	// 원본 순서는 사전 순이 아니다 — None 이 맨 뒤다
	i.categoryEn = new Map<string, Record<string, unknown>>([
		['Combustion', { id: 'Combustion', name: 'Burn' }],
		['Laceration', { id: 'Laceration', name: 'Bleed' }],
		['None', { id: 'None', name: 'Keywordless' }],
	]);
	const v = buildVocab(i, new Meta());
	assert.deepEqual(
		v.keyword.map((k) => [k.id, k.order]).sort((a, b) => Number(a[1]) - Number(b[1])),
		[
			['Combustion', 0],
			['Laceration', 1],
			['None', 2],
		],
	);
});

test('키워드 표시명이 3로케일로 나온다', () => {
	const v = buildVocab(input(), new Meta());
	assert.deepEqual(
		v.keywordText.filter((t) => t.keywordId === 'Combustion').map((t) => [t.locale, t.name]).sort(),
		[
			['en', 'Burn'],
			['ja', '火傷'],
			['ko', '화상'],
		],
	);
});

test('트리거·효과가 유일 집합으로 정렬돼 나온다', () => {
	const v = buildVocab(input(), new Meta());
	assert.deepEqual(v.trigger.map((t) => t.id), ['Always', 'Clash Win']);
	assert.deepEqual(v.effect.map((e) => e.id), ['Deal More Damage']);
});

test('buildKeywordLookup 은 소문자 영문명을 사전 id 로 잇는다', () => {
	const d = buildKeywordLookup(input().categoryEn);
	assert.equal(d.get('burn'), 'Combustion');
	assert.equal(d.get('keywordless'), 'None');
});

test('keywordIdOf 는 null 을 None 으로 본다 — 게임은 「범용」이라 부른다', () => {
	const d = buildKeywordLookup(input().categoryEn);
	assert.equal(keywordIdOf(null, d), 'None');
	assert.equal(keywordIdOf('Burn', d), 'Combustion');
	assert.equal(keywordIdOf('burn', d), 'Combustion');
});

test('사전에 없는 키워드는 null 이다', () => {
	const d = buildKeywordLookup(input().categoryEn);
	assert.equal(keywordIdOf('Nonexistent', d), null);
});
