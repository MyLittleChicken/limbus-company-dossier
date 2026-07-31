import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildEncounters, type EncounterInput } from './encounters.js';
import { Meta } from './meta.js';

function input(): EncounterInput {
	return {
		encounters: new Map<string, Record<string, unknown>>([
			['md__canto-1-1', {
				name: 'The Forgotten', siteId: 'uuid-1',
				targets: [{
					name: 'Ebony Queen', parts: [{
						partId: 872101, name: 'Fruit',
						hp: { base: 18, level: 0.51 }, defCorrection: -1,
						speed: [2, 5],
						resists: { blunt: 1, pierce: 1, slash: 1, wrath: 2, lust: 0.75, sloth: 0.75, gluttony: 0.75, gloom: 0.75, pride: 0.75, envy: 0.75 },
					}],
				}],
			}],
			['story__waves-only', { name: 'Wave Battle', siteId: 'uuid-2', waves: [{ a: 1 }] }],
		]),
		groups: new Map<string, Record<string, unknown>>([
			['md', { 'canto-1-1': 'The Forgotten' }],
			['story', {}],
		]),
		enemyKo: new Map<string, Record<string, unknown>>([
			['8605', { id: 8605, name: '굴절된 어느 날의 초상', desc: '본체' }],
		]),
		enemyEn: new Map<string, Record<string, unknown>>([
			['8605', { id: 8605, name: 'Portrait', desc: 'Body' }],
		]),
		enemyJa: new Map<string, Record<string, unknown>>(),
		knownPacks: new Set(['1001']),
		packs: new Map<string, Record<string, unknown>>([
			['1001', { bossEncounters: ['md|canto-1-1', 'md|nonexistent'] }],
		]),
	};
}

test('조우가 그룹과 함께 나온다', () => {
	const t = buildEncounters(input(), new Meta());
	assert.deepEqual(
		t.encounter.map((e) => [e.id, e.group, e.name]).sort(),
		[
			['md__canto-1-1', 'md', 'The Forgotten'],
			['story__waves-only', 'story', 'Wave Battle'],
		],
	);
});

test('targets 가 없으면 waves 를 원문으로 남기고 나머지는 SQL NULL 이다', () => {
	const t = buildEncounters(input(), new Meta());
	const w = t.encounter.find((e) => e.id === 'story__waves-only');
	assert.deepEqual(w?.waves, [{ a: 1 }]);
	assert.equal(w?.phases, undefined, 'JSON null 이 아니라 undefined 여야 한다');
	assert.equal(w?.battles, undefined);
});

test('적 부위와 저항 10축이 나온다', () => {
	const t = buildEncounters(input(), new Meta());
	assert.deepEqual(t.encounterTarget, [
		{ encounterId: 'md__canto-1-1', index: 0, name: 'Ebony Queen' },
	]);
	const part = t.encounterTargetPart[0];
	assert.equal(part?.partId, '872101');
	assert.equal(part?.hpBase, 18);
	assert.equal(part?.speedMin, 2);
	assert.equal(t.encounterPartResist.length, 10, '물리 3축 + 죄악 7축');
});

test('이름이 빈 적도 담고 결손으로 남긴다 — 버리지 않는다', () => {
	const i = input();
	i.encounters.set('story__9-5-24', {
		name: 'X', siteId: 'uuid-3',
		targets: [{ name: '', parts: [{ partId: 146001, name: 'Body', hp: 450 }] }],
	});
	const meta = new Meta();
	const t = buildEncounters(i, meta);
	const target = t.encounterTarget.find((x) => x.encounterId === 'story__9-5-24');
	assert.ok(target, '이름이 비어도 행을 만든다');
	assert.equal(target.name, '');
	assert.equal(t.encounterTargetPart.filter((p) => p.encounterId === 'story__9-5-24').length, 1);
	assert.ok(meta.gaps.some((g) => g.entity === 'encounter_target' && g.field === 'name'));
});

test('hp 가 객체가 아니라 숫자면 base 로 담는다', () => {
	const i = input();
	i.encounters.set('x', { name: 'X', siteId: 'u', targets: [{ name: 'T', parts: [{ partId: 1, name: 'P', hp: 450 }] }] });
	const t = buildEncounters(i, new Meta());
	const p = t.encounterTargetPart.find((x) => x.encounterId === 'x');
	assert.equal(p?.hpBase, 450);
	assert.equal(p?.hpLevel, null);
});

test('팩 보스 조우가 이어지고 모르는 것은 결손으로 남는다', () => {
	const meta = new Meta();
	const t = buildEncounters(input(), meta);
	assert.deepEqual(t.packBossEncounter, [
		{ packId: '1001', encounterId: 'md__canto-1-1' },
	]);
	assert.ok(meta.gaps.some((g) => g.field === 'bossEncounters'));
});

test('적 표시명이 나오고 desc 가 부위 이름이다', () => {
	const t = buildEncounters(input(), new Meta());
	assert.deepEqual(t.enemy, [{ id: '8605' }]);
	const ko = t.enemyText.find((x) => x.locale === 'ko');
	assert.equal(ko?.name, '굴절된 어느 날의 초상');
	assert.equal(ko?.part, '본체');
});

test('일본어가 없으면 결손으로 남긴다', () => {
	const meta = new Meta();
	buildEncounters(input(), meta);
	assert.ok(meta.gaps.some((g) => g.entity === 'enemy' && g.locale === 'ja'));
});

test('전투 풀 미해결이 기록된다', () => {
	const meta = new Meta();
	buildEncounters(input(), meta);
	assert.ok(meta.gaps.some((g) => g.field === 'battlePool'));
});
