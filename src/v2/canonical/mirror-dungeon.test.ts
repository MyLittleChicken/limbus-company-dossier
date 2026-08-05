import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
	buildMirrorDungeon,
	detectVersion,
	floorBounds,
	nameIdFor,
	type MirrorDungeonInput,
} from './mirror-dungeon.js';
import { Meta } from './meta.js';

/** 실측 구간. hard 는 11-15 로 끝나고 normal 은 5 로 끝난다 */
const FLOORS = [
	{ difficulty: 'normal', floorRange: '1' },
	{ difficulty: 'normal', floorRange: '2' },
	{ difficulty: 'normal', floorRange: '3' },
	{ difficulty: 'normal', floorRange: '4' },
	{ difficulty: 'normal', floorRange: '5' },
	{ difficulty: 'hard', floorRange: '1' },
	{ difficulty: 'hard', floorRange: '6-10' },
	{ difficulty: 'hard', floorRange: '11-15' },
];

/** 실측 파일명. loc-ko·en 에 판본 3~7 이 섞여 있다 */
const FILES = [
	'mirror-dungeon/loc-ko/AbEvents_Mirror3.json',
	'mirror-dungeon/loc-ko/AbEvents_Mirror7.json',
	'mirror-dungeon/loc-en/BattleKeywords_Mirror6.json',
	'mirror-dungeon/loc-ko/MirrorDungeonName.json',
];

function input(): MirrorDungeonInput {
	return {
		localeFiles: FILES,
		floorPack: FLOORS,
		names: [
			{ locale: 'ko', id: 'mirrordungeon_name_7', content: '이름과 거미의 거울' },
			{ locale: 'en', id: 'mirrordungeon_name_7', content: 'Mirror of Names and Spiders' },
			{ locale: 'ja', id: 'mirrordungeon_name_7', content: '名と蜘蛛の鏡' },
		],
	};
}

// ── 판본 뽑기 ────────────────────────────────────────────────────

test('판본은 파일명 최댓값이다', () => {
	assert.equal(detectVersion(FILES), 'MD7');
});

test('_MD<n> 꼴도 읽는다', () => {
	assert.equal(detectVersion(['x/y/Foo_MD6.json', 'x/y/Bar_MD4.json']), 'MD6');
});

test('상태 식별자에 안 걸린다 — MD6147 은 판본이 아니다', () => {
	// 표제어 id 로 찾으면 판본이 6147 이 된다. 파일명의 무늬만 본다
	assert.equal(detectVersion(['x/MD6147.json', 'x/AbEvents_Mirror7.json']), 'MD7');
});

test('하나도 못 찾으면 null 이다 — 가짜 값을 안 만든다', () => {
	assert.equal(detectVersion(['x/y/Something.json']), null);
});

// ── 층수 유도 ────────────────────────────────────────────────────

test('층수는 구간 표기의 최댓값이다', () => {
	assert.deepEqual(floorBounds(FLOORS), { totalFloors: 15, baseFloors: 5 });
});

test('구간이 한 자리여도 읽는다', () => {
	const got = floorBounds([
		{ difficulty: 'hard', floorRange: '7' },
		{ difficulty: 'normal', floorRange: '3' },
	]);
	assert.deepEqual(got, { totalFloors: 7, baseFloors: 3 });
});

test('숫자가 아닌 구간은 0으로 친다 — NaN 을 DB 에 넣지 않는다', () => {
	const got = floorBounds([
		{ difficulty: 'hard', floorRange: 'boss' },
		{ difficulty: 'normal', floorRange: '2' },
	]);
	assert.deepEqual(got, { totalFloors: 0, baseFloors: 2 });
});

test('층 표가 비면 0이다', () => {
	assert.deepEqual(floorBounds([]), { totalFloors: 0, baseFloors: 0 });
});

// ── 이름 고르기 ──────────────────────────────────────────────────

test('이름 id 는 접미사가 없다', () => {
	assert.equal(nameIdFor('MD7'), 'mirrordungeon_name_7');
});

test('난이도 접미사가 붙은 이름은 안 고른다', () => {
	const i = input();
	i.names.push(
		{ locale: 'ko', id: 'mirrordungeon_name_7_0', content: '이름과 거미의 거울 [NORMAL]' },
		{ locale: 'ko', id: 'mirrordungeon_name_7_1', content: '이름과 거미의 거울 [HARD]' },
	);
	const t = buildMirrorDungeon(i, new Meta());

	const ko = t.mirrorDungeonText.filter((r) => r.locale === 'ko');
	assert.equal(ko.length, 1);
	assert.equal(ko[0]?.name, '이름과 거미의 거울');
});

// ── 합쳐서 ───────────────────────────────────────────────────────

test('실측대로 나온다 — MD7 · 15 · 5 · 로케일 셋', () => {
	const t = buildMirrorDungeon(input(), new Meta());

	assert.deepEqual(t.mirrorDungeon, [{ version: 'MD7', totalFloors: 15, baseFloors: 5 }]);
	assert.equal(t.mirrorDungeonText.length, 3);
	assert.equal(t.mirrorDungeonText.find((r) => r.locale === 'ko')?.name, '이름과 거미의 거울');
});

test('판본을 못 뽑으면 행이 하나도 안 선다', () => {
	const meta = new Meta();
	const i = input();
	i.localeFiles = ['x/y/Something.json'];
	const t = buildMirrorDungeon(i, meta);

	assert.deepEqual(t.mirrorDungeon, []);
	assert.deepEqual(t.mirrorDungeonText, []);
	assert.equal(meta.gaps.filter((g) => g.field === 'version').length, 1);
});

test('층수가 0이면 결손으로 남긴다 — 층 표를 못 읽었다는 뜻이다', () => {
	const meta = new Meta();
	const i = input();
	i.floorPack = [];
	buildMirrorDungeon(i, meta);

	assert.equal(meta.gaps.filter((g) => g.field === 'floors').length, 1);
});

test('이름이 하나도 없으면 결손으로 남긴다', () => {
	const meta = new Meta();
	const i = input();
	i.names = [];
	const t = buildMirrorDungeon(i, meta);

	assert.equal(t.mirrorDungeonText.length, 0);
	assert.equal(meta.gaps.filter((g) => g.field === 'name').length, 1);
});
