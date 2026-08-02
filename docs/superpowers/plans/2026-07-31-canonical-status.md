# canonical 상태·어휘 계열 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 상태 1,472종과 그 표시 문자열, 죄악 7종, 치환 어휘 483종을 적재하고, **스킬 코인 효과 문자열 7,498개를 토큰 215종으로 분해해 상태와 잇는다.** 스펙 §6(그래프 파생을 위한 조건)의 본체다.

**Architecture:** 계획 2–5의 뼈대를 그대로 쓴다. 변환기는 `canonical/statuses.ts`. 코인 토큰 분해는 순수 함수 `parseCoinTokens` 로 떼어 테스트한다. 상태 테이블이 서면 계획 3·5에서 미룬 연결(E.G.O `statuses` · 인격 `statuses`)도 여기서 잇는다.

## Global Constraints

- **현행 파일 수정 금지** · **계획 1–5 산출물은 고치지 않는다**(스키마에는 더하기만)
- 예외 하나 — `src/v2/canonical/identities.ts` 와 `egos.ts` 에 **상태 연결만** 더한다
- 신규 스키마는 `@@map`/`@map` snake_case · 변환기는 `raw.*` 만 질의
- 커밋 메시지 한국어

### 선행 조건

```bash
npm run v2:verify              # 13건
npm run v2:verify:canonical    # 96건
```

---

## 실측 기준값

### 출처 규모

```
limbus-assets/statuses.json      1,472  키 6종  ← 정본
limbus-data-mj/terms.json          483  치환표 {name, nameKo}
limbus-data-mj/sins.json             7  {name, nameKo, attribute(색), order}
limbus-data-mj/keywords.json        10  {name, order}
shared-library/statuses.json       869  구버전
loc-{ko,en,ja}  각 85파일  BattleKeywords 1,409 · Bufs 1,496
```

### **한국어 결손 245종 (16.6 %)** — 마스터북과 정확히 일치

```
statuses                    1,472
  BattleKeywords 커버       1,214
  Bufs 커버                 1,193
  terms.json 커버             435
  ─────────────────────────────
  합집합 커버                1,227
  못 얻는 것                  245   ← 마스터북 상태 편 회차 3 과 같다
```

못 얻는 표본 — `AccumulatedPastMirror` · `FullCharon` · `EnhanceRoseSign` 등.
거울 던전 내부 처리용으로 보이는 것이 많다.

**행을 만들지 않는다.** 소비 측이 폴백을 판정할 수 있어야 한다(ADR-03 5절).
245건 전부 `field_gap` 에 남긴다.

### 코인 토큰 — **그래프 파생의 핵심**

```
스킬 코인 효과 문자열 7,498개
대괄호 토큰 유일 215종
  상태에 걸리는 것    189   → kind = 'status'  · FK 가 선다
  안 걸리는 것         26   → kind = 'timing'

발동 시점 26종
  OnSucceedAttack · OnSucceedAttackHead · OnSucceedAttackTail
  EndSkill · EndSkillHead · EndSkillTail · EndCoin · OnStartCoin
  EnemyKill · EnemyKillFail · AllyKill · AllyKillFail
  WinDuelAttack · WinDuelAttackHead · BeforeAttack · StartBattle · WhenUse
  Critical* 4종 · ReUse* 2종 · UnBrokenCoinOnSucceedAttack · TabExplain
```

**정확히 둘로 갈린다.** 남는 것이 없다.

### 상태 연결 — **100 % 걸린다**

```
E.G.O statuses   유일 137 · 걸림 137 · 안 걸림 0    연결 475
인격 statuses    유일 342 · 걸림 342 · 안 걸림 0    연결 1,179
```

계획 3·5에서 미룬 것이 여기서 전부 이어진다.

### 그 밖의 실측

```
buffType             Positive 678 · Neutral 416 · Negative 378
categoryKeywordList  보유 116건 · 유일 24종
BattleKeywords ∩ Bufs  1,381  (BattleKeywords 1,409 · Bufs 1,496)
```

두 로케일 파일이 겹치지만 **목적이 다르다** — 마스터북이 「런타임 원형 vs 표시용」
으로 판정했다. `Bufs` 를 우선하고 `BattleKeywords` 를 폴백으로 쓴다.

### 적재 행 수 — 검증이 이 숫자를 검사한다

```
status              1,472
status_text     (실측)     ko 1,227 + en + ja
status_category       116   유일 24종
sin_info                7
sin_text               21   7 × 3
term                  483
term_text       (실측)
coin_token      (실측)     스킬 코인에서 분해
ego_status            475
identity_status     1,179
field_gap             245   한국어 결손
```

> 괄호는 실측해 검증에 박는다.

---

## Task 1: 상태·어휘 모델

```prisma
/// 상태의 성격
enum BuffType {
  Positive
  Neutral
  Negative

  @@schema("canonical")
}

/// 전투 상태 1,472종. 정본은 limbus-assets 다.
/// 한국어가 245종(16.6 %) 없다 — 세 출처를 합쳐도 못 얻는다.
model Status {
  id       String   @id
  buffType BuffType @map("buff_type")
  /// 아이콘 경로. 수치 변화형은 없다
  sprite   String?

  texts      StatusText[]
  categories StatusCategory[]
  egos       EgoStatus[]
  identities IdentityStatus[]
  coinTokens CoinToken[]

  @@index([buffType])
  @@map("status")
  @@schema("canonical")
}

model StatusText {
  statusId String  @map("status_id")
  locale   Locale
  name     String
  desc     String?
  /// 짧은 표기. 게임 상세 화면은 desc 를 쓴다
  summary  String?

  status Status @relation(fields: [statusId], references: [id], onDelete: Cascade)

  @@id([statusId, locale])
  @@map("status_text")
  @@schema("canonical")
}

/// 상태 분류. assets categoryKeywordList 24종.
model StatusCategory {
  statusId String @map("status_id")
  category String

  status Status @relation(fields: [statusId], references: [id], onDelete: Cascade)

  @@id([statusId, category])
  @@index([category])
  @@map("status_category")
  @@schema("canonical")
}

/// 죄악 7종과 색 토큰의 대응. mj sins.json 이 유일 출처다.
model SinInfo {
  sin       Sin    @id
  /// 색 토큰. CRIMSON · SCARLET · AMBER · SHAMROCK · AZURE · INDIGO · VIOLET
  attribute String
  order     Int

  texts SinText[]

  @@map("sin_info")
  @@schema("canonical")
}

model SinText {
  sin    Sin
  locale Locale
  name   String

  info SinInfo @relation(fields: [sin], references: [sin], onDelete: Cascade)

  @@id([sin, locale])
  @@map("sin_text")
  @@schema("canonical")
}

/// 치환 어휘 483종. 설명문의 토큰을 표시명으로 바꾸는 표다.
model Term {
  id String @id

  texts TermText[]

  @@map("term")
  @@schema("canonical")
}

model TermText {
  termId String @map("term_id")
  locale Locale
  name   String

  term Term @relation(fields: [termId], references: [id], onDelete: Cascade)

  @@id([termId, locale])
  @@map("term_text")
  @@schema("canonical")
}

/// 스킬 코인 효과 문자열에서 뽑은 토큰. **스펙 6절의 구현이다.**
///
/// 원문은 skill_coin.effects 에 그대로 남고 이것은 분해 결과다. 파싱이 틀려도
/// 원문에서 다시 뽑을 수 있다.
///
/// kind = 'status' 189종은 canonical.status 로 FK 가 선다 →
///   (Skill)-[:INFLICTS]->(Status)
/// kind = 'timing' 26종은 발동 시점이다 → (Skill)-[:TIMED_AT]->(Timing)
model CoinToken {
  skillId  String @map("skill_id")
  uptie    Int
  coinIdx  Int    @map("coin_idx")
  /// 효과 문자열 안 등장 순서
  ordinal  Int
  token    String
  /// status · timing
  kind     String
  /// "Inflict 3 [Sinking]" 의 3. 못 뽑으면 null
  amount   Int?
  /// kind='status' 일 때만 찬다
  statusId String? @map("status_id")

  status Status? @relation(fields: [statusId], references: [id])

  @@id([skillId, uptie, coinIdx, ordinal])
  @@index([token])
  @@index([statusId])
  @@map("coin_token")
  @@schema("canonical")
}

/// E.G.O 가 다루는 상태. 계획 5에서 미룬 연결이다.
model EgoStatus {
  egoId    String @map("ego_id")
  statusId String @map("status_id")

  ego    Ego    @relation(fields: [egoId], references: [id], onDelete: Cascade)
  status Status @relation(fields: [statusId], references: [id], onDelete: Cascade)

  @@id([egoId, statusId])
  @@index([statusId])
  @@map("ego_status")
  @@schema("canonical")
}

/// 인격이 다루는 상태. 계획 4에서 미룬 연결이다.
model IdentityStatus {
  identityId String @map("identity_id")
  statusId   String @map("status_id")

  identity Identity @relation(fields: [identityId], references: [id], onDelete: Cascade)
  status   Status   @relation(fields: [statusId], references: [id], onDelete: Cascade)

  @@id([identityId, statusId])
  @@index([statusId])
  @@map("identity_status")
  @@schema("canonical")
}
```

`Ego` 에 `statuses EgoStatus[]`, `Identity` 에 `statuses IdentityStatus[]`,
`SkillCoin` 관계는 두지 않는다(`CoinToken` 이 복합키로 직접 가리킨다).

- [ ] Step 1–3: 모델 추가 → 검증 → 적용 → 커밋

---

## Task 2: 코인 토큰 분해기

**Files:** `src/v2/canonical/tokens.ts` · `.test.ts`

**Interfaces:**
- `interface ParsedToken { token: string; ordinal: number; amount: number | null }`
- `function parseCoinTokens(effect: string): ParsedToken[]`

### 규칙

```
"[OnSucceedAttack] Inflict 3 [Sinking]"
  → [{token:'OnSucceedAttack', ordinal:0, amount:null},
     {token:'Sinking',         ordinal:1, amount:3}]
```

**수치는 토큰 **앞**에서 찾는다.** `Inflict 3 [Sinking]` 처럼 토큰 직전 숫자가
그 토큰의 값이다. 못 찾으면 null.

- [ ] Step 1: 테스트 — 토큰 0개 · 1개 · 여러 개 · 수치 있음/없음 · 중첩 대괄호
- [ ] Step 2–5: 실패 확인 → 구현 → 통과 → 커밋

---

## Task 3: 상태·어휘 변환기

**Files:** `src/v2/canonical/statuses.ts` · `.test.ts`

### 판정 규칙

| 필드 | 규칙 |
| --- | --- |
| `status` 본체 | assets 단독 (1,472) |
| 표시명 ko/ja | **`Bufs` 우선 · `BattleKeywords` 폴백 · `terms.json` 최종 폴백** |
| 표시명 en | assets `name` 정본 |
| `buffType` · `sprite` · `categoryKeywordList` | assets 단독 |
| 죄악 | mj `sins.json` 단독 |
| 어휘 | mj `terms.json` 단독 |

- [ ] Step 1–5

---

## Task 4: 미룬 연결 잇기

**Files:** `src/v2/canonical/identities.ts` · `egos.ts` (연결만 추가)

- [ ] `Identity.statuses` ← assets `statuses` 1,179연결
- [ ] `Ego.statuses` ← assets `statuses` 475연결
- [ ] 둘 다 100 % 걸리므로 결손이 나오면 검증이 잡는다

---

## Task 5: 적재기·검증 확장

- [ ] 적재 순서 — `status` → `sin_info` → `term` → 연결 → `coin_token`
- [ ] 실측 행 수를 검증에 박는다
- [ ] 판정 검사
      ```
      status 1,472 · buffType 분포 678/416/378
      한국어 결손 245건
      coin_token kind 분포 status 189종 · timing 26종
      ego_status 475 · identity_status 1,179 · 결손 0
      ```
- [ ] 전체 회귀

---

## 완료 판정 — **전부 통과 (2026-07-31)**

```
1. status 1,472 · 한국어 결손 245건 특정         ✔ 마스터북과 정확히 일치
2. coin_token 26,942 · 189종이 status FK        ✔ 그래프 투영 준비 완료
3. 계획 3·5에서 미룬 상태 연결이 이어졌다          ✔ 결손 0
4. 계획 1–5 가 안 깨졌다                        ✔ 검사 109건 · 테스트 248건
```

### 실행 결과

```
status 1,472 · status_text 3,913 · status_category 163
sin_info 7 · sin_text 14 · term 483 · term_text 966
coin_token 26,942 · identity_status 1,179 · ego_status 475
field_gap 589 (상태 ja 258 · 상태 ko 245 · 나머지 86)
```

### **스펙 6절이 여기서 완성됐다**

```
코인 토큰 26,942건
  kind='status'  14,389건 · 189종   → status 로 FK 전건 성립
  kind='timing'  12,553건 ·  26종
  amount 있음     8,452건

남는 것이 없다. 정확히 둘로 갈린다.
```

이제 Neo4j 투영이 덤프 한 번이다.

```
(Skill)-[:INFLICTS {amount}]->(Status)   coin_token WHERE kind='status'
(Skill)-[:TIMED_AT]->(Timing)            coin_token WHERE kind='timing'
(Gift)-[:TRIGGERS_ON]->(Trigger)         gift_trigger
(Gift)-[:PRODUCES]->(Effect)             gift_effect
(Identity)-[:USES]->(Status)             identity_status
(Ego)-[:USES]->(Status)                  ego_status
```

### 계획과 달라진 것

**일본어 결손 258건을 예상하지 못했다.** 한국어 245는 마스터북이 실측한 값이라
계획에 박았지만 일본어는 세지 않았다. 한국어보다 13건 많다.

`status_category` 163 — 계획에 116으로 적은 것은 **필드를 가진 상태 수**였다.
연결 수는 163이다(유일 24종).
