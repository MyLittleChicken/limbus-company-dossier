import type { EgoRank, Locale, Prisma, Sin } from '@prisma/client';
import { db } from '@/lib/db';
import { egoImage } from '@/lib/assets';
import { localeFilter, multi, nameOf, one, textOf, type SearchParams } from './shared';

/**
 * E.G.O.
 *
 * **등급 축에서 ALEPH 을 빼지 않는다.** 실측 분포는 ZAYIN 20 · TETH 32 · HE 40 · WAW 18 이고
 * ALEPH 은 0종이지만, 없다는 이유로 축에서 빼면 출시 시점에 화면이 깨진다(02-data-model 4.4).
 *
 * **저항의 축이 죄악 7종이다.** 인격은 공격 타입 3종이라 같은 컴포넌트를 쓰면 축이 어긋난다.
 */

export const EGO_RANKS: EgoRank[] = ['ZAYIN', 'TETH', 'HE', 'WAW', 'ALEPH'];

export interface EgoFilter {
	q?: string | undefined;
	sinners: string[];
	ranks: string[];
	awakenSins: string[];
	/** 침식이 있는 것만 / 없는 것만. 없는 E.G.O 가 12종이다. */
	corrosion?: boolean | undefined;
	extractable?: boolean | undefined;
}

export function readEgoFilter(params: SearchParams): EgoFilter {
	const bool = (key: string) => {
		const v = one(params[key]);
		return v === '1' ? true : v === '0' ? false : undefined;
	};
	return {
		q: one(params['q'])?.trim() || undefined,
		sinners: multi(params['sinner']),
		ranks: multi(params['rank']),
		awakenSins: multi(params['sin']),
		corrosion: bool('corrosion'),
		extractable: bool('extractable'),
	};
}

export async function listEgos(locale: Locale, filter: EgoFilter) {
	const and: Prisma.EgoWhereInput[] = [];
	if (filter.sinners.length) and.push({ sinnerId: { in: filter.sinners.map(Number) } });
	if (filter.ranks.length) and.push({ rank: { in: filter.ranks as EgoRank[] } });
	if (filter.awakenSins.length) and.push({ awakenAffinity: { in: filter.awakenSins as Sin[] } });
	if (filter.corrosion === true) and.push({ corrosionAffinity: { not: null } });
	if (filter.corrosion === false) and.push({ corrosionAffinity: null });
	if (filter.extractable !== undefined) and.push({ extractable: filter.extractable });
	if (filter.q) {
		and.push({
			texts: {
				some: { locale: { in: [locale, 'en'] }, name: { contains: filter.q, mode: 'insensitive' } },
			},
		});
	}

	const rows = await db.ego.findMany({
		where: and.length ? { AND: and } : {},
		orderBy: [{ sinnerId: 'asc' }, { id: 'asc' }],
		include: { texts: localeFilter(locale), costs: true },
	});

	return rows.map((e) => ({
		id: e.id,
		sinnerId: e.sinnerId,
		rank: e.rank,
		season: e.season,
		awakenAffinity: e.awakenAffinity,
		awakenAtkType: e.awakenAtkType,
		hasCorrosion: e.corrosionAffinity !== null,
		image: egoImage(e.id, 'awaken'),
		text: nameOf(e.texts, locale),
		costs: e.costs.map((c) => ({ sin: c.sin, amount: c.amount })),
	}));
}

export async function getEgo(id: number, locale: Locale) {
	const ego = await db.ego.findUnique({
		where: { id },
		include: {
			texts: localeFilter(locale),
			sinner: { include: { texts: localeFilter(locale) } },
			costs: true,
			resists: true,
			statuses: { include: { status: { include: { texts: localeFilter(locale) } } } },
			passives: { orderBy: { index: 'asc' }, include: { texts: localeFilter(locale) } },
		},
	});

	if (!ego) return null;

	return {
		id: ego.id,
		sinnerId: ego.sinnerId,
		sinner: nameOf(ego.sinner.texts, locale),
		rank: ego.rank,
		season: ego.season,
		releaseDate: ego.releaseDate,
		awakenAffinity: ego.awakenAffinity,
		awakenAtkType: ego.awakenAtkType,
		corrosionAffinity: ego.corrosionAffinity,
		corrosionAtkType: ego.corrosionAtkType,
		extractable: ego.extractable,
		maxThreadspin: ego.maxThreadspin,
		text: nameOf(ego.texts, locale),
		images: {
			awaken: egoImage(ego.id, 'awaken'),
			cg: egoImage(ego.id, 'cg'),
			erosion: egoImage(ego.id, 'erosion'),
		},
		// 죄악 자원 소모량. E.G.O 기능의 핵심이다(02-data-model 3.4).
		costs: ego.costs.map((c) => ({ sin: c.sin, amount: c.amount })),
		resists: ego.resists.map((r) => ({ sin: r.sin, value: r.value })),
		statuses: ego.statuses.map((s) => ({ id: s.statusId, text: nameOf(s.status.texts, locale) })),
		// 패시브는 요약 파일에 없고 개별 상세에만 있었다(02-data-model 3.4).
		passives: ego.passives.map((p) => ({ index: p.index, text: textOf(p.texts, locale) })),
	};
}

export type EgoDetail = NonNullable<Awaited<ReturnType<typeof getEgo>>>;
