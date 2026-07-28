import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
	TOTAL_BITS, BLOCK_BITS, FIELD,
	sinnerOf, indexOf, identityId, egoId,
	readBlock, writeBlock, emptyBits,
} from './layout';

test('560 = 46 × 12 + 8', () => {
	assert.equal(BLOCK_BITS, 46);
	assert.equal(TOTAL_BITS, 560);
	assert.equal(BLOCK_BITS * 12 + 8, TOTAL_BITS);
});

test('필드 폭의 합이 블록 크기와 맞는다', () => {
	const spans = Object.values(FIELD).map(([s, e]) => e - s + 1);
	// 1비트는 미사용으로 남긴다
	assert.equal(spans.reduce((a, b) => a + b, 0) + 1, BLOCK_BITS);
});

test('id 에서 수감자와 순번을 뽑는다', () => {
	assert.equal(sinnerOf(10508), 5);
	assert.equal(indexOf(10508), 8);
	assert.equal(sinnerOf(20509), 5);
	assert.equal(indexOf(20509), 9);
	assert.equal(sinnerOf(11216), 12);
	assert.equal(indexOf(11216), 16);
});

test('수감자와 순번에서 id 를 만든다', () => {
	assert.equal(identityId(5, 8), 10508);
	assert.equal(identityId(12, 16), 11216);
	assert.equal(egoId(5, 9), 20509);
});

test('가이드 예시 블록을 읽는다', () => {
	// 가이드가 제시한 블록: 인격 1 · 미편성 · ZAYIN 1
	const block = '0000000100000000001000000000000000000000000000';
	assert.equal(block.length, BLOCK_BITS);
	const bits = block + '0'.repeat(TOTAL_BITS - BLOCK_BITS);
	const b = readBlock(bits, 1);
	assert.equal(b.identityIndex, 1);
	assert.equal(b.order, 0);
	assert.equal(b.egoIndex.ZAYIN, 1);
});

test('블록을 쓰고 읽으면 같다', () => {
	const b = {
		identityIndex: 16,
		order: 3,
		egoIndex: { ZAYIN: 1, TETH: 2, HE: 3, WAW: 4, ALEPH: 0 },
	};
	const bits = writeBlock(emptyBits(), 7, b);
	assert.deepEqual(readBlock(bits, 7), b);
});

test('블록끼리 침범하지 않는다', () => {
	let bits = emptyBits();
	bits = writeBlock(bits, 1, { identityIndex: 5, order: 1, egoIndex: {} });
	bits = writeBlock(bits, 2, { identityIndex: 9, order: 2, egoIndex: {} });
	assert.equal(readBlock(bits, 1).identityIndex, 5);
	assert.equal(readBlock(bits, 2).identityIndex, 9);
});
