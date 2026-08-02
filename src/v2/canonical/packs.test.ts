import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildPacks, type PackInput } from './packs.js';
import { Meta } from './meta.js';

/** 최소 입력. 팩 하나로 규칙을 하나씩 본다. */
function input(): PackInput {
	return {
		mjPacks: new Map<string, Record<string, unknown>>([
			[
				'1001',
				{
					id: 1001,
					name: 'The Forgotten',
					nameKo: '잊혀진 자들',
					category: 'canto',
					chapter: 1,
					variant: 'normal',
					sprite: 'Canto_I',
					textColor: 'af241c',
					superposition: false,
					extreme: false,
					bokgak: false,
					floorLength: 4,
				},
			],
		]),
		mjDetail: new Map<string, Record<string, unknown>>([
			['1001', { id: 1001, unlock: { unlockCode: 101 } }],
		]),
		assets: new Map<string, Record<string, unknown>>([
			[
				'1001',
				{
					category: ['Canto', 'I'],
					image: 'Canto_I',
					name: 'The Forgotten',
					tags: ['Canto I'],
					overlayImage: 'Canto_I_overlay',
				},
			],
		]),
		floorTable: { normal: { '1': ['1001'] }, hard: { '11-15': ['1001'] } },
		locKo: new Map<string, Record<string, unknown>>([['1001', { id: '1001', name: '잊혀진 자들' }]]),
		locEn: new Map<string, Record<string, unknown>>([['1001', { id: '1001', name: 'The Forgotten' }]]),
		locJa: new Map<string, Record<string, unknown>>([
			['1001', { id: '1001', name: '忘れ去られた者たち' }],
		]),
	};
}

test('pack 행이 mj 값을 그대로 받는다', () => {
	const t = buildPacks(input(), new Meta());
	assert.equal(t.pack.length, 1);
	assert.deepEqual(t.pack[0], {
		id: '1001',
		category: 'canto',
		chapter: 1,
		variant: 'normal',
		sprite: 'Canto_I',
		overlaySprite: 'Canto_I_overlay',
		superposition: false,
		extreme: false,
		bokgak: false,
		floorLength: 4,
		textColor: 'af241c',
		unlockCode: 101,
	});
});

test('표시명 3로케일이 나온다', () => {
	const t = buildPacks(input(), new Meta());
	assert.deepEqual(
		t.packText.map((r) => [r.locale, r.name]).sort(),
		[
			['en', 'The Forgotten'],
			['ja', '忘れ去られた者たち'],
			['ko', '잊혀진 자들'],
		],
	);
});

test('한국어는 mj 가 이긴다 — 1309 의 loc 후행 공백을 쓰지 않는다', () => {
	const i = input();
	i.mjPacks.get('1001')!['nameKo'] = '깨끗한 이름';
	i.locKo.set('1001', { id: '1001', name: '깨끗한 이름 ' });
	const t = buildPacks(i, new Meta());
	assert.equal(t.packText.find((r) => r.locale === 'ko')?.name, '깨끗한 이름');
});

test('한국어가 mj 에 없으면 loc 으로 폴백한다', () => {
	const i = input();
	delete i.mjPacks.get('1001')!['nameKo'];
	const t = buildPacks(i, new Meta());
	assert.equal(t.packText.find((r) => r.locale === 'ko')?.name, '잊혀진 자들');
});

test('세 출처 어디에도 이름이 없으면 행을 만들지 않고 결손으로 남긴다', () => {
	const i = input();
	delete i.mjPacks.get('1001')!['nameKo'];
	i.locKo.clear();
	const meta = new Meta();
	const t = buildPacks(i, meta);
	assert.equal(t.packText.filter((r) => r.locale === 'ko').length, 0);
	assert.equal(meta.gaps.filter((g) => g.field === 'name' && g.locale === 'ko').length, 1);
});

test('textColor 가 없으면 NULL 이고 결손으로 남는다', () => {
	const i = input();
	delete i.mjPacks.get('1001')!['textColor'];
	const meta = new Meta();
	const t = buildPacks(i, meta);
	assert.equal(t.pack[0]?.textColor, null);
	assert.equal(meta.gaps.filter((g) => g.field === 'textColor').length, 1);
});

test('unlockCode 가 없으면 NULL 이고 결손으로 남는다', () => {
	const i = input();
	i.mjDetail.set('1001', { id: 1001 });
	const meta = new Meta();
	const t = buildPacks(i, meta);
	assert.equal(t.pack[0]?.unlockCode, null);
	assert.equal(meta.gaps.filter((g) => g.field === 'unlockCode').length, 1);
});

test('categoryPath 는 assets 배열을 깊이별 행으로 편다', () => {
	const t = buildPacks(input(), new Meta());
	assert.deepEqual(t.packCategoryPath, [
		{ packId: '1001', depth: 0, value: 'Canto' },
		{ packId: '1001', depth: 1, value: 'I' },
	]);
});

test('tags 가 행으로 펴진다', () => {
	const t = buildPacks(input(), new Meta());
	assert.deepEqual(t.packTag, [{ packId: '1001', tag: 'Canto I' }]);
});

test('floorPack 이 난이도 × 구간으로 펴진다', () => {
	const t = buildPacks(input(), new Meta());
	assert.deepEqual(
		t.floorPack.slice().sort((a, b) => a.difficulty.localeCompare(b.difficulty)),
		[
			{ difficulty: 'hard', floorRange: '11-15', packId: '1001' },
			{ difficulty: 'normal', floorRange: '1', packId: '1001' },
		],
	);
});

test('층 테이블이 모르는 팩을 가리키면 버리고 결손으로 남긴다', () => {
	const i = input();
	i.floorTable = { normal: { '1': ['9999'] }, hard: {} };
	const meta = new Meta();
	const t = buildPacks(i, meta);
	assert.equal(t.floorPack.length, 0);
	assert.equal(meta.gaps.filter((g) => g.field === 'floorPack').length, 1);
});

test('sprite 가 두 출처에서 다르면 mj 를 쓰고 규칙을 disagreed 로 적는다', () => {
	const i = input();
	i.assets.get('1001')!['image'] = 'Different';
	const meta = new Meta();
	const t = buildPacks(i, meta);
	assert.equal(t.pack[0]?.sprite, 'Canto_I');
	assert.equal(meta.sources.find((s) => s.field === 'sprite')?.rule, 'disagreed');
});

test('sprite 가 같으면 규칙이 agreed 다', () => {
	const meta = new Meta();
	buildPacks(input(), meta);
	assert.equal(meta.sources.find((s) => s.field === 'sprite')?.rule, 'agreed');
});

test('assets 에 없는 팩도 버리지 않는다 — mj 가 정본이다', () => {
	const i = input();
	i.assets.clear();
	const t = buildPacks(i, new Meta());
	assert.equal(t.pack.length, 1);
	assert.equal(t.pack[0]?.overlaySprite, null);
	assert.equal(t.packTag.length, 0);
	assert.equal(t.packCategoryPath.length, 0);
});
