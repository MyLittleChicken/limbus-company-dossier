import type { Locale, Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { giftIcon } from '@/lib/assets';
import { localeFilter, multi, nameOf, one, PAGE_SIZE, textOf, type SearchParams } from './shared';

/**
 * E.G.O 기프트 — 정보 제공의 중심 엔티티(`02-data-model.md` 3.5).
 *
 * 필터 축은 `05-ui-foundation.md` 4.1 이 정했다. 두 축이 함정이다.
 *   - 연관 키워드가 **없는 기프트가 120종**이다. "없음"을 축의 값으로 둔다.
 *   - 전용 팩이 없는 **범용 226종은 결손이 아니다.** 부재이지 결손이 아니다.
 */

export const GIFT_TIERS = ['1', '2', '3', '4', '5', 'EX'] as const;

/**
 * 등급 표기.
 *
 * 데이터는 `1`~`5` 와 `EX` 로 갖고 있지만 **게임은 카드에 로마자를 인쇄한다.**
 * 애셋으로는 없다 — 기프트 그림 456 장과 `assets/icons/` 54 종을 다 뒤졌고 숫자·로마자
 * 아이콘이 없다. 그래서 글자로 낸다. 표기를 새로 만든 것이 아니라 게임 표기를 따른 것이다.
 *
 * 실측 분포는 I 58 · II 139 · III 136 · IV 119 · V 2 · EX 2 다.
 */
export const GIFT_TIER_LABEL: Record<string, string> = {
	'1': 'I',
	'2': 'II',
	'3': 'III',
	'4': 'IV',
	'5': 'V',
	EX: 'EX',
};

/** 키워드 축의 "없음". 질의 문자열에 쓰는 예약어다. */
export const NO_KEYWORD = 'none';

export interface GiftFilter {
	q?: string | undefined;
	tiers: string[];
	keywords: string[];
	enhanceable?: boolean | undefined;
	hardOnly?: boolean | undefined;
	/** 'exclusive' 전용 · 'general' 범용 */
	pool?: 'exclusive' | 'general' | undefined;
	page: number;
}

export function readGiftFilter(params: SearchParams): GiftFilter {
	const bool = (key: string) => {
		const v = one(params[key]);
		return v === '1' ? true : v === '0' ? false : undefined;
	};
	const pool = one(params['pool']);
	const page = Number(one(params['page']) ?? '1');
	return {
		q: one(params['q'])?.trim() || undefined,
		tiers: multi(params['tier']),
		keywords: multi(params['keyword']),
		enhanceable: bool('enhanceable'),
		hardOnly: bool('hard'),
		pool: pool === 'exclusive' || pool === 'general' ? pool : undefined,
		page: Number.isFinite(page) && page >= 1 ? Math.floor(page) : 1,
	};
}

function giftWhere(filter: GiftFilter, locale: Locale): Prisma.GiftWhereInput {
	const and: Prisma.GiftWhereInput[] = [];

	if (filter.tiers.length) and.push({ tier: { in: filter.tiers } });

	if (filter.keywords.length) {
		const named = filter.keywords.filter((k) => k !== NO_KEYWORD);
		const or: Prisma.GiftWhereInput[] = [];
		if (named.length) or.push({ keywordId: { in: named } });
		if (filter.keywords.includes(NO_KEYWORD)) or.push({ keywordId: null });
		and.push({ OR: or });
	}

	if (filter.enhanceable !== undefined) and.push({ enhanceable: filter.enhanceable });
	if (filter.hardOnly !== undefined) and.push({ hardOnly: filter.hardOnly });

	if (filter.pool === 'exclusive') and.push({ exclusivePacks: { some: {} } });
	if (filter.pool === 'general') and.push({ exclusivePacks: { none: {} } });

	if (filter.q) {
		// 검색 대상은 치환된 표시용 desc 다. descRaw 는 쓰지 않는다(05-ui-foundation 5절).
		and.push({
			texts: {
				some: {
					locale: { in: [locale, 'en'] },
					OR: [
						{ name: { contains: filter.q, mode: 'insensitive' } },
						{ desc: { contains: filter.q, mode: 'insensitive' } },
					],
				},
			},
		});
	}

	return and.length ? { AND: and } : {};
}

export async function listGifts(locale: Locale, filter: GiftFilter) {
	const where = giftWhere(filter, locale);

	const [total, rows] = await Promise.all([
		db.gift.count({ where }),
		db.gift.findMany({
			where,
			orderBy: [{ tier: 'asc' }, { id: 'asc' }],
			skip: (filter.page - 1) * PAGE_SIZE,
			take: PAGE_SIZE,
			include: {
				// 목록에는 기본 단계(0)의 이름만 쓴다.
				texts: { where: { locale: { in: [locale, 'en'] }, enhanceLevel: 0 } },
				keyword: { include: { texts: localeFilter(locale) } },
				_count: { select: { packs: true, exclusivePacks: true } },
			},
		}),
	]);

	return {
		total,
		page: filter.page,
		pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)),
		items: rows.map((g) => ({
			id: g.id,
			tier: g.tier,
			enhanceable: g.enhanceable,
			hardOnly: g.hardOnly,
			mdCost: g.mdCost,
			icon: giftIcon(g.sprite),
			text: nameOf(g.texts, locale),
			keyword: g.keyword ? nameOf(g.keyword.texts, locale) : null,
			keywordId: g.keywordId,
			packCount: g._count.packs,
			exclusiveCount: g._count.exclusivePacks,
		})),
	};
}

export type GiftListItem = Awaited<ReturnType<typeof listGifts>>['items'][number];

export async function getGift(id: number, locale: Locale) {
	const gift = await db.gift.findUnique({
		where: { id },
		include: {
			texts: { where: { locale: { in: [locale, 'en'] } }, orderBy: { enhanceLevel: 'asc' } },
			keyword: { include: { texts: localeFilter(locale) } },
			exclusivePacks: { include: { pack: { include: { texts: localeFilter(locale) } } } },
			packs: { include: { pack: { include: { texts: localeFilter(locale) } } } },
			recipes: {
				orderBy: { index: 'asc' },
				include: {
					slots: {
						orderBy: { index: 'asc' },
						include: {
							options: {
								include: {
									gift: {
										include: {
											texts: {
												where: { locale: { in: [locale, 'en'] }, enhanceLevel: 0 },
											},
										},
									},
								},
							},
						},
					},
				},
			},
			// 이 기프트가 재료로 쓰이는 레시피 — 역방향 조회
			usedIn: {
				include: {
					slot: {
						include: {
							recipe: {
								include: {
									result: {
										include: {
											texts: {
												where: { locale: { in: [locale, 'en'] }, enhanceLevel: 0 },
											},
										},
									},
								},
							},
						},
					},
				},
			},
		},
	});

	if (!gift) return null;

	// 강화 단계별로 묶는다. 로컬라이즈 소스에서는 단계마다 별도 id 였다(ADR-03 3.1).
	const levels = [...new Set(gift.texts.map((t) => t.enhanceLevel))].sort((a, b) => a - b);
	const stages = levels.map((level) => ({
		level,
		text: textOf(
			gift.texts.filter((t) => t.enhanceLevel === level),
			locale,
		),
	}));

	const packName = (p: { texts: { locale: Locale; name: string }[] }) => nameOf(p.texts, locale);

	return {
		id: gift.id,
		tier: gift.tier,
		enhanceable: gift.enhanceable,
		hardOnly: gift.hardOnly,
		mdCost: gift.mdCost,
		icon: giftIcon(gift.sprite),
		keywordId: gift.keywordId,
		keyword: gift.keyword ? nameOf(gift.keyword.texts, locale) : null,
		stages,
		exclusivePacks: gift.exclusivePacks.map((x) => ({
			id: x.packId,
			text: packName(x.pack),
		})),
		packs: gift.packs.map((x) => ({ id: x.packId, text: packName(x.pack) })),
		recipes: gift.recipes.map((r) => ({
			id: r.id,
			slots: r.slots.map((s) => ({
				count: s.count,
				options: s.options.map((o) => ({
					id: o.giftId,
					icon: giftIcon(o.gift.sprite),
					text: nameOf(o.gift.texts, locale),
				})),
			})),
		})),
		usedIn: [
			...new Map(
				gift.usedIn.map((u) => [
					u.slot.recipe.resultGiftId,
					{
						id: u.slot.recipe.resultGiftId,
						icon: giftIcon(u.slot.recipe.result.sprite),
						text: nameOf(u.slot.recipe.result.texts, locale),
					},
				]),
			).values(),
		],
	};
}

export type GiftDetail = NonNullable<Awaited<ReturnType<typeof getGift>>>;

/** 필터 칩에 쓸 키워드 축. 상태 7종 + 공격 타입 3종을 한 축으로 다룬다(02-data-model 4.3). */
export async function listKeywords(locale: Locale) {
	const rows = await db.keyword.findMany({
		orderBy: { order: 'asc' },
		include: { texts: localeFilter(locale) },
	});
	return rows.map((k) => ({ id: k.id, text: nameOf(k.texts, locale) }));
}

export async function listSins(locale: Locale) {
	const rows = await db.sinInfo.findMany({
		orderBy: { order: 'asc' },
		include: { texts: localeFilter(locale) },
	});
	return rows.map((s) => ({ id: s.sin, text: nameOf(s.texts, locale) }));
}
