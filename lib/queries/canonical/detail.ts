import type { Locale } from '@prisma/client';
import { canonical } from '@/lib/db-canonical';
import {
	atkTypeIcon,
	defTypeIcon,
	egoImage,
	giftIcon,
	identityImage,
	packBossIcon,
	packIcon,
	rarityIcon,
	sinIcon,
	skillFrame,
	skillIcon,
} from '@/lib/assets';
import { localeRows, nameOf, textOf } from './locale';

/**
 * 상세 화면이 쓰는 캐노니컬 질의 — 인격 · E.G.O · 팩.
 *
 * **현행 `lib/queries/{identities,egos,packs}.ts` 의 상세부를 대체한다.** 반환
 * 모양은 같고 층만 다르다.
 *
 * 캐노니컬이 이름을 달리 쓰는 자리가 많다. 화면 계약을 지키려 여기서 되돌린다.
 *
 * ```
 * 인격  id String→number · rarity→star · hpBase→hp · hpPerLevel→hpLevel
 *       breakSection→stagger · speeds→speed · affiliations→associations
 *       skills 가 직접 관계가 아니라 IdentitySkill 조인이다
 * E.G.O  id String→number · passives 가 index 대신 ordinal 을 쓸 수 있다
 * 팩     gift.tier 가 Int?+tierLabel 로 갈렸다
 * ```
 */

/** 캐노니컬의 `tier` + `tierLabel` 을 화면이 쓰던 한 열로 되돌린다. */
const tierOf = (g: { tier: number | null; tierLabel: string | null }): string =>
	g.tierLabel ?? (g.tier === null ? '' : String(g.tier));

/**
 * 게임의 죄악 차례. `canonical.sin_info.order` 가 같은 것을 데이터로 갖고 있고
 * `Sin` enum 의 선언 순서도 이것이다.
 *
 * **현행은 정렬을 안 줬다.** 원본 JSON 의 키 순서가 그대로 나와 E.G.O 마다 차례가
 * 달랐다 — 20509 는 envy · pride · wrath 였다. 게임 차례로 못 박는다.
 */
const SIN_ORDER = ['wrath', 'lust', 'sloth', 'gluttony', 'gloom', 'pride', 'envy'];

const bySin = <T extends { sin: string }>(rows: T[]): T[] =>
	[...rows].sort((a, b) => SIN_ORDER.indexOf(a.sin) - SIN_ORDER.indexOf(b.sin));

/**
 * 출시일. **캐노니컬은 문자열이고 현행은 `Date` 였다.**
 *
 * 화면이 `.toISOString().slice(0, 10)` 을 부르므로 `Date` 로 되돌린다 — 이 PR 은
 * 화면 계약을 안 바꾼다. 원본이 `"2026-06-11"` 꼴이라 UTC 자정으로 읽힌다.
 */
const dateOf = (raw: string | null): Date | null => (raw === null ? null : new Date(raw));

/**
 * 인격 이름은 `title` 이다.
 *
 * `identity_text.name` 은 **수감자 이름**이고(10208 → 「파우스트」) 인격 이름은
 * `title` 에 있다(「검계\n살수」). `canonical/list.ts` 가 목록에서 겪은 것과 같은
 * 함정이며, 스키마 주석은 이 둘을 반대로 적고 있다 — 실측이 정본이다.
 *
 * 게임이 두 줄로 흘려 쓰는 이름이 있어 `title` 에 줄바꿈이 들어 있다 — 한 줄로 편다.
 */
function identityName(
	rows: Array<{ locale: string; name: string; title: string | null }>,
	locale: Locale,
) {
	const pick = rows.find((r) => r.locale === locale) ?? rows.find((r) => r.locale === 'en');
	if (!pick) return null;
	return {
		name: (pick.title ?? pick.name).replace(/\s+/g, ' ').trim(),
		fellBack: pick.locale !== locale,
	};
}

// ── 인격 ─────────────────────────────────────────────────────────

export async function getIdentity(id: number, locale: Locale) {
	const identity = await canonical.identity.findUnique({
		where: { id: String(id) },
		include: {
			texts: localeRows(locale),
			sinner: { include: { texts: localeRows(locale) } },
			resists: true,
			speed: { orderBy: { uptie: 'asc' } },
			associations: { include: { association: { include: { texts: localeRows(locale) } } } },
			statuses: { include: { status: { include: { texts: localeRows(locale) } } } },
			passives: {
				include: { passive: { include: { texts: localeRows(locale), requirements: true } } },
			},
			skills: {
				orderBy: [{ role: 'asc' }, { ordinal: 'asc' }],
				include: {
					skill: {
						include: {
							stages: {
								orderBy: { uptie: 'asc' },
								include: { texts: localeRows(locale), coins: { orderBy: { index: 'asc' } } },
							},
						},
					},
				},
			},
		},
	});

	if (!identity) return null;

	return {
		id: Number(identity.id),
		sinnerId: identity.sinnerId,
		sinner: nameOf(identity.sinner.texts, locale),
		rarity: identity.star,
		rarityIcon: rarityIcon(identity.star),
		season: identity.season,
		releaseDate: dateOf(identity.releaseDate),
		hpBase: identity.hp,
		hpPerLevel: identity.hpLevel,
		defCorrection: identity.defCorrection,
		// 길이가 인격마다 다르다. 배열 그대로 넘기고 화면이 길이를 가정하지 않는다.
		breakSection: identity.stagger,
		text: identityName(identity.texts, locale),
		images: {
			profile: identityImage(Number(identity.id), 'profile'),
			profileBase: identityImage(Number(identity.id), 'profileBase'),
			full: identityImage(Number(identity.id), 'full'),
			fullAwakened: identityImage(Number(identity.id), 'fullAwakened'),
		},
		resists: identity.resists.map((r) => ({ atkType: r.atkType, value: r.value })),
		speeds: identity.speed.map((s) => ({ uptie: s.uptie, min: s.min, max: s.max })),
		affiliations: identity.associations.map((a) => ({
			id: a.associationId,
			text: nameOf(a.association.texts, locale),
		})),
		statuses: identity.statuses.map((s) => ({
			id: s.statusId,
			text: nameOf(s.status.texts, locale),
		})),
		passives: identity.passives.map((p) => ({
			id: p.passiveId,
			kind: p.role,
			uptie: p.level,
			text: textOf(p.passive.texts, locale),
			requirements: p.passive.requirements.map((r) => ({ type: r.sin, value: r.value })),
			condType: p.passive.condType,
		})),
		skills: identity.skills.map((s) => ({
			id: Number(s.skillId),
			deckCount: s.copies,
			affinity: s.skill.sin,
			atkType: s.skill.attackType,
			defType: s.skill.kind,
			tier: s.skill.skillTier,
			icon: skillIcon(Number(s.skillId)),
			// tier 는 표시용 숫자이면서 프레임 애셋을 고르는 키다.
			// 아이콘이 없는 12종에서도 프레임은 뜨므로 그것이 대체 표시가 된다.
			frame: skillFrame(s.skill.sin, s.skill.skillTier, s.skill.kind),
			icons: {
				sin: s.skill.sin ? sinIcon(s.skill.sin) : null,
				atkType: s.skill.attackType ? atkTypeIcon(s.skill.attackType) : null,
				defType: defTypeIcon(s.skill.kind),
			},
			stages: s.skill.stages.map((st) => ({
				uptie: st.uptie,
				baseValue: st.baseValue,
				coinValue: st.coinValue,
				atkWeight: st.atkWeight,
				text: textOf(st.texts, locale),
				/*
					코인 개수에 상한을 두지 않는다. 실측 최대 9개다.

					**캐노니컬의 코인은 로케일 축을 갖는다.** 현행은 영문 단일이라 한국어
					4,305코인·5,519줄을 잃었다(스키마 주석). 요청 로케일을 고르고 없으면
					영어로 물러선다 — 다른 텍스트와 같은 규칙이다.
				*/
				coins: [...new Set(st.coins.map((c) => c.index))]
					.sort((a, b) => a - b)
					.map((index) => {
						const rows = st.coins.filter((c) => c.index === index);
						const picked = rows.find((c) => c.locale === locale)
							?? rows.find((c) => c.locale === 'en');
						return {
							index,
							type: picked?.type ?? null,
							// 918행은 어느 언어로도 설명이 없다. 효과 없는 코인이라 결손이 아니다.
							desc: picked && picked.effects.length > 0 ? picked.effects.join('\n') : null,
						};
					}),
			})),
		})),
	};
}

export type IdentityDetail = NonNullable<Awaited<ReturnType<typeof getIdentity>>>;

// ── E.G.O ────────────────────────────────────────────────────────

export async function getEgo(id: number, locale: Locale) {
	const ego = await canonical.ego.findUnique({
		where: { id: String(id) },
		include: {
			texts: localeRows(locale),
			sinner: { include: { texts: localeRows(locale) } },
			// 죄악은 enum 이라 정렬을 안 주면 선언 순서로 나오는데, 그 순서가
			// 캐노니컬과 현행에서 다르다. 이름순으로 못 박는다
			costs: { orderBy: { sin: 'asc' } },
			resists: { orderBy: { sin: 'asc' } },
			statuses: { include: { status: { include: { texts: localeRows(locale) } } } },
			// 연결 표에 순서가 없다. passiveId 로 정렬해 실행마다 같은 차례를 낸다
			passives: {
				orderBy: { passiveId: 'asc' },
				include: { passive: { include: { texts: localeRows(locale) } } },
			},
		},
	});

	if (!ego) return null;

	return {
		id: Number(ego.id),
		sinnerId: ego.sinnerId,
		sinner: nameOf(ego.sinner.texts, locale),
		rank: ego.rank,
		season: ego.season,
		releaseDate: dateOf(ego.releaseDate),
		awakenAffinity: ego.sin,
		awakenAtkType: ego.attackType,
		corrosionAffinity: ego.corrosionSin,
		corrosionAtkType: ego.corrosionAttackType,
		extractable: ego.extractable,
		maxThreadspin: ego.maxThreadspin,
		text: nameOf(ego.texts, locale),
		images: {
			awaken: egoImage(Number(ego.id), 'awaken'),
			cg: egoImage(Number(ego.id), 'cg'),
			erosion: egoImage(Number(ego.id), 'erosion'),
		},
		// 죄악 자원 소모량. E.G.O 기능의 핵심이다(02-data-model 3.4).
		costs: bySin(ego.costs).map((c) => ({ sin: c.sin, amount: c.count })),
		resists: bySin(ego.resists).map((r) => ({ sin: r.sin, value: r.value })),
		statuses: ego.statuses.map((s) => ({ id: s.statusId, text: nameOf(s.status.texts, locale) })),
		// 패시브는 요약 파일에 없고 개별 상세에만 있었다(02-data-model 3.4).
		// 캐노니컬 연결 표에 순서 열이 없어 나열 차례를 index 로 쓴다
		passives: ego.passives.map((p, index) => ({
			index,
			text: textOf(p.passive.texts, locale),
		})),
	};
}

export type EgoDetail = NonNullable<Awaited<ReturnType<typeof getEgo>>>;

// ── 테마 팩 ──────────────────────────────────────────────────────

export async function getPack(id: string, locale: Locale) {
	const giftShape = {
		include: {
			gift: {
				include: {
					stages: { where: { level: 0 }, include: { texts: localeRows(locale) } },
					keyword: { include: { texts: localeRows(locale) } },
				},
			},
		},
	};

	const pack = await canonical.pack.findUnique({
		where: { id },
		include: {
			texts: localeRows(locale),
			// 조우 이름은 담지 않았다 — 팩 이름과 같기 때문이다. 담긴 것은 등장하는 적이다.
			bosses: {
				include: {
					encounter: {
						// 캐노니컬은 적 이름을 target 행에 직접 담는다 — 로케일 표가 아니다.
						// 「정본은 asset targets[].name 이다. loc 이름으로 덮지 않는다」(스키마 주석)
						include: { targets: { orderBy: [{ groupIndex: 'asc' }, { index: 'asc' }] } },
					},
				},
			},
			floors: true,
			exclusiveGifts: giftShape,
			gifts: giftShape,
		},
	});

	if (!pack) return null;

	type Row = (typeof pack.gifts)[number];
	const shape = (row: Row) => ({
		id: Number(row.giftId),
		tier: tierOf(row.gift),
		keyword: row.gift.keyword ? nameOf(row.gift.keyword.texts, locale) : null,
		icon: giftIcon(row.gift.sprite),
		text: nameOf(row.gift.stages[0]?.texts ?? [], locale),
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
				count: t.num,
				// 이름이 행에 직접 있다. 로케일 폴백이 없으므로 fellBack 은 false 다
				text: { name: t.name, fellBack: false },
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
