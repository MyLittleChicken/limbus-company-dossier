'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';

/**
 * 인격 · E.G.O · 기프트 목록.
 *
 * 세 화면이 같은 골격을 쓴다 — 섹션으로 가른 세로 카드 · 상단에 붙는 인라인 필터 ·
 * 정렬 뒤집기 · 이름 검색. 다른 것은 축 구성과 섹션 기준뿐이라 그것만 밖에서 받는다.
 * 인격은 수감자로, E.G.O 도 수감자로, 기프트는 키워드로 가른다.
 *
 * **거르기를 브라우저에서 한다.** 축이 여섯이고 셋이 관계 테이블이라 조건마다 다시
 * 질의하면 왕복이 잦다. 한 번에 받아 거르는 편이 싸고, 조건을 켤 때마다 화면이 즉시
 * 반응한다.
 *
 * **대신 그리기를 나눈다.** 기프트가 456 장이라 한 번에 다 그리면 첫 화면이 늦다.
 * 거른 결과를 `STEP` 씩 늘려 가며 그리고, 바닥에 둔 표적이 보이면 다음 몫을 붙인다.
 */

export type Unit = {
	id: string;
	/** 어느 섹션에 들어가는가. `sections` 의 id 와 맞춘다. */
	sectionId: string;
	/** 등급 그림. 없으면 `rankText` 를 쓴다. */
	rankIcon?: string | null;
	/** 등급을 글자로 낼 때. 기프트의 로마자가 그렇다 — 애셋이 없다. */
	rankText?: string | null;
	rankLabel?: string;
	/** 정렬의 첫 열쇠. 인격·E.G.O 는 등급이고 기프트도 등급이다. */
	grade: number;
	season?: number | null;
	released?: string | null;
	image: string | null;
	name: string;
	fellBack?: boolean;
	/** 카드 아래에 다는 한 줄. 시즌이 없는 목록이 쓴다. */
	note?: string | null;
	/** 축 id 집합. 필터가 이것만 본다. */
	tags: Record<string, string[]>;
};

export type AxisOption = { id: string; label: string; icon?: string | null };
export type Axis = {
	key: string;
	label: string;
	options: AxisOption[];
	/**
	 * 그림이 곧 이름인 축. 등급이 그렇다 — 인격은 물방울 수가 곧 등급이고 E.G.O 는
	 * 배너 안에 ZAYIN 이 그려져 있다. 글자를 덧붙이면 같은 말을 두 번 하게 된다.
	 */
	iconOnly?: boolean;
};
export type Section = { id: string; name: string; icon?: string | null };

/**
 * 한 번에 그리는 몫. 바닥에 닿으면 이만큼 늘린다.
 *
 * **인격 184 · E.G.O 110 은 한 번에 다 들어간다.** 나누는 것은 기프트 456 뿐이며 그것이
 * 노린 바다 — 200 보다 작게 잡았더니 인격 목록에서 뒤쪽 수감자 섹션이 처음에 없다가
 * 나중에 생겨 목차 감각이 깨졌다.
 */
const STEP = 200;

/**
 * 시즌 표기.
 *
 *   0      통상
 *   1~8    시즌 N
 *   91NN   발푸르기스의 밤 — 뒤 두 자리가 회차
 *   8000   콜라보 — 명일방주 「선의의 순례」. 표본이 1 건이라 상수로 다룬다
 */
export function seasonLabel(raw: number | null): string | null {
	if (raw === null || raw === undefined) return null;
	const n = String(raw);
	if (n === '0') return '통상';
	if (n === '8000') return '콜라보';
	if (n.startsWith('91') && n.length === 4) return `발푸르기스의 밤 ${Number(n.slice(2))}회`;
	return `시즌 ${n}`;
}

export function UnitList({
	units,
	axes,
	sections,
	basePath,
	searchPlaceholder,
	variant = 'portrait',
}: {
	units: Unit[];
	axes: Axis[];
	/** 섹션 머리. 여기 없는 `sectionId` 를 가진 카드는 그려지지 않는다. */
	sections: Section[];
	/*
		상세로 가는 경로의 앞부분. **함수를 받지 않는다** — 서버 컴포넌트에서 클라이언트로
		함수를 넘길 수 없어서다(직렬화 대상이 아니다).
	*/
	basePath: string;
	searchPlaceholder: string;
	/**
	 * 그림을 어떻게 앉히는가. 인물 초상은 잘라서 채우고(`portrait`), 물건 아이콘은
	 * 잘리면 무엇인지 알 수 없어 통 안에 온전히 넣는다(`icon`).
	 */
	variant?: 'portrait' | 'icon';
}) {
	const [picked, setPicked] = useState<Record<string, string[]>>({});
	const [open, setOpen] = useState<string | null>(null);
	const [q, setQ] = useState('');
	const [desc, setDesc] = useState(false);
	const [atTop, setAtTop] = useState(true);
	const openedAt = useRef(0);

	/*
		스크롤을 시작하면 펼친 축을 닫는다.

		덮지는 않지만 자리를 차지한다 — 소속 93 을 연 채 내려가면 붙어 있는 덩이가 화면
		절반을 먹는다. 여는 동안 문서가 길어지며 나는 보정은 사용자의 스크롤이 아니므로
		짧은 창 동안 무시한다.
	*/
	useEffect(() => {
		const onScroll = () => {
			setAtTop(window.scrollY <= 400);
			if (performance.now() - openedAt.current < 400) return;
			setOpen(null);
		};
		addEventListener('scroll', onScroll, { passive: true });
		return () => removeEventListener('scroll', onScroll);
	}, []);

	const toggle = (axis: string, id: string) => {
		/*
			**고르는 것은 스크롤이 아니다.**

			조건을 켜면 목록이 짧아지고 그만큼 문서가 줄어 브라우저가 스크롤 위치를 옮긴다.
			그 이동이 스크롤 이벤트로 오는데 위의 감시가 그것을 사용자 스크롤로 읽어 패널을
			닫았다 — 값 하나 고를 때마다 축이 접혀서 여럿을 고를 수 없었다. 여는 때와 같은
			창을 두어 무시한다.
		*/
		openedAt.current = performance.now();
		setPicked((prev) => {
			const cur = prev[axis] ?? [];
			const next = cur.includes(id) ? cur.filter((v) => v !== id) : [...cur, id];
			return next.length ? { ...prev, [axis]: next } : omit(prev, axis);
		});
	};

	const shown = useMemo(() => {
		const needle = q.trim().toLowerCase();
		return units.filter((u) => {
			if (needle && !u.name.toLowerCase().includes(needle)) return false;
			// 축끼리는 AND, 축 안의 값끼리는 OR 다. 「000 이면서 분노」가 자연스러운 읽기다.
			return Object.entries(picked).every(([axis, ids]) =>
				ids.some((id) => (u.tags[axis] ?? []).includes(id)),
			);
		});
	}, [units, picked, q]);

	/**
	 * 섹션 차례 → 등급 오름차순 → 출시일.
	 *
	 * **섹션을 첫 열쇠로 둔다.** 등급만으로 늘어놓고 앞에서부터 자르면 그린 몫이 「모든
	 * 섹션의 I 등급」이 되고, 더 그릴 때 이미 지나친 섹션 한가운데에 II 등급이 끼어든다 —
	 * 읽는 사람에게는 다 본 자리에 없던 것이 생기는 셈이다. 섹션 순으로 늘어놓으면 자란
	 * 몫이 언제나 뒤에 붙는다.
	 *
	 * **날짜에 동률이 있다** — 같은 수감자 안에서 인격 12 건 · E.G.O 13 건이 같은 날짜다.
	 * 그래서 날짜가 같으면 id 로 가른다. id 가 출시 순서를 담고 있고 전수 검증에서 위반이 없다.
	 *
	 * 뒤집기는 **섹션 안에서만** 한다. 섹션 차례는 화면이 정한 것이라 정렬이 건드리지 않는다.
	 */
	const sectionRank = useMemo(
		() => new Map(sections.map((s, i) => [s.id, i])),
		[sections],
	);

	const sorted = useMemo(() => {
		const within = (a: Unit, b: Unit) =>
			a.grade - b.grade ||
			(a.released ?? '').localeCompare(b.released ?? '') ||
			a.id.localeCompare(b.id);
		// 섹션 목록에 없는 것은 뒤로 보낸다. 그려지지는 않지만 차례를 흔들지도 않는다.
		const rank = (u: Unit) => sectionRank.get(u.sectionId) ?? sections.length;
		return [...shown].sort(
			(a, b) => rank(a) - rank(b) || (desc ? -within(a, b) : within(a, b)),
		);
	}, [shown, desc, sectionRank, sections.length]);

	/*
		그리기를 나눈다.

		456 장을 한 번에 그리면 첫 화면이 늦다. 거른 결과의 앞에서부터 `STEP` 씩 붙이고
		바닥의 표적이 보이면 다음 몫을 잇는다. **조건이 바뀌면 처음으로 되돌린다** —
		안 그러면 좁게 거른 뒤에도 지난번에 늘려 둔 몫이 남아 엉뚱한 수를 그린다.
	*/
	const [limit, setLimit] = useState(STEP);
	const tail = useRef<HTMLButtonElement>(null);

	useEffect(() => setLimit(STEP), [picked, q, desc]);

	/*
		표적은 **눌러서도 더 볼 수 있는 버튼**이다.

		관찰자는 문서가 숨겨져 있으면 콜백을 부르지 않는다(`visibilityState` 가 `hidden` 인
		동안 실측으로 한 번도 오지 않았다). 그런 상황에서 빈 표적만 두면 목록이 거기서
		멈춘 채 아무 길도 남지 않는다. 손으로 이어갈 수 있게 두고, 관찰자는 그 버튼을 본다.
	*/
	useEffect(() => {
		const target = tail.current;
		if (!target) return;
		const io = new IntersectionObserver((entries) => {
			if (entries.some((e) => e.isIntersecting)) setLimit((n) => n + STEP);
		});
		io.observe(target);
		return () => io.disconnect();
	}, [sorted.length, limit]);

	const visible = useMemo(() => sorted.slice(0, limit), [sorted, limit]);

	const bySection = useMemo(() => {
		const map = new Map<string, Unit[]>();
		for (const u of visible) map.set(u.sectionId, [...(map.get(u.sectionId) ?? []), u]);
		return map;
	}, [visible]);

	/*
		섹션 머리의 수는 **거른 전부**를 센다. 그린 몫만 세면 아래로 내려갈수록 수가 자라
		읽는 사람이 무엇을 믿어야 할지 알 수 없다.
	*/
	const countBySection = useMemo(() => {
		const map = new Map<string, number>();
		for (const u of sorted) map.set(u.sectionId, (map.get(u.sectionId) ?? 0) + 1);
		return map;
	}, [sorted]);

	const axisOf = (key: string) => axes.find((a) => a.key === key);
	const labelOf = (axis: string, id: string) =>
		axisOf(axis)?.options.find((o) => o.id === id) ?? { id, label: id, icon: null };

	const conditions = Object.entries(picked).flatMap(([axis, ids]) =>
		ids.map((id) => ({ axis, ...labelOf(axis, id) })),
	);

	return (
		<>
			<div className="listbar">
				<div className="axisbar">
					{axes.map((a) => (
						<button
							key={a.key}
							type="button"
							className="chip axischip"
							aria-expanded={open === a.key}
							onClick={() => {
								openedAt.current = performance.now();
								setOpen((cur) => (cur === a.key ? null : a.key));
							}}
						>
							{a.label}
						</button>
					))}
					<div className="filters">
						<input
							className="srch"
							type="search"
							placeholder={searchPlaceholder}
							value={q}
							onChange={(e) => setQ(e.target.value)}
						/>
					</div>
				</div>

				<div className="axispanels" data-open={open !== null}>
					<div className="axispanels-in">
						{open ? (
							<div className="axispanel">
								<div className="filter-axis" role="group" aria-label={axisOf(open)?.label}>
									{axisOf(open)?.options.map((o) => (
										<button
											key={o.id}
											type="button"
											className="chip"
											aria-pressed={(picked[open] ?? []).includes(o.id)}
											onClick={() => toggle(open, o.id)}
										>
											{o.icon ? (
												/* eslint-disable-next-line @next/next/no-img-element */
												<img src={o.icon} alt={axisOf(open)?.iconOnly ? o.label : ''} />
											) : null}
											{axisOf(open)?.iconOnly && o.icon ? null : o.label}
										</button>
									))}
								</div>
							</div>
						) : null}
					</div>
				</div>

				<div className="toolrow">
					<div className="applied">
						<span className="filter-axis-label">적용됨</span>
						{conditions.length === 0 ? (
							<span className="hint">없음</span>
						) : (
							conditions.map((c) => (
								<button
									key={`${c.axis}:${c.id}`}
									type="button"
									className="chip"
									aria-pressed="true"
									onClick={() => toggle(c.axis, c.id)}
								>
									<span className="applied-k">{axisOf(c.axis)?.label}</span>
									{c.icon ? (
										/* eslint-disable-next-line @next/next/no-img-element */
										<img src={c.icon} alt={c.label} />
									) : null}
									{axisOf(c.axis)?.iconOnly && c.icon ? null : c.label}
								</button>
							))
						)}
						{conditions.length > 0 ? (
							<button type="button" className="chip chip-clear" onClick={() => setPicked({})}>
								조건 초기화
							</button>
						) : null}
					</div>

					<div className="sortbar">
						{/* 거른 뒤 몇 장이 남았는지. 섹션마다 수를 세게 하지 않는다. */}
						<span className="hint">
							{sorted.length === units.length ? units.length : `${sorted.length} / ${units.length}`}
						</span>
						<span className="filter-axis-label">정렬</span>
						<button type="button" className="chip" onClick={() => setDesc((v) => !v)}>
							{desc ? '내림차순 ↓' : '오름차순 ↑'}
						</button>
					</div>
				</div>
			</div>

			{sections.map((s) => {
				const rows = bySection.get(s.id) ?? [];
				if (!rows.length) return null;
				return (
					<div key={s.id}>
						<div className="seclabel secgroup" id={`sec-${s.id}`}>
							{s.icon ? (
								/* eslint-disable-next-line @next/next/no-img-element */
								<img className="icon" src={s.icon} alt="" width={28} height={28} />
							) : null}
							<h2>{s.name}</h2>
							<span className="rule" />
							<span className="hint">{countBySection.get(s.id) ?? rows.length}</span>
						</div>
						<ul className={variant === 'icon' ? 'cardgrid cardgrid-gift' : 'cardgrid'}>
							{rows.map((u) => (
								<li key={u.id}>
									<Link className="card unit" href={`${basePath}/${u.id}`}>
										<strong className="unit-name" title={u.name}>
											{u.name}
										</strong>
										<span className="unit-art">
											{u.image ? (
												/* eslint-disable-next-line @next/next/no-img-element */
												<img src={u.image} alt="" loading="lazy" />
											) : null}
											{u.rankIcon ? (
												/* eslint-disable-next-line @next/next/no-img-element */
												<img className="unit-rank" src={u.rankIcon} alt={u.rankLabel ?? ''} />
											) : null}
											{/* 등급 애셋이 없는 목록은 글자로 낸다 — 기프트의 로마자가 그렇다. */}
											{u.rankText ? <span className="gift-tier">{u.rankText}</span> : null}
										</span>
										<span className="card-meta">
											{u.season === undefined ? null : seasonLabel(u.season) ? (
												<span className="tag">{seasonLabel(u.season)}</span>
											) : (
												// 시즌을 쓰는 목록에서만 결손을 말한다. 기프트는 시즌 자체가 없다.
												<span className="tag absent">시즌 없음</span>
											)}
											{/* 시즌 옆에 한 줄 더. 인격의 획득 경로가 여기 온다. */}
											{u.note != null ? <span className="tag">{u.note}</span> : null}
											{u.fellBack ? <abbr className="fellback">EN</abbr> : null}
										</span>
									</Link>
								</li>
							))}
						</ul>
					</div>
				);
			})}

			{/* 바닥 표적. 여기가 보이면 다음 몫을 잇고, 눌러도 이어진다. */}
			{visible.length < sorted.length ? (
				<button
					type="button"
					ref={tail}
					className="loadmore"
					onClick={() => setLimit((n) => n + STEP)}
				>
					더 보기
					<span className="hint">
						{visible.length} / {sorted.length}
					</span>
				</button>
			) : null}

			{sorted.length === 0 ? <p className="emptied">조건에 맞는 것이 없습니다</p> : null}

			<a className="totop" href="#top" data-on={!atTop} aria-label="맨 위로">
				↑
			</a>
		</>
	);
}

function omit<T extends Record<string, unknown>>(obj: T, key: string): T {
	const next = { ...obj };
	delete next[key];
	return next;
}
