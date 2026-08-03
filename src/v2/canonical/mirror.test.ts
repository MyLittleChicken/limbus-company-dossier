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
				Collection: [{
					id: 'col_a', text: 'Clear with [count]+',
					points: [10, 30], hardonly: [false, true], replace: { count: [10, 30] },
				}],
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
				adversity: {
					'11': [
						{ name: 'Level Boost', desc: 'All +3', value: 1 },
						{ name: 'Frailness', desc: '-10% Max HP', value: 1 },
						{ name: 'Mark of Fire I', desc: 'burn', value: 2 },
						{ name: 'Inflation I', desc: 'cost x2', value: 2 },
						{ name: 'Ego Interference I', desc: 'ego x2', value: 2 },
						{ name: 'Force Redistribution', desc: 'offense up', value: 1 },
					],
				},
			}],
		]),
		graceLocKo: new Map<string, Record<string, unknown>>([
			['mirror_dungeon_5_buffs_title_100', { content: '시작의 별' }],
		]),
		graceLocEn: new Map<string, Record<string, unknown>>([
			['mirror_dungeon_5_buffs_title_100', { content: 'Star' }],
		]),
		graceLocJa: new Map<string, Record<string, unknown>>([
			['mirror_dungeon_5_buffs_title_100', { content: '始まりの星' }],
		]),
		adversityLocKo: new Map<string, Record<string, unknown>>([
			['MD6Limit101', { name: '레벨 강화', desc: '모든 적 레벨 3 증가' }],
			['MD7Limit101', { name: '전력 재분배', desc: '적 처치 시' }],
		]),
		adversityLocEn: new Map<string, Record<string, unknown>>([
			['MD6Limit101', { name: 'Level Boost', desc: 'All +3' }],
			['MD7Limit101', { name: 'Force Redistribution', desc: 'offense up' }],
		]),
		adversityLocJa: new Map<string, Record<string, unknown>>([
			['MD6Limit101', { name: 'レベル強化', desc: '全ての敵のレベルが3増加' }],
			['MD7Limit101', { name: '戦力の再分配', desc: '敵撃破時' }],
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
			['col_a', 1, 'Collection'],
			['col_a', 6, 'Collection'],
		],
	);
});

test('시즌은 __Season__ 이 정한다 — 하드코딩이 아니다', () => {
	const i = input();
	i.achievements = new Map([['md__achievements', {
		__Season__: '7',
		Collection: [{ id: 'col_a', text: 'x', points: [10], hardonly: [false] }],
	}]]);
	const t = buildMirror(i, new Meta());
	assert.deepEqual(t.achievement.map((a) => a.season), [7, 6]);
	// 보상 파일에는 __Season__ 이 없다 — 같은 판본의 업적 파일에서 받아 온다
	assert.deepEqual(t.reward.map((r) => r.season).sort((a, b) => a - b), [6, 7]);
});

test('업적 replace 를 담는다 — [count] 를 채울 값이다', () => {
	const t = buildMirror(input(), new Meta());
	assert.deepEqual(t.achievement[0]?.thresholds, { count: [10, 30] });
	// replace 가 없는 업적은 null 이다
	assert.equal(t.achievement[1]?.thresholds, null);
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
		{ season: 1, level: 1, item: 'Thread', count: 20 },
		{ season: 6, level: 1, item: 'Shard', count: 5 },
	]);
});

test('은총·역경·시작 기프트가 나온다', () => {
	const t = buildMirror(input(), new Meta());
	assert.deepEqual(t.grace, [{ id: 'star', index: 1, cost: 10 }]);
	assert.deepEqual(t.adversity[0], { floorRange: '11', index: 0, value: 1 });
	assert.equal(t.adversity.length, 6);
	assert.deepEqual(t.startGift, [
		{ keywordId: 'Combustion', giftId: '9001' },
		{ keywordId: 'Combustion', giftId: '9009' },
	]);
});

test('은총 이름 ko·ja 는 MirrorDungeonUI_5 의 조합 키에서 온다', () => {
	const meta = new Meta();
	const t = buildMirror(input(), meta);
	const byLocale = Object.fromEntries(t.graceText.map((x) => [x.locale, x.name]));
	assert.deepEqual(byLocale, { en: 'Star', ko: '시작의 별', ja: '始まりの星' });
	assert.ok(!meta.gaps.some((g) => g.entity === 'grace'));
});

test('은총 — 영문명이 어긋나면 조합 키를 믿지 않는다', () => {
	// 규칙으로 만든 키다. 영문 대조가 어긋나면 다른 은총을 가리키는 것이다
	const i = input();
	i.graceLocEn = new Map([['mirror_dungeon_5_buffs_title_100', { content: 'Something Else' }]]);
	const meta = new Meta();
	const t = buildMirror(i, meta);
	assert.deepEqual(t.graceText.map((x) => x.locale), ['en']);
	assert.equal(meta.gaps.filter((g) => g.entity === 'grace').length, 2);
});

test('역경 이름 ko·ja 는 MD6Limit·MD7Limit 조합 키에서 온다', () => {
	const meta = new Meta();
	const t = buildMirror(input(), meta);
	const first = t.adversityText.filter((x) => x.index === 0);
	assert.deepEqual(
		first.map((x) => [x.locale, x.name]),
		[['en', 'Level Boost'], ['ko', '레벨 강화'], ['ja', 'レベル強化']],
	);
	// 여섯 번째만 MD7Limit 계열이다
	const sixth = t.adversityText.filter((x) => x.index === 5);
	assert.deepEqual(
		sixth.map((x) => [x.locale, x.name]),
		[['en', 'Force Redistribution'], ['ko', '전력 재분배'], ['ja', '戦力の再分配']],
	);
});

test('역경 — 출처가 없는 것만 결손으로 남는다', () => {
	const meta = new Meta();
	buildMirror(input(), meta);
	// 1·6번째는 채웠고 2~5번째(MD6Limit102~105)는 fixture 에 없다 → 4건 × 2언어
	assert.equal(meta.gaps.filter((g) => g.entity === 'adversity').length, 8);
	assert.ok(!meta.gaps.some((g) => g.entityId === '11#0'));
	assert.ok(!meta.gaps.some((g) => g.entityId === '11#5'));
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
