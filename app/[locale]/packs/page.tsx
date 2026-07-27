import Link from 'next/link';
import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { isLocale } from '@/lib/locale';
import { UI } from '@/lib/ui-text';
import { listPackCategories, listPacks, readPackFilter } from '@/lib/queries/packs';
import type { SearchParams } from '@/lib/queries/shared';
import { ChipFilter, ClearFilters, SearchBox, TriFilter } from '@/components/filters';
import { Empty, Icon, Name, SecLabel } from '@/components/ui';

export default async function PacksPage({
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

	const filter = readPackFilter(sp);
	const [packs, categories] = await Promise.all([listPacks(locale, filter), listPackCategories()]);

	return (
		<>
			<SecLabel
				title={t.nav.packs}
				sub={ko ? '층 진입 시 선택하는 단위' : 'Chosen on entering a floor'}
				hint={`${packs.length}`}
			/>

			<Suspense fallback={<div className="filters" />}>
				<div className="filters">
					<SearchBox placeholder={ko ? '팩 이름 검색' : 'Search pack name'} />
					<ClearFilters label={ko ? '필터 해제' : 'Clear'} />
				</div>
				<div className="filter-axes">
					<ChipFilter
						param="category"
						label={ko ? '분류' : 'Category'}
						options={categories.map((c) => ({ value: c.id, label: `${c.id} ${c.count}` }))}
					/>
					<div className="filter-axis">
						<TriFilter param="superposition" label={ko ? '중첩' : 'Superposition'} />
						<TriFilter param="extreme" label={ko ? '극한' : 'Extreme'} />
						<TriFilter param="exclusive" label={ko ? '전용 기프트 보유' : 'Has exclusives'} />
					</div>
				</div>
			</Suspense>

			{packs.length === 0 ? (
				<Empty message={t.empty} />
			) : (
				<ul className="cardgrid cardgrid-wide">
					{packs.map((p) => (
						<li key={p.id}>
							<Link href={`/${locale}/packs/${p.id}`} className="card">
								<Icon src={p.icon} alt="" size={56} shape="wide" />
								<div className="card-body">
									<strong>
										<Name value={p.text} notice={t.fallbackNotice} />
									</strong>
									<span className="card-meta">
										<span className="tag">{p.category}</span>
										{p.superposition ? <span className="tag">{ko ? '중첩' : 'Super'}</span> : null}
										{p.extreme ? <span className="tag">{ko ? '극한' : 'Extreme'}</span> : null}
										<span className="tag">
											{ko ? '기프트' : 'Gifts'} {p.giftCount}
										</span>
										{p.exclusiveCount > 0 ? (
											<span className="tag tag-mark">
												{ko ? '전용' : 'Excl.'} {p.exclusiveCount}
											</span>
										) : null}
									</span>
									<span className="card-meta">
										{p.floors.length === 0 ? (
											<span className="absent">
												{ko ? '일반 층 순환에 등장하지 않음' : 'Not in the normal rotation'}
											</span>
										) : (
											p.floors.map((f) => (
												<span key={`${f.difficulty}${f.range}`} className="tag">
													{f.difficulty} {f.range}
												</span>
											))
										)}
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
