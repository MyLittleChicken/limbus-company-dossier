import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Meta } from './meta.js';

test('gap 은 결손을 쌓는다', () => {
	const m = new Meta();
	m.gap('pack', '1001', 'textColor', '원본에 값이 없다', 'docs/data/pack/01-…');
	assert.equal(m.gaps.length, 1);
	assert.deepEqual(m.gaps[0], {
		entity: 'pack',
		entityId: '1001',
		field: 'textColor',
		locale: '',
		reason: '원본에 값이 없다',
		evidence: 'docs/data/pack/01-…',
	});
});

test('gap 은 로케일을 받을 수 있다', () => {
	const m = new Meta();
	m.gap('pack', '1', 'name', '없다', 'e', 'ko');
	assert.equal(m.gaps[0]?.locale, 'ko');
});

test('source 는 판정 근거를 쌓는다', () => {
	const m = new Meta();
	m.source('pack', '1001', 'sprite', 'agreed', ['limbus-data-mj', 'limbus-assets']);
	assert.deepEqual(m.sources[0], {
		entity: 'pack',
		entityId: '1001',
		field: 'sprite',
		rule: 'agreed',
		sources: ['limbus-data-mj', 'limbus-assets'],
	});
});

test('같은 (entity, id, field) 를 두 번 적으면 뒤가 이긴다', () => {
	const m = new Meta();
	m.source('pack', '1', 'x', 'mj-only', ['limbus-data-mj']);
	m.source('pack', '1', 'x', 'manual', ['manual']);
	assert.equal(m.sources.length, 1);
	assert.equal(m.sources[0]?.rule, 'manual');
});

test('summary 는 규칙별·필드별 건수를 센다', () => {
	const m = new Meta();
	m.source('pack', '1', 'a', 'mj-only', ['limbus-data-mj']);
	m.source('pack', '2', 'a', 'mj-only', ['limbus-data-mj']);
	m.source('pack', '1', 'b', 'agreed', ['limbus-data-mj', 'limbus-assets']);
	m.gap('pack', '3', 'a', 'r', 'e');
	const s = m.summary();
	assert.deepEqual(s.byRule, { 'mj-only': 2, agreed: 1 });
	assert.deepEqual(s.gapsByField, { a: 1 });
});
