import Link from 'next/link';
import { notFound } from 'next/navigation';
import { isLocale } from '@/lib/locale';
import { UI } from '@/lib/ui-text';
import { getGift } from '@/lib/queries/canonical/gifts';
import { Facts, Icon, IconTag, Name, Nothing, Panel, SecLabel } from '@/components/ui';
import { keywordIcon } from '@/lib/assets';

export default async function GiftDetailPage({
	params,
}: {
	params: Promise<{ locale: string; id: string }>;
}) {
	const { locale, id } = await params;
	if (!isLocale(locale)) notFound();

	const giftId = Number(id);
	if (!Number.isInteger(giftId)) notFound();

	const gift = await getGift(giftId, locale);
	if (!gift) notFound();

	const t = UI[locale];
	const ko = locale === 'ko';
	const base = gift.stages[0];

	return (
		<>
			<SecLabel
				title={base?.text?.name ?? (ko ? '이름 없음' : 'Unnamed')}
				sub={t.nav.gifts}
				hint={<Link href={`/${locale}/gifts`}>{ko ? '목록으로' : 'Back to list'}</Link>}
			/>

			<div className="grid2">
				<div>
					{/* 강화 단계마다 이름과 설명이 다르다. 같은 기프트로 묶어 나란히 둔다. */}
					{gift.stages.map((stage) => (
						<Panel
							key={stage.level}
							title={
								stage.level === 0
									? ko
										? '기본'
										: 'Base'
									: `${ko ? '강화' : 'Enhanced'} ${'+'.repeat(stage.level)}`
							}
						>
							{stage.text ? (
								<>
									<p className="stage-name">
										<Name value={stage.text} notice={t.fallbackNotice} />
									</p>
									<p className="desc">{stage.text.desc}</p>
								</>
							) : (
								<Nothing kind="missing">{ko ? '설명 없음' : 'No description'}</Nothing>
							)}
						</Panel>
					))}

					{gift.recipes.length > 0 && (
						<Panel title={ko ? '합성 레시피' : 'Fusion recipes'} hint={gift.recipes.length}>
							{gift.recipes.map((recipe) => (
								<div key={recipe.id} className="recipe">
									{recipe.slots.map((slot, i) => (
										<div key={i} className="slot">
											<span className="slot-count">×{slot.count}</span>
											{/* 한 슬롯 안의 재료는 서로 대체 가능하다. 평탄하게 늘어놓으면 그 구조가 사라진다. */}
											<div className="slot-options">
												{slot.options.map((o, j) => (
													<span key={o.id}>
														{j > 0 ? <em className="or">{ko ? '또는' : 'or'}</em> : null}
														<Link href={`/${locale}/gifts/${o.id}`} className="inline-gift">
															<Icon src={o.icon} alt="" size={22} />
															<Name value={o.text} notice={t.fallbackNotice} />
														</Link>
													</span>
												))}
											</div>
										</div>
									))}
								</div>
							))}
						</Panel>
					)}

					{gift.usedIn.length > 0 && (
						<Panel title={ko ? '이 기프트를 재료로 쓰는 합성' : 'Used as material'} hint={gift.usedIn.length}>
							<ul className="inline-list">
								{gift.usedIn.map((u) => (
									<li key={u.id}>
										<Link href={`/${locale}/gifts/${u.id}`} className="inline-gift">
											<Icon src={u.icon} alt="" size={22} />
											<Name value={u.text} notice={t.fallbackNotice} />
										</Link>
									</li>
								))}
							</ul>
						</Panel>
					)}
				</div>

				<aside>
					<Panel title={ko ? '속성' : 'Attributes'}>
						<div className="hero-icon">
							<Icon src={gift.icon} alt="" size={96} />
						</div>
						<Facts
							rows={[
								[ko ? '등급' : 'Tier', gift.tier],
								[
									ko ? '키워드' : 'Keyword',
									gift.keyword ? (
										<IconTag src={keywordIcon(gift.keywordId ?? '')}>{gift.keyword.name}</IconTag>
									) : (
										// 120종이 키워드를 갖지 않는다. 결손이 아니다.
										<Nothing kind="absent">{ko ? '없음' : 'None'}</Nothing>
									),
								],
								[ko ? '강화 가능' : 'Enhanceable', gift.enhanceable ? 'O' : 'X'],
								[ko ? 'hard 전용' : 'Hard only', gift.hardOnly ? 'O' : 'X'],
								[
									ko ? 'MD 코스트' : 'MD cost',
									gift.mdCost ?? (
										// 441/456 만 값을 갖는다. 보강 출처에 없는 15종이다.
										<Nothing kind="missing">{ko ? '출처에 없음' : 'Not in source'}</Nothing>
									),
								],
							]}
						/>
					</Panel>

					<Panel
						title={ko ? '전용 팩' : 'Exclusive packs'}
						hint={gift.exclusivePacks.length}
					>
						{gift.exclusivePacks.length === 0 ? (
							// 범용 226종. 비어 있는 것이 정상이다(02-data-model 3.5).
							<Nothing kind="absent">
								{ko ? '범용 풀에서 등장한다' : 'Appears in the general pool'}
							</Nothing>
						) : (
							<ul className="inline-list">
								{gift.exclusivePacks.map((p) => (
									<li key={p.id}>
										<Link href={`/${locale}/packs/${p.id}`}>
											<Name value={p.text} notice={t.fallbackNotice} />
										</Link>
									</li>
								))}
							</ul>
						)}
					</Panel>

					<Panel title={ko ? '등장 팩' : 'Appears in'} hint={gift.packs.length}>
						{gift.packs.length === 0 ? (
							<Nothing kind="absent">{ko ? '없음' : 'None'}</Nothing>
						) : (
							<ul className="inline-list">
								{gift.packs.map((p) => (
									<li key={p.id}>
										<Link href={`/${locale}/packs/${p.id}`}>
											<Name value={p.text} notice={t.fallbackNotice} />
										</Link>
									</li>
								))}
							</ul>
						)}
					</Panel>
				</aside>
			</div>
		</>
	);
}
