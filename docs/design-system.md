# 디자인 시스템 — 구현 기준

상태: **ops 문서 검수 완료(제품 QA 별도)**. 2026-09-08 구현을 문서화한다. ops가 106개 토큰·링크·주요 CSS 및 컴포넌트 계약 대조와 문서 범위를 승인했다. 새 시각 언어를 제안하거나 제품 UI를 변경하지 않는다.

기준: `app/tokens.css`, `app/globals.css`, `components/unit-list.tsx`, `components/identity-sheet.tsx`, `components/ego-sheet.tsx`, `components/sheet-parts.tsx`, `components/ui.tsx`, ko/en 목록·상세 페이지.

## 목차

1. 적용 범위와 브랜드·정보 위계
2. 색·폰트·치수 토큰
3. 셸·그리드·반응형
4. 목록 카드·필터·정렬·탭
5. 상세 서류·수치·스킬·패시브
6. 패널·표·태그·버튼·상태
7. 이미지·아이콘·게임 데이터 표시
8. ko/en 문구·폴백·접근성
9. 새 페이지 작성 예시와 컴포넌트 매핑
10. 미통일 예외와 후속 개선
11. 구현 대조 체크리스트

인격·EGO 목록/상세와 기프트 목록이 현행 시각 기준이다. **기프트 상세는 구판**으로, 패널·합성·결손 처리의 참고이지 신규 상세의 시각 표준이 아니다. 종합 정보 도감에서 인격·EGO·기프트·팩은 동등한 핵심이며 이 문서의 조사 표본이 제품 우선순위를 바꾸지 않는다.

## 1. 적용 범위와 브랜드·정보 위계

**문서의 역할은 같은 화면을 다시 만들 수 있게 하는 것**이다. 아래의 ‘현행’은 코드에서 확인한 구현이고, ‘개선’은 아직 적용되지 않은 제안이다. CSS 주석의 계획·과거 실측은 현재 실행값과 다를 수 있다. 숫자는 데이터 규모가 아닌 레이아웃 값만 표준으로 사용한다.

| 기준 화면 | ko/en 라우트 템플릿 | 실행 컴포넌트 | 참고 수준 |
|---|---|---|---|
| 인격 목록 | `app/[locale]/identities/page.tsx` | `UnitList`, `SecLabel` | 목록 표준 |
| E.G.O 목록 | `app/[locale]/egos/page.tsx` | 같은 `UnitList` | 같은 시각 언어, 다른 필터/등급 |
| 기프트 목록 | `app/[locale]/gifts/page.tsx` | `UnitList variant="icon"` | 사물 이미지 목록 표준 |
| 인격 상세 | `app/[locale]/identities/[id]/page.tsx` | `IdentitySheetView` | 상세 서류형 표준 |
| E.G.O 상세 | `app/[locale]/egos/[id]/page.tsx` | `EgoSheetView` | 상세 표준의 도메인별 변형 |
| 기프트 상세 | `app/[locale]/gifts/[id]/page.tsx` | `Panel`, `Facts`, `Icon`, `Nothing` | **구판**, 강화·합성 정보 구성만 참고 |

브랜드는 웜 차콜 바탕의 **게임 자료 서류철**이다. 크림 제목, 얇은 이중선, 사진 모서리 홀더와 등록 번호가 정보의 소속과 순서를 만든다. 골드는 활성·선택과 주요 수치, 브릭레드는 경보·제한적 동작/체력 계열이다. 단일 다크 테마이며 둥근 범용 대시보드 카드로 바꾸지 않는다. 근거: [globals.css](../app/globals.css) 머리 주석 및 `.panel`, `.card`, `.f-card`, `.f-art`, `.f-file`.

목록은 **엔티티 제목 → 필터/적용 조건·결과 수 → 수감자/키워드 섹션 → 이름·그림·등급 → 시즌/공통·전용** 순서다. 상세는 **대상 이름 → 소속 또는 고유 속성 → 문서 번호·출시 → 단계 선택·핵심 수치 → 스킬·패시브·상태 설명** 순서다. `SecLabel`에 상세 이름을 중복하지 않고 종류와 ‘목록으로’를 둔다. 근거: `UnitList` JSX, 두 상세 `page.tsx`, `.f-head`, `.f-title`, `.f-affil`, `.f-file`.

기존 브랜드 표기는 `UI.appName='Mirror Tracker'`, ko 부제는 ‘거울 던전 정보·추천’, en은 ‘Mirror Dungeon reference’다. 이는 [ui-text.ts](../lib/ui-text.ts)의 **현행 문구**이며 종합 도감 방향에 맞춘 리브랜딩 승인으로 해석하지 않는다.

## 2. 색·폰트·치수 토큰

정본은 [tokens.css](../app/tokens.css) `:root`, 전수값은 [106개 토큰 참조](design-system/tokens.md)에 있다. 새 CSS는 역할 토큰을 사용한다. 원자 `--lcb-*`, `--sin-*`, `--kw-*`를 새 컴포넌트마다 복사하지 않는다. 축 색은 기존 `[data-sin]`/`[data-kw]` 매핑의 `--axis-color`를 따른다. 속성 부여만으로 모든 요소에 자동 색칠되는 것은 아니다.

### 색 역할

| 역할 토큰 | 해석값 | 사용처 / globals.css 선택자 |
|---|---|---|
| `--surface-page` | `#0c0a08` | `body`, `.listbar` 바닥 |
| `--surface-1` | `#141210` | `.panel`, `.card`, `.f-card`, 기본 `.chip` |
| `--surface-2` | `#1f1b17` | 선택된 nav/칩, 카드 hover |
| `--surface-3` | `#2a241d` | `.chip:hover` |
| `--surface-inset` | `#080706` | `.srch`, `.unit-art`, `.f-art` |
| `--line` / `--line-inner` | `#2f2820` / `#221d18` | 외곽 1px와 inset 1px 이중선 |
| `--line-strong` / `--line-faint` | `#453a2c` / `#1e1a15` | 강한 구획 / 약한 내부 구분 |
| `--line-active`, `--accent` | `#c9a84c` | 선택 테두리·키보드 focus |
| `--ink` / `--ink-dim` | `#e8e4dc` / `#9b8f7d` | 본문 / 보조 본문 |
| `--ink-muted` / `--ink-faint` | `#7d7263` / `#574f45` | 낮은 위계 라벨 / placeholder·장식 |
| `--ink-cream` / `--ink-gold` | `#e3c49b` / `#e0c060` | 제목 / 활성·핵심 숫자 |
| `--alert` / `--accent-soft` | `#b23a2e` / `#8a7434` | 제한적 경보 / 채워진 막대 |
| `--state-missing` | `#d98f6a` | `.missing` 결손 |
| `--state-absent` / `--state-fallback` | `#7d7263` / `#9b8f7d` | `.absent` / `.fellback` |
| `--state-short` | `#d98080` | 공급 부족 표현. 인격/EGO 정보 상세의 공통 경보색으로 확대하지 않음 |

죄악과 키워드는 서로 다른 축이다. 동일한 ‘화상/분노 느낌’으로 합치지 않는다. **색만으로 의미를 전달하지 않고 이름/아이콘을 함께 쓴다.** 근거: `tokens.css` 축 주석, `globals.css` `[data-sin='…']`, `[data-kw='…']`, `[data-atk]`.

| 축 | 정확한 원자값 |
|---|---|
| 죄악 | wrath `#8b3227`, lust `#b45f2c`, sloth `#e28a0c`, gluttony `#64832f`, gloom `#336570`, pride `#225182`, envy `#7f5093`, none `#6b5a45` |
| 상태 키워드 | bleed `#cd2522`, burn `#e62644`, tremor `#ff9000`, rupture `#18edc0`, sinking `#0096ff`, charge `#19ecea`, poise `#a9c4c4`, haste `#ff6400`, bind `#fe6900`, fragile `#ad14c8`, poison `#3bed1a` |
| 공격 타입 | slash/pierce/blunt 모두 `#a56939` |

키워드 토큰은 실제 선언 **11개**다. 파일 주석의 ‘12종’이라는 과거 설명을 토큰 개수로 복제하지 않는다.

### 타이포그래피

| 토큰 | 정확한 스택 / 역할 |
|---|---|
| `--font-title`, `--font-display` | `'Chakra Petch', 'Pretendard Variable', Pretendard, 'Noto Sans KR', system-ui, sans-serif`; 제목 / 작은 라벨·탭 |
| `--font-body` | `'Pretendard Variable', Pretendard, 'Noto Sans KR', system-ui, 'Segoe UI', sans-serif`; 한국어·본문 |
| `--font-num` | `'Bebas Neue', 'Chakra Petch', ui-monospace, monospace`; 강조 숫자·등급 |
| `--font-mono` | `ui-monospace, 'Cascadia Mono', Consolas, monospace`; 등록 자료·미세 수치 주석 |

`tokens.css`는 Google Fonts(Chakra Petch 400/500/600/700, Bebas Neue)와 jsDelivr(Pretendard 1.3.9)를 `@import`한다. Noto Sans KR는 fallback 이름만 있으며 별도 다운로드하지 않는다. 자체 호스팅은 코드 주석의 **계획**, 현재 구현 아님. 라이선스에 대한 주석을 새 법률 판단으로 사용하지 않는다. 이 문서는 폰트 교체·다운로드를 수행하지 않았다.

| 분류 | 정확한 값 / 사용 |
|---|---|
| 글자 크기 | `--fs-micro` 9.5, tiny 10.5, xs 11.5, sm 12.5, base 14, lg 15, xl 19 **px** |
| 굵기 | normal 400, medium 500, bold 700 |
| 줄높이 | tight 1.3, base 1.6 |
| 자간 | normal .02em, wide .08em, wider .1em |
| 수치 정렬 | `body`, `.f-stat b`, `.f-file dd` 등 `font-variant-numeric: tabular-nums` |
| 상세의 국소 크기 | `.f-title h1` 32px/1.15; `.f-hp-n` 28px/1; `.f-stat b` 21px; `.f-cost b` 26px/1. **전역 fs 토큰으로 승격된 값은 아님** |

큰 국문 제목도 Pretendard fallback으로 읽힌다. 라틴의 각진 얼굴, 기존 제목의 uppercase·자간 처리는 유지하되 새 영문 문구 자체를 대문자로 저장하지 않는다. `.htitle`, `.seclabel h2`, `.panel-h h3`가 CSS로 변환한다. 상세 이름 `.f-title h1`에는 그 uppercase 규칙이 없다.

### 간격·프레임

| 토큰 | 정확한 값 |
|---|---|
| `--sp-1`…`--sp-11` | **2, 4, 6, 8, 10, 12, 14, 18, 22, 26, 32px** |
| `--gap` / `--gap-sm` | sp-8=18px / sp-4=8px |
| `--shell-max` / `--shell-pad` / `--head-h` | 1360px / 24px / 110px |
| `--cut` / `--cut-sm` | 12px / 7px |
| `--fx-scanline` / `--fx-grain` | .3 / .035 opacity |

컷코너는 `.panel`(12px), `.card`(7px)의 우상단 `clip-path`와 회전된 1px `::after` 대각선이다. `.f-card`에는 컷코너가 **없고** 금색 외곽선과 inset 6px 점선이 있다. 모든 요소에 컷코너를 추가하지 않는다. 질감은 `body::before`(3px 점 패턴), `body::after`(1px/3px 스캔라인) 두 fixed overlay이며 pointer-events:none, z-index:200이다. 페이지별로 중복 레이어를 만들지 않는다.

## 3. 셸·그리드·반응형

아래 치수는 모두 [globals.css](../app/globals.css)의 해당 선택자 선언이다. CSS 캐스케이드 때문에 기본 `.card`와 뒤의 `.unit`을 **함께** 읽어야 한다.

| 영역 / 선택자 | 현행 치수·동작 |
|---|---|
| `.site-header` | sticky top0, z50; nav는 flex-wrap |
| `.hbar` / `.site-nav` | max1360px, 가운데; hbar 13px 24px, nav 0 24px |
| `.site-main` | max1360px, margin auto, padding **26px 24px 90px** |
| `.site-footer` | max1360px, padding **22px 24px 40px** |
| `.seclabel` | flex gap11px, 아래18px; h2 19px; rule flex1, 높이1px |
| `.grid2` | `1fr 360px`, gap22px; ≤1020px에서 1열 |
| `.cardgrid` | `repeat(auto-fill,minmax(180px,1fr))`, gap10px |
| `.cardgrid-gift` | 최소150px, 나머지 기본 grid와 같음 |
| `.listbar` | sticky top110px, z20, 좌우 margin -12px, padding10px 12px 8px; 아래18px |
| `.axisbar .filters` | flex `0 1 300px`, min180px, 왼쪽 auto; 내부 search의 원래 min220px도 적용됨 |
| `.secgroup` | 위22px; scroll-margin-top `110px+110px` |
| `.f-card` | `380px minmax(0,1fr)`, gap32px, padding22px |
| `.st-grid` | `repeat(auto-fill,minmax(240px,1fr))`, gap8px |

| 반응형 기준 | 실제 선택자와 변화 | 적용 범위 |
|---|---|---|
| ≤480px `--bp-sm` | `.filter-axis` 좌측 padding0, `.filter-axis-label` static/width100% | 일반 필터 라벨. 목록 카드가 무조건 2열이라는 뜻 아님 |
| ≤760px `--bp-md` | `.formation-cols` 1열 등 편성 관련 규칙 | 조사 대상 목록/상세의 전용 breakpoint가 아님 |
| **≤860px** (토큰 없음) | `.f-card` 1열/gap18/padding14; `.f-head` column/gap10; `.f-file` 좌측 정렬; `.f-statrow` 2열·라벨 전폭 | 인격·EGO 상세의 실제 예외 |
| ≤860px 후속 override | `.f-statrow--sin` **4열**, 라벨 전폭 | EGO 죄악7종을 일반2열 규칙에 덮어쓰지 않음 |
| ≤1020px `--bp-lg` | `.grid2` 1열 | 상세 하위 패널과 구판 상세 |
| ≤1180px `--bp-xl` | `.formation-cols` 2열 | 편성 전용. 일반 도감 그리드 아님 |

목록 컬럼 수는 카드 min 폭과 가용 폭으로 정해진다. 예를 들어 viewport390px에서 셸 내부는342px이므로 기본180px 카드는1열, 기프트150px 카드는2열이다(간격10px 포함). 이는 **CSS 계산**이며 이번 문서 작성에서 390px 실화면 합격을 검증했다는 뜻이 아니다. 헤더는 wrap으로 높이가 변하지만 `--head-h=110px`는 고정이므로 좁은 화면 sticky 겹침은 §10의 예외다.

## 4. 목록 카드·필터·정렬·탭

### 재사용 목록 계약

[unit-list.tsx](../components/unit-list.tsx)의 `UnitList`가 세 목록의 공통 소유자다. 서버 페이지가 canonical 질의 결과를 아래 형태로 변환하고 클라이언트에 전달한다. 필터를 위해 새로운 DB/분류 표를 UI 안에 만들지 않는다.

| 입력 | 계약 |
|---|---|
| `units: Unit[]` | `id`, `sectionId`, `grade`, `image:string|null`, `name`, `tags:Record<string,string[]>` 필수. `rankIcon/rankText/rankLabel`, `season`, `released`, `note`, `fellBack` 선택 |
| `axes: Axis[]` | `key`, `label`, `options:[{id,label,icon?}]`; `iconOnly?`는 의미 있는 등급 아이콘 등에만 사용 |
| `sections: Section[]` | `{id,name,icon?}` 배열 순서가 화면 순서. sectionId가 여기에 없으면 카드는 렌더되지 않음 |
| `basePath` | 로케일 포함 목록 경로, 카드 href는 `${basePath}/${id}` |
| `searchPlaceholder` | 페이지에서 ko/en 전달. 실제 검색은 **이름만** case-insensitive 포함 검색 |
| `variant` | 기본 `portrait`, 사물은 `icon` |

| 페이지 | 그룹 / 실제 필터 |
|---|---|
| 인격 | 수감자 그룹. sinner·grade·sin·keyword·mechanic·association 6축 |
| EGO | 수감자 그룹. sinner·grade·sin·keyword 4축 |
| 기프트 | generic→질의 keyword 순서→cursed 구성. tier·keyword 2축. 문자열 이름/정렬을 새로 추정하지 않고 `gifts/page.tsx` 반환을 따름 |

동일 축 값은 OR, 서로 다른 축은 AND. 선택된 조건칩 재클릭은 해당 값 제거, ‘조건 초기화’는 `picked`만 비워 **검색어는 유지**한다. 축 펼침은 aria-expanded, 값 선택은 aria-pressed다. 패널은 화면 위를 덮는 팝오버가 아니라 `.axispanels`의 **0fr→1fr**로 문서 공간을 차지한다(180ms ease). 스크롤 시 닫히며 오픈/선택 뒤400ms는 레이아웃 변화를 사용자 스크롤로 오인하지 않게 무시한다. 같은 축 버튼 재클릭으로 닫을 수 있으며 **Escape·바깥 클릭 종료는 구현되어 있지 않다**.

정렬은 section 순서 고정 → grade → released → id. 역순은 **section 내부만** 뒤집는다. 결과 수는 전체 필터 결과를 세고, 화면에 그려진200개와 혼동하지 않는다. 초기200개, IntersectionObserver와 클릭 가능한 `.loadmore` 둘 다 지원한다. 필터/검색/정렬 변경 시 limit200으로 돌아간다. `.totop`은 scrollY>400에서 표시되고 42×42px, 우하단18px이다.

### 카드 구성

`.card.unit` = 위의 이름 → 정사각 `.unit-art` → `.card-meta` 순서. padding8px/gap6px. 이름은15px, line-height1.3, 좌측정렬, **한 줄 ellipsis**와 title 전문. 썸네일에 목록명 텍스트가 이미 있으므로 img alt는 비워 중복을 피한다. 상세에서 전문을 읽을 수 있어야 한다.

- 인격/EGO 초상: `.unit-art > img:not(.unit-rank)` `object-fit:cover`, position50% 20%. 등급은 좌상단6px, 높이24px/최대폭64px/contain. 그림 상단42%에 어두운 그라데이션.
- 기프트: `.cardgrid-gift`의 이미지 `contain`, padding8px. 등급은 `.gift-tier`, 좌6px/상4px, 숫자체19px/1.1, 금색·그림자. 물건의 외곽을 잘라내지 않는다.
- 이름이 없는 이미지로 의미를 대신하지 않는다. 카드 image=null이면 현재는 inset 빈 영역이다. 명시적인 이미지 결손 문구는 구현되어 있지 않다(§10).

근거: `globals.css` `.unit*`, `.cardgrid-gift`, `.gift-tier`; `UnitList` 카드 JSX.

### 탭·버튼의 의미

공통 nav는 `SiteNav`의 **Link**이며 상세에서도 부모 탭이 aria-current=page다. 별도 ARIA tablist는 없다. `LocaleSwitch`의 현재 언어는 span aria-current=true, 다른 언어는 Link다. 단계 버튼 `.f-up`과 필터 `.chip`은 선택 버튼이지 페이지 링크가 아니다. 색이 비슷하다고 전부 tab role로 바꾸지 않는다.

다른 URL 필터가 필요하면 [filters.tsx](../components/filters.tsx)의 `ChipFilter`, `PickFilter`, `TriFilter`, `SearchBox`, `ClearFilters`를 참고한다. 이 구현은 URL 기반/router.replace이고 SearchBox는300ms debounce다. **UnitList의 로컬 state 동작과 같은 구현이 아니다.** 현재 URL 공유/복원 격차는 §10에 남긴다.

## 5. 상세 서류·수치·스킬·패시브

아래 구조를 `.f-card` 계열과 두 SheetView가 공유한다. **재사용 가능한 범용 Sheet 컴포넌트가 이미 있다는 뜻은 아니다.** 새 도메인 상세는 전용 데이터 계약을 먼저 정하고 기존 `sheet-parts`를 재사용한다.

```text
SecLabel: 엔티티 종류                         목록으로
f-card
  f-art (사진·모서리 홀더·교체)  f-body
                                f-head: 이름·소속 | 등록 자료
                                f-picks: 단계/레벨
                                HP 또는 죄악 소모
                                스탯·저항·키워드
grid2 / Panel
  스킬 details·패시브             추가 정보
StatusPanel: 본문에서 참조한 상태 설명
```

| 요소 | 정확한 구현 / 근거 선택자 |
|---|---|
| 사진 | `.f-art` padding6px; img3:4, cover, position50% 18%. `.f-art`/`.f-mount` 가상요소 홀더16px, 선2px, opacity .55 |
| 교체 | `.f-swap`40×40px, top/right10px, svg21px; aria-pressed 및 로케일별 aria-label/title. EGO 침식 그림 없으면 버튼 없음 |
| 이름 | `.f-title h1`32px, cream; `.f-sinner` 같은 크기/본문색. 대괄호는 CSS before로 `[이름] 수감자` 구성 |
| 상징/등급 | `.f-emblem`60×60, screen blend; `.f-rank` 높이30px/폭auto |
| 소속/등록 | `.f-affil` wrap/gap6/margin-top10, 태그4px 10px. `.f-file` mono, label10.5px, value12.5px/min84px, 첫 NO. 값15px |
| 레벨 | `.f-pick--lv` flex1 1 260px/min220px; range18px; numeric6ch/padding6px/숫자14px |
| 단계 | `.f-up` min40px, padding6px 8px, 숫자12.5px; 선택은 금색 선·surface2 |
| 수치 | `.f-statrow` label46px+3열/gap8px; `.f-stat b`21px 숫자체; `.f-stat em`10.5px mono 보정 |
| HP | `.f-hp-n`28px/min4ch/right; bar26px; 흐트러짐 marker3px와 백분율. 비율에 근거 없는 장식 marker 금지 |
| EGO 소모 | `.f-cost` label+wrap list; 아이콘22px, 숫자26px; `.f-statrow--type` 값은 숫자체가 아닌 본문14px |
| EGO 저항 | `.f-statrow--sin` label46px+7열/gap6px, 값15px. 공격 타입3종과 합치지 않음 |

기본 선택은 인격 레벨60·실제 speeds에 있는 마지막 동기화 단계·기본 그림, EGO는 실제 skill stages의 마지막 해석 단계·각성 그림이다. 단계 행이 없을 때는 고른 단계 이하 마지막 행을 이어 쓰고, 앞 단계가 없으면 ‘동기화/해석 …부터’를 표시한다. 이런 선택 규칙은 **현재 SheetView 로직**이지 디자인 문서가 게임 값을 새로 정의하는 것이 아니다.

스킬은 native `details.f-skill`/`summary`로 접는다. summary padding10px 12px/gap10px, 아이콘30px, 슬롯 min44px/10.5px, 이름14px/500. 인격 우측은 coin52px·sin56px·attack56px의3열, EGO는 coin52px·SP64px의2열이다. body padding12px. 패시브는 `.f-passive` padding12px·얇은 경계, 제목14px, 단계 태그. 근거: 두 파일의 비공개 `SkillRow`, `globals.css` `.f-skill*`, `.f-passive*`.

본문은 `Lines`→`paint`가 줄 단위로 렌더한다. `.fx-line`12.5px/1.6/보조 본문색, `.fx-when`10.5px mono, `.fx-st` 금색·점선 밑줄 링크로 `#st-ID`에 이동한다. 이름 사전은 `nameMap`으로 긴 상태명을 먼저 매칭한다. 알려진 상태 토큰은 표시명으로 변환하고 모르는 태그를 임의 번역하지 않는다. 새 rich text renderer나 `dangerouslySetInnerHTML`을 만들 필요가 없다. 코인 목록은 `.fx-coins` 위12px 점선·각 행 gap10px, 로마 번호 최소2ch, `CoinDots` 아이콘12px.

`StatusPanel`은 전달받은 관련 상태만 출력하며 없으면 패널 자체를 숨긴다. `.st-card` padding10px, 상태 아이콘22px·이름12.5px gold. 설명이 비면 현행은 absent ‘설명 없음/No description’. 데이터 의미가 달라지면 UI가 사유를 추정하지 않고 계약을 바꾼다.

## 6. 패널·표·태그·버튼·상태

| 용도 | 재사용 / 스타일 | 정확한 규칙 |
|---|---|---|
| 제목줄 | `SecLabel` / `.seclabel` | h2+sub+rule+hint. 숫자0 hint는 현재 truthy 검사로 숨겨짐(예외) |
| 구획 | `Panel` / `.panel-h`, `.panel-b` | 제목h3, hint, body. header11px 18px; body18px. 숫자0 hint 지원 |
| 스칼라 표 | `Facts` / `.facts` | 실제 HTML은 **dl/dt/dd**, `auto 1fr`, gap6px 14px. 목록 비교 table 컴포넌트는 없음 |
| 일반 태그 | `.tag` | padding1px 6px, 글자10.5px/1.5, nowrap, 1px line |
| 강조 태그 | `.tag-mark` | gold border/text, gold alpha .08 배경. 모든 메타에 적용하지 않음 |
| 그림 태그 | `IconTag` / `.tag-icon` | icon16px, gap4px. `sheet-parts.Tag`는 별도 `.tag--icon`+14px img/gap6px |
| 그림만 | `IconOnly` / `.icon-inline` | 높이20px/최대폭52px; src없으면 label 태그. alt/title 필수 |
| 일반 선택 | `.chip` | padding6px 10px, 11.5px display; hover surface3; pressed surface2/gold border/text |
| 결과없음 | `Empty` / `.emptied` | 중앙, 위아래40px, muted12.5px. 엔티티 결손과 혼동하지 않음 |
| 결손 | `Nothing kind="missing"` / `.missing` | 11.5px, #d98f6a 점선밑줄/offset2px. ‘출처에 없음’ 등 사유 |
| 정상 부재 | `Nothing kind="absent"` / `.absent` | 11.5px muted italic. 예: 전용 팩 없음→범용 풀 |
| 언어 폴백 | `Name` / `.fellback` | EN 테두리표시, 9.5px display, 왼쪽4px/padding0 2px. title에 전달한 notice |
| 페이지 이동 | `Pager` / `.pager` | 기존 query 유지하고 page만 변경. 현재 한국어 내장 문구는 §10 |

`0`은 수치이며 ‘없음’과 다르다. `null`의 뜻은 필드 계약으로 정한다. 예를 들어 기프트 비용 미상은 `Nothing missing`, 전용 팩0은 정상 범용 안내다. `Icon`의 null placeholder는 aria-hidden 이미지 자리일 뿐 결손 이유를 설명하지 않으므로 필요한 텍스트를 별도로 둔다. 근거: [ui.tsx](../components/ui.tsx), 기프트 상세 `page.tsx`.

포커스는 `button/a/input/textarea/summary:focus-visible`에 **2px accent outline+1px offset**이다. 체크박스 accent도 gold. 클릭 대상을 div로 흉내 내지 않는다. 검색 `.srch:focus`는 active border+1px ring을 추가한다. `.f-lv-num:focus`의 뒤쪽 outline:none override는 현행 예외로 기록한다. 전역적으로 포커스를 없애는 규칙을 새로 만들지 않는다.

## 7. 이미지·아이콘·게임 데이터 표시

경로는 서버의 [lib/assets.ts](../lib/assets.ts)에서 해석하고 컴포넌트에는 URL 또는 null을 넘긴다. 원본 sprite와 ID는 서로 대체할 수 없다. 파일명 공백·아포스트로피는 resolver에서 처리하므로 화면에서 URL을 수작업 연결하지 않는다.

| 대상 | resolver / 변형 | 표시 규칙 |
|---|---|---|
| 인격 | `identityImage(id,profile/full/profileBase/fullAwakened)` | 목록 profile=`_gacksung_profile`; 상세 full=`_normal`, fullAwakened=`_gacksung` |
| EGO | `egoImage(id,awaken/cg/erosion)` | `_awaken_profile`, `_cg`, `_erosion_profile`; CG `.f-cg` width100%/height auto |
| 기프트 | `giftIcon(sprite)` | id에서 추정하지 않음. 목록 contain |
| 스킬/프레임 | `skillIcon(id)`, `skillFrame(affinity,tier,defType)` | 실제 파일 우선, null이면 의미 있는 텍스트 유지 |
| 공용 | `rarityIcon`, `egoRankIcon`, `sinIcon`, `keywordIcon`, `statusIcon`, `sinnerIcon`, `uiIcon` | 죄악·공격·키워드 이름/아이콘을 서로 바꾸지 않음 |

인격 등급은 0/00/000, EGO는 ZAYIN/TETH/HE/WAW/ALEPH. 가로로 긴 EGO 등급을 정사각형으로 늘리지 않는다. `.chip img`는 높이16px/폭auto/max42px, `.unit-rank`는 높이24px/max64px이다. 본문 옆 장식 icon alt="", 그림만으로 식별하는 `IconOnly`는 label alt/title. 링크 텍스트에 이름이 이미 있으면 초상은 빈 alt. 게임 그림의 추가 색칠·AI 재생성·범용 아이콘 대체는 이 문서 범위 밖이다. `SwapIcon`은 기존24×24 SVG 교체 화살표를 재사용한다.

게임 자산은 코드/문서 라이선스와 구분한다([README](../README.md) 라이선스·고지, [05-ui](05-ui-foundation.md) 이미지 정책). 이 문서에 새 게임 이미지 복제본을 넣지 않았다. 실측 캡처는 아래 감사 기록의 로컬 참고자료이며 배포용 자산 번들이 아니다. **2026-09-08 조사 당시** resolver에 프로세스 수명 동안 유지되는 이미지 인덱스가 있었다. **문서 검수 시점에는 ops가 `lib/assets.ts` 및 `/media` 서빙을 구현·운영 검증 중**이다. 조사 당시의 영구 캐시를 현행 확정 상태나 신규 페이지 규칙으로 고정하지 않고, 최종 서빙 계약은 ops 검증 결과를 따른다.

## 8. ko/en 문구·폴백·접근성

게임 이름·설명은 canonical locale 데이터, 서비스 UI 문구는 `UI[locale]` 또는 페이지의 `ko ? … : …`에서 온다. 같은 역할의 새 문구를 작성할 때 기존 단어를 재사용하고, 원본 게임 효과를 UX 문구로 요약해서 대체하지 않는다. `LocaleSwitch`는 path 첫 세그먼트만 바꾸고 query를 유지한다.

| 의미 | ko / en 현행 예시 | 근거 |
|---|---|---|
| 뒤로 이동 | 목록으로 / Back to list | 두 상세 page.tsx |
| 필터 축 | 수감자 / Sinner, 키워드 / Keyword | 세 목록 page.tsx |
| 인격 단계 | 동기화 / Uptie | IdentitySheetView |
| EGO 단계 | 해석 / Threadspin | EgoSheetView |
| 원본 결손 | 출처에 없음 / Not in source | 기프트 상세 |
| 정상 부재 | 범용 풀에서 등장한다 / Appears in the general pool | 기프트 상세 |
| 상태 설명 없음 | 설명 없음 / No description | StatusPanel |
| 검색0건 | 조건에 맞는 항목이 없습니다 / No matching entries | UI.empty. UnitList는 다른 한국어 내장문구 사용 |

톤은 짧은 명사 라벨과 구체적인 행동이다. ‘목록으로’, ‘그림 바꾸기’, ‘조건 초기화’, ‘더 보기’처럼 결과를 말한다. 출처가 없는 값은 지어내지 않고 이유를 쓴다. 과장·추천 보장·내부 DB/ETL 용어를 새 정보 화면의 기본 안내로 넣지 않는다. 기존 `UI.sourceNotice`의 비공식 고지는 footer에 유지한다. 이 규칙은 `ui-text.ts` 머리 원칙, 두 SheetView의 버튼, `Nothing` 주석에 근거한다.

접근성의 **구현된 기반**은 native Link/button/details, aria-current/pressed/expanded, 이미지 대체텍스트, focus-visible다. 구현 기반과 전수 합격을 구분한다. 영문 누수·검색 label·모션·좁은 화면에 대한 미통일 항목은 아래 표에 명시한다. 작은 글자를 새 핵심 본문에 배정하지 말고 기존 크기 역할을 따른다. 토큰 주석의 대비 목표를 WCAG 전수 검증 결과로 인용하지 않는다.

## 9. 새 페이지 작성 예시와 재사용 매핑

### 목록: 데이터 어댑터를 분리하고 기존 골격에 전달

아래는 새 route를 추가하는 구현이 아니라 **현재 props로 작성 가능한 문서용 예시**다. 호출자는 검증된 query 반환값을 Unit/Axis/Section으로 변환한다. 실데이터를 흉내 낸 하드코딩 샘플은 넣지 않는다.

```tsx
import type { Locale } from '@/lib/locale';
import { UnitList, type Unit, type Axis, type Section } from '@/components/unit-list';
import { SecLabel } from '@/components/ui';

export function CatalogView({ locale, title, basePath, units, axes, sections, objects = false }: {
  locale: Locale;
  title: string;
  basePath: string; // 예: `/${locale}/identities`; 실제 route 존재 확인
  units: Unit[];
  axes: Axis[];
  sections: Section[];
  objects?: boolean;
}) {
  return <>
    <SecLabel title={title} hint={units.length} />
    <UnitList
      units={units} axes={axes} sections={sections} basePath={basePath}
      searchPlaceholder={locale === 'ko' ? '이름 검색' : 'Search name'}
      variant={objects ? 'icon' : 'portrait'}
    />
  </>;
}
```

이 예시도 `UnitList`의 한국어 내장 제어 문구·URL 미복원·`SecLabel`의0 hint 누락을 그대로 가진다. 이를 해결한 범용 컴포넌트가 있다고 가정하지 않는다. 새 production route는 `app/[locale]/…/page.tsx`에서 locale 검증→query→없으면 notFound→표시 props 전달 순서를 기존 페이지와 맞춘다. 임의 데이터 필터는 화면 안에서 발명하지 않는다.

### 상세: 기존 도메인 뷰를 조립

```tsx
// 인격 상세 page.tsx가 이미 하는 조립. sheet는 getIdentity의 반환값이다.
<SecLabel title={ko ? '인격' : 'Identity'}
  hint={<Link href={`/${locale}/identities`}>{ko ? '목록으로' : 'Back to list'}</Link>} />
<IdentitySheetView sheet={sheet} locale={locale}
  notice={UI[locale].fallbackNotice}
  icons={{ coin: uiIcon('coin'), offense: uiIcon('offense level'),
           defense: uiIcon('defense level'), speed: uiIcon('speed') }} />
```

EGO는 `EgoSheetView`에 `EgoDetail`, locale, notice, `{coin}`을 넘긴다. 신규 도메인에서 인격용 HP/레벨/저항3종을 그대로 복사하지 않는다. `Panel`·`Facts`·`Lines`·`StatusPanel`로 필요한 부분을 조합하고, 상세의 시각 계층만 재사용한다. 예를 들어 추가 스칼라 정보는 다음 패턴이다.

```tsx
<Panel title={ko ? '속성' : 'Properties'}>
  <Facts rows={[
    [ko ? '비용' : 'Cost', cost === null
      ? <Nothing kind="missing">{ko ? '출처에 없음' : 'Not in source'}</Nothing>
      : cost],
  ]} />
</Panel>
```

| 필요한 것 | 재사용 파일/심볼 | 새로 만들지 않을 것 |
|---|---|---|
| 셸·nav·언어 | locale layout, SiteNav, LocaleSwitch | 페이지별 헤더/푸터 |
| 제목·구획·스칼라 | ui.tsx: SecLabel/Panel/Facts | 같은 선/간격의 별도 CSS |
| 도감 목록 | unit-list.tsx: UnitList/Unit/Axis/Section | 인격/EGO/기프트마다 별도 카드·필터 엔진 |
| 인격/EGO 상세 | IdentitySheetView/EgoSheetView | 같은 도메인의 두 번째 상세 뷰 |
| 효과문·상태 | sheet-parts.tsx: Lines/paint/nameMap/StatusPanel | 토큰 번역표·HTML 주입 renderer |
| 숫자/표식 | sheet-parts.tsx: roman/signed/CoinDots/SwapIcon | ASCII 하이픈 보정·새 단계 표기 |
| 빈값/이미지 | ui.tsx: Name/Nothing/Icon/IconTag/IconOnly/Empty | null을0·무명 숫자 ID로 채우는 임시값 |
| URL 질의 필터 | filters.tsx, Pager | UnitList와 같은 동작이라고 단정하는 설명 |

## 10. 미통일 예외와 후속 개선 — 표준과 분리

아래는 **미수정 현행**이다. 새 시각 언어를 제안하는 목록이 아니며, 작업 승인이 나면 기존 언어 안에서 좁게 보완한다.

| 현행 예외 / 근거 | 새 페이지에서 주의 / 개선 후보 |
|---|---|
| 기프트 상세는 `.grid2`+강화별 Panel·Facts 구판; 목록의 I가 상세 숫자1로 바뀜 | 이를 새 상세 표준으로 복제하지 않음. 정보 구조는 보존하고 통일은 별도 작업 |
| `UnitList` 적용됨/없음/정렬/초기화/더보기/0건/맨위로가 한국어 내장. `seasonLabel`도 한국어 | en 완성이라고 선언하지 않음. UI locale 계약 추가 후보 |
| `Name` null시 ‘이름 없음’, `Pager` 이전/다음이 한국어 내장 | 호출자/컴포넌트의 locale 확장 필요. 현재 실제 API에는 locale prop 없음 |
| 목록 page의 이름/그룹 어댑터는 일부 `name ?? String(id)`를 사용 | 결손 의미를 `Name`/`Nothing`과 통일한 구현이 아님. 기존 표시 사실과 새 UI에서 지향할 명시적 결손 표기를 구분 |
| `app/layout.tsx` html.lang=ko 고정, `/en/egos`·상세에서 실측 | 언어 태그 수정은 별도. 본문 영어 표시와 문서 언어 합격은 다름 |
| `UnitList`는 q/picked 로컬 state, URL 필터 요구와 불일치. 상세의 `?sinner/keyword/affiliation` 링크를 목록이 반영하지 않음 | 공유·복원 흐름을 추가 검증. URL 기반 filters.tsx와 구분 |
| 검색 입력에 명시적 label/aria-label 없음; UnitList EN abbr에 title 없음 | placeholder에만 의존하지 않도록 보완 후보 |
| `CoinDots`는 빈 alt 이미지로만 수를 표현 | 코인 수의 텍스트/accessible label 보완 후보 |
| `SecLabel` hint가 truthy 검사라0 누락. `Lines` 빈 desc는 null 반환 | 의미 있는0·미상·부재는 호출 계약에 따라 검수 |
| `IdentitySheetView` hpBase/hpPerLevel/defCorrection에 `??0` 계산 fallback | 데이터 결손을 정상0으로 오인할 수 있음. 데이터 계약 확인 없이 새 계산에 복제 금지 |
| 토큰 밖 `.f-title`32px, HP28px, 수치21px, cost26px 및860px breakpoint | 상세 전용 국소값으로 기록. 전역 토큰을 바꾸어 목록 밀도를 함께 바꾸지 않음 |
| `.f-hp-bar`, `.f-corrosion-bar i`의 `#6d2320→#a83c33`, `.f-swap[aria-pressed]`의 `#17130f`; HP radius2px | globals 머리의 ‘hex 하드코딩 없음’과 다름. 기존 상세 예외이지 새 색/라운드 규칙 아님 |
| `.tag-icon`과 `.tag--icon` 두 계열 | 컴포넌트가 사용하는 selector 그대로 적용. 무작정 합치지 않음 |
| 고정 head110px vs wrap header, st-grid min240px, skill summary 고정 태그폭 | 좁은 화면 overflow·sticky 가림 확인. 감사251px에서 인격344px/EGO337px 관측. **390px 실패 증거는 아님** |
| `.totop`만 reduced-motion transition 제거; axispanels/axischip 전환 남음 | 모션 전수 대응으로 표기하지 않음 |
| `.f-lv-num:focus`가 공통 focus-visible 뒤에서 outline:none, clipped card 외부 outline 가능성 | 실제 키보드 focus 가시성 확인. 현재 자동합격 아님 |
| CDN 폰트는 현행. resolver 프로세스 캐시·Next public runtime 파일 제약은 **2026-09-08 조사 당시** 발견 사항 | **문서 검수 시점 ops의 `lib/assets.ts`·`/media` 구현 및 운영 검증 진행 중**. 최종 서빙 계약은 해당 검증 결과를 따르며, 이 문서로 갱신 해결을 주장하지 않음. 폰트 자체호스팅도 별도 작업 |

## 11. 구현 대조와 인수 체크리스트

**해야 할 것:** `tokens.css` 역할 토큰 사용, 기존 component props 재사용, 목록 섹션 순서·카드 비율 유지, 상세 이름 하나를 가장 크게 배치, null 사유·정상0·영문 폴백 구분, 게임 아이콘의 원래 비율 유지, ko/en 문자열과 키보드 동선 확인. 근거는 §§2–9의 코드/선택자 매핑이다.

**피할 것:** 새 파스텔/원색 테마·일괄 둥근카드, 모든 태그의 강한 강조, 숫자/이름/분류의 UI 추정, 물건 이미지 crop, 상세 이름 중복 헤드라인, 내부 상태 링크를 glossary 라우트 의존으로 착각, 구판 기프트 상세나 주석의 미구현 계획을 현행 표준으로 복제. 근거는 `.cardgrid-gift`, `.tag`, 두 상세 page, `sheet-parts.paint`, §10이다.

새 페이지 리뷰는 다음을 나란히 대조한다.

1. 대응하는 실제 route와 component를 선정했는가? 한글/영문 이름 길이·긴 효과문·이미지null·필터0건으로 비교한다.
2. 카드의 이름→그림→메타, 상세의 이름→고유 속성→등록 정보 순서와 색 역할이 같은가?
3. 1360px 셸 안에서 grid min 폭·padding·gap이 위 표와 같은가? ≤1020/860/480 경계 및390/320px에서 줄바꿈·focus·sticky 가림을 직접 확인한다.
4. native 버튼/링크/details, aria 상태, 명시적인 이름과 폴백 표기가 있는가?
5. 재사용 컴포넌트의 알려진 한계를 문서와 결과 보고에 남겼는가? 개선안이 적용된 것처럼 쓰지 않았는가?

### 조사·검증 범위

코드 전수값과 ko/en 조건 분기를 대조했다. 이전 [MVP 감사](audits/2026-09-08-design-mvp.md)의 실화면 표본(251px 인격/EGO 상세·기프트 목록/상세, ops503px 기프트 검수)을 참고했다. 당시 PNG는 `/tmp/design-mvp-{gifts,gift-detail,identity,ego-en,pack}-251.png`의 **로컬 임시자료**이며 이 문서의 필수 의존성이 아니다. 390px/1440px, 모든 영어 문구/단계 조작/대비를 전수 합격한 자료는 없다. 이 문서는 구현 표준과 알려진 예외를 기록하며 제품 QA 합격증이 아니다.

`frontend-design` 스킬은 주제 기반의 시각 일관성·정보 위계·문구 검토 원칙에 사용했다. 새 미감 탐색은 사용자 금지 범위이므로 수행하지 않았다. 제품 파일 변경·커밋·푸시 없음. 이미지 라이브캐시 조사는 분석만 ops에 인계하고 중단했다.

문서 검증: 상대 Markdown 링크 대상 존재 확인, 106개 토큰의 이름·선언값을 `tokens.css`와 자동 대조하여 일치 확인, 코드 예시의 props를 실제 export 타입과 수동 대조했다. 예시 TSX를 별도 빌드하거나 제품 테스트를 실행하지 않았다. 동시 진행 중인 ops/data의 package·asset·pipeline 변경은 이 문서 작업이 수정하지 않았다.
