# canonical 기프트 계열 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** E.G.O 기프트 582종(거울 던전 456 + 스토리 던전 126)과 그 강화 단계·관계·합성을 `raw` 에서 읽어 판정해 `canonical` 에 적재한다. 그래프 파생을 위한 어휘 차원 테이블(키워드 12 · 트리거 150 · 효과 55)도 여기서 처음 세운다.

**Architecture:** 계획 2가 세운 `src/v2/source.ts`(raw 읽기)와 `canonical/meta.ts`(결손·출처 기록)를 그대로 쓴다. 기프트는 로케일 파일이 30개로 흩어져 있어 `readSourceGroup` 을 하나 더한다. 변환기는 `canonical/gifts.ts` 하나에 모으되 코어·단계·관계·합성을 함수로 가른다.

**Tech Stack:** 계획 1·2와 동일

## Global Constraints

- **현행 파일 수정 금지** — `prisma/schema.prisma` · `src/*.ts`(v2 제외) · `lib/**` · `app/**`
- **계획 1·2 산출물은 고치지 않는다.** 예외 하나 — `src/v2/source.ts` 에 `readSourceGroup` 을 **더한다**(기존 함수는 그대로)
- 신규 스키마의 모든 테이블·컬럼은 `@@map`/`@map` 으로 snake_case
- 변환기는 `data/` 를 읽지 않는다. 오직 `raw.*` 를 질의한다
- 스키마를 고치면 반드시 `npm run v2:generate` 후 타입 검사
- 커밋 메시지는 한국어

### 선행 조건

```bash
npm run v2:verify              # 13건 통과
npm run v2:verify:canonical    # 22건 통과
```

---

## 실측 기준값

### 출처 규모

```
limbus-data-mj/gifts.json          441   키 15종
limbus-data-mj/gifts_detail.json   441   키 4종 (attributeType · keyword · upgrades)
limbus-assets/gifts.json           456   키 22종   ← 정본 (ADR-04)
loc-ko  30파일 869항목 · 유일 805      loc-en/ja  31파일 944항목 · 유일 811

mj 441 ⊂ assets 456   (mj만 0 · assets만 15)
```

### **loc 는 강화 단계를 별도 id 로 담는다** — 이 계획의 핵심 발견

```
19001 "지옥나비의 꿈+"    = 9001 + 10000    2단계
29001 "지옥나비의 꿈++"   = 9001 + 20000    3단계

+10000 로 assets 에 걸리는 것   110건
+20000 로 걸리는 것            107건
```

**한국어 강화 단계 이름·설명이 여기에만 있다.** assets 는 영문 `names[3]`·`descs[3]` 만
갖는다. 이 규칙을 모르면 강화 단계의 한국어를 영영 못 얻는다.

loc 전용 349건이 이것으로 완전히 갈린다.

```
349 = 강화판 217 (110 + 107)
    + 스토리 던전 기프트 126 중 loc-ko 에 있는 120
    + EgoGiftCategory 12 (기프트가 아니라 키워드 사전)
```

### 강화 단계

```
assets names 길이   1단계 346 · 2단계 3 · 3단계 107     합 673행
assets enhanceable true 110  = 2단계 3 + 3단계 107
mj detail upgrades 길이  0:43 · 1:288 · 2:3 · 3:107

gift_stage_text 는 ko · en · ja 가 673 전부를 커버한다 (결손 0)
```

### 스토리 던전 기프트 126

```
4자리 id (1001 신도의 가면 · 2001 작은 앰플 …) · assets 에 없다
ko 120 · en 126 · ja 126
한국어 결손 6건   1017 · 1031 · 1035 · 1036 · 1045 · 1047
                 ← 마스터북 기프트 편 회차 7 과 정확히 일치
```

### 어휘 — 그래프 파생의 기반 (스펙 §6)

```
EgoGiftCategory   12종 · ko·en·ja 3로케일 모두 있음   ← 공식 사전
  Combustion 화상 Burn · Laceration 출혈 Bleed · Vibration 진동 Tremor
  Burst 파열 Rupture · Sinking 침잠 Sinking · Breath 호흡 Poise
  Charge 충전 Charge · Random 무작위 Random · Slash 참격 Slash
  Penetrate 관통 Pierce · Hit 타격 Blunt · None 범용 Keywordless

키워드 대조   mj(소문자 en) ↔ assets(en) ↔ 사전 id
  사전에 없는 값 0 · mj null ↔ assets "Keywordless" 109/109 · 불일치 0

triggers  150종 · 연결 1,081
effects    55종 · 연결 1,123
```

### 출처 간 대조

```
hardOnly     mj 53 · assets 116 · 합집합 122 · 교집합 47
             → 합집합이 정답 (게임 5건 확인 · 마스터북 기프트 편 회차 1)

sin ↔ attributeType ↔ affinity
  mj sin 분포        wrath 56 lust 77 sloth 57 gluttony 60 gloom 65 pride 64 envy 62
  detail attributeType  CRIMSON 56 SCARLET 77 AMBER 57 SHAMROCK 60 AZURE 65 INDIGO 64 VIOLET 62
  → 색-죄악 대응이 건수까지 일치. assets affinity 는 4건 틀렸다
    9038 환상 사냥 · 9111 생체 맹독 바이알 · 9404 갇힌 구더기 · 9707 반짝이는 폐품
    (게임 4건 확인 · 마스터북 기프트 편 회차 2)

tier   mj "2"(문자열) vs assets 2 — 타입이 갈린다. EX 2건은 숫자가 아니다
```

### 적재 행 수 — 검증이 이 숫자를 검사한다

```
gift                  582   456 (mirror_dungeon) + 126 (story_dungeon)
gift_stage            799   673 (assets names 합) + 126 (스토리 각 1단계)
gift_stage_text      2,391  2,019 (673×3) + 372 (ko 120 · en 126 · ja 126)
gift_effect          1,123
gift_trigger         1,081
gift_pack           10,115  mj packs
gift_exclusive_pack    321  assets exclusiveTo  (mj uniquePacks 236 보다 넓다)
gift_requirement       142  resonance 23 · sinAffinity 46 · slots 60 · skills 10 · teamWide 3
fusion_recipe           68
fusion_slot            179
fusion_slot_option       7
gift_locked_desc       192  64 × 3로케일
keyword                 12
keyword_text            36  12 × 3
trigger                150
effect                  55
field_gap                6  스토리 기프트 한국어
```

---

## File Structure

| 파일 | 책임 |
| --- | --- |
| `prisma/v2/schema.prisma` | 어휘 3종 + 기프트 10종 모델 **추가** |
| `src/v2/source.ts` | `readSourceGroup` **추가** (기존 함수 불변) |
| `src/v2/canonical/vocab.ts` | 키워드·트리거·효과 차원 변환기 |
| `src/v2/canonical/vocab.test.ts` | |
| `src/v2/canonical/gifts.ts` | 기프트 변환기 |
| `src/v2/canonical/gifts.test.ts` | |
| `src/v2/load-canonical.ts` | 기프트 적재 **추가** |
| `src/v2/verify-canonical.ts` | 기프트 검증 **추가** |

---

## 이 계획에서 담지 않는 것

| 원본 | 왜 미룸 | 어느 계획 |
| --- | --- | --- |
| assets `events` 218 | `ChoiceEvent` 가 없다 | 7 |
| assets `vestige` 5 · `hidden` 5 · `updated` 1 | 뜻이 미확정. 마스터북에 판정 없음 | 미정 → `tool_annotation` 으로 보관 |
| assets `search_desc` · `srcPath` · `imageOverride` | 도구 도메인 | 이 계획에서 `tool_annotation` 으로 |
| mj `desc`/`descKo` | `gift_stage_text` 가 대신한다 (level 0) | — |

---

## Task 1: 어휘·기프트 모델

**Files:** `prisma/v2/schema.prisma` · `prisma/v2/schema.sql`

**Interfaces:**
- Consumes: enum `Locale` (계획 2)
- Produces: enum `Sin` · `GiftDomain`, 테이블 `keyword` · `keyword_text` · `trigger` · `effect` · `gift` · `gift_stage` · `gift_stage_text` · `gift_effect` · `gift_trigger` · `gift_pack` · `gift_exclusive_pack` · `gift_requirement` · `fusion_recipe` · `fusion_slot` · `fusion_slot_option` · `gift_locked_desc`

- [ ] **Step 1: 모델을 더한다**

`prisma/v2/schema.prisma` 끝에 덧붙인다.

```prisma
// ─────────────────────────────────────────────────────────────
// canonical — 어휘 (그래프 파생의 기반, 스펙 6절)
// ─────────────────────────────────────────────────────────────

/// 죄악 7종. 색 토큰과 1:1 대응한다
/// (CRIMSON 분노 · SCARLET 색욕 · AMBER 나태 · SHAMROCK 탐식 ·
///  AZURE 우울 · INDIGO 오만 · VIOLET 질투).
enum Sin {
  wrath
  lust
  sloth
  gluttony
  gloom
  pride
  envy

  @@schema("canonical")
}

/// 기프트가 속한 게임 모드.
enum GiftDomain {
  mirror_dungeon
  story_dungeon

  @@schema("canonical")
}

/// 기믹 키워드. loc EgoGiftCategory.json 12종이 공식 사전이다.
/// id 는 사전의 상태명(Combustion)이고 표시명이 ko 화상 · en Burn 이다.
model Keyword {
  id String @id

  texts KeywordText[]
  gifts Gift[]

  @@map("keyword")
  @@schema("canonical")
}

model KeywordText {
  keywordId String @map("keyword_id")
  locale    Locale
  name      String

  keyword Keyword @relation(fields: [keywordId], references: [id], onDelete: Cascade)

  @@id([keywordId, locale])
  @@map("keyword_text")
  @@schema("canonical")
}

/// 발동 조건. assets triggers 150종. 그래프에서 (Gift)-[:TRIGGERS_ON]->(Trigger) 가 된다.
model Trigger {
  id    String @id
  gifts GiftTrigger[]

  @@map("trigger")
  @@schema("canonical")
}

/// 효과 분류. assets effects 55종. 그래프에서 (Gift)-[:PRODUCES]->(Effect) 가 된다.
model Effect {
  id    String @id
  gifts GiftEffect[]

  @@map("effect")
  @@schema("canonical")
}

// ─────────────────────────────────────────────────────────────
// canonical — E.G.O 기프트
// ─────────────────────────────────────────────────────────────

/// E.G.O 기프트 582종. 정본은 limbus-assets 다(ADR-04).
///
/// 스토리 던전 기프트 126종은 loc 에만 있어 구조 필드가 전부 NULL 이다.
/// domain 으로 가른다.
model Gift {
  /// 원본 id. 4자리(스토리) · 4–5자리(거울 던전)
  id            String     @id
  domain        GiftDomain
  /// 죄악. mj sin 이 정본이다 — assets affinity 는 4건 틀렸다(게임 확인)
  sin           Sin?
  /// 등급 1–5. "EX" 2건은 숫자가 아니라 null 이고 tierLabel 에 남는다
  tier          Int?
  /// tier 가 숫자가 아닐 때의 원문. "EX"
  tierLabel     String?    @map("tier_label")
  cost          Int?
  keywordId     String?    @map("keyword_id")
  /// mj ∪ assets = 122. 한쪽만 보면 6건 또는 69건을 놓친다(게임 5건 확인)
  hardOnly      Boolean    @default(false) @map("hard_only")
  /// 강화 가능 여부. 단계가 2 이상이면 true
  enhanceable   Boolean    @default(false)

  keyword        Keyword?            @relation(fields: [keywordId], references: [id])
  stages         GiftStage[]
  effects        GiftEffect[]
  triggers       GiftTrigger[]
  packs          GiftPack[]
  exclusivePacks GiftExclusivePack[]
  requirements   GiftRequirement[]
  recipes        FusionRecipe[]
  lockedDescs    GiftLockedDesc[]

  @@index([domain])
  @@index([sin])
  @@index([keywordId])
  @@map("gift")
  @@schema("canonical")
}

/// 강화 단계. level 0 이 기본이고 1·2 가 + · ++ 다.
/// assets 는 names/descs 배열로, loc 은 id+10000·id+20000 으로 담는다.
model GiftStage {
  giftId String @map("gift_id")
  level  Int

  gift  Gift            @relation(fields: [giftId], references: [id], onDelete: Cascade)
  texts GiftStageText[]

  @@id([giftId, level])
  @@map("gift_stage")
  @@schema("canonical")
}

model GiftStageText {
  giftId String  @map("gift_id")
  level  Int
  locale Locale
  name   String
  desc   String?

  stage GiftStage @relation(fields: [giftId, level], references: [giftId, level], onDelete: Cascade)

  @@id([giftId, level, locale])
  @@map("gift_stage_text")
  @@schema("canonical")
}

model GiftEffect {
  giftId   String @map("gift_id")
  effectId String @map("effect_id")

  gift   Gift   @relation(fields: [giftId], references: [id], onDelete: Cascade)
  effect Effect @relation(fields: [effectId], references: [id], onDelete: Cascade)

  @@id([giftId, effectId])
  @@index([effectId])
  @@map("gift_effect")
  @@schema("canonical")
}

model GiftTrigger {
  giftId    String @map("gift_id")
  triggerId String @map("trigger_id")

  gift    Gift    @relation(fields: [giftId], references: [id], onDelete: Cascade)
  trigger Trigger @relation(fields: [triggerId], references: [id], onDelete: Cascade)

  @@id([giftId, triggerId])
  @@index([triggerId])
  @@map("gift_trigger")
  @@schema("canonical")
}

/// 팩별 등장 기프트 풀. mj 단독 개념이다 — 정본(assets)에 없다.
/// 마스터북 팩 편에서 역참조 441/441 완전 일치를 확인했다.
model GiftPack {
  giftId String @map("gift_id")
  packId String @map("pack_id")

  gift Gift @relation(fields: [giftId], references: [id], onDelete: Cascade)
  pack Pack @relation(fields: [packId], references: [id], onDelete: Cascade)

  @@id([giftId, packId])
  @@index([packId])
  @@map("gift_pack")
  @@schema("canonical")
}

/// 테마 한정 기프트. assets exclusiveTo 321 이 mj uniquePacks 236 을 포함한다.
model GiftExclusivePack {
  giftId String @map("gift_id")
  packId String @map("pack_id")

  gift Gift @relation(fields: [giftId], references: [id], onDelete: Cascade)
  pack Pack @relation(fields: [packId], references: [id], onDelete: Cascade)

  @@id([giftId, packId])
  @@index([packId])
  @@map("gift_exclusive_pack")
  @@schema("canonical")
}

/// 발동 조건. mj requires 가 유일 출처이며 다섯 갈래다.
/// resonance · sinAffinity · slots · skills · teamWide
model GiftRequirement {
  giftId String @map("gift_id")
  kind   String
  /// 갈래마다 모양이 다르다. 원문을 그대로 담는다
  value  Json

  gift Gift @relation(fields: [giftId], references: [id], onDelete: Cascade)

  @@id([giftId, kind])
  @@map("gift_requirement")
  @@schema("canonical")
}

/// 합성 레시피. 한 기프트가 여러 레시피를 가질 수 있다.
model FusionRecipe {
  giftId String @map("gift_id")
  index  Int

  gift  Gift         @relation(fields: [giftId], references: [id], onDelete: Cascade)
  slots FusionSlot[]

  @@id([giftId, index])
  @@map("fusion_recipe")
  @@schema("canonical")
}

/// 레시피의 재료 자리. 고정 재료면 giftId 가 차고, 대체 가능하면 options 가 찬다.
model FusionSlot {
  giftId     String @map("gift_id")
  recipeIdx  Int    @map("recipe_idx")
  slotIdx    Int    @map("slot_idx")
  /// 고정 재료
  materialId String? @map("material_id")
  /// 이 자리에 필요한 개수. 대체 가능한 자리에만 있다
  count      Int?

  recipe  FusionRecipe       @relation(fields: [giftId, recipeIdx], references: [giftId, index], onDelete: Cascade)
  options FusionSlotOption[]

  @@id([giftId, recipeIdx, slotIdx])
  @@map("fusion_slot")
  @@schema("canonical")
}

/// 대체 가능한 재료 후보. 9083 달의 기억처럼 mj 가 표현하지 못하는 것이다.
model FusionSlotOption {
  giftId     String @map("gift_id")
  recipeIdx  Int    @map("recipe_idx")
  slotIdx    Int    @map("slot_idx")
  materialId String @map("material_id")

  slot FusionSlot @relation(fields: [giftId, recipeIdx, slotIdx], references: [giftId, recipeIdx, slotIdx], onDelete: Cascade)

  @@id([giftId, recipeIdx, slotIdx, materialId])
  @@map("fusion_slot_option")
  @@schema("canonical")
}

/// 미획득 시 표시 문구. 64건 전부 상점 팩에 안 들어가는 기프트다.
model GiftLockedDesc {
  giftId String @map("gift_id")
  locale Locale
  text   String

  gift Gift @relation(fields: [giftId], references: [id], onDelete: Cascade)

  @@id([giftId, locale])
  @@map("gift_locked_desc")
  @@schema("canonical")
}
```

- [ ] **Step 2: 검증하고 적용한다**

```bash
npm run v2:schema:validate
npm run v2:schema:ddl
npm run v2:generate
npm run db:ddl -- -c "DROP SCHEMA IF EXISTS canonical CASCADE; DROP SCHEMA IF EXISTS raw CASCADE"
npm run db:ddl < prisma/v2/schema.sql
npm run v2:load
npm run v2:canonical
npm run v2:verify
npm run v2:verify:canonical
```
Expected: raw 13건 · canonical 22건 전부 통과

- [ ] **Step 3: 타입 검사와 커밋**

```bash
npm run typecheck
git add prisma/v2/schema.prisma prisma/v2/schema.sql
git commit -m "feat(v2): 어휘 차원 3종과 기프트 계열 모델 10종"
```

---

## Task 2: `readSourceGroup` — 흩어진 로케일 파일 읽기

**Files:** `src/v2/source.ts` · `src/v2/source.test.ts`

**Interfaces:**
- Produces: `function mergeIndexes(parts: RawIndex[]): RawIndex` (순수, 테스트 대상)
  · `async function readSourceGroup(prisma, snapshotId, entity, source, exclude?: string[]): Promise<RawIndex>`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`src/v2/source.test.ts` 끝에 덧붙이고 맨 위 import 에 `mergeIndexes` 를 더한다.

```ts
test('mergeIndexes 는 여러 맵을 하나로 합친다', () => {
	const m = mergeIndexes([
		new Map([['a', { v: 1 }]]),
		new Map([['b', { v: 2 }]]),
	]);
	assert.equal(m.size, 2);
	assert.deepEqual(m.get('b'), { v: 2 });
});

test('mergeIndexes 는 뒤에 온 것이 이긴다', () => {
	const m = mergeIndexes([
		new Map([['a', { v: 1 }]]),
		new Map([['a', { v: 2 }]]),
	]);
	assert.deepEqual(m.get('a'), { v: 2 });
});

test('mergeIndexes 는 빈 입력에 빈 맵을 낸다', () => {
	assert.equal(mergeIndexes([]).size, 0);
});
```

- [ ] **Step 2: 실패 확인**

Run: `npm test` → FAIL (`mergeIndexes` 없음)

- [ ] **Step 3: 구현을 더한다**

`src/v2/source.ts` 끝에 덧붙인다.

```ts
/** 여러 맵을 하나로 합친다. 뒤에 온 것이 이긴다. */
export function mergeIndexes(parts: RawIndex[]): RawIndex {
	const m: RawIndex = new Map();
	for (const part of parts) for (const [k, v] of part) m.set(k, v);
	return m;
}

/**
 * 한 계열·한 출처의 **모든 파일**을 합쳐 읽는다.
 *
 * 기프트 로케일이 30파일로 흩어져 있어 필요하다. `exclude` 는 파일명(basename)
 * 목록이며 성격이 다른 파일을 뺀다 — EgoGiftCategory 는 키워드 사전이고
 * MirrorDungeonEgoGiftLockedDesc 는 획득 문구라 기프트 본체와 섞으면 안 된다.
 */
export async function readSourceGroup(
	prisma: PrismaClient,
	snapshotId: string,
	entity: string,
	source: string,
	exclude: string[] = [],
): Promise<RawIndex> {
	const rows = await prisma.rawObject.findMany({
		where: { snapshotId, entity, source },
		select: { id: true, payload: true, srcPath: true },
	});
	if (rows.length === 0) throw new Error(`raw 에 ${entity}/${source} 가 없다`);
	const skip = new Set(exclude);
	return indexRows(
		rows
			.filter((r) => {
				const base = r.srcPath.split('/').pop() ?? '';
				return !skip.has(base);
			})
			.map((r) => ({ id: r.id, payload: (r.payload ?? {}) as Record<string, unknown> })),
	);
}
```

- [ ] **Step 4: 통과 확인과 커밋**

```bash
npm test
npm run typecheck
git add src/v2/source.ts src/v2/source.test.ts
git commit -m "feat(v2): readSourceGroup — 흩어진 로케일 파일을 합쳐 읽는다"
```

---

## Task 3: 어휘 차원 변환기

**Files:** `src/v2/canonical/vocab.ts` · `src/v2/canonical/vocab.test.ts`

**Interfaces:**
- Produces:
  - `interface VocabTables { keyword; keywordText; trigger; effect }`
  - `interface VocabInput { categoryKo; categoryEn; categoryJa; assets }`
  - `function buildVocab(input: VocabInput, meta: Meta): VocabTables`
  - `function keywordIdOf(en: string | null, dict: Map<string, string>): string | null` — 영문명 → 사전 id
  - `function buildKeywordLookup(categoryEn: RawIndex): Map<string, string>` — 소문자 영문명 → id

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`src/v2/canonical/vocab.test.ts`:

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildVocab, buildKeywordLookup, keywordIdOf, type VocabInput } from './vocab.js';
import { Meta } from './meta.js';

function input(): VocabInput {
	return {
		categoryKo: new Map<string, Record<string, unknown>>([
			['Combustion', { id: 'Combustion', name: '화상' }],
			['None', { id: 'None', name: '범용' }],
		]),
		categoryEn: new Map<string, Record<string, unknown>>([
			['Combustion', { id: 'Combustion', name: 'Burn' }],
			['None', { id: 'None', name: 'Keywordless' }],
		]),
		categoryJa: new Map<string, Record<string, unknown>>([
			['Combustion', { id: 'Combustion', name: '火傷' }],
			['None', { id: 'None', name: '汎用' }],
		]),
		assets: new Map<string, Record<string, unknown>>([
			['9001', { triggers: ['Always', 'Clash Win'], effects: ['Deal More Damage'] }],
			['9002', { triggers: ['Always'], effects: [] }],
		]),
	};
}

test('키워드 12종이 사전에서 나온다', () => {
	const v = buildVocab(input(), new Meta());
	assert.deepEqual(v.keyword.map((k) => k.id).sort(), ['Combustion', 'None']);
});

test('키워드 표시명이 3로케일로 나온다', () => {
	const v = buildVocab(input(), new Meta());
	const combustion = v.keywordText.filter((t) => t.keywordId === 'Combustion');
	assert.deepEqual(
		combustion.map((t) => [t.locale, t.name]).sort(),
		[
			['en', 'Burn'],
			['ja', '火傷'],
			['ko', '화상'],
		],
	);
});

test('트리거·효과가 유일 집합으로 정렬돼 나온다', () => {
	const v = buildVocab(input(), new Meta());
	assert.deepEqual(v.trigger.map((t) => t.id), ['Always', 'Clash Win']);
	assert.deepEqual(v.effect.map((e) => e.id), ['Deal More Damage']);
});

test('buildKeywordLookup 은 소문자 영문명을 사전 id 로 잇는다', () => {
	const d = buildKeywordLookup(input().categoryEn);
	assert.equal(d.get('burn'), 'Combustion');
	assert.equal(d.get('keywordless'), 'None');
});

test('keywordIdOf 는 null 을 None 으로 본다 — 게임은 「범용」이라 부른다', () => {
	const d = buildKeywordLookup(input().categoryEn);
	assert.equal(keywordIdOf(null, d), 'None');
	assert.equal(keywordIdOf('Burn', d), 'Combustion');
	assert.equal(keywordIdOf('burn', d), 'Combustion');
});

test('사전에 없는 키워드는 null 이다', () => {
	const d = buildKeywordLookup(input().categoryEn);
	assert.equal(keywordIdOf('Nonexistent', d), null);
});
```

- [ ] **Step 2: 실패 확인** — `npm test` → `Cannot find module './vocab.js'`

- [ ] **Step 3: 구현**

`src/v2/canonical/vocab.ts`:

```ts
/**
 * 어휘 차원. 스펙 6절 「그래프 파생을 위한 조건」의 구현이다.
 *
 * 원본이 이미 유한 집합이므로 문자열로 두지 않고 차원 테이블 + 연결 테이블로 담는다.
 * 그러면 Neo4j 투영이 덤프 한 번이 된다 — 재파싱도 재해석도 없다.
 *
 *   키워드   loc EgoGiftCategory.json 12종이 공식 사전
 *   트리거   assets triggers 150종
 *   효과     assets effects 55종
 */
import { arr, str, type RawIndex } from '../source.js';
import type { Meta } from './meta.js';

const LOC = 'loc-ko/en/ja';
const ASSETS = 'limbus-assets';

export interface VocabInput {
	categoryKo: RawIndex;
	categoryEn: RawIndex;
	categoryJa: RawIndex;
	assets: RawIndex;
}

export interface KeywordRow {
	id: string;
}
export interface KeywordTextRow {
	keywordId: string;
	locale: 'ko' | 'en' | 'ja';
	name: string;
}
export interface TriggerRow {
	id: string;
}
export interface EffectRow {
	id: string;
}

export interface VocabTables {
	keyword: KeywordRow[];
	keywordText: KeywordTextRow[];
	trigger: TriggerRow[];
	effect: EffectRow[];
}

/** 소문자 영문 표시명 → 사전 id. assets·mj 의 keyword 값이 영문명이라 필요하다. */
export function buildKeywordLookup(categoryEn: RawIndex): Map<string, string> {
	const m = new Map<string, string>();
	for (const [id, o] of categoryEn) {
		const name = str(o, 'name');
		if (name !== null) m.set(name.toLowerCase(), id);
	}
	return m;
}

/**
 * 영문 키워드명을 사전 id 로 바꾼다.
 *
 * **null 은 「없음」이 아니라 「범용」이다**(마스터북 기프트 편 회차 7). 게임이
 * 그렇게 부르며 사전에 `None` 항목이 따로 있다. mj 의 null 109건과 assets 의
 * "Keywordless" 109건이 정확히 대응한다.
 */
export function keywordIdOf(en: string | null, dict: Map<string, string>): string | null {
	if (en === null) return dict.get('keywordless') ?? 'None';
	return dict.get(en.toLowerCase()) ?? null;
}

export function buildVocab(input: VocabInput, meta: Meta): VocabTables {
	const keyword: KeywordRow[] = [];
	const keywordText: KeywordTextRow[] = [];

	for (const id of [...input.categoryEn.keys()].sort()) {
		keyword.push({ id });
		for (const [locale, index] of [
			['ko', input.categoryKo],
			['en', input.categoryEn],
			['ja', input.categoryJa],
		] as const) {
			const name = str(index.get(id) ?? {}, 'name');
			if (name === null) {
				meta.gap('keyword', id, 'name', `${locale} 표시명이 사전에 없다`,
					'docs/data/gift/07-loc-egogift-common.md', locale);
				continue;
			}
			keywordText.push({ keywordId: id, locale, name });
		}
		meta.source('keyword', id, 'name', 'loc-only', [LOC]);
	}

	const triggers = new Set<string>();
	const effects = new Set<string>();
	for (const g of input.assets.values()) {
		for (const t of arr(g, 'triggers')) if (typeof t === 'string') triggers.add(t);
		for (const e of arr(g, 'effects')) if (typeof e === 'string') effects.add(e);
	}
	for (const id of triggers) meta.source('trigger', id, 'id', 'assets-only', [ASSETS]);
	for (const id of effects) meta.source('effect', id, 'id', 'assets-only', [ASSETS]);

	return {
		keyword,
		keywordText,
		trigger: [...triggers].sort().map((id) => ({ id })),
		effect: [...effects].sort().map((id) => ({ id })),
	};
}
```

- [ ] **Step 4: 통과 확인과 커밋**

```bash
npm test && npm run typecheck
git add src/v2/canonical/vocab.ts src/v2/canonical/vocab.test.ts
git commit -m "feat(v2): 어휘 차원 변환기 — 키워드 사전·트리거·효과"
```

---

## Task 4: 기프트 변환기

**Files:** `src/v2/canonical/gifts.ts` · `src/v2/canonical/gifts.test.ts`

**Interfaces:**
- Consumes: `RawIndex` · 도우미 (계획 2) · `Meta` · `keywordIdOf`
- Produces:
  - `interface GiftInput { mj; mjDetail; assets; locKo; locEn; locJa; lockedKo; lockedEn; lockedJa; keywordDict; knownPacks }`
  - `interface GiftTables { gift; giftStage; giftStageText; giftEffect; giftTrigger; giftPack; giftExclusivePack; giftRequirement; fusionRecipe; fusionSlot; fusionSlotOption; giftLockedDesc; toolAnnotation }`
  - `function buildGifts(input: GiftInput, meta: Meta): GiftTables`
  - `function stageLocId(giftId: string, level: number): string` — `level 0 → id`, `1 → id+10000`, `2 → id+20000`

### 판정 규칙

| 필드 | 규칙 | 근거 |
| --- | --- | --- |
| `domain` | assets 에 있으면 `mirror_dungeon`, 없으면 `story_dungeon` | |
| `sin` | **mj 단독** | assets `affinity` 4건 오류 (게임 확인) |
| `tier` | agreed. 숫자로 정규화, `"EX"` 는 `tierLabel` | mj 문자열 · assets 숫자 |
| `cost` | mj 단독 | assets 에 없다 |
| `keywordId` | agreed. 사전 id 로 정규화 | 불일치 0 · null ↔ Keywordless 109/109 |
| `hardOnly` | **union** | mj 53 ∪ assets 116 = 122 (게임 5건 확인) |
| `enhanceable` | 단계 수 ≥ 2 에서 유도 | assets `enhanceable` 110 과 대조 |
| 단계 이름·설명 | assets(en) + **loc(id+10000·id+20000)** | 한국어가 여기에만 있다 |
| `packs` | mj 단독 | 정본에 없다 |
| `exclusiveTo` | **assets 단독** | 321 ⊃ mj 236 |
| `requires` | mj 단독 | 구조화된 조건 |
| 합성 | **assets `recipes`** | 대체 슬롯을 mj 가 표현하지 못한다 |

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`src/v2/canonical/gifts.test.ts`:

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildGifts, stageLocId, type GiftInput } from './gifts.js';
import { Meta } from './meta.js';

function input(): GiftInput {
	return {
		mj: new Map<string, Record<string, unknown>>([
			[
				'9001',
				{
					id: 9001,
					name: 'Hellterfly’s Dream',
					nameKo: '지옥나비의 꿈',
					keyword: 'burn',
					tier: '2',
					sin: 'wrath',
					cost: 100,
					hardOnly: false,
					packs: [1001, 1002],
					uniquePacks: [1001],
					requires: { slots: [6] },
				},
			],
		]),
		mjDetail: new Map<string, Record<string, unknown>>([
			['9001', { id: 9001, attributeType: 'CRIMSON' }],
		]),
		assets: new Map<string, Record<string, unknown>>([
			[
				'9001',
				{
					affinity: 'wrath',
					tier: 2,
					keyword: 'Burn',
					names: ['Hellterfly’s Dream', 'Hellterfly’s Dream+', 'Hellterfly’s Dream++'],
					descs: ['base', 'plus', 'plusplus'],
					effects: ['Gain Buff'],
					triggers: ['Always'],
					enhanceable: true,
					exclusiveTo: ['1001', '1003'],
					hardonly: true,
					search_desc: '도구용',
				},
			],
		]),
		locKo: new Map<string, Record<string, unknown>>([
			['9001', { id: 9001, name: '지옥나비의 꿈', desc: '기본' }],
			['19001', { id: 19001, name: '지옥나비의 꿈+', desc: '강화1' }],
			['29001', { id: 29001, name: '지옥나비의 꿈++', desc: '강화2' }],
		]),
		locEn: new Map<string, Record<string, unknown>>([
			['9001', { id: 9001, name: 'Hellterfly’s Dream', desc: 'base' }],
		]),
		locJa: new Map<string, Record<string, unknown>>(),
		lockedKo: new Map<string, Record<string, unknown>>([
			['9001', { id: 9001, content: '획득 기록 없음' }],
		]),
		lockedEn: new Map<string, Record<string, unknown>>(),
		lockedJa: new Map<string, Record<string, unknown>>(),
		keywordDict: new Map([
			['burn', 'Combustion'],
			['keywordless', 'None'],
		]),
		knownPacks: new Set(['1001', '1002', '1003']),
	};
}

test('stageLocId 는 단계별 loc id 를 만든다', () => {
	assert.equal(stageLocId('9001', 0), '9001');
	assert.equal(stageLocId('9001', 1), '19001');
	assert.equal(stageLocId('9001', 2), '29001');
});

test('gift 행이 판정 결과를 담는다', () => {
	const t = buildGifts(input(), new Meta());
	assert.equal(t.gift.length, 1);
	assert.deepEqual(t.gift[0], {
		id: '9001',
		domain: 'mirror_dungeon',
		sin: 'wrath',
		tier: 2,
		tierLabel: null,
		cost: 100,
		keywordId: 'Combustion',
		hardOnly: true,
		enhanceable: true,
	});
});

test('hardOnly 는 합집합이다 — mj false · assets true 면 true', () => {
	const t = buildGifts(input(), new Meta());
	assert.equal(t.gift[0]?.hardOnly, true);
	const meta = new Meta();
	buildGifts(input(), meta);
	assert.equal(meta.sources.find((s) => s.field === 'hardOnly')?.rule, 'union');
});

test('tier 가 EX 면 숫자는 null 이고 tierLabel 에 남는다', () => {
	const i = input();
	i.mj.get('9001')!['tier'] = 'EX';
	i.assets.get('9001')!['tier'] = 'EX';
	const t = buildGifts(i, new Meta());
	assert.equal(t.gift[0]?.tier, null);
	assert.equal(t.gift[0]?.tierLabel, 'EX');
});

test('강화 단계가 assets names 길이만큼 생긴다', () => {
	const t = buildGifts(input(), new Meta());
	assert.deepEqual(t.giftStage, [
		{ giftId: '9001', level: 0 },
		{ giftId: '9001', level: 1 },
		{ giftId: '9001', level: 2 },
	]);
});

test('단계 한국어가 loc 의 +10000 · +20000 에서 온다', () => {
	const t = buildGifts(input(), new Meta());
	const ko = t.giftStageText.filter((r) => r.locale === 'ko').sort((a, b) => a.level - b.level);
	assert.deepEqual(ko.map((r) => r.name), ['지옥나비의 꿈', '지옥나비의 꿈+', '지옥나비의 꿈++']);
	assert.deepEqual(ko.map((r) => r.desc), ['기본', '강화1', '강화2']);
});

test('단계 영문은 loc 에 없으면 assets names 로 채운다', () => {
	const t = buildGifts(input(), new Meta());
	const en = t.giftStageText.filter((r) => r.locale === 'en').sort((a, b) => a.level - b.level);
	assert.deepEqual(en.map((r) => r.name), [
		'Hellterfly’s Dream',
		'Hellterfly’s Dream+',
		'Hellterfly’s Dream++',
	]);
});

test('로케일에 아무것도 없으면 단계 텍스트를 만들지 않는다', () => {
	const t = buildGifts(input(), new Meta());
	assert.equal(t.giftStageText.filter((r) => r.locale === 'ja').length, 0);
});

test('assets 에 없는 기프트는 story_dungeon 이고 구조가 비어 있다', () => {
	const i = input();
	i.assets.clear();
	i.mj.clear();
	i.locKo.set('1001', { id: 1001, name: '신도의 가면', desc: '설명' });
	const t = buildGifts(i, new Meta());
	assert.equal(t.gift.length, 1);
	assert.equal(t.gift[0]?.domain, 'story_dungeon');
	assert.equal(t.gift[0]?.sin, null);
	assert.equal(t.giftStage.length, 1, '스토리 기프트는 단계가 하나다');
});

test('스토리 기프트의 한국어가 없으면 결손으로 남는다', () => {
	const i = input();
	i.assets.clear();
	i.mj.clear();
	i.locEn.set('1017', { id: 1017, name: 'Hopeful Eyes' });
	const meta = new Meta();
	const t = buildGifts(i, meta);
	assert.equal(t.giftStageText.filter((r) => r.locale === 'ko' && r.giftId === '1017').length, 0);
	assert.equal(meta.gaps.filter((g) => g.entityId === '1017' && g.locale === 'ko').length, 1);
});

test('팩 연결이 mj packs 에서 나온다', () => {
	const t = buildGifts(input(), new Meta());
	assert.deepEqual(t.giftPack, [
		{ giftId: '9001', packId: '1001' },
		{ giftId: '9001', packId: '1002' },
	]);
});

test('전용 팩은 assets exclusiveTo 다 — mj uniquePacks 보다 넓다', () => {
	const t = buildGifts(input(), new Meta());
	assert.deepEqual(t.giftExclusivePack, [
		{ giftId: '9001', packId: '1001' },
		{ giftId: '9001', packId: '1003' },
	]);
});

test('모르는 팩을 가리키면 버리고 결손으로 남긴다', () => {
	const i = input();
	i.knownPacks = new Set(['1001']);
	const meta = new Meta();
	const t = buildGifts(i, meta);
	assert.equal(t.giftPack.length, 1);
	assert.ok(meta.gaps.some((g) => g.field === 'packs'));
});

test('requires 가 갈래별 행이 된다', () => {
	const t = buildGifts(input(), new Meta());
	assert.deepEqual(t.giftRequirement, [
		{ giftId: '9001', kind: 'slots', value: [6] },
	]);
});

test('도구 필드가 tool_annotation 으로 격리된다', () => {
	const t = buildGifts(input(), new Meta());
	assert.deepEqual(t.toolAnnotation, [
		{
			source: 'limbus-assets',
			entity: 'gift',
			entityId: '9001',
			field: 'search_desc',
			value: '도구용',
		},
	]);
});

test('획득 문구가 로케일별로 나온다', () => {
	const t = buildGifts(input(), new Meta());
	assert.deepEqual(t.giftLockedDesc, [
		{ giftId: '9001', locale: 'ko', text: '획득 기록 없음' },
	]);
});

test('합성 레시피가 assets recipes 에서 나온다', () => {
	const i = input();
	i.assets.get('9001')!['recipes'] = [
		[{ count: 2, options: ['9105', '9110'] }, '9142'],
	];
	const t = buildGifts(i, new Meta());
	assert.deepEqual(t.fusionRecipe, [{ giftId: '9001', index: 0 }]);
	assert.deepEqual(t.fusionSlot, [
		{ giftId: '9001', recipeIdx: 0, slotIdx: 0, materialId: null, count: 2 },
		{ giftId: '9001', recipeIdx: 0, slotIdx: 1, materialId: '9142', count: null },
	]);
	assert.deepEqual(t.fusionSlotOption, [
		{ giftId: '9001', recipeIdx: 0, slotIdx: 0, materialId: '9105' },
		{ giftId: '9001', recipeIdx: 0, slotIdx: 0, materialId: '9110' },
	]);
});
```

- [ ] **Step 2: 실패 확인** — `npm test`

- [ ] **Step 3: 구현**

`src/v2/canonical/gifts.ts` 를 쓴다. 구조는 다음과 같다.

```ts
/**
 * E.G.O 기프트 582종.
 *
 * 정본은 limbus-assets 다(ADR-04). 다만 마스터북 기프트 편에서 세 출처가 처음으로
 * 균등해졌다 — 단독 보유 개념이 mj 5 · assets 6 · loc 6 이다. 어느 하나를 골라도
 * 3분의 1을 잃으므로 필드마다 정본이 다르다.
 *
 * **loc 가 강화 단계를 별도 id 로 담는다** — id+10000 이 2단계, id+20000 이 3단계다.
 * 한국어 강화 단계 이름·설명이 여기에만 있으므로 이 규칙이 없으면 영영 못 얻는다.
 */
import { arr, bool, num, str, strArr, type RawIndex } from '../source.js';
import { keywordIdOf } from './vocab.js';
import type { Meta } from './meta.js';

const MJ = 'limbus-data-mj';
const ASSETS = 'limbus-assets';
const EVIDENCE = 'docs/data/gift/00-overview.md';
const LOCALES = ['ko', 'en', 'ja'] as const;
type Loc = (typeof LOCALES)[number];

/** assets 가 자기 웹도구를 위해 붙인 필드. 게임 사실이 아니다. */
const TOOL_FIELDS = ['search_desc', 'srcPath', 'imageOverride', 'vestige', 'hidden', 'updated'];

/** loc 의 강화 단계 id 규칙. level 0 은 원래 id, 1·2 는 +10000 · +20000 이다. */
export function stageLocId(giftId: string, level: number): string {
	if (level === 0) return giftId;
	return String(Number(giftId) + level * 10_000);
}

// … 인터페이스와 buildGifts 구현 …
```

전체 구현은 다음 순서로 한 함수 안에서 처리한다.

1. **대상 id 집합** — `assets` 키 ∪ (`locKo`·`locEn`·`locJa` 중 4자리 숫자이면서 assets 에 없는 것)
2. 각 id 마다 `domain` 판정 → `mirror_dungeon` / `story_dungeon`
3. 코어 필드 판정 (표의 규칙대로) 후 `gift` 행
4. 단계 수 = `assets.names.length` 또는 스토리면 1 → `gift_stage`
5. 단계마다 로케일 3종 → `gift_stage_text` (loc 우선, en 은 assets `names`/`descs` 폴백)
6. `gift_effect` · `gift_trigger` · `gift_pack` · `gift_exclusive_pack` · `gift_requirement`
7. `assets.recipes` → `fusion_recipe` / `fusion_slot` / `fusion_slot_option`
8. `locked*` → `gift_locked_desc`
9. `TOOL_FIELDS` → `tool_annotation`

- [ ] **Step 4: 통과 확인과 커밋**

```bash
npm test && npm run typecheck
git add src/v2/canonical/gifts.ts src/v2/canonical/gifts.test.ts
git commit -m "feat(v2): 기프트 변환기 — loc 의 강화 단계 id 규칙 포함"
```

---

## Task 5: 적재기 확장

**Files:** `src/v2/load-canonical.ts`

- [ ] **Step 1: 어휘와 기프트 적재를 더한다**

`buildPacks` 다음에 `buildVocab` · `buildGifts` 를 부르고 적재 순서를 지킨다.

```
keyword → keyword_text → trigger → effect
→ gift → gift_stage → gift_stage_text
→ gift_effect · gift_trigger · gift_pack · gift_exclusive_pack
→ gift_requirement → fusion_recipe → fusion_slot → fusion_slot_option
→ gift_locked_desc → tool_annotation
```

`pack` 이 먼저 적재돼야 `gift_pack` 의 외래 키가 선다. `TRUNCATE` 목록에
`canonical.keyword` · `canonical.trigger` · `canonical.effect` · `canonical.gift` 를 더한다.

- [ ] **Step 2: 적재하고 행 수를 확인한다**

Run: `npm run v2:canonical`
Expected: 위 「적재 행 수」 표와 일치

- [ ] **Step 3: 커밋**

---

## Task 6: 검증 확장

**Files:** `src/v2/verify-canonical.ts`

- [ ] **Step 1: 기프트 검사를 더한다**

행 수 17종 + 판정 검사.

```
gift 582 · mirror_dungeon 456 · story_dungeon 126
gift_stage 799 · gift_stage_text 2,391
hardOnly true 122                          ← 합집합
sin 분포 wrath 56 lust 77 sloth 57 gluttony 60 gloom 65 pride 64 envy 62
keyword None 109                           ← 「범용」
tierLabel 'EX' 2
gift_pack 10,115 · gift_exclusive_pack 321
gift_requirement 142 · fusion_recipe 68 · fusion_slot 179 · fusion_slot_option 7
gift_locked_desc 192 · keyword 12 · trigger 150 · effect 55
한국어 결손 6건 = 1017 1031 1035 1036 1045 1047
```

**마스터북 완전 일치 쌍 재현 2건**을 SQL 로 더한다.

```
기프트 ↔ 팩 역참조 441/441   canonical.gift_pack ↔ raw 의 packs.gifts
기프트 색 attributeType → sin 441/441   raw 를 직접 맞댄다
```

- [ ] **Step 2: 검증하고 전체 회귀를 돌린다**

```bash
npm run v2:verify:canonical
npm test
npm run v2:verify
npm run schema:validate
npm run db:ddl -- -c "SELECT count(*) FROM public.gift"
```

- [ ] **Step 3: 커밋**

---

## 완료 판정 — **전부 통과 (2026-07-31)**

```
1. canonical.gift 582종                      ✔ 검사 50건 전부 통과
2. 강화 단계 한국어가 loc 에서 왔다             ✔ gift_stage_text 2,391
3. hardOnly 합집합 122                        ✔ 백로그 08 해소
4. 어휘 차원 3종이 섰다                        ✔ keyword 12 · trigger 150 · effect 55
5. 계획 1·2 가 안 깨졌다                      ✔ raw 13건 · 테스트 189건
6. 현행이 그대로 돈다                          ✔ public.gift 456
```

### 실행 결과

```
npm test                    189건 통과
npm run v2:canonical        gift 582 · gift_stage 799 · gift_stage_text 2,391
                            gift_pack 10,115 · gift_exclusive_pack 321
                            어휘 keyword 12 · trigger 150 · effect 55
                            tool_annotation 942 · field_gap 69 · field_source 3,858
npm run v2:verify:canonical 검사 50건 전부 통과
```

### 계획과 달라진 것

**① 원본 결함을 하나 새로 찾았다.** `9429` 가 `effects` 에
`"Gain Speed / Haste"` 를 두 번 담는다. 마스터북 원본 결함 31건에 없던
것이다. 중복을 접어 `gift_effect` 가 1,123 → **1,122** 가 됐고
`field_source.rule = 'assets-only-deduped'` 로 남겼다.

**② 기대값 둘이 틀렸다.**

```
결손 합계        63 → 69   기프트 한국어 6건을 더하는 걸 빠뜨렸다
keyword None    109 → 120  109 는 mj 기준이다. assets 단독 11건이 더 있다
```

**③ `Pack` 모델에 역관계 둘을 더했다.** `gifts` · `exclusiveGifts`.
계획 2에서 미룬 연결이 여기서 섰다.

### 마스터북 완전 일치 쌍 — 누적 4건이 회귀 검사가 됐다

```
계획 2   층 ↔ 팩 1–5구간 218/218
계획 3   기프트 ↔ 팩 역참조 10,115 차집합 0
        기프트 색 attributeType → sin 441건 불일치 0
        assets affinity 오류 4건 (게임 확인과 일치)
```
