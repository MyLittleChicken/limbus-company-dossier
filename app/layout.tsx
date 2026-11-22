import type { ReactNode } from 'react';
import { headers } from 'next/headers';
import { DOCUMENT_PATH_HEADER, localeFromPathname } from '@/lib/locale';
import { DocumentLanguage } from '@/components/document-language';
import './tokens.css';
import './globals.css';
import './dossier.css';
import './experience.css';
import './motion.css';

/** The proxy supplies the document path for SSR; the client bridge handles subsequent navigation. */
export default async function RootLayout({ children }: { children: ReactNode }) {
	const requestHeaders = await headers();
	const locale = localeFromPathname(requestHeaders.get(DOCUMENT_PATH_HEADER) ?? '/');
	return (
		<html lang={locale} suppressHydrationWarning>
			<head><link rel="preload" href="/fonts/pretendard.woff2" as="font" type="font/woff2" crossOrigin="anonymous"/><link rel="preload" href="/fonts/chakra.ttf" as="font" type="font/ttf" crossOrigin="anonymous"/></head>
            <body>
				<script
					dangerouslySetInnerHTML={{
						__html: `(function(){try{var t=localStorage.getItem('dossier-theme');document.documentElement.dataset.theme=t==='dark'||(t!=='light'&&matchMedia('(prefers-color-scheme: dark)').matches)?'dark':'light'}catch(e){document.documentElement.dataset.theme=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}})()`,
					}}
				/>
				<DocumentLanguage />
				{children}
			</body>
		</html>
	);
}
