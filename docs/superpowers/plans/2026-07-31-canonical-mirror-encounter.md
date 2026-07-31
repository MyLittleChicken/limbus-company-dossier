# canonical 거울 던전·인카운터 계열 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 지금 **통째로 버려지는 것들**을 담는다 — 선택지 이벤트 159 · 업적 183 · 층별 보상 200 · 역경 5 · 은총 10 · 시작 기프트 풀 10 · 인카운터 251 · 적 1,342. 계획 7은 신규 테이블이 가장 많다.

**Architecture:** 계획 2–6의 뼈대를 그대로 쓴다. 변환기 둘 — `canonical/mirror.ts`(거울 던전 구성)와 `canonical/encounters.ts`(인카운터·적). 팩 계열에서 미룬 `bossEncounters` 75 와 `eventPool` 도 여기서 이어진다.

## Global Constraints

- **현행 파일 수정 금지** · **계획 1–6 산출물은 고치지 않는다**(스키마에는 더하기만)
- 예외 — `canonical/packs.ts` 에 `bossEncounters` · `eventPool` 연결만 더한다
- 신규 스키마는 `@@map`/`@map` snake_case · 변환기는 `raw.*` 만 질의
- 커밋 메시지 한국어

### 선행 조건

```bash
npm run v2:verify              # 13건
npm run v2:verify:canonical    # 109건
```

---

## 실측 기준값

### 거울 던전 구성 (`limbus-assets`)

```
md_choice_events.json    159  키 8종 — desc · gifts 156 · messages · name 139
                              options · type · advantages 112 · illustId 1
md__achievements.json      9범주  Collection 25 · Loadout 19 · Combat 15
                                  Adversity-EXTREME 13 · Hidden 9 · Shop 7
                                  Clears 4 · Completionist 1 · __Season__ 1
md__md6__achievements.json 9범주  같은 구성 (시즌 판본)
md__rewards.json         100단계  {item, count}
md__md6__rewards.json    100단계
md__details.json           3키  grace 10 · startGiftPool 10 · adversity 5
```

**`md__*` 와 `md__md6__*` 는 시즌 판본이다.** 범주 구성이 같다. `season` 컬럼으로
가른다 — 마스터북이 두 파일을 합해 183·200 으로 센 것과 맞춘다.

### 선택지 이벤트 구조

```
{ desc, name, type, messages[], gifts[], advantages[],
  options: [{ message, messageDesc, result: [{ condition, results: [...] }] }] }
```

`options[].result[].results[]` 가 **3중 중첩**이다. 결과 하나가
`{target: {condition, target}, type, value}` 꼴이다.

**결과는 JSONB 로 담는다.** 마스터북이 구조를 확정하지 않았고, 종류를 세지 않은
채 정규화하면 틀린 스키마를 만든다. 선택지까지는 행으로 펴고 그 아래는 원문을
남긴다.

### 인카운터 (`limbus-assets/encounters/` 251파일)

```
키   name 251 · siteId 251 · targets 152 · waves 59 · phases 13 · battles 27

targets[]  { name, parts: [{ partId, name, hp{base,level}, defCorrection,
                             resists{10축}, speed[min,max] }] }
```

**적 저항이 10축이다** — 물리 3축(slash·pierce·blunt) + 죄악 7축. 인격 3축 ·
E.G.O 7축과 다르며 **부위마다 따로 갖는다**(마스터북 인카운터 편).

`waves` · `phases` · `battles` 는 `targets` 와 배타적인 다른 모양이다.
전부 담되 구조가 갈리는 것은 JSONB 로 둔다.

### 인카운터 그룹 (`mirror-dungeon/encounters.json`)

```
luxcavation 50 · md 79 · reflectrial 3 · rr 3 · story 113   합 248
md 표본  "canto-1-1" → "The Forgotten"
```

팩 `bossEncounters` 가 `md|canto-1-1` 꼴로 가리키는 그 이름표다.

### 적 표시명 (`loc-*/Enemies*.json`)

```
각 43파일 · 1,342항목 · 키 id · name · desc
표본  8605 "굴절된 어느 날의 초상" desc="본체"
```

> **`desc` 가 부위 이름이다** — "본체" 처럼. 적 이름과 부위가 한 항목에 있다.

### 미해결 — 전투 풀 2,525종은 여전히 못 잇는다

```
mj packs_detail 의 5개 풀   7자리 숫자 2,525종
assets encounters/*.json    UUID + "md|canto-1-1"  251개
                            ↕  연결표가 리포에 없다
```

마스터북 인카운터 편이 `data/` 전역을 훑어 **없다고 확정**했다(`backlog/10`).
이 계획도 잇지 못한다. `field_gap` 에 남긴다.

### 적재 행 수 — 실측해 검증에 박는다

```
choice_event         159      choice_option (실측)
achievement      (실측)      achievement_text (실측)
reward               200      100단계 × 2시즌
adversity              5      adversity_option (실측)
grace                 10      grace_text (실측)
start_gift_pool       10      start_gift (실측)
encounter            251      encounter_target · encounter_part (실측)
enemy_text         4,026      1,342 × 3
pack_boss_encounter   75      팩 계열에서 미룬 것
```

---

## Task 1: 거울 던전 모델

```prisma
/// 거울 던전 선택지 이벤트 159종.
model ChoiceEvent {
  id      String  @id
  type    String
  /// 삽화 id. 실측 1건만 있다
  illustId String? @map("illust_id")

  texts   ChoiceEventText[]
  options ChoiceOption[]
  gifts   ChoiceEventGift[]

  @@map("choice_event")
  @@schema("canonical")
}

model ChoiceEventText {
  eventId String @map("event_id")
  locale  Locale
  name    String?
  desc    String?

  event ChoiceEvent @relation(fields: [eventId], references: [id], onDelete: Cascade)

  @@id([eventId, locale])
  @@map("choice_event_text")
  @@schema("canonical")
}

/// 이 이벤트가 줄 수 있는 기프트.
model ChoiceEventGift {
  eventId String @map("event_id")
  giftId  String @map("gift_id")

  event ChoiceEvent @relation(fields: [eventId], references: [id], onDelete: Cascade)
  gift  Gift        @relation(fields: [giftId], references: [id], onDelete: Cascade)

  @@id([eventId, giftId])
  @@index([giftId])
  @@map("choice_event_gift")
  @@schema("canonical")
}

/// 선택지 하나.
///
/// **결과는 JSONB 로 담는다.** options[].result[].results[] 가 3중 중첩이고
/// 마스터북이 구조를 확정하지 않았다. 종류를 세지 않은 채 정규화하면 틀린
/// 스키마를 만든다 — 선택지까지 행으로 펴고 그 아래는 원문을 남긴다.
model ChoiceOption {
  eventId String @map("event_id")
  index   Int
  message String
  /// 원문 result 배열
  results Json

  event ChoiceEvent @relation(fields: [eventId], references: [id], onDelete: Cascade)
  texts ChoiceOptionText[]

  @@id([eventId, index])
  @@map("choice_option")
  @@schema("canonical")
}

model ChoiceOptionText {
  eventId String  @map("event_id")
  index   Int
  locale  Locale
  message String
  desc    String?

  option ChoiceOption @relation(fields: [eventId, index], references: [eventId, index], onDelete: Cascade)

  @@id([eventId, index, locale])
  @@map("choice_option_text")
  @@schema("canonical")
}

/// 거울 던전 업적. md__*(기본)과 md__md6__*(시즌 판본)를 season 으로 가른다.
model Achievement {
  id       String
  /// null 이 기본, 6 이 MD6 판본
  season   Int?
  category String
  /// 단계별 점수
  points   Int[]
  /// 하드 전용 여부. 단계별
  hardOnly Boolean[] @map("hard_only")

  texts AchievementText[]

  @@id([id, category])
  @@index([category])
  @@map("achievement")
  @@schema("canonical")
}

model AchievementText {
  id       String
  category String
  locale   Locale
  text     String

  achievement Achievement @relation(fields: [id, category], references: [id, category], onDelete: Cascade)

  @@id([id, category, locale])
  @@map("achievement_text")
  @@schema("canonical")
}

/// 층별 보상. 100단계 × 시즌.
model Reward {
  season Int
  level  Int
  item   String
  count  Int

  @@id([season, level])
  @@map("reward")
  @@schema("canonical")
}

/// 역경. 층 구간별 적용 효과다.
model Adversity {
  floorRange String @map("floor_range")
  index      Int
  name       String
  desc       String
  value      Int

  @@id([floorRange, index])
  @@map("adversity")
  @@schema("canonical")
}

/// 은총. 시작 시 고르는 강화 10종.
model Grace {
  id    String @id
  index Int
  cost  Int

  texts GraceText[]

  @@map("grace")
  @@schema("canonical")
}

model GraceText {
  graceId String @map("grace_id")
  locale  Locale
  name    String
  /// 단계별 설명. 중첩 배열이라 원문을 담는다
  descs   Json

  grace Grace @relation(fields: [graceId], references: [id], onDelete: Cascade)

  @@id([graceId, locale])
  @@map("grace_text")
  @@schema("canonical")
}

/// 시작 기프트 풀. 기믹 키워드별로 3개씩이다.
model StartGift {
  keywordId String @map("keyword_id")
  giftId    String @map("gift_id")

  keyword Keyword @relation(fields: [keywordId], references: [id], onDelete: Cascade)
  gift    Gift    @relation(fields: [giftId], references: [id], onDelete: Cascade)

  @@id([keywordId, giftId])
  @@index([giftId])
  @@map("start_gift")
  @@schema("canonical")
}
```

## Task 2: 인카운터 모델

```prisma
/// 전투 조우 251종. 파일 하나가 조우 하나다.
model Encounter {
  id     String @id
  /// luxcavation · md · reflectrial · rr · story
  group  String?
  name   String
  siteId String @map("site_id")
  /// targets 와 배타적인 다른 모양들. 구조가 갈려 원문을 남긴다
  waves    Json?
  phases   Json?
  battles  Json?

  targets EncounterTarget[]
  packs   PackBossEncounter[]

  @@index([group])
  @@map("encounter")
  @@schema("canonical")
}

/// 조우에 나오는 적.
model EncounterTarget {
  encounterId String @map("encounter_id")
  index       Int
  name        String

  encounter Encounter            @relation(fields: [encounterId], references: [id], onDelete: Cascade)
  parts     EncounterTargetPart[]

  @@id([encounterId, index])
  @@map("encounter_target")
  @@schema("canonical")
}

/// 적의 부위. **저항이 부위마다 따로 있고 10축이다** —
/// 물리 3축 + 죄악 7축. 인격 3축 · E.G.O 7축과 다르다.
model EncounterTargetPart {
  encounterId   String @map("encounter_id")
  targetIndex   Int    @map("target_index")
  partId        String @map("part_id")
  name          String
  hpBase        Float? @map("hp_base")
  hpLevel       Float? @map("hp_level")
  defCorrection Int?   @map("def_correction")
  speedMin      Int?   @map("speed_min")
  speedMax      Int?   @map("speed_max")

  target  EncounterTarget       @relation(fields: [encounterId, targetIndex], references: [encounterId, index], onDelete: Cascade)
  resists EncounterPartResist[]

  @@id([encounterId, targetIndex, partId])
  @@map("encounter_target_part")
  @@schema("canonical")
}

/// 부위별 저항 10축.
model EncounterPartResist {
  encounterId String @map("encounter_id")
  targetIndex Int    @map("target_index")
  partId      String @map("part_id")
  /// slash · pierce · blunt · 죄악 7종
  axis        String
  value       Float

  part EncounterTargetPart @relation(fields: [encounterId, targetIndex, partId], references: [encounterId, targetIndex, partId], onDelete: Cascade)

  @@id([encounterId, targetIndex, partId, axis])
  @@map("encounter_part_resist")
  @@schema("canonical")
}

/// 적 표시명 1,342종. loc 단독이며 desc 가 부위 이름이다.
model Enemy {
  id String @id

  texts EnemyText[]

  @@map("enemy")
  @@schema("canonical")
}

model EnemyText {
  enemyId String @map("enemy_id")
  locale  Locale
  name    String
  /// 부위 이름. "본체" 등
  part    String?

  enemy Enemy @relation(fields: [enemyId], references: [id], onDelete: Cascade)

  @@id([enemyId, locale])
  @@map("enemy_text")
  @@schema("canonical")
}
```

`Pack` 에 `bosses PackBossEncounter[]`, `Gift` 에 `choiceEvents` · `startGifts`,
`Keyword` 에 `startGifts` 를 더한다.

---

## Task 3–5

- [ ] **Task 3** 거울 던전 변환기 `canonical/mirror.ts`
- [ ] **Task 4** 인카운터 변환기 `canonical/encounters.ts`
- [ ] **Task 5** 적재기·검증 확장 · 팩 `bossEncounters` 75 연결 · 전체 회귀

---

## 완료 판정 — **전부 통과 (2026-07-31)**

```
1. 버려지던 것이 전부 담겼다                   ✔ 선택지 159 · 업적 183 · 보상 200
2. 인카운터 251 · 적 저항 10축                 ✔ 3,530행 · 축 어긋남 0
3. 팩 boss_encounter 75 가 이어졌다            ✔ 팩 계열 이월 해소
4. 전투 풀 2,525종 미해결이 기록됐다            ✔ field_gap · backlog/10 유지
5. 계획 1–6 이 안 깨졌다                       ✔ 검사 127건 · 테스트 248건
```

### 실행 결과

```
choice_event 159 · choice_option 372 · choice_event_gift 219
choice_event_text 365 · choice_option_text 866
achievement 183 · reward 200 · adversity 30 · grace 10 · start_gift 30
encounter 251 · encounter_target 397 · encounter_target_part 353
encounter_part_resist 3,530 · enemy 1,342 · enemy_text 4,026
pack_boss_encounter 75
```

**업적 183 이 마스터북 실측과 정확히 일치한다.**

### 계획과 달라진 것

**① 업적 `season` 이 키의 일부여야 했다.** 두 시즌 판본(`md__*` · `md__md6__*`)이
같은 `(id, category)` 를 쓴다. `0`(기본) · `6`(MD6) 으로 가른다.

**② `md__achievements.json` 이 단일 객체로 스캔된다.** 값이 전부 객체가 아니라
(`__Season__` 이 숫자) 파일명 stem 이 id 인 한 행이다. 맵으로 순회하면 0건이 나온다.
`md__details.json` 과 같은 모양이다.

**③ 선택지 이벤트 한국어가 103/159 만 있다.** 56건 결손이며 `field_gap` 에 남겼다.
`ActionEvents_Mirror*` 계열이 커버하는 범위 밖이다.

### 남긴 판단 — 선택지 결과를 JSONB 로 담았다

`options[].result[].results[]` 가 3중 중첩이고 결과 하나가
`{target: {condition, target}, type, value}` 꼴이다. **마스터북이 이 구조를
확정하지 않았다.** 종류를 세지 않은 채 정규화하면 틀린 스키마를 만든다.

선택지까지는 행으로 펴고(`choice_option` 372) 그 아래는 원문을 남긴다.
구조가 확정되면 `raw` 를 다시 읽어 정규화할 수 있다 — 그것이 raw 층을 둔 이유다.
