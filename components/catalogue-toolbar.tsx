'use client';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import {usePathname} from 'next/navigation';
import {useLiveSearch} from './use-live-search';
import {CatalogueSymbol} from './catalogue-symbol';
import { InterfaceIcon } from './interface-icon';

export function CatalogueToolbar({
	title,
	query,
	onQuery,
    onAutoQuery,
	onApply,
	onReset,
	placeholder,
	ko,
	active = 0,
	pending = false,
    hasFilters,
	children,
}: {
	title: string;
	query: string;
	onQuery: (q: string) => void;
    onAutoQuery?: (q:string)=>void;
	onApply: () => void;
	onReset: () => void;
	placeholder: string;
	ko: boolean;
	active?: number;
	pending?: boolean;
    hasFilters?: boolean;
	children?: ReactNode;
}) {
	const composition=useLiveSearch(query,q=>onAutoQuery?.(q));
	const section=usePathname().split('/')[2];
    const symbol=section==='identities'||section==='egos'||section==='gifts'||section==='packs'?section:null;
	const [open, setOpen] = useState(false),
		form = useRef<HTMLFormElement>(null),
        toggle = useRef<HTMLButtonElement>(null),
		id = useId();
    const closeFilters=()=>{
        if(form.current?.querySelector('.filter-reveal')?.contains(document.activeElement))toggle.current?.focus({preventScroll:true});
        setOpen(false);
    };
	useEffect(() => {
		let outside = false;
		const mark = (e: Event) => {
			outside = !form.current?.contains(e.target as Node);
		};
		const scroll = () => {
			if (outside) closeFilters();
		};
		window.addEventListener('wheel', mark, { passive: true });
		window.addEventListener('touchstart', mark, { passive: true });
		window.addEventListener('scroll', scroll, { passive: true });
		return () => {
			window.removeEventListener('wheel', mark);
			window.removeEventListener('touchstart', mark);
			window.removeEventListener('scroll', scroll);
		};
	}, []);
	return (
		<div className="catalogue-header">
			<h1 className="catalogue-title">{symbol&&<CatalogueSymbol section={symbol}/>}<span>{title}</span></h1>
			<form
				ref={form}
				className="catalogue-form"
				onSubmit={(e) => {
					e.preventDefault();
					onApply();
                    closeFilters();
				}}
				aria-busy={pending}
			>
				<div className="catalogue-search">
					<label className="search-field">
						<InterfaceIcon name="search" />
						<input
							type="search"
                        {...composition}
							value={query}
							onChange={(e) => onQuery(e.target.value)}
							placeholder={placeholder}
							aria-label={placeholder}
						/>
					</label>
					<button type="submit" className="ui-button ui-primary" disabled={pending}>
						{ko ? '검색' : 'Search'}
					</button>
					{(hasFilters ?? Boolean(children)) && (
						<button
							type="button"
							ref={toggle}
                            className="ui-button filter-toggle"
                            disabled={pending}
							aria-expanded={open}
							aria-controls={id}
							aria-label={ko ? '필터' : 'Filters'}
							onClick={() => setOpen((v) => !v)}
						>
							<InterfaceIcon name="filter" />
							<span className="filter-label">{ko ? '필터' : 'Filters'}</span>
							{active > 0 && <span className="filter-count">{active}</span>}
							<InterfaceIcon name="chevron" className="filter-chevron" />
						</button>
					)}
				</div>
				{children && (
					<div id={id} className="filter-reveal" data-open={open} inert={!open} aria-hidden={!open} onKeyDown={e=>{if(e.key==='Escape'){e.preventDefault();closeFilters()}}}>
                        <div className="filter-reveal-inner"><div className="catalogue-filter-panel">
						<div className="catalogue-filter-fields">{children}</div>
						<div className="filter-actions">
							<button type="button" className="ui-button" onClick={onReset}>
								{ko ? '초기화' : 'Reset'}
							</button>
							<button className="ui-button ui-primary" type="submit" disabled={pending}>
								{ko ? '적용' : 'Apply'}
							</button>
						</div>
                        </div></div>
					</div>
				)}
			</form>
		</div>
	);
}
