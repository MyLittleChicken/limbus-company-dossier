import type { SVGProps } from 'react';

const paths = {
 identities:'M5 3h12l3 3v15H4V3h1M8 8a3 3 0 1 0 6 0 3 3 0 0 0-6 0M7 18v-2a4 4 0 0 1 8 0v2M16 3v4h4',
 egos:'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Zm7 0a3 3 0 1 0 6 0 3 3 0 0 0-6 0M12 2v3m0 14v3',
 gifts:'M3 8h18v4H3zM5 12v9h14v-9M12 8v13M12 8H8a3 3 0 1 1 3-3l1 3Zm0 0h4a3 3 0 1 0-3-3l-1 3Z',
 packs:'M3 5h7l2 3h9v13H3V5Zm4 8h10M7 17h7',
	search: 'm21 21-4.3-4.3M19 11a8 8 0 1 1-16 0 8 8 0 0 1 16 0',
	filter: 'M4 7h9m4 0h3M4 17h3m4 0h9M13 4v6M7 14v6',
	menu: 'M4 6h16M4 12h16M4 18h16',
	close: 'm6 6 12 12M6 18 18 6',
	sun: 'M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
	moon: 'M20.9 13A9 9 0 0 1 11 3.1 9 9 0 1 0 20.9 13Z',
	chevron: 'm6 9 6 6 6-6',
	arrow: 'm9 5 7 7-7 7',
} as const;
export function InterfaceIcon({
	name,
	...props
}: SVGProps<SVGSVGElement> & { name: keyof typeof paths }) {
	return (
		<svg
			width="18"
			height="18"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="1.6"
			strokeLinecap="round"
			strokeLinejoin="round"
			aria-hidden="true"
			{...props}
		>
			<path d={paths[name]} />
		</svg>
	);
}
