'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { Locale } from '@prisma/client';
import { NAV_PRIMARY, NAV_SECONDARY, UI } from '@/lib/ui-text';

/**
 * 활성 표시가 현재 경로에 달려 있어 클라이언트 컴포넌트다.
 * 렌더 자체는 서버에서 끝나고 브라우저가 받는 것은 활성 판정뿐이다.
 */
export function SiteNav({ locale }: { locale: Locale }) {
	const pathname = usePathname();
	const t = UI[locale];

	const item = (key: keyof typeof t.nav) => {
		const href = `/${locale}/${key}`;
		// 상세 경로(`/ko/gifts/9001`)에서도 목록 탭이 활성이어야 한다.
		const active = pathname === href || pathname.startsWith(`${href}/`);
		return (
			<Link key={key} href={href} aria-current={active ? 'page' : undefined}>
				{t.nav[key]}
			</Link>
		);
	};

	return (
		<nav className="site-nav">
			{NAV_PRIMARY.map(item)}
			<span className="nav-sep" aria-hidden="true" />
			{NAV_SECONDARY.map(item)}
		</nav>
	);
}
