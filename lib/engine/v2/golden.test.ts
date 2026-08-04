/**
 * 골든 — 적재된 `canonical` 로 실제 편성을 판정한다.
 *
 * 단위 테스트는 규칙이 규칙대로 도는지만 본다. 여기서는 **실제 데이터로 알려진
 * 답이 나오는지** 본다. 편성은 축 골든과 같은 화상·진동 덱이다.
 */
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { PrismaClient } from '../../../src/v2/generated/client.js';
import { NO_DB, canonicalReachable } from '../../../src/v2/canonical/db-available.js';
import { loadEngineData } from './load';
import { Profile } from './profile';
import { evaluateGifts } from './evaluate';
import { chain } from './chain';
import type { Squad } from './types';

const prisma = new PrismaClient();
after(async () => { await prisma.$disconnect(); });

/** CI 는 DB 를 쓰지 않는다. 없으면 건너뛰되 건너뛴 사실은 보고에 남는다 */
const DB = { skip: (await canonicalReachable(prisma)) ? false : NO_DB };

const SQUAD: Squad = {
	roster: ['10216', '11216', '11009', '10916', '10716', '10512']
		.map((identityId) => ({ identityId, egoIds: [] })),
	field: ['10216', '11216', '11009', '10916', '10716', '10512'],
};

// DB 가 없으면 적재 자체가 던진다. 빈 값으로 두고 아래 테스트를 전부 건너뛴다
const data = DB.skip === false
	? await loadEngineData(prisma)
	: { capabilities: [], refsByTrigger: new Map(), giftTriggers: new Map(),
		giftEffects: new Map(), effectRefs: new Map(), giftRefs: new Map(), params: [] };
const verdicts = evaluateGifts({
	squad: SQUAD,
	profile: new Profile(SQUAD, data.capabilities),
	giftTriggers: data.giftTriggers,
	refsByTrigger: data.refsByTrigger,
	params: data.params,
});
const byId = new Map(verdicts.map((v) => [v.giftId, v]));

test('진혼(9088) 이 켜진다 — 화상 6 ≥ 5, 출전 분모', DB, () => {
	const v = byId.get('9088');
	assert.equal(v?.grade, 'A');
	const r = v?.reasons.find((x) => x.refKind === 'axis' && x.refId === 'COMBUSTION');
	assert.equal(r?.have, 6);
	assert.equal(r?.need, 5);
	assert.equal(r?.denominator, 'field');
	assert.equal(r?.verdict, 'satisfied');
});

test('피안개(9090) 는 같은 편성에서 미달한다 — 출혈 0 < 5', DB, () => {
	const v = byId.get('9090');
	const r = v?.reasons.find((x) => x.refId === 'LACERATION');
	assert.equal(r?.have, 0);
	assert.equal(r?.need, 5);
	assert.equal(r?.verdict, 'unsatisfied');
});

test('등급 셋이 전부 나온다 — 결합을 접지 않은 결과', DB, () => {
	const n = { A: 0, B: 0, C: 0 };
	for (const v of verdicts) n[v.grade] += 1;
	assert.ok(n.A > 0 && n.B > 0 && n.C > 0, JSON.stringify(n));
	// B 가 가장 크다. 설계 결정 2 가 「B 291건이 정보의 대부분」이라 한 자리다
	assert.ok(n.B > n.A && n.B > n.C, JSON.stringify(n));
	assert.equal(n.A + n.B + n.C, data.giftTriggers.size);
});

test('판정 불가를 목록에서 빼지 않는다 — C 도 근거를 갖는다', DB, () => {
	const c = verdicts.filter((v) => v.grade === 'C');
	assert.ok(c.length > 0);
	assert.ok(c.every((v) => v.decidable === 0));
	// 「참조는 있는데 전부 런타임」인 기프트가 실재해야 한다
	assert.ok(c.some((v) => v.total > 0));
});

test('충족은 항상 판정 가능 범위 안이다', DB, () => {
	assert.ok(verdicts.every((v) => v.satisfied <= v.decidable && v.decidable <= v.total));
});

test('분모를 편성으로 바꾸면 답이 달라지는 기프트가 있다', DB, () => {
	// 대기 인원을 채운 12인 편성. 출전은 그대로 6인이다
	const wide: Squad = {
		roster: [...SQUAD.roster, ...['10208', '10501', '10109', '11001', '10601', '10801']
			.map((identityId) => ({ identityId, egoIds: [] }))],
		field: SQUAD.field,
	};
	const wideVerdicts = evaluateGifts({
		squad: wide,
		profile: new Profile(wide, data.capabilities),
		giftTriggers: data.giftTriggers,
		refsByTrigger: data.refsByTrigger,
		params: data.params,
	});
	const wideById = new Map(wideVerdicts.map((v) => [v.giftId, v]));
	// 진혼은 출전 분모라 대기가 늘어도 그대로여야 한다 — 분모 분기가 실제로 산다
	const r = wideById.get('9088')?.reasons.find((x) => x.refId === 'COMBUSTION');
	assert.equal(r?.have, 6);
});

test('연쇄 — 보유 기프트가 아직 안 켜진 기프트를 켠다', DB, () => {
	// **9088 진혼으로는 안 된다.** 진혼이 거는 화상은 이 편성이 이미 갖고 있어
	// 사슬이 줄 것이 없다 — 설계가 「이미 충족된 참조는 뺀다」로 정한 자리다.
	// 9095 고장난 나침반은 이 화상 덱에 없는 침잠을 건다
	const links = chain({
		heldGiftIds: ['9095'],
		giftEffects: data.giftEffects,
		effectRefs: data.effectRefs,
		giftRefs: data.giftRefs,
		verdicts,
	});
	assert.ok(links.length > 0);
	assert.ok(links.every((l) => l.depth >= 1 && l.depth <= 2));
	assert.equal(links.some((l) => l.giftId === '9095'), false);
	// 침잠을 보는 기프트가 실제로 나와야 한다
	assert.ok(links.some((l) => l.via.some((v) => v.refId === 'SINKING')));
	// 근거가 비어 있으면 사슬을 낼 이유가 없다
	assert.ok(links.every((l) => l.via.length > 0));
});

test('이미 충족된 참조는 사슬이 되풀이하지 않는다 — 화상 덱에 화상 기프트', DB, () => {
	// 진혼이 거는 화상은 편성이 이미 갖고 있다. 사슬이 이것으로 늘면 중복이다
	const links = chain({
		heldGiftIds: ['9088'],
		giftEffects: data.giftEffects,
		effectRefs: data.effectRefs,
		giftRefs: data.giftRefs,
		verdicts,
	});
	assert.equal(links.some((l) => l.via.some((v) => v.refId === 'COMBUSTION')), false);
});

test('실측 등급 — A 146 · B 219 · C 86', DB, () => {
	const n = { A: 0, B: 0, C: 0 };
	for (const v of verdicts) n[v.grade] += 1;
	assert.deepEqual(n, { A: 146, B: 219, C: 86 });
});

test('전부 충족 95 · 그중 확정 50 — roster_gated 를 확정으로 세면 과대다', DB, () => {
	const fired = verdicts.filter((v) => v.grade === 'A' && v.satisfied === v.total);
	const sure = fired.filter((v) => v.certain === v.total);
	assert.equal(fired.length, 95);
	assert.equal(sure.length, 50);
});
