import type { Locale } from '@prisma/client';

/**
 * 화면 껍데기의 문자열.
 *
 * 게임 데이터의 표시 문자열은 데이터베이스의 로케일 행에서 온다(ADR-03). 여기 있는 것은
 * 내비게이션·라벨처럼 **우리가 쓴 문구**이며 데이터가 아니다. 둘을 한 곳에 섞지 않는다.
 *
 * 엔티티 이름은 게임 내 표기를 그대로 쓴다(00-product 3절) — 자체 용어를 만들지 않는다.
 */
export interface UiText {
	appName: string;
	appSub: string;
	nav: {
		gifts: string;
		packs: string;
		identities: string;
		squad: string;
		recommend: string;
		egos: string;
		floors: string;
		dungeon: string;
		glossary: string;
		about: string;
	};
	search: string;
	empty: string;
	/** 한국어가 없어 영문을 노출한 항목에 붙이는 표기 (ADR-03 5절) */
	fallbackNotice: string;
	sourceNotice: string;
}

export const UI: Record<Locale, UiText> = {
	ko: {
		appName: 'Mirror Tracker',
		appSub: '거울 던전 정보·추천',
		nav: {
			gifts: 'E.G.O 기프트',
			packs: '테마 팩',
			identities: '인격',
			squad: '편성',
			recommend: '추천',
			egos: 'E.G.O',
			floors: '층별 등장 팩',
			dungeon: '거울 던전',
			glossary: '용어',
			about: '고지',
		},
		search: '이름·설명 검색',
		empty: '조건에 맞는 항목이 없습니다',
		fallbackNotice: '한국어 표기가 원본에 없어 영문을 노출합니다',
		sourceNotice: '비공식 팬 프로젝트이며 Project Moon과 제휴·승인 관계가 없습니다',
	},
	en: {
		appName: 'Mirror Tracker',
		appSub: 'Mirror Dungeon reference',
		nav: {
			gifts: 'E.G.O Gifts',
			packs: 'Theme Packs',
			identities: 'Identities',
			squad: 'Squad',
			recommend: 'Recommend',
			egos: 'E.G.O',
			floors: 'Floor Packs',
			dungeon: 'Mirror Dungeon',
			glossary: 'Glossary',
			about: 'About',
		},
		search: 'Search name and description',
		empty: 'No matching entries',
		fallbackNotice: 'Shown in English — no Korean text in the source',
		sourceNotice: 'Unofficial fan project. Not affiliated with Project Moon.',
	},
};

/**
 * 내비게이션 순서. 엔티티 4종을 앞에 두고 부속 화면을 뒤에 둔다.
 *
 * 인격과 E.G.O 를 맨 앞에 둔다 — 가장 자주 찾는 것이 그 둘이고, 기프트·팩은
 * 거울 던전 안에서 고르는 것이라 한 단 뒤에 온다.
 */
export const NAV_PRIMARY = ['identities', 'egos', 'gifts', 'packs'] as const;
export const NAV_SECONDARY = ['squad', 'recommend', 'floors', 'dungeon', 'glossary'] as const;

/**
 * 테마 팩 분류 8 종.
 *
 * 데이터는 `attack_type` · `canto` 같은 내부 값을 그대로 갖고 있고 화면이 그것을 내보내고
 * 있었다. **표기를 새로 만들지 않고** 게임이 쓰는 말로 옮긴다.
 *
 * 각 분류가 무엇인지는 데이터로 확인했다.
 *
 *   attack_type  6   참격·관통·타격 셋을 각각 두 단계로. 속성 범용 팩이다
 *   sin         21   죄악 7 × 세 단계. 같은 성격의 범용 팩
 *   keyword     14   출혈·침잠 등 기믹 7 × 두 단계. 역시 범용
 *   canto       27   `chapter` 1~9 를 갖는다. 장별 팩이며 sprite 도 `Canto_I`~`Canto_IX` 다
 *   walpurgis    4   sprite 가 회차를 담는다 — `Walpu4` · `Walpu5` · `Walpu6` · `Walpu8`
 *   railway      6   1~5 호선. 4 호선만 구간이 둘이다
 *   event       18   기간 한정. 명일방주 콜라보 「선의의 순례」가 여기 있다
 *   extreme     21   20 종이 하드 11~15 층 전용이다
 *
 * **이 값은 데이터층에 있어야 한다**(`docs/backlog/13-frontend-data-debt.md`).
 * 분류 이름표가 데이터에 담기면
 * 이 표는 사라진다.
 *
 * **접근 조건은 데이터에 없다.** 장 클리어 여부나 이벤트 참여 이력 같은 것은 어느 출처도
 * 담고 있지 않으므로 화면이 말하지 않는다.
 */
export const PACK_CATEGORY: Record<Locale, Record<string, string>> = {
	ko: {
		attack_type: '공격 속성',
		sin: '죄악 속성',
		keyword: '키워드',
		canto: '장',
		walpurgis: '발푸르기스의 밤',
		railway: '거울굴절철도',
		event: '이벤트',
		extreme: '극한',
	},
	en: {
		attack_type: 'Attack type',
		sin: 'Sin',
		keyword: 'Keyword',
		canto: 'Canto',
		walpurgis: 'Walpurgis Night',
		railway: 'Mirror Refraction Railway',
		event: 'Event',
		extreme: 'Extreme',
	},
};

/** 층 난이도. 데이터가 `normal` · `hard` 로 갖고 있다. */
export const PACK_DIFFICULTY: Record<Locale, Record<string, string>> = {
	ko: { normal: '일반', hard: '하드' },
	en: { normal: 'Normal', hard: 'Hard' },
};
