'use client';

import { useLayoutEffect } from 'react';
import { usePathname } from 'next/navigation';
import { localeFromPathname } from '@/lib/locale';

/** Root layouts persist across navigation. Initial HTML already has its server-rendered language. */
export function DocumentLanguage() {
	const pathname = usePathname();
	useLayoutEffect(() => {
		document.documentElement.lang = localeFromPathname(pathname);
	}, [pathname]);
	return null;
}
