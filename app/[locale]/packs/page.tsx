import Link from 'next/link';
import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { isLocale } from '@/lib/locale';
import { PACK_CATEGORY, UI } from '@/lib/ui-text';
import { listPackCategories, listPacks, readPackFilter } from '@/lib/queries/packs';
import type { SearchParams } from '@/lib/queries/shared';
import { ChipFilter, ClearFilters, SearchBox, TriFilter } from '@/components/filters';
import { Empty, Name, SecLabel } from '@/components/ui';
import { PackArt } from '@/components/pack-art';
import { comparePackKind, packKind } from '@/lib/pack-label';
import { listCollabPackIds } from '@/lib/queries/canonical/packs';

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
	const [packs, categories, collabIds] = await Promise.all([
		listPacks(locale, filter),
		listPackCategories(),
		// 콜라보 판정은 캐노니컬 태그에만 있다. 이름으로 짐작하지 않는다.
		listCollabPackIds(),
	]);

	// 필터 칩은 분류 축을 그대로 남긴다. 모르는 값이 오면 그대로 낸다 — 숨기지 않는다.
	const categoryLabel = (id: string) => PACK_CATEGORY[locale][id] ?? id;

	/*
		차례를 종류로 세운다.

		질의는 `category` 알파벳 순으로 내려주는데 그 차례에는 뜻이 없다 — 범용 41 종이
		`attack_type` · `keyword` · `sin` 세 덩이로 갈려 목록 앞·중간·뒤에 따로 나왔다.
		늘 고를 수 있는 것을 먼저, 한정을 뒤로 놓는다.
	*/
	const sorted = packs
		.map((pack) => ({
			pack,
			kind: packKind(
				{
					category: pack.category,
					chapter: pack.chapter,
					sprite: pack.sprite,
					collab: collabIds.has(pack.id),
				},
				locale,
			),
		}))
		.sort((a, b) => comparePackKind(a.kind, b.kind, a.pack.id, b.pack.id));

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
						options={categories.map((c) => ({
								value: c.id,
								label: `${categoryLabel(c.id)} ${c.count}`,
							}))}
					/>
					<div className="filter-axis">
						<TriFilter param="superposition" label={ko ? '중첩' : 'Superposition'} />
						<TriFilter param="extreme" label={ko ? '극한' : 'Extreme'} />
						<TriFilter param="exclusive" label={ko ? '전용 기프트 보유' : 'Has exclusives'} />
					</div>
				</div>
			</Suspense>

			{sorted.length === 0 ? (
				<Empty message={t.empty} />
			) : (
				<ul className="cardgrid cardgrid-wide">
					{sorted.map(({ pack: p, kind }) => (
						<li key={p.id}>
							<Link href={`/${locale}/packs/${p.id}`} className="card unit">
								{/* 이름을 맨 위 좌측에 둔다 — 인격·E.G.O 카드와 같은 골격이다. */}
								<strong className="unit-name" title={p.text?.name ?? undefined}>
									<Name value={p.text} notice={t.fallbackNotice} />
								</strong>
								{/*
									봉지 · 보스 · 광택 · 이름을 겹쳐 낸다. 봉지만 내면 8각 창과 이름 띠가
									비어 팩을 알아볼 수 없다(`publish/PACK-ART.md`).
								*/}
								<PackArt id={p.id} sprite={p.sprite} name={p.text?.name ?? null} />
								<span className="card-meta">
									{/*
										언제 고를 수 있는 팩인가 하나. 무엇에 대한 팩인지는 그림과 이름이
										이미 말하므로 되풀이하지 않는다. 등장 층은 상세에 있다 — 난이도 ×
										구간 조합이 팩마다 하나에서 여덟까지 달라 카드 높이가 제멋대로였다.
									*/}
									<span className="tag">{kind.label}</span>
								</span>
							</Link>
						</li>
					))}
				</ul>
			)}
		</>
	);
}
