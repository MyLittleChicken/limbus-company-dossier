import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildGiftTriggerParam, type GiftTriggerParamInput } from './gift-trigger-param.js';
import { Meta } from './meta.js';

const AXES = ['COMBUSTION', 'LACERATION', 'VIBRATION', 'BURST', 'SINKING', 'BREATH', 'CHARGE', 'BULLET'];

function base(): GiftTriggerParamInput {
	return {
		giftDesc: [],
		giftTrigger: [
			// 진혼 — 축 트리거 둘. 「보유한 인격이 5인」은 편성을 보는 roster 쪽 조건이다
			{ giftId: '9088', triggerId: 'Allies have Burn Skill' },
			{ giftId: '9088', triggerId: 'Burn Skill Used' },
			{ giftId: '2033', triggerId: 'Blade Lineage Identities' },
			// 9796 애달픈 날숨 — 호흡 트리거가 runtime 하나뿐이다
			{ giftId: '9796', triggerId: 'Allies have Poise' },
			{ giftId: '9282', triggerId: 'Dawn Office Identities' },
			{ giftId: '9761', triggerId: 'Deployment Position' },
		],
		triggerRef: [
			{ triggerId: 'Allies have Burn Skill', refKind: 'axis', refId: 'COMBUSTION', evaluability: 'roster' },
			{ triggerId: 'Burn Skill Used', refKind: 'axis', refId: 'COMBUSTION', evaluability: 'roster_gated' },
			{ triggerId: 'Blade Lineage Identities', refKind: 'association', refId: 'BLADE_LINEAGE', evaluability: 'roster' },
			{ triggerId: 'Allies have Poise', refKind: 'axis', refId: 'BREATH', evaluability: 'runtime' },
			{ triggerId: 'Dawn Office Identities', refKind: 'association', refId: 'DAWN', evaluability: 'roster' },
			{ triggerId: 'Deployment Position', refKind: 'deployment', refId: '', evaluability: 'roster_gated' },
		],
		associationKo: [
			{ associationId: 'BLADE_LINEAGE', name: '검계' },
			{ associationId: 'DAWN', name: '새벽 사무소' },
			{ associationId: 'MIDDLE_FINGER', name: '중지' },
		],
		giftSlots: [],
		axisIds: AXES,
		// app.ref_exception 이 주는 것. trigger kind 도 섞어 둔다 — 여기서는 안 봐야 한다
		refException: [
			{ kind: 'token', key: 'BLOODDINNER', refKind: 'unit_keyword', refId: 'BLOODFIEND' },
			{ kind: 'trigger', key: 'Bloodfiend Identities', refKind: 'unit_keyword', refId: 'BLOODFIEND' },
		],
	};
}

test('진혼 — 축 게이트가 roster 트리거에 붙고 분모는 출전이다', () => {
	const i = base();
	i.giftDesc = [{
		giftId: '9088',
		desc: '턴 시작 시, [Combustion] 위력, [Combustion] 횟수 또는 특수 화상을 부여하는 공격 스킬을 보유한 인격이 5인 이상이면, 이번 전투 동안 발동 (E.G.O 스킬 제외. 대기 인원 제외)',
	}];
	const rows = buildGiftTriggerParam(i, new Meta());
	assert.deepEqual(
		rows.map((r) => `${r.triggerId}|${r.kind}|${r.tier}|${r.value}`).sort(),
		[
			'Allies have Burn Skill|denominator|0|field',
			'Allies have Burn Skill|min_count|0|5',
		],
	);
});

test('소속 게이트 — 「검계 소속 인격이 3인 이상」', () => {
	const i = base();
	i.giftDesc = [{
		giftId: '2033',
		desc: '턴 시작 시, 검계 소속 인격이 3인 이상일 때 발동 (출격 인원을 기준으로 함)',
	}];
	const rows = buildGiftTriggerParam(i, new Meta());
	const min = rows.find((r) => r.kind === 'min_count');
	assert.equal(min?.triggerId, 'Blade Lineage Identities');
	assert.equal(min?.value, '3');
	assert.equal(rows.find((r) => r.kind === 'denominator')?.value, 'field');
});

test('다단 임계 — 같은 트리거에 tier 가 0·1 로 쌓인다', () => {
	const i = base();
	i.giftDesc = [{
		giftId: '9088',
		desc: '[Combustion] 위력을 부여하는 공격 스킬을 보유한 인격이 5인 이상이면 발동 - 10인 이상이면 대신 강화 (대기 인원 제외)',
	}];
	const rows = buildGiftTriggerParam(i, new Meta());
	assert.deepEqual(
		rows.filter((r) => r.kind === 'min_count').map((r) => [r.tier, r.value]),
		[[0, '5'], [1, '10']],
	);
	// 분모는 단을 공유한다. 한 행뿐이어야 한다
	assert.equal(rows.filter((r) => r.kind === 'denominator').length, 1);
});

test('편성 분모 — 「편성 인원을 기준으로 함」은 roster 다', () => {
	const i = base();
	i.giftDesc = [{
		giftId: '9282',
		desc: '턴 시작시, 새벽 사무소 소속 인격이 3인 이상일 때 발동 (편성 인원을 기준으로 함)',
	}];
	const rows = buildGiftTriggerParam(i, new Meta());
	assert.equal(rows.find((r) => r.kind === 'denominator')?.value, 'roster');
});

test('대기 분모 — 「대기 인원에」가 「대기 인원 포함」보다 먼저 걸린다', () => {
	const i = base();
	i.giftDesc = [{
		giftId: '9282',
		desc: '대기 인원에 새벽 사무소 소속 인격이 4명 이상이면, 턴 시작 시 무작위 아군 둘이 강화',
	}];
	const rows = buildGiftTriggerParam(i, new Meta());
	assert.equal(rows.find((r) => r.kind === 'denominator')?.value, 'waiting');
});

test('roster 트리거가 없으면 같은 축의 아무 트리거나 쓴다', () => {
	const i = base();
	i.giftDesc = [{
		giftId: '9796',
		desc: '편성된 인원 중 [Breath] 위력을 부여 또는 획득하는 공격 스킬을 보유한 인격이 5인 이상 일 때 발동 (편성 인원 포함)',
	}];
	const rows = buildGiftTriggerParam(i, new Meta());
	assert.equal(rows.find((r) => r.kind === 'min_count')?.triggerId, 'Allies have Poise');
});

test('대상을 못 정한 게이트는 결손으로 남는다 — 조용히 버리지 않는다', () => {
	const meta = new Meta();
	const i = base();
	i.giftDesc = [{ giftId: '9088', desc: '2인 이상 [Bullet]을 얻거나 소모하는 스킬 사용 시 강화' }];
	// [Bullet] 은 축이지만 이 기프트에 탄환 트리거가 없다
	const rows = buildGiftTriggerParam(i, meta);
	assert.equal(rows.length, 0);
	assert.equal(meta.gaps.filter((g) => g.entityId === '9088').length, 1);
});

test('트리거가 아예 없는 기프트는 결손으로 남는다 — 1xxx·2xxx 스토리 던전', () => {
	const meta = new Meta();
	const i = base();
	i.giftTrigger = [];
	i.giftDesc = [{ giftId: '2043', desc: '[Vibration] 위력을 부여하는 공격 스킬을 보유한 인격이 5인 이상 (대기 인원 제외)' }];
	assert.equal(buildGiftTriggerParam(i, meta).length, 0);
	assert.equal(meta.gaps.filter((g) => g.entityId === '2043').length, 1);
});

test('배치 슬롯 — gift_requirement 를 Deployment Position 에 귄다', () => {
	const i = base();
	i.giftSlots = [{ giftId: '9761', slots: [1, 2, 7, 8] }];
	const rows = buildGiftTriggerParam(i, new Meta());
	const slot = rows.find((r) => r.kind === 'slot');
	assert.equal(slot?.triggerId, 'Deployment Position');
	assert.deepEqual(slot?.slots, [1, 2, 7, 8]);
	assert.equal(slot?.source, 'requirement');
});

test('수에 가까운 대상을 쓴다 — 한 문장에 소속이 여럿일 때', () => {
	const i = base();
	i.giftDesc = [{
		giftId: '2033',
		desc: '검계 소속 인격을 제외한 편성 순서가 가장 빠른 새벽 사무소 소속 인격 1인을 검계 소속으로 취급하고, 턴 시작시 검계 소속 인격이 3인 이상일 때 발동 (출격 인원을 기준으로 함)',
	}];
	const rows = buildGiftTriggerParam(i, new Meta());
	assert.equal(rows.find((r) => r.kind === 'min_count')?.triggerId, 'Blade Lineage Identities');
});

test('저작 예외 — [BloodDinner] 는 흡혈종 트리거로 간다', () => {
	const i = base();
	i.giftTrigger.push({ giftId: '9795', triggerId: 'Bloodfiend Identities' });
	i.triggerRef.push({
		triggerId: 'Bloodfiend Identities', refKind: 'unit_keyword',
		refId: 'BLOODFIEND', evaluability: 'roster',
	});
	i.giftDesc = [{
		giftId: '9795',
		desc: '턴 시작 시, [BloodDinner]을 소모하는 스킬을 보유한 인격이 3인 이상이면, 이번 전투 동안 발동 (E.G.O 스킬 제외. 대기 인원 제외)',
	}];
	const rows = buildGiftTriggerParam(i, new Meta());
	const min = rows.find((r) => r.kind === 'min_count');
	assert.equal(min?.triggerId, 'Bloodfiend Identities');
	assert.equal(min?.value, '3');
});

test('적을 세는 문장은 이유를 갈라 남긴다 — 올바른 배제와 결손은 다르다', () => {
	const meta = new Meta();
	const i = base();
	i.giftDesc = [{ giftId: '9088', desc: '턴 종료 시 정신력이 -45인 적이 3명 이상이면, 다음 턴에 모든 아군이 강화' }];
	assert.equal(buildGiftTriggerParam(i, meta).length, 0);
	assert.match(meta.gaps.find((g) => g.entityId === '9088')?.reason ?? '', /적을 센다/);
});

test('토큰 예외는 입력으로 온다 — 상수가 아니다', () => {
	const i = base();
	i.giftTrigger = [{ giftId: '9795', triggerId: 'Bloodfiend Identities' }];
	i.triggerRef = [
		{ triggerId: 'Bloodfiend Identities', refKind: 'unit_keyword', refId: 'BLOODFIEND', evaluability: 'roster' },
	];
	i.giftDesc = [{ giftId: '9795', desc: '[BloodDinner]을 소모하는 스킬을 보유한 인격이 3인 이상일 때 발동' }];

	const rows = buildGiftTriggerParam(i, new Meta());
	assert.equal(rows.find((r) => r.kind === 'min_count')?.value, '3');
});

test('입력에 그 토큰이 없으면 게이트가 안 붙는다', () => {
	const i = base();
	i.giftTrigger = [{ giftId: '9795', triggerId: 'Bloodfiend Identities' }];
	i.triggerRef = [
		{ triggerId: 'Bloodfiend Identities', refKind: 'unit_keyword', refId: 'BLOODFIEND', evaluability: 'roster' },
	];
	i.giftDesc = [{ giftId: '9795', desc: '[BloodDinner]을 소모하는 스킬을 보유한 인격이 3인 이상일 때 발동' }];
	i.refException = [];

	const rows = buildGiftTriggerParam(i, new Meta());
	assert.equal(rows.filter((r) => r.kind === 'min_count').length, 0);
});

test('trigger kind 는 gift-trigger-param 이 안 본다 — 자기 kind 만 거른다', () => {
	const i = base();
	i.giftTrigger = [{ giftId: '9795', triggerId: 'Bloodfiend Identities' }];
	i.triggerRef = [
		{ triggerId: 'Bloodfiend Identities', refKind: 'unit_keyword', refId: 'BLOODFIEND', evaluability: 'roster' },
	];
	i.giftDesc = [{ giftId: '9795', desc: '[BloodDinner]을 소모하는 스킬을 보유한 인격이 3인 이상일 때 발동' }];
	// 같은 키를 trigger kind 로만 준다. 토큰 경로는 이걸 안 봐야 한다
	i.refException = [
		{ kind: 'trigger', key: 'BLOODDINNER', refKind: 'unit_keyword', refId: 'BLOODFIEND' },
	];

	const rows = buildGiftTriggerParam(i, new Meta());
	assert.equal(rows.filter((r) => r.kind === 'min_count').length, 0);
});

test('DENOMINATOR 는 코드에 남는다 — 입력으로 안 받는다', () => {
	const i = base();
	i.giftDesc = [{ giftId: '9088', desc: '[Combustion] 스킬을 보유한 인격이 5인 이상. 대기 인원 제외' }];
	i.refException = [];

	const rows = buildGiftTriggerParam(i, new Meta());
	assert.equal(rows.find((r) => r.kind === 'denominator')?.value, 'field');
});
