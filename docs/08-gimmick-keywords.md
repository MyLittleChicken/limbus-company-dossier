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

## 4. 인격의 축 — 세 출처가 다른 말을 한다

| 출처 | 필드 | 담는 것 |
| --- | --- | --- |
| `limbus-data-mj/identities.json` | `keywords` | **S1–S3 스킬이 직접 부여하는 기믹만.** 값 7종 고정 |
| `limbus-assets/identities.json` | `skillKeywordList` | mj `keywords` 와 같은 개념. 표기만 대문자 |
| `limbus-assets/identities.json` | `statuses` | **인격이 다루는 상태 전부.** 기믹 + 버프/디버프 + 고유 상태 |

`keywords` ↔ `skillKeywordList` 는 대소문자만 다르다(`burn` vs `Burn`). 실제로 다른 것은
`statuses` 이며, 이것이 우리 `identity_status` 의 원천이다.

### 어긋나는 지점 (184건 전수)

```
완전 일치                      142건
statuses 쪽이 넓음              40건
mj 에만 있는 축이 남는 인격        3건   → categoryKeywordList 병합으로 0건
```

세 번째 줄은 두 번째와 겹친다 — `10504` 는 `protection` 을 얻으면서 동시에 `bleed` 를 놓쳐
양방향으로 어긋난다.

넓어지는 40건의 내역은 자원 축 30건(`protection` 17 · `ammo` 13)과 7종 기믹 16건이다.

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

이 16건이 전부 조건부인 것은 아니다. `Breath` 하나만으로 `poise` 가 붙는 사례(6건)는
호흡을 **소량 다루는** 것에 가깝다. 조건부로 확인된 것은 아래 5절의 4건뿐이다.

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

`Laceration` → `bleed`, `Vibration` → `tremor`. **조합으로 생기는 축이 E.G.O 쪽 데이터에서
그대로 나온다.**

이 데이터는 **이미 우리 DB에 있다**.

```
스키마   model EgoStatus { egoId, statusId }     prisma/schema.prisma:432
적재     src/entities/egos.ts:136
엔진     lib/engine/load.ts:20 — 인격 statuses 만 읽는다. ego_status 미사용
```

즉 인격+E.G.O 조합 축은 **새 데이터 없이 조인 한 번**으로 얻는다.

### 5.2 조건의 큐레이션은 두 파일에만 있다

"이 축은 조건부다"라는 표시는 두 곳에 흩어져 있고 **집합이 다르다**.

| 인격 | 축 | 조건 | mj `egoKeywords`/`altKeywords` | assets `identity_keyword_modifiers.json` |
| --- | --- | --- | --- | --- |
| `10110` 로보토미 E.G.O:: 엄숙한 애도 (이상) | `tremor` | E.G.O `20109` 엄숙한 애도 | ✓ | ✓ |
| `10508` 검계 우두머리 (뫼르소) | `bleed` | E.G.O `20509` 착영휘도[着影揮刀] | — | ✓ |
| `11009` 새벽 사무소 해결사 (싱클레어) | `tremor` | 기프트 `9282` 날개 모양 양초 | — | ✓ (`allowInSolver:false`) |
| `10312` 로보토미 E.G.O:: 사랑과 증오의 이름으로 (돈키호테) | `sinking` | **미상** | ✓ | — |

```
mj 가 아는 것       10110 · 10312
assets 가 아는 것   10110 · 10508 · 11009
겹치는 것           10110
합집합              4건
```

**어느 출처도 단독으로는 완전하지 않다.**

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
"altKeywords": ["sinking"]                // 10312, 조건 없음
```

`conds` 가 배열이라 조건을 여럿 걸 수 있는 구조이며, `type` 은 `ego` 와 `gift` 두 종이 실측된다.

### 5.4 `allowInSolver: false`

`11009` 에만 붙어 있다. 상류 도구가 **추천 계산에서 이 조건을 빼라**고 표시한 것이다.
기프트는 런마다 달라져 고정 전제로 쓸 수 없기 때문으로 읽힌다. 우리 추천 엔진에도
같은 판단이 필요하다.

### 5.5 `10312` 의 결손

```
keywords      ["rupture", "sinking", "charge"]
keywordSkills {"rupture": [1,2,3], "charge": [1,2,3]}     ← sinking 없음
altKeywords   ["sinking"]
```

`keywords` 에는 침잠이 있는데 `keywordSkills`(기믹별 해당 스킬 슬롯)에는 없다. S1–S3 스킬로는
침잠을 주지 않는다는 뜻이며, E.G.O나 패시브 경유로 보인다. **조건이 어디에도 적혀 있지 않다.**

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

/// 상태가 어느 축에 속하는가.
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

/// 인격의 축이 특정 조합에서만 생기는 경우.
model IdentityComboGimmick {
  identityId    Int
  gimmick       Gimmick
  /// ego | gift
  sourceType    String
  /// 조건이 밝혀지지 않은 경우 null (10312)
  sourceId      Int?
  /// 상류 도구가 추천 계산에서 제외하라고 표시한 것
  allowInSolver Boolean @default(true)
  identity      Identity @relation(fields: [identityId], references: [id], onDelete: Cascade)

  @@id([identityId, gimmick, sourceType])
  @@map("identity_combo_gimmick")
}
```

### 축을 얻는 방법 — 저장하지 않고 조인한다

```
인격 기본 축   = (identity_status ⋈ status_gimmick) − identity_combo_gimmick.gimmick
인격 조건부 축 = identity_combo_gimmick
E.G.O 축      = ego_status ⋈ status_gimmick
편성 실축      = 기본 축 ∪ 장착 E.G.O 축 ∪ 조건 충족한 조건부 축
```

검증:

```
10508 검계 우두머리
  identity_status → {poise, bleed}      combo → bleed ← ego 20509
  기본 {poise}   조건부 {bleed ← 착영휘도}

10110 엄숙한 애도 이상
  identity_status → {ammo, sinking, tremor}   combo → tremor ← ego 20109
  기본 {ammo, sinking}   조건부 {tremor ← 엄숙한 애도}

11009 새벽 사무소 해결사
  identity_status → {burn}   combo → tremor ← gift 9282 (allowInSolver=false)
  기본 {burn}   조건부 {tremor ← 날개 모양 양초}
```

### 바뀌는 것

| | 지금 | 바뀐 뒤 |
| --- | --- | --- |
| 상태 → 축 | 코드 정규식 10줄, 커버 4.7% | 데이터 테이블, `categoryKeywordList` 병합 |
| 인격 축 | 조건부가 기본에 섞임 | 기본 / 조건부 분리 |
| E.G.O 축 | 적재돼 있으나 미사용 | 조인으로 사용 |
| 조건 근거 | 없음 | "착영휘도 장착 시"를 화면에 표시 가능 |

기존 테이블은 삭제하지 않는다. `identity_status` · `ego_status` 는 사실 데이터라 그대로 둔다.
추가되는 것은 테이블 2개와 엔진의 조인 변경이다.

## 8. 미해결

- ❓ `10312` 의 침잠 조건. 회차 9(`identity_keyword_modifiers.json`) 또는 스킬·패시브 원문에서 확인
- ❓ 5절 4건 외에 조건부 조합이 더 있는가. 두 출처가 서로를 못 덮는 것이 확인됐으므로 **둘 다 놓친 사례**가 있을 수 있다
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
