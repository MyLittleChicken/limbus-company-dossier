/**
 * payload 검사기 — DB 없이 돈다.
 *
 * 저작 파일이 손으로 고쳐지므로 형식이 틀어질 수 있다. 심기 전에 여기서 막는다.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validatePayload, type AbilityPayload } from './ability-payload.js';

const ok: AbilityPayload = {
	timing: 'turn_start',
	unconditional: false,
	refines: null,
	sourceText: '약지 소속 인격이 가하는 피해량 +10%',
	conds: [{
		group: 0, idx: 0, refKind: 'association', refId: 'RING_FINGER',
		op: 'has', threshold: null, scope: 'roster', supply: 'tag',
		slot: null, runtime: false, resonanceMode: null,
	}],
};

test('제대로 된 payload 는 문제가 없다', () => {
	assert.deepEqual(validatePayload(ok), []);
});

test('unconditional 이면 조건이 없어야 한다', () => {
	const bad = { ...ok, unconditional: true };
	assert.deepEqual(validatePayload(bad), ['unconditional=true 인데 조건이 1개 있다']);
});

test('unconditional 이 아닌데 조건이 없으면 결손이지 오류가 아니다', () => {
	// 「조건이 있는 줄은 아는데 못 뽑았다」를 표현하는 자리다. 막지 않는다 —
	// 대신 굽는 쪽이 field_gap 을 남긴다.
	const gap = { ...ok, conds: [] };
	assert.deepEqual(validatePayload(gap), []);
});

test('timing 어휘 밖은 잡는다', () => {
	const bad = { ...ok, timing: 'when_i_feel_like_it' };
	assert.deepEqual(validatePayload(bad), ['timing 이 어휘에 없다: when_i_feel_like_it']);
});

test('scope=slot 이면 slot 이 1~7 이어야 한다', () => {
	const c = { ...ok.conds[0], scope: 'slot' as const, slot: 9 };
	assert.deepEqual(validatePayload({ ...ok, conds: [c] }), ['조건 0/0 의 slot 이 1~7 이 아니다: 9']);
});

test('출격이 7인이므로 7번 자리는 있다', () => {
	// 9759 불 꺼진 랜턴이 「[편성 7번 인격 전용 효과]」다. 1~5 로 두면 죽는다.
	const c = { ...ok.conds[0], scope: 'slot' as const, slot: 7 };
	assert.deepEqual(validatePayload({ ...ok, conds: [c] }), []);
});

test('scope 가 slot 이 아니면 slot 은 null 이어야 한다', () => {
	const c = { ...ok.conds[0], slot: 3 };
	assert.deepEqual(validatePayload({ ...ok, conds: [c] }), ["조건 0/0 은 scope='slot' 이 아닌데 slot 이 있다: 3"]);
});

test('group 과 idx 는 0 부터 빈틈없이 이어져야 한다', () => {
	const conds = [
		{ ...ok.conds[0], group: 0, idx: 0 },
		{ ...ok.conds[0], group: 0, idx: 2 },
	];
	assert.deepEqual(validatePayload({ ...ok, conds }), ['group 0 의 idx 가 0..1 로 이어지지 않는다: 0,2']);
});

test('supply=skill 은 축으로만 셀 수 있다', () => {
	// 스킬이 실제로 그 상태를 주는가는 coin_token 으로 세는데, coin_token 은
	// 축만 안다. 소속을 스킬로 셀 방법이 없다.
	const c = { ...ok.conds[0], supply: 'skill' as const };
	assert.deepEqual(validatePayload({ ...ok, conds: [c] }), ["조건 0/0 은 supply='skill' 인데 refKind 가 axis 가 아니다: association"]);
});

test('threshold 는 null 이거나 1 이상이다', () => {
	const c = { ...ok.conds[0], threshold: 0 };
	assert.deepEqual(validatePayload({ ...ok, conds: [c] }), ['조건 0/0 의 threshold 가 1 미만이다: 0']);
});

test('resonanceMode 는 resonance 조건에만 붙는다', () => {
	const c = { ...ok.conds[0], resonanceMode: 'absolute' };
	assert.deepEqual(validatePayload({ ...ok, conds: [c] }), ['조건 0/0 은 refKind 가 resonance 가 아닌데 resonanceMode 가 있다: absolute']);
});

test('sourceText 가 비면 잡는다 — 근거 없이 굽지 않는다', () => {
	assert.deepEqual(validatePayload({ ...ok, sourceText: '   ' }), ['sourceText 가 비어 있다 — 근거 없이 굽지 않는다']);
});
