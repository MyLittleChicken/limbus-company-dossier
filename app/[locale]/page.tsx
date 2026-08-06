import Link from 'next/link';
import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { isLocale } from '@/lib/locale';
import { NAV_PRIMARY, UI } from '@/lib/ui-text';
import { getCounts, getBuildInfo, searchAll } from '@/lib/queries/canonical/reference';

import { one, type SearchParams } from '@/lib/queries/shared';
import { SearchBox } from '@/components/filters';
import { Empty, Icon, SecLabel } from '@/components/ui';

export default async function HomePage({
	params,
	searchParams,
}: {
	params: Promise<{ locale: string }>;
	searchParams: Promise<SearchParams>;
}) {
	const { locale } = await params;
	if (!isLocale(locale)) notFound();
	const sp = await searchParams;

	const t = UI[locale];
	const ko = locale === 'ko';
	const query = one(sp['q'])?.trim() ?? '';

	const [counts, build, hits] = await Promise.all([
		getCounts(),
		getBuildInfo(),
		query ? searchAll(query, locale) : Promise.resolve([]),
	]);

	const countOf = {
		gifts: counts.gifts,
		packs: counts.packs,
		identities: counts.identities,
		egos: counts.egos,
	} as const;

	const kindLabel = {
		gift: t.nav.gifts,
		pack: t.nav.packs,
		identity: t.nav.identities,
		ego: t.nav.egos,
	} as const;

	return (
		<>
			<SecLabel title={t.appName} sub={t.appSub} />

			<Suspense fallback={<div className="filters" />}>
				<div className="filters">
					<SearchBox placeholder={t.search} />
				</div>
			</Suspense>

			{query ? (
				<section className="search-results">
					<SecLabel
						title={ko ? '검색 결과' : 'Results'}
						sub={`"${query}"`}
						hint={`${hits.length}`}
					/>
					{hits.length === 0 ? (
						<Empty message={t.empty} />
					) : (
						<ul className="cardgrid">
							{hits.map((hit) => (
								<li key={`${hit.kind}-${hit.id}`}>
									<Link href={hit.href} className="card">
										<Icon src={hit.icon} alt="" size={40} />
										<div className="card-body">
											<strong>
												{hit.name ?? <span className="missing">{ko ? '이름 없음' : 'Unnamed'}</span>}
												{hit.fellBack ? (
													<abbr className="fellback" title={t.fallbackNotice}>
														EN
													</abbr>
												) : null}
											</strong>
											<span className="card-meta">
												<span className="tag">{kindLabel[hit.kind]}</span>
												<span className="tag">{hit.meta}</span>
											</span>
										</div>
									</Link>
								</li>
							))}
						</ul>
					)}
				</section>
			) : null}

			<ul className="cardgrid entry-grid">
				{NAV_PRIMARY.map((key) => (
					<li key={key}>
						<Link href={`/${locale}/${key}`} className="card card-entry">
							<strong>{t.nav[key]}</strong>
							<span className="entry-n">{countOf[key]}</span>
						</Link>
					</li>
				))}
			</ul>

			<ul className="cardgrid entry-grid">
				<li>
					<Link href={`/${locale}/floors`} className="card card-entry">
						<strong>{t.nav.floors}</strong>
					</Link>
				</li>
				<li>
					<Link href={`/${locale}/dungeon`} className="card card-entry">
						<strong>{t.nav.dungeon}</strong>
					</Link>
				</li>
				<li>
					<Link href={`/${locale}/glossary`} className="card card-entry">
						<strong>{t.nav.glossary}</strong>
						<span className="entry-n">{counts.statuses}</span>
					</Link>
				</li>
			</ul>

			{/* 기준 버전은 /about 에만 두지 않는다 — 05-ui-foundation 10절 */}
			{build ? (
				<p className="stamp">
					{build.mdVersion} · {build.snapshotId}{' '}
					{ko ? '스냅샷' : 'snapshot'}
				</p>
			) : null}
		</>
	);
}
