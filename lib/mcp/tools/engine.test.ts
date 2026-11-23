import { test, after, before } from 'node:test';
import assert from 'node:assert/strict';
import type { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { canonical } from '@/lib/db-canonical';
import { canonicalReachable, NO_DB } from '@/src/v2/canonical/db-available';
import { connectInMemory } from '../test-client';
import { engineData } from '../axes';
import { LIVE_NOTE, PROVISIONAL_REASON, SKILL_SUPPLY_NOTE, STAGE_NOTE, STATE_NOTE } from './engine';

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
		for (const c of [s.tag, s.skill, s.gated?.tag, s.gated?.skill].filter(Boolean)) {
			assert.equal(c.roster, c.field + c.waiting, `${s.refKind}:${s.refId} roster = field + waiting`);
			assert.ok(c.field <= 7 && c.waiting <= 5);
		}
		if (s.refKind !== 'axis') assert.equal(s.skill, null);
	}
	const axes = b.supply.filter((s: Body) => s.refKind === 'axis');
	assert.ok(axes.length > 0);
	assert.ok(axes.every((s: Body) => typeof s.label === 'string'), '키워드 축 이름표');
	assert.ok(b.supply.some((s: Body) => s.refKind === 'sin'), '죄악(공명) 공급');
	assert.ok(!b.supply.some((s: Body) => s.refKind === 'resonance'), '공명은 sin 표 하나로 센다');
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

test('analyze_deck: 8–11인 편성은 deployNote 에 미대조 단서가 붙는다', { skip }, async () => {
	const ids = [10101, 10201, 10301, 10401, 10501, 10601, 10701, 10801, 10901];
	const b = await call('analyze_deck', { identityIds: ids });
	assert.match(b.deployNote, /미대조/);
});

test('E.G.O 장착이 공급에 든다: gated 몫이 E.G.O 를 빼면 0', { skip }, async () => {
	const data = await engineData();
	const gated = data.capabilities.find((x) =>
		x.gateKind === 'ego_equipped' && x.refKind === 'axis' && x.affects !== 'skill'
		&& !data.supply.axisTag.get(x.refId)?.has(x.identityId));
	assert.ok(gated, 'ego_equipped 게이트만으로 붙는 축이 있다');
	const id = Number(gated.identityId);
	const row = (b: Body) => b.supply.find((s: Body) => s.refKind === 'axis' && s.refId === gated.refId);

	const without = await call('analyze_deck', { identityIds: [id] });
	const withEgo = await call('analyze_deck', { identityIds: [id], egoIds: [Number(gated.gateRef)] });
	assert.equal(row(without)?.gated.tag.field ?? 0, 0, `E.G.O 없이 ${gated.refId} gated 0`);
	assert.equal(row(withEgo)?.gated.tag.field, 1, `E.G.O ${gated.gateRef} 장착 시 ${gated.refId} gated 1`);
	assert.equal(row(withEgo)?.tag.field ?? 0, row(without)?.tag.field ?? 0, 'tag(엔진 표)는 E.G.O 와 무관');
});

test('analyze_deck: tag + gated = score_packs 적합도가 쓰는 Profile 수', { skip }, async () => {
	const { Profile } = await import('@/lib/engine/v2/profile');
	const data = await engineData();
	const b = await call('analyze_deck', { deckCode: CODE_24 });
	const dec = await call('decode_deck_code', { deckCode: CODE_24 });
	const squad = {
		roster: dec.order.map((o: Body) => ({ identityId: String(o.identityId), egoIds: o.egoIds.map(String) })),
		field: dec.field.map(String),
	};
	const profile = new Profile(squad, data.capabilities);
	for (const s of b.supply.filter((x: Body) => x.refKind === 'axis')) {
		assert.equal(s.tag.field + s.gated.tag.field, profile.count('axis', s.refId, 'field'), s.refId);
	}
});

/**
 * 같은 덱이면 check_gifts reasons 의 have 와 analyze_deck 의 같은 칸이 같다(리뷰 R1#1).
 * 조건의 supply(tag · skill · any)와 scope 는 엔진 데이터에서 찾는다.
 */
async function assertParity(deck: Record<string, unknown>, refId: string) {
	const data = await engineData();
	const conds = new Map<string, { supply: string; scope: string; runtime: boolean }>();
	const giftIds: string[] = [];
	for (const [giftId, byOrd] of data.abilityConds) {
		for (const cs of byOrd.values()) {
			for (const cnd of cs) {
				if (cnd.refKind !== 'axis' || cnd.refId !== refId) continue;
				conds.set(`${giftId}|${cnd.ordinal}/${cnd.group}/${cnd.idx}`, cnd);
				if (!giftIds.includes(giftId)) giftIds.push(giftId);
			}
		}
	}
	const mirror = new Set((await canonical.gift.findMany({
		where: { id: { in: giftIds }, domain: 'mirror_dungeon' }, select: { id: true },
	})).map((g) => g.id));
	const ids = giftIds.filter((id) => mirror.has(id)).slice(0, 50);
	assert.ok(ids.length > 0, `${refId} 조건 기프트`);

	const a = await call('analyze_deck', deck);
	const row = a.supply.find((s: Body) => s.refKind === 'axis' && s.refId === refId)
		?? { tag: { roster: 0, field: 0, waiting: 0 }, skill: { roster: 0, field: 0, waiting: 0 } };
	const b = await call('check_gifts', { ...deck, giftIds: ids.map(Number), detail: 'full' });
	let checked = 0;
	for (const g of b.gifts) {
		for (const ab of g.abilities) {
			for (const r of ab.reasons) {
				const cnd = conds.get(`${g.id}|${r.triggerId}`);
				if (!cnd || cnd.runtime) continue;
				const scope = cnd.scope as 'roster' | 'field' | 'waiting';
				const want = cnd.supply === 'skill' ? row.skill[scope]
					: cnd.supply === 'any' ? Math.max(row.tag[scope], row.skill[scope])
					: row.tag[scope];
				assert.equal(r.have, want, `${g.id} ${r.triggerId} ${cnd.supply}/${scope}`);
				checked += 1;
			}
		}
	}
	assert.ok(checked > 0, `${refId} 대조한 조건 수`);
}

test('대조: R1 탐침 덱의 VIBRATION — check_gifts have = analyze_deck', { skip }, async () =>
	assertParity({ identityIds: [10109, 10208, 10301, 10412, 10614, 10715, 11109] }, 'VIBRATION'));

test('대조: 10110 단독 SINKING — check_gifts have = analyze_deck', { skip }, async () =>
	assertParity({ identityIds: [10110] }, 'SINKING'));

test('analyze_deck: 전투 중 상태 축(status_held)은 공급이 아니라 battleOnly', { skip }, async () => {
	const data = await engineData();
	const st = data.capabilities.find((x) => x.gateKind === 'status_held');
	assert.ok(st);
	const b = await call('analyze_deck', { identityIds: [Number(st.identityId)] });
	assert.ok(b.battleOnly.some((x: Body) => x.identityId === Number(st.identityId) && x.statusId === st.gateRef));
});

test('check_gifts 는 stageNote · stateNote 를 달고 능력 단위 상태를 낸다', { skip }, async () => {
	const data = await engineData();
	const mirror = (await canonical.gift.findMany({
		where: { id: { in: [...data.abilities.keys()] }, domain: 'mirror_dungeon' }, select: { id: true }, orderBy: { id: 'asc' }, take: 30,
	})).map((g) => Number(g.id));
	const b = await call('check_gifts', { deckCode: CODE_24, giftIds: mirror, detail: 'full' });
	assert.equal(b.stageNote, STAGE_NOTE);
	assert.equal(b.stateNote, STATE_NOTE);
	assert.equal(b.field.length, 7);
	for (const g of b.gifts) {
		assert.ok(['on', 'partial', 'possible', 'off'].includes(g.state));
		assert.equal(g.abilities.reduce((n: number, a: Body) => n + a.reasons.length, 0), g.total);
		const indep = g.abilities.filter((a: Body) => a.refines === null);
		if (g.state === 'on' || g.state === 'partial') assert.ok(indep.some((a: Body) => a.state === 'on'), `${g.id} on 독립 능력`);
		if (g.state === 'partial') assert.ok(g.abilities.some((a: Body) => a.state === 'off'), `${g.id} off 능력`);
		if (g.state === 'off') assert.ok(indep.every((a: Body) => a.state === 'off'), `${g.id} 독립 능력 전부 off`);
		for (const a of g.abilities) for (const r of a.reasons) assert.ok('label' in r);
	}
});

test('check_gifts: 9001 은 partial — 기본 효과 on, 분노 공명 효과 off (편성 #24)', { skip }, async () => {
	const b = await call('check_gifts', { deckCode: CODE_24, giftIds: [9001], detail: 'full' });
	const g = b.gifts[0];
	assert.equal(g.state, 'partial');
	assert.deepEqual(g.abilities.map((a: Body) => a.state), ['on', 'off']);
	assert.equal(g.abilities[1].reasons[0].refKind, 'resonance');
	assert.equal(g.abilities[1].reasons[0].label, '분노');
});

test('check_gifts: 능력이 전부 무조건인 기프트 표본은 on', { skip }, async () => {
	const data = await engineData();
	const all = [...data.abilities].filter(([, abs]) => abs.length > 0 && abs.every((a) => a.unconditional)).map(([id]) => id);
	const mirror = (await canonical.gift.findMany({
		where: { id: { in: all }, domain: 'mirror_dungeon' }, select: { id: true }, orderBy: { id: 'asc' }, take: 10,
	})).map((g) => Number(g.id));
	assert.ok(mirror.length > 0);
	const b = await call('check_gifts', { identityIds: [10101], giftIds: mirror });
	assert.ok(b.gifts.every((g: Body) => g.state === 'on'), JSON.stringify(b.gifts.map((g: Body) => [g.id, g.state])));
});

test('check_gifts: 판정 행이 없는 기프트는 possible + no-judgement-data', { skip }, async (t) => {
	const data = await engineData();
	const row = await canonical.gift.findFirst({
		where: { id: { notIn: [...data.abilities.keys()] }, domain: 'mirror_dungeon' },
		select: { id: true },
		orderBy: { id: 'asc' },
	});
	if (!row) return t.skip('판정 행이 없는 거울 던전 기프트가 없다 — 확인할 대상 없음');
	const b = await call('check_gifts', { identityIds: [10101], giftIds: [Number(row.id)], detail: 'full' });
	assert.equal(b.gifts[0].state, 'possible');
	assert.equal(b.gifts[0].reason, 'no-judgement-data');
	assert.equal(b.gifts[0].grade, null);
});

test('하향: 10110 단독의 9041 SINKING(스킬) 미충족은 off 가 아니라 possible + skill-supply-incomplete', { skip }, async () => {
	const b = await call('check_gifts', { identityIds: [10110], giftIds: [9041], detail: 'full' });
	const g = b.gifts[0];
	assert.notEqual(g.state, 'off');
	assert.equal(g.abilities[0].state, 'possible');
	assert.equal(g.abilities[0].reason, 'skill-supply-incomplete');
	assert.equal(g.abilities[0].reasons[0].have, 0, '엔진 have 는 그대로 싣는다');
	assert.match(b.stateNote, /코인 토큰 기준/);
});

test('하향: 10110 + E.G.O 20109 의 9112 VIBRATION 미충족은 possible + ego-not-judged, E.G.O 없으면 off', { skip }, async () => {
	const withEgo = await call('check_gifts', { identityIds: [10110], egoIds: [20109], giftIds: [9112] });
	assert.equal(withEgo.gifts[0].state, 'possible');
	assert.equal(withEgo.gifts[0].reason, 'ego-not-judged');
	assert.equal(withEgo.gifts[0].abilities[0].reason, 'ego-not-judged');
	const without = await call('check_gifts', { identityIds: [10110], giftIds: [9112] });
	assert.equal(without.gifts[0].state, 'off');
	const a = await call('analyze_deck', { identityIds: [10110], egoIds: [20109] });
	const vib = a.supply.find((s: Body) => s.refKind === 'axis' && s.refId === 'VIBRATION');
	assert.equal(vib.gated.skill.field, 1, 'gated.skill 에 E.G.O 몫');
});

test('하향 상한: 편성 #24 의 9165(진동 have 2 · need 5) · 9802 는 off 그대로, #24 전체 하향 0건', { skip }, async () => {
	const b = await call('check_gifts', { deckCode: CODE_24, giftIds: [9165, 9802], detail: 'full' });
	for (const g of b.gifts) {
		assert.equal(g.state, 'off', `${g.id}`);
		assert.ok(g.abilities.every((a: Body) => a.reason === undefined), `${g.id} 하향 없음`);
	}
	const ids = (await canonical.gift.findMany({ where: { domain: 'mirror_dungeon' }, select: { id: true }, orderBy: { id: 'asc' } })).map((g) => Number(g.id));
	let downgraded = 0;
	for (let i = 0; i < ids.length; i += 50) {
		const r = await call('check_gifts', { deckCode: CODE_24, giftIds: ids.slice(i, i + 50), detail: 'full' });
		downgraded += r.gifts.reduce((n: number, g: Body) => n + g.abilities.filter((a: Body) => a.reason !== undefined).length, 0);
	}
	assert.equal(downgraded, 0);
});

test('과대 공급: R1 탐침 덱(10109 · 11109 LACERATION 스킬 제한 미적용)에서 skill-supply-overcount 가 난다', { skip }, async () => {
	const deck = { identityIds: [10109, 10208, 10301, 10412, 10614, 10715, 11109] };
	const b = await call('check_gifts', { ...deck, giftIds: [9090, 9161, 9162], detail: 'full' });
	for (const g of b.gifts) {
		assert.equal(g.state, 'possible', `${g.id}`);
		assert.equal(g.reason, 'skill-supply-overcount', `${g.id}`);
		const doubted = g.abilities.filter((a: Body) => a.reason === 'skill-supply-overcount');
		assert.ok(doubted.length > 0);
		assert.ok(doubted.every((a: Body) => a.reasons.some((x: Body) => x.refId === 'LACERATION' && x.verdict === 'satisfied')));
	}
});

test('check_gifts brief: 50개 < 20KB, on 능력은 근거 생략 · 나머지는 충족 안 된 근거만', { skip }, async () => {
	const ids = (await canonical.gift.findMany({ where: { domain: 'mirror_dungeon' }, select: { id: true }, take: 50, orderBy: { id: 'asc' } })).map((g) => Number(g.id));
	const r = await c.callTool({ name: 'check_gifts', arguments: { deckCode: CODE_24, giftIds: ids } });
	assert.notEqual(r.isError, true);
	const size = JSON.stringify(r.structuredContent).length;
	assert.ok(size < 20_000, `brief structuredContent ${size}B`);
	assert.ok(text(r).length <= 20_000, `brief text ${text(r).length}B`);
	const full = await call('check_gifts', { deckCode: CODE_24, giftIds: ids, detail: 'full' });
	const brief = r.structuredContent as Body;
	brief.gifts.forEach((g: Body, i: number) => {
		assert.equal(g.state, full.gifts[i].state, '상태는 detail 과 무관');
		assert.ok(!('total' in g) && !('grade' in g), 'brief 에는 고정 칸이 없다');
		for (const a of g.abilities) {
			if (a.state !== 'possible') assert.deepEqual(Object.keys(a).sort(), ['ordinal', 'state']);
			else assert.ok(a.reasons.every((x: Body) => x.verdict !== 'satisfied' || a.reason === 'skill-supply-overcount'));
		}
	});
	assert.ok(SKILL_SUPPLY_NOTE.length > 0);
});

test('check_gifts: 없는 기프트 id · 스토리 던전 기프트는 isError', { skip }, async () => {
	const r = await c.callTool({ name: 'check_gifts', arguments: { identityIds: [10101], giftIds: [999999] } });
	assert.equal(r.isError, true);
	assert.match(text(r), /없는 기프트 id: 999999/);
	const story = await canonical.gift.findMany({ where: { domain: 'story_dungeon' }, select: { id: true }, take: 2, orderBy: { id: 'asc' } });
	const s = await c.callTool({ name: 'check_gifts', arguments: { identityIds: [10101], giftIds: [9001, ...story.map((g) => Number(g.id))] } });
	assert.equal(s.isError, true);
	assert.match(text(s), new RegExp(`스토리 던전\\): ${story.map((g) => g.id).join(', ')}`));
});

test('score_packs 는 provisional 표시를 단다', { skip }, async () => {
	const b = await call('score_packs', { deckCode: CODE_24, floor: 3 });
	assert.equal(b.provisional, true);
	assert.equal(b.provisionalReason, PROVISIONAL_REASON);
	assert.equal(b.liveNote, LIVE_NOTE);
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
		const top = scores[0];
		b.packs.forEach((p: Body, i: number) => {
			for (const k of ['score', 'fit', 'live', 'fusion']) assert.equal(p[k], Math.round(p[k] * 1000) / 1000, `${p.id} ${k} 셋째 자리`);
			if (i > 0) assert.equal(p.nearTie, top - p.score <= 0.01 + 1e-9, `${p.id} nearTie`);
		});
	}
	for (const p of b.packs) {
		const ranks = p.topGifts.map((g: Body) => ['on', 'partial', 'possible', 'off'].indexOf(g.state));
		assert.deepEqual(ranks, [...ranks].sort((x: number, y: number) => x - y), `${p.id} topGifts 켜짐 순`);
	}
});

test('score_packs: 난이도의 유효 층 밖이면 isError (normal 8층)', { skip }, async () => {
	const r = await c.callTool({ name: 'score_packs', arguments: { deckCode: CODE_24, floor: 8, difficulty: 'normal' } });
	assert.equal(r.isError, true);
	assert.match(text(r), /normal 난이도에 8층이 없다 — 유효 층: 1–5층/);
});

test('score_packs: topGifts 의 켜짐이 같은 덱 · 보유의 check_gifts 판정과 같다', { skip }, async () => {
	const held = [9001];
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
	const heldGates = data.capabilities.filter((x) => x.gateKind === 'gift_held').length;
	const without = await call('analyze_deck', { deckCode: CODE_24 });
	assert.match(without.gateNote, /gift_held/);
	const withHeld = await call('analyze_deck', { deckCode: CODE_24, heldGiftIds: [9001] });
	if (heldGates === 0) {
		assert.match(withHeld.gateNote, /0개/);
		assert.deepEqual(withHeld.supply, without.supply, '게이트 행이 없으면 보유가 공급을 안 바꾼다');
	} else assert.match(withHeld.gateNote, /보유 기프트 1개/);
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

	const gid = '9001';
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
