import Link from 'next/link';
import { notFound } from 'next/navigation';
import { isLocale } from '@/lib/locale';
import { UI } from '@/lib/ui-text';
import { getIdentity } from '@/lib/queries/identities';
import { Facts, Icon, Name, Nothing, Panel, SecLabel } from '@/components/ui';
import { UptieSkills } from '@/components/uptie-skills';

export default async function IdentityDetailPage({
	params,
}: {
	params: Promise<{ locale: string; id: string }>;
}) {
	const { locale, id } = await params;
	if (!isLocale(locale)) notFound();

	const numeric = Number(id);
	if (!Number.isInteger(numeric)) notFound();

	const identity = await getIdentity(numeric, locale);
	if (!identity) notFound();

	const t = UI[locale];
	const ko = locale === 'ko';

	return (
		<>
			<SecLabel
				title={identity.text?.name ?? (ko ? '이름 없음' : 'Unnamed')}
				sub={identity.sinner?.name ?? undefined}
				hint={<Link href={`/${locale}/identities`}>{ko ? '목록으로' : 'Back to list'}</Link>}
			/>

			<div className="grid2">
				<div>
					{/* 방어 스킬을 공격 스킬과 같은 깊이로 기본 표시한다(05-ui-foundation 4.3). */}
					<UptieSkills skills={identity.skills} locale={locale} notice={t.fallbackNotice} />

					<Panel title={ko ? '패시브' : 'Passives'} hint={identity.passives.length}>
						{identity.passives.length === 0 ? (
							<Nothing kind="absent">{ko ? '없음' : 'None'}</Nothing>
						) : (
							<ul className="plain">
								{identity.passives.map((p) => (
									<li key={`${p.id}${p.kind}`}>
										<div className="row-head">
											<strong>
												{p.text ? (
													<Name value={p.text} notice={t.fallbackNotice} />
												) : (
													<Nothing kind="missing">{ko ? '이름 없음' : 'Unnamed'}</Nothing>
												)}
											</strong>
											<span className="tag">{p.kind === 'combat' ? (ko ? '전투' : 'Combat') : (ko ? '지원' : 'Support')}</span>
											<span className="tag">
												{ko ? '동기화' : 'Uptie'} {p.uptie}
											</span>
										</div>
										{p.text ? <p className="desc">{p.text.desc}</p> : null}
										{p.requirements.length > 0 ? (
											<p className="req">
												{ko ? '조건' : 'Requires'}:{' '}
												{p.requirements.map((r) => `${r.type} ${r.value}`).join(' · ')}
											</p>
										) : null}
									</li>
								))}
							</ul>
						)}
					</Panel>
				</div>

				<aside>
					<Panel title={ko ? '초상' : 'Portraits'}>
						<div className="portraits">
							<Icon src={identity.images.profile} alt="" size={110} />
							{identity.images.profileBase ? (
								<Icon src={identity.images.profileBase} alt="" size={110} />
							) : null}
						</div>
					</Panel>

					<Panel title={ko ? '스탯' : 'Stats'}>
						<Facts
							rows={[
								// hp 는 스칼라가 아니다. 기본값과 레벨당 증가량의 쌍이다.
								[
									ko ? '체력' : 'HP',
									`${identity.hpBase} + ${identity.hpPerLevel}/${ko ? '레벨' : 'lv'}`,
								],
								[ko ? '방어 보정' : 'Def. correction', identity.defCorrection],
								[
									ko ? '스태거 구간' : 'Stagger',
									// 길이가 인격마다 다르다. 3구간을 가정하지 않는다.
									identity.breakSection.length
										? identity.breakSection.join(' / ')
										: ((<Nothing kind="absent">{ko ? '없음' : 'None'}</Nothing>) as never),
								],
								[ko ? '시즌' : 'Season', identity.season],
								[
									ko ? '출시일' : 'Released',
									identity.releaseDate.toISOString().slice(0, 10),
								],
							]}
						/>
					</Panel>

					{/* 인격의 저항은 공격 타입 3종이 축이다. E.G.O 와 다르다. */}
					<Panel title={ko ? '저항 (공격 타입)' : 'Resistances (attack type)'}>
						<Facts rows={identity.resists.map((r) => [r.atkType, `×${r.value}`])} />
					</Panel>

					<Panel title={ko ? '속도' : 'Speed'}>
						<Facts
							rows={identity.speeds.map((s) => [
								`${ko ? '동기화' : 'Uptie'} ${s.uptie}`,
								`${s.min} – ${s.max}`,
							])}
						/>
					</Panel>

					<Panel title={ko ? '소속' : 'Affiliations'} hint={identity.affiliations.length}>
						{identity.affiliations.length === 0 ? (
							<Nothing kind="absent">{ko ? '없음' : 'None'}</Nothing>
						) : (
							<ul className="inline-list">
								{identity.affiliations.map((a) => (
									<li key={a.id}>
										<Link
											href={`/${locale}/identities?affiliation=${encodeURIComponent(a.id)}`}
											className="tag"
										>
											<Name value={a.text} notice={t.fallbackNotice} />
										</Link>
									</li>
								))}
							</ul>
						)}
					</Panel>

					<Panel title={ko ? '보유 상태' : 'Statuses'} hint={identity.statuses.length}>
						{identity.statuses.length === 0 ? (
							<Nothing kind="absent">{ko ? '없음' : 'None'}</Nothing>
						) : (
							<ul className="inline-list">
								{identity.statuses.map((s) => (
									<li key={s.id} className="tag">
										<Name value={s.text} notice={t.fallbackNotice} />
									</li>
								))}
							</ul>
						)}
					</Panel>

					{/* E.G.O 는 수감자에 붙는다. 인격 상세에 싣지 않고 목록으로 잇는다. */}
					<Panel title="E.G.O">
						<Link href={`/${locale}/egos?sinner=${identity.sinnerId}`}>
							{ko
								? `${identity.sinner?.name ?? ''}의 E.G.O 보기`
								: `View E.G.O for ${identity.sinner?.name ?? ''}`}
						</Link>
					</Panel>
				</aside>
			</div>
		</>
	);
}
