import Link from 'next/link';
import { notFound } from 'next/navigation';
import { isLocale } from '@/lib/locale';
import { UI } from '@/lib/ui-text';
import { listSquad, listSquadAxes } from '@/lib/queries/canonical/squad';
import { Icon, IconOnly, IconTag, Name, Nothing, SecLabel } from '@/components/ui';
import { DeckEditor } from '@/components/deck-editor';
import { egoRankIcon, rarityIcon, sinIcon } from '@/lib/assets';

/**
 * 편성.
 *
 * 수감자 12명을 축으로 그 인격과 E.G.O 를 나란히 둔다. 배치는 이전 프로토타입의 SQUAD 탭과
 * 같다 — 덱 레일 · 12칸 · 프로필의 3열이며 고르는 일은 모달이 맡는다
 * (`reference/v1-formation-ui.md`).
 */
export default async function SquadPage({ params }: { params: Promise<{ locale: string }> }) {
	const { locale } = await params;
	if (!isLocale(locale)) notFound();

	const t = UI[locale];
	const ko = locale === 'ko';
	const [sinners, axes] = await Promise.all([listSquad(locale), listSquadAxes(locale)]);

	const totals = sinners.reduce(
		(acc, s) => ({ i: acc.i + s.identities.length, e: acc.e + s.egos.length }),
		{ i: 0, e: 0 },
	);

	return (
		<>
			<SecLabel
				title={t.nav.squad}
				sub={ko ? '수감자별 인격과 E.G.O' : 'Identities and E.G.O by Sinner'}
				hint={`${sinners.length} · ${totals.i} · ${totals.e}`}
			/>

			<p className="lede">
				{ko
					? 'E.G.O는 인격이 아니라 수감자에 붙는다. 그래서 인격 상세에 싣지 않고 이 화면에서 함께 본다.'
					: 'E.G.O belong to a Sinner, not to an Identity. They are shown together here rather than on the identity page.'}
			</p>

			<DeckEditor squad={sinners} axes={axes} ko={ko} />

			{/*
				수감자별 전량 목록.

				**지우지 않는다.** 2단계 성공 기준이 "적재한 데이터 전체를 조회할 수 있다"이고
				(05-ui-foundation 1절) 이 화면이 인격·E.G.O 를 수감자 축으로 보는 유일한 자리다.
				편성 모달은 그 수감자 하나만 열어 주므로 대체가 아니다.
				다만 편성이 화면의 주가 되었으므로 접어 둔다.
			*/}
			<details className="bulk roster">
				<summary className="seclabel">
					<h2>{ko ? '수감자별 전체 목록' : 'Full roster by Sinner'}</h2>
					<span className="rule" />
					<span className="hint">{`${totals.i} · ${totals.e}`}</span>
				</summary>

				{sinners.map((s) => (
					<section key={s.id} className="squad-row">
						<header className="squad-head">
							<Icon src={s.icon} alt="" size={38} />
							<h3>
								<Name value={s.text} notice={t.fallbackNotice} />
							</h3>
							<span className="rule" />
							<Link href={`/${locale}/identities?sinner=${s.id}`} className="hint">
								{ko ? '인격' : 'Identities'} {s.identities.length}
							</Link>
							<Link href={`/${locale}/egos?sinner=${s.id}`} className="hint">
								E.G.O {s.egos.length}
							</Link>
						</header>

						<div className="squad-cols">
							<div>
								<h4 className="grouph">{ko ? '인격' : 'Identities'}</h4>
								{s.identities.length === 0 ? (
									<Nothing kind="absent">{ko ? '없음' : 'None'}</Nothing>
								) : (
									<ul className="squad-list">
										{s.identities.map((i) => (
											<li key={i.id}>
												<Link href={`/${locale}/identities/${i.id}`} className="squad-cell">
													<Icon src={i.image} alt="" size={44} />
													<span className="squad-cell-body">
														<strong>
															<Name value={i.text} notice={t.fallbackNotice} />
														</strong>
														<IconOnly src={rarityIcon(i.rarity)} label={'0'.repeat(i.rarity)} />
													</span>
												</Link>
											</li>
										))}
									</ul>
								)}
							</div>

							<div>
								<h4 className="grouph">E.G.O</h4>
								{s.egos.length === 0 ? (
									<Nothing kind="absent">{ko ? '없음' : 'None'}</Nothing>
								) : (
									<ul className="squad-list">
										{s.egos.map((e) => (
											<li key={e.id}>
												<Link href={`/${locale}/egos/${e.id}`} className="squad-cell">
													<Icon src={e.image} alt="" size={44} />
													<span className="squad-cell-body">
														<strong>
															<Name value={e.text} notice={t.fallbackNotice} />
														</strong>
														<span className="card-meta">
															<IconTag src={egoRankIcon(e.rank)}>{e.rank}</IconTag>
															{/* 죄악 자원 소모는 E.G.O 기능의 핵심이다(02-data-model 3.4) */}
															{e.costs.map((c) => (
																<IconTag key={c.sin} src={sinIcon(c.sin)} label={c.sin}>
																	{c.amount}
																</IconTag>
															))}
														</span>
													</span>
												</Link>
											</li>
										))}
									</ul>
								)}
							</div>
						</div>
					</section>
				))}
			</details>
		</>
	);
}
