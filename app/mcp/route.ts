import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { createDossierServer } from '@/lib/mcp/server';
import { clientKey, retryAfterSeconds, takeToken } from '@/lib/mcp/rate-limit';

/**
 * `/mcp` — Streamable HTTP, 무상태(설계 §4). 요청마다 서버와 전송을 새로 만들고 응답 뒤 닫는다.
 * 세션 id 가 없으므로 GET(SSE 스트림) · DELETE(세션 종료)는 받지 않는다.
 * 읽기 전용이고 로그인이 없다. 호출 제한은 lib/mcp/rate-limit.ts(설계 §5).
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** 요청 본문 상한. 도구 인자는 짧다 — 덱 코드 하나 · id 목록 정도. */
const MAX_BODY_BYTES = 64 * 1024;

function rpcError(status: number, code: number, message: string, headers: Record<string, string> = {}): Response {
	return Response.json({ jsonrpc: '2.0', error: { code, message }, id: null }, { status, headers });
}

export async function POST(request: Request): Promise<Response> {
	// 이미 끊긴 요청은 토큰도 쓰지 않고 버린다. 처리 도중의 중단을 도구 안(DB 질의 등)까지
	// 전하는 것은 범위 밖이다 — 도구가 끝까지 돈 뒤 응답이 버려진다.
	if (request.signal.aborted) return new Response(null, { status: 499 });

	// MCP_TRUST_PROXY=1 일 때만 x-forwarded-for 를 키로 쓴다(믿을 앞단이 있을 때).
	const key = clientKey(request.headers, process.env.MCP_TRUST_PROXY === '1');
	if (!takeToken(key)) {
		const retryAfter = Math.max(1, retryAfterSeconds(key));
		return rpcError(429, -32000, `Rate limit exceeded. Retry after ${retryAfter}s.`, { 'Retry-After': String(retryAfter) });
	}

	const declared = Number(request.headers.get('content-length'));
	if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) {
		return rpcError(413, -32000, `Request body exceeds ${MAX_BODY_BYTES} bytes.`);
	}

	let server: McpServer | undefined;
	let transport: WebStandardStreamableHTTPServerTransport | undefined;
	try {
		server = createDossierServer();
		// sessionIdGenerator 를 주지 않는 것이 무상태다(SDK 문서의 `sessionIdGenerator: undefined` 와 같다 —
		// exactOptionalPropertyTypes 라 생략으로 쓴다). 청크 전송 본문의 상한은 전송이 413 으로 막는다.
		transport = new WebStandardStreamableHTTPServerTransport({
			enableJsonResponse: true,
			maxRequestBodySize: MAX_BODY_BYTES,
		});
		await server.connect(transport);
		return await transport.handleRequest(request);
	} catch (error) {
		console.error('[mcp] request failed', error);
		return rpcError(500, -32603, 'Internal error');
	} finally {
		// JSON 응답 모드라 handleRequest 가 돌려줄 때 본문이 이미 다 찼다. 닫아도 응답은 그대로다.
		await transport?.close().catch(() => {});
		await server?.close().catch(() => {});
	}
}

function methodNotAllowed(): Response {
	return rpcError(405, -32000, 'Method not allowed. This server is stateless; use POST.', { Allow: 'POST' });
}

export const GET = methodNotAllowed;
export const DELETE = methodNotAllowed;
