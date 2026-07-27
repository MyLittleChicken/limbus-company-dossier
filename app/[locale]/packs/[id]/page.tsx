import Link from 'next/link';
import { notFound } from 'next/navigation';
import { isLocale } from '@/lib/locale';
import { UI } from '@/lib/ui-text';
import { getPack } from '@/lib/queries/packs';
import { Facts, Icon, Name, Nothing, Panel, SecLabel } from '@/components/ui';

/**
 * 팩 상세 — 3단 구성(05-ui-foundation 4.2).
 *   1. 전용 기프트 — 이 팩을 고를 이유
 *   2. 전체 풀의 축별 분포 — 188개를 읽지 않고 성격을 판단
 *   3. 전체 목록 — 접은 상태
 */
export default async function PackDetailPage({
	params,
}: {
	params: Promise<{ locale: string; id: string }>;
}) {
	const { locale, id } = await params;
	if (!isLocale(locale)) notFound();

	const pack = await getPack(id, locale);
	if (!pack) notFound();

	const t = UI[locale];
	const ko = locale === 'ko';

	const giftLink = (g: (typeof pack.gifts)[number]) => (
		<li key={g.id}>
			<Link href={`/${locale}/gifts/${g.id}`} className="inline-gift">
				<Icon src={g.icon} alt="" size={24} />
				<Name value={g.text} notice={t.fallbackNotice} />
				<span className="tag">{g.tier}</span>
			</Link>
		</li>
	);

	const bar = (rows: Array<[string | null, number]>, total: number) => (
		<ul className="dist">
			{rows.map(([key, n]) => (
				<li key={String(key)}>
					<span className="dist-key">{key ?? (ko ? '없음' : 'None')}</span>
					<span className="dist-bar" style={{ width: `${Math.round((n / total) * 100)}%` }} />
					<span className="dist-n">{n}</span>
				</li>
			))}
		</ul>
	);

	return (
		<>
			<SecLabel
				title={pack.text?.name ?? (ko ? '이름 없음' : 'Unnamed')}
				sub={t.nav.packs}
				hint={<Link href={`/${locale}/packs`}>{ko ? '목록으로' : 'Back to list'}</Link>}
			/>

			<div className="grid2">
				<div>
					<Panel
						title={ko ? '전용 기프트' : 'Exclusive gifts'}
						hint={pack.exclusiveGifts.length}
					>
						{pack.exclusiveGifts.length === 0 ? (
							<Nothing kind="absent">
								{ko ? '이 팩에만 나오는 기프트가 없다' : 'No pack-exclusive gifts'}
							</Nothing>
						) : (
							<ul className="inline-list">{pack.exclusiveGifts.map(giftLink)}</ul>
						)}
					</Panel>

					<Panel title={ko ? '전체 풀 분포' : 'Pool distribution'} hint={pack.gifts.length}>
						{pack.gifts.length === 0 ? (
							<Nothing kind="absent">{ko ? '등장 기프트 정보 없음' : 'No pool data'}</Nothing>
						) : (
							<div className="dist-group">
								<h4>{ko ? '등급' : 'Tier'}</h4>
								{bar(pack.distribution.tier, pack.gifts.length)}
								<h4>{ko ? '키워드' : 'Keyword'}</h4>
								{bar(pack.distribution.keyword, pack.gifts.length)}
								<h4>{ko ? '죄악' : 'Sin'}</h4>
								{bar(pack.distribution.affinity, pack.gifts.length)}
							</div>
						)}
					</Panel>

					{pack.gifts.length > 0 && (
						<details className="panel bulk">
							<summary className="panel-h">
								<h3>{ko ? '등장 기프트 전체' : 'All gifts in pool'}</h3>
								<span className="hint">{pack.gifts.length}</span>
							</summary>
							<div className="panel-b">
								<ul className="inline-list">{pack.gifts.map(giftLink)}</ul>
							</div>
						</details>
					)}
				</div>

				<aside>
					<Panel title={ko ? '속성' : 'Attributes'}>
						<div className="hero-icon">
							<Icon src={pack.icon} alt="" size={160} shape="wide" />
						</div>
						<Facts
							rows={[
								[ko ? '분류' : 'Category', pack.category],
								[
									ko ? '변형' : 'Variant',
									pack.variant ?? <Nothing kind="absent">{ko ? '없음' : 'None'}</Nothing>,
								],
								[
									ko ? '장' : 'Chapter',
									pack.chapter ?? <Nothing kind="absent">{ko ? '없음' : 'None'}</Nothing>,
								],
								[ko ? '중첩' : 'Superposition', pack.superposition ? 'O' : 'X'],
								[ko ? '극한' : 'Extreme', pack.extreme ? 'O' : 'X'],
								[
									ko ? '차지 층 수' : 'Floor length',
									pack.floorLength ?? <Nothing kind="absent">{ko ? '없음' : 'None'}</Nothing>,
								],
							]}
						/>
					</Panel>

					<Panel title={ko ? '등장 층' : 'Floors'} hint={pack.floors.length}>
						{pack.floors.length === 0 ? (
							// 21종이 여기 걸린다. 결손이 아니라 일반 순환에 없다는 뜻이다.
							<Nothing kind="absent">
								{ko ? '일반 층 순환에 등장하지 않는다' : 'Not in the normal floor rotation'}
							</Nothing>
						) : (
							<ul className="inline-list">
								{pack.floors.map((f) => (
									<li key={`${f.difficulty}${f.range}`} className="tag">
										{f.difficulty} {f.range}
									</li>
								))}
							</ul>
						)}
					</Panel>

					<Panel title={ko ? '등장 보스' : 'Boss encounters'} hint={pack.bosses.length}>
						{pack.bosses.length === 0 ? (
							<Nothing kind="absent">{ko ? '없음' : 'None'}</Nothing>
						) : (
							<ul className="inline-list">
								{pack.bosses.map((b) => (
									<li key={b} className="tag">
										{b}
									</li>
								))}
							</ul>
						)}
					</Panel>

					<p className="absent">
						{ko
							? '기프트 등장 확률은 어느 출처에도 없어 표시하지 않는다.'
							: 'Drop rates are absent from every source and are not shown.'}
					</p>
				</aside>
			</div>
		</>
	);
}
