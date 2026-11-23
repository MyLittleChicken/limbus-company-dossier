import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { canonical } from '../../db-canonical';
import { canonicalReachable, NO_DB } from '../../../src/v2/canonical/db-available';
import { HWAJIN_DECK, rangeCovers, recommendForDeck, recommendForSquad } from './recommend';

const reachable = await canonicalReachable(canonical);
after(async () => { await canonical.$disconnect(); });

test('한 자리 구간은 그 층만 담는다', () => {
	assert.equal(rangeCovers('3', 3), true);
	assert.equal(rangeCovers('3', 4), false);
});

test('범위 구간은 양끝을 포함한다', () => {
	assert.equal(rangeCovers('6-10', 6), true);
	assert.equal(rangeCovers('6-10', 10), true);
	assert.equal(rangeCovers('6-10', 5), false);
	assert.equal(rangeCovers('6-10', 11), false);
});

test('11-15 가 15층을 담는다 — hard 의 마지막 구간이다', () => {
	assert.equal(rangeCovers('11-15', 15), true);
});

test('숫자가 아닌 구간은 아무 층도 안 담는다 — 조용히 전부 담지 않는다', () => {
	assert.equal(rangeCovers('boss', 1), false);
	assert.equal(rangeCovers('', 1), false);
});

test('recommendForDeck(화진) 결과가 recommendForSquad 와 같다', { skip: reachable ? false : NO_DB }, async () => {
	const a = await recommendForDeck('ko', {});
	const b = await recommendForSquad('ko', {
		squad: {
			roster: HWAJIN_DECK.map((id) => ({ identityId: String(id), egoIds: [] })),
			field: HWAJIN_DECK.map(String),
		},
		floor: 3,
		difficulty: 'hard',
		heldGiftIds: [],
	});
	assert.deepEqual(a, b);
});
