import Link from 'next/link';
import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { isLocale } from '@/lib/locale';
import { UI } from '@/lib/ui-text';
import {
	GIFT_TIER_LABEL,
	GIFT_TIERS,
	NO_KEYWORD,
	listGifts,
	listKeywords,
	readGiftFilter,
} from '@/lib/queries/gifts';
import type { SearchParams } from '@/lib/queries/shared';
import { ChipFilter, ClearFilters, PickFilter, SearchBox } from '@/components/filters';
import { Empty, IconTag, Name, Pager, SecLabel } from '@/components/ui';
import { keywordIcon } from '@/lib/assets';

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

	// 죄악 축은 화면에 내지 않는다. 게임에서 무엇을 하는지 확인되지 않았기 때문이며
	// (docs/backlog/03-gift-affinity.md), 그래서 죄악 목록을 질의하지도 않는다.
	const [result, keywords] = await Promise.all([
		listGifts(locale, filter),
		listKeywords(locale),
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
						// 게임이 카드에 로마자를 인쇄한다. 애셋으로는 없어 글자로 낸다.
						options={GIFT_TIERS.map((v) => ({ value: v, label: GIFT_TIER_LABEL[v] ?? v }))}
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
					<PickFilter
						param="pool"
						label={locale === 'ko' ? '풀' : 'Pool'}
						options={[
							{ value: 'exclusive', label: locale === 'ko' ? '팩 전용' : 'Pack-exclusive' },
							{ value: 'general', label: locale === 'ko' ? '범용' : 'General' },
						]}
					/>
				</div>
			</Suspense>

			{result.items.length === 0 ? (
				<Empty message={t.empty} />
			) : (
				<ul className="cardgrid cardgrid-gift">
					{result.items.map((g) => (
						<li key={g.id}>
							<Link href={`/${locale}/gifts/${g.id}`} className="card unit">
								{/* 이름을 맨 위 좌측에 한 줄로 — 인격·E.G.O·팩 카드와 같은 골격이다. */}
								<strong className="unit-name" title={g.text?.name ?? undefined}>
									<Name value={g.text} notice={t.fallbackNotice} />
								</strong>
								<span className="unit-art">
									{g.icon ? (
										/* eslint-disable-next-line @next/next/no-img-element -- 로컬 정적 파일이다 */
										<img src={g.icon} alt="" loading="lazy" />
									) : null}
									{/* 등급은 게임처럼 로마자다. 그림 좌측 상단에 얹어 이름 자리를 비운다. */}
									<span className="gift-tier">{GIFT_TIER_LABEL[g.tier] ?? g.tier}</span>
								</span>
								<span className="card-meta">
									{/*
									 * 죄악 속성은 카드에 내지 않는다. 원본에 있는 값이지만 게임에서
									 * 무엇을 하는지 확인되지 않았다(docs/backlog/03-gift-affinity.md).
									 * 확인 전까지 등급·키워드와 같은 무게로 두지 않는다.
									 */}
									{g.keyword ? (
										<IconTag src={g.keywordId ? keywordIcon(g.keywordId) : null}>
											{g.keyword.name}
										</IconTag>
									) : (
										// 키워드 없는 기프트 120 종. 결손이 아니라 축의 값이다.
										<span className="tag absent">{locale === 'ko' ? '키워드 없음' : 'No keyword'}</span>
									)}
									{g.exclusiveCount > 0 ? (
										<span className="tag tag-mark">
											{locale === 'ko' ? '전용' : 'Exclusive'}
										</span>
									) : null}
								</span>
							</Link>
						</li>
					))}
				</ul>
			)}

			<Pager base={`/${locale}/gifts`} params={sp} page={result.page} pageCount={result.pageCount} />
		</>
	);
}
