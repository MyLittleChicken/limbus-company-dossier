import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
	accumulateDeltas,
	buildSkills,
	expandStages,
	indexDetailSkills,
	pickAt,
	skillIdsInSlot,
	type SkillInput,
} from './skills.js';
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

// ── 델타 누적 ────────────────────────────────────────────────

test('accumulateDeltas 는 앞 단계 값을 이어받고 온 필드만 덮는다', () => {
	const m = accumulateDeltas(
		[
			{ uptie: 1, baseValue: 2, coinValue: 7, atkWeight: 1 },
			{ uptie: 2, coinValue: 8 },
			{ uptie: 3, baseValue: 3 },
		],
		'uptie',
	);
	assert.deepEqual(m.get(1), { uptie: 1, baseValue: 2, coinValue: 7, atkWeight: 1 });
	// 2 는 coinValue 만 왔지만 baseValue·atkWeight 를 이어받는다
	assert.equal(m.get(2)?.['baseValue'], 2);
	assert.equal(m.get(2)?.['coinValue'], 8);
	assert.equal(m.get(2)?.['atkWeight'], 1);
	// 3 은 baseValue 만 왔고 coinValue 는 2 단계 값이 남는다
	assert.equal(m.get(3)?.['baseValue'], 3);
	assert.equal(m.get(3)?.['coinValue'], 8);
});

test('accumulateDeltas 는 축이 없는 원소를 버린다', () => {
	const m = accumulateDeltas([{ baseValue: 1 }, 'x', null, { uptie: 2, baseValue: 5 }], 'uptie');
	assert.deepEqual([...m.keys()], [2]);
});

test('pickAt 은 요청 이하 중 가장 큰 것, 없으면 가장 앞을 준다', () => {
	const m = new Map([
		[2, 'b'],
		[4, 'd'],
	]);
	assert.equal(pickAt(m, 1), 'b', '앞선 원본이 없으면 가장 앞');
	assert.equal(pickAt(m, 3), 'b');
	assert.equal(pickAt(m, 5), 'd');
	assert.equal(pickAt(new Map<number, string>(), 1), null);
});

test('indexDetailSkills 는 인격 파일을 스킬 id 로 다시 색인한다', () => {
	const m = indexDetailSkills(
		new Map<string, Record<string, unknown>>([
			['10101', { skills: { '1010101': { data: [{ uptie: 1, baseValue: 2 }] } } }],
		]),
	);
	assert.equal(m.get('1010101')?.get(1)?.['baseValue'], 2);
});

test('skillIdsInSlot 은 공격 스킬의 슬롯으로 id 를 모은다', () => {
	const s = skillIdsInSlot(
		new Map<string, Record<string, unknown>>([
			[
				'10101',
				{
					attackSkills: [
						{ slot: 1, skillId: 1010101 },
						{ slot: 3, skillId: 1010103 },
					],
				},
			],
		]),
		3,
	);
	assert.deepEqual([...s], ['1010103']);
});

// ── 변환 ─────────────────────────────────────────────────────

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
		details: new Map<string, Record<string, unknown>>([
			[
				'10101',
				{
					skills: {
						'1010101': {
							data: [
								{
									uptie: 1,
									baseValue: 2,
									coinValue: 7,
									atkWeight: 1,
									levelCorrection: 0,
									coins: [{ type: 'normal', descs: ['x'] }],
								},
								{ uptie: 3, baseValue: 3, clashable: true },
							],
						},
					},
				},
			],
		]),
		mjIdentityDetail: new Map<string, Record<string, unknown>>([
			['10101', { attackSkills: [{ slot: 1, skillId: 1010101 }] }],
		]),
		locKo: new Map<string, Record<string, unknown>>([
			[
				'1010101',
				{
					id: '1010101',
					levelList: [
						{
							level: 1,
							name: '쳐내기(loc)',
							desc: '로케일',
							coinlist: [{ coindescs: [{ desc: '[적중시] <style="highlight">침잠</style> 1 부여' }] }],
						},
					],
				},
			],
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

test('단계 수치가 identity-details 에서 오고 델타로 이어진다', () => {
	const t = buildSkills(input(), new Meta());
	const at = (u: number) => t.skillStage.find((s) => s.uptie === u);
	assert.equal(at(1)?.baseValue, 2);
	assert.equal(at(1)?.coinValue, 7);
	assert.equal(at(1)?.atkWeight, 1);
	assert.equal(at(1)?.levelCorrection, 0);
	// 2 단계는 원본이 없다. 1 단계 값을 이어받는다
	assert.equal(at(2)?.baseValue, 2);
	// 3 단계는 baseValue 만 바뀌고 나머지는 이어받는다
	assert.equal(at(3)?.baseValue, 3);
	assert.equal(at(3)?.coinValue, 7);
	// 4·5 단계는 원본 축(1–4)을 넘어서도 마지막 값을 쓴다
	assert.equal(at(5)?.baseValue, 3);
});

test('clashable 은 원본이 말할 때만 채운다 — 없으면 false 가 아니라 모름이다', () => {
	const t = buildSkills(input(), new Meta());
	assert.equal(t.skillStage.find((s) => s.uptie === 1)?.clashable, null);
	assert.equal(t.skillStage.find((s) => s.uptie === 3)?.clashable, true);
});

test('수치가 없는 스킬은 NULL 로 둔다 — 지어내지 않는다', () => {
	const i = input();
	i.details = new Map();
	const t = buildSkills(i, new Meta());
	assert.ok(t.skillStage.every((s) => s.baseValue === null && s.coinValue === null));
});

test('코인이 로케일 축을 갖는다 — 한국어는 loc, 영문은 mj 폴백', () => {
	const t = buildSkills(input(), new Meta());
	const ko1 = t.skillCoin.filter((c) => c.uptie === 1 && c.locale === 'ko');
	assert.deepEqual(ko1.map((c) => c.effects), [['[적중시] 침잠 1 부여']], '마크업을 지운다');
	const en1 = t.skillCoin.filter((c) => c.uptie === 1 && c.locale === 'en');
	assert.deepEqual(en1.map((c) => c.effects), [['Inflict 1 [Sinking]']]);
	// 코인 자체는 로케일과 무관하게 존재한다. 일본어 문장만 없다
	const ja1 = t.skillCoin.filter((c) => c.uptie === 1 && c.locale === 'ja');
	assert.deepEqual(ja1.map((c) => c.effects), [[]]);
});

test('문장이 없는 코인도 코인이다 — assets 가 아는 개수를 따른다', () => {
	const i = input();
	// loc·mj 는 코인을 모르지만 details 는 코인 하나를 안다
	i.locKo = new Map();
	i.mjSkills.set('1010104', { id: 1010104, levels: [{ level: 1, name: 'Guard' }] });
	i.details.set('10101x', {
		skills: { '1010104': { data: [{ uptie: 1, coins: [{ type: 'unbreakable' }] }] } },
	});
	const t = buildSkills(i, new Meta());
	const c = t.skillCoin.filter((x) => x.skillId === '1010104' && x.uptie === 1);
	assert.equal(c.length, 3, '로케일 3벌');
	assert.ok(c.every((x) => x.effects.length === 0 && x.type === 'unbreakable'));
});

test('코인 종류가 identity-details 에서 온다', () => {
	const t = buildSkills(input(), new Meta());
	assert.equal(t.skillCoin.find((c) => c.uptie === 1 && c.locale === 'ko')?.type, 'normal');
	// 두 번째 코인은 details 에 없다. 종류를 지어내지 않는다
	assert.equal(
		t.skillCoin.find((c) => c.uptie === 5 && c.locale === 'en' && c.index === 1)?.type,
		null,
	);
});

test('loc 이 성긴 축이라도 이어받는다 — 5 단계 한국어가 1 단계 문장을 쓴다', () => {
	const t = buildSkills(input(), new Meta());
	const ko5 = t.skillCoin.find((c) => c.uptie === 5 && c.locale === 'ko');
	assert.deepEqual(ko5?.effects, ['[적중시] 침잠 1 부여']);
	assert.equal(t.skillStageText.find((r) => r.uptie === 5 && r.locale === 'ko')?.name, '쳐내기(loc)');
});

test('단계 텍스트가 mj 에서 나오고 loc 이 이긴다', () => {
	const i = input();
	// loc 을 1 단계만 두면 3 단계는 loc 1 단계를 이어받는다. mj 폴백을 보려면 loc 을 비운다
	i.locKo = new Map();
	const t = buildSkills(i, new Meta());
	const ko3 = t.skillStageText.find((r) => r.uptie === 3 && r.locale === 'ko');
	assert.equal(ko3?.name, '쳐내기', 'loc 에 없으면 mj');
	assert.equal(ko3?.desc, '설명');
	const withLoc = buildSkills(input(), new Meta());
	assert.equal(
		withLoc.skillStageText.find((r) => r.uptie === 1 && r.locale === 'ko')?.name,
		'쳐내기(loc)',
		'loc 우선',
	);
});

test('levels 가 비면 단계를 만들지 않는다', () => {
	const i = input();
	i.mjSkills.set('9999999', { id: 9999999, levels: [] });
	const meta = new Meta();
	const t = buildSkills(i, meta);
	assert.equal(t.skillStage.filter((s) => s.skillId === '9999999').length, 0);
	assert.ok(meta.gaps.some((g) => g.entityId === '9999999' && g.field === 'levels'));
});

// ── 동기화 III 해금 ──────────────────────────────────────────

test('슬롯 3 스킬은 동기화 1·2 단계를 만들지 않는다 — 게임에서 잠겨 있다', () => {
	const i = input();
	i.mjSkills.set('1010103', {
		id: 1010103,
		levels: [{ level: 3, name: 'Enjamb', nameKo: '연격' }],
	});
	i.mjIdentityDetail = new Map<string, Record<string, unknown>>([
		['10101', { attackSkills: [{ slot: 1, skillId: 1010101 }, { slot: 3, skillId: 1010103 }] }],
	]);
	const t = buildSkills(i, new Meta());
	assert.deepEqual(
		t.skillStage.filter((s) => s.skillId === '1010103').map((s) => s.uptie),
		[3, 4, 5],
	);
	// 슬롯 3 이 아닌 스킬은 그대로 5단계다
	assert.equal(t.skillStage.filter((s) => s.skillId === '1010101').length, 5);
});

test('슬롯 3 이어도 첫 원본이 3단계가 아니면 현행을 둔다 — 판정 밖 10건', () => {
	const i = input();
	i.mjSkills.set('1010103', {
		id: 1010103,
		levels: [{ level: 4, name: 'Enjamb', nameKo: '연격' }],
	});
	i.mjIdentityDetail = new Map<string, Record<string, unknown>>([
		['10101', { attackSkills: [{ slot: 3, skillId: 1010103 }] }],
	]);
	const t = buildSkills(i, new Meta());
	assert.equal(t.skillStage.filter((s) => s.skillId === '1010103').length, 5);
});
