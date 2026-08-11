import Link from 'next/link';
import { notFound } from 'next/navigation';
import { isLocale } from '@/lib/locale';
import { UI } from '@/lib/ui-text';
import { getIdentity } from '@/lib/queries/canonical/detail';
import { uiIcon } from '@/lib/assets';
import { SecLabel } from '@/components/ui';
import { IdentitySheetView } from '@/components/identity-sheet';

/**
 * 인격 상세.
 *
 * 시안 F 를 그대로 옮겼다(`publish/lab/identity-f.html`). 서류철에서 뽑은 한 장의 꼴이다 —
 * 색인 · 문서 번호 · 이중 테두리 · 대지에 붙인 사진.
 *
 * **계산기가 아니다.** 레벨과 동기화는 값을 다시 계산하는 장치가 아니라 무엇을 보여줄지
 * 고르는 것이다. 체력 · 공격 레벨 · 방어 레벨만 레벨을 따라 움직이는데, 셋 다 게임이
 * 레벨에서 곧장 유도하는 값이라 특정 전투에 기대지 않는다.
 */
export default async function IdentityDetailPage({
	params,
}: {
	params: Promise<{ locale: string; id: string }>;
}) {
	const { locale, id } = await params;
	if (!isLocale(locale)) notFound();

	const numeric = Number(id);
	if (!Number.isInteger(numeric)) notFound();

	const sheet = await getIdentity(numeric, locale);
	if (!sheet) notFound();

	const t = UI[locale];
	const ko = locale === 'ko';

	/*
		공용 그림은 서버에서 찾아 넘긴다.

		애셋 찾기가 파일 목록을 뒤지는 일이라 클라이언트에서 할 수 없다. 공격·방어 레벨과
		속도는 `icons/` 에 이미 있는 그림이며 새로 만들지 않았다.
	*/
	const icons = {
		coin: uiIcon('coin'),
		offense: uiIcon('offense level'),
		defense: uiIcon('defense level'),
		speed: uiIcon('speed'),
	};

	return (
		<>
			{/*
				제목을 여기 두지 않는다 — 바로 아래 카드의 표제가 같은 것을 더 크게 말한다.
				이 줄은 되돌아가는 길만 진다.
			*/}
			<SecLabel
				title={ko ? '인격' : 'Identity'}
				hint={<Link href={`/${locale}/identities`}>{ko ? '목록으로' : 'Back to list'}</Link>}
			/>

			<IdentitySheetView sheet={sheet} locale={locale} notice={t.fallbackNotice} icons={icons} />

			{/* E.G.O 는 수감자에 붙는다. 인격 상세에 싣지 않고 목록으로 잇는다. */}
			<p className="lede">
				<Link href={`/${locale}/egos?sinner=${sheet.sinnerId}`}>
					{ko
						? `${sheet.sinner?.name ?? ''}의 E.G.O 보기`
						: `View E.G.O for ${sheet.sinner?.name ?? ''}`}
				</Link>
			</p>
		</>
	);
}
