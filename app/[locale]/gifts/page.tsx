import Link from 'next/link';
import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { isLocale } from '@/lib/locale';
import { UI } from '@/lib/ui-text';
import {
	GIFT_TIERS,
	NO_KEYWORD,
	listGifts,
	listKeywords,
	listSins,
	readGiftFilter,
} from '@/lib/queries/gifts';
import type { SearchParams } from '@/lib/queries/shared';
import { ChipFilter, ClearFilters, PickFilter, SearchBox, TriFilter } from '@/components/filters';
import { Empty, Icon, IconTag, Name, Pager, SecLabel } from '@/components/ui';
import { keywordIcon, sinIcon } from '@/lib/assets';

export default async function GiftsPage({
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
	const filter = readGiftFilter(sp);

	const [result, keywords, sins] = await Promise.all([
		listGifts(locale, filter),
		listKeywords(locale),
		listSins(locale),
	]);

	return (
		<>
			<SecLabel
				title={t.nav.gifts}
				sub={locale === 'ko' ? '거울 던전에서 획득하는 강화 요소' : 'Mirror Dungeon rewards'}
				hint={`${result.total}`}
			/>

			<Suspense fallback={<div className="filters" />}>
				<div className="filters">
					<SearchBox placeholder={t.search} />
					<ClearFilters label={locale === 'ko' ? '필터 해제' : 'Clear'} />
				</div>

				<div className="filter-axes">
					<ChipFilter
						param="tier"
						label={locale === 'ko' ? '등급' : 'Tier'}
						options={GIFT_TIERS.map((v) => ({ value: v, label: v }))}
					/>
					<ChipFilter
						param="keyword"
						label={locale === 'ko' ? '키워드' : 'Keyword'}
						options={[
							...keywords.map((k) => ({
								value: k.id,
								label: k.text?.name ?? k.id,
								icon: keywordIcon(k.id),
							})),
							// 키워드 없는 기프트 120종. 결손이 아니라 축의 값이다.
							{ value: NO_KEYWORD, label: locale === 'ko' ? '없음' : 'None' },
						]}
					/>
					<ChipFilter
						param="affinity"
						label={locale === 'ko' ? '죄악' : 'Sin'}
						options={sins.map((s) => ({
							value: s.id,
							label: s.text?.name ?? s.id,
							icon: sinIcon(s.id),
						}))}
					/>
					<PickFilter
						param="pool"
						label={locale === 'ko' ? '풀' : 'Pool'}
						options={[
							{ value: 'exclusive', label: locale === 'ko' ? '팩 전용' : 'Pack-exclusive' },
							{ value: 'general', label: locale === 'ko' ? '범용' : 'General' },
						]}
					/>
					<div className="filter-axis">
						<TriFilter param="enhanceable" label={locale === 'ko' ? '강화 가능' : 'Enhanceable'} />
						<TriFilter param="hard" label={locale === 'ko' ? 'hard 전용' : 'Hard only'} />
					</div>
				</div>
			</Suspense>

			{result.items.length === 0 ? (
				<Empty message={t.empty} />
			) : (
				<ul className="cardgrid">
					{result.items.map((g) => (
						<li key={g.id}>
							<Link href={`/${locale}/gifts/${g.id}`} className="card">
								<Icon src={g.icon} alt="" size={44} />
								<div className="card-body">
									<strong>
										<Name value={g.text} notice={t.fallbackNotice} />
									</strong>
									<span className="card-meta">
										<span className="tag">{g.tier}</span>
										<IconTag src={sinIcon(g.affinity)} label={g.affinity} />
										{g.keyword ? (
											<IconTag src={g.keywordId ? keywordIcon(g.keywordId) : null}>
												{g.keyword.name}
											</IconTag>
										) : null}
										{g.exclusiveCount > 0 ? (
											<span className="tag tag-mark">
												{locale === 'ko' ? '전용' : 'Exclusive'}
											</span>
										) : null}
									</span>
								</div>
							</Link>
						</li>
					))}
				</ul>
			)}

			<Pager base={`/${locale}/gifts`} params={sp} page={result.page} pageCount={result.pageCount} />
		</>
	);
}
