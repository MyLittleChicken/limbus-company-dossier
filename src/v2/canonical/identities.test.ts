import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildIdentities, type IdentityInput } from './identities.js';
import { Meta } from './meta.js';

function input(): IdentityInput {
	return {
		mj: new Map<string, Record<string, unknown>>([
			[
				'10101',
				{
					id: 10101, sinnerId: 1, star: 1, teamCodeEligible: true,
					name: 'LCB Sinner', nameKo: 'LCB 수감자', title: 'Yi Sang', titleKo: '이상',
					hp: 72, stagger: [65, 35, 15], speed: [4, 8],
					resists: { slash: 2, pierce: 0.5, blunt: 1 },
					associations: ['LIMBUS_COMPANY'],
					keywords: ['sinking'], keywordSkills: { sinking: [1, 2, 3] },
				},
			],
		]),
		mjDetail: new Map<string, Record<string, unknown>>([
			[
				'10101',
				{
					id: 10101, defCorrection: -2,
					attackSkills: [
						{ slot: 1, copies: 3, skillId: 1010101 },
						{ slot: 2, copies: 2, skillId: 1010102 },
					],
					defenseSkills: [1010104], panicSkill: 1010199,
					battlePassives: [{ level: 1, passives: [1010101] }],
					supporterPassives: [{ level: 3, passives: [1010102] }],
					unitKeywords: ['SMALL'],
				},
			],
		]),
		assets: new Map<string, Record<string, unknown>>([
			[
				'10101',
				{
					date: '2023-02-27', defCorrection: -2, season: 0,
					hp: { base: 72, level: 2.48 },
					speedList: [[4, 6], [4, 7], [4, 8], [4, 8]],
					resists: { blunt: 1, pierce: 0.5, slash: 2 },
				},
			],
		]),
		details: new Map<string, Record<string, unknown>>([
			[
				'10101',
				{
					passiveData: {
						'1010101': {
							name: 'Information Relay',
							condition: { type: 'res', requirement: [{ type: 'gloom', value: 4 }] },
						},
					},
				},
			],
		]),
		mjPassives: new Map<string, Record<string, unknown>>([
			['1010101', { id: 1010101, name: 'Information Relay', nameKo: '정보전달', desc: 'd', descKo: '설명', cost: ['CheckAwakenLevel4'] }],
			['1010102', { id: 1010102, name: null, nameKo: null, desc: null, descKo: null }],
		]),
		locKo: new Map<string, Record<string, unknown>>([
			['10101', { id: '10101', name: 'LCB 수감자', title: '이상', nameWithTitle: '이상 LCB 수감자' }],
		]),
		locEn: new Map<string, Record<string, unknown>>(),
		locJa: new Map<string, Record<string, unknown>>(),
		passiveKo: new Map<string, Record<string, unknown>>([
			['1010101', { id: '1010101', name: '정보전달(loc)', desc: '로케일 설명' }],
		]),
		passiveEn: new Map<string, Record<string, unknown>>(),
		passiveJa: new Map<string, Record<string, unknown>>(),
		knownSkills: new Set(['1010101', '1010102', '1010104', '1010199']),
		knownAssociations: new Set(['LIMBUS_COMPANY']),
		knownKeywords: new Set(['Sinking']),
		keywordDict: new Map([['sinking', 'Sinking']]),
		knownStatuses: new Set(['Sinking']),
	};
}

test('identity 행이 두 출처를 합쳐 나온다', () => {
	const t = buildIdentities(input(), new Meta());
	assert.deepEqual(t.identity, [
		{
			id: '10101', sinnerId: 1, star: 1, teamCodeEligible: true, season: 0,
			hp: 72, hpLevel: 2.48, stagger: [65, 35, 15], defCorrection: -2, releaseDate: '2023-02-27',
		},
	]);
});

test('체력은 기본값과 레벨당 증가치의 쌍이다 — 스칼라로 접지 않는다', () => {
	const t = buildIdentities(input(), new Meta());
	assert.equal(t.identity[0]?.hp, 72);
	assert.equal(t.identity[0]?.hpLevel, 2.48);
});

test('season 은 mj 에 없으면 assets 를 쓴다 — 결손이 아니라 출처 문제였다', () => {
	const i = input();
	// mj 에 season 키가 없는 10311 · 10708 이 실제 사례다
	assert.equal(i.mj.get('10101')?.['season'], undefined);
	assert.equal(buildIdentities(i, new Meta()).identity[0]?.season, 0);
});

test('저항 3축이 행으로 펴진다', () => {
	const t = buildIdentities(input(), new Meta());
	assert.deepEqual(
		t.identityResist.map((r) => [r.atkType, r.value]).sort(),
		[
			['blunt', 1],
			['pierce', 0.5],
			['slash', 2],
		],
	);
});

test('속도가 동기화 1–4 네 행으로 펴진다 — 마지막 원소만 남기지 않는다', () => {
	const t = buildIdentities(input(), new Meta());
	assert.deepEqual(t.identitySpeed, [
		{ identityId: '10101', uptie: 1, min: 4, max: 6 },
		{ identityId: '10101', uptie: 2, min: 4, max: 7 },
		{ identityId: '10101', uptie: 3, min: 4, max: 8 },
		{ identityId: '10101', uptie: 4, min: 4, max: 8 },
	]);
});

test('speedList 가 없으면 속도를 지어내지 않고 결손으로 남긴다', () => {
	const i = input();
	i.assets.set('10101', { ...(i.assets.get('10101') as Record<string, unknown>), speedList: [] });
	const meta = new Meta();
	const t = buildIdentities(i, meta);
	assert.equal(t.identitySpeed.length, 0);
	assert.ok(meta.gaps.some((g) => g.field === 'speed'));
});

test('이름·칭호가 loc 우선이다', () => {
	const t = buildIdentities(input(), new Meta());
	const ko = t.identityText.find((r) => r.locale === 'ko');
	assert.equal(ko?.name, 'LCB 수감자');
	assert.equal(ko?.title, '이상');
});

test('스킬 연결이 역할별로 나온다', () => {
	const t = buildIdentities(input(), new Meta());
	assert.deepEqual(
		t.identitySkill.map((s) => [s.skillId, s.role, s.ordinal, s.slot, s.copies]),
		[
			['1010101', 'attack', 0, 1, 3],
			['1010102', 'attack', 1, 2, 2],
			['1010104', 'defense', 0, null, null],
			['1010199', 'panic', 0, null, null],
		],
	);
});

test('공격 스킬은 슬롯·매수를 함께 담는다 — 덱 구성 정보', () => {
	const t = buildIdentities(input(), new Meta());
	const atk = t.identitySkill.filter((s) => s.role === 'attack');
	assert.deepEqual(atk.map((s) => s.copies), [3, 2]);
});

test('모르는 스킬을 가리키면 버리고 결손으로 남긴다', () => {
	const i = input();
	i.knownSkills = new Set(['1010101']);
	const meta = new Meta();
	const t = buildIdentities(i, meta);
	assert.equal(t.identitySkill.length, 1);
	assert.ok(meta.gaps.some((g) => g.field === 'skills'));
});

test('패시브 연결이 역할별로 나온다', () => {
	const t = buildIdentities(input(), new Meta());
	assert.deepEqual(
		t.identityPassive.map((p) => [p.passiveId, p.role, p.level]),
		[
			['1010101', 'battle', 1],
			['1010102', 'supporter', 3],
		],
	);
});

test('패시브 conditions 가 조건 코드 배열로 담긴다 — cost 가 아니다', () => {
	const t = buildIdentities(input(), new Meta());
	assert.deepEqual(t.passive.find((p) => p.id === '1010101')?.conditions, ['CheckAwakenLevel4']);
	assert.deepEqual(t.passive.find((p) => p.id === '1010102')?.conditions, []);
});

test('패시브 발동 조건이 assets 에서 온다 — mj cost 와 다른 축이다', () => {
	const t = buildIdentities(input(), new Meta());
	assert.equal(t.passive.find((p) => p.id === '1010101')?.condType, 'res');
	assert.equal(t.passive.find((p) => p.id === '1010102')?.condType, null);
	assert.deepEqual(t.passiveRequirement, [
		{ passiveId: '1010101', index: 0, sin: 'gloom', value: 4 },
	]);
});

test('죄악이 아닌 요구치는 버린다 — 열거형에 없는 값을 넣지 않는다', () => {
	const i = input();
	i.details.set('10101', {
		passiveData: {
			'1010101': { condition: { type: 'res', requirement: [{ type: 'nonsense', value: 4 }] } },
		},
	});
	const t = buildIdentities(i, new Meta());
	assert.deepEqual(t.passiveRequirement, []);
});

test('흐트러짐 구간이 배열로 담긴다 — 스칼라가 아니다', () => {
	const t = buildIdentities(input(), new Meta());
	assert.deepEqual(t.identity[0]?.stagger, [65, 35, 15]);
});

test('설명의 마크업을 지우고 원문을 descRaw 에 남긴다', () => {
	const i = input();
	i.passiveKo.set('1010101', { id: '1010101', name: '정보전달(loc)', desc: '<style="highlight">강화</style> 설명' });
	const t = buildIdentities(i, new Meta());
	const ko = t.passiveText.find((p) => p.passiveId === '1010101' && p.locale === 'ko');
	assert.equal(ko?.desc, '강화 설명');
	assert.equal(ko?.descRaw, '<style="highlight">강화</style> 설명');
});

test('마크업이 없으면 descRaw 는 null 이다', () => {
	const t = buildIdentities(input(), new Meta());
	const en = t.passiveText.find((p) => p.passiveId === '1010101' && p.locale === 'en');
	assert.equal(en?.descRaw, null);
});

test('이름이 전부 null 인 패시브는 유령이며 결손으로 남는다', () => {
	const meta = new Meta();
	const t = buildIdentities(input(), meta);
	assert.equal(t.passive.length, 2, '유령도 적재한다');
	assert.equal(t.passiveText.filter((p) => p.passiveId === '1010102').length, 0);
	assert.ok(meta.gaps.some((g) => g.entity === 'passive' && g.entityId === '1010102'));
});

test('패시브 이름은 loc 이 이기고 mj 가 폴백이다', () => {
	const t = buildIdentities(input(), new Meta());
	const ko = t.passiveText.find((p) => p.passiveId === '1010101' && p.locale === 'ko');
	assert.equal(ko?.name, '정보전달(loc)');
	const en = t.passiveText.find((p) => p.passiveId === '1010101' && p.locale === 'en');
	assert.equal(en?.name, 'Information Relay', 'loc-en 이 없으면 mj');
});

test('기믹 키워드가 사전 id 로 정규화되고 스킬 번호를 담는다', () => {
	const t = buildIdentities(input(), new Meta());
	assert.deepEqual(t.identityKeyword, [
		{ identityId: '10101', keywordId: 'Sinking', skillSlots: [1, 2, 3] },
	]);
});

test('특성 키워드가 소속과 별개 축으로 나온다', () => {
	const t = buildIdentities(input(), new Meta());
	assert.deepEqual(t.identityUnitKeyword, [{ identityId: '10101', keyword: 'SMALL' }]);
	assert.deepEqual(t.identityAssociation, [
		{ identityId: '10101', associationId: 'LIMBUS_COMPANY' },
	]);
});
