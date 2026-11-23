import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { canonical } from '../../db-canonical';
import { canonicalReachable, NO_DB } from '../../../src/v2/canonical/db-available';
import { connectInMemory } from '../test-client';
import { normalizeAxisRef } from './catalog';

const reachable = await canonicalReachable(canonical);
after(async () => { await canonical.$disconnect(); });
const db = { skip: reachable ? false : NO_DB };

type Sc = Record<string, any>;
const client = reachable ? await connectInMemory() : null;
after(async () => { await client?.close(); });

async function call(name: string, args: Record<string, unknown> = {}) {
	const r = await client!.callTool({ name, arguments: args });
	return { r, sc: r.structuredContent as Sc };
}

/** 응답 안의 모든 키 이름(재귀). */
function keysOf(value: unknown, out = new Set<string>()): Set<string> {
	if (Array.isArray(value)) value.forEach((v) => keysOf(v, out));
	else if (value && typeof value === 'object')
		for (const [k, v] of Object.entries(value)) { out.add(k); keysOf(v, out); }
	return out;
}
const MEDIA = ['image', 'images', 'icon', 'icons', 'sprite', 'art', 'href', 'frame', 'rarityIcon', 'rankIcon', 'iconKey'];
function assertNoMedia(sc: Sc) {
	const keys = keysOf(sc);
	for (const k of MEDIA) assert.ok(!keys.has(k), `응답에 화면용 키 ${k} 가 남았다`);
	assert.doesNotMatch(JSON.stringify(sc), /\.(png|webp|jpg|jpeg|gif|svg)\b/);
}

test('normalizeAxisRef: 접두어는 소문자, 값은 종류별 대소문자로', () => {
	assert.equal(normalizeAxisRef('VIBRATION'), 'axis:VIBRATION');
	assert.equal(normalizeAxisRef('Vibration'), 'axis:VIBRATION');
	assert.equal(normalizeAxisRef(' axis:Vibration '), 'axis:VIBRATION');
	assert.equal(normalizeAxisRef('sin:gluttony'), 'sin:gluttony');
	assert.equal(normalizeAxisRef('association:ATL'), 'association:ATL');
	assert.equal(normalizeAxisRef('sin:Gluttony'), 'sin:gluttony');
	assert.equal(normalizeAxisRef('SIN:gluttony'), 'sin:gluttony');
	assert.equal(normalizeAxisRef('association:atl'), 'association:ATL');
	assert.equal(normalizeAxisRef('Attack_Type:Blunt'), 'attack_type:blunt');
});

test('조회 도구 6개가 읽기 전용으로 등록된다', db, async () => {
	const { tools } = await client!.listTools();
	for (const name of ['search', 'list_identities', 'get_identity', 'list_egos', 'get_ego', 'list_vocab']) {
		const t = tools.find((x) => x.name === name);
		assert.ok(t, `${name} 이 없다`);
		assert.equal(t.annotations?.readOnlyHint, true);
		assert.ok(t.outputSchema, `${name} 에 outputSchema 가 없다`);
	}
});

test('10104 는 진동 tag 필터에 없고 skill 필터에 있다', db, async () => {
	const ids = async (layer: string, keyword = 'VIBRATION') => {
		const out: number[] = [];
		let cursor: string | undefined;
		do {
			const { r, sc } = await call('list_identities', { keyword, axisLayer: layer, ...(cursor ? { cursor } : {}) });
			assert.ok(!r.isError);
			out.push(...sc.items.map((i: Sc) => i.id));
			cursor = sc.nextCursor ?? undefined;
		} while (cursor);
		return out;
	};
	assert.ok(!(await ids('tag')).includes(10104));
	assert.ok((await ids('skill')).includes(10104));
	// 접두어 꼴도 같다
	assert.deepEqual(await ids('skill', 'axis:VIBRATION'), await ids('skill'));

	const { sc } = await call('list_identities', { sinnerId: 1, keyword: 'VIBRATION', axisLayer: 'skill' });
	const row = sc.items.find((i: Sc) => i.id === 10104);
	assert.ok(row.axes.skill.includes('axis:VIBRATION'));
	assert.ok(!row.axes.tag.includes('axis:VIBRATION'));
	assert.ok(row.axes.tag.every((v: string) => v.startsWith('axis:')), '목록 행 axes 는 키워드 축만');
});

test('list_identities 필터: 수감자 · 성급 · 죄악', db, async () => {
	const { sc } = await call('list_identities', { sinnerId: 1, star: 3, sin: 'Gluttony' });
	assert.ok(sc.items.length > 0);
	for (const i of sc.items) {
		assert.equal(i.sinnerId, 1);
		assert.equal(i.star, 3);
		assert.ok(i.sins.includes('gluttony'));
		assert.match(i.siteUrl, new RegExp(`/ko/identities/${i.id}$`));
	}
	assert.ok('snapshotId' in sc);
});

test('list_identities: 종류 접두어 축 값은 대소문자 무관 · 빈 필터는 없는 것', db, async () => {
	const ids = async (args: Record<string, unknown>) =>
		(await call('list_identities', { sinnerId: 1, ...args })).sc.items.map((i: Sc) => i.id);
	const base = await ids({ keyword: 'sin:gluttony' });
	assert.ok(base.includes(10104));
	assert.deepEqual(await ids({ keyword: 'sin:Gluttony' }), base);
	assert.deepEqual(await ids({ keyword: 'SIN:gluttony' }), base);
	const atl = await ids({ keyword: 'association:atl' });
	assert.ok(atl.includes(10104));
	assert.deepEqual(atl, await ids({ keyword: 'association:ATL' }));

	const all = await ids({});
	assert.deepEqual(await ids({ keyword: '  ', sin: '', cursor: '' }), all);
	const egoAll = (await call('list_egos', { sinnerId: 1 })).sc.items.map((i: Sc) => i.id);
	assert.deepEqual((await call('list_egos', { sinnerId: 1, rank: ' ', sin: '' })).sc.items.map((i: Sc) => i.id), egoAll);
});

test('list_identities 는 커서로 이어지고 행이 겹치지 않는다', db, async () => {
	const first = await call('list_identities', {});
	assert.ok(first.sc.total > 50, '인격이 50 을 넘어야 페이지를 본다');
	assert.equal(first.sc.items.length, 50);
	assert.ok(first.sc.nextCursor);

	const seen: number[] = first.sc.items.map((i: Sc) => i.id);
	let cursor: string | null = first.sc.nextCursor;
	while (cursor) {
		const { r, sc } = await call('list_identities', { cursor });
		assert.ok(!r.isError);
		assert.equal(sc.total, first.sc.total);
		seen.push(...sc.items.map((i: Sc) => i.id));
		cursor = sc.nextCursor;
	}
	assert.equal(seen.length, first.sc.total);
	assert.equal(new Set(seen).size, seen.length);
	assert.ok(seen.every((id) => typeof id === 'number'));

	// 같은 뜻의 다른 표기는 같은 범위 — 정규화된 값으로 커서를 묶는다
	const glu = await call('list_identities', { sin: 'GLUTTONY' });
	assert.ok(glu.sc.nextCursor, '탐식 인격이 50 을 넘어야 본다');
	const cont = await client!.callTool({ name: 'list_identities', arguments: { sin: ' gluttony', cursor: glu.sc.nextCursor } });
	assert.ok(!cont.isError);

	// 필터가 다른 질의에 커서를 넘기면 오류 — 조용히 첫 페이지를 주지 않는다
	const foreign = await client!.callTool({ name: 'list_identities', arguments: { sinnerId: 1, cursor: first.sc.nextCursor } });
	assert.equal(foreign.isError, true);
	const garbage = await client!.callTool({ name: 'list_egos', arguments: { cursor: 'not-a-cursor' } });
	assert.equal(garbage.isError, true);
});

test('get_identity 응답에 이미지 경로가 없고 siteUrl · axes 가 있다', db, async () => {
	const { r, sc } = await call('get_identity', { id: 10101 });
	assert.ok(!r.isError);
	assertNoMedia(sc);
	assert.match(sc.siteUrl, /\/ko\/identities\/10101$/);
	assert.equal(sc.id, 10101);
	assert.ok(sc.skills.length > 0);
	assert.ok(Array.isArray(sc.axes.tag) && Array.isArray(sc.axes.skill));
	assert.ok(sc.axes.tag.some((v: string) => v.startsWith('sin:')), '상세 axes 는 전체 축');
	assert.ok(sc.releaseDate === null || typeof sc.releaseDate === 'string');

	// 문자열 id 와 en 로케일도 받는다
	const en = await call('get_identity', { id: '10104', locale: 'en' });
	assert.ok(!en.r.isError);
	assert.match(en.sc.siteUrl, /\/en\/identities\/10104$/);
	assert.ok(en.sc.axes.skill.includes('axis:VIBRATION'));
	assert.ok(!en.sc.axes.tag.includes('axis:VIBRATION'));
});

test('list_egos · get_ego: 필터 · 이미지 없음 · siteUrl', db, async () => {
	const list = await call('list_egos', { sinnerId: 1, rank: 'zayin' });
	assert.ok(list.sc.items.length > 0);
	for (const e of list.sc.items) {
		assert.equal(e.sinnerId, 1);
		assert.equal(e.rank, 'ZAYIN');
		assert.equal(typeof e.id, 'number');
	}
	assertNoMedia(list.sc);

	const { r, sc } = await call('get_ego', { id: 20101 });
	assert.ok(!r.isError);
	assertNoMedia(sc);
	assert.match(sc.siteUrl, /\/ko\/egos\/20101$/);
	assert.ok(sc.costs.length > 0);
});

test('없는 id 는 isError', db, async () => {
	const a = await client!.callTool({ name: 'get_identity', arguments: { id: 99999 } });
	assert.equal(a.isError, true);
	assert.match((a.content as Sc[])[0]!.text, /없는 id/);
	const b = await client!.callTool({ name: 'get_ego', arguments: { id: 99999 } });
	assert.equal(b.isError, true);
	assert.match((b.content as Sc[])[0]!.text, /없는 id/);
	// 컷신 전용 E.G.O 는 목록에 없으므로 상세도 없는 id
	const cut = await client!.callTool({ name: 'get_ego', arguments: { id: 201011 } });
	assert.equal(cut.isError, true);
	assert.match((cut.content as Sc[])[0]!.text, /없는 id/);
});

test('search: href 대신 siteUrl, 아이콘 없음, detailTool 로 이어진다', db, async () => {
	const { r, sc } = await call('search', { query: '이상' });
	assert.ok(!r.isError);
	assert.ok(sc.hits.length > 0);
	assertNoMedia(sc);
	for (const h of sc.hits) {
		const site = { identity: 'identities', ego: 'egos', gift: 'gifts', pack: 'packs' }[h.kind as string];
		assert.match(h.siteUrl, new RegExp(`/ko/${site}/${h.id}$`));
		assert.equal(typeof h.id, h.kind === 'pack' ? 'string' : 'number');
		assert.ok(['get_identity', 'get_ego', 'get_gift', 'get_pack'].includes(h.detailTool));
	}
	const none = await call('search', { query: 'zzzzqqqq없음' });
	assert.deepEqual(none.sc.hits, []);
});

test('list_vocab: 키워드 axisRef 가 list_identities 의 축 값과 맞는다', db, async () => {
	const { r, sc } = await call('list_vocab', {});
	assert.ok(!r.isError);
	assertNoMedia(sc);
	assert.equal(sc.sinners.length, 12);
	assert.equal(sc.sins.length, 7);
	assert.equal(sc.keywords.find((k: Sc) => k.id === 'Vibration')?.axisRef, 'axis:VIBRATION');
	assert.equal(sc.sins.find((s: Sc) => s.id === 'gluttony')?.axisRef, 'sin:gluttony');
	assert.equal(sc.axisLabels.mechanics.find((m: Sc) => m.id === 'Bullet')?.axisRef, 'axis:BULLET');
	assert.ok(sc.axisLabels.associations.some((a: Sc) => a.axisRef === 'association:ATL'));
});
