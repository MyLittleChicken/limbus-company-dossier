'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { atkTypeIcon, egoRankIcon, keywordIcon, rarityIcon, sinIcon } from '@/lib/assets';
import { EGO_RANKS, type EgoRank } from '@/lib/storage/schema';
import type { SquadAxes, SquadEgo, SquadIdentity, SquadSinner } from '@/lib/queries/squad';

/**
 * 편성 선택 모달.
 *
 * **칸은 결과만 보이고 고르는 일은 여기서 한다**(`reference/v1-formation-ui.md` 1절).
 * 칸 안에 `select` 를 넣으면 필터가 들어갈 자리가 없어 수감자당 인격 14~16종을 이름만 보고
 * 골라야 한다. 이전 프로토타입이 같은 이유로 선택을 모달로 뺐다.
 *
 * 인격과 E.G.O 를 한 모달의 두 탭으로 둔다. 어느 쪽을 눌러 열었는지가 첫 탭을 정한다.
 */

export type PickMode = 'identity' | 'ego';

/** 필터 축 하나. **그룹 간 AND, 그룹 내 OR** — 목록 화면의 규칙과 같다. */
interface Axis {
	key: string;
	label: string;
	options: Array<{ value: string; label: string; icon: string | null }>;
}

type Selected = Record<string, Set<string>>;

const hasAny = (selected: Set<string> | undefined, values: readonly string[]): boolean =>
	!selected || selected.size === 0 || values.some((v) => selected.has(v));

/**
 * 축의 선택지를 **그 수감자의 풀에서** 만든다.
 *
 * 전역 목록을 깔면 눌러도 0건인 필터가 생긴다. 실제로 등장하는 값만 칩으로 낸다.
 */
function axisOptions<T>(
	pool: readonly T[],
	pick: (item: T) => readonly string[],
	label: (value: string) => string,
	icon: (value: string) => string | null,
	order?: readonly string[],
): Axis['options'] {
	const seen = new Set<string>();
	for (const item of pool) for (const v of pick(item)) seen.add(v);
	const values = [...seen];
	if (order) {
		const at = (v: string) => {
			const i = order.indexOf(v);
			return i < 0 ? order.length : i;
		};
		values.sort((a, b) => at(a) - at(b) || a.localeCompare(b));
	} else {
		values.sort();
	}
	return values.map((v) => ({ value: v, label: label(v), icon: icon(v) }));
}

export function FormationPicker({
	sinner,
	mode,
	axes,
	identityId,
	egos,
	supply,
	ko,
	onMode,
	onIdentity,
	onEgo,
	onClose,
}: {
	sinner: SquadSinner;
	mode: PickMode;
	axes: SquadAxes;
	identityId: number | null;
	egos: Partial<Record<EgoRank, number>>;
	/**
	 * 죄악별 공급 — **편성 전체**의 공격 스킬 수.
	 *
	 * E.G.O 비용을 이 값과 대조해 모자란 죄악을 카드에 표기한다. 고르는 자리에서 자원 수급이
	 * 보여야 한다는 것이 이전 프로토타입의 판단이고 그것을 가져온다. 이 수감자가 아니라
	 * 편성 전체를 세는 이유는 비용이 팀 자원에서 나가기 때문이다.
	 */
	supply: Record<string, number>;
	ko: boolean;
	onMode: (mode: PickMode) => void;
	onIdentity: (id: number | null) => void;
	onEgo: (rank: EgoRank, id: number | null) => void;
	onClose: () => void;
}) {
	const [selected, setSelected] = useState<Selected>({});
	const [affiliation, setAffiliation] = useState('');
	const closeRef = useRef<HTMLButtonElement>(null);

	// 탭을 바꾸면 필터를 비운다. 축이 서로 달라 남겨두면 보이지 않는 조건이 목록을 거른다.
	useEffect(() => {
		setSelected({});
		setAffiliation('');
	}, [mode, sinner.id]);

	useEffect(() => {
		closeRef.current?.focus();
		const onKey = (e: KeyboardEvent) => {
			if (e.key === 'Escape') onClose();
		};
		window.addEventListener('keydown', onKey);
		return () => window.removeEventListener('keydown', onKey);
	}, [onClose]);

	const label = (v: string) => axes.labels[v] ?? v;
	const name = axes.labels;

	const identityAxes = useMemo((): Axis[] => {
		const pool = sinner.identities;
		return [
			{
				key: 'kw',
				label: ko ? '키워드' : 'Keyword',
				options: axisOptions(pool, (i) => i.keywords, label, keywordIcon),
			},
			{
				key: 'sin',
				label: ko ? '죄악' : 'Sin',
				options: axisOptions(pool, (i) => i.skillSins, label, sinIcon, axes.sinOrder),
			},
			{
				key: 'atk',
				label: ko ? '공격' : 'Attack',
				options: axisOptions(pool, (i) => i.atkTypes, label, atkTypeIcon),
			},
			// 키워드·소속과 나란한 독립 축이다. 섞지 않는다(05-ui-foundation 4.3).
			{
				key: 'mech',
				label: ko ? '특수' : 'Special',
				options: axisOptions(pool, (i) => i.mechanics, label, () => null),
			},
		].filter((a) => a.options.length > 0);
	}, [sinner, axes, ko]);

	/**
	 * 소속만 드롭다운이다.
	 *
	 * 수감자당 20종을 넘어 칩으로 깔면 목록 공간을 다 먹는다. 축의 크기가 형태를 정한다.
	 */
	const affiliations = useMemo(() => {
		const map = new Map<string, string>();
		for (const i of sinner.identities) {
			for (const a of i.affiliations) map.set(a.id, a.text?.name ?? a.id);
		}
		return [...map].sort((a, b) => a[1].localeCompare(b[1]));
	}, [sinner]);

	const egoAxes = useMemo((): Axis[] => {
		const pool = sinner.egos;
		return [
			{
				key: 'rank',
				label: ko ? '등급' : 'Rank',
				options: axisOptions(pool, (e) => [e.rank], (v) => v, egoRankIcon, EGO_RANKS),
			},
			{
				key: 'kw',
				label: ko ? '키워드' : 'Keyword',
				options: axisOptions(pool, (e) => e.keywords, label, keywordIcon),
			},
			{
				key: 'cost',
				label: ko ? '비용' : 'Cost',
				options: axisOptions(pool, (e) => e.costs.map((c) => c.sin), label, sinIcon, axes.sinOrder),
			},
			{
				key: 'atk',
				label: ko ? '공격' : 'Attack',
				options: axisOptions(pool, (e) => [e.awakenAtkType], label, atkTypeIcon),
			},
		].filter((a) => a.options.length > 0);
	}, [sinner, axes, ko]);

	const identities = useMemo(
		() =>
			sinner.identities.filter(
				(i) =>
					hasAny(selected['kw'], i.keywords) &&
					hasAny(selected['sin'], i.skillSins) &&
					hasAny(selected['atk'], i.atkTypes) &&
					hasAny(selected['mech'], i.mechanics) &&
					(affiliation === '' || i.affiliations.some((a) => a.id === affiliation)),
			),
		[sinner, selected, affiliation],
	);

	const egoList = useMemo(
		() =>
			sinner.egos.filter(
				(e) =>
					hasAny(selected['rank'], [e.rank]) &&
					hasAny(selected['kw'], e.keywords) &&
					hasAny(selected['cost'], e.costs.map((c) => c.sin)) &&
					hasAny(selected['atk'], [e.awakenAtkType]),
			),
		[sinner, selected],
	);

	const activeCount =
		Object.values(selected).reduce((n, s) => n + s.size, 0) + (affiliation === '' ? 0 : 1);

	const toggle = (axis: string, value: string) =>
		setSelected((prev) => {
			const next = new Set(prev[axis] ?? []);
			if (next.has(value)) next.delete(value);
			else next.add(value);
			return { ...prev, [axis]: next };
		});

	const shown = mode === 'identity' ? identityAxes : egoAxes;

	return (
		<div className="modal" role="dialog" aria-modal="true" aria-label={sinner.text?.name ?? String(sinner.id)}>
			{/* 배경을 눌러도 닫힌다. 버튼이라 키보드로도 닿는다. */}
			<button type="button" className="modal-scrim" aria-label={ko ? '닫기' : 'Close'} onClick={onClose} />

			<div className="msheet">
				<header className="mhead">
					<h3>{sinner.text?.name ?? `#${sinner.id}`}</h3>
					<span className="rule" />
					<button ref={closeRef} type="button" className="chip" onClick={onClose}>
						{ko ? '닫기' : 'Close'}
					</button>
				</header>

				<div className="mtabs" role="tablist">
					<button
						type="button"
						role="tab"
						className="mtab"
						aria-selected={mode === 'identity'}
						onClick={() => onMode('identity')}
					>
						{ko ? '인격' : 'Identity'} <span className="tag">{sinner.identities.length}</span>
					</button>
					<button
						type="button"
						role="tab"
						className="mtab"
						aria-selected={mode === 'ego'}
						onClick={() => onMode('ego')}
					>
						E.G.O{' '}
						<span className="tag">
							{Object.values(egos).filter((v) => v !== undefined).length}/{EGO_RANKS.length}
						</span>
					</button>
				</div>

				<div className="mtools">
					{shown.map((axis) => (
						<div key={axis.key} className="filter-axis" role="group" aria-label={axis.label}>
							<span className="filter-axis-label">{axis.label}</span>
							{axis.options.map((o) => (
								<button
									key={o.value}
									type="button"
									className="chip"
									aria-pressed={selected[axis.key]?.has(o.value) ?? false}
									onClick={() => toggle(axis.key, o.value)}
								>
									{o.icon ? (
										/* eslint-disable-next-line @next/next/no-img-element */
										<img src={o.icon} alt="" width={16} height={16} />
									) : null}
									{o.label}
								</button>
							))}
						</div>
					))}

					{mode === 'identity' && affiliations.length > 0 && (
						<div className="filter-axis">
							<span className="filter-axis-label">{ko ? '소속' : 'Affiliation'}</span>
							<select value={affiliation} onChange={(e) => setAffiliation(e.target.value)}>
								<option value="">
									{ko ? '전체' : 'All'} ({affiliations.length})
								</option>
								{affiliations.map(([id, text]) => (
									<option key={id} value={id}>
										{text}
									</option>
								))}
							</select>
						</div>
					)}

					{activeCount > 0 && (
						<div className="filter-axis">
							<span className="filter-axis-label" />
							<button
								type="button"
								className="chip chip-clear"
								onClick={() => {
									setSelected({});
									setAffiliation('');
								}}
							>
								{ko ? `필터 해제 ${activeCount}` : `Clear ${activeCount}`}
							</button>
						</div>
					)}
				</div>

				<div className="mbody">
					{mode === 'identity' ? (
						<ul className="pickgrid">
							{/* 비우는 것도 선택이다. 편성하지 않은 칸을 표현할 수 있어야 한다. */}
							<li>
								<button
									type="button"
									className="pickcard pickcard-none"
									aria-pressed={identityId === null}
									onClick={() => onIdentity(null)}
								>
									{ko ? '편성하지 않음' : 'Leave empty'}
								</button>
							</li>
							{identities.map((i) => (
								<li key={i.id}>
									<IdentityCard
										identity={i}
										on={identityId === i.id}
										label={label}
										onPick={() => onIdentity(identityId === i.id ? null : i.id)}
									/>
								</li>
							))}
						</ul>
					) : (
						<ul className="pickgrid">
							{egoList.map((e) => (
								<li key={e.id}>
									<EgoCard
										ego={e}
										on={egos[e.rank] === e.id}
										taken={egos[e.rank] !== undefined && egos[e.rank] !== e.id}
										supply={supply}
										label={label}
										ko={ko}
										onPick={() => onEgo(e.rank, egos[e.rank] === e.id ? null : e.id)}
									/>
								</li>
							))}
						</ul>
					)}
				</div>

				<footer className="mfoot">
					<span className="hint">
						{mode === 'ego'
							? ko
								? '등급마다 하나 — 같은 등급을 고르면 교체됩니다'
								: 'One per rank — picking another replaces it'
							: ko
								? '희귀도 · 죄악 · 공격 타입 · 키워드 · 소속은 모두 적재된 데이터입니다'
								: 'Rarity, sin, attack type, keyword and affiliation come from loaded data'}
					</span>
					<span className="hint">
						{mode === 'identity'
							? `${identities.length} / ${sinner.identities.length}`
							: `${egoList.length} / ${sinner.egos.length}`}
					</span>
				</footer>
			</div>
		</div>
	);
}

function IdentityCard({
	identity,
	on,
	label,
	onPick,
}: {
	identity: SquadIdentity;
	on: boolean;
	label: (v: string) => string;
	onPick: () => void;
}) {
	const rarity = rarityIcon(identity.rarity);
	return (
		<button type="button" className="pickcard" aria-pressed={on} onClick={onPick}>
			<span className="pickcard-port">
				{identity.image ? (
					/* eslint-disable-next-line @next/next/no-img-element */
					<img src={identity.image} alt="" loading="lazy" />
				) : (
					<span className="pickcard-port-none" aria-hidden="true" />
				)}
				{rarity ? (
					/* eslint-disable-next-line @next/next/no-img-element */
					<img className="pickcard-rarity" src={rarity} alt={'0'.repeat(identity.rarity)} />
				) : (
					<span className="pickcard-rarity tag">{'0'.repeat(identity.rarity)}</span>
				)}
			</span>
			<span className="pickcard-body">
				<strong>{identity.text?.name ?? `#${identity.id}`}</strong>
				<span className="card-meta">
					{identity.keywords.map((k) => (
						<AxisTag key={k} value={k} label={label} icon={keywordIcon(k)} />
					))}
					{identity.mechanics.map((k) => (
						<AxisTag key={k} value={k} label={label} icon={null} />
					))}
				</span>
				<span className="card-meta">
					{[...new Set(identity.skillSins)].map((s) => (
						<AxisTag key={s} value={s} label={label} icon={sinIcon(s)} />
					))}
					{identity.atkTypes.map((t) => (
						<AxisTag key={t} value={t} label={label} icon={atkTypeIcon(t)} />
					))}
				</span>
			</span>
		</button>
	);
}

function EgoCard({
	ego,
	on,
	taken,
	supply,
	label,
	ko,
	onPick,
}: {
	ego: SquadEgo;
	on: boolean;
	taken: boolean;
	supply: Record<string, number>;
	label: (v: string) => string;
	ko: boolean;
	onPick: () => void;
}) {
	const rank = egoRankIcon(ego.rank);
	return (
		<button
			type="button"
			className={taken ? 'pickcard pickcard-taken' : 'pickcard'}
			aria-pressed={on}
			onClick={onPick}
			title={taken ? (ko ? `${ego.rank} 등급에 다른 E.G.O 장착 중 — 누르면 교체됩니다` : 'Replaces the equipped one') : undefined}
		>
			<span className="pickcard-port">
				{ego.image ? (
					/* eslint-disable-next-line @next/next/no-img-element */
					<img src={ego.image} alt="" loading="lazy" />
				) : (
					<span className="pickcard-port-none" aria-hidden="true" />
				)}
			</span>
			<span className="pickcard-body">
				<strong>{ego.text?.name ?? `#${ego.id}`}</strong>
				<span className="card-meta">
					{rank ? (
						/* eslint-disable-next-line @next/next/no-img-element */
						<span className="tag tag-icon">
							<img src={rank} alt="" width={16} height={16} />
							{ego.rank}
						</span>
					) : (
						<span className="tag">{ego.rank}</span>
					)}
					<AxisTag value={ego.awakenAffinity} label={label} icon={sinIcon(ego.awakenAffinity)} />
					<AxisTag value={ego.awakenAtkType} label={label} icon={atkTypeIcon(ego.awakenAtkType)} />
				</span>
				{/* 팀의 죄악 공급보다 요구량이 많으면 표기한다. 색만으로 구분하지 않는다(05-ui 8절). */}
				<span className="card-meta">
					{ego.costs.map((c) => {
						const short = (supply[c.sin] ?? 0) < c.amount;
						const icon = sinIcon(c.sin);
						return (
							<span
								key={c.sin}
								className={short ? 'tag tag-icon cost-short' : 'tag tag-icon'}
								title={`${label(c.sin)} ${c.amount} ${ko ? '필요' : 'needed'} · ${ko ? '공급' : 'supply'} ${supply[c.sin] ?? 0}`}
							>
								{icon ? (
									/* eslint-disable-next-line @next/next/no-img-element */
									<img src={icon} alt="" width={16} height={16} />
								) : (
									`${label(c.sin)} `
								)}
								{c.amount}
								{short ? <b aria-hidden="true"> !</b> : null}
							</span>
						);
					})}
				</span>
			</span>
		</button>
	);
}

function AxisTag({
	value,
	label,
	icon,
}: {
	value: string;
	label: (v: string) => string;
	icon: string | null;
}) {
	if (!icon) return <span className="tag">{label(value)}</span>;
	return (
		<span className="tag tag-icon">
			{/* eslint-disable-next-line @next/next/no-img-element */}
			<img src={icon} alt="" width={16} height={16} />
			{label(value)}
		</span>
	);
}
