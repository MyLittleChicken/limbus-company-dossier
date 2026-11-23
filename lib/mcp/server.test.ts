import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { canonical } from '../db-canonical';
import { canonicalReachable, NO_DB } from '../../src/v2/canonical/db-available';
import { execFile } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { connectInMemory } from './test-client';
import { cachedToolList, computeToolList, createDossierServer } from './server';
import { INTERNAL_ERROR } from './define-tool';

const reachable = await canonicalReachable(canonical);
after(async () => { await canonical.$disconnect(); });

test('get_build_info 가 등록되고 snapshotId 와 출처 고지를 준다', { skip: reachable ? false : NO_DB }, async () => {
	const client = await connectInMemory();
	const names = (await client.listTools()).tools.map((t) => t.name);
	assert.ok(names.includes('get_build_info'));
	const r = await client.callTool({ name: 'get_build_info', arguments: {} });
	assert.notEqual(r.isError, true);
	assert.equal(typeof (r.structuredContent as any).snapshotId, 'string');
	assert.equal(typeof (r.structuredContent as any).dataVersion, 'string');
	assert.match(JSON.stringify(r.structuredContent), /Project Moon/);
	await client.close();
});

test('서버 instructions 에 면책과 참고값 고지가 있다', async () => {
	const client = await connectInMemory();
	assert.match(client.getInstructions() ?? '', /2차 창작/);
	assert.match(client.getInstructions() ?? '', /참고값/);
	assert.match(client.getInstructions() ?? '', /Project Moon/);
	assert.equal(client.getServerVersion()?.name, 'limbus-dossier');
	await client.close();
});

test('무상태라 tools.listChanged 를 알리지 않는다', async () => {
	const client = await connectInMemory();
	assert.equal(client.getServerCapabilities()?.tools?.listChanged, false);
	await client.close();
});

test('instructions 는 snapshotId 를 성공 응답에만 있다고 하고 dataVersion 을 말한다', async () => {
	const client = await connectInMemory();
	const text = client.getInstructions() ?? '';
	assert.match(text, /성공 응답에는 snapshotId/);
	assert.match(text, /dataVersion/);
	assert.doesNotMatch(text, /모든 응답에 snapshotId/);
	await client.close();
});

const HERE = import.meta.dirname;

test('tools/*.ts 는 registerTool 을 직접 부르지 않는다 — 모두 defineTool 을 거친다 (오류 원문 차단)', () => {
	const dir = join(HERE, 'tools');
	const files = readdirSync(dir).filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'));
	assert.ok(files.length >= 4, '도구 파일을 찾았다');
	const offenders = files.filter((f) => /registerTool\s*\(/.test(readFileSync(join(dir, f), 'utf8')));
	assert.deepEqual(offenders, []);
});

test('DB 장애 때 모든 도구가 INTERNAL_ERROR 만 주고 경로 · prisma · DB 주소를 흘리지 않는다', { timeout: 120_000 }, async () => {
	const { stdout } = await promisify(execFile)(
		process.execPath,
		['--import', 'tsx', join(HERE, 'no-db-probe.ts')],
		{ env: { ...process.env, DATABASE_URL: 'postgresql://probe:probe@127.0.0.1:1/none' }, timeout: 110_000, maxBuffer: 8 << 20 },
	);
	const results = JSON.parse(stdout.trim().split('\n').at(-1)!) as Array<{ name: string; isError: boolean; text: string; probed: boolean }>;
	assert.equal(results.length, 18, `도구 18개 — ${results.map((r) => r.name).join(', ')}`);
	assert.deepEqual(results.filter((r) => !r.probed).map((r) => r.name), [], '모든 도구에 시험 인자가 있다');
	for (const r of results) {
		assert.equal(r.isError, true, `${r.name} 는 isError`);
		assert.equal(r.text, INTERNAL_ERROR, `${r.name} 는 내부 오류 문구만: ${r.text.slice(0, 200)}`);
		assert.doesNotMatch(r.text, /\/Users\/|prisma|database server|127\.0\.0\.1|postgres/i, r.name);
	}
});

test('tools/list 는 프로세스에 한 번 만든 것을 다시 준다 — 덮어쓰지 않은 SDK 응답과 같다', async () => {
	const first = await cachedToolList();
	assert.equal(await cachedToolList(), first, '같은 Promise 결과');
	assert.equal(first.tools.length, 18);
	// 두 세션(무상태라 서버 둘)이 같은 목록을 받고, 클라이언트 쪽 파싱 뒤 모양도 같다
	const [c1, c2] = await Promise.all([connectInMemory(), connectInMemory()]);
	const [l1, l2] = await Promise.all([c1.listTools(), c2.listTools()]);
	assert.deepEqual(l1, l2);
	assert.deepEqual(l1.tools.map((t) => t.name), first.tools.map((t) => t.name));
	// 기억한 목록은 SDK 가 바로 만든 것과 필드까지 같다 (outputSchema · annotations 포함)
	assert.deepEqual(first, await computeToolList());
	const raw = first.tools.find((t) => t.name === 'get_build_info')!;
	assert.equal((raw.outputSchema as any).properties.dataVersion.type, 'string');
	assert.deepEqual(raw.annotations, { readOnlyHint: true, openWorldHint: false });
	await Promise.all([c1.close(), c2.close()]);
	assert.ok(createDossierServer());
});
