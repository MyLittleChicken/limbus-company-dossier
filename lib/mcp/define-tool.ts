import type { McpServer, RegisteredTool, ToolCallback } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AnySchema, SchemaOutput, ShapeOutput, ZodRawShapeCompat } from '@modelcontextprotocol/sdk/server/zod-compat.js';
import type { CallToolResult, ToolAnnotations } from '@modelcontextprotocol/sdk/types.js';
import { fail } from './envelope';
import { readToolCtx, type ToolCtx } from './version';

export type { ToolCtx } from './version';

/**
 * 호출자가 고칠 수 있는 입력 잘못(없는 id · 다른 질의의 커서 · 편성 밖 deployedIds …).
 * `defineTool` 이 문구 그대로 `fail(message)` 로 돌려준다 — 문구는 에이전트가 읽고 고칠 수 있게 쓴다.
 */
export class ToolInputError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'ToolInputError';
	}
}

export const INTERNAL_ERROR = '내부 오류 — 잠시 뒤 다시 시도하세요 (internal error)';

type HandlerArgs<I> = I extends ZodRawShapeCompat ? ShapeOutput<I> : I extends AnySchema ? SchemaOutput<I> : Record<string, never>;

export interface ToolConfig<O extends ZodRawShapeCompat | AnySchema, I extends undefined | ZodRawShapeCompat | AnySchema> {
	title?: string;
	description?: string;
	inputSchema?: I;
	outputSchema?: O;
	annotations?: ToolAnnotations;
	_meta?: Record<string, unknown>;
}

/**
 * `server.registerTool` 을 감싼다.
 *
 * - 호출 머리에 `ToolCtx`(snapshotId · dataVersion)를 **한 번** 읽어 handler 에 넘긴다 —
 *   한 응답 안의 봉투 · 커서 scope · engineData 키가 같은 판을 보게. handler 는 `ok(data, summary, ctx)`.
 * - `ToolInputError` → `fail(message)`.
 * - 그 밖의 예외 → 원문은 `console.error` 로만, 응답은 `INTERNAL_ERROR` (Prisma 원문 · 접속 정보 노출 금지).
 *
 * 입력 스키마 검증 실패는 SDK 가 handler 앞에서 `Input validation error: …` 로 돌려준다.
 */
export function defineTool<
	O extends ZodRawShapeCompat | AnySchema,
	I extends undefined | ZodRawShapeCompat | AnySchema = undefined,
>(
	server: McpServer,
	name: string,
	config: ToolConfig<O, I>,
	handler: (args: HandlerArgs<I>, ctx: ToolCtx) => Promise<CallToolResult>,
): RegisteredTool {
	const hasInput = config.inputSchema !== undefined;
	const run = async (...params: unknown[]): Promise<CallToolResult> => {
		// SDK 는 inputSchema 가 있으면 (args, extra), 없으면 (extra) 로 부른다
		const args = (hasInput ? params[0] : {}) as HandlerArgs<I>;
		try {
			const ctx = await readToolCtx();
			return await handler(args, ctx);
		} catch (error) {
			if (error instanceof ToolInputError) return fail(error.message);
			console.error(`[mcp] ${name} 실패`, error);
			return fail(INTERNAL_ERROR);
		}
	};
	return server.registerTool<O, I>(name, config, run as unknown as ToolCallback<I>);
}
