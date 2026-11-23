import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { createDossierServer } from './server';
import { clientIpConfig, clientKey, mcpSemaphore, retryAfterSeconds, takeToken, type createSemaphore } from './rate-limit';

/**
 * `/mcp` HTTP 처리 — `app/mcp/route.ts` 가 부른다. Next.js 의 route 파일은 HTTP 메서드 외의 export 를
 * 받지 않으므로 몸통은 여기 둔다. 웹 표준 Request/Response 만 쓴다.
 *
 * POST 차례(앞에서 막힐수록 싸다):
 *   켜짐(MCP_ENABLED) 404 → 끊긴 요청 499 → Host · Origin 403 → Content-Type 415 → 호출 제한 429
 *   → 본문 상한 413 → JSON 400(-32700) → 배치 400(-32600) → 동시 실행 상한 503(대기열 가득 · 대기 5 초 초과)
 *   → 전송(처리 15 초 상한, 넘으면 JSON-RPC -32603 「시간 초과」. 자리는 처리가 실제로 끝날 때 돌려준다).
 */

/** 요청 본문 상한. 도구 인자는 짧다 — 덱 코드 하나 · id 목록 정도. */
export const MAX_BODY_BYTES = 64 * 1024;
/** 동시 실행 자리를 기다리는 상한. 넘으면 503. */
export const QUEUE_WAIT_MS = 5_000;
/** 처리 전체 상한. 넘으면 -32603 「시간 초과」로 먼저 답한다. 자리는 처리가 실제로 끝날 때 돌려준다. */
export const REQUEST_TIMEOUT_MS = 15_000;

/** 시험이 바꿔 끼우는 것들. 기본은 실제 서버 · 공용 세마포어 · 위 상수. */
export type McpHttpOptions = {
	createServer?: () => McpServer;
	semaphore?: ReturnType<typeof createSemaphore>;
	queueWaitMs?: number;
	requestTimeoutMs?: number;
};

const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '[::1]']);
const DEFAULT_SITE_URL = 'http://127.0.0.1:3100';

type Env = Record<string, string | undefined>;

function isProduction(env: Env): boolean {
	return env.NODE_ENV === 'production';
}

/** 프로덕션에서는 `MCP_ENABLED=1` 일 때만 켠다(기본 꺼짐 — 공개는 설계 §3 으로 막혀 있다). 개발에서는 켜짐. */
export function mcpEnabled(env: Env = process.env): boolean {
	return isProduction(env) ? env.MCP_ENABLED === '1' : env.MCP_ENABLED !== '0';
}

function siteOrigin(env: Env): URL | null {
	try {
		return new URL(env.SITE_URL?.trim() || DEFAULT_SITE_URL);
	} catch {
		return null;
	}
}

/**
 * DNS rebinding · 브라우저 교차 출처 호출 막기.
 * - Host: SITE_URL 의 호스트 이름 또는 루프백.
 * - Origin(있을 때만): SITE_URL 의 origin. 개발에서는 `http://127.0.0.1:*` · `http://localhost:*` · `http://[::1]:*` 도.
 *   Origin 이 없는 요청(CLI · 서버 간)은 통과한다.
 */
export function originAllowed(request: Request, env: Env = process.env): boolean {
	const site = siteOrigin(env);
	const hostHeader = request.headers.get('host') ?? new URL(request.url).host;
	let hostname: string;
	try {
		hostname = new URL(`http://${hostHeader}`).hostname;
	} catch {
		return false;
	}
	if (!LOOPBACK_HOSTS.has(hostname) && hostname !== site?.hostname) return false;

	const origin = request.headers.get('origin');
	if (origin === null) return true;
	let o: URL;
	try {
		o = new URL(origin);
	} catch {
		return false;
	}
	if (site && o.origin === site.origin) return true;
	return !isProduction(env) && o.protocol === 'http:' && LOOPBACK_HOSTS.has(o.hostname);
}

function rpcError(status: number, code: number, message: string, headers: Record<string, string> = {}): Response {
	return Response.json({ jsonrpc: '2.0', error: { code, message }, id: null }, { status, headers });
}

const notFound = () => new Response('Not Found', { status: 404 });

function isJsonContentType(value: string | null): boolean {
	return value?.split(';')[0]?.trim().toLowerCase() === 'application/json';
}

/** 본문을 상한 안에서만 읽는다. 넘으면 null(읽기를 끊는다). */
async function readCapped(request: Request, max: number): Promise<string | null> {
	if (!request.body) return '';
	const reader = request.body.getReader();
	const chunks: Uint8Array[] = [];
	let total = 0;
	for (;;) {
		const { done, value } = await reader.read();
		if (done) break;
		total += value.byteLength;
		if (total > max) {
			await reader.cancel().catch(() => {});
			return null;
		}
		chunks.push(value);
	}
	const bytes = new Uint8Array(total);
	let at = 0;
	for (const c of chunks) {
		bytes.set(c, at);
		at += c.byteLength;
	}
	return new TextDecoder().decode(bytes);
}

let warnedTrust = false;
function warnTrustOnce(env: Env): void {
	if (warnedTrust || !isProduction(env) || env.MCP_TRUST_PROXY === '1') return;
	warnedTrust = true;
	console.warn('[mcp] MCP_TRUST_PROXY 가 꺼져 있다 — 모든 호출자가 호출 제한 키 하나(direct)를 같이 쓴다.');
}

export async function handleMcpPost(request: Request, env: Env = process.env, options: McpHttpOptions = {}): Promise<Response> {
	const {
		createServer = createDossierServer,
		semaphore = mcpSemaphore,
		queueWaitMs = QUEUE_WAIT_MS,
		requestTimeoutMs = REQUEST_TIMEOUT_MS,
	} = options;
	if (!mcpEnabled(env)) return notFound();
	warnTrustOnce(env);
	// 이미 끊긴 요청은 토큰도 쓰지 않고 버린다. 처리 도중의 중단을 도구 안(DB 질의 등)까지
	// 전하는 것은 범위 밖이다 — 도구가 끝까지 돈 뒤 응답이 버려진다.
	if (request.signal.aborted) return new Response(null, { status: 499 });
	if (!originAllowed(request, env)) return rpcError(403, -32000, 'Forbidden origin or host.');
	if (!isJsonContentType(request.headers.get('content-type'))) {
		return rpcError(415, -32000, 'Unsupported Media Type: Content-Type must be application/json');
	}

	const key = clientKey(request.headers, clientIpConfig(env));
	if (!takeToken(key)) {
		const retryAfter = Math.max(1, retryAfterSeconds(key));
		return rpcError(429, -32000, `Rate limit exceeded. Retry after ${retryAfter}s.`, { 'Retry-After': String(retryAfter) });
	}

	const declared = Number(request.headers.get('content-length'));
	if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) {
		return rpcError(413, -32000, `Request body exceeds ${MAX_BODY_BYTES} bytes.`);
	}
	const text = await readCapped(request, MAX_BODY_BYTES);
	if (text === null) return rpcError(413, -32000, `Request body exceeds ${MAX_BODY_BYTES} bytes.`);
	let body: unknown;
	try {
		body = JSON.parse(text);
	} catch {
		return rpcError(400, -32700, 'Parse error: Invalid JSON');
	}
	// 배치는 받지 않는다(2025-06-18 판부터 프로토콜에서 빠졌다). 받으면 요청 하나가 호출 제한을 배수로 비켜 간다.
	if (Array.isArray(body)) return rpcError(400, -32600, 'Invalid Request: batch not supported');

	const slot = await semaphore.acquire(queueWaitMs);
	if (!slot.ok) return rpcError(503, -32000, 'Server busy. Retry later.', { 'Retry-After': '1' });

	if (request.signal.aborted) {
		slot.release();
		return new Response(null, { status: 499 });
	}

	// 실제 처리. 자리는 이것이 **실제로 끝날 때** 돌려준다 — 시간 초과로 응답을 먼저 돌려줘도 도구 안의 일
	// (DB 질의 · 엔진)은 계속 돌기 때문이다. 자리를 일찍 돌려주면 실제로 도는 일이 상한을 넘는다.
	// transport · server 도 그때 닫는다. 먼저 닫으면 JSON 응답 대기가 풀리지 않아 자리가 영영 안 돌아온다.
	// 한계: 끝나지 않는 도구는 자리를 계속 쥔다 — 바닥은 DB 역할의 statement_timeout(README 체크리스트).
	let timedOut = false;
	const work = (async (): Promise<Response> => {
		const server = createServer();
		// sessionIdGenerator 를 주지 않는 것이 무상태다(SDK 문서의 `sessionIdGenerator: undefined` 와 같다 —
		// exactOptionalPropertyTypes 라 생략으로 쓴다). 본문은 위에서 읽었으니 parsedBody 로 넘긴다
		// (전송은 Accept 검사 뒤 그것을 쓴다).
		const transport = new WebStandardStreamableHTTPServerTransport({ enableJsonResponse: true });
		try {
			await server.connect(transport);
			return await transport.handleRequest(request, { parsedBody: body });
		} finally {
			// JSON 응답 모드라 handleRequest 가 돌려줄 때 본문이 이미 다 찼다. 닫아도 응답은 그대로다.
			await transport.close().catch(() => {});
			await server.close().catch(() => {});
		}
	})();
	// 시간 초과 뒤의 늦은 실패는 여기서 받는다(처리 안 된 거절로 새지 않게). 제때의 실패는 아래 race 가 받는다.
	void work
		.catch(error => {
			if (timedOut) console.error('[mcp] request failed after timeout', error);
		})
		.finally(() => slot.release());

	let timer: ReturnType<typeof setTimeout> | undefined;
	try {
		const deadline = new Promise<'timeout'>(resolve => {
			timer = setTimeout(() => resolve('timeout'), requestTimeoutMs);
		});
		const winner = await Promise.race([work, deadline]);
		if (winner !== 'timeout') return winner;
		timedOut = true;
		return timeoutResponse(body);
	} catch (error) {
		console.error('[mcp] request failed', error);
		return rpcError(500, -32603, 'Internal error');
	} finally {
		clearTimeout(timer);
	}
}

/**
 * 시간 초과 응답. JSON-RPC 요청에 대한 오류이므로 HTTP 200 에 그 요청의 id 를 실어 보낸다 —
 * 클라이언트가 어느 요청의 실패인지 맞춰 볼 수 있게.
 */
function timeoutResponse(body: unknown): Response {
	const raw = body && typeof body === 'object' ? (body as { id?: unknown }).id : undefined;
	const id = typeof raw === 'string' || typeof raw === 'number' ? raw : null;
	return Response.json({ jsonrpc: '2.0', error: { code: -32603, message: 'Request timed out (시간 초과).' }, id });
}

/** GET(SSE) · DELETE(세션 종료) — 무상태라 받지 않는다. */
export function handleMcpOther(_request: Request, env: Env = process.env): Response {
	if (!mcpEnabled(env)) return notFound();
	return rpcError(405, -32000, 'Method not allowed. This server is stateless; use POST.', { Allow: 'POST' });
}
