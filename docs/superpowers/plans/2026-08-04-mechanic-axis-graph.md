# 메카닉 축 그래프 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 「이 편성으로 어떤 E.G.O 기프트가 켜지는가」를 RDB 조인만으로 답할 수 있게, `canonical` 에 축·트리거 참조·효과 참조·정량자 5테이블을 세운다.

**Architecture:** `canonical` 은 이미 게임 데이터를 담고 있으나 트리거·효과가 id 뿐인 통제 어휘 라벨이라 「무엇을 참조하는지」가 없다. 그 참조를 이름 매칭으로 **유도해 테이블로 굳히고**, 유도되지 않는 정량자(임계값·분모·배치 슬롯)만 저작한다. 파싱과 하드코딩을 런타임에서 몰아내는 것이 목표다 — 그래야 나중에 다른 저장소로 옮기는 것이 말이 된다.

**Tech Stack:** TypeScript (ESM) · Prisma 6 · PostgreSQL 17 · `tsx --test` (node:test)

## Global Constraints

- **`raw` 스키마는 건드리지 않는다.** 재수집 없이 `npm run v2:canonical` 재계산만으로 끝난다.
- **변환기는 파일을 읽지 않는다.** `raw.raw_object` 를 질의해 만든다. `src/v2/source.ts` 의 `readSource`·`readSourceGroup`·`str`·`num`·`arr` 도우미만 쓴다.
- **지어내지 않는다.** 원본에 없는 값을 채우지 않는다. 유도 실패는 `meta.gap(...)` 으로 남긴다.
- **말없이 버리지 않는다.** 어느 분류에도 안 들어가는 원소는 `none`/`unclassified` 로 명시 기록한다.
- **주석은 한국어**로 「무엇을 왜」를 적는다. 기존 파일의 톤을 따른다.
- **스키마 파일은 `prisma/v2/schema.prisma` 하나다.** 고친 뒤 반드시 `npm run v2:schema:validate` → `npm run v2:schema:ddl` → `npm run v2:generate` 를 돌린다.
- **DDL 은 델타로 적용한다.** `schema.sql` 은 from-empty 라 그대로 쓰면 `raw` 43,270행과 `app.field_override` 5행이 날아간다.
  ```bash
  set -a; . ./.env; set +a
  npx prisma migrate diff --from-url "$DATABASE_URL" \
    --to-schema-datamodel prisma/v2/schema.prisma --script > build/tmp/delta.sql
  grep -nE 'DROP (SCHEMA|TABLE)|TRUNCATE' build/tmp/delta.sql   # 나오면 멈추고 사람에게 묻는다
  docker compose exec -T postgres psql -U postgres -d limbus -v ON_ERROR_STOP=1 -q < build/tmp/delta.sql
  ```
- **검사 기준값을 바꿀 때는 사유를 주석으로 남긴다.**
- **작업 디렉터리는 워크트리다.** `/Users/sungil/toy/limbus-company-dossier/.claude/worktrees/recommendation-engine`. 단 `docker compose` 는 메인 리포(`/Users/sungil/toy/limbus-company-dossier`)에서 실행한다.
- DB 질의:
  ```bash
  cd /Users/sungil/toy/limbus-company-dossier && docker compose exec -T postgres psql -U postgres -d limbus -t -A -F'|' -c "SQL"
  ```

---

## File Structure

| 파일 | 책임 | 변경 |
| --- | --- | --- |
| `prisma/v2/schema.prisma` | 스키마 | `Axis` · `IdentityAxis` · `TriggerRef` · `EffectRef` · `GiftTriggerParam` 5모델 신설 |
| `src/v2/canonical/axis.ts` | **신규.** 축 어휘 · 트리거/효과 참조 유도 | 신규 |
| `src/v2/canonical/axis.test.ts` | 위 테스트 | 신규 |
| `src/v2/canonical/identity-axis.ts` | **신규.** 인격 축 프로파일 적재 | 신규 |
| `src/v2/canonical/identity-axis.test.ts` | 위 테스트 | 신규 |
| `src/v2/load-canonical.ts` | 적재 | 신규 5테이블 `createMany` · TRUNCATE 목록 |
| `src/v2/verify-canonical.ts` | 검증 | 축 검사 추가 |

`vocab.ts` 를 늘리지 않고 `axis.ts` 를 새로 만든다. `vocab.ts` 는 「원본 어휘를 담는다」가 책임이고, 축 유도는 「어휘끼리 잇는다」라 성격이 다르다.

---

## Task 1: 스키마 5모델

**Files:**
- Modify: `prisma/v2/schema.prisma`

**Interfaces:**
- Produces: `Axis` · `IdentityAxis` · `TriggerRef` · `EffectRef` · `GiftTriggerParam` 모델과 그 컬럼명

- [ ] **Step 1: 5모델을 추가한다**

`model Keyword` 바로 뒤에 넣는다. 이 파일의 다른 모델처럼 `@@schema("canonical")` 를 마지막 줄에 둔다.

```prisma
/// 트리거가 판정하는 축. `status_category` 중 트리거가 참조하는 것만이다.
///
/// **`BULLET` 은 `keyword` 테이블에 없다.** 탄환은 키워드가 아니지만 키워드처럼
/// 동작한다 — 게임이 「특수 탄환」이라는 계열을 두고 `Allies have Ammo Skill` 트리거가
/// 이를 참조한다. 그래서 축 어휘를 `keyword` 와 분리해 둔다.
model Axis {
  /// COMBUSTION · LACERATION · VIBRATION · BURST · SINKING · BREATH · CHARGE · BULLET
  id   String  @id
  /// status_keyword — keyword 테이블에도 있는 7종
  /// bullet        — keyword 에 없는 BULLET
  kind String
  /// 판정 보류를 기록한다. 마탄 7종(FREISHUTZ_OUTIS_EGO_BULLET)이 BULLET 태그를
  /// 갖지 않는 것 등. 재적재에도 남아야 다음 사람이 다시 헤매지 않는다
  note String?

  identities IdentityAxis[]

  @@map("axis")
  @@schema("canonical")
}

/// 인격이 가진 축. 세 경로를 한 관계로 통일한다.
///
/// keyword         identity_keyword → axis            mj 가 특수 키워드 파생과
///                                                    「~로만 취급됨」을 이미 반영했다
/// special_status  identity_status → status_category → axis   홍매화 → LACERATION
/// ego_granted     **저작 2행.** 「인격으로 취급됨」이 명시된 E.G.O 만이다.
///                 `ego_status` 는 「다루는 상태」지 「주는 축」이 아니다 —
///                 20705 홀리데이는 5축을 증폭하지만 어느 축의 인격도 아니다
model IdentityAxis {
  identityId String @map("identity_id")
  axisId     String @map("axis_id")
  source     String
  /// ego_granted 일 때 어느 E.G.O 가 주는가
  egoId      String? @map("ego_id")

  identity Identity @relation(fields: [identityId], references: [id], onDelete: Cascade)
  axis     Axis     @relation(fields: [axisId], references: [id], onDelete: Cascade)

  @@id([identityId, axisId, source])
  @@index([axisId])
  @@map("identity_axis")
  @@schema("canonical")
}

/// 트리거가 무엇을 참조하나. 이름 유도 결과를 적재 시 한 번 풀어 굳힌다.
///
/// **질의마다 이름 매칭을 다시 하면 오매칭이 되살아난다** — `Dawn Office Identities` 가
/// `DawnTeam` 상태에, `N Corp. Fanatic Identities` 가 `AssemblePersonality` 에 걸린다.
model TriggerRef {
  triggerId String  @map("trigger_id")
  /// axis | association | unit_keyword | sin | resonance | attack_type
  /// | skill_kind | coin | deployment | none
  refKind   String  @map("ref_kind")
  refId     String? @map("ref_id")
  /// resonance 전용. activate | threshold | dominant | scaling
  resonanceMode String? @map("resonance_mode")
  /// resonance threshold 전용
  threshold     Int?
  /// roster       편성만으로 확정된다             … Identities · Allies have X Skill
  /// roster_gated 편성이 가능성을, 런타임이 발생을  X Skill Used · X Resonance · Deployment Position
  /// runtime      편성과 무관하다                 Clash Win · Critical Hit
  /// always       항상                           Always
  /// unclassified 원본이 분류를 포기했다            Other Uncommon Triggers
  evaluability String @map("evaluability")

  trigger Trigger @relation(fields: [triggerId], references: [id], onDelete: Cascade)

  @@id([triggerId, refKind, refId])
  @@index([refKind, refId])
  @@map("trigger_ref")
  @@schema("canonical")
}

/// 효과가 무엇을 다루나. 연쇄 엣지의 출발점이다.
model EffectRef {
  effectId String  @map("effect_id")
  /// axis | sin | attack_type | none
  refKind  String  @map("ref_kind")
  refId    String? @map("ref_id")
  /// inflict | gain | consume | trigger
  mode     String

  effect Effect @relation(fields: [effectId], references: [id], onDelete: Cascade)

  @@id([effectId, refKind, refId])
  @@map("effect_ref")
  @@schema("canonical")
}

/// 정량자. **이 계획에서 유일하게 「값」이 저작인 테이블이다.**
///
/// 어느 출처에도 구조화돼 있지 않다 — limbus-assets 가 트리거 어휘를 저작할 때
/// 정량자를 버렸다. 같은 「3인 이상」인데 9282 는 편성 기준이고 9283 은 출격 기준이다.
model GiftTriggerParam {
  giftId    String @map("gift_id")
  triggerId String @map("trigger_id")
  /// min_count | denominator | slot
  kind      String
  /// min_count → "3" · denominator → "roster"|"field"
  value     String?
  /// slot 전용. **다중값이다** — 9761 은 #1·#2·#7·#8 이고 슬롯 공간은 8이다
  slots     Int[]
  /// wiki | game-verified
  source    String

  gift Gift @relation(fields: [giftId], references: [id], onDelete: Cascade)

  @@id([giftId, triggerId, kind])
  @@map("gift_trigger_param")
  @@schema("canonical")
}
```

- [ ] **Step 2: 역방향 관계 필드를 더한다**

`model Identity` 의 관계 목록에 한 줄, `model Trigger` · `model Effect` · `model Gift` 에도 한 줄씩 더한다. Prisma 는 양방향 관계를 요구한다.

```prisma
// model Identity 안
  axes IdentityAxis[]

// model Trigger 안
  refs TriggerRef[]

// model Effect 안
  refs EffectRef[]

// model Gift 안
  triggerParams GiftTriggerParam[]
```

- [ ] **Step 3: 검증하고 재생성한다**

```bash
npm run v2:schema:validate && npm run v2:schema:ddl && npm run v2:generate
```
Expected: `The schema at prisma/v2/schema.prisma is valid 🚀`

- [ ] **Step 4: 커밋**

```bash
git add prisma/v2/schema.prisma prisma/v2/schema.sql
git commit -m "feat(v2): 메카닉 축 5테이블 스키마"
```

---

## Task 2: 축 어휘와 트리거·효과 참조 유도

**Files:**
- Create: `src/v2/canonical/axis.ts`
- Test: `src/v2/canonical/axis.test.ts`

**Interfaces:**
- Consumes: Task 1 의 모델
- Produces:
  ```ts
  export interface AxisInput {
    statusCategory: Array<{ statusId: string; category: string }>;
    statusTextEn:   Array<{ statusId: string; name: string }>;
    associationTextEn: Array<{ associationId: string; name: string }>;
    triggerIds: string[];
    effectIds: string[];
    unitKeywords: string[];
    sinIds: string[];
  }
  export interface AxisTables {
    axis:       Array<{ id: string; kind: string; note: string | null }>;
    triggerRef: Array<{ triggerId: string; refKind: string; refId: string | null;
                        resonanceMode: string | null; threshold: number | null;
                        evaluability: string }>;
    effectRef:  Array<{ effectId: string; refKind: string; refId: string | null; mode: string }>;
  }
  export function buildAxis(input: AxisInput, meta: Meta): AxisTables
  ```

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`src/v2/canonical/axis.test.ts` 를 만든다. 다른 변환기 테스트(`src/v2/canonical/vocab.test.ts`)의 형식을 따른다.

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildAxis, type AxisInput } from './axis.js';
import { Meta } from './meta.js';

function input(): AxisInput {
	return {
		statusCategory: [
			{ statusId: 'Combustion', category: 'COMBUSTION' },
			{ statusId: 'Vibration', category: 'VIBRATION' },
			{ statusId: 'VibrationExplosion', category: 'VIBRATION_CONVERTED' },
			{ statusId: 'Bullet', category: 'BULLET' },
			{ statusId: 'DawnTeam', category: 'IGNORE_CHECED_CORRECTION_EXCLUSION' },
		],
		statusTextEn: [
			{ statusId: 'Combustion', name: 'Burn' },
			{ statusId: 'Vibration', name: 'Tremor' },
			{ statusId: 'VibrationExplosion', name: 'Tremor Burst' },
			{ statusId: 'Bullet', name: 'Ammo' },
			{ statusId: 'DawnTeam', name: 'Dawn Office' },
		],
		associationTextEn: [
			{ associationId: 'DAWN', name: 'Dawn Office' },
			{ associationId: 'LIU', name: 'Liu Association' },
			{ associationId: 'YURODIVY', name: 'Yurodiviye' },
		],
		triggerIds: [
			'Allies have Burn Skill', 'Dawn Office Identities', 'Liu Assoc. Identities',
			'Trigger Tremor Burst', 'Allies have Ammo Skill', 'Wrath Skill Used',
			'Wrath Absolute Resonance', 'Counter Skill Used', 'Plus Coin Skill Used',
			'Deployment Position', 'Clash Win', 'Always', 'Other Uncommon Triggers',
			'Bloodfiend Identities', 'Yurodivy Identities',
		],
		effectIds: ['Inflict Burn Count', 'Deal Blunt Damage', 'Gain Buff', 'Consume Charge'],
		unitKeywords: ['BLOODFIEND', 'SMALL'],
		sinIds: ['wrath', 'lust', 'sloth', 'gluttony', 'gloom', 'pride', 'envy'],
	};
}

test('축은 8종만 뽑는다 — 내부 플래그는 제외', () => {
	const t = buildAxis(input(), new Meta());
	assert.deepEqual(t.axis.map((a) => a.id).sort(), ['BULLET', 'COMBUSTION', 'VIBRATION']);
	assert.equal(t.axis.find((a) => a.id === 'BULLET')?.kind, 'bullet');
	assert.equal(t.axis.find((a) => a.id === 'COMBUSTION')?.kind, 'status_keyword');
});

test('소속이 상태 이름보다 우선한다 — Dawn Office 오매칭 방지', () => {
	const t = buildAxis(input(), new Meta());
	const r = t.triggerRef.filter((x) => x.triggerId === 'Dawn Office Identities');
	assert.deepEqual(r.map((x) => [x.refKind, x.refId]), [['association', 'DAWN']]);
});

test('최장일치가 축을 못 찾으면 짧은 매칭으로 내려간다', () => {
	// Tremor Burst(VibrationExplosion)는 VIBRATION_CONVERTED 라 축이 아니다.
	// Tremor(Vibration) → VIBRATION 이 정답이다
	const t = buildAxis(input(), new Meta());
	const r = t.triggerRef.filter((x) => x.triggerId === 'Trigger Tremor Burst');
	assert.deepEqual(r.map((x) => [x.refKind, x.refId]), [['axis', 'VIBRATION']]);
});

test('이름 매칭 예외 둘을 표로 푼다', () => {
	const t = buildAxis(input(), new Meta());
	const blood = t.triggerRef.find((x) => x.triggerId === 'Bloodfiend Identities');
	assert.deepEqual([blood?.refKind, blood?.refId], ['unit_keyword', 'BLOODFIEND']);
	const yuro = t.triggerRef.find((x) => x.triggerId === 'Yurodivy Identities');
	assert.deepEqual([yuro?.refKind, yuro?.refId], ['association', 'YURODIVY']);
});

test('evaluability 3단', () => {
	const t = buildAxis(input(), new Meta());
	const ev = (id: string) => t.triggerRef.find((x) => x.triggerId === id)?.evaluability;
	assert.equal(ev('Allies have Burn Skill'), 'roster');
	assert.equal(ev('Dawn Office Identities'), 'roster');
	assert.equal(ev('Wrath Skill Used'), 'roster_gated');
	assert.equal(ev('Deployment Position'), 'roster_gated');
	assert.equal(ev('Clash Win'), 'runtime');
	assert.equal(ev('Always'), 'always');
	assert.equal(ev('Other Uncommon Triggers'), 'unclassified');
});

test('공명은 죄악과 다른 refKind 이고 absolute 를 mode 로 담는다', () => {
	const t = buildAxis(input(), new Meta());
	const r = t.triggerRef.find((x) => x.triggerId === 'Wrath Absolute Resonance');
	assert.equal(r?.refKind, 'resonance');
	assert.equal(r?.refId, 'wrath');
	assert.equal(r?.resonanceMode, 'absolute');
});

test('skill_kind 와 coin 을 none 으로 뭉개지 않는다', () => {
	const t = buildAxis(input(), new Meta());
	const counter = t.triggerRef.find((x) => x.triggerId === 'Counter Skill Used');
	assert.deepEqual([counter?.refKind, counter?.refId], ['skill_kind', 'counter']);
	const coin = t.triggerRef.find((x) => x.triggerId === 'Plus Coin Skill Used');
	assert.equal(coin?.refKind, 'coin');
});

test('어디에도 안 걸리는 트리거는 none 으로 명시 기록한다', () => {
	const t = buildAxis(input(), new Meta());
	const r = t.triggerRef.find((x) => x.triggerId === 'Clash Win');
	assert.equal(r?.refKind, 'none');
});

test('효과도 축·죄악·공격타입으로 갈리고 mode 를 갖는다', () => {
	const t = buildAxis(input(), new Meta());
	const burn = t.effectRef.find((x) => x.effectId === 'Inflict Burn Count');
	assert.deepEqual([burn?.refKind, burn?.refId, burn?.mode], ['axis', 'COMBUSTION', 'inflict']);
	const blunt = t.effectRef.find((x) => x.effectId === 'Deal Blunt Damage');
	assert.deepEqual([blunt?.refKind, blunt?.refId], ['attack_type', 'blunt']);
	const charge = t.effectRef.find((x) => x.effectId === 'Consume Charge');
	assert.equal(charge?.mode, 'consume');
	const buff = t.effectRef.find((x) => x.effectId === 'Gain Buff');
	assert.equal(buff?.refKind, 'none');
});
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npx tsx --test src/v2/canonical/axis.test.ts`
Expected: FAIL — `Cannot find module './axis.js'`

- [ ] **Step 3: `axis.ts` 를 만든다**

```ts
/**
 * 메카닉 축과 트리거·효과의 참조 유도.
 *
 * `trigger` 와 `effect` 는 id 하나뿐인 통제 어휘 라벨이다 — 무엇을 참조하는지가
 * 테이블에 없다. 이름으로 유도하되 **오매칭이 실재한다.** 적재 시 한 번 풀어
 * 굳히고, 질의는 그 결과만 읽는다.
 *
 * 설계 docs/superpowers/specs/2026-08-03-mechanic-axis-graph-design.md
 */
import type { Meta } from './meta.js';

const EVIDENCE = 'docs/superpowers/specs/2026-08-03-mechanic-axis-graph-design.md';

/** 트리거가 참조하는 8축. keyword 7 + BULLET */
const AXIS_IDS = [
	'COMBUSTION', 'LACERATION', 'VIBRATION', 'BURST',
	'SINKING', 'BREATH', 'CHARGE', 'BULLET',
] as const;

/**
 * 이름 매칭이 못 푸는 것. **표로 둔다.**
 *   Bloodfiend  소속이 아니라 unit_keyword 다
 *   Yurodivy    소속은 YURODIVY 인데 표시명이 'Yurodiviye' 라 안 붙는다
 */
const TRIGGER_EXCEPTION: Record<string, { refKind: string; refId: string }> = {
	'Bloodfiend Identities': { refKind: 'unit_keyword', refId: 'BLOODFIEND' },
	'Yurodivy Identities': { refKind: 'association', refId: 'YURODIVY' },
};

const ATTACK_TYPES = ['slash', 'pierce', 'blunt'] as const;
const SKILL_KINDS = ['counter', 'guard', 'evade'] as const;

export interface AxisInput {
	statusCategory: Array<{ statusId: string; category: string }>;
	statusTextEn: Array<{ statusId: string; name: string }>;
	associationTextEn: Array<{ associationId: string; name: string }>;
	triggerIds: string[];
	effectIds: string[];
	unitKeywords: string[];
	sinIds: string[];
}

export interface AxisTables {
	axis: Array<{ id: string; kind: string; note: string | null }>;
	triggerRef: Array<{
		triggerId: string; refKind: string; refId: string | null;
		resonanceMode: string | null; threshold: number | null; evaluability: string;
	}>;
	effectRef: Array<{ effectId: string; refKind: string; refId: string | null; mode: string }>;
}

/**
 * 트리거·효과 이름이 어느 축을 가리키나.
 *
 * **최장일치하되 축이 없으면 짧은 매칭으로 내려간다.** `Trigger Tremor Burst` 는
 * 최장일치하면 `Tremor Burst`(VibrationExplosion)에 걸리는데 그것은
 * VIBRATION_CONVERTED 라 축이 아니다. `Tremor`(Vibration) → VIBRATION 이 정답이다.
 */
function axisOf(
	name: string,
	statusToAxis: Map<string, string>,
	enToStatus: Array<{ en: string; statusId: string }>,
): string | null {
	const hits = enToStatus
		.filter((x) => name.includes(x.en))
		.sort((a, b) => b.en.length - a.en.length);
	for (const h of hits) {
		const axis = statusToAxis.get(h.statusId);
		if (axis !== undefined) return axis;
	}
	return null;
}

/** `… Skill` · `… Identities` 는 편성만으로 확정된다 */
function evaluabilityOf(id: string): string {
	if (id === 'Always') return 'always';
	if (id === 'Other Uncommon Triggers') return 'unclassified';
	if (id.endsWith(' Identities') || id.endsWith(' Skill')) return 'roster';
	// **편성이 가능성을 정하고 런타임이 발생을 정한다.** 분노 스킬이 없는 편성에서는
	// 영원히 안 켜지고, 있으면 언젠가 켜진다. roster 도 runtime 도 아니다
	if (id.endsWith('Skill Used') || id.endsWith('Resonance') || id === 'Deployment Position') {
		return 'roster_gated';
	}
	return 'runtime';
}

export function buildAxis(input: AxisInput, meta: Meta): AxisTables {
	const t: AxisTables = { axis: [], triggerRef: [], effectRef: [] };

	// ── 축 어휘 ────────────────────────────────────────────────
	// status_category 의 카테고리 중 **트리거가 참조하는 8종만** 축이다.
	// 주살(BURSTREACTIVE) · 마탄(FREISHUTZ…) · 원호 방어 등은 트리거가 하나도
	// 참조하지 않으므로 축이 아니다
	const present = new Set(input.statusCategory.map((s) => s.category));
	for (const id of AXIS_IDS) {
		if (!present.has(id)) continue;
		t.axis.push({
			id,
			kind: id === 'BULLET' ? 'bullet' : 'status_keyword',
			note: id === 'BULLET'
				? '마탄 7종(FREISHUTZ_OUTIS_EGO_BULLET)은 BULLET 태그가 없다. 게임이 그렇게 묶지 않았다 — 판정 보류'
				: null,
		});
	}

	const statusToAxis = new Map<string, string>();
	for (const s of input.statusCategory) {
		if ((AXIS_IDS as readonly string[]).includes(s.category)) statusToAxis.set(s.statusId, s.category);
	}
	const enToStatus = input.statusTextEn
		.filter((s) => s.name.length > 0)
		.map((s) => ({ en: s.name, statusId: s.statusId }));

	// 소속 이름 → id. 'Liu Association' 과 'Liu Assoc.' 둘 다 받는다
	const assocByName = new Map<string, string>();
	for (const a of input.associationTextEn) {
		assocByName.set(a.name, a.associationId);
		assocByName.set(a.name.replace('Association', 'Assoc.'), a.associationId);
	}

	const sins = new Set(input.sinIds);

	// ── 트리거 참조 ────────────────────────────────────────────
	for (const id of input.triggerIds) {
		const evaluability = evaluabilityOf(id);
		const push = (refKind: string, refId: string | null,
		              resonanceMode: string | null = null, threshold: number | null = null) => {
			t.triggerRef.push({ triggerId: id, refKind, refId, resonanceMode, threshold, evaluability });
		};

		// 1) 예외 표가 먼저다
		const exc = TRIGGER_EXCEPTION[id];
		if (exc !== undefined) { push(exc.refKind, exc.refId); continue; }

		// 2) **소속이 상태 이름보다 우선한다.** 'Dawn Office Identities' 가
		//    DawnTeam(Dawn Office) 상태에 걸리는 오매칭을 막는다
		if (id.endsWith(' Identities')) {
			const bare = id.slice(0, -' Identities'.length);
			const assoc = assocByName.get(bare);
			if (assoc !== undefined) { push('association', assoc); continue; }
			meta.gap('trigger', id, 'ref', '소속 이름과 매칭되지 않는다', EVIDENCE);
			push('none', null);
			continue;
		}

		// 3) 공명은 죄악과 다른 갈래다. absolute 를 mode 로 담는다
		if (id.endsWith('Resonance')) {
			const sin = [...sins].find((s) => id.toLowerCase().startsWith(s));
			push('resonance', sin ?? null, id.includes('Absolute') ? 'absolute' : 'activate');
			continue;
		}

		// 4) 축
		const axis = axisOf(id, statusToAxis, enToStatus);
		if (axis !== null) { push('axis', axis); continue; }

		// 5) 죄악 · 공격 타입 · 스킬 종류 · 코인
		const sin = [...sins].find((s) => id.toLowerCase().includes(s));
		if (sin !== undefined) { push('sin', sin); continue; }
		const atk = ATTACK_TYPES.find((a) => id.toLowerCase().includes(a));
		if (atk !== undefined) { push('attack_type', atk); continue; }
		const kind = SKILL_KINDS.find((k) => id.toLowerCase().includes(k));
		if (kind !== undefined) { push('skill_kind', kind); continue; }
		if (id.includes('Coin')) { push('coin', null); continue; }
		if (id === 'Deployment Position') { push('deployment', null); continue; }

		// 6) **말없이 버리지 않는다.** none 으로 명시 기록한다
		push('none', null);
	}

	// ── 효과 참조 ──────────────────────────────────────────────
	for (const id of input.effectIds) {
		const mode = id.startsWith('Inflict') ? 'inflict'
			: id.startsWith('Gain') || id.startsWith('Generate') ? 'gain'
			: id.startsWith('Consume') ? 'consume'
			: id.startsWith('Trigger') ? 'trigger'
			: 'gain';
		const axis = axisOf(id, statusToAxis, enToStatus);
		if (axis !== null) { t.effectRef.push({ effectId: id, refKind: 'axis', refId: axis, mode }); continue; }
		const sin = [...sins].find((s) => id.toLowerCase().includes(s));
		if (sin !== undefined) { t.effectRef.push({ effectId: id, refKind: 'sin', refId: sin, mode }); continue; }
		const atk = ATTACK_TYPES.find((a) => id.toLowerCase().includes(a));
		if (atk !== undefined) { t.effectRef.push({ effectId: id, refKind: 'attack_type', refId: atk, mode }); continue; }
		t.effectRef.push({ effectId: id, refKind: 'none', refId: null, mode });
	}

	return t;
}
```

- [ ] **Step 4: 테스트가 통과하는지 확인한다**

Run: `npx tsx --test src/v2/canonical/axis.test.ts`
Expected: PASS 9/9

- [ ] **Step 5: 타입체크**

Run: `npm run typecheck`
Expected: 오류 0

- [ ] **Step 6: 커밋**

```bash
git add src/v2/canonical/axis.ts src/v2/canonical/axis.test.ts
git commit -m "feat(v2): 축 어휘와 트리거·효과 참조 유도"
```

---

## Task 3: 인격 축 프로파일

**Files:**
- Create: `src/v2/canonical/identity-axis.ts`
- Test: `src/v2/canonical/identity-axis.test.ts`

**Interfaces:**
- Consumes: Task 2 의 `AXIS_IDS` 개념
- Produces:
  ```ts
  export interface IdentityAxisInput {
    identityKeyword: Array<{ identityId: string; keywordId: string }>;
    identityStatus:  Array<{ identityId: string; statusId: string }>;
    statusCategory:  Array<{ statusId: string; category: string }>;
    axisIds: string[];
  }
  export function buildIdentityAxis(input: IdentityAxisInput, meta: Meta):
    Array<{ identityId: string; axisId: string; source: string; egoId: string | null }>
  ```

- [ ] **Step 1: 실패하는 테스트를 쓴다**

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildIdentityAxis, EGO_GRANTED, type IdentityAxisInput } from './identity-axis.js';
import { Meta } from './meta.js';

function input(): IdentityAxisInput {
	return {
		identityKeyword: [
			{ identityId: '10208', keywordId: 'Laceration' },
			{ identityId: '10208', keywordId: 'Breath' },
		],
		identityStatus: [
			// 홍매화 — 특수 출혈. status_category 로 LACERATION 에 닿는다
			{ identityId: '10208', statusId: 'RedApricotBlossom' },
			// 축이 아닌 상태는 무시된다
			{ identityId: '10208', statusId: 'Binding' },
		],
		statusCategory: [
			{ statusId: 'RedApricotBlossom', category: 'LACERATION' },
			{ statusId: 'Binding', category: 'IGNORE_CHECED_CORRECTION_EXCLUSION' },
		],
		axisIds: ['COMBUSTION', 'LACERATION', 'VIBRATION', 'BURST', 'SINKING', 'BREATH', 'CHARGE', 'BULLET'],
	};
}

test('키워드 경로 — 대문자 축으로 옮긴다', () => {
	const rows = buildIdentityAxis(input(), new Meta());
	const kw = rows.filter((r) => r.source === 'keyword').map((r) => r.axisId).sort();
	assert.deepEqual(kw, ['BREATH', 'LACERATION']);
});

test('특수 상태 경로 — 홍매화가 LACERATION 으로 닿는다', () => {
	const rows = buildIdentityAxis(input(), new Meta());
	const sp = rows.filter((r) => r.source === 'special_status');
	assert.deepEqual(sp.map((r) => r.axisId), ['LACERATION']);
});

test('축이 아닌 상태는 행을 만들지 않는다', () => {
	const rows = buildIdentityAxis(input(), new Meta());
	assert.equal(rows.filter((r) => r.axisId === 'IGNORE_CHECED_CORRECTION_EXCLUSION').length, 0);
});

test('ego_granted 는 저작 2행이다 — ego_status 로 유도하지 않는다', () => {
	// 20705 홀리데이는 ego_status 로 축 7개를 주지만 「부여하는 위력 +1」인 증폭기다.
	// 어느 축의 인격도 아니므로 표에 없어야 한다
	assert.deepEqual(Object.keys(EGO_GRANTED).sort(), ['20109', '20509']);
	assert.deepEqual(EGO_GRANTED['20509'].sort(), ['BREATH', 'LACERATION']);
});
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npx tsx --test src/v2/canonical/identity-axis.test.ts`
Expected: FAIL — 모듈 없음

- [ ] **Step 3: `identity-axis.ts` 를 만든다**

```ts
/**
 * 인격이 가진 축.
 *
 * 세 경로를 한 관계로 통일한다.
 *   keyword         identity_keyword → axis
 *   special_status  identity_status → status_category → axis
 *   ego_granted     **저작 2행.** 아래 표를 보라
 */
import type { Meta } from './meta.js';

const EVIDENCE = 'docs/superpowers/specs/2026-08-03-mechanic-axis-graph-design.md';

/**
 * **E.G.O 장착이 축을 주는 경우는 저작이다.**
 *
 * `ego_status` 로 유도하면 안 된다 — 그것은 「이 E.G.O 가 다루는 상태」지
 * 「장착하면 그 인격이 이 축을 갖는다」가 아니다. 실측하면 `ego_status` 로 축을
 * 주는 E.G.O 가 94종인데 「인격으로 취급됨」이 명시된 것은 2종뿐이다.
 *
 * 반례 — 20705 홀리데이는 「부여하는 화상·출혈·진동·파열·침잠 위력 **+1**」인
 * 증폭기인데 `ego_status` 로는 축 7개를 전부 받는다. 어느 축의 인격도 아니다.
 *
 * 새 메카닉이 나오면 행이 는다. 게임이 「인격으로 취급됨」을 명시하므로 판별은 쉽다.
 */
export const EGO_GRANTED: Record<string, string[]> = {
	// 착영휘도 — 「이 인격은 [Laceration], [Breath]을 부여하는 인격으로 취급됨」
	'20509': ['LACERATION', 'BREATH'],
	// 엄숙한 애도 — 「이 인격은 [Vibration], [Sinking]을 부여하는 인격으로 취급됨」
	'20109': ['VIBRATION', 'SINKING'],
};

export interface IdentityAxisInput {
	identityKeyword: Array<{ identityId: string; keywordId: string }>;
	identityStatus: Array<{ identityId: string; statusId: string }>;
	statusCategory: Array<{ statusId: string; category: string }>;
	axisIds: string[];
}

export interface IdentityAxisRow {
	identityId: string;
	axisId: string;
	source: string;
	egoId: string | null;
}

export function buildIdentityAxis(input: IdentityAxisInput, meta: Meta): IdentityAxisRow[] {
	const axes = new Set(input.axisIds);
	const seen = new Set<string>();
	const rows: IdentityAxisRow[] = [];
	const push = (identityId: string, axisId: string, source: string) => {
		const key = `${identityId}|${axisId}|${source}`;
		if (seen.has(key)) return;
		seen.add(key);
		rows.push({ identityId, axisId, source, egoId: null });
	};

	// ── keyword 경로 ───────────────────────────────────────────
	// keyword.id 를 대문자화하면 축 id 다. mj 가 특수 키워드 파생과
	// 「~로만 취급됨」을 이미 반영해 담았으므로 그대로 옮긴다
	for (const k of input.identityKeyword) {
		const axisId = k.keywordId.toUpperCase();
		if (!axes.has(axisId)) continue;
		push(k.identityId, axisId, 'keyword');
	}

	// ── special_status 경로 ────────────────────────────────────
	// 홍매화(특수 출혈) → LACERATION. 게임이 부모 축으로 취급한다
	const statusToAxis = new Map<string, string>();
	for (const s of input.statusCategory) {
		if (axes.has(s.category)) statusToAxis.set(s.statusId, s.category);
	}
	for (const s of input.identityStatus) {
		const axisId = statusToAxis.get(s.statusId);
		if (axisId === undefined) continue;
		push(s.identityId, axisId, 'special_status');
	}

	// ── 축이 하나도 없는 인격을 기록한다 ─────────────────────────
	// 실측 5인격(10201·10205·10305·10903·11206). E.G.O 없이는 축 프로파일이 빈다
	const withAxis = new Set(rows.map((r) => r.identityId));
	const allIds = new Set([
		...input.identityKeyword.map((k) => k.identityId),
		...input.identityStatus.map((s) => s.identityId),
	]);
	for (const id of [...allIds].sort()) {
		if (withAxis.has(id)) continue;
		meta.gap('identity', id, 'axis', '축이 하나도 없다 — E.G.O 없이는 트리거에 안 걸린다', EVIDENCE);
	}

	return rows;
}
```

- [ ] **Step 4: 테스트가 통과하는지 확인한다**

Run: `npx tsx --test src/v2/canonical/identity-axis.test.ts`
Expected: PASS 4/4

- [ ] **Step 5: 커밋**

```bash
git add src/v2/canonical/identity-axis.ts src/v2/canonical/identity-axis.test.ts
git commit -m "feat(v2): 인격 축 프로파일 — ego_granted 는 저작 2행"
```

---

## Task 4: 적재기 연결과 DDL 적용

**Files:**
- Modify: `src/v2/load-canonical.ts`

**Interfaces:**
- Consumes: Task 2 의 `buildAxis` · Task 3 의 `buildIdentityAxis`

- [ ] **Step 1: import 를 더한다**

`src/v2/load-canonical.ts` 상단의 import 블록에 두 줄을 더한다.

```ts
import { buildAxis } from './canonical/axis.js';
import { buildIdentityAxis } from './canonical/identity-axis.js';
```

- [ ] **Step 2: 축 변환기를 호출한다**

`vocab` 을 만든 직후(약 87행)에 넣는다. 이 시점에 `vocab.trigger`·`vocab.effect` 가 있고,
`statuses`·`associations` 결과도 이미 만들어져 있어야 한다. **없으면 그 변환기 호출 뒤로 옮긴다.**

```ts
		// 축 어휘와 트리거·효과 참조. 이름 유도를 여기서 한 번 풀어 굳힌다 —
		// 질의마다 다시 하면 오매칭이 되살아난다
		const axisTables = buildAxis({
			statusCategory: statuses.statusCategory.map((s) => ({ statusId: s.statusId, category: s.category })),
			statusTextEn: statuses.statusText
				.filter((s) => s.locale === 'en')
				.map((s) => ({ statusId: s.statusId, name: s.name })),
			associationTextEn: sinners.associationText
				.filter((a) => a.locale === 'en')
				.map((a) => ({ associationId: a.associationId, name: a.name })),
			triggerIds: vocab.trigger.map((t) => t.id),
			effectIds: vocab.effect.map((e) => e.id),
			unitKeywords: [...new Set(identities.identityUnitKeyword.map((u) => u.keyword))],
			sinIds: ['wrath', 'lust', 'sloth', 'gluttony', 'gloom', 'pride', 'envy'],
		}, meta);

		const identityAxis = buildIdentityAxis({
			identityKeyword: identities.identityKeyword.map((k) => ({ identityId: k.identityId, keywordId: k.keywordId })),
			identityStatus: identities.identityStatus,
			statusCategory: statuses.statusCategory.map((s) => ({ statusId: s.statusId, category: s.category })),
			axisIds: axisTables.axis.map((a) => a.id),
		}, meta);
```

> **변수명이 다를 수 있다.** `statuses`·`sinners`·`identities` 는 이 파일이 이미 쓰는 변환기 결과
> 변수다. 실제 이름을 파일에서 확인하고 맞춰라. 필드명(`statusCategory` 등)도 마찬가지다.

- [ ] **Step 3: TRUNCATE 목록에 5테이블을 더한다**

`TRUNCATE` 문을 찾아 다섯을 더한다. 부모–자식 순서를 지킨다.

```
canonical.axis, canonical.identity_axis, canonical.trigger_ref,
canonical.effect_ref, canonical.gift_trigger_param,
```

- [ ] **Step 4: 적재 구간에 5테이블을 더한다**

`counts.push(['trigger', …])` 뒤에 넣는다. **`axis` 가 `identity_axis` 보다 먼저**여야 FK 가 안 깨진다.

```ts
		counts.push(['axis', (await prisma.axis.createMany({ data: axisTables.axis })).count]);
		counts.push(['trigger_ref', await chunked(axisTables.triggerRef, (d) => prisma.triggerRef.createMany({ data: d }))]);
		counts.push(['effect_ref', await chunked(axisTables.effectRef, (d) => prisma.effectRef.createMany({ data: d }))]);
		counts.push(['identity_axis', await chunked(identityAxis, (d) => prisma.identityAxis.createMany({ data: d }))]);
```

`gift_trigger_param` 은 저작 테이블이라 이 계획에서 적재하지 않는다. **빈 채로 둔다** — Task 6 이 검사로 그것을 명시한다.

- [ ] **Step 5: 타입체크와 테스트**

```bash
npm run typecheck && npm test
```
Expected: 타입 오류 0 · 기존 테스트 전부 통과

- [ ] **Step 6: DDL 을 델타로 적용한다**

```bash
cd /Users/sungil/toy/limbus-company-dossier
set -a; . ./.env; set +a
mkdir -p build/tmp
npx prisma migrate diff --from-url "$DATABASE_URL" \
  --to-schema-datamodel .claude/worktrees/recommendation-engine/prisma/v2/schema.prisma \
  --script > build/tmp/delta.sql
grep -nE 'DROP (SCHEMA|TABLE)|TRUNCATE' build/tmp/delta.sql
```
Expected: 파괴적 구문이 **없어야** 한다. 나오면 멈추고 사람에게 묻는다.

```bash
docker compose exec -T postgres psql -U postgres -d limbus -v ON_ERROR_STOP=1 -q < build/tmp/delta.sql
```

- [ ] **Step 7: 재적재하고 실측한다**

```bash
cd /Users/sungil/toy/limbus-company-dossier/.claude/worktrees/recommendation-engine
npm run v2:canonical
cd /Users/sungil/toy/limbus-company-dossier
docker compose exec -T postgres psql -U postgres -d limbus -t -A -F'|' -c "
select 'axis', count(*) from canonical.axis
union all select 'trigger_ref', count(*) from canonical.trigger_ref
union all select 'effect_ref', count(*) from canonical.effect_ref
union all select 'identity_axis', count(*) from canonical.identity_axis
union all select 'trigger_ref refKind 분포', null from canonical.trigger_ref where false;
select ref_kind, count(*) from canonical.trigger_ref group by 1 order by 2 desc;
select evaluability, count(*) from canonical.trigger_ref group by 1 order by 2 desc;"
```

Expected (설계 기준):
```
axis            8
trigger_ref   ~150   refKind 에 axis 43 · association 26 · sin · resonance · none …
effect_ref     ~55
identity_axis  유도.  keyword 266 + special_status 일부
evaluability   roster 45 · roster_gated 41+ · runtime · always 1 · unclassified 1
```

**수치가 다르면 그 자체가 발견이다.** 실측값을 적고 왜 다른지 밝힌 뒤 Task 6 의 기준값으로 삼는다.

- [ ] **Step 8: 커밋**

```bash
git add src/v2/load-canonical.ts
git commit -m "feat(v2): 축 5테이블을 적재기에 잇는다"
```

---

## Task 5: 골든 검증 — 실제 편성으로 판정한다

**Files:**
- Create: `src/v2/canonical/axis-golden.test.ts`

**Interfaces:**
- Consumes: Task 4 가 적재한 DB

이 Task 는 **DB 를 읽는 통합 테스트**다. 단위 테스트가 못 잡는 「실제로 답이 맞나」를 본다.

- [ ] **Step 1: 골든 테스트를 쓴다**

```ts
/**
 * 골든 검증 — 실제 편성으로 판정이 맞는지 본다.
 *
 * 단위 테스트는 변환기가 규칙대로 도는지만 본다. 이 테스트는 **적재된 DB 로
 * 실제 편성을 판정해 알려진 답과 맞는지** 확인한다.
 *
 * 편성은 화상·진동 덱이다.
 *   10216 새벽 사무소 해결사 파우스트 · 11216 대표 그레고르 · 11009 해결사 싱클레어
 *   10916 거미집 엄지 아비 로쟈 · 10716 엄지 제자 히스클리프 · 10512 동부 엄지 카포 뫼르소
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PrismaClient } from '../generated/client.js';

const prisma = new PrismaClient();
const SQUAD = ['10216', '11216', '11009', '10916', '10716', '10512'];

test('편성의 축 프로파일 — 화상 6 · 진동 5', async () => {
	const rows = await prisma.$queryRaw<Array<{ axis_id: string; n: bigint }>>`
		SELECT axis_id, count(DISTINCT identity_id)::bigint AS n
		FROM canonical.identity_axis
		WHERE identity_id = ANY(${SQUAD})
		GROUP BY 1 ORDER BY 2 DESC
	`;
	const m = Object.fromEntries(rows.map((r) => [r.axis_id, Number(r.n)]));
	assert.equal(m['COMBUSTION'], 6);
	assert.equal(m['VIBRATION'], 5);
});

test('검계 살수 파우스트는 출혈·호흡 인격이다 — 홍매화가 LACERATION 으로 닿는다', async () => {
	const rows = await prisma.identityAxis.findMany({
		where: { identityId: '10208' },
		select: { axisId: true, source: true },
	});
	const axes = [...new Set(rows.map((r) => r.axisId))].sort();
	assert.deepEqual(axes, ['BREATH', 'LACERATION']);
	assert.ok(rows.some((r) => r.axisId === 'LACERATION' && r.source === 'special_status'),
		'홍매화 경로가 있어야 한다');
});

test('소속 트리거가 상태가 아니라 소속을 가리킨다 — 오매칭 방지', async () => {
	const dawn = await prisma.triggerRef.findMany({ where: { triggerId: 'Dawn Office Identities' } });
	assert.deepEqual(dawn.map((r) => [r.refKind, r.refId]), [['association', 'DAWN']]);
	const fanatic = await prisma.triggerRef.findMany({ where: { triggerId: 'N Corp. Fanatic Identities' } });
	assert.deepEqual(fanatic.map((r) => [r.refKind, r.refId]), [['association', 'N_CORP_FNATIC']]);
});

test('Trigger Tremor Burst 는 VIBRATION 이다 — 최장일치가 축을 못 찾으면 내려간다', async () => {
	const r = await prisma.triggerRef.findMany({ where: { triggerId: 'Trigger Tremor Burst' } });
	assert.deepEqual(r.map((x) => [x.refKind, x.refId]), [['axis', 'VIBRATION']]);
});

test('축을 가리키는 트리거가 43종이다', async () => {
	const n = await prisma.triggerRef.count({ where: { refKind: 'axis' } });
	assert.equal(n, 43);
});

test('gift_trigger_param 은 비어 있다 — 저작 전이다', async () => {
	// 정량자는 이 계획의 범위 밖이다. 비어 있음을 명시적으로 고정해,
	// 나중에 채웠을 때 이 테스트가 깨져 「채웠다」는 사실이 드러나게 한다
	const n = await prisma.giftTriggerParam.count();
	assert.equal(n, 0);
});
```

- [ ] **Step 2: 돌린다**

Run: `npx tsx --test src/v2/canonical/axis-golden.test.ts`
Expected: PASS 6/6

실패하면 **기대값이 아니라 데이터를 먼저 의심해라.** Task 4 Step 7 의 실측과 대조한다.

- [ ] **Step 3: 커밋**

```bash
git add src/v2/canonical/axis-golden.test.ts
git commit -m "test(v2): 축 판정 골든 검증 — 실제 편성으로 확인"
```

---

## Task 6: 검사 추가

**Files:**
- Modify: `src/v2/verify-canonical.ts`

**Interfaces:**
- Consumes: Task 4 Step 7 의 실측값

- [ ] **Step 1: 행 수 검사를 더한다**

`verify-canonical.ts` 의 어휘 계열 검사 근처에 넣는다. **값은 Task 4 Step 7 의 실측을 쓴다.**

```ts
		// ══ 메카닉 축 ═══════════════════════════════════════════════
		// 축은 8종이다. status_category 의 카테고리 중 트리거가 참조하는 것만이며,
		// 주살·마탄·원호 방어 등은 트리거가 하나도 참조하지 않아 축이 아니다
		eq('axis', await prisma.axis.count(), 8);
		eq('trigger_ref', await prisma.triggerRef.count(), <Task 4 실측>);
		eq('effect_ref', await prisma.effectRef.count(), <Task 4 실측>);
		eq('identity_axis', await prisma.identityAxis.count(), <Task 4 실측>);
```

- [ ] **Step 2: 오매칭 방지 검사를 더한다**

```ts
		// **소속 트리거가 상태에 걸리면 안 된다.** 이름 매칭에서 실재하는 오매칭이다 —
		// 'Dawn Office Identities' 가 DawnTeam(Dawn Office) 상태에,
		// 'N Corp. Fanatic Identities' 가 AssemblePersonality(Fanatic) 에 걸린다
		const misMatched = await prisma.$queryRaw<Array<{ n: bigint }>>`
			SELECT count(*)::bigint AS n FROM canonical.trigger_ref
			WHERE trigger_id LIKE '% Identities' AND ref_kind = 'axis'
		`;
		checks.push({
			name: '소속 트리거가 축에 잘못 걸렸다 (0이어야 한다)',
			ok: Number(misMatched[0]?.n ?? 1n) === 0,
			detail: `${Number(misMatched[0]?.n ?? 0n)} / 0`,
		});
```

- [ ] **Step 3: 축 참조 무결성 검사를 더한다**

```ts
		// trigger_ref·effect_ref 의 axis 참조가 전부 axis 테이블에 있어야 한다
		const orphanAxis = await prisma.$queryRaw<Array<{ n: bigint }>>`
			SELECT (SELECT count(*) FROM canonical.trigger_ref r
			        WHERE r.ref_kind='axis' AND NOT EXISTS
			          (SELECT 1 FROM canonical.axis a WHERE a.id = r.ref_id))
			     + (SELECT count(*) FROM canonical.effect_ref r
			        WHERE r.ref_kind='axis' AND NOT EXISTS
			          (SELECT 1 FROM canonical.axis a WHERE a.id = r.ref_id)) AS n
		`;
		checks.push({
			name: '축 테이블에 없는 축을 가리킨다 (0이어야 한다)',
			ok: Number(orphanAxis[0]?.n ?? 1n) === 0,
			detail: `${Number(orphanAxis[0]?.n ?? 0n)} / 0`,
		});
```

- [ ] **Step 4: evaluability 분포 검사를 더한다**

**한 갈래도 0이면 안 된다.** 규칙이 퇴화하면 전부 한 값으로 쏠린다.

```ts
		const evalDist = await prisma.$queryRaw<Array<{ evaluability: string; n: bigint }>>`
			SELECT evaluability, count(*)::bigint AS n
			FROM canonical.trigger_ref GROUP BY 1
		`;
		const ed = Object.fromEntries(evalDist.map((r) => [r.evaluability, Number(r.n)]));
		checks.push({
			name: 'evaluability 5갈래가 전부 나온다',
			ok: ['roster', 'roster_gated', 'runtime', 'always', 'unclassified']
				.every((k) => (ed[k] ?? 0) > 0),
			detail: Object.entries(ed).map(([k, v]) => `${k} ${v}`).join(' · '),
		});
```

- [ ] **Step 5: 골든 표본 검사를 더한다**

```ts
		// 검계 살수 파우스트(10208)는 출혈·호흡 인격이다. 홍매화(특수 출혈)가
		// status_category 로 LACERATION 에 닿는 것이 이 설계의 핵심 발견이다
		const faust = await prisma.identityAxis.findMany({
			where: { identityId: '10208' }, select: { axisId: true },
		});
		const faustAxes = [...new Set(faust.map((r) => r.axisId))].sort().join(' · ');
		checks.push({
			name: '10208 검계 살수 파우스트 = BREATH · LACERATION',
			ok: faustAxes === 'BREATH · LACERATION',
			detail: faustAxes,
		});
```

- [ ] **Step 6: 저작 미완을 명시하는 검사를 더한다**

```ts
		// **정량자는 아직 저작 전이다.** 임계값 72 · 분모 · 배치 슬롯 ~90행이며
		// 어느 출처에도 구조화돼 있지 않다. 0 이 아니게 되면 이 검사가 깨지고,
		// 그때 기준값을 올리면서 「무엇을 얼마나 저작했나」가 기록에 남는다
		eq('gift_trigger_param (저작 전이므로 0)', await prisma.giftTriggerParam.count(), 0);
```

- [ ] **Step 7: 전체를 돌린다**

```bash
npm run typecheck && npm test && npm run v2:verify:canonical
```
Expected: 검사 전부 통과. 실패하면 기준값을 Task 4 실측으로 맞춘다.

- [ ] **Step 8: 커밋**

```bash
git add src/v2/verify-canonical.ts
git commit -m "test(v2): 축 검사 7건 — 오매칭·무결성·분포·골든"
```

---

## Task 7: 설계 문서 상태 갱신

**Files:**
- Modify: `docs/superpowers/specs/2026-08-03-mechanic-axis-graph-design.md`

- [ ] **Step 1: 헤더의 상태를 고친다**

```markdown
> 설계 2026-08-03 · 구현 2026-08-04 — **1단계 완료**
> 12절이 초판의 기둥 여섯을 무너뜨렸고 14절이 판단 여섯을 닫았다. 15·16절이 결정 후 구조다.
> **15절의 5테이블 중 4개가 적재됐다.** `gift_trigger_param`(정량자 ~90행)은 저작 전이다.
```

- [ ] **Step 2: 구현 결과 절을 더한다**

문서 끝(18절 뒤)에 붙인다. 수치는 Task 4 Step 7 실측을 쓴다.

```markdown
## 19. 구현 결과 (2026-08-04)

```
axis            8행     status_category 중 트리거가 참조하는 8종
trigger_ref     <실측>   이름 유도를 적재 시 한 번 풀어 굳혔다
effect_ref      <실측>
identity_axis   <실측>   keyword + special_status 두 경로. ego_granted 는 저작 2행
gift_trigger_param  0    ← 저작 전. 검사가 0 을 고정한다
```

**검사 7건을 더했다** — 행 수 4 · 소속 트리거 오매칭 0 · 축 참조 무결성 0 ·
evaluability 5갈래 전부 · 골든 표본(10208) · 저작 미완 고정.

**남은 것은 정량자다.** 임계값 72 · 분모 · 배치 슬롯 ~90행이며 위키·게임 확인으로
채운다. 파이프라인 밖의 일이다.
```

- [ ] **Step 3: 커밋**

```bash
git add docs/superpowers/specs/2026-08-03-mechanic-axis-graph-design.md
git commit -m "docs(spec): 축 그래프 1단계 구현 결과 반영"
```

---

## Self-Review

**스펙 커버리지**

| 설계 절 | Task |
| --- | --- |
| 4 축 8개 | Task 1 `Axis` · Task 2 Step 3 `AXIS_IDS` |
| 5 여섯 갈래 | Task 2 `refKind` 10종 |
| 6 evaluability 3단 | Task 2 `evaluabilityOf` · Task 6 Step 4 |
| 7 유도와 함정 | Task 2 `TRIGGER_EXCEPTION` · 소속 우선 · `axisOf` 폴백 · Task 6 Step 2 |
| 8 `gift_requirement` | **미구현.** 아래 참조 |
| 9 팩→축 | **미구현.** 아래 참조 |
| 14 결정 1 저작 2행 | Task 3 `EGO_GRANTED` |
| 14 결정 2 결합 안 접음 | 구조에 결합 컬럼을 두지 않음으로 반영 |
| 14 결정 3 rewrite 없음 | 테이블을 만들지 않음 |
| 14 결정 4 판정 불가 유지 | `evaluability` 로 등급이 남음 |
| 14 결정 5 pack_tag 제외 | `PackAxis` 를 만들지 않음 |
| 14 결정 6 연쇄 깊이 2 | **미구현.** 평가기 단계 |
| 15 5테이블 | Task 1 |
| 16 평가 흐름 | **미구현.** 평가기 단계 |

**의도적으로 뺀 것 넷** — 이 계획은 **데이터 계층까지**다.

```
gift_requirement 활용    죄악·공명 상세를 읽는 것은 평가기의 일이다. 테이블은 이미 있다
팩→축 유도               gift_pack 경유 유도는 질의지 테이블이 아니다. 평가기가 만든다
연쇄 · 평가 흐름          평가기(lib/engine) 작업이며 별도 계획이다
정량자 저작 ~90행         위키·게임 확인이 필요해 파이프라인 밖이다
```

**타입 일관성**

- `AxisInput`/`AxisTables` — Task 2 정의, Task 4 Step 2 소비. 필드명 일치
- `IdentityAxisInput`/`IdentityAxisRow` — Task 3 정의, Task 4 Step 2 소비
- `EGO_GRANTED` — Task 3 에서 export, Task 3 테스트에서 검증
- Prisma 모델명 — Task 1 정의(`Axis`·`IdentityAxis`·`TriggerRef`·`EffectRef`·`GiftTriggerParam`),
  Task 4 에서 `prisma.axis`·`prisma.identityAxis`·`prisma.triggerRef`·`prisma.effectRef`,
  Task 5·6 에서 같은 이름 사용

**플레이스홀더** — Task 6 Step 1 과 Task 7 Step 2 의 `<Task 4 실측>` 은 의도적이다.
Task 4 Step 7 이 실측을 뽑고 그 값을 쓰라고 절차가 명시돼 있다. 예상값도 함께 적었다.

**Task 4 Step 2 의 변수명 주의** — `statuses`·`sinners`·`identities` 는 `load-canonical.ts` 가
이미 쓰는 변환기 결과 변수다. 실제 이름과 필드명을 파일에서 확인하고 맞추라고 명시했다.
이것이 이 계획에서 가장 깨지기 쉬운 자리다.
