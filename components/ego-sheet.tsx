'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { Locale } from '@/lib/locale';
import type { EgoDetail } from '@/lib/queries/canonical/detail';
import { Name, Nothing, Panel } from './ui';
import { seasonLabel } from '@/lib/season';
import { CoinDots, Lines, ROMAN, StatusPanel, SwapIcon, nameMap, roman } from './sheet-parts';

/**
 * E.G.O 상세 한 장.
 *
 * 인격 상세(#26)의 짜임을 그대로 쓴다 — 서류철에서 뽑은 한 장. **축이 다른 자리만 갈랐다.**
 *
 *   저항      인격은 공격 타입 3, E.G.O 는 **죄악 7**
 *   조정      레벨이 없다. 환상 해석 단계 하나뿐이고 **단계가 띄엄띄엄하다**(1 · 3 · 4 가 주력)
 *   체력      없다. 그 자리에 **죄악 자원 소모**가 온다 — E.G.O 기능의 핵심이다
 *   그림      기본↔각성이 아니라 **각성↔침식**. 침식 없는 12종은 단추가 없다
 *   스킬      각성과 침식으로 갈린다
 *
 * **계산기가 아니다.** 해석 단계는 값을 다시 계산하는 장치가 아니라 무엇을 보여줄지 고르는
 * 것이다.
 */

type Skill = EgoDetail['skills'][number];

/**
 * 고른 단계에서 쓸 스킬.
 *
 * **단계가 띄엄띄엄하다.** 실측 1 · 3 · 4 가 주력이고 2 · 5 는 열 건뿐이다. 고른 단계 이하에서
 * 가장 늦은 것을 이어 쓴다 — 인격의 동기화와 같은 규칙이다.
 */
function stageAt(skill: Skill, uptie: number) {
	let found: Skill['stages'][number] | null = null;
	for (const st of skill.stages) if (st.uptie <= uptie) found = st;
	return found;
}

function SkillRow({
	skill,
	uptie,
	names,
	slot,
	ko,
	coin,
}: {
	skill: Skill;
	uptie: number;
	names: Map<string, string>;
	slot: string;
	ko: boolean;
	coin: string | null;
}) {
	const stage = stageAt(skill, uptie);
	const first = skill.firstUptie;

	return (
		<details className="f-skill">
			<summary>
				{/* eslint-disable-next-line @next/next/no-img-element */}
				{skill.icon ? (
					<img className="f-skill-icon" src={skill.icon} alt="" width={30} height={30} loading="lazy" />
				) : (
					<span className="f-skill-icon" />
				)}
				<span className="f-skill-slot">{slot}</span>
				<strong>
					{stage?.text ? (
						stage.text.name
					) : (
						<Nothing kind="absent">
							{ko ? `해석 ${roman(first ?? 0)} 부터` : `From threadspin ${roman(first ?? 0)}`}
						</Nothing>
					)}
				</strong>
				<span className="f-skill-tags f-skill-tags--ego">
					<CoinDots n={stage?.coins.length ?? 0} src={coin} />
					{/* 정신력 소모는 E.G.O 만 갖는 값이다. 인격 스킬에는 없다. */}
					<span className="f-sp">{stage?.spCost === null || stage === null ? '—' : `SP ${stage.spCost}`}</span>
				</span>
			</summary>
			<div className="f-skill-body">
				{stage ? (
					<>
						{/* 유래 환상체. loc 단독 개념이며 실측 611/611 이 값을 갖는다. */}
						{stage.abName ? (
							<p className="f-abname">
								{ko ? '유래' : 'From'} <b>{stage.abName}</b>
							</p>
						) : null}
						<div className="fx-lines">
							<Lines text={stage.text} names={names} id={`s${skill.id}`} />
						</div>
						{stage.coins.length ? (
							<ol className="fx-coins">
								{stage.coins.map((c, i) => (
									<li key={c.index}>
										<span className="coin-r">{ROMAN[i + 1] ?? i + 1}</span>
										<div>
											<Lines
												text={c.desc === null ? null : { name: '', desc: c.desc }}
												names={names}
												id={`s${skill.id}c${c.index}`}
											/>
										</div>
									</li>
								))}
							</ol>
						) : null}
					</>
				) : (
					<p className="absent">
						{ko
							? `해석 ${roman(first ?? 0)} 부터 쓸 수 있다`
							: `Available from threadspin ${roman(first ?? 0)}`}
					</p>
				)}
			</div>
		</details>
	);
}

export function EgoSheetView({
	sheet,
	locale,
	notice,
	icons,
}: {
	sheet: EgoDetail;
	locale: Locale;
	notice: string;
	icons: { coin: string | null };
}) {
	const ko = locale === 'ko';

	/* 이 E.G.O 가 실제로 가진 해석 단계. 띄엄띄엄해서 데이터에서 모은다. */
	const upties = [...new Set(sheet.skills.flatMap((s) => s.stages.map((st) => st.uptie)))].sort(
		(a, b) => a - b,
	);
	const [uptie, setUptie] = useState(upties[upties.length - 1] ?? 1);
	const [corroded, setCorroded] = useState(false);

	const names = nameMap(sheet.statuses);
	/* 침식 그림이 없는 E.G.O 가 12종이다 — 결손이 아니라 부재다. 그때는 단추를 두지 않는다. */
	const canCorrode = Boolean(sheet.images.erosion);
	const art = corroded && canCorrode ? sheet.images.erosion : sheet.images.awaken;

	const awakening = sheet.skills.filter((s) => s.role === 'awakening');
	const corrosion = sheet.skills.filter((s) => s.role === 'corrosion');

	const sin = (v: string | null) => (v ? (sheet.sinNames[v] ?? v) : '—');
	const atk = (v: string | null) => (v ? (sheet.atkNames[v] ?? v) : '—');

	return (
		<>
			<section className="f-card">
				<div className="f-art">
					{/* eslint-disable-next-line @next/next/no-img-element */}
					{art ? <img src={art} alt="" /> : <span className="f-art-none" />}
					<i className="f-mount" />
					{canCorrode ? (
						<button
							type="button"
							className="f-swap"
							onClick={() => setCorroded((v) => !v)}
							aria-pressed={corroded}
							title={ko ? '각성 · 침식 그림 바꾸기' : 'Toggle awaken / corrosion art'}
							aria-label={ko ? '그림 바꾸기' : 'Toggle art'}
						>
							<SwapIcon />
						</button>
					) : null}
				</div>

				<div className="f-body">
					<header className="f-head">
						<div className="f-ident">
							<div className="f-title">
								{/* eslint-disable-next-line @next/next/no-img-element */}
								{sheet.images.sinner ? (
									<span className="f-emblem">
										<img src={sheet.images.sinner} alt="" aria-hidden="true" />
									</span>
								) : null}
								{/* eslint-disable-next-line @next/next/no-img-element */}
								{sheet.rankIcon ? (
									<img className="f-rank" src={sheet.rankIcon} alt={sheet.rank ?? ''} />
								) : null}
								{/* 게임 표기가 `[E.G.O명] 수감자` 다. 대괄호는 CSS 로 그린다. */}
								<h1>
									{sheet.text ? (
										<Name value={sheet.text} notice={notice} />
									) : (
										<Nothing kind="missing">{ko ? '이름 없음' : 'Unnamed'}</Nothing>
									)}
									<span className="f-sinner">{sheet.sinner?.name ?? ''}</span>
								</h1>
							</div>
						</div>
						<dl className="f-file">
							<div>
								<dt>NO.</dt>
								<dd>{sheet.id}</dd>
							</div>
							<div>
								<dt>{ko ? '시즌' : 'Season'}</dt>
								<dd>{seasonLabel(sheet.season) ?? '—'}</dd>
							</div>
							<div>
								<dt>{ko ? '출시' : 'Released'}</dt>
								<dd>
									{sheet.releaseDate?.toISOString().slice(0, 10) ?? (ko ? '알 수 없음' : 'Unknown')}
								</dd>
							</div>
						</dl>
					</header>

					<div className="f-picks">
						<div className="f-pick">
							<span className="f-lab">{ko ? '해석' : 'Threadspin'}</span>
							{upties.map((u) => (
								<button
									key={u}
									type="button"
									className="f-up"
									aria-pressed={u === uptie}
									onClick={() => setUptie(u)}
								>
									{roman(u)}
								</button>
							))}
						</div>
					</div>

					{/*
						죄악 자원 소모.

						**E.G.O 기능의 핵심이다**(02-data-model 3.4). 인격 카드에서 체력 막대가
						앉던 자리에 같은 무게로 놓는다 — 이 카드에서 가장 먼저 읽혀야 하는 값이다.
					*/}
					<div className="f-cost">
						<span className="f-lab">{ko ? '소모' : 'Cost'}</span>
						{sheet.costs.length ? (
							<ul>
								{sheet.costs.map((c) => (
									<li key={c.sin}>
										{/* eslint-disable-next-line @next/next/no-img-element */}
										{c.icon ? <img src={c.icon} alt="" width={22} height={22} /> : null}
										<span>{sin(c.sin)}</span>
										<b>{c.amount}</b>
									</li>
								))}
							</ul>
						) : (
							<Nothing kind="absent">{ko ? '소모 없음' : 'No cost'}</Nothing>
						)}
					</div>

					<div className="f-stats">
						<div className="f-statrow f-statrow--type">
							<span className="f-lab">{ko ? '속성' : 'Type'}</span>
							<div className="f-stat">
								<span>{ko ? '각성' : 'Awaken'}</span>
								<b>
									{sin(sheet.awakenAffinity)} · {atk(sheet.awakenAtkType)}
								</b>
							</div>
							<div className="f-stat">
								<span>{ko ? '침식' : 'Corrosion'}</span>
								<b>
									{sheet.corrosionAffinity ? (
										`${sin(sheet.corrosionAffinity)} · ${atk(sheet.corrosionAtkType)}`
									) : (
										/* 침식이 없는 E.G.O 가 12종이다 — 결손이 아니라 부재다. */
										<Nothing kind="absent">{ko ? '없음' : 'None'}</Nothing>
									)}
								</b>
							</div>
							{/* 거울 던전에서 뽑을 수 있는가. 게임 확인으로 값이 맞음을 밝혔다. */}
							<div className="f-stat">
								<span>{ko ? '추출' : 'Extract'}</span>
								<b>{sheet.extractable ? (ko ? '가능' : 'Yes') : ko ? '불가' : 'No'}</b>
							</div>
						</div>

						{/* E.G.O 의 저항은 죄악 7종이 축이다. 인격은 공격 타입 3종이라 축이 다르다. */}
						<div className="f-statrow f-statrow--sin">
							<span className="f-lab">{ko ? '저항' : 'Resist'}</span>
							{sheet.resists.map((r) => (
								<div className="f-stat" key={r.sin}>
									<span>{sin(r.sin)}</span>
									<b>×{r.value}</b>
								</div>
							))}
						</div>
					</div>

					<div className="f-tags">
						<div>
							<span className="f-lab">{ko ? '키워드' : 'Keyword'}</span>
							{sheet.keywords.length ? (
								sheet.keywords.map((k) => (
									<Link
										key={k.id}
										className="tag tag--icon"
										href={`/${locale}/egos?keyword=${encodeURIComponent(k.id)}`}
									>
										{/* eslint-disable-next-line @next/next/no-img-element */}
										{k.icon ? <img src={k.icon} alt="" width={15} height={15} /> : null}
										<Name value={k.text} notice={notice} />
									</Link>
								))
							) : (
								/* 기믹이 하나도 없는 E.G.O 가 18종이다 — 결손이 아니라 부재다. */
								<Nothing kind="absent">{ko ? '없음' : 'None'}</Nothing>
							)}
						</div>
					</div>
				</div>
			</section>

			{awakening.length ? (
				<Panel title={ko ? '각성 스킬' : 'Awakening skills'} hint={awakening.length}>
					<div className="f-skills">
						{awakening.map((s, i) => (
							<SkillRow
								key={s.id}
								skill={s}
								uptie={uptie}
								names={names}
								slot={awakening.length > 1 ? `${ko ? '각성' : 'Awaken'} ${i + 1}` : ko ? '각성' : 'Awaken'}
								ko={ko}
								coin={icons.coin}
							/>
						))}
					</div>
				</Panel>
			) : null}

			{corrosion.length ? (
				<Panel title={ko ? '침식 스킬' : 'Corrosion skills'} hint={corrosion.length}>
					<div className="f-skills">
						{corrosion.map((s, i) => (
							<SkillRow
								key={s.id}
								skill={s}
								uptie={uptie}
								names={names}
								slot={corrosion.length > 1 ? `${ko ? '침식' : 'Corrode'} ${i + 1}` : ko ? '침식' : 'Corrode'}
								ko={ko}
								coin={icons.coin}
							/>
						))}
					</div>
				</Panel>
			) : null}

			{sheet.passives.length ? (
				<Panel title={ko ? '패시브' : 'Passives'} hint={sheet.passives.length}>
					<div className="f-passives">
						{sheet.passives.map((p) => (
							<article className="f-passive" key={p.index}>
								<div className="f-passive-head">
									<strong>
										{p.text ? (
											<Name value={p.text} notice={notice} />
										) : (
											<Nothing kind="missing">{ko ? '이름 없음' : 'Unnamed'}</Nothing>
										)}
									</strong>
								</div>
								<div className="fx-lines">
									<Lines text={p.text} names={names} id={`p${p.index}`} />
								</div>
							</article>
						))}
					</div>
				</Panel>
			) : null}

			{/*
				침식 확률.

				원본은 `section` 을 정규화된 값으로 갖는데 **백분율이 아니다** — 게임의 정신력
				범위 `[-45, +45]` 를 `[0, 1]` 로 편 자리다. 질의가 SP 로 되돌려 주므로 여기서는
				「정신력이 이 아래로 내려가면 이 확률」로 읽으면 된다.
			*/}
			{sheet.corrosion.length ? (
				<Panel title={ko ? '침식 확률' : 'Corrosion chance'} hint={sheet.corrosion.length}>
					<ul className="f-corrosion">
						{sheet.corrosion.map((c) => (
							<li key={c.sp}>
								<span className="f-lab">SP {c.sp}</span>
								<span className="f-corrosion-bar">
									<i style={{ width: `${Math.round(c.probability * 100)}%` }} />
								</span>
								<b>{Math.round(c.probability * 100)}%</b>
							</li>
						))}
					</ul>
				</Panel>
			) : null}

			<StatusPanel
				statuses={sheet.statuses}
				title={ko ? '이 E.G.O 가 쓰는 상태' : 'Statuses used'}
				ko={ko}
			/>

			{sheet.images.cg ? (
				<Panel title="CG">
					{/* eslint-disable-next-line @next/next/no-img-element */}
					<img className="f-cg" src={sheet.images.cg} alt="" loading="lazy" />
				</Panel>
			) : null}
		</>
	);
}
