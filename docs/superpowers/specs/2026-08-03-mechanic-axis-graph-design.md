# 메카닉 축 그래프 — 추천 엔진의 근간

> 설계 2026-08-03 · 구현 2026-08-04 — **1단계 완료**
> 12절이 초판의 기둥 여섯을 무너뜨렸고 14절이 판단 여섯을 닫았다. 15·16절이 결정 후 구조다.
> **15절의 5테이블 중 4개가 적재됐다.** `gift_trigger_param`(정량자 ~90행)은 저작 전이다.
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

~~E.G.O 도 같다. `ego_status → status_category` 로 94종의 E.G.O 가 축을 준다(159엣지).~~

> **이 주장은 12절 ①에서 반증됐다.** `ego_status` 는 「다루는 상태」지 「주는 축」이 아니다.
> 「인격으로 취급」 명시가 있는 E.G.O 는 **2종뿐**이고 나머지 155엣지는 근거가 없다.

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

## 12. 반증으로 무너진 가정 여섯

병렬 반증(완전성 · 건전성 · 흐름 반례 · 불변식) 결과다. **설계의 기둥 여섯이 무너졌다.**
아래는 전부 실측 반례가 있다.

### ① `ego_status` 는 「E.G.O 가 주는 축」이 아니다 — 치명적

초판 §3·§13 은 `ego_status → status_category` 로 장착 파생을 얻는다고 했다. **틀렸다.**

```
「인격으로 취급」 명시가 있는 E.G.O    2종 (20509 착영휘도 · 20109 엄숙한 애도)
ego_status 로 축을 주는 E.G.O        94종 · 159엣지
                                     → 155엣지(97.5%)가 근거 없다
```

반례 — **20705 홀리데이**는 `ego_status` 로 축 7개를 전부 주는데, 패시브 원문은
「부여하는 화상·출혈·진동·파열·침잠 위력 **+1**」이다. **증폭기지 부여자가 아니다.**
21105 는 「5축 중 **무작위 1개**」인데 5축을 전부 준다 — §3 이 `identity_keyword` 의
미덕으로 든 10109 와 같은 메카닉인데 E.G.O 쪽만 안 접힌다.

`ego_status` 는 limbus-assets 의 `statuses`(= 「다루는 상태」)이고 참조·소모·자원을 포함한다.
20109 는 `Discard`·`ReloadLament`·`SuperCoin`·`AzureResistDown` 까지 담는다.

**대안 경로** — `ego_skill → coin_token(kind='status')` 이 「이 E.G.O 스킬이 실제로 부여하는
상태」다. E.G.O 스킬 205개가 `coin_token` 에 있고, 20509 는 `Laceration` 만 나온다(정확).
다만 **「부여한다」와 「그 인격으로 취급된다」는 여전히 다르다.** 후자는 2종만 명시돼 있다.

> **결론** — 장착 파생은 **저작 2행**이다. 유도가 아니다.
> `coin_token` 경로는 「이 E.G.O 로 무엇을 부여하게 되나」라는 **다른 질문**에 쓴다.

### ② E.G.O 는 등급 슬롯별로 동시 장착된다

초판 `squad.ego_id` 가 인격당 1개를 가정했다. **틀렸다.**

```
뫼르소(sinner 5)   ZAYIN 1 · TETH 3 · HE 3 · WAW 2
```

20509(HE)와 20507(WAW)을 **함께** 낀다. 입력은 `(identityId, egoId[])` 여야 한다.

부수 — `rank` NULL 동명 중복 5건(201011·203011·205011·206011·211011)은 `ego_status` 가
0행이라 조용히 축을 안 준다. `ego.sinner_id = identity.sinner_id` 검사도 없으면
파우스트 인격에 뫼르소 E.G.O 가 붙는다.

### ③ 다중 트리거는 OR 가 아니다 — AND 사례가 실재한다

초판은 「OR 로 보되 확인 필요」로 남겼다. **확인 결과 AND 다.**

반례 — **9179** 는 트리거가 `Allies have Poise Skill` · `Allies have Gloom Skill` 둘뿐인데
ko 원문은 「[Breath] … 공격 스킬 보유 인격이 **5인 이상이면** 이번 전투 동안 발동
(대기 인원 제외)」이고 우울 절은 그 안쪽 조건이다. OR 로 접으면 우울 스킬만 있는 편성에서
「켜진다」로 표기되지만 **실제로는 한 번도 안 켜진다.**

같은 「5인 이상 게이트」 기프트가 **39개**다. 배치 스코프 59개의 `Deployment Position` 도
OR 가 아니라 AND 스코프다.

> **결론** — 트리거 결합은 기프트마다 다르다. **`gift_trigger` 에 결합 의미를 저작해야 한다.**

### ④ `gift_exclusive_pack` 은 배타 그룹이 아니다

초판 §9 는 「팩당 배타 그룹이라 그룹당 1개만 계산」이라 했다. **정반대로 틀렸다.**

원본 필드명이 `exclusiveTo` 이고 방향이 **기프트 → 팩**이다 — 「이 기프트는 이 팩에서만
나온다」. 택일이 아니다.

```
9208 인연 얽힘        exclusiveTo 가 7개 팩       ← 팩당 택일이면 성립 불가
배타 원소 1개뿐인 팩    19개                      ← 택일이면 무의미
gift_pack 에도 있는 쌍  237 / 321
```

초판대로 「그룹당 1개」를 적용하면 최대 17개짜리 팩이 1/17 만 계산돼 **대규모 과소평가**가
난다(71팩 · 230기프트 영향).

**반대 방향 결함도 있다** — `gift_exclusive_pack` 84행(58기프트 · 44팩)이 `gift_pack` 에
없다. 9212 는 1014 의 전용인데 어느 팩의 드랍 풀에도 없다. `gift_pack` 을 1차 소스로 삼고
`exclusive` 는 서브셋으로만 쓰며, 나머지는 결손으로 기록해야 한다.

### ⑤ `identity_rewrite` 3행이 전부 모델과 안 맞는다

```
9280    자기참조 순환.  같은 기프트가 「검계 3인 이상일 때 발동」이면서 3번째 검계를 만든다
        게다가 S_CORP 소속 인격은 10615 홍루 1인뿐이라 orderBy·take 가 무의미하다
9841    필터가 소속이 아니다.  「자신의 기본 스킬로 [DimensionRift]을 부여하는 인격 중」
        — 스킬-상태 술어다.  filterId(소속) 타입으로는 표현 불가
1041302 targetId 가 다값이다.  「흑수 또는 가씨 가문」
        흑수=unit_keyword BLACK_BEAST · 가씨=association FAMILY_GA — targetKind 도 단일이 아니다
        발동 조건이 「홍원 군주 홍루의 패시브로 일방공격 명령 받을 때」 — 런타임 조건인데 자리가 없다
```

**3행짜리 테이블을 위해 스키마를 일반화하는 것이 옳은지 재검토해야 한다.**

### ⑥ 최장일치 규칙이 정답을 파괴한다

초판 §7 이 근거로 든 예시가 규칙을 깬다.

```
Trigger Tremor Burst   최장일치 → VibrationExplosion(Tremor Burst)  → status_category 0행 → 축 NULL
                       짧은 매칭 → Vibration(Tremor)               → VIBRATION  ← 정답
```

`Trigger Amplitude Conversion/Entanglement` 도 같은 사유로 축을 잃는다. **이름 매칭 실패는
2건이 아니라 최소 4건**이고, `effect` 쪽에서도 같은 이름으로 재발한다.

> 다만 **거짓 양성은 0건**이다. 전수 50쌍 중 축을 낳는 오매칭이 없고, `Bind`·`Charge` 류
> 부분 문자열 사고도 없다. 43/150 도 재현된다. **문제는 거짓 음성뿐이다.**

## 13. 그 밖에 드러난 정량적 사실

```
83 / 451 기프트(18.4%)   트리거가 전부 runtime·unclassified.  편성으로 영원히 판정 불가
                         9020 · 9024 · 9045 · 9091 · 9812 (Trigger Tremor Burst 단독 계열)
5 인격                    identity_keyword 가 0개.  10201·10205·10305·10903·11206
                         특수 상태 경로로도 축이 없다. E.G.O 없으면 축 공백
36 기프트                 배치 슬롯이 다중값.  9761 은 #1·#2·#7·#8
                         **슬롯 공간이 8이다** — 「출전 7」이라는 초판 전제가 틀렸다
7 기프트                  gift_requirement 가 어느 트리거의 상세인지 모른다
                         9043 은 Wrath Resonance 와 Wrath Absolute Resonance 를 둘 다 갖는데
                         requirement 는 absolute:true 하나뿐
1 인격                    identity_keyword.skill_slots 가 빈 배열 (10312 · Sinking)
normal 51팩 중 0팩         축 태그가 없다.  hard 도 14/116
                         → pack_axis 로는 노멀 런에서 아무것도 못 낸다
자기 루프 21 · 상호 쌍 37   연쇄 종료 조건이 없다.  9003 재에서 재로는 Always 로 스스로 씨를 뿌린다
association 64 중 37       트리거가 참조하지 않는다 (실사용률 42%)
```

## 14. 판단 여섯 — 전부 닫았다

### 결정 1 · 장착 파생은 저작 2행이다

`ego_status` 경로를 **버린다.** 155/159 엣지가 근거 없다.

```
identity_axis(source='ego_granted')     저작 2행   20509 착영휘도 · 20109 엄숙한 애도
                                        「인격으로 취급됨」이 명시된 것만
```

`ego_skill → coin_token(kind='status')` 는 **다른 질문에 쓴다** — 「이 E.G.O 로 무엇을
부여하게 되나」다. 축 소속이 아니라 **런타임 상태 예측**의 입력이다. 트리거는 「이 인격이
X 축인가」를 묻지 「X 를 부여할 수 있나」를 묻지 않는다. 20705 홀리데이가 그 차이다 —
5축을 증폭하지만 어느 축의 인격도 아니다.

**새 메카닉이 나오면 저작 행이 는다.** 게임이 「인격으로 취급됨」을 명시하므로 판별은 쉽다.

### 결정 2 · 트리거 결합을 판정하지 않는다

AND/OR 를 451행 저작하는 것도, AND 로 통일하는 것도 틀린다. **결합을 접지 않고 그대로 낸다.**

```
실측 (mirror 451)
  A  전부 roster/always      62    「켜진다」
  B  일부만 판정 가능        291    「N개 중 M개 충족」 — 접지 않고 그대로 표기
  C  전부 runtime/unclassified 98   「편성으로는 모름」
```

**B 291건이 정보의 대부분이다.** 여기서 AND 를 가정하면 과소, OR 를 가정하면 과대가 된다.
「5개 중 3개 충족」이 사용자에게 가장 정확한 답이고, 점수화는 충족 비율로 한다.

결합 저작은 **필요해지면 그때 더한다.** 지금 451행을 저작하면 대부분이 쓰이지 않는다.

### 결정 3 · `identity_rewrite` 테이블을 만들지 않는다

3행을 위해 6필드 스키마를 세웠는데 **3행 모두 필드가 안 맞았다.** 일반화 실패의 신호다.

```
9280     자기참조 순환.  S_CORP 소속 인격이 10615 홍루 1인뿐이라 orderBy·take 가 무의미
9841     필터가 소속이 아니라 스킬-상태 술어 ([DimensionRift] 부여 인격 중)
1041302  targetId 다값(흑수=unit_keyword · 가씨=association) + 런타임 조건
```

**대신 `field_gap` 계열에 「미지원 메카닉」으로 기록한다.** 이 셋을 보유했을 때 화면이
「이 기프트는 소속 판정을 바꿉니다 — 수동 확인 필요」로 표기한다.

넷째 사례가 나와 패턴이 보이면 그때 스키마를 만든다. 지금은 **셋이 서로 다른 모양**이다.

### 결정 4 · 판정 불가 98건을 후보에서 빼지 않는다

**별도 등급으로 표시한다.** 22%(98/451)를 감추면 사용자가 존재를 모른다.

```
켜진다          A 62
N/M 충족        B 291
편성으로는 모름   C 98
```

C 는 점수에 넣지 않되 목록에는 남긴다 — 「이 팩엔 편성으로 판단 못 하는 기프트가 N개」로.

### 결정 5 · `pack_tag` 을 1차 신호에서 뺀다

측정이 결정적이다.

```
pack_tag 축 태그          hard 14/116 · normal  0/51   ← 노멀 런에서 아무것도 못 낸다
gift_pack → trigger → 축   hard 116/116 · normal 51/51  ← 전 팩 커버
```

**팩→축 신호는 `gift_pack` 을 경유해 유도한다.** 「이 팩의 드랍 풀에 어떤 축 트리거를 쓰는
기프트가 몇 개 있나」가 실질이고, 전 팩을 덮는다.

`pack_tag` 은 **화면 라벨**로만 쓴다(「화상 팩」 표기). 점수화 근거가 아니다.

### 결정 6 · 연쇄는 visited 집합 + 깊이 2

```
종료      visited 집합으로 사이클을 막는다.  자기 루프 21 · 상호 쌍 37 이 실재한다
깊이      2 홉.  「내 기프트가 A 를 켜고, A 가 B 를 켠다」까지
누적      기대 효용은 visited 기준으로 한 번만 더한다.  중복 합산 금지
```

**깊이 2 인 이유** — 3홉 이상은 사용자가 검증할 수 없는 근거가 된다. 「나침반 → 침잠 →
서릿발 발자국 → 합위력 감소」가 2홉이고, 이것이 사람이 납득하는 사슬의 길이다.
도달 집합이 281 노드로 유한하므로 깊이를 늘리는 것은 언제든 가능하다 — **지금 상한을
두는 것은 성능이 아니라 설명 가능성 때문이다.**

## 15. 결정에 따른 구조 — canonical 5테이블

결정 1·3·5 로 테이블이 7개에서 5개로 줄었다.

```prisma
/// 트리거가 판정하는 축. 8행
model Axis { id String @id  kind String  note String? }

/// 인격이 가진 축. keyword | special_status 는 유도, ego_granted 는 저작 2행
model IdentityAxis { identityId String  axisId String  source String
                     @@id([identityId, axisId, source]) }

/// 트리거가 무엇을 참조하나 + 판정 가능성
/// refKind: axis | association | unit_keyword | sin | resonance | attack_type
///        | skill_kind | coin | deployment | none        ← 반증으로 4종 추가
model TriggerRef { triggerId String  refKind String  refId String @default("")
                   resonanceMode String?  threshold Int?
                   evaluability String
                   @@id([triggerId, refKind, refId]) }

/// 효과가 무엇을 다루나. refKind 에 attack_type 추가
model EffectRef { effectId String  refKind String  refId String @default("")  mode String
                  @@id([effectId, refKind, refId]) }

/// 정량자. 유일하게 「값」이 저작이다. slot 은 다중값이므로 Int[]
model GiftTriggerParam { giftId String  triggerId String  kind String
                         value String  slots Int[]  source String
                         @@id([giftId, triggerId, kind]) }
```

**빠진 것** — `PackAxis`(결정 5 로 `gift_pack` 유도로 대체) · `IdentityRewrite`(결정 3 으로
`field_gap` 기록으로 대체).

**고친 것** — `TriggerRef` 에 `skill_kind`·`coin` refKind 와 `resonanceMode`·`threshold` 추가,
`EffectRef` 에 `attack_type` 추가, `GiftTriggerParam.slots` 를 배열로(슬롯 공간 8).

> **구현이 한 군데를 더 고쳤다 — `refId` 는 nullable 이 아니다.** 위 스니펫은 이미 구현을
> 반영해 `String @default("")` 로 적었다. 초판은 `String?` 였다. 이유와 배경은 19절 ③에 적는다 —
> 이 설계를 참고해 스키마를 되돌릴 때 nullable 로 회귀하면 안 된다.

## 16. 결정에 따른 평가 흐름

```
1  축 프로파일     identity_axis(keyword|special_status)
                  + ego_granted 저작 2행 (장착 E.G.O 가 그 둘일 때만)
                  입력은 (identityId, egoId[]) — 등급 슬롯별 다중 장착
                  ego.sinner_id = identity.sinner_id 검사

2  갈래별 집계     축 · 소속 · unit_keyword · 죄악 · 공명 · 공격타입 · skill_kind · 배치
                  분모가 roster 면 편성 전체, field 면 출전만
                  배치 슬롯 공간은 8

3  트리거 판정     trigger_ref 로 갈래를 찾고 gift_trigger_param 으로 임계값 비교

4  기프트 등급     A 전부 충족 · B N/M 충족 · C 판정 불가.  결합을 접지 않는다

5  팩 점수화      floor_pack(난이도, 층) → 후보 팩
                  gift_pack 을 1차 소스로 축 신호 유도 (117/117 커버)
                  gift_exclusive_pack 은 「이 기프트가 나오는 팩」으로 읽는다 — 배타 아님
                  A 는 점수에, B 는 비율 가중, C 는 목록에만

6  연쇄          effect_ref → 축 → trigger_ref.  visited 집합 · 깊이 2 · 중복 합산 금지

7  근거          충족한 트리거와 그 갈래를 그대로 낸다.  사슬은 2홉까지
```

## 17. 무너지지 않은 것

반증에 견딘 것도 명확히 적는다.

```
identity_keyword 정본 가정   특수 상태의 부모 축이 빠진 인격 0건 · 역방향도 0건.  §3 의 핵심은 옳다
상태당 축 최대 1개            8축 기준 위반 0
FK 정합                     identity_association · ego_status · gift_trigger · gift_effect 고아 0
sinner 정합                 ego·identity 의 sinner_id 전부 canonical.sinner 에 있다
pack_tag · floor_pack 유일성  중복 0
분모 roster/field 분기        9282·9283·9179 전부 절대수. 비율 해석이 필요 없다
거짓 양성                    이름 매칭이 만드는 잘못된 축 0건
VIBRATION_CONVERTED 공존      9건 · MERGED 1건이 항상 VIBRATION 과 함께 온다
```

## 18. 범위 밖

```
런 기록 수집과 가중치 학습     app.run 에 편성·E.G.O 열이 아예 없다. 스키마 확장이 선행
Neo4j 적재                  이 설계가 RDB 에서 검증된 뒤
화면과 트래커 흐름            디자인 작업과 겹친다
정량자를 채우는 방법           위키·게임 확인. 파이프라인 밖
런 상태 트리거의 확률 가중      데이터가 아니라 모델링 선택
기대 효용의 저울추             gift.tier · cost · enhanceable
적 저항 프로파일               encounter_part_resist 11,800행
패닉 스킬 · cursedPair 3쌍     raw 에 있고 canonical 에 없다. 결손 기록만
```

## 19. 구현 결과 (2026-08-04)

```
axis                8행     status_category 중 트리거가 참조하는 8종
trigger_ref       150행     refKind: axis 43 · none 31 · association 27 · sin 20
                            resonance 15 · attack_type 6 · skill_kind 3 · coin 3
                            deployment 1 · unit_keyword 1
                            evaluability: roster_gated 57 · runtime 46 · roster 45
                            always 1 · unclassified 1
effect_ref         55행
identity_axis     566행     keyword 266 + special_status 300
gift_trigger_param   0행    저작 전. 검사가 0 을 고정한다
```

**검사는 9건이다.** 계획 브리프는 「7건」이라 적었으나 실장은 행 수 4 · 소속 트리거
오매칭 방지 · 축 참조 무결성 · evaluability 5갈래 전부 0 초과 · 골든 표본(10208) ·
저작 미완 고정까지 9건을 넣었다. `npm run v2:verify:canonical` 은 이 9건을 포함해
**총계 191건 전부 통과**다.

### ① 결손 합계 1,137 → 1,142 — 새로 생긴 결손이 아니다

축이 하나도 없는 인격 5건(`10201`·`10205`·`10305`·`10903`·`11206`)을 `field_gap` 에
`entity='identity', field='axis'` 로 기록해 합계가 늘었다. 이 5건은 13절이 이미 실측해
둔 값이다 — keyword·special_status 어느 경로로도 축을 못 얻는다는 사실 자체는 설계
시점에 알려져 있었다. 이번 적재가 한 일은 **몰랐던 결손을 새로 만든 게 아니라, 이미
알던 결손을 처음으로 `field_gap` 에 기록한 것**이다. 회귀 가드 기준값도 1,142로 함께
올렸다.

### ② 골든 검증이 반증에서 나온 함정을 실제 데이터로 막았다

12절이 반증으로 찾아낸 오매칭·최장일치 함정과 13절의 골든 표본을, 실제 적재 결과로
다시 확인했다.

```
소속 트리거가 축에 걸린 건수     0
Dawn Office Identities        → association DAWN         (DawnTeam 상태로 안 샜다)
N Corp. Fanatic Identities    → association N_CORP_FNATIC
Trigger Tremor Burst          → axis VIBRATION            (최장일치 폴백 작동)
10208 검계 살수 파우스트        → BREATH · LACERATION       keyword · special_status 두 경로
편성 6인 축 프로파일            화상 6 · 진동 5
```

7절이 확인된 오매칭 2건(Dawn Office · N Corp. Fanatic)이라 적은 자리와 12절 ⑥이 반례로
든 `Trigger Tremor Burst` 최장일치 문제가, 소속 우선·최장일치 규칙을 적재기에 그대로
넣은 뒤에는 재발하지 않는다.

### ③ 스키마가 설계와 세 군데 다르다

15절 스니펫은 요약이라 구현이 세 군데를 벗어났다. 셋 다 15절 본문을 이 결과로
고쳤다 — 이 설계 문서를 다시 참고해 스키마를 되돌릴 때 아래로 회귀하면 안 된다.

```
refId               String? → String @default("")
                     이유    @@id([triggerId, refKind, refId]) 에 nullable 컬럼을 넣으면
                             Prisma 가 P1012 로 거부한다. @@unique 로 우회하면 PostgreSQL 이
                             NULL 을 서로 다르게 봐(NULLS DISTINCT) 다뤄 중복이 뚫린다 —
                             refKind='none' 행이 31건이라 실질적 구멍이었다. model FieldGap 의
                             locale String @default("") 가 이미 같은 패턴을 쓴다.

IdentityAxis.egoId  15절 스니펫에 없는데 구현에 있다
                     이유    ego_granted 축이 「어느 E.G.O 가 주는가」를 남겨야 16절의
                             (identityId, egoId[]) 판정이 조인만으로 된다. 요약 스니펫이
                             축약하며 뺐을 뿐 결정 자체는 15절 본문(「ego_granted 는 저작
                             2행」)에 이미 있었다.

GiftTriggerParam.value  String → String?
                     이유    kind='slot' 행은 값이 슬롯 배열(slots Int[])에 있고 value 는
                             안 쓴다 — min_count·denominator 행만 value 를 채운다. 15절
                             스니펫은 value 를 필수로 적었으나 slot 행에는 값이 없으니
                             nullable 이 맞다.
```

**남은 것은 정량자다.** 임계값 72 · 분모 · 배치 슬롯 ~90행이며 위키·게임 확인으로
채운다. 파이프라인 밖의 일이다.
