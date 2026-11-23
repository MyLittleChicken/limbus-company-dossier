import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import * as z from 'zod';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { canonical } from '../db-canonical';
import { canonicalReachable, NO_DB } from '../../src/v2/canonical/db-available';
import { defineTool, INTERNAL_ERROR, ToolInputError, type ToolCtx } from './define-tool';
import { envelopeShape, ok } from './envelope';

const reachable = await canonicalReachable(canonical);
after(async () => { await canonical.$disconnect(); });

type Text = { type: 'text'; text: string };
const seen: ToolCtx[] = [];

async function harness(): Promise<Client> {
	const server = new McpServer({ name: 't', version: '0' });
	defineTool(server, 'echo', {
		inputSchema: { n: z.number() },
		outputSchema: envelopeShape({ n: z.number() }),
	}, async ({ n }, ctx) => {
		seen.push(ctx);
		return ok({ n }, `n=${n}`, ctx);
	});
	defineTool(server, 'bad_input', { inputSchema: { id: z.number() } }, async ({ id }) => {
		throw new ToolInputError(`없는 id: ${id}`);
	});
	defineTool(server, 'boom', {}, async () => {
		throw new Error('PrismaClientKnownRequestError: connection to postgresql://user:secret@db failed');
	});
	const [a, b] = InMemoryTransport.createLinkedPair();
	const client = new Client({ name: 'c', version: '0' });
	await Promise.all([server.connect(b), client.connect(a)]);
	await client.listTools();
	return client;
}

test('defineTool: ctx 를 한 번 읽어 넘기고 ok 봉투에 실린다', { skip: reachable ? false : NO_DB }, async () => {
	const c = await harness();
	const r = await c.callTool({ name: 'echo', arguments: { n: 2 } });
	assert.notEqual(r.isError, true);
	const body = r.structuredContent as Record<string, unknown>;
	const ctx = seen.at(-1)!;
	assert.equal(body.n, 2);
	assert.equal(body.snapshotId, ctx.snapshotId);
	assert.equal(body.dataVersion, ctx.dataVersion);
	await c.close();
});

test('defineTool: ToolInputError 는 문구 그대로 fail', { skip: reachable ? false : NO_DB }, async () => {
	const c = await harness();
	const r = await c.callTool({ name: 'bad_input', arguments: { id: 9 } });
	assert.equal(r.isError, true);
	assert.deepEqual(r.content, [{ type: 'text', text: '없는 id: 9' }]);
	await c.close();
});

test('defineTool: 그 밖의 예외는 원문을 숨기고 내부 오류 문구만 준다', async () => {
	const c = await harness();
	const original = console.error;
	const logged: unknown[][] = [];
	console.error = (...a: unknown[]) => { logged.push(a); };
	try {
		const r = await c.callTool({ name: 'boom', arguments: {} });
		assert.equal(r.isError, true);
		const text = (r.content as Text[])[0]!.text;
		assert.equal(text, INTERNAL_ERROR);
		assert.doesNotMatch(text, /Prisma|secret/);
		assert.ok(logged.length >= 1, '원문은 서버 로그로');
	} finally {
		console.error = original;
		await c.close();
	}
});
