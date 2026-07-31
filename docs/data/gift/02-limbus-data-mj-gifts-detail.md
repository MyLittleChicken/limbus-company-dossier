# 회차 2 — `limbus-data-mj/gifts_detail.json`

> **기프트 상세** · `limbus-data-mj` · **441건** · 549 KB · 키 **4종**
> 출처 커밋 `774883d7` · 스냅샷 2026-07-25 · 정리 2026-07-31

## 파일 정체

`gifts.json` 과 id 집합이 완전히 같다(441/441). 키가 4종뿐이지만 **회차 1의 미룬 질문
두 개가 여기서 닫힌다** — 색 표기와 강화 단계다.

---

## 1. `attributeType` — `sin` 의 원본이다

```
SCARLET 77 · AZURE 65 · INDIGO 64 · VIOLET 62 · SHAMROCK 60 · AMBER 57 · CRIMSON 56
```

`mechanics/limbus-data-mj/sins.json` 으로 치환하면 `gifts.json` 의 `sin` 과
**441/441 완전 일치**한다. 분포까지 그대로다.

| 색 | 죄악 | 건수 |
| --- | --- | ---: |
| `SCARLET` | lust 색욕 | 77 |
| `AZURE` | gloom 우울 | 65 |
| `INDIGO` | pride 오만 | 64 |
| `VIOLET` | envy 질투 | 62 |
| `SHAMROCK` | gluttony 탐식 | 60 |
| `AMBER` | sloth 나태 | 57 |
| `CRIMSON` | wrath 분노 | 56 |

> **회차 1의 관측이 확정됐다.** `gifts.json` 의 `sin` 은 파생값이고 이 필드가 원본이다.

E.G.O 편 회차 2의 `requirements` 색 토큰과 같은 어휘이며, 같은 치환표를 쓴다.

**적재** — `Gift.attributeType`. 다만 변환기는 이 파일이 아니라 **assets 의 `affinity`**
에서 읽는다. 우리는 색 어휘를 죄악으로 되바꾸지 않는다(`02-data-model.md` 원칙 3).

## 2. `keyword` — `gifts.keyword` 와 어휘가 다르다

`gifts.json` 이 **기믹명**을 쓰는데 여기는 **상태명**이다. 12종이 1:1 대응하며
교차 오염이 0건이다.

| `gifts_detail` (상태명) | `gifts` (기믹명) | 건수 |
| --- | --- | ---: |
| `Laceration` | `bleed` | 52 |
| `Vibration` | `tremor` | 44 |
| `Burst` | `rupture` | 38 |
| `Sinking` | `sinking` | 37 |
| `Charge` | `charge` | 36 |
| `Breath` | `poise` | 34 |
| `Combustion` | `burn` | 31 |
| **`Hit`** | `blunt` | 21 |
| **`Slash`** | `slash` | 25 |
| **`Penetrate`** | `pierce` | 14 |

공격 타입 3종의 상태명이 `Hit` · `Slash` · `Penetrate` 다.
**`blunt` ↔ `Hit` 대응은 다른 어느 문서에도 없던 것**이다.

### 함정 — `null` 과 문자열 `"None"` 이 섞여 있다

```
JSON null      64건    90xx 32 · 97xx 15 · 92xx 6 · 94xx 5 · 98xx 4 · 91xx 2
문자열 "None"  45건    97xx 16 · 92xx 14 · 91xx 7 · 94xx 4 · 98xx 4
               ─────
               109건   = gifts.json 의 null 109건과 정확히 대응
```

같은 뜻을 두 가지로 쓴다. 인격 편 회차 9의 `"null"` 문자열 오타와 같은 계열이며,
`if (x.keyword)` 로 걸러야 한다 — `x.keyword !== null` 은 45건을 통과시킨다.

## 3. `upgrades` — 강화 단계

```
level 조합       ()       43건    상세가 아예 없다
                 (0,)    288건    강화 불가
                 (0,1)     3건
                 (0,1,2) 107건    완전 강화

항목 키   level · effect · effectKo · abilityIDs
```

### `enhanceable` 이 정확히 설명된다

```
assets enhanceable   110
upgrades 3개 107  +  2개 3   =   110      예외 0
```

`(0,1)` 3건은 **강화가 1단계까지만** 있다.

```
9192 덧붙인 반창고 · 9440 퍼레이드의 가면 · 9757 대양전 접지 플러그
```

### 상세가 빈 43건은 전부 `90xx` 다

```
빈 43건의 id 앞자리   {'90': 43}      90 대역 99건 중 43건
tier 분포             1:5 · 2:16 · 3:13 · 4:8 · 5:1
```

초기 기프트에 강화 상세가 없다. **결손이 아니라 강화 개념 도입 이전**으로 보인다.
`9011` 여우비 · `9008` 늘어붙은 쇠말뚝 등이 여기 든다.

### `abilityIDs` 는 덧셈이 아니라 **prefix** 규칙이다

```
9001  level 0  [9001,  90011]
      level 1  [19001, 190011]        "1" + 원본
      level 2  [29001, 290011]        "2" + 원본
```

자릿수가 섞여 있어(`9001` 4자리 · `90011` 5자리) 덧셈으로는 안 맞는다.
**문자열 앞에 단계 숫자를 붙인다.**

```
str(level) + str(base)   준수 594 / 615      위반 21
```

> 변환기 상수 `ENHANCE_ID_STRIDE = 10_000`(`src/entities/gifts.ts:17`)은
> **4자리 기프트 id 에만 맞는 근사**다. 로컬라이즈 파일의 강화 id 에는 통하지만
> `abilityIDs` 에는 통하지 않는다.

**위반 21건은 일부 원소만 강화되는 경우**다.

```
9075 충전식 장갑
  level 0  [9075,  90751,  90752,  90753]
  level 1  [9075, 190751, 190752, 190753]     ← 첫 원소가 그대로다
```

### `abilityIDs` 가 남을 가리키는 13건

| 기프트 | 참조 | 성격 |
| --- | --- | --- |
| `9224` 수작 | `9222` | 다른 기프트 |
| `9256`·`9257`·`9258`·`9259` | `98270` | 넷이 같은 것을 공유 |
| `9264` 수작 : 박제된 야성 | `92631` | 다른 기프트의 하위 id |
| `9268` 모든 것의 본능 | `92621` | 〃 |
| `9188`–`9191` (4건) | `19188` 등 | **자기 강화판 id 를 level 0 에 갖는다** |
| `9801` 강인환 · `9804` 물 속의 달 | `2066` · `2070` | **`2xxx` 대역** |

`9801`·`9804` 만 다른 번호 공간을 참조한다. **관측으로 남긴다** — 회차 3에서
assets 가 같은 것을 갖는지 본다.

## 4. `effect` · `effectKo` — `gifts.desc` 와 사실상 같다

```
level 0 effect == gifts.desc      395 / 398
```

어긋난 3건은 **영문 표현만 다르고 한국어는 글자까지 같다.**

| id | 기프트 | `gifts.desc` | `upgrades[0].effect` |
| --- | --- | --- | --- |
| `9721` | 은빛 시계 케이스 | `except` | `Not counting` |
| `9726` | 낙수의 잔 | **`excep`** | `No` |
| `9727` | 선불 시간 영수증 | `except` | `Not counting` |

**`9726` 의 `"excep"` 은 원본 오타다** — 단어가 잘렸다.

### 마크업 8종 — 리터럴 꺾쇠가 또 있다

```
<style="upgradeHighlight"> … </style>    798쌍     level 0 에는 0건
<noparse> … </noparse>                    54쌍
<혈귀> · <Bloodfiend>                      3쌍      ← 태그 아님
<기계 융화 생명체> · <Mechanical Amalgam>   1쌍      ← 태그 아님
```

`upgradeHighlight` 는 **강화로 바뀐 수치만** 감싼다. level 0 에 하나도 없는 것이 근거다.
강화 전후 비교 UI 를 데이터가 그대로 담고 있다.

`<혈귀>`·`<기계 융화 생명체>` 는 **소속명을 감싼 리터럴 꺾쇠**다.

```
9213 미니어처 대관람차   <혈귀>
9416 완전함             <기계 융화 생명체>
9440 퍼레이드의 가면     <혈귀>   (level 0 · 1 둘 다)
```

E.G.O 편 회차 8의 `<나사빠진 일격>` 과 같은 계열이며, `src/text.ts:193` 이
Unity 태그 화이트리스트만 지우므로 **우리 코드는 안전하다.**

---

## 이 파일은 전혀 읽히지 않는다

`src/entities/gifts.ts` 에 `gifts_detail` 참조가 **0건**이다.

| 개념 | 우리가 쓰는 출처 |
| --- | --- |
| `attributeType` | assets `affinity` |
| `keyword` | assets `keyword`(기믹명) |
| `upgrades` 텍스트 | `loc-*/EGOgift*.json` + `ENHANCE_ID_STRIDE` |

**한국어 강화 텍스트(`effectKo`)를 갖는 유일한 출처**인데 미적재다.
회차 5–7에서 로케일 파일이 같은 것을 갖는지 확인하면 갈린다.

| 회차 5–7 결과 | 뜻 |
| --- | --- |
| loc 도 강화 텍스트를 갖는다 | 이 파일은 중복. 지금 구조 유지 |
| loc 이 안 갖는다 | **이 파일이 한국어 강화 텍스트의 유일한 출처** |

---

## 함정 요약

1. `keyword` 가 `gifts.json` 과 **다른 어휘**다. 상태명 vs 기믹명
2. `null` 과 문자열 `"None"` 이 섞여 있다. **`!== null` 로 거르면 45건이 샌다**
3. `abilityIDs` 는 **prefix 규칙**이다. `+10000` 은 4자리 id 에만 맞는 근사
4. `upgrades` 가 빈 43건은 전부 `90xx` — **결손이 아니라 강화 도입 이전**
5. `9726` 낙수의 잔의 `gifts.desc` 가 `"excep"` 로 **잘려 있다**
6. `<혈귀>`·`<기계 융화 생명체>` 는 **마크업이 아니다.** 지우면 소속명이 사라진다

## 미해결

없다. 키 4종 전부 확정했다.

### 이월 질문 2건 해소

- ✔ **회차 1** `sin` 이 색의 변환본인가 — **맞다. 441/441 일치**
- ✔ **회차 1** `tier`·`enhanceable` 의 강화 단계 실체 — `upgrades` 배열 길이가 곧 그것

## 근거 재현

```
data/entities/gifts/limbus-data-mj/gifts_detail.json    441건 · 키 4종
data/entities/gifts/limbus-data-mj/gifts.json           sin · desc 대조
data/entities/gifts/limbus-assets/gifts.json            enhanceable 110 대조
data/entities/mechanics/limbus-data-mj/sins.json        색 치환표
src/entities/gifts.ts:17                                ENHANCE_ID_STRIDE
src/text.ts:193                                         MARKUP 화이트리스트
```
