# canonical 인격 계열 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 수감자 12 · 인격 184 · 스킬 1,045(단계 전량 전개 5,225) · 패시브 709 · 소속 64 를 `raw` 에서 읽어 판정해 `canonical` 에 적재한다. 마스터북 최대 계열이며 스킬 코인 효과 문자열 7,498개가 여기 있다.

**Architecture:** 계획 2·3의 `source.ts` · `meta.ts` · `vocab.ts` 를 그대로 쓴다. 변환기를 셋으로 가른다 — `sinners.ts`(수감자·소속) · `skills.ts`(스킬·단계·코인) · `identities.ts`(인격·저항·연결). 스킬이 가장 크고 독립적이라 따로 둔다.

**Tech Stack:** 계획 1–3과 동일

## Global Constraints

- **현행 파일 수정 금지** · **계획 1–3 산출물은 고치지 않는다**(`prisma/v2/schema.prisma` 에는 더하기만)
- 신규 스키마의 모든 테이블·컬럼은 `@@map`/`@map` 으로 snake_case
- 변환기는 `raw.*` 만 질의한다
- 스키마를 고치면 `npm run v2:generate` 후 타입 검사
- 커밋 메시지는 한국어

### 선행 조건

```bash
npm run v2:verify              # 13건
npm run v2:verify:canonical    # 50건
```

---

## 실측 기준값

### 출처 규모

```
limbus-data-mj/identities.json         184   키 23종
limbus-data-mj/identities_detail.json  184   키 16종
limbus-data-mj/skills.json           1,045   키 6종 (levels 안에 coins)
limbus-data-mj/passives.json           709   키 6종
limbus-data-mj/associations.json        64   dict[코드 → {name, nameKo}]
limbus-assets/identities.json          184   키 17종   ← 수치의 정본
loc-{ko,en,ja}  각 2,203항목

교집합 184 · mj만 0 · assets만 0     ← 인격은 두 출처가 완전히 같은 집합이다
```

### 수감자 12

```
sinnerId 1–12 · 인격 수 14–16개씩
star = 1 인 인격 12개가 각 수감자의 LCB 기본 인격이다
  10101 이상 · 10201 파우스트 · 10301 돈키호테 · 10401 료슈 …
수감자 이름은 그 인격의 name/nameKo 에서 온다
```

> 마스터북 인격 편 오버뷰가 처음 `3=료슈 · 4=돈키호테` 로 적었다가 E.G.O 편
> 회차 1에서 **3=돈키호테 · 4=료슈** 로 정정했다. 실측이 정정본과 맞는다.

### 스킬 — 단계 전량 전개

```
skills.json 1,045
  levels 델타 행           2,561
  level 값 분포            1:815 · 2:388 · 3:435 · 4:917 · 5:6
  coins 행 (델타 기준)      5,157
  코인 효과 문자열           7,498

전량 전개 시   skill_stage 1,045 × 5 = 5,225
              changedHere 로 원본 델타 정보를 보존한다(스펙 3.3)
```

### 패시브 709

```
값 있는 키   id 709 · name 703 · nameKo 703 · desc 703 · descKo 703 · cost 599

이름이 전부 null 인 6건이 마스터북의 「유령」이다.
  1011003 · 1021202 · 1031102 · 1050803 · 1051102 · 1100903
  회차 4·10·13 세 번 확인 — 어느 층에서도 패시브가 아니다
  → 적재하되 field_gap 에 남긴다
```

### 연결 실측

```
identity_skill        1,020   attackSkills + defenseSkills + panicSkill
identity_passive        556   battlePassives + supporterPassives
identity_association    241
identity_keyword        266   mj keywords (기믹 축)
identity_unit_keyword   391   detail unitKeywords (특성 키워드)
```

### 축이 다르다 — 저항 3축

```
인격 저항   slash · pierce · blunt        3축
E.G.O 저항  죄악 7축                      (계획 5)
적 저항     10축 + 부위별                 (계획 7)
```

마스터북 `docs/09-resistance.md` 가 이 두 축을 다룬다.

### 적재 행 수 — 검증이 이 숫자를 검사한다

```
sinner                   12
sinner_text              36   12 × 3로케일
association              64
association_text        192   64 × 3
identity                184
identity_text           552   184 × 3
identity_resist         552   184 × 3축
identity_speed          184
skill                 1,045
skill_stage           5,225   전량 전개
skill_stage_text     15,675   5,225 × 3
skill_coin           (실측 필요 — 전개 후)
skill_coin_text      (실측 필요)
passive                 709
passive_text          2,127   709 × 3
identity_skill        1,020
identity_passive        556
identity_association    241
identity_keyword        266
identity_unit_keyword   391
```

> `skill_coin` 은 전량 전개 후 수가 정해진다. Task 3에서 실측해 검증에 박는다.

---

## File Structure

| 파일 | 책임 |
| --- | --- |
| `prisma/v2/schema.prisma` | 인격 계열 모델 **추가** |
| `src/v2/canonical/sinners.ts` · `.test.ts` | 수감자 · 소속 |
| `src/v2/canonical/skills.ts` · `.test.ts` | 스킬 · 단계 전량 전개 · 코인 |
| `src/v2/canonical/identities.ts` · `.test.ts` | 인격 · 저항 · 속도 · 연결 |
| `src/v2/load-canonical.ts` | 적재 **추가** |
| `src/v2/verify-canonical.ts` | 검증 **추가** |

---

## 이 계획에서 담지 않는 것

| 원본 | 왜 미룸 |
| --- | --- |
| `identity-details/{id}.json` 184파일 | 마스터북 회차 10 이 「기존 파일의 재구성」으로 판정. 새 개념 없음 |
| `mentalCondition` | 중첩이 깊고 마스터북이 구조를 확정하지 않았다 → `tool_annotation` 보류 |
| `appearance` · `identity_header_offsets` · `alt_names` | 표시·도구 도메인 |
| 코인 효과 토큰화 (215종) | **계획 6**. 상태 어휘와 함께 푼다 |

---

## Task 1: 인격 계열 모델

**Files:** `prisma/v2/schema.prisma` · `prisma/v2/schema.sql`

- [ ] **Step 1: 모델을 더한다**

```prisma
// ─────────────────────────────────────────────────────────────
// canonical — 수감자 · 소속
// ─────────────────────────────────────────────────────────────

/// 수감자 12명. star=1 인 LCB 기본 인격에서 이름을 얻는다.
model Sinner {
  id Int @id

  texts      SinnerText[]
  identities Identity[]

  @@map("sinner")
  @@schema("canonical")
}

model SinnerText {
  sinnerId Int    @map("sinner_id")
  locale   Locale
  name     String

  sinner Sinner @relation(fields: [sinnerId], references: [id], onDelete: Cascade)

  @@id([sinnerId, locale])
  @@map("sinner_text")
  @@schema("canonical")
}

/// 소속. mj associations.json 64종이 유일 출처다.
/// id 는 영문 코드(LIMBUS_COMPANY)이며 표시명이 따로 온다.
model Association {
  id String @id

  texts      AssociationText[]
  identities IdentityAssociation[]

  @@map("association")
  @@schema("canonical")
}

model AssociationText {
  associationId String @map("association_id")
  locale        Locale
  name          String

  association Association @relation(fields: [associationId], references: [id], onDelete: Cascade)

  @@id([associationId, locale])
  @@map("association_text")
  @@schema("canonical")
}

// ─────────────────────────────────────────────────────────────
// canonical — 스킬
// ─────────────────────────────────────────────────────────────

/// 공격 타입 3종
enum AtkType {
  slash
  pierce
  blunt

  @@schema("canonical")
}

/// 방어 스킬 종류
enum DefType {
  guard
  evade
  counter

  @@schema("canonical")
}

/// 스킬 1,045종. mj skills.json 이 유일 출처다.
model Skill {
  id         String   @id
  sin        Sin?
  attackType AtkType? @map("attack_type")
  defType    DefType? @map("def_type")
  skillTier  Int?     @map("skill_tier")

  stages     SkillStage[]
  identities IdentitySkill[]

  @@map("skill")
  @@schema("canonical")
}

/// 동기화 단계 1–5. **전량 전개**한다 — 값이 안 바뀐 단계도 앞 단계를 복사해 채운다.
/// changedHere 가 원본 델타 정보를 보존하므로 충실성을 잃지 않는다(스펙 3.3).
model SkillStage {
  skillId     String  @map("skill_id")
  uptie       Int
  /// 원본 델타가 이 단계에 있었나. false 면 앞 단계 복사본이다
  changedHere Boolean @map("changed_here")

  skill Skill             @relation(fields: [skillId], references: [id], onDelete: Cascade)
  texts SkillStageText[]
  coins SkillCoin[]

  @@id([skillId, uptie])
  @@map("skill_stage")
  @@schema("canonical")
}

model SkillStageText {
  skillId String  @map("skill_id")
  uptie   Int
  locale  Locale
  name    String
  desc    String?

  stage SkillStage @relation(fields: [skillId, uptie], references: [skillId, uptie], onDelete: Cascade)

  @@id([skillId, uptie, locale])
  @@map("skill_stage_text")
  @@schema("canonical")
}

/// 코인. 효과 문자열은 원문 그대로 담는다.
/// 대괄호 토큰(215종) 분해는 계획 6에서 상태 어휘와 함께 한다.
model SkillCoin {
  skillId String @map("skill_id")
  uptie   Int
  index   Int
  /// 코인 효과 문자열. 여러 줄일 수 있어 배열로 담는다
  effects String[]

  stage SkillStage @relation(fields: [skillId, uptie], references: [skillId, uptie], onDelete: Cascade)

  @@id([skillId, uptie, index])
  @@map("skill_coin")
  @@schema("canonical")
}

// ─────────────────────────────────────────────────────────────
// canonical — 패시브
// ─────────────────────────────────────────────────────────────

/// 패시브 709종. 이름이 전부 null 인 6건은 마스터북의 「유령」이며
/// 어느 층에서도 패시브가 아니다(회차 4·10·13 세 번 확인).
model Passive {
  id   String @id
  cost Int?

  texts      PassiveText[]
  identities IdentityPassive[]

  @@map("passive")
  @@schema("canonical")
}

model PassiveText {
  passiveId String  @map("passive_id")
  locale    Locale
  name      String
  desc      String?

  passive Passive @relation(fields: [passiveId], references: [id], onDelete: Cascade)

  @@id([passiveId, locale])
  @@map("passive_text")
  @@schema("canonical")
}

// ─────────────────────────────────────────────────────────────
// canonical — 인격
// ─────────────────────────────────────────────────────────────

model Identity {
  id               String  @id
  sinnerId         Int     @map("sinner_id")
  /// 등급 1–3
  star             Int
  /// 편성 코드에 넣을 수 있나
  teamCodeEligible Boolean @default(true) @map("team_code_eligible")
  /// 원본 시즌 정수. 8000 은 명일방주 콜라보다(backlog/11)
  season           Int?
  hp               Int?
  stagger          Int?
  defCorrection    Int?    @map("def_correction")
  /// 출시일. assets date
  releaseDate      String? @map("release_date")

  sinner       Sinner                @relation(fields: [sinnerId], references: [id])
  texts        IdentityText[]
  resists      IdentityResist[]
  speed        IdentitySpeed?
  skills       IdentitySkill[]
  passives     IdentityPassive[]
  associations IdentityAssociation[]
  keywords     IdentityKeyword[]
  unitKeywords IdentityUnitKeyword[]

  @@index([sinnerId])
  @@index([star])
  @@map("identity")
  @@schema("canonical")
}

model IdentityText {
  identityId String  @map("identity_id")
  locale     Locale
  /// 인격명. "죄와 벌"
  name       String
  /// 수감자 칭호. "LCB 수감자"
  title      String?

  identity Identity @relation(fields: [identityId], references: [id], onDelete: Cascade)

  @@id([identityId, locale])
  @@map("identity_text")
  @@schema("canonical")
}

/// 물리 저항 3축. E.G.O 는 죄악 7축, 적은 10축이라 축이 다르다.
model IdentityResist {
  identityId String  @map("identity_id")
  atkType    AtkType @map("atk_type")
  value      Float

  identity Identity @relation(fields: [identityId], references: [id], onDelete: Cascade)

  @@id([identityId, atkType])
  @@map("identity_resist")
  @@schema("canonical")
}

model IdentitySpeed {
  identityId String @map("identity_id")
  min        Int
  max        Int

  identity Identity @relation(fields: [identityId], references: [id], onDelete: Cascade)

  @@id([identityId])
  @@map("identity_speed")
  @@schema("canonical")
}

/// 인격이 쓰는 스킬. slot 이 자리를 가른다.
model IdentitySkill {
  identityId String @map("identity_id")
  skillId    String @map("skill_id")
  /// attack · defense · panic
  role       String
  /// 같은 역할 안에서의 순서
  ordinal    Int

  identity Identity @relation(fields: [identityId], references: [id], onDelete: Cascade)
  skill    Skill    @relation(fields: [skillId], references: [id], onDelete: Cascade)

  @@id([identityId, skillId, role])
  @@index([skillId])
  @@map("identity_skill")
  @@schema("canonical")
}

model IdentityPassive {
  identityId String @map("identity_id")
  passiveId  String @map("passive_id")
  /// battle · supporter
  role       String

  identity Identity @relation(fields: [identityId], references: [id], onDelete: Cascade)
  passive  Passive  @relation(fields: [passiveId], references: [id], onDelete: Cascade)

  @@id([identityId, passiveId, role])
  @@index([passiveId])
  @@map("identity_passive")
  @@schema("canonical")
}

model IdentityAssociation {
  identityId    String @map("identity_id")
  associationId String @map("association_id")

  identity    Identity    @relation(fields: [identityId], references: [id], onDelete: Cascade)
  association Association @relation(fields: [associationId], references: [id], onDelete: Cascade)

  @@id([identityId, associationId])
  @@index([associationId])
  @@map("identity_association")
  @@schema("canonical")
}

/// 기믹 축. mj keywords 이며 기프트 keyword 와 같은 어휘를 쓴다.
model IdentityKeyword {
  identityId String @map("identity_id")
  keywordId  String @map("keyword_id")
  /// 이 기믹을 쓰는 스킬 번호들
  skillSlots Int[]  @map("skill_slots")

  identity Identity @relation(fields: [identityId], references: [id], onDelete: Cascade)

  @@id([identityId, keywordId])
  @@map("identity_keyword")
  @@schema("canonical")
}

/// 특성 키워드. detail unitKeywords 이며 소속과 다른 축이다(backlog/01).
model IdentityUnitKeyword {
  identityId String @map("identity_id")
  keyword    String

  identity Identity @relation(fields: [identityId], references: [id], onDelete: Cascade)

  @@id([identityId, keyword])
  @@map("identity_unit_keyword")
  @@schema("canonical")
}
```

- [ ] **Step 2: 검증하고 적용한다**

```bash
npm run v2:schema:validate && npm run v2:schema:ddl && npm run v2:generate
npm run db:ddl -- -c "DROP SCHEMA IF EXISTS canonical CASCADE; DROP SCHEMA IF EXISTS raw CASCADE"
npm run db:ddl < prisma/v2/schema.sql
npm run v2:load && npm run v2:canonical
npm run v2:verify && npm run v2:verify:canonical
```
Expected: raw 13건 · canonical 50건 통과

- [ ] **Step 3: 타입 검사와 커밋**

---

## Task 2: 수감자·소속 변환기

**Files:** `src/v2/canonical/sinners.ts` · `.test.ts`

**Interfaces:**
- Produces: `buildSinners(input, meta): { sinner; sinnerText; association; associationText }`
  · `SinnerInput { mjIdentities; associations; locKo; locEn; locJa; assocNameKo/En/Ja }`

### 판정 규칙

| 필드 | 규칙 |
| --- | --- |
| 수감자 id | mj `sinnerId` 1–12 |
| 수감자 이름 | `star=1` 인격의 `nameKo`/`name`. loc 은 인격명이라 못 쓴다 |
| 소속 id | mj `associations.json` 키 (영문 코드) |
| 소속 표시명 | mj `name`/`nameKo` 정본. `ja` 는 `UnitKeyword` 계열에서 |

- [ ] Step 1–5: 테스트 → 실패 확인 → 구현 → 통과 → 커밋

---

## Task 3: 스킬 변환기 — 단계 전량 전개

**Files:** `src/v2/canonical/skills.ts` · `.test.ts`

**Interfaces:**
- Produces: `buildSkills(input, meta): { skill; skillStage; skillStageText; skillCoin }`
  · `function expandStages(levels: unknown[]): Array<{ uptie; changedHere; source }>` — 델타를 1–5로 편다

### 전량 전개 규칙

```
원본 levels     [{level:1,…}, {level:2,…}, {level:3,…}]
전개 결과       uptie 1  changedHere true   ← level 1 원본
               uptie 2  changedHere true   ← level 2 원본
               uptie 3  changedHere true   ← level 3 원본
               uptie 4  changedHere false  ← level 3 복사
               uptie 5  changedHere false  ← level 3 복사
```

**요청 단계 이하 중 가장 큰 원본**을 쓴다. `levels` 가 비면 단계를 만들지 않는다
(실측 9건).

- [ ] Step 1: `expandStages` 테스트 — 델타 4종(빈 배열 · 1단계만 · 중간 결손 · 전량)
- [ ] Step 2–5: 실패 확인 → 구현 → 통과 → **`skill_coin` 실측값을 검증에 박는다** → 커밋

---

## Task 4: 인격 변환기

**Files:** `src/v2/canonical/identities.ts` · `.test.ts`

**Interfaces:**
- Produces: `buildIdentities(input, meta): { identity; identityText; identityResist; identitySpeed; identitySkill; identityPassive; identityAssociation; identityKeyword; identityUnitKeyword; passive; passiveText }`

### 판정 규칙

| 필드 | 규칙 | 근거 |
| --- | --- | --- |
| `hp` · `stagger` · `defCorrection` | **assets 정본** | 수치는 assets 가 넓다 |
| `resists` | agreed 대조 | mj·assets 둘 다 3축 |
| `speed` | mj `speed: [min, max]` | detail 의 `minSpeed`/`maxSpeed` 와 대조 |
| `star` · `sinnerId` · `season` | mj 단독 | |
| `releaseDate` | assets `date` 단독 | |
| 이름·칭호 | **loc 정본 · mj 폴백** | `Personalities` 가 `nameWithTitle` 까지 갖는다 |
| 패시브 이름 | mj 정본 · loc 보강 | loc 이 강화판(`11`·`31`)을 안 담는다 |

- [ ] Step 1–5: 테스트 → 실패 확인 → 구현 → 통과 → 커밋

---

## Task 5: 적재기 확장

- [ ] 적재 순서 — `sinner` → `association` → `skill` → `passive` → `identity` → 연결 6종
- [ ] `TRUNCATE` 목록에 새 뿌리 테이블을 더한다
- [ ] 행 수 확인

---

## Task 6: 검증 확장

- [ ] 행 수 20종
- [ ] **마스터북 완전 일치 쌍 재현** — 인격 `iconId` ↔ 애셋 966/966 은 애셋 계열이라 미룸.
      대신 다음을 검사한다.
      ```
      수감자 12 · 각 수감자의 인격 수 14–16
      star=1 인격이 정확히 12개
      스킬 단계가 전부 5개 (levels 있는 스킬 기준)
      유령 패시브 6건이 field_gap 에 남았다
      저항 3축이 전 인격에 있다 (552행)
      ```
- [ ] 전체 회귀

---

## 완료 판정

```
1. canonical.identity 184 · skill 1,045 · passive 709 · sinner 12
2. skill_stage 5,225 (전량 전개) · changedHere 로 델타 보존
3. 유령 패시브 6건이 field_gap 에 특정됐다
4. 계획 1–3 이 안 깨졌다
5. 현행이 그대로 돈다
```
