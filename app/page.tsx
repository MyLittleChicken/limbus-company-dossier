import { redirect } from 'next/navigation';
import { DEFAULT_LOCALE } from '@/lib/locale';

/** 로케일 없는 진입은 기본 로케일로 보낸다. 한국어가 정본이다(ADR-03 3.2). */
export default function RootPage() {
	redirect(`/${DEFAULT_LOCALE}`);
}
