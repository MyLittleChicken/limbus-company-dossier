/**
 * 격자 탐색 — **표본이 오기 전에도 돌아야 한다.**
 *
 * 답을 아는 작은 표본에서 답을 못 찾으면 진짜 표본에서도 못 찾는다.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { valueOf, agreementOf, searchWeights, type Weights } from './grid.js';
import type { DeckSupply, GiftCard } from './types.js';
import type { Pair } from './pairs.js';

const SUPPLY: DeckSupply = {
	// 출격 6인이 전원 화상이라 화상 적합도가 1.0 이다 — 아래 검사들이 그 1.0 에
	// 기대어 세 항이 각각 더해지는지를 본다
	axis: new Map([['COMBUSTION', 6]]),
	attackType: new Map([['slash', 4]]),
	fieldSize: 6,
};
const card = (o: Partial<GiftCard> = {}): GiftCard => ({
	giftId: 'g', name: '이름', desc: '설명', tier: 3,
	keywordId: null, exclusive: false, fireable: true, ...o,
});

test('값은 합이다 — 적합도가 0 이어도 등급이 값을 낸다', () => {
	// 곱이면 「범용 5등급이 화상 2등급보다 위」가 원리적으로 불가능하다
	const w: Weights = { fit: 1, tier: 1, exclusive: 0 };
	assert.equal(valueOf(card({ keywordId: null, tier: 5 }), SUPPLY, w), 1);
});

test('세 항이 각각 더해진다', () => {
	const w: Weights = { fit: 2, tier: 4, exclusive: 8 };
	// fit 1 · tier (3-1)/4 = 0.5 · exclusive 1
	const v = valueOf(card({ keywordId: 'Combustion', tier: 3, exclusive: true }), SUPPLY, w);
	assert.equal(v, 2 * 1 + 4 * 0.5 + 8 * 1);
});

test('전용은 적합도에 곱하지 않고 따로 더한다', () => {
	// 곱하면 키워드 없는 전용 기프트가 전용 여부를 아예 못 보인다
	const w: Weights = { fit: 1, tier: 0, exclusive: 1 };
	assert.equal(valueOf(card({ keywordId: null, exclusive: true }), SUPPLY, w), 1);
});

test('제약을 몇 개나 지켰는지 센다', () => {
	const pairs: Pair[] = [
		{ deck: 'A', hi: 'x', lo: 'y' },
		{ deck: 'A', hi: 'y', lo: 'z' },
	];
	const v = new Map([['x', 3], ['y', 2], ['z', 1]]);
	assert.deepEqual(agreementOf(pairs, (_d, g) => v.get(g) ?? 0), { hit: 2, total: 2 });
});

test('값이 같으면 안 지킨 것으로 센다 — 순서를 못 만들었다', () => {
	const pairs: Pair[] = [{ deck: 'A', hi: 'x', lo: 'y' }];
	assert.deepEqual(agreementOf(pairs, () => 1), { hit: 0, total: 1 });
});

test('짝이 없으면 total 0 이다 — 0 으로 나누지 않는다', () => {
	assert.deepEqual(agreementOf([], () => 1), { hit: 0, total: 0 });
});

test('답을 아는 표본에서 답을 찾는다 — 등급만 말하는 세상', () => {
	// 적합도는 전부 0(키워드 없음)이고 등급만 다르다. w_등급 이 커야 맞는다
	const cards = new Map<string, GiftCard>([
		['hi', card({ giftId: 'hi', tier: 5 })],
		['lo', card({ giftId: 'lo', tier: 1 })],
	]);
	const pairs: Pair[] = [{ deck: 'A', hi: 'hi', lo: 'lo' }];
	const r = searchWeights(pairs, (_d, g, w) =>
		valueOf(cards.get(g) as GiftCard, SUPPLY, w));
	assert.equal(r.hit, 1);
	assert.equal(r.total, 1);
	assert.ok(r.best.tier > 0, JSON.stringify(r.best));
});

test('답을 아는 표본에서 답을 찾는다 — 적합도만 말하는 세상', () => {
	// 등급이 같고 키워드만 다르다. w_적합 이 커야 맞는다
	const cards = new Map<string, GiftCard>([
		['hi', card({ giftId: 'hi', keywordId: 'Combustion' })],
		['lo', card({ giftId: 'lo', keywordId: null })],
	]);
	const pairs: Pair[] = [{ deck: 'A', hi: 'hi', lo: 'lo' }];
	const r = searchWeights(pairs, (_d, g, w) =>
		valueOf(cards.get(g) as GiftCard, SUPPLY, w));
	assert.equal(r.hit, 1);
	assert.ok(r.best.fit > 0, JSON.stringify(r.best));
});

test('동점 저울추를 전부 돌려준다 — 하나만 내면 답인 척하게 된다', () => {
	// 짝이 없으면 512 격자점이 전부 hit 0 으로 동점이다
	const r = searchWeights([], () => 0);
	assert.equal(r.tied.length, 512);
	assert.ok(r.tied.some((w) => w.fit === r.best.fit && w.tier === r.best.tier
		&& w.exclusive === r.best.exclusive), 'best 가 tied 에 없다');
});

test('대표는 항을 적게 쓰는 쪽이다 — 주석과 코드가 어긋나면 안 된다', () => {
	const cards = new Map<string, GiftCard>([
		['hi', card({ giftId: 'hi', tier: 5 })],
		['lo', card({ giftId: 'lo', tier: 1 })],
	]);
	const r = searchWeights([{ deck: 'A', hi: 'hi', lo: 'lo' }],
		(_d, g, w) => valueOf(cards.get(g) as GiftCard, SUPPLY, w));
	// 등급만으로 갈리는 표본이므로 적합·전용은 0 이어야 한다
	assert.equal(r.best.fit, 0);
	assert.equal(r.best.exclusive, 0);
	assert.ok(r.best.tier > 0);
});

test('못 맞히는 표본에서는 못 맞혔다고 답한다 — 억지로 채우지 않는다', () => {
	// 같은 카드 둘을 서로 위라고 하면 어떤 저울추로도 둘 다 못 지킨다
	const c = card({ giftId: 'a' });
	const cards = new Map<string, GiftCard>([['a', c], ['b', { ...c, giftId: 'b' }]]);
	const pairs: Pair[] = [
		{ deck: 'A', hi: 'a', lo: 'b' },
		{ deck: 'A', hi: 'b', lo: 'a' },
	];
	const r = searchWeights(pairs, (_d, g, w) =>
		valueOf(cards.get(g) as GiftCard, SUPPLY, w));
	assert.equal(r.total, 2);
	assert.ok(r.hit <= 1, `${r.hit}`);
});
