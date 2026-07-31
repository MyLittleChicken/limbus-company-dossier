# 회차 1 — `limbus-data-mj/gifts.json`

> **E.G.O 기프트 본체** · `limbus-data-mj` · **441건** · 596 KB · 키 **15종**
> 출처 커밋 `774883d7` · 스냅샷 2026-07-25 · 정리 2026-07-31
> **기프트 편(회차 1–8)의 첫 회차**

## 파일 정체

거울 던전에서 얻는 E.G.O 기프트다. `limbus-assets` 가 **456건**을 갖는 데 비해
mj 는 441건으로 **15건이 적다**(`9242` · `9831`–`9839` · `9991`–`9995`).

```
id 대역   90xx 99 · 91xx 100 · 92xx 81 · 94xx 28 · 97xx 99 · 98xx 34
          93 · 95 · 96 대역은 비어 있다
```

인격(`1xxxx`)·E.G.O(`2xxxx`)가 5자리인데 **기프트는 4자리**다.

---

## 키 15종

### 1. `id` — 기본키

`9001`–`9843` · 유일 441 · 결손 0.

### 2·3. `name` · `nameKo` — 이름

**441건 전부 유일하다.** 중복이 0이다.

| 엔티티 | 이름 중복 |
| --- | --- |
| 인격 | 있음 |
| E.G.O | **32종** (같은 환상체에서 뽑았기 때문) |
| **기프트** | **0** |

**기프트는 이름으로 식별할 수 있다.** 다른 편과 다른 성질이다.

### 4·5. `desc` · `descKo` — 설명

결손 0 · 441건 전부 유일. mj 가 한국어를 인라인으로 갖는다.

`<noparse>` 마크업이 소속명을 감싼다 — `<noparse>새벽 사무소</noparse>`.

### 6. `tier` — 등급

**문자열이다.** 정수가 아니다.

```
"1" 57 · "2" 138 · "3" 133 · "4" 110 · "5" 1 · "EX" 2
```

`limbus-assets` 와 **441/441 일치**한다. 화면은 **로마 숫자**로 표시한다 — 게임에서
`9226` 은 「Ⅱ」, `9211` 은 「Ⅳ」다.

### 7. `keyword` — 기믹 또는 공격 타입

**10종이지만 `08-gimmick-keywords.md` 의 기믹 축 10종과 다르다.**

```
기믹 7      bleed · burn · charge · poise · rupture · sinking · tremor
공격 타입 3  blunt · pierce · slash
null       109건
```

| | 기믹 축(08 문서) | 기프트 `keyword` |
| --- | --- | --- |
| 공통 7 | bleed burn charge poise rupture sinking tremor | 〃 |
| 08 문서에만 | **ammo · protection · bloodfeast** | — |
| 기프트에만 | — | **blunt · pierce · slash** |

`prisma/schema.prisma:476` 주석이 이미 정확하다 — "상태 키워드 7종 또는 공격 타입 3종".

**null 109건은 결손이 아니다.** `limbus-assets` 가 같은 자리에 `"Keywordless"` 를 쓴다
(109/109 대응). 변환기가 `normalizeKeyword` 로 `null` 에 접는다(`src/text.ts:255`).

한국어 표기는 게임 화면에서 확인했다 — `poise` = **호흡**, `sinking` = **침잠**.

### 8. `sin` — 죄악

죄악 7종 · null 0.

```
lust 77 · gloom 65 · pride 64 · envy 62 · gluttony 60 · sloth 57 · wrath 56
```

**원본은 색으로 기록한다.** `gifts_detail.json` 의 `attributeType` 이 `CRIMSON`·`SCARLET`
계열이며, 이 필드는 그것을 죄악으로 되바꾼 값으로 보인다. **회차 2에서 대조해 판정한다.**

우리는 색 어휘를 그대로 둔다(`Gift.attributeType`, 02-data-model 원칙 3).

### 9. `cost` — 거울 던전 획득 비용

```
140 – 999
```

**게임 화면의 「코스트」와 그대로 일치한다.** 세 건을 화면과 대조했다.

| id | 기프트 | 데이터 | 게임 화면 |
| --- | --- | ---: | --- |
| `9226` | 누군가의 푸른 검 | 199 | 코스트 199 |
| `9211` | 먹장구름 | 404 | 코스트 404 |
| `9212` | 모든 악의 끝 | 399 | 코스트 399 **[구매불가]** |

`9212` 가 「구매불가」인 것은 **합성 전용**이기 때문이다 — `packs` 가 0개다(아래 11).

등급이 비용 구간을 가른다.

```
tier 1   140–165      tier 2   147–249      tier 3   150–404
tier 4   373–450      tier 5   600 (1건)    tier EX  999 (2건)
```

**적재** — `Gift.mdCost`. assets 에 없으므로 **15종은 빈다**(`src/entities/gifts.ts:6`).

### 10. `hardOnly` — 하드 난이도 전용

**53건이 `true`. 그런데 `limbus-assets` 는 116건이다.** → 12절에서 다룬다.

### 11·12. `packs` · `uniquePacks` — 팩 소속과 테마 한정

```
packs        유일 117개 · 항목당 0–90개 · 빈 것 83건
uniquePacks  171건 보유 · 항목당 최대 7개 · uniquePacks ⊆ packs (예외 0)
pack id      1001 – 3001
```

`uniquePacks` 는 **그 테마에서만 나오는 기프트**를 뜻한다. 게임 화면과 개수까지 맞는다.

| id | 데이터 `uniquePacks` | 게임 화면 |
| --- | --- | --- |
| `9226` | `[1026]` | '검과 작품' **한정** |
| `9211` | `[1314, 1410]` | '가라앉은 우울', '침잠쇄도' **한정** |
| `9212` | `[]` | '기어오는 심연' **한정** ← **mj 가 비었다** |

`limbus-assets` 의 `exclusiveTo` 는 `9212` 에 `['1014']` 를 갖는다.

```
mj uniquePacks   171          assets exclusiveTo   230
mj ⊆ assets      예외 0
겹치는 171건     값까지 100 % 동일
```

> **assets 가 상위집합이고 게임과 맞는다.** mj 는 59건이 비어 있다.

**적재** — `packs` → `GiftPack`(**정본에 없는 단일 출처**), `uniquePacks` → 미적재.
`GiftExclusivePack` 은 assets `exclusiveTo` 에서 온다.

### 13·14. `combinesFrom` · `fusesInto` — 융합 그래프

```
combinesFrom  59건 · 배열의 배열 (레시피 여러 개 가능) · 길이 1이 51 · 2가 8
fusesInto    132건 · 정수 배열 · 길이 1이 104 · 2가 28
참조 깨짐 0
```

`9212` 모든 악의 끝이 `combinesFrom [[9427, 9428]]` 을 갖고, 게임도 **「합성 기프트」**로
표기한다. 마을을 지킬 작살 + 고래의 심장 → 모든 악의 끝이다.

**적재** — `FusionRecipe`·`FusionSlotOption` 은 **assets `recipes`** 에서 온다. 회차 3에서 대조한다.

### 15. `requires` — 구조화된 발동 조건 126건

| 하위 키 | 건수 | 형태 | 표본 |
| --- | ---: | --- | --- |
| `slots` | 60 | 정수 배열 | `9075` 충전식 장갑 `[1]` |
| `sinAffinity` | 46 | `{sins, attackSkill}` | `9002` 도착증 `{sins:["wrath"], attackSkill:true}` |
| `resonance` | 23 | `{mode, sins, absolute, count}` | `9011` 여우비 `{mode:"activate", sins:["sloth"], absolute:true}` |
| `skills` | 10 | `{atkType, min, scaling, skillTiers, hasMinusCoinTier}` | `9210` 연육 망치 `{atkType:"blunt", min:2}` |
| `teamWide` | 3 | `true` | `9140` 결의 |

#### 우리는 이 구조를 쓰지 않는다

엔진은 **assets 의 `triggers` 문자열**을 정규식으로 파싱한다(`lib/engine/vocab.ts:242` `mapTrigger`).

```
9001 지옥나비의 꿈
  mj      {"resonance": [{"mode":"activate", "sins":["wrath"]}]}          구조
  assets  ["Apply Burn or Unique Burn", "Wrath Absolute Resonance"]        문자열
```

```
mj requires   126        assets triggers   451
교집합 126 · mj 에만 0 · assets 에만 325
```

**mj 는 assets 의 진부분집합**이고 assets 가 3.5배 많다. 다만 mj 쪽은 **파싱 없이 바로
읽히는 구조**이고, `08-gimmick-keywords.md` 4.2 의 엔진 과대 계상이 바로 이 파싱에서 나왔다.

**미적재.** 회차 3에서 `triggers` 를 본 뒤 판단할 값이다.

---

## `9282` 날개 모양 양초 — 조건부 기믹의 세 번째 원문

「취급됨」 문구를 가진 기프트는 **441건 중 이것 하나뿐**이다.

```
<새벽 사무소> 소속 인격을 [Combustion], [Vibration]을 부여하는 인격으로 취급됨
- 이 효과로 인해서 기본 스킬이 [Combustion], [Vibration]을 부여하는 스킬로 취급됨
```

E.G.O 편 회차 5·8의 `20109`·`20509` 와 **같은 문형**이다. 다만 걸리는 단위가 다르다.

| 조건 주체 | 대상 | 조건 |
| --- | --- | --- |
| E.G.O `20109` · `20509` | **인격 하나** | 그 E.G.O 장착 |
| 기프트 `9282` | **소속 전체**(새벽 사무소) | 소속 인격 **3인 이상 편성** |

`identity_keyword_modifiers.json` 에서 `11009` 만 `allowInSolver: false` 인 이유가 여기 있다 —
**편성 구성에 따라 켜지고 꺼지므로 단일 인격의 고정 축으로 셀 수 없다.**

---

## 확정된 미해결 — `hardOnly` 는 **양쪽 다 틀린다**

```
mj hardOnly true      53
assets hardonly true 116
교집합 47 · mj 단독 6 · assets 단독 69 · 합집합 122
```

게임 화면으로 세 건을 확인했고 **셋 다 하드 난이도 전용**이었다.

| id | 기프트 | 게임 | mj | assets |
| --- | --- | --- | --- | --- |
| `9226` | 누군가의 푸른 검 | **하드** | `false` ✗ | `true` ✓ |
| `9211` | 먹장구름 | **하드** | `false` ✗ | `true` ✓ |
| `9212` | 모든 악의 끝 | **하드** | `true` ✓ | 없음 ✗ |

> **어느 한쪽도 완전하지 않다.** mj 가 놓친 것이 69건, assets 가 놓친 것이 6건이다.
> **합집합 122건이 정답에 가깝다.**

불일치가 `92`·`94`·`97`·`98` 후기 대역에만 몰려 있고 `90`·`91` 초기 대역은 0건이다.
양쪽이 서로 다른 시점에 갱신을 놓친 것으로 보인다.

**지금 적재는 assets 만 쓴다**(`src/entities/gifts.ts:107` — `hardOnly: g.hardonly === true`).
`9212` 처럼 mj 만 아는 6건이 `false` 로 들어간다. → `docs/backlog/08-gift-hardonly.md`

---

## 함정 요약

1. `tier` 는 **문자열**이다. `"EX"` 가 있어 정수로 못 읽는다
2. `keyword` 10종은 **기믹 7 + 공격 타입 3** 이다. 기믹 축 10종과 어휘가 다르다
3. `keyword: null` 109건은 **결손이 아니다.** assets 의 `"Keywordless"` 와 대응
4. **`hardOnly` 는 mj·assets 둘 다 결손이 있다.** 합집합을 써야 한다
5. `uniquePacks` 는 assets `exclusiveTo` 의 **부분집합**이다. mj 가 59건 비었다
6. `combinesFrom` 은 **배열의 배열**이다. 평평하게 읽으면 레시피가 섞인다
7. mj 는 **441건**으로 assets 보다 15건 적다

## 미해결

없다. 키 15종 전부 확정했다.

## 근거 재현

```
data/entities/gifts/limbus-data-mj/gifts.json          441건 · 키 15종
data/entities/gifts/limbus-assets/gifts.json           456건 대조
data/entities/gifts/limbus-data-mj/gifts_detail.json   attributeType (회차 2)
src/entities/gifts.ts:1,35,107                         정본 배정 · 읽는 필드 · hardOnly
lib/engine/vocab.ts:242                                mapTrigger
prisma/schema.prisma:472                               Gift 모델
```

게임 화면 대조 — `9226` 누군가의 푸른 검 · `9211` 먹장구름 · `9212` 모든 악의 끝
(등급 · 키워드 · 코스트 · 하드 여부 · 테마 한정 · 합성 여부)
