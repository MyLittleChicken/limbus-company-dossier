# 회차 3 — `limbus-assets/gifts.json` + `shared-library` 대조

> **기프트 정본** · `limbus-assets` · **456건** · 610 KB · 키 **22종**
> `shared-library/gifts.json` 381건 · 키 12종
> 출처 커밋 `774883d7` · 스냅샷 2026-07-25 · 정리 2026-07-31

## 파일 정체

변환기가 **척추로 쓰는 파일**이다(`src/entities/gifts.ts:42`). mj 보다 **15건 많다.**

```
456 = mj 441 + 15
      9242 Bongy Plush          hidden
      9831–9839 (9건)           Sea Terror 계열
      9991–9995 (5건)           Vestige · tier 1–5
```

---

## 1. `names` · `descs` — 강화 단계별 배열

```
길이 1  346건   ·  길이 2  3건  ·  길이 3  107건
```

`enhanceable` 110 = 길이 3인 107 + 길이 2인 3. **예외 0** — 회차 2의 `upgrades` 와 같은 구조다.

| | mj `upgrades` | assets `names`/`descs` |
| --- | --- | --- |
| 강화 3단계 | 107 | 107 |
| 강화 2단계 | 3 | 3 |
| 강화 없음 | 288 | **346** |
| 상세 자체가 없음 | **43** | — |

**assets 는 빈 43건도 길이 1로 채운다.** `346 = 288 + 43 + 15`.

## 2. `affinity` — 죄악이다. 색이 아니다

```
lust 83 · pride 67 · gloom 65 · envy 64 · gluttony 61 · sloth 58 · wrath 58
```

회차 2에서 확인했듯 **원본 어휘는 색**이고 이 필드는 죄악으로 되바꾼 값이다.
그래서 변환기는 이 필드를 쓰지 않고 **mj `gifts_detail.attributeType` 을 읽는다**.

```ts
// src/entities/gifts.ts:46
// **원본은 죄악이 아니라 색을 기록한다.** 정본(`limbus-assets`)의 `affinity` 는 그 색을
// 죄악으로 되바꾼 값이라 원본 어휘가 아니다. 색을 그대로 담은 곳은 보강 출처의
// `gifts_detail.json` 뿐이므로 거기서 가져온다. 변환은 우리가 하지 않는다.
```

### 4건이 어긋나고 **assets 가 전부 틀렸다** (2026-07-31 게임 확인)

`sins.json` 으로 치환해 대조하면 **437/441** 이 맞고 4건이 다르다.

| id | 기프트 | mj `attributeType` | assets `affinity` | **게임** |
| --- | --- | --- | --- | --- |
| `9038` | 환상 사냥 | AZURE (우울) | `envy` (질투) | **우울** ✓ mj |
| `9111` | 생체 맹독 바이알 | AMBER (나태) | `pride` (오만) | **나태** ✓ mj |
| `9404` | 갇힌 구더기 | SHAMROCK (탐식) | `sloth` (나태) | **탐식** ✓ mj |
| `9707` | 반짝이는 폐품 | AMBER (나태) | `wrath` (분노) | **나태** ✓ mj |

> **mj 가 4/4 전부 맞다.** 현재 적재(`Gift.attributeType` ← mj)가 정확하다.

변환기 주석이 옳았음이 증명됐다 — "assets 의 `affinity` 는 그 색을 죄악으로 되바꾼
값이라 원본 어휘가 아니다". **되바꾸기가 실제로 4건 실패했다.**

**이 4건은 색→죄악 변환을 하면 안 되는 이유의 실증**이다. 원본 색을 그대로 두는
`02-data-model.md` 원칙 3이 여기서 값을 지켰다.

## 3. `tier` · `keyword` — mj 와 어휘가 같다

```
tier      "1" 58 · "2" 139 · "3" 136 · "4" 119 · "5" 2 · "EX" 2
keyword   Bleed 52 · Tremor 45 · Rupture 39 · Sinking 38 · Charge 36 · Poise 35
          Burn 31 · Slash 25 · Blunt 21 · Pierce 14 · Keywordless 120
```

**대문자 시작**이라 소문자로 정규화해야 조인된다(`normalizeKeyword`).
`Keywordless` 120건 = mj null 109 + assets 단독 15 중 11건.

`tier 5` 가 2건인데 mj 는 1건이다 — `9995` Lunar Vestige 가 assets 단독이다.

## 4. `effects` · `triggers` — 엔진 어휘의 출처

```
effects   55종 · 451건 보유
triggers  150종 · 451건 보유
```

```
effects   Deal More Damage 158 · Gain Skill Power 114 · Gain Buff 101
          Gain Offense Level Up 73 · Other Uncommon Effects 58
triggers  Always 94 · Deployment Position 63 · Other Uncommon Triggers 44
          Clash Win 40 · Enemy Defeated 33 · Bleed Skill Used 22
```

`lib/engine/vocab.ts:242` `mapTrigger` 가 **이 문자열을 정규식으로 파싱**해 `Condition` 을 만든다.
`08-gimmick-keywords.md` 4.2 의 엔진 과대 계상이 `Tremor Skill Used` 계열 25건에서 나왔는데,
그 원본이 여기다.

> `Other Uncommon Effects` 58 · `Other Uncommon Triggers` 44 는 **출처가 이미 뭉뚱그린 것**이다.
> 파싱으로 되살릴 수 없다. mj 의 `requires` 구조(회차 1)가 이 자리를 메울 후보다.

## 5. 융합 그래프 — assets 가 표현력이 더 크다

```
mj combinesFrom  59      assets recipes      60
mj fusesInto    132      assets ingredientOf 142
```

겹치는 59건은 **값까지 완전 일치**하고 `fusesInto` 132건도 값이 전부 같다.

### `9083` 달의 기억 — 유일한 대체 슬롯 레시피

assets 만 갖는 1건이며, **레시피 안에 객체가 들어간다.**

```json
{ "count": 2, "options": ["9105","9110","9116","9121","9126","9131","9136"] }
```

**7개 중 아무거나 2개**를 넣는 레시피다. mj `combinesFrom` 은 고정 배열만 담을 수 있어
**이 레시피를 표현할 수 없다** — 그래서 mj 에 없다.

`ingredientOf` 가 10건 더 많은 것도 같은 이유다. 그 7개 후보 + `9142` 가 mj 쪽에서
`fusesInto` 를 갖지 못한다.

**적재** — `FusionRecipe` · `FusionSlotOption`. 슬롯이 객체면 대체 후보를 펼친다
(`src/entities/gifts.ts:150`).

## 6. `exclusiveTo` · `hardonly` — 회차 1에서 본 것

```
exclusiveTo 230   (mj uniquePacks 171 의 상위집합, 겹치는 171건 값 동일)
hardonly    116   (mj 53 과 양방향 불일치 65건 — backlog/08)
```

## 7. 소수 키 7종

| 키 | 건수 | 뜻 |
| --- | ---: | --- |
| `events` | 218 | 6자리 이벤트 id · 유일 156종 |
| `imageOverride` | 19 | 애셋 파일명 보정 — `"Devil_s Share"` 처럼 `'` 를 `_` 로 |
| `hidden` | 5 | `9242` + `9256`–`9259`. mj 에는 `9242` 만 없다 |
| `vestige` | 5 | `9991`–`9995` **전부 mj 에 없다** · tier 1–5 |
| `cursedPair` · `blessedPair` | 3 + 3 | **서로를 가리키는 쌍** |
| `updated` | 1 | `9841` C형 정리 요원 장비 세트 |

### 저주 / 축복 쌍 3세트

```
9227 귀기 서린 환도   ⇄  9228 신검합일
9229 빛바랜 건틀릿    ⇄  9230 황금빛 시간
9231 그날의 기록      ⇄  9232 가능성
```

`cursedPair` 와 `blessedPair` 가 **서로를 참조**한다. mj 에는 이 관계가 없다.
**미적재**이며 `Gift` 모델에 자리가 없다.

## 8. `srcPath` — id 로 추정하면 안 된다

```
이름 문자열   381건    "Hellterfly’s Dream" · "Dark Vestige"
id 와 같은 숫자 75건    "9282"
id 와 다른 숫자  0건
```

`prisma/schema.prisma:490` 주석이 정확하다 — "애셋 스프라이트 키. **애셋을 id로 추정해
찾으면 안 된다.**" 381건이 이름 기반이다.

`imageOverride` 19건은 그 이름에 파일 시스템 금지 문자가 있을 때 쓰는 보정이다.

## 9. `search_desc` — 토큰을 푼 사본

`descs[0]` 에서 `[DawnLight]` 같은 토큰을 표시명(`Dawnherald`)으로 바꾸고 `<noparse>` 를
지운 검색용 문자열이다. **456건 전부 보유.**

우리는 쓰지 않는다 — `substituteTokens` 로 직접 만든다.

---

## `shared-library` 대조 — 구버전 시간축

```
assets 456   shared 381   shared 에만 0건
shared 키 12종 · assets 키 22종
```

### assets 가 나중에 얻은 키 10종

```
affinity · effects · triggers · events · ingredientOf · srcPath
hidden · cursedPair · blessedPair · updated
```

**`affinity` 가 구버전에 아예 없다.** 죄악 표기가 나중에 붙었다는 뜻이며,
회차 2의 "색이 원본" 판정과 맞는다.

`effects`·`triggers` 도 나중에 생겼다 — **엔진이 쓰는 어휘가 도구 쪽 후발 산물**이다.

### 없는 75건이 전부 `92xx` 다

```
shared 에 없는 75건의 id 앞자리   {'92': 75}
92 대역 81건 중 6건만 shared 에 있다
```

`92` 대역이 최근 추가됐다. 인격·E.G.O 편에서 본 "구버전 스냅샷" 과 같은 성격이지만,
여기서는 **한 대역이 통째로 빠진다.**

### 공통 381건의 변화

| 키 | 다른 건수 | 방향 |
| --- | ---: | --- |
| `affinity` | 381 | 구버전에 키 자체가 없다 |
| `exclusiveTo` | **167** | 추가 238 · 제거 216 — **양방향** |
| `descs` | 68 | 길이는 같고 **내용만** 바뀜 |
| `hardonly` | 45 | **전부 assets 만 `true`** — 단조 증가 |
| `tier`·`keyword`·`names`·`enhanceable` | **0** | 안 바뀐다 |

`exclusiveTo` 가 양방향으로 크게 흔들린다 — 테마 구성이 실제로 재편됐다는 뜻이다.
`hardonly` 는 한 방향이라 **갱신을 따라간 것**으로 읽힌다(회차 1의 mj 결손 69건과 같은 이야기).

---

## 함정 요약

1. `affinity` 는 **죄악이다.** 되바꾸기가 **4건 실패**했으므로 원본 색(mj)을 써야 한다
2. `keyword` 가 **대문자 시작**이다. 소문자로 정규화하지 않으면 조인이 깨진다
3. `srcPath` 는 **381건이 이름**이다. id 로 애셋을 찾으면 안 된다
4. `recipes` 슬롯에 **객체가 섞인다**(`9083`). 문자열로 가정하면 깨진다
5. `Other Uncommon Effects/Triggers` 는 **출처가 이미 뭉갠 것**이다. 되살릴 수 없다
6. `shared-library` 는 `92` 대역이 통째로 없다 — 75건

## 미해결

없다. 키 22종 전부 확정했다.

### 게임 확인으로 닫은 것 1건

- ✔ `affinity` ↔ `attributeType` 4건 불일치 — **mj 가 4/4 정답.** assets 의 색→죄악
  되바꾸기가 실패한 것이며 현재 적재가 정확하다

## 근거 재현

```
data/entities/gifts/limbus-assets/gifts.json         456건 · 키 22종
data/entities/gifts/shared-library/gifts.json        381건 · 키 12종
data/entities/gifts/limbus-data-mj/gifts.json        441 대조
data/entities/gifts/limbus-data-mj/gifts_detail.json attributeType 대조
data/entities/mechanics/limbus-data-mj/sins.json     색 치환표
src/entities/gifts.ts:42,46,150                      척추 · attributeType · 슬롯
lib/engine/vocab.ts:242                              mapTrigger
```
