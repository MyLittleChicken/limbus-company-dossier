import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractObjects, scanAll } from './scan.js';

test('dataList 모양 — 원소의 id 를 쓴다', () => {
	const r = extractObjects({ dataList: [{ id: 'A', v: 1 }, { id: 'B', v: 2 }] }, 'Whatever');
	assert.equal(r.shape, 'dataList');
	assert.deepEqual(r.objects, [
		{ id: 'A', payload: { id: 'A', v: 1 } },
		{ id: 'B', payload: { id: 'B', v: 2 } },
	]);
});

test('map 모양 — 맵의 키를 id 로 쓴다', () => {
	const r = extractObjects({ '9427': { affinity: 'sloth' }, '9428': { affinity: 'envy' } }, 'gifts');
	assert.equal(r.shape, 'map');
	assert.deepEqual(r.objects, [
		{ id: '9427', payload: { affinity: 'sloth' } },
		{ id: '9428', payload: { affinity: 'envy' } },
	]);
});

test('list 모양 — 원소의 id 를 쓴다', () => {
	const r = extractObjects([{ id: 9427, hardOnly: true }], 'gifts');
	assert.equal(r.shape, 'list');
	assert.deepEqual(r.objects, [{ id: '9427', payload: { id: 9427, hardOnly: true } }]);
});

test('단일 객체 모양 — 파일명 stem 을 id 로 쓴다', () => {
	const r = extractObjects({ grace: [], startGiftPool: {} }, 'md__details');
	assert.equal(r.shape, 'single');
	assert.deepEqual(r.objects, [
		{ id: 'md__details', payload: { grace: [], startGiftPool: {} } },
	]);
});

test('id 가 없는 원소는 #순번으로 대체한다', () => {
	const r = extractObjects([{ tag: 'a' }, { tag: 'b' }], 'identity_tag_list');
	assert.deepEqual(r.objects.map((o) => o.id), ['#0', '#1']);
});

test('빈 객체 원소도 버리지 않는다 — a1c5p2 원본 결함', () => {
	const r = extractObjects({ dataList: [{}] }, 'Skills_Ego-a1c5p2');
	assert.equal(r.objects.length, 1);
	assert.deepEqual(r.objects[0], { id: '#0', payload: {} });
});

test('빈 배열은 개체 0개다', () => {
	assert.deepEqual(extractObjects({ dataList: [] }, 'x').objects, []);
	assert.deepEqual(extractObjects([], 'x').objects, []);
});

test('빈 맵은 단일 객체로 본다 — 값이 전부 객체라는 조건을 만족하지 못한다', () => {
	const r = extractObjects({}, 'empty');
	assert.equal(r.shape, 'single');
	assert.deepEqual(r.objects, [{ id: 'empty', payload: {} }]);
});

test('값에 객체가 아닌 것이 섞이면 단일 객체다', () => {
	const r = extractObjects({ a: { x: 1 }, b: 'text' }, 'cfg');
	assert.equal(r.shape, 'single');
	assert.equal(r.objects[0]?.id, 'cfg');
});

test('id 는 숫자든 문자열이든 문자열로 정규화한다', () => {
	const r = extractObjects({ dataList: [{ id: 1010101 }] }, 'x');
	assert.equal(r.objects[0]?.id, '1010101');
});

test('원소가 문자열이어도 담는다 — identity_tag_list', () => {
	const r = extractObjects(['Slash', 'Pierce'], 'identity_tag_list');
	assert.equal(r.shape, 'list');
	assert.deepEqual(r.objects, [
		{ id: '#0', payload: 'Slash' },
		{ id: '#1', payload: 'Pierce' },
	]);
});

test('scanAll 은 실측 기준값과 일치한다', () => {
	const r = scanAll();
	assert.equal(r.fileCount, 1664, '파일 수');
	assert.equal(r.rows.length, 43270, '개체 행 수');
	assert.deepEqual(r.shapeCounts, { dataList: 796, single: 827, map: 34, list: 7 });
});

test('scanAll 의 (source, srcPath, id) 는 유일하다', () => {
	const r = scanAll();
	const seen = new Set<string>();
	const dups: string[] = [];
	for (const row of r.rows) {
		const k = `${row.source} ${row.srcPath} ${row.id}`;
		if (seen.has(k)) dups.push(k);
		seen.add(k);
	}
	assert.deepEqual(dups, [], '기본키 중복');
});

test('scanAll 의 출처별 개체 수가 실측과 일치한다', () => {
	const r = scanAll();
	const per: Record<string, number> = {};
	for (const row of r.rows) per[row.source] = (per[row.source] ?? 0) + 1;
	assert.deepEqual(per, {
		'loc-ja': 11218,
		'loc-en': 11013,
		'loc-ko': 10919,
		'limbus-data-mj': 4032,
		'limbus-assets': 3830,
		'shared-library': 2258,
	});
});

test('#순번으로 대체된 개체는 190건이고 9파일에서만 나온다', () => {
	const r = scanAll();
	const fallback = r.rows.filter((row) => row.id.startsWith('#'));
	assert.equal(fallback.length, 190);
	assert.equal(new Set(fallback.map((row) => row.srcPath)).size, 9);
});

test('payload 는 객체 43,096 · 문자열 174 이고 null 이 없다', () => {
	const r = scanAll();
	let obj = 0;
	let str = 0;
	let other = 0;
	for (const row of r.rows) {
		if (row.payload === null) other += 1;
		else if (typeof row.payload === 'string') str += 1;
		else if (typeof row.payload === 'object') obj += 1;
		else other += 1;
	}
	assert.equal(obj, 43096);
	assert.equal(str, 174);
	assert.equal(other, 0, 'null 이나 숫자 payload 가 있으면 적재 타입을 다시 봐야 한다');
});

test('알려진 개체가 제자리에 있다 — 기프트 9427', () => {
	const r = scanAll();
	const mj = r.rows.find(
		(row) => row.srcPath === 'gifts/limbus-data-mj/gifts.json' && row.id === '9427',
	);
	assert.ok(mj, 'mj 9427 이 있어야 한다');
	assert.equal(mj.entity, 'gifts');
	assert.equal((mj.payload as Record<string, unknown>)['hardOnly'], true);

	const assets = r.rows.find(
		(row) => row.srcPath === 'gifts/limbus-assets/gifts.json' && row.id === '9427',
	);
	assert.ok(assets, 'assets 9427 이 있어야 한다');
	assert.equal((assets.payload as Record<string, unknown>)['hardonly'], undefined);
});
