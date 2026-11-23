import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { ListToolsRequestSchema, type JSONRPCMessage, type ListToolsResult } from '@modelcontextprotocol/sdk/types.js';
import pkg from '@/package.json';
import { registerCatalogTools } from './tools/catalog';
import { registerDungeonTools } from './tools/dungeon';
import { registerEngineTools } from './tools/engine';
import { registerMetaTools } from './tools/meta';

/**
 * 서버 instructions — 에이전트가 연결 때 한 번 읽는다.
 * 출처 · 2차 창작 표시 · 면책(01-data-source 7절)과 응답을 말할 때의 단서를 담는다.
 */
export const SERVER_INSTRUCTIONS = `Limbus Company 도감 (limbus-dossier) — 읽기 전용 MCP.

출처 / Source: 게임 클라이언트 데이터, 저작권 Project Moon. Game client data © Project Moon.
비공식 팬 제작 2차 창작 사이트다. Project Moon 과 관계없고 승인받지 않았다.
Unofficial fan-made site; not affiliated with or endorsed by Project Moon. 데이터가 게임과 다를 수 있다 — 정확성을 보증하지 않는다.

- 성공 응답에는 snapshotId(데이터 기준 스냅샷)와 dataVersion(라이브 갱신까지 반영한 판)이 있다. 상세는 get_build_info. dataVersion 이 바뀌면 이전 nextCursor 는 못 쓴다 — 처음부터 다시 부른다.
- 응답에 이미지는 없다. 사용자에게 보여 줄 링크는 siteUrl 을 쓴다.
- locale: 'ko' | 'en' (기본 ko). fellBack: true 면 다른 로케일 문구로 대신한 것이다.
- 축은 두 층이다: tag(인격 취급) · skill(스킬 취급). 섞지 않는다.
- 기프트 판정(check_gifts)은 강화 0단계 절만 본다 (enhancement stage 0 only). 켜짐은 on · partial · possible · off 네 값이다 (partial = 일부 능력만 켜짐). on 은 편성(진입 시점) 조건 확정 충족이며 전투 중 발동 조건은 범위 밖이다.
- 팩 점수(score_packs)는 참고값이다 (provisional) — 저울추가 사람 검토 전이다. 사실처럼 단정하지 말 것.
- 출격 규칙 / deploy rule: 편성 순서 1..7 이 출격(sortie), 8..12 가 대기. identityIds 는 목록 차례가 편성 순서다. deployedIds 를 주면 그것이 우선한다.`;

function buildServer(): McpServer {
	const server = new McpServer(
		{ name: 'limbus-dossier', version: pkg.version },
		{ instructions: SERVER_INSTRUCTIONS },
	);
	registerMetaTools(server);
	registerCatalogTools(server);
	registerDungeonTools(server);
	registerEngineTools(server);
	// 무상태 전송(요청마다 서버 생성)이라 도구 목록 변경 알림을 보낼 수 없다. 도구를 등록하면
	// SDK 가 listChanged: true 를 넣으므로, 등록을 마친 뒤 연결 전에 덮어쓴다.
	server.server.registerCapabilities({ tools: { listChanged: false } });
	return server;
}

/**
 * `tools/list` 응답을 프로세스에 한 번만 만든다.
 *
 * 무상태라 요청마다 서버가 새로 서고, SDK 는 `tools/list` 때마다 zod → JSON Schema 변환을 다시 한다
 * (실측 23 ms · 69 KB). 도구 등록은 결정적이고(같은 코드 → 같은 목록) 런타임에 바꾸지 않으므로
 * (enable/disable/update 를 쓰지 않는다) 첫 결과를 기억해도 된다.
 *
 * 만드는 법은 공개 API 만 쓴다 — 덮어쓰지 않은 서버 하나를 InMemoryTransport 에 붙이고 JSON-RPC
 * `tools/list` 를 날 것으로 보내 SDK 자신의 응답을 그대로 받는다(클라이언트 파싱을 거치지 않아
 * 필드가 깎이지 않는다). 이후 각 서버는 `setRequestHandler(ListToolsRequestSchema)` 로 그것을 준다.
 * 실패하면 기억하지 않는다 — 다음 요청이 다시 만든다.
 */
let toolList: Promise<ListToolsResult> | null = null;

/** 덮어쓰지 않은 서버의 날 `tools/list` 응답. 시험이 기억한 것과 대조할 때도 쓴다. */
export async function computeToolList(): Promise<ListToolsResult> {
	const server = buildServer();
	const [mine, theirs] = InMemoryTransport.createLinkedPair();
	const reply = new Promise<JSONRPCMessage>((resolve) => {
		mine.onmessage = (message) => {
			if ('id' in message && message.id === 1) resolve(message);
		};
	});
	await server.connect(theirs);
	await mine.start();
	try {
		await mine.send({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} });
		const message = await reply;
		if (!('result' in message)) throw new Error(`tools/list 실패: ${JSON.stringify(message).slice(0, 200)}`);
		return message.result as ListToolsResult;
	} finally {
		await server.close();
	}
}

export function cachedToolList(): Promise<ListToolsResult> {
	if (!toolList) {
		const mine = computeToolList();
		toolList = mine;
		mine.catch(() => {
			if (toolList === mine) toolList = null;
		});
	}
	return toolList;
}

/** 모든 도구를 등록한 MCP 서버. 프레임워크 무관 — 전송은 호출하는 쪽(`app/mcp/route.ts` · 시험)이 붙인다. */
export function createDossierServer(): McpServer {
	const server = buildServer();
	server.server.setRequestHandler(ListToolsRequestSchema, () => cachedToolList());
	return server;
}
