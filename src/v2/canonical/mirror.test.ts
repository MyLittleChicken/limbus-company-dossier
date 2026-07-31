import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildMirror, type MirrorInput } from './mirror.js';
import { Meta } from './meta.js';

function input(): MirrorInput {
	return {
		choiceEvents: new Map<string, Record<string, unknown>>([
			['901001', {
				type: 'Action', name: 'Ardor Blossom Moth', desc: 'Orange circles',
				gifts: [9104, 9001],
				options: [{ message: 'Reach out.', messageDesc: 'Gain a Burn Gift', result: [{ condition: 'None', results: [] }] }],
			}],
		]),
		achievements: new Map<string, Record<string, unknown>>([
			['md__achievements', {
				__Season__: 1,
				Collection: [{ id: 'col_a', text: 'Clear with [count]+', points: [10, 30], hardonly: [false, true] }],
			}],
		]),
		achievementsMd6: new Map<string, Record<string, unknown>>([
			['md__md6__achievements', {
				__Season__: 6,
				Collection: [{ id: 'col_a', text: 'MD6 version', points: [20], hardonly: [false] }],
			}],
		]),
		rewards: new Map<string, Record<string, unknown>>([['1', { item: 'Thread', count: 20 }]]),
		rewardsMd6: new Map<string, Record<string, unknown>>([['1', { item: 'Shard', count: 5 }]]),
		details: new Map<string, Record<string, unknown>>([
			['md__details', {
				grace: [{ index: 1, id: 'star', name: 'Star', cost: 10, descs: [['a']] }],
				startGiftPool: { Burn: [9001, 9009] },
				adversity: { '11': [{ name: 'Level Boost', desc: 'All +3', value: 1 }] },
			}],
		]),
		eventLocKo: new Map<string, Record<string, unknown>>([
			['901001', { id: 901001, desc: '주홍빛 동그라미', options: [{ message: '손을 뻗는다.', messageDesc: '화상 기프트 획득' }] }],
		]),
		eventLocEn: new Map<string, Record<string, unknown>>(),
		eventLocJa: new Map<string, Record<string, unknown>>(),
		knownGifts: new Set(['9001', '9009', '9104']),
		knownKeywords: new Set(['Combustion']),
		keywordDict: new Map([['burn', 'Combustion']]),
	};
}

test('선택지 이벤트와 기프트 연결이 나온다', () => {
	const t = buildMirror(input(), new Meta());
	assert.deepEqual(t.choiceEvent, [{ id: '901001', type: 'Action', illustId: null }]);
	assert.deepEqual(t.choiceEventGift.map((g) => g.giftId).sort(), ['9001', '9104']);
});

test('선택지가 행으로 펴지고 결과는 원문으로 남는다', () => {
	const t = buildMirror(input(), new Meta());
	assert.equal(t.choiceOption.length, 1);
	assert.equal(t.choiceOption[0]?.message, 'Reach out.');
	assert.deepEqual(t.choiceOption[0]?.results, [{ condition: 'None', results: [] }]);
});

test('한국어는 loc 에서, 영문은 assets 에서 온다', () => {
	const t = buildMirror(input(), new Meta());
	assert.equal(t.choiceEventText.find((x) => x.locale === 'ko')?.desc, '주홍빛 동그라미');
	assert.equal(t.choiceEventText.find((x) => x.locale === 'en')?.name, 'Ardor Blossom Moth');
	assert.equal(t.choiceOptionText.find((x) => x.locale === 'ko')?.message, '손을 뻗는다.');
});

test('일본어가 없으면 결손으로 남는다', () => {
	const meta = new Meta();
	buildMirror(input(), meta);
	assert.ok(meta.gaps.some((g) => g.entity === 'choice_event' && g.locale === 'ja'));
});

test('업적이 두 시즌 판본으로 갈린다 — 같은 id 가 겹친다', () => {
	const t = buildMirror(input(), new Meta());
	assert.deepEqual(
		t.achievement.map((a) => [a.id, a.season, a.category]),
		[
			['col_a', 0, 'Collection'],
			['col_a', 6, 'Collection'],
		],
	);
});

test('__Season__ 은 범주가 아니다', () => {
	const t = buildMirror(input(), new Meta());
	assert.ok(!t.achievement.some((a) => a.category === '__Season__'));
});

test('업적 한국어가 없으면 결손으로 남는다', () => {
	const meta = new Meta();
	buildMirror(input(), meta);
	assert.ok(meta.gaps.some((g) => g.entity === 'achievement' && g.locale === 'ko'));
});

test('보상이 시즌별로 나온다', () => {
	const t = buildMirror(input(), new Meta());
	assert.deepEqual(t.reward.sort((a, b) => a.season - b.season), [
		{ season: 0, level: 1, item: 'Thread', count: 20 },
		{ season: 6, level: 1, item: 'Shard', count: 5 },
	]);
});

test('은총·역경·시작 기프트가 나온다', () => {
	const t = buildMirror(input(), new Meta());
	assert.deepEqual(t.grace, [{ id: 'star', index: 1, cost: 10 }]);
	assert.deepEqual(t.adversity, [
		{ floorRange: '11', index: 0, name: 'Level Boost', desc: 'All +3', value: 1 },
	]);
	assert.deepEqual(t.startGift, [
		{ keywordId: 'Combustion', giftId: '9001' },
		{ keywordId: 'Combustion', giftId: '9009' },
	]);
});

test('은총·역경 한국어가 없으면 결손으로 남는다', () => {
	const meta = new Meta();
	buildMirror(input(), meta);
	assert.ok(meta.gaps.some((g) => g.entity === 'grace' && g.locale === 'ko'));
	assert.ok(meta.gaps.some((g) => g.entity === 'adversity' && g.locale === 'ko'));
});

test('모르는 기프트는 버리고 모르는 키워드는 결손으로 남긴다', () => {
	const i = input();
	i.knownGifts = new Set(['9001']);
	i.knownKeywords = new Set();
	const meta = new Meta();
	const t = buildMirror(i, meta);
	assert.deepEqual(t.choiceEventGift.map((g) => g.giftId), ['9001']);
	assert.equal(t.startGift.length, 0);
	assert.ok(meta.gaps.some((g) => g.entity === 'start_gift'));
});
