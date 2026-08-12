import Link from 'next/link';
import { notFound } from 'next/navigation';
import { isLocale } from '@/lib/locale';
import { UI } from '@/lib/ui-text';
import { getEgo } from '@/lib/queries/canonical/detail';
import { uiIcon } from '@/lib/assets';
import { SecLabel } from '@/components/ui';
import { EgoSheetView } from '@/components/ego-sheet';

/**
 * E.G.O 상세.
 *
 * 인격 상세(#26)와 같은 짜임이다 — 서류철에서 뽑은 한 장. 축이 다른 자리만 갈랐다.
 * 자세한 것은 `components/ego-sheet.tsx` 머리에 적었다.
 */
export default async function EgoDetailPage({
	params,
}: {
	params: Promise<{ locale: string; id: string }>;
}) {
	const { locale, id } = await params;
	if (!isLocale(locale)) notFound();

	const numeric = Number(id);
	if (!Number.isInteger(numeric)) notFound();

	const ego = await getEgo(numeric, locale);
	if (!ego) notFound();

	const t = UI[locale];
	const ko = locale === 'ko';

	/* 애셋 찾기가 파일 목록을 뒤지는 일이라 서버에서 찾아 넘긴다. */
	const icons = { coin: uiIcon('coin') };

	return (
		<>
			{/* 제목을 여기 두지 않는다 — 바로 아래 카드의 표제가 같은 것을 더 크게 말한다. */}
			<SecLabel
				title="E.G.O"
				hint={<Link href={`/${locale}/egos`}>{ko ? '목록으로' : 'Back to list'}</Link>}
			/>

			<EgoSheetView sheet={ego} locale={locale} notice={t.fallbackNotice} icons={icons} />

			{/* E.G.O 는 수감자에 붙는다. 그 수감자의 인격으로 잇는다. */}
			<p className="lede">
				<Link href={`/${locale}/identities?sinner=${ego.sinnerId}`}>
					{ko ? `${ego.sinner?.name ?? ''}의 인격 보기` : `View identities for ${ego.sinner?.name ?? ''}`}
				</Link>
			</p>
		</>
	);
}
