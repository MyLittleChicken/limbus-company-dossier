import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyRequiredMessage } from './schema-ops.js';

test('거부 메시지가 우회로를 알려 준다', () => {
	const m = emptyRequiredMessage(94);
	assert.match(m, /canonical/);
	assert.match(m, /94/);
	// 무엇을 하라는지 없으면 사람이 막힌다
	assert.match(m, /v2:build/);
});
