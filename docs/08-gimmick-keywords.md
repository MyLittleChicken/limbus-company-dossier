# 기믹 키워드 — 인격 · E.G.O · 기프트의 관계 (Gimmick Keywords)

> 상태: 초안 v0.1 / 작성 2026-07-29 · 스냅샷 2026-07-25
> 데이터 마스터북 회차 1(`limbus-data-mj/identities.json`) 인터뷰 중 발견한 내용을 분리해 정리한다.
> 엔티티 정의는 `02-data-model.md`, 정본 배정은 `adr/04-source-authority.md`, 추천 판정은
> `06-recommendation-engine.md` 를 함께 본다.

## 1. 이 문서가 다루는 것

인격이 "화상 인격"인지 "침잠 인격"인지를 정하는 **기믹 축**이 어디서 오는가.

핵심은 축이 **인격 단독으로 정해지지 않는다**는 것이다. 특정 E.G.O나 기프트를 조합하면
축이 하나 더 생긴다. 게임 안에서 이것은 예외가 아니라 편성의 전제다.

```
검계 우두머리 뫼르소          기본  호흡
  + E.G.O 착영휘도[着影揮刀]        호흡 + 출혈

로보토미 E.G.O:: 엄숙한 애도 이상   기본  침잠 (+ 탄환 소모)
  + E.G.O 엄숙한 애도               침잠 + 진동

새벽 사무소 해결사 싱클레어    기본  화상
  + 기프트 날개 모양 양초           화상 + 진동
```

현재 파이프라인은 이 조건을 **하나도 담지 않는다.** 결과 축은 우연히 맞히지만
"왜 그 축인지"를 말하지 못한다.

## 2. 지금 축을 어떻게 정하고 있나

`lib/engine/vocab.ts` 의 `STATUS_MATCH` 정규식 10줄이 상태 id에서 축을 뽑는다.

```ts
['ammo',       /^(Accel)?Bullet(Godok|Lament|Propellant(Special)?)?$/i],
['protection', /^(Burst)?Protection$/i],
['burn',       /combustion|(^|[^a-z])burn/i],
['bleed',      /laceration|bleed/i],
['tremor',     /vibration|tremor/i],
['rupture',    /burst|rupture/i],
['sinking',    /sinking/i],
['poise',      /breath|poise/i],
['charge',     /charge/i],
['bloodfeast', /bloodfeast/i],
```

입력은 `identity_status`(인격이 다루는 상태)다. 출력이 그 인격의 축이 된다.

**커버리지**: 상태 **1,472종 중 69종(4.7%)** 만 이 정규식에 걸린다. 이름에 축 단어가
들어간 것만 잡기 때문이다.

**축 개수 분포**(인격 184건): 0개 5 · 1개 85 · 2개 64 · 3개 20 · 4개 8 · 5개 2.

## 3. 원본이 이미 축을 알고 있다

`data/entities/mechanics/limbus-assets/statuses.json` 의 상태마다 `categoryKeywordList` 가 있다.

```json
"RedApricotBlossom": {                     // 홍행화
  "buffType": "Negative",
  "categoryKeywordList": ["LACERATION"],
  "desc": "- Unique Bleed\n- Max ..."
},
"NailPersonality": { "categoryKeywordList": ["LACERATION"] },
"Breath":          { "categoryKeywordList": ["SIN", "BREATH"] },
"BulletGodok":     { "categoryKeywordList": ["RESOURCE","BULLET","CAN_GET_ONLY_BY_SYSTEM"] }
```

**이름이 축을 드러내지 않는 고유 변종**을 정확히 잡아준다. 정규식이 놓치는 자리다.

1,472종 중 **116종(7.9%)** 이 이 필드를 갖고, 값은 24종이다. 축 계열과 플래그 계열이 섞여 있다.

| 계열 | 값 |
| --- | --- |
| 축 | `LACERATION` · `VIBRATION`(+`_CONVERTED`/`_MERGED`) · `SINKING` · `COMBUSTION` · `BREATH` · `BURST`(+`REACTIVE`) · `CHARGE` · `BULLET` · `FREISHUTZ_OUTIS_EGO_BULLET` · `FAUVISM_CLAW_WOUND` |
| 플래그 | `SIN` · `RESOURCE` · `CAN_GET_ONLY_BY_SYSTEM` · `DUEL_DECLARATION` · `CONCENTRATED_ATTACK` · `SUPPORTIVE_PROTECT` · `SHIELD_MANAGER` · `TURN_IS_ALSO_LOADED_BULLET` · `IGNORE_CHECED_CORRECTION_EXCLUSION` · `DIANXUE` · `AACFPBBCA` |

### 병합 효과

정규식과 `categoryKeywordList` 를 합치면 어긋나던 사례가 메워진다.

| 인격 | mj `keywords` | 정규식만 | 병합 후 | 근거 상태 |
| --- | --- | --- | --- | --- |
| `10208` 검계 살수 (파우스트) | `bleed` `poise` | `poise` | `poise` `bleed` | `RedApricotBlossom` |
| `10304` N사 중간 망치 (돈키호테) | `bleed` `tremor` | `tremor` | `bleed` `tremor` | `NailPersonality` |
| `10504` N사 큰 망치 (뫼르소) | `bleed` | `protection` | `bleed` `protection` | `NailPersonality` |

**mj `keywords` 에 있는데 상태 매핑으로는 안 잡히던 인격이 3건에서 0건이 된다.** 셋 다 출혈이며,
근거 상태가 홍행화·못 계열이라 이름만으로는 출혈인 줄 알 수 없는 것들이다.

## 4. 원본은 축을 3층으로 나눠 놓았다

**세 출처가 다른 말을 하는 것이 아니라, 서로 다른 층을 담는다.** 이것을 혼동하면
"어느 쪽이 맞나"라는 잘못된 질문에 빠진다.

| 층 | 필드 | 담는 것 |
| --- | --- | --- |
| **① 기본** | mj `keywords` · assets `skillKeywordList` | S1–S3 스킬이 **직접 부여**하는 기믹. 값 7종 고정. **기프트 조건 카운트의 판정 기준**(4.1) |
| **② 조건부** | mj `egoKeywords` · assets `identity_keyword_modifiers.json` | E.G.O·기프트 **조합으로 붙는** 기믹. `altKeywords` 는 조건이 아니라 주석이다(5.5) |
| **③ 접점** | assets `statuses` | 이 인격이 **다루는 상태 전부**. 기믹 + 버프/디버프 + 고유 상태. 조건부 경유분도 섞여 있다 |

인격 `10110` 으로 세 층을 한 번에 보면 이렇다.

```
① mj.keywords              ["sinking"]                    침잠
① assets.skillKeywordList  ["Sinking"]                    〃  (표기만 대문자)
② mj.egoKeywords           {"20109": ["tremor"]}          진동 ← E.G.O 20109
③ assets.statuses          ["Agility","Bullet","BulletLament","ReloadLament",
                            "Sinking","SinkingWhite","Vibration"]
                                                          침잠 · 진동 · 탄환 · 기타
```

**①과 ②는 나뉘어 있고 ③만 뭉쳐 있다.** `Vibration` 은 ③에만 있으며, 그것이 조건부라는
사실은 ②에서만 알 수 있다.

### 우리 파이프라인은 ③만 적재한다

```
척추   ① keywords · ② egoKeywords · altKeywords · assets modifiers
변환   src/entities/identities.ts 가 ①②를 전부 버린다
적재   identity_status ← assets.statuses (③) 하나뿐
```

그 결과 엔진이 축을 계산하면 기본과 조건부가 한 덩어리로 나온다. **이 문서의 목표는
①②③을 각각 적재해 되찾는 것이다.**

### ①과 ③의 차이 (184건 전수)

같은 층이 아니므로 "어긋난다"가 아니라 "③이 더 넓다"가 정확한 서술이다.

```
①과 ③이 같음                   142건
③이 더 넓음                     40건
①에만 있는 축이 남던 인격         3건   → categoryKeywordList 병합으로 0건
```

세 번째 줄은 두 번째와 겹친다 — `10504` 는 `protection` 을 얻으면서 동시에 `bleed` 를 놓쳐
양방향으로 어긋났다.

③이 넓어지는 40건의 내역은 자원 축 30건(`protection` 17 · `ammo` 13)과 7종 기믹 16건이다.

7종 기믹이 늘어나는 16건:

| 인격 | mj `keywords` | 추가되는 축 | 근거 상태 |
| --- | --- | --- | --- |
| `10109` 약지 점묘파 스튜던트 (이상) | `bleed` | `rupture` `burn` `sinking` `tremor` | Burst · Combustion · Sinking · Vibration |
| `11109` 약지 점묘파 스튜던트 (오티스) | `bleed` | `rupture` `burn` `sinking` `tremor` | 〃 |
| `10110` 엄숙한 애도 (이상) | `sinking` | `tremor` | Vibration |
| `10114` 흑수 - 오 필두 (이상) | `tremor` `rupture` | `poise` | Breath |
| `10115` 거미집 검지 아비 (이상) | `sinking` `poise` | `burn` | BurningWoundYisang · Combustion |
| `10206` 남부 세븐 협회 4과 (파우스트) | `rupture` | `poise` | Breath |
| `10212` 흑수 - 묘 필두 (파우스트) | `rupture` | `poise` | Breath |
| `11107` 로보토미 E.G.O:: 마탄 (오티스) | `burn` | `poise` | Breath |
| `10412` N사 E.G.O:: 경멸, 경외 (료슈) | `bleed` `tremor` | `poise` | Breath |
| `10415` 거미집의 검 (료슈) | `burn` `bleed` `poise` | `sinking` | Sinking |
| `10508` 검계 우두머리 (뫼르소) | `poise` | `bleed` | Laceration |
| `10610` 송곳니 사냥 사무소 해결사 (홍루) | `rupture` | `bleed` | Laceration |
| `10614` 거미집 약지 아비 (홍루) | `bleed` `charge` | `burn` | Combustion |
| `10705` 로보토미 E.G.O:: 여우비 (히스클리프) | `rupture` `sinking` | `tremor` | VibrationExplosion |
| `10715` 중지 작은 형님 (히스클리프) | `burn` `bleed` | `tremor` | Vibration · VibrationExplosion |
| `10916` 거미집 엄지 아비 (로쟈) | `burn` `tremor` | `poise` | Breath |

**이 16건이 전부 조건부인 것은 아니다.** ③은 조건부 경유분과 부수 접점을 함께 담는다.
`Breath` 하나만으로 `poise` 가 붙는 사례(6건)는 호흡을 소량 다루는 것에 가깝다.
조건부로 확인된 것은 5절의 3건뿐이며, 그 판정은 ③이 아니라 ②에서만 나온다.

### 4.1 ①이 기프트 조건 카운트의 판정 기준이다

**회차 6에서 ①의 두 출처가 갈리는 1건을 찾았고, 그것이 게임의 판정 기준을 드러냈다.**

```
10104 개화 E.G.O:: 동백 (이상)

  mj  keywords            ["tremor", "sinking"]
      keywordSkills       { tremor: [1,2,3], sinking: [1,2,3] }
  assets skillKeywordList ["Sinking"]                         ← 침잠만
         statuses         ["Sinking", "SinkingSurge", "Vibration"]

  keyword_modifiers 없음 · egoKeywords/altKeywords 없음 → 조건부가 아니다
```

게임에서 이 인격은 **침잠 인격이며, 진동 조건 카운트에서 명시적으로 제외**된다.

> 진동 위력·횟수를 부여하는 공격 스킬을 보유한 인격 5인 이상 출격 — **이 인격은 포함되지
> 않는다.** 다만 다른 인격들로 조건이 충족되면 그 기프트 효과는 받는다.

따라서 두 필드는 어긋난 것이 아니라 **다른 것을 재고 있다.**

| 필드 | 재는 것 | 10104 |
| --- | --- | --- |
| mj `keywords` | 스킬이 **실제로 부여**하는 기믹 | 진동 · 침잠 |
| assets `skillKeywordList` | **기프트 조건 카운트**에 들어가는 기믹 | 침잠 |

**기프트 판정의 정본은 `assets skillKeywordList` 다.**

### 4.2 그래서 우리 엔진이 과대 계상한다

```
우리 엔진 (③ statuses 기반)
  10104 statuses → 엔진 축 ["sinking", "tremor"]     ← 진동으로 센다
게임 판정 (① skillKeywordList 기반)
                → ["Sinking"]                       ← 진동으로 세지 않는다
```

기프트 조건에 **기믹 카운트가 41종** 있다.

```
22  Bleed Skill Used        18  Burn Skill Used        18  Rupture Skill Used
16  Sinking Skill Used      15  Tremor Skill Used      15  Charge Skill Used
10  Allies have Tremor Skill     9  Allies have Rupture Skill
 6  Allies have Burn Skill       6  Allies have Sinking Skill  …
```

`lib/engine/dsl.ts:88` 의 `SKILL_SUPPLIES` 가 `ctx.statusSupply` 를 세고, 그 값은
`identity_status`(= ③ `statuses`)에서 온다.

**따라서 `Tremor Skill Used` · `Allies have Tremor Skill` 계열 기프트 25건에서 `10104` 를
진동 공급자로 잘못 센다.**

`①`을 적재해야 하는 이유가 둘이 됐다.

1. ③에 조건부가 섞여 되찾을 수 없다(5.1)
2. **기프트 조건 카운트가 ①을 기준으로 판정한다** — ③으로 세면 틀린다

## 5. 조합 축 — 인격 + E.G.O · 인격 + 기프트

### 5.1 E.G.O도 `statuses` 를 갖는다

`limbus-assets/egos.json` 의 각 E.G.O가 `statuses` 배열을 갖는다.

```
20509 착영휘도[着影揮刀]  ["AlcoholKimPersonal","Breath","GhostKimPersonal","GrudgePersonal",
                          "Laceration","RootSoupKimPersonal","SlashDamageUp",
                          "SlashTakeDamageUp","SuperCoin"]
20109 엄숙한 애도         ["AzureResistDown","AzureTakeDamageUp","BulletLament","Discard",
                          "ReloadLament","Sinking","SinkingWhite","SuperCoin","Vibration",
                          "VibrationExplosion","WideAreaRampage"]
```

`Laceration` → `bleed`, `Vibration` → `tremor`. 조합으로 생기는 축이 E.G.O 쪽에도 나타난다.

이 데이터는 이미 우리 DB에 있다.

```
스키마   model EgoStatus { egoId, statusId }     prisma/schema.prisma:432
적재     src/entities/egos.ts:136
엔진     lib/engine/load.ts:20 — 인격 statuses 만 읽는다. ego_status 미사용
```

**다만 이것으로 조건부 조합을 재현할 수는 없다.** 초안에서 "조인 한 번이면 나온다"고 적었으나
실측이 반증했다.

```
10110 엄숙한 애도 이상
  인격 접점 축   {ammo, sinking, tremor}    ← 진동이 이미 들어 있다
  20109 축       {ammo, sinking, tremor}
  차집합          {}                         ← 조건부가 사라진다

10508 검계 우두머리 뫼르소
  인격 접점 축   {poise, bleed}             ← 출혈이 이미 들어 있다
  20509 축       {poise, bleed}
  차집합          {}
```

조건부 상태가 **인격의 `statuses` 에 이미 섞여 있어** 차집합이 빈다. 반대로 무관한 조합은
대량으로 잡힌다.

```
인격 × 같은 수감자 E.G.O      1,687쌍
축이 느는 조합                1,293쌍 (76.6%)

10508 에 축을 더하는 E.G.O    20503 집행 +보호·진동 · 20504 카포테 +화상·진동 ·
                              20505 후회 +진동 · 20506 전기울음 +파열·충전 …
```

착영휘도는 안 나오고 엉뚱한 7개가 나온다. **신호 대 잡음이 뒤집힌다.**

이유는 단순하다. **E.G.O의 `statuses` 는 그 E.G.O 스킬이 내는 효과**다. 인격의 키워드와는
다른 것을 가리킨다.

```
20504 카포테 (뫼르소, HE, 분노)   statuses [Combustion, Vibration, ...]
  → 카포테를 사용하면 그 스킬이 화상·진동을 준다.
    검계 우두머리의 키워드와는 무관하다.

20509 착영휘도 (뫼르소, HE, 오만)
  → 장착만으로 검계 우두머리가 "호흡 인격" 에서 "호흡·출혈 인격" 이 된다.
```

**둘의 차이는 E.G.O 데이터에 없다.** 어느 E.G.O가 인격의 키워드 자체를 바꾸는지는
`identity_keyword_modifiers.json` 과 mj `egoKeywords` 에만 적혀 있다(5.2).

따라서 인격의 축을 계산할 때 `ego_status` 를 끌어오지 않는다. E.G.O의 상태는 E.G.O의 것이다.

### 5.2 조건의 큐레이션은 두 파일에만 있다

"이 축은 조건부다"라는 표시는 두 곳에 흩어져 있고 **집합이 다르다**.

| 인격 | 축 | 조건 | mj `egoKeywords`/`altKeywords` | assets `identity_keyword_modifiers.json` |
| --- | --- | --- | --- | --- |
| `10110` 로보토미 E.G.O:: 엄숙한 애도 (이상) | `tremor` | E.G.O `20109` 엄숙한 애도 | ✓ | ✓ |
| `10508` 검계 우두머리 (뫼르소) | `bleed` | E.G.O `20509` 착영휘도[着影揮刀] | — | ✓ |
| `11009` 새벽 사무소 해결사 (싱클레어) | `tremor` | 기프트 `9282` 날개 모양 양초 | — | ✓ (`allowInSolver:false`) |

```
mj 가 아는 것       10110
assets 가 아는 것   10110 · 10508 · 11009
합집합              3건
```

**mj 단독으로는 불완전하다** — 착영휘도(`10508`)와 날개 모양 양초(`11009`)를 모른다.
현재 스냅샷에서는 `assets/identity_keyword_modifiers.json` 이 상위집합이다.

조건 유형은 **`ego` 와 `gift` 둘**이다.

### 5.3 원본 구조

```jsonc
// limbus-assets/identity_keyword_modifiers.json — 전체 3건
{
  "10508": [{ "keyword": "Bleed",  "conds": [{ "type": "ego",  "id": "20509" }] }],
  "10110": [{ "keyword": "Tremor", "conds": [{ "type": "ego",  "id": "20109" }] }],
  "11009": [{ "keyword": "Tremor", "conds": [{ "type": "gift", "id": "9282"  }],
             "allowInSolver": false }]
}

// limbus-data-mj/identities.json — 해당 인격에만 있는 키
"egoKeywords": { "20109": ["tremor"] }    // 10110
"altKeywords": ["sinking"]                // 10312. 조건이 아니라 "대체 스킬에서 나온다"는 주석
```

`conds` 가 배열이라 조건을 여럿 걸 수 있는 구조이며, `type` 은 `ego` 와 `gift` 두 종이 실측된다.

### 5.4 `allowInSolver: false`

`11009` 에만 붙어 있다. 상류 도구가 **추천 계산에서 이 조건을 빼라**고 표시한 것이다.
기프트는 런마다 달라져 고정 전제로 쓸 수 없기 때문으로 읽힌다. 우리 추천 엔진에도
같은 판단이 필요하다.

### 5.5 대체 스킬은 조건이 아니다

`10312` 은 `keywords` 와 `keywordSkills` 가 어긋나는 **184건 중 유일한 인격**이다.

```
keywords      ["rupture", "sinking", "charge"]
keywordSkills {"rupture": [1,2,3], "charge": [1,2,3]}     ← sinking 없음
altKeywords   ["sinking"]

assets.skillKeywordList  ["Charge", "Rupture", "Sinking"]  ← 침잠 있음
```

침잠이 기본 S1–S3이 아니라 **대체 스킬**에서 나오기 때문이다. `limbus-assets/identities.json`
의 `skillTypes` 에서 `num`(덱 매수)이 **0인 항목이 대체 스킬**이다.

```
1031201 num=3  tier1     1031205 num=0  tier1      ← 대체
1031202 num=2  tier2     1031206 num=0  tier2      ← 대체
1031203 num=1  tier3     1031207 num=0  tier3      ← 대체

1031203  아르카나 비트!!            Inflict 2 [Burst]     ← 파열
1031207  리버스드 아르카나 슬레이브    Inflict 2 [Sinking]   ← 침잠
```

**그러나 이것은 조건부가 아니다.** 게임에서 이 인격은 사랑 상태든 증오 상태든
**충전·파열·침잠 셋 모두** 적용된다(2025-07-17 실험 확인). 두 출처가 `sinking` 을
기본 키워드에 넣은 것이 옳다.

일반화하면 이렇다.

> **`num=0` 대체 스킬은 인격의 기믹 키워드를 바꾸지 않는다.**
> 1·2·3 스킬이 출혈인 인격이 조건부로 진동 스킬을 쓰더라도 그 인격은 출혈 인격이다.

`altKeywords` 는 조건을 표시하는 필드가 아니라 **"이 기믹은 대체 스킬에서 나온다"는 주석**이다.
값 자체는 이미 `keywords` 에 포함돼 있다.

따라서 **조건 유형은 `ego` 와 `gift` 둘뿐이다.**

### 5.6 죄악 축은 다르게 다룬다 — 대체 스킬 37건

`skillTypes` 의 `num=0` 을 전수 집계하면 대체 스킬 보유 인격이 나온다.

```
대체 스킬 보유 인격        37 / 184
  개수 분포   1개:21 · 2개:6 · 3개:8 · 4개:1 · 5개:1
```

기믹 축과 달리 **죄악 축은 대체 스킬을 분리해 기록한다.**

```
altSins = (대체 스킬의 죄악) − (기본 스킬의 죄악)      184/184 성립, 불일치 0건
```

`atkSins`(기본 3스킬의 죄악)에 대체 스킬의 죄악을 섞지 않고 `altSins` 로 뺀다. 대체 스킬이
있어도 죄악이 기본과 겹치면 빈다(32건).

**같은 원본이 두 축을 반대로 다룬다.**

| 축 | 대체 스킬의 값 | 근거 |
| --- | --- | --- |
| 기믹 | `keywords` 에 **포함** | 게임이 그렇게 표기한다(5.5) |
| 죄악 | `altSins` 로 **분리** | `atkSins` 합계가 항상 3이라 기본 3스킬만 센다 |

모순이 아니다. 죄악은 스킬마다 하나씩 붙는 값이라 합이 고정되고, 기믹은 인격 단위 성격이라
합이 고정되지 않는다.

## 6. 자원 축 — 탄환 · 보호 · 혈석

7종 기믹과 별개의 축이 셋 더 있다(`backlog/04-status-mechanics.md` 3·4절).

| 축 | 보유 인격 | 비고 |
| --- | --- | --- |
| `protection`(보호) | 17건 | `BurstProtection` 은 이름에 `Burst` 를 품어 `rupture` 로 오분류될 수 있어 정규식에서 먼저 판정한다 |
| `ammo`(탄환) | 13건 | `10110` 엄숙한 애도 이상이 여기 든다 — 탄환을 소모하는 인격이다 |
| `bloodfeast`(혈석) | **0건** | 축은 정의돼 있으나 인격 `statuses` 로는 하나도 잡히지 않는다 |

mj `keywords` 는 7종만 담아 이 셋을 **구조적으로 모른다**. `statuses` 를 쓰는 이유 중 하나다.

## 7. 제안하는 구조

축을 1급 개념으로 올리고, 상태 → 축 매핑을 코드가 아니라 데이터로 둔다.

```prisma
/// 기믹 축. 죄악·공격 타입과 같은 층위의 분류축이다.
enum Gimmick {
  burn  bleed  tremor  rupture  sinking  poise  charge
  ammo  protection  bloodfeast
}

/// ① 기본 축. 원본 keywords 를 그대로 담는다. 7종 기믹만 표현된다.
/// **기프트 조건 카운트는 이 축으로 판정한다**(4.1·4.2). ③으로 세면 10104 를 과대 계상한다.
/// 두 출처가 갈리는 1건에서는 assets skillKeywordList 가 정본이다.
model IdentityKeyword {
  identityId Int
  gimmick    Gimmick
  /// 그 기믹을 보유한 스킬 슬롯. 원본 keywordSkills. 예: [1,2,3]
  skillSlots Int[]
  identity   Identity @relation(fields: [identityId], references: [id], onDelete: Cascade)

  @@id([identityId, gimmick])
  @@map("identity_keyword")
}

/// ③ 접점 축의 재료. 상태가 어느 축에 속하는가.
/// 원본 categoryKeywordList 와 이름 규칙에서 만들고, 근거를 남긴다.
model StatusGimmick {
  statusId String
  gimmick  Gimmick
  /// category | name | manual
  basis    String
  status   Status @relation(fields: [statusId], references: [id], onDelete: Cascade)

  @@id([statusId, gimmick])
  @@map("status_gimmick")
}

/// ② 조건부 축. 인격의 축이 특정 조합에서만 생기는 경우.
model IdentityComboGimmick {
  identityId    Int
  gimmick       Gimmick
  /// ego | gift
  sourceType    String
  sourceId      Int
  /// 상류 도구가 추천 계산에서 제외하라고 표시한 것
  allowInSolver Boolean @default(true)
  identity      Identity @relation(fields: [identityId], references: [id], onDelete: Cascade)

  @@id([identityId, gimmick, sourceType])
  @@map("identity_combo_gimmick")
}
```

### 축을 얻는 방법 — 저장하지 않고 조인한다

```
① 기본 축     = identity_keyword                     (원본 keywords 를 적재)
② 조건부 축   = identity_combo_gimmick               (큐레이션 합집합 + 대체 스킬)
③ 접점 축     = identity_status ⋈ status_gimmick     (지금 유일하게 있는 것)

인격의 키워드 = ① ∪ ② ∪ (③ 중 자원 축)
```

**③에서 ①②를 빼려 하지 않는다.** 조건부가 ③에 이미 섞여 있어 되찾을 수 없다(5.1).
①과 ②를 원본에서 각각 적재하는 것이 유일한 길이다.

**`ego_status` 는 인격 축 계산에 넣지 않는다.** 그것은 E.G.O 스킬의 효과이며 인격의
키워드가 아니다(5.1).

검증 — 원본 ①②를 그대로 읽었을 때:

```
10508 검계 우두머리
  ① keywords ["poise"]                 ② bleed ← ego 20509 착영휘도
  키워드 = 호흡, 착영휘도 장착 시 호흡·출혈      ③ {poise, bleed}

10110 엄숙한 애도 이상
  ① keywords ["sinking"]               ② tremor ← ego 20109 엄숙한 애도
  키워드 = 침잠, 엄숙한 애도 장착 시 침잠·진동  ③ {ammo, sinking, tremor}

11009 새벽 사무소 해결사
  ① keywords ["burn"]                  ② tremor ← gift 9282 날개 모양 양초
  키워드 = 화상, 양초 획득 시 화상·진동         ③ {burn}

10312 사랑과 증오의 이름으로
  ① keywords ["rupture","sinking","charge"]   ② 없음
  키워드 = 파열·충전·침잠 (조건 없음)           ③ {rupture, charge, sinking}
```

**①이 표현하지 못하는 것이 하나 있다** — 자원 축이다. mj `keywords` 는 7종 기믹만 담아
`ammo`(탄환) · `protection`(보호) · `bloodfeast`(혈석)를 구조적으로 모른다.
`10110` 이 탄환을 소모하는 인격이라는 사실은 ③에만 있다.

```
인격의 키워드 = ① ∪ ② ∪ (③ 중 자원 축)
```

자원 축은 ③에서만 오므로 조건부 여부를 가릴 수 없다. 현재 실측에서 자원 축이 조건부인
사례는 없다(5절 3건은 전부 7종 기믹).

### 바뀌는 것

| | 지금 | 바뀐 뒤 |
| --- | --- | --- |
| 적재하는 층 | ③ 접점만 | ① 기본 · ② 조건부 · ③ 접점 |
| 상태 → 축 | 코드 정규식 10줄, 커버 4.7% | 데이터 테이블, `categoryKeywordList` 병합 |
| 인격 축 | 조건부가 기본에 섞여 되찾을 수 없음 | 원본에서 각각 읽어 분리 |
| `ego_status` | 적재돼 있으나 미사용 | 그대로 미사용 — E.G.O 스킬의 효과이지 인격의 키워드가 아니다 |
| 조건 근거 | 없음 | "착영휘도 장착 시"를 화면에 표시 가능 |
| 기프트 기믹 카운트 | ③ `statuses` 로 세어 `10104` 를 과대 계상 | ①로 세어 게임 판정과 일치 |

기존 테이블은 삭제하지 않는다. `identity_status` · `ego_status` 는 사실 데이터라 그대로 둔다.
추가되는 것은 테이블 3개(`identity_keyword` · `status_gimmick` · `identity_combo_gimmick`)와
엔진의 조인 변경이다.

## 8. 미해결

- ~~대체 스킬이 세 번째 조건 유형인가~~ → **아니다.** 대체 스킬은 인격의 기믹 키워드를 바꾸지 않는다 (5.5)
- ❓ 5절 3건 외에 `ego`/`gift` 조건부 조합이 더 있는가. 두 출처가 서로를 못 덮는 것이
  확인됐으므로 **둘 다 놓친 사례**가 있을 수 있다
- ❓ `categoryKeywordList` 의 플래그 계열 11종이 각각 무엇을 뜻하는가 (`AACFPBBCA` 는 의미 불명)
- ❓ `bloodfeast` 축이 인격에서 0건인 이유. 축 정의가 이르거나, 상태 이름이 다르거나
- ❓ 자원 축(탄환·보호)을 7종 기믹과 같은 열거값에 둘지, 별도 축으로 나눌지
- ❓ `allowInSolver:false` 를 우리 추천 엔진이 어떻게 다룰지

## 9. 근거 재현

이 문서의 수치는 2026-07-25 스냅샷에서 다음 파일을 직접 집계해 얻었다.

```
data/entities/identities/limbus-data-mj/identities.json          인격 184건
data/entities/identities/limbus-assets/identities.json           statuses
data/entities/identities/limbus-assets/identity_keyword_modifiers.json
data/entities/egos/limbus-assets/egos.json                       E.G.O statuses
data/entities/mechanics/limbus-assets/statuses.json              상태 1,472종
data/entities/gifts/limbus-assets/gifts.json                     기프트 9282
data/entities/gifts/loc-ko/EGOgift_MirrorDungeon_7.json          기프트 한국어명
lib/engine/vocab.ts                                              현행 축 판정
```
