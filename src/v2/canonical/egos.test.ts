import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildEgos, type EgoInput } from './egos.js';
import { Meta } from './meta.js';

function input(): EgoInput {
	return {
		mj: new Map<string, Record<string, unknown>>([
			['20101', { id: 20101, sinnerId: 1, name: 'Crow’s Eye View', nameKo: '오감도', rarity: 'zayin', sin: 'sloth', attackType: 'pierce', resourceCost: { wrath: 1, sloth: 3 }, season: 0 }],
		]),
		mjDetail: new Map<string, Record<string, unknown>>([
			['20101', {
				id: 20101,
				attributeResists: { wrath: 1, lust: 1, sloth: 0.75, gluttony: 1, gloom: 2, pride: 1, envy: 2, white: 2, black: 2 },
				corrosion: [{ section: 0.5, probability: 0.25 }, { section: 0, probability: 1 }],
				awakeningSkill: 2010111, corrosionSkill: null,
				awakeningPassives: [2010111],
				requirements: [{ attributeType: 'CRIMSON', num: 1 }, { attributeType: 'AMBER', num: 3 }],
			}],
		]),
		assets: new Map<string, Record<string, unknown>>([
			['20101', { rank: 'ZAYIN', date: '2023-02-27', season: 0, sinnerId: 1, extractable: true, maxThreadspin: 5 }],
		]),
		locEgoKo: new Map<string, Record<string, unknown>>([
			['20101', { id: 20101, name: '오감도', desc: '이상의 기본 EGO 장비' }],
			['201011', { id: 201011, name: '오감도', desc: '이상 연출 전용 EGO 장비' }],
		]),
		locEgoEn: new Map<string, Record<string, unknown>>(),
		locEgoJa: new Map<string, Record<string, unknown>>(),
		locSkillKo: new Map<string, Record<string, unknown>>([
			['2010111', { id: 2010111, levelList: [{ level: 1, name: '오감도', abName: '이상', desc: '', coinlist: [{ coindescs: [{ desc: '[OnSucceedAttack] 신속 1' }] }] }] }],
			['2010112', { id: 2010112, levelList: [{ level: 4, name: '오감도(둘째)', abName: '이상', desc: '', coinlist: [] }] }],
		]),
		locSkillEn: new Map<string, Record<string, unknown>>(),
		locSkillJa: new Map<string, Record<string, unknown>>(),
		locPassiveKo: new Map<string, Record<string, unknown>>([
			['2010111', { id: 2010111, name: '침묵', desc: '피격 시 속박 3' }],
		]),
		locPassiveEn: new Map<string, Record<string, unknown>>(),
		locPassiveJa: new Map<string, Record<string, unknown>>(),
		knownSinners: new Set([1]),
	};
}

test('ego 행이 두 출처를 합쳐 나온다', () => {
	const t = buildEgos(input(), new Meta());
	const e = t.ego.find((x) => x.id === '20101');
	assert.deepEqual(e, {
		id: '20101', sinnerId: 1, rank: 'ZAYIN', sin: 'sloth', attackType: 'pierce',
		season: 0, releaseDate: '2023-02-27', maxThreadspin: 5, extractable: true,
		presentationOnly: false,
	});
});

test('연출 전용 5건이 플래그로 갈린다', () => {
	const t = buildEgos(input(), new Meta());
	const p = t.ego.find((x) => x.id === '201011');
	assert.ok(p, '연출 전용이 나와야 한다');
	assert.equal(p.presentationOnly, true);
	assert.equal(p.rank, null, '구조 필드가 없다');
});

test('저항이 죄악 7축만 담긴다', () => {
	const t = buildEgos(input(), new Meta());
	assert.equal(t.egoResist.length, 7);
	assert.ok(!t.egoResist.some((r) => r.sin === 'white' || r.sin === 'black'));
});

test('white·black 이 tool_annotation 으로 격리된다 — 로보토미 유산', () => {
	const t = buildEgos(input(), new Meta());
	const legacy = t.toolAnnotation.filter((a) => a.field === 'legacyResist');
	assert.equal(legacy.length, 1);
	assert.deepEqual(legacy[0]?.value, { white: 2, black: 2 });
});

test('자원 소모가 죄악별 행이 된다', () => {
	const t = buildEgos(input(), new Meta());
	assert.deepEqual(
		t.egoCost.map((c) => [c.sin, c.count]).sort(),
		[
			['sloth', 3],
			['wrath', 1],
		],
	);
});

test('침식 확률표가 순서대로 담긴다', () => {
	const t = buildEgos(input(), new Meta());
	assert.deepEqual(t.egoCorrosion, [
		{ egoId: '20101', index: 0, section: 0.5, probability: 0.25 },
		{ egoId: '20101', index: 1, section: 0, probability: 1 },
	]);
});

test('색 토큰 요구가 행이 된다', () => {
	const t = buildEgos(input(), new Meta());
	assert.deepEqual(t.egoRequirement, [
		{ egoId: '20101', attributeType: 'CRIMSON', num: 1 },
		{ egoId: '20101', attributeType: 'AMBER', num: 3 },
	]);
});

test('두 번째 각성 스킬을 loc 에서 찾아낸다 — mj 는 하나만 담는다', () => {
	const t = buildEgos(input(), new Meta());
	assert.deepEqual(
		t.egoSkill.map((s) => [s.id, s.role, s.ordinal]),
		[
			['2010111', 'awakening', 0],
			['2010112', 'awakening', 1],
		],
	);
});

test('스킬 단계가 원본에 있는 것만 담긴다 — 전량 전개하지 않는다', () => {
	const t = buildEgos(input(), new Meta());
	assert.deepEqual(t.egoSkillStage.filter((s) => s.skillId === '2010111'), [
		{ skillId: '2010111', uptie: 1 },
	]);
	assert.deepEqual(t.egoSkillStage.filter((s) => s.skillId === '2010112'), [
		{ skillId: '2010112', uptie: 4 },
	]);
});

test('코인이 coinlist.coindescs 에서 나온다', () => {
	const t = buildEgos(input(), new Meta());
	assert.deepEqual(t.egoSkillCoin, [
		{ skillId: '2010111', uptie: 1, index: 0, locale: 'ko', effects: ['[OnSucceedAttack] 신속 1'] },
	]);
});

test('유래 환상체 abName 이 담긴다 — loc 단독 개념', () => {
	const t = buildEgos(input(), new Meta());
	const txt = t.egoSkillStageText.find((x) => x.skillId === '2010111' && x.locale === 'ko');
	assert.equal(txt?.abName, '이상');
});

test('패시브가 loc 에서 나오고 연결이 선다', () => {
	const t = buildEgos(input(), new Meta());
	assert.deepEqual(t.egoPassive, [{ id: '2010111' }]);
	assert.deepEqual(t.egoPassiveLink, [{ egoId: '20101', passiveId: '2010111' }]);
	assert.equal(t.egoPassiveText.find((x) => x.locale === 'ko')?.name, '침묵');
});

test('이름이 loc 우선이고 mj 가 폴백이다', () => {
	const i = input();
	i.locEgoKo.delete('20101');
	const t = buildEgos(i, new Meta());
	assert.equal(t.egoText.find((x) => x.egoId === '20101' && x.locale === 'ko')?.name, '오감도');
});
