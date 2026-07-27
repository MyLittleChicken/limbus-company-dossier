import type { Locale } from '@prisma/client';

/**
 * 표시 로케일.
 *
 * ADR-03 2절이 한국어·영어 두 로케일을 로케일별 행으로 담기로 했고,
 * 05-ui-foundation 6절이 사용자에게 언어 선택을 노출하기로 정했다. 기본값은 한국어다.
 *
 * URL 의 첫 경로 조각이 로케일이다(`/ko/gifts`). 필터 상태를 URL 에 담기로 했으므로
 * (05-ui-foundation 3절) 로케일도 같은 층위에 두어야 주소 하나로 화면이 재현된다.
 */
export const LOCALES = ['ko', 'en'] as const satisfies readonly Locale[];

export const DEFAULT_LOCALE: Locale = 'ko';

export function isLocale(value: string): value is Locale {
	return (LOCALES as readonly string[]).includes(value);
}

/** 언어 전환 버튼에 쓰는 표기. 각 언어를 그 언어로 적는다. */
export const LOCALE_LABEL: Record<Locale, string> = {
	ko: '한국어',
	en: 'English',
};

/**
 * 로케일 행을 고르고 폴백 여부를 함께 돌려준다.
 *
 * ADR-03 5절 — 요청한 로케일이 없으면 영어를 쓰고, 영어도 없으면 표시하지 않는다.
 * **문자열을 만들어내지 않는다.** 폴백이 일어난 사실은 화면이 표기해야 하므로
 * 값과 함께 돌려준다. 한국어 화면에 영문이 섞이는 것은 결손의 결과이지 설계 의도가 아니다.
 */
export interface Localized<T> {
	row: T;
	/** 요청한 로케일이 없어 영어로 대체했다 */
	fellBack: boolean;
}

export function pickLocale<T extends { locale: Locale }>(
	rows: readonly T[],
	wanted: Locale,
): Localized<T> | null {
	const exact = rows.find((r) => r.locale === wanted);
	if (exact) return { row: exact, fellBack: false };

	const english = rows.find((r) => r.locale === 'en');
	if (english) return { row: english, fellBack: true };

	return null;
}
