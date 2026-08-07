/**
 * 표시 로케일.
 *
 * **여기가 이 타입의 집이다.** 전에는 v1 Prisma 클라이언트가 스키마의 `enum Locale`
 * 로 내주던 것을 화면 16곳이 가져다 썼는데, v1 스키마가 물러나면서 그 출처가
 * 사라졌다. 캐노니컬 클라이언트의 `$Enums.Locale` 은 `ja` 를 포함해 여기와
 * 다르다 — 데이터가 담은 로케일과 **화면이 내보내는 로케일은 별개**이며,
 * 그 차이를 타입으로 유지하려면 좁은 쪽을 여기서 따로 적어야 한다.
 */
export type Locale = 'ko' | 'en';

/**
 * 표시 로케일의 목록.
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
