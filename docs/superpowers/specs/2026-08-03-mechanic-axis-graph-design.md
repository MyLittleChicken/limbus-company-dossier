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

## 3. 핵심 발견 — 이 구조는 이미 데이터에 있다

설계에 앞서 `canonical` 과 `raw` 를 전수로 뒤졌다. **「취급됨」 메카닉이 구조화돼 있었다.**

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

두 경로가 서로를 교차 검증한다. **「~로만 취급됨」(제거 모드)도 이미 반영돼 있다** —
10109 약지 점묘파 스튜던트 이상은 화상·출혈·진동·파열·침잠을 랜덤 부여하는데
`identity_keyword` 에는 `Laceration` 하나만 있다.

E.G.O 도 같다. `ego_status → status_category` 로 **94종의 E.G.O 가 축을 준다**(159엣지).

```
20509 착영휘도       → Laceration(LACERATION) · Breath(BREATH)
20109 엄숙한 애도     → SinkingWhite(SINKING) · BulletLament(BULLET) · Sinking · Vibration
```

> **초판 판단을 정정한다.** 설계 초안은 「파생 규칙 13건을 저작해야 한다」고 적었다.
> 산문에서 「취급됨」 문구를 세고 그것이 저작 대상이라 단정했는데 틀렸다.
> `status_category` + `ego_status` 로 이미 구조화돼 있다.

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

## 5. 다섯 축이 아니라 여섯 갈래

트리거 150종을 무엇으로 판정하는지로 가르면 이렇다.

| 갈래 | 근거 | 실측 | 편성으로 판정 |
| --- | --- | --- | --- |
| 축 | `identity_keyword` + `identity_status`→`status_category` | 266 + 163 | ✅ |
| 소속 | `identity_association` (+ `unit_keyword` 예외) | 241 · 64종 | ✅ |
| 죄악 | `identity_skill` → `skill.sin` | 563쌍 · 1044/1045 채움 | ✅ |
| 공격 타입 | `identity_skill` → `skill.attack_type` | 261쌍 · 907/1045 | ✅ |
| 편성 구조 | 배치 슬롯 · 후열 여부 | 입력에서 온다 | ✅ |
| 전장 상태 | 없음 | — | ❌ 런 상태 |

## 6. `evaluability` 는 저작이 아니라 유도다

`limbus-assets` 의 트리거 어휘가 **편성과 런 상태를 이미 구분한다.**

```
Allies have Burn Skill    화상 스킬을 가진 아군    → roster
Allies have Burn          지금 화상을 보유한 아군   → runtime
```

`Bleed·Burn·Charge·Poise·Tremor` 는 쌍으로 있고, `Ammo·Sinking·Rupture·죄악 7·공격타입 3` 은
`Skill` 형만 있다. 규칙으로 유도한다.

```
'… Skill' 로 끝난다           → roster
'Allies have X' (Skill 없음)  → runtime
'… Identities'               → roster
'Always'                     → always
'Other Uncommon Triggers'    → unclassified
그 밖                         → runtime
```

## 7. 유도 규칙과 그 함정

`trigger` 와 `effect` 는 **id 하나뿐인 통제 어휘 라벨**이다. 무엇을 참조하는지가 테이블에 없다.
이름으로 유도하되 **오매칭이 실재한다.**

```
trigger → 축            47/150   status_text.en 매칭 (Combustion→Burn · Vibration→Tremor)
trigger → 소속          26/28    'Assoc.' ↔ 'Association' 변형 포함
trigger → 죄악          33
trigger → 공격 타입      6
어느 것도 아님           39       런 상태 · 무조건 · 미분류
```

**확인된 오매칭 2건** — 둘 다 소속 트리거가 상태 이름에 잘못 걸린다.

```
Dawn Office Identities      → DawnTeam(Dawn Office) 상태에 매칭됨
N Corp. Fanatic Identities  → AssemblePersonality(Fanatic) 상태에 매칭됨
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
**죄악·공명 판정은 이름 파싱이 아니라 이 테이블을 쓴다.**

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

## 10. 저작해야 하는 것 — 정량자뿐

**어느 출처에도 구조화돼 있지 않다.** `limbus-assets` 가 트리거 어휘를 저작할 때
정량자를 의도적으로 버렸다.

```
임계값 「N인 이상」    72 기프트
분모 편성 vs 출전     명시 27 · 미명시 45
배치 슬롯            Deployment Position 63기프트의 「1번 편성 전용」
                    ─────
                    ~90행
```

같은 「3인 이상」인데 분모가 다르다는 것이 결정적이다.

```
9282 날개 모양 양초   3인 이상 · 편성 인원 기준 (counts Backup Identities)
9283 상납된 시가      3인 이상 · 출격 인원 기준 (only counts Identities on the field)
```

## 11. 남은 구멍 넷 — 정직하게

**① 9280 본국검보 — 기프트가 소속을 재작성한다**

```
「검계 소속 인격을 제외한 편성 순서가 가장 빠른 S사 소속 인격 1인을 검계 소속으로 취급」
```

단순 축 추가가 아니라 **선택 규칙**(제외 · 필터 · 정렬 · 개수)이다. 정형 데이터에 전혀 없다.
**패시브 0건 · E.G.O 0건 · 기프트 1건**으로 구멍이 좁다.

**② 완전 불투명 3건** — `Other Uncommon Triggers` 만 가진 기프트. 44건 중 41건은 다른
트리거도 가져 판정된다.

**③ 런 상태 39종** — `Clash Win` · `Critical Hit` · `Enemies with HP Condition`. 편성으로
원리적 판정 불가. 「켜질 수 있음」까지만 말한다. 확률 가중은 데이터가 아니라 모델링 선택이다.

**④ 마탄 7종** — `FREISHUTZ_OUTIS_EGO_BULLET` 이 `BULLET` 태그를 안 갖는다. 탄환 계열로
보이지만 게임이 그렇게 묶지 않았다. **판정 보류** — 보유 인격이 0이라 지금은 영향 없다.

## 12. 추가할 구조 — canonical 6테이블

**RDB 조인만으로 전부 풀리게 만든다.** 파싱도 하드코딩도 없이. 그래야 다른 저장소로
옮기는 것이 말이 된다.

```prisma
/// 트리거가 판정하는 축. status_category 중 트리거가 참조하는 것만.
/// BULLET 은 keyword 테이블에 없지만 키워드처럼 동작하므로 여기서 1급이다
model Axis { id String @id  kind String }                              // 8행

/// 인격이 가진 축. 세 경로를 한 관계로 통일한다
/// keyword        identity_keyword → axis            (mj 저작. 「~로만」 반영됨)
/// special_status identity_status → status_category → axis  (홍매화 → LACERATION)
/// ego_granted    평가 시점에 더한다 — 편성 의존이라 적재 불가
model IdentityAxis { identityId String  axisId String  source String } // 유도

/// 트리거가 무엇을 참조하나. 이름 유도 결과를 못박는다
/// refKind: axis | association | unit_keyword | sin | attack_type | deployment | none
/// evaluability: roster | runtime | always | unclassified   ← 이름 규칙으로 유도
model TriggerRef { triggerId String  refKind String  refId String?  evaluability String }  // ~150

/// 효과가 무엇을 다루나. 연쇄 엣지의 출발점
/// mode: inflict | gain | consume | trigger
model EffectRef { effectId String  refKind String  refId String?  mode String }            // ~55

/// 팩이 어떤 축·죄악·공격타입 덱에 좋은가. pack_tag 유도
model PackAxis { packId String  refKind String  refId String }                             // 유도

/// **유일한 저작.** kind: min_count | denominator | slot
model GiftTriggerParam { giftId String  triggerId String  kind String  value String  source String }  // ~90

/// 축 재작성 규칙. 지금은 9280 하나다
model AxisRewrite { id String  targetAxis String  excludeAxis String?  filterAxis String?
                    orderBy String  take Int  mode String }                                 // 1행
```

## 13. 이걸로 답이 나온다

```sql
-- 「이 편성으로 켜지는 기프트」
select g.id
from canonical.gift g
join canonical.gift_trigger gt on gt.gift_id = g.id
join canonical.trigger_ref tr on tr.trigger_id = gt.trigger_id
join canonical.identity_axis ia on ia.axis_id = tr.ref_id
where ia.identity_id = any($편성)
  and tr.evaluability = 'roster'
group by g.id, gt.trigger_id
having count(distinct ia.identity_id)
       >= coalesce((select value::int from canonical.gift_trigger_param p
                    where p.gift_id=g.id and p.trigger_id=gt.trigger_id and p.kind='min_count'), 1)
```

연쇄는 `gift → effect_ref → axis → trigger_ref → gift` 로 이어진다. 실측 6,259엣지 · 281노드 ·
평균 out-degree 35.6 · 양방향 쌍 1,762.

## 14. 저장소 판단

**PostgreSQL 에 구조를 먼저 세운다.** 관계형이 관계로 전부 설명하지 못하는 채로 다른
저장소에 옮기면 문제를 이사시키는 것뿐이다.

Neo4j 는 그 다음이다. 근거는 측정에 있다 — 연쇄 그래프가 out-degree 35.6 에 사이클
1,762쌍이라 깊이별 경로가 `35.6^n` 으로 터진다(3홉 4.5만 · 4홉 160만). **OLTP DB 에
조합 탐색 부하를 걸면 안 된다.** 탐색은 OLTP 밖에서 한다.

투영은 `raw → canonical` 과 같은 규율로 둔다 — 재생성 가능 · 검사로 지킴 · 계보 유지.

## 15. 범위 밖

```
런 기록 수집과 가중치 학습     app.run 스키마 확장이 선행돼야 한다. 별도 설계
Neo4j 적재                  이 설계가 RDB 에서 검증된 뒤
화면과 트래커 흐름            디자인 작업과 겹친다
정량자 ~90행을 채우는 방법     위키·게임 확인. 파이프라인 밖의 일
```
