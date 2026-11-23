import { handleMcpOther, handleMcpPost } from '@/lib/mcp/http';

/**
 * `/mcp` — Streamable HTTP, 무상태(설계 §4). 요청마다 서버와 전송을 새로 만들고 응답 뒤 닫는다.
 * 세션 id 가 없으므로 GET(SSE 스트림) · DELETE(세션 종료)는 받지 않는다.
 * 읽기 전용이고 로그인이 없다. 몸통(켜짐 · 출처 · 호출 제한 · 본문 · 동시 실행)은 lib/mcp/http.ts.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export function POST(request: Request): Promise<Response> {
	return handleMcpPost(request);
}

export function GET(request: Request): Response {
	return handleMcpOther(request);
}

export function DELETE(request: Request): Response {
	return handleMcpOther(request);
}
