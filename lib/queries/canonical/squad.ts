import type { Locale } from '@/lib/locale';
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
 * **축은 캐노니컬이 판정한 것을 읽는다.** 현행은 `lib/engine/vocab` 의 정규식 10개로
 * 상태 id 1,472종을 접었는데, 그 접기가 이미 데이터로 있다 —
 * `identity_axis` 628행이며 적재기가 축 어휘로 판정한 결과다. 검사 203건이 지킨다.
 *
 * **어휘는 `keyword.id` 로 통일한다** — `Combustion` 이지 `COMBUSTION` 도 `burn` 도
 * 아니다. 레거시는 `poise` · `tremor` 를 냈는데 `listSquadAxes` 의 라벨 표는
 * `Breath` · `Vibration` 로 키를 잡고 있어 **화면에서 라벨이 하나도 안 풀리고 있었다.**
 * `canonical/list.ts` 가 이미 쓰는 어휘이며 여기를 맞추면 그 결함이 함께 닫힌다.
 */

/**
 * 기믹 축. **키워드와 갈라 담는다** — 기프트를 나누는 분류가 아니라 인격이
 * 공급하는 자원이다(backlog/04 3·4절).
 *
 * **`canonical.axis` 가 아니라 상태에서 읽는다.** 축 표에는 `BULLET` 만 있고
 * `PROTECTION` 이 없다 — 게임이 보호를 축으로 묶지 않았기 때문이다. `list.ts` 의
 * `MECHANICS` 와 같은 둘이고 같은 경로다. 실측 탄환 13 · 보호 15.
 */
const MECHANICS = ['Bullet', 'Protection'];

/**
 * 축 id → 키워드 id. 다리 표가 따로 없고 필요도 없다 — 축 id 는 키워드 id 의
 * 대문자다(`Combustion` → `COMBUSTION`). 짝이 없는 것은 `BULLET` 하나이며
 * 그쪽은 기믹이라 키워드로 안 낸다.
 */
function keywordByAxis(keywordIds: string[]): Map<string, string> {
	return new Map(keywordIds.map((id) => [id.toUpperCase(), id]));
}

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
	const keywordIds = (await canonical.keyword.findMany({ select: { id: true } })).map((k) => k.id);
	const axisToKeyword = keywordByAxis(keywordIds);

	const sinners = await canonical.sinner.findMany({
		orderBy: { id: 'asc' },
		include: {
			texts: localeRows(locale),
			identities: {
				orderBy: [{ star: 'desc' }, { id: 'asc' }],
				include: {
					texts: localeRows(locale),
					/**
					 * **`ego_granted` 는 뺀다.** 그 62행은 수감자의 E.G.O 가 주는 축이지
					 * 인격이 주는 축이 아니다 — 인격 카드에 실으면 없는 공급을 있다고
					 * 말하게 된다. 남는 둘(`keyword` 266 · `special_status` 300)이
					 * 레거시 `statusKeyOf` 가 세던 것과 같은 집합이다.
					 */
					axes: { where: { source: { not: 'ego_granted' } }, select: { axisId: true } },
					// 기믹은 축 표에 `PROTECTION` 이 없어 상태에서 직접 읽는다
					statuses: { where: { statusId: { in: MECHANICS } }, select: { statusId: true } },
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
					/**
					 * **E.G.O 에는 `identity_axis` 같은 굳혀진 표가 없다.** 인격만 있다.
					 * `ego_status` 에서 키워드·기믹 어휘와 겹치는 것만 추린다 —
					 * `list.ts` 의 `listEgosFull` 과 같은 경로이며 실측 92 가 키워드를
					 * 하나 이상 갖는다(18 은 부재이지 결손이 아니다).
					 *
					 * **기믹을 키워드와 같은 칸에 담는다.** 인격과 다른 처사인데, E.G.O 는
					 * 자원을 공급하는 쪽이 아니라 쓰는 쪽이라 갈라 담을 이유가 없다.
					 * 레거시도 한 칸이었고 화면도 한 줄로 그린다.
					 */
					statuses: {
						where: { statusId: { in: [...keywordIds, ...MECHANICS] } },
						select: { statusId: true },
					},
				},
			},
		},
	});

	return sinners.map((s) => ({
		id: s.id,
		icon: sinnerIcon(s.id),
		text: nameOf(s.texts, locale),
		identities: s.identities.map((i) => {
			// 적재기가 판정한 축을 읽고 키워드 어휘로 되돌린다. 짝이 없는 `BULLET` 은
			// 기믹이라 여기서 떨어져 나가고 아래 `mechanics` 가 상태에서 따로 집는다
			const keywords = [
				...new Set(
					i.axes
						.map((a) => axisToKeyword.get(a.axisId))
						.filter((v): v is string => v !== undefined),
				),
			].sort();
			return {
				id: Number(i.id),
				rarity: i.star,
				season: i.season,
				image: identityImage(Number(i.id), 'profile'),
				text: identityName(i.texts, locale),
				keywords,
				// 키워드와 섞지 않는다. 기프트를 나누는 분류가 아니라 인격이 공급하는 자원이다.
				mechanics: [...new Set(i.statuses.map((s) => s.statusId))].sort(),
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

			return [{
				id: Number(e.id),
				rank: e.rank,
				image: egoImage(Number(e.id), 'awaken'),
				text: nameOf(e.texts, locale),
				awakenAffinity: e.sin,
				awakenAtkType: e.attackType,
				keywords: [...new Set(e.statuses.map((s) => s.statusId))].sort(),
				// 죄악 자원 소모는 E.G.O 기능의 핵심이다(02-data-model 3.4).
				costs: e.costs.map((c) => ({ sin: c.sin, amount: c.count })),
			}];
		}),
	}));
}

export type SquadSinner = Awaited<ReturnType<typeof listSquad>>[number];
export type SquadIdentity = SquadSinner['identities'][number];
export type SquadEgo = SquadSinner['egos'][number];

/** 인격 등급 1–3. 게임 표기 0 / 00 / 000 이 그대로 파일명이다. */
const RARITIES = [1, 2, 3] as const;

export async function listSquadAxes(locale: Locale) {
	const [keywords, sins, mechanics] = await Promise.all([
		canonical.keyword.findMany({ orderBy: { order: 'asc' }, include: { texts: localeRows(locale) } }),
		canonical.sinInfo.findMany({ orderBy: { order: 'asc' }, include: { texts: localeRows(locale) } }),
		canonical.status.findMany({
			where: { id: { in: MECHANICS } },
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
	// 기믹은 상태 id 를 그대로 열쇠로 쓴다 — `listSquad` 가 내는 값과 같아야 풀린다
	for (const m of mechanics) {
		const name = nameOf(m.texts, locale)?.name;
		if (name) labels[m.id] = name;
		// 탄환·보호는 공용 아이콘 목록에 없다. 없는 것이 정상이라 화면이 글자로 낸다.
		icons[m.id] = uiIcon(m.id);
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
