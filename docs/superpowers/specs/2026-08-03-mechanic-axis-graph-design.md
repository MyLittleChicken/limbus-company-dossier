# 메카닉 축 그래프 — 추천 엔진의 근간

> 설계 2026-08-03 · 상태 WIP
> 선행 [ADR-06 3스키마 데이터베이스](../../adr/06-three-schema-database.md) · [소비자 관점 감사](../../audit/00-summary.md)
> 이 문서의 모든 수치는 `canonical` 실측이다. 스냅샷 `2026-07-25`(MD7).

## 1. 무엇을 만드나

거울 던전 트래커의 추천 근간이다.

```
입력   인격 편성 12 · 출전 7과 순서 · 각자의 E.G.O · 난이도 · 현재 층 · 보유 기프트
평가   축 프로파일 → 트리거 충족 → 발동 가능 기프트 → 연쇄
출력   층별 팩 후보를 「내 편성에서 실제로 켜질 기프트의 기대 효용」으로 점수화 + 근거
기록   선택과 결과를 남겨 가중치를 학습 (이후 단계)
```

## 2. 이 설계가 푸는 문제

기프트는 **트리거**로 켜진다. 트리거는 편성의 성질을 본다 — 「새벽 사무소 인격 3인 이상」,
「화상 스킬을 가진 아군 5인」, 「탄환을 쓰는 아군」.

그런데 그 성질이 단순하지 않다.

**특수 키워드가 부모 키워드로 취급된다.** 홍매화(특수 출혈)를 가진 검계 살수 파우스트는
**출혈 인격으로 동작**한다. 사랑/증오(특수 충전)를 쓰는 돈키호테는 충전 인격이다.
게임에 30종의 특수 키워드가 있고 앞으로 늘어난다.

**E.G.O 장착이 성질을 바꾼다.** 착영휘도를 끼면 그 인격이 「출혈·호흡을 부여하는 인격으로
취급됨」이 된다. 편성마다 달라지므로 미리 계산할 수 없다.

**기프트가 기프트를 켠다.** 나침반이 적에게 침잠을 쌓으면 「적이 침잠 보유」가 트리거인
다른 기프트가 켜진다.

## 3. 핵심 발견 — 상태 취급은 이미 데이터에 있다

설계에 앞서 `canonical` 과 `raw` 를 전수로 뒤졌다.
**「상태를 부여하는 인격으로 취급됨」 메카닉이 구조화돼 있었다.**

> **범위를 밝힌다.** 아래는 **상태 축** 취급에 한정된 발견이다.
> **소속** 취급은 구조화돼 있지 않다 — 11절 ①이 그 반례다.

```
status_category   163행   특수 상태 → 부모 축
                          RedApricotBlossom(홍매화)      → LACERATION
                          ThePowerOfLoveAndHate(사랑/증오) → CHARGE · SIN
                          SinkingWhite(나비)             → SINKING
                          AccelBullet(가속탄)             → BULLET · RESOURCE
                          VibrationIgnition(진동-작열)     → VIBRATION · VIBRATION_CONVERTED · SIN
```

검증 — 검계 살수 파우스트(10208):

```
identity_keyword    Laceration · Breath          ← mj 가 이미 해소해 담았다
identity_status     RedApricotBlossom → LACERATION
```

두 경로가 같은 답을 낸다. 다만 **둘 다 `limbus-data-mj` 계열에서 파생되므로 독립 검증은 아니다** —
출처가 스스로와 일치한다는 뜻이다. 독립 확인은 게임·위키로 해야 한다.

**「~로만 취급됨」(제거 모드)도 이미 반영돼 있다** —
10109 약지 점묘파 스튜던트 이상은 화상·출혈·진동·파열·침잠을 랜덤 부여하는데
`identity_keyword` 에는 `Laceration` 하나만 있다.

E.G.O 도 같다. `ego_status → status_category` 로 **94종의 E.G.O 가 축을 준다**(159엣지).

```
20509 착영휘도       → Laceration(LACERATION) · Breath(BREATH)
20109 엄숙한 애도     → SinkingWhite(SINKING) · BulletLament(BULLET) · Sinking · Vibration
```

> **초판 판단을 정정한다.** 설계 초안은 「파생 규칙 13건을 저작해야 한다」고 적었다.
> 산문에서 「취급됨」 문구를 세고 그것이 저작 대상이라 단정했는데, **상태 축에 대해서는** 틀렸다.
> `status_category` + `ego_status` 로 이미 구조화돼 있다.
> 다만 **소속 취급 3건은 여전히 저작 대상**이다(11절 ①). 초판의 정정이 과했다.

## 4. 축 — 8개

`status_category` 의 카테고리 중 트리거가 참조하는 것만 축이다.

```
COMBUSTION 화상 · LACERATION 출혈 · VIBRATION 진동 · BURST 파열
SINKING 침잠 · BREATH 호흡 · CHARGE 충전 · BULLET 탄환
```

`keyword` 테이블은 12종인데 그중 상태 기반은 7종이고, **`BULLET` 은 `keyword` 에 없다.**
탄환은 키워드가 아니지만 키워드처럼 동작한다 — 그래서 축 어휘를 별도로 둔다.

`keyword` 의 나머지 5종(`Random`·`Slash`·`Penetrate`·`Hit`·`None`)은 상태 축이 아니라
공격 타입·메타이며 다른 경로로 다룬다.

**축이 아닌 카테고리** — 트리거가 하나도 참조하지 않는다.

```
BURSTREACTIVE 7          주살【신속】·【독】…  흑운회 메카닉. 파열과 무관하다(id 접두가 헷갈린다)
FREISHUTZ_OUTIS_EGO_BULLET 7   마탄 1~7차. 오티스 E.G.O 전용. 보유 인격 0
SUPPORTIVE_PROTECT 2     원호 방어 · 호위
DUEL_DECLARATION 4 · FAUVISM_CLAW_WOUND 4   특정 인격 메카닉
VIBRATION_CONVERTED 9 · VIBRATION_MERGED 1  항상 VIBRATION 과 공존한다 → 추가 처리 불필요
IGNORE_CHECED_CORRECTION_EXCLUSION 32       내부 플래그
```

## 5. 여섯 갈래

트리거 150종을 무엇으로 판정하는지로 가르면 이렇다. **축 8개와는 다른 층위다** —
축은 「상태 계열」이고, 갈래는 「트리거가 무엇을 보는가」다.

| 갈래 | 근거 | 실측 | 편성으로 판정 |
| --- | --- | --- | --- |
| 축 | `identity_keyword` + `identity_status`→`status_category` | 266 + 163 | ✅ |
| 소속 | `identity_association` · `identity_unit_keyword` | 241 · 391 | ✅ |
| 죄악 | `gift_requirement.sinAffinity` · `resonance` (보조: `skill.sin`) | 46 · 23 · 563쌍 | ✅ |
| 공격 타입 | `gift_requirement.skills` (보조: `skill.attack_type`) | 10 · 261쌍 | ✅ |
| 편성 구조 | 배치 슬롯 · 후열 여부 | 입력에서 온다 | ✅ |
| 전장 상태 | 없음 | — | ❌ 런 상태 |

`unit_keyword` 는 예외가 아니라 **1급 갈래**다 — `Bloodfiend Identities` 가 여기로만 풀린다.

## 6. `evaluability` — 이진이 아니라 3단이다

초안은 「`… Skill` 이면 roster, 아니면 runtime」이라는 이진 규칙을 세웠다. **틀렸다.**
실측하면 규칙 밖으로 떨어지는 것이 너무 많다.

```
… Identities    28   roster
… Skill         17   roster
X Skill Used    41   ← 초안이 runtime 으로 보냈다
그 밖           64
```

`Wrath Skill Used` 는 **편성이 가능성을 정하고 런타임이 발생을 정한다.** 분노 스킬이 없는
편성에서는 영원히 안 켜지고, 있으면 언젠가 켜진다. roster 도 runtime 도 아니다.

```
roster        편성만으로 확정된다              … Identities · Allies have X Skill
roster_gated  편성이 가능성을 정하고            X Skill Used · X Resonance
              런타임이 발생을 정한다            E.G.O Skill Used · Deployment Position
runtime       편성과 무관하다                  Clash Win · Critical Hit · Enemies with HP Condition
always        항상                            Always
unclassified  원본이 분류를 포기했다             Other Uncommon Triggers
```

**이 3단이 출력의 신뢰도를 가른다.** `roster` 는 「켜진다」, `roster_gated` 는 「켜질 수 있다」,
`runtime` 은 「편성으로는 모른다」로 화면에 다르게 표기해야 한다.

> 규칙만으로는 `그 밖 64` 가 안 갈린다. **`trigger_ref.evaluability` 는 유도로 초안을 만들되
> 사람이 검토해 확정하는 값이다.** 저작이 아니라고 한 초판 주장을 철회한다.

## 7. 유도 규칙과 그 함정

`trigger` 와 `effect` 는 **id 하나뿐인 통제 어휘 라벨**이다. 무엇을 참조하는지가 테이블에 없다.
이름으로 유도하되 **오매칭이 실재한다.**

```
trigger → 축            43/150   status_text.en 매칭 (Combustion→Burn · Vibration→Tremor)
trigger → 소속          26/28    'Assoc.' ↔ 'Association' 변형 포함
trigger → 죄악          33
trigger → 공격 타입      6
어느 것도 아님           39       런 상태 · 무조건 · 미분류
```

**확인된 오매칭 2건** — 둘 다 소속 트리거가 상태 이름에 잘못 걸린다.

```
Dawn Office Identities      → DawnTeam(Dawn Office) 상태에 매칭됨
N Corp. Fanatic Identities  → Assemble · AssemblePersonality(Fanatic) 두 상태에 매칭됨
```

**소속 우선 · 최장일치** 규칙으로 막는다. `Trigger Tremor Burst` 는 `Tremor`(Vibration)와
`Tremor Burst`(VibrationExplosion) 둘에 걸리는데 최장일치가 옳다.

**이름 매칭 실패 2건**은 표로 둔다.

```
Bloodfiend  → association 이 아니라 unit_keyword BLOODFIEND (5인격)
Yurodivy    → association YURODIVY 인데 표시명이 'Yurodiviye' 라 안 붙는다
```

> **유도 결과를 테이블로 못박는다.** 질의마다 이름 매칭을 다시 하면 오매칭이 곳곳에서
> 되살아난다. 적재 시 한 번 풀고 검사로 지킨다.

## 8. `gift_requirement` 는 트리거의 구조화 판본이다

초안은 이 테이블을 「임계값이 아니다」로 넘겼는데 다시 보니 값이 크다.

```
sinAffinity  46   [{"sins":["wrath"], "attackSkill":true}]
resonance    23   [{"mode":"activate","sins":["wrath"],"absolute":true}]
skills       10   [{"atkType":"blunt","scaling":true}]
slots        60   [1,2,3]  ← 스킬 슬롯 번호
teamWide      3   true
```

트리거가 `Wrath Skill Used` 라 말하는 것을 requirement 는 구조로 준다.
`sinAffinity`·`resonance` 는 관련 트리거를 100% 함께 갖는다(46/46 · 23/23) — **중복이 아니라 상세**다.

**공명은 죄악과 다른 갈래다.** `{"mode":"activate","absolute":true}` 가
`Wrath Resonance` 와 `Wrath Absolute Resonance` 를 가른다. `refKind='sin'` 으로 뭉개면
이 정보가 사라지므로 `resonance` 를 별도 `refKind` 로 둔다.

## 9. 팩 → 축도 구조화돼 있다

`pack_tag` 이 트리거와 **같은 영문 어휘**를 쓴다.

```
1401 타오르는 일렁임 → Burn      1405 어지러운 파동 → Tremor
1403 새어나온 적혈   → Bleed     1409 잠겨드는 아림 → Sinking
1411 내쉬어진 한숨   → Poise     1413 차오르는 동력 → Charge
sin 계열 21팩       → Lust · Pride · Sloth · Wrath · Envy · Gloom · Gluttony
attack_type 6팩     → Blunt · Pierce · Slash
```

팩이 어떤 축의 덱에 좋은지를 데이터가 말한다. 팩 점수화의 1차 근거다.

**층·난이도로 팩 후보를 추리는 경로는 `floor_pack` 288행**이다(`difficulty` × `floor_range` × `pack_id`).
1절 입력의 「난이도 · 현재 층」이 여기로 들어간다.

**팩 안에는 배타 그룹이 있다.** `gift_exclusive_pack` 321행 · 71팩. 팩 1002 는 9403·9404 중
하나만 준다. 배타를 무시하고 기대 효용을 합산하면 **과대평가된다** — 점수화가 배타 그룹을
단위로 다뤄야 한다.

## 10. 저작해야 하는 것

초판은 「저작은 정량자뿐」이라 적었다. **틀렸다.** 저작물이 넷이다.

```
① 정량자                 ~90행   임계값 72 · 분모 · 배치 슬롯          유일하게 「값」이 저작이다
② trigger_ref            ~150   유도 초안 + 사람 검토. evaluability 3단 판정
③ 이름 매칭 예외·우선순위     4~6   Bloodfiend · Yurodivy · 소속 우선 · 최장일치
④ identity_rewrite          3   9280 · 9841 · 1041302
```

②③은 코드에 규칙으로 담고 결과를 테이블로 굳힌다. `lib/engine/vocab.ts` 가 토큰→어휘를
저작한 것과 같은 계열이다.

### 정량자 실측

```
「N인 이상」 기프트        72
  ㄴ ko 「편성 인원」 명시   11        ko 「출격 인원」 명시   20
  ㄴ en 'counts Backup'    1        en 'on the field'    27
배치 슬롯                 Deployment Position 63기프트의 「1번 편성 전용」
```

**분모를 명시한 것이 ko·en 합쳐 31건 안팎이고 나머지 40여 건은 표기가 없다.**
초판이 적은 「명시 27」은 재현되지 않는 수치라 위 실측으로 대체한다.

같은 「3인 이상」인데 분모가 다르다는 것이 결정적이다.

```
9282 날개 모양 양초   3인 이상 · 편성 인원 기준 (counts Backup Identities)
9283 상납된 시가      3인 이상 · 출격 인원 기준 (only counts Identities on the field)
```

## 11. 남은 구멍

**① 소속 재작성 3건** — 초판은 1건이라 했으나 「소속으로 **간주**」 표현을 안 봐서 놓쳤다.

```
gift 9280 본국검보   「검계 소속 인격을 제외한 편성 순서가 가장 빠른 S사 소속 인격 1인을 검계 소속으로 취급」
gift 9841 C형 정리 요원 장비 세트   「편성 순서가 가장 빠른 W사 소속이 아닌 인격 1인을 W사 소속으로 취급」
passive 1041302     「일방공격 명령 받을 때 흑수 또는 가씨 가문 소속으로 간주」
```

셋 다 **선택 규칙**(제외 · 필터 · 정렬 · 개수)이며 정형 데이터에 전혀 없다. E.G.O 는 0건이다.
대상이 **축이 아니라 소속**이라는 점이 중요하다 — 초판의 `axis_rewrite` 는 타입이 틀렸다.

**② 완전 불투명 3건** — `Other Uncommon Triggers` 만 가진 기프트. 44건 중 41건은 다른
트리거도 가져 판정된다.

**③ 런 상태** — `Clash Win` · `Critical Hit` · `Enemies with HP Condition`. 편성으로
원리적 판정 불가. 확률 가중은 데이터가 아니라 모델링 선택이므로 이 설계의 범위 밖이다.

**④ 마탄 7종** — `FREISHUTZ_OUTIS_EGO_BULLET` 이 `BULLET` 태그를 안 갖는다. 보유 인격 0이라
지금은 영향 없다. `axis` 테이블에 `note` 로 판정 보류를 기록해 재적재에도 남긴다.

**⑤ 무기록 드롭** — raw `cursedPair`/`blessedPair` 3쌍(9227↔9228 · 9229↔9230 · 9231↔9232)이
canonical 에 없고 `field_gap` 에도 안 잡혔다. 저주↔축복 대응이라 획득 경로 판정에 쓰일 수 있다.
이 설계의 범위 밖이지만 **결손으로 기록해야 한다.**

## 12. 추가할 구조 — canonical 7테이블

**RDB 조인만으로 전부 풀리게 만든다.** 파싱도 하드코딩도 없이. 그래야 다른 저장소로
옮기는 것이 말이 된다.

```prisma
/// 트리거가 판정하는 축. status_category 중 트리거가 참조하는 것만.
/// BULLET 은 keyword 에 없지만 키워드처럼 동작하므로 여기서 1급이다
model Axis {
  id   String  @id                    // COMBUSTION … BULLET
  kind String                         // status_keyword | bullet
  note String?                        // 판정 보류 기록 (마탄 등)
}                                                                      // 8행

/// 인격이 가진 축. 두 경로를 적재한다.
/// **ego_granted 는 여기 없다** — 편성 의존이라 저장할 수 없고 평가 시점에 UNION 한다
model IdentityAxis {
  identityId String
  axisId     String
  source     String                   // keyword | special_status
  @@id([identityId, axisId, source])
}                                                                      // 유도

/// 트리거가 무엇을 참조하나. 이름 유도 결과를 못박는다
model TriggerRef {
  triggerId    String
  refKind      String                 // axis | association | unit_keyword | sin
                                      // | resonance | attack_type | deployment | none
  refId        String?
  /// 공명 전용. absolute 인가
  absolute     Boolean?
  evaluability String                 // roster | roster_gated | runtime | always | unclassified
  @@id([triggerId, refKind, refId])
}                                                                      // ~150

/// 효과가 무엇을 다루나. 연쇄 엣지의 출발점
model EffectRef {
  effectId String
  refKind  String                     // axis | sin | none
  refId    String?
  mode     String                     // inflict | gain | consume | trigger
  @@id([effectId, refKind, refId])
}                                                                      // ~55

/// 팩이 어떤 축·죄악·공격타입 덱에 좋은가. pack_tag 유도
model PackAxis {
  packId  String
  refKind String                      // axis | sin | attack_type
  refId   String
  @@id([packId, refKind, refId])
}                                                                      // 유도

/// **정량자. 유일하게 「값」이 저작이다**
model GiftTriggerParam {
  giftId    String
  triggerId String
  kind      String                    // min_count | denominator | slot
  value     String                    // 3 | roster | field | 1
  source    String                    // wiki | game-verified
  @@id([giftId, triggerId, kind])
}                                                                      // ~90

/// 소속을 재작성하는 규칙. 축이 아니라 **소속**이 대상이다
model IdentityRewrite {
  id            String  @id
  sourceKind    String                // gift | passive
  sourceId      String                // 9280 · 9841 · 1041302
  targetKind    String                // association
  targetId      String                // BLADE_LINEAGE · W_CORP · …
  excludeId     String?               // 이미 대상 소속인 인격은 제외
  filterId      String?               // 이 소속 중에서만 고른다 (S_CORP 등)
  orderBy       String                // roster_order
  take          Int                   // 1
  mode          String                // add
}                                                                      // 3행
```

## 13. 평가 흐름 — 6갈래를 모두 소비한다

초판은 축 하나만 조인하는 SQL 을 실었다. **그것으로는 답이 안 나온다.** 전체 흐름은 이렇다.

**단계 1 — 축 프로파일을 만든다 (E.G.O 를 UNION 한다)**

```sql
WITH squad AS (SELECT identity_id, ego_id, slot, on_field FROM $입력),
axis_of AS (
  SELECT s.identity_id, ia.axis_id, s.on_field
    FROM squad s JOIN canonical.identity_axis ia USING (identity_id)
  UNION                                   -- ← ego_granted. 저장 불가, 평가 시점에만 존재
  SELECT s.identity_id, sc.category, s.on_field
    FROM squad s
    JOIN canonical.ego_status es ON es.ego_id = s.ego_id
    JOIN canonical.status_category sc ON sc.status_id = es.status_id
    JOIN canonical.axis a ON a.id = sc.category
)
```

**단계 2 — 소속 재작성을 적용한다** (`identity_rewrite` · 보유 기프트와 패시브 기준)

**단계 3 — 갈래별로 충족 수를 센다.** 분모가 `roster` 면 편성 12 전체, `field` 면 `on_field` 만
센다. **이 분기가 없으면 9282 와 9283 이 같은 답을 낸다.**

**단계 4 — 트리거별 충족을 판정하고 기프트로 접는다.** 한 기프트가 트리거를 여럿 갖는다
(451 중 **339 기프트가 2개 이상**, 최대 8개).

> **다중 트리거는 OR 로 본다.** 게임 설명문이 트리거를 「또는」으로 나열하고, `limbus-assets`
> 가 이를 배열로 담았다. 다만 **AND 인 사례가 있는지 표본으로 확인해야 한다** — 확인 전까지
> OR 로 두되 이 가정을 문서에 남긴다.

**단계 5 — 신뢰도를 붙인다.** 기프트의 트리거들이 어떤 `evaluability` 인지로 갈린다.

```
roster 트리거를 충족          → 「켜진다」
roster_gated 만 충족          → 「켜질 수 있다」
runtime 만 있다               → 「편성으로는 모른다」
```

**단계 6 — 팩을 점수화한다.**

```
floor_pack(난이도, 층)  →  후보 팩
  각 팩의 gift_pack ∩ 위에서 켜지는 기프트  →  기대 효용
  gift_exclusive_pack 배타 그룹은 그룹당 1개만 계산   ← 없으면 과대평가
  pack_axis 와 내 축 프로파일의 겹침         →  1차 근거
```

**단계 7 — 연쇄.** 켜진 기프트의 `effect_ref` 가 주는 축이 다시 `trigger_ref` 를 켠다.
실측 6,259엣지 · 281노드 · 평균 out-degree 35.6 · 양방향 쌍 1,762.

## 14. 저장소 판단

**PostgreSQL 에 구조를 먼저 세운다.** 관계형이 관계로 전부 설명하지 못하는 채로 다른
저장소에 옮기면 문제를 이사시키는 것뿐이다.

연쇄 그래프는 **281노드로 유한하다.** 도달 집합은 아무리 커도 281이다. 폭발하는 것은
「경로 열거」라는 선택의 결과이지 저장소의 성질이 아니다 — 깊이 상한 없이 열거하면
Neo4j 에서도 똑같이 발산한다. **따라서 `35.6^n` 은 저장소 전환의 근거가 아니다.**

Neo4j 를 볼 실제 시점은 이렇다.

```
근거 사슬이 산출물이 될 때        「왜 켜지나」를 경로로 보여줘야 하고 SQL 로 쓰기 어려워질 때
깊이를 미리 못 정할 때            지금은 2–3홉이고 상한을 정할 수 있다
탐색 UI 가 저작을 도울 때          trigger_ref · 정량자 저작에 그래프 브라우저가 값을 낼 때
```

전환을 싸게 만들어 두는 편이 낫다 — **투영 정의를 코드로 분리하고, 평가기를 저장소와
분리한다.** `loadFacts()` 구현 하나만 갈아끼우면 되게.

## 15. 범위 밖

```
런 기록 수집과 가중치 학습     app.run 스키마 확장이 선행돼야 한다. 별도 설계
Neo4j 적재                  이 설계가 RDB 에서 검증된 뒤
화면과 트래커 흐름            디자인 작업과 겹친다
정량자 ~90행을 채우는 방법     위키·게임 확인. 파이프라인 밖의 일
런 상태 트리거의 확률 가중      데이터가 아니라 모델링 선택
기대 효용의 저울추             gift.tier · cost · enhanceable. 가중치 학습 설계로 미룬다
적 저항 프로파일               encounter_part_resist 11,800행. 「얼마나 유용한가」의 다음 단계
패닉 스킬 · cursedPair        raw 에 있고 canonical 에 없다. 결손 기록만 남긴다
```
