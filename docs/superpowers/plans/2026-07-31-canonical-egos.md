# canonical E.G.O 계열 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** E.G.O 115종(플레이 110 + 연출 전용 5)과 각성·침식 스킬 215, 패시브 113, 죄악 7축 저항, 침식 확률표, 색 토큰 요구를 `canonical` 에 적재한다.

**Architecture:** 계획 2–4의 `source.ts` · `meta.ts` 를 그대로 쓴다. 변환기는 `canonical/egos.ts` 하나. E.G.O 스킬은 인격 스킬과 **구조가 달라**(`coinlist.coindescs`) 별도 테이블을 쓴다.

## Global Constraints

- **현행 파일 수정 금지** · **계획 1–4 산출물은 고치지 않는다**(스키마에는 더하기만)
- 신규 스키마는 `@@map`/`@map` snake_case · 변환기는 `raw.*` 만 질의
- 스키마 변경 후 `npm run v2:generate` → 타입 검사
- 커밋 메시지 한국어

### 선행 조건

```bash
npm run v2:verify              # 13건
npm run v2:verify:canonical    # 76건
```

---

## 실측 기준값

### 출처 규모

```
limbus-data-mj/egos.json          110  키 12종
limbus-data-mj/egos_detail.json   110  키 7종
limbus-assets/egos.json           110  키 12종   ← 정본 (ADR-04)
limbus-assets/egos_mini.json      110  키 7종
loc-{ko,en,ja}  각 22파일  Egos 115 · Passive_Ego 114 · Skills_Ego 216
```

### **loc 가 mj 보다 넓다** — 이 계획의 핵심 발견 둘

**① 연출 전용 E.G.O 5건**

```
201011 오감도            "이상 연출 전용 EGO 장비"
203011 라 샹그레 데 산쵸   "돈키호테 연출 전용 EGO 장비"
205011 타인의 사슬        "뫼르소 연출 전용 EGO 장비"
206011 허환경            "홍루 연출 전용 EGO 장비"
211011 토 파토스 마토스    "오티스 연출 전용 EGO 장비"

전부 Egos-a1c9p3.json (9장 3막) · id 는 기본 E.G.O id + "1"
플레이 불가한 컷신 전용 개체다. 구조 필드가 전혀 없다
```

**② 두 번째 각성 스킬 2건 — mj 가 표현하지 못한다**

```
mj egos_detail.awakeningSkill 은 값이 하나뿐이다

2060812  오혈읍루 - 종[終]              base 20608 (mj awakeningSkill=2060811)
2120912  눈부시지 않은 영광 - 광휘(光輝)   base 21209 (mj awakeningSkill=2120911)
```

마스터북 E.G.O 편이 「`20608`·`21209` 의 두 번째 각성 스킬을 mj 가 못 담는다」고
적은 그것이다. **loc 를 봐야만 얻는다.**

`loc Skills_Ego` 전용 7건 = 연출 전용 5 + 두 번째 각성 2.

### E.G.O 스킬은 인격 스킬과 구조가 다르다

```
인격   levels[].coins[]                     문자열 배열
E.G.O  levelList[].coinlist[].coindescs[]   {desc} 객체 배열

levelList 길이 분포   3:183 · 2:23 · 4:4 · 1:5
level 값 분포        1:210 · 3:210 · 4:190 · 5:6
```

동기화 단계가 인격(1–5)과 다르다 — **1·3·4 가 주력이고 2·5 는 드물다.**
전량 전개하지 않고 **원본 단계를 그대로** 담는다. 인격 스킬과 달리 델타가 아니라
실제로 그 단계만 존재한다.

### 저항 — 죄악 7축 + 로보토미 유산 2축

```
mj attributeResists   wrath lust sloth gluttony gloom pride envy  +  white black
assets resists        죄악 7축만
```

`white`/`black` 은 **전작 로보토미 코퍼레이션의 개념이며 현재 게임에 없다**
(마스터북 게임 확인). 죄악 7축만 `ego_resist` 에 담고, 둘은 `tool_annotation` 에
`legacyResist` 로 보관한다 — 버리지 않되 게임 사실과 섞지 않는다.

### 그 밖의 실측

```
rank        ZAYIN 20 · TETH 32 · HE 40 · WAW 18        (ALEPH 없음)
corrosion   110 × 3 = 330행   {section, probability}
requirements 314행            {attributeType(색), num}
statuses    연결 475 · 유일 137                        ← 계획 6으로 미룸
maxThreadspin  3건 (20102 · 20402 · 20902) 값 5        환상 해석
extractable 28건                                       게임 확인으로 값 일치 확인됨
nameKo      108/110  ← 2건 결손
```

> **`corrosion.section` 은 백분율이 아니다.** SP [-45,+45] 를 [0,1] 로 정규화한
> 위치다(0.5 = SP 0). 마스터북이 처음 백분율로 오독했다가 게임 카드로 정정했다.
> 값을 그대로 담고 뜻은 주석에 남긴다.

### 적재 행 수 — 검증이 이 숫자를 검사한다

```
ego               115   플레이 110 + 연출 전용 5
ego_text          345   115 × 3로케일
ego_resist        770   110 × 7축 (연출 전용은 없다)
ego_cost      (실측)    resourceCost 죄악별
ego_corrosion     330   110 × 3
ego_requirement   314
ego_skill     (실측)    각성 + 침식 + 두 번째 각성
ego_skill_stage (실측)
ego_skill_stage_text (실측)
ego_skill_coin  (실측)
ego_passive       113
ego_passive_text  339   113 × 3
```

> 괄호는 Task 3에서 실측해 검증에 박는다. 계획 4에서 추정치를 박았다가 셋 다
> 틀린 경험을 반영했다.

---

## 이 계획에서 담지 않는 것

| 원본 | 왜 미룸 |
| --- | --- |
| assets `statuses` 475연결 · 137유일 | `Status` 테이블이 없다 → **계획 6** |
| `ego_voicelines.json` | 음성 대사. 게임 데이터지만 우리 범위 밖 |
| `ego_header_offsets.json` | 표시 도메인 |
| 코인 효과 토큰화 | **계획 6** |

---

## Task 1: E.G.O 모델

**Files:** `prisma/v2/schema.prisma` · `prisma/v2/schema.sql`

- [ ] **Step 1: 모델을 더한다**

```prisma
// ─────────────────────────────────────────────────────────────
// canonical — E.G.O
// ─────────────────────────────────────────────────────────────

/// E.G.O 등급. 게임 표기는 세피로트 이름이다.
enum EgoRank {
  ZAYIN
  TETH
  HE
  WAW
  ALEPH

  @@schema("canonical")
}

/// E.G.O 115종.
///
/// 정본은 limbus-assets 다(ADR-04) — 인격과 뒤집힌다. 다만 loc 가 두 가지를
/// 더 안다: 연출 전용 개체 5건과 두 번째 각성 스킬 2건.
model Ego {
  id            String   @id
  sinnerId      Int      @map("sinner_id")
  rank          EgoRank?
  /// 각성 시 공격 죄악
  sin           Sin?
  attackType    AtkType? @map("attack_type")
  season        Int?
  releaseDate   String?  @map("release_date")
  /// 환상 해석 최대 단계. 실측 3건만 값이 있다
  maxThreadspin Int?     @map("max_threadspin")
  /// 거울 던전에서 추출 가능한가. 게임 확인으로 값이 맞음을 밝혔다
  extractable   Boolean  @default(false)
  /// 컷신 전용이라 플레이할 수 없다. loc 에만 있는 5건
  presentationOnly Boolean @default(false) @map("presentation_only")

  sinner       Sinner           @relation(fields: [sinnerId], references: [id])
  texts        EgoText[]
  resists      EgoResist[]
  costs        EgoCost[]
  corrosions   EgoCorrosion[]
  requirements EgoRequirement[]
  skills       EgoSkill[]
  passives     EgoPassiveLink[]

  @@index([sinnerId])
  @@index([rank])
  @@map("ego")
  @@schema("canonical")
}

model EgoText {
  egoId  String  @map("ego_id")
  locale Locale
  name   String
  desc   String?

  ego Ego @relation(fields: [egoId], references: [id], onDelete: Cascade)

  @@id([egoId, locale])
  @@map("ego_text")
  @@schema("canonical")
}

/// 죄악 7축 저항. 인격은 물리 3축이라 축이 다르다.
///
/// mj 는 white·black 2축을 더 갖지만 **전작 로보토미의 개념이고 현재 게임에
/// 없다**(마스터북 게임 확인). 그 둘은 tool_annotation 에 legacyResist 로 남긴다.
model EgoResist {
  egoId String @map("ego_id")
  sin   Sin
  value Float

  ego Ego @relation(fields: [egoId], references: [id], onDelete: Cascade)

  @@id([egoId, sin])
  @@map("ego_resist")
  @@schema("canonical")
}

/// 사용 자원. 죄악별 개수다.
model EgoCost {
  egoId String @map("ego_id")
  sin   Sin
  count Int

  ego Ego @relation(fields: [egoId], references: [id], onDelete: Cascade)

  @@id([egoId, sin])
  @@map("ego_cost")
  @@schema("canonical")
}

/// 침식 확률표.
///
/// **section 은 백분율이 아니다.** 정신력 [-45, +45] 를 [0, 1] 로 정규화한
/// 위치다 — 0.5 가 SP 0 이고, 그때 침식 확률이 25 % 다. 마스터북이 처음
/// 백분율로 오독했다가 게임 카드로 정정했다.
model EgoCorrosion {
  egoId       String @map("ego_id")
  index       Int
  section     Float
  probability Float

  ego Ego @relation(fields: [egoId], references: [id], onDelete: Cascade)

  @@id([egoId, index])
  @@map("ego_corrosion")
  @@schema("canonical")
}

/// 사용 조건. 색 토큰을 몇 개 요구하는가.
model EgoRequirement {
  egoId         String @map("ego_id")
  /// CRIMSON · SCARLET · AMBER · SHAMROCK · AZURE · INDIGO · VIOLET
  attributeType String @map("attribute_type")
  num           Int

  ego Ego @relation(fields: [egoId], references: [id], onDelete: Cascade)

  @@id([egoId, attributeType])
  @@map("ego_requirement")
  @@schema("canonical")
}

/// E.G.O 스킬. 인격 스킬과 **구조가 다르다** —
/// 원본이 levelList[].coinlist[].coindescs[] 이고 단계가 델타가 아니다.
/// 있는 단계만 담는다(실측 1·3·4 가 주력).
model EgoSkill {
  id    String @id
  egoId String @map("ego_id")
  /// awakening · corrosion
  role  String
  /// 같은 역할 안의 순서. 두 번째 각성 스킬이 실측 2건 있다
  ordinal Int  @default(0)

  ego    Ego              @relation(fields: [egoId], references: [id], onDelete: Cascade)
  stages EgoSkillStage[]

  @@index([egoId])
  @@map("ego_skill")
  @@schema("canonical")
}

model EgoSkillStage {
  skillId String @map("skill_id")
  uptie   Int

  skill EgoSkill            @relation(fields: [skillId], references: [id], onDelete: Cascade)
  texts EgoSkillStageText[]
  coins EgoSkillCoin[]

  @@id([skillId, uptie])
  @@map("ego_skill_stage")
  @@schema("canonical")
}

model EgoSkillStageText {
  skillId String  @map("skill_id")
  uptie   Int
  locale  Locale
  name    String
  desc    String?
  /// 유래 환상체. loc 단독 개념이다
  abName  String? @map("ab_name")

  stage EgoSkillStage @relation(fields: [skillId, uptie], references: [skillId, uptie], onDelete: Cascade)

  @@id([skillId, uptie, locale])
  @@map("ego_skill_stage_text")
  @@schema("canonical")
}

/// 코인 효과. loc 이 로케일별로 갖는다.
model EgoSkillCoin {
  skillId String @map("skill_id")
  uptie   Int
  index   Int
  locale  Locale
  effects String[]

  stage EgoSkillStage @relation(fields: [skillId, uptie], references: [skillId, uptie], onDelete: Cascade)

  @@id([skillId, uptie, index, locale])
  @@map("ego_skill_coin")
  @@schema("canonical")
}

/// E.G.O 패시브 113종. mj·assets·loc 3중 일치를 마스터북이 확인했다(순서까지).
model EgoPassive {
  id String @id

  texts EgoPassiveText[]
  egos  EgoPassiveLink[]

  @@map("ego_passive")
  @@schema("canonical")
}

model EgoPassiveText {
  passiveId String  @map("passive_id")
  locale    Locale
  name      String
  desc      String?

  passive EgoPassive @relation(fields: [passiveId], references: [id], onDelete: Cascade)

  @@id([passiveId, locale])
  @@map("ego_passive_text")
  @@schema("canonical")
}

model EgoPassiveLink {
  egoId     String @map("ego_id")
  passiveId String @map("passive_id")

  ego     Ego        @relation(fields: [egoId], references: [id], onDelete: Cascade)
  passive EgoPassive @relation(fields: [passiveId], references: [id], onDelete: Cascade)

  @@id([egoId, passiveId])
  @@index([passiveId])
  @@map("ego_passive_link")
  @@schema("canonical")
}
```

- [ ] **Step 2: 검증하고 적용한다** — 전체 재적재 사이클
- [ ] **Step 3: 타입 검사와 커밋**

---

## Task 2: E.G.O 변환기

**Files:** `src/v2/canonical/egos.ts` · `.test.ts`

### 판정 규칙

| 필드 | 규칙 | 근거 |
| --- | --- | --- |
| `rank` | mj `rarity`(소문자) ↔ assets `rank`(대문자). 대문자로 정규화 | agreed |
| `sin` · `attackType` | mj 단독. assets 는 `awakeningType` 안에 중첩 | |
| `releaseDate` | assets `date` 단독 | |
| `maxThreadspin` · `extractable` | assets 단독 | 게임 확인 |
| 저항 | mj `attributeResists` 죄악 7축. `white`/`black` 은 격리 | 게임 확인 |
| 침식 | mj `corrosion` 단독 | 정본에 없다 |
| 색 요구 | mj `requirements` 단독 | |
| 스킬 | **mj ∪ loc** | mj 는 각성 하나만 담는다 |
| 이름·설명 | loc 정본 · mj 폴백 | `nameKo` 2건 결손 |

- [ ] Step 1–5: 테스트 → 실패 확인 → 구현 → 통과 → 커밋

---

## Task 3: 적재기·검증 확장

- [ ] 적재 순서 — `ego_passive` → `ego` → 연결
- [ ] 실측 행 수를 검증에 박는다
- [ ] 판정 검사
      ```
      ego 115 · 연출 전용 5 · 플레이 110
      rank 분포 ZAYIN 20 · TETH 32 · HE 40 · WAW 18
      저항 770 = 110 × 7축 (white/black 은 tool_annotation)
      두 번째 각성 스킬 2건 (2060812 · 2120912)
      침식 330 = 110 × 3
      ```
- [ ] 전체 회귀

---

## 완료 판정 — **전부 통과 (2026-07-31)**

```
1. ego 115 · ego_skill 215 · ego_passive 113        ✔ 검사 96건 통과
2. 두 번째 각성 스킬 7건이 담겼다                     ✔ mj 만으로는 못 얻는 것
3. 연출 전용 5건이 플래그로 갈렸다                    ✔ presentationOnly
4. white/black 이 tool_annotation 으로 격리됐다       ✔ 110건
5. 계획 1–4 가 안 깨졌다                            ✔ raw 13건 · 테스트 229건
```

### 실행 결과

```
ego 115 (플레이 110 · 연출 전용 5) · ego_text 345
ego_resist 770 (110 × 7축) · ego_cost 314 · ego_corrosion 330 · ego_requirement 314
ego_skill 215 · ego_skill_stage 616 · ego_skill_stage_text 1,848 · ego_skill_coin 2,745
ego_passive 113 · ego_passive_text 339 · ego_passive_link 113
tool_annotation(legacyResist) 110
```

### 계획과 달라진 것

**두 번째 각성 스킬이 2건이 아니라 7건이었다.**

```
2060812  오혈읍루 - 종[終]              ← 마스터북이 지목한 20608
2120912  눈부시지 않은 영광 - 광휘(光輝)   ← 마스터북이 지목한 21209
2010112 · 2030112 · 2050112 · 2060112 · 2110112   ← 연출 전용 E.G.O 5건의 스킬
```

마스터북이 둘만 지목한 것은 연출 전용 5건을 별도 개념으로 셌기 때문이다.
규칙(「E.G.O id 로 시작하는 7자리 스킬 전부」)으로 잡으면 7건이 나온다.

### 실행 중 잡은 문제 — **번호 공간 충돌이 실제로 물렸다**

로케일 파일을 id 자릿수로 갈랐더니 `ego_passive_text` 가 339 대신 **9건**만 나왔다.

```
loc Skills_Ego  215종
loc Passive_Ego 113종
교집합          110종   ← 2010111 이 각성 스킬이자 패시브다
```

마스터북이 인격 편에서 찾은 그 충돌이다. 같은 맵에 넣으면 한쪽이 다른 쪽을
덮어쓴다. `readSourceGroup` 에 **파일명 접두어 필터**를 더해 해소했다.

> **id 로 가르면 안 되는 곳이 있다.** 파일이 곧 네임스페이스다 — 계획 1에서
> `srcPath` 를 기본키에 넣은 것과 같은 이유다.
