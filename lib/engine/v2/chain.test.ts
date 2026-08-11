import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chain, type ChainInput } from './chain';
import type { GiftVerdict } from './types';

function base(): ChainInput {
	return {
		heldGiftIds: ['held'],
		giftEffects: new Map([
			['held', ['inflictSink']],
			['mid', ['inflictBurn']],
			['far', ['inflictSink']],
		]),
		effectRefs: new Map([
			['inflictSink', [{ effectId: 'inflictSink', refKind: 'axis', refId: 'SINKING', mode: 'inflict' }]],
			['inflictBurn', [{ effectId: 'inflictBurn', refKind: 'axis', refId: 'COMBUSTION', mode: 'inflict' }]],
			['eatSink', [{ effectId: 'eatSink', refKind: 'axis', refId: 'SINKING', mode: 'consume' }]],
		]),
		giftRefs: new Map([
			['mid', [{ refKind: 'axis', refId: 'SINKING' }]],
			['far', [{ refKind: 'axis', refId: 'COMBUSTION' }]],
			['unrelated', [{ refKind: 'axis', refId: 'CHARGE' }]],
		]),
		verdicts: [],
	};
}

test('2홉 — held → mid → far', () => {
	const links = chain(base());
	assert.deepEqual(links.map((l) => [l.giftId, l.depth]), [['mid', 1], ['far', 2]]);
});

test('깊이 상한을 지킨다 — 1홉이면 far 가 안 나온다', () => {
	const links = chain(base(), 1);
	assert.deepEqual(links.map((l) => l.giftId), ['mid']);
});

test('보유 기프트는 사슬에 안 들어간다 — 자기 루프 방지', () => {
	const i = base();
	i.giftRefs.set('held', [{ refKind: 'axis', refId: 'SINKING' }]);
	assert.equal(chain(i).some((l) => l.giftId === 'held'), false);
});

test('상호 쌍이 무한히 돌지 않는다', () => {
	const i = base();
	// mid 가 침잠을 걸고 held 가 침잠을 본다 — 서로 켜 주는 쌍
	i.giftEffects.set('mid', ['inflictSink']);
	i.giftRefs.set('held', [{ refKind: 'axis', refId: 'SINKING' }]);
	const links = chain(i, 5);
	assert.equal(links.filter((l) => l.giftId === 'mid').length, 1);
});

test('중복 합산 금지 — 여러 경로로 만나도 한 번만 센다', () => {
	const i = base();
	i.heldGiftIds = ['held', 'held2'];
	i.giftEffects.set('held2', ['inflictSink']);
	const links = chain(i);
	const mid = links.filter((l) => l.giftId === 'mid');
	assert.equal(mid.length, 1);
	// 경로는 둘 다 남는다 — 근거를 잃지 않는다
	assert.equal(mid[0]?.via.length, 2);
	assert.equal(mid[0]?.depth, 1);
});

test('consume 은 사슬을 잇지 않는다 — 없애는 것이다', () => {
	const i = base();
	i.giftEffects.set('held', ['eatSink']);
	assert.deepEqual(chain(i), []);
});

test('편성으로 이미 충족된 참조는 사슬에서 뺀다', () => {
	const i = base();
	const v: GiftVerdict = {
		giftId: 'mid', grade: 'A', decidable: 1, satisfied: 1, certain: 1, total: 1,
		reasons: [{
			triggerId: 't', refKind: 'axis', refId: 'SINKING',
			verdict: 'satisfied', certainty: 'certain', have: 5, need: 5, denominator: 'field',
			blocking: true,
		}],
		// 확정 미충족이 없으므로 켜질 수 있다
		fireable: true,
	};
	i.verdicts = [v];
	// mid 는 이미 켜져 있으므로 사슬이 줄 것이 없다. far 도 따라서 안 나온다
	assert.deepEqual(chain(i), []);
});

test('무관한 기프트는 안 나온다', () => {
	assert.equal(chain(base()).some((l) => l.giftId === 'unrelated'), false);
});
