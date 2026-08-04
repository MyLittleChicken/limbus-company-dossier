import type { Locale, Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { giftIcon, packBossIcon, packIcon } from '@/lib/assets';
import { localeFilter, multi, nameOf, one, type SearchParams } from './shared';

/**
 * 테마 팩.
 *
 * **이 화면의 설계 문제는 밀도다**(05-ui-foundation 4.2). 팩당 기프트가 median 73 · 최대 188이라
 * 전체 목록을 그냥 늘어놓으면 읽히지 않는다. 상세는 전용 기프트 → 축별 분포 → 전체 목록의 3단이다.
 *
 * 등장 확률은 표시하지 않는다. 팩별 기프트 목록은 확보했으나 확률은 어느 출처에도 없다.
 */

/**
 * 목록 거르기.
 *
 * **분류로 거르지 않는다.** 화면이 쓰는 종류가 `category` 한 칸으로 나오지 않기 때문이다 —
 * 발푸르기스 2 · 3 회가 `extreme` 로 분류돼 있어 분류로 거르면 그 둘이 빠진다. 종류
 * 판정은 스프라이트와 캐노니컬 태그까지 봐야 서므로 화면에서 거른다(`lib/pack-label.ts`).
 *
 * 여기 남는 것은 이름 검색뿐이다.
 */
export interface PackFilter {
	q?: string | undefined;
}

export function readPackFilter(params: SearchParams): PackFilter {
	return { q: one(params['q'])?.trim() || undefined };
}

export async function listPacks(locale: Locale, filter: PackFilter) {
	const and: Prisma.PackWhereInput[] = [];
	if (filter.q) {
		and.push({
			texts: {
				some: { locale: { in: [locale, 'en'] }, name: { contains: filter.q, mode: 'insensitive' } },
			},
		});
	}

	const rows = await db.pack.findMany({
		where: and.length ? { AND: and } : {},
		orderBy: [{ category: 'asc' }, { id: 'asc' }],
		include: {
			texts: localeFilter(locale),
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

export async function getPack(id: string, locale: Locale) {
	const pack = await db.pack.findUnique({
		where: { id },
		include: {
			texts: localeFilter(locale),
			// 조우 이름은 담지 않았다 — 팩 이름과 같기 때문이다. 담긴 것은 등장하는 적이다.
			bosses: {
				include: {
					encounter: {
						include: {
							targets: {
								orderBy: { index: 'asc' },
								include: { texts: localeFilter(locale) },
							},
						},
					},
				},
			},
			floors: true,
			exclusiveGifts: {
				include: {
					gift: {
						include: {
							texts: { where: { locale: { in: [locale, 'en'] }, enhanceLevel: 0 } },
							keyword: { include: { texts: localeFilter(locale) } },
						},
					},
				},
			},
			gifts: {
				include: {
					gift: {
						include: {
							texts: { where: { locale: { in: [locale, 'en'] }, enhanceLevel: 0 } },
							keyword: { include: { texts: localeFilter(locale) } },
						},
					},
				},
			},
		},
	});

	if (!pack) return null;

	type Row = (typeof pack.gifts)[number];
	const shape = (row: Row) => ({
		id: row.giftId,
		tier: row.gift.tier,
		keyword: row.gift.keyword ? nameOf(row.gift.keyword.texts, locale) : null,
		icon: giftIcon(row.gift.sprite),
		text: nameOf(row.gift.texts, locale),
	});

	const gifts = pack.gifts.map(shape).sort((a, b) => a.tier.localeCompare(b.tier) || a.id - b.id);

	// 188개를 읽지 않고도 팩의 성격을 판단할 수 있어야 한다 — 축별 분포를 미리 센다.
	const tally = <K extends string | number | null>(pick: (g: (typeof gifts)[number]) => K) => {
		const map = new Map<K, number>();
		for (const g of gifts) map.set(pick(g), (map.get(pick(g)) ?? 0) + 1);
		return [...map.entries()].sort((a, b) => b[1] - a[1]);
	};

	return {
		id: pack.id,
		category: pack.category,
		variant: pack.variant,
		chapter: pack.chapter,
		superposition: pack.superposition,
		extreme: pack.extreme,
		floorLength: pack.floorLength,
		icon: packIcon(pack.sprite),
		sprite: pack.sprite,
		/*
			보스 층 그림.

			**완성된 카드가 아니라 투명한 보스 층 한 장이다**(391 × 432). 봉지 위에 겹쳐야
			게임과 같은 카드가 된다 — 조사 기록은 `publish/PACK-ART.md` 다. 규칙으로
			짝을 찾는 것은 실측 40 종이고, 규칙 밖 7 종은 `lib/pack-art.ts` 의 표가 맡는다.
		*/
		bossIcon: packBossIcon(pack.sprite),
		text: nameOf(pack.texts, locale),
		bosses: pack.bosses.map((b) => ({
			encounterId: b.encounterId,
			targets: b.encounter.targets.map((t) => ({
				index: t.index,
				// 등장 수가 원본에 없는 경우가 있다. 1로 지어내지 않는다.
				count: t.count,
				text: nameOf(t.texts, locale),
			})),
		})),
		floors: pack.floors.map((f) => ({ difficulty: f.difficulty, range: f.floorRange })),
		exclusiveGifts: pack.exclusiveGifts.map(shape),
		gifts,
		distribution: {
			tier: tally((g) => g.tier),
			keyword: tally((g) => g.keyword?.name ?? null),
		},
	};
}

export type PackDetail = NonNullable<Awaited<ReturnType<typeof getPack>>>;
