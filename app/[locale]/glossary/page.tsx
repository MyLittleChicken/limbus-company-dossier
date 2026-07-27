import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { isLocale } from '@/lib/locale';
import { UI } from '@/lib/ui-text';
import { listGlossaryAxes, listStatuses, readGlossaryFilter } from '@/lib/queries/reference';
import type { SearchParams } from '@/lib/queries/shared';
import { ChipFilter, ClearFilters, SearchBox } from '@/components/filters';
import { Empty, Icon, Name, Nothing, Pager, Panel, SecLabel } from '@/components/ui';

export default async function GlossaryPage({
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

	const filter = readGlossaryFilter(sp);
	const [statuses, axes] = await Promise.all([
		listStatuses(locale, filter),
		listGlossaryAxes(locale),
	]);

	return (
		<>
			<SecLabel
				title={t.nav.glossary}
				sub={ko ? '상태 · 죄악 · 키워드' : 'Statuses, sins, keywords'}
				hint={`${statuses.total}`}
			/>

			<div className="grid2">
				<div>
					<Suspense fallback={<div className="filters" />}>
						<div className="filters">
							<SearchBox placeholder={ko ? '상태 이름·설명 검색' : 'Search status'} />
							<ClearFilters label={ko ? '필터 해제' : 'Clear'} />
						</div>
						<div className="filter-axes">
							{/* 판정은 이름이 아니라 buffType 메타데이터로 한다(02-data-model 3.10). */}
							<ChipFilter
								param="buff"
								label={ko ? '성격' : 'Type'}
								options={axes.buffTypes.map((b) => ({
									value: b.id,
									label: `${b.id} ${b.count}`,
								}))}
							/>
						</div>
					</Suspense>

					{statuses.items.length === 0 ? (
						<Empty message={t.empty} />
					) : (
						<ul className="plain status-list">
							{statuses.items.map((s) => (
								<li key={s.id}>
									<div className="row-head">
										<Icon src={s.icon} alt="" size={24} />
										<strong>
											{s.text ? (
												<Name value={s.text} notice={t.fallbackNotice} />
											) : (
												<Nothing kind="missing">{ko ? '이름 없음' : 'Unnamed'}</Nothing>
											)}
										</strong>
										<span className="tag">{s.buffType}</span>
										<code className="idcode">{s.id}</code>
									</div>
									{s.text?.desc ? <p className="desc">{s.text.desc}</p> : null}
								</li>
							))}
						</ul>
					)}

					<Pager
						base={`/${locale}/glossary`}
						params={sp}
						page={statuses.page}
						pageCount={statuses.pageCount}
					/>
				</div>

				<aside>
					<Panel title={ko ? '죄악' : 'Sins'} hint={axes.sins.length}>
						<ul className="inline-list">
							{axes.sins.map((s) => (
								<li key={s.id} className="tag">
									<Name value={s.text} notice={t.fallbackNotice} />
									{/* 게임이 죄악마다 부여한 색 이름. 디자인 단계의 색 축이 된다. */}
									<em className="attr">{s.attribute}</em>
								</li>
							))}
						</ul>
					</Panel>

					{/* 상태 7종 + 공격 타입 3종을 한 축으로 다룬다(02-data-model 4.3). */}
					<Panel title={ko ? '키워드' : 'Keywords'} hint={axes.keywords.length}>
						<ul className="inline-list">
							{axes.keywords.map((k) => (
								<li key={k.id} className="tag">
									<Name value={k.text} notice={t.fallbackNotice} />
								</li>
							))}
						</ul>
					</Panel>

					<p className="absent">
						{ko
							? '아이콘이 없는 상태 254종은 수치 변화형이라 게임에도 아이콘이 없다. 결손이 아니다.'
							: '254 statuses have no icon in the game itself. That is absence, not a gap.'}
					</p>
				</aside>
			</div>
		</>
	);
}
