import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSkills, expandStages, type SkillInput } from './skills.js';
import { Meta } from './meta.js';

test('expandStages 는 델타를 1–5로 편다', () => {
	const r = expandStages([{ level: 1, name: 'a' }, { level: 3, name: 'b' }]);
	assert.deepEqual(
		r.map((s) => [s.uptie, s.changedHere, (s.source as Record<string, unknown>)['name']]),
		[
			[1, true, 'a'],
			[2, false, 'a'],
			[3, true, 'b'],
			[4, false, 'b'],
			[5, false, 'b'],
		],
	);
});

test('expandStages 는 요청 단계 이하 중 가장 큰 원본을 쓴다', () => {
	const r = expandStages([{ level: 4, name: 'only4' }]);
	// 1–3 은 4보다 앞이라 원본이 없다. 가장 앞 원본으로 채운다
	assert.deepEqual(r.map((s) => s.uptie), [1, 2, 3, 4, 5]);
	assert.equal(r[0]?.changedHere, false);
	assert.equal(r[3]?.changedHere, true);
});

test('expandStages 는 levels 가 비면 빈 배열이다', () => {
	assert.deepEqual(expandStages([]), []);
});

test('expandStages 는 전량이면 전부 changedHere true 다', () => {
	const r = expandStages([1, 2, 3, 4, 5].map((level) => ({ level, name: `n${level}` })));
	assert.equal(r.length, 5);
	assert.ok(r.every((s) => s.changedHere));
});

function input(): SkillInput {
	return {
		mjSkills: new Map<string, Record<string, unknown>>([
			[
				'1010101',
				{
					id: 1010101,
					sin: 'gloom',
					attackType: 'slash',
					skillTier: 1,
					levels: [
						{
							level: 1,
							name: 'Deflect',
							nameKo: '쳐내기',
							desc: null,
							descKo: null,
							coins: [['Inflict 1 [Sinking]']],
						},
						{
							level: 3,
							name: 'Deflect',
							nameKo: '쳐내기',
							desc: 'd',
							descKo: '설명',
							coins: [['Inflict 3 [Sinking]'], ['second coin']],
						},
					],
				},
			],
		]),
		locKo: new Map<string, Record<string, unknown>>([
			['1010101', { id: '1010101', levelList: [{ level: 1, name: '쳐내기(loc)', desc: '로케일' }] }],
		]),
		locEn: new Map<string, Record<string, unknown>>(),
		locJa: new Map<string, Record<string, unknown>>(),
	};
}

test('skill 행이 나온다', () => {
	const t = buildSkills(input(), new Meta());
	assert.deepEqual(t.skill, [
		{ id: '1010101', sin: 'gloom', attackType: 'slash', kind: null, skillTier: 1 },
	]);
});

test('단계가 5개로 전개되고 changedHere 가 델타를 보존한다', () => {
	const t = buildSkills(input(), new Meta());
	assert.deepEqual(
		t.skillStage.map((s) => [s.uptie, s.changedHere]),
		[
			[1, true],
			[2, false],
			[3, true],
			[4, false],
			[5, false],
		],
	);
});

test('코인이 단계마다 복사된다', () => {
	const t = buildSkills(input(), new Meta());
	assert.deepEqual(t.skillCoin.filter((c) => c.uptie === 1), [
		{ skillId: '1010101', uptie: 1, index: 0, effects: ['Inflict 1 [Sinking]'] },
	]);
	assert.deepEqual(t.skillCoin.filter((c) => c.uptie === 5).map((c) => c.effects), [
		['Inflict 3 [Sinking]'],
		['second coin'],
	]);
});

test('단계 텍스트가 mj 에서 나오고 loc 이 이긴다', () => {
	const t = buildSkills(input(), new Meta());
	const ko1 = t.skillStageText.find((r) => r.uptie === 1 && r.locale === 'ko');
	assert.equal(ko1?.name, '쳐내기(loc)', 'loc 우선');
	const ko3 = t.skillStageText.find((r) => r.uptie === 3 && r.locale === 'ko');
	assert.equal(ko3?.name, '쳐내기', 'loc 에 없으면 mj');
	assert.equal(ko3?.desc, '설명');
});

test('levels 가 비면 단계를 만들지 않는다', () => {
	const i = input();
	i.mjSkills.set('9999999', { id: 9999999, levels: [] });
	const meta = new Meta();
	const t = buildSkills(i, meta);
	assert.equal(t.skillStage.filter((s) => s.skillId === '9999999').length, 0);
	assert.ok(meta.gaps.some((g) => g.entityId === '9999999' && g.field === 'levels'));
});
