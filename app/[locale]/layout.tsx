import type { ReactNode } from 'react';
import { Suspense } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { isLocale } from '@/lib/locale';
import { UI } from '@/lib/ui-text';
import { SiteNav } from '@/components/site-nav';
import { LocaleSwitch } from '@/components/locale-switch';

/**
 * **사전 렌더하지 않는다.** ADR-05 3.2가 데이터의 기준 시점을 하나로 두기로 했고,
 * 7절이 프레임워크의 캐시 기본값을 명시적으로 다루는 것을 구현의 책임으로 남겼다.
 * 이 선언이 하위 라우트 전체에 적용된다.
 */
export const dynamic = 'force-dynamic';

export default async function LocaleLayout({
	children,
	params,
}: {
	children: ReactNode;
	params: Promise<{ locale: string }>;
}) {
	const { locale } = await params;
	if (!isLocale(locale)) notFound();

	const t = UI[locale];

	return (
		<>
			<header className="site-header">
				<div className="hbar">
					<div className="htitle">
						<Link href={`/${locale}`}>{t.appName}</Link>
						<span className="sub">{t.appSub}</span>
					</div>
					<Suspense fallback={null}>
						<LocaleSwitch locale={locale} />
					</Suspense>
				</div>
				<SiteNav locale={locale} />
			</header>

			<main className="site-main">{children}</main>

			<footer className="site-footer">
				<p>{t.sourceNotice}</p>
				<Link href={`/${locale}/about`}>{t.nav.about}</Link>
			</footer>
		</>
	);
}
