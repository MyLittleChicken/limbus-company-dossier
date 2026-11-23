import { test, after, before } from 'node:test';
import assert from 'node:assert/strict';
import type { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { canonical } from '../../db-canonical';
import { canonicalReachable, NO_DB } from '../../../src/v2/canonical/db-available';
import {
	listAllGifts,
	listCursedGiftIds,
	listGifts,
	listGiftsUnpaged,
	type GiftFilter,
} from '../../queries/canonical/gifts';
import { listPacks } from '../../queries/canonical/packs';
import { listStatuses, listStatusesUnpaged } from '../../queries/canonical/reference';
import { floorBounds } from '../../queries/canonical/floor-range';
import { rangeCovers } from '../../queries/canonical/recommend';
import { connectInMemory } from '../test-client';
import { encodeCursor } from '../page';
import { filterByFloor } from './dungeon';

const reachable = await canonicalReachable(canonical);
const DB = { skip: reachable ? false : NO_DB };

let c: Client;
before(async () => { c = await connectInMemory(); });
after(async () => {
	await c?.close();
	await canonical.$disconnect();
});

const call = async (name: string, args: Record<string, unknown> = {}) => c.callTool({ name, arguments: args });
const sc = (r: Awaited<ReturnType<typeof call>>) => r.structuredContent as any;
const textOf = (r: Awaited<ReturnType<typeof call>>) => (r.content as Array<{ text: string }>)[0]?.text ?? '';
const NO_IMAGE = /\.(png|webp|jpg|jpeg|gif|svg)\b/;

test('던전 도구 7종이 등록되고 읽기 전용이다', async () => {
	const tools = (await c.listTools()).tools;
	const names = ['list_gifts', 'get_gift', 'list_packs', 'get_pack', 'list_floor_packs', 'get_dungeon', 'list_statuses'];
	for (const n of names) {
		const t = tools.find((x) => x.name === n);
		assert.ok(t, `${n} 등록`);
		assert.equal(t.annotations?.readOnlyHint, true);
		assert.ok(t.outputSchema, `${n} outputSchema`);
	}
});

test('get_gift 는 단계별 문구와 등장 팩 id 를 준다', DB, async () => {
	const all = await listGifts('ko', { tiers: [], keywords: [], enhanceable: true, page: 1 });
	const id = all.items[0]?.id;
	assert.ok(id !== undefined, 'enhanceable 기프트가 있다');
	const r = await call('get_gift', { id });
	assert.notEqual(r.isError, true, textOf(r));
	const g = sc(r);
	assert.equal(typeof g.snapshotId, 'string');
	assert.ok(g.stages.length >= 2);
	assert.deepEqual(g.stages.map((s: { label: string }) => s.label).slice(0, 2), ['0', '+']);
	assert.ok(Array.isArray(g.packs));
	assert.ok(Array.isArray(g.exclusivePacks));
	assert.match(g.siteUrl, new RegExp(`/ko/gifts/${id}$`));
	assert.doesNotMatch(JSON.stringify(g), NO_IMAGE);
	assert.ok(!('icon' in g));
});

test('get_gift 의 팩 id 로 get_pack 을 부를 수 있다 (엮임)', DB, async () => {
	const rows = sc(await call('list_gifts', { pool: 'exclusive' })).items;
	const g = sc(await call('get_gift', { id: rows[0].id }));
	const packId = g.exclusivePacks[0]?.id ?? g.packs[0]?.id;
	assert.equal(typeof packId, 'string');
	const p = await call('get_pack', { id: packId });
	assert.notEqual(p.isError, true, textOf(p));
});

test('get_pack 의 기프트 id 로 get_gift 를 부를 수 있다 (엮임)', DB, async () => {
	const packs = sc(await call('list_packs')).items;
	const withGifts = packs.find((p: { giftCount: number }) => p.giftCount > 0);
	const r = await call('get_pack', { id: withGifts.id });
	assert.notEqual(r.isError, true, textOf(r));
	const p = sc(r);
	assert.ok(p.gifts.length > 0);
	assert.ok(Array.isArray(p.floors));
	assert.ok(Array.isArray(p.distribution.tier));
	assert.match(p.siteUrl, new RegExp(`/ko/packs/${p.id}$`));
	assert.doesNotMatch(JSON.stringify(p), NO_IMAGE);
	assert.ok(!('sprite' in p) && !('bossIcon' in p) && !('icon' in p));
	const g = await call('get_gift', { id: p.gifts[0].id });
	assert.notEqual(g.isError, true, textOf(g));
});

test('list_gifts 개수가 화면 목록과 같다 (거울 던전 범위)', DB, async () => {
	const r = sc(await call('list_gifts'));
	assert.equal(r.total, (await listAllGifts('ko')).length);
	assert.equal(r.items.length, 50);
	assert.equal(typeof r.nextCursor, 'string');
	assert.doesNotMatch(JSON.stringify(r), NO_IMAGE);
});

test('list_gifts 커서를 끝까지 이으면 전부 한 번씩 나온다', DB, async () => {
	const seen: number[] = [];
	let cursor: string | undefined;
	let total = 0;
	for (let i = 0; i < 50; i++) {
		const r = sc(await call('list_gifts', cursor ? { cursor } : {}));
		total = r.total;
		seen.push(...r.items.map((x: { id: number }) => x.id));
		if (!r.nextCursor) break;
		cursor = r.nextCursor;
	}
	assert.equal(seen.length, total);
	assert.equal(new Set(seen).size, total);
	assert.deepEqual(new Set(seen), new Set((await listAllGifts('ko')).map((g) => g.id)));
});

test('list_gifts 필터는 화면 질의와 같은 수를 준다 · 다른 질의의 커서는 isError', DB, async () => {
	const ex = sc(await call('list_gifts', { tiers: ['EX'] }));
	const screen = await listGifts('ko', { tiers: ['EX'], keywords: [], page: 1 });
	assert.equal(ex.total, screen.total);
	assert.ok(ex.items.every((g: { tier: string }) => g.tier === 'EX'));

	const first = sc(await call('list_gifts'));
	const bad = await call('list_gifts', { tiers: ['1'], cursor: first.nextCursor });
	assert.equal(bad.isError, true);
	const junk = await call('list_gifts', { cursor: 'not-a-cursor' });
	assert.equal(junk.isError, true);
});

/** 스냅샷에 그 기프트가 있는지 DB 로 먼저 본다 — 없을 때만 skip, 도구 isError 는 실패다. */
const giftsExist = async (...ids: number[]) =>
	(await canonical.gift.count({ where: { id: { in: ids.map(String) } } })) === ids.length;

test('저주·축복 기프트는 무리를 준다', DB, async (t) => {
	if (!(await giftsExist(9227))) { t.skip('9227 이 이 스냅샷에 없다'); return; }
	const r = await call('get_gift', { id: 9227 });
	assert.notEqual(r.isError, true, textOf(r));
	const g = sc(r);
	assert.ok(g.curseBlessing);
	assert.ok(g.curseBlessing.curseIds.includes(9227));
	const normal = sc(await call('get_gift', { id: sc(await call('list_gifts', { pool: 'exclusive' })).items[0].id }));
	assert.equal(normal.curseBlessing, null);
});

test('없는 id 는 isError', DB, async () => {
	const g = await call('get_gift', { id: 999999 });
	assert.equal(g.isError, true);
	assert.match(textOf(g), /없는 id/);
	const p = await call('get_pack', { id: 'no-such-pack' });
	assert.equal(p.isError, true);
	assert.match(textOf(p), /없는 id/);
});

test('list_packs 는 화면 목록 수와 같고 q 로 좁힌다', DB, async () => {
	const r = sc(await call('list_packs'));
	assert.equal(r.total, (await listPacks('ko', {})).length);
	const name = r.items[0].name as string;
	const q = sc(await call('list_packs', { q: name }));
	assert.ok(q.total >= 1 && q.total < r.total);
	assert.ok(q.items.some((p: { id: string }) => p.id === r.items[0].id));
});

test('list_floor_packs 는 층 · 난이도로 거른다', DB, async () => {
	const all = sc(await call('list_floor_packs'));
	assert.ok(all.groups.length > 0);
	const r = sc(await call('list_floor_packs', { floor: 7, difficulty: 'hard' }));
	assert.equal(r.groups.length, 1);
	assert.equal(r.groups[0].difficulty, 'hard');
	assert.ok(r.groups[0].floorFrom <= 7 && 7 <= r.groups[0].floorTo);
	assert.ok(r.groups[0].packs.length > 0);
	const p = await call('get_pack', { id: r.groups[0].packs[0].id });
	assert.notEqual(p.isError, true);
	const normal = sc(await call('list_floor_packs', { difficulty: 'normal' }));
	assert.ok(normal.groups.every((g: { difficulty: string }) => g.difficulty === 'normal'));
});

test('get_dungeon 은 층 구조와 은총을 준다', DB, async () => {
	const r = await call('get_dungeon', { locale: 'en' });
	assert.notEqual(r.isError, true, textOf(r));
	const d = sc(r);
	assert.ok(d.totalFloors >= d.baseFloors);
	assert.ok(d.graces.length > 0);
	assert.ok(Array.isArray(d.graces[0].descs));
});

test('list_statuses 는 화면 질의 수와 같고 buffTypes · 커서가 돈다', DB, async () => {
	const r = sc(await call('list_statuses'));
	assert.equal(r.total, (await listStatuses('ko', { buffTypes: [], page: 1 })).total);
	assert.equal(r.items.length, Math.min(50, r.total));
	const neg = sc(await call('list_statuses', { buffTypes: ['Negative'] }));
	assert.ok(neg.total < r.total);
	assert.ok(neg.items.every((s: { buffType: string }) => s.buffType === 'Negative'));
	assert.equal(typeof neg.nextCursor, 'string', 'Negative 가 50개를 넘어 다음 쪽이 있다');
	const next = sc(await call('list_statuses', { buffTypes: ['Negative'], cursor: neg.nextCursor }));
	assert.notEqual(next.items[0].id, neg.items[0].id);
});

// ── 재작업 시험 ──

test('floorBounds: 1 · a-b 만 읽고 그 밖은 null', () => {
	assert.deepEqual(floorBounds('1'), { floorFrom: 1, floorTo: 1 });
	assert.deepEqual(floorBounds('6-10'), { floorFrom: 6, floorTo: 10 });
	assert.deepEqual(floorBounds('11-15'), { floorFrom: 11, floorTo: 15 });
	assert.deepEqual(floorBounds('B1'), { floorFrom: null, floorTo: null });
	assert.deepEqual(floorBounds('6~10'), { floorFrom: null, floorTo: null });
	assert.deepEqual(floorBounds(''), { floorFrom: null, floorTo: null });
});

test('list_floor_packs: 표기를 다 읽으면 note 는 null, 구간은 빠지지 않는다', DB, async () => {
	const all = sc(await call('list_floor_packs'));
	assert.equal(all.note, null);
	const withFloor = sc(await call('list_floor_packs', { floor: 1 }));
	assert.equal(withFloor.note, null);
	assert.ok(all.groups.every((g: { floorFrom: number | null }) => g.floorFrom !== null));
});

test('listGiftsUnpaged 는 화면 listGifts 쪽들과 결과 집합 · 순서가 같다', DB, async () => {
	const filters: Array<Omit<GiftFilter, 'page'>> = [
		{ tiers: [], keywords: [] },
		{ tiers: ['EX', '3'], keywords: [] },
		{ tiers: [], keywords: ['Combustion', 'none'] },
		{ tiers: [], keywords: [], enhanceable: true, hardOnly: false },
		{ tiers: [], keywords: [], pool: 'general' },
		{ q: '화상', tiers: [], keywords: [] },
	];
	for (const f of filters) {
		const first = await listGifts('ko', { ...f, page: 1 });
		const pages = [first];
		for (let p = 2; p <= first.pageCount; p++) pages.push(await listGifts('ko', { ...f, page: p }));
		const paged = pages.flatMap((r) => r.items);
		const unpaged = await listGiftsUnpaged('ko', f);
		assert.equal(unpaged.length, first.total, JSON.stringify(f));
		assert.deepEqual(unpaged, paged, JSON.stringify(f));
	}
});

test('list_gifts 커서는 데이터 판(dataVersion)에 묶인다 — 다른 판의 커서는 isError', DB, async () => {
	const { dataVersion } = sc(await call('list_gifts'));
	assert.equal(typeof dataVersion, 'string');
	const scope = (v: string) => JSON.stringify({ tool: 'list_gifts', locale: 'ko', tiers: [], keywords: [], dataVersion: v });
	const good = await call('list_gifts', { cursor: encodeCursor(50, scope(dataVersion)) });
	assert.notEqual(good.isError, true, textOf(good));
	assert.equal(sc(good).items.length, 50);
	const stale = await call('list_gifts', { cursor: encodeCursor(50, scope('1999-01-01.oldhash0')) });
	assert.equal(stale.isError, true);
	assert.match(textOf(stale), /다른 질의/);
});

test('keyword 는 { id, name, fellBack, axisRef } 이다 (list_gifts · get_gift)', DB, async () => {
	const rows = sc(await call('list_gifts', { keywords: ['Combustion'] })).items;
	assert.ok(rows.length > 0);
	for (const g of rows) {
		assert.equal(g.keyword.id, 'Combustion');
		assert.equal(typeof g.keyword.name, 'string');
		assert.equal(typeof g.keyword.fellBack, 'boolean');
		assert.equal(g.keyword.axisRef, 'axis:COMBUSTION');
	}
	const g = sc(await call('get_gift', { id: rows[0].id, locale: 'en' }));
	assert.equal(g.keyword.id, 'Combustion');
	assert.equal(g.keyword.name, 'Burn');
	assert.equal(g.keyword.axisRef, 'axis:COMBUSTION');
	const slash = sc(await call('list_gifts', { keywords: ['Slash'] })).items[0];
	assert.equal(slash.keyword.axisRef, 'attack_type:slash');
	const none = sc(await call('list_gifts', { keywords: ['none'] })).items[0];
	assert.equal(none.keyword.axisRef, null);
});

test('list_gifts keywords: 대소문자 · axisRef · ko/en 이름을 같은 값으로 받는다', DB, async () => {
	const total = async (k: string) => {
		const r = await call('list_gifts', { keywords: [k] });
		assert.notEqual(r.isError, true, `${k}: ${textOf(r)}`);
		return sc(r).total;
	};
	const base = await total('Combustion');
	assert.ok(base > 0);
	for (const k of ['combustion', 'COMBUSTION', 'axis:COMBUSTION', 'axis:combustion', '화상', 'Burn', 'burn', 'axis:BURN', ' Combustion ']) {
		assert.equal(await total(k), base, k);
	}
	assert.equal(await total('attack_type:pierce'), await total('Penetrate'));
	assert.equal(await total('Pierce'), await total('Penetrate'));
	assert.equal(await total('범용'), await total('none'));
	assert.equal(await total('None'), await total('none'));
	assert.equal(await total('Keywordless'), await total('none'));
	// 같은 뜻의 다른 표기는 같은 커서 범위다
	const first = sc(await call('list_gifts', { keywords: ['Combustion', 'none'] }));
	if (first.nextCursor) {
		const next = await call('list_gifts', { keywords: ['none', '화상'], cursor: first.nextCursor });
		assert.notEqual(next.isError, true, textOf(next));
	}
});

test('list_gifts keywords: 모르는 값은 isError + 받는 값 목록', DB, async () => {
	for (const k of ['nope', 'sin:wrath', 'axis:BULLET_X']) {
		const r = await call('list_gifts', { keywords: [k] });
		assert.equal(r.isError, true, k);
		assert.match(textOf(r), /모르는 키워드/);
		assert.match(textOf(r), /Combustion\(axis:COMBUSTION · 화상 · Burn\)/);
		assert.match(textOf(r), /'none'/);
	}
	const tooMany = await call('list_gifts', { keywords: Array.from({ length: 21 }, () => 'Combustion') });
	assert.equal(tooMany.isError, true);
	const badTier = await call('list_gifts', { tiers: ['6'] });
	assert.equal(badTier.isError, true);
});

test('get_pack: 풀은 전부 · 최소 필드 · giftCount · 키워드 분포 합이 맞다', DB, async () => {
	const packs = sc(await call('list_packs')).items;
	const big = packs.reduce((a: { giftCount: number }, b: { giftCount: number }) => (b.giftCount > a.giftCount ? b : a));
	const p = sc(await call('get_pack', { id: big.id }));
	assert.equal(p.giftCount, big.giftCount);
	assert.equal(p.gifts.length, p.giftCount);
	assert.equal(p.exclusiveGifts.length, p.exclusiveGiftCount);
	assert.deepEqual(Object.keys(p.gifts[0]).sort(), ['fellBack', 'id', 'keywordId', 'name', 'tier']);
	const sum = (xs: Array<{ count: number }>) => xs.reduce((n, x) => n + x.count, 0);
	assert.equal(sum(p.distribution.keyword), p.giftCount);
	assert.equal(sum(p.distribution.tier), p.giftCount);
	const ids = new Set(p.gifts.map((g: { keywordId: string | null }) => g.keywordId));
	assert.equal(p.distribution.keyword.length, ids.size);
	for (const d of p.distribution.keyword) {
		if (d.keyword) {
			assert.ok(ids.has(d.keyword.id));
			assert.equal(typeof d.keyword.fellBack, 'boolean');
			assert.ok('axisRef' in d.keyword);
			const n = p.gifts.filter((g: { keywordId: string | null }) => g.keywordId === d.keyword.id).length;
			assert.equal(d.count, n);
		}
	}
});

test('id 형식: 기프트 id 는 number · 팩 id 는 string 으로 나오고, 입력은 숫자 문자열도 받는다', DB, async () => {
	const row = sc(await call('list_gifts', { pool: 'exclusive' })).items[0];
	assert.equal(typeof row.id, 'number');
	const g = sc(await call('get_gift', { id: String(row.id) }));
	assert.equal(g.id, row.id);
	const packId = g.exclusivePacks[0].id;
	assert.equal(typeof packId, 'string');
	if (/^\d+$/.test(packId)) {
		const p = sc(await call('get_pack', { id: Number(packId) }));
		assert.equal(p.id, packId);
		assert.equal(typeof p.gifts[0].id, 'number');
	}
	const bad = await call('get_gift', { id: 'abc' });
	assert.equal(bad.isError, true);
});

test('저주 · 축복: 저주는 확정, 축복은 inferred, 짝은 id + 1 추정, 합은 listCursedGiftIds 와 같다', DB, async (t) => {
	if (!(await giftsExist(9227, 9228))) { t.skip('9227 · 9228 이 이 스냅샷에 없다'); return; }
	const curse = await call('get_gift', { id: 9227 });
	const bless = await call('get_gift', { id: 9228 });
	assert.notEqual(curse.isError, true, textOf(curse));
	assert.notEqual(bless.isError, true, textOf(bless));
	const c1 = sc(curse).curseBlessing;
	const b1 = sc(bless).curseBlessing;
	assert.equal(c1.role, 'curse');
	assert.equal(c1.inferred, false);
	assert.equal(b1.role, 'blessing');
	assert.equal(b1.inferred, true);
	assert.match(b1.note, /id \+ 1/);
	assert.deepEqual(c1.pairGuess, { curseId: 9227, blessingId: 9228, inferred: true });
	assert.deepEqual(b1.pairGuess, { curseId: 9227, blessingId: 9228, inferred: true });
	assert.deepEqual(new Set([...c1.curseIds, ...c1.blessingIds]), await listCursedGiftIds());
});

test('filterByFloor: 못 읽은 구간은 floor 필터에서 빼고 note 에 수를 적는다 · floor 없으면 그대로', () => {
	const groups = [
		{ difficulty: 'hard', range: '6-10', ...floorBounds('6-10') },
		{ difficulty: 'hard', range: 'B1', ...floorBounds('B1') },
		{ difficulty: 'hard', range: '?', ...floorBounds('?') },
	];
	const all = filterByFloor(groups, undefined);
	assert.equal(all.groups.length, 3);
	assert.equal(all.note, null);
	const r = filterByFloor(groups, 7);
	assert.deepEqual(r.groups.map((g) => g.range), ['6-10']);
	assert.match(r.note ?? '', /2개/);
	assert.match(r.note ?? '', /'B1'/);
	assert.equal(filterByFloor(groups.slice(0, 1), 7).note, null);
});

test('floorBounds 와 추천 rangeCovers 는 비정상 표기까지 같은 결과다', () => {
	const ranges = ['1', '5', '6-10', '11-15', ' 6 - 10 ', '1-', '-3', '', 'B1', '6~10', '1-5-7', 'boss', '10-6'];
	for (const range of ranges) {
		for (let floor = 0; floor <= 16; floor++) {
			const viaBounds = filterByFloor([{ difficulty: 'hard', range, ...floorBounds(range) }], floor).groups.length === 1;
			assert.equal(rangeCovers(range, floor), viaBounds, `'${range}' @ ${floor}`);
		}
	}
	assert.deepEqual(floorBounds('1-'), { floorFrom: null, floorTo: null });
	assert.equal(rangeCovers('1-', 1), false);
});

test('listStatusesUnpaged 는 화면 listStatuses 쪽들과 결과 집합 · 순서가 같다', DB, async () => {
	const filters = [
		{ buffTypes: [] as string[] },
		{ buffTypes: ['Negative'] },
		{ q: 'e', buffTypes: [] as string[] },
		{ q: '화상', buffTypes: ['Negative', 'Positive'] },
		{ q: 'ㅎㅅ', buffTypes: [] as string[] },
	];
	for (const f of filters) {
		const first = await listStatuses('ko', { ...f, page: 1 });
		const pages = [first];
		for (let p = 2; p <= first.pageCount; p++) pages.push(await listStatuses('ko', { ...f, page: p }));
		const unpaged = await listStatusesUnpaged('ko', f);
		assert.equal(unpaged.length, first.total, JSON.stringify(f));
		assert.deepEqual(unpaged, pages.flatMap((r) => r.items), JSON.stringify(f));
	}
});

/* 상태 말뭉치가 행별 검색 열쇠를 미리 갖는다(reference.ts statusCorpus). 질의마다 자모를 다시 풀지 않는다. */
test('list_statuses q:"e" 는 데운 뒤 10ms 안쪽이다', DB, async () => {
	await call('list_statuses', { q: 'e' });
	const runs: number[] = [];
	for (let i = 0; i < 5; i++) {
		const t0 = performance.now();
		const r = await call('list_statuses', { q: 'e' });
		runs.push(performance.now() - t0);
		assert.notEqual(r.isError, true);
	}
	const median = runs.sort((a, b) => a - b)[2] ?? Infinity;
	assert.ok(median < 10, `median ${median.toFixed(1)}ms`);
});

test('list_statuses: 동시 20회도 한 번씩 다시 풀지 않는다 (합계 200ms 안쪽)', DB, async () => {
	await call('list_statuses', { q: 'e' });
	const t0 = performance.now();
	const rs = await Promise.all(Array.from({ length: 20 }, () => call('list_statuses', { q: 'e' })));
	const ms = performance.now() - t0;
	assert.ok(rs.every((r) => r.isError !== true));
	assert.ok(ms < 200, `${ms.toFixed(0)}ms`);
});
