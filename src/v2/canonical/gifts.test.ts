import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildGifts, stageLocId, type GiftInput } from './gifts.js';
import { Meta } from './meta.js';

function input(): GiftInput {
	return {
		mj: new Map<string, Record<string, unknown>>([
			[
				'9001',
				{
					id: 9001,
					name: 'Hellterfly’s Dream',
					nameKo: '지옥나비의 꿈',
					keyword: 'burn',
					tier: '2',
					sin: 'wrath',
					cost: 100,
					hardOnly: false,
					packs: [1001, 1002],
					uniquePacks: [1001],
					requires: { slots: [6] },
				},
			],
		]),
		mjDetail: new Map<string, Record<string, unknown>>([
			['9001', { id: 9001, attributeType: 'CRIMSON' }],
		]),
		assets: new Map<string, Record<string, unknown>>([
			[
				'9001',
				{
					affinity: 'wrath',
					tier: 2,
					keyword: 'Burn',
					names: ['Hellterfly’s Dream', 'Hellterfly’s Dream+', 'Hellterfly’s Dream++'],
					descs: ['base', 'plus', 'plusplus'],
					effects: ['Gain Buff'],
					triggers: ['Always'],
					enhanceable: true,
					exclusiveTo: ['1001', '1003'],
					hardonly: true,
					search_desc: '도구용',
				},
			],
		]),
		locKo: new Map<string, Record<string, unknown>>([
			['9001', { id: 9001, name: '지옥나비의 꿈', desc: '기본' }],
			['19001', { id: 19001, name: '지옥나비의 꿈+', desc: '강화1' }],
			['29001', { id: 29001, name: '지옥나비의 꿈++', desc: '강화2' }],
		]),
		locEn: new Map<string, Record<string, unknown>>([
			['9001', { id: 9001, name: 'Hellterfly’s Dream', desc: 'base' }],
		]),
		locJa: new Map<string, Record<string, unknown>>(),
		lockedKo: new Map<string, Record<string, unknown>>([
			['9001', { id: 9001, content: '획득 기록 없음' }],
		]),
		lockedEn: new Map<string, Record<string, unknown>>(),
		lockedJa: new Map<string, Record<string, unknown>>(),
		keywordDict: new Map([
			['burn', 'Combustion'],
			['keywordless', 'None'],
		]),
		knownPacks: new Set(['1001', '1002', '1003']),
	};
}

test('stageLocId 는 단계별 loc id 를 만든다', () => {
	assert.equal(stageLocId('9001', 0), '9001');
	assert.equal(stageLocId('9001', 1), '19001');
	assert.equal(stageLocId('9001', 2), '29001');
});

test('gift 행이 판정 결과를 담는다', () => {
	const t = buildGifts(input(), new Meta());
	assert.equal(t.gift.length, 1);
	assert.deepEqual(t.gift[0], {
		id: '9001',
		domain: 'mirror_dungeon',
		sin: 'wrath',
		tier: 2,
		tierLabel: null,
		cost: 100,
		keywordId: 'Combustion',
		hardOnly: true,
		enhanceable: true,
	});
});

test('hardOnly 는 합집합이다 — mj false · assets true 면 true', () => {
	const t = buildGifts(input(), new Meta());
	assert.equal(t.gift[0]?.hardOnly, true);
	const meta = new Meta();
	buildGifts(input(), meta);
	assert.equal(meta.sources.find((s) => s.field === 'hardOnly')?.rule, 'union');
});

test('tier 가 EX 면 숫자는 null 이고 tierLabel 에 남는다', () => {
	const i = input();
	i.mj.get('9001')!['tier'] = 'EX';
	i.assets.get('9001')!['tier'] = 'EX';
	const t = buildGifts(i, new Meta());
	assert.equal(t.gift[0]?.tier, null);
	assert.equal(t.gift[0]?.tierLabel, 'EX');
});

test('강화 단계가 assets names 길이만큼 생긴다', () => {
	const t = buildGifts(input(), new Meta());
	assert.deepEqual(t.giftStage, [
		{ giftId: '9001', level: 0 },
		{ giftId: '9001', level: 1 },
		{ giftId: '9001', level: 2 },
	]);
});

test('단계 한국어가 loc 의 +10000 · +20000 에서 온다', () => {
	const t = buildGifts(input(), new Meta());
	const ko = t.giftStageText.filter((r) => r.locale === 'ko').sort((a, b) => a.level - b.level);
	assert.deepEqual(ko.map((r) => r.name), ['지옥나비의 꿈', '지옥나비의 꿈+', '지옥나비의 꿈++']);
	assert.deepEqual(ko.map((r) => r.desc), ['기본', '강화1', '강화2']);
});

test('단계 영문은 loc 에 없으면 assets names 로 채운다', () => {
	const t = buildGifts(input(), new Meta());
	const en = t.giftStageText.filter((r) => r.locale === 'en').sort((a, b) => a.level - b.level);
	assert.deepEqual(en.map((r) => r.name), [
		'Hellterfly’s Dream',
		'Hellterfly’s Dream+',
		'Hellterfly’s Dream++',
	]);
});

test('로케일에 아무것도 없으면 단계 텍스트를 만들지 않는다', () => {
	const t = buildGifts(input(), new Meta());
	assert.equal(t.giftStageText.filter((r) => r.locale === 'ja').length, 0);
});

test('loc 에만 있는 4자리 id 는 story_dungeon 이고 구조가 비어 있다', () => {
	const i = input();
	i.locKo.set('1001', { id: 1001, name: '신도의 가면', desc: '설명' });
	const t = buildGifts(i, new Meta());
	const story = t.gift.find((g) => g.id === '1001');
	assert.ok(story, '스토리 기프트가 나와야 한다');
	assert.equal(story.domain, 'story_dungeon');
	assert.equal(story.sin, null);
	assert.equal(story.tier, null);
	assert.equal(story.keywordId, null);
	assert.equal(t.giftStage.filter((s) => s.giftId === '1001').length, 1, '단계가 하나다');
	// assets 에 있는 9001 은 4자리여도 mirror_dungeon 이다
	assert.equal(t.gift.find((g) => g.id === '9001')?.domain, 'mirror_dungeon');
});

test('스토리 기프트의 한국어가 없으면 결손으로 남는다', () => {
	const i = input();
	i.locEn.set('1017', { id: 1017, name: 'Hopeful Eyes' });
	const meta = new Meta();
	const t = buildGifts(i, meta);
	assert.equal(t.giftStageText.filter((r) => r.locale === 'ko' && r.giftId === '1017').length, 0);
	assert.equal(meta.gaps.filter((g) => g.entityId === '1017' && g.locale === 'ko').length, 1);
});

test('5자리 강화판 id 는 개별 기프트가 되지 않는다', () => {
	const t = buildGifts(input(), new Meta());
	assert.deepEqual(t.gift.map((g) => g.id), ['9001'], '19001 · 29001 은 단계로만 존재한다');
});

test('팩 연결이 mj packs 에서 나온다', () => {
	const t = buildGifts(input(), new Meta());
	assert.deepEqual(t.giftPack, [
		{ giftId: '9001', packId: '1001' },
		{ giftId: '9001', packId: '1002' },
	]);
});

test('전용 팩은 assets exclusiveTo 다 — mj uniquePacks 보다 넓다', () => {
	const t = buildGifts(input(), new Meta());
	assert.deepEqual(t.giftExclusivePack, [
		{ giftId: '9001', packId: '1001' },
		{ giftId: '9001', packId: '1003' },
	]);
});

test('모르는 팩을 가리키면 버리고 결손으로 남긴다', () => {
	const i = input();
	i.knownPacks = new Set(['1001']);
	const meta = new Meta();
	const t = buildGifts(i, meta);
	assert.equal(t.giftPack.length, 1);
	assert.ok(meta.gaps.some((g) => g.field === 'packs'));
});

test('requires 가 갈래별 행이 된다', () => {
	const t = buildGifts(input(), new Meta());
	assert.deepEqual(t.giftRequirement, [
		{ giftId: '9001', kind: 'slots', value: [6] },
	]);
});

test('도구 필드가 tool_annotation 으로 격리된다', () => {
	const t = buildGifts(input(), new Meta());
	assert.deepEqual(t.toolAnnotation, [
		{
			source: 'limbus-assets',
			entity: 'gift',
			entityId: '9001',
			field: 'search_desc',
			value: '도구용',
		},
	]);
});

test('획득 문구가 로케일별로 나온다', () => {
	const t = buildGifts(input(), new Meta());
	assert.deepEqual(t.giftLockedDesc, [
		{ giftId: '9001', locale: 'ko', text: '획득 기록 없음' },
	]);
});

test('합성 레시피가 assets recipes 에서 나온다', () => {
	const i = input();
	i.assets.get('9001')!['recipes'] = [
		[{ count: 2, options: ['9105', '9110'] }, '9142'],
	];
	const t = buildGifts(i, new Meta());
	assert.deepEqual(t.fusionRecipe, [{ giftId: '9001', index: 0 }]);
	assert.deepEqual(t.fusionSlot, [
		{ giftId: '9001', recipeIdx: 0, slotIdx: 0, materialId: null, count: 2 },
		{ giftId: '9001', recipeIdx: 0, slotIdx: 1, materialId: '9142', count: null },
	]);
	assert.deepEqual(t.fusionSlotOption, [
		{ giftId: '9001', recipeIdx: 0, slotIdx: 0, materialId: '9105' },
		{ giftId: '9001', recipeIdx: 0, slotIdx: 0, materialId: '9110' },
	]);
});

test('중복 효과를 접는다 — 9429 가 같은 효과를 두 번 담는 원본 결함', () => {
	const i = input();
	i.assets.get('9001')!['effects'] = ['Gain Buff', 'Gain Buff', 'Deal More Damage'];
	const meta = new Meta();
	const t = buildGifts(i, meta);
	assert.deepEqual(t.giftEffect, [
		{ giftId: '9001', effectId: 'Gain Buff' },
		{ giftId: '9001', effectId: 'Deal More Damage' },
	]);
	assert.equal(meta.sources.find((s) => s.field === 'effects')?.rule, 'assets-only-deduped');
});
