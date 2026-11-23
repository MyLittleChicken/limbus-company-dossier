import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import * as z from 'zod';
import { cacheReference } from '@/lib/query-cache';
import { getBuildInfo } from '@/lib/queries/canonical/reference';

/**
 * MCP 응답 봉투 — 모든 도구 응답 머리에 `snapshotId` 하나(설계 §5 「데이터 기준 표시」).
 *
 * 스냅샷 id 는 자주 바뀌지 않으므로 1 분 캐시한다. DB 에 스냅샷 행이 없으면 `null`.
 * `engineData()`(axes.ts) 도 이것을 캐시 키로 쓴다 — 봉투의 snapshotId 와 판정 데이터가
 * 같은 스냅샷을 가리키게.
 */
export const currentSnapshotId = cacheReference(
	async (): Promise<string | null> => (await getBuildInfo())?.snapshotId ?? null,
	60_000,
);

/** 도구 `outputSchema` 에 봉투 머리를 더한다. 모든 도구가 이것으로 출력 모양을 선언한다. */
export function envelopeShape<S extends z.ZodRawShape>(shape: S) {
	return { snapshotId: z.string().nullable(), ...shape };
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
 * 성공 응답. `structuredContent = { ...data, snapshotId }`, `content[0].text = summary`.
 * `data` 에 `snapshotId` 가 있어도 봉투의 것이 이긴다.
 *
 * `data` 는 JSON 으로 한 번 왕복시킨다 — `Date` 는 ISO 문자열로, `undefined` 키는 빠진다.
 * HTTP 전송이면 어차피 그렇게 되지만 in-memory 전송은 객체를 그대로 넘겨서, 클라이언트의
 * outputSchema 검사(JSON Schema)가 `Date` 를 문자열로 보지 않는다. 두 전송의 답을 같게 한다.
 * 왕복 전에 `assertJsonSafe` 로 Map · Set · 클래스 인스턴스를 거른다(던진다).
 */
export async function ok<T extends object>(data: T, summary: string): Promise<CallToolResult> {
	assertJsonSafe(data, 'data');
	const snapshotId = await currentSnapshotId();
	const body = JSON.parse(JSON.stringify(data)) as Record<string, unknown>;
	return {
		structuredContent: { ...body, snapshotId },
		content: [{ type: 'text', text: summary }],
	};
}

/** 실패 응답. 도구는 throw 하지 않고 이것을 돌려준다 — 「없는 id」「덱 코드를 풀지 못했다」 등. snapshotId 는 일부러 없다. */
export function fail(message: string): CallToolResult {
	return { isError: true, content: [{ type: 'text', text: message }] };
}
