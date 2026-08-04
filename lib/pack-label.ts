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
 * `Walpu4_NoonOfViolet` 처럼 접두에 회차가 박혀 있다 — 실측 4 · 5 · 6 · 8 이다.
 * **필드가 아니라 파일명에서 유도한 값이다.** `pack_tag` 은 `Walpurgisnacht` 까지만
 * 말하고 회차를 담지 않는다. 규칙이 깨지면 회차 없이 이름만 낸다.
 */
const WALPURGIS_ROUND = /^Walpu(\d+)_/;

export type PackKindInput = {
	category: string;
	chapter: string | null;
	sprite: string;
	/** 캐노니컬 `pack_tag` 의 `Collab`. 실측 1 건이다. */
	collab: boolean;
};

export function packKind(pack: PackKindInput, locale: Locale): string {
	const ko = locale === 'ko';

	if (pack.collab) return ko ? '콜라보 한정' : 'Collab only';
	if (GENERIC.has(pack.category)) return ko ? '범용' : 'Generic';

	if (pack.category === 'canto' && pack.chapter) {
		return ko ? `${pack.chapter}장` : `Canto ${pack.chapter}`;
	}

	if (pack.category === 'walpurgis') {
		const round = WALPURGIS_ROUND.exec(pack.sprite)?.[1];
		if (!round) return ko ? '발푸르기스의 밤' : 'Walpurgis Night';
		return ko ? `${round}회 발푸르기스` : `Walpurgis Night ${round}`;
	}

	return OTHER[locale][pack.category] ?? pack.category;
}

/** 위 넷에 들지 않는 것. 분류 이름을 그대로 쓴다. */
const OTHER: Record<Locale, Record<string, string>> = {
	ko: { railway: '거울굴절철도', extreme: '극한', event: '이벤트' },
	en: { railway: 'Refraction Railway', extreme: 'Extreme', event: 'Event' },
};
