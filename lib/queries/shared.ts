import type { Locale } from '@/lib/locale';
import { pickLocale } from '@/lib/locale';

/**
 * 로케일 행을 다루는 공통부.
 *
 * 표시 문자열은 엔티티에서 분리되어 로케일별 행으로 있다(ADR-03 2절). 질의는 언제나
 * 요청 로케일과 영어를 **함께** 가져온다. 폴백이 일어났는지 판정하려면 두 행이 다 필요하고,
 * 그 사실을 화면이 표기해야 하기 때문이다(ADR-03 5절).
 */
export const localeFilter = (locale: Locale) => ({
	where: { locale: { in: [locale, 'en'] as Locale[] } },
});

export interface Named {
	name: string;
	/** 한국어가 없어 영문을 노출했다 */
	fellBack: boolean;
}

/** 이름이 어느 로케일에도 없으면 null 이다. **문자열을 만들어내지 않는다**(02-data-model 6절). */
export function nameOf<T extends { locale: Locale; name: string }>(
	texts: readonly T[],
	locale: Locale,
): Named | null {
	const picked = pickLocale(texts, locale);
	return picked ? { name: picked.row.name, fellBack: picked.fellBack } : null;
}

export interface Described extends Named {
	desc: string;
}

export function textOf<T extends { locale: Locale; name: string; desc: string }>(
	texts: readonly T[],
	locale: Locale,
): Described | null {
	const picked = pickLocale(texts, locale);
	return picked
		? { name: picked.row.name, desc: picked.row.desc, fellBack: picked.fellBack }
		: null;
}

/** 목록 화면의 한 쪽 크기. 팩 상세의 기프트 188개는 페이지를 나누지 않는다. */
export const PAGE_SIZE = 60;

export function pageOf(value: string | undefined): number {
	const n = Number(value ?? '1');
	return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1;
}

/** 질의 문자열의 반복 파라미터를 집합으로 읽는다. `?tier=1&tier=2` 와 `?tier=1,2` 를 모두 받는다. */
export function multi(value: string | string[] | undefined): string[] {
	if (value === undefined) return [];
	const list = Array.isArray(value) ? value : [value];
	return list.flatMap((v) => v.split(',')).filter(Boolean);
}

export function one(value: string | string[] | undefined): string | undefined {
	if (value === undefined) return undefined;
	return Array.isArray(value) ? value[0] : value;
}

export type SearchParams = Record<string, string | string[] | undefined>;
