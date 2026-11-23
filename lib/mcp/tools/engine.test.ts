import { test, after, before } from 'node:test';
import assert from 'node:assert/strict';
import type { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { canonical } from '@/lib/db-canonical';
import { canonicalReachable, NO_DB } from '@/src/v2/canonical/db-available';
import { connectInMemory } from '../test-client';
import { engineData } from '../axes';
import { PROVISIONAL_REASON, STAGE_NOTE } from './engine';

// 사용자 실물 덱 코드(편성 #24). 2026-11-23 게임 편성창 캡처와 12칸을 대조했다(설계 §6.2).
const CODE_24 = 'H4sIAAAAAAAAE3P1dkyv8Ex3DAx09nDNLHdyLPd0BAJnL8d0EO2f7gyiHEsyAiPDPR2djR0zgxwjHT3LIcKFENWuwY4ZYENcg11dndKdnAI98/29gBK2tgAHpASdYAAAAA==';

const reachable = await canonicalReachable(canonical);
const skip = reachable ? false : NO_DB;

let c: Client;
before(async () => { if (reachable) c = await connectInMemory(); });
after(async () => {
	await c?.close();
	await canonical.$disconnect();
});

type Body = Record<string, any>;
const text = (r: Awaited<ReturnType<Client['callTool']>>) => (r.content as Array<{ text: string }>)[0]!.text;
async function call(name: string, args: Record<string, unknown>): Promise<Body> {
	const r = await c.callTool({ name, arguments: args });
	assert.notEqual(r.isError, true, `${name} 실패: ${r.isError ? text(r) : ''}`);
	return r.structuredContent as Body;
}

test('네 도구가 등록되고 읽기 전용이다', { skip }, async () => {
	const { tools } = await c.listTools();
	for (const name of ['decode_deck_code', 'analyze_deck', 'check_gifts', 'score_packs']) {
		const t = tools.find((x) => x.name === name);
		assert.ok(t, name);
		assert.equal(t.annotations?.readOnlyHint, true);
		assert.ok(t.outputSchema, `${name} outputSchema`);
	}
});

test('decode_deck_code(편성 #24): 12칸, 1–7 출격 · 8–12 대기, E.G.O 가 실린다', { skip }, async () => {
	const b = await call('decode_deck_code', { deckCode: CODE_24 });
	assert.equal(b.order.length, 12);
	assert.deepEqual(b.order.map((o: Body) => o.position), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
	assert.deepEqual(b.order.map((o: Body) => o.role), [...Array(7).fill('field'), ...Array(5).fill('waiting')]);
	assert.deepEqual(b.field, [11116, 11017, 10316, 10216, 11216, 10611, 10711]);
	assert.deepEqual(b.waiting, [10514, 10408, 10116, 10910, 10808]);
	const otis = b.order.find((o: Body) => o.identityId === 11116);
	assert.equal(otis.sinnerId, 11);
	assert.deepEqual([...otis.egoIds].sort(), [21104, 21106, 21108, 21109]);
	assert.ok(b.order.every((o: Body) => typeof o.name === 'string' && o.name.length > 0));
	assert.equal(typeof b.deployNote, 'string');
	assert.ok('snapshotId' in b);
});

test('analyze_deck(편성 #24) 는 출격 7 · 대기 5', { skip }, async () => {
	const b = await call('analyze_deck', { deckCode: CODE_24 });
	assert.equal(b.field.length, 7);
	assert.equal(b.waiting.length, 5);
	assert.ok(b.supply.length > 0);
	for (const s of b.supply) {
		assert.ok(s.tag.roster >= s.tag.field, `${s.refKind}:${s.refId} roster ≥ field`);
		assert.equal(s.tag.roster, s.tag.field + s.tag.waiting, `${s.refKind}:${s.refId} roster = field + waiting`);
		assert.ok(s.tag.field <= 7 && s.skill.field <= 7);
	}
	// 키워드 축에는 이름표가 붙는다
	const axes = b.supply.filter((s: Body) => s.refKind === 'axis');
	assert.ok(axes.length > 0);
	assert.ok(axes.every((s: Body) => typeof s.label === 'string'), '키워드 축 이름표');
});

test('analyze_deck: 두 층을 섞지 않는다 — 10104 의 진동은 skill 에만 든다', { skip }, async () => {
	const b = await call('analyze_deck', { identityIds: [10104] });
	const vib = b.supply.find((s: Body) => s.refKind === 'axis' && s.refId === 'VIBRATION');
	assert.ok(vib, '진동 행이 있다');
	assert.equal(vib.tag.field, 0);
	assert.equal(vib.skill.field, 1);
});

test('analyze_deck: deployedIds 가 순서 규칙보다 우선한다', { skip }, async () => {
	const b = await call('analyze_deck', { identityIds: [10101, 10201, 10301], deployedIds: [10301] });
	assert.deepEqual(b.field, [10301]);
	assert.deepEqual(b.waiting, [10101, 10201]);
	assert.match(b.deployNote, /deployedIds/);
});

test('E.G.O 장착이 공급에 든다: ego_equipped 게이트 축이 E.G.O 를 빼면 줄어든다', { skip }, async () => {
	const data = await engineData();
	const always = new Set(data.capabilities
		.filter((x) => x.gateKind === 'always' && x.affects !== 'skill')
		.map((x) => `${x.identityId}|${x.refKind}|${x.refId}`));
	const gated = data.capabilities.find((x) =>
		x.gateKind === 'ego_equipped' && x.affects !== 'skill' && !always.has(`${x.identityId}|${x.refKind}|${x.refId}`));
	assert.ok(gated, 'ego_equipped 게이트만으로 붙는 축이 있다');
	const id = Number(gated.identityId);
	const row = (b: Body) => b.supply.find((s: Body) => s.refKind === gated.refKind && s.refId === gated.refId);

	const without = await call('analyze_deck', { identityIds: [id] });
	const withEgo = await call('analyze_deck', { identityIds: [id], egoIds: [Number(gated.gateRef)] });
	assert.equal(row(without)?.tag.field ?? 0, 0, `E.G.O 없이 ${gated.refId} 없음`);
	assert.equal(row(withEgo)?.tag.field, 1, `E.G.O ${gated.gateRef} 장착 시 ${gated.refId} 1`);
});

test('check_gifts 는 stageNote 를 달고 켜짐 세 값만 낸다', { skip }, async () => {
	const data = await engineData();
	const giftIds = [...data.abilities.keys()].slice(0, 20).map(Number);
	const b = await call('check_gifts', { deckCode: CODE_24, giftIds });
	assert.equal(b.stageNote, STAGE_NOTE);
	assert.equal(b.field.length, 7);
	assert.equal(b.gifts.length, giftIds.length);
	for (const g of b.gifts) {
		assert.ok(['on', 'possible', 'off'].includes(g.state));
		assert.equal(g.reasons.length, g.total);
		if (g.state === 'on') assert.equal(g.certain, g.total);
		if (g.state === 'off') assert.ok(g.reasons.some((r: Body) => r.blocking && r.verdict === 'unsatisfied'), `${g.id} off 근거`);
	}
});

test('check_gifts: 판정 행이 없는 기프트는 possible + no-judgement-data', { skip }, async () => {
	const data = await engineData();
	const row = await canonical.gift.findFirst({
		where: { id: { notIn: [...data.abilities.keys()] } },
		select: { id: true },
		orderBy: { id: 'asc' },
	});
	if (!row) return; // 모든 기프트에 판정이 있으면 확인할 대상이 없다
	const b = await call('check_gifts', { identityIds: [10101], giftIds: [Number(row.id)] });
	assert.equal(b.gifts[0].state, 'possible');
	assert.equal(b.gifts[0].reason, 'no-judgement-data');
	assert.equal(b.gifts[0].grade, null);
});

test('check_gifts: 없는 기프트 id 는 isError', { skip }, async () => {
	const r = await c.callTool({ name: 'check_gifts', arguments: { identityIds: [10101], giftIds: [999999] } });
	assert.equal(r.isError, true);
	assert.match(text(r), /없는 기프트 id: 999999/);
});

test('score_packs 는 provisional 표시를 단다', { skip }, async () => {
	const b = await call('score_packs', { deckCode: CODE_24, floor: 3 });
	assert.equal(b.provisional, true);
	assert.equal(b.provisionalReason, PROVISIONAL_REASON);
	assert.equal(b.difficulty, 'hard');
	assert.equal(b.field.length, 7);
	assert.equal(b.waiting.length, 5);
	assert.ok(b.packs.length > 0);
	for (const p of b.packs) {
		assert.ok(p.topGifts.length <= 5);
		assert.match(p.siteUrl, /\/ko\/packs\//);
		assert.ok(!('icon' in p));
	}
	if (b.rankable) {
		const scores = b.packs.map((p: Body) => p.score);
		assert.deepEqual(scores, [...scores].sort((x: number, y: number) => y - x), '점수 내림차순');
	}
});

test('score_packs: topGifts 의 켜짐이 같은 덱 · 보유의 check_gifts 판정과 같다', { skip }, async () => {
	const data = await engineData();
	const held = [Number([...data.abilities.keys()][0])];
	const b = await call('score_packs', { deckCode: CODE_24, floor: 3, heldGiftIds: held });
	const tops = new Map<number, Body>();
	for (const p of b.packs) for (const g of p.topGifts) tops.set(g.id, g);
	assert.ok(tops.size > 0);
	const ids = [...tops.keys()];
	for (let i = 0; i < ids.length; i += 50) {
		const chk = await call('check_gifts', { deckCode: CODE_24, giftIds: ids.slice(i, i + 50), heldGiftIds: held });
		for (const g of chk.gifts) {
			assert.equal(tops.get(g.id)!.state, g.state, `${g.id} state`);
			assert.equal(tops.get(g.id)!.reason, g.reason, `${g.id} reason`);
		}
	}
});

test('analyze_deck: heldGiftIds 를 받고 gateNote 로 보유 게이트를 밝힌다', { skip }, async () => {
	const data = await engineData();
	const without = await call('analyze_deck', { deckCode: CODE_24 });
	assert.match(without.gateNote, /gift_held/);
	const gid = Number([...data.abilities.keys()][0]);
	const withHeld = await call('analyze_deck', { deckCode: CODE_24, heldGiftIds: [gid] });
	assert.match(withHeld.gateNote, /보유 기프트 1개/);
	const bad = await c.callTool({ name: 'analyze_deck', arguments: { deckCode: CODE_24, heldGiftIds: [999999] } });
	assert.equal(bad.isError, true);
	assert.match(text(bad), /없는 보유 기프트 id: 999999/);
});

test('512자를 넘는 덱 코드는 입력 검사에서 막힌다', { skip }, async () => {
	const r = await c.callTool({ name: 'decode_deck_code', arguments: { deckCode: 'A'.repeat(513) } });
	assert.equal(r.isError, true);
});

test('잘못된 덱 코드는 isError + 코덱 문구', { skip }, async () => {
	for (const name of ['analyze_deck', 'decode_deck_code']) {
		const r = await c.callTool({ name, arguments: { deckCode: 'not-a-code' } });
		assert.equal(r.isError, true, name);
		assert.match(text(r), /덱 코드를 풀지 못했다/, name);
	}
});

test('없는 인격 id 는 isError (축 0 을 성공으로 주지 않는다)', { skip }, async () => {
	const r = await c.callTool({ name: 'analyze_deck', arguments: { identityIds: [10199] } });
	assert.equal(r.isError, true);
	assert.match(text(r), /없는 인격 id: 10199/);
});

test('deckCode 와 identityIds 를 함께 주면 isError', { skip }, async () => {
	const r = await c.callTool({ name: 'analyze_deck', arguments: { deckCode: CODE_24, identityIds: [10101] } });
	assert.equal(r.isError, true);
});

test('출력 id 타입: 인격 · E.G.O · 기프트 id 는 number, 팩 id 는 string. 입력은 숫자 문자열도 받는다', { skip }, async () => {
	const nums = (xs: unknown[]) => xs.every((x) => typeof x === 'number');
	const dec = await call('decode_deck_code', { deckCode: CODE_24 });
	assert.ok(nums(dec.field) && nums(dec.waiting));
	assert.ok(dec.order.every((o: Body) => typeof o.identityId === 'number' && nums(o.egoIds)));

	const data = await engineData();
	const gid = [...data.abilities.keys()][0]!;
	const chk = await call('check_gifts', { identityIds: ['10101', 10201], deployedIds: ['10101'], giftIds: [gid], heldGiftIds: [gid] });
	assert.deepEqual(chk.field, [10101]);
	assert.deepEqual(chk.waiting, [10201]);
	assert.equal(chk.gifts[0].id, Number(gid));

	const sp = await call('score_packs', { deckCode: CODE_24, floor: 3 });
	assert.ok(nums(sp.field) && nums(sp.waiting));
	for (const p of sp.packs) {
		assert.equal(typeof p.id, 'string');
		assert.ok(nums(p.topGifts.map((g: Body) => g.id)));
	}
});
