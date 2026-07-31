# 회차 9 — assets 부속 4종

> **척추 4파일** · `alt_names.json`(231건 · 11.3 KB) · `identity_tag_list.json`(95항목 · 1.9 KB) ·
> `identity_header_offsets.json`(105건 · 2.9 KB) · `identity_keyword_modifiers.json`(3건 · 0.5 KB)
> 출처 커밋 `774883d7` · 스냅샷 2026-07-25 · 정리 2026-07-30

## 파일 정체

**`limbus-assets` 구조 파일의 마지막 회차다.** 네 파일 모두 작고, 인격 본체를 보조하는
부속 메타를 담는다. 셋은 미적재이고 하나(`identity_tag_list`)만 적재된다.

```
alt_names.json                    커뮤니티 별칭 사전. 인격 + E.G.O
identity_tag_list.json            태그 마스터 목록.  → affiliation.id
identity_header_offsets.json      초상 이미지 표시 오프셋
identity_keyword_modifiers.json   조건부 기믹 큐레이션 3건
```

### 대조한 출처

| 출처 | 무엇을 대조했나 |
| --- | --- |
| `limbus-assets/identities.json` | `tags` 집합 · 어느 인격에 별칭·오프셋이 있는가 |
| `limbus-data-mj/egos.json` | `alt_names` 의 E.G.O 대역 110건 |
| `limbus-data-mj/identities.json` | `egoKeywords` 와 `keyword_modifiers` 의 겹침 |
| `lib/queries/search.ts` | 별칭이 검색에 쓰이는가 |

---

## `alt_names.json` — 커뮤니티 별칭 사전

| | |
| --- | --- |
| 타입·실측 | 최상위 객체(키 = 인격 **또는 E.G.O** id) · **231건** |
| 대역 | **인격 121 · E.G.O 110** (둘 다 아닌 것 0) |
| 값 | `String[]` · 인격 기준 개수 1:72 · 2:37 · 3:8 · 4:3 · 6:1 |
| 변환 | — |
| 적재 | **미적재** |
| 화면 | 미표시 |

**인격과 E.G.O를 한 파일에 담는다.** E.G.O는 110/110 전부 있고, **인격은 121/184만** 있다.

```
20101 오감도        → ["Base"]
20102 4번째 성냥불   → ["Scorched Girl"]        E.G.O 원본 환상체 이름
20104 차원찢개       → ["Wayward Passenger"]
```

세 갈래가 섞인다.

```
원작 인물명       Kromer · Guido · Araya · Scorched Girl · Queen of Hatred
축약형           NSang · WShu · KoD · QoH · HoS
띄어쓰기 변형     "NSang" 과 "N Sang" 을 둘 다 담는다
```

**최다 6개**

```
10415 거미집의 검      ["Araya","Dihui Star","Shiomi Yoru","HoS","Labubu","BOTHOS"]
10913 눈물로 벼려낸 검  ["Knight of Despair","KoD","KoDya","KoDion"]
10412 경멸, 경외       ["Jia Huan","Spiral of Contempt","NShu","N Shu"]
10713 W사 4등급 CCA   ["WHeath","W Heath","WCliff","W Cliff"]
```

`10415` 의 `"Dihui Star"` 는 회차 5에서 본 특성 키워드(지혜성)와 같은 문자열이다 —
별칭과 태그가 같은 어휘를 쓰는 자리가 있다.

**별칭이 없는 63건은 협회·기업 계열이다.**

```
10102 남부 세븐 협회 6과 · 10108 남부 디에치 협회 4과 · 10109 약지 점묘파 스튜던트 ·
10112 남부 리우 협회 3과 · 10205 남부 츠바이 협회 4과 · 10209 워더링하이츠 버틀러 …
```

원작 인물이 아니라 조직원 인격이라 별칭이 붙지 않은 것으로 읽힌다.

**함정 — 우리 검색이 이 파일을 쓰지 않는다.** `lib/queries/search.ts` 는
`identity_text.name` 만 본다. `Kromer` 로 검색해도 `쥐는 자`(`10204`)가 나오지 않는다.
영어권 사용자가 흔히 쓰는 이름이 전부 빠진다.

---

## `identity_tag_list.json` — 태그 마스터 목록

| | |
| --- | --- |
| 타입·실측 | **배열** · **raw 95항목** |
| 유일 문자열 | **94종** — `"The Wild Hunt"` 가 완전 동일 문자열로 2번 |
| 마크업 제거 후 | **93종** — `"Jia Family"` 의 마크업/비마크업 쌍 |
| 변환 | `stripMarkup` 후 빈 문자열 제외, `affiliationIds` 집합 (`src/entities/identities.ts:76`) |
| 적재 | `affiliation.id` |
| 화면 | 목록 "소속" 필터 · 상세 "소속" 패널 |

```
raw 배열      95항목
유일 문자열    94종      "The Wild Hunt" × 2      원본 목록의 실수
마크업 제거     93종      "Jia Family" × 2         하나는 <color=#d40000><s> 로 감싸짐
```

`identities.json` 의 `tags` 와 **유일 문자열 기준 94종으로 동일**하다(양쪽 차집합 0).
따라서 이 파일은 **중복 정보**이며, 존재 이유는 도구가 필터 목록을 만들 때 인격을 순회하지
않고 바로 읽기 위한 것으로 보인다.

> **회차 6 정정 취소.** 회차 6에서 "회차 1이 95항목이라 적었는데 실제 94항목"이라고 적었으나
> 그 정정이 틀렸다. `Set` 으로 비교해 유일 문자열 수를 raw 항목 수로 착각했다.
> **회차 1이 맞았다.**

마크업 5종은 스포일러 취소선이다 — `Great Sister` · `Jia Family` · `Le Sette Famiglie` ·
`Maestro` · `Sottocapo`. 그중 2종은 닫는 태그가 `</s>` 가 아니라 `<s>` 로 깨져 있으며,
`stripMarkup` 이 태그 단위로 지우므로 함께 처리된다(회차 1 함정 3).

---

## `identity_header_offsets.json` — 초상 표시 오프셋

| | |
| --- | --- |
| 타입·실측 | 최상위 객체(키 = 인격 id) · **105건** · 전부 인격 대역 |
| 값 | `[String\|null, String\|null]` — 길이 2 고정 |
| 패턴 | `[str,str]`:64 · `[null,str]`:24 · `[str,null]`:17 |
| 값 종류 | `20%`:88 · `10%`:42 · `40%`:11 · `15%`:10 · `50%`·`60%`·`70%`:4 · `0%`·`25%`·`30%`·`80%`·`90%`:1 |
| 변환 | — |
| 적재 | **미적재** |
| 화면 | 미표시 |

**초상 이미지를 자를 때 쓰는 오프셋**이다. 두 값은 축이 다른 것으로 보이며(가로/세로 또는
두 종류 이미지), `null` 은 "보정 없음"이다.

**184건 중 105건만 있다.** 나머지 79건은 기본 위치로 충분한 것이다.

값이 `10%`·`20%` 에 몰려 있고(130/141) 극단값은 `90%` 1건뿐이다.

**함정 — 문자열 `"null"` 이 하나 섞여 있다.**

```
10701 LCB 수감자 (히스클리프)   ["null", "20%"]
```

다른 24건은 JSON `null` 인데 **이것만 문자열 `"null"`** 이다. 원본 오타이며,
쓰는 쪽에서 `x === null` 로 검사하면 이 값이 통과해 `"null"` 을 오프셋으로 해석하게 된다.

우리는 이 파일을 쓰지 않는다. `Icon` 컴포넌트가 고정 크기로 그리므로
(`app/[locale]/identities/[id]/page.tsx:80`), 오프셋을 쓰면 초상이 더 잘 잘릴 것이다.

---

## `identity_keyword_modifiers.json` — 조건부 기믹 큐레이션

| | |
| --- | --- |
| 타입·실측 | 최상위 객체(키 = 인격 id) · **3건** |
| 값 | `[{keyword, conds:[{type, id}], allowInSolver?}]` |
| 변환 | — |
| 적재 | **미적재** |
| 화면 | 미표시 |
| 상세 | `../../08-gimmick-keywords.md` 5.2 |

**회차 1에서 이미 전수 분석한 파일이다.**

```
10110 엄숙한 애도 이상    Tremor  ← ego 20109 엄숙한 애도
10508 검계 우두머리      Bleed   ← ego 20509 착영휘도[着影揮刀]
11009 새벽 사무소 해결사   Tremor  ← gift 9282 날개 모양 양초    allowInSolver: false
```

회차 1·6·7을 거치며 확인된 것:

| | |
| --- | --- |
| 조건 유형 | `ego` 2건 · `gift` 1건. `conds` 가 배열이라 복수 조건도 담을 수 있다 |
| `allowInSolver` | `11009` 만 `false` — 상류 도구가 추천 계산에서 빼라고 표시. 기프트는 런마다 달라져 고정 전제로 못 쓴다 |
| mj 대응 | `egoKeywords` 1건(`10110`)만 겹친다. **합집합이 필요하다** |

**함정 — 큐레이션이라 자동 감지가 안 된다.** 회차 7이 `10104` 의 진동 제외가 패치로 생긴 것을
보였듯, 이 3건도 패치로 늘어날 수 있다. 그때 원본이 파일을 갱신해주지 않으면 우리는 모른다.

`docs/backlog/07-report-artifact.md` 의 리포트 산출물이 있으면 **파일 크기·건수 변화로
감지**할 수 있다.

---

## 함정 요약

1. `alt_names` 는 **인격과 E.G.O를 한 파일에** 담는다. 인격은 121/184만 있다
2. **우리 검색이 별칭을 쓰지 않는다.** `Kromer` 로 `쥐는 자` 를 못 찾는다
3. `identity_tag_list` 는 **raw 95 · 유일 94 · 마크업 제거 93** 이다. `"The Wild Hunt"` 가 완전 중복
4. `identity_tag_list` 는 `identities.json` 의 `tags` 와 같은 집합이라 **중복 정보**다
5. `header_offsets` 의 `10701` 에 **문자열 `"null"`** 이 들어 있다 — 원본 오타
6. `keyword_modifiers` 는 **큐레이션이라 자동 감지가 안 된다**

## 미해결

없다. 4파일 전부 확정했다.

### 다른 문서 정정

- **회차 6** — `identity_tag_list` 항목 수 정정을 취소했다. 회차 1이 맞았다

## 근거 재현

```
data/entities/identities/limbus-assets/alt_names.json                별칭 231건
data/entities/identities/limbus-assets/identity_tag_list.json        태그 95항목
data/entities/identities/limbus-assets/identity_header_offsets.json  오프셋 105건
data/entities/identities/limbus-assets/identity_keyword_modifiers.json  조건부 3건
data/entities/identities/limbus-assets/identities.json               tags 집합 대조
data/entities/egos/limbus-data-mj/egos.json                          E.G.O 대역 확인
lib/queries/search.ts                                                검색 경로
```
