import type { Locale } from '@prisma/client';
import { db } from '@/lib/db';
import { egoImage, giftIcon, identityImage, packIcon } from '@/lib/assets';
import { localeFilter, nameOf } from './shared';

/**
 * 통합 검색.
 *
 * 대상은 **치환된 표시용 `desc`** 이고 `descRaw` 는 쓰지 않는다(05-ui-foundation 5절).
 * 사용자가 입력하는 것은 표시 문자열이며, 원문에는 내부 식별자와 `<noparse>` 마커가 남아 있다.
 *
 * 계산은 서버에서 한다(ADR-05 3.3). 표시 문자열 7,498 KB 를 클라이언트로 보내지 않는다.
 */

const PER_KIND = 8;

export interface SearchHit {
	kind: 'gift' | 'pack' | 'identity' | 'ego';
	id: string;
	href: string;
	icon: string | null;
	name: string | null;
	fellBack: boolean;
	meta: string;
}

export async function searchAll(query: string, locale: Locale): Promise<SearchHit[]> {
	const q = query.trim();
	if (q.length === 0) return [];

	const like = { contains: q, mode: 'insensitive' as const };
	const locales = { in: [locale, 'en'] as Locale[] };

	const [gifts, packs, identities, egos] = await Promise.all([
		db.gift.findMany({
			where: {
				texts: { some: { locale: locales, OR: [{ name: like }, { desc: like }] } },
			},
			take: PER_KIND,
			orderBy: { id: 'asc' },
			include: { texts: { where: { locale: locales, enhanceLevel: 0 } } },
		}),
		db.pack.findMany({
			where: { texts: { some: { locale: locales, name: like } } },
			take: PER_KIND,
			orderBy: { id: 'asc' },
			include: { texts: localeFilter(locale) },
		}),
		db.identity.findMany({
			where: { texts: { some: { locale: locales, name: like } } },
			take: PER_KIND,
			orderBy: { id: 'asc' },
			include: { texts: localeFilter(locale) },
		}),
		db.ego.findMany({
			where: { texts: { some: { locale: locales, name: like } } },
			take: PER_KIND,
			orderBy: { id: 'asc' },
			include: { texts: localeFilter(locale) },
		}),
	]);

	const hits: SearchHit[] = [];

	for (const g of gifts) {
		const t = nameOf(g.texts, locale);
		hits.push({
			kind: 'gift',
			id: String(g.id),
			href: `/${locale}/gifts/${g.id}`,
			icon: giftIcon(g.sprite),
			name: t?.name ?? null,
			fellBack: t?.fellBack ?? false,
			meta: g.tier,
		});
	}
	for (const p of packs) {
		const t = nameOf(p.texts, locale);
		hits.push({
			kind: 'pack',
			id: p.id,
			href: `/${locale}/packs/${p.id}`,
			icon: packIcon(p.sprite),
			name: t?.name ?? null,
			fellBack: t?.fellBack ?? false,
			meta: p.category,
		});
	}
	for (const i of identities) {
		const t = nameOf(i.texts, locale);
		hits.push({
			kind: 'identity',
			id: String(i.id),
			href: `/${locale}/identities/${i.id}`,
			icon: identityImage(i.id, 'profile'),
			name: t?.name ?? null,
			fellBack: t?.fellBack ?? false,
			meta: '0'.repeat(i.rarity),
		});
	}
	for (const e of egos) {
		const t = nameOf(e.texts, locale);
		hits.push({
			kind: 'ego',
			id: String(e.id),
			href: `/${locale}/egos/${e.id}`,
			icon: egoImage(e.id, 'awaken'),
			name: t?.name ?? null,
			fellBack: t?.fellBack ?? false,
			meta: e.rank,
		});
	}

	return hits;
}
