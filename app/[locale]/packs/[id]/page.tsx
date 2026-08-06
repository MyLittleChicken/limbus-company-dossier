import Link from 'next/link';
import { notFound } from 'next/navigation';
import { isLocale } from '@/lib/locale';
import { PACK_CATEGORY, PACK_DIFFICULTY, UI } from '@/lib/ui-text';
import { getPack } from '@/lib/queries/canonical/detail';
import { Facts, Icon, Name, Nothing, Panel, SecLabel } from '@/components/ui';
import { PackArt } from '@/components/pack-art';

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

	// 목록과 같은 말을 쓴다. 모르는 값이 오면 그대로 낸다.
	const categoryLabel = PACK_CATEGORY[locale][pack.category] ?? pack.category;
	const difficultyLabel = (id: string) => PACK_DIFFICULTY[locale][id] ?? id;

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
						<div className="hero-icon pack-arts">
							{/*
							 * 보스 층 그림이 따로 있으면 여기는 봉지만 낸다 — 둘이 같아지면
							 * 나란히 둘 이유가 없다. 규칙 밖 7 종은 보스 층 그림이 없으므로
							 * 이 자리에서 합성한다.
							 */}
							<figure>
								<PackArt
									id={pack.id}
									sprite={pack.sprite}
									name={pack.text?.name ?? null}
									showBoss={!pack.bossIcon}
								/>
								<figcaption>{ko ? '일반 층' : 'Normal floor'}</figcaption>
							</figure>
							{/*
							 * 보스 층. 애셋은 프레임 없는 투명 그림이라 봉지 위에 겹쳐야
							 * 게임과 같은 카드가 된다. 없는 팩이 있고 Canto 계열은 그 자체가
							 * 보스전이라 변형을 갖지 않는다.
							 */}
							{pack.bossIcon ? (
								<figure>
									<PackArt id={pack.id} sprite={pack.sprite} name={pack.text?.name ?? null} />
									<figcaption>{ko ? '보스 층' : 'Boss floor'}</figcaption>
								</figure>
							) : null}
						</div>
						<Facts
							rows={[
								[ko ? '분류' : 'Category', categoryLabel],
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
										{difficultyLabel(f.difficulty)} {f.range}
										{ko ? '층' : 'F'}
									</li>
								))}
							</ul>
						)}
					</Panel>

					{/*
					 * 조우 이름은 팩 이름과 같아 담지 않았다(실측 75/75). 담긴 것은 등장하는 적이다.
					 */}
					<Panel
						title={ko ? '보스전 등장 적' : 'Boss encounter'}
						hint={pack.bosses.reduce((n, b) => n + b.targets.length, 0)}
					>
						{pack.bosses.length === 0 ? (
							<Nothing kind="absent">{ko ? '보스전 없음' : 'No boss encounter'}</Nothing>
						) : (
							pack.bosses.map((b) =>
								b.targets.length === 0 ? (
									<Nothing key={b.encounterId} kind="absent">
										{ko ? '등장 적 정보 없음' : 'No target data'}
									</Nothing>
								) : (
									<ul key={b.encounterId} className="inline-list">
										{b.targets.map((tg) => (
											<li key={tg.index} className="tag">
												<Name value={tg.text} notice={t.fallbackNotice} />
												{/* 등장 수가 원본에 없는 경우가 있다 */}
												{tg.count !== null ? ` ×${tg.count}` : ''}
											</li>
										))}
									</ul>
								),
							)
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
