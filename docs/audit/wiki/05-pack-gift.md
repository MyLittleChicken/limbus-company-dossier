# 팩↔기프트 잔여 4건 — 위키 조사 판정

조사일 2026-08-03 · 대상 `docs/audit/05-pack-gift.md` §8.2 · §8.3 · §8.4 · §8.5
주 출처 `limbuscompany.wiki.gg` (공식 위키. fandom·miraheze 보다 신뢰도 높음)
DB 실측은 `canonical` 스키마 · 소스 JSON 은 `data/entities/gifts/limbus-assets/gifts.json`

---

## 0. 이번 조사의 열쇠 — 위키의 테마팩 페이지 구조

4건 중 3건이 이 하나의 발견으로 갈렸다. 위키의 테마팩 페이지는 기프트를 **세 구획으로 나눠 적는다.**

```wikitext
==E.G.O Gift Rates==
{| class="lcbtable2" ...
! Unique Gifts
|-
|{{GiftList|Fractured Blade;Broken Blade;Ragged Bamboo Hat;Rusted Hilt (MD);Red Tassel (MD);Old Dopo Robe (MD);Black Ledger}}
|-
! Featured Gifts
|-
|{{#invoke:GiftList|Category|MD3}}
|}

...

==Fusion Gifts==
{| ...
! colspan="2" |Fused Gifts
! style="border-left:2px solid #600000"|Result
|-
|...Fractured Blade | ...Rusted Hilt | ...Sublimity
|-
|...Broken Blade    | ...Rusted Hilt | ...Unbending
|}
```

— [Yield My Flesh to Claim Their Bones Theme Pack](https://limbuscompany.wiki.gg/wiki/Yield_My_Flesh_to_Claim_Their_Bones_Theme_Pack?action=raw) 원문

세 구획의 뜻이 서로 다르다.

| 위키 구획 | 뜻 | 우리 테이블 대응 |
|---|---|---|
| `Unique Gifts` | 이 팩에서만 **드랍**되는 기프트. 팩별로 명시 열거 | `gift_pack` ∩ `gift_exclusive_pack` (live) |
| `Featured Gifts` | `{{#invoke:GiftList|Category|MD3}}` — 팩이 아니라 **MD 세대 공용 풀**을 통째로 불러옴 | `gift_pack` 의 범용 부분 |
| `Fusion Gifts` | 이 팩의 unique 를 재료로 쓰는 **합성 레시피와 그 결과물** | `fusion_recipe` + `gift_exclusive_pack` (dead) |

`Featured Gifts` 가 팩 이름이 아니라 카테고리 키(`MD3`)를 부르는 것이 중요하다. **위키는 팩별 일반 풀을 따로 적지 않는다. 세대 공용 목록 하나를 모든 팩이 공유해 렌더한다.**

`Module:GiftList/data` 의 최상위 카테고리 키 전량:

```
MD1, MD2, MD3, MD3_2, MD4, MD5, Railway, Keywordless, Keywordless2,
Burn, Bleed, Tremor, Rupture, Sinking, Poise, Charge, Slash, Pierce, Blunt,
Wrath, Lust, Sloth, Gluttony, Gloom, Pride, Envy, MDEX1, MDEX2
```

| 키 | 항목 수 |
|---|---|
| `MD3` | **99** |
| `MD5` | 39 |
| `Railway` | 16 |
| `MDEX1` | **147** |
| `MDEX2` | **161** |

— [Module:GiftList/data](https://limbuscompany.wiki.gg/wiki/Module:GiftList/data?action=raw)

---

## 1. `gift_exclusive_pack` 이 두 의미를 섞는가

**판정** 확정

**답** 섞는다. 위키는 「이 팩에서만 드랍」(`Unique Gifts`)과 「이 팩에서만 합성」(`Fusion Gifts`)을 **다른 절(節)로 분리해 적고**, 합성 레시피는 팩마다 다르다. 우리 테이블은 이 둘을 구분 컬럼 없이 한곳에 담고 있다.

**근거**

① 테마팩 페이지에 `==Fusion Gifts==` 가 `==E.G.O Gift Rates==` 와 **별도 섹션**으로 존재한다(§0 원문). 즉 위키 자체가 두 개념을 같은 것으로 보지 않는다.

② 합성 목록이 팩마다 다르다 — 세 팩을 대조했다.

| 팩 | 위키 `Fusion Gifts` 결과물 | 위키 `Unique Gifts` |
|---|---|---|
| 1104 육참골단 (Yield My Flesh) | **Sublimity · Unbending** (2종) | 7종 |
| 1124 호박색 어스름 (The Dusk of Amber) | **Pink Bouquet · Desperado** (2종) | 7종 |
| 1122 선의의 순례 (Pilgrimage of Compassion) | **섹션 자체가 없다** | 9종 |

> `|{{GiftList|Royal Jelly Perfume; Beak-shaped Necklace; Harmonics; Walking Bass; Pink Petals; Staticky Two-way Radio; Still-warm Coffee}}`
> `==Fusion Gifts==` … `|...Pink Petals| … |...Pink Bouquet`  `|...Staticky Two-way Radio|...Beak-shaped Necklace|...Torn Bandolier| … |...Desperado`
> — [The Dusk of Amber Theme Pack](https://limbuscompany.wiki.gg/wiki/The_Dusk_of_Amber_Theme_Pack?action=raw)

③ **왜 팩마다 다른지도 데이터로 설명된다** — 합성 레시피의 재료가 그 팩의 unique 드랍이다. 우리 DB `fusion_slot` 실측:

```
9717 Sublimity   ← 9713 Rusted Hilt  + 9714 Fractured Blade
9718 Unbending   ← 9713 Rusted Hilt  + 9715 Broken Blade
9783 Resplendence← 9714 Fractured Blade + 9782 Worn Hilt
9784 Cultivation ← 9715 Broken Blade + 9782 Worn Hilt
9280 The Book of the Homeland Swordplay ← 9193 Overused Whetstone + 9716 Red Tassel + 9279 Unadorned Sword-guard
```

9713·9714·9715·9716 은 전부 팩 1104 의 unique 드랍이다(`gift_pack` 에 1104 로 등재됨, 위키 `Unique Gifts` 7종과 일치). **재료가 그 팩에서만 나오므로 결과물도 그 팩에서만 만들 수 있다.** 「이 팩에서만 합성 가능」은 별도 규칙이 아니라 재료 게이팅의 파생 결과다.

④ 위키가 `Fusion Gifts` 결과물을 `Unique Gifts` 목록에 **넣지 않는다**. 1104 의 `Unique Gifts` 7종에 Sublimity·Unbending 은 없다. 우리 `gift_exclusive_pack` 은 둘을 함께 담는다.

**우리 데이터**

- `gift_exclusive_pack` 321쌍 = live 236 + dead 85. dead 85 중 **64쌍이 `fusion_recipe` 결과물**이고, live 236 중 합성 결과물은 **0건**이다(감사 §3.5). → **live/dead 경계가 정확히 「드랍 / 합성」 경계와 일치한다.**
- 팩 1124 의 `gift_exclusive_pack` 13행 실측 (강화 단계 중복 포함):
  ```
  9233 Staticky Two-way Radio  풀O  합성X
  9234 Beak-shaped Necklace    풀O  합성X
  9236 Harmonics (+, ++)       풀O  합성X
  9237 Walking Bass (+, ++)    풀O  합성X
  9238 Pink Petals             풀O  합성X
  9240 Royal Jelly Perfume     풀O  합성X
  9235 Desperado               풀X  합성O   ← 위키 Fusion Gifts
  9239 Pink Bouquet            풀X  합성O   ← 위키 Fusion Gifts
  9241 Still-warm Coffee       풀X  합성X   ← 위키 Unique Gifts. 결손 (§ 아래)
  ```
  위키의 3구획과 우리 13행이 **한 행도 어긋나지 않고** 대응한다.

**조치**

1. `canonical.gift_exclusive_pack` 에 의미 구분 컬럼을 넣는다. 예: `kind enum('drop','fusion')`.
   - `fusion_recipe` 에 결과물로 등재된 `gift_id` → `'fusion'`
   - 나머지 → `'drop'`
   - 현재 값으로 그대로 도출 가능하다(교집합 0이므로 무모순).
2. 엔진 `lib/engine/pack.ts:103` 은 `'drop'` 만 `exclusiveOpportunity` 로 세고, `'fusion'` 은 죽어 있는 `fusionProgress` 항의 입력으로 돌린다. 지금은 `pack.gifts` 루프 안에 있어 `'fusion'` 쌍이 원리적으로 도달 불가다.
3. 화면(`/ko/packs/*`)은 「이 팩에만 나오는 기프트」와 「이 팩에서만 합성 가능한 기프트」를 분리 표기한다. 감사 §1.3 이 지적한 1122/9831 의 화면 모순도 이 분리로 대부분 해소된다.

---

## 2. 획득 경로 0건인 13종은 어떻게 얻는가

**판정** 확정 (13종 전부)

**답** 13종은 셋으로 갈린다 — **저주 기프트 정화 3종 · EXTREME 히든 보스 드랍 4종 · 합성 실패 보상 1종 · 시작 버프 지급 5종**. 어느 것도 팩 드랍이 아니므로 `gift_pack` 결손이 아니다. 다만 **네 경로 모두 우리 스키마에 대응 테이블이 없다.**

DB 실측 목록(ko/en 병기):

| id | ko | en | tier | hardOnly | assets 필드 |
|---|---|---|---|---|---|
| 9228 | 신검합일 | One with the Blade | 3 | f | `blessedPair: 9227` |
| 9230 | 황금빛 시간 | Golden Hour | 3 | f | `blessedPair: 9229` |
| 9232 | 가능성 | Potentialities | 3 | f | `blessedPair: 9231` |
| 9256 | 불완전한 예지안 | Imperfect Eye of Precognition | 4 | **t** | `hidden: true` |
| 9257 | 남겨진 신탁 | The Abandoned Oracle | 4 | **t** | `hidden: true` |
| 9258 | 앙갚음 장부 : 번외 | The Book of Vengeance: Annex | 4 | **t** | `hidden: true` |
| 9259 | 작품이 된 마에스트로 링 | A Maestro's Ring-Turned-Artwork | 4 | **t** | `hidden: true` |
| 9799 | 어떤 철학 | A Certain Philosophy | EX | f | — |
| 9991 | 어두운 잔영 | Dark Vestige | 1 | f | `vestige: true` |
| 9992 | 아스라한 잔영 | Faint Vestige | 2 | f | `vestige: true` |
| 9993 | 빛나는 잔영 | Twinkling Vestige | 3 | f | `vestige: true` |
| 9994 | 찬란한 잔영 | Brilliant Vestige | 4 | f | `vestige: true` |
| 9995 | 달의 잔영 | Lunar Vestige | 5 | f | `vestige: true` |

**소스 JSON 이 이미 답의 절반을 갖고 있었다.** `limbus-assets/gifts.json` 의 `vestige`·`hidden`·`cursedPair`/`blessedPair` 필드는 `canonical.gift`(컬럼: `id·domain·sin·tier·tier_label·cost·keyword_id·hard_only·enhanceable`)로 **적재되지 않고 버려졌다.** 이 세 필드만 살렸어도 13종 중 12종은 미확정이 되지 않았다.

### 2-1. 9228 · 9230 · 9232 — 저주 기프트의 정화 결과물

**근거**

> "The following E.G.O Gifts are only available from rare events that can occur starting from Floor 3 of the Mirror Dungeon. Cursed E.G.O Gifts start out in a "Cursed" state, but after meeting criteria specified in the Description, it will become its "Blessed" counterpart."
> — [List of E.G.O Gifts](https://limbuscompany.wiki.gg/wiki/List_of_E.G.O_Gifts?action=raw) · `Cursed E.G.O Gifts` 절

> "Purify a Cursed E.G.O Gift and unlock 'One with the Blade' in the E.G.O Gift Compendium" — Lunacy x10
> "Purify a Cursed E.G.O Gift and unlock 'Golden Hour' in the E.G.O Gift Compendium" — Lunacy x10
> "Purify a Cursed E.G.O Gift and unlock 'Potentialities' in the E.G.O Gift Compendium" — Lunacy x10
> — [Mirror of Names and Spiders](https://limbuscompany.wiki.gg/wiki/Mirror_of_Names_and_Spiders) · `Hidden Achievements` 절

**우리 데이터** — 사슬이 이미 DB 안에 완전히 있다. 다만 두 조각이 끊겨 있다.

```
choice_event 971085 → gift 9227 저주 Baleful Hwando(1등급)  ─┐
choice_event 971086 → gift 9229 저주 Tarnished Gauntlet(1등급) ├ canonical.choice_event_gift 에 있음
choice_event 971087 → gift 9231 저주 Record Logs of That Day  ─┘

assets.cursedPair: 9227→9228 · 9229→9230 · 9231→9232      ← canonical 에 적재 안 됨
```

9227·9229·9231 은 `gift_pack` 0행이지만 `choice_event_gift` 로 경로가 잡혀 「경로 0건」에 안 들어갔고, 정화 결과인 9228·9230·9232 만 고아로 남았다. **위키의 「rare events from Floor 3」와 우리 `choice_event` 3건이 정확히 대응한다.**

**조치** — `canonical.gift` 에 `blessed_pair_id` / `cursed_pair_id` (self-FK, nullable) 를 추가하고 assets 의 3쌍을 적재한다. 그러면 9228/9230/9232 의 획득 경로가 `choice_event → 저주 기프트 → 정화` 로 이어진다. 화면에서는 저주 기프트 상세에 「정화 시 → X」를 표시한다.

### 2-2. 9256 ~ 9259 — EXTREME 히든 보스 노드 드랍

**근거**

> "In any non-Boss, non-Shop Node on a floor while in the Mirror Dungeon's EXTREME Mode, there is a 10% chance for the current node being replaced by an optional, hidden Boss Node."
> 이 보스들은 "exclusive Tier IV E.G.O Gifts alongside 1000 Cost and fully healing all Sinners" 를 보상으로 준다.
> — [Mirror Dungeon](https://limbuscompany.wiki.gg/wiki/Mirror_Dungeon) · `Mirror Dungeon EXTREME Bosses` 절

같은 절의 표 원문(wikitext, [Mirror of Names and Spiders](https://limbuscompany.wiki.gg/wiki/Mirror_of_Names_and_Spiders?action=raw)):

```wikitext
|{{EnBox|1379}} … |{{GiftTT|Imperfect Eye of Precognition|75}}
|{{EnBox|1380}} … |{{GiftTT|The Abandoned Oracle|75}}
|{{EnBox|1382}} … |{{GiftTT|The Book of Vengeance: Annex|75}}
|{{EnBox|1383}} … |{{GiftTT|A Maestro's Ring-Turned-Artwork|75}}
```

보스 대응 — 9256 = The Thumb Nursefather (Valencina) · 9257 = The Index Nursefather (Rien) · 9258 = The Middle Nursefather (Matthias) · 9259 = The Ring Nursefather (Callisto).

**우리 데이터** — 4종 모두 `gift_pack` 0 · `gift_exclusive_pack` 0 · `fusion_recipe` 0 · `choice_event_gift` 0. `assets.hidden: true` 이며 `hidden` 플래그를 가진 기프트는 전체에서 **5종뿐**이다 — `9242, 9256, 9257, 9258, 9259`. 9242 봉이 인형(Bongy Plush)은 감사 §9 에서 이미 「특수 조건, 층 보상 아님」으로 판정된 것이다. **`assets.hidden` 은 「팩 드랍 풀 밖의 조건부 획득」을 뜻하는 플래그로 읽힌다.**

또 4종은 전부 설명문이 `Allies' Plus Coin Skills: Gain Coin Power +(8 / # of Coins)…` 로 시작한다. 이 접두를 가진 기프트는 DB 전체에서 이 4종뿐이다 — EXTREME 보스 보상 계열의 서명이다.

**조치** — `canonical` 에 `pack_boss_encounter`(75행)·`reward`(200행) 테이블이 이미 있다. 보스 보상 기프트 관계를 담을 자리가 이미 있다는 뜻이다. 최소 조치로는 `canonical.gift` 에 `hidden boolean` 을 추가해 assets 값 5건을 적재하고, 소비자가 「팩 풀에 없는 것이 정상」임을 알 수 있게 한다. 그 다음 단계로 `boss_reward_gift(encounter_id, gift_id)` 를 신설한다.

### 2-3. 9799 어떤 철학 (A Certain Philosophy) — 합성 실패 보상

**판정** 확정

**근거**

> "If a Fusion with 99%+ chance of resulting in an E.G.O Gift of the desired Keyword 'fails'… the A Certain Philosophy E.G.O Gift will be produced if it is not already owned."
> Tier: EX · Cost: 999 · Effect: "Fix Fusion Probability forecast to 100%"
> — [Mirror Dungeon](https://limbuscompany.wiki.gg/wiki/Mirror_Dungeon) · `Gift Fusion Details > Random Fusions` 절

> "Unlock the EX-Tier E.G.O Gift 'A Certain Philosophy' in the E.G.O Gift Compendium" — Lunacy x10
> — [Mirror of Names and Spiders](https://limbuscompany.wiki.gg/wiki/Mirror_of_Names_and_Spiders) · `Hidden Achievements` 절

**우리 데이터** — 우리 설명문(`canonical.gift_stage_text` 9799 ko)은 「기프트 합성 확률이 항상 100%로 적용됨」, en 은 "Fix Fusion Probability forecast to 100%". **위키와 문자 단위로 일치한다.** tier 는 `tier_label='EX'`. EX 기프트는 9799 와 9800 Wealth 둘뿐이다.

**조치** — 팩·합성 레시피 어디에도 넣을 수 없는 「시스템 보상」이다. `canonical.gift` 에 획득 계통을 나타내는 `acquisition` enum(`pack_drop`·`fusion`·`choice_event`·`start`·`boss`·`system`·`starter_buff`) 을 두는 편이 정직하다. 지금은 「경로 0건」이 결손과 구별되지 않는다.

### 2-4. 9991 ~ 9995 「잔영」 — 실제 기프트다. 시작 버프로 지급된다

**판정** 확정

**답** 강화 재화도 승급 아이템도 아니다. **정규 E.G.O 기프트**이며, 등급 1~5 완전 사다리인 이유는 「해당 등급의 만능 합성 재료 / 판매용 대체품」이기 때문이다. 획득은 **시작 버프(Starter Buff)** 다.

**근거**

> "Upon entry, gain 1 {{GiftTT|Dark Vestige|25|t}}"
> "Upon entry, gain 1 {{GiftTT|Dark Vestige|25|t}} and 1 {{GiftTT|Faint Vestige|25|t}} each"
> "Upon entry, gain 1 {{GiftTT|Dark Vestige|25|t}}, 1 {{GiftTT|Faint Vestige|25|t}}, and 1 {{GiftTT|Twinkling Vestige|25|t}} each"
> — [Mirror of Names and Spiders](https://limbuscompany.wiki.gg/wiki/Mirror_of_Names_and_Spiders?action=raw) · `Starter Buffs` 절, 버프 **"Perfected Possibility"**(60 Starlight, 3단계 강화)

같은 페이지가 세 잔영의 스탯을 기프트로 적는다 — "Dark Vestige: Tier **I** Cost 100 … Counts as a Tier 1 E.G.O Gift" / "Faint Vestige: Tier **II** Cost 200" / "Twinkling Vestige: Tier **III** Cost 300". 전부 "used as ingredients for Fusion" 또는 상점 판매용이다.

**우리 데이터** — 설명문이 위키와 정확히 같다.

```
9991 ko 어두운 잔영  「1등급 E.G.O 기프트로 취급되며, 상점에서 판매하거나 합성에서 재료로 사용할 수 있다.」
9991 en Dark Vestige "Counts as a Tier 1 E.G.O Gift. Can be sold at a Shop or be used as an ingredient for Fusion."
… 9995 Lunar Vestige "Counts as a Tier 5 E.G.O Gift."
```

`assets.vestige: true` 를 가진 기프트는 정확히 이 5종이며, canonical 은 이 필드를 버렸다.

**주의 — 위키가 확인해주지 않는 것 (「위키로 불가」)**

- 위키에서 확인된 잔영은 **Dark · Faint · Twinkling 3종뿐**이다. **9994 Brilliant Vestige · 9995 Lunar Vestige 는 "Perfected Possibility" 버프 서술에 나오지 않는다.** 4·5등급 잔영의 획득 경로는 위키로 판정 불가다.
  - **게임에서 볼 것** — 거울 던전 상점의 판매 목록, 층 클리어 보상, 그리고 다른 시작 버프(특히 `Chance Comet` 계열)의 최고 강화 단계 설명문. 4·5등급 잔영이 어디서도 지급되지 않는다면 미구현 자산이다.
- **잔영이 합성 재료로 실제로 쓰이는 레시피는 우리 데이터에 0건이다.** `fusion_slot.material_id` · `fusion_slot_option.material_id` 어디에도 9991~9995 가 없다. 설명문("합성에서 재료로 사용할 수 있다")과 어긋난다.
  - 해석 — 잔영은 「해당 등급 아무 기프트 자리에나 들어가는 와일드카드」로 보이며, 그래서 레시피에 열거되지 않는다. **위키가 이를 명시하지 않으므로 단정하지 않는다.**
  - **게임에서 볼 것** — 잔영을 소지한 채 합성 UI 를 열고, 잔영이 임의 레시피의 재료 슬롯에 놓이는지 본다. 놓인다면 와일드카드가 맞고, 특정 레시피에서만 놓인다면 레시피 데이터가 결손이다.

**조치**

1. `canonical.gift` 에 `vestige boolean` 추가 · assets 5건 적재.
2. 시작 버프(Starter Buff)를 담는 관계가 없다. `start_gift` 30행은 **키워드 시작 기프트**(키워드 10종 × 3)로 별개다. 잔영은 여기 안 들어간다. 시작 버프 테이블을 신설하거나, 최소한 §2-3 의 `acquisition` enum 에 `starter_buff` 를 둔다.
3. 잔영 5종은 추천 엔진 점수화에서 제외해야 한다. 전투 효과가 없는 재화성 기프트를 `immediate`/`universal` 로 세면 잡음이 된다. 지금은 `gift_pack` 에 없어 우연히 제외돼 있으나, 규칙으로 표현돼 있지 않다.

---

## 3. `extreme` 팩의 187~188종 풀이 실제 풀인가

**판정** 확정 (구조에 대해서는) · 부분적으로 **위키로 불가** (정확한 종수에 대해서는)

**답** **범용 전체가 맞다. 테마별로 좁혀지지 않는다.** 위키는 모든 EXTREME 팩의 `Featured Gifts` 를 팩별 목록이 아니라 **단일 공용 카테고리(`MDEX1` / `MDEX2`)** 로 렌더한다. 다만 위키의 공용 풀은 147/161종이고 우리는 188종이라 **종수는 어긋난다.**

**근거**

EXTREME 팩 두 곳의 원문이 동일한 카테고리를 부른다.

> ```wikitext
> ==E.G.O Gift Rates==
> {| class="lcbtable2" …
> ! Unique Gifts
> |-
> |{{GiftList|Bongy Plush}}
> |-
> ! Featured Gifts
> |-
> |{{#invoke:GiftList|Category|MDEX1}}
> |}
> ```
> — [The B.E. Theme Pack](https://limbuscompany.wiki.gg/wiki/The_B.E._Theme_Pack?action=raw) (= 3001 뽕.황)

> ```wikitext
> ==E.G.O Gift Rates==
> {| class="lcbtable2" …
> ! Featured Gifts
> |-
> |{{#invoke:GiftList|Category|MDEX1}}
> |}
> ```
> — [Code Purple Theme Pack](https://limbuscompany.wiki.gg/wiki/Code_Purple_Theme_Pack?action=raw) (= 1511 코드 퍼플. `Unique Gifts` 행 자체가 없다)

일반 테마팩은 `MD3` 을 부른다(§0 의 1104 · 1122 · 1124 전부 `MD3`). **EXTREME 은 별도의 공용 풀을 쓰되, EXTREME 팩끼리는 그 풀을 공유한다.** 팩 이름이 렌더에 전혀 개입하지 않으므로 「테마별로 좁혀진다」는 가설은 위키상 성립하지 않는다.

EXTREME 이 별도 계통이라는 것은 기프트 목록 쪽에서도 확인된다.

> "===EXTREME E.G.O Gifts===
> The following E.G.O Gifts are only available within [[Mirror Dungeon#Parallel Superposition Mode (Infinity Mirror)|Parallel Superposition EXTREME]] floors."
> — [List of E.G.O Gifts](https://limbuscompany.wiki.gg/wiki/List_of_E.G.O_Gifts?action=raw)

> "After completing Floor 10, another popup will appear asking whether the Manager will enter 'Parallel Superposition EXTREME' … extends the Mirror Dungeon run to 15 Floors, with Floors 11~15 featuring unique Long Battle Theme Packs, highly difficult Mounting Trials, and Mounting Adversities … **Theme Pack Observation cannot be used in 'Parallel Superposition EXTREME'.**"
> — [Mirror Dungeon](https://limbuscompany.wiki.gg/wiki/Mirror_Dungeon)

마지막 문장이 제품 관점에서 결정적이다. **EXTREME 층에서는 팩 관찰(Theme Pack Observation)을 쓸 수 없다.** 미리 보고 고르는 행위 자체가 봉인된다.

**우리 데이터**

- `category='extreme'` 팩은 감사 §3.1 이 적은 8개가 아니라 **21개**다(팩당 184~188종). 8 은 187~188 상위 절단면이었다.
  ```
  extreme 21팩 · 최소 184 · 최대 188
  21팩 gift_pack 의 distinct gift_id 합집합 = 188
  ```
  → **21팩이 사실상 같은 188종 풀을 공유한다.** 팩 간 편차 최대 4종. 위키의 「단일 공용 카테고리」 구조와 정성적으로 일치한다.
- 카테고리별 팩당 풀 크기:
  ```
  extreme 21팩  184–188      canto 27팩  43–110
  walpurgis 4팩 79–80        sin 21팩    61–67
  event 18팩    24–88        keyword 14팩 58–61
  attack_type 6팩 54–55      railway 6팩  18–19
  ```
- **어긋나는 지점** — 위키 `MDEX1` 147 · `MDEX2` 161 vs 우리 188. 위키 `MD3` 99 vs 우리 일반 테마팩 73~81. `Railway` 16 vs 우리 18~19. **모든 구간에서 우리 쪽이 크다.** 위키가 MD 세대별로 목록을 나누는 데 반해(`MD1`~`MD5`, `MDEX1`·`MDEX2`) 우리 `gift_pack` 은 세대 구분 없이 하나로 뭉쳐 있는 것이 유력한 원인이다.
  - **단정하지 않는다.** 위키가 갱신이 덜 됐을 수도, 우리가 세대를 합쳐 과대 적재했을 수도 있다.
  - **게임에서 볼 것** — EXTREME 층에서 기프트 선택지를 20~30회 표본해 등장 기프트 집합이 188종 범위 안에 드는지, 그리고 구세대 전용 기프트(예: `MD1`·`MD2` 에만 있던 것)가 뜨는지 본다. 안 뜬다면 `gift_pack` 이 세대를 뭉쳐 과대 적재한 것이다.

**조치**

1. 「EXTREME 팩은 정보량 0」이라는 감사 §3.1 의 관측은 **위키로 뒷받침된다.** 게다가 게임이 EXTREME 에서 팩 관찰을 막아 놓았으므로, 추천 서비스가 EXTREME 팩을 후보로 줄 세우는 것 자체가 제품상 무의미하다. `lib/engine/load.ts:159` 의 주석(「뽕.황(3001)은 187종을 담은 덕에 언제나 1위」)이 가리키는 버그는 **가중치 조정이 아니라 EXTREME 21팩 전량 제외**로 푸는 것이 옳다.
2. `canonical.pack` 에 MD 세대(`md_generation`) 컬럼이 없다. 위키가 `MD1`~`MD5`·`MDEX1`·`MDEX2` 로 명확히 나누는 축이므로, 풀 과대 적재 의심을 해소하려면 이 축이 데이터에 필요하다.
3. 감사 §3.1 의 「`extreme` 8팩」 서술을 **21팩**으로 정정한다.

---

## 4. 기프트 9429 의 중복 효과 토큰

**판정** 확정

**답** 속도 획득 효과가 **두 번 서술된다.** `public` 의 2행이 옳고, **`canonical.gift_effect` 의 PK `(gift_id, effect_id)` 가 값을 삼켰다.**

**우리 데이터**

```
9429  ko 작살 의족 / en Harpoon Prosthetic Leg / tier 2 / hardOnly t / keyword Poise
ko: 턴 종료 시 [Breath] 위력과 [Breath] 횟수의 합이 가장 높은 아군 하나에게
    다음 턴에 [Agility] 2, [AttackUp] 2, [AttackDmgUp] 2 부여.
    피쿼드호 소속 인격의 최대 속도값 +1.
en: Turn End: apply 2 [Agility], 2 [AttackUp] and 2 [AttackDmgUp] next turn to the ally
    with the highest sum of [Breath] Potency and Count.
    The Pequod Identities gain Max Speed +1.
```

```
public.gift_token                      canonical
9429 effect 0  Gain Speed / Haste      gift_effect  9429  Gain Buff
9429 effect 1  Gain Offense Level Up                9429  Gain Offense Level Up
9429 effect 2  Gain Buff                            9429  Gain Speed / Haste   ← 1행뿐
9429 effect 3  Gain Speed / Haste
9429 trigger 0 Allies have Poise       gift_trigger 9429  Allies have Poise
9429 trigger 1 The Pequod Identities                9429  The Pequod Identities
```

**근거** — 위키가 설명문을 우리와 동일하게 적으며, 속도 관련 서술이 **문장 두 개에 각각 하나씩** 들어 있다.

> **Harpoon Prosthetic Leg** — Tier: **II** · Cost: 219 · Keyword: **Poise**
> "Turn End: apply 2 **Haste**, 2 Offense Level Up and 2 Damage Up next turn to the ally with the highest sum of Poise Potency and Count. The Pequod Identities gain **Max Speed +1**."
> — [The Evil Defining Theme Pack](https://limbuscompany.wiki.gg/wiki/The_Evil_Defining_Theme_Pack) · `Unique E.G.O Gifts` 절

두 속도 효과는 **서로 다른 효과다.**

| 토큰 index | 대응 서술 | 짝지어지는 trigger |
|---|---|---|
| effect 0 `Gain Speed / Haste` | "apply 2 **Haste** … to the ally with the highest sum of Poise Potency and Count" | trigger 0 `Allies have Poise` |
| effect 3 `Gain Speed / Haste` | "The Pequod Identities gain **Max Speed +1**" | trigger 1 `The Pequod Identities` |

트리거가 정확히 2개이고 효과 블록도 2개이므로, index 0–2 가 첫 블록 · index 3 이 둘째 블록이다. **`public.gift_token.index` 가 이 짝짓기를 보존하고 있었고 canonical 이 그것을 잃었다.** 감사 §4.1 이 「canonical 에는 순서 컬럼이 없다」고 적은 것의 실제 피해 사례다.

**우리 데이터 (부수 확인)** — `assets.gifts.json` 의 9429 는 `exclusiveTo: ['1015']`, `ingredientOf: ['9430']`, `hardonly: true`, `keyword: 'Poise'`, `tier: '2'`. 팩 1015 는 `canonical.pack` 에서 **악으로 규정되는 / The Evil Defining**(category `canto`, 풀 74종)이며, 위키의 출처 페이지와 정확히 같은 팩이다. `gift_pack` 에도 1행 존재 — 즉 9429 는 live 전용 기프트로 정상이다.

**조치**

1. `canonical.gift_effect` 의 PK 를 `(gift_id, effect_id)` 에서 `(gift_id, index)` 로 바꾸고 `index` 를 복원한다. `gift_trigger` 도 같다. 이래야 「어느 트리거가 어느 효과에 걸리는가」를 나중에 정밀화할 수 있다.
2. 임시 조치로도 최소한 중복 행은 살려야 한다 — 현재 canonical 위에서 엔진을 돌리면(`lib/engine/score.ts:44` 가 `gift.effects` 를 전부 합산) **9429 는 「피쿼드 최대 속도 +1」 만큼 점수를 덜 받는다.** 영향 범위는 582종 중 1종이나, 원인은 스키마 설계이므로 다른 기프트에서도 재발할 수 있다.
3. 회귀 검사 — `public.gift_token` 기준으로 `(giftId, kind, token)` 중복이 있는 기프트를 전수 조회해, canonical 적재 시 흡수되는 행이 9429 하나뿐인지 확인한다(감사 §4 의 1,123 vs 1,122 차이가 1이므로 1건일 가능성이 높으나 미검증).

---

## 5. 부수 발견 — 감사 §9 의 「진짜 결손 10쌍」 중 9쌍은 결손이 아니다

이번 조사에서 우연히 드러났다. **§9 의 판정을 정정해야 한다.**

**판정** 확정 (위키가 명시적으로 반대 판정을 내림)

**답** 팩 1122 선의의 순례의 9종(9831~9839)은 **결손이 아니라 게임에서 삭제된 콜라보 한정 콘텐츠**다. `gift_pack` 에 넣으면 안 된다. 1124 의 9241 한 건만 진짜 결손이다.

**근거**

> "This article covers content that has been scrapped or removed, and is no longer available in the game."
> "The **Pilgrimage of Compassion Theme Pack** was related to [Episode Arknights - EX: Pilgrimage of Compassion]"
> "It was available from September 25th, 2025 until October 23rd."
> — [Pilgrimage of Compassion Theme Pack](https://limbuscompany.wiki.gg/wiki/Pilgrimage_of_Compassion_Theme_Pack)

같은 9종이 **삭제 기프트 전용 페이지에 열거돼 있다.**

> "This article covers content that has been scrapped or removed, and is no longer available in the game."
> **Removed E.G.O Gifts**: Entry Ticket · Golden Entry Ticket · **Sea Terror Notes · Goldforged Compass · Silver Key Bundle · Sea Terror Jerky · Brilliant Lamplight · Aged Sheet Music · Metal Construct · Moonmirror Wine Cup · Classical-design Letter Opener**
> — [List of E.G.O Gifts/Unobtainable](https://limbuscompany.wiki.gg/wiki/List_of_E.G.O_Gifts/Unobtainable)

우리 DB 의 en 이름과 1:1 로 대응한다.

```
9831 시테러 연구집          Sea Terror Notes
9832 황금으로 만든 나침반    Goldforged Compass
9833 은빛 열쇠 모음          Silver Key Bundle
9834 말린 시테러            Sea Terror Jerky
9835 밝게 빛나는 등불        Brilliant Lamplight
9836 오래된 악보            Aged Sheet Music
9837 금속 구성체            Metal Construct
9838 달을 담은 술잔          Moonmirror Wine Cup
9839 고풍스러운 페이퍼 나이프  Classical-design Letter Opener
```

**§9 가 틀린 이유** — §9 는 「위키가 9종 전부를 Unique 로 열거」한 것을 근거로 결손 판정했다. 열거된 것은 사실이지만, **그 페이지 전체에 삭제 배너가 붙어 있는 것을 보지 않았다.** 위키는 삭제된 콘텐츠도 기록 목적으로 남긴다.

**1124 9241 은 결손이 맞다** — 대조군 논리가 여기서는 성립한다.

> `|{{GiftList|Royal Jelly Perfume; Beak-shaped Necklace; Harmonics; Walking Bass; Pink Petals; Staticky Two-way Radio; Still-warm Coffee}}`
> — [The Dusk of Amber Theme Pack](https://limbuscompany.wiki.gg/wiki/The_Dusk_of_Amber_Theme_Pack?action=raw) · `Unique Gifts`

이 페이지에는 삭제 배너가 없다. 7종 중 6종은 `gift_pack` 에 있고 **Still-warm Coffee(9241) 만 없다.** 같은 팩의 `Fusion Gifts` 2종(Desperado 9235 · Pink Bouquet 9239)은 §1 의 규칙대로 풀 밖이 정상이다. **결손 = 1쌍.**

**조치**

1. 「진짜 결손 10쌍」을 **1쌍(1124 × 9241)** 으로 정정한다. `gift_pack` 에 1행 추가.
2. 1122 는 삭제 콘텐츠다. **제품 판단이 필요하다** — 팩 117개 중 이런 한정 콘텐츠가 몇 개인지 파악하고, 추천 후보에서 제외할지 「과거 콘텐츠」로 표기할지 정한다. 현재 1122 는 `floor_pack` 에 있어 추천 후보로 뜬다.
3. §9 가 제안한 검사식(`gift_exclusive_pack` 의 각 쌍은 ① `gift_pack` 에 있거나 ② `fusion_recipe` 결과물이거나 ③ 팩이 Extreme·Hidden)에 **④ 팩이 삭제(retired) 콘텐츠** 조항을 더한다. 그러면 위반은 1건만 남는다. `canonical.pack` 에 `retired`/`available_until` 컬럼이 없으므로 이 조항은 지금 표현 불가다.

---

## 6. 판정 요약

| # | 항목 | 판정 | 답 |
|---|---|---|---|
| 1 | `gift_exclusive_pack` 이 두 의미를 섞는가 | **확정** | 섞는다. 위키는 `Unique Gifts`(드랍)와 `Fusion Gifts`(합성)를 별도 절로 분리. 합성 목록은 팩마다 다르며 이유는 재료 게이팅 |
| 2-1 | 9228 · 9230 · 9232 | **확정** | 저주 기프트(9227/9229/9231, 3층 이상 희귀 이벤트)의 정화 결과물 |
| 2-2 | 9256 ~ 9259 | **확정** | EXTREME 모드 히든 보스 노드(10% 확률) 드랍. `assets.hidden: true` |
| 2-3 | 9799 어떤 철학 | **확정** | 99%+ 합성이 실패했을 때 지급되는 시스템 보상 |
| 2-4 | 9991 ~ 9995 잔영 | **확정** (1~3등급) | 정규 기프트. 시작 버프 "Perfected Possibility" 로 지급. 4·5등급은 **위키로 불가** |
| 3 | `extreme` 팩 풀 | **확정** (구조) | 범용 전체가 맞다. 위키도 EXTREME 팩 전부를 단일 공용 카테고리로 렌더. 단 종수는 위키 147/161 vs 우리 188 로 어긋남 — **위키로 불가** |
| 4 | 기프트 9429 | **확정** | 속도 효과는 두 번 서술된다(Haste + Max Speed +1). canonical PK 가 삼켰다 |
| 5 | (부수) §9 의 결손 10쌍 | **확정** | 9쌍(1122)은 삭제된 콜라보 콘텐츠. 진짜 결손은 1쌍(1124 × 9241) |

## 7. 데이터 조치 목록 (우선순위)

| 순위 | 조치 | 근거 항 |
|---|---|---|
| 1 | `canonical.gift` 에 `vestige`·`hidden` 적재 (assets 에 이미 있는데 버려짐) | §2-2 · §2-4 |
| 2 | `canonical.gift` 에 `cursed_pair_id`/`blessed_pair_id` 적재 (assets 3쌍) | §2-1 |
| 3 | `gift_effect`·`gift_trigger` 의 PK 에 `index` 복원 | §4 |
| 4 | `gift_exclusive_pack` 에 `kind enum('drop','fusion')` 추가 — 현재 값에서 무모순 도출 가능 | §1 |
| 5 | `gift_pack` 에 (1124, 9241) 1행 추가 | §5 |
| 6 | `canonical.pack` 에 `retired`/`available_until` 추가, 1122 표시 | §5 |
| 7 | 엔진에서 `extreme` 21팩 제외 (게임이 EXTREME 에서 팩 관찰 자체를 봉인함) | §3 |
| 8 | `canonical.pack` 에 `md_generation` 추가 — 풀 과대 적재 의심 해소용 | §3 |

## 8. 게임에서 확인해야 남는 것 (위키로 불가)

| 확인할 것 | 어디서 | 무엇이 갈리는가 |
|---|---|---|
| 9994 찬란한 잔영 · 9995 달의 잔영 의 획득처 | 상점 판매 목록 · 층 클리어 보상 · 시작 버프 최고 강화 단계 설명문 | 지급처가 있으면 시작 버프/보상 계통 추가. 없으면 미구현 자산 |
| 잔영이 합성 재료로 실제 놓이는가 | 잔영 소지 상태로 합성 UI 열기 | 임의 레시피에 놓이면 와일드카드(레시피 결손 아님). 특정 레시피에서만 놓이면 `fusion_slot` 결손 |
| EXTREME 풀이 188종인가 147/161종인가 | EXTREME 층 기프트 선택지 20~30회 표본 | 구세대 전용 기프트가 뜨면 우리가 맞고, 안 뜨면 `gift_pack` 이 MD 세대를 뭉쳐 과대 적재 |
| `public.gift_token` 중복이 9429 하나뿐인가 | (DB 질의로 가능 — 이번 조사 범위 밖) | 스키마 결함의 실제 피해 범위 |
