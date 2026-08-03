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
		// ego-details 가 스킬 id 집합과 단계별 수치의 정본이다. data[] 는 델타 배열
		details: new Map<string, Record<string, unknown>>([
			['20101', {
				awakeningSkills: [{
					type: 'awakening',
					data: [
						{ id: '2010111', uptie: 1, spCost: 10, baseValue: 14, coinValue: 6, atkWeight: 1, levelCorrection: -4 },
						{ id: '2010111', uptie: 3, baseValue: 18 },
						{ id: '2010111', uptie: 4, atkWeight: 2 },
					],
				}],
			}],
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
		knownStatuses: new Set(['Agility']),
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

test('연출 전용 E.G.O 의 스킬이 기본 E.G.O 에 붙지 않는다 — loc 접두 스캔을 버렸다', () => {
	// loc 에 2010112 가 있어도 ego-details 의 id 집합에 없으면 이 E.G.O 의 것이 아니다.
	// 접두 스캔은 201011(연출 전용)의 스킬 2010112 를 20101 로 끌어왔다(감사 §4.3)
	const t = buildEgos(input(), new Meta());
	assert.deepEqual(
		t.egoSkill.map((s) => [s.id, s.role, s.ordinal]),
		[['2010111', 'awakening', 0]],
	);
	assert.ok(!t.egoSkillStage.some((s) => s.skillId === '2010112'));
});

test('두 번째 각성 스킬은 ego-details 가 담는다 — 20608 · 21209 대조군', () => {
	const i = input();
	const d = i.details.get('20101') as Record<string, unknown>;
	(d['awakeningSkills'] as unknown[]).push({
		type: 'awakening',
		data: [{ id: '2010112', uptie: 1, baseValue: 20 }],
	});
	const t = buildEgos(i, new Meta());
	assert.deepEqual(
		t.egoSkill.map((s) => [s.id, s.role, s.ordinal]),
		[
			['2010111', 'awakening', 0],
			['2010112', 'awakening', 1],
		],
	);
});

test('침식 스킬도 ego-details 에서 나온다', () => {
	const i = input();
	const d = i.details.get('20101') as Record<string, unknown>;
	d['corrosionSkills'] = [{ type: 'corrosion', data: [{ id: '2010121', uptie: 1, spCost: 20 }] }];
	const t = buildEgos(i, new Meta());
	assert.deepEqual(
		t.egoSkill.filter((s) => s.role === 'corrosion').map((s) => [s.id, s.ordinal]),
		[['2010121', 0]],
	);
	assert.equal(
		t.egoSkillStage.find((s) => s.skillId === '2010121')?.spCost,
		20,
	);
});

test('스킬 단계가 loc ∪ ego-details 다 — loc 은 문구가 안 바뀐 단계를 싣지 않는다', () => {
	const t = buildEgos(input(), new Meta());
	assert.deepEqual(
		t.egoSkillStage.filter((s) => s.skillId === '2010111').map((s) => s.uptie),
		[1, 3, 4],
	);
});

test('스킬 수치가 델타 전개된다 — 앞 단계 값을 이어받고 온 필드만 덮는다', () => {
	const t = buildEgos(input(), new Meta());
	assert.deepEqual(t.egoSkillStage.filter((s) => s.skillId === '2010111'), [
		{ skillId: '2010111', uptie: 1, spCost: 10, baseValue: 14, coinValue: 6, atkWeight: 1, levelCorrection: -4 },
		{ skillId: '2010111', uptie: 3, spCost: 10, baseValue: 18, coinValue: 6, atkWeight: 1, levelCorrection: -4 },
		{ skillId: '2010111', uptie: 4, spCost: 10, baseValue: 18, coinValue: 6, atkWeight: 2, levelCorrection: -4 },
	]);
});

test('ego-details 에 없는 스킬은 수치가 null 이다 — 지어내지 않는다', () => {
	const i = input();
	const d = i.details.get('20101') as Record<string, unknown>;
	d['awakeningSkills'] = [{ type: 'awakening', data: [{ id: '2010111', uptie: 1 }] }];
	const t = buildEgos(i, new Meta());
	assert.deepEqual(t.egoSkillStage.filter((s) => s.skillId === '2010111'), [
		{ skillId: '2010111', uptie: 1, spCost: null, baseValue: null, coinValue: null, atkWeight: null, levelCorrection: null },
	]);
});

test('코인이 coinlist.coindescs 에서 나온다', () => {
	const t = buildEgos(input(), new Meta());
	assert.deepEqual(t.egoSkillCoin, [
		{ skillId: '2010111', uptie: 1, index: 0, locale: 'ko', effects: ['[OnSucceedAttack] 신속 1'] },
	]);
});

test('효과 문자열이 없는 코인도 행으로 남는다 — 코인 수는 클래시 계산 입력이다', () => {
	const i = input();
	i.locSkillKo.set('2010111', {
		id: 2010111,
		levelList: [{ level: 1, name: '오감도', abName: '이상', desc: '', coinlist: [{ coindescs: [{}] }] }],
	});
	const t = buildEgos(i, new Meta());
	assert.deepEqual(t.egoSkillCoin, [
		{ skillId: '2010111', uptie: 1, index: 0, locale: 'ko', effects: [] },
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
