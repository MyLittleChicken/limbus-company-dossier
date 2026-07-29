# v1 추천 엔진의 데이터 구분 — 분석

> 상태: 분석 / 작성 2026-07-28
> 대상: `../limbus-mirror-tracker-v1/engine` (설계 정본은 그쪽 `docs/03-data/master-book.md`)
> 목적: v1이 데이터를 **어떤 축으로 갈랐는가**를 밝히고, 우리 3단계 엔진과 대조한다.
> 이 문서는 우리 구현을 바꾸지 않는다. 개선 판단의 근거로만 쓴다.

## 1. 한 줄 결론

**메카닉(상태)을 축으로 갈랐다.** 정확히는 **상태 노드와 그 사이의 파생 엣지**를 저작물로 두고,
인격·기프트·팩·합성을 모두 그 상태 축에 붙여 읽는다.

키워드는 표시용으로만 남기고 계산에서 배제한다. 그래서 "화상 덱"이라는 말이 엔진 안에 없고,
`statusSupply.burn = 12.3` 같은 **수치**만 있다.

## 2. 파일 다섯 개 — 저작물 하나, 산출물 넷

| 파일 | 크기 | 성격 | 추적 |
| --- | ---: | --- | --- |
| `mechanics.json` | **1.3 KB** | **우리 저작물** — 상태 정의와 파생 엣지 | ✅ 커밋 |
| `identities.json` | 159.3 KB | 정규화 산출물 (인격 183 → 스킬) | ⛔ gitignore |
| `gifts.json` | 650.6 KB | 정규화 산출물 (기프트 431 → 효과 단위 + 조건 DSL) | ⛔ gitignore |
| `packs.json` | 57.5 KB | 정규화 산출물 (팩 70 → 획득 관계) | ⛔ gitignore |
| `fusions.json` | 25.2 KB | 정규화 산출물 (레시피 67) | ⛔ gitignore |

**1.3 KB가 나머지 893 KB의 축을 정한다.** 이 비율이 설계의 요지다 — 저작해야 하는 것은 작고,
나머지는 그 축에 기계적으로 붙는 산출물이라 재생성 가능하다.

산출물은 재호스팅 방지로 커밋하지 않고 `node build/generate.js` 로 로컬 재생성한다.
우리 1단계가 `build/data/` 를 커밋하지 않는 것과 같은 정책이다.

## 3. `mechanics.json` — 축의 정의

전문이 이 정도다.

```json
{
  "statuses": [
    { "id": "sinking", "side": "enemy", "kind": "ailment",  "ko": "침잠", "sins": ["gloom"] },
    { "id": "bleed",   "side": "enemy", "kind": "ailment",  "ko": "출혈" },
    { "id": "burn",    "side": "enemy", "kind": "ailment",  "ko": "화상" },
    { "id": "tremor",  "side": "enemy", "kind": "ailment",  "ko": "진동" },
    { "id": "rupture", "side": "enemy", "kind": "ailment",  "ko": "파열" },
    { "id": "poise",   "side": "ally",  "kind": "resource", "ko": "호흡" },
    { "id": "charge",  "side": "ally",  "kind": "resource", "ko": "충전" },
    { "id": "lowSP",       "side": "enemy", "kind": "derived", "ko": "적 저정신력" },
    { "id": "crit",        "side": "ally",  "kind": "derived", "ko": "치명타" },
    { "id": "tremorBurst", "side": "enemy", "kind": "derived", "ko": "진동 폭발" }
  ],
  "statusEdges": [
    { "from": "sinking", "to": "lowSP",       "transfer": 0.6 },
    { "from": "poise",   "to": "crit",        "transfer": 0.6 },
    { "from": "tremor",  "to": "tremorBurst", "transfer": 0.5 }
  ]
}
```

### 3.1 상태에 붙는 세 가지 메타

| 필드 | 값 | 무엇을 결정하는가 |
| --- | --- | --- |
| `side` | `enemy` · `ally` | 조건의 대상 범위. 적 상태 조건은 `ALL_ENEMIES`, 아군 자원은 `ALL_ALLIES` |
| `kind` | `ailment` · `resource` · `derived` | **공급 가능성.** `ailment`와 `resource`만 직접 공급되고 `derived`는 엣지로만 생긴다 |
| `sins` | 죄악 목록 (선택) | 죄악↔상태 대응. 침잠=우울만 명시했다 |

`kind` 가 핵심이다. `data.js` 가 이 값으로 두 집합을 만든다.

```js
SUPPLY_STATUS = ailment ∪ resource   // 직접 공급 대상
ENEMY_STATUS  = side === 'enemy'
```

`derived` 를 공급 집합에서 뺀 덕에 "치명타를 부여하는 스킬"을 찾는 헛수고가 구조적으로 막힌다.

### 3.2 파생 엣지 — 이것이 v1의 특징

```
침잠 → 적 저정신력  (transfer 0.6)
호흡 → 치명타       (transfer 0.6)
진동 → 진동 폭발    (transfer 0.5)
```

`transfer` 는 **전달 계수**다. 침잠 공급이 10이면 저SP 공급이 6으로 잡힌다.

이 세 줄이 하는 일은 **"적 저정신력일 때 발동"이라는 조건을 침잠 덱에서 켜지게 만드는 것**이다.
엣지가 없으면 그 조건은 영원히 0이고, 침잠 덱에 저SP 페이오프 기프트를 추천하지 못한다.

`ADR-01` 3.3이 "상태 간 파생 관계는 원본에서 추출되는 값이 아니라 우리가 저작해야 하는 관계이며
상태 노드는 10종 남짓"이라고 예측한 것이 정확히 이 파일이다.

## 4. `identities.json` — 인격은 스킬의 집합

```json
{
  "id": "10101",
  "name_ko": "LCB 수감자",
  "rarity": 1,
  "affiliations": ["limbus_company"],
  "keywords_display": ["sinking"],
  "skills": [
    { "id": "1010101", "type": "ATTACK", "sin": "gloom", "atkType": "slash", "coins": 1,
      "inflicts": [{ "status": "sinking", "action": "POTENCY", "value": 3 }] },
    { "id": "1010102", "type": "ATTACK", "sin": "envy",  "atkType": "pierce", "coins": 2, "inflicts": [] }
  ]
}
```

**`keywords_display` 라는 이름이 설계를 말한다.** 표시용이라고 필드명에 박아 두었고 계산에 쓰지 않는다.
계산은 `skills[].inflicts[]` 를 본다 — 어느 스킬이 어떤 상태를 얼마나 부여하는가.

`inflicts` 의 `action` 이 `POTENCY` · `COUNT` 로 갈린다. 위력과 횟수는 다른 자원이다.

## 5. `gifts.json` — 효과 단위로 쪼갠다

```json
{
  "id": "9001", "name_ko": "지옥나비의 꿈",
  "displayKeywords": ["burn"],
  "tier": 2, "affinity": "wrath", "fusion": false, "enhance": "+2",
  "effects": [{
    "effectType": "INFLICT_STATUS", "status": "burn",
    "value": 3, "valueSrc": "parsed",
    "target": { "scope": "ALL_ENEMIES" },
    "condition": { "op": "GTE",
      "left": { "op": "COUNT", "scope": "DEPLOYED", "where": { "op": "HAS_SIN", "value": "wrath" } },
      "right": 1 },
    "utilityCategory": "BURN_SUPPLY",
    "_src": "Inflict Burn Potency"
  }],
  "acquisition": { "type": "PACK_POOL", "scarcity": "COMMON" }
}
```

한 기프트가 효과 여러 개를 갖고 **효과마다 조건이 따로 붙는다.** 기프트 하나에 점수 하나를
매기지 않는다는 원칙이 자료 구조에 박혀 있다.

### 5.1 효과에 붙는 다섯 축

| 필드 | 무엇 |
| --- | --- |
| `effectType` | 무엇을 하는가 (`INFLICT_STATUS` · `DAMAGE_ADD` · `HEAL_HP` …) |
| `status` | 상태를 다루면 어느 상태인가 |
| `value` + `valueSrc` | 크기와 그 **출처** — `parsed`(설명문에서 뽑음) · `default`(유형 대표치) |
| `target.scope` | 누구에게 (`ALL_ALLIES` · `ALL_ENEMIES` · `ACTOR` · `SELF` …) |
| `condition` | 언제 — DSL AST |
| `utilityCategory` | **무엇을 위한 효과인가** (아래) |
| `_src` | 원본 토큰. 추적용 |

`valueSrc` 가 눈에 띈다. **어느 값이 실측이고 어느 값이 추정인지 데이터에 남긴다.**
그쪽 기록으로 파싱 커버리지가 `DAMAGE_ADD` 71% · `INFLICT` 63% · `COIN` 65% 다.

`_src` 로 원본 토큰을 보존해, 점수가 이상할 때 어느 토큰에서 왔는지 역추적된다.

### 5.2 `utilityCategory` — 효과의 역할

```js
if (effectType === 'INFLICT_STATUS') return `${status.toUpperCase()}_SUPPLY`;  // BURN_SUPPLY
if (statusConds.length)              return 'STATUS_PAYOFF';
if (deckConds.length)                return 'BUILD';
return 'GENERAL_COMBAT';
```

네 갈래다 — **공급 / 상태 페이오프 / 편성 의존 / 범용.**
`Score` 계산에는 쓰지 않고 근거 표시와 이중차감 방지 키에 쓴다.

### 5.3 공급과 페이오프에 **다른 조건**을 붙인다

이것이 이 분석에서 가장 중요한 발견이다. `generate.js` 의 `buildEffects` 가 조건을 두 벌 만든다.

```js
supplyCond = always ? ALWAYS
           : and(deckConds) || (situational ? SITUATIONAL : ALWAYS)

payoffCond = and(statusConds) || and(deckConds) || (always ? ALWAYS : null)
             // 상황성이 함께 있으면 AND(base, SITUATIONAL 0.75) 로 완화 감쇠
```

| 효과 | 붙는 조건 | 왜 |
| --- | --- | --- |
| `INFLICT_STATUS` (공급자) | `supplyCond` — **상태 조건을 붙이지 않는다** | 화상을 *부여하는* 기프트는 적이 이미 화상일 필요가 없다 |
| 그 외 (수요자) | `payoffCond` — **상태 조건을 우선 붙인다** | 화상을 *이용하는* 기프트는 적이 화상이어야 켜진다 |

원본은 `ef`(효과)와 `tg`(발동) 배열을 따로 줄 뿐 짝을 주지 않는다. v1은 그 미결을
**효과의 성격으로 갈라** 해결했다. 공급자에게 수요 조건을 걸면 "화상 공급 기프트가 화상이 있어야
켜진다"는 순환이 생겨 첫 공급자가 영원히 0이 된다.

### 5.4 크기 추출과 상한

```js
CAP = { DAMAGE_ADD: 60, FIXED_DAMAGE: 20, INFLICT_STATUS: 15, HEAL_HP: 15, ... }
```

설명문에서 숫자를 정규식으로 뽑되 **유형별 상한으로 이상치를 억제한다.** 조건문의 숫자
("5인 이상")를 효과 크기로 잘못 읽는 사고를 상한으로 막는 것이다.

## 6. `packs.json` — 한정성은 팩↔기프트 관계에 있다

```json
{
  "id": "1002", "name_ko": "속하지 못하는", "category": "Canto",
  "availability": "standard", "rarity": "NORMAL",
  "floor": { "min": 1, "max": 1 },
  "gifts": [
    { "giftId": "9403", "acquisitionType": "PACK_POOL", "grade": "HIGH", "exclusive": true, "confidence": 0.8 }
  ]
}
```

**한정 여부가 기프트의 속성이 아니라 관계의 속성이다.** 같은 기프트가 팩 A에서는 확정,
팩 B에서는 낮은 확률로 나올 수 있으므로 `exclusive` · `grade` 를 관계 행에 둔다.

### 6.1 확률을 쓰지 않는다

```js
AVAILABILITY = { GUARANTEED: 1.0, VERY_HIGH: 0.9, HIGH: 0.75, NORMAL: 0.5, LOW: 0.25, UNKNOWN: 0.4 }
```

정확한 확률을 모르므로 **순서형 등급**을 쓰고 별도로 `confidence` 를 둔다.
임의의 퍼센트를 지어내지 않는다는 원칙이다.

### 6.2 등장성 세 등급

```js
availabilityOf = (cat) => HIDDEN_CATS.has(cat) ? 'hidden'
                        : LIMITED_CATS.has(cat) ? 'limited' : 'standard'
```

`standard` 기본 후보 · `limited` 이벤트 중에만 · `hidden` 항상 제외.
걸러진 팩은 `dropped` 로 노출한다 — 조용한 누락 금지.

## 7. `fusions.json` — 대체 재료를 그룹으로

```json
{ "id": "recipe_9088_0", "resultGiftId": "9088", "recipeType": "STANDARD",
  "materials": [
    { "group": "0", "giftId": "9003", "quantity": 1, "isAlternative": false },
    { "group": "1", "giftId": "9053", "quantity": 1, "isAlternative": false }
  ] }
```

같은 `group` 안의 재료는 서로 대체 가능하다. 평탄한 목록으로 두면 그 구조가 사라진다.

진행도는 **그룹 충족 수**로 센다. `satisfiedGroups` 가 `sat/total` 을 내고
`NOT_STARTED` · `PARTIAL` · `READY` · `TARGET_ALREADY_OWNED` 로 상태를 판정한다.

## 8. 런타임 — 데이터가 아니라 상태에서 계산한다

여기가 정적 데이터와 갈리는 지점이다.

### 8.1 상태 공급은 **수치 합**이다

```js
function deckSupply(onfield) {
  for (const ident of onfield)
    for (const s of ident.skills)
      for (const inf of s.inflicts)
        if (SUPPLY_STATUS.has(inf.status))
          supply[inf.status] += inf.value;      // ← 인원 수가 아니라 값의 합
}
```

인원을 세지 않고 **부여 수치를 더한다.** 백업 인격은 세지 않는다 — 필드에 상태를 깔지 않으므로.

### 8.2 기프트도 공급원이다

```js
function giftSupply(owned, ctx) {
  for (const g of owned) for (const eff of g.effects) {
    if (!isSupplyEffect(eff)) continue;
    add[eff.status] += eff.value * activation(eff.condition, ctx);   // 활성도로 가중
  }
}
```

보유 기프트의 공급 효과가 **활성도로 가중돼 공급에 더해진다.**

### 8.3 파생 전파와 폐포 반복

```js
let supply = propagate(deckSupply(deployed));
for (let i = 0; i < 4; i++) {
  const ctx = { deck, deployed, backup, statusSupply: supply };
  const next = propagate(mergeAdd(deckSupply(deployed), giftSupply(owned, ctx)));
  if (stable(supply, next)) break;
  supply = next;
}
```

기프트 공급 조건이 `statusSupply` 에 의존하므로 **수렴할 때까지 최대 4회 반복한다.**
`propagate` 가 매 회 파생 엣지를 적용한다.

**이 폐포가 시너지 창발의 실제 기구다.** 공급 기프트를 넣으면 → 공급이 오르고 → 파생이 오르고 →
수요 기프트의 활성도가 오르고 → 그 상승분이 `MarginalValue` 에 잡힌다.
`(Identity)-[:SYNERGIZES_WITH]->(Gift)` 같은 엣지를 저장하지 않아도 되는 이유다.

`propagate` 는 **한 홉만** 간다 — 입력 `supply` 를 읽어 `out` 에 더하므로 `A→B→C` 사슬이
한 번에 흐르지 않고, 매 반복이 원천 공급에서 다시 계산하므로 반복으로도 이어지지 않는다.
현재 엣지 셋이 깊이 1이라 문제가 드러나지 않을 뿐이다.

### 8.4 인에이블러 가치

```js
DEMANDER_COUNT[st] = 게임 전체에서 st 를 필요로 하는 기프트 수   // 모듈 로드 시 1회
enablerValue = Σ  potential × ENABLER_W × (1 − rate(현재 공급))
               potential = DEMANDER_COUNT[st] − 이미 보유한 수요자 수
```

순수 공급자에게 **"판 깔기" 점수**를 준다. 덱이 그 축을 굴릴 때만, 공급 여유가 있을 때만,
아직 없는 수요자 수에 비례해서.

## 9. 가중치는 전부 한 파일

`tuning.js` 에 `EFFECT_W`(20종) · `TARGET_FACTOR`(9종) · `DEPLOY`(12/7/5) · `SUPPLY_K`(3.0) ·
`SOFT` · `PACK_W`(5항) · `FLOOR_PHASE`(early/mid/late) · `AVAILABILITY`(6등급) ·
`SCARCITY`(3등급) · `FUTURE_DISCOUNT` · `ENABLER_W` 가 있다.

주석이 명시한다 — *"정식 제품에서는 PG `tuning`/`effect_weight` 테이블로 이관. 유저가 여기만
손대면 추천이 통째로 재반영된다."*

`TARGET_FACTOR` 가 우리보다 세분돼 있다 — `FACTION_ALLIES` 0.7 · `SLOWEST_ALLY` 0.35 ·
`FIRST_DEPLOYED` 0.3 처럼 대상 범위를 아홉으로 나눈다.

## 10. 우리 3단계와의 대조

같은 뼈대인데 넷이 다르다.

| 항목 | v1 | 우리 (`lib/engine`) |
| --- | --- | --- |
| 상태 축 정의 | **`mechanics.json` 저작물** — 10종 + 파생 엣지 3 | 코드의 `StatusKey` 8종. **파생 엣지 없음** |
| 상태 공급 | **부여 수치의 합** | **보유 인원 수** |
| 기프트의 공급 기여 | **활성도 가중해 공급에 더함** | **없음.** 공급은 인격에서만 나온다 |
| 조건 부착 | **공급 / 페이오프에 다른 조건** | 모든 트리거를 AND 로 묶어 모든 효과에 |
| 폐포 반복 | 최대 4회 수렴 | 없음 (한 번 계산) |
| 효과 크기 | 설명문 파싱 + 상한, `valueSrc` 로 출처 표시 | 유형 대표치만 |
| 원본 토큰 보존 | `_src` 필드 | `EffectUnit.token` (있음) |
| 획득 등급 | 순서형 6등급 + `confidence` | 없음 |
| 합성 | 그룹 충족 수 · 이중계산 가드 | **값 0** (미구현) |
| 인에이블러 | 게임 전체 수요자 수 기반 | 없음 |
| 등장성 | 3등급 + `dropped` | **같음** ✅ |
| 시너지 저장 | 안 함 (창발) | **같음** ✅ |
| 키워드 계산 배제 | `keywords_display` · `displayKeywords` | 같음 ✅ (필터·표시만) |

### 10.1 가장 큰 차이 — 우리 시너지는 **항상 0이다**

얕은 것이 아니라 구조적으로 0이다. 실측으로 확인했다.

```
marginalValue 호출 4,760건 (기프트 1개 보유 × 후보 119)  → synergy 비어 있지 않은 건: 0
기프트 120개 보유 상태에서 후보 140건                    → synergy 비어 있지 않은 건: 0
```

원인은 한 줄이다. `contextOf(state)` 가 `state.owned` 에서 뽑는 것은 `ownedIds` 뿐이고,
**`ownedIds` 를 읽는 조건이 `dsl.ts` 에 하나도 없다** (중복 판정을 위해 `pack.ts` 만 읽는다).
`statusSupply` 는 `deployed` 인격만 센다.

따라서 `Score(state ∪ g) − Score(state)` 는 항상 **정확히 `g` 자신의 기여**이고,
`marginalValue().synergy` 배열은 채워질 경로가 없다.

**`06-recommendation-engine.md` 6절의 서술이 구현과 어긋난다.**

> 공급 기프트를 넣으면 상태 공급이 올라 기존 수요 기프트의 활성도가 함께 오르고,
> 그 상승분이 한계 효용에 그대로 잡힌다.

이 문장은 v1의 기구(8.1~8.3)를 서술한 것이며 우리 구현에는 그 경로가 없다.
"시너지를 엣지로 저장하지 않는다"는 앞 문장은 사실이지만, 저장하지 않은 것이 창발하지도 않는다.

바로잡는 데 필요한 것은 8.2의 `giftSupply` 와 8.3의 폐포다. 둘을 넣으면 이 서술이 참이 된다.

### 10.2 두 번째 차이 — 조건 부착의 순환 위험

우리는 모든 트리거를 AND 로 묶으므로, `Inflict Burn Potency` + `Enemies have Burn` 을 가진
기프트가 **자기 자신이 공급하는 상태를 조건으로 요구**한다. 공급이 0인 덱에서는 그 기프트가
영원히 켜지지 않는다. v1의 5.3이 이 순환을 갈라서 막았다.

`06-recommendation-engine.md` 10절이 이 근사를 "실제보다 보수적"이라고 적었는데,
**방향은 맞지만 이유가 다르다.** 보수적인 것을 넘어 특정 조합에서 구조적으로 0이 된다.

## 11. v1이 남긴 미모델링

그쪽 `master-book-gap.md` 가 적어 둔 것이다. 우리도 같은 자리에 있다.

- 전투 상성(보스 내성) — 데이터 없음으로 보류. `PackScore` 에서 항 제외
- 효과 값 저파싱 필드 — `CLASH`/`OFFENSE`/`HEAL` 은 "by N"·"%" 표현이라 대표치 폴백
- 인격 스킬 상태 부여 — 원본에 개별 수치가 없어 근사 합성
- 소속 슬러그 노이즈 — `facSlug` 가 비소속 태그(`student`·`e_g_o_gear`)도 슬러그화

마지막 항목이 우리 [`backlog/01`](../backlog/01-identity-tags.md) 과 같은 건이다.
v1은 슬러그 정규화로 우회했고 우리는 별칭표로 이었다. 둘 다 근본을 고치지 않았다.

## 12. 우리가 가져올 순서 (판단 근거용)

비용과 효과로 보면 이 순서다. **결정은 아니고 재료다.**

| 순위 | 가져올 것 | 왜 | 비용 |
| --- | --- | --- | --- |
| 1 | **기프트를 공급원에 포함 + 폐포** (8.2·8.3) | 시너지가 지금 **항상 0**이고 문서 서술이 어긋나 있다 | `state.ts` + `score.ts` |
| 2 | **공급/페이오프 조건 분리** (5.3) | 1번을 넣으면 이것이 없을 때 순환이 드러난다 | `load.ts` 한 곳 |
| 3 | **공급을 수치 합으로** (8.1) | 인원 수는 "3명이 3씩"과 "3명이 1씩"을 구분하지 못한다 | 스킬 부여 수치가 필요 — `02-data-model.md` 8절 미결 |
| 4 | **파생 엣지** (`mechanics.json` 3.2) | 저SP·치명타·진동폭발 조건이 켜진다 | 저작물 하나 + `propagate` |
| 5 | 획득 등급·합성·인에이블러 | 팩 점수의 나머지 항 | 각각 독립 |

3번은 데이터가 먼저다. 나머지는 지금 데이터로 된다.

## 13. 이 문서가 보증하는 범위

**보증하는 것** — 2026-07-28 시점 `../limbus-mirror-tracker-v1/engine` 의 파일 다섯과 소스 아홉을
직접 읽고 구조를 옮겼다. 인용한 코드는 원문이다.

**보증하지 않는 것** — v1의 수치가 옳은지는 판단하지 않았다. 가중치와 `transfer` 계수는
그쪽도 "튜닝 대상"이라고 적어 두었으며 근거는 골든 테스트 26건뿐이다.
게임과 대조한 적은 양쪽 모두 없다.
