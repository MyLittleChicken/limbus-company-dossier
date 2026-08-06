import type { Locale } from '@prisma/client';
import type { Prisma } from '@/src/v2/generated/client';
import { canonical } from '@/lib/db-canonical';
import { packIcon } from '@/lib/assets';
import { one, type SearchParams } from '@/lib/queries/shared';
import { localeRows, nameOf } from './locale';

/**
 * 팩 분류 태그.
 *
 * **현행 `public.pack` 에는 없는 축이다.** 현행은 `category` 한 칸에 `event` 처럼 뭉쳐
 * 담지만, 캐노니컬은 원본의 중첩 분류를 `pack_tag` 과 `pack_category_path` 로 편다 —
 * `Attack Type > Slash` · `Canto > I` · `Collab` · `Hidden` 같은 것이다.
 *
 * 지금 필요한 것은 콜라보 판정 하나다. 이름으로 짐작하거나 id 를 박아 넣지 않고
 * **데이터가 가진 태그를 읽는다** — 실측 1 건이며 명일방주 「선의의 순례」다.
 */
export async function listCollabPackIds(): Promise<Set<string>> {
	const rows = await canonical.packTag.findMany({
		where: { tag: 'Collab' },
		select: { packId: true },
	});
	return new Set(rows.map((r) => r.packId));
}

export interface PackFilter {
	q?: string | undefined;
}

export function readPackFilter(params: SearchParams): PackFilter {
	return { q: one(params['q'])?.trim() || undefined };
}

/**
 * 테마 팩 목록.
 *
 * **이 함수가 서면 팩 목록 화면이 한 층만 읽는다.** 지금까지는 이 파일의
 * `listCollabPackIds` 와 현행 `lib/queries/packs.ts` 의 `listPacks` 를 함께 썼다.
 */
export async function listPacks(locale: Locale, filter: PackFilter) {
	const and: Prisma.PackWhereInput[] = [];
	if (filter.q) {
		and.push({
			texts: {
				some: { locale: { in: [locale, 'en'] }, name: { contains: filter.q, mode: 'insensitive' } },
			},
		});
	}

	const rows = await canonical.pack.findMany({
		where: and.length ? { AND: and } : {},
		orderBy: [{ category: 'asc' }, { id: 'asc' }],
		include: {
			texts: localeRows(locale),
			floors: true,
			_count: { select: { gifts: true, exclusiveGifts: true, bosses: true } },
		},
	});

	return rows.map((p) => ({
		id: p.id,
		category: p.category,
		variant: p.variant,
		chapter: p.chapter,
		superposition: p.superposition,
		extreme: p.extreme,
		icon: packIcon(p.sprite),
		// 카드가 봉지·보스·이름을 겹쳐 내므로 스프라이트 키 자체가 필요하다.
		sprite: p.sprite,
		text: nameOf(p.texts, locale),
		giftCount: p._count.gifts,
		exclusiveCount: p._count.exclusiveGifts,
		bossCount: p._count.bosses,
		floors: p.floors.map((f) => ({ difficulty: f.difficulty, range: f.floorRange })),
	}));
}
