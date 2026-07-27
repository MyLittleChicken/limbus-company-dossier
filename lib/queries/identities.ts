import type { Locale, Prisma, Sin } from '@prisma/client';
import { db } from '@/lib/db';
import { identityImage, sinnerIcon, skillIcon } from '@/lib/assets';
import { localeFilter, multi, nameOf, one, textOf, type SearchParams } from './shared';

/**
 * 인격.
 *
 * 함정이 셋 있다(05-ui-foundation 4.3).
 *   - `hp` 는 스칼라가 아니라 기본값과 레벨당 증가량의 쌍이다.
 *   - `breakSection` 의 **길이가 인격마다 다르다**(1개 32 · 2개 67 · 3개 85). 3구간을 가정하지 않는다.
 *   - 저항의 축이 **공격 타입** 3종이다. E.G.O 는 죄악 7종이라 축이 다르다.
 *
 * 방어 스킬 216종은 공격 스킬과 같은 깊이로 기본 표시한다.
 * E.G.O 는 수감자에 붙으므로 여기 담지 않는다.
 */

export interface IdentityFilter {
	q?: string | undefined;
	sinners: string[];
	rarities: string[];
	affiliations: string[];
	sins: string[];
}

export function readIdentityFilter(params: SearchParams): IdentityFilter {
	return {
		q: one(params['q'])?.trim() || undefined,
		sinners: multi(params['sinner']),
		rarities: multi(params['rarity']),
		affiliations: multi(params['affiliation']),
		sins: multi(params['sin']),
	};
}

export async function listSinners(locale: Locale) {
	const rows = await db.sinner.findMany({
		orderBy: { id: 'asc' },
		include: { texts: localeFilter(locale) },
	});
	return rows.map((s) => ({ id: s.id, icon: sinnerIcon(s.id), text: nameOf(s.texts, locale) }));
}

export async function listAffiliations(locale: Locale) {
	const rows = await db.affiliation.findMany({
		orderBy: { id: 'asc' },
		include: { texts: localeFilter(locale), _count: { select: { identities: true } } },
	});
	return rows
		.filter((a) => a._count.identities > 0)
		.map((a) => ({ id: a.id, text: nameOf(a.texts, locale), count: a._count.identities }));
}

export async function listIdentities(locale: Locale, filter: IdentityFilter) {
	const and: Prisma.IdentityWhereInput[] = [];
	if (filter.sinners.length) and.push({ sinnerId: { in: filter.sinners.map(Number) } });
	if (filter.rarities.length) and.push({ rarity: { in: filter.rarities.map(Number) } });
	if (filter.affiliations.length) {
		and.push({ affiliations: { some: { affiliationId: { in: filter.affiliations } } } });
	}
	// 스킬의 죄악 속성으로 거른다. 죄악이 없는 스킬이 131건 있어 null 은 걸리지 않는다.
	if (filter.sins.length) {
		and.push({ skills: { some: { affinity: { in: filter.sins as Sin[] } } } });
	}
	if (filter.q) {
		and.push({
			texts: {
				some: { locale: { in: [locale, 'en'] }, name: { contains: filter.q, mode: 'insensitive' } },
			},
		});
	}

	const rows = await db.identity.findMany({
		where: and.length ? { AND: and } : {},
		orderBy: [{ sinnerId: 'asc' }, { id: 'asc' }],
		include: {
			texts: localeFilter(locale),
			affiliations: { include: { affiliation: { include: { texts: localeFilter(locale) } } } },
		},
	});

	return rows.map((i) => ({
		id: i.id,
		sinnerId: i.sinnerId,
		rarity: i.rarity,
		season: i.season,
		image: identityImage(i.id, 'profile'),
		text: nameOf(i.texts, locale),
		affiliations: i.affiliations.map((a) => ({
			id: a.affiliationId,
			text: nameOf(a.affiliation.texts, locale),
		})),
	}));
}

export async function getIdentity(id: number, locale: Locale) {
	const identity = await db.identity.findUnique({
		where: { id },
		include: {
			texts: localeFilter(locale),
			sinner: { include: { texts: localeFilter(locale) } },
			resists: true,
			speeds: { orderBy: { uptie: 'asc' } },
			affiliations: { include: { affiliation: { include: { texts: localeFilter(locale) } } } },
			statuses: { include: { status: { include: { texts: localeFilter(locale) } } } },
			passives: {
				include: {
					passive: { include: { texts: localeFilter(locale), requirements: true } },
				},
			},
			skills: {
				orderBy: [{ defType: 'asc' }, { id: 'asc' }],
				include: {
					stages: {
						orderBy: { uptie: 'asc' },
						include: {
							texts: localeFilter(locale),
							coins: {
								orderBy: { index: 'asc' },
								include: { texts: localeFilter(locale) },
							},
						},
					},
				},
			},
		},
	});

	if (!identity) return null;

	return {
		id: identity.id,
		sinnerId: identity.sinnerId,
		sinner: nameOf(identity.sinner.texts, locale),
		rarity: identity.rarity,
		season: identity.season,
		releaseDate: identity.releaseDate,
		hpBase: identity.hpBase,
		hpPerLevel: identity.hpPerLevel,
		defCorrection: identity.defCorrection,
		// 길이가 인격마다 다르다. 배열 그대로 넘기고 화면이 길이를 가정하지 않는다.
		breakSection: identity.breakSection,
		text: nameOf(identity.texts, locale),
		images: {
			profile: identityImage(identity.id, 'profile'),
			profileBase: identityImage(identity.id, 'profileBase'),
			full: identityImage(identity.id, 'full'),
			fullAwakened: identityImage(identity.id, 'fullAwakened'),
		},
		resists: identity.resists.map((r) => ({ atkType: r.atkType, value: r.value })),
		speeds: identity.speeds.map((s) => ({ uptie: s.uptie, min: s.min, max: s.max })),
		affiliations: identity.affiliations.map((a) => ({
			id: a.affiliationId,
			text: nameOf(a.affiliation.texts, locale),
		})),
		statuses: identity.statuses.map((s) => ({
			id: s.statusId,
			text: nameOf(s.status.texts, locale),
		})),
		passives: identity.passives.map((p) => ({
			id: p.passiveId,
			kind: p.kind,
			uptie: p.uptie,
			text: textOf(p.passive.texts, locale),
			requirements: p.passive.requirements.map((r) => ({ type: r.type, value: r.value })),
			condType: p.passive.condType,
		})),
		skills: identity.skills.map((s) => ({
			id: s.id,
			deckCount: s.deckCount,
			affinity: s.affinity,
			atkType: s.atkType,
			defType: s.defType,
			tier: s.tier,
			icon: skillIcon(s.id),
			stages: s.stages.map((st) => ({
				uptie: st.uptie,
				baseValue: st.baseValue,
				coinValue: st.coinValue,
				atkWeight: st.atkWeight,
				text: textOf(st.texts, locale),
				// 코인 개수에 상한을 두지 않는다. 실측 최대 9개다.
				coins: st.coins.map((c) => ({
					index: c.index,
					type: c.type,
					// 918행은 어느 언어로도 설명이 없다. 효과 없는 코인이라 결손이 아니다.
					desc: c.texts.length ? textOf(c.texts.map((t) => ({ ...t, name: '' })), locale)?.desc ?? null : null,
				})),
			})),
		})),
	};
}

export type IdentityDetail = NonNullable<Awaited<ReturnType<typeof getIdentity>>>;
