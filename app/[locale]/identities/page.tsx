import Link from 'next/link';
import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { isLocale } from '@/lib/locale';
import { UI } from '@/lib/ui-text';
import {
	listAffiliations,
	listIdentities,
	listSinners,
	readIdentityFilter,
} from '@/lib/queries/identities';
import { listSins } from '@/lib/queries/gifts';
import type { SearchParams } from '@/lib/queries/shared';
import { ChipFilter, ClearFilters, SearchBox } from '@/components/filters';
import { Empty, Icon, IconOnly, Name, SecLabel } from '@/components/ui';
import { rarityIcon } from '@/lib/assets';

export default async function IdentitiesPage({
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

	const filter = readIdentityFilter(sp);
	const [identities, sinners, affiliations, sins] = await Promise.all([
		listIdentities(locale, filter),
		listSinners(locale),
		listAffiliations(locale),
		listSins(locale),
	]);

	return (
		<>
			<SecLabel
				title={t.nav.identities}
				sub={ko ? '전투에 편성하는 단위' : 'Deployable units'}
				hint={`${identities.length}`}
			/>

			<Suspense fallback={<div className="filters" />}>
				<div className="filters">
					<SearchBox placeholder={ko ? '인격 이름 검색' : 'Search identity name'} />
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
					{/* 게임 표기 0 / 00 / 000 으로 노출한다(00-product 3절). */}
					<ChipFilter
						param="rarity"
						label={ko ? '등급' : 'Rarity'}
						options={[1, 2, 3].map((r) => ({
							value: String(r),
							label: '0'.repeat(r),
							icon: rarityIcon(r),
						}))}
					/>
					<ChipFilter
						param="sin"
						label={ko ? '스킬 죄악' : 'Skill sin'}
						options={sins.map((s) => ({ value: s.id, label: s.text?.name ?? s.id }))}
					/>
					<ChipFilter
						param="affiliation"
						label={ko ? '소속' : 'Affiliation'}
						options={affiliations.map((a) => ({
							value: a.id,
							// 필터 키는 원본 영문 태그이고 표시만 로케일 행에서 온다(ADR-03 5절).
							label: a.text?.name ?? a.id,
						}))}
					/>
				</div>
			</Suspense>

			{identities.length === 0 ? (
				<Empty message={t.empty} />
			) : (
				<ul className="cardgrid">
					{identities.map((i) => (
						<li key={i.id}>
							<Link href={`/${locale}/identities/${i.id}`} className="card">
								<Icon src={i.image} alt="" size={52} />
								<div className="card-body">
									<strong>
										<Name value={i.text} notice={t.fallbackNotice} />
									</strong>
									<span className="card-meta">
										<IconOnly src={rarityIcon(i.rarity)} label={'0'.repeat(i.rarity)} />
										<span className="tag">S{i.season}</span>
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
