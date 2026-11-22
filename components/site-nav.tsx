'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';
import type { Locale } from '@/lib/locale';
import { NAV_PRIMARY, NAV_SECONDARY, UI } from '@/lib/ui-text';
import { InterfaceIcon } from './interface-icon';
import { resetListNavigation } from './use-list-memory';

export function SiteNav({ locale }: { locale: Locale }) {
	const pathname = usePathname(),
		ko = locale === 'ko',
		t = UI[locale];
	const dialog = useRef<HTMLDialogElement>(null),
		trigger = useRef<HTMLButtonElement>(null),
		more = useRef<HTMLDetailsElement>(null);
	const motion = useRef<Animation|null>(null);
    const close = (immediate = false) => {
        const el=dialog.current;if(!el?.open)return;
        if(el.dataset.closing==='true'&&!immediate)return;
        const from=getComputedStyle(el).transform;
        motion.current?.cancel();
        if(immediate||matchMedia('(prefers-reduced-motion: reduce)').matches){el.close();return;}
        el.dataset.closing='true';
        motion.current=el.animate([{transform:from},{transform:'translateX(-100%)'}],{duration:180,easing:'cubic-bezier(.2,.8,.2,1)'});
        motion.current.onfinish=()=>{el.close();delete el.dataset.closing;motion.current=null};
    };
	useEffect(() => {
		close(true);
		if (more.current) more.current.open = false;
	}, [pathname]);
	useEffect(() => {
		const outside = (e: PointerEvent) => {
			if (more.current && !more.current.contains(e.target as Node)) more.current.open = false;
		};
		const escape = (e: KeyboardEvent) => {
			if (e.key === 'Escape' && more.current?.open) {
				more.current.open = false;
				more.current.querySelector('summary')?.focus();
			}
		};
		const resize = () => {
			if (innerWidth > 1000) close(true);
		};
		document.addEventListener('pointerdown', outside);
		document.addEventListener('keydown', escape);
		window.addEventListener('resize', resize);
		return () => {
			document.removeEventListener('pointerdown', outside);
			document.removeEventListener('keydown', escape);
			window.removeEventListener('resize', resize);
			document.body.style.overflow = '';
		};
	}, []);
	const item = (key: keyof typeof t.nav) => {
		const href = `/${locale}/${key}`;
		return (
			<Link
				key={key}
				href={href}
				aria-current={pathname === href || pathname.startsWith(`${href}/`) ? 'page' : undefined}
				onClick={(event)=>{if(event.button===0&&!event.metaKey&&!event.ctrlKey&&!event.shiftKey&&!event.altKey){resetListNavigation(href);close(true);}}}
			>
				{t.nav[key]}
			</Link>
		);
	};
	return (
		<>
			<button
				ref={trigger}
				className="ui-button ui-icon-button mobile-nav-trigger"
				type="button"
				aria-label={ko ? '메뉴 열기' : 'Open navigation'}
				onClick={() => {
					const el=dialog.current;if(!el)return;
                    motion.current?.cancel();delete el.dataset.closing;el.showModal();
                    if(!matchMedia('(prefers-reduced-motion: reduce)').matches)motion.current=el.animate([{transform:'translateX(-100%)'},{transform:'translateX(0)'}],{duration:260,easing:'cubic-bezier(.2,.8,.2,1)'});
					document.body.style.overflow = 'hidden';
				}}
			>
				<InterfaceIcon name="menu" />
			</button>
			<nav className="site-nav" aria-label={ko ? '주 메뉴' : 'Main navigation'}>
				{NAV_PRIMARY.map((key, i) => (
					<span className={i === 2 ? 'nav-item nav-group-start' : 'nav-item'} key={key}>
						{item(key)}
					</span>
				))}
				<details className="nav-more" ref={more}>
					<summary>
						{ko ? '더 보기' : 'More'}
						<InterfaceIcon name="chevron" />
					</summary>
					<div className="nav-popover">
						{NAV_SECONDARY.map(item)}
						{item('about')}
					</div>
				</details>
			</nav>
			<dialog
				ref={dialog}
				className="navigation-drawer"
                onCancel={e=>{e.preventDefault();close()}}
				aria-label={ko ? '전체 메뉴' : 'All navigation'}
				onClose={() => {
					document.body.style.overflow = '';
					trigger.current?.focus();
				}}
				onClick={(e) => {
					if (e.target === e.currentTarget) {
						const r = e.currentTarget.getBoundingClientRect();
						if (e.clientX > r.right) close();
					}
				}}
			>
				<div className="drawer-heading">
					<span>
						Limbus Company
						<br />
						<small>Dossier</small>
					</span>
					<button
						type="button"
						className="ui-button ui-icon-button"
						aria-label={ko ? '메뉴 닫기' : 'Close navigation'}
						onClick={()=>close()}
					>
						<InterfaceIcon name="close" />
					</button>
				</div>
				<nav className="drawer-links" aria-label={ko ? '모바일 메뉴' : 'Mobile navigation'}>
					<Link href={`/${locale}`} onClick={()=>close()}>
						{ko ? '홈' : 'Home'}
					</Link>
					<div className="drawer-group">{NAV_PRIMARY.slice(0, 2).map(item)}</div>
					<div className="drawer-group">{NAV_PRIMARY.slice(2).map(item)}</div>
					<div className="drawer-group">
						{NAV_SECONDARY.map(item)}
						{item('about')}
					</div>
				</nav>
			</dialog>
		</>
	);
}
