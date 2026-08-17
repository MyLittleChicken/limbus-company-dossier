/**
 * 기프트 20개 고르기 — 네 축을 고르게 덮어야 표본이 쓸모 있다.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pickTwenty } from './pick.js';
import type { DeckSupply, GiftCard } from './types.js';

const SUPPLY: DeckSupply = {
	axis: new Map([['COMBUSTION', 6], ['SINKING', 1]]),
	attackType: new Map([['slash', 4]]),
};

/** 등급·키워드·전용·켜짐을 골고루 섞은 못 */
function makePool(): GiftCard[] {
	const out: GiftCard[] = [];
	const tiers: Array<number | null> = [1, 2, 3, 4, 5, null];
	const keywords = ['Combustion', 'Sinking', 'Slash', 'None', null];
	let n = 0;
	for (const tier of tiers) {
		for (const keywordId of keywords) {
			for (const exclusive of [true, false]) {
				for (const fireable of [true, false]) {
					n += 1;
					out.push({
						giftId: `g${String(n).padStart(3, '0')}`,
						name: `기프트 ${n}`, desc: '설명', tier, keywordId, exclusive, fireable,
					});
				}
			}
		}
	}
	return out;
}

test('스무 개를 고른다', () => {
	assert.equal(pickTwenty(makePool(), SUPPLY, []).length, 20);
});

test('공통 기프트를 반드시 넣는다', () => {
	const picked = pickTwenty(makePool(), SUPPLY, ['g001', 'g010', 'g020']);
	for (const id of ['g001', 'g010', 'g020']) {
		assert.ok(picked.some((c) => c.giftId === id), `${id} 이 빠졌다`);
	}
	assert.equal(picked.length, 20);
});

test('등급을 고르게 덮는다 — 한 등급에 몰리지 않는다', () => {
	const picked = pickTwenty(makePool(), SUPPLY, []);
	const byTier = new Map<string, number>();
	for (const c of picked) {
		const k = c.tier === null ? 'EX' : String(c.tier);
		byTier.set(k, (byTier.get(k) ?? 0) + 1);
	}
	// 여섯 갈래(1~5·EX)가 다 나와야 한다
	assert.equal(byTier.size, 6, JSON.stringify([...byTier]));
	assert.ok(Math.max(...byTier.values()) <= 8, JSON.stringify([...byTier]));
});

test('축 일치 · 축 불일치 · 키워드 없음을 다 넣는다', () => {
	const picked = pickTwenty(makePool(), SUPPLY, []);
	assert.ok(picked.some((c) => c.keywordId === 'Combustion'), '축 일치가 없다');
	assert.ok(picked.some((c) => c.keywordId === 'Sinking'), '축 불일치가 없다');
	assert.ok(picked.some((c) => c.keywordId === null || c.keywordId === 'None'),
		'키워드 없음이 없다');
});

test('전용과 공용을 다 넣는다', () => {
	const picked = pickTwenty(makePool(), SUPPLY, []);
	assert.ok(picked.some((c) => c.exclusive), '전용이 없다');
	assert.ok(picked.some((c) => !c.exclusive), '공용이 없다');
});

test('안 켜지는 기프트도 넣는다 — 거르기가 옳은지를 표본이 판정한다', () => {
	const picked = pickTwenty(makePool(), SUPPLY, []);
	assert.ok(picked.some((c) => !c.fireable), '안 켜지는 것이 없다');
});

test('같은 못이면 같은 답이 나온다 — 무작위가 아니다', () => {
	const a = pickTwenty(makePool(), SUPPLY, []).map((c) => c.giftId);
	const b = pickTwenty(makePool(), SUPPLY, []).map((c) => c.giftId);
	assert.deepEqual(a, b);
});

test('못이 스무 개보다 작으면 있는 만큼만 낸다', () => {
	const small = makePool().slice(0, 7);
	assert.equal(pickTwenty(small, SUPPLY, []).length, 7);
});
