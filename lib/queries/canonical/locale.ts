import type { Locale } from '@prisma/client';
import type { $Enums } from '@/src/v2/generated/client';
import type { Named } from '@/lib/queries/shared';

/**
 * 캐노니컬 층의 로케일 공통부.
 *
 * **`@/lib/queries/shared` 를 그대로 못 쓴다.** 그쪽 헬퍼는 행의 `locale` 을
 * `Locale`(= `ko | en`)로 받는데, 캐노니컬 행은 `ko | en | ja` 라 좁혀지지 않는다 —
 * 대입이 한 방향으로만 성립한다. 여기서는 `locale: string` 으로 받아 그 벽을 넘는다.
 *
 * 표시 로케일 자체는 여전히 앱의 정본(`lib/locale.ts` 의 `ko | en`)이다. 캐노니컬이
 * 일본어를 더 갖고 있을 뿐이며, 이 PR 은 그것을 화면에 열지 않는다.
 *
 * 폴백 규칙은 ADR-03 5절이다 — 요청한 것이 없으면 영어로 물러서고 **폴백이 일어난
 * 사실을 함께 돌려준다.**
 */

/**
 * 질의가 가져올 로케일 행. 요청한 것과 영어를 **함께** 가져와야 폴백을 판정할 수 있다.
 *
 * 캐노니컬의 `Locale` 로 좁힌다 — 그쪽이 `ja` 를 더 갖고 있어 앱의 `ko | en` 이
 * 그대로는 안 들어간다.
 */
export const localeRows = (locale: Locale) => ({
	where: { locale: { in: [locale, 'en'] as $Enums.Locale[] } },
});

function pick<T extends { locale: string }>(
	rows: readonly T[],
	locale: Locale,
): { row: T; fellBack: boolean } | null {
	const exact = rows.find((r) => r.locale === locale);
	if (exact) return { row: exact, fellBack: false };
	const en = rows.find((r) => r.locale === 'en');
	return en ? { row: en, fellBack: true } : null;
}

/**
 * 이름이 어느 로케일에도 없으면 `null` 이다.
 * **문자열을 만들어내지 않는다**(02-data-model 6절).
 */
export function nameOf<T extends { locale: string; name: string }>(
	rows: readonly T[],
	locale: Locale,
): Named | null {
	const picked = pick(rows, locale);
	return picked ? { name: picked.row.name, fellBack: picked.fellBack } : null;
}

export interface DescribedNullable extends Named {
	/**
	 * 캐노니컬에서는 **null 일 수 있다**(상태 설명 실측 27행).
	 *
	 * 현행은 같은 자리에 빈 문자열을 넣었다. 캐노니컬은 없는 것을 만들어내지 않는다 —
	 * 화면이 「설명 없음」과 「빈 설명」을 가릴 수 있어야 한다.
	 */
	desc: string | null;
}

export function textOf<T extends { locale: string; name: string; desc: string | null }>(
	rows: readonly T[],
	locale: Locale,
): DescribedNullable | null {
	const picked = pick(rows, locale);
	return picked
		? { name: picked.row.name, desc: picked.row.desc, fellBack: picked.fellBack }
		: null;
}

/**
 * 게임이 두 줄로 흘려 쓰는 이름이 있어 줄바꿈이 들어 있다 — 한 줄로 편다.
 * `canonical/list.ts` 가 목록에서 겪은 것과 같다.
 */
export const clean = (s: string) => s.replace(/\s+/g, ' ').trim();
