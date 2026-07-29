import type { Locale } from '@prisma/client';
import { db } from '@/lib/db';
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
import { localeFilter, nameOf } from './shared';

/**
 * 편성 — 수감자 축으로 인격과 E.G.O 를 함께 보는 화면.
 *
 * **이 축이 필요한 이유는 E.G.O 가 인격이 아니라 수감자에 붙기 때문이다**(`Ego.sinnerId`).
 * 인격 상세에 E.G.O 를 싣지 않기로 했으므로(05-ui-foundation 4.3) 둘을 함께 보는 자리가
 * 따로 있어야 한다.
 *
 * **선택 축을 함께 싣는다.** 편성 칸이 표시 전용이 되고 고르는 일이 필터 모달로 나가면
 * (`reference/v1-formation-ui.md` 1절) 그 모달이 키워드·죄악·공격 타입·기믹·소속으로 걸러야
 * 한다. 다섯 축은 인격 이름 옆에 없고 관계 테이블에 있다 — 여기서 한 번에 가져온다.
 *
 * **설명문은 싣지 않는다.** 표시 문자열 7,498 KB 를 내보내지 않는다는 제약이 그대로다
 * (ADR-05 3.3). 여기서 나가는 것은 이름과 축 태그뿐이다.
 */

/** 인격을 서술하는 축은 셋이다 — 키워드 · 소속 · 상태 기믹(05-ui-foundation 4.3). */
const MECHANIC_KEYS: readonly StatusKey[] = ['ammo', 'protection'];

const isMechanic = (key: StatusKey): boolean => MECHANIC_KEYS.includes(key);

export async function listSquad(locale: Locale) {
	const sinners = await db.sinner.findMany({
		orderBy: { id: 'asc' },
		include: {
			texts: localeFilter(locale),
			identities: {
				orderBy: [{ rarity: 'desc' }, { id: 'asc' }],
				include: {
					texts: localeFilter(locale),
					statuses: { select: { statusId: true } },
					affiliations: { include: { affiliation: { include: { texts: localeFilter(locale) } } } },
					// 공격 스킬만 본다. 방어 스킬은 죄악 자원을 만들지 않는다.
					skills: { where: { defType: 'attack' }, select: { affinity: true, atkType: true } },
				},
			},
			egos: {
				orderBy: [{ rank: 'asc' }, { id: 'asc' }],
				include: {
					texts: localeFilter(locale),
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
				id: i.id,
				rarity: i.rarity,
				season: i.season,
				image: identityImage(i.id, 'profile'),
				text: nameOf(i.texts, locale),
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
					.map((k) => k.affinity)
					.filter((v): v is NonNullable<typeof v> => v !== null),
				atkTypes: [
					...new Set(
						i.skills.map((k) => k.atkType).filter((v): v is NonNullable<typeof v> => v !== null),
					),
				],
				affiliations: i.affiliations.map((a) => ({
					id: a.affiliationId,
					text: nameOf(a.affiliation.texts, locale),
				})),
			};
		}),
		egos: s.egos.map((e) => {
			const keys = new Set<StatusKey>();
			for (const st of e.statuses) {
				const key = statusKeyOf(st.statusId);
				if (key) keys.add(key);
			}
			return {
				id: e.id,
				rank: e.rank,
				image: egoImage(e.id, 'awaken'),
				text: nameOf(e.texts, locale),
				awakenAffinity: e.awakenAffinity,
				awakenAtkType: e.awakenAtkType,
				keywords: [...keys],
				// 죄악 자원 소모는 E.G.O 기능의 핵심이다(02-data-model 3.4).
				costs: e.costs.map((c) => ({ sin: c.sin, amount: c.amount })),
			};
		}),
	}));
}

export type SquadSinner = Awaited<ReturnType<typeof listSquad>>[number];
export type SquadIdentity = SquadSinner['identities'][number];
export type SquadEgo = SquadSinner['egos'][number];

/**
 * 필터 축의 표시 이름과 아이콘.
 *
 * **이름을 우리가 짓지 않는다**(00-product 3절 · ADR-03). 키워드 10종(상태 7 + 공격 타입 3)과
 * 죄악 7종은 게임이 표기를 갖고 있어 `keyword` · `sin_info` 로케일 행에서 온다.
 *
 * 상태 기믹 둘은 그 표에 없다 — 게임의 키워드 분류가 아니라 우리가 세운 축이기 때문이다
 * (`backlog/04-status-mechanics.md`). 대신 같은 이름의 상태 행이 실재하므로 거기서 가져온다
 * (`Bullet` 탄환 · `Protection` 보호). 어느 쪽에도 없으면 **축 id 를 그대로 노출한다.**
 *
 * **아이콘 경로도 여기서 푼다.** `lib/assets.ts` 는 파일 시스템 인덱스라 서버 전용이고,
 * 편성 화면의 칸·모달·프로필은 클라이언트 컴포넌트다. 경로 해석을 한 모듈에 모은다는 제약
 * (ADR-05 6절 제약 2)이 곧 "화면이 직접 부르지 않는다"는 뜻이 된다 — 푼 값을 실어 보낸다.
 */
const MECHANIC_STATUS_ID: Record<string, StatusKey> = { Bullet: 'ammo', Protection: 'protection' };

/** 인격 등급 1–3. 게임 표기 0 / 00 / 000 이 그대로 파일명이다. */
const RARITIES = [1, 2, 3] as const;

export async function listSquadAxes(locale: Locale) {
	const [keywords, sins, mechanics] = await Promise.all([
		db.keyword.findMany({ orderBy: { order: 'asc' }, include: { texts: localeFilter(locale) } }),
		db.sinInfo.findMany({ orderBy: { order: 'asc' }, include: { texts: localeFilter(locale) } }),
		db.status.findMany({
			where: { id: { in: Object.keys(MECHANIC_STATUS_ID) } },
			include: { texts: localeFilter(locale) },
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
