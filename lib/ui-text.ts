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

/** 내비게이션 순서. 엔티티 4종을 앞에 두고 부속 화면을 뒤에 둔다. */
export const NAV_PRIMARY = ['gifts', 'packs', 'identities', 'egos'] as const;
export const NAV_SECONDARY = ['floors', 'dungeon', 'glossary'] as const;
