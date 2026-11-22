'use client';
import { useEffect, useState } from 'react';
import { InterfaceIcon } from './interface-icon';

export const THEME_KEY = 'dossier-theme';
export function ThemeToggle({ ko }: { ko: boolean }) {
	const [dark, setDark] = useState(false);
	useEffect(() => {
		const media = matchMedia('(prefers-color-scheme: dark)');
		const sync = () => {
			let saved: string | null = null;
			try {
				saved = localStorage.getItem(THEME_KEY);
			} catch {}
			const next = saved === 'dark' || (saved !== 'light' && media.matches);
			document.documentElement.dataset.theme = next ? 'dark' : 'light';
			setDark(next);
		};
		sync();
		media.addEventListener('change', sync);
		window.addEventListener('storage', sync);
		return () => {
			media.removeEventListener('change', sync);
			window.removeEventListener('storage', sync);
		};
	}, []);
	return (
		<button
			type="button"
			className="ui-button ui-icon-button theme-toggle"
			aria-label={
				ko
					? dark
						? '라이트 모드로 변경'
						: '다크 모드로 변경'
					: dark
						? 'Use light theme'
						: 'Use dark theme'
			}
			onClick={() => {
				const next = !dark;
				setDark(next);
				document.documentElement.dataset.theme = next ? 'dark' : 'light';
				try {
					localStorage.setItem(THEME_KEY, next ? 'dark' : 'light');
				} catch {}
			}}
		>
			<InterfaceIcon name={dark ? 'sun' : 'moon'} />
		</button>
	);
}
