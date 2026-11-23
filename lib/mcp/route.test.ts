import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { DELETE, GET, POST } from '../../app/mcp/route';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { BURST, createSemaphore, resetBuckets, takeToken } from './rate-limit';
import { MAX_BODY_BYTES, handleMcpPost } from './http';

/**
 * `app/mcp/route.ts` 를 Request 로 직접 부른다. DB 를 건드리는 도구 호출은 없다
 * (initialize · ping 만) — DB 없이 돈다.
 */

const URL_ = 'http://127.0.0.1:3100/mcp';
const HEADERS = {
	'content-type': 'application/json',
	accept: 'application/json, text/event-stream',
	'mcp-protocol-version': '2025-11-25',
};
const env = process.env as Record<string, string | undefined>;
const saved: Record<string, string | undefined> = {};
const KEYS = ['NODE_ENV', 'MCP_ENABLED', 'MCP_TRUST_PROXY', 'SITE_URL'] as const;

beforeEach(() => {
	resetBuckets();
	for (const k of KEYS) {
		saved[k] = env[k];
		delete env[k];
	}
});
afterEach(() => {
	for (const k of KEYS) {
		if (saved[k] === undefined) delete env[k];
		else env[k] = saved[k];
	}
});

function post(body: unknown, headers: Record<string, string> = {}): Promise<Response> {
	return POST(
		new Request(URL_, {
			method: 'POST',
			headers: { ...HEADERS, ...headers },
			body: typeof body === 'string' ? body : JSON.stringify(body),
		}),
	);
}

const ping = (id = 1) => ({ jsonrpc: '2.0', id, method: 'ping' });

test('POST initialize · ping 은 200 JSON, 세션 id 머리가 없다', async () => {
	const init = await post({
		jsonrpc: '2.0',
		id: 1,
		method: 'initialize',
		params: { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 't', version: '0' } },
	});
	assert.equal(init.status, 200);
	assert.equal(init.headers.get('mcp-session-id'), null);
	const body = (await init.json()) as any;
	assert.equal(body.result.serverInfo.name, 'limbus-dossier');
	const p = await post(ping(2));
	assert.equal(p.status, 200);
	assert.deepEqual(await p.json(), { jsonrpc: '2.0', id: 2, result: {} });
});

test('GET · DELETE 는 405 + Allow: POST', async () => {
	for (const handler of [GET, DELETE]) {
		const r = handler(new Request(URL_, { method: 'GET' }));
		assert.equal(r.status, 405);
		assert.equal(r.headers.get('allow'), 'POST');
	}
});

test('배치는 400 · -32600', async () => {
	const r = await post([ping(1), ping(2)]);
	assert.equal(r.status, 400);
	const body = (await r.json()) as any;
	assert.equal(body.error.code, -32600);
	assert.match(body.error.message, /batch not supported/);
});

test('JSON 이 아니면 400 · -32700, Content-Type 이 아니면 415', async () => {
	const bad = await post('{not json');
	assert.equal(bad.status, 400);
	assert.equal(((await bad.json()) as any).error.code, -32700);
	const ct = await post(ping(), { 'content-type': 'text/plain' });
	assert.equal(ct.status, 415);
});

test('본문 상한 — Content-Length 로도, 청크 전송으로도 413', async () => {
	const big = 'a'.repeat(MAX_BODY_BYTES + 1);
	const declared = await post(big);
	assert.equal(declared.status, 413);

	const bytes = new TextEncoder().encode(big);
	const stream = new ReadableStream<Uint8Array>({
		start(c) {
			for (let i = 0; i < bytes.length; i += 4096) c.enqueue(bytes.slice(i, i + 4096));
			c.close();
		},
	});
	const chunked = await POST(
		new Request(URL_, { method: 'POST', headers: HEADERS, body: stream, duplex: 'half' } as RequestInit),
	);
	assert.equal(chunked.status, 413);
});

test('호출 제한 — 키 버킷이 비면 429 + Retry-After + JSON-RPC 본문', async () => {
	for (let i = 0; i < BURST; i++) takeToken('direct');
	const r = await post(ping());
	assert.equal(r.status, 429);
	assert.ok(Number(r.headers.get('retry-after')) >= 1);
	const body = (await r.json()) as any;
	assert.equal(body.jsonrpc, '2.0');
	assert.equal(body.error.code, -32000);
});

test('MCP_TRUST_PROXY 가 없으면 x-forwarded-for 를 바꿔도 같은 키(direct)', async () => {
	for (let i = 0; i < BURST - 1; i++) takeToken('direct');
	assert.equal((await post(ping(), { 'x-forwarded-for': '1.1.1.1' })).status, 200);
	assert.equal((await post(ping(), { 'x-forwarded-for': '2.2.2.2' })).status, 429);
});

test('Origin — 허용 목록 밖이면 403, 개발의 루프백 · SITE_URL origin 은 통과', async () => {
	assert.equal((await post(ping(), { origin: 'https://evil.example' })).status, 403);
	assert.equal((await post(ping(), { origin: 'null' })).status, 403);
	assert.equal((await post(ping(), { origin: 'http://localhost:6274' })).status, 200);
	env.SITE_URL = 'https://dossier.example';
	assert.equal((await post(ping(), { origin: 'https://dossier.example' })).status, 200);
	env.NODE_ENV = 'production';
	env.MCP_ENABLED = '1';
	env.MCP_TRUST_PROXY = '1';
	assert.equal((await post(ping(), { origin: 'http://localhost:6274' })).status, 403);
	assert.equal((await post(ping(), { origin: 'https://dossier.example', host: 'dossier.example' })).status, 200);
});

test('Host — SITE_URL 호스트 · 루프백 밖이면 403', async () => {
	assert.equal((await post(ping(), { host: 'evil.example' })).status, 403);
	assert.equal((await post(ping(), { host: 'localhost:3200' })).status, 200);
});

test('MCP_ENABLED — 프로덕션에서 1 이 아니면 POST · GET 모두 404', async () => {
	env.NODE_ENV = 'production';
	env.MCP_TRUST_PROXY = '1';
	assert.equal((await post(ping())).status, 404);
	assert.equal(GET(new Request(URL_)).status, 404);
	env.MCP_ENABLED = '1';
	assert.equal((await post(ping())).status, 200);
	env.MCP_ENABLED = '0';
	delete env.NODE_ENV;
	assert.equal((await post(ping())).status, 404, '개발에서도 0 이면 끈다');
});

/** 부르면 `ms` 동안 매달리는 도구 하나만 있는 서버. */
function slowServer(ms: number): () => McpServer {
	return () => {
		const s = new McpServer({ name: 'slow', version: '0' });
		s.registerTool('slow', { description: 'slow' }, async () => {
			await new Promise(r => setTimeout(r, ms));
			return { content: [{ type: 'text', text: 'done' }] };
		});
		return s;
	};
}

/** 첫 요청이 자리를 잡을 때까지 기다린다 — 두 번째 요청이 반드시 대기 쪽이 되게. */
async function untilActive(sem: ReturnType<typeof createSemaphore>): Promise<void> {
	while (sem.stats().active === 0) await new Promise(r => setImmediate(r));
}

const callSlow = (id: number) =>
	new Request(URL_, {
		method: 'POST',
		headers: HEADERS,
		body: JSON.stringify({ jsonrpc: '2.0', id, method: 'tools/call', params: { name: 'slow', arguments: {} } }),
	});

test('처리 상한 — 넘으면 -32603 「시간 초과」(그 요청의 id), 자리를 돌려준다', async () => {
	const semaphore = createSemaphore(1, 4);
	const started = Date.now();
	const r = await handleMcpPost(callSlow(7), env, { createServer: slowServer(300), semaphore, requestTimeoutMs: 30 });
	assert.ok(Date.now() - started < 250, '상한에서 바로 돌아온다');
	const body = (await r.json()) as any;
	assert.equal(body.id, 7);
	assert.equal(body.error.code, -32603);
	assert.match(body.error.message, /timed out|시간 초과/);
	assert.deepEqual(semaphore.stats(), { active: 0, queued: 0 });
});

test('대기 상한 — 자리를 못 얻고 기다림이 넘으면 503 + Retry-After', async () => {
	const semaphore = createSemaphore(1, 4);
	const opts = { createServer: slowServer(200), semaphore, queueWaitMs: 20 };
	const first = handleMcpPost(callSlow(1), env, opts);
	await untilActive(semaphore);
	const second = await handleMcpPost(callSlow(2), env, opts);
	assert.equal(second.status, 503);
	assert.equal(second.headers.get('retry-after'), '1');
	const ok = (await (await first).json()) as any;
	assert.equal(ok.result.content[0].text, 'done');
	assert.deepEqual(semaphore.stats(), { active: 0, queued: 0 });
});

test('대기열이 가득이면 기다리지 않고 503', async () => {
	const semaphore = createSemaphore(1, 0);
	const opts = { createServer: slowServer(100), semaphore };
	const first = handleMcpPost(callSlow(1), env, opts);
	await untilActive(semaphore);
	const started = Date.now();
	const second = await handleMcpPost(callSlow(2), env, opts);
	assert.equal(second.status, 503);
	assert.ok(Date.now() - started < 80);
	await first;
});
