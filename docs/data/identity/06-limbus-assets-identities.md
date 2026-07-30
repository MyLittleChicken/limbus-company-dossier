# 회차 6 — `limbus-assets/identities.json`

> **관계·표시의 정본** · 인격 · **184건** · 295 KB · 최상위 **객체**(키 = 인격 id) · 키 **17종**
> 출처 커밋 `774883d7` · 스냅샷 2026-07-25 · 정리 2026-07-30

## 파일 정체

**척추가 `limbus-data-mj` 에서 `limbus-assets` 로 넘어가는 회차다.** 회차 1·2에서 대조군으로
계속 봤던 파일이 이제 주인공이 된다.

mj 두 파일(23키 + 16키)의 내용이 여기 한 파일에 담기고, **mj에 없는 것이 5개** 있다.

| 회차 1·2와 겹침 (12) | `breakSection` · `date` · `defCorrection` · `hp` · `name` · `rank` · `resists` · `season` · `sinnerId` · `skillTypes` · `defenseSkillTypes` · `tags` |
| --- | --- |
| **여기만 있음 (5)** | `speedList` · `statuses` · `skillKeywordList` · **`event`** · **`eventReward`** |

구조도 mj와 다르다.

```
mj      minSpeed [4,4,4,4] · maxSpeed [6,7,8,8]     축이 min/max
assets  speedList [[4,6],[4,7],[4,8],[4,8]]         축이 단계

mj      hp { defaultStat, incrementByLevel }
assets  hp { base, level }                           키 이름이 다르다

mj      skills 는 별도 파일 + attackSkills 로 연결
assets  skillTypes 에 id·num·type 을 인라인
```

**오버뷰 5.1의 가설이 강화된다** — `event`·`eventReward` 는 mj 5파일 어디에도 없고,
그것도 **역사 정보**라 다른 출처가 대체할 수 없는 종류다.

### 대조한 출처

| 출처 | 무엇을 대조했나 |
| --- | --- |
| `limbus-data-mj/identities.json` · `identities_detail.json` | 겹치는 12필드 전수 |
| `limbus-data-mj/skills.json` | `skillTypes`·`defenseSkillTypes` 의 `type` 3필드 |
| `limbus-assets/identity_tag_list.json` | `tags` 집합 대조 |
| `limbus-assets/identity_keyword_modifiers.json` | `10104` 가 조건부인지 |
| `mechanics/limbus-assets/statuses.json` | `statuses` 참조 정합성 |
| `gifts/limbus-assets/gifts.json` | 기믹 카운트 트리거 41종 |
| `lib/engine/dsl.ts` · `state.ts` | 엔진이 어느 축으로 세는지 |
| 게임 인격 상세 화면 | `10105`·`10508`·`10103` 획득 방법 · `10104` 기믹 표기 |

---

## 여기만 있는 필드

### `event` / `eventReward` — 이벤트 출신 표시

| | |
| --- | --- |
| 타입·실측 | `Boolean?` · `event` **31/184** · `eventReward` **13/184** |
| 값 | **`true` 만 존재.** `false` 는 없다 |
| 포함 관계 | `eventReward` ⊂ `event` (13 ⊂ 31) |
| 의미 | `event` = 이벤트와 결부되어 **처음 등장**한 인격 · `eventReward` = 그중 **보상으로 직접 지급**된 것 |
| mj 대응 | **없음** |
| 변환 | — |
| 적재 | **미적재** |
| 화면 | 미표시 |

게임 확인으로 판정했다.

```
10105 어금니 사무소 해결사 이상   출석 이벤트 누적 14일 보상   event + eventReward
10508 검계 우두머리 뫼르소       이벤트 기간 추출            event 만
10103 검계 살수 이상            사전 예약 + 상시 추출        플래그 없음
```

**`10103` 이 사전 예약 보상인데도 `event` 가 아닌 것**이 경계를 정한다 — 사전 예약은 이벤트로
보지 않고, 상시 추출 풀에 있는 것이 기준이다.

시즌 1–7에 흩어져 있고 **발푸르기스 인격 17건(시즌 `9101`–`9109`)은 하나도 없다.**
발푸르기스는 이벤트가 아니라 별도 축이다.

같은 이벤트에서 나온 쌍의 한쪽만 `eventReward` 인 경우가 있다.

```
시즌 3 검계 계열   10308 검계 살수(돈키호테)  event+reward   10208 검계 살수(파우스트) event만
시즌 4 유로지비     10409 20구 유로지비(료슈)  event+reward   10609 20구 유로지비(홍루)  event만
```

**함정 — 최초 획득 경로의 기록이고 현재 획득 가능성과 무관하다.** 당신 확인에 따르면
`10105`·`10508` 모두 *"이후 추출이나 자아 파편 교환에 추가"* 됐다. 31건 전부 지금은 얻을 수 있다.
추천 서비스에서 "가질 수 있는 인격인가" 판단에 쓸 수 없다.

`false` 가 없어 **"이벤트가 아니다"는 필드 부재로 표현된다.**

### `speedList` — 동기화 단계별 속도

| | |
| --- | --- |
| 타입·실측 | `Int[][]` · 184/184 · **바깥 4 고정 · 안쪽 2 고정**(736쌍) · 값 1–8 |
| 의미 | 인덱스가 동기화 단계 1–4, 안쪽이 `[최소, 최대]` |
| 교차대조 | mj `minSpeed`/`maxSpeed` 와 **184/184 완전 일치** · `min > max` 위반 0건 |
| 변환 | — (`identity_speed` 는 mj detail 에서 온다) |
| 적재 | **미적재** |
| 화면 | 미표시 |
| 함정 | 없음. **축만 전치돼 있다** |

같은 736개 값을 행/열만 바꿔 담았다. 다만 **`speedList` 쪽이 읽기 쉽다** — 회차 2의 예외가
한눈에 보인다.

```
11214 로보토미 E.G.O:: 램프   [[1,6],[1,5],[1,4],[1,4]]    동기화할수록 상한이 내려간다
10813 정사무소 대표          [[2,6],[2,6],[3,7],[3,8]]    3→4 에서 유일하게 변한다
```

**정본 판정에서 실익이 없다** — 값이 같고 구조는 assets 쪽이 낫다. 우리는 mj detail 을 쓴다.

### `statuses` — 인격이 다루는 상태

| | |
| --- | --- |
| 타입·실측 | `String[]` · 184/184 · 길이 **1–36** · 총 **1,179개 참조** · 값 **342종** |
| 참조 정합성 | `mechanics/limbus-assets/statuses.json`(1,472종)에 **없는 것 0종** |
| mj 대응 | **없음** |
| 변환 | `statusIds` 집합으로 검증 후 통과 (`src/entities/identities.ts:171`) |
| 적재 | `identity_status(identity_id, status_id)` |
| 화면 | 상세 "보유 상태" 패널 |

**08 문서의 ③ 접점 축이 이것이다.**

```
최다 20종
  52  Burst(파열)        52  Laceration(열상→출혈)  48  SuperCoin
  47  Breath(호흡)       46  Agility(신속)          41  Vibration(진동)
  35  Sinking(침잠)      32  Combustion(화상)       30  VibrationExplosion
  29  Binding(속박)      25  DefenseDown            25  Charge(충전)
  21  Paralysis(마비)    20  Aggro(도발)            20  AttackUp
  19  CanDuelGuard       18  Enhancement            17  AttackDmgUp
  16  DefenseUp          15  Protection(보호)
```

기믹 축과 일반 버프/디버프가 섞여 있다. `Aggro`(도발) 20건에 회차 2의 `11214` 램프 그레고르
도발 탱커가 든다.

**꼬리가 매우 길다** — 342종 중 **241종(70%)이 1개 인격 전용** 고유 상태다.

```
최다 보유   10115 거미집 검지 아비 36종 · 11115 거미집 중지 아비 27종 · 10613 홍원 군주 22종
최소 보유   1종 11건 — 10901 LCB 수감자 [Laceration] · 11101 LCB 수감자 [Burst]
```

`10115` 거미집 검지 아비가 또 최다다 — 회차 1의 `altSins`(Furioso-Replica), 회차 3의 코인 9개,
`atkTypes` 3종 유일 인격이 전부 이 인격이다.

**참조 정합성이 완벽하다.** 342종 전부 상태 마스터에 있어, `identity_status` 검증
(`statusIds.has(statusId)` 실패 시 `unmapped`)이 현행 스냅샷에서 한 번도 걸리지 않는다.
`limbus-assets` 안에서 인격 → 상태 참조가 닫혀 있다.

### `skillKeywordList` — 기프트 조건 카운트의 기믹 축

| | |
| --- | --- |
| 타입·실측 | `String[]` · **179/184** · 값 **7종** |
| 분포 | `Bleed` 53 · `Rupture` 50 · `Poise` 41 · `Tremor` 36 · `Sinking` 32 · `Burn` 28 · `Charge` 25 |
| 의미 | **기프트 조건 카운트에 들어가는 기믹 축** |
| 교차대조 | mj `keywords` 와 **183/184 일치**(소문자 비교) |
| 변환 | — |
| 적재 | **미적재** |
| 화면 | 미표시 |

없는 5건(`10201`·`10205`·`10305`·`10903`·`11206`)은 mj `keywords` 도 빈 배열인 그 5건이다 —
**기믹 없는 인격**이다.

**어긋나는 1건이 판정 기준을 드러냈다.**

```
10104 개화 E.G.O:: 동백 (이상)

  mj  keywords            ["tremor", "sinking"]
      keywordSkills       { tremor: [1,2,3], sinking: [1,2,3] }
  assets skillKeywordList ["Sinking"]
         statuses         ["Sinking", "SinkingSurge", "Vibration"]

  keyword_modifiers 없음 · egoKeywords/altKeywords 없음 → 조건부가 아니다
```

게임에서 이 인격은 **침잠 인격이며 진동 조건 카운트에서 명시적으로 제외**된다.

> 진동 위력·횟수를 부여하는 공격 스킬을 보유한 인격 5인 이상 출격 — 이 인격은 포함되지
> 않는다. 다만 다른 인격들로 조건이 충족되면 그 기프트 효과는 받는다.

두 필드는 어긋난 것이 아니라 **다른 것을 재고 있다.**

| 필드 | 재는 것 | 10104 |
| --- | --- | --- |
| mj `keywords` | 스킬이 **실제로 부여**하는 기믹 | 진동 · 침잠 |
| assets `skillKeywordList` | **기프트 조건 카운트**에 들어가는 기믹 | 침잠 |

**기프트 판정의 정본은 `assets skillKeywordList` 다.** 이 발견으로 우리 엔진의 과대 계상이
드러났다 — `docs/08-gimmick-keywords.md` 4.1·4.2.

---

## 회차 1·2와 겹치는 필드 — 차이만

184건 전수 대조 결과다.

| 필드 | mj 대응 | 결과 |
| --- | --- | --- |
| `breakSection` | `identities_detail.stagger` | **184/184 완전 일치** |
| `defCorrection` | `identities_detail.defCorrection` | **184/184 완전 일치** |
| `hp` | `identities_detail.hp` | **184/184 일치.** 키 이름이 다르다 — `{base, level}` vs `{defaultStat, incrementByLevel}` |
| `rank` | `identities.star` | **184/184 완전 일치** |
| `resists` | `identities_detail.resists` | **184/184 일치.** 키 순서가 다르다 — assets `blunt,pierce,slash` vs mj `slash,pierce,blunt` |
| `sinnerId` | `identities.sinnerId` | **184/184 완전 일치** |
| `name` | `identities.title` | **184/184 완전 일치.** 인격명 영문. mj `name`(수감자명)이 아니다 |
| `season` | `identities.season` | **182/184.** mj 결손 2건(`10311`·`10708`) — 회차 1에서 확인 |
| `date` | `identities.updatedDate` | **183/184.** `10116` 픽업 종료일 — 회차 1에서 확인 |

**실질 차이가 없다.** 9필드 모두 값이 같고, 다른 것은 키 이름(`hp`)과 키 순서(`resists`)뿐이다.

### `skillTypes` — 공격 스킬 인라인

| | |
| --- | --- |
| 구조 | `{ id, num, type{affinity, tier, type} }` |
| 배열 길이 | 3:147 · 4:21 · 5:6 · 6:8 · 7:1 · 8:1 |
| `num` | 0:66 · 1:184 · 2:184 · 3:184 |
| 변환 | `deckCounts` 는 mj `copies` 를 쓴다. `type` 은 `identity-details` 가 정본 |
| 적재 | 간접 — `skill` 테이블은 `identity-details` 에서 만든다 |

`num` 은 회차 2의 mj `copies` 와 같은 개념이며 **`num: 0` 이 대체 스킬**이다.
회차 2에서 확인한 대로 **assets가 6개를 누락**한다(mj 72 vs assets 66).

### `defenseSkillTypes` — 방어 스킬 인라인

| | |
| --- | --- |
| 구조 | `{ id, type{affinity, tier, type, affinityUptie?, atkType?, clashable?} }` |
| 배열 길이 | 1:163 · 2:20 · 3:1 |
| 적재 | 간접 |

**`atkType` 이 새로 나왔다** — 회차 3에서 못 본 키다. **71건에 있고 전부 `counter`** 다.

```
type 키 조합 6종
  affinity, affinityUptie, tier, type              116   guard·evade (죄악이 4단계에 붙는다)
  affinity, affinityUptie, clashable, tier, type    15   합 가능 guard·evade
  affinity, atkType, tier, type                     36   counter
  affinity, atkType, clashable, tier, type          32   합 가능 counter
  affinity, clashable, tier, type                    5
  affinity, tier, type                               2
```

**`atkType` 과 `affinityUptie` 가 상호 배타적이다.**

```
counter        공격 타입을 갖고, 죄악이 1단계부터 있다      atkType 있음 · affinityUptie 없음
guard · evade  공격 타입이 없고, 죄악이 4단계에 붙는다      atkType 없음 · affinityUptie 있음
```

회차 3의 실측과 정확히 맞물린다. `clashable` 은 52건(counter 32 + guard 20)이며 두 계열에
걸쳐 나타난다.

**`type` 3필드가 mj `skills.json` 과 823/824 일치.** 불일치는 기지의 `1041206`
(assets tier 4 vs mj tier 3) 1건이다.

### `tags` — 특성 키워드

| | |
| --- | --- |
| 타입·실측 | `String[]` · **94종**(마크업 5종 포함) · 마크업 제거 후 **93종** · 길이 1–7 |
| 교차대조 | `identity_tag_list.json` 94항목과 **완전히 같은 집합**(양쪽 차집합 0) |
| 변환 | `stripMarkup` 후 `affiliationIds` 집합으로 검증 (`identities.ts:162`) |
| 적재 | `identity_affiliation(identity_id, affiliation_id)` |
| 화면 | 상세 "소속" 패널 · 목록 "소속" 필터 |

**회차 1 정정** — 그때 "95항목"이라 적었는데 실제 **94항목**이다. `identities.json` 의 `tags` 와
`identity_tag_list.json` 이 완전히 같은 집합이므로 목록 파일은 **중복 정보**다.

게임의 「특성 키워드」와 1:1이며, 이름을 `trait` 으로 바꾸기로 했다
(`../../backlog/01-identity-tags.md`).

---

## 함정 요약

1. `event`·`eventReward` 는 **최초 획득 경로의 기록**이고 현재 획득 가능성과 무관하다
2. `false` 가 없어 "이벤트가 아니다"는 **필드 부재**로 표현된다
3. `speedList` 는 mj와 **축이 전치**돼 있다. 값은 184/184 동일
4. `hp` 키 이름이 mj와 다르다 — `{base, level}` vs `{defaultStat, incrementByLevel}`
5. `resists` 키 순서가 mj와 다르다. 순서를 무시하면 184/184 일치
6. `name` 은 **인격명 영문**이다. mj의 `name`(수감자명)과 이름이 같아 헷갈린다
7. `defenseSkillTypes.type` 의 `atkType` 과 `affinityUptie` 가 **상호 배타적**이다
8. `skillKeywordList` 는 **기프트 조건 카운트의 판정 기준**이며 mj `keywords` 와 1건 갈린다
9. `tags` 와 `identity_tag_list.json` 이 같은 집합이라 목록 파일은 중복이다

## 미해결

없다. 17필드 전부 확정했다.

### 다음 회차로 넘긴 것

- → **회차 7** `identities_mini.json` 이 이 파일의 부분집합인가
- → **회차 9** `identity_tag_list.json` 이 중복이라면 왜 별도 파일인가
- → **회차 10** `identity-details` 의 `skills` 가 `skillTypes` 와 어떻게 다른가.
  `1041206` tier 불일치의 적재값

### 다른 문서로 넘긴 것

- **`docs/08-gimmick-keywords.md` 4.1·4.2 추가** — `10104` 가 드러낸 판정 기준과
  우리 엔진의 과대 계상. `Tremor Skill Used` 계열 기프트 25건에서 `10104` 를 진동
  공급자로 잘못 센다

## 근거 재현

```
data/entities/identities/limbus-assets/identities.json             인격 184건 · 17키
data/entities/identities/limbus-data-mj/identities.json            겹치는 필드 대조
data/entities/identities/limbus-data-mj/identities_detail.json     스탯 대조
data/entities/identities/limbus-data-mj/skills.json                type 3필드 대조
data/entities/identities/limbus-assets/identity_tag_list.json      tags 집합 대조
data/entities/identities/limbus-assets/identity_keyword_modifiers.json  10104 조건부 확인
data/entities/mechanics/limbus-assets/statuses.json                statuses 참조 정합성
data/entities/gifts/limbus-assets/gifts.json                       기믹 카운트 트리거 41종
lib/engine/dsl.ts · lib/engine/state.ts                            엔진 축 계산 경로
게임 인격 상세 화면                                                  획득 방법 · 기믹 표기
```
