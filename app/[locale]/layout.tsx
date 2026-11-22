import type { ReactNode } from 'react';
import { Suspense } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { isLocale } from '@/lib/locale';
import { UI } from '@/lib/ui-text';
import { SiteNav } from '@/components/site-nav';
import { LocaleSwitch } from '@/components/locale-switch';
import {ReferencePreviews} from '@/components/reference-previews';
import {SiteMotion} from '@/components/site-motion';
import { ThemeToggle } from '@/components/theme-toggle';

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
			<a className="skip-link" href="#main">
				{locale === 'ko' ? '본문으로 이동' : 'Skip to content'}
			</a>
			<header className="site-header" id="top">
				<div className="hbar">
					<Link className="brand" href={`/${locale}`}>
						<img className="brand-mark" src="/brand/dossier-mark.png" width={40} height={40} alt="" />
						<div className="brand-wordmark">Limbus Company<span>Dossier</span></div>
					</Link>
					<SiteNav locale={locale} />
					<div className="header-actions">
						<Suspense fallback={null}>
							<LocaleSwitch locale={locale} />
						</Suspense>
						<ThemeToggle ko={locale === 'ko'} />
					</div>
				</div>
			</header>

			<main className="site-main" id="main">
				<Suspense fallback={null}><SiteMotion /></Suspense>
                <ReferencePreviews locale={locale}>{children}</ReferencePreviews>
			</main>

			<footer className="site-footer">
				<div className="footer-document">
					<div className="footer-identity">
						<img className="brand-mark" src="/brand/dossier-mark.png" width={44} height={44} alt="" />
						<div><strong>Limbus Company Dossier</strong><p>{locale === 'ko' ? '수감자 기록 · 거울 던전 자료' : 'Sinner records · Mirror Dungeon reference'}</p></div>
					</div>
					<dl className="footer-routing">
						<div><dt>{locale === 'ko' ? '열람 대상' : 'ADDRESSEE'}</dt><dd>{locale === 'ko' ? '관리자 단테' : 'Manager Dante'}</dd></div>
						<div><dt>{locale === 'ko' ? '문서 분류' : 'CLASSIFICATION'}</dt><dd>{locale === 'ko' ? '참조 자료' : 'Reference copy'}</dd></div>
					</dl>
				</div>
				<p>{t.sourceNotice}</p>
				<Link href={`/${locale}/about`}>{t.nav.about}</Link>
			</footer>
		</>
	);
}
