/**
 * 테마 팩 카드 합성 데이터.
 *
 * 조사와 측정 기록은 `publish/PACK-ART.md` 에 있다. 여기 있는 값은 **손으로 정한 것이
 * 아니다** — 게임 애셋의 픽셀과 위키 완성 카드에서 재서 뽑았다.
 *
 * 애셋은 팩 하나에 두 장이다.
 *
 *   봉지  `{sprite}.webp`       380 x 690. 가운데가 빈 8각 창을 가진다
 *   보스  `{sprite}_boss.webp`  391 x 432. 프레임 없는 투명 그림. 실측 40 장
 *
 * 게임은 창에 보스를 채우고 하단 금색 괘선 사이 띠에 이름을 인쇄한다. 봉지만 내면
 * 그 둘이 비어 팩을 식별할 수 없다 — 지금 목록 화면이 그 상태다.
 *
 * **이름은 애셋이 아니다.** 테마팩 154 장 중 글자 애셋이 없다. 게임이 그려 넣는 것이고
 * 우리는 `pack_text` 에 이름을 갖고 있으므로 HTML 글자로 얹는다.
 *
 * **키를 팩 id 로 잡는다.** 프로토타입이 이름으로 잡은 것은 덤프가 링크를 파일명으로
 * 바꿔 id 가 마크업에 남지 않았기 때문이다(`PACK-ART.md` 3.1). 여기서는 그럴 이유가 없다.
 */

/**
 * 팩 이름 글자 색 48 종.
 *
 * 게임은 이름을 카드 팔레트에 맞춰 물들인다. 위키의 완성 카드 113 장을 우리 봉지 애셋과
 * 겹쳐 차분을 내고 인쇄된 글자 픽셀만 골라 뽑았다. 58 종은 기본값과 같게 나와 생략했고,
 * 7 종은 차분에 판 색이 남아 못 믿을 값이 나와 버렸다 — 틀린 색을 넣느니 기본값이 낫다.
 *
 * 기본값 크림(`#ebcaa2`)도 눈대중이 아니라 58 종에서 같게 나온 실측값이며 CSS 에 있다.
 */
export const PACK_NAME_COLOR: Record<string, string> = {
	'1003': '#5ce6ff',	// 카지노 푸어
	'1004': '#5ce6ff',	// 공장 자동화
	'1005': '#5ce6ff',	// 사랑할 수 없는
	'1006': '#f37a22',	// 못과 망치
	'1007': '#f37a22',	// 신앙과 침식
	'1008': '#f37a22',	// 마주하지 않는
	'1009': '#d8e9f4',	// 둥지, 공방, 기술
	'1010': '#d8e9f4',	// 낙화
	'1011': '#d8e9f4',	// 흘리는 것들
	'1012': '#d8e9f4',	// 변하지 않는
	'1013': '#27c0c4',	// 레이크 월드
	'1014': '#27c0c4',	// 기어오는 심연
	'1015': '#27c0c4',	// 악으로 규정되는
	'1016': '#7e57a8',	// 저택의 부산물
	'1017': '#7e57a8',	// 어느 세계
	'1018': '#7e57a8',	// 마음이 어긋나는
	'1019': '#7e57a8',	// 다시 열린 라만차랜드
	'1020': '#7e57a8',	// 끝나지 않는 행렬
	'1021': '#ffef23',	// 꿈이 끝나는
	'1022': '#5bffde',	// 사대 가문과 욕망
	'1023': '#5bffde',	// 바라볼 수밖에 없는
	'1102': '#caf027',	// 우.미.다
	'1103': '#ca9b79',	// 20번구의 기적
	'1104': '#5ce6ff',	// 육참골단
	'1105': '#e7b03b',	// 시간살인시간
	'1106': '#2c9af7',	// 워프특급 살인사건
	'1107': '#9378d9',	// 자색 정오의 시련
	'1108': '#5ec2bc',	// 1호선
	'1109': '#5ec2bc',	// 2호선
	'1110': '#5ec3bc',	// 3호선
	'1113': '#5ebfb9',	// 20번구의 기적 BokGak
	'1114': '#efc281',	// 탄환이 찍은 마침표
	'1115': '#704d2b',	// LCB 정기검진
	'1116': '#5ce6ff',	// 육참골단 BokGak
	'1117': '#625aff',	// 심야청소
	'1118': '#67c6b9',	// 5호선
	'1119': '#ee4893',	// 증오와 절망
	'1120': '#e7b03b',	// 시간살인시간 BokGak
	'1121': '#c92f32',	// 절차탁춘
	'1122': '#b1beff',	// 선의의 순례
	'1123': '#2c9af7',	// 워프특급 살인사건 BokGak
	'1124': '#eb9010',	// 호박색 어스름의 시련
	'1125': '#843214',	// LCB 정기검진 BokGak
	'1126': '#bebaf7',	// 타래 엮기
	'1127': '#625aff',	// 심야청소 BokGak
	'1128': '#dadce0',	// 경험기억
	'1503': '#fb6600',	// 3호선 - 종착역
	'1505': '#a4b3a2',	// 우.미.다 게.판
};

/**
 * 파일명 규칙으로 보스 그림을 찾을 수 없는 팩 7 종.
 *
 * 공격 타입 팩 6 종이 스프라이트를 범용 둘(`AttackType_normal` · `AttackType_effective`)로
 * 공유해서 `{sprite}_boss` 규칙이 통하지 않는다. 참격·관통·타격을 가리는 필드도 없다.
 * **추측하지 않고 위키의 카드 이미지와 로컬 애셋을 그림 단위로 맞춰 확정했다**
 * (`PACK-ART.md` 3.1 의 대조표).
 *
 * 1302 해방된 분노는 `Crimson_hard_boss` 가 상류에 아예 없다. 보스 그림은 팩 테마가
 * 아니라 **그 층의 보스**에 딸리며, 인게임 HARD 5 층에서 화왕지절(`Burn_hard`)과 나란히
 * 나와 같은 그림을 쓴다. 없는 파일을 지어내지 않고 같은 보스의 파일을 가리킨다.
 *
 * 이 표는 파이프라인이 스프라이트를 교정하거나 공격 타입을 필드로 담으면 사라진다.
 */
export const PACK_BOSS_SPRITE: Record<string, string> = {
	'1201': 'AttackTypeSlash_hard',		// 가르고 베는 이들 = Slicers & Dicers
	'1202': 'AttackTypeSlash_effective',	// 베어낼 것 = To be Cleaved
	'1203': 'AttackTypePierce_hard',		// 꿰고 뚫는 이들 = Piercers & Penetrators
	'1204': 'AttackTypePierce_effective',	// 꿰뚫을 것 = To be Pierced
	'1205': 'AttackTypeBlunt_hard',		// 부수고 깨뜨릴 이들 = Crushers & Breakers
	'1206': 'AttackTypeBlunt_effective',	// 바스라질 것 = To be Crushed
	'1302': 'Burn_hard',					// 해방된 분노 — 같은 층 보스의 파일
};

export type BossFit = { top: number; left: number; h: number };

/**
 * 보스 그림 맞춤. 값은 봉지 대비 %.
 *
 * **파일 상자가 아니라 그림 내용을 기준으로 앉힌다.** 보스 파일 40 개가 모두 391 x 432
 * 인데 그 안의 그림 위치가 파일마다 다르다. 고정 좌표로 놓으면 여백이 큰 파일이 창
 * 아래로 밀리고 옆으로 치우친다.
 *
 * 중심은 **알파 가중 무게중심**이다. 경계의 중점이 아니다 — 한쪽으로 뻗은 불꽃·꼬리가
 * 경계를 늘리는데 시각적 무게가 거의 없어 중점이 빈 쪽으로 끌린다(오차 최대 5.5%).
 *
 * 크기는 건드리지 않는다. 파일 본래 비율(432/690 = 62.6%)로 고정하고 치우침만 바로잡는다
 * — 게임도 고정 사각형에 그리고 내용 크기는 그대로 둔다.
 */
export const PACK_BOSS_FIT: Record<string, BossFit> = {
	'Amber_effective': { top: 14.42, left: -1.27, h: 62.61 },
	'Amber_hard': { top: 15.21, left: -1.37, h: 62.61 },
	'Amber_normal': { top: 17.41, left: -5.02, h: 62.61 },
	'AttackTypeBlunt_effective': { top: 14.61, left: 1.32, h: 62.61 },
	'AttackTypeBlunt_hard': { top: 13.49, left: -2.92, h: 62.61 },
	'AttackTypePierce_effective': { top: 14.25, left: 2.8, h: 62.61 },
	'AttackTypePierce_hard': { top: 17, left: -3.54, h: 62.61 },
	'AttackTypeSlash_effective': { top: 18.66, left: -2.97, h: 62.61 },
	'AttackTypeSlash_hard': { top: 15.37, left: 0.57, h: 62.61 },
	'Azure_effective': { top: 13.68, left: -3.7, h: 62.61 },
	'Azure_hard': { top: 14.17, left: -2.13, h: 62.61 },
	'Azure_normal': { top: 15.47, left: -0.23, h: 62.61 },
	'Bleed_hard': { top: 14.03, left: 1.47, h: 62.61 },
	'Bleed_normal': { top: 12.11, left: -0.29, h: 62.61 },
	'Burn_hard': { top: 13.85, left: 0.73, h: 62.61 },
	'Burn_normal': { top: 13.48, left: -1.18, h: 62.61 },
	'Charge_hard': { top: 17.47, left: -6.19, h: 62.61 },
	'Charge_normal': { top: 10.57, left: 1.16, h: 62.61 },
	'Crimson_effective': { top: 15.36, left: 0.1, h: 62.61 },
	'Crimson_normal': { top: 15.91, left: -4.38, h: 62.61 },
	'Indigo_effective': { top: 19.32, left: -1.97, h: 62.61 },
	'Indigo_hard': { top: 14.53, left: 1.49, h: 62.61 },
	'Indigo_normal': { top: 14.95, left: -1.5, h: 62.61 },
	'Poise_hard': { top: 14.37, left: -3.21, h: 62.61 },
	'Poise_normal': { top: 12.97, left: -0.18, h: 62.61 },
	'Rupture_hard': { top: 15.05, left: -1.22, h: 62.61 },
	'Rupture_normal': { top: 10.11, left: -0.59, h: 62.61 },
	'Scarlet_effective': { top: 16.16, left: -7.39, h: 62.61 },
	'Scarlet_hard': { top: 18.4, left: -2.28, h: 62.61 },
	'Scarlet_normal': { top: 18.52, left: 2.34, h: 62.61 },
	'Shamrock_effective': { top: 18.02, left: -1.26, h: 62.61 },
	'Shamrock_hard': { top: 17.25, left: -5.49, h: 62.61 },
	'Shamrock_normal': { top: 17.75, left: -2.46, h: 62.61 },
	'Sinking_hard': { top: 14.87, left: -0.1, h: 62.61 },
	'Sinking_normal': { top: 16.86, left: -0.34, h: 62.61 },
	'Tremor_hard': { top: 13.14, left: -1.4, h: 62.61 },
	'Tremor_normal': { top: 17.18, left: -5.41, h: 62.61 },
	'Violet_effective': { top: 11.61, left: -2.54, h: 62.61 },
	'Violet_hard': { top: 12.04, left: -5.47, h: 62.61 },
	'Violet_normal': { top: 14.23, left: -1.13, h: 62.61 },
};

/**
 * 극한 카드인가.
 *
 * 카드 형식이 둘이고 이름 띠 위치가 다르다 — 봉지는 380 x 690, 극한은 314 x 628 이다.
 * **파일명으로 가른다.** 350px 미만 폭인 애셋 20 개가 모두 `_Extreme` 로 끝나고 나머지
 * 94 개는 전부 380 폭이라는 것을 전수 측정으로 확인했다.
 *
 * `pack.extreme` 플래그로 가르면 안 된다 — 플래그는 24 종이고 그중 철도 4 종
 * (1110 · 1111 · 1112 · 1118)은 봉지 형식이다. 플래그는 난이도를 말하고 파일명은
 * 카드 형식을 말한다.
 */
export const isExtremeCard = (sprite: string): boolean => /_Extreme$/i.test(sprite);
