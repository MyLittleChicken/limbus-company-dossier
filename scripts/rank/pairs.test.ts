/**
 * 바구니 → 순서 제약 짝.
 *
 * 칸이 다르면 「가 나보다 위」가 생긴다. 칸 안은 순서를 안 따지므로 짝이 없다.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pairsOf } from './pairs.js';
import type { RankRow } from './types.js';

const ALL_FIRE = (): boolean => true;
const rows = (...xs: Array<[string, string, 0 | 1 | 2 | 3]>): RankRow[] =>
	xs.map(([deck, giftId, bucket]) => ({ deck, giftId, bucket }));

test('칸이 다르면 짝이 생긴다 — 높은 칸이 hi 다', () => {
	const p = pairsOf(rows(['A', 'g1', 3], ['A', 'g2', 1]), ALL_FIRE);
	assert.deepEqual(p, [{ deck: 'A', hi: 'g1', lo: 'g2' }]);
});

test('같은 칸은 짝이 없다 — 칸 안은 순서를 안 따진다', () => {
	assert.deepEqual(pairsOf(rows(['A', 'g1', 2], ['A', 'g2', 2]), ALL_FIRE), []);
});

test('덱이 다르면 짝이 없다 — 덱마다 적합도가 다르다', () => {
	assert.deepEqual(pairsOf(rows(['A', 'g1', 3], ['B', 'g2', 0]), ALL_FIRE), []);
});

test('세 칸이면 짝이 셋이다 — 모든 칸 사이를 잇는다', () => {
	const p = pairsOf(rows(['A', 'g1', 3], ['A', 'g2', 2], ['A', 'g3', 0]), ALL_FIRE);
	assert.equal(p.length, 3);
	assert.deepEqual(new Set(p.map((x) => `${x.hi}>${x.lo}`)),
		new Set(['g1>g2', 'g1>g3', 'g2>g3']));
});

test('안 켜지는 기프트는 짝에서 빠진다', () => {
	// scorePack 이 fireable 거짓을 후보에서 아예 빼므로 모형이 값을 안 매긴다.
	// 세면 「죽는 기프트를 0점으로 두면 정확도가 오른다」는 가짜 이득이 생긴다
	const fire = (_d: string, g: string): boolean => g !== 'g2';
	const p = pairsOf(rows(['A', 'g1', 3], ['A', 'g2', 0], ['A', 'g3', 1]), fire);
	assert.deepEqual(p, [{ deck: 'A', hi: 'g1', lo: 'g3' }]);
});

test('짝 순서가 입력 순서에 안 흔들린다', () => {
	const a = pairsOf(rows(['A', 'g1', 3], ['A', 'g2', 1]), ALL_FIRE);
	const b = pairsOf(rows(['A', 'g2', 1], ['A', 'g1', 3]), ALL_FIRE);
	assert.deepEqual(a, b);
});
