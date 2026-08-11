/**
 * 굽기 — 저작 payload 를 canonical 행으로. **순수 함수라 DB 가 필요 없다.**
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildGiftAbility } from './gift-ability.js';
import { Meta } from './meta.js';
import type { GiftAbilityAuthoredRow } from '../authored.js';

const cond = (over: Record<string, unknown> = {}) => ({
	group: 0, idx: 0, refKind: 'association', refId: 'RING_FINGER', op: 'has',
	threshold: null, scope: 'roster', supply: 'tag',
	slot: null, runtime: false, resonanceMode: null, ...over,
});
const payload = (over: Record<string, unknown> = {}) => ({
	timing: 'none', unconditional: false, refines: null, sourceText: '문단',
	conds: [cond()], ...over,
});
const row = (over: Record<string, unknown> = {}): GiftAbilityAuthoredRow =>
	({ giftId: '9262', level: 0, ordinal: 0, payload: payload(), ...over }) as GiftAbilityAuthoredRow;

const GIFTS = new Set(['9262']);

test('능력 하나와 조건 하나를 편다', () => {
	const meta = new Meta();
	const out = buildGiftAbility({ authored: [row()], giftIds: GIFTS }, meta);
	assert.equal(out.abilities.length, 1);
	assert.equal(out.conds.length, 1);
	assert.equal(out.conds[0].refId, 'RING_FINGER');
	assert.equal(out.conds[0].giftId, '9262');
	assert.equal(out.conds[0].ordinal, 0);
});

test('없는 기프트를 가리키면 버리고 결손으로 남긴다', () => {
	// 저작이 실물을 앞지를 수 있다 — 새 기프트가 나오기 전에 적어 둘 수 있어야
	// 한다. 다만 FK 가 걸려 있으므로 굽지는 않는다.
	const meta = new Meta();
	const out = buildGiftAbility({ authored: [row({ giftId: '9999' })], giftIds: GIFTS }, meta);
	assert.equal(out.abilities.length, 0);
	assert.equal(meta.gaps.some((g) => g.entityId === '9999' && g.field === 'gift_ability'), true);
});

test('unconditional 이 아닌데 조건이 없으면 결손을 남기고 굽는다', () => {
	// 「조건이 있는 줄은 아는데 못 뽑았다」이므로 능력 자체는 살린다.
	// 조건이 없으면 못 막으니 결과적으로 켜지는 쪽이고, 그것이
	// 「모른다를 아니다로 쓰지 않는다」에 맞다.
	const meta = new Meta();
	const out = buildGiftAbility(
		{ authored: [row({ payload: payload({ conds: [] }) })], giftIds: GIFTS }, meta);
	assert.equal(out.abilities.length, 1);
	assert.equal(meta.gaps.some((g) => g.field === 'conds' && g.entityId === '9262'), true);
});

test('threshold 가 null 이면 결손을 남긴다', () => {
	// 「문턱값을 못 찾았다」를 정직하게 적는다. 1 로 가정하지 않는다 —
	// 그 가정이 Allies have% 118짝 중 76짝을 틀리게 만들었다.
	const meta = new Meta();
	const p = payload({ conds: [cond({ op: 'gte', threshold: null })] });
	const out = buildGiftAbility({ authored: [row({ payload: p })], giftIds: GIFTS }, meta);
	assert.equal(out.conds[0].threshold, null);
	assert.equal(meta.gaps.some((g) => g.field === 'threshold'), true);
});

test("op='has' 의 threshold=null 은 결손이 아니다", () => {
	// 「약지 소속 인격이」는 수가 아니라 존재가 조건이다. 문턱값이 없는 것이 옳다.
	const meta = new Meta();
	const out = buildGiftAbility({ authored: [row()], giftIds: GIFTS }, meta);
	assert.equal(out.conds[0].threshold, null);
	assert.equal(meta.gaps.some((g) => g.field === 'threshold'), false);
});

test("timing='other' 는 결손을 남긴다", () => {
	const meta = new Meta();
	const p = payload({ timing: 'other', unconditional: true, conds: [] });
	const out = buildGiftAbility({ authored: [row({ payload: p })], giftIds: GIFTS }, meta);
	assert.equal(out.abilities[0].timing, 'other');
	assert.equal(meta.gaps.some((g) => g.field === 'timing'), true);
});

test('refines 가 없는 ordinal 을 가리키면 버리고 결손으로 남긴다', () => {
	// 사슬이 끊기면 강화판이 영원히 안 켜진다. 조용히 두면 안 된다.
	const meta = new Meta();
	const p = payload({ unconditional: true, refines: 5, conds: [] });
	const out = buildGiftAbility({ authored: [row({ payload: p })], giftIds: GIFTS }, meta);
	assert.equal(out.abilities[0].refines, null);
	assert.equal(meta.gaps.some((g) => g.field === 'refines'), true);
});

test('refines 사슬은 금지한다 — 강화판을 또 강화하지 않는다', () => {
	const meta = new Meta();
	const a0 = row({ ordinal: 0, payload: payload({ unconditional: true, refines: null, sourceText: 'A', conds: [] }) });
	const a1 = row({ ordinal: 1, payload: payload({ unconditional: true, refines: 0, sourceText: 'B', conds: [] }) });
	const a2 = row({ ordinal: 2, payload: payload({ unconditional: true, refines: 1, sourceText: 'C', conds: [] }) });
	const out = buildGiftAbility({ authored: [a0, a1, a2], giftIds: GIFTS }, meta);
	assert.equal(out.abilities.find((x) => x.ordinal === 2)?.refines, null);
	assert.equal(out.abilities.find((x) => x.ordinal === 1)?.refines, 0);
	assert.equal(meta.gaps.some((g) => g.field === 'refines'), true);
});

test('기프트마다 refines=null 인 능력이 하나는 남는다', () => {
	// 전부 강화판이면 켜짐 판정에 참여하는 능력이 없어 영영 죽는다.
	const meta = new Meta();
	const a0 = row({ ordinal: 0, payload: payload({ unconditional: true, refines: 1, sourceText: 'A', conds: [] }) });
	const a1 = row({ ordinal: 1, payload: payload({ unconditional: true, refines: 0, sourceText: 'B', conds: [] }) });
	const out = buildGiftAbility({ authored: [a0, a1], giftIds: GIFTS }, meta);
	assert.equal(out.abilities.filter((x) => x.refines === null).length >= 1, true);
	assert.equal(meta.gaps.some((g) => g.field === 'refines'), true);
});

test('강화 단계가 다르면 refines 가 서로를 못 가리킨다', () => {
	// (gift, level) 안에서만 이어야 한다. 0단계의 능력을 1단계가 가리키면
	// 단계마다 조건이 바뀌는 기프트에서 엉뚱한 절에 딸린다.
	const meta = new Meta();
	const l0 = row({ level: 0, ordinal: 0, payload: payload({ unconditional: true, refines: null, conds: [] }) });
	const l1 = row({ level: 1, ordinal: 0, payload: payload({ unconditional: true, refines: 0, conds: [] }) });
	const out = buildGiftAbility({ authored: [l0, l1], giftIds: GIFTS }, meta);
	// 1단계에는 ordinal 0 이 자기 자신뿐이고 그것이 refines 를 가졌으므로
	// 「전부 강화판」 규칙에 걸려 독립으로 돌아온다
	assert.equal(out.abilities.find((x) => x.level === 1)?.refines, null);
});
