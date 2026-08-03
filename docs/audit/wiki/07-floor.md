# 위키 조사 — 층과 거울 던전 진행 (floor · dungeon)

조사일 2026-08-03 · 담당 영역 `docs/audit/07-floor.md` 8절 미확정 7건

## 출처와 시점

| 항목 | 값 |
|---|---|
| 주 출처 | `limbuscompany.wiki.gg` (신뢰도 최상 — 표가 게임 내부 표기 그대로다) |
| 핵심 페이지 | `Mirror_Dungeon` · `List_of_Floor_Themes` · `Mirror_of_Names_and_Spiders` |
| 위키 기준 시즌 | **시즌 7 · 「이름과 거미의 거울」(Mirror of Names and Spiders) · 2026-02-19 시작 · 종료일 미정(진행 중)** |
| 우리 스냅샷 | 2026-07-25 · `MD7` |
| **시점 일치 여부** | **일치한다.** 위키의 `|end=` 가 비어 있어 MD7 이 현행이며, 우리 스냅샷과 같은 시즌이다. 시점 차이로 인한 해석 유보가 필요한 항목은 **없다** |

조사 방법: WebFetch 의 요약 모델이 표를 삭제해 버려서, MediaWiki API(`action=parse&prop=wikitext`)로 원문 위키텍스트를 받아 직접 파싱했다. 아래 인용은 전부 원문 그대로다.

### 총평 — 우리 `floor_pack` 은 위키와 116/116 완전 일치한다

`List_of_Floor_Themes` 의 117행을 파싱해 `canonical.floor_pack` 288행과 (팩, 난이도, 층) 단위로 대조했다.

```
matched packs: 116   mismatches: 0
wiki-only:     ['Pilgrimage of Compassion']   ← 위키가 (Removed content) 로 표기
```

위키 표에서 재계산한 층별 후보 팩 수가 우리 DB 실측과 한 자리도 틀리지 않는다.

| | 1층 | 2층 | 3층 | 4층 | 5층 | 6–10층 | 11–15층 |
|---|---|---|---|---|---|---|---|
| normal (위키=DB) | 8 | 11 | 14 | 19 | 23 | — | — |
| hard (위키=DB) | 13 | 16 | 27 | 41 | 46 | 46 | 24 |

이 한 장의 표가 1·2·3번 항목을 동시에 판정한다.

---

### 1. normal 난이도의 구간이 1~5 다섯 개인가, `1-5` 하나인가

**판정** 확정

**답** 다섯 개다 — normal 은 층마다 후보 팩 집합이 다르다. `floor_pack` 데이터가 옳고, 화면 안내문과 코드 주석의 「normal 이 1–5 다」가 틀렸다.

**근거**

`List_of_Floor_Themes` 표는 Normal 과 Hard 를 **별도 열**로 두고, 각 팩마다 층 범위를 따로 적는다. 표 헤더 원문:

```wikitext
!style="width:150px"|Theme Pack
!Normal
!Hard
!Floor Length
!style="width:20%"|Possible Bosses
!style="width:20%"|Unique Gifts
```

Normal 열 값이 팩마다 갈린다 — 원문 인용:

```wikitext
[[The Forgotten Theme Pack|...]]      | 1F    | 1F
[[Flat-broke Gamblers Theme Pack|...]] | 1F-2F | 1F
[[S.E.A. Theme Pack|...]]              | 2F    | 2F-3F
[[The Unconfronting Theme Pack|...]]   | 3F    | 2F-3F
[[Miracle in District 20 Theme Pack|...]] | 4F | 3F-4F
[[LCB Regular Check-up Theme Pack|...]]   | 5F | 4F-10F
```

— https://limbuscompany.wiki.gg/wiki/List_of_Floor_Themes

즉 「선망의 잔재」는 normal 1층에만, 「S.E.A.」는 normal 2층에만, 「LCB 정기검진」은 normal 5층에만 뜬다. 단일 `1-5` 풀이라면 성립할 수 없는 표기다.

게임 시스템 설명도 「현재 층의 풀」을 명시한다:

> "a Theme Pack in a specific slot may be replaced with another Theme Pack of one's choosing from **the pool of Theme Packs available on the current Floor**."

— https://limbuscompany.wiki.gg/wiki/Mirror_Dungeon (Theme Pack Observation 절)

**우리 데이터**

`canonical.floor_pack` normal = `1`·`2`·`3`·`4`·`5` 다섯 구간, 각 8·11·14·19·23종. 위키 표에서 독립 재계산한 값과 **완전 일치**(위 총평 표). `/ko/floors` 렌더도 다섯 구간 8·11·14·19·23 으로 나온다.

**조치**

데이터는 손대지 않는다. **문안만 고친다.**
- `app/[locale]/floors/page.tsx` 의 상단 안내문에서 「normal 은 1–5」 표현 삭제 → 「보통 난이도는 1~5층이며 층마다 후보 테마팩이 다르다」
- `lib/queries/reference.ts:11` 주석 동일 수정

참고로 normal 은 5층이 상한이다:

> "If all 5 Floors of a Mirror Dungeon was completed in [HARD] Mode and 'Parallel Superposition' is enabled ... Confirming extends the Mirror Dungeon run to 10 Floors ... After completing Floor 10, another popup ... Confirming extends the Mirror Dungeon run to 15 Floors, with Floors 11~15 featuring unique Long Battle Theme Packs, highly difficult Mounting Trials, and Mounting Adversities"

— https://limbuscompany.wiki.gg/wiki/Mirror_Dungeon (Parallel Superposition Mode 절)

`mirror_dungeon.baseFloors = 5` · `totalFloors = 15` 는 이 서술과 정확히 대응한다.

---

### 2. 팩 1122(선의의 순례)의 층 배정

**판정** 확정

**답** **결손이 아니다.** 2025-09-25~10-23 기간 한정 명일방주 콜라보 팩이며 시즌 6 종료와 함께 순환에서 빠졌다. `floor_pack` 0행이 현재(시즌 7) 상태로 옳다.

**근거**

팩 전용 페이지 최상단이 제거 표식 템플릿으로 시작한다:

```wikitext
{{removed}}
{{ThemePackInfo
|name=Pilgrimage of Compassion
|source=[[Episode Arknights - EX: Pilgrimage of Compassion]]
|normal=4F, 5F
|hard=4F, 5F, 6-10F
}}
```

본문:

> "It debuted alongside the [[Pilgrimage of Compassion]] Event during **[[Season 6]]**. It features a variable layout and a bossfight against Mayors, the Yearning Flotsam, appearing on Floor 4 and 5 in Normal mode and Floor 4 through 10 in Hard mode in Mirror Dungeons. **It was available from September 25th, 2025 until October 23rd.**"

— https://limbuscompany.wiki.gg/wiki/Pilgrimage_of_Compassion_Theme_Pack

`List_of_Floor_Themes` 목록 표에서도 두 셀 모두에 제거 주석이 병기된다:

```wikitext
[[Pilgrimage of Compassion Theme Pack|...]]
| 4F-5F ''(Removed content)''
| 4F-10F ''(Removed content)''
```

**우리 데이터**

`canonical.pack` 에 `1122` 존재(category `event`, floor_length 4), `canonical.floor_pack` 0행. 위키 117행 중 유일하게 우리 `floor_pack` 에 없는 팩이며, 그 유일한 예외가 정확히 「제거된 콘텐츠」로 표시된 팩이다.

**추산치(참고)** 만약 시즌 6 당시 배정을 복원한다면 normal `4`·`5`, hard `4`·`5`·`6-10` 의 **5행**이다(위키 `|normal=4F, 5F |hard=4F, 5F, 6-10F` 를 우리 구간 표기로 환산). 다만 현행 시즌 7 스냅샷에는 넣으면 **안 된다**.

**조치**

- `floor_pack` 에 행을 추가하지 않는다. 감사 문서 3.4 절의 「트래커의 후보 그리드에는 영원히 안 뜬다」를 「기간 한정 종료 팩이라 뜨지 않는 것이 옳다」로 정정
- 다만 **팩 도감/목록 화면**에서는 「기간 한정 · 현재 미제공」 뱃지를 붙여 구분하는 것이 낫다. 현재 `canonical.pack` 에 이 상태를 담는 컬럼이 없다 → `pack.availability` 류 플래그 신설 검토 (제품 판단)
- 팩 `1122` 를 「층 미배정 = 데이터 결손」으로 세는 대장이 있다면 제외 처리

---

### 3. 교차 출처 13건 — `limbus-assets` 와 `shared-library` 중 어느 쪽이 맞나

**판정** 확정

**답** **13건 전부 `limbus-assets`(= canonical/public)가 맞다. `shared-library` 가 틀렸다.** canonical 을 고칠 것이 없다.

**근거** — https://limbuscompany.wiki.gg/wiki/List_of_Floor_Themes

지목된 두 건부터:

| 팩 | 위키 원문 (Normal / Hard) | shared-library 주장 | canonical 실측 | 승자 |
|---|---|---|---|---|
| `1108` 1호선 Line 1 | `-` / **`5F-10F`** | hard·4 에 뜬다 | hard `5`, `6-10` | **canonical** — 위키에 4F 없음 |
| `1109` 2호선 Line 2 | `-` / **`4F-10F`** | hard·5, 6-10 에 안 뜬다 | hard `4`, `5`, `6-10` | **canonical** — 위키가 4F~10F 전 구간 |

`1123` 은 shared-library 의 오류 원인까지 드러났다. 위키에 **이름이 비슷한 팩이 둘** 있다:

```wikitext
'Murder on the WARP Express'          N='4F-5F'   H='4F-10F'
'Murder on the WARP Express BokGak'   N='-'       H='4F-10F'
```

우리 `1123` 은 `Murder on the WARP Express BokGak`(ko 「워프특급 살인사건 BokGak」)이고 Normal 배정이 **없다**. shared-library 가 주장한 `normal·4`·`normal·5` 는 접미사 없는 원판 팩의 값이다 — 두 팩을 뭉갠 것이다.

나머지 10건도 전부 canonical 이 맞다:

| 팩 | 위키 (N / H) | canonical 실측 | 일치 |
|---|---|---|---|
| `1008` The Unconfronting | `3F` / `2F-3F` | normal 3 · hard 2,3 | ✔ |
| `1010` Falling Flowers | `3F` / `2F-3F` | normal 3 · hard 2,3 | ✔ |
| `1102` S.E.A. | `2F` / `2F-3F` | normal 2 · hard 2,3 | ✔ |
| `1103` Miracle in District 20 | `4F` / `3F-4F` | normal 4 · hard 3,4 | ✔ |
| `1107` The Noon of Violet | `4F` / `3F-4F` | normal 4 · hard 3,4 | ✔ |
| `1114` Full-Stopped by a Bullet | `4F` / `3F-4F` | normal 4 · hard 3,4 | ✔ |
| `1115` LCB Regular Check-up | `5F` / `4F-10F` | normal 5 · hard 4,5,6-10 | ✔ |
| `1117` Nocturnal Sweeping | `5F` / `4F-10F` | normal 5 · hard 4,5,6-10 | ✔ |

**우리 데이터**

전수 대조 결과 **116팩 전부 불일치 0**. 감사 3.6 절이 유보한 13건이 모두 `shared-library` 측 오류로 판명됐다. `shared-library` 는 팩 56종만 다루는 부분 관측인 데다 그 안에서도 값이 틀렸다.

**조치**

- `shared-library` 의 `md_floor_packs.json` 을 **층 배정 출처로 쓰지 않는다.** canonical 이 `limbus-assets` 만 읽는 현재 동작이 옳다
- `canonical.field_source` 에 `floor_pack` 항목을 추가하고 출처를 `limbus-assets` 로 명시한다(현재 계보 미기록). 「shared-library 는 288쌍 중 138쌍만 가진 부분 관측이며 13건 오류 확인됨」을 주석으로 남긴다
- 감사 3.6 절의 「어느 쪽이 옳은지 여기서는 판정하지 않는다」를 위 결론으로 갱신
- **보너스**: 위키 표는 우리 `floor_pack` 의 독립 검증 수단으로 쓸 수 있다. 시즌 개편 때 회귀 테스트로 자동 대조하면 좋다(파싱 스크립트가 동작함을 확인)

---

### 4. 시즌 번호 — `season 0` 이 시즌 7 인가

**판정** 확정

**답** 그렇다. `season 0` 은 **시즌 7** 이며, ETL 하드코딩은 버그다.

**근거**

MD7 페이지 인포박스와 첫 문장:

```wikitext
{{MDInfo
|title=Mirror of Names and Spiders
|season=[[Season 7: Kumo no ito • oti on akA]]
|start=February 19th, 2026
|end=
|prev=Mirror of Immortality{{!}}Immortality
}}
```

> "The '''Mirror of Names and Spiders''' is the [[Mirror Dungeon]] of **[[Season 7]]**."

— https://limbuscompany.wiki.gg/wiki/Mirror_of_Names_and_Spiders

보상 트랙(레벨 1~100)도 시즌 7 아이템으로 채워진다 — 원문:

```wikitext
|1||{{Icons|Thread}}Thread x20
|2||{{Icons|Identity Training Ticket IV}}Identity Training Ticket IV x5
|3||Season 7 Uptie & Threadspinning only Shard (Universal) x5
|5||{{Icons|Extraction Ticket}}Extraction Ticket x1
|40||{{Icons|Decaextraction Ticket}}Decaextraction Ticket x1
|50||Season 7: Mirror of Names and Spiders Commemorative Banner
|80||[Season 7] 3★ Guarantee Decaextraction Ticket x1
|90||Season 7: Mirror of Names and Spiders Special Ticket Banner
```

질문에 있던 「Season 7 동기화·실뽑기 전용 조각」류 아이템 — **있다**. `Season 7 Uptie & Threadspinning only Shard (Universal) x5` 가 트랙 전체에 30회 반복된다.

**우리 데이터**

`canonical.reward` season=0 을 위키 트랙과 직접 대조:

| level | 위키 | 우리 DB |
|---|---|---|
| 1 | Thread x20 | Thread 20 ✔ |
| 2 | Identity Training Ticket IV x5 | Identity Training Ticket IV 5 ✔ |
| 3 | Season 7 Uptie & Threadspinning only Shard (Universal) x5 | 동일 5 ✔ |
| 5 | Extraction Ticket x1 | Extraction Ticket 1 ✔ |
| 40 | Decaextraction Ticket x1 | Decaextraction Ticket 1 ✔ |
| 50 | Season 7 … Commemorative Banner | 동일 ✔ |
| 80 | [Season 7] 3★ Guarantee Decaextraction Ticket | Season 7 3* Guarantee Decaextraction Ticket ✔ |
| 100 | Mirror of Names and Spiders - Special Ticket … | Mirror of Names and Spiders - Special Ticket ✔ |

레벨 1~100 트랙이 위키와 동일 계열이다. 원본 `__Season__` = `"7"`, 아이템명 `Season 7 …`, 위키 서술 셋이 모두 일치한다.

> **경미한 불일치 1건**: 레벨 4 가 위키는 `Identity Training Ticket IV x4`, 우리 DB 는 `count = 5` 다. 레벨 2 는 양쪽 다 5 다. 위키 편집자의 오타로 보이나 단정하지 않는다 — 게임 내 보상 목록 레벨 4 를 보면 갈린다. 시즌 판정에는 영향 없다.

**조치**

`src/v2/canonical/mirror.ts` 의 하드코딩을 고친다.
- `md__achievements.json` → season **7** (현재 0)
- `md__md6__achievements.json` → season 6 (현재도 6, 우연히 맞음)
- 근본 수정: `__Season__` 키를 `continue` 로 건너뛰지 말고 읽어서 그 값을 시즌으로 쓴다
- 영향 200행 (`reward` 100 + `achievement` 93). 마이그레이션 시 `season = 0 → 7` 일괄 갱신
- `canonical` 에 `mirror_dungeon` 메타(버전 `MD7` · 명칭 · totalFloors 15 · baseFloors 5)를 복원할 때 시즌 7 과 MD7 이 같은 것임을 명시한다 (감사 2.3 참조)

---

### 5. 역경(adversity)이 정말 11~15층에만 있는가 · `MD6LimitBaseN` 은 무엇인가

**판정** 확정 (단, **층 번호 표기가 1 어긋난다** — 아래)

**답** 역경은 **EXTREME 모드 전용**이고 위키는 「10층부터」로, 우리 데이터는 「11층부터」로 적는다. **같은 것을 다른 기준으로 부르는 것**이며 내용은 30/30 완전 일치한다. `MD6LimitBaseN` 은 역경 **시스템 자체의 표시명 라벨**(개별 역경이 아님)이다.

**근거**

```
From Floor 10 onwards, an optional choice of Adversities will be presented to the Manager
following each Floor clearance. These debuffs are typically more problematic than the
Mounting Trials. However, Adversities are completely optional - each Adversity grants a
number of Adversity Scores, with a maximum of 60 Adversity Score being possible if one
chooses every Adversity one comes across. At the end of each run, 15 Starlight and 15
Projection Rate will be granted for each Adversity Score one holds.

Adversities are fixed to each Floor, and unlike Mounting Trials, all Adversities available
to that Floor will be presented to be chosen from at the end of each Floor. All Adversities
are identical to the ones found in the Mirror of Immortality.
```

— https://limbuscompany.wiki.gg/wiki/Mirror_of_Names_and_Spiders (Mounting Adversities 절)

핵심은 **"following each Floor clearance"** · **"presented ... at the end of each Floor"** 다. 위키의 「Floor 10」 표는 **10층을 클리어한 직후 제시되는** 역경이고, 그 디버프는 11층부터 적용된다. 우리 데이터의 `floor_range = 11` 은 **적용되는 층**을 가리킨다. 두 표기는 모순이 아니라 기준점이 다르다.

그리고 **11~15층은 EXTREME 모드에서만 존재**한다:

> "After completing Floor 10, another popup will appear asking whether the Manager will enter 'Parallel Superposition EXTREME' ... Confirming extends the Mirror Dungeon run to 15 Floors, with Floors 11~15 featuring unique Long Battle Theme Packs, highly difficult Mounting Trials, and **Mounting Adversities** that puts severe limitations on the Sinners."

— https://limbuscompany.wiki.gg/wiki/Mirror_Dungeon

→ 1~10층에는 역경이 없다. `adversity` 30행이 11~15 다섯 층뿐인 것이 **옳다**.

**질문의 11층 6개 목록 — 맞다.** 위키 「Floor 10」 블록 원문:

```wikitext
|'''Floor 10'''
|Level Boost||All Enemy Levels +3||1
|Frailness||-10% Max HP for all allies||1
|Mark of Fire I||Turn End: all allies take 5 fixed HP damage...||2
|Inflation I||Doubles the cost of every Shop function, except for selling E.G.O Gifts||2
|Ego Interference I||Doubles the amount of E.G.O Resources consumed when using E.G.O Skills||2
|Force Redistribution||When an enemy is killed, it applies 3 Offense Level Up to all of its allies...||1
```

= 레벨 강화 · 쇠약 · 불의 낙인 I · 인플레이션 I · 에고 간섭 I · 전력 재분배. **정확히 6개, 순서까지 일치**한다.

**우리 데이터** — 30/30 전수 대조, 이름·순서·`value` 모두 일치

| 우리 `floor_range` | 위키 표 제목 | 6개 이름 (순서대로) | `value` (= Adversity Score) |
|---|---|---|---|
| `11` | Floor 10 | Level Boost · Frailness · Mark of Fire I · Inflation I · Ego Interference I · Force Redistribution | 1,1,2,2,2,1 ✔ |
| `12` | Floor 11 | Level Boost · Frailness · Mental Psychosis I · Nerve Acceleration I · SP Fatigue I · Psychological Elation | 1,1,2,2,3,2 ✔ |
| `13` | Floor 12 | Level Boost · Frailness · Tremor Barrier · Inflation II · Ego Interference II · Shield Generation | 1,1,2,3,3,3 ✔ |
| `14` | Floor 13 | Level Boost · Frailness · Vitality Boost · Brutality · Mark of Fire II · Fracture Proliferation | 1,1,2,3,3,3 ✔ |
| `15` | Floor 14 | Level Boost · Frailness · Mental Psychosis II · Nerve Acceleration II · SP Fatigue II · Status Infliction | 1,1,3,3,5,1 ✔ |

**결정적 교차 검증**: `value` 합계 = 9+11+13+13+14 = **60**. 위키의 `"with a maximum of 60 Adversity Score being possible if one chooses every Adversity one comes across"` 와 정확히 일치한다. → `adversity.value` 는 **역경 점수(Adversity Score)** 이며 30/30 정확하다. 감사 문서에 이 컬럼의 의미가 적혀 있지 않았다.

또 하나: `"All Adversities are identical to the ones found in the Mirror of Immortality"`(= MD6) 가 **왜 키가 `MD6Limit*` 인지**를 설명한다. 감사 6.2 절의 키 매핑 추정이 옳았음이 위키로 뒷받침된다.

**`MD6LimitBaseN` 은 무엇인가**

`raw.raw_object` 실측 (7행):

```
mechanics/limbus-assets/statuses.json  MD6LimitBaseN
  {"desc": "", "name": "Mounting Adversities", "buffType": "Negative"}
mirror-dungeon/loc-ko/Bufs_Mirror6.json  MD6LimitBaseN  name "추가되는 제약"
mirror-dungeon/loc-ja/Bufs_Mirror6.json  MD6LimitBaseN  name "追加される制約"
```

`desc` 가 빈 문자열이고 개별 효과가 없다. `name` 이 위키의 **절 제목 `==Mounting Adversities==` 와 같은 문자열**이다.

→ **개별 역경이 아니라 「역경 시스템」 전체를 가리키는 상위 상태이상 라벨**이다. 전투 화면에서 역경들을 묶어 표시하는 부모 아이콘/헤더에 해당한다. canonical 에 없는 것은 **정상**이며, 층별 누적 규칙 같은 것이 **아니다**.

**조치**

1. **`adversity.floor_range` 의 층 표기 기준을 문서에 명시한다.** 우리 값 11~15 는 「역경이 **적용되는** 층」이고, 게임 UI 는 10~14층 **클리어 직후**에 선택지를 띄운다. 트래커에서 「11층 역경」을 10층 클리어 시점에 보여줄지 11층 진입 시점에 보여줄지가 갈리므로 UX 결정이 필요하다. **권장**: 「10층 클리어 후 선택 → 11층부터 적용」으로 양쪽을 다 적는다
2. `adversity` 에 **EXTREME 모드 전용**임을 표시한다. 현재 스키마에 난이도/모드 컬럼이 없어, 일반·하드 런에서도 역경 화면이 뜰 것처럼 보인다
3. `adversity.value` 컬럼에 **「역경 점수(Adversity Score) · 합계 최대 60 · 점수당 별빛 15 + 투영률 15」** 라는 의미를 문서화한다. 트래커가 런 종료 보상을 계산해 줄 수 있는 값이다
4. `MD6LimitBaseN` 은 canonical 에 넣지 않는다. 다만 **역경 화면의 한국어 제목으로 「추가되는 제약」을 쓸 수 있다**(raw 에 ko·ja 존재)
5. 역경 이름 ko·ja 60건 거짓 결손(감사 6.2)은 위키가 아니라 raw 로 이미 확정 — 그대로 수복 진행

---

### 6. 업적 `[count]` 임계값

**판정** 확정

**답** 「상점 새로고침」은 **10·20·30·40·50회**이고 점수는 **20·40·60·80·100** 이다. 원본 `replace.count` 가 그대로 맞다. 화면 표기는 **횟수와 점수 둘 다** 나온다(조건문에 횟수, 보상란에 투영률).

**근거** — https://limbuscompany.wiki.gg/wiki/Mirror_of_Names_and_Spiders (Achievements List · Shop 탭)

위키는 `[count]` 를 **단계마다 별도 행으로 전개**해 적는다. 원문:

```wikitext
|In a single run, use the Shop Refresh function (including Keyword Refresh) 10 or more times and clear Mirror dungeon at Floor 5 or higher||{{Icons|MD7 Projection Rate}} 20
|In a single run, use the Shop Refresh function (including Keyword Refresh) 20 or more times and clear Mirror dungeon at Floor 5 or higher||{{Icons|MD7 Projection Rate}} 40
|In a single run, use the Shop Refresh function (including Keyword Refresh) 30 or more times and clear Mirror dungeon at Floor 5 or higher||{{Icons|MD7 Projection Rate}} 60
|In a single run, use the Shop Refresh function (including Keyword Refresh) 40 or more times and clear Mirror dungeon at Floor 5 or higher||{{Icons|MD7 Projection Rate}} 80
|In a single run, use the Shop Refresh function (including Keyword Refresh) 50 or more times and clear Mirror dungeon at Floor 5 or higher||{{Icons|MD7 Projection Rate}} 100
```

**우리 데이터**

`canonical.achievement` `shp_refresh` season 0: `points = {20,40,60,80,100}`, 텍스트 `"In a single run, use the Shop Refresh function (including Keyword Refresh) [count] or more times and clear Mirror Dungeon at Floor 5 or higher"`. 원본 `replace.count = [10,20,30,40,50]`.

→ 위키 5행과 **횟수·점수 모두 정확히 일치**. `[count]` ← `[10,20,30,40,50]` 확정.

다른 업적으로도 모델을 검증했다 — `replace` 배열 길이 = 단계 수 = `points` 길이가 성립한다:

| 업적 id | 우리 `points` | 위키 전개 행 | 일치 |
|---|---|---|---|
| `clr_any_count` | `{10,10,20,30,40,50}` | `Clear MD at Floor 5 or higher 5/10/20/30/40/50 time(s)` → 10,10,20,30,40,50 | ✔ (count = 5,10,20,30,40,50) |
| `clr_floors` | `{10,10,10,10,10,20,20,30,40,50,60,70,80,90,100}` | `Clear MD up to Floor 1…15 once` → 동일 15값 | ✔ (`[floor]` = 1..15) |
| `shp_purchase` | `{10,30,50,80,100}` | `purchase 10/20/30/40/50 or more E.G.O Gifts` → 10,30,50,80,100 | ✔ |
| `shp_enhance` | `{20,50,80}` | `carrying 5/10/20 or more Enhanced E.G.O Gifts` → 20,50,80 | ✔ |
| `shp_cost` | `{30,70,100}` | `with 1000/3000/5000 or more Cost` → 30,70,100 | ✔ |
| `shp_fuse` | `{40,80}` | `use the Fusion function at least 10/20 times` → 40,80 | ✔ |
| `col_clear_with_fusion` | `{10,50}` | `with 2+/10+ Fusion Recipe-only Tier 4 E.G.O Gifts` → 10,50 | ✔ |

> **경미한 불일치 1건**: `clr_hard_count` 는 우리 `points = {20,30,40}`, 위키는 `30, 30, 40` 이다. 단계 수(3)와 뒤 두 값은 같고 첫 값만 20 vs 30 이다. 원본 데이터가 20 이므로 **위키 편집자 오타로 추정**하되 단정하지 않는다 — 게임 내 달성도 → 클리어 탭의 「어려움 난이도로 5층 이상 1회 클리어」 보상 투영률을 보면 갈린다.

**조치**

- **ETL 을 고쳐 `replace` 를 적재한다.** `canonical.achievement` 에 `thresholds int[]`(또는 `replace jsonb`) 컬럼을 추가하고 원본 `replace.count` / `replace.floor` / `replace.skills` 를 담는다. 28건 대상
- 소비 측에서 `points[i]` ↔ `thresholds[i]` 를 짝지어 `[count]` 를 치환해 **단계별 행으로 전개**한다 (위키가 하는 것과 같은 형태). 그래야 영문조차 온전히 못 띄우던 28건이 살아난다
- 자리표시자는 `[count]` 하나가 아니다 — `clr_floors` 는 `[floor]`, `shp_replace` 는 `[skills]` 를 쓴다. 치환기를 키 이름 기준으로 일반화할 것
- 감사 6.3 절의 「그 28건은 영문조차 온전히 못 띄운다」는 원인 진단이 옳았다. 다만 **위키가 전개된 전문을 갖고 있으므로**, ETL 수정 전이라도 위키에서 183건 영문 전문을 긁어 대조·보완할 수 있다

---

### 7. `points`/`hard_only` 길이 불일치 5건

**판정** 확정

**답** **`points` 가 맞고 `hard_only` 가 틀렸다.** 위키가 전개한 단계 수는 5건 모두 `cardinality(points)` 와 같다. 그리고 「상점 기프트 구매」(`shp_purchase`)의 어느 단계에도 **어려움 난이도 전용 표기가 붙지 않는다.**

**근거**

먼저 위키가 hard 전용을 **어떻게 표기하는지** 확인했다 — 조건문 뒤에 접미사를 붙인다(Clears 탭 원문):

```wikitext
|Clear Mirror Dungeon at Floor 5 or higher 1 time(s) - every floor has to be in Hard Difficulty||30
|Clear Mirror Dungeon at Floor 5 or higher 5 time(s) - every floor has to be in Hard Difficulty||30
|Clear Mirror Dungeon at Floor 5 or higher 10 time(s) - every floor has to be in Hard Difficulty||40
```

이 접미사가 우리 `hard_only = true` 에 대응한다. 그런데 **Shop 탭 20행 전체에 이 접미사가 하나도 없다.** 「상점 기프트 구매」 5행 원문 전문:

```wikitext
|In a single run, purchase 10 or more E.G.O Gifts from Shops and clear Mirror Dungeon at Floor 5 or higher||{{Icons|MD7 Projection Rate}} 10
|In a single run, purchase 20 or more E.G.O Gifts from Shops and clear Mirror Dungeon at Floor 5 or higher||{{Icons|MD7 Projection Rate}} 30
|In a single run, purchase 30 or more E.G.O Gifts from Shops and clear Mirror Dungeon at Floor 5 or higher||{{Icons|MD7 Projection Rate}} 50
|In a single run, purchase 40 or more E.G.O Gifts from Shops and clear Mirror Dungeon at Floor 5 or higher||{{Icons|MD7 Projection Rate}} 80
|In a single run, purchase 50 or more E.G.O Gifts from Shops and clear Mirror Dungeon at Floor 5 or higher||{{Icons|MD7 Projection Rate}} 100
```

**5단계 전부 어려움 전용 표기 없음** — 질문에 대한 직접 답이다.

— https://limbuscompany.wiki.gg/wiki/Mirror_of_Names_and_Spiders (Achievements List · Shop 탭)

**우리 데이터** — 불일치 5건 전수

| 업적 id | `points` (len) | `hard_only` (len) | 위키 단계 수 | 위키의 hard 표기 | 판정 |
|---|---|---|---|---|---|
| `shp_purchase` | `{10,30,50,80,100}` (5) | `{f,f,f,t}` (4) | **5** | 없음 | `hard_only` 는 `{f,f,f,f,f}` 여야 한다. 4번째 `t` 는 오류 |
| `shp_cost` | `{30,70,100}` (3) | `{f,f}` (2) | **3** | 없음 | `{f,f,f}` |
| `shp_enhance` | `{20,50,80}` (3) | `{f,f,f,f}` (4) | **3** | 없음 | `{f,f,f}` — 뒤 1개 잉여 |
| `col_clear_with_fusion` | `{10,50}` (2) | `{f,f,t}` (3) | **2** | 없음 | `{f,f}` — 뒤 1개 잉여 |
| `clr_hard_count` | `{20,30,40}` (3) | `{t,t,t,t}` (4) | **3** | 전 단계 있음 | `{t,t,t}` — 뒤 1개 잉여, 값은 무해 |

**원인이 드러났다 — 시즌 6 배열의 잔재다.** 같은 id 의 season 6 행과 비교하면 명확하다:

```
shp_purchase season 6 : points {10,40,60,100}   (4)   hard_only {f,f,f,t} (4)   ← 길이 일치
shp_purchase season 0 : points {10,30,50,80,100}(5)   hard_only {f,f,f,t} (4)   ← points 만 갱신됨

shp_cost     season 6 : points {30,70}          (2)   hard_only {f,f}     (2)   ← 길이 일치
shp_cost     season 0 : points {30,70,100}      (3)   hard_only {f,f}     (2)   ← points 만 갱신됨

shp_enhance  season 6 : points {20,40,60,80}    (4)   hard_only {f,f,f,f} (4)   ← 길이 일치
shp_enhance  season 0 : points {20,50,80}       (3)   hard_only {f,f,f,f} (4)   ← points 만 줄어듦
```

즉 MD7 원본(`md__achievements.json`)을 만들 때 **`points` 는 갱신하고 `hard_only` 는 MD6 값을 그대로 복사한 것**이다. **원본(게임사) 측 데이터 오류**이며 canonical 은 원본을 정확히 옮겼다 — ETL 버그가 아니다.

**조치**

1. **`points` 를 단계 수의 기준으로 삼는다.** `cardinality(points)` = 실제 단계 수임이 5/5 검증됐다
2. `hard_only` 를 `points` 길이에 맞춰 정규화한다:
   - 긴 경우(`shp_enhance`·`col_clear_with_fusion`·`clr_hard_count`) → **뒤에서 잘라낸다**. 잘리는 값이 전부 잉여이므로 손실 없음
   - 짧은 경우(`shp_purchase`·`shp_cost`) → **`false` 로 채운다**. 위키가 Shop 탭 전 단계에 hard 표기가 없음을 확인했으므로 근거 있는 보정이다
   - `shp_purchase` 의 4번째 `true` 도 **`false` 로 정정**한다(위키 4단계에 hard 표기 없음). 이것만은 원본 값을 덮는 것이므로 `field_source` / 주석에 위키 근거를 남긴다
3. 정규화는 ETL 이 아니라 **소비 측 어댑터**에서 하고, 원본 값은 `raw` 에 그대로 둔다. 다음 시즌에 게임사가 고칠 수 있다
4. 불변식 `cardinality(points) = cardinality(hard_only)` 를 canonical 제약 또는 검증 리포트에 추가해 재발을 잡는다

---

## 부록 — 재현 방법

WebFetch 는 표를 요약해 버려 쓸 수 없다. MediaWiki API 로 원문을 받아야 한다.

```bash
curl -sL "https://limbuscompany.wiki.gg/api.php?action=parse&page=List_of_Floor_Themes&prop=wikitext&format=json&formatversion=2" \
  | python3 -c "import json,sys; print(json.load(sys.stdin)['parse']['wikitext'])"
```

층 배정 파싱은 `|-` 로 행을 쪼갠 뒤 `\[\[([^\]|]*Theme Pack)\|<span[^>]*>([^<]+)</span>\]\]` 로 팩명을, 그 다음 두 셀에서 Normal/Hard 층 범위(`4F-10F` 형식)를 읽으면 된다. 팩명 정규화 3건 필요:

```
'Line 4 - Section 3'          → 'Line 4 - Section #3'
'Line 4 - Section 4'          → 'Line 4 - Section #4'
"Who Couldn't Be Bloodfiends" → "Who Couldn't be Bloodfiends"
```

이 스크립트로 `floor_pack` 288행을 시즌 개편마다 재검증할 수 있다.

## 결과 요약

| # | 항목 | 판정 | 우리 데이터 |
|---|---|---|---|
| 1 | normal 구간 5개인가 | 확정 — 5개 | **옳다.** 문안만 수정 |
| 2 | 팩 1122 층 배정 | 확정 — 제거된 콘텐츠 | **옳다.** 결손 아님 |
| 3 | 교차 출처 13건 | 확정 — limbus-assets | **옳다.** 116/116 일치 |
| 4 | season 0 = 시즌 7 | 확정 — 시즌 7 | **틀렸다.** 200행 수정 |
| 5 | 역경 11~15층 · MD6LimitBaseN | 확정 | **옳다.** 층 표기 기준만 명시 |
| 6 | `[count]` 임계값 | 확정 — 10/20/30/40/50 | **미적재.** 28건 보강 필요 |
| 7 | 배열 길이 불일치 5건 | 확정 — points 가 기준 | **원본 오류.** 정규화 필요 |

**우리 데이터가 고쳐야 할 것은 4·6·7 세 건뿐이고, 1·2·3·5 는 데이터가 옳았다.**
