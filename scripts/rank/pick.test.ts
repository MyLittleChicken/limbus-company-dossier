/**
 * 기프트 20개 고르기 — 네 축을 고르게 덮어야 표본이 쓸모 있다.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fitOfKeyword } from './fit.js';
import { pickTwenty } from './pick.js';
import type { DeckSupply, GiftCard } from './types.js';

const SUPPLY: DeckSupply = {
	axis: new Map([['COMBUSTION', 6], ['SINKING', 1]]),
	// 참격·타격을 둘 다 4로 둔다 — 둘 다 「강」이라 「약」은 침잠만 남는다.
	// **타격의 공급 표 이름은 blunt 다** — 'hit' 로 두면 고정물이 코드의 버그를
	// 따라가 「Hit 이 강」이라는 이 고정물의 뜻이 조용히 뒤집힌다
	attackType: new Map([['slash', 4], ['blunt', 4]]),
};

/**
 * 등급·키워드·전용·켜짐을 골고루 섞은 못.
 *
 * **못의 모양이 곧 검사의 이빨이다.** 「앞에서 giftId 순으로 스물」만 집는
 * 엉터리 구현이 통과하면 안 되므로, 앞 스물이 어느 갈래도 다 덮지 못하게
 * 짠다.
 *
 * ```
 * 등급 한 덩어리 = 6키워드 × 2 × 2 = 24 > 20     앞 스물은 1등급뿐이다
 * 침잠(유일한 「약」)을 키워드 목록 맨 뒤에 둔다   앞 스물에 「약」이 없다
 * ```
 *
 * 이렇게 두면 엉터리 구현이 「등급 덮임」과 「키워드 셋」에서 걸린다.
 * **줄이지 마라** — 5키워드로 되돌리면 24가 20이 되어 1등급 덩어리 하나가
 * 모든 조합을 담고, 검사가 통째로 무력해진다.
 */
function makePool(): GiftCard[] {
	const out: GiftCard[] = [];
	const tiers: Array<number | null> = [1, 2, 3, 4, 5, null];
	const keywords = ['Combustion', 'Slash', 'Hit', 'None', null, 'Sinking'];
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

test('공통 기프트를 반드시 넣는다 — 앞 스물 밖에 있어도', () => {
	// g024·g100 은 giftId 순으로 스물 밖이다. 공통을 안 챙기는 구현은 여기서 걸린다
	const shared = ['g001', 'g024', 'g100'];
	const picked = pickTwenty(makePool(), SUPPLY, shared);
	for (const id of shared) {
		assert.ok(picked.some((c) => c.giftId === id), `${id} 이 빠졌다`);
	}
	assert.equal(picked.length, 20);
});

test('앞에서 스물을 집는 것과 다르다 — 검사에 이빨이 있는지 못 박는다', () => {
	// 이 검사가 없으면 나머지가 우연히 통과하는 못으로 되돌아가도 아무도 모른다
	const pool = makePool();
	const naive = [...pool].sort((a, b) => a.giftId.localeCompare(b.giftId)).slice(0, 20);
	const picked = pickTwenty(pool, SUPPLY, []);
	assert.notDeepEqual(picked.map((c) => c.giftId), naive.map((c) => c.giftId));
});

test('다른 덱이 쓴 기프트는 피한다 — 덱마다 다른 것을 보여야 한다', () => {
	// 이것이 없으면 세 덱이 거의 같은 스물을 보여 준다(실측: 서로 다른 기프트 21개)
	const pool = makePool();
	const first = pickTwenty(pool, SUPPLY, []);
	const avoid = new Set(first.map((c) => c.giftId));
	const second = pickTwenty(pool, SUPPLY, [], avoid);
	const overlap = second.filter((c) => avoid.has(c.giftId)).map((c) => c.giftId);
	assert.deepEqual(overlap, [], `겹친다: ${overlap.join(' ')}`);
	assert.equal(second.length, 20);
});

test('공통 기프트는 피하기보다 우선한다 — 일부러 겹치라고 둔 것이다', () => {
	const picked = pickTwenty(makePool(), SUPPLY, ['g001'], new Set(['g001']));
	assert.ok(picked.some((c) => c.giftId === 'g001'), '공통인데 피했다');
});

test('피할 것뿐이면 피하지 않는다 — 자리를 비우느니 겹친다', () => {
	// 갈래를 덮는 것이 겹침을 피하는 것보다 중요하다
	const small = makePool().slice(0, 4);
	const avoid = new Set(small.map((c) => c.giftId));
	assert.equal(pickTwenty(small, SUPPLY, [], avoid).length, 4);
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

test('어휘 밖과 곁다리를 가른다 — 둘이 뭉치면 「약」이 빈 칸이 된다', () => {
	const picked = pickTwenty(makePool(), SUPPLY, []);
	const weak = picked.filter((c) => {
		const f = fitOfKeyword(c.keywordId, SUPPLY);
		return f > 0 && f < 0.5;
	});
	assert.ok(weak.length > 0, '0 도 1 도 아닌 카드가 하나도 없다');
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

test('자리 메우기는 희귀 등급을 안 건드린다 — 뒤 덱이 되쓰게 된다', () => {
	// EX 를 두 장만 둔 못. ②단계가 하나를 덮으면 ③단계는 나머지를 남겨야 한다
	const pool = makePool().filter((c) => c.tier !== null)
		.concat(makePool().filter((c) => c.tier === null).slice(0, 2));
	const picked = pickTwenty(pool, SUPPLY, []);
	assert.equal(picked.filter((c) => c.tier === null).length, 1);
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
