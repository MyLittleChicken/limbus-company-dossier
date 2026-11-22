'use client';
import { usePathname } from 'next/navigation';
export default function ErrorState() {
	const ko = usePathname().startsWith('/ko');
	return (
		<section className="error-state" role="alert">
			<h1>{ko ? '해당 정보를 불러오지 못했습니다.' : 'Unable to load this information.'}</h1>
			<p>{ko ? '잠시 후 페이지를 새로고침해 주세요.' : 'Please refresh the page in a moment.'}</p>
		</section>
	);
}
