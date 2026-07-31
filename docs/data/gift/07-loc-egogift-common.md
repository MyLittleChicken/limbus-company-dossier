# 회차 7 — `loc-*` 의 공용 기프트 파일 3종

> **공용 3파일** · `EGOgift.json` 75 · `EgoGiftCategory.json` 12 ·
> `MirrorDungeonEgoGiftLockedDesc.json` 64
> 출처 커밋 `774883d7` · 스냅샷 2026-07-25 · 정리 2026-07-31

---

## 1. `EgoGiftCategory.json` — **두 어휘를 잇는 공식 사전**

12건뿐이지만 **기프트 편에서 가장 중요한 파일**이다.
회차 1(기믹명)과 회차 2(상태명)의 대응이 여기 명시돼 있다.

| `id` (상태명) | `loc-ko` | `loc-en` (기믹명) |
| --- | --- | --- |
| `Combustion` | **화상** | Burn |
| `Laceration` | **출혈** | Bleed |
| `Vibration` | **진동** | Tremor |
| `Burst` | **파열** | Rupture |
| `Sinking` | **침잠** | Sinking |
| `Breath` | **호흡** | Poise |
| `Charge` | **충전** | Charge |
| `Slash` | **참격** | Slash |
| `Penetrate` | **관통** | Pierce |
| `Hit` | **타격** | Blunt |
| `None` | **범용** | Keywordless |
| **`Random`** | **무작위** | Random |

> 회차 2에서 실측으로 추론한 `Hit` ↔ `blunt` · `Penetrate` ↔ `pierce` 대응이
> **원본 사전으로 확인됐다.**

### 새 값 둘

**`Random`(무작위)** 은 `limbus-data-mj` · `limbus-assets` 어디에도 없다.
`grep` 으로 확인하니 **3로케일의 이 파일에만 존재**한다. 실제 기프트에 붙은 적이 없는
카테고리이거나, 상점 UI 의 「무작위」 선택지용으로 보인다.

**`None` = 「범용」** 이다. 회차 1에서 null 109건 · 회차 2에서 `null`+`"None"` 109건으로
본 그 값이며, 게임은 이것을 「없음」이 아니라 **「범용」**이라 부른다.

> `Gift.keywordId` 를 화면에 쓸 때 null 을 「없음」으로 표시하면 게임 표기와 다르다.

**적재** — 하지 않는다. `Keyword` 테이블이 별도로 있다.

## 2. `MirrorDungeonEgoGiftLockedDesc.json` — 미획득 시 표시 문구

```
64건 · 키 id · content · id 범위 9088–9841
앞자리   97xx 19 · 92xx 16 · 91xx 15 · 90xx 6 · 94xx 5 · 98xx 3
assets 와 교집합 64 · 로케일 전용 0
```

```
9088  "획득 기록 없음\n\n\n<획득 조건>\n- 상점 「E.G.O 기프트 합성」"
```

### 획득 조건 11종

| 건수 | 조건 |
| ---: | --- |
| **54** | 상점 「E.G.O 기프트 합성」 |
| 1 | 어떤 철학을 마주하기 |
| 1 | 당신의 운을 시험해 보세요! |
| 1 | 선택지 「확률과 선택」 |
| 2 | 선택지 / 저주 해제 「귀기 서린 환도」 |
| 2 | 선택지 / 저주 해제 「빛바랜 건틀릿」 |
| 2 | 선택지 / 저주 해제 「그날의 기록」 |
| 1 | 선택지 「아직 따뜻한 커피」 |

**「저주 해제」 3쌍이 회차 3의 `cursedPair`/`blessedPair` 3쌍과 정확히 대응한다.**

```
9227 귀기 서린 환도  ⇄  9228 신검합일
9229 빛바랜 건틀릿   ⇄  9230 황금빛 시간
9231 그날의 기록     ⇄  9232 가능성
```

### 64건이 전부 「상점에서 살 수 없는 기프트」다

```
packs 가 0개          64 / 64      ← 예외 없음
combinesFrom 보유      54 / 64      합성 기프트
assets hardonly       21 / 64
```

**회차 1에서 `9212` 모든 악의 끝이 「구매불가」였고 `packs: []` 였던 것**과 같은 구조다.
이 파일은 **상점 팩에 안 들어가는 기프트 64건의 획득 경로를 설명하는 문구 모음**이다.

> `packs` 가 0개인 기프트는 회차 1 기준 83건이다. 그중 64건이 여기 있고
> 나머지 19건은 이 문구가 없다.

**적재** — 하지 않는다. 획득 경로를 담는 모델이 없다.

## 3. `EGOgift.json` — **`loc-ko` 에만 파일이 없다**

```
loc-en   75건    loc-ja   75건    loc-ko   파일 자체가 없음
키       id · name · desc · abnormalityName
id       10xx 35 · 90xx 40
```

### 한국어 결손은 6건뿐이다

```
en 75건 중 ko 의 다른 EGOgift* 파일이 커버하는 것   69
  EGOgift_MirrorDungeon.json      40
  EGOgift_StoryDungeon.json       29

진짜 결손                                          6
```

| id | 이름(en 기준) | `loc-ja` |
| --- | --- | --- |
| `1017` | 희망찬 눈동자 | 있음 |
| `1031` | 용기의 조각 | 있음 |
| `1035` | 경화된 살점 | 있음 |
| `1036` | 경계하는 눈동자 | 있음 |
| `1045` | 파고드는 비늘 | 있음 |
| `1047` | 잘린 뱀 머리 | 있음 |

**일본어는 6건 다 갖는다. 한국어만 없다.**

전부 `10xx` 스토리 던전 대역이며 `limbus-assets/gifts.json` 456건에도 없다.
→ **한국어 표시 문자열이 어느 출처에도 없는 기프트 6건**이다.

`src/text.ts` 의 로케일 폴백(`backlog/02-locale-fallback.md`)이 이런 경우를 위해 있다.

### `abnormalityName` — 여기도 1건뿐

```
값 있음 1 / 75      ("강화 인간")
```

회차 6의 `EGOgift_StoryDungeon.json`(54건 중 1건)과 **같은 값 하나**다.
두 파일이 같은 기프트를 나눠 갖고 있으며, 환상체 유래를 붙이려다 만 흔적이다.

---

## 함정 요약

1. **`loc-ko` 에 `EGOgift.json` 이 없다.** 6건이 한국어 표시 문자열을 갖지 못한다
2. `None` 은 「없음」이 아니라 **「범용」**이다. 화면 표기가 갈린다
3. **`Random`(무작위)** 카테고리는 이 파일에만 있다. 실제 기프트에 붙지 않는다
4. `LockedDesc` 64건은 **전부 `packs` 가 0개**다 — 상점에서 살 수 없다

## 미해결

없다. 3파일 × 로케일 전부 확정했다.

### 이월 확인 2건

- ✔ **회차 2** `Hit`↔`blunt` · `Penetrate`↔`pierce` 대응 — **`EgoGiftCategory.json` 이 원본 사전**
- ✔ **회차 3** `cursedPair`/`blessedPair` 3쌍의 뜻 — 「저주 해제」 획득 경로

## 근거 재현

```
data/entities/gifts/loc-{en,ja}/EGOgift.json                     75건 (ko 없음)
data/entities/gifts/loc-{ko,en,ja}/EgoGiftCategory.json          12건 · 공식 사전
data/entities/gifts/loc-{ko,en,ja}/MirrorDungeonEgoGiftLockedDesc.json   64건
data/entities/gifts/limbus-data-mj/gifts.json                    packs · combinesFrom
data/entities/gifts/limbus-assets/gifts.json                     hardonly · 쌍
```
