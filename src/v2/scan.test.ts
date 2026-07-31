import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractObjects } from './scan.js';

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
