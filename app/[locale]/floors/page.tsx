import Link from 'next/link';
import { notFound } from 'next/navigation';
import { isLocale } from '@/lib/locale';
import { UI } from '@/lib/ui-text';
import { listFloorPacks } from '@/lib/queries/reference';
import { Icon, Name, Panel, SecLabel } from '@/components/ui';

/**
 * 층별 등장 팩.
 *
 * 이 화면이 이후 단계의 접점이다(05-ui-foundation 1절). 2단계에서는 순서 없는 목록이고,
 * 4단계에서 파티 구성과 보유 기프트가 더해지면 그 순서가 점수로 바뀐다.
 */
export default async function FloorsPage({ params }: { params: Promise<{ locale: string }> }) {
	const { locale } = await params;
	if (!isLocale(locale)) notFound();

	const t = UI[locale];
	const ko = locale === 'ko';
	const groups = await listFloorPacks(locale);

	return (
		<>
			<SecLabel
				title={t.nav.floors}
				sub={ko ? '난이도·구간별 등장 팩' : 'Packs by difficulty and floor range'}
				hint={`${groups.length} ${ko ? '구간' : 'ranges'}`}
			/>

			<p className="lede">
				{ko
					? '원본 구간은 hard 가 1 · 2 · 3 · 4 · 5 · 6–10 · 11–15 이고 normal 이 1–5 다. 후반 층일수록 상위 등급 팩이 배정된다.'
					: 'Hard is split into 1, 2, 3, 4, 5, 6–10 and 11–15; normal is a single 1–5 band.'}
			</p>

			{groups.map((group) => (
				<Panel
					key={`${group.difficulty}-${group.range}`}
					title={`${group.difficulty} · ${group.range}`}
					hint={group.packs.length}
				>
					<ul className="inline-list">
						{group.packs.map((p) => (
							<li key={p.id}>
								<Link href={`/${locale}/packs/${p.id}`} className="inline-gift">
									<Icon src={p.icon} alt="" size={34} shape="wide" />
									<Name value={p.text} notice={t.fallbackNotice} />
								</Link>
							</li>
						))}
					</ul>
				</Panel>
			))}
		</>
	);
}
