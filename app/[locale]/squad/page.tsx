import Link from 'next/link';
import { notFound } from 'next/navigation';
import { isLocale } from '@/lib/locale';
import { UI } from '@/lib/ui-text';
import { listSquad } from '@/lib/queries/squad';
import { Icon, Name, Nothing, SecLabel } from '@/components/ui';

/**
 * 편성.
 *
 * 수감자 12명을 축으로 그 인격과 E.G.O 를 나란히 둔다.
 * 이전 프로토타입의 SQUAD 탭과 같은 배치이며, 고르는 흐름 없이 조회만 한다.
 */
export default async function SquadPage({ params }: { params: Promise<{ locale: string }> }) {
	const { locale } = await params;
	if (!isLocale(locale)) notFound();

	const t = UI[locale];
	const ko = locale === 'ko';
	const sinners = await listSquad(locale);

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
													<span className="tag">{'0'.repeat(i.rarity)}</span>
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
														<span className="tag">{e.rank}</span>
														{/* 죄악 자원 소모는 E.G.O 기능의 핵심이다(02-data-model 3.4) */}
														{e.costs.map((c) => (
															<span key={c.sin} className="tag">
																{c.sin} {c.amount}
															</span>
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
		</>
	);
}
