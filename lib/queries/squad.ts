import type { Locale } from '@prisma/client';
import { db } from '@/lib/db';
import { egoImage, identityImage, sinnerIcon } from '@/lib/assets';
import { localeFilter, nameOf } from './shared';

/**
 * 편성 — 수감자 축으로 인격과 E.G.O 를 함께 보는 화면.
 *
 * 이전 프로토타입(`limbus-mirror-tracker-v1`)의 SQUAD 탭이 같은 축을 썼다.
 * 그쪽은 슬롯에 인격과 E.G.O 를 골라 담는 편집 화면이지만, 2단계에서는 조회만 한다.
 * 고르는 흐름은 4단계 런 상태 입력의 몫이다(05-ui-foundation 1절).
 *
 * **이 축이 필요한 이유는 E.G.O 가 인격이 아니라 수감자에 붙기 때문이다**(`Ego.sinnerId`).
 * 인격 상세에 E.G.O 를 싣지 않기로 했으므로(4.3) 둘을 함께 보는 자리가 따로 있어야 한다.
 */
export async function listSquad(locale: Locale) {
	const sinners = await db.sinner.findMany({
		orderBy: { id: 'asc' },
		include: {
			texts: localeFilter(locale),
			identities: {
				orderBy: [{ rarity: 'desc' }, { id: 'asc' }],
				include: { texts: localeFilter(locale) },
			},
			egos: {
				orderBy: [{ rank: 'asc' }, { id: 'asc' }],
				include: { texts: localeFilter(locale), costs: true },
			},
		},
	});

	return sinners.map((s) => ({
		id: s.id,
		icon: sinnerIcon(s.id),
		text: nameOf(s.texts, locale),
		identities: s.identities.map((i) => ({
			id: i.id,
			rarity: i.rarity,
			season: i.season,
			image: identityImage(i.id, 'profile'),
			text: nameOf(i.texts, locale),
		})),
		egos: s.egos.map((e) => ({
			id: e.id,
			rank: e.rank,
			image: egoImage(e.id, 'awaken'),
			text: nameOf(e.texts, locale),
			costs: e.costs.map((c) => ({ sin: c.sin, amount: c.amount })),
		})),
	}));
}

export type SquadSinner = Awaited<ReturnType<typeof listSquad>>[number];
