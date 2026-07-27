import type { ReactNode } from 'react';
import './globals.css';

/**
 * 루트 레이아웃. `lang` 은 로케일 세그먼트를 아는 하위 레이아웃이 정할 수 없으므로
 * 여기서는 기본값만 두고 `app/[locale]/layout.tsx` 가 문서 언어를 다시 알린다.
 */
export default function RootLayout({ children }: { children: ReactNode }) {
	return (
		<html lang="ko">
			<body>{children}</body>
		</html>
	);
}
