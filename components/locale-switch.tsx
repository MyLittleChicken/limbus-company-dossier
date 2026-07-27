'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import type { Locale } from '@prisma/client';
import { LOCALES, LOCALE_LABEL } from '@/lib/locale';

/**
 * 언어 전환. 05-ui-foundation 6절이 노출하기로 정했다.
 *
 * **보던 화면을 유지한 채 바꾼다.** 로케일은 경로의 첫 조각이므로 그 자리만 교체하고
 * 나머지 경로와 질의 문자열은 그대로 둔다. 필터를 걸어둔 목록에서 언어만 바뀌어야 한다.
 */
export function LocaleSwitch({ locale }: { locale: Locale }) {
	const pathname = usePathname();
	const search = useSearchParams().toString();

	const swap = (next: Locale) => {
		const rest = pathname.split('/').slice(2).join('/');
		const path = rest ? `/${next}/${rest}` : `/${next}`;
		return search ? `${path}?${search}` : path;
	};

	return (
		<div className="locale-switch">
			{LOCALES.map((code) =>
				code === locale ? (
					<span key={code} aria-current="true">
						{LOCALE_LABEL[code]}
					</span>
				) : (
					<Link key={code} href={swap(code)} hrefLang={code}>
						{LOCALE_LABEL[code]}
					</Link>
				),
			)}
		</div>
	);
}
