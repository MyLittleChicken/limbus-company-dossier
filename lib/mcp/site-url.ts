import type { Locale } from '@/lib/locale';

/** 사이트 상세 페이지의 종류. 경로 조각 그대로다(`/ko/gifts/9001`). */
export type SiteKind = 'identities' | 'egos' | 'gifts' | 'packs';

const DEFAULT_SITE_URL = 'http://127.0.0.1:3100';

/**
 * 사이트 상세 페이지의 절대 URL. MCP 응답은 이미지 대신 이것을 준다(설계 §5).
 *
 * `SITE_URL` 은 부를 때마다 읽는다 — 시험과 배포가 환경변수만 바꿔 끼울 수 있게.
 * 끝의 `/` 는 몇 개든 하나도 남기지 않고 붙인다.
 */
export function siteUrl(locale: Locale, kind: SiteKind, id: string | number): string {
	const base = (process.env.SITE_URL?.trim() || DEFAULT_SITE_URL).replace(/\/+$/, '');
	return `${base}/${locale}/${kind}/${encodeURIComponent(String(id))}`;
}
