import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import * as z from 'zod';
import { readToolCtx, type ToolCtx } from './version';

export { currentSnapshotId, dataVersion, readToolCtx, type ToolCtx } from './version';

/**
 * MCP 응답 봉투 — 성공 응답 머리에 `snapshotId` · `dataVersion`(설계 §5 「데이터 기준 표시」).
 * 판 계산은 `./version` 이 맡는다. 이전 호출부 호환으로 `currentSnapshotId` 등을 여기서도 내보낸다.
 */

/** 도구 `outputSchema` 에 봉투 머리를 더한다. 모든 도구가 이것으로 출력 모양을 선언한다. */
export function envelopeShape<S extends z.ZodRawShape>(shape: S) {
	return {
		snapshotId: z.string().nullable().describe('데이터 기준 스냅샷 id. 상세는 get_build_info'),
		dataVersion: z.string().describe('라이브 갱신까지 반영한 데이터 판. 바뀌면 이전 커서는 못 쓴다'),
		...shape,
	};
}

/**
 * JSON 으로 그대로 옮겨지는 값인지 본다 — plain object · array · 원시값 · Date · undefined 만.
 *
 * Map · Set · 클래스 인스턴스는 `JSON.stringify` 가 `{}` 로 조용히 비운다. 그런 값이
 * 응답에 섞이면 결손을 빈 값으로 감추는 셈이라(설계 §2 반목표) 던진다. 도구가 먼저
 * 배열·객체로 바꿔 넘길 것.
 */
function assertJsonSafe(value: unknown, path: string): void {
	if (value === null || value === undefined) return;
	const kind = typeof value;
	if (kind === 'string' || kind === 'boolean') return;
	if (kind === 'number') {
		if (!Number.isFinite(value)) throw new Error(`응답에 JSON 으로 못 옮기는 수가 있다: ${path} = ${String(value)}`);
		return;
	}
	if (kind !== 'object') throw new Error(`응답에 JSON 으로 못 옮기는 값이 있다: ${path} (${kind})`);
	if (value instanceof Date) return;
	if (Array.isArray(value)) {
		value.forEach((v, i) => assertJsonSafe(v, `${path}[${i}]`));
		return;
	}
	const proto = Object.getPrototypeOf(value);
	if (proto !== Object.prototype && proto !== null) {
		const name = (proto?.constructor?.name as string | undefined) ?? 'unknown';
		throw new Error(`응답에 plain object 가 아닌 값이 있다: ${path} (${name}) — 배열·객체로 바꿔 넘길 것`);
	}
	for (const [k, v] of Object.entries(value)) assertJsonSafe(v, `${path}.${k}`);
}

/**
 * 성공 응답.
 *
 *   structuredContent = { ...data, snapshotId: ctx.snapshotId, dataVersion: ctx.dataVersion } — 봉투가 이긴다
 *   content[0].text   = summary + '\n' + JSON.stringify(structuredContent)  (압축 JSON)
 *
 * text 에도 JSON 을 싣는다 — structuredContent 를 안 읽고 text 만 모델에 넘기는 클라이언트가
 * 있어서다(요약 한 줄만 주면 그런 클라이언트에서 데이터가 사라진다).
 *
 * `ctx` 는 `defineTool` 이 호출 머리에 한 번 읽어 넘긴다. 빠지면 여기서 읽는다(2인자 호출 호환).
 *
 * `data` 는 JSON 으로 한 번 왕복시킨다 — `Date` 는 ISO 문자열로, `undefined` 키는 빠진다.
 * in-memory 전송은 객체를 그대로 넘겨서 클라이언트의 outputSchema 검사가 `Date` 를 문자열로
 * 보지 않는다. 왕복 전에 `assertJsonSafe` 로 Map · Set · 클래스 인스턴스를 거른다(던진다).
 */
export async function ok<T extends object>(data: T, summary: string, ctx?: ToolCtx): Promise<CallToolResult> {
	assertJsonSafe(data, 'data');
	const { snapshotId, dataVersion } = ctx ?? (await readToolCtx());
	const body = JSON.parse(JSON.stringify(data)) as Record<string, unknown>;
	const structuredContent = { ...body, snapshotId, dataVersion };
	return {
		structuredContent,
		content: [{ type: 'text', text: `${summary}\n${JSON.stringify(structuredContent)}` }],
	};
}

/** 실패 응답. 「없는 id」「덱 코드를 풀지 못했다」 등. snapshotId 는 일부러 없다. */
export function fail(message: string): CallToolResult {
	return { isError: true, content: [{ type: 'text', text: message }] };
}
