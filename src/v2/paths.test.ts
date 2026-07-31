import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { ROOT, ENTITIES, SOURCES, parseEntityPath, listEntityFiles } from './paths.js';

test('parseEntityPath 는 계열·출처·상대경로·stem 을 뽑는다', () => {
	const abs = join(ENTITIES, 'gifts', 'limbus-assets', 'gifts.json');
	assert.deepEqual(parseEntityPath(abs), {
		entity: 'gifts',
		source: 'limbus-assets',
		srcPath: 'gifts/limbus-assets/gifts.json',
		stem: 'gifts',
	});
});

test('parseEntityPath 는 stem 에서 확장자만 벗긴다', () => {
	const abs = join(ENTITIES, 'ego-details', 'limbus-assets', '20101.json');
	assert.equal(parseEntityPath(abs).stem, '20101');
	assert.equal(parseEntityPath(abs).entity, 'ego-details');
});

test('parseEntityPath 는 규약을 벗어난 경로를 거부한다', () => {
	assert.throws(() => parseEntityPath(join(ENTITIES, 'gifts', 'gifts.json')));
	assert.throws(() => parseEntityPath(join(ROOT, 'package.json')));
});

test('SOURCES 는 출처 6종이다', () => {
	assert.deepEqual([...SOURCES].sort(), [
		'limbus-assets',
		'limbus-data-mj',
		'loc-en',
		'loc-ja',
		'loc-ko',
		'shared-library',
	]);
});

test('listEntityFiles 는 1,664파일을 정렬해 낸다', () => {
	const files = listEntityFiles();
	assert.equal(files.length, 1664);
	assert.deepEqual(files, [...files].sort());
	// 전부 규약을 만족한다
	for (const f of files) parseEntityPath(f);
});
