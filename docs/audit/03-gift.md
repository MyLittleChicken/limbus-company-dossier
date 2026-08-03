# E.G.O 기프트 (gift)

감사 대상: `canonical` 스키마의 기프트 도메인. 기준은 **소비자**(현행 화면 `app/[locale]/gifts/*`,
현행 추천 엔진 `lib/engine/*`)다. 모든 수치는 2026-08-02 실제 질의 결과다.

---

## 1. 현행 화면이 읽는 것

### 1.1 목록 `/ko/gifts` (`app/[locale]/gifts/page.tsx` + `listGifts`)

| 읽는 컬럼 | 쓰임 |
| --- | --- |
| `gift.id` | 링크 · 정렬 2차 키 |
| `gift.tier` (text) | 칩 표시 · `tier IN (...)` 필터 · 정렬 1차 키 |
| `gift.enhanceable` (bool) | TriFilter |
| `gift.hardOnly` (bool) | TriFilter |
| `gift.mdCost` (int) | 목록 항목에 실려 나가나 카드에는 미표시 |
| `gift.sprite` (text) | `giftIcon(sprite)` — 카드 아이콘 |
| `gift.keywordId` (text, nullable) | 키워드 칩 필터. **`NULL` 자체가 축의 값**(`none`) |
| `gift_text.{locale,enhanceLevel,name,desc}` | 이름 표시(level 0) · 검색(`q` → `name`/`desc` ILIKE) |
| `keyword.order` | 필터 칩 정렬 |
| `keyword_text.{locale,name}` | 칩 라벨 |
| `gift_pack` / `gift_exclusive_pack` | `_count` → "전용" 배지, `pool` 필터 |

죄악 축(`gift.attributeType`)은 **의도적으로 화면에 내지 않는다**(page.tsx 32-33행 주석,
`docs/backlog/03-gift-affinity.md`).

### 1.2 상세 `/ko/gifts/{id}` (`app/[locale]/gifts/[id]/page.tsx` + `getGift`)

목록의 컬럼 전부에 더해:

| 읽는 컬럼 | 쓰임 |
| --- | --- |
| `gift_text.desc` (전 강화 단계) | 단계별 패널 본문 |
| `fusion_recipe.{id,resultGiftId,index}` | 합성 레시피 패널 |
| `fusion_slot.{recipeId,index,count}` | `×{count}` 표기 |
| `fusion_slot_option.{recipeId,slotIndex,giftId}` | 슬롯 내 "또는" 대체 재료 |
| 역방향 `fusion_slot_option → recipe → result` | "이 기프트를 재료로 쓰는 합성" |
| `pack_text.name` | 전용 팩 / 등장 팩 목록 |

`/ko/gifts/9001` 실측 렌더 (curl):

- 이름 `지옥나비의 꿈` / `지옥나비의 꿈+` / `지옥나비의 꿈++` (3단계)
- 본문 **치환된** 한국어: "**화상** 또는 특수 화상에 걸린 적에게 … 모든 적에게 **화상 위력 3** 무작위로 나누어 부여."
- 속성: 등급 2 · 키워드 화상 · 강화 가능 O · hard 전용 X · MD 코스트 198
- 전용 팩 0 (범용) · 등장 팩 66

### 1.3 엔진 (`lib/engine/load.ts` `loadGifts`)

| 읽는 컬럼 | 쓰임 |
| --- | --- |
| `gift.tier` | 점수 가중 |
| `gift.keywordId` | 기프트 분류 축 |
| `gift_token.{kind,index,token}` | `mapEffect` / `mapTrigger` 입력. **`ORDER BY kind, index`** |
| `gift_text.desc` (ko, level 0) | `refineAffiliation` — 설명문에서 소속 인원수(`N인 이상`)를 읽는다 |

---

## 2. canonical 대응 현황

### 2.1 테이블

| 항목 | public | canonical | 상태 |
| --- | --- | --- | --- |
| 기프트 본체 | `gift` 456 | `gift` 582 (mirror_dungeon 456 + story_dungeon 126) | 신규가 상위집합 |
| 강화 단계 | (`gift_text` 에 내포) | `gift_stage` 799 (mirror 673 + story 126) | 대응 |
| 단계 텍스트 | `gift_text` 1,346 (ko 673 · en 673) | `gift_stage_text` 2,391 (ko 793 · en 799 · ja 799) | ja 추가 · 의미 변질(3.1) |
| 효과 | `gift_token WHERE kind='effect'` 1,123 | `gift_effect` 1,122 | **1행 손실**(4.2) |
| 발동 | `gift_token WHERE kind='trigger'` 1,081 | `gift_trigger` 1,081 | 일치 |
| 효과 어휘 | (테이블 없음, 토큰 distinct 55) | `effect` 55 | 일치 |
| 발동 어휘 | (테이블 없음, 토큰 distinct 150) | `trigger` 150 | 일치 |
| 기프트↔팩 | `gift_pack` 10,115 | `gift_pack` 10,115 | 완전 일치(full join diff 0) |
| 전용 팩 | `gift_exclusive_pack` 321 | `gift_exclusive_pack` 321 | 완전 일치(diff 0) |
| 합성 레시피 | `fusion_recipe` 68 | `fusion_recipe` 68 | 완전 일치(diff 0) |
| 합성 슬롯 | `fusion_slot` 179 | `fusion_slot` 179 | 행 수 일치 · `count` 결손(3.2) |
| 슬롯 대체 재료 | `fusion_slot_option` 185 | `fusion_slot` 178(단일) + `fusion_slot_option` 7(복수) | 모델 차이, 총량 동일 |
| 키워드 | `keyword` 10 · `keyword_text` 20 | `keyword` 12 · `keyword_text` 36 | id 체계 상이(2.2) |
| 죄악 | `sin_info` 7 (`sin`,`order`,`attribute`) | `sin_info` 7 (`sin`,`attribute`,`order`) | 대응 |
| 잠금 설명 | — | `gift_locked_desc` 192 (64 기프트 × 3로케일) | **신규 전용** |
| 발동 요건(구조화) | — | `gift_requirement` 142 (126 기프트) | **신규 전용** |
| 시작 기프트 | — | `start_gift` 30 (키워드 10 × 3) | **신규 전용** |
| 선택 이벤트 보상 | — | `choice_event_gift` 219 (218 기프트) | **신규 전용** |

### 2.2 컬럼 대응

| public.gift | canonical.gift | 상태 |
| --- | --- | --- |
| `id` integer | `id` text | 타입 변경. FK 조인 시 캐스팅 필요 (582행 전부 숫자 문자열, 실측) |
| `tier` text (`1`..`5`,`EX`) | `tier` integer + `tier_label` text | 분해. `coalesce(tier::text, tier_label)` = public.tier 로 **456/456 일치** |
| `keywordId` text NULL 120 | `keyword_id` text, mirror_dungeon **NULL 0** | 의미 변경(3.3) |
| `attributeType` text (SCARLET 등) | `sin` enum (lust 등) | 표현 변경. 색↔죄악 **완전 1:1 대응, 예외 0**(6절) |
| `enhanceable` bool | `enhanceable` bool | 전 456행 일치 (diff 0) |
| `hardOnly` bool true 116 | `hard_only` bool true 122 | **6행 차이 — canonical 이 정답**(합집합 122) |
| `mdCost` int | `cost` int | 전 456행 일치 (diff 0) |
| `sprite` text NOT NULL | **없음** | **결손. 대응 컬럼 자체가 없다**(3.4) |
| — | `domain` enum | 신규 |
| public.keyword.`order` | **없음** | 결손(3.6) |

---

## 3. 채움률 이상

### 3.1 `gift_stage_text.desc` — 표시용 치환이 사라졌다 (심각)

`canonical.gift_stage_text.desc` 는 NULL 0건이라 채움률은 100%다. 그러나 **담긴 값이 다르다.**

| | public.gift_text.desc | public.gift_text.descRaw | canonical.gift_stage_text.desc | canonical.gift_stage_text.desc_raw |
| --- | --- | --- | --- | --- |
| 의미 | 치환·태그제거 완료 (표시용) | 원문(치환 전 + `<style>` 태그) | **치환 전** + 태그 제거 | 원문. 태그가 있을 때만 채움 |
| `[Xxx]` 자리표시자 포함 | 119 / 1,346 (8.8%) | 1,109 / 1,346 | **1,803 / 2,391 (75.4%)** | — |
| NULL | 0 (NOT NULL) | 0 (NOT NULL) | 0 | **1,681 / 2,391 (70.3%)** |

실측 등식 (2,391행 중 public 과 짝이 있는 1,346행 대상):

- `canonical.desc = public.descRaw` … **892행**(태그 없는 행 전부)
- `canonical.desc_raw = public.descRaw` … **454행**(태그 있는 행 전부) — 이 454행에서만 `desc ≠ desc_raw`
- 892 + 454 = 1,346 → **canonical.desc 는 public 의 `descRaw` 이지 `desc` 가 아니다.**
- `canonical.desc ≠ public.desc` … **1,079 / 1,346행**
- 이름(`name`)은 **1,346행 전부 일치** — 어긋난 것은 설명뿐이다.

실례 (9001 · level 0 · ko):

```
public.desc     화상 또는 특수 화상에 걸린 적에게 … 모든 적에게 화상 위력 3 무작위로 나누어 부여.
canonical.desc  [Combustion] 또는 특수 화상에 걸린 적에게 … 모든 적에게 [Combustion] 위력 3 …
```

**재현 가능성**: 자리표시자는 총 125종이고 그중 **119종이 `canonical.status.id` 또는
`canonical.keyword.id` 로 해소된다.** 나머지 6종은 id 가 아니라 주석 문장이며
(`Cannot Stack` · `La Manchaland Identities Only` · `Blade Lineage Mentor Meursault Only` ·
`Dawn Office Identities Exclusive Effect` · `The Manager of La Manchaland Don Quixote Only` ·
`Effects apply only to the Identity with the earliest Deployment order`)
public.desc 에도 그대로 12행 남아 있다 — 즉 **public 이 쓴 치환 규칙과 정확히 같은 6종이 남는다.**
따라서 치환은 canonical 안에서 재현 가능하나 **어떤 컬럼에도 재현물이 없고, 뷰도 없다.**

**영향**
- 상세 화면 본문이 `[Combustion] 또는 특수 화상에…` 로 렌더된다.
- 목록 검색 `q` 가 표시 문자열을 못 맞춘다. 실측: ko `desc` 에 `화상` 이 든 행 **public 62 → canonical 38**.
- 엔진 `refineAffiliation` 은 ko `desc` 에서 소속 이름을 찾는데, 소속명은 자리표시자가 아니라
  영향 없을 가능성이 높다. 다만 **미검증**(엔진을 canonical 로 돌려본 적 없음).

**추가 관측**: `desc_raw` 의 의미가 public 과 다르다. public 은 항상 원문을 담고,
canonical 은 `desc` 와 다를 때만 담는다(70.3% NULL). 컬럼 이름만 보고 옮기면 70%가 NULL 이 된다.

### 3.2 `fusion_slot.count` — 178/179 NULL (버그)

| 값 | public.fusion_slot | canonical.fusion_slot |
| --- | --- | --- |
| 1 | 178 | **0** |
| 2 | 1 | 1 |
| NULL | 0 (NOT NULL) | **178** |

기본값 1이 물질화되지 않았다. 상세 화면은 `×{slot.count}` 를 그대로 찍으므로
합성 레시피 179슬롯 중 178개가 `×` 뒤가 빈 채 렌더된다. 원본(`limbus-assets`)이 1을 생략했을
가능성이 높으나, **소비자 관점에서는 전량 결손이다.**

### 3.3 `gift.keyword_id` — NULL 0 이지만 정보가 늘지 않았다

| | public | canonical (mirror_dungeon 456) |
| --- | --- | --- |
| NULL | 120 | **0** |
| 'None' 센티넬 | — | **120** |

canonical 은 "키워드 없음"을 `keyword_id = 'None'`(`canonical.keyword` 에 실재하는 행,
`keyword_text` ko = `범용`)으로 표현한다. 값의 대응은 완전하다 — `NULL ↔ 'None'` 로 맞추면
456행 전부 일치(diff 0). 다만 현행 화면의 `keywordId: null` 필터(`NO_KEYWORD='none'`)와
`gift.keyword ? … : <Nothing kind="absent">` 분기는 **그대로 옮기면 오작동**한다.

`canonical.keyword` 12행 중 `Random` 은 기프트 0건 · `start_gift` 0건으로 **어디에서도 참조되지 않는다.**

### 3.4 `gift.sprite` — 컬럼이 없다 (심각)

`canonical` 전체에서 `sprite` 컬럼은 `pack.sprite` · `pack.overlay_sprite` · `status.sprite` 뿐이다.
기프트 스프라이트 키가 없다.

- 원본에는 있다: `raw.raw_object` (`limbus-assets` · `limbus-data-mj`) payload 의 `srcPath`
  (예 9001 → `Hellterfly's Dream`). `public.gift.sprite` 는 456행 전부 유일값으로 이것을 담고 있다.
- **id 로 유도할 수 없다** — 마스터북 `docs/data/gift/00-overview.md` 65·78행이 이미 그렇게 적었다.
- 대체 시도: `gift_stage_text(locale='en', level=0).name = public.gift.sprite` 는 **362/456 만 일치**.
  94종은 이름과 스프라이트 키가 달라 복원 불가.

**영향**: `giftIcon()` 을 canonical 만으로 호출할 수 없다. 목록 카드 아이콘 456개,
상세 히어로 아이콘, 합성 레시피 재료 아이콘이 전부 빈다.

### 3.5 `gift.sin` · `gift.tier` · `gift.cost` — NULL 141 (도메인 경계)

| 컬럼 | 전체 NULL | mirror_dungeon(456) | story_dungeon(126) |
| --- | --- | --- | --- |
| `sin` | 141 | 15 | 126 |
| `cost` | 141 | 15 | 126 |
| `tier` | 128 | 2 (= `tier_label='EX'`) | 126 |
| `keyword_id` | 126 | 0 | 126 |
| `tier_label` 채움 | 2 | 2 | 0 |

mirror_dungeon 의 `sin`/`cost` NULL 15는 **기존에 알려진 15종**(보강 출처 mj 에 없음)과 정확히 일치.
story_dungeon 126종은 `sin`·`cost`·`tier`·`keyword_id`·효과·발동·팩 관계가 **전부 비어 있다** —
본체 행과 단계 텍스트만 있다.

### 3.6 `keyword.order` 없음

`canonical.keyword` 의 컬럼은 `id` 하나다. 현행 `listKeywords` 는 `orderBy: {order:'asc'}` 로
필터 칩 순서를 정한다. canonical 에는 정렬 근거가 없어 순서가 임의가 된다.

### 3.7 전량 NULL / 이상 낮음 없음이 확인된 컬럼

`gift_stage_text.name` 빈 문자열 0 · `gift_locked_desc.text` 빈 문자열 0 ·
`gift_requirement.value` 빈 JSON 0 · `keyword_text.name` 빈 문자열 0 ·
`effect.id`/`trigger.id` 빈 문자열 0.

---

## 4. 참조 무결성

### 4.1 고아 FK — 0건

| 검사 | 결과 |
| --- | --- |
| `gift_effect.effect_id → effect` | 0 |
| `gift_trigger.trigger_id → trigger` | 0 |
| `gift_pack.pack_id → pack` / `.gift_id → gift` | 0 / 0 |
| `gift_exclusive_pack.pack_id → pack` | 0 |
| `gift.keyword_id → keyword` | 0 |
| `fusion_recipe.gift_id → gift` | 0 |
| `fusion_slot.material_id → gift` | 0 |
| `fusion_slot_option.material_id → gift` | 0 |
| `fusion_slot → fusion_recipe` | 0 |
| `fusion_slot_option → fusion_slot` | 0 |
| `start_gift.gift_id → gift` / `.keyword_id → keyword` | 0 / 0 |
| `choice_event_gift.gift_id → gift` | 0 |
| `gift_locked_desc.gift_id → gift` | 0 |
| `gift_stage → gift_stage_text` (level 0 누락) | 0 |

### 4.2 효과 1행 손실 — 다중도 붕괴 (버그)

`public.gift_token(kind='effect')` 1,123행 vs `canonical.gift_effect` 1,122행.
집합(중복 제거)으로는 full join 차이 0 — 유일한 차이는 **중복 1건**이다.

```
gift 9429 (작살 의족 / Harpoon Prosthetic Leg)
  public.gift_token  effect index 0  Gain Speed / Haste
                     effect index 1  Gain Offense Level Up
                     effect index 2  Gain Buff
                     effect index 3  Gain Speed / Haste   ← 같은 토큰이 두 번
  canonical.gift_effect  Gain Buff / Gain Offense Level Up / Gain Speed / Haste  (3행)
```

`canonical.gift_effect` 는 `(gift_id, effect_id)` 만으로 식별되어 중복을 담을 수 없다.
엔진(`loadGifts`)은 효과 토큰마다 `EffectUnit` 을 하나씩 만들고 그 합으로 점수를 내므로,
9429 의 `Gain Speed / Haste` 는 **현행 2회 → canonical 1회**로 세어진다.

같은 이유로 **`index`(원본 순서) 컬럼이 canonical 에 없다.** 엔진은 지금
`orderBy [kind, index]` 로 읽고 있어 순서 재현이 불가하다. 다만 현행 엔진은 효과와 발동을
짝짓지 않고 모든 발동을 AND 로 묶으므로(`docs/06-recommendation-engine.md` 205행),
순서 상실의 실제 영향은 **없다고 판단되나 미검증**이다.

### 4.3 빈 자식 분포

**단계(`gift_stage`)** — 582종 전부 ≥1. 결손 0.

| 단계 수 | 기프트 수 |
| --- | --- |
| 1 | 472 |
| 2 | 3 |
| 3 | 107 |

**효과(`gift_effect`)**

| 효과 수 | 기프트 수 | | 효과 수 | 기프트 수 |
| --- | --- | --- | --- | --- |
| 0 | **131** | | 6 | 11 |
| 1 | 136 | | 7 | 8 |
| 2 | 142 | | 8 | 2 |
| 3 | 87 | | 9 | 2 |
| 4 | 42 | | 10 | 1 |
| 5 | 19 | | 12 | 1 |

**발동(`gift_trigger`)**

| 발동 수 | 기프트 수 | | 발동 수 | 기프트 수 |
| --- | --- | --- | --- | --- |
| 0 | **131** | | 5 | 21 |
| 1 | 112 | | 6 | 4 |
| 2 | 161 | | 7 | 2 |
| 3 | 104 | | 8 | 1 |
| 4 | 46 | | | |

효과 0 · 발동 0 인 131종의 내역은 **story_dungeon 126 + mirror_dungeon 5** 로 동일 집합이다.
mirror_dungeon 5종은 `9991` 어두운 잔영 · `9992` 아스라한 잔영 · `9993` 빛나는 잔영 ·
`9994` 찬란한 잔영 · `9995` 달의 잔영 — **public 에서도 토큰이 0이라 canonical 의 회귀가 아니다.**

**팩 관계 없음**: mirror_dungeon 39종 · story_dungeon 126종. mirror 39종은 public 과 동일 집합.

---

## 5. 엔진 어휘 재검증 (효과 55 · 발동 150)

`docs/06-recommendation-engine.md` 38·48·56·76·146행이 주장하는 값 —
"`gift_token` 2,204행 — 효과 55종 · 발동 150종", "커버리지 효과 55/55 · 발동 150/150".

**질의로 확인한 결과 — 문서의 수치가 맞다.**

| 검사 | 결과 |
| --- | --- |
| `public.gift_token` 전체 | 2,204행 (effect 1,123 + trigger 1,081) ✔ |
| `public.gift_token(effect)` distinct token | **55** ✔ |
| `public.gift_token(trigger)` distinct token | **150** ✔ |
| `canonical.effect` 행 수 | **55** ✔ |
| `canonical.trigger` 행 수 | **150** ✔ |
| 효과 토큰: public 에만 있음 | **0** |
| 효과 토큰: canonical 에만 있음 | **0** |
| 발동 토큰: public 에만 있음 | **0** |
| 발동 토큰: canonical 에만 있음 | **0** |

즉 `canonical.effect.id` · `canonical.trigger.id` 는 현행 `gift_token.token` 과
**문자열 수준까지 완전히 같은 집합**이다. `lib/engine/vocab.ts` 의
`mapEffect` / `mapTrigger` 가 받는 토큰 문자열이 canonical 에도 그대로 있다.

표본 확인:
- `Inflict Burn Potency` · `Gain Speed / Haste` · `Trigger Amplitude Conversion/Entanglement`
  (슬래시 포함 토큰)이 `canonical.effect` 에 그대로 존재.
- `Wrath Absolute Resonance` · `The Pequod Identities` · `Allies with Shield` ·
  `Other Uncommon Triggers` 가 `canonical.trigger` 에 그대로 존재.

**단, 어휘 자체는 같아도 엔진 입력은 세 곳이 다르다.**

1. 효과 중복 1건 소실(4.2) → 9429 점수가 달라진다.
2. `index` 부재(4.2).
3. `gift.tier` 가 integer + `tier_label` 로 분해되어 `Gift.tier: string` 과 타입이 다르다.
4. `gift.keywordId` 의 `null` 이 `'None'` 으로 바뀌었다(3.3) → `Gift.keyword` 가 120종에서
   `null` 대신 문자열이 된다.
5. `refineAffiliation` 이 읽는 ko `desc` 가 치환 전 문자열이다(3.1) — 소속명은 자리표시자가
   아니므로 영향 없을 가능성이 높으나 **미검증**.

`coin_token` 은 `canonical.coin_token(skill_id, uptie, coin_idx, ordinal, token, kind, amount, status_id)`
로 존재하나 **스킬 도메인 소속이며 기프트와 FK 로 이어지지 않는다.** 현행 엔진의 기프트 경로는
`coin_token` 을 읽지 않는다(`lib/engine/load.ts` 확인). 기프트 감사 범위 밖으로 둔다.

---

## 6. 신규에만 있는 것

| 항목 | 규모 | 비고 |
| --- | --- | --- |
| `gift.domain = story_dungeon` | 126종 | public 에 없는 기프트. 단계 텍스트만 있고 효과·발동·팩·죄악·코스트·키워드 전부 없음 |
| `gift_locked_desc` | 192행 (64종 × ko/en/ja) | 잠금 상태 설명문. 화면 대응 없음 |
| `gift_requirement` | 142행 / 126종 (전부 mirror_dungeon) | 구조화된 발동 요건 jsonb. `kind` 분포: `slots` 60 · `sinAffinity` 46 · `resonance` 23 · `skills` 10 · `teamWide` 3. 예: `9002 sinAffinity [{"sins":["wrath"],"attackSkill":true}]` |
| `start_gift` | 30행 (키워드 10 × 3) | 키워드별 시작 기프트 |
| `choice_event_gift` | 219행 / 218종 | 선택 이벤트 보상 연결 |
| `gift_stage_text` ja 로케일 | 799행 | 현행은 ko/en 뿐 |
| `keyword` `None` · `Random` | 2행 | `Random` 은 참조 0 |
| `gift.tier_label` | 2행 | `EX` |
| `effect` · `trigger` 테이블 | 55 · 150 | public 에서는 토큰 문자열이었을 뿐 어휘 테이블이 없었다 |

**현행에만 있고 신규에 없는 것**

| 항목 | 규모 | 영향 |
| --- | --- | --- |
| `gift.sprite` | 456행 | 아이콘 전량 소실 (3.4) |
| 치환된 표시용 `desc` | 1,346행 | 상세 본문·검색 (3.1) |
| `fusion_slot.count = 1` | 178행 | 합성 레시피 수량 표기 (3.2) |
| `gift_token.index` | 2,204행 | 원본 순서 (4.2) |
| 효과 중복 1건 (9429) | 1행 | 엔진 점수 (4.2) |
| `keyword.order` | 10행 | 필터 칩 순서 (3.6) |

**값이 다른 것 (양쪽 값 병기, 어느 쪽이 옳다고 단정하지 않음)**

| 항목 | public | canonical | 관측 |
| --- | --- | --- | --- |
| `hardOnly` true | 116 | **122** | 6종 차이. 알려진 사실("두 출처 다 결손, 합집합 122가 정답")과 대조하면 canonical 이 정답 쪽 |
| 죄악/색 | `attributeType` 7색 (SCARLET 77 · AZURE 65 · INDIGO 64 · VIOLET 62 · SHAMROCK 60 · AMBER 57 · CRIMSON 56 · NULL 15) | `sin` 7종 (lust 77 · gloom 65 · pride 64 · envy 62 · gluttony 60 · sloth 57 · wrath 56 · NULL 15) | **완전 1:1 대응, 교차 예외 0건.** 알려진 오변환 4건(9038·9111·9404·9707)은 양쪽 모두 정답값(gloom·sloth·gluttony·sloth ↔ AZURE·AMBER·SHAMROCK·AMBER)을 갖는다 — 이미 교정된 상태 |

---

## 7. 결손과 영향

`canonical.field_gap` 의 기프트 관련 항목은 **6건뿐**이다 (전체 1,549건 중).

| entity | entity_id | field | locale | reason |
| --- | --- | --- | --- | --- |
| gift | 1017 · 1031 · 1035 · 1036 · 1045 · 1047 | `name` | ko | `ko 표시명이 어느 출처에도 없다 (단계 0)` |

`build/gap-report.md` 40행도 같은 6건을 적는다.

### 7.1 한국어 이름 6종 — 대장의 서술과 데이터가 어긋난다 (관측)

6종 전부 `domain = story_dungeon` 이고 `gift_stage_text` 에 `ko` 행이 없다. 여기까지는 대장과 맞다.
그런데 **`en` · `ja` 행에 한국어 문자열이 들어 있다.**

| id | ko | en | ja |
| --- | --- | --- | --- |
| 1017 | (없음) | `희망찬 눈동자` | `희망찬 눈동자` |
| 1031 | (없음) | `용기의 조각` | `용기의 조각` |
| 1035 | (없음) | `경화된 살점` | `경화된 살점` |
| 1036 | (없음) | `경계하는 눈동자` | `경계하는 눈동자` |
| 1045 | (없음) | `파고드는 비늘` | `파고드는 비늘` |
| 1047 | (없음) | `잘린 뱀 머리` | `잘린 뱀 머리` |

원인 후보(실측): `raw.raw_file` 에 `gifts/loc-en/EGOgift.json`(75객체)과
`gifts/loc-ja/EGOgift.json`(75객체)은 있으나 **`gifts/loc-ko/EGOgift.json` 은 없다.**
raw 객체 수도 loc-en 946 · loc-ja 946 · loc-ko 871 = 정확히 75 차이.
en/ja 파일이 미번역 한국어 원문을 담고 있는 것으로 보인다.

- 대장의 `ko 표시명이 어느 출처에도 없다` 는 **`ko` 슬롯 기준으로는 맞고, 문자열 기준으로는 틀리다.**
- 실제 화면 영향: `nameOf` 가 en 으로 폴백하므로 한국어가 보인다. 다만 `fellBack: true` 가 되어
  **폴백 표기(`t.fallbackNotice`)가 잘못 붙는다.**
- 다른 story_dungeon 기프트(1001 신도의 가면 / Mask of a Devotee / 信徒の仮面, 1050 못 / Nagel / 釘)는
  3로케일이 정상이므로 전역 문제가 아니다.

### 7.2 색 속성 15종

`gift.sin` NULL 15 = `public.gift.attributeType` NULL 15 = 동일 집합.
**화면·엔진 영향 없음** — 현행 목록·상세 어디에도 죄악 축을 내지 않는다
(`app/[locale]/gifts/page.tsx` 32-33행, `docs/backlog/03-gift-affinity.md`).
`gift.cost` NULL 15도 같은 집합이며 상세의 "MD 코스트" 칸이 `출처에 없음` 으로 렌더된다
(현행과 동일 동작).

### 7.3 기프트↔팩 10,115행

대조할 출처가 없다는 서술은 원본 대조 기준의 이야기다. **두 스키마 사이 대조는 가능하며
full join 차이 0** — canonical 이 public 과 완전히 같은 10,115쌍을 담는다.
`gift_exclusive_pack` 321쌍도 동일.

### 7.4 `field_gap` 이 놓친 것

3절·4절에서 찾은 다음 항목들은 `canonical.field_gap` 에 **한 건도 등재되어 있지 않다.**

- `gift.sprite` 컬럼 부재 (456종)
- 치환된 표시용 `desc` 부재 (1,346행 상당)
- `fusion_slot.count` 178행 결손
- `gift_token.index` 부재
- 효과 중복 1건 소실 (9429)
- `keyword.order` 부재

`extractable` 은 기프트 도메인 필드가 아니다 — `docs/adr/04-source-authority.md` 90행과
`docs/data/ego/00-overview.md` 83행이 E.G.O 도메인(`egos.extractable` 28건)의 개념으로 적고 있고,
`public.gift` · `canonical.gift` 어디에도 해당 컬럼이 없다(컬럼 목록 전수 확인).

---

## 8. 사용자 확인 필요 항목

1. **`fusion_slot.count` 기본값** — canonical 178행 NULL 을 `1` 로 읽어도 되는가.
   확인 방법: 거울 던전 `E.G.O 기프트 합성` 화면에서 예컨대 **9088**(레시피 0: 9003 · 9053 · 9157)의
   각 재료 옆 수량 표기를 본다. 전부 `×1` 이면 NULL=1 로 확정.
   예외 후보는 9083(레시피 0, 슬롯 0)뿐이며 이것만 `count=2` 로 들어 있다.

2. **`gift.hard_only` 6종 차이** — public 116 vs canonical 122. 알려진 사실은 "합집합 122가 정답"이나,
   차이 나는 6종이 실제 하드 전용인지 게임에서 갈린다.
   차이 6종은 전부 `public=false` · `canonical=true` 다 —
   **9212** 모든 악의 끝 · **9249** 조그맣고 근사한 바이올린 · **9427** 마을을 지킬 작살 ·
   **9428** 고래의 심장 · **9431** 부서진 바이올린 · **9841** C형 정리 요원 장비 세트.
   확인 방법: 거울 던전 **일반** 난이도로 완주하며 이 6종이 획득 후보에 뜨는지 본다.
   안 뜨면 canonical(하드 전용) 이 맞다.

3. **story_dungeon 126종을 기프트 목록에 낼 것인가** — 거울 던전 화면의 목록·필터·추천은
   전부 거울 던전 기프트를 전제한다. canonical 을 그대로 읽으면 목록 총계가 456 → 582 가 되고,
   그 126종은 등급·키워드·코스트·효과가 전부 비어 카드가 껍데기가 된다.
   `domain = 'mirror_dungeon'` 필터를 강제할지 제품 판단이 필요하다.

4. **`gift_stage_text` en/ja 에 한국어가 든 6종(7.1)** — 이것이 원본(loc-en/EGOgift.json)의
   미번역인지, 적재 과정의 로케일 오배치인지.
   확인 방법: 게임을 **영어**로 설정하고 스토리 던전에서 1017 · 1031 · 1035 · 1036 · 1045 · 1047
   기프트의 이름 표기를 본다. 영어 이름이 나오면 원본 파일이 낡은 것이고,
   한국어가 그대로 나오면 게임 자체가 미번역이라 결손이 아니다.

5. **`canonical.keyword` 의 `Random`** — 기프트 0건 · start_gift 0건으로 아무데서도 참조되지 않는다.
   게임에 "무작위" 키워드 기프트가 실재하는지, 아니면 데이터 구조상의 예약값인지.

6. **`gift_requirement` 의 신뢰도** — 신규 전용이며 대조할 현행 대응물이 없다.
   126종 142행이 게임의 실제 발동 요건과 맞는지 표본 확인이 필요하다.
   실측 이상 1건: **9001** 의 요건은 `[{"mode":"activate","sins":["wrath"]}]` 로
   `absolute` 플래그가 없는데, 같은 기프트의 ko 설명문과 발동 토큰은 둘 다
   **완전 공명**(`Wrath Absolute Resonance`)이라고 말한다.
   `kind='resonance'` 23행 중 `absolute` 를 가진 것은 12행뿐이다.
   확인 방법: 9001 을 들고 분노 **완전** 공명이 아닌 일반 공명만 띄웠을 때 효과가 켜지는지 본다.
   켜지지 않으면 `gift_requirement` 쪽이 틀린 것이다.
