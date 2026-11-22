'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {useListMemory} from './use-list-memory';
import {createKoreanMatcher,canSearch} from '@/lib/korean-search';
import {compareCatalogueUnits,catalogueSearchKey} from '@/lib/catalogue-order';
import {listStateKey} from '@/lib/navigation-state';
import { useSearchParams } from 'next/navigation';
import { seasonLabel } from '@/lib/season';
import { CatalogueToolbar } from './catalogue-toolbar';
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
    isBase?: boolean;
	season?: number | null;
	released?: string | null;
	image: string | null;
	name: string;
	fellBack?: boolean;
	/**
	 * 카드 아래에 다는 한 줄. 시즌을 쓰지 않는 목록이 이 자리를 쓴다 —
	 * 기프트의 「전용 / 공통」이 그렇다.
	 */
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

const STEP = 48;
type Conditions = { q: string; picked: Record<string, string[]> };
export function UnitList({
	units,
	axes,
	sections,
	basePath,
	searchPlaceholder,
	title,
	variant = 'portrait',
	gradeOrder = variant === 'icon' ? 'desc' : 'asc',
}: {
	units: Unit[];
	axes: Axis[];
	sections: Section[];
	basePath: string;
	searchPlaceholder: string;
	title: string;
	variant?: 'portrait' | 'icon';
	gradeOrder?: 'asc' | 'desc' | 'none';
}) {
	const ko = basePath.startsWith('/ko/'),
		params = useSearchParams(),
		serialized = params.toString();
	const applied = useMemo(() => {
		const sp = new URLSearchParams(serialized),
			picked: Record<string, string[]> = {};
		for (const a of axes) {
			const raw = sp.getAll(a.key).flatMap((v) => v.split(','));
			if (a.key === 'association') raw.push(...sp.getAll('affiliation'));
			const valid = raw.filter((v) => a.options.some((o) => o.id === v));
			if (valid.length) picked[a.key] = [...new Set(valid)];
		}
		return { q: sp.get('q') || '', picked };
	}, [serialized, axes]);
	const [draft, setDraft] = useState<Conditions>(applied),
		[limit, setLimit] = useState(STEP),
		[atTop, setAtTop] = useState(true);
	const liveQuery=useRef<string|null>(null);
	const tail = useRef<HTMLButtonElement>(null);
	useListMemory(basePath,serialized,limit,setLimit);
	useEffect(() => {
		if(liveQuery.current===applied.q){liveQuery.current=null;return;}
        setDraft(applied);
	}, [applied]);
	useEffect(() => {
		const scroll = () => setAtTop(scrollY < 500);
		window.addEventListener('scroll', scroll, { passive: true });
		return () => window.removeEventListener('scroll', scroll);
	}, []);
	const apply = (next: Conditions) => {
		const sp = new URLSearchParams();
		if (canSearch(next.q)) sp.set('q', next.q.trim());
		for (const [key, ids] of Object.entries(next.picked))
			if (ids.length) sp.set(key, ids.join(','));
		try { sessionStorage.removeItem(listStateKey(basePath,sp.toString())); } catch {}
		history.pushState(null, '', basePath + (sp.size ? '?' + sp : ''));
		setDraft(next);
		setLimit(STEP);
	};
	const toggle = (key: string, id: string) =>
		setDraft((prev) => {
			const ids = prev.picked[key] || [];
			return {
				...prev,
				picked: {
					...prev.picked,
					[key]: ids.includes(id) ? ids.filter((v) => v !== id) : [...ids, id],
				},
			};
		});
	const sorted = useMemo(() => {
		const needle = catalogueSearchKey(applied.q);
        const matches=createKoreanMatcher(applied.q);
		const order = new Map(sections.map((s, i) => [s.id, i]));
		return units
			.filter(
				(u) =>
					(!needle || matches(u.name)) &&
					Object.entries(applied.picked).every(
						([key, ids]) => !ids.length || ids.some((id) => u.tags[key]?.includes(id)),
					),
			)
			.sort(
				(a, b) =>
					(order.get(a.sectionId) ?? 0) - (order.get(b.sectionId) ?? 0) ||
					compareCatalogueUnits(a,b,ko?'ko':'en',gradeOrder),
			);
	}, [units, sections, applied, ko, gradeOrder]);
	useEffect(() => {
		const el = tail.current;
		if (!el) return;
		const observer = new IntersectionObserver(
			([entry]) => {
				if (entry?.isIntersecting) setLimit((n) => n + STEP);
			},
			{ rootMargin: '600px' },
		);
		observer.observe(el);
		return () => observer.disconnect();
	}, [limit, sorted.length]);
	const conditions = axes.flatMap((a) =>
		(applied.picked[a.key] || []).map((id) => ({
			key: a.key,
			id,
			label: a.options.find((o) => o.id === id)?.label ?? id,
		})),
	);
	return (
		<>
			<CatalogueToolbar
				title={title}
				ko={ko}
				query={draft.q}
				onQuery={(q) => setDraft((prev) => ({ ...prev, q }))}
				onAutoQuery={(q)=>{
                    if(q===applied.q)return;
                    const sp=new URLSearchParams(serialized);
                    if(q)sp.set('q',q);else sp.delete('q');
                    liveQuery.current=q;
                    try{sessionStorage.removeItem(listStateKey(basePath,sp.toString()));}catch{}
                    history.replaceState(null,'',basePath+(sp.size?'?'+sp:''));
                    setLimit(STEP);
                }}
                placeholder={searchPlaceholder}
				active={conditions.length}
				onApply={() => apply(draft)}
				onReset={() => setDraft({ q: '', picked: {} })}
			>
				{axes.filter(a=>a.options.length>0).map((a) => (
					<fieldset className="catalogue-axis" key={a.key}>
						<legend>{a.label}</legend>
						<div className="catalogue-options">
							{a.options.map((o) => (
								<label key={o.id}>
									<input
										type="checkbox"
										checked={draft.picked[a.key]?.includes(o.id) ?? false}
										onChange={() => toggle(a.key, o.id)}
									/>
									{o.icon && <img src={o.icon} alt="" loading="lazy" />}
									<span>{o.label}</span>
								</label>
							))}
						</div>
					</fieldset>
				))}
			</CatalogueToolbar>
			<div className="catalogue-results" aria-live="polite">
				<span>{ko ? `${sorted.length}개 항목` : `${sorted.length} entries`}</span>
				{applied.q && <span className="result-token">{applied.q}</span>}
				{conditions.map((c) => (
					<span className="result-token" key={`${c.key}-${c.id}`}>
						{c.label}
					</span>
				))}
				{(applied.q || conditions.length > 0) && (
					<button
						className="text-button"
						type="button"
						onClick={() => apply({ q: '', picked: {} })}
					>
						{ko ? '모두 해제' : 'Clear all'}
					</button>
				)}
			</div>
			{sections.map((s) => {
				const all = sorted.filter((u) => u.sectionId === s.id),
					rows = sorted.slice(0, limit).filter((u) => u.sectionId === s.id);
				if (!rows.length) return null;
				return (
					<section key={s.id} className="catalogue-group">
						<div className="catalogue-group-heading" id={`sec-${s.id}`}>
							{s.icon && <img src={s.icon} alt="" width="26" height="26" />}
							<h2>{s.name}</h2>
							<span>
								{all.length}
								{ko ? '개' : ''}
							</span>
						</div>
						<ul className={`catalogue-grid ${variant === 'icon' ? 'catalogue-grid-icons' : ''}`}>
							{rows.map((u) => (
								<li key={u.id} data-entry-id={u.id}>
									<Link className="catalogue-card" href={`${basePath}/${u.id}`}>
										<h3>{u.name}</h3>
										<span className="catalogue-art">
											{u.image && <img src={u.image} alt="" loading="lazy" />}
										</span>
										<span className="catalogue-meta">
											{u.rankIcon ? (
												<img className="catalogue-rank" src={u.rankIcon} alt={u.rankLabel ?? ''} />
											) : (
												<span className="catalogue-tier">{u.rankText}</span>
											)}
											<span>
												{u.season !== undefined ? seasonLabel(u.season, ko ? 'ko' : 'en') : u.note}
											</span>
										</span>
									</Link>
								</li>
							))}
						</ul>
					</section>
				);
			})}
			{limit < sorted.length && (
				<button
					type="button"
					ref={tail}
					className="loadmore"
					onClick={() => setLimit((n) => n + STEP)}
				>
					{ko ? '더 보기' : 'Load more'}
				</button>
			)}
			{!sorted.length && (
				<p className="emptied">{ko ? '검색 결과가 없습니다.' : 'No results found.'}</p>
			)}
			<a className="totop" href="#top" data-on={!atTop} aria-label={ko ? '맨 위로' : 'Back to top'}>
				↑
			</a>
		</>
	);
}
