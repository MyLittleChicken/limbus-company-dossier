import * as z from 'zod';

/**
 * 도구들이 함께 쓰는 입력 인자. 상한을 여기서 한 번에 건다 — 길이 · 자릿수 · 제어문자.
 */

export const localeArg = z.enum(['ko', 'en']).default('ko').describe("응답 로케일 'ko' | 'en' (기본 ko)");

export const cursorArg = z.string().max(128).optional().describe('직전 응답의 nextCursor. 첫 페이지는 생략');

/** 게임 id — 양의 정수(≤ 999,999,999) 또는 1–9 자리 숫자 문자열. */
export const idArg = z
	.union([z.number().int().positive().max(999_999_999), z.string().regex(/^\d{1,9}$/)])
	.describe('id (숫자 또는 숫자 문자열)');

export function toId(v: number | string): number {
	return typeof v === 'number' ? v : Number(v);
}

/** 팩 id — `[\w-]{1,32}` 문자열 또는 양의 정수. 팩 id 는 문자열로 다룬다. */
export const packIdArg = z
	.union([z.string().regex(/^[\w-]{1,32}$/), z.number().int().positive().max(999_999_999)])
	.describe('팩 id');

export function toPackId(v: string | number): string {
	return String(v);
}

/** 검색어 — 100 자 이하, 제어문자(U+0000–U+001F) 없음. 빈 값 처리는 `cleanText`. */
export const queryArg = z
	.string()
	.max(100)
	.refine((s) => !/[\u0000-\u001f]/.test(s), { message: '제어문자는 쓸 수 없다 (control characters not allowed)' });

/** 앞뒤 공백을 떼고, 비었으면 `undefined` — 「검색어 없음」과 같게 다룬다. */
export function cleanText(s: string | undefined): string | undefined {
	const t = s?.trim();
	return t ? t : undefined;
}

export const READ_ONLY = { readOnlyHint: true, openWorldHint: false } as const;

/** 목록 도구 출력 모양. `envelopeShape({ ...pageShape(ROW) })` 로 쓴다. */
export function pageShape<I extends z.ZodType>(item: I) {
	return {
		items: z.array(item),
		total: z.number().int().nonnegative().describe('필터 뒤 전체 행 수'),
		nextCursor: z.string().nullable().describe('다음 페이지 커서. null 이면 끝'),
	};
}
