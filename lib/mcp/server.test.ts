import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { canonical } from '../db-canonical';
import { canonicalReachable, NO_DB } from '../../src/v2/canonical/db-available';
import { connectInMemory } from './test-client';

const reachable = await canonicalReachable(canonical);
after(async () => { await canonical.$disconnect(); });

test('get_build_info 가 등록되고 snapshotId 와 출처 고지를 준다', { skip: reachable ? false : NO_DB }, async () => {
	const client = await connectInMemory();
	const names = (await client.listTools()).tools.map((t) => t.name);
	assert.ok(names.includes('get_build_info'));
	const r = await client.callTool({ name: 'get_build_info', arguments: {} });
	assert.notEqual(r.isError, true);
	assert.equal(typeof (r.structuredContent as any).snapshotId, 'string');
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
