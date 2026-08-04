import type { Locale } from '@prisma/client';

/**
 * 목록 카드가 다는 팩 종류표.
 *
 * 분류를 그대로 내는 대신 **언제 고를 수 있는 팩인가**로 묶는다. 공격 속성·죄악 속성·
 * 키워드는 성격이 다르지만 셋 다 상시 등장하는 범용 팩이라 카드에서는 「범용」 하나로
 * 족하다 — 무엇에 대한 범용인지는 그림과 이름이 이미 말한다.
 *
 * **필터 칩은 세 축을 그대로 남긴다.** 「범용」 칩이 셋 나란히 있으면 고를 수 없다.
 *
 * 근거는 데이터에 있다. 캐노니컬 `pack.unlock_code` 를 보면 장 팩의 해금 코드가
 * `10N` 이고 그 `N` 이 `chapter` 와 정확히 맞아떨어진다(1~9, 불일치 0). 범용 팩도
 * 같은 대역이며 27 종이 `102`(장 2) · 14 종이 `105`(장 5)다. 거울굴절철도도 이 대역이다 —
 * 1 호선 `103` · 2 호선 `104` · 3 호선 `105` · 4 호선 `106` · 5 호선 `107` 이다.
 * `91xx` 대역은 이벤트 순번이며 발푸르기스도 그 안에 섞여 있다.
 */

/** 상시 등장하는 범용 팩 셋. 성격은 다르지만 고르는 조건이 같다. */
const GENERIC = new Set(['attack_type', 'sin', 'keyword']);

/**
 * 발푸르기스 회차는 스프라이트에서만 나온다.
 *
 * `Walpu4_NoonOfViolet` 처럼 접두에 회차가 박혀 있다. **필드가 아니라 파일명에서 유도한
 * 값이다** — `pack_tag` 은 `Walpurgisnacht` 까지만 말하고 회차를 담지 않는다.
 *
 * **분류보다 스프라이트를 믿는다.** 2 회와 3 회 팩이 `walpurgis` 가 아니라 `extreme` 로
 * 분류돼 있다(`Walpu2_Extreme` 녹빛 여명의 시련 · `Walpu3_Extreme` 어느 도서관의 어떤 책
 * 속으로). 극한 형식으로 나온 발푸르기스 팩이며 태그도 `Extreme` 하나뿐이라, 분류만 보면
 * 어느 회차 것인지 알 수 없다. 그래서 회차 판정을 분류보다 앞에 둔다.
 *
 * 실측 2 · 3 · 4 · 5 · 6 · 8 회다. **빠진 1 · 7 · 9 회는 결손이 아니다** — 그 세 회차는
 * 한정 던전 자체가 없었다. 나무위키의 회차표와 대조해 여섯 이름이 전부 일치하고 없는
 * 셋도 「던전 없음」으로 맞는 것을 확인했다(2026-08-04).
 *
 *   1 회 (2023-10)  던전 없음
 *   2 회 (2024-01)  녹빛 여명의 시련            Walpu2_Extreme
 *   3 회 (2024-05)  어느 도서관의 어떤 책 속으로  Walpu3_Extreme
 *   4 회 (2024-09)  자색 정오의 시련            Walpu4_NoonOfViolet
 *   5 회 (2025-01)  탄환이 찍은 마침표          Walpu5_ChurchOfGears
 *   6 회 (2025-07)  증오와 절망                Walpu6_MagicalGirl
 *   7 회 (2025-11)  던전 없음
 *   8 회 (2026-03)  호박색 어스름의 시련        Walpu8_Amber
 *   9 회 (2026-07)  던전 없음
 */
const WALPURGIS_ROUND = /^Walpu(\d+)[_.]/;

/** 숨겨진 팩. 캐노니컬 분류 경로가 `Hidden` 이며 실측 1 건(3001 뽕.황)이다. */
const HIDDEN_SPRITE = 'HiddenTheme';

export type PackKindInput = {
	category: string;
	chapter: string | null;
	sprite: string;
	/** 캐노니컬 `pack_tag` 의 `Collab`. 실측 1 건이다. */
	collab: boolean;
};

/**
 * 종류의 차례.
 *
 * **언제 열리는가로 늘어놓는다** — 늘 고를 수 있는 것이 먼저고 한정이 뒤다. 알파벳
 * 분류 순서(`attack_type` · `canto` · `event` · `extreme` · `keyword` · `railway` ·
 * `sin` · `walpurgis`)로 두었더니 범용 41 종이 세 덩이로 흩어져 목록 앞·중간·뒤에
 * 따로 나왔다. 읽는 사람에게는 아무 뜻이 없는 차례다.
 */
export const KIND_ORDER = [
	'generic',
	'canto',
	'railway',
	'extreme',
	'event',
	'walpurgis',
	'collab',
	'hidden',
] as const;

export type PackKindKey = (typeof KIND_ORDER)[number];

/**
 * 필터 축에 쓰는 종류 이름.
 *
 * 카드는 「3장」·「2회 발푸르기스」처럼 낱낱을 말하지만 축은 묶음까지만 말한다 —
 * 장 아홉과 회차 여섯을 칩으로 펴면 축이 스물을 넘는다.
 */
export const PACK_KIND_LABEL: Record<Locale, Record<PackKindKey, string>> = {
	ko: {
		generic: '범용',
		canto: '장',
		railway: '거울굴절철도',
		extreme: '극한',
		event: '이벤트',
		walpurgis: '발푸르기스의 밤',
		collab: '콜라보',
		hidden: '히든',
	},
	en: {
		generic: 'Generic',
		canto: 'Canto',
		railway: 'Refraction Railway',
		extreme: 'Extreme',
		event: 'Event',
		walpurgis: 'Walpurgis Night',
		collab: 'Collab',
		hidden: 'Hidden',
	},
};

export type PackKind = {
	key: PackKindKey;
	/** 장·회차처럼 같은 종류 안에서 갈리는 수. 없으면 0 이다. */
	step: number;
	label: string;
};

export function packKind(pack: PackKindInput, locale: Locale): PackKind {
	const ko = locale === 'ko';
	const kind = (key: PackKindKey, label: string, step = 0): PackKind => ({ key, step, label });

	if (pack.collab) return kind('collab', ko ? '콜라보 한정' : 'Collab only');
	if (pack.sprite === HIDDEN_SPRITE) return kind('hidden', ko ? '히든' : 'Hidden');

	// 분류보다 앞에 둔다 — 2 · 3 회가 `extreme` 로 분류돼 있다(위 주석).
	const round = WALPURGIS_ROUND.exec(pack.sprite)?.[1];
	if (round) {
		const n = Number(round);
		return kind('walpurgis', ko ? `${n}회 발푸르기스` : `Walpurgis Night ${n}`, n);
	}
	if (pack.category === 'walpurgis') {
		return kind('walpurgis', ko ? '발푸르기스의 밤' : 'Walpurgis Night');
	}

	if (GENERIC.has(pack.category)) return kind('generic', ko ? '범용' : 'Generic');

	if (pack.category === 'canto' && pack.chapter) {
		const n = Number(pack.chapter);
		return kind('canto', ko ? `${pack.chapter}장` : `Canto ${pack.chapter}`, n);
	}

	const key: PackKindKey =
		pack.category === 'railway' ? 'railway' : pack.category === 'event' ? 'event' : 'extreme';
	return kind(key, OTHER[locale][pack.category] ?? pack.category);
}

/**
 * 목록 차례.
 *
 * 종류 → 장·회차 → id 다. id 는 팩이 나온 순서를 담고 있어 같은 종류 안에서 기준이 된다.
 */
export function comparePackKind(a: PackKind, b: PackKind, aId: string, bId: string): number {
	return (
		KIND_ORDER.indexOf(a.key) - KIND_ORDER.indexOf(b.key) ||
		a.step - b.step ||
		aId.localeCompare(bId)
	);
}

/** 위에 들지 않는 것. 분류 이름을 그대로 쓴다. */
const OTHER: Record<Locale, Record<string, string>> = {
	ko: { railway: '거울굴절철도', extreme: '극한', event: '이벤트' },
	en: { railway: 'Refraction Railway', extreme: 'Extreme', event: 'Event' },
};
