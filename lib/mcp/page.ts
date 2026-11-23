import { createHash } from 'node:crypto';

/**
 * 목록 도구의 커서 페이지(설계 §9 「목록 페이지 크기 · 커서 방식」).
 *
 * 커서는 「다음 시작 위치 + 질의 범위(scope)의 짧은 해시」를 base64url 로 감싼 불투명
 * 문자열이다. 에이전트는 받은 `nextCursor` 를 그대로 되돌려 주기만 한다.
 *
 * - 잘못된 커서는 처음부터 주지 않고 **오류**로 던진다 — 조용히 첫 페이지를 주면 에이전트가
 *   같은 행을 두 번 읽고도 모른다.
 * - 다른 질의(필터가 다른 호출)의 커서도 오류다. 호출자는 `scope` 에
 *   `JSON.stringify(필터 인자, 커서 제외)` 를 넘긴다.
 *
 * 도구 핸들러 안에서 던지면 SDK 가 `isError` 결과로 바꿔 준다.
 */
const PREFIX = 'o';

function scopeHash(scope: string): string {
	return createHash('sha256').update(scope, 'utf8').digest('base64url').slice(0, 8);
}

export function encodeCursor(offset: number, scope: string): string {
	return Buffer.from(`${PREFIX}:${offset}:${scopeHash(scope)}`, 'utf8').toString('base64url');
}

export function decodeCursor(cursor: string, scope: string): number {
	const parts = Buffer.from(cursor, 'base64url').toString('utf8').split(':');
	const offset = parts.length === 3 && parts[0] === PREFIX ? Number(parts[1]) : NaN;
	const hash = parts[2] ?? '';
	if (!Number.isSafeInteger(offset) || offset < 0 ||
		Buffer.from(`${PREFIX}:${offset}:${hash}`, 'utf8').toString('base64url') !== cursor) {
		throw new Error(`잘못된 커서: ${cursor} — 직전 응답의 nextCursor 를 그대로 넘기세요`);
	}
	if (hash !== scopeHash(scope)) {
		throw new Error('이 커서는 다른 질의의 것이다 — 필터를 바꿨다면 cursor 없이 처음부터 다시 부르세요');
	}
	return offset;
}

export function paginate<T>(
	rows: T[],
	cursor: string | undefined,
	scope: string,
	size = 50,
): { items: T[]; nextCursor: string | null; total: number } {
	if (!Number.isSafeInteger(size) || size < 1) throw new Error(`페이지 크기는 1 이상 정수: ${size}`);
	const start = cursor === undefined || cursor === '' ? 0 : decodeCursor(cursor, scope);
	const end = start + size;
	return {
		items: rows.slice(start, end),
		nextCursor: end < rows.length ? encodeCursor(end, scope) : null,
		total: rows.length,
	};
}
