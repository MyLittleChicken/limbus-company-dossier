import type { Locale } from '@/lib/locale';
import { canonical } from '@/lib/db-canonical';
import { egoImage, identityImage, sinnerIcon } from '@/lib/assets';

/**
 * 목록 화면이 쓰는 캐노니컬 질의.
 *
 * **현행 `lib/queries/{identities,egos}.ts` 와 다른 층을 읽는다.** 캐노니컬이 시즌과
 * 출시일을 갖고 있어서다 — 현행 스키마도 시즌은 있으나 E.G.O 목록이 그것을 내려주지
 * 않았고, 출시일은 두 목록 다 없었다. 정렬 기준이 「등급 → 출시일」이므로 없으면 못 짠다.
 *
 * 로케일 행 고르기는 현행과 같은 규칙이다(ADR-03 5절) — 요청한 것이 없으면 영어로
 * 물러서고, **폴백이 일어난 사실을 화면이 표기할 수 있게** 함께 돌려준다.
 */

/**
 * 특수 축. 게임이 상태로 붙이는 둘이다.
 *
 * `IdentityUnitKeyword` 가 아니다 — 그쪽은 `BASE_APPEARANCE` · `SMALL` 처럼 겉모습을
 * 가리는 다른 축이다. 실측으로 탄환 13 · 보호 15 다.
 *
 * **이 값은 데이터층에 있어야 한다** — 축 정의가 담기면 이 상수는 사라진다.
 * `docs/backlog/13-frontend-data-debt.md` 7 번.
 */
const MECHANICS = ['Bullet', 'Protection'];

const localeRows = (locale: Locale) => ({
	where: { locale: { in: [locale, 'en'] as Locale[] } },
});

type TextRow = { locale: string; name: string };

function nameOf(rows: TextRow[], locale: Locale) {
	const exact = rows.find((r) => r.locale === locale);
	if (exact) return { name: clean(exact.name), fellBack: false };
	const en = rows.find((r) => r.locale === 'en');
	return en ? { name: clean(en.name), fellBack: true } : null;
}

/**
 * 인격 이름은 `title` 이다.
 *
 * `identity_text.name` 은 **수감자 이름**이고(10101 → 「이상」) 인격 이름은 `title` 에 있다
 * (「LCB 수감자」). 처음에 `name` 을 썼더니 한 수감자의 카드가 전부 같은 이름이 됐다.
 *
 * 게임이 두 줄로 흘려 쓰는 이름이 있어 `title` 에 줄바꿈이 들어 있다 — 한 줄로 편다.
 */
function identityName(rows: { locale: string; name: string; title: string | null }[], locale: Locale) {
	const pick = rows.find((r) => r.locale === locale) ?? rows.find((r) => r.locale === 'en');
	if (!pick) return null;
	return { name: clean(pick.title ?? pick.name), fellBack: pick.locale !== locale };
}

const clean = (s: string) => s.replace(/\s+/g, ' ').trim();

/** 수감자 12. 섹션 머리와 필터 축이 같은 목록을 쓴다. */
export async function listSinners(locale: Locale) {
	const rows = await canonical.sinner.findMany({
		orderBy: { id: 'asc' },
		include: { texts: localeRows(locale) },
	});
	return rows.map((s) => ({ id: s.id, icon: sinnerIcon(s.id), text: nameOf(s.texts, locale) }));
}

/**
 * 인격 전체.
 *
 * **거르지 않고 전부 내려보낸다.** 축이 여섯이고 그중 셋(속성 · 키워드 · 특수)이 관계
 * 테이블이라, 조건이 바뀔 때마다 다시 질의하면 왕복이 잦다. 184 장이면 한 번에 받아
 * 브라우저에서 거르는 편이 싸다 — 목록이 커지면 그때 서버로 되돌린다.
 */
export async function listIdentitiesFull(locale: Locale) {
	const rows = await canonical.identity.findMany({
		orderBy: [{ sinnerId: 'asc' }, { id: 'asc' }],
		include: {
			texts: localeRows(locale),
			skills: { include: { skill: { select: { sin: true, attackType: true } } } },
			keywords: { select: { keywordId: true } },
			associations: { select: { associationId: true } },
			// 특수는 상태로 붙는다. `unitKeyword` 는 BASE_APPEARANCE · SMALL 같은 다른 축이다.
			statuses: { where: { statusId: { in: MECHANICS } }, select: { statusId: true } },
		},
	});

	return rows.map((i) => ({
		id: i.id,
		sinnerId: i.sinnerId,
		star: i.star,
		season: i.season,
		released: i.releaseDate,
		image: identityImage(Number(i.id), 'profile'),
		text: identityName(i.texts, locale),
		// 스킬의 죄악으로 거른다. 죄악이 없는 스킬이 있어 `null` 은 담지 않는다.
		sins: [...new Set(i.skills.map((s) => s.skill.sin).filter(Boolean))] as string[],
		keywords: [...new Set(i.keywords.map((k) => k.keywordId))],
		mechanics: [...new Set(i.statuses.map((s) => s.statusId))],
		associations: [...new Set(i.associations.map((a) => a.associationId))],
	}));
}

/**
 * E.G.O 전체.
 *
 * **컷신 전용 다섯을 뺀다.** `presentationOnly` 는 loc 에만 있고 플레이할 수 없는 것들이라
 * 목록에 두면 고를 수 없는 카드가 섞인다. 캐노니컬 115 에서 그것을 빼면 110 이며 현행
 * 화면이 내던 수와 같다.
 *
 * **키워드는 인격과 다른 데서 온다.** 인격은 `identity_keyword` 라는 전용 표를 갖지만
 * E.G.O 에는 그런 표가 없어 `ego_status` 에서 기믹 어휘 12 개와 겹치는 것만 추린다.
 * 두 방식이 같지는 않다 — 인격으로 대조하면 상태에서 뽑은 쪽이 21 건 많고 3 건 적다.
 * 같은 축 이름을 쓰되 **유래가 다르다는 사실을 여기 적어 둔다.**
 *
 * 실측으로 7 종이 걸린다(침잠 24 · 화상 24 · 진동 23 · 출혈 23 · 파열 22 · 충전 15 ·
 * 호흡 13). 110 중 92 가 하나 이상을 갖고 **18 은 하나도 없다** — 결손이 아니라 부재다.
 */
export async function listEgosFull(locale: Locale) {
	const keywordIds = (await canonical.keyword.findMany({ select: { id: true } })).map((k) => k.id);

	const rows = await canonical.ego.findMany({
		where: { presentationOnly: false },
		orderBy: [{ sinnerId: 'asc' }, { id: 'asc' }],
		include: {
			texts: localeRows(locale),
			// 기믹 키워드는 상태에서 읽는다 — 아래 주석 참고.
			statuses: { where: { statusId: { in: keywordIds } }, select: { statusId: true } },
		},
	});

	return rows.map((e) => ({
		id: e.id,
		sinnerId: e.sinnerId,
		rank: e.rank,
		sin: e.sin,
		attackType: e.attackType,
		season: e.season,
		released: e.releaseDate,
		image: egoImage(Number(e.id), 'awaken'),
		text: nameOf(e.texts, locale),
		// E.G.O 의 죄악은 각성 죄악 하나다. 인격처럼 스킬마다 갈리지 않는다.
		sins: e.sin ? [e.sin] : [],
		keywords: [...new Set(e.statuses.map((s) => s.statusId))],
	}));
}

/**
 * 필터 축에 쓰는 이름표. 키워드와 소속은 이름이 데이터에 있다.
 *
 * **키워드 아이콘은 id 로 찾지 못한다.** 파일명이 영문 표시명이라 `Combustion` 이 아니라
 * `Burn.webp` 이고, `Laceration` → `Bleed` · `Burst` → `Rupture` · `Vibration` → `Tremor` ·
 * `Breath` → `Poise` 로 갈린다. 표를 새로 만들지 않고 **데이터가 이미 가진 `en` 이름을
 * 그대로 파일명 열쇠로 준다** — 쓰이는 7 종 모두 이 규칙으로 찾힌다.
 *
 * **이 규칙은 데이터층에 있어야 한다** — 애셋 키가 필드로 있으면 필요 없다.
 * `docs/backlog/13-frontend-data-debt.md` 6 번.
 *
 * 특수 둘은 이름도 그림도 상태 표에 있다. `sprite` 가 곧 파일명이며 탄환은 `Ammo` 로
 * 갈린다 — 여기서도 짝을 새로 만들지 않고 데이터가 가진 값을 그대로 쓴다.
 */
export async function listAxisLabels(locale: Locale) {
	const [keywords, associations, mechanics] = await Promise.all([
		canonical.keyword.findMany({ include: { texts: localeRows(locale) } }),
		canonical.association.findMany({ include: { texts: localeRows(locale) } }),
		canonical.status.findMany({
			where: { id: { in: MECHANICS } },
			include: { texts: localeRows(locale) },
		}),
	]);
	return {
		mechanics: MECHANICS.map((id) => mechanics.find((m) => m.id === id))
			.filter((m) => m !== undefined)
			.map((m) => ({ id: m.id, text: nameOf(m.texts, locale), sprite: m.sprite })),
		keywords: keywords.map((k) => ({
			id: k.id,
			text: nameOf(k.texts, locale),
			iconKey: k.texts.find((t) => t.locale === 'en')?.name ?? k.id,
		})),
		associations: associations
			.map((a) => ({ id: a.id, text: nameOf(a.texts, locale) }))
			.sort((x, y) => (x.text?.name ?? '').localeCompare(y.text?.name ?? '')),
	};
}
