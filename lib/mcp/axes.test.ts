import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { canonical } from '../db-canonical';
import { canonicalReachable, NO_DB } from '../../src/v2/canonical/db-available';
import { axesOf, engineData, identityAxes } from './axes';

const reachable = await canonicalReachable(canonical);
after(async () => { await canonical.$disconnect(); });

test('identityAxes: skill 전용 행은 tag 에 안 든다', () => {
	const m = identityAxes([
		{ identityId: '10104', refKind: 'keyword', refId: 'VIBRATION', gateKind: 'always', gateRef: '', gateMin: null, affects: 'skill' },
		{ identityId: '10104', refKind: 'keyword', refId: 'BURN', gateKind: 'always', gateRef: '', gateMin: null, affects: 'both' },
		{ identityId: '10104', refKind: 'keyword', refId: 'BLEED', gateKind: 'ego_equipped', gateRef: '20101', gateMin: null, affects: 'both' },
	]);
	assert.deepEqual(m.get('10104'), { tag: ['keyword:BURN'], skill: ['keyword:BURN', 'keyword:VIBRATION'] });
});

test('identityAxes: tag 전용 · 중복 행은 한 번만, 정렬된다', () => {
	const m = identityAxes([
		{ identityId: '1', refKind: 'sin', refId: 'WRATH', gateKind: 'always', gateRef: '', gateMin: null, affects: 'tag' },
		{ identityId: '1', refKind: 'keyword', refId: 'BURN', gateKind: 'always', gateRef: '', gateMin: null, affects: 'both' },
		{ identityId: '1', refKind: 'keyword', refId: 'BURN', gateKind: 'always', gateRef: '', gateMin: null, affects: 'both' },
	]);
	assert.deepEqual(m.get('1'), { tag: ['keyword:BURN', 'sin:WRATH'], skill: ['keyword:BURN'] });
	assert.equal(m.has('2'), false);
	assert.equal(m.get('2'), undefined);
	assert.deepEqual(axesOf(m, '2'), { tag: [], skill: [] });
	assert.deepEqual(axesOf(m, '1'), m.get('1'));
	axesOf(m, '1').tag.push('x');
	assert.deepEqual(m.get('1')!.tag, ['keyword:BURN', 'sin:WRATH'], 'axesOf 결과를 고쳐도 원본은 그대로');
});

// 실데이터의 키워드 축은 refKind 가 'keyword' 가 아니라 'axis' 다 (axis:VIBRATION)
test('engineData 로 실제 10104 는 진동이 skill 에만 있다', { skip: reachable ? false : NO_DB }, async () => {
	const data = await engineData();
	assert.equal(await engineData(), data, '캐시가 같은 객체를 준다');
	const axes = identityAxes(data.capabilities).get('10104');
	assert.ok(axes, '10104 의 축이 있다');
	assert.ok(axes.skill.includes('axis:VIBRATION'));
	assert.ok(!axes.tag.includes('axis:VIBRATION'));
});
