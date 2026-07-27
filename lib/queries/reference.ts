import type { BuffType, Difficulty, Locale, Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { packIcon, statusIcon } from '@/lib/assets';
import { localeFilter, multi, nameOf, one, textOf, type SearchParams } from './shared';

/** 층별 등장 팩 · 거울 던전 구성 · 용어 · 데이터셋 스탬프. */

/**
 * 층별 등장 팩.
 *
 * 원본 구간은 hard 가 1 · 2 · 3 · 4 · 5 · 6–10 · 11–15 이고 normal 이 1–5 다.
 * "이번 층에 어떤 팩이 나오는가"의 판단 근거이며, 4단계 런 상태 입력의 전신이다.
 */
export async function listFloorPacks(locale: Locale) {
	const rows = await db.floorPack.findMany({
		include: { pack: { include: { texts: localeFilter(locale) } } },
	});

	const groups = new Map<
		string,
		{
			difficulty: Difficulty;
			range: string;
			packs: Array<{ id: string; icon: string | null; text: ReturnType<typeof nameOf> }>;
		}
	>();

	for (const row of rows) {
		const key = `${row.difficulty}|${row.floorRange}`;
		let group = groups.get(key);
		if (!group) {
			group = { difficulty: row.difficulty, range: row.floorRange, packs: [] };
			groups.set(key, group);
		}
		group.packs.push({
			id: row.packId,
			icon: packIcon(row.pack.sprite),
			text: nameOf(row.pack.texts, locale),
		});
	}

	// 구간 표기가 `1` 과 `6-10` 이 섞여 있다. 시작 층 기준으로 정렬한다.
	const start = (range: string) => Number(range.split('-')[0] ?? '0');

	return [...groups.values()]
		.sort((a, b) => a.difficulty.localeCompare(b.difficulty) || start(a.range) - start(b.range))
		.map((g) => ({
			...g,
			packs: g.packs.sort((a, b) => a.id.localeCompare(b.id)),
		}));
}

/** 거울 던전 구성과 은총. */
export async function getDungeon(locale: Locale) {
	const dungeon = await db.mirrorDungeon.findFirst({
		include: {
			texts: localeFilter(locale),
			graces: { orderBy: { index: 'asc' }, include: { texts: localeFilter(locale) } },
		},
	});
	if (!dungeon) return null;

	return {
		version: dungeon.version,
		// 화면은 내부 키가 아니라 명칭을 쓴다(05-ui-foundation 10절).
		text: nameOf(dungeon.texts, locale),
		totalFloors: dungeon.totalFloors,
		baseFloors: dungeon.baseFloors,
		graces: dungeon.graces.map((g) => {
			const picked = g.texts.find((t) => t.locale === locale) ?? g.texts.find((t) => t.locale === 'en');
			return {
				id: g.id,
				cost: g.cost,
				name: picked?.name ?? null,
				fellBack: picked !== undefined && picked.locale !== locale,
				// 강화 단계별 효과 설명. 원본이 단계별 문자열 배열이다.
				descs: picked?.descs ?? [],
			};
		}),
	};
}

/** 용어 — 상태. 판정은 이름이 아니라 `buffType` 메타데이터로 한다(02-data-model 3.10). */
export interface GlossaryFilter {
	q?: string | undefined;
	buffTypes: string[];
	page: number;
}

export const GLOSSARY_PAGE = 120;

export function readGlossaryFilter(params: SearchParams): GlossaryFilter {
	const page = Number(one(params['page']) ?? '1');
	return {
		q: one(params['q'])?.trim() || undefined,
		buffTypes: multi(params['buff']),
		page: Number.isFinite(page) && page >= 1 ? Math.floor(page) : 1,
	};
}

export async function listStatuses(locale: Locale, filter: GlossaryFilter) {
	const and: Prisma.StatusWhereInput[] = [];
	if (filter.buffTypes.length) and.push({ buffType: { in: filter.buffTypes as BuffType[] } });
	if (filter.q) {
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
	const where = and.length ? { AND: and } : {};

	const [total, rows] = await Promise.all([
		db.status.count({ where }),
		db.status.findMany({
			where,
			orderBy: { id: 'asc' },
			skip: (filter.page - 1) * GLOSSARY_PAGE,
			take: GLOSSARY_PAGE,
			include: { texts: localeFilter(locale) },
		}),
	]);

	return {
		total,
		page: filter.page,
		pageCount: Math.max(1, Math.ceil(total / GLOSSARY_PAGE)),
		items: rows.map((s) => ({
			id: s.id,
			buffType: s.buffType,
			// 아이콘 없는 254종은 수치 변화형이라 게임에도 아이콘이 없다. 결손이 아니다.
			icon: statusIcon(s.sprite),
			text: textOf(s.texts, locale),
		})),
	};
}

export async function listGlossaryAxes(locale: Locale) {
	const [sins, keywords, counts] = await Promise.all([
		db.sinInfo.findMany({ orderBy: { order: 'asc' }, include: { texts: localeFilter(locale) } }),
		db.keyword.findMany({ orderBy: { order: 'asc' }, include: { texts: localeFilter(locale) } }),
		db.status.groupBy({ by: ['buffType'], _count: true }),
	]);

	return {
		sins: sins.map((s) => ({ id: s.sin, attribute: s.attribute, text: nameOf(s.texts, locale) })),
		keywords: keywords.map((k) => ({ id: k.id, text: nameOf(k.texts, locale) })),
		buffTypes: counts.map((c) => ({ id: c.buffType, count: c._count })),
	};
}

/** 기준 버전 스탬프. 조회 화면에서도 확인 가능해야 한다(05-ui-foundation 10절). */
export async function getDataset() {
	return db.dataset.findFirst();
}

/** 적재된 테이블별 행 수. 고지 화면이 데이터의 범위를 밝히는 데 쓴다. */
export async function getCounts() {
	const [gifts, packs, identities, egos, skills, statuses, affiliations, relations] =
		await Promise.all([
			db.gift.count(),
			db.pack.count(),
			db.identity.count(),
			db.ego.count(),
			db.skill.count(),
			db.status.count(),
			db.affiliation.count(),
			db.giftPack.count(),
		]);
	return { gifts, packs, identities, egos, skills, statuses, affiliations, relations };
}
