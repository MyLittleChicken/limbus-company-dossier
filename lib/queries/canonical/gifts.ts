import type { Locale } from '@/lib/locale';
import type { Prisma } from '@/src/v2/generated/client';
import { canonical } from '@/lib/db-canonical';
import { giftIcon } from '@/lib/assets';
import { multi, one, PAGE_SIZE, type SearchParams } from '@/lib/queries/shared';
import { localeRows, nameOf, textOf } from './locale';

/**
 * E.G.O 기프트 — 정보 제공의 중심 엔티티(`02-data-model.md` 3.5).
 *
 * **현행 `lib/queries/gifts.ts` 를 대체한다.** 반환 모양은 같고 층만 다르다.
 *
 * 필터 축은 `05-ui-foundation.md` 4.1 이 정했다. 두 축이 함정이다.
 *   - 연관 키워드가 **없는 기프트가 120종**이다. "없음"을 축의 값으로 둔다.
 *   - 전용 팩이 없는 **범용 226종은 결손이 아니다.** 부재이지 결손이 아니다.
 *
 * 캐노니컬과 현행이 갈리는 자리 넷:
 *
 * ```
 * id       현행 Int · 캐노니컬 String.  화면 계약을 지키려 number 로 받고 안에서 바꾼다
 * tier     현행 '1'~'5'·'EX' 한 열 · 캐노니컬 tier Int? + tierLabel String?
 * mdCost   캐노니컬은 cost
 * domain   캐노니컬이 스토리 던전 126종을 더 갖는다.  거울 던전만 낸다 — 실측 456 으로
 *          현행과 같다.  여기는 거울 던전 사이트다
 * ```
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

/**
 * 키워드 축의 "없음".
 *
 * **캐노니컬에서는 `null` 이 아니라 행이다.** 게임 공식 사전
 * (`EgoGiftCategory.json`)에 `None` 이 order 11 로 들어 있고, 현행은 그것을
 * `keywordId = null` 로 눌러 담았다. 사전에 있는 것을 없는 것으로 바꾸지 않는다 —
 * 키워드가 10에서 12로 는 이유의 하나다(나머지 하나는 `Random`).
 *
 * 질의 문자열의 예약어는 그대로 `none` 이다. URL 을 필요 이상으로 안 바꾼다.
 */
export const NO_KEYWORD = 'none';

/** 사전의 「없음」 행. `NO_KEYWORD` 는 URL 값이고 이쪽은 데이터 값이다. */
const NONE_KEYWORD_ID = 'None';

/**
 * 이 화면이 다루는 것은 거울 던전 기프트다.
 *
 * 캐노니컬이 스토리 던전 126종을 더 갖고 있는데, 그건 다른 게임 모드의 것이라
 * 목록·필터·합성에 섞이면 안 된다. 실측으로 456 이 되어 현행과 같다.
 */
const MIRROR = { domain: 'mirror_dungeon' } as const;

/** 캐노니컬의 `tier` + `tierLabel` 을 화면이 쓰던 한 열로 되돌린다. */
const tierOf = (g: { tier: number | null; tierLabel: string | null }): string =>
	g.tierLabel ?? (g.tier === null ? '' : String(g.tier));

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
	const and: Prisma.GiftWhereInput[] = [MIRROR];

	if (filter.tiers.length) {
		// 'EX' 는 tier 가 null 이고 tierLabel 에 있다. 두 열을 함께 본다
		const numeric = filter.tiers.map(Number).filter((n) => Number.isFinite(n));
		const labels = filter.tiers.filter((t) => !Number.isFinite(Number(t)));
		const or: Prisma.GiftWhereInput[] = [];
		if (numeric.length) or.push({ tier: { in: numeric } });
		if (labels.length) or.push({ tierLabel: { in: labels } });
		and.push({ OR: or });
	}

	if (filter.keywords.length) {
		const named = filter.keywords.filter((k) => k !== NO_KEYWORD);
		const or: Prisma.GiftWhereInput[] = [];
		if (named.length) or.push({ keywordId: { in: named } });
		// 「없음」은 캐노니컬에서 행이다. null 도 함께 본다 — 사전에 없는 기프트가
		// 생기면 그쪽으로 떨어진다
		if (filter.keywords.includes(NO_KEYWORD)) {
			or.push({ keywordId: NONE_KEYWORD_ID }, { keywordId: null });
		}
		and.push({ OR: or });
	}

	if (filter.enhanceable !== undefined) and.push({ enhanceable: filter.enhanceable });
	if (filter.hardOnly !== undefined) and.push({ hardOnly: filter.hardOnly });

	if (filter.pool === 'exclusive') and.push({ exclusivePacks: { some: {} } });
	if (filter.pool === 'general') and.push({ exclusivePacks: { none: {} } });

	if (filter.q) {
		// 검색 대상은 치환된 표시용 desc 다. descRaw 는 쓰지 않는다(05-ui-foundation 5절).
		and.push({
			stages: {
				some: {
					texts: {
						some: {
							locale: { in: [locale, 'en'] },
							OR: [
								{ name: { contains: filter.q, mode: 'insensitive' } },
								{ desc: { contains: filter.q, mode: 'insensitive' } },
							],
						},
					},
				},
			},
		});
	}

	return { AND: and };
}

/** 목록에는 기본 단계(0)의 이름만 쓴다. */
const baseStage = (locale: Locale) => ({
	where: { level: 0 },
	include: { texts: localeRows(locale) },
});

export async function listGifts(locale: Locale, filter: GiftFilter) {
	const where = giftWhere(filter, locale);

	const [total, rows] = await Promise.all([
		canonical.gift.count({ where }),
		canonical.gift.findMany({
			where,
			orderBy: [{ tier: 'asc' }, { id: 'asc' }],
			skip: (filter.page - 1) * PAGE_SIZE,
			take: PAGE_SIZE,
			include: {
				stages: baseStage(locale),
				keyword: { include: { texts: localeRows(locale) } },
				_count: { select: { packs: true, exclusivePacks: true } },
			},
		}),
	]);

	return {
		total,
		page: filter.page,
		pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)),
		items: rows.map((g) => ({
			id: Number(g.id),
			tier: tierOf(g),
			enhanceable: g.enhanceable,
			hardOnly: g.hardOnly,
			mdCost: g.cost,
			icon: giftIcon(g.sprite),
			text: nameOf(g.stages[0]?.texts ?? [], locale),
			keyword: g.keyword ? nameOf(g.keyword.texts, locale) : null,
			keywordId: g.keywordId,
			packCount: g._count.packs,
			exclusiveCount: g._count.exclusivePacks,
		})),
	};
}

export type GiftListItem = Awaited<ReturnType<typeof listGifts>>['items'][number];

/**
 * 저주·축복 기프트.
 *
 * 얻을 때는 「저주」로 붙어 아군에게 불리하게 걸리고, 조건을 채우면 「축복」으로 바뀌어
 * 이로운 효과를 낸다. **데이터가 그것을 플래그로 갖고 있지 않아 설명문으로 가린다** —
 * 「전투를 6회 승리할 시 해당 E.G.O 기프트가 변경됨」이라는 문장이 있는 것이 그것이고
 * 실측 3 건이다(9227 귀기 서린 환도 · 9229 빛바랜 건틀릿 · 9231 그날의 기록).
 *
 * **한국어 행으로 가린다.** 화면 로케일과 무관하게 같은 셋이 나와야 하기 때문이다.
 *
 * 바뀐 뒤의 축복 셋도 함께 돌려준다(9228 신검합일 · 9230 황금빛 시간 · 9232 가능성).
 * 짝을 잇는 값이 없어 **어느 저주가 어느 축복이 되는지는 말하지 않고** 같은 칸에 넣기만
 * 한다. 아래 주석에 근거를 적었다.
 */
export async function listCursedGiftIds(): Promise<Set<number>> {
	const cursed = await canonical.giftStageText.findMany({
		where: { locale: 'ko', level: 0, desc: { contains: '기프트가 변경' } },
		select: { giftId: true },
	});

	/*
		바뀐 뒤의 축복 기프트.

		**둘을 잇는 값이 데이터에 없다.** `gift_effect` · `choice_event_gift` · `fusion_recipe`
		를 다 봤지만 짝을 가리키는 것이 없다 — 저주 셋만 `choice_event_gift` 에 있고 축복
		셋은 어디에도 걸리지 않는다.

		그래서 **id 하나 뒤**라는 관찰을 쓰되 그대로 믿지 않고 걸러 확인한다. 저주는 전부
		1 등급이고 축복은 3 등급이며 둘 다 키워드가 없다. 조건에 맞지 않으면 버린다 —
		규칙이 깨졌는데 엉뚱한 기프트를 특수로 표시하는 것보다 낫다.

		나무위키의 기프트 문서가 축복 기프트가 셋(신검합일 · 황금빛 시간 · 가능성)이라고
		적고 있어 수는 맞는다. 다만 **어느 저주가 어느 축복이 되는지는 그 문서도 밝히지
		않는다.** 여기서도 짝으로 잇지 않고 같은 칸에 넣기만 한다.
	*/
	const candidates = cursed.map((r) => String(Number(r.giftId) + 1));
	const blessed = await canonical.gift.findMany({
		// 「키워드가 없다」는 캐노니컬에서 keywordId='None' 이다 — null 이 아니다
		where: {
			...MIRROR,
			id: { in: candidates },
			tier: 3,
			OR: [{ keywordId: NONE_KEYWORD_ID }, { keywordId: null }],
		},
		select: { id: true },
	});

	return new Set([
		...cursed.map((r) => Number(r.giftId)),
		...blessed.map((g) => Number(g.id)),
	]);
}

/**
 * 기프트 전량.
 *
 * **쪽을 나누지 않는다.** 456 장을 한 번에 내려보내고 거르기·정렬·섹션을 화면이 맡는다 —
 * 인격 184 · E.G.O 110 · 팩 117 과 같은 방식이다. 그리기는 화면이 나눠 한다.
 */
export async function listAllGifts(locale: Locale) {
	const rows = await canonical.gift.findMany({
		where: MIRROR,
		orderBy: [{ tier: 'asc' }, { id: 'asc' }],
		include: {
			stages: baseStage(locale),
			keyword: { include: { texts: localeRows(locale) } },
			_count: { select: { exclusivePacks: true } },
		},
	});

	// **목록 질의보다 좁은 모양이다.** 456장을 한 번에 내려보내므로 화면이 안 쓰는
	// 필드를 실으면 그만큼 페이로드가 는다(ADR-05 3.3).
	return rows.map((g) => ({
		id: Number(g.id),
		tier: tierOf(g),
		icon: giftIcon(g.sprite),
		text: nameOf(g.stages[0]?.texts ?? [], locale),
		keyword: g.keyword ? nameOf(g.keyword.texts, locale) : null,
		keywordId: g.keywordId,
		exclusiveCount: g._count.exclusivePacks,
	}));
}

export async function getGift(id: number, locale: Locale) {
	const gift = await canonical.gift.findUnique({
		where: { id: String(id) },
		include: {
			stages: { orderBy: { level: 'asc' }, include: { texts: localeRows(locale) } },
			keyword: { include: { texts: localeRows(locale) } },
			exclusivePacks: { include: { pack: { include: { texts: localeRows(locale) } } } },
			packs: { include: { pack: { include: { texts: localeRows(locale) } } } },
			recipes: {
				orderBy: { index: 'asc' },
				include: { slots: { orderBy: { slotIdx: 'asc' }, include: { options: true } } },
			},
		},
	});

	if (!gift) return null;

	// 강화 단계별로 묶는다. 로컬라이즈 소스에서는 단계마다 별도 id 였다(ADR-03 3.1).
	const stages = gift.stages.map((s) => ({ level: s.level, text: textOf(s.texts, locale) }));

	// 재료로 쓰인 기프트의 이름·아이콘을 한 번에 가져온다. 레시피 안에서 개별
	// 조회하면 같은 기프트를 여러 번 읽는다
	const materialIds = [
		...new Set(
			gift.recipes.flatMap((r) =>
				r.slots.flatMap((s) => [
					...(s.materialId === null ? [] : [s.materialId]),
					...s.options.map((o) => o.materialId),
				]),
			),
		),
	];
	const materials = new Map(
		(
			await canonical.gift.findMany({
				where: { id: { in: materialIds } },
				include: { stages: baseStage(locale) },
			})
		).map((m) => [m.id, m]),
	);

	const materialOf = (materialId: string) => {
		const m = materials.get(materialId);
		return {
			id: Number(materialId),
			icon: m ? giftIcon(m.sprite) : null,
			text: m ? nameOf(m.stages[0]?.texts ?? [], locale) : null,
		};
	};

	/**
	 * 이 기프트가 재료로 쓰이는 레시피 — 역방향 조회.
	 *
	 * **캐노니컬에는 역방향 관계가 없다.** `fusion_slot.material_id` 와
	 * `fusion_slot_option.material_id` 가 `gift` 를 가리키는 FK 가 아니라 값이라
	 * 따로 물어야 한다. 고정 재료와 선택지 양쪽을 다 본다.
	 */
	const [asFixed, asOption] = await Promise.all([
		canonical.fusionSlot.findMany({ where: { materialId: String(id) }, select: { giftId: true } }),
		canonical.fusionSlotOption.findMany({
			where: { materialId: String(id) },
			select: { giftId: true },
		}),
	]);
	const usedInIds = [...new Set([...asFixed, ...asOption].map((r) => r.giftId))];
	const usedInGifts = await canonical.gift.findMany({
		where: { id: { in: usedInIds } },
		include: { stages: baseStage(locale) },
	});

	const packName = (p: { texts: Array<{ locale: string; name: string }> }) => nameOf(p.texts, locale);

	return {
		id: Number(gift.id),
		tier: tierOf(gift),
		enhanceable: gift.enhanceable,
		hardOnly: gift.hardOnly,
		mdCost: gift.cost,
		icon: giftIcon(gift.sprite),
		keywordId: gift.keywordId,
		keyword: gift.keyword ? nameOf(gift.keyword.texts, locale) : null,
		stages,
		exclusivePacks: gift.exclusivePacks.map((x) => ({ id: x.packId, text: packName(x.pack) })),
		packs: gift.packs.map((x) => ({ id: x.packId, text: packName(x.pack) })),
		recipes: gift.recipes.map((r) => ({
			// 캐노니컬 레시피는 (giftId, index) 복합키다. 현행이 쓰던 표기로 되돌린다
			id: `${gift.id}_${r.index}`,
			slots: r.slots.map((s) => ({
				// 고정 재료 자리는 캐노니컬이 count 를 안 둔다 — 하나라는 뜻이다.
				// 현행은 그 자리에 1 을 담았다
				count: s.count ?? 1,
				// 고정 재료도 선택지 하나로 낸다 — 현행이 그 모양이었다(실측 178 + 7 = 185)
				options: s.materialId === null
					? s.options.map((o) => materialOf(o.materialId))
					: [materialOf(s.materialId)],
			})),
		})),
		usedIn: usedInGifts.map((u) => ({
			id: Number(u.id),
			icon: giftIcon(u.sprite),
			text: nameOf(u.stages[0]?.texts ?? [], locale),
		})),
	};
}

export type GiftDetail = NonNullable<Awaited<ReturnType<typeof getGift>>>;

/** 필터 칩에 쓸 키워드 축. 상태 7종 + 공격 타입 3종을 한 축으로 다룬다(02-data-model 4.3). */
export async function listKeywords(locale: Locale) {
	const rows = await canonical.keyword.findMany({
		orderBy: { order: 'asc' },
		include: { texts: localeRows(locale) },
	});
	return rows.map((k) => ({ id: k.id, text: nameOf(k.texts, locale) }));
}

export async function listSins(locale: Locale) {
	const rows = await canonical.sinInfo.findMany({
		orderBy: { order: 'asc' },
		include: { texts: localeRows(locale) },
	});
	return rows.map((s) => ({ id: s.sin, text: nameOf(s.texts, locale) }));
}
