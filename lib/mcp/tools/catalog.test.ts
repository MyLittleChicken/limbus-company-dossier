import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { canonical } from '../../db-canonical';
import { canonicalReachable, NO_DB } from '../../../src/v2/canonical/db-available';
import { canSearch, createKeysMatcher, createKoreanMatcher, searchKeys } from '../../korean-search';
import { searchAll } from '../../queries/canonical/reference';
import { engineData } from '../axes';
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
const errorText = (r: Sc) => (r.content as Sc[])[0]!.text as string;

/** 모든 페이지를 이어 읽은 행. */
async function allRows(name: string, args: Record<string, unknown>): Promise<Sc[]> {
	const out: Sc[] = [];
	let cursor: string | undefined;
	do {
		const { r, sc } = await call(name, { ...args, ...(cursor ? { cursor } : {}) });
		assert.ok(!r.isError, errorText(r));
		out.push(...sc.items);
		cursor = sc.nextCursor ?? undefined;
	} while (cursor);
	return out;
}
const idsOf = async (args: Record<string, unknown>) => (await allRows('list_identities', args)).map((i) => i.id as number);

/** 응답 안의 모든 키 이름(재귀). */
function keysOf(value: unknown, out = new Set<string>()): Set<string> {
	if (Array.isArray(value)) value.forEach((v) => keysOf(v, out));
	else if (value && typeof value === 'object')
		for (const [k, v] of Object.entries(value)) { out.add(k); keysOf(v, out); }
	return out;
}
const MEDIA = ['image', 'images', 'icon', 'icons', 'sprite', 'art', 'href', 'frame', 'rarityIcon', 'rankIcon', 'iconKey'];
function assertNoMedia(sc: Sc, what = '') {
	const keys = keysOf(sc);
	for (const k of MEDIA) assert.ok(!keys.has(k), `${what} 응답에 화면용 키 ${k} 가 남았다`);
	const json = JSON.stringify(sc);
	assert.doesNotMatch(json, /\/media\//, `${what} 에 /media 경로`);
	assert.doesNotMatch(json, /\.(png|webp|jpe?g|gif|svg|avif)\b/i, `${what} 에 이미지 확장자`);
}

// ── 순수 ────────────────────────────────────────────────────────

test('normalizeAxisRef: 접두어는 소문자, 값은 종류별 대소문자로', () => {
	assert.equal(normalizeAxisRef('VIBRATION'), 'axis:VIBRATION');
	assert.equal(normalizeAxisRef('Vibration'), 'axis:VIBRATION');
	assert.equal(normalizeAxisRef(' axis:Vibration '), 'axis:VIBRATION');
	assert.equal(normalizeAxisRef('sin:gluttony'), 'sin:gluttony');
	assert.equal(normalizeAxisRef('sin:Gluttony'), 'sin:gluttony');
	assert.equal(normalizeAxisRef('SIN:gluttony'), 'sin:gluttony');
	assert.equal(normalizeAxisRef('association:atl'), 'association:ATL');
	assert.equal(normalizeAxisRef('Attack_Type:Blunt'), 'attack_type:blunt');
});

test('createKeysMatcher(미리 푼 열쇠)는 createKoreanMatcher 와 같은 판정', () => {
	const values = ['쐐기 사무소 해결사', 'Wedge Office', '도착증', '작열우모', 'LCB 수감자', '', '개화 E.G.O:: 동백', '화상 3 부여'];
	const queries = ['쐐', '쐑', 'ㅆㄱ', 'ㄷㅊ', '도ㅊ', 'wedge', 'WEDGEoffice', 'ㄱ', '', '  ', '동백', 'e.g.o', '화상', 'ㅎㅅ', '1'];
	for (const q of queries) {
		const a = createKoreanMatcher(q);
		const b = createKeysMatcher(q);
		for (const v of values) assert.equal(b(searchKeys([v])), a(v), `${q} / ${v}`);
		assert.equal(b(searchKeys(values)), values.some((v) => a(v)), `${q} / 묶음`);
	}
});

// ── 등록 ────────────────────────────────────────────────────────

test('조회 도구 6개가 읽기 전용으로 등록된다', db, async () => {
	const { tools } = await client!.listTools();
	for (const name of ['search', 'list_identities', 'get_identity', 'list_egos', 'get_ego', 'list_vocab']) {
		const t = tools.find((x) => x.name === name);
		assert.ok(t, `${name} 이 없다`);
		assert.equal(t.annotations?.readOnlyHint, true);
		assert.ok(t.outputSchema, `${name} 에 outputSchema 가 없다`);
	}
});

// ── 축 두 층 ────────────────────────────────────────────────────

test('10104 는 진동 tag 필터에 없고 skill 필터에 있다 (실데이터 재확인)', db, async () => {
	assert.ok(!(await idsOf({ keyword: 'VIBRATION' })).includes(10104));
	assert.ok((await idsOf({ keyword: 'VIBRATION', axisLayer: 'skill' })).includes(10104));

	const { sc } = await call('list_identities', { sinnerId: 1, keyword: 'VIBRATION', axisLayer: 'skill' });
	const row = sc.items.find((i: Sc) => i.id === 10104);
	assert.ok(row.axes.skill.includes('axis:VIBRATION'));
	assert.ok(!row.axes.tag.includes('axis:VIBRATION'));
	assert.ok(row.axes.tag.every((v: string) => v.startsWith('axis:')), '목록 행 axes 는 키워드 축만');
});

test('axes 는 엔진 supply 와 같다 — tag = axisTag, skill = axisSkill(coin_token)', db, async () => {
	const engine = await engineData();
	const layer = (m: Map<string, Set<string>>, id: string) =>
		[...m].filter(([, ids]) => ids.has(id)).map(([axis]) => `axis:${axis}`).sort();

	const rows = await allRows('list_identities', {});
	assert.ok(rows.length > 100);
	let differs = 0;
	for (const r of rows) {
		const id = String(r.id);
		assert.deepEqual(r.axes.tag, layer(engine.supply.axisTag, id), `${id} tag`);
		assert.deepEqual(r.axes.skill, layer(engine.supply.axisSkill, id), `${id} skill`);
		if (r.axes.tag.join() !== r.axes.skill.join()) differs++;
	}
	assert.ok(differs > 0, '두 층이 갈리는 인격이 있어야 한다');

	// 비축 값도 엔진 supply 그대로 — resonance 는 supply.sin(공명 판정), coin 은 minus 만
	const members = (m: Map<string, Set<string>>, kind: string, id: string) =>
		[...m].filter(([, ids]) => ids.has(id)).map(([v]) => `${kind}:${v}`).sort();
	for (const id of ['10508', '10707', '10104', '10101']) {
		const { sc: d } = await call('get_identity', { id });
		for (const layerName of ['tag', 'skill'] as const) {
			const got = d.axes[layerName] as string[];
			assert.deepEqual(got.filter((v) => v.startsWith('resonance:')), members(engine.supply.sin, 'resonance', id), `${id} resonance`);
			assert.deepEqual(got.filter((v) => v.startsWith('sin:')), members(engine.supply.sin, 'sin', id), `${id} sin`);
			assert.deepEqual(got.filter((v) => v.startsWith('association:')), members(engine.supply.association, 'association', id));
			assert.deepEqual(got.filter((v) => v.startsWith('attack_type:')), members(engine.supply.attackType, 'attack_type', id));
			assert.deepEqual(got.filter((v) => v.startsWith('coin:')), engine.supply.minusCoin.has(id) ? ['coin:minus'] : []);
		}
	}
	const resonance = await idsOf({ keyword: 'resonance:wrath' });
	assert.deepEqual(resonance.map(String).sort(), [...(engine.supply.sin.get('wrath') ?? [])].sort());
	const minus = await idsOf({ keyword: 'coin:minus' });
	assert.deepEqual(minus.map(String).sort(), [...engine.supply.minusCoin].sort());
	for (const kw of ['coin:plus', 'coin:single']) {
		const r = await client!.callTool({ name: 'list_identities', arguments: { keyword: kw } });
		assert.equal(r.isError, true, `${kw} 는 엔진이 안 쓰는 값이라 어휘에 없다`);
	}

	// 상세도 같은 출처 — 10109 는 capability affects 로는 LACERATION 하나뿐이지만 스킬은 다섯 축을 준다
	const { sc } = await call('get_identity', { id: 10109 });
	assert.deepEqual(sc.axes.skill.filter((v: string) => v.startsWith('axis:')), layer(engine.supply.axisSkill, '10109'));
	assert.ok(sc.axes.skill.some((v: string) => v.startsWith('sin:')), '나머지 종류는 skill 층에도 있다');
});

// ── 필터 값 풀기 ────────────────────────────────────────────────

test('keyword: id · ko/en 이름 · axisRef 가 같은 축으로 풀린다', db, async () => {
	const base = await idsOf({ keyword: 'axis:VIBRATION', axisLayer: 'skill' });
	assert.ok(base.length > 0);
	for (const kw of ['VIBRATION', 'Vibration', '진동', 'Tremor', 'tremor', 'axis:vibration']) {
		assert.deepEqual(await idsOf({ keyword: kw, axisLayer: 'skill' }), base, kw);
	}
	const bullet = await idsOf({ keyword: 'axis:BULLET' });
	assert.deepEqual(await idsOf({ keyword: '탄환' }), bullet);
	assert.deepEqual(await idsOf({ keyword: 'Ammo' }), bullet);

	const glu = await idsOf({ sinnerId: 1, keyword: 'sin:gluttony' });
	assert.ok(glu.includes(10104));
	for (const kw of ['sin:Gluttony', 'SIN:gluttony', '탐식', 'Gluttony']) assert.deepEqual(await idsOf({ sinnerId: 1, keyword: kw }), glu, kw);
	const atl = await idsOf({ sinnerId: 1, keyword: 'association:atl' });
	assert.ok(atl.includes(10104));
	assert.deepEqual(atl, await idsOf({ sinnerId: 1, keyword: 'association:ATL' }));
	assert.deepEqual(await idsOf({ keyword: '참격' }), await idsOf({ keyword: 'attack_type:slash' }));
});

test('모르는 값은 조용히 0건이 아니라 오류 — 받을 수 있는 값을 알려 준다', db, async () => {
	const kw = await client!.callTool({ name: 'list_identities', arguments: { keyword: 'Foo' } });
	assert.equal(kw.isError, true);
	assert.match(errorText(kw), /모르는 keyword.*받는 값.*Vibration\(진동\/Tremor\)/);
	const ax = await client!.callTool({ name: 'list_identities', arguments: { keyword: 'axis:NOPE' } });
	assert.equal(ax.isError, true);
	const sin = await client!.callTool({ name: 'list_identities', arguments: { sin: 'anger' } });
	assert.equal(sin.isError, true);
	assert.match(errorText(sin), /wrath\(분노\/Wrath\)/);
	const rank = await client!.callTool({ name: 'list_egos', arguments: { rank: 'ZAIN' } });
	assert.equal(rank.isError, true);
	assert.match(errorText(rank), /ZAYIN · TETH · HE · WAW · ALEPH/);
	for (const args of [{ sinnerId: 13 }, { sinnerId: 0 }, { star: 4 }, { star: '0' }]) {
		const r = await client!.callTool({ name: 'list_identities', arguments: args });
		assert.equal(r.isError, true, JSON.stringify(args));
	}
	const egoSinner = await client!.callTool({ name: 'list_egos', arguments: { sinnerId: 99 } });
	assert.equal(egoSinner.isError, true);
});

test('필터: 숫자 문자열 · 죄악 이름 · 대소문자 · 빈 문자열', db, async () => {
	const base = await idsOf({ sinnerId: 1, star: 3, sin: 'gluttony' });
	assert.ok(base.length > 0);
	assert.deepEqual(await idsOf({ sinnerId: '1', star: '3', sin: '탐식' }), base);
	assert.deepEqual(await idsOf({ sinnerId: 1, star: 3, sin: 'Gluttony' }), base);
	const { sc } = await call('list_identities', { sinnerId: 1, star: 3, sin: 'gluttony' });
	for (const i of sc.items) {
		assert.equal(i.sinnerId, 1);
		assert.equal(i.star, 3);
		assert.ok(i.sins.includes('gluttony'));
		assert.match(i.siteUrl, new RegExp(`/ko/identities/${i.id}$`));
	}
	assert.ok('snapshotId' in sc && typeof sc.dataVersion === 'string');

	assert.deepEqual(await idsOf({ sinnerId: 1, keyword: '  ', sin: '', cursor: '' }), await idsOf({ sinnerId: 1 }));
	const egoAll = (await allRows('list_egos', { sinnerId: 1 })).map((e) => e.id);
	assert.deepEqual((await allRows('list_egos', { sinnerId: '1', rank: ' ', sin: '' })).map((e) => e.id), egoAll);
	const zayin = await allRows('list_egos', { sinnerId: 1, rank: 'zayin' });
	assert.ok(zayin.length > 0 && zayin.every((e) => e.rank === 'ZAYIN' && typeof e.id === 'number'));
	const wrath = await allRows('list_egos', { sin: '분노' });
	assert.ok(wrath.length > 0 && wrath.every((e) => e.sin === 'wrath'));
});

// ── 페이지 ──────────────────────────────────────────────────────

test('list_identities 는 커서로 이어지고 행이 겹치지 않는다', db, async () => {
	const first = await call('list_identities', {});
	assert.ok(first.sc.total > 50, '인격이 50 을 넘어야 페이지를 본다');
	assert.equal(first.sc.items.length, 50);
	assert.ok(first.sc.nextCursor);
	const seen = (await allRows('list_identities', {})).map((i) => i.id);
	assert.equal(seen.length, first.sc.total);
	assert.equal(new Set(seen).size, seen.length);
	assert.ok(seen.every((id) => typeof id === 'number'));

	// 같은 뜻의 다른 표기는 같은 범위 — 정규화된 값으로 커서를 묶는다
	const glu = await call('list_identities', { sin: 'GLUTTONY' });
	assert.ok(glu.sc.nextCursor, '탐식 인격이 50 을 넘어야 본다');
	const cont = await client!.callTool({ name: 'list_identities', arguments: { sin: '탐식', cursor: glu.sc.nextCursor } });
	assert.ok(!cont.isError);

	// 필터가 다른 질의에 커서를 넘기면 오류 — 조용히 첫 페이지를 주지 않는다
	const foreign = await client!.callTool({ name: 'list_identities', arguments: { sinnerId: 1, cursor: first.sc.nextCursor } });
	assert.equal(foreign.isError, true);
	const garbage = await client!.callTool({ name: 'list_egos', arguments: { cursor: 'not-a-cursor' } });
	assert.equal(garbage.isError, true);
});

// ── 상세 ────────────────────────────────────────────────────────

test('get_identity: 이미지 없음 · siteUrl · name 평평 · keywords axisRef · 기본은 최고 단계', db, async () => {
	const { r, sc } = await call('get_identity', { id: 10101 });
	assert.ok(!r.isError);
	assertNoMedia(sc);
	assert.match(sc.siteUrl, /\/ko\/identities\/10101$/);
	assert.equal(sc.id, 10101);
	assert.equal(typeof sc.name, 'string');
	assert.equal(typeof sc.fellBack, 'boolean');
	assert.ok(!('text' in sc), '최상위 text 는 name · fellBack 으로 폈다');
	assert.ok(sc.axes.tag.some((v: string) => v.startsWith('sin:')), '상세 axes 는 전체 축');
	assert.ok(sc.releaseDate === null || typeof sc.releaseDate === 'string');
	assert.equal(sc.uptie.shown, sc.uptie.max);
	assert.ok(sc.skills.length > 0 && sc.skills.every((s: Sc) => s.stages.length === 1));
	assert.ok(sc.skills.every((s: Sc) => s.stages[0].uptie <= sc.uptie.max));
	assert.ok(sc.speeds.length <= 1);
	assert.ok(sc.keywords.every((k: Sc) => 'axisRef' in k));
	// 중첩 text 없이 평평하게 — affiliations · keywords · passives
	for (const key of ['affiliations', 'keywords', 'passives']) {
		assert.ok(sc[key].every((x: Sc) => !('text' in x) && 'name' in x && typeof x.fellBack === 'boolean'), key);
	}
	assert.ok(sc.passives.every((p: Sc) => 'desc' in p));

	const all = await call('get_identity', { id: '10101', uptie: 'all' });
	assert.equal(all.sc.uptie.shown, 'all');
	assert.ok(all.sc.skills.some((s: Sc) => s.stages.length > 1));
	assert.ok(all.sc.speeds.length > 1);

	const one = await call('get_identity', { id: 10101, uptie: 1 });
	assert.equal(one.sc.uptie.shown, 1);
	assert.ok(one.sc.skills.every((s: Sc) => s.stages[0].uptie === 1 && s.firstUptie === 1));
	assert.ok(one.sc.passives.every((p: Sc) => p.uptie <= 1));
	const big = await call('get_identity', { id: 10101, uptie: 9 });
	assert.equal(big.sc.uptie.shown, big.sc.uptie.max, '최고보다 크면 최고로');

	const en = await call('get_identity', { id: '10104', locale: 'en' });
	assert.match(en.sc.siteUrl, /\/en\/identities\/10104$/);
	assert.ok(en.sc.axes.skill.includes('axis:VIBRATION'));
	assert.ok(!en.sc.axes.tag.includes('axis:VIBRATION'));
	assert.equal(en.sc.keywords.find((k: Sc) => k.id === 'Vibration')?.axisRef, 'axis:VIBRATION');
});

test('get_identity 크기: 기본(최고 단계)은 전 단계의 40% 아래, 가장 큰 11016 도 22KiB 이하', db, async () => {
	// 11016(스킬 13 · 변신)이 가장 크다 — 전 단계 69.6KB → 기본 약 21.6KB. 나머지 인격은 20KiB 이하.
	const { r, sc } = await call('get_identity', { id: 11016 });
	assert.ok(!r.isError);
	const bytes = Buffer.byteLength(JSON.stringify(sc), 'utf8');
	const all = await call('get_identity', { id: 11016, uptie: 'all' });
	const allBytes = Buffer.byteLength(JSON.stringify(all.sc), 'utf8');
	console.log(`11016 기본 ${bytes} B · 전 단계 ${allBytes} B`);
	assert.ok(bytes <= 22 * 1024, `${bytes} bytes`);
	assert.ok(bytes < allBytes * 0.4, `${bytes} vs ${allBytes}`);
	// 패시브는 갈래마다 그 단계의 목록만 — 1101604 는 3 단계에서 1101614(같은 이름)로 바뀐다
	const passives = sc.passives.map((p: Sc) => p.id);
	assert.ok(passives.includes('1101614') && !passives.includes('1101604'));
	assert.ok(sc.statuses.every((s: Sc) => !('text' in s) && 'name' in s), 'statuses 는 { id, name } 만');
});

test('get_ego: 이미지 없음 · siteUrl · name 평평 · 단계 인자', db, async () => {
	const { r, sc } = await call('get_ego', { id: 20101 });
	assert.ok(!r.isError);
	assertNoMedia(sc);
	assert.match(sc.siteUrl, /\/ko\/egos\/20101$/);
	assert.equal(typeof sc.name, 'string');
	assert.ok(!('text' in sc));
	for (const key of ['keywords', 'passives']) assert.ok(sc[key].every((x: Sc) => !('text' in x) && 'name' in x), key);
	assert.ok(sc.costs.length > 0);
	assert.equal(sc.uptie.shown, sc.uptie.max);
	assert.ok(sc.skills.every((s: Sc) => s.stages.length === 1));
	const all = await call('get_ego', { id: 20101, uptie: 'all' });
	assert.ok(all.sc.skills.some((s: Sc) => s.stages.length > 1));
});

test('없는 id · 컷신 전용 E.G.O 는 isError', db, async () => {
	for (const [name, id] of [['get_identity', 99999], ['get_ego', 99999], ['get_ego', 201011]] as const) {
		const r = await client!.callTool({ name, arguments: { id } });
		assert.equal(r.isError, true, `${name} ${id}`);
		assert.match(errorText(r), /없는 id/);
	}
});

test('애셋 회귀: 모든 인격 · E.G.O 상세(전 단계)에 /media · 이미지 확장자 · 화면용 키가 없다', db, async () => {
	const identities = (await allRows('list_identities', {})).map((i) => i.id);
	const egos = (await allRows('list_egos', {})).map((e) => e.id);
	for (const id of identities) {
		const { r, sc } = await call('get_identity', { id, uptie: 'all' });
		assert.ok(!r.isError, `인격 ${id}`);
		assertNoMedia(sc, `인격 ${id}`);
	}
	for (const id of egos) {
		const { r, sc } = await call('get_ego', { id, uptie: 'all' });
		assert.ok(!r.isError, `E.G.O ${id}`);
		assertNoMedia(sc, `E.G.O ${id}`);
	}
});

// ── 검색 ────────────────────────────────────────────────────────

test('search: href 대신 siteUrl, id 형식, detailTool 로 이어진다', db, async () => {
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
	const blank = await client!.callTool({ name: 'search', arguments: { query: '   ' } });
	assert.equal(blank.isError, true);
});

/** 말뭉치 캐시 전의 searchAll 과 같은 판정 — createKoreanMatcher 로 행마다 다시 푼다. */
async function legacySearch(query: string): Promise<string[]> {
	const q = query.trim();
	if (!canSearch(q)) return [];
	const m = createKoreanMatcher(q);
	const texts = { where: { locale: { in: ['ko', 'en'] as ('ko' | 'en')[] } } };
	const [gifts, packs, identities, egos] = await Promise.all([
		canonical.gift.findMany({ where: { domain: 'mirror_dungeon' }, orderBy: { id: 'asc' }, include: { stages: { orderBy: { level: 'asc' }, include: { texts } } } }),
		canonical.pack.findMany({ orderBy: { id: 'asc' }, include: { texts } }),
		canonical.identity.findMany({ orderBy: { id: 'asc' }, include: { texts } }),
		canonical.ego.findMany({ where: { presentationOnly: false }, orderBy: { id: 'asc' }, include: { texts } }),
	]);
	return [
		...gifts.filter((g) => g.stages.some((s) => s.texts.some((t) => m(t.name) || m(t.desc)))).slice(0, 8).map((g) => `gift:${g.id}`),
		...packs.filter((p) => p.texts.some((t) => m(t.name))).slice(0, 8).map((p) => `pack:${p.id}`),
		...identities.filter((i) => i.texts.some((t) => m(t.title))).slice(0, 8).map((i) => `identity:${i.id}`),
		...egos.filter((e) => e.texts.some((t) => m(t.name))).slice(0, 8).map((e) => `ego:${e.id}`),
	];
}

test('searchAll: 미리 푼 열쇠로 찾아도 결과가 전과 같고, warm 호출이 빠르다', db, async () => {
	const queries = ['이상', 'ㄷㅂ', 'ㅇㅅ', '화상', '도ㅊ', 'burn', 'Bleed', 'LCB', '진', 'ㅎㅅ', '1', 'e', '파우스트', 'ㄱ'];
	for (const q of queries) {
		const now = (await searchAll(q, 'ko')).map((h) => `${h.kind}:${h.id}`);
		assert.deepEqual(now, await legacySearch(q), q);
	}
	await searchAll('화상', 'ko');
	const runs = 20;
	const t0 = performance.now();
	for (let i = 0; i < runs; i++) await searchAll(queries[i % queries.length]!, 'ko');
	const avg = (performance.now() - t0) / runs;
	console.log(`searchAll warm 평균 ${avg.toFixed(2)} ms`);
	assert.ok(avg < 25, `warm 평균 ${avg.toFixed(2)} ms`);
});

// ── 어휘 ────────────────────────────────────────────────────────

test('list_vocab: axisRef 가 list_identities 의 축 값과 맞는다', db, async () => {
	const { r, sc } = await call('list_vocab', {});
	assert.ok(!r.isError);
	assertNoMedia(sc);
	assert.equal(sc.sinners.length, 12);
	assert.equal(sc.sins.length, 7);
	assert.equal(sc.keywords.find((k: Sc) => k.id === 'Vibration')?.axisRef, 'axis:VIBRATION');
	assert.equal(sc.keywords.find((k: Sc) => k.id === 'Slash')?.axisRef, 'attack_type:slash');
	assert.equal(sc.keywords.find((k: Sc) => k.id === 'Random')?.axisRef, null);
	assert.equal(sc.sins.find((s: Sc) => s.id === 'gluttony')?.axisRef, 'sin:gluttony');
	assert.equal(sc.axisLabels.mechanics.find((m: Sc) => m.id === 'Bullet')?.axisRef, 'axis:BULLET');
	assert.ok(sc.axisLabels.associations.some((a: Sc) => a.axisRef === 'association:ATL'));
	const en = await call('list_vocab', { locale: 'en' });
	assert.equal(en.sc.keywords.find((k: Sc) => k.id === 'Vibration')?.name, 'Tremor');
});
