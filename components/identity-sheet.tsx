'use client';

import { Fragment, useState, type ReactElement, type ReactNode } from 'react';
import Link from 'next/link';
import type { Locale } from '@/lib/locale';
import type { IdentityDetail } from '@/lib/queries/canonical/detail';
import { Name, Nothing, Panel } from './ui';

/** 게임이 60 에서 멈춘다. */
const MAX_LEVEL = 60;

type Skill = IdentityDetail['skills'][number];
type Passive = IdentityDetail['passives'][number];
type Text = { name: string; desc: string | null } | null;

/**
 * 인격 상세 한 장.
 *
 * 시안 F 를 옮긴 것이다(`publish/lab/identity-f.html`). **계산기가 아니다** — 레벨과 동기화는
 * 값을 다시 계산하는 장치가 아니라 **무엇을 보여줄지 고르는 것**이다. 하나만 예외로 체력·
 * 공격 레벨·방어 레벨이 레벨을 따라 움직이는데, 그 셋은 게임이 레벨에서 곧장 유도하는 값이라
 * 어느 전투인지에 기대지 않는다.
 *
 * 레벨과 동기화가 카드와 스킬 양쪽을 움직이므로 한 덩이로 묶어 둔다.
 */

const ROMAN = ['', 'Ⅰ', 'Ⅱ', 'Ⅲ', 'Ⅳ', 'Ⅴ'];
const roman = (n: number) => ROMAN[n] ?? String(n);

/** 부호를 붙여 적는다. 방어 보정은 66 건이 0 이하라 부호가 뜻을 가른다. 빼기표(−)를 쓴다. */
const signed = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : '0');

/** 교체 아이콘. 애셋 스냅샷 4721 장에 화살표가 교차하는 그림이 없어 직접 그린다. */
const SwapIcon = () => (
	<svg
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		strokeWidth={2}
		strokeLinecap="round"
		strokeLinejoin="round"
		aria-hidden="true"
		focusable="false"
	>
		<path d="M4 8h14M15 5l3 3-3 3M20 16H6M9 13l-3 3 3 3" />
	</svg>
);

/**
 * 한 줄을 색으로 가른다.
 *
 * 셋을 집는다.
 *
 *   상태 이름   문장 속의 「출혈」 — 눌러서 아래 상태 칸으로 내려간다
 *   상태 토큰   아직 치환이 안 끝난 `[Laceration]` — **이름으로 바꿔 보인다**
 *   타이밍 태그 `[OnSucceedAttack]` — 뜻을 모르므로 꼴만 태그로 세운다
 *
 * 게임의 공식 인격 프리뷰 카드가 같은 자리를 같은 방식으로 가른다.
 *
 * **짝표를 새로 만들지 않는다.** 토큰을 이름으로 바꾸는 데 쓰는 것은 이미 읽어 온
 * `status_text` 하나뿐이다. 거기 없는 토큰은 그대로 둔다 — 없는 말을 지어내지 않는다.
 *
 * 한국어 코인 문구 7,634 행 중 4,219 행에 아직 토큰이 남아 있다(2026-08-11 실측).
 * 데이터층이 치환을 끝내면 이 갈래는 저절로 조용해진다.
 */
const TOKEN = /\[([A-Za-z][A-Za-z0-9_]*)\]/g;

function paint(line: string, names: Map<string, string>, key: string) {
	const out: ReactNode[] = [];
	let at = 0;

	/*
		대괄호 밖의 맨 글자. 여기서만 상태 이름을 찾는다.

		조각을 `ReactNode` 로 두면 `flatMap` 이 중첩 배열까지 받아들이는 넓은 타입이 되어
		빌드가 막힌다. **글자 아니면 요소** 둘로 좁혀 둔다.
	*/
	const plain = (text: string, tag: string) => {
		let parts: Array<string | ReactElement> = [text];
		for (const [id, name] of names) {
			parts = parts.flatMap((part, i) => {
				if (typeof part !== 'string') return [part];
				const chunks = part.split(name);
				if (chunks.length === 1) return [part];
				return chunks.flatMap((c, j) =>
					j === 0
						? [c]
						: [
								<a key={`${tag}-${id}-${i}-${j}`} className="fx-st" href={`#st-${id}`}>
									{name}
								</a>,
								c,
							],
				);
			});
		}
		out.push(...parts.map((p, i) => <Fragment key={`${tag}-p${i}`}>{p}</Fragment>));
	};

	for (const m of line.matchAll(TOKEN)) {
		if (m.index > at) plain(line.slice(at, m.index), `${key}-${at}`);
		const id = m[1]!;
		const name = names.get(id);
		out.push(
			name ? (
				<a key={`${key}-t${m.index}`} className="fx-st" href={`#st-${id}`}>
					{name}
				</a>
			) : (
				<span key={`${key}-t${m.index}`} className="fx-when">
					{m[0]}
				</span>
			),
		);
		at = m.index + m[0].length;
	}
	if (at < line.length) plain(line.slice(at), `${key}-${at}`);

	return <>{out}</>;
}

/** 여러 줄을 문단으로 편다. */
function Lines({ text, names, id }: { text: Text; names: Map<string, string>; id: string }) {
	if (!text?.desc) return null;
	return (
		<>
			{text.desc
				.split('\n')
				.filter((v) => v.trim())
				.map((line, i) => (
					<p className="fx-line" key={`${id}-${i}`}>
						{paint(line, names, `${id}-${i}`)}
					</p>
				))}
		</>
	);
}

/** 코인 수는 동전 그림으로 센다. 게임의 프리뷰 카드가 그렇게 한다. */
function CoinDots({ n, src }: { n: number; src: string | null }) {
	if (!src || n <= 0) return null;
	return (
		<span className="coin-dots">
			{Array.from({ length: n }, (_, i) => (
				/* eslint-disable-next-line @next/next/no-img-element */
				<img key={i} src={src} alt="" width={12} height={12} />
			))}
		</span>
	);
}

function Tag({ icon, label }: { icon: string | null; label: string }) {
	return (
		<span className="tag tag--icon">
			{/* eslint-disable-next-line @next/next/no-img-element */}
			{icon ? <img src={icon} alt="" width={14} height={14} /> : null}
			{label}
		</span>
	);
}

/**
 * 고른 단계에서 쓸 스킬 문구.
 *
 * **단계 행은 바뀔 때만 있다.** 고른 단계 이하에서 가장 늦은 행을 이어 쓴다. 이월할 앞 단계가
 * 없으면 그 단계에는 정말로 없는 스킬이다.
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
	icons,
	labels,
}: {
	skill: Skill;
	uptie: number;
	names: Map<string, string>;
	slot: string;
	ko: boolean;
	icons: { coin: string | null };
	/** 죄악·공격 타입 이름. **데이터에서 온다** — 화면이 표를 들지 않는다. */
	labels: { sin: Record<string, string>; atk: Record<string, string> };
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
							{ko ? `동기화 ${roman(first ?? 0)} 부터` : `From uptie ${roman(first ?? 0)}`}
						</Nothing>
					)}
				</strong>
				<span className="f-skill-tags">
					<CoinDots n={stage?.coins.length ?? 0} src={icons.coin} />
					<Tag icon={skill.icons.sin} label={labels.sin[skill.affinity ?? ''] ?? '—'} />
					<Tag icon={skill.icons.atkType} label={labels.atk[skill.atkType ?? ''] ?? '—'} />
				</span>
			</summary>
			<div className="f-skill-body">
				{stage ? (
					<>
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
							? `동기화 ${roman(first ?? 0)} 부터 쓸 수 있다`
							: `Available from uptie ${roman(first ?? 0)}`}
					</p>
				)}
			</div>
		</details>
	);
}

function PassiveCard({
	passive,
	names,
	ko,
	notice,
}: {
	passive: Passive;
	names: Map<string, string>;
	ko: boolean;
	notice: string;
}) {
	return (
		<article className="f-passive">
			<div className="f-passive-head">
				<strong>
					{passive.text ? (
						<Name value={{ name: passive.text.name, fellBack: passive.text.fellBack }} notice={notice} />
					) : (
						<Nothing kind="missing">{ko ? '이름 없음' : 'Unnamed'}</Nothing>
					)}
				</strong>
				<span className="tag">
					{ko ? '동기화' : 'Uptie'} {roman(passive.uptie)}
				</span>
			</div>
			<div className="fx-lines">
				<Lines text={passive.text} names={names} id={`p${passive.id}`} />
			</div>
		</article>
	);
}

export function IdentitySheetView({
	sheet,
	locale,
	notice,
	icons,
}: {
	sheet: IdentityDetail;
	locale: Locale;
	notice: string;
	/** 화면이 쓰는 공용 그림. 서버에서 애셋 목록을 뒤져 넘긴다. */
	icons: { coin: string | null; offense: string | null; defense: string | null; speed: string | null };
}) {
	const ko = locale === 'ko';
	const upties = [...new Set(sheet.speeds.map((s) => s.uptie))].sort((a, b) => a - b);
	const [level, setLevel] = useState(MAX_LEVEL);
	const [uptie, setUptie] = useState(upties[upties.length - 1] ?? 1);
	const [awakened, setAwakened] = useState(false);

	/* 긴 이름을 먼저 자르려고 길이 내림차순으로 둔다 — 짧은 이름이 긴 이름 안에 들면 조각난다. */
	const names = new Map(
		[...sheet.statuses]
			.sort((a, b) => b.text.name.length - a.text.name.length)
			.map((s) => [s.id, s.text.name] as const),
	);
	const labels = { sin: sheet.sinNames, atk: sheet.atkNames };
	const speed = sheet.speeds.find((s) => s.uptie === uptie);

	/* 체력 = 기본 체력 + 레벨당 증가 × 레벨. 소수점을 버린다. */
	const hp = Math.floor((sheet.hpBase ?? 0) + (sheet.hpPerLevel ?? 0) * level);
	/* 공격 레벨은 레벨과 같고 방어 레벨에만 보정이 붙는다. 피해 배율 = 1 + 0.03 × (공격 − 방어). */
	const defLevel = level + (sheet.defCorrection ?? 0);

	const clamp = (v: number) => Math.min(MAX_LEVEL, Math.max(1, Math.round(v) || 1));
	const art = awakened ? sheet.images.fullAwakened : sheet.images.full;

	const attacks = sheet.skills.filter((s) => s.defType === 'attack');
	const defenses = sheet.skills.filter((s) => s.defType !== 'attack');
	/*
		**같은 패시브가 단계마다 다시 온다.** 10515 의 1051502 는 동기화 1 과 2 에 각각 행이
		있다(전체 111 건). 문구가 단계마다 달라서다 — id 와 갈래만으로는 열쇠가 겹친다.
	*/
	const battle = sheet.passives.filter((p) => p.kind !== 'supporter');
	const support = sheet.passives.filter((p) => p.kind === 'supporter');

	return (
		<>
			<section className="f-card">
				<div className="f-art">
					{/* eslint-disable-next-line @next/next/no-img-element */}
					{art ? <img src={art} alt="" /> : <span className="f-art-none" />}
					<i className="f-mount" />
					<button
						type="button"
						className="f-swap"
						onClick={() => setAwakened((v) => !v)}
						aria-pressed={awakened}
						title={ko ? '기본 · 3 동기화 일러스트 바꾸기' : 'Toggle base / uptie 3 art'}
						aria-label={ko ? '일러스트 바꾸기' : 'Toggle art'}
					>
						<SwapIcon />
					</button>
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
								{sheet.rarityIcon ? (
									<img className="f-rank" src={sheet.rarityIcon} alt={'0'.repeat(sheet.rarity)} />
								) : null}
								{/* 게임 표기가 `[인격명] 수감자` 다. 대괄호는 CSS 로 그려 이름 문자열을 건드리지 않는다. */}
								<h1>
									{sheet.text ? (
										<Name value={sheet.text} notice={notice} />
									) : (
										<Nothing kind="missing">{ko ? '이름 없음' : 'Unnamed'}</Nothing>
									)}
									<span className="f-sinner">{sheet.sinner?.name ?? ''}</span>
								</h1>
							</div>
							<div className="f-affil">
								{sheet.affiliations.length ? (
									sheet.affiliations.map((a) => (
										<Link
											key={a.id}
											className="tag"
											href={`/${locale}/identities?affiliation=${encodeURIComponent(a.id)}`}
										>
											<Name value={a.text} notice={notice} />
										</Link>
									))
								) : (
									<Nothing kind="absent">{ko ? '없음' : 'None'}</Nothing>
								)}
							</div>
						</div>
						<dl className="f-file">
							<div>
								<dt>NO.</dt>
								<dd>{sheet.id}</dd>
							</div>
							<div>
								<dt>{ko ? '시즌' : 'Season'}</dt>
								<dd>{sheet.season}</dd>
							</div>
							<div>
								<dt>{ko ? '출시' : 'Released'}</dt>
								<dd>{sheet.releaseDate?.toISOString().slice(0, 10) ?? (ko ? '알 수 없음' : 'Unknown')}</dd>
							</div>
						</dl>
					</header>

					<div className="f-picks">
						<div className="f-pick f-pick--lv">
							<span className="f-lab">{ko ? '레벨' : 'Level'}</span>
							<input
								className="f-lv-range"
								type="range"
								min={1}
								max={MAX_LEVEL}
								value={level}
								onChange={(e) => setLevel(clamp(Number(e.target.value)))}
								aria-label={ko ? '레벨' : 'Level'}
							/>
							<input
								className="f-lv-num"
								type="number"
								min={1}
								max={MAX_LEVEL}
								value={level}
								onChange={(e) => setLevel(clamp(Number(e.target.value)))}
								aria-label={ko ? '레벨' : 'Level'}
							/>
						</div>
						<div className="f-pick">
							<span className="f-lab">{ko ? '동기화' : 'Uptie'}</span>
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

					<div className="f-hp">
						<span className="f-lab">{ko ? '체력' : 'HP'}</span>
						<span className="f-hp-n">{hp}</span>
						{/* 흐트러짐 구간. **길이가 인격마다 다르다** — 3구간을 가정하지 않는다. */}
						<span className="f-hp-bar">
							{sheet.breakSection.map((v) => (
								<i key={v} style={{ left: `${v}%` }}>
									<b>{v}%</b>
								</i>
							))}
						</span>
					</div>

					<div className="f-stats">
						<div className="f-statrow">
							<span className="f-lab">{ko ? '스탯' : 'Stats'}</span>
							<div className="f-stat">
								<span>
									{/* eslint-disable-next-line @next/next/no-img-element */}
									{icons.offense ? <img src={icons.offense} alt="" width={14} height={14} /> : null}
									{ko ? '공격 레벨' : 'Offense lv.'}
								</span>
								<b>{level}</b>
							</div>
							<div className="f-stat">
								<span>
									{/* eslint-disable-next-line @next/next/no-img-element */}
									{icons.defense ? <img src={icons.defense} alt="" width={14} height={14} /> : null}
									{ko ? '방어 레벨' : 'Defense lv.'}{' '}
									<em>
										{ko ? '보정' : 'mod.'} {signed(sheet.defCorrection ?? 0)}
									</em>
								</span>
								<b>{defLevel}</b>
							</div>
							<div className="f-stat">
								<span>
									{/* eslint-disable-next-line @next/next/no-img-element */}
									{icons.speed ? <img src={icons.speed} alt="" width={14} height={14} /> : null}
									{ko ? '속도' : 'Speed'}
								</span>
								<b>{speed ? `${speed.min}–${speed.max}` : '—'}</b>
							</div>
						</div>
						{/* 인격의 저항은 공격 타입 3종이 축이다. E.G.O 는 죄악 7종이라 축이 다르다. */}
						<div className="f-statrow">
							<span className="f-lab">{ko ? '저항' : 'Resist'}</span>
							{sheet.resists.map((r) => (
								<div className="f-stat" key={r.atkType}>
									<span>
										{/* eslint-disable-next-line @next/next/no-img-element */}
										{r.icon ? <img src={r.icon} alt="" width={14} height={14} /> : null}
										{sheet.atkNames[r.atkType] ?? r.atkType}
									</span>
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
										href={`/${locale}/identities?keyword=${encodeURIComponent(k.id)}`}
									>
										{/* eslint-disable-next-line @next/next/no-img-element */}
										{k.icon ? <img src={k.icon} alt="" width={15} height={15} /> : null}
										<Name value={k.text} notice={notice} />
									</Link>
								))
							) : (
								/* 키워드가 하나도 없는 인격이 있다 — 결손이 아니라 부재다. */
								<Nothing kind="absent">{ko ? '없음' : 'None'}</Nothing>
							)}
						</div>
					</div>
				</div>
			</section>

			<Panel title={ko ? '스킬' : 'Skills'} hint={sheet.skills.length}>
				<div className="f-skills">
					{attacks.map((s, i) => (
						<SkillRow
							key={s.id}
							skill={s}
							uptie={uptie}
							names={names}
							slot={ko ? `스킬 ${i + 1}` : `Skill ${i + 1}`}
							ko={ko}
							icons={icons}
							labels={labels}
						/>
					))}
					{defenses.map((s) => (
						<SkillRow
							key={s.id}
							skill={s}
							uptie={uptie}
							names={names}
							slot={ko ? '방어' : 'Defense'}
							ko={ko}
							icons={icons}
							labels={labels}
						/>
					))}
				</div>
			</Panel>

			{battle.length ? (
				<Panel title={ko ? '전투 패시브' : 'Combat passives'} hint={battle.length}>
					<div className="f-passives">
						{battle.map((p) => (
							<PassiveCard key={`${p.id}-${p.kind}-${p.uptie}`} passive={p} names={names} ko={ko} notice={notice} />
						))}
					</div>
				</Panel>
			) : null}

			{support.length ? (
				<Panel title={ko ? '서포트 패시브' : 'Support passives'} hint={support.length}>
					<div className="f-passives">
						{support.map((p) => (
							<PassiveCard key={`${p.id}-${p.kind}-${p.uptie}`} passive={p} names={names} ko={ko} notice={notice} />
						))}
					</div>
				</Panel>
			) : null}

			{/*
				본문에 실제로 나오는 상태만 싣는다. `identity_status` 는 넓게 잡혀 있어 글에
				없는 것까지 든다 — 읽는 사람이 궁금해하는 것은 지금 눈에 보이는 낱말이다.
			*/}
			{sheet.statuses.length ? (
				<Panel
					title={ko ? '이 인격이 쓰는 상태' : 'Statuses used'}
					hint={sheet.statuses.length}
				>
					<div className="st-grid">
						{sheet.statuses.map((st) => (
							<article className="st-card" id={`st-${st.id}`} key={st.id}>
								<div className="st-head">
									{/* eslint-disable-next-line @next/next/no-img-element */}
									{st.icon ? <img src={st.icon} alt="" width={22} height={22} loading="lazy" /> : null}
									<strong>{st.text.name}</strong>
								</div>
								<div className="st-body">
									{st.text.desc?.trim() ? (
										st.text.desc
											.split('\n')
											.filter((v) => v.trim())
											.map((v, i) => (
												<p className="fx-line" key={i}>
													{v}
												</p>
											))
									) : (
										/* 설명이 없는 상태가 있다 — 결손이 아니라 효과가 없는 것이다. */
										<Nothing kind="absent">{ko ? '설명 없음' : 'No description'}</Nothing>
									)}
								</div>
							</article>
						))}
					</div>
				</Panel>
			) : null}
		</>
	);
}
