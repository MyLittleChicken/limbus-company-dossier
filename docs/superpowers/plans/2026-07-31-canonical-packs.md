# canonical 뼈대와 팩 계열 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `canonical` 스키마의 공통 뼈대(열거값 · 메타 3종)를 세우고, 첫 엔티티 계열로 거울 던전 테마 팩 117종을 `raw` 에서 읽어 판정해 적재한다.

**Architecture:** **변환기는 파일을 읽지 않는다.** `raw.raw_object` 를 질의해 만든다 — 그래야 판정이 뒤집혔을 때 파일이 아니라 DB 에서 재조사할 수 있다(스펙 2.1). `src/v2/source.ts` 가 그 읽기 계층이며 이후 모든 계열이 이것을 쓴다. 팩을 첫 계열로 고른 이유는 가장 단순하면서 판정 유형을 다 갖고 있어서다 — mj 단독 · assets 단독 · 3출처 일치 · 결손 · 출처 간 표현 차이.

**Tech Stack:** TypeScript (ES2022 · NodeNext) · Node 24 내장 테스트 러너 · Prisma 6.19.3 (multiSchema) · PostgreSQL 17

## Global Constraints

- **현행 파일 수정 금지** — `prisma/schema.prisma` · `src/*.ts`(v2 제외) · `lib/**` · `app/**`. `package.json` 스크립트 **추가**만 예외.
- **계획 1의 산출물을 고치지 않는다** — `src/v2/paths.ts` · `scan.ts` · `snapshot.ts` · `load-raw.ts` · `verify-raw.ts` 는 그대로 둔다. `prisma/v2/schema.prisma` 에는 **더하기만** 한다.
- 신규 스키마의 **모든 테이블·컬럼은 `@@map`/`@map` 으로 snake_case**.
- 변환기는 `data/` 를 읽지 않는다. 오직 `raw.*` 를 질의한다.
- `npm run v2:load` 는 `raw` 만 적재한다. canonical 적재는 `npm run v2:canonical` 로 따로 둔다 — 계획이 늘어나도 스크립트 하나가 비대해지지 않게.
- 커밋 메시지는 한국어.
- `src/v2/generated/` 는 gitignore 대상. 스키마를 고치면 **반드시 `npm run v2:generate`** 를 돌린 뒤 타입 검사한다.

### 선행 조건

계획 1이 끝나 있어야 한다. 확인:

```bash
npm run v2:verify     # 검사 13건 전부 통과
```

---

## 실측 기준값 — 테스트가 이 숫자를 검사한다

계획을 쓰며 원본을 직접 세었다.

```
packs.json (mj)                117건
  id name nameKo category sprite superposition extreme floorLength bokgak gifts   117
  chapter 27 · variant 27 · textColor 56 · normalFloors 51 · hardFloors 96 · uniqueGifts 59

  category   canto 27 · sin 21 · extreme 21 · event 18 · keyword 14 · railway 6 · attack_type 6 · walpurgis 4
  variant    normal 9 · mid 10 · hard 8 · (없음) 90
  chapter    1..9 · (없음) 90
  bokgak     true 6 · false 111

packs_detail.json (mj)         117건 · 키 id unlock mapGen exceptions mapGenSequence
  unlockCode 값 있음 115 · 없음 2

md_theme_packs.json (assets)   117건
  category 117 (2단 배열 · 42조합) · image 117 · name 117 · tags 117
  bossEncounters 75 · exclusive_gifts 71팩 321연결 · overlayImage 41 · eventPool 19팩
  tags 유일 47종 · 연결 184건

md_floor_packs.json (assets)
  hard   구간 7종 (1·2·3·4·5·6-10·11-15) · 연결 213
  normal 구간 5종 (1·2·3·4·5)            · 연결  75
  합계 288

loc-{ko,en,ja}/MirrorDungeonTheme-1.json   각 117건 · 키 id name
```

### 출처 간 대조 (실측)

```
sprite == assets.image                     117/117   (유일 값은 113종)
mj.name == loc-en.name                     117/117
assets.name == loc-en.name                 117/117
mj.nameKo == loc-ko.name                   116/117
  1309  mj "'감정 앞에 게으른 것'"  vs  loc-ko "'감정 앞에 게으른 것 '"   ← 후행 공백
```

### 층 정보 — **1–5층은 완전 일치, 6층 이상은 표현이 갈린다**

마스터북의 완전 일치 쌍 「층 ↔ 팩 218/218」을 SQL 로 재현해 확인했다.

```
mj      normalFloors · hardFloors 원소 합              218
        값이 1–5 뿐이다 (6층 이상을 층 번호로 담지 않는다)
assets  normal 5구간 75 + hard 7구간 213               288

1–5층 구간만 맞대면
  mj 218 · assets 218 · mj만 0 · assets만 0          ← 완전 일치
```

6층 이상은 **같은 사실을 다르게 표현**한다. 모순이 아니다.

```
assets hard "6-10"    46건   그중 mj superposition = true  46/46
assets hard "11-15"   24건   그중 mj extreme       = true  24/24

288 = 218 (1–5층) + 46 (6-10) + 24 (11-15)
```

mj 는 6층 이상 배정을 `superposition`·`extreme` **플래그**로 담고, assets 는 **구간**으로
담는다. 둘은 서로를 완전히 재구성할 수 있다.

`floor_pack` 의 정본은 `md_floor_packs`(assets)다(ADR-04 2.1). 적재 행 수는 **288**이며,
mj 의 층 배열은 별도 컬럼으로 담지 않는다 — 같은 개념이고 assets 가 더 넓다.
대신 **1–5층 218/218 일치를 검증 항목으로 남긴다**(Task 7). 이것이 깨지면 회귀 신호다.

---

## File Structure

| 파일 | 책임 |
| --- | --- |
| `prisma/v2/schema.prisma` | 열거값 · 메타 3종 · 팩 5종 모델 **추가** |
| `prisma/v2/schema.sql` | 재생성 |
| `src/v2/source.ts` | `raw.*` 읽기 계층. 이후 모든 계열이 쓴다 |
| `src/v2/source.test.ts` | 순수 부분(`indexRows`) 테스트 |
| `src/v2/canonical/packs.ts` | 팩 계열 변환기. 판정이 여기 모인다 |
| `src/v2/canonical/packs.test.ts` | 판정 규칙 테스트 (DB 불필요) |
| `src/v2/canonical/meta.ts` | `field_gap` · `field_source` 수집기 |
| `src/v2/canonical/meta.test.ts` | 위 테스트 |
| `src/v2/load-canonical.ts` | canonical 적재기 |
| `src/v2/verify-canonical.ts` | 적재 검증 |
| `package.json` | `v2:canonical` · `v2:verify:canonical` 추가 |

---

## 이 계획에서 담지 않는 것 — 뒤 계열에 외래 키가 걸린다

| 원본 | 규모 | 왜 미룸 | 어느 계획 |
| --- | ---: | --- | --- |
| `bossEncounters` | 75 | `Encounter` 가 없다 | 7 (인카운터) |
| `exclusive_gifts` | 321 | `Gift` 가 없다 | 3 (기프트) |
| `packs.gifts` | 팩별 18–188 | `Gift` 가 없다 | 3 |
| `eventPool` | 19팩 | `ChoiceEvent` 가 없다 | 7 (거울 던전) |
| `mapGen`·`mapGenSequence`·`exceptions` | 전투 풀 2,525 | 가리킬 대상이 리포에 없다 | `backlog/10` · 미정 |

**`raw` 에는 이미 다 들어 있다.** 미루는 것은 canonical 적재일 뿐 데이터가 아니다.

---

## Task 1: canonical 공통 뼈대 — 열거값과 메타 3종

**Files:**
- Modify: `prisma/v2/schema.prisma`
- Modify: `prisma/v2/schema.sql` (재생성)

**Interfaces:**
- Consumes: 없음
- Produces:
  - enum `Locale` · `Difficulty` · `PackCategory` · `PackVariant`
  - 테이블 `canonical.field_gap` · `canonical.field_source` · `canonical.tool_annotation`

- [ ] **Step 1: 열거값과 메타 모델을 더한다**

`prisma/v2/schema.prisma` 끝에 덧붙인다. 기존 `raw` 모델은 건드리지 않는다.

```prisma
// ─────────────────────────────────────────────────────────────
// canonical — 공통
// ─────────────────────────────────────────────────────────────

/// 표시 문자열 로케일. 현행 public 스키마는 ko·en 만 담지만 신규는 ja 를 더한다.
enum Locale {
  ko
  en
  ja

  @@schema("canonical")
}

/// 거울 던전 난이도
enum Difficulty {
  normal
  hard

  @@schema("canonical")
}

/// 테마 팩 분류. mj packs.category 8종이며 id 대역과 1:1 대응한다.
enum PackCategory {
  canto
  event
  walpurgis
  railway
  attack_type
  sin
  keyword
  extreme

  @@schema("canonical")
}

/// 본편 장 팩의 난이도 변형. canto 27건만 값이 있다.
enum PackVariant {
  normal
  mid
  hard

  @@schema("canonical")
}

/// 세 출처 어디에도 없는 것. 값은 NULL 로 두고 사유를 여기 남긴다.
/// 적재 후 build/gap-report.md 로 뽑아 수동 보정 지시서가 된다.
model FieldGap {
  entity   String
  entityId String  @map("entity_id")
  field    String
  /// 한국어만 없는 경우 등. 로케일 무관이면 빈 문자열
  locale   String  @default("")
  reason   String
  /// 근거 문서 경로
  evidence String

  @@id([entity, entityId, field, locale])
  @@index([entity, field])
  @@map("field_gap")
  @@schema("canonical")
}

/// 이 값이 어느 출처에서 어떤 규칙으로 왔나. 「왜 이렇지?」를 DB 안에서 답한다.
model FieldSource {
  entity   String
  entityId String   @map("entity_id")
  field    String
  /// mj-only · assets-only · loc-only · union · agreed · game-verified · manual
  rule     String
  sources  String[]

  @@id([entity, entityId, field])
  @@index([entity, rule])
  @@map("field_source")
  @@schema("canonical")
}

/// limbus-assets 가 자기 도구를 위해 붙인 필드. 게임 사실이 아니다.
/// 게임 데이터 테이블을 열었을 때 게임 사실만 보이게 하려고 따로 둔다.
model ToolAnnotation {
  source   String
  entity   String
  entityId String @map("entity_id")
  field    String
  value    Json

  @@id([source, entity, entityId, field])
  @@index([entity, entityId])
  @@map("tool_annotation")
  @@schema("canonical")
}
```

- [ ] **Step 2: 검증하고 DDL 을 낸다**

Run:
```bash
npm run v2:schema:validate
npm run v2:schema:ddl
npm run v2:generate
```
Expected: `is valid 🚀` · `prisma/v2/schema.sql` 재생성

- [ ] **Step 3: DDL 이 canonical 스키마를 만드는지 확인한다**

Run: `grep -n "CREATE SCHEMA" prisma/v2/schema.sql`
Expected: `raw` 와 `canonical` 두 줄. `app` 은 아직 모델이 없어 안 나온다.

- [ ] **Step 4: 적용한다**

`raw` 는 파생 데이터라 통째로 갈아엎어도 4초에 복구된다. **`public` 은 건드리지 않는다.**

```bash
npm run db:ddl -- -c "DROP SCHEMA IF EXISTS canonical CASCADE; DROP SCHEMA IF EXISTS raw CASCADE"
npm run db:ddl < prisma/v2/schema.sql
npm run v2:load
npm run v2:verify
```
Expected: `v2:verify` 검사 13건 전부 통과 (계획 1이 안 깨졌다)

- [ ] **Step 5: 현행이 멀쩡한지 확인한다**

Run: `npm run db:ddl -- -c "SELECT count(*) FROM public.gift"`
Expected: `456`

- [ ] **Step 6: 타입 검사와 커밋**

```bash
npm run typecheck
git add prisma/v2/schema.prisma prisma/v2/schema.sql
git commit -m "feat(v2): canonical 공통 뼈대 — 열거값 4종과 메타 3종"
```

---

## Task 2: `raw` 읽기 계층

**Files:**
- Create: `src/v2/source.ts`
- Create: `src/v2/source.test.ts`

**Interfaces:**
- Consumes: `PrismaClient` (계획 1 Task 5)
- Produces:
  - `interface RawRecord { id: string; payload: Record<string, unknown> }`
  - `type RawIndex = Map<string, Record<string, unknown>>`
  - `function indexRows(rows: RawRecord[]): RawIndex` — 순수. 테스트 대상
  - `function readSource(prisma, snapshotId, srcPath): Promise<RawIndex>`
  - `function latestSnapshotId(prisma): Promise<string>`
  - `function str(o, k): string | null` · `num(o, k): number | null` · `bool(o, k): boolean` · `arr(o, k): unknown[]` — payload 에서 타입 안전하게 꺼내는 도우미

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`src/v2/source.test.ts`:

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { indexRows, str, num, bool, arr, strArr } from './source.js';

test('indexRows 는 id 를 열쇠로 하는 맵을 만든다', () => {
	const m = indexRows([
		{ id: '1001', payload: { name: 'The Forgotten' } },
		{ id: '1002', payload: { name: 'Sound of a Star' } },
	]);
	assert.equal(m.size, 2);
	assert.deepEqual(m.get('1001'), { name: 'The Forgotten' });
});

test('indexRows 는 뒤에 온 것이 이긴다 — 중복은 원본 결함이므로 감춘다', () => {
	const m = indexRows([
		{ id: 'x', payload: { v: 1 } },
		{ id: 'x', payload: { v: 2 } },
	]);
	assert.deepEqual(m.get('x'), { v: 2 });
});

test('str 는 문자열만 돌려주고 나머지는 null 이다', () => {
	assert.equal(str({ a: 'hi' }, 'a'), 'hi');
	assert.equal(str({ a: '' }, 'a'), null, '빈 문자열은 값이 없는 것으로 본다');
	assert.equal(str({ a: 3 }, 'a'), null);
	assert.equal(str({}, 'a'), null);
	assert.equal(str({ a: null }, 'a'), null);
});

test('num 은 숫자와 숫자 문자열을 받는다 — tier 가 "2" 와 2 로 갈린다', () => {
	assert.equal(num({ a: 3 }, 'a'), 3);
	assert.equal(num({ a: '3' }, 'a'), 3);
	assert.equal(num({ a: 'x' }, 'a'), null);
	assert.equal(num({}, 'a'), null);
});

test('bool 은 true 만 true 다 — 키가 없으면 false', () => {
	assert.equal(bool({ a: true }, 'a'), true);
	assert.equal(bool({ a: false }, 'a'), false);
	assert.equal(bool({}, 'a'), false);
	assert.equal(bool({ a: 'true' }, 'a'), false, '문자열은 불리언이 아니다');
});

test('arr 는 배열이 아니면 빈 배열이다', () => {
	assert.deepEqual(arr({ a: [1, 2] }, 'a'), [1, 2]);
	assert.deepEqual(arr({ a: null }, 'a'), []);
	assert.deepEqual(arr({}, 'a'), []);
});

test('strArr 는 원소를 문자열로 정규화한다 — 팩 id 가 숫자와 문자열로 갈린다', () => {
	assert.deepEqual(strArr({ a: [1014, '1015'] }, 'a'), ['1014', '1015']);
	assert.deepEqual(strArr({ a: [1, null, 2] }, 'a'), ['1', '2'], 'null 은 버린다');
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인한다**

Run: `npm test`
Expected: FAIL — `Cannot find module './source.js'`

- [ ] **Step 3: 구현을 쓴다**

`src/v2/source.ts`:

```ts
/**
 * canonical 변환기의 입력 계층.
 *
 * **변환기는 파일을 읽지 않는다.** raw.raw_object 를 질의해 만든다 — 그래야 판정이
 * 뒤집혔을 때 파일이 아니라 DB 에서 재조사할 수 있다(스펙 2.1).
 *
 * payload 는 JSONB 라 타입이 없다. 아래 도우미로만 꺼낸다. 직접 캐스팅하면
 * 원본의 타입 흔들림(tier 가 "2" 와 2, portrait 가 정수와 문자열)에 걸린다.
 */
import type { PrismaClient } from './generated/client.js';

export interface RawRecord {
	id: string;
	payload: Record<string, unknown>;
}

export type RawIndex = Map<string, Record<string, unknown>>;

/** id 를 열쇠로 하는 맵. 중복이면 뒤에 온 것이 이긴다. */
export function indexRows(rows: RawRecord[]): RawIndex {
	const m: RawIndex = new Map();
	for (const r of rows) m.set(r.id, r.payload);
	return m;
}

/** 가장 최근 스냅샷 id. version 이 가장 큰 것이다. */
export async function latestSnapshotId(prisma: PrismaClient): Promise<string> {
	const s = await prisma.snapshot.findFirst({ orderBy: { version: 'desc' } });
	if (s === null) throw new Error('스냅샷이 없다. npm run v2:load 를 먼저 돌린다.');
	return s.id;
}

/**
 * 원본 파일 하나를 통째로 읽어 맵으로 준다.
 *
 * `srcPath` 로 좁힌다 — `(entity, id)` 만으로는 유일하지 않다(계획 1에서 확인한
 * 충돌 8,530건).
 */
export async function readSource(
	prisma: PrismaClient,
	snapshotId: string,
	srcPath: string,
): Promise<RawIndex> {
	const rows = await prisma.rawObject.findMany({
		where: { snapshotId, srcPath },
		select: { id: true, payload: true },
	});
	if (rows.length === 0) {
		throw new Error(`raw 에 ${srcPath} 가 없다. 적재를 확인한다.`);
	}
	return indexRows(
		rows.map((r) => ({ id: r.id, payload: (r.payload ?? {}) as Record<string, unknown> })),
	);
}

// ── payload 에서 값을 꺼내는 도우미 ────────────────────────────

/** 문자열. 빈 문자열은 값이 없는 것으로 본다(원본이 결손을 ""로 표현하는 곳이 있다). */
export function str(o: Record<string, unknown>, k: string): string | null {
	const v = o[k];
	return typeof v === 'string' && v.length > 0 ? v : null;
}

/** 숫자. 숫자 문자열도 받는다 — 원본이 tier 를 "2" 와 2 로 갈라 쓴다. */
export function num(o: Record<string, unknown>, k: string): number | null {
	const v = o[k];
	if (typeof v === 'number' && Number.isFinite(v)) return v;
	if (typeof v === 'string' && v.trim() !== '') {
		const n = Number(v);
		return Number.isFinite(n) ? n : null;
	}
	return null;
}

/** 불리언. `true` 만 true 다. 키가 없으면 false. */
export function bool(o: Record<string, unknown>, k: string): boolean {
	return o[k] === true;
}

/** 배열. 배열이 아니면 빈 배열. */
export function arr(o: Record<string, unknown>, k: string): unknown[] {
	const v = o[k];
	return Array.isArray(v) ? v : [];
}

/** 문자열 배열. 원소를 문자열로 정규화하고 null·undefined 는 버린다. */
export function strArr(o: Record<string, unknown>, k: string): string[] {
	return arr(o, k)
		.filter((v) => v !== null && v !== undefined)
		.map((v) => String(v));
}
```

- [ ] **Step 4: 테스트가 통과하는지 확인한다**

Run: `npm test`
Expected: PASS — `source.test.ts` 7건

- [ ] **Step 5: 타입 검사와 커밋**

```bash
npm run typecheck
git add src/v2/source.ts src/v2/source.test.ts
git commit -m "feat(v2): raw 읽기 계층 — 변환기는 파일이 아니라 DB 를 읽는다"
```

---

## Task 3: 메타 수집기

**Files:**
- Create: `src/v2/canonical/meta.ts`
- Create: `src/v2/canonical/meta.test.ts`

**Interfaces:**
- Consumes: 없음
- Produces:
  - `interface GapRow { entity; entityId; field; locale; reason; evidence }`
  - `interface SourceRow { entity; entityId; field; rule; sources }`
  - `class Meta` — `gap(...)` · `source(...)` · `get gaps` · `get sources` · `summary()`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`src/v2/canonical/meta.test.ts`:

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Meta } from './meta.js';

test('gap 은 결손을 쌓는다', () => {
	const m = new Meta();
	m.gap('pack', '1001', 'textColor', '원본에 값이 없다', 'docs/data/pack/01-…');
	assert.equal(m.gaps.length, 1);
	assert.deepEqual(m.gaps[0], {
		entity: 'pack',
		entityId: '1001',
		field: 'textColor',
		locale: '',
		reason: '원본에 값이 없다',
		evidence: 'docs/data/pack/01-…',
	});
});

test('gap 은 로케일을 받을 수 있다', () => {
	const m = new Meta();
	m.gap('pack', '1', 'name', '없다', 'e', 'ko');
	assert.equal(m.gaps[0]?.locale, 'ko');
});

test('source 는 판정 근거를 쌓는다', () => {
	const m = new Meta();
	m.source('pack', '1001', 'sprite', 'agreed', ['limbus-data-mj', 'limbus-assets']);
	assert.deepEqual(m.sources[0], {
		entity: 'pack',
		entityId: '1001',
		field: 'sprite',
		rule: 'agreed',
		sources: ['limbus-data-mj', 'limbus-assets'],
	});
});

test('같은 (entity, id, field) 를 두 번 적으면 뒤가 이긴다', () => {
	const m = new Meta();
	m.source('pack', '1', 'x', 'mj-only', ['limbus-data-mj']);
	m.source('pack', '1', 'x', 'manual', ['manual']);
	assert.equal(m.sources.length, 1);
	assert.equal(m.sources[0]?.rule, 'manual');
});

test('summary 는 규칙별·필드별 건수를 센다', () => {
	const m = new Meta();
	m.source('pack', '1', 'a', 'mj-only', ['limbus-data-mj']);
	m.source('pack', '2', 'a', 'mj-only', ['limbus-data-mj']);
	m.source('pack', '1', 'b', 'agreed', ['limbus-data-mj', 'limbus-assets']);
	m.gap('pack', '3', 'a', 'r', 'e');
	const s = m.summary();
	assert.deepEqual(s.byRule, { 'mj-only': 2, agreed: 1 });
	assert.deepEqual(s.gapsByField, { a: 1 });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인한다**

Run: `npm test`
Expected: FAIL — `Cannot find module './meta.js'`

- [ ] **Step 3: 구현을 쓴다**

`src/v2/canonical/meta.ts`:

```ts
/**
 * 판정의 부산물을 모은다.
 *
 * field_gap    세 출처 어디에도 없는 것. 값은 NULL 이고 사유가 여기 남는다
 * field_source 이 값이 어디서 어떤 규칙으로 왔나
 *
 * 변환기가 값을 정하는 그 자리에서 함께 적는다. 나중에 몰아서 적으면 근거가 흐려진다.
 */
export interface GapRow {
	entity: string;
	entityId: string;
	field: string;
	locale: string;
	reason: string;
	evidence: string;
}

export interface SourceRow {
	entity: string;
	entityId: string;
	field: string;
	/** mj-only · assets-only · loc-only · union · agreed · game-verified · manual */
	rule: string;
	sources: string[];
}

export interface MetaSummary {
	byRule: Record<string, number>;
	gapsByField: Record<string, number>;
}

export class Meta {
	private readonly gapMap = new Map<string, GapRow>();
	private readonly sourceMap = new Map<string, SourceRow>();

	gap(
		entity: string,
		entityId: string,
		field: string,
		reason: string,
		evidence: string,
		locale = '',
	): void {
		const key = `${entity} ${entityId} ${field} ${locale}`;
		this.gapMap.set(key, { entity, entityId, field, locale, reason, evidence });
	}

	source(
		entity: string,
		entityId: string,
		field: string,
		rule: string,
		sources: string[],
	): void {
		const key = `${entity} ${entityId} ${field}`;
		this.sourceMap.set(key, { entity, entityId, field, rule, sources });
	}

	get gaps(): GapRow[] {
		return [...this.gapMap.values()];
	}

	get sources(): SourceRow[] {
		return [...this.sourceMap.values()];
	}

	summary(): MetaSummary {
		const byRule: Record<string, number> = {};
		for (const s of this.sourceMap.values()) byRule[s.rule] = (byRule[s.rule] ?? 0) + 1;
		const gapsByField: Record<string, number> = {};
		for (const g of this.gapMap.values()) gapsByField[g.field] = (gapsByField[g.field] ?? 0) + 1;
		return { byRule, gapsByField };
	}
}
```

- [ ] **Step 4: 테스트가 통과하는지 확인한다**

Run: `npm test`
Expected: PASS — `meta.test.ts` 5건

- [ ] **Step 5: 커밋**

```bash
npm run typecheck
git add src/v2/canonical/meta.ts src/v2/canonical/meta.test.ts
git commit -m "feat(v2): 판정 부산물 수집기 — 결손 대장과 출처 기록"
```

---

## Task 4: 팩 모델

**Files:**
- Modify: `prisma/v2/schema.prisma`
- Modify: `prisma/v2/schema.sql` (재생성)

**Interfaces:**
- Consumes: enum `Locale` · `Difficulty` · `PackCategory` · `PackVariant` (Task 1)
- Produces: 테이블 `canonical.pack` · `pack_text` · `pack_tag` · `pack_category_path` · `floor_pack`

- [ ] **Step 1: 모델을 더한다**

`prisma/v2/schema.prisma` 끝에 덧붙인다.

```prisma
// ─────────────────────────────────────────────────────────────
// canonical — 거울 던전 테마 팩
// ─────────────────────────────────────────────────────────────

/// 층 진입 시 고르는 단위. 117종이며 id 대역이 곧 분류다.
///
/// 정본은 limbus-data-mj 다 — 마스터북 팩 편 실측에서 mj 단독 개념 6 · assets 2 로
/// mj 쪽으로 쏠렸다(ADR-04 의 「거울 던전 구성 = assets」와 어긋난다, backlog/09).
model Pack {
  /// mj packs.id. 정수지만 문자열로 담는다 — 다른 계열의 id 와 규약을 맞춘다
  id            String       @id
  category      PackCategory
  /// assets category 배열의 2단째. 로마 숫자 등. canto 27건만
  chapter       Int?
  variant       PackVariant?
  /// 애셋은 id 가 아니라 이 값으로 찾는다. assets image 와 117/117 일치
  sprite        String
  /// assets overlayImage. 41건
  overlaySprite String?      @map("overlay_sprite")
  /// 6–10층 구간에 배정되는 중첩 팩
  superposition Boolean      @default(false)
  /// 11–15층 구간에 배정되는 극한 팩
  extreme       Boolean      @default(false)
  /// 복각 여부
  bokgak        Boolean      @default(false)
  /// 팩이 차지하는 층 수
  floorLength   Int          @map("floor_length")
  /// 이름 표시색. 6자리 16진수. 61건 결손 → NULL (field_gap 참조)
  textColor     String?      @map("text_color")
  /// packs_detail.unlock.unlockCode. 2건 결손
  unlockCode    Int?         @map("unlock_code")

  texts        PackText[]
  tags         PackTag[]
  categoryPath PackCategoryPath[]
  floors       FloorPack[]

  @@index([category])
  @@map("pack")
  @@schema("canonical")
}

/// 표시명. ko 는 mj.nameKo 가 정본이고 loc 이 폴백이다.
model PackText {
  packId String @map("pack_id")
  locale Locale
  name   String

  pack Pack @relation(fields: [packId], references: [id], onDelete: Cascade)

  @@id([packId, locale])
  @@map("pack_text")
  @@schema("canonical")
}

/// assets tags. 유일 47종 · 연결 184건. 화면 필터용이며 assets 단독 개념이다.
model PackTag {
  packId String @map("pack_id")
  tag    String

  pack Pack @relation(fields: [packId], references: [id], onDelete: Cascade)

  @@id([packId, tag])
  @@index([tag])
  @@map("pack_tag")
  @@schema("canonical")
}

/// assets category 배열. 2단 계층이며 mj 의 평평한 category 가 담지 못하는 것이다.
/// 예: ["Canto", "I"] → depth 0 "Canto", depth 1 "I"
model PackCategoryPath {
  packId String @map("pack_id")
  depth  Int
  value  String

  pack Pack @relation(fields: [packId], references: [id], onDelete: Cascade)

  @@id([packId, depth])
  @@map("pack_category_path")
  @@schema("canonical")
}

/// 난이도·층 구간별 등장 팩. 정본은 assets md_floor_packs 다(ADR-04 2.1).
///
/// mj 는 개별 층 번호를, assets 는 구간을 쓴다 — 단위가 다르다. mj 218항목 ·
/// assets 288항목이며 (난이도, 팩) 쌍으로 맞추면 assets 에만 있는 20건이 전부
/// extreme 팩이다. mj 는 extreme 팩의 hardFloors 를 비우고 플래그로 표시한다.
model FloorPack {
  difficulty Difficulty
  /// "1" · "2" · … · "6-10" · "11-15"
  floorRange String     @map("floor_range")
  packId     String     @map("pack_id")

  pack Pack @relation(fields: [packId], references: [id], onDelete: Cascade)

  @@id([difficulty, floorRange, packId])
  @@index([packId])
  @@map("floor_pack")
  @@schema("canonical")
}
```

- [ ] **Step 2: 검증하고 DDL 을 내고 적용한다**

```bash
npm run v2:schema:validate
npm run v2:schema:ddl
npm run v2:generate
npm run db:ddl -- -c "DROP SCHEMA IF EXISTS canonical CASCADE; DROP SCHEMA IF EXISTS raw CASCADE"
npm run db:ddl < prisma/v2/schema.sql
npm run v2:load
npm run v2:verify
```
Expected: `v2:verify` 검사 13건 통과

- [ ] **Step 3: 테이블이 생겼는지 확인한다**

Run: `npm run db:ddl -- -c "\dt canonical.*"`
Expected: `field_gap` · `field_source` · `floor_pack` · `pack` · `pack_category_path` · `pack_tag` · `pack_text` · `tool_annotation` 8개

- [ ] **Step 4: 타입 검사와 커밋**

```bash
npm run typecheck
git add prisma/v2/schema.prisma prisma/v2/schema.sql
git commit -m "feat(v2): 팩 계열 모델 5종"
```

---

## Task 5: 팩 변환기

**Files:**
- Create: `src/v2/canonical/packs.ts`
- Create: `src/v2/canonical/packs.test.ts`

**Interfaces:**
- Consumes: `RawIndex` · `str` · `num` · `bool` · `arr` · `strArr` (Task 2) · `Meta` (Task 3)
- Produces:
  - `interface PackTables { pack; packText; packTag; packCategoryPath; floorPack }`
  - `interface PackInput { mjPacks; mjDetail; assets; floorTable; locKo; locEn; locJa }`
  - `function buildPacks(input: PackInput, meta: Meta): PackTables`

### 판정 규칙 — 마스터북 팩 편 장부를 코드로 옮긴다

| 필드 | 규칙 | 근거 |
| --- | --- | --- |
| `category` | mj 단독 | assets 는 2단 배열로 계층을 담고 mj 는 평평한 8종. 우리 분류는 mj |
| `categoryPath` | assets 단독 | mj 가 못 담는 계층. 별도 테이블 |
| `chapter`·`variant` | mj 단독 | `normal`/`mid`/`hard` 는 여기만 |
| `sprite` | agreed | mj `sprite` == assets `image` 117/117 |
| `overlaySprite` | assets 단독 | 41건 |
| `superposition`·`extreme`·`bokgak`·`floorLength` | mj 단독 | |
| `textColor` | mj 단독 · **결손 61** | 56건만 값이 있다 → NULL + `field_gap` |
| `unlockCode` | mj 단독 · **결손 2** | `packs_detail.unlock.unlockCode` |
| `name[ko]` | **mj 우선 · loc 폴백** | 116/117 일치. `1309` 는 loc 에 후행 공백이 있어 mj 를 쓴다 |
| `name[en]` | agreed | mj · assets · loc-en 셋 다 117/117 일치 |
| `name[ja]` | loc 단독 | loc-ja 만 갖는다 |
| `tags` | assets 단독 | 47종 · 184연결 |
| `floorPack` | assets 정본 | 288행. mj 218은 단위가 다르다 |

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`src/v2/canonical/packs.test.ts`:

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildPacks, type PackInput } from './packs.js';
import { Meta } from './meta.js';

/** 최소 입력. 팩 하나로 규칙을 하나씩 본다. */
function input(over: Partial<PackInput> = {}): PackInput {
	return {
		mjPacks: new Map([
			[
				'1001',
				{
					id: 1001,
					name: 'The Forgotten',
					nameKo: '잊혀진 자들',
					category: 'canto',
					chapter: 1,
					variant: 'normal',
					sprite: 'Canto_I',
					textColor: 'af241c',
					superposition: false,
					extreme: false,
					bokgak: false,
					floorLength: 4,
				},
			],
		]),
		mjDetail: new Map([['1001', { id: 1001, unlock: { unlockCode: 101 } }]]),
		assets: new Map([
			[
				'1001',
				{
					category: ['Canto', 'I'],
					image: 'Canto_I',
					name: 'The Forgotten',
					tags: ['Canto I'],
					overlayImage: 'Canto_I_overlay',
				},
			],
		]),
		floorTable: { normal: { '1': ['1001'] }, hard: { '11-15': ['1001'] } },
		locKo: new Map([['1001', { id: '1001', name: '잊혀진 자들' }]]),
		locEn: new Map([['1001', { id: '1001', name: 'The Forgotten' }]]),
		locJa: new Map([['1001', { id: '1001', name: '忘れ去られた者たち' }]]),
		...over,
	};
}

test('pack 행이 mj 값을 그대로 받는다', () => {
	const t = buildPacks(input(), new Meta());
	assert.equal(t.pack.length, 1);
	assert.deepEqual(t.pack[0], {
		id: '1001',
		category: 'canto',
		chapter: 1,
		variant: 'normal',
		sprite: 'Canto_I',
		overlaySprite: 'Canto_I_overlay',
		superposition: false,
		extreme: false,
		bokgak: false,
		floorLength: 4,
		textColor: 'af241c',
		unlockCode: 101,
	});
});

test('표시명 3로케일이 나온다', () => {
	const t = buildPacks(input(), new Meta());
	assert.deepEqual(
		t.packText.map((r) => [r.locale, r.name]).sort(),
		[
			['en', 'The Forgotten'],
			['ja', '忘れ去られた者たち'],
			['ko', '잊혀진 자들'],
		],
	);
});

test('한국어는 mj 가 이긴다 — 1309 의 loc 후행 공백을 쓰지 않는다', () => {
	const i = input();
	i.mjPacks.get('1001')!['nameKo'] = '깨끗한 이름';
	i.locKo.set('1001', { id: '1001', name: '깨끗한 이름 ' });
	const t = buildPacks(i, new Meta());
	const ko = t.packText.find((r) => r.locale === 'ko');
	assert.equal(ko?.name, '깨끗한 이름');
});

test('한국어가 mj 에 없으면 loc 으로 폴백한다', () => {
	const i = input();
	delete i.mjPacks.get('1001')!['nameKo'];
	const t = buildPacks(i, new Meta());
	assert.equal(t.packText.find((r) => r.locale === 'ko')?.name, '잊혀진 자들');
});

test('세 출처 어디에도 이름이 없으면 행을 만들지 않고 결손으로 남긴다', () => {
	const i = input();
	delete i.mjPacks.get('1001')!['nameKo'];
	i.locKo.clear();
	const meta = new Meta();
	const t = buildPacks(i, meta);
	assert.equal(t.packText.filter((r) => r.locale === 'ko').length, 0);
	assert.equal(meta.gaps.filter((g) => g.field === 'name' && g.locale === 'ko').length, 1);
});

test('textColor 가 없으면 NULL 이고 결손으로 남는다', () => {
	const i = input();
	delete i.mjPacks.get('1001')!['textColor'];
	const meta = new Meta();
	const t = buildPacks(i, meta);
	assert.equal(t.pack[0]?.textColor, null);
	assert.equal(meta.gaps.filter((g) => g.field === 'textColor').length, 1);
});

test('unlockCode 가 없으면 NULL 이고 결손으로 남는다', () => {
	const i = input();
	i.mjDetail.set('1001', { id: 1001 });
	const meta = new Meta();
	const t = buildPacks(i, meta);
	assert.equal(t.pack[0]?.unlockCode, null);
	assert.equal(meta.gaps.filter((g) => g.field === 'unlockCode').length, 1);
});

test('categoryPath 는 assets 배열을 깊이별 행으로 편다', () => {
	const t = buildPacks(input(), new Meta());
	assert.deepEqual(t.packCategoryPath, [
		{ packId: '1001', depth: 0, value: 'Canto' },
		{ packId: '1001', depth: 1, value: 'I' },
	]);
});

test('tags 가 행으로 펴진다', () => {
	const t = buildPacks(input(), new Meta());
	assert.deepEqual(t.packTag, [{ packId: '1001', tag: 'Canto I' }]);
});

test('floorPack 이 난이도 × 구간으로 펴진다', () => {
	const t = buildPacks(input(), new Meta());
	assert.deepEqual(t.floorPack.sort((a, b) => a.difficulty.localeCompare(b.difficulty)), [
		{ difficulty: 'hard', floorRange: '11-15', packId: '1001' },
		{ difficulty: 'normal', floorRange: '1', packId: '1001' },
	]);
});

test('층 테이블이 모르는 팩을 가리키면 버리고 결손으로 남긴다', () => {
	const i = input();
	i.floorTable = { normal: { '1': ['9999'] }, hard: {} };
	const meta = new Meta();
	const t = buildPacks(i, meta);
	assert.equal(t.floorPack.length, 0);
	assert.equal(meta.gaps.filter((g) => g.field === 'floorPack').length, 1);
});

test('sprite 가 두 출처에서 다르면 mj 를 쓰고 규칙을 disagreed 로 적는다', () => {
	const i = input();
	i.assets.get('1001')!['image'] = 'Different';
	const meta = new Meta();
	const t = buildPacks(i, meta);
	assert.equal(t.pack[0]?.sprite, 'Canto_I');
	assert.equal(
		meta.sources.find((s) => s.field === 'sprite')?.rule,
		'disagreed',
	);
});

test('sprite 가 같으면 규칙이 agreed 다', () => {
	const meta = new Meta();
	buildPacks(input(), meta);
	assert.equal(meta.sources.find((s) => s.field === 'sprite')?.rule, 'agreed');
});

test('assets 에 없는 팩도 버리지 않는다 — mj 가 정본이다', () => {
	const i = input();
	i.assets.clear();
	const t = buildPacks(i, new Meta());
	assert.equal(t.pack.length, 1);
	assert.equal(t.pack[0]?.overlaySprite, null);
	assert.equal(t.packTag.length, 0);
	assert.equal(t.packCategoryPath.length, 0);
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인한다**

Run: `npm test`
Expected: FAIL — `Cannot find module './packs.js'`

- [ ] **Step 3: 구현을 쓴다**

`src/v2/canonical/packs.ts`:

```ts
/**
 * 거울 던전 테마 팩 117종.
 *
 * 정본은 limbus-data-mj 다. 마스터북 팩 편 실측에서 단독 보유 개념이
 * mj 6 · assets 2 · loc 1 로 mj 쪽으로 쏠렸다 — ADR-04 의 「거울 던전 구성 =
 * limbus-assets」 문장과 어긋난다(backlog/09).
 *
 * 예외 하나 — 층별 등장 팩(floor_pack)은 assets md_floor_packs 가 정본이다.
 * 구간 단위 테이블이 원본 형태에 가깝다(ADR-04 2.1).
 */
import { arr, bool, num, str, strArr, type RawIndex } from '../source.js';
import type { Meta } from './meta.js';

const MJ = 'limbus-data-mj';
const ASSETS = 'limbus-assets';
const EVIDENCE = 'docs/data/pack/00-overview.md';

/** `{ hard: { "1": [...], "6-10": [...] }, normal: { ... } }` */
export type FloorTable = Record<string, Record<string, string[]>>;

export interface PackInput {
	mjPacks: RawIndex;
	mjDetail: RawIndex;
	assets: RawIndex;
	floorTable: FloorTable;
	locKo: RawIndex;
	locEn: RawIndex;
	locJa: RawIndex;
}

export interface PackRow {
	id: string;
	category: string;
	chapter: number | null;
	variant: string | null;
	sprite: string;
	overlaySprite: string | null;
	superposition: boolean;
	extreme: boolean;
	bokgak: boolean;
	floorLength: number;
	textColor: string | null;
	unlockCode: number | null;
}

export interface PackTextRow {
	packId: string;
	locale: 'ko' | 'en' | 'ja';
	name: string;
}
export interface PackTagRow {
	packId: string;
	tag: string;
}
export interface PackCategoryPathRow {
	packId: string;
	depth: number;
	value: string;
}
export interface FloorPackRow {
	difficulty: string;
	floorRange: string;
	packId: string;
}

export interface PackTables {
	pack: PackRow[];
	packText: PackTextRow[];
	packTag: PackTagRow[];
	packCategoryPath: PackCategoryPathRow[];
	floorPack: FloorPackRow[];
}

export function buildPacks(input: PackInput, meta: Meta): PackTables {
	const pack: PackRow[] = [];
	const packText: PackTextRow[] = [];
	const packTag: PackTagRow[] = [];
	const packCategoryPath: PackCategoryPathRow[] = [];

	for (const [id, mj] of input.mjPacks) {
		const assets = input.assets.get(id) ?? {};
		const detail = input.mjDetail.get(id) ?? {};

		// ── sprite — 두 출처가 같아야 한다. 실측 117/117 일치 ────────────
		const sprite = str(mj, 'sprite');
		if (sprite === null) throw new Error(`팩 ${id} 에 sprite 가 없다`);
		const image = str(assets, 'image');
		meta.source('pack', id, 'sprite', image === null ? 'mj-only' : image === sprite ? 'agreed' : 'disagreed',
			image === null ? [MJ] : [MJ, ASSETS]);

		// ── textColor — 61건 결손 ────────────────────────────────────
		const textColor = str(mj, 'textColor');
		if (textColor === null) {
			meta.gap('pack', id, 'textColor', 'mj packs.json 에 값이 없다 (56/117 만 보유)', EVIDENCE);
		} else {
			meta.source('pack', id, 'textColor', 'mj-only', [MJ]);
		}

		// ── unlockCode — 2건 결손 ────────────────────────────────────
		const unlockRaw = detail['unlock'];
		const unlockCode =
			typeof unlockRaw === 'object' && unlockRaw !== null
				? num(unlockRaw as Record<string, unknown>, 'unlockCode')
				: null;
		if (unlockCode === null) {
			meta.gap('pack', id, 'unlockCode', 'packs_detail.unlock 에 값이 없다', EVIDENCE);
		} else {
			meta.source('pack', id, 'unlockCode', 'mj-only', [MJ]);
		}

		const category = str(mj, 'category');
		if (category === null) throw new Error(`팩 ${id} 에 category 가 없다`);
		const floorLength = num(mj, 'floorLength');
		if (floorLength === null) throw new Error(`팩 ${id} 에 floorLength 가 없다`);

		const overlaySprite = str(assets, 'overlayImage');
		if (overlaySprite !== null) meta.source('pack', id, 'overlaySprite', 'assets-only', [ASSETS]);

		pack.push({
			id,
			category,
			chapter: num(mj, 'chapter'),
			variant: str(mj, 'variant'),
			sprite,
			overlaySprite,
			superposition: bool(mj, 'superposition'),
			extreme: bool(mj, 'extreme'),
			bokgak: bool(mj, 'bokgak'),
			floorLength,
			textColor,
			unlockCode,
		});

		for (const field of ['category', 'chapter', 'variant', 'superposition', 'extreme', 'bokgak', 'floorLength']) {
			meta.source('pack', id, field, 'mj-only', [MJ]);
		}

		// ── 표시명 ───────────────────────────────────────────────────
		// ko 는 mj 가 이긴다. 1309 「감정 앞에 게으른 것 」의 loc 후행 공백을 피한다.
		pushText(packText, meta, id, 'ko', str(mj, 'nameKo'), str(input.locKo.get(id) ?? {}, 'name'), MJ);
		pushText(packText, meta, id, 'en', str(input.locEn.get(id) ?? {}, 'name'), str(mj, 'name'), 'loc-en');
		pushText(packText, meta, id, 'ja', str(input.locJa.get(id) ?? {}, 'name'), null, 'loc-ja');

		// ── assets 단독 ──────────────────────────────────────────────
		const tags = strArr(assets, 'tags');
		for (const tag of tags) packTag.push({ packId: id, tag });
		if (tags.length > 0) meta.source('pack', id, 'tags', 'assets-only', [ASSETS]);

		const path = arr(assets, 'category');
		path.forEach((value, depth) => {
			packCategoryPath.push({ packId: id, depth, value: String(value) });
		});
		if (path.length > 0) meta.source('pack', id, 'categoryPath', 'assets-only', [ASSETS]);
	}

	// ── 층별 등장 팩 — assets 가 정본 ────────────────────────────────
	const known = new Set(pack.map((p) => p.id));
	const floorPack: FloorPackRow[] = [];
	for (const [difficulty, ranges] of Object.entries(input.floorTable)) {
		for (const [floorRange, packIds] of Object.entries(ranges)) {
			for (const raw of packIds) {
				const packId = String(raw);
				if (!known.has(packId)) {
					meta.gap('pack', packId, 'floorPack',
						`층 테이블(${difficulty} ${floorRange})이 팩 목록에 없는 id 를 가리킨다`, EVIDENCE);
					continue;
				}
				floorPack.push({ difficulty, floorRange, packId });
			}
		}
	}

	return { pack, packText, packTag, packCategoryPath, floorPack };
}

/**
 * 표시명 한 로케일. 정본이 없으면 폴백을 쓰고, 둘 다 없으면 **행을 만들지 않는다.**
 * 소비 측이 폴백을 판정할 수 있어야 한다(ADR-03 5절).
 */
function pushText(
	out: PackTextRow[],
	meta: Meta,
	packId: string,
	locale: 'ko' | 'en' | 'ja',
	primary: string | null,
	fallback: string | null,
	primarySource: string,
): void {
	const name = primary ?? fallback;
	if (name === null) {
		meta.gap('pack', packId, 'name', `${locale} 표시명이 어느 출처에도 없다`, EVIDENCE, locale);
		return;
	}
	out.push({ packId, locale, name });
	meta.source('pack', packId, `name.${locale}`,
		primary !== null ? `${primarySource}-primary` : 'fallback', [primarySource]);
}
```

- [ ] **Step 4: 테스트가 통과하는지 확인한다**

Run: `npm test`
Expected: PASS — `packs.test.ts` 14건

- [ ] **Step 5: 커밋**

```bash
npm run typecheck
git add src/v2/canonical/packs.ts src/v2/canonical/packs.test.ts
git commit -m "feat(v2): 팩 변환기 — 마스터북 팩 편 판정을 코드로"
```

---

## Task 6: canonical 적재기

**Files:**
- Create: `src/v2/load-canonical.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: `readSource` · `latestSnapshotId` (Task 2) · `Meta` (Task 3) · `buildPacks` (Task 5)
- Produces: `npm run v2:canonical`

- [ ] **Step 1: 적재기를 쓴다**

`src/v2/load-canonical.ts`:

```ts
/**
 * canonical 층 적재기.
 *
 * **파일을 읽지 않는다.** raw.raw_object 를 질의해 만든다(스펙 2.1).
 * 재적재는 canonical 만 비운다 — raw 도 app 도 건드리지 않는다.
 *
 * 실행: npm run v2:canonical
 */
import { PrismaClient, Prisma } from './generated/client.js';
import { latestSnapshotId, readSource } from './source.js';
import { Meta } from './canonical/meta.js';
import { buildPacks, type FloorTable } from './canonical/packs.js';

const CHUNK = 1_000;

async function chunked<T>(rows: T[], insert: (part: T[]) => Promise<{ count: number }>): Promise<number> {
	let n = 0;
	for (let i = 0; i < rows.length; i += CHUNK) {
		const r = await insert(rows.slice(i, i + CHUNK));
		n += r.count;
	}
	return n;
}

async function main(): Promise<void> {
	const prisma = new PrismaClient();
	try {
		const snapshotId = await latestSnapshotId(prisma);
		console.log(`스냅샷 ${snapshotId} 를 읽는다`);

		const meta = new Meta();

		// md_floor_packs.json 은 {hard: {...}, normal: {...}} 이고 값이 전부 객체라
		// 스캔 규칙상 map 으로 분류된다 — 즉 id 가 'hard' · 'normal' 인 두 행이다.
		const floorRaw = await readSource(
			prisma,
			snapshotId,
			'mirror-dungeon/limbus-assets/md_floor_packs.json',
		);
		const floorTable: FloorTable = {};
		for (const [difficulty, ranges] of floorRaw) {
			floorTable[difficulty] = ranges as Record<string, string[]>;
		}

		const tables = buildPacks(
			{
				mjPacks: await readSource(prisma, snapshotId, 'packs/limbus-data-mj/packs.json'),
				mjDetail: await readSource(prisma, snapshotId, 'packs/limbus-data-mj/packs_detail.json'),
				assets: await readSource(prisma, snapshotId, 'packs/limbus-assets/md_theme_packs.json'),
				floorTable,
				locKo: await readSource(prisma, snapshotId, 'packs/loc-ko/MirrorDungeonTheme-1.json'),
				locEn: await readSource(prisma, snapshotId, 'packs/loc-en/MirrorDungeonTheme-1.json'),
				locJa: await readSource(prisma, snapshotId, 'packs/loc-ja/MirrorDungeonTheme-1.json'),
			},
			meta,
		);

		// canonical 만 비운다. raw 도 app 도 건드리지 않는다.
		await prisma.$executeRaw`
			TRUNCATE canonical.pack, canonical.field_gap, canonical.field_source,
			         canonical.tool_annotation CASCADE
		`;

		const counts: Array<[string, number]> = [];
		counts.push(['pack', (await prisma.pack.createMany({ data: tables.pack as never })).count]);
		counts.push(['pack_text', await chunked(tables.packText, (d) => prisma.packText.createMany({ data: d as never }))]);
		counts.push(['pack_tag', await chunked(tables.packTag, (d) => prisma.packTag.createMany({ data: d as never }))]);
		counts.push(['pack_category_path', await chunked(tables.packCategoryPath, (d) => prisma.packCategoryPath.createMany({ data: d as never }))]);
		counts.push(['floor_pack', await chunked(tables.floorPack, (d) => prisma.floorPack.createMany({ data: d as never }))]);
		counts.push(['field_gap', await chunked(meta.gaps, (d) => prisma.fieldGap.createMany({ data: d }))]);
		counts.push(['field_source', await chunked(meta.sources, (d) => prisma.fieldSource.createMany({ data: d }))]);

		console.log('');
		for (const [t, n] of counts) console.log(`  ${t.padEnd(22)} ${String(n).padStart(6)}`);

		const s = meta.summary();
		console.log('');
		console.log('판정 규칙별:', JSON.stringify(s.byRule));
		console.log('결손 필드별:', JSON.stringify(s.gapsByField));
	} finally {
		await prisma.$disconnect();
	}
}

await main();
```

> `as never` 는 Prisma 의 enum 입력 타입 때문이다. `category`·`variant`·`locale`·
> `difficulty` 가 문자열 리터럴 유니온을 요구하는데 변환기는 `string` 을 준다.
> 값의 정당성은 Task 7 검증이 DB 제약으로 보장한다.

- [ ] **Step 2: 스크립트를 더한다**

`package.json` 의 `scripts` 에 추가한다.

```json
"v2:canonical": "tsx --env-file-if-exists=.env src/v2/load-canonical.ts",
```

- [ ] **Step 3: 적재한다**

Run:
```bash
npm run typecheck
npm run v2:canonical
```
Expected:

```
  pack                      117
  pack_text                 351
  pack_tag                  184
  pack_category_path        202
  floor_pack                288
  field_gap                  63
  field_source             ~900
```

`pack_category_path` 202 = 2단 85팩 + 1단 32팩. `field_gap` 63 =
`textColor` 61 + `unlockCode` 2.

- [ ] **Step 4: 커밋**

```bash
git add src/v2/load-canonical.ts package.json
git commit -m "feat(v2): canonical 적재기 — 팩 계열"
```

---

## Task 7: canonical 검증

**Files:**
- Create: `src/v2/verify-canonical.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: `PrismaClient`
- Produces: `npm run v2:verify:canonical`. 실패 시 종료 코드 1

- [ ] **Step 1: 검증기를 쓴다**

`src/v2/verify-canonical.ts`:

```ts
/**
 * canonical 층 검증 — 팩 계열.
 *
 * 변환기 테스트(packs.test.ts)가 판정 규칙을 보장하고, 이 스크립트가
 * 원본 전량에 대한 결과를 실측 기준값과 대조한다.
 *
 * 실행: npm run v2:verify:canonical
 */
import { PrismaClient } from './generated/client.js';

interface Check {
	name: string;
	ok: boolean;
	detail: string;
}

async function main(): Promise<void> {
	const prisma = new PrismaClient();
	const checks: Check[] = [];
	const eq = (name: string, got: number, want: number): void => {
		checks.push({ name, ok: got === want, detail: `${got.toLocaleString()} / ${want.toLocaleString()}` });
	};

	try {
		eq('pack', await prisma.pack.count(), 117);
		eq('pack_text', await prisma.packText.count(), 351);
		eq('pack_tag', await prisma.packTag.count(), 184);
		eq('pack_category_path', await prisma.packCategoryPath.count(), 202);
		eq('floor_pack', await prisma.floorPack.count(), 288);

		eq('tag 유일 종수', (await prisma.packTag.findMany({ distinct: ['tag'], select: { tag: true } })).length, 47);

		const byCategory = await prisma.pack.groupBy({ by: ['category'], _count: { _all: true } });
		const cat = Object.fromEntries(byCategory.map((r) => [r.category, r._count._all]));
		const wantCat: Record<string, number> = {
			canto: 27, sin: 21, extreme: 21, event: 18, keyword: 14, railway: 6, attack_type: 6, walpurgis: 4,
		};
		checks.push({
			name: '분류별 팩 수',
			ok: JSON.stringify(cat) === JSON.stringify(Object.fromEntries(Object.entries(wantCat).sort())),
			detail: JSON.stringify(cat),
		});

		eq('chapter 보유', await prisma.pack.count({ where: { chapter: { not: null } } }), 27);
		eq('variant 보유', await prisma.pack.count({ where: { variant: { not: null } } }), 27);
		eq('bokgak true', await prisma.pack.count({ where: { bokgak: true } }), 6);
		eq('overlaySprite 보유', await prisma.pack.count({ where: { overlaySprite: { not: null } } }), 41);
		eq('textColor 보유', await prisma.pack.count({ where: { textColor: { not: null } } }), 56);
		eq('unlockCode 보유', await prisma.pack.count({ where: { unlockCode: { not: null } } }), 115);

		eq('결손 textColor', await prisma.fieldGap.count({ where: { field: 'textColor' } }), 61);
		eq('결손 unlockCode', await prisma.fieldGap.count({ where: { field: 'unlockCode' } }), 2);
		eq('결손 합계', await prisma.fieldGap.count(), 63);

		// 마스터북이 실측한 것 — 1309 는 loc 후행 공백을 쓰지 않는다
		const p1309 = await prisma.packText.findUnique({
			where: { packId_locale: { packId: '1309', locale: 'ko' } },
		});
		checks.push({
			name: '1309 한국어에 후행 공백이 없다',
			ok: p1309 !== null && p1309.name === p1309.name.trimEnd(),
			detail: JSON.stringify(p1309?.name),
		});

		// sprite 는 두 출처가 전건 일치해야 한다
		const disagreed = await prisma.fieldSource.count({ where: { field: 'sprite', rule: 'disagreed' } });
		checks.push({ name: 'sprite 출처 간 불일치 (0이어야 한다)', ok: disagreed === 0, detail: `${disagreed} / 0` });

		// 6층 이상 구간과 mj 플래그가 정확히 대응한다
		const ranges = await prisma.$queryRaw<Array<{ floor_range: string; n: bigint; sup: bigint; ext: bigint }>>`
			SELECT f.floor_range,
			       count(*)::bigint                             AS n,
			       count(*) FILTER (WHERE p.superposition)::bigint AS sup,
			       count(*) FILTER (WHERE p.extreme)::bigint       AS ext
			FROM canonical.floor_pack f
			JOIN canonical.pack p ON p.id = f.pack_id
			WHERE f.floor_range IN ('6-10', '11-15')
			GROUP BY f.floor_range
		`;
		const r610 = ranges.find((r) => r.floor_range === '6-10');
		const r1115 = ranges.find((r) => r.floor_range === '11-15');
		checks.push({
			name: '6-10 구간은 전부 superposition',
			ok: Number(r610?.n ?? 0n) === 46 && Number(r610?.sup ?? 0n) === 46,
			detail: `${Number(r610?.sup ?? 0n)} / ${Number(r610?.n ?? 0n)} (46 기대)`,
		});
		checks.push({
			name: '11-15 구간은 전부 extreme',
			ok: Number(r1115?.n ?? 0n) === 24 && Number(r1115?.ext ?? 0n) === 24,
			detail: `${Number(r1115?.ext ?? 0n)} / ${Number(r1115?.n ?? 0n)} (24 기대)`,
		});

		// ── 마스터북 완전 일치 쌍 재현 — 1–5층에서 mj 와 assets 가 218/218 ──
		// canonical 이 아니라 raw 를 직접 맞댄다. 이 층의 존재 이유다(스펙 2.1).
		const floors = await prisma.$queryRaw<Array<{ mj: bigint; assets: bigint; only_mj: bigint; only_assets: bigint }>>`
			WITH mj AS (
			  SELECT id AS pack_id, 'normal' AS difficulty,
			         jsonb_array_elements_text(payload->'normalFloors') AS floor
			  FROM raw.raw_object
			  WHERE src_path = 'packs/limbus-data-mj/packs.json' AND payload ? 'normalFloors'
			  UNION ALL
			  SELECT id, 'hard', jsonb_array_elements_text(payload->'hardFloors')
			  FROM raw.raw_object
			  WHERE src_path = 'packs/limbus-data-mj/packs.json' AND payload ? 'hardFloors'
			),
			assets AS (
			  SELECT o.id AS difficulty, r.key AS floor,
			         jsonb_array_elements_text(r.value) AS pack_id
			  FROM raw.raw_object o
			  CROSS JOIN LATERAL jsonb_each(o.payload) r
			  WHERE o.src_path = 'mirror-dungeon/limbus-assets/md_floor_packs.json'
			),
			a15 AS (SELECT pack_id, difficulty, floor FROM assets WHERE floor IN ('1','2','3','4','5'))
			SELECT (SELECT count(*) FROM mj)::bigint  AS mj,
			       (SELECT count(*) FROM a15)::bigint AS assets,
			       (SELECT count(*) FROM (SELECT * FROM mj EXCEPT SELECT * FROM a15) x)::bigint AS only_mj,
			       (SELECT count(*) FROM (SELECT * FROM a15 EXCEPT SELECT * FROM mj) y)::bigint AS only_assets
		`;
		const f = floors[0];
		checks.push({
			name: '1–5층 mj ↔ assets 완전 일치',
			ok:
				Number(f?.mj ?? 0n) === 218 &&
				Number(f?.assets ?? 0n) === 218 &&
				Number(f?.only_mj ?? 1n) === 0 &&
				Number(f?.only_assets ?? 1n) === 0,
			detail: `mj ${Number(f?.mj ?? 0n)} · assets ${Number(f?.assets ?? 0n)} · 차집합 ${Number(f?.only_mj ?? 0n)}/${Number(f?.only_assets ?? 0n)}`,
		});

		// 모든 팩이 최소 한 로케일 이름을 갖는다
		const noName = await prisma.pack.count({ where: { texts: { none: {} } } });
		checks.push({ name: '이름 없는 팩 (0이어야 한다)', ok: noName === 0, detail: `${noName} / 0` });
	} finally {
		await prisma.$disconnect();
	}

	console.log('');
	for (const c of checks) console.log(`${c.ok ? '  OK  ' : '  실패'} ${c.name.padEnd(36)} ${c.detail}`);
	const failed = checks.filter((c) => !c.ok);
	console.log('');
	if (failed.length === 0) {
		console.log(`검사 ${checks.length}건 전부 통과`);
		return;
	}
	console.error(`검사 ${failed.length}건 실패`);
	process.exitCode = 1;
}

await main();
```

- [ ] **Step 2: 스크립트를 더한다**

```json
"v2:verify:canonical": "tsx --env-file-if-exists=.env src/v2/verify-canonical.ts",
```

- [ ] **Step 3: 검증한다**

Run:
```bash
npm run typecheck
npm run v2:verify:canonical
```
Expected: 검사 24건 전부 통과

숫자가 어긋나면 **테스트를 고치지 말고 멈춘다.** 실측 기준값은 계획 상단에 근거가
있으므로, 원본이 바뀌었는지 변환이 틀렸는지부터 가른다.

- [ ] **Step 4: 전체 회귀를 확인한다**

Run:
```bash
npm test
npm run v2:verify
npm run schema:validate
npm run db:ddl -- -c "SELECT count(*) FROM public.gift"
```
Expected: 전부 통과 · `public.gift` 456

- [ ] **Step 5: 커밋**

```bash
git add src/v2/verify-canonical.ts package.json
git commit -m "feat(v2): canonical 검증 — 팩 계열 실측 대조 21건"
```

---

## 완료 판정

```
1. canonical.pack 117종이 있다                    npm run v2:verify:canonical
2. 표시명이 3로케일로 351행                        ja 포함
3. 결손 63건이 field_gap 에 특정됐다               textColor 61 · unlockCode 2
4. 판정 근거가 field_source 에 남았다              규칙별 집계 출력
5. 계획 1이 안 깨졌다                             npm run v2:verify 13건
6. 현행이 그대로 돈다                             public.gift 456 · schema:validate
```

## 이 계획이 남기는 것

`src/v2/source.ts` 와 `src/v2/canonical/meta.ts` 는 **이후 모든 계열이 쓴다.**
계획 3(기프트)부터는 `src/v2/canonical/<계열>.ts` 를 더하고 적재기에 한 줄을
추가하는 형태가 된다.

팩 계열에서 미룬 것 5종(`bossEncounters` · `exclusive_gifts` · `gifts` ·
`eventPool` · `mapGen`)은 **뒤 계열이 생기면 그때 연결한다.** 원본은 이미
`raw` 에 있다.
