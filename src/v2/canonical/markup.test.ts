import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stripMarkup, hasMarkup } from './markup.js';

test('style 태그를 지운다', () => {
	assert.equal(stripMarkup('<style="highlight">합 위력 +1</style>'), '합 위력 +1');
});

test('여는 태그와 닫는 태그를 둘 다 지운다', () => {
	assert.equal(stripMarkup('<b>굵게</b> 보통 <i>기울임</i>'), '굵게 보통 기울임');
});

test('리터럴 꺾쇠는 보존한다 — 게임 텍스트다', () => {
	assert.equal(stripMarkup('<Bloodfiend> 를 처치'), '<Bloodfiend> 를 처치');
	assert.equal(stripMarkup('<La Manchaland>'), '<La Manchaland>');
	assert.equal(stripMarkup('<Mechanical> 부품'), '<Mechanical> 부품');
});

test('대괄호 토큰은 건드리지 않는다', () => {
	assert.equal(stripMarkup('[Sinking] 3 부여'), '[Sinking] 3 부여');
});

test('마크업이 없으면 그대로다', () => {
	assert.equal(stripMarkup('그냥 문장'), '그냥 문장');
});

test('중첩과 속성이 섞여도 지운다', () => {
	assert.equal(
		stripMarkup('<color=#ff0000><size=120%>빨강</size></color>'),
		'빨강',
	);
});

test('hasMarkup 이 마크업만 참이다', () => {
	assert.equal(hasMarkup('<style="x">a</style>'), true);
	assert.equal(hasMarkup('<Bloodfiend>'), false);
	assert.equal(hasMarkup('[Sinking]'), false);
	assert.equal(hasMarkup('그냥 문장'), false);
});

test('hasMarkup 은 여러 번 불러도 같은 답이다 — 정규식 상태가 안 샌다', () => {
	const t = '<b>x</b>';
	assert.equal(hasMarkup(t), true);
	assert.equal(hasMarkup(t), true);
	assert.equal(hasMarkup(t), true);
});
