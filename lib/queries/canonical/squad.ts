import type { Locale } from '@prisma/client';
import { canonical } from '@/lib/db-canonical';
import {
	egoImage,
	egoRankIcon,
	identityImage,
	keywordIcon,
	rarityIcon,
	sinIcon,
	sinnerIcon,
	uiIcon,
} from '@/lib/assets';
import { statusKeyOf, type StatusKey } from '@/lib/engine/vocab';
import { EGO_RANKS } from '@/lib/storage/schema';
import { localeRows, nameOf } from './locale';

/**
 * 편성 — 수감자 축으로 인격과 E.G.O 를 함께 보는 화면.
 *
 * **현행 `lib/queries/squad.ts` 를 대체한다.** 반환 모양은 같고 층만 다르다.
 *
 * **이 축이 필요한 이유는 E.G.O 가 인격이 아니라 수감자에 붙기 때문이다**(`Ego.sinnerId`).
 * 인격 상세에 E.G.O 를 싣지 않기로 했으므로(05-ui-foundation 4.3) 둘을 함께 보는 자리가
 * 따로 있어야 한다.
 *
 * **설명문은 싣지 않는다.** 표시 문자열 7,498 KB 를 내보내지 않는다는 제약이 그대로다
 * (ADR-05 3.3). 여기서 나가는 것은 이름과 축 태그뿐이다.
 *
 * `statusKeyOf` 는 `lib/engine/vocab` 의 순수 어휘다 — DB 를 안 보므로 층과 무관하다.
 */

/** 인격을 서술하는 축은 셋이다 — 키워드 · 소속 · 상태 기믹(05-ui-foundation 4.3). */
const MECHANIC_KEYS: readonly StatusKey[] = ['ammo', 'protection'];

const isMechanic = (key: StatusKey): boolean => MECHANIC_KEYS.includes(key);

/**
 * 인격 이름은 `title` 이다 — `canonical/detail.ts` 와 같은 함정이다.
 * `identity_text.name` 은 수감자 이름이라 그걸 쓰면 한 수감자의 카드가 전부 같아진다.
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

export async function listSquad(locale: Locale) {
	const sinners = await canonical.sinner.findMany({
		orderBy: { id: 'asc' },
		include: {
			texts: localeRows(locale),
			identities: {
				orderBy: [{ star: 'desc' }, { id: 'asc' }],
				include: {
					texts: localeRows(locale),
					statuses: { select: { statusId: true } },
					associations: { include: { association: { include: { texts: localeRows(locale) } } } },
					// 공격 스킬만 본다. 방어 스킬은 죄악 자원을 만들지 않는다.
					skills: {
						where: { skill: { kind: 'attack' } },
						select: { skill: { select: { sin: true, attackType: true } } },
					},
				},
			},
			egos: {
				/**
				 * **연출 전용 5종을 뺀다.** 캐노니컬은 컷신에만 나오는 E.G.O 를 담는데
				 * (`presentationOnly`) 그쪽은 등급도 각성 속성도 없다 — 플레이할 수
				 * 없으니 편성에 못 넣는다. 현행 스키마는 그 다섯을 아예 안 담았다.
				 */
				where: { presentationOnly: false },
				orderBy: [{ rank: 'asc' }, { id: 'asc' }],
				include: {
					texts: localeRows(locale),
					costs: true,
					statuses: { select: { statusId: true } },
				},
			},
		},
	});

	return sinners.map((s) => ({
		id: s.id,
		icon: sinnerIcon(s.id),
		text: nameOf(s.texts, locale),
		identities: s.identities.map((i) => {
			// 상태 id 1,472종을 키워드 축으로 접는다. 이름이 아니라 id 로 판정한다(02-data-model 3.10).
			const keys = new Set<StatusKey>();
			for (const st of i.statuses) {
				const key = statusKeyOf(st.statusId);
				if (key) keys.add(key);
			}
			return {
				id: Number(i.id),
				rarity: i.star,
				season: i.season,
				image: identityImage(Number(i.id), 'profile'),
				text: identityName(i.texts, locale),
				keywords: [...keys].filter((k) => !isMechanic(k)),
				// 키워드와 섞지 않는다. 기프트를 나누는 분류가 아니라 인격이 공급하는 자원이다.
				mechanics: [...keys].filter(isMechanic),
				/**
				 * 공격 스킬의 죄악. **중복을 접지 않는다.**
				 *
				 * 죄악 자원은 스킬을 쓸 때마다 들어오므로 공급량의 단위가 인격이 아니라 스킬이다.
				 * 인격당 하나로 접으면 "분노 스킬 셋"과 "분노 스킬 하나"가 같은 값이 되고,
				 * 그것을 E.G.O 비용과 대조하면 수급 판정이 틀린다.
				 *
				 * 엔진의 `sinSupply` 는 인격 수를 센다(`lib/engine/state.ts`) — 조건 평가의 단위가
				 * 다르기 때문이며, 화면이 그 값을 옮겨 적는 것이 아니라는 뜻이다.
				 */
				skillSins: i.skills
					.map((k) => k.skill.sin)
					.filter((v): v is NonNullable<typeof v> => v !== null),
				atkTypes: [
					...new Set(
						i.skills
							.map((k) => k.skill.attackType)
							.filter((v): v is NonNullable<typeof v> => v !== null),
					),
				],
				affiliations: i.associations.map((a) => ({
					id: a.associationId,
					text: nameOf(a.association.texts, locale),
				})),
			};
		}),
		egos: s.egos.flatMap((e) => {
			// 등급·각성 속성이 없는 E.G.O 는 편성 카드를 못 그린다. 질의에서 이미
			// 연출 전용을 뺐지만 타입은 그것을 모르므로 여기서 한 번 더 좁힌다 —
			// 값이 없으면 지어내지 않고 목록에서 뺀다
			if (e.rank === null || e.sin === null || e.attackType === null) return [];

			const keys = new Set<StatusKey>();
			for (const st of e.statuses) {
				const key = statusKeyOf(st.statusId);
				if (key) keys.add(key);
			}
			return [{
				id: Number(e.id),
				rank: e.rank,
				image: egoImage(Number(e.id), 'awaken'),
				text: nameOf(e.texts, locale),
				awakenAffinity: e.sin,
				awakenAtkType: e.attackType,
				keywords: [...keys],
				// 죄악 자원 소모는 E.G.O 기능의 핵심이다(02-data-model 3.4).
				costs: e.costs.map((c) => ({ sin: c.sin, amount: c.count })),
			}];
		}),
	}));
}

export type SquadSinner = Awaited<ReturnType<typeof listSquad>>[number];
export type SquadIdentity = SquadSinner['identities'][number];
export type SquadEgo = SquadSinner['egos'][number];

/**
 * 기믹 상태의 원본 id. 축 키와 이름이 달라 표로 잇는다.
 *
 * 캐노니컬도 같은 id 를 쓴다 — `canonical/list.ts` 의 `MECHANICS` 와 같은 둘이다.
 */
const MECHANIC_STATUS_ID: Record<string, StatusKey> = { Bullet: 'ammo', Protection: 'protection' };

/** 인격 등급 1–3. 게임 표기 0 / 00 / 000 이 그대로 파일명이다. */
const RARITIES = [1, 2, 3] as const;

export async function listSquadAxes(locale: Locale) {
	const [keywords, sins, mechanics] = await Promise.all([
		canonical.keyword.findMany({ orderBy: { order: 'asc' }, include: { texts: localeRows(locale) } }),
		canonical.sinInfo.findMany({ orderBy: { order: 'asc' }, include: { texts: localeRows(locale) } }),
		canonical.status.findMany({
			where: { id: { in: Object.keys(MECHANIC_STATUS_ID) } },
			include: { texts: localeRows(locale) },
		}),
	]);

	const labels: Record<string, string> = {};
	const icons: Record<string, string | null> = {};

	for (const k of keywords) {
		const name = nameOf(k.texts, locale)?.name;
		if (name) labels[k.id] = name;
		// 키워드 표에 상태 7종과 공격 타입 3종이 함께 있고 아이콘 규칙도 같다.
		icons[k.id] = keywordIcon(k.id);
	}
	for (const s of sins) {
		const name = nameOf(s.texts, locale)?.name;
		if (name) labels[s.sin] = name;
		icons[s.sin] = sinIcon(s.sin);
	}
	for (const m of mechanics) {
		const key = MECHANIC_STATUS_ID[m.id];
		if (!key) continue;
		const name = nameOf(m.texts, locale)?.name;
		if (name) labels[key] = name;
		// 탄환·보호는 공용 아이콘 목록에 없다. 없는 것이 정상이라 화면이 글자로 낸다.
		icons[key] = uiIcon(m.id);
	}

	return {
		labels,
		icons,
		// 죄악은 표시 순서가 게임에 정해져 있다(`sin_info.order`). 프로필의 행 순서가 그것을 따른다.
		sinOrder: sins.map((s) => s.sin),
		rarityIcons: Object.fromEntries(RARITIES.map((r) => [r, rarityIcon(r)])) as Record<
			string,
			string | null
		>,
		rankIcons: Object.fromEntries(EGO_RANKS.map((r) => [r, egoRankIcon(r)])) as Record<
			string,
			string | null
		>,
	};
}

export type SquadAxes = Awaited<ReturnType<typeof listSquadAxes>>;
