import Link from 'next/link';
import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { isLocale } from '@/lib/locale';
import { UI } from '@/lib/ui-text';
import { EGO_RANKS, listEgos, readEgoFilter } from '@/lib/queries/egos';
import { listSinners } from '@/lib/queries/identities';
import { listSins } from '@/lib/queries/gifts';
import type { SearchParams } from '@/lib/queries/shared';
import { ChipFilter, ClearFilters, SearchBox, TriFilter } from '@/components/filters';
import { Empty, Icon, Name, SecLabel } from '@/components/ui';

export default async function EgosPage({
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

	const filter = readEgoFilter(sp);
	const [egos, sinners, sins] = await Promise.all([
		listEgos(locale, filter),
		listSinners(locale),
		listSins(locale),
	]);

	return (
		<>
			<SecLabel
				title="E.G.O"
				sub={ko ? '인격에 장착하는 특수 기술' : 'Special abilities equipped to a Sinner'}
				hint={`${egos.length}`}
			/>

			<Suspense fallback={<div className="filters" />}>
				<div className="filters">
					<SearchBox placeholder={ko ? 'E.G.O 이름 검색' : 'Search E.G.O name'} />
					<ClearFilters label={ko ? '필터 해제' : 'Clear'} />
				</div>
				<div className="filter-axes">
					<ChipFilter
						param="sinner"
						label={ko ? '수감자' : 'Sinner'}
						options={sinners.map((s) => ({
							value: String(s.id),
							label: s.text?.name ?? String(s.id),
							icon: s.icon,
						}))}
					/>
					{/* ALEPH 은 실측 0종이지만 축에서 빼지 않는다(02-data-model 4.4). */}
					<ChipFilter
						param="rank"
						label={ko ? '등급' : 'Rank'}
						options={EGO_RANKS.map((r) => ({ value: r, label: r }))}
					/>
					<ChipFilter
						param="sin"
						label={ko ? '각성 죄악' : 'Awaken sin'}
						options={sins.map((s) => ({ value: s.id, label: s.text?.name ?? s.id }))}
					/>
					<div className="filter-axis">
						<TriFilter param="corrosion" label={ko ? '침식 있음' : 'Has corrosion'} />
						<TriFilter param="extractable" label={ko ? '추출 가능' : 'Extractable'} />
					</div>
				</div>
			</Suspense>

			{egos.length === 0 ? (
				<Empty message={t.empty} />
			) : (
				<ul className="cardgrid">
					{egos.map((e) => (
						<li key={e.id}>
							<Link href={`/${locale}/egos/${e.id}`} className="card">
								<Icon src={e.image} alt="" size={52} />
								<div className="card-body">
									<strong>
										<Name value={e.text} notice={t.fallbackNotice} />
									</strong>
									<span className="card-meta">
										<span className="tag">{e.rank}</span>
										<span className="tag">{e.awakenAffinity}</span>
										{e.costs.map((c) => (
											<span key={c.sin} className="tag">
												{c.sin} {c.amount}
											</span>
										))}
									</span>
								</div>
							</Link>
						</li>
					))}
				</ul>
			)}
		</>
	);
}
