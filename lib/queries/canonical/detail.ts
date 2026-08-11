import type { Locale } from '@/lib/locale';
import { canonical } from '@/lib/db-canonical';
import {
	atkTypeIcon,
	defTypeIcon,
	egoImage,
	egoRankIcon,
	giftIcon,
	identityImage,
	keywordIcon,
	packBossIcon,
	packIcon,
	rarityIcon,
	sinIcon,
	skillFrame,
	sinnerIcon,
	skillIcon,
	statusIcon,
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

/**
 * 공격 타입의 이름은 `keyword` 어휘가 갖고 있다 — 참격 · 관통 · 타격.
 * `EgoGiftCategory.json` 이 정본이다. 다만 `attack_type` 열은 `slash` · `pierce` · `blunt`
 * 로 적혀 어휘 id 와 달라 여기서 맞춘다. **화면이 이 어긋남을 알 필요가 없다.**
 */
const ATK_KEYWORD: Record<string, string> = { slash: 'Slash', pierce: 'Penetrate', blunt: 'Hit' };

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

/**
 * 본문에 나오는 상태만 고른다.
 *
 * 등록 목록 안에서만 찾으므로 엉뚱한 낱말이 걸리지 않는다. 이름과 토큰 두 갈래로 보는
 * 까닭은 `getIdentity` 의 주석에 적었다.
 */
function pickStatuses(
	rows: ReadonlyArray<{
		statusId: string;
		status: {
			sprite: string | null;
			texts: ReadonlyArray<{ locale: string; name: string; desc: string | null }>;
		};
	}>,
	body: string,
	locale: Locale,
) {
	return rows
		.map((row) => {
			const text = textOf(row.status.texts, locale);
			if (!text) return null;
			const byName = text.name.length >= 2 && body.includes(text.name);
			const byToken = body.includes(`[${row.statusId}]`);
			if (!byName && !byToken) return null;
			return {
				id: row.statusId,
				text,
				icon: statusIcon(row.status.sprite),
			};
		})
		.filter((v) => v !== null)
		.sort((a, b) => a.text.name.localeCompare(b.text.name));
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
			// 기믹 축. 게임이 「직접 부여하는 것」으로 선언한 값이다(#32 부여와 제한).
			keywords: true,
			passives: {
				include: { passive: { include: { texts: localeRows(locale), requirements: true } } },
			},
			skills: {
				/*
					**`non_action` 하나를 뺀다.** `1000104` E.G.O 침식은 184 인격 전부에 붙어
					있고 고를 수 있는 스킬이 아니다 — 정신력이 바닥났을 때 게임이 대신 쓰는
					것이다. 목록에 두면 모든 인격의 스킬이 하나씩 늘어난다.
				*/
				where: { skill: { kind: { not: 'non_action' } } },
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

	/* 상태를 가려낼 밑글. 스킬 · 코인 · 패시브의 모든 줄을 한 덩이로 잇는다. */
	const body = [
		...identity.skills.flatMap((s) =>
			s.skill.stages.flatMap((st) => [
				textOf(st.texts, locale)?.desc ?? '',
				...st.coins.map((c) => c.effects.join('\n')),
			]),
		),
		...identity.passives.map((p) => textOf(p.passive.texts, locale)?.desc ?? ''),
	].join('\n');

	/*
		이름표는 데이터에서 읽는다. **표를 새로 만들지 않는다.**

		죄악은 `sin_text` 가, 공격 타입은 `keyword` 의 `Slash` · `Penetrate` · `Hit` 이
		갖고 있다(참격 · 관통 · 타격). 후자는 `EgoGiftCategory.json` 이 정본이다. 다만
		`skill.attack_type` 은 `slash` · `pierce` · `blunt` 로 적혀 어휘 id 와 다르므로
		여기서 맞춘다 — 화면이 그 어긋남을 알 필요가 없다.
	*/
	const [sinRows, vocabulary] = await Promise.all([
		canonical.sinText.findMany({ where: { locale: { in: [locale, 'en'] } } }),
		canonical.keyword.findMany({ include: { texts: localeRows(locale) } }),
	]);
	const sinNames: Record<string, string> = {};
	for (const r of sinRows) if (r.locale === locale || !sinNames[r.sin]) sinNames[r.sin] = r.name;
	const atkNames: Record<string, string> = {};
	for (const [atk, keywordId] of Object.entries(ATK_KEYWORD)) {
		const text = nameOf(vocabulary.find((v) => v.id === keywordId)?.texts ?? [], locale);
		if (text) atkNames[atk] = text.name;
	}

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
			/** 수감자 상징. 표제에 이름과 함께 선다. */
			sinner: sinnerIcon(identity.sinnerId),
		},
		resists: identity.resists.map((r) => ({
			atkType: r.atkType,
			value: r.value,
			icon: atkTypeIcon(r.atkType),
		})),
		speeds: identity.speed.map((s) => ({ uptie: s.uptie, min: s.min, max: s.max })),
		affiliations: identity.associations.map((a) => ({
			id: a.associationId,
			text: nameOf(a.association.texts, locale),
		})),
		/*
			상태.

			**등록 목록을 그대로 늘어놓지 않고 본문에 나오는 것만 고른다.** `identity_status`
			는 넓게 잡혀 있어 글에 없는 것까지 든다 — 읽는 사람이 궁금해하는 것은 지금 눈에
			보이는 낱말이다.

			**두 갈래로 찾는다.** 문구가 상태를 늘 같은 꼴로 적지 않는다.

			  이름   「침잠 1 부여」   치환이 끝난 줄
			  토큰   「[Sinking] 1 부여」   아직 안 끝난 줄 — ko 코인 7,634 중 4,219 행

			이름만 보면 후자를, 토큰만 보면 전자를 놓친다. 실측으로 토큰만 볼 때 184 중 48
			인격이 통째로 비었다.

			아무 이름이나 훑지 않고 **그 인격의 등록 목록 안에서만** 찾으므로 엉뚱한 낱말이
			걸리지 않는다. 한 글자 이름은 뺀다 — 어느 문장에나 걸린다.
		*/
		statuses: pickStatuses(identity.statuses, body, locale),

		/*
			기믹 키워드.

			**아이콘 열쇠는 id 가 아니라 `en` 이름이다** — `Laceration` → `Bleed.webp` 처럼
			다섯 군데가 갈린다. 짝표를 새로 만들지 않고 데이터가 가진 이름을 그대로 쓴다.
			목록 화면이 쓰는 규칙과 같다(`canonical/list.ts`).
		*/
		keywords: identity.keywords
			.map((k) => {
				const row = vocabulary.find((v) => v.id === k.keywordId);
				const text = row ? nameOf(row.texts, locale) : null;
				const en = row?.texts.find((t) => t.locale === 'en')?.name;
				return text ? { id: k.keywordId, text, icon: keywordIcon(en ?? k.keywordId) } : null;
			})
			.filter((v) => v !== null),

		/** 죄악 · 공격 타입의 이름. **화면이 표를 들지 않는다** — 데이터에 있다. */
		sinNames,
		atkNames,
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
			/*
				이 스킬이 처음 생기는 동기화 단계.

				**단계 행은 바뀔 때만 있다.** 1051504 는 1·4 단계만 갖는데 2·3 에서 문구가
				그대로라 행이 없을 뿐이고, 1051503 은 3 단계부터 행이 생겨 그 앞에서는
				정말로 쓸 수 없다. 화면이 둘을 갈라 말하려면 이 값이 필요하다.
			*/
			firstUptie: s.skill.stages[0]?.uptie ?? null,
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
			/* 침식 확률 곡선. `section` 은 백분율이 아니라 정규화된 SP 자리다 — 아래 참고. */
			corrosions: { orderBy: { index: 'asc' } },
			/*
				스킬. **인격과 구조가 다르다** — 각성과 침식으로 갈리고, 단계가 델타가 아니라
				있는 것만 담긴다(실측 1 · 3 · 4 가 주력이고 2 · 5 는 열 건뿐이다).
			*/
			skills: {
				orderBy: [{ role: 'asc' }, { ordinal: 'asc' }],
				include: {
					stages: {
						orderBy: { uptie: 'asc' },
						include: { texts: localeRows(locale), coins: { orderBy: { index: 'asc' } } },
					},
				},
			},
			// 연결 표에 순서가 없다. passiveId 로 정렬해 실행마다 같은 차례를 낸다
			passives: {
				orderBy: { passiveId: 'asc' },
				include: { passive: { include: { texts: localeRows(locale) } } },
			},
		},
	});

	if (!ego) return null;

	/* 상태를 가려낼 밑글. 스킬 · 코인 · 패시브의 모든 줄을 한 덩이로 잇는다. */
	const body = [
		...ego.skills.flatMap((s) =>
			s.stages.flatMap((st) => [
				textOf(st.texts, locale)?.desc ?? '',
				...st.coins.map((c) => c.effects.join('\n')),
			]),
		),
		...ego.passives.map((p) => textOf(p.passive.texts, locale)?.desc ?? ''),
	].join('\n');

	const [sinRows, vocabulary] = await Promise.all([
		canonical.sinText.findMany({ where: { locale: { in: [locale, 'en'] } } }),
		canonical.keyword.findMany({ include: { texts: localeRows(locale) } }),
	]);
	const sinNames: Record<string, string> = {};
	for (const r of sinRows) if (r.locale === locale || !sinNames[r.sin]) sinNames[r.sin] = r.name;
	const atkNames: Record<string, string> = {};
	for (const [atk, keywordId] of Object.entries(ATK_KEYWORD)) {
		const text = nameOf(vocabulary.find((v) => v.id === keywordId)?.texts ?? [], locale);
		if (text) atkNames[atk] = text.name;
	}

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
		rankIcon: ego.rank ? egoRankIcon(ego.rank) : null,
		images: {
			awaken: egoImage(Number(ego.id), 'awaken'),
			cg: egoImage(Number(ego.id), 'cg'),
			erosion: egoImage(Number(ego.id), 'erosion'),
			/** 수감자 상징. 표제에 이름과 함께 선다. */
			sinner: sinnerIcon(ego.sinnerId),
		},
		// 죄악 자원 소모량. E.G.O 기능의 핵심이다(02-data-model 3.4).
		costs: bySin(ego.costs).map((c) => ({ sin: c.sin, amount: c.count })),
		resists: bySin(ego.resists).map((r) => ({ sin: r.sin, value: r.value })),
		statuses: pickStatuses(ego.statuses, body, locale),

		/*
			기믹 키워드.

			**인격과 다른 데서 온다.** 인격은 `identity_keyword` 라는 전용 표를 갖지만 E.G.O
			에는 그런 표가 없어 `ego_status` 에서 기믹 어휘와 겹치는 것만 추린다. 목록 화면이
			쓰는 규칙과 같다(`canonical/list.ts`). **두 방식이 같지는 않다는 사실을 여기 적어
			둔다** — 유래가 다르다.
		*/
		keywords: [...new Set(ego.statuses.map((s) => s.statusId))]
			.map((statusId) => {
				const row = vocabulary.find((v) => v.id === statusId);
				const text = row ? nameOf(row.texts, locale) : null;
				const en = row?.texts.find((t) => t.locale === 'en')?.name;
				return text ? { id: statusId, text, icon: keywordIcon(en ?? statusId) } : null;
			})
			.filter((v) => v !== null),

		/**
		 * 침식 확률.
		 *
		 * `section` 은 백분율이 아니라 **정규화된 정신력 자리**다 — 게임의 SP 범위
		 * `[-45, +45]` 를 `[0, 1]` 로 편 값이다(마스터북 게임 확인). `0.5` 가 SP 0 이고
		 * `0` 이 SP −45 다. 화면이 그 자리를 SP 로 되돌려 보인다.
		 */
		corrosion: ego.corrosions.map((c) => ({
			sp: Math.round(c.section * 90 - 45),
			probability: c.probability,
		})),

		/** 죄악 · 공격 타입 이름표. **화면이 표를 들지 않는다** — 데이터에 있다. */
		sinNames,
		atkNames,

		/*
			스킬. 각성과 침식으로 갈린다.

			`abName` 은 **유래 환상체**다(loc 단독 개념). 실측 611/611 이 값을 갖는다.
		*/
		skills: ego.skills.map((s) => ({
			id: Number(s.id),
			role: s.role,
			ordinal: s.ordinal,
			icon: skillIcon(Number(s.id)),
			/** 이 스킬이 처음 생기는 단계. 단계가 띄엄띄엄해 화면이 이월을 판정해야 한다. */
			firstUptie: s.stages[0]?.uptie ?? null,
			stages: s.stages.map((st) => ({
				uptie: st.uptie,
				spCost: st.spCost,
				baseValue: st.baseValue,
				coinValue: st.coinValue,
				atkWeight: st.atkWeight,
				text: textOf(st.texts, locale),
				abName: st.texts.find((t) => t.locale === locale)?.abName
					?? st.texts.find((t) => t.locale === 'en')?.abName
					?? null,
				coins: [...new Set(st.coins.map((c) => c.index))]
					.sort((a, b) => a - b)
					.map((index) => {
						const rows = st.coins.filter((c) => c.index === index);
						const picked =
							rows.find((c) => c.locale === locale) ?? rows.find((c) => c.locale === 'en');
						return {
							index,
							desc: picked && picked.effects.length > 0 ? picked.effects.join('\n') : null,
						};
					}),
			})),
		})),
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
