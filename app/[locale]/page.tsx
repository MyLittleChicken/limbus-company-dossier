import Link from 'next/link';
import {getCurrentHome} from '@/lib/queries/home';
import {CurrentHome} from '@/components/current-home';
import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { isLocale } from '@/lib/locale';
import { UI } from '@/lib/ui-text';
import { searchAll } from '@/lib/queries/canonical/reference';

import { one, type SearchParams } from '@/lib/queries/shared';
import { SearchBox } from '@/components/filters';
import { Empty, Icon } from '@/components/ui';

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

	const [hits, current] = await Promise.all([
		query ? searchAll(query, locale) : Promise.resolve([]),
		getCurrentHome(locale),
	]);

	const kindLabel = {
		gift: t.nav.gifts,
		pack: t.nav.packs,
		identity: t.nav.identities,
		ego: t.nav.egos,
	} as const;

	return (
		<>
			<div className="home-search-row"><Suspense fallback={null}><SearchBox placeholder={t.search} /></Suspense></div>
			{!query && <CurrentHome data={current} locale={locale} />}

			{query && (
				<section className="search-results">
					<h1>{ko ? '검색 결과' : 'Search results'}</h1>
					{hits.length === 0 ? (
						<Empty message={ko ? '검색 결과가 없습니다.' : 'No results found.'} />
					) : (
						(['identity', 'ego', 'gift', 'pack'] as const).map((kind) => {
							const rows = hits.filter((hit) => hit.kind === kind);
							return rows.length ? (
								<section key={kind} className="search-result-group">
									<h3>
										{kindLabel[kind]} <span>{rows.length}</span>
									</h3>
									<ul>
										{rows.map((hit) => (
											<li key={hit.id}>
												<Link href={hit.href}>
													<Icon src={hit.icon} alt="" size={48} />
													<span>
														<strong>{hit.name ?? (ko ? '이름 없음' : 'Unnamed')}</strong>
														<small>{hit.meta}</small>
													</span>
													<span aria-hidden="true" className="result-arrow">
														→
													</span>
												</Link>
											</li>
										))}
									</ul>
								</section>
							) : null;
						})
					)}
				</section>
			)}
		</>
	);
}
