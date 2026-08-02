import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyTextOverrides, applyColumnOverrides, type OverrideRow } from './override.js';
import { Meta } from './meta.js';

const ov = (o: Partial<OverrideRow>): OverrideRow => ({
	entity: 'status',
	entityId: 'FullCharon',
	field: 'name',
	locale: 'ko',
	value: '완전한 카론',
	note: '게임 확인',
	...o,
});

test('없던 텍스트 행을 만든다 — 결손을 채우는 것이 주 용도다', () => {
	const meta = new Meta();
	const rows = applyTextOverrides(
		[{ statusId: 'Sinking', locale: 'ko', name: '침잠' }],
		[ov({})],
		{ entity: 'status', idKey: 'statusId', field: 'name' },
		meta,
	);
	assert.equal(rows.length, 2);
	assert.deepEqual(rows[1], { statusId: 'FullCharon', locale: 'ko', name: '완전한 카론' });
	assert.equal(meta.sources.find((s) => s.entityId === 'FullCharon')?.rule, 'manual');
});

test('있는 행을 덮어쓴다', () => {
	const rows = applyTextOverrides(
		[{ statusId: 'FullCharon', locale: 'ko', name: '틀린 이름' }],
		[ov({})],
		{ entity: 'status', idKey: 'statusId', field: 'name' },
		new Meta(),
	);
	assert.equal(rows.length, 1);
	assert.equal(rows[0]?.name, '완전한 카론');
});

test('다른 계열·다른 필드는 건드리지 않는다', () => {
	const rows = applyTextOverrides(
		[{ statusId: 'Sinking', locale: 'ko', name: '침잠' }],
		[ov({ entity: 'gift' }), ov({ field: 'desc' })],
		{ entity: 'status', idKey: 'statusId', field: 'name' },
		new Meta(),
	);
	assert.deepEqual(rows, [{ statusId: 'Sinking', locale: 'ko', name: '침잠' }]);
});

test('로케일이 다르면 별도 행이다', () => {
	const rows = applyTextOverrides(
		[{ statusId: 'FullCharon', locale: 'ko', name: '완전한 카론' }],
		[ov({ locale: 'ja', value: '完全なカロン' })],
		{ entity: 'status', idKey: 'statusId', field: 'name' },
		new Meta(),
	);
	assert.equal(rows.length, 2);
	assert.equal(rows.find((r) => r.locale === 'ja')?.name, '完全なカロン');
});

test('문자열이 아닌 값은 무시하고 결손으로 남긴다', () => {
	const meta = new Meta();
	const rows = applyTextOverrides(
		[],
		[ov({ value: 123 })],
		{ entity: 'status', idKey: 'statusId', field: 'name' },
		meta,
	);
	assert.equal(rows.length, 0);
	assert.ok(meta.gaps.some((g) => g.field === 'override'));
});

test('컬럼 덮어쓰기 — 있는 행의 값을 바꾼다', () => {
	const meta = new Meta();
	const rows = applyColumnOverrides(
		[
			{ id: '1001', textColor: null },
			{ id: '1002', textColor: 'ffffff' },
		],
		[ov({ entity: 'pack', entityId: '1001', field: 'textColor', locale: '', value: 'af241c' })],
		{ entity: 'pack', idKey: 'id' },
		meta,
	);
	assert.equal(rows[0]?.textColor, 'af241c');
	assert.equal(rows[1]?.textColor, 'ffffff', '다른 행은 그대로');
	assert.equal(meta.sources.find((s) => s.entityId === '1001')?.rule, 'manual');
});

test('컬럼 덮어쓰기 — 없는 행은 만들지 않고 결손으로 남긴다', () => {
	const meta = new Meta();
	const rows = applyColumnOverrides(
		[{ id: '1001', textColor: null }],
		[ov({ entity: 'pack', entityId: '9999', field: 'textColor', locale: '', value: 'x' })],
		{ entity: 'pack', idKey: 'id' },
		meta,
	);
	assert.equal(rows.length, 1);
	assert.ok(meta.gaps.some((g) => g.entityId === '9999'));
});

test('보정으로 채운 결손은 field_gap 에서 사라진다', () => {
	const meta = new Meta();
	meta.gap('status', 'FullCharon', 'name', '어느 출처에도 없다', 'e', 'ko');
	assert.equal(meta.gaps.length, 1);
	applyTextOverrides([], [ov({})], { entity: 'status', idKey: 'statusId', field: 'name' }, meta);
	assert.equal(meta.gaps.length, 0, '채웠으므로 결손이 아니다');
});

test('컬럼 보정도 결손을 해소한다', () => {
	const meta = new Meta();
	meta.gap('pack', '1001', 'textColor', '값이 없다', 'e');
	applyColumnOverrides(
		[{ id: '1001', textColor: null }],
		[ov({ entity: 'pack', entityId: '1001', field: 'textColor', locale: '', value: 'af241c' })],
		{ entity: 'pack', idKey: 'id' },
		meta,
	);
	assert.equal(meta.gaps.length, 0);
});
