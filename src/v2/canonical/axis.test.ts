import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildAxis, type AxisInput } from './axis.js';
import { Meta } from './meta.js';

function input(): AxisInput {
	return {
		statusCategory: [
			{ statusId: 'Combustion', category: 'COMBUSTION' },
			{ statusId: 'Vibration', category: 'VIBRATION' },
			{ statusId: 'VibrationExplosion', category: 'VIBRATION_CONVERTED' },
			{ statusId: 'Bullet', category: 'BULLET' },
			{ statusId: 'DawnTeam', category: 'IGNORE_CHECED_CORRECTION_EXCLUSION' },
		],
		statusTextEn: [
			{ statusId: 'Combustion', name: 'Burn' },
			{ statusId: 'Vibration', name: 'Tremor' },
			{ statusId: 'VibrationExplosion', name: 'Tremor Burst' },
			{ statusId: 'Bullet', name: 'Ammo' },
			{ statusId: 'DawnTeam', name: 'Dawn Office' },
		],
		associationTextEn: [
			{ associationId: 'DAWN', name: 'Dawn Office' },
			{ associationId: 'LIU', name: 'Liu Association' },
			{ associationId: 'YURODIVY', name: 'Yurodiviye' },
		],
		triggerIds: [
			'Allies have Burn Skill', 'Dawn Office Identities', 'Liu Assoc. Identities',
			'Trigger Tremor Burst', 'Allies have Ammo Skill', 'Wrath Skill Used',
			'Wrath Absolute Resonance', 'Counter Skill Used', 'Plus Coin Skill Used',
			'Minus Coin Skill Used', 'Single-Coin Skill Used',
			'Deployment Position', 'Clash Win', 'Always', 'Other Uncommon Triggers',
			'Bloodfiend Identities', 'Yurodivy Identities',
		],
		effectIds: ['Inflict Burn Count', 'Deal Blunt Damage', 'Gain Buff', 'Consume Charge'],
		sinIds: ['wrath', 'lust', 'sloth', 'gluttony', 'gloom', 'pride', 'envy'],
		// app.ref_exception 이 주는 것. token kind 도 섞어 둔다 — axis 는 안 봐야 한다
		refException: [
			{ kind: 'trigger', key: 'Bloodfiend Identities', refKind: 'unit_keyword', refId: 'BLOODFIEND' },
			{ kind: 'trigger', key: 'Yurodivy Identities', refKind: 'association', refId: 'YURODIVY' },
			{ kind: 'token', key: 'BLOODDINNER', refKind: 'unit_keyword', refId: 'BLOODFIEND' },
		],
	};
}

test('축은 8종만 뽑는다 — 내부 플래그는 제외', () => {
	const t = buildAxis(input(), new Meta());
	assert.deepEqual(t.axis.map((a) => a.id).sort(), ['BULLET', 'COMBUSTION', 'VIBRATION']);
	assert.equal(t.axis.find((a) => a.id === 'BULLET')?.kind, 'bullet');
	assert.equal(t.axis.find((a) => a.id === 'COMBUSTION')?.kind, 'status_keyword');
});

test('소속이 상태 이름보다 우선한다 — Dawn Office 오매칭 방지', () => {
	const t = buildAxis(input(), new Meta());
	const r = t.triggerRef.filter((x) => x.triggerId === 'Dawn Office Identities');
	assert.deepEqual(r.map((x) => [x.refKind, x.refId]), [['association', 'DAWN']]);
});

test('최장일치가 축을 못 찾으면 짧은 매칭으로 내려간다', () => {
	// Tremor Burst(VibrationExplosion)는 VIBRATION_CONVERTED 라 축이 아니다.
	// Tremor(Vibration) → VIBRATION 이 정답이다
	const t = buildAxis(input(), new Meta());
	const r = t.triggerRef.filter((x) => x.triggerId === 'Trigger Tremor Burst');
	assert.deepEqual(r.map((x) => [x.refKind, x.refId]), [['axis', 'VIBRATION']]);
});

test('이름 매칭 예외 둘을 표로 푼다', () => {
	const t = buildAxis(input(), new Meta());
	const blood = t.triggerRef.find((x) => x.triggerId === 'Bloodfiend Identities');
	assert.deepEqual([blood?.refKind, blood?.refId], ['unit_keyword', 'BLOODFIEND']);
	const yuro = t.triggerRef.find((x) => x.triggerId === 'Yurodivy Identities');
	assert.deepEqual([yuro?.refKind, yuro?.refId], ['association', 'YURODIVY']);
});

test('evaluability 3단', () => {
	const t = buildAxis(input(), new Meta());
	const ev = (id: string) => t.triggerRef.find((x) => x.triggerId === id)?.evaluability;
	assert.equal(ev('Allies have Burn Skill'), 'roster');
	assert.equal(ev('Dawn Office Identities'), 'roster');
	assert.equal(ev('Wrath Skill Used'), 'roster_gated');
	assert.equal(ev('Deployment Position'), 'roster_gated');
	assert.equal(ev('Clash Win'), 'runtime');
	assert.equal(ev('Always'), 'always');
	assert.equal(ev('Other Uncommon Triggers'), 'unclassified');
});

test('공명은 죄악과 다른 refKind 이고 absolute 를 mode 로 담는다', () => {
	const t = buildAxis(input(), new Meta());
	const r = t.triggerRef.find((x) => x.triggerId === 'Wrath Absolute Resonance');
	assert.equal(r?.refKind, 'resonance');
	assert.equal(r?.refId, 'wrath');
	assert.equal(r?.resonanceMode, 'absolute');
});

test('skill_kind 와 coin 을 none 으로 뭉개지 않는다', () => {
	const t = buildAxis(input(), new Meta());
	const counter = t.triggerRef.find((x) => x.triggerId === 'Counter Skill Used');
	assert.deepEqual([counter?.refKind, counter?.refId], ['skill_kind', 'counter']);
	const plus = t.triggerRef.find((x) => x.triggerId === 'Plus Coin Skill Used');
	assert.deepEqual([plus?.refKind, plus?.refId], ['coin', 'plus']);
	const minus = t.triggerRef.find((x) => x.triggerId === 'Minus Coin Skill Used');
	assert.deepEqual([minus?.refKind, minus?.refId], ['coin', 'minus']);
	const single = t.triggerRef.find((x) => x.triggerId === 'Single-Coin Skill Used');
	assert.deepEqual([single?.refKind, single?.refId], ['coin', 'single']);
});

test('어디에도 안 걸리는 트리거는 none 으로 명시 기록한다', () => {
	const t = buildAxis(input(), new Meta());
	const r = t.triggerRef.find((x) => x.triggerId === 'Clash Win');
	assert.equal(r?.refKind, 'none');
});

test('효과도 축·죄악·공격타입으로 갈리고 mode 를 갖는다', () => {
	const t = buildAxis(input(), new Meta());
	const burn = t.effectRef.find((x) => x.effectId === 'Inflict Burn Count');
	assert.deepEqual([burn?.refKind, burn?.refId, burn?.mode], ['axis', 'COMBUSTION', 'inflict']);
	const blunt = t.effectRef.find((x) => x.effectId === 'Deal Blunt Damage');
	assert.deepEqual([blunt?.refKind, blunt?.refId], ['attack_type', 'blunt']);
	const charge = t.effectRef.find((x) => x.effectId === 'Consume Charge');
	assert.equal(charge?.mode, 'consume');
	const buff = t.effectRef.find((x) => x.effectId === 'Gain Buff');
	assert.equal(buff?.refKind, 'none');
});

test('예외 표는 입력으로 온다 — 상수가 아니다', () => {
	const i = input();
	i.refException = [
		{ kind: 'trigger', key: 'Bloodfiend Identities', refKind: 'axis', refId: 'BURST' },
	];
	const t = buildAxis(i, new Meta());

	const row = t.triggerRef.find((x) => x.triggerId === 'Bloodfiend Identities');
	assert.equal(row?.refKind, 'axis');
	assert.equal(row?.refId, 'BURST');
});

test('예외 표를 안 주면 그 트리거는 none 으로 떨어지고 결손이 남는다', () => {
	const meta = new Meta();
	const i = input();
	i.refException = [];
	const t = buildAxis(i, meta);

	// Bloodfiend 는 소속 이름에 없으므로 이름 매칭으로도 못 닿는다.
	// 행이 사라지는 게 아니라 none 으로 서고 결손이 따로 기록된다
	const row = t.triggerRef.find((x) => x.triggerId === 'Bloodfiend Identities');
	assert.equal(row?.refKind, 'none');
	assert.equal(meta.gaps.filter((g) => g.entityId === 'Bloodfiend Identities').length, 1);
});

test('token kind 는 axis 가 안 본다 — 자기 kind 만 거른다', () => {
	const i = input();
	i.triggerIds = ['BLOODDINNER'];
	i.refException = [
		{ kind: 'token', key: 'BLOODDINNER', refKind: 'unit_keyword', refId: 'BLOODFIEND' },
	];
	const t = buildAxis(i, new Meta());

	const row = t.triggerRef.find((x) => x.triggerId === 'BLOODDINNER');
	assert.notEqual(row?.refKind, 'unit_keyword');
});
