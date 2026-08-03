# 팩↔기프트 관계

감사일 2026-08-02 · 대상 `limbus` DB (`canonical` · `public` · `raw`) · 소스 JSON `data/entities/`
모든 수치는 실제 질의·파싱 결과다. 확인 못 한 것은 그렇게 적었다.

---

## 1. 현행 화면·엔진이 이 관계를 쓰는 방식

### 1.1 엔진 경로 (전수)

읽기 순서는 `lib/queries/recommend.ts` → `lib/engine/load.ts` → `lib/engine/pack.ts` → `lib/engine/score.ts` 다.
Prisma(`lib/db`)를 통하므로 **읽는 곳은 전부 `public` 스키마다. `canonical` 을 읽는 코드는 하나도 없다.**

| 순서 | 함수 | 읽는 테이블(`public`) | 쓰임 |
|---|---|---|---|
| 1 | `loadAffiliations` | `affiliation` · `affiliation_text` | 조건 토큰의 소속 id 검증 · 설명문 정밀화 |
| 2 | `loadIdentities` | `identity` · `identity_text` · `identity_status` · `identity_affiliation` · `identity_skill` | 덱 특성 |
| 3 | `loadGifts` | `gift` · `gift_text` · **`gift_token`** | 기프트 582… 실제로는 456종 전량 + 효과/발동 토큰 |
| 4 | `packIdsForFloor` | **`floor_pack`** | 난이도·층 → 후보 팩 id. `floorRange` 를 `"6-10"` 처럼 문자열로 저장해 코드가 split 해서 판정 |
| 5 | `loadPackCandidates` | `pack` · `pack_text` · **`gift_pack`** · **`gift_exclusive_pack`** | `PackCandidate.gifts` ← `gift_pack`, `PackCandidate.exclusiveIds` ← `gift_exclusive_pack` |
| 6 | `rankPacks` → `scorePack` | (메모리) | 점수화 |

### 1.2 점수화에서 이 관계가 쓰이는 지점 — 정확히 두 곳

`lib/engine/pack.ts:84` 의 루프는 **`pack.gifts`(= `gift_pack`)만 순회한다.**

```ts
for (const gift of pack.gifts) {          // gift_pack 이 정의한 집합
    ...
    if (pack.exclusiveIds.has(gift.id)) exclusiveOpportunity += m.delta;   // :103
}
```

즉 `gift_pack` 은 **점수의 전 항목**(`immediate`·`universal`·`futureOption`·`redundancy`)의 정의역이고,
`gift_exclusive_pack` 은 **그 정의역 안에서만** `exclusiveOpportunity` 를 가산한다.
→ `gift_exclusive_pack` 에만 있고 `gift_pack` 에 없는 쌍은 **엔진에서 아무 일도 하지 않는다.** (§3.4 · §7)

가중치는 `lib/engine/tuning.ts` — `PACK_W.exclusiveOpportunity = 0.25`. `FLOOR_PHASE` 배수를 **곱하지 않는** 유일한 항이다(`pack.ts:115`).

`fusionProgress` 는 `pack.ts:109` 에서 **하드코딩 `0`** 이다. `fusion_recipe`/`fusion_slot`/`fusion_slot_option` 을 읽는 엔진 코드는 없다. `PACK_W.fusionProgress = 0.6` 과 `FLOOR_PHASE.early.fusionProgress = 1.4` 는 현재 죽은 상수다.

`start_gift`·`choice_event_gift`·`gift_requirement` 를 읽는 엔진 코드도 없다.

### 1.3 화면 (실측 렌더)

| 화면 | 실측 결과 |
|---|---|
| `/ko/packs/1201` (가르고 베는 이들) | 전용 기프트 **0** ("이 팩에만 나오는 기프트가 없다") · 전체 풀 분포 **54** · 등장 기프트 전체 **54**. DB `gift_pack where pack_id='1201'` = **54** 로 일치 |
| `/ko/gifts/9002` (도착증) | 전용 팩 **0** ("범용 풀에서 등장한다") · 등장 팩 **71** |
| `/ko/packs/1122` (선의의 순례) | 전용 기프트 **9** · 전체 풀 분포 **73**. DB `gift_pack where pack_id='1122'` = **73**, `gift_exclusive_pack` = **9**, 그중 `gift_pack` 에도 있는 것 = **0** |
| `/ko/gifts/9831` (시테러 연구집) | 전용 팩 **1**(선의의 순례) · 등장 팩 **0**("없음") |
| `/ko/recommend` (hard 3층) | 후보 **27**, 1위 「어느 세계」 72.8. `exclusiveOpportunity` 는 상위 5팩에서 0.25 / 0.50 / 1.90 / 0.45 |

**관측** — 1122·9831 조합은 화면상 모순으로 읽힌다. 팩 상세는 「이 팩에만 나오는 기프트 9종」을 나열하지만 그 9종은 같은 화면의 「전체 풀 73」에 하나도 없고, 기프트 상세는 「전용 팩 1 · 등장 팩 0」을 나란히 보여준다. 원인은 §3.4.

---

## 2. canonical 적재 현황

| 테이블 | 행 | 컬럼 | 채움률 |
|---|---|---|---|
| `canonical.gift_pack` | **10,115** | `gift_id`·`pack_id` (PK 둘 다, NOT NULL) | 100% |
| `canonical.gift_exclusive_pack` | **321** | `gift_id`·`pack_id` (PK 둘 다, NOT NULL) | 100% |
| `canonical.start_gift` | **30** | `keyword_id`·`gift_id` (PK 둘 다) | 100% · 키워드 10종 × 3 정확히 균등 |
| `canonical.fusion_recipe` | **68** | `gift_id`·`index` (PK 둘 다) | 100% · 결과 기프트 60종(1레시피 52 · 2레시피 8) |
| `canonical.fusion_slot` | **179** | `gift_id`·`recipe_idx`·`slot_idx` (PK) · `material_id` nullable · `count` nullable | `material_id` **178/179 (99.4%)** · `count` **1/179 (0.6%)** |
| `canonical.fusion_slot_option` | **7** | `gift_id`·`recipe_idx`·`slot_idx`·`material_id` (전부 PK) | 100% |
| `canonical.choice_event_gift` | **219** | `event_id`·`gift_id` (PK 둘 다) | 100% · 이벤트 156종 · 기프트 218종 |
| `canonical.gift_requirement` | **142** | `gift_id`·`kind` (PK) · `value` jsonb NOT NULL | 100% · 기프트 126종. `kind` 분포: `slots` 60 · `sinAffinity` 46 · `resonance` 23 · `skills` 10 · `teamWide` 3 |

참고 규모: `canonical.gift` **582** · `canonical.pack` **117** · `canonical.floor_pack` **288**.

### 2.1 582 의 정체 — 이 감사의 전제를 바꾸는 사실

`canonical.gift.domain` 으로 쪼개면:

- `mirror_dungeon` **456**
- `story_dungeon` **126**

`public.gift` 는 **456** 이고, `canonical.gift` 중 `public` 에 없는 126건은 **전부** `story_dungeon` 이다(차집합 실측: canonical−public = 126, public−canonical = 0).

→ **`gift_pack` 의 자연스러운 모수는 582 × 117 = 68,094 가 아니라 456 × 117 = 53,352 다.** 스토리 던전 기프트는 테마 팩에서 나오지 않는다. §3.3 의 밀도 계산은 두 모수를 모두 적었다.

### 2.2 참조 무결성

전부 통과. 위반 0건.

- `fusion_recipe` 중 슬롯이 없는 레시피: **0**
- `fusion_slot.material_id` 가 `gift` 에 없는 것: **0**
- `fusion_slot_option.material_id` 가 `gift` 에 없는 것: **0**
- `gift_pack`·`gift_exclusive_pack` 은 FK 로 `gift`·`pack` 을 강제한다

---

## 3. 관계 분포 실측

### 3.1 팩당 기프트 수 (117팩)

| 지표 | 값 |
|---|---|
| 기프트가 하나라도 붙은 팩 | **117 / 117** |
| **0개인 팩** | **없음** |
| 최소 | **18** |
| 최대 | **188** |
| 중앙값 | **73** |
| 평균 | **86.45** |

상위:

| 팩 id | 이름 | category | 기프트 |
|---|---|---|---|
| 1504 | 영겁의 굴레 | extreme | 188 |
| 1515 | 페어리테일 | extreme | 187 |
| 1503 | 3호선 - 종착역 | extreme | 187 |
| 3001 | 뽕.황 | extreme | 187 |
| 1506 | 끝도 없이 막힌 길 | extreme | 187 |
| 1520 | 한 봄 밤의 꿈 2 | extreme | 187 |
| 1513 | 1호선 : 광기 | extreme | 187 |
| 1502 | 개화하는 녹림 | extreme | 187 |

하위:

| 팩 id | 이름 | category | 기프트 |
|---|---|---|---|
| 1112 | 4호선 - 제 4 구간 | railway | 18 |
| 1110 | 3호선 | railway | 18 |
| 1109 | 2호선 | railway | 18 |
| 1108 | 1호선 | railway | 18 |
| 1111 | 4호선 - 제 3 구간 | railway | 18 |
| 1118 | 5호선 | railway | 19 |
| 1117 | 심야청소 | event | 24 |
| 1127 | 심야청소 BokGak | event | 26 |

**관측** — 상하위가 category 로 깨끗이 갈린다. `extreme` 8팩이 187~188 로 상위를 독점하고 `railway` 6팩이 18~19 로 하위를 독점한다. `lib/engine/load.ts:159` 의 주석("뽕.황(3001)은 187종을 담은 덕에 언제나 1위가 된다")과 실측이 일치한다.

**관측** — `extreme` 팩의 187~188 은 「팩 풀 = 범용 풀 거의 전부」라는 뜻이다. 187 은 `gift_pack` 에 등장하는 358종의 52% 이자, 팩에 1개 넘게 붙는 240종의 78% 다. 이 규모의 팩은 「선택의 정보량」이 사실상 0 이며, 엔진이 `hidden`/제외로 다루는 근거가 데이터에도 남아 있다.

### 3.2 기프트당 팩 수 (582종)

| 지표 | 값 |
|---|---|
| 팩에 하나라도 붙은 기프트 | **358 / 582** |
| **어느 팩에도 안 붙은 기프트 (고아)** | **224** |
| 전체 582 기준 평균 | 17.38 · 중앙값 **1** |
| 붙은 358 기준 최소/최대 | **1 / 90** |
| 붙은 358 기준 중앙값 | **26** (p25 = 1 · p75 = 66 · 평균 28.25) |

붙은 358종의 버킷 분포:

| 팩 수 | 기프트 종수 | 관계 행 |
|---|---|---|
| 1 | **118** | 118 |
| 2–5 | 52 | 111 |
| 6–20 | 1 | 7 |
| 21–50 | 84 | 2,643 |
| 51–80 | **90** | 6,074 |
| 81+ | **13** | 1,162 |

**관측** — 이봉(bimodal) 분포다. 「1팩 전속」 118종과 「51팩 이상 범용」 103종이 양 극단을 이루고 6–20 구간은 **단 1종**으로 사실상 비어 있다. 이는 게임의 「테마 전용 기프트 vs 범용 풀 기프트」 이분법과 형태가 맞는다. 관계 행 수로는 51팩 이상 103종이 10,115 중 **7,236행(71.5%)** 을 차지한다.

### 3.3 고아 224종의 정체

| 분류 | 수 |
|---|---|
| **`story_dungeon` 도메인** (테마 팩 대상 아님) | **126** |
| `mirror_dungeon` 도메인 | **98** |

`mirror_dungeon` 고아 98종을 다른 획득 경로로 쪼개면(중복 허용):

| 경로 | 수 |
|---|---|
| 합성 결과물 (`fusion_recipe` 보유) | 59 |
| `gift_exclusive_pack` 에만 등재 | 59 |
| 선택 이벤트 (`choice_event_gift`) | 6 |
| 시작 기프트 (`start_gift`) | **0** |
| **어느 경로에도 없음** | **13** |

`start_gift` 30종은 **전부** `gift_pack` 에도 있다(고아 0). 마스터북의 30/30 일치와 모순 없다.

**경로 0건인 13종** — 팩·합성·이벤트·시작 어디에도 없다:

| id | 이름 | tier | hard_only |
|---|---|---|---|
| 9228 | 신검합일 | 3 | f |
| 9230 | 황금빛 시간 | 3 | f |
| 9232 | 가능성 | 3 | f |
| 9256 | 불완전한 예지안 | 4 | **t** |
| 9257 | 남겨진 신탁 | 4 | **t** |
| 9258 | 앙갚음 장부 : 번외 | 4 | **t** |
| 9259 | 작품이 된 마에스트로 링 | 4 | **t** |
| 9799 | 어떤 철학 | (EX) | f |
| 9991 | 어두운 잔영 | 1 | f |
| 9992 | 아스라한 잔영 | 2 | f |
| 9993 | 빛나는 잔영 | 3 | f |
| 9994 | 찬란한 잔영 | 4 | f |
| 9995 | 달의 잔영 | 5 | f |

**관측** — 9991~9995 「잔영」 5종은 등급 1~5 완전 사다리로, 등급별 1개씩이라는 형태가 「팩 드랍」이 아니라 별도 획득 계통(EGO 기프트 등급 승급/보상)임을 시사한다. 9256~9259 는 4종 모두 tier 4 · hardOnly 다. 판정은 §8 로 보낸다.

### 3.4 밀도 — 10,115 는 상식과 맞는가

| 모수 | 밀도 |
|---|---|
| 582 × 117 = 68,094 (과제문 기준) | **14.86%** |
| **456 × 117 = 53,352** (`mirror_dungeon` 만) | **18.96%** |
| 358 × 117 = 41,886 (실제 팩에 붙는 기프트만) | **24.15%** |

**관측** — 밀도를 단일 수치로 읽으면 오해가 된다. §3.2 의 이봉 분포가 실질이다. 팩 하나를 열면 중앙값 73종이 나오고 그중 대부분이 51팩 이상 범용 기프트이며, 1팩 전속 118종은 그 팩에서만 나온다. 「15%」라는 평균은 이 구조를 전혀 설명하지 못한다. **밀도 자체에 이상 신호는 없다.**

### 3.5 `gift_exclusive_pack` 321 과 `gift_pack` 10,115 의 관계 — **포함이 아니다**

| 관계 | 쌍 수 |
|---|---|
| `gift_exclusive_pack` 총 | **321** |
| 그중 같은 `(gift_id, pack_id)` 가 `gift_pack` 에도 있음 (**live**) | **236** |
| 그중 `gift_pack` 에 **없음** (**dead**) | **85 (26.5%)** |

dead 85쌍 내역:

- 기프트 **59종** · 팩 **44개**에 걸침 (전부 `mirror_dungeon`)
- 합성 결과물인 것 **64쌍** / 합성과 무관 **21쌍**
- **`gift_exclusive_pack` 에서 `gift_pack` 과 겹치면서 동시에 합성 결과물인 쌍은 0건이다** — 합성 결과물의 전용 등재는 100% dead

또 「exclusive」라는 이름과 달리 한 기프트가 여러 팩에 전용으로 걸린다:

| 걸린 팩 수 | 기프트 종수 |
|---|---|
| 1 | 153 |
| 2 | 68 |
| 3 | 7 |
| 4 | 1 |
| 7 | 1 |

합성과 무관한 dead 21쌍(전문):

| gift | 이름 | pack | 팩 이름 |
|---|---|---|---|
| 9241 | 아직 따뜻한 커피 | 1124 | 호박색 어스름의 시련 |
| 9242 | 봉이 인형 | 3001 | 뽕.황 |
| 9250 | 보급형 K사 앰플 | 1511 | 코드 퍼플 |
| 9251 | 불타는 운명 | 1512 | 무게를 진 자들 |
| 9252 | 못과 망치 | 1513 | 1호선 : 광기 |
| 9253 | 회전 목마 모형 | 1514 | 축복의 카니발 |
| 9254 | 한 잔 더! | 1515 | 페어리테일 |
| 9255 | 박수 짝짝! | 1516 | 핏물진 비린내 |
| 9827 | 가족의 원망 | 1518 | 라만차랜드의 주인 |
| 9828 | 카포를 위하여 | 1519 | 삽시호 |
| 9829 | 중지의 규율 | 1517 | 즉결처형의 시간 |
| 9830 | 꼬미의 작은 선물 | 1520 | 한 봄 밤의 꿈 2 |
| 9831 | 시테러 연구집 | 1122 | 선의의 순례 |
| 9832 | 황금으로 만든 나침반 | 1122 | 선의의 순례 |
| 9833 | 은빛 열쇠 모음 | 1122 | 선의의 순례 |
| 9834 | 말린 시테러 | 1122 | 선의의 순례 |
| 9835 | 밝게 빛나는 등불 | 1122 | 선의의 순례 |
| 9836 | 오래된 악보 | 1122 | 선의의 순례 |
| 9837 | 금속 구성체 | 1122 | 선의의 순례 |
| 9838 | 달을 담은 술잔 | 1122 | 선의의 순례 |
| 9839 | 고풍스러운 페이퍼 나이프 | 1122 | 선의의 순례 |

**관측** — 21쌍 전부가 팩 하나당 완결된 묶음이다(1122 가 9종, 나머지는 1:1). 게임에서 실제로 그 팩을 골랐을 때 이 기프트가 등장한다면 `gift_pack` 쪽이 결손이고, 등장하지 않는다면 `gift_exclusive_pack` 쪽이 과적재다. **어느 쪽이라 단정하지 않는다.** §8 로 보낸다.

### 3.6 출처 대조 — 10,115 는 정말 단일 출처인가 (**예, 확인함**)

소스 JSON 을 직접 파싱했다.

| 출처 파일 | 필드 | 산출 쌍 수 |
|---|---|---|
| `data/entities/gifts/limbus-data-mj/gifts.json` | `packs` | **10,115** |
| 같은 파일 | `uniquePacks` | **236** |
| `data/entities/gifts/limbus-assets/gifts.json` | `packs` | **필드 자체가 없음** |
| 같은 파일 | `exclusiveTo` | **321** |

`limbus-assets/gifts.json` 의 전체 키 집계 — `affinity`·`descs`·`keyword`·`names`·`search_desc`·`srcPath`·`tier`·`effects`·`triggers`·`exclusiveTo`·`events`·`ingredientOf`·`hardonly`·`enhanceable`·`recipes`·`fusion`·`imageOverride`·`hidden`·`vestige`·`cursedPair`·`blessedPair`·`updated`. **`packs` 는 없다.**

→ **`gift_pack` 10,115행은 `mj` 단독 출처이며 교차 검증이 원리적으로 불가능하다.** `docs/adr/04-source-authority.md` 2.3 의 서술을 소스 레벨에서 확인했다.

그리고 dead 85쌍의 정체가 여기서 정확히 드러난다:

```
mj.uniquePacks(236) ⊂ mj.packs(10,115)      — mj 내부는 정합. 벗어난 쌍 0
assets.exclusiveTo(321) ⊃ mj.uniquePacks(236)  — 교집합 236 · assets 단독 85 · mj 단독 0
assets 단독 85쌍 중 mj.packs 에 들어 있는 것: 0
```

`canonical.gift_exclusive_pack` = `assets.exclusiveTo` 321 을 그대로 적재한 것이고, `canonical.gift_pack` = `mj.packs` 10,115 를 그대로 적재한 것이다. **두 관계를 서로 다른 출처에서 가져와 합친 결과가 §3.5 의 dead 85쌍이다.** 어느 한쪽의 적재 버그가 아니라, 출처 간 불일치가 정합성 검사 없이 통과한 것이다.

---

## 4. public 대조 (차집합)

| 관계 | canonical | public | canonical−public | public−canonical |
|---|---|---|---|---|
| `gift_pack` | 10,115 | 10,115 | **0** | **0** |
| `gift_exclusive_pack` | 321 | 321 | **0** | **0** |
| `floor_pack` | 288 | 288 | **0** | **0** |
| `pack` | 117 | 117 | **0** | — |
| `fusion_recipe` | 68 | 68 | (키 구조 상이 · §5) | |
| `fusion_slot` | 179 | 179 | (키 구조 상이 · §5) | |
| `fusion_slot_option` | **7** | **185** | (모델링 상이 · §5) | |
| `gift` | **582** | 456 | **126** (전부 `story_dungeon`) | **0** |
| 효과 토큰 | `gift_effect` **1,122** | `gift_token`(effect) **1,123** | **0** | **0** |
| 발동 토큰 | `gift_trigger` **1,081** | `gift_token`(trigger) **1,081** | 0 | 0 |
| `hardOnly` | **122** | **116** | 6 | 0 |

**팩↔기프트 관계 본체(`gift_pack`·`gift_exclusive_pack`·`floor_pack`)는 양방향 차집합 0 으로 완전 일치한다.** 재적재 과정에서 이 관계는 하나도 잃지 않았고 하나도 만들어내지 않았다.

### 4.1 효과 토큰 1건 차 (버그 아님 · 설계 결과)

`public.gift_token` 은 `(giftId, kind, index)` 를 갖고 `canonical.gift_effect` 는 `(gift_id, effect_id)` 가 PK 다. 중복 토큰이 하나 있어 PK 가 흡수했다:

```
gift 9429 · kind=effect · token="Gain Speed / Haste" — public 에 2행, canonical 에 1행
```

**관측** — `lib/engine/score.ts:44` 는 `gift.effects` 를 전부 더하므로, 같은 엔진을 `canonical` 위에서 돌리면 기프트 9429 의 점수가 `public` 대비 낮아진다. 영향 범위는 582종 중 1종.

**관측** — `canonical.gift_effect`·`gift_trigger` 에는 **순서 컬럼이 없다.** `public.gift_token.index` 가 보존하던 토큰 순서가 canonical 에는 없다. 현재 엔진은 모든 발동 조건을 AND 로 묶어 모든 효과에 걸므로(`load.ts:111`) 순서에 의존하지 않지만, 「효과-발동 짝짓기」를 후속 슬라이스로 정밀화하려면 순서가 필요할 수 있다.

### 4.2 `gift.tier` 표현 변경 (손실 없음)

`public.gift.tier` 는 text 이며 `1`~`5` 와 `EX` 2건을 담는다. `canonical.gift.tier` 는 integer 라 `EX` 를 담지 못하고, 대신 `tier_label` 이 그 2건만 채운다.

```
9799 · 9800 → canonical: tier=NULL, tier_label='EX' / public: tier='EX'
```

`canonical.gift` 의 `tier` NULL 128건 = `story_dungeon` 126 + 위 2건. 값은 잃지 않았다.
다만 `lib/engine/state.ts:33` 의 `Gift.tier` 는 `string` 이라 canonical 을 붙이려면 두 컬럼을 합쳐야 한다.

### 4.3 `canonical.gift` 에 없는 `public.gift` 컬럼 — **`sprite`**

`public.gift.sprite`(NOT NULL) 에 대응하는 컬럼이 `canonical.gift` 에 **없다.** canonical 전체에서 sprite 컬럼은 `pack.sprite`·`pack.overlay_sprite`·`status.sprite` 뿐이다.

`lib/queries/gifts.ts:114·198·213·224` 와 `lib/assets.ts:98` 이 `giftIcon(g.sprite)` 로 아이콘을 만든다.
→ **기프트 아이콘은 `canonical` 만으로 못 만든다.** §7 참조.

---

## 5. 합성 사슬

### 5.1 사슬은 이어진다

```
fusion_recipe 68  →  fusion_slot 179  →  fusion_slot_option 7
```

- 슬롯 없는 레시피 **0건**
- 레시피 없는 슬롯 — FK 로 불가
- `material_id`/`option.material_id` 가 `gift` 에 없는 것 **0건**
- 레시피 결과 기프트 **60종** (1레시피 52종 · 2레시피 8종 → 68)

### 5.2 `fusion_slot_option` 이 7행뿐인 것은 **정상이다** (원본까지 확인함)

숫자가 작아 보인 이유는 데이터 손실이 아니라 **모델링 차이**다.

| 스키마 | 슬롯의 재료를 어디에 두는가 |
|---|---|
| `public` | `fusion_slot` 에 재료를 두지 않는다. 재료는 **전부** `fusion_slot_option` 에 (**185행**) |
| `canonical` | 재료 1개짜리 슬롯은 `fusion_slot.material_id` 에 인라인(**178행**), 대체 후보가 여럿인 슬롯만 `fusion_slot_option` 으로 넘긴다(**7행**) |

산술이 정확히 맞는다:

```
canonical: fusion_slot.material_id NOT NULL 178 + fusion_slot_option 7 = 185
public:    fusion_slot_option                                          = 185
```

`public` 쪽 슬롯당 옵션 수 분포도 일치한다 — 옵션 1개인 슬롯 **178**, 옵션 **7**개인 슬롯 **1**.

원본 JSON `data/entities/gifts/limbus-assets/gifts.json` 을 직접 파싱했다:

```
assets recipes 68 · slots 179
객체(다중 옵션) 슬롯: 1건
  {'count': 2, 'options': ['9105','9110','9116','9121','9126','9131','9136']}
```

**68 / 179 / 7 이 원본과 1:1 로 일치한다.** DB 의 그 슬롯:

```
9083 (달의 기억) recipe 0
  slot 0 : material_id = NULL, count = 2   ← 옵션 7개 중 2개를 고르는 슬롯
  slot 1 : 9142
  slot 2 : 9147
  slot 3 : 9152
fusion_slot_option: (9083,0,0) → 9105 · 9110 · 9116 · 9121 · 9126 · 9131 · 9136
```

리포지토리 문서도 같은 말을 한다 — `docs/data/gift/00-overview.md:114` 「`9083` 달의 기억 — 유일한 **대체 슬롯 레시피**. mj 가 표현 못 한다」, `docs/data/gift/03-limbus-assets-gifts.md:115`.

실제로 `mj` 소스는 이 레시피를 담지 못한다(파싱 실측: `mj.combinesFrom` = 레시피 **67** · 재료 **175**, 전부 단일 재료. 9083 의 `combinesFrom` 은 **빈 배열**). assets 의 68/179 와 정확히 1레시피 4슬롯 차이다.

→ **`fusion_slot_option` 7행은 결손 신호가 아니다. 게임에 대체 슬롯 레시피가 하나뿐이라는 사실의 정확한 반영이다.**

### 5.3 다만 `fusion_slot.count` 는 채움률 0.6% 다

`canonical.fusion_slot.count` 는 179행 중 **1행**(위 9083 슬롯, count=2)만 채워져 있다.
`public.fusion_slot.count` 는 NOT NULL 이며 **178행이 1 · 1행이 2** 다.

**관측** — canonical 은 「count=1」을 암묵값으로 두고 저장하지 않는다. 값이 사라진 것은 아니지만, 소비자가 `COALESCE(count, 1)` 을 해야 한다는 규약이 스키마에 표현돼 있지 않다. 이 규약을 모르는 소비자는 NULL 을 「수량 미상」으로 읽는다.

### 5.4 합성 결과물은 팩에서 안 나온다

- 레시피 결과 기프트 60종 중 **59종이 `gift_pack` 에 없다** (남은 1종은 확인 못 함 — 어느 것인지 별도 질의 안 함)
- 그 59종은 전부 `gift_exclusive_pack` 에 등재돼 있고, 그 등재는 **100% dead** (§3.5)

**관측** — `gift_exclusive_pack` 이 두 의미를 섞어 담고 있다고 읽을 수 있다. (1) 「이 팩에서만 **드랍**된다」 236쌍, (2) 「이 팩에서만 **합성**할 수 있다」 64쌍. 스키마에 이를 구분하는 컬럼이 없어 소비자가 둘을 분간할 수 없다. 단정하지 않는다 — 관측으로 남긴다.

---

## 6. hardOnly 122건 재검

| 대상 | 값 |
|---|---|
| `canonical.gift where hard_only` | **122** ✅ |
| `public.gift where "hardOnly"` | **116** |

**canonical 이 122 로 정확히 맞는다.**

출처를 파싱해 122 의 구성을 확인했다:

| 출처 | 필드 | 기프트 수 |
|---|---|---|
| `limbus-data-mj/gifts.json` | `hardOnly` | **53** |
| `limbus-assets/gifts.json` | `hardonly` | **116** |
| 합집합 | | **122** ✅ |
| 교집합 | | 47 |
| assets 단독 | | 69 |
| **mj 단독** | | **6** |

`public` 의 116 은 `limbus-assets` 값만 쓴 것이다(수치·집합 모두 일치). `canonical` 은 합집합 122 를 쓴다.

**mj 단독 6건과 합성 계통** — 마스터북의 「하드 전용 합성 계통 둘」을 실측으로 확인했다:

| id | 이름 | tier | 레시피 | 재료로 쓰임 | 팩 |
|---|---|---|---|---|---|
| 9212 | 모든 악의 끝 | 4 | 1 | 0 | 0 |
| 9249 | 조그맣고 근사한 바이올린 | 4 | 1 | 0 | 0 |
| 9841 | C형 정리 요원 장비 세트 | 4 | 1 | 0 | 0 |
| 9427 | 마을을 지킬 작살 | 2 | 0 | **1** | 1 |
| 9428 | 고래의 심장 | 4 | 0 | **1** | 1 |
| 9431 | 부서진 바이올린 | 3 | 0 | **1** | 1 |

**관측** — 6건이 정확히 「결과물 3 + 재료 3」으로 갈린다. 재료 3종은 팩에서 드랍되고(팩 1개씩), 결과물 3종은 합성으로만 얻는다(팩 0). 「합성 계통 둘」이라는 서술보다는 **계통 셋**으로 보이지만, 9212/9249/9841 의 레시피 재료가 9427/9428/9431 과 어떻게 대응하는지는 이 감사에서 추적하지 않았다 — **확인 못 함.**

---

## 7. 엔진이 할 수 있는 것과 못 하는 것

「층 진입 → 팩 3장 제시 → 각 팩 점수화 → 근거 표시」를 `canonical` 만으로 끝까지 돌릴 수 있는가.

### 7.1 단계별 판정

| 단계 | canonical 소스 | 판정 |
|---|---|---|
| 층 진입 → 후보 팩 | `floor_pack` 288 (public 과 차집합 0) | **가능** |
| 등장성 필터 (`hidden`/`limited`) | `pack.category` · `pack.extreme` 둘 다 존재 | **가능** |
| 팩 → 기프트 집합 | `gift_pack` 10,115 (차집합 0) | **가능** |
| 기프트 효과·발동 | `gift_effect` 1,122 · `gift_trigger` 1,081 (차집합 0) | **가능** (토큰 1건 흡수 · §4.1) |
| 덱 특성 (소속·상태) | `identity`·`identity_association`·`identity_status`·`identity_skill`·`association` 모두 존재 | **가능** |
| 조건 정밀화용 설명문 | `gift_stage_text.desc` | **가능** |
| 점수 5항 중 4항 | 위 재료로 계산됨 | **가능** |
| `exclusiveOpportunity` | `gift_exclusive_pack` 321 중 **236 만 유효** | **부분 가능 — 26.5% 소실** |
| `fusionProgress` | `fusion_recipe`/`slot`/`option` 완비 | **데이터는 있으나 엔진이 하드코딩 0** |
| 근거 표시 (텍스트) | `gift_stage_text` · `pack_text` | **가능** |
| 근거 표시 (기프트 아이콘) | **`gift.sprite` 컬럼 없음** | **불가** |
| 기프트 등급 표시 | `tier`(int) + `tier_label`(text) 를 합쳐야 함 | 가능(코드 수정 필요) |

### 7.2 결론

**점수를 내는 데까지는 `canonical` 만으로 끝까지 돈다.** 팩↔기프트 관계 본체가 `public` 과 차집합 0 이므로 점수의 주요 4항(`immediate`·`universal`·`futureOption`·`redundancy`)은 값이 동일하게 나온다(기프트 9429 1건 제외).

막히는 곳은 셋이다.

1. **`exclusiveOpportunity` 가 구조적으로 26.5% 죽어 있다.** 이건 canonical 만의 문제가 아니라 `public` 도 같다(차집합 0 이므로 동일). `pack.ts:103` 의 검사가 `pack.gifts` 루프 안에 있어, `gift_pack` 에 없는 85쌍은 절대 도달하지 못한다. 영향: 전용 기프트를 가진 71팩 중 **44팩이 일부 손실**, 그중 **12팩은 전용 기프트가 전부 죽어 `exclusiveOpportunity` 가 항상 0** 이다. 유효한 전용 팩은 **59개**뿐이다. `/ko/recommend` hard 3층 실측에서 상위 5팩의 `exclusiveOpportunity` 가 0.25~1.90 으로 다른 항(`futureOption` 63~123, `immediate` 22~24)에 비해 두 자릿수 작은 것과 무관하지 않다.

2. **`fusionProgress` 는 데이터가 다 있는데 엔진이 안 읽는다.** `fusion_recipe` 68 · `fusion_slot` 179 · `fusion_slot_option` 7 · 무결성 위반 0 으로 완비돼 있으나 `pack.ts:109` 가 상수 0 이다. 「초반에 합성 재료를 모으는 팩이 좋다」는 `FLOOR_PHASE.early.fusionProgress = 1.4` 의 의도가 전혀 작동하지 않는다. 특히 합성 결과물 59종이 `gift_pack` 밖에 있으므로, 합성을 안 보면 **엔진은 그 59종의 가치를 영원히 못 센다.**

3. **아이콘을 못 만든다.** `canonical.gift` 에 `sprite` 가 없어 `giftIcon()` 을 호출할 수 없다. 「근거 표시」를 텍스트로만 할 거면 문제없지만, 현행 화면과 같은 밀도로 그리려면 `public.gift.sprite` 를 계속 참조하거나 canonical 에 컬럼을 추가해야 한다.

또 하나. **팩 3장 제시를 `canonical` 로 재현할 수는 있으나, 「어느 3장이 뜨는가」는 어느 스키마에도 없다.** `floor_pack` 은 「이 층 구간에 등장 가능한 팩 목록」이고(hard 3층 = 27개), 실제 제시 3장의 추출 확률은 없다. `lib/queries/packs.ts:12` 주석도 「등장 확률은 표시하지 않는다. 확률은 어느 출처에도 없다」고 적고 있다. 현행 엔진은 후보 전체를 줄 세워 상위 N개를 보여주는 것이며, 이는 「제시된 3장 중 고르기」와 다른 문제다.

---

## 8. 사용자 확인 필요 항목

### 8.1 [최우선] dead 85쌍 — 어느 출처가 맞는가

두 출처가 서로 다른 말을 하고 있고 어느 쪽도 반증할 데이터가 없다.

**확인 방법** — 게임에서 해당 테마 팩을 골라 층을 진행하고, 전투 후 기프트 선택 화면에 그 기프트가 뜨는지 본다.

| 팩 id | 팩 이름 | 확인할 기프트 | 예상 (assets 가 맞다면) |
|---|---|---|---|
| **1122** | 선의의 순례 | 9831 시테러 연구집 · 9832 황금으로 만든 나침반 · 9833 은빛 열쇠 모음 · 9834 말린 시테러 · 9835 밝게 빛나는 등불 · 9836 오래된 악보 · 9837 금속 구성체 · 9838 달을 담은 술잔 · 9839 고풍스러운 페이퍼 나이프 | 9종이 이 팩에서 드랍된다 → `gift_pack` 에 9행 결손 (현재 1122 는 73행) |
| 1513 | 1호선 : 광기 | 9252 못과 망치 | 드랍된다 → `gift_pack` 결손 |
| 1515 | 페어리테일 | 9254 한 잔 더! | 드랍된다 → `gift_pack` 결손 |
| 1124 | 호박색 어스름의 시련 | 9241 아직 따뜻한 커피 | 드랍된다 → `gift_pack` 결손 |

1122 한 팩만 확인해도 판정이 갈린다. **9종이 뜨면** `gift_pack`(mj) 이 결손이고 `gift_exclusive_pack`(assets) 이 옳다. **안 뜨면** assets 의 `exclusiveTo` 가 「드랍 전용」이 아닌 다른 의미(예: 이 팩 안에서만 합성/이벤트로 획득)를 담고 있는 것이다.

**화면 위치** — 「E.G.O 기프트 획득」 선택지 3장. 층을 여러 번 반복해야 확률상 확인 가능하다. 대안으로 팩 선택 직후 팩 정보 UI 의 전용 기프트 표시를 본다.

### 8.2 `gift_exclusive_pack` 이 두 의미를 섞는가

합성 결과물 59종의 전용 등재 64쌍이 100% dead 다(§5.4). 「이 팩에서만 **드랍**」과 「이 팩에서만 **합성 가능**」이 한 테이블에 들어 있는지 확인이 필요하다.

**확인 방법** — 아무 테마 팩이나 하나 골라 진행 중 합성 UI 를 열고, 다른 팩에서는 만들 수 없는 기프트가 목록에 있는지 본다.
**갈리는 지점** — 합성 가능 목록이 팩마다 다르면 「두 의미가 섞였다」가 맞고, 팩과 무관하게 같으면 assets 의 `exclusiveTo` 가 합성 결과물에 대해서는 다른 뜻(예: 「이 팩의 재료로만 만들 수 있다」)이거나 잘못된 값이다.

### 8.3 획득 경로 0건인 13종은 어떻게 얻는가

§3.3 의 13종은 팩·합성·이벤트·시작 어디에도 없다. 특히:

- **9991~9995 「잔영」** (어두운/아스라한/빛나는/찬란한/달의) — 등급 1~5 완전 사다리
  - **확인 방법** — 거울 던전 진행 중 EGO 기프트 강화·승급 UI, 또는 층 클리어 보상 화면
  - **갈리는 지점** — 강화 재화/승급 아이템이면 「기프트」 테이블에 있는 것 자체가 분류 문제다. 별도 획득 계통이면 새 관계 테이블이 필요하다
- **9256~9259** (불완전한 예지안 · 남겨진 신탁 · 앙갚음 장부 : 번외 · 작품이 된 마에스트로 링) — 4종 모두 tier 4 · hardOnly
  - **확인 방법** — hard 난이도 11–15층 보스전 보상, 또는 특정 팩의 조건부 이벤트
  - **갈리는 지점** — 팩에서 드랍되면 `gift_pack` 결손 4행. 보스 보상 전용이면 별도 관계가 필요하다
- **9228 신검합일 · 9230 황금빛 시간 · 9232 가능성** (tier 3, hardOnly=false)
- **9799 어떤 철학** (tier EX)

### 8.4 `extreme` 팩 8종의 187~188 이 실제 풀인가

`extreme` 8팩이 `gift_pack` 에 187~188종을 갖는다. 이는 팩에 붙는 기프트 358종의 52% 다.
**확인 방법** — 게임에서 `extreme` 팩(예: 1504 영겁의 굴레) 진행 중 기프트 선택지가 실제로 범용 풀 전체에서 나오는지, 아니면 테마별로 좁혀지는지 본다.
**갈리는 지점** — 실제로 187종 전부에서 뽑는다면 데이터가 맞고 「extreme 팩은 정보량 0」이 사실이다. 좁혀진다면 `gift_pack` 이 「등장 가능」을 너무 넓게 담고 있다는 뜻이며, 점수화의 정의역 자체가 과대평가된다.

### 8.5 기프트 9429 의 중복 효과 토큰

`public` 은 "Gain Speed / Haste" 를 2번, `canonical` 은 1번 담는다.
**확인 방법** — 게임에서 기프트 9429 의 설명문에 속도 획득 효과가 두 번 서술되는지 본다.
**갈리는 지점** — 두 번이면 canonical 의 PK 가 값을 삼킨 것이고, 한 번이면 public 이 중복 적재한 것이다. 영향은 이 기프트 하나의 점수뿐이다.

---

## 부록 — 이 감사가 확인하지 못한 것

- 레시피 결과 60종 중 `gift_pack` 에 있는 **1종**이 무엇인지 (별도 질의 안 함)
- mj 단독 hardOnly 6건의 합성 계통이 실제로 「둘」인지 「셋」인지 — 재료↔결과 대응을 추적하지 않음 (§6)
- `raw` 스키마(`raw_object` 43,270행)를 통한 원본 무손실 대조 — 소스 JSON 을 직접 파싱해 대체함
- `gift_requirement.value` jsonb 의 내부 구조 정합성 (kind 별 스키마 검증 안 함)
- `choice_event_gift` 219행과 `assets.events`(218종) 의 쌍 단위 대조
- 팩당 기프트 등장 **확률** — 어느 스키마·출처에도 없음이 확인됨

---

## 9. 추가 판정 — 85쌍의 정체 (2026-08-02, 위키 조사)

이 문서 1절이 「85쌍이 엔진에서 죽어 있다」고 적은 것에 대한 후속 판정이다.
`limbuscompany.wiki.gg` 의 테마팩별 「Unique E.G.O Gifts」 목록과 전수 대조했다.

```
64쌍   합성 결과물 (fusion_recipe 결과)   정상 — 드랍 풀에 없는 것이 맞다
11쌍   Extreme 팩 10 + Hidden 팩 1        정상 — 완주 보상·희귀 조건부
10쌍   진짜 결손                          gift_pack 에 있어야 한다
```

**대조군 — 팩 1104 육참골단.** 전용 12종 중 `gift_pack` 에 있는 7종이 위키 unique 7종과
등급까지 정확히 일치했다(Black Ledger II · Rusted Hilt III · Fractured Blade III ·
Broken Blade III · Red Tassel III · Ragged Bamboo Hat IV · Old Dopo Robe IV).
없는 5종은 전부 `fusion_recipe` 결과물이고 위키 unique 목록에도 없다.
→ **테마 전용 드랍 기프트는 `gift_pack` 에 들어간다**는 규칙이 성립한다.

**정상 확인 근거**
- 팩 1511 코드 퍼플 / `Mid-range K Corp. Ampule`(9250) — 위키: 팩 완주 시 자동 지급
- 팩 3001 뽕.황 / `Bongy Plush`(9242) — 위키: 특수 조건 필요, 층 보상 아님

**결손 10쌍**

| 팩 | 기프트 | 근거 |
| --- | --- | --- |
| 1122 선의의 순례 | 9831–9839 (9종 전부) | 위키가 9종 전부를 Unique 로 열거. 등급 일치(III·III·IV×7). 합성 결과물 0건 |
| 1124 호박색 어스름의 시련 | 9241 아직 따뜻한 커피 | 위키 unique 7종 중 6종은 풀에 있고 이것만 없다. 등급 III 일치 |

1124 가 결정적이다 — 같은 팩 안에서 6종은 들어가고 1종만 빠졌다. 설계가 아니라 결손이다.

원인은 알려진 출처 프로파일과 맞는다 — 「`mj` 는 갱신이 늦다 · 이벤트 기프트 122 누락」.
1122 는 2025-09-25 명일방주 콜라보, 1124 는 발푸르기스의 밤 계열이다.

**제안 검사** — `gift_exclusive_pack` 의 각 쌍은 ① `gift_pack` 에 있거나 ② `fusion_recipe`
결과물이거나 ③ 팩이 `Extreme`·`Hidden` 태그여야 한다. 지금 걸면 10건이 잡힌다.

출처: [Pilgrimage of Compassion Theme Pack](https://limbuscompany.wiki.gg/wiki/List_of_Floor_Themes/Pilgrimage_of_Compassion) ·
[The Dusk of Amber](https://limbuscompany.wiki.gg/wiki/List_of_Floor_Themes/The_Dusk_of_Amber) ·
[Code Purple Theme Pack](https://limbuscompany.wiki.gg/wiki/Code_Purple_Theme_Pack) ·
[The B.E. Theme Pack](https://limbuscompany.wiki.gg/wiki/The_B.E._Theme_Pack)
