import Link from 'next/link';
import { notFound } from 'next/navigation';
import { isLocale } from '@/lib/locale';
import { UI } from '@/lib/ui-text';
import { getEgo } from '@/lib/queries/egos';
import { Facts, Icon, Name, Nothing, Panel, SecLabel } from '@/components/ui';

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

	return (
		<>
			<SecLabel
				title={ego.text?.name ?? (ko ? '이름 없음' : 'Unnamed')}
				sub={ego.sinner?.name ?? undefined}
				hint={<Link href={`/${locale}/egos`}>{ko ? '목록으로' : 'Back to list'}</Link>}
			/>

			<div className="grid2">
				<div>
					<Panel title={ko ? '패시브' : 'Passives'} hint={ego.passives.length}>
						{ego.passives.length === 0 ? (
							<Nothing kind="absent">{ko ? '없음' : 'None'}</Nothing>
						) : (
							<ul className="plain">
								{ego.passives.map((p) => (
									<li key={p.index}>
										{p.text ? (
											<>
												<strong>
													<Name value={p.text} notice={t.fallbackNotice} />
												</strong>
												<p className="desc">{p.text.desc}</p>
											</>
										) : (
											<Nothing kind="missing">{ko ? '설명 없음' : 'No description'}</Nothing>
										)}
									</li>
								))}
							</ul>
						)}
					</Panel>

					{ego.images.cg ? (
						<Panel title="CG">
							<div className="hero-icon">
								<Icon src={ego.images.cg} alt="" size={420} shape="wide" />
							</div>
						</Panel>
					) : null}
				</div>

				<aside>
					<Panel title={ko ? '이미지' : 'Images'}>
						<div className="portraits">
							<Icon src={ego.images.awaken} alt="" size={110} />
							{ego.images.erosion ? (
								<Icon src={ego.images.erosion} alt="" size={110} />
							) : (
								// 침식이 없는 E.G.O 가 12종이다. 결손이 아니다.
								<Nothing kind="absent">{ko ? '침식 없음' : 'No corrosion'}</Nothing>
							)}
						</div>
					</Panel>

					{/* cost 는 E.G.O 기능의 핵심이다(02-data-model 3.4). */}
					<Panel title={ko ? '죄악 자원 소모' : 'Sin cost'}>
						{ego.costs.length === 0 ? (
							<Nothing kind="absent">{ko ? '없음' : 'None'}</Nothing>
						) : (
							<Facts rows={ego.costs.map((c) => [c.sin, c.amount])} />
						)}
					</Panel>

					<Panel title={ko ? '속성' : 'Attributes'}>
						<Facts
							rows={[
								[ko ? '등급' : 'Rank', ego.rank],
								[ko ? '각성' : 'Awaken', `${ego.awakenAffinity} · ${ego.awakenAtkType}`],
								[
									ko ? '침식' : 'Corrosion',
									ego.corrosionAffinity ? (
										`${ego.corrosionAffinity} · ${ego.corrosionAtkType}`
									) : (
										<Nothing kind="absent">{ko ? '없음' : 'None'}</Nothing>
									),
								],
								[ko ? '추출 가능' : 'Extractable', ego.extractable ? 'O' : 'X'],
								[
									ko ? '최대 실뽑기' : 'Max threadspin',
									ego.maxThreadspin ?? <Nothing kind="absent">{ko ? '없음' : 'None'}</Nothing>,
								],
								[ko ? '시즌' : 'Season', ego.season],
								[ko ? '출시일' : 'Released', ego.releaseDate.toISOString().slice(0, 10)],
							]}
						/>
					</Panel>

					{/* E.G.O 의 저항은 죄악 7종이 축이다. 인격과 다르다. */}
					<Panel title={ko ? '저항 (죄악)' : 'Resistances (sin)'}>
						{ego.resists.length === 0 ? (
							<Nothing kind="absent">{ko ? '없음' : 'None'}</Nothing>
						) : (
							<Facts rows={ego.resists.map((r) => [r.sin, `×${r.value}`])} />
						)}
					</Panel>

					<Panel title={ko ? '보유 상태' : 'Statuses'} hint={ego.statuses.length}>
						{ego.statuses.length === 0 ? (
							<Nothing kind="absent">{ko ? '없음' : 'None'}</Nothing>
						) : (
							<ul className="inline-list">
								{ego.statuses.map((s) => (
									<li key={s.id} className="tag">
										<Name value={s.text} notice={t.fallbackNotice} />
									</li>
								))}
							</ul>
						)}
					</Panel>

					<Panel title={ko ? '같은 수감자' : 'Same Sinner'}>
						<Link href={`/${locale}/identities?sinner=${ego.sinnerId}`}>
							{ko ? '인격 보기' : 'View identities'}
						</Link>
					</Panel>
				</aside>
			</div>
		</>
	);
}
