import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { canonical } from '../db-canonical';
import { canonicalReachable, NO_DB } from '../../src/v2/canonical/db-available';
import { fail, ok } from './envelope';
import { siteUrl } from './site-url';

const reachable = await canonicalReachable(canonical);
after(async () => { await canonical.$disconnect(); });

test('siteUrl 은 SITE_URL 위에 로케일·종류·id 를 붙인다', () => {
	process.env.SITE_URL = 'https://example.test';
	assert.equal(siteUrl('ko', 'gifts', 9001), 'https://example.test/ko/gifts/9001');
});

test('siteUrl 은 SITE_URL 끝의 / 를 겹치지 않는다', () => {
	process.env.SITE_URL = 'https://example.test//';
	assert.equal(siteUrl('en', 'identities', '10101'), 'https://example.test/en/identities/10101');
});

test('siteUrl 은 SITE_URL 이 없으면 로컬 기본값을 쓴다', () => {
	delete process.env.SITE_URL;
	assert.equal(siteUrl('ko', 'packs', 1129), 'http://127.0.0.1:3100/ko/packs/1129');
});

test('fail 은 isError 와 문구만 준다', () => {
	assert.deepEqual(fail('없는 id: 1'), { isError: true, content: [{ type: 'text', text: '없는 id: 1' }] });
});

test('ok 는 snapshotId 를 머리에 붙이고 Date 를 ISO 문자열로 바꾼다', { skip: reachable ? false : NO_DB }, async () => {
	const at = new Date('2026-11-23T00:00:00.000Z');
	const r = await ok({ id: 1, at, gone: undefined }, '요약');
	const body = r.structuredContent as Record<string, unknown>;
	assert.equal(typeof body.snapshotId, 'string');
	assert.equal(body.at, '2026-11-23T00:00:00.000Z');
	assert.ok(!('gone' in body));
	assert.equal(typeof body.dataVersion, 'string');
	assert.equal(r.isError, undefined);
});

const CTX = { snapshotId: 'snap-1', dataVersion: 'snap-1.abcdefgh' };

test('ok(data, summary, ctx) 는 ctx 를 봉투로 쓰고 봉투가 data 를 이긴다 (DB 없이)', async () => {
	const r = await ok({ snapshotId: 'fake', dataVersion: 'fake', id: 3 }, '요약', CTX);
	assert.deepEqual(r.structuredContent, { id: 3, snapshotId: 'snap-1', dataVersion: 'snap-1.abcdefgh' });
});

test('ok 의 content text 는 요약 한 줄 + 압축 JSON 이다', async () => {
	const r = await ok({ id: 3, list: [1, 2] }, '요약', CTX);
	const text = (r.content as Array<{ type: string; text: string }>)[0]!.text;
	const [head, json, ...rest] = text.split('\n');
	assert.equal(head, '요약');
	assert.deepEqual(rest, []);
	assert.deepEqual(JSON.parse(json!), r.structuredContent);
	assert.equal(json, JSON.stringify(r.structuredContent));
});

test('ok 2인자 호출도 동작한다 — ctx 를 스스로 읽고 봉투가 이긴다', { skip: reachable ? false : NO_DB }, async () => {
	const r = await ok({ snapshotId: 'fake', dataVersion: 'fake' }, '요약');
	const body = r.structuredContent as Record<string, unknown>;
	assert.notEqual(body.snapshotId, 'fake');
	assert.notEqual(body.dataVersion, 'fake');
});

test('ok 는 Map · Set · 클래스 인스턴스를 조용히 비우지 않고 던진다', async () => {
	class Box { constructor(public v: number) {} }
	await assert.rejects(ok({ m: new Map([['a', 1]]) }, 's', CTX), /plain object 가 아닌 값.*data\.m \(Map\)/);
	await assert.rejects(ok({ list: [{ s: new Set([1]) }] }, 's', CTX), /data\.list\[0\]\.s \(Set\)/);
	await assert.rejects(ok({ b: new Box(1) }, 's', CTX), /Box/);
	await assert.rejects(ok({ n: Number.NaN }, 's', CTX), /못 옮기는 수/);
	await assert.rejects(ok({ f: () => 1 }, 's', CTX), /function/);
});
