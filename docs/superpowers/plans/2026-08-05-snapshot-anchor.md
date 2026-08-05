# 기준점 심기 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `canonical` 이 자기 출처를 알게 하고, 저작 사실 셋을 `app` 으로 내려 재빌드가 아무것도 잃지 않게 만든다.

**Architecture:** 저작 사실 셋(`TRIGGER_EXCEPTION` · `TOKEN_EXCEPTION` · `EGO_GRANTED`)을 `app` 표 둘로 내리고, 적재기는 그것을 **입력으로 받는다**(상수를 안 갖는다). `canonical.build_info` 1행이 「어느 스냅샷 · 어느 커밋 · 어떤 저작으로 구웠나」를 적고, `v2:verify:rebuild` 가 그 셋을 다시 재어 같으면 다시 구워 전수 대조한다. 파싱 규칙(`DENOMINATOR` 정규식)은 코드에 남는다.

**Tech Stack:** TypeScript (ESM · `.js` 확장자 import) · Prisma `multiSchema` · PostgreSQL 17 · `node:test` · tsx

## Global Constraints

- 설계는 [`docs/superpowers/specs/2026-08-05-snapshot-anchor-design.md`](../specs/2026-08-05-snapshot-anchor-design.md). 절 번호는 그 문서를 가리킨다.
- **`canonical` 의 값을 바꾸지 않는다.** 표 셋이 늘고 열 하나가 늘 뿐이다. 검사 203건은 그대로 통과해야 한다.
- **`app → canonical` FK 를 걸지 않는다** (설계 6.1). 승격 때 재조준 대상이 늘어난다. 무결성은 적재기 선검사로 지킨다.
- **`canonical → raw` FK 를 걸지 않는다** (설계 6.2). 같은 이유다.
- import 는 항상 `.js` 확장자를 붙인다 (ESM). 예: `import { x } from './y.js'`.
- 순수 함수와 DB 접근을 가른다 — 순수한 쪽은 DB 없이 테스트한다 (`schema-ops.ts` 가 선례다).
- 테스트 실행은 `npm test` (`tsx --test "lib/**/*.test.ts" "src/**/*.test.ts"`). 기준선은 **432 pass / 0 fail / 12 skip**.
- 타입 검사는 `npm run typecheck` (`tsconfig.pipeline.json` · `tsconfig.json` 둘 다).
- DB 는 `docker exec limbus-postgres psql -U postgres -d limbus`.
- 커밋 메시지는 한국어. Conventional Commits. 본문은 「왜」가 자명하지 않을 때만.

## 파일 구조

| 파일 | 책임 | 상태 |
| --- | --- | --- |
| `prisma/v2/schema.prisma` | 표 셋 추가 · `field_source` 열 하나 | 수정 |
| `prisma/v2/views.sql` | `build_info` 의 `CHECK (id = 1)` | 수정 |
| `src/v2/authored.ts` | `app` 저작 표를 읽고 지문을 잰다. 순수부 분리 | **신규** |
| `src/v2/authored.test.ts` | 지문 산출·선검사의 순수부 테스트 | **신규** |
| `src/v2/seed-authored.ts` | 초기 7행 심기. 있으면 건너뛴다 | **신규** |
| `src/v2/canonical/axis.ts` | `TRIGGER_EXCEPTION` 상수 제거 → 입력 | 수정 |
| `src/v2/canonical/gift-trigger-param.ts` | `TOKEN_EXCEPTION` 상수 제거 → 입력. `DENOMINATOR` 는 남는다 | 수정 |
| `src/v2/canonical/identity-axis.ts` | `EGO_GRANTED` 상수 제거 → 입력 | 수정 |
| `src/v2/load-canonical.ts` | `app` 에서 읽어 셋에 넘긴다 · 선검사 · `build_info` 쓰기 · `field_source.snapshotId` | 수정 |
| `src/v2/verify-rebuild.ts` | 등식 검사. 입력 지문 → 재빌드 → 전수 대조 | **신규** |
| `src/v2/diff-canonical.ts` | `entityDiff` · `tableNames` 를 export | 수정 |
| `src/v2/reproduce.ts` | `app` 을 DROP 대상에서 뺀다 · `built_at` 을 걸러낸다 | 수정 |
| `src/v2/verify-canonical.ts` | 새 검사 넷 | 수정 |
| `docs/adr/08-authored-facts-as-data.md` | 경계 재정의 | **신규** |

---

### Task 1: `app` 저작 표 둘 — 스키마 · 시드 · 검사

`app.ref_exception` 3행과 `app.ego_granted_axis` 4행을 만들고 심는다. 아직 아무도 읽지 않는다 — 읽는 것은 Task 3 이다.

**Files:**
- Modify: `prisma/v2/schema.prisma`
- Create: `src/v2/seed-authored.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: 없음
- Produces: Prisma 모델 `RefException { kind, key, refKind, refId, note }` · `EgoGrantedAxis { egoId, axisId, note }`. `npm run v2:seed:authored`.

- [ ] **Step 1: 모델 둘을 스키마에 넣는다**

`prisma/v2/schema.prisma` 의 `model FieldOverride` 바로 뒤에 붙인다 (같은 `app` 스키마 구역이다).

```prisma
/// 이름 매칭이 못 푸는 참조. **게임의 사실이며 규칙이 아니다** — 규칙은 코드에 있다.
///
///   kind='trigger'  키는 트리거 표시명.  'Bloodfiend Identities'
///   kind='token'    키는 desc 안의 브래킷 토큰.  'BLOODDINNER'
///
/// canonical 을 가리키지만 FK 는 걸지 않는다(ADR-08). 승격 때 재조준 대상이
/// 늘어난다. 대신 적재기가 선검사한다 — 없는 ref_id 면 build 가 거기서 멈춘다.
model RefException {
  kind    String
  key     String
  refKind String @map("ref_kind")
  refId   String @map("ref_id")
  /// 왜 이 값인가. 근거를 사람 말로 남긴다
  note    String

  @@id([kind, key])
  @@map("ref_exception")
  @@schema("app")
}

/// 「이 인격은 [X]를 부여하는 인격으로 취급됨」을 게임이 명시한 E.G.O.
///
/// **증폭기는 여기 없다.** 20705 홀리데이는 ego_status 로 축 7개를 받지만
/// 「부여하는 인격으로 취급」이 아니라 위력 +1 이다. 어느 축의 인격도 아니다.
model EgoGrantedAxis {
  egoId  String @map("ego_id")
  axisId String @map("axis_id")
  note   String

  @@id([egoId, axisId])
  @@map("ego_granted_axis")
  @@schema("app")
}
```

- [ ] **Step 2: 스키마가 유효한지 보고 DDL 을 다시 낸다**

```bash
npm run v2:schema:validate
npm run v2:schema:ddl
git diff --stat prisma/v2/schema.sql
```

기대: `schema.sql` 에 `app.ref_exception` · `app.ego_granted_axis` 문장이 늘어난다. **`canonical` 문장은 하나도 안 바뀌어야 한다.**

```bash
git diff prisma/v2/schema.sql | grep -c '"canonical"'
```

기대: `0`. 0 이 아니면 멈추고 왜 canonical 이 바뀌었는지 본다.

- [ ] **Step 3: 살아있는 DB 에 표 둘을 만든다**

`v2:build` 를 안 돌리고 표만 더한다 — `canonical` 을 안 건드리는 변경이라 그렇게 할 수 있다.

```bash
docker exec -i limbus-postgres psql -U postgres -d limbus <<'SQL'
CREATE TABLE IF NOT EXISTS "app"."ref_exception" (
    "kind" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "ref_kind" TEXT NOT NULL,
    "ref_id" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    CONSTRAINT "ref_exception_pkey" PRIMARY KEY ("kind","key")
);
CREATE TABLE IF NOT EXISTS "app"."ego_granted_axis" (
    "ego_id" TEXT NOT NULL,
    "axis_id" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    CONSTRAINT "ego_granted_axis_pkey" PRIMARY KEY ("ego_id","axis_id")
);
SQL
```

확인:

```bash
docker exec limbus-postgres psql -U postgres -d limbus -tAc \
  "SELECT table_name FROM information_schema.tables WHERE table_schema='app' ORDER BY 1"
```

기대: 8줄 (기존 6 + 새 2).

- [ ] **Step 4: Prisma 클라이언트를 다시 낸다**

```bash
npm run v2:generate
```

- [ ] **Step 5: 시드 스크립트를 쓴다**

`src/v2/seed-authored.ts` 를 만든다. **`skipDuplicates` 로 초기 심기 전용이다** — 이미 있는 행은 안 덮는다. DB 가 정본이고 이 파일은 빈 DB 를 채우는 용도다.

```typescript
/**
 * 저작 사실 초기 심기.
 *
 * **이미 있는 행은 안 덮는다.** DB 가 정본이고 이 파일은 빈 DB 를 채우는
 * 용도다. 값을 고치려면 DB 에서 고친다 — 그러면 build_info 의
 * authored_digest 가 달라지고, v2:verify:rebuild 가 「저작이 바뀌었다」로
 * 보고한다(설계 결정 4).
 *
 * 실행: npm run v2:seed:authored
 */
import { PrismaClient } from './generated/client.js';

const REF_EXCEPTION = [
	{
		kind: 'trigger', key: 'Bloodfiend Identities',
		refKind: 'unit_keyword', refId: 'BLOODFIEND',
		note: 'Bloodfiend 는 소속이 아니라 유닛 키워드다. 이름 매칭으로 풀면 association 으로 잘못 붙는다',
	},
	{
		kind: 'trigger', key: 'Yurodivy Identities',
		refKind: 'association', refId: 'YURODIVY',
		note: '소속은 YURODIVY 인데 표시명이 Yurodiviye 라 이름 매칭이 안 붙는다',
	},
	{
		kind: 'token', key: 'BLOODDINNER',
		refKind: 'unit_keyword', refId: 'BLOODFIEND',
		note: '9795 떨어진 한 방울. BloodDinner 는 status_category 에 없어 축으로 못 닿지만 그 기프트의 Bloodfiend Identities 트리거가 정확히 그 조건이다',
	},
];

const EGO_GRANTED_AXIS = [
	{ egoId: '20509', axisId: 'LACERATION', note: '착영휘도 — 「이 인격은 [Laceration], [Breath]을 부여하는 인격으로 취급됨」' },
	{ egoId: '20509', axisId: 'BREATH', note: '착영휘도 — 「이 인격은 [Laceration], [Breath]을 부여하는 인격으로 취급됨」' },
	{ egoId: '20109', axisId: 'VIBRATION', note: '엄숙한 애도 — 「이 인격은 [Vibration], [Sinking]을 부여하는 인격으로 취급됨」' },
	{ egoId: '20109', axisId: 'SINKING', note: '엄숙한 애도 — 「이 인격은 [Vibration], [Sinking]을 부여하는 인격으로 취급됨」' },
];

async function main(): Promise<void> {
	const prisma = new PrismaClient();
	try {
		const a = await prisma.refException.createMany({ data: REF_EXCEPTION, skipDuplicates: true });
		const b = await prisma.egoGrantedAxis.createMany({ data: EGO_GRANTED_AXIS, skipDuplicates: true });
		const totalA = await prisma.refException.count();
		const totalB = await prisma.egoGrantedAxis.count();
		console.log(`ref_exception     새로 ${a.count}행 · 합계 ${totalA}`);
		console.log(`ego_granted_axis  새로 ${b.count}행 · 합계 ${totalB}`);
		if (totalA !== 3 || totalB !== 4) {
			console.error(`기대와 다르다 — ref_exception 3 · ego_granted_axis 4 여야 한다`);
			process.exitCode = 1;
		}
	} finally {
		await prisma.$disconnect();
	}
}

await main();
```

- [ ] **Step 6: 스크립트를 등록한다**

`package.json` 의 `"v2:canonical"` 줄 바로 뒤에 넣는다.

```json
"v2:seed:authored": "tsx --env-file-if-exists=.env src/v2/seed-authored.ts",
```

- [ ] **Step 7: 심고 확인한다**

```bash
npm run v2:seed:authored
```

기대:

```
ref_exception     새로 3행 · 합계 3
ego_granted_axis  새로 4행 · 합계 4
```

한 번 더 돌린다 — **멱등이어야 한다.**

```bash
npm run v2:seed:authored
```

기대: `새로 0행 · 합계 3` · `새로 0행 · 합계 4`.

- [ ] **Step 8: 타입 검사와 커밋**

```bash
npm run typecheck
git add prisma/v2/schema.prisma prisma/v2/schema.sql src/v2/seed-authored.ts package.json
git commit -m "feat(v2): app 에 저작 사실 표 둘 — ref_exception · ego_granted_axis

이름 매칭이 못 푸는 참조와 축을 부여하는 E.G.O 를 데이터로 내린다. 아직
아무도 읽지 않는다 — 적재기 배선은 다음 커밋이다.

FK 는 걸지 않는다. app → canonical FK 는 승격 때 재조준 대상이 되어 교체를
무겁게 만든다(ADR-07 3.2). 무결성은 적재기 선검사로 지킨다.

시드는 skipDuplicates 다. DB 가 정본이고 이 파일은 빈 DB 를 채우는 용도다."
```

---

### Task 2: 적재기 셋이 저작을 입력으로 받는다

상수 셋을 지우고 입력으로 바꾼다. **아직 `app` 에서 안 읽는다** — 호출부는 Task 3 에서 바꾼다. 이 Task 는 순수 함수의 서명만 바꾸고 테스트로 지킨다.

**Files:**
- Modify: `src/v2/canonical/axis.ts`
- Modify: `src/v2/canonical/axis.test.ts`
- Modify: `src/v2/canonical/gift-trigger-param.ts`
- Modify: `src/v2/canonical/gift-trigger-param.test.ts`
- Modify: `src/v2/canonical/identity-axis.ts`
- Modify: `src/v2/canonical/identity-axis.test.ts`
- Modify: `src/v2/load-canonical.ts` (호출부를 상수 리터럴로 임시 유지)

**Interfaces:**
- Consumes: 없음 (순수 함수)
- Produces:
  - `AxisInput` 에 `refException: Array<{ kind: string; key: string; refKind: string; refId: string }>` 추가
  - `GiftTriggerParamInput` 에 같은 타입의 `refException` 추가
  - `IdentityAxisInput` 에 `egoGranted: Array<{ egoId: string; axisId: string }>` 추가
  - **셋 다 같은 `refException` 배열을 받는다.** 각자 자기 `kind` 만 걸러 쓴다.

- [ ] **Step 1: 실패하는 테스트를 쓴다 — `axis.test.ts`**

기존 테스트가 `TRIGGER_EXCEPTION` 의 효과를 확인하는 자리를 찾아 입력 주입 형태로 바꾼다. 아래를 `src/v2/canonical/axis.test.ts` 끝에 더한다.

```typescript
test('예외 표는 입력으로 온다 — 상수가 아니다', () => {
	const meta = new Meta();
	const t = buildAxis({
		statusCategory: [],
		statusTextEn: [],
		associationTextEn: [],
		triggerIds: ['Bloodfiend Identities'],
		effectIds: [],
		sinIds: [],
		refException: [
			{ kind: 'trigger', key: 'Bloodfiend Identities', refKind: 'unit_keyword', refId: 'BLOODFIEND' },
		],
	}, meta);

	const row = t.triggerRef.find((r) => r.triggerId === 'Bloodfiend Identities');
	assert.equal(row?.refKind, 'unit_keyword');
	assert.equal(row?.refId, 'BLOODFIEND');
});

test('예외 표를 안 주면 그 트리거는 결손이 된다', () => {
	const meta = new Meta();
	const t = buildAxis({
		statusCategory: [],
		statusTextEn: [],
		associationTextEn: [],
		triggerIds: ['Bloodfiend Identities'],
		effectIds: [],
		sinIds: [],
		refException: [],
	}, meta);

	assert.equal(t.triggerRef.filter((r) => r.triggerId === 'Bloodfiend Identities').length, 0);
});

test('token kind 는 axis 가 안 본다 — 자기 kind 만 거른다', () => {
	const meta = new Meta();
	const t = buildAxis({
		statusCategory: [],
		statusTextEn: [],
		associationTextEn: [],
		triggerIds: ['BLOODDINNER'],
		effectIds: [],
		sinIds: [],
		refException: [
			{ kind: 'token', key: 'BLOODDINNER', refKind: 'unit_keyword', refId: 'BLOODFIEND' },
		],
	}, meta);

	assert.equal(t.triggerRef.filter((r) => r.triggerId === 'BLOODDINNER').length, 0);
});
```

- [ ] **Step 2: 실패를 확인한다**

```bash
npx tsx --test src/v2/canonical/axis.test.ts 2>&1 | tail -20
```

기대: FAIL — `refException` 이 `AxisInput` 에 없다는 타입 오류, 또는 런타임에서 세 테스트 실패.

- [ ] **Step 3: `axis.ts` 를 고친다**

`const TRIGGER_EXCEPTION: Record<...> = { ... };` 블록(주석 포함 `axis.ts:20-29`)을 통째로 지운다. `AxisInput` 에 필드를 더한다.

```typescript
export interface AxisInput {
	statusCategory: Array<{ statusId: string; category: string }>;
	statusTextEn: Array<{ statusId: string; name: string }>;
	associationTextEn: Array<{ associationId: string; name: string }>;
	triggerIds: string[];
	effectIds: string[];
	sinIds: string[];
	/**
	 * 이름 매칭이 못 푸는 참조. `app.ref_exception` 에서 온다(ADR-08).
	 * **`kind='trigger'` 만 본다** — 같은 배열을 gift-trigger-param 도 받고
	 * 거기서는 `kind='token'` 만 본다.
	 */
	refException: Array<{ kind: string; key: string; refKind: string; refId: string }>;
}
```

본문에서 `TRIGGER_EXCEPTION[id]` 를 쓰던 자리(`axis.ts:141` 부근)를 맵 조회로 바꾼다. 함수 앞쪽, 반복문 **밖에** 맵을 만든다.

```typescript
	// 예외 표를 맵으로 굳힌다. 반복문 안에서 매번 filter 하면 O(n²) 다
	const triggerExc = new Map(
		input.refException
			.filter((e) => e.kind === 'trigger')
			.map((e) => [e.key, { refKind: e.refKind, refId: e.refId }]),
	);
```

그리고 소비 자리:

```typescript
		// 1) 예외 표가 먼저다
		const exc = triggerExc.get(id);
		if (exc !== undefined) { push(exc.refKind, exc.refId); continue; }
```

- [ ] **Step 4: 통과를 확인한다**

```bash
npx tsx --test src/v2/canonical/axis.test.ts 2>&1 | tail -8
```

기대: 전부 pass.

- [ ] **Step 5: `gift-trigger-param.ts` 의 테스트를 쓴다**

`src/v2/canonical/gift-trigger-param.test.ts` 끝에 더한다.

```typescript
test('토큰 예외는 입력으로 온다 — 상수가 아니다', () => {
	const meta = new Meta();
	const rows = buildGiftTriggerParam({
		giftDesc: [{ giftId: '9795', desc: '[BloodDinner]을 소모하는 스킬을 보유한 인격이 3인 이상' }],
		giftTrigger: [{ giftId: '9795', triggerId: 'Bloodfiend Identities' }],
		triggerRef: [{ triggerId: 'Bloodfiend Identities', refKind: 'unit_keyword', refId: 'BLOODFIEND', evaluability: 'roster' }],
		associationKo: [],
		giftSlots: [],
		axisIds: [],
		refException: [
			{ kind: 'token', key: 'BLOODDINNER', refKind: 'unit_keyword', refId: 'BLOODFIEND' },
		],
	}, meta);

	assert.equal(rows.find((r) => r.kind === 'min_count')?.value, '3');
});

test('trigger kind 는 gift-trigger-param 이 안 본다', () => {
	const meta = new Meta();
	const rows = buildGiftTriggerParam({
		giftDesc: [{ giftId: '9795', desc: '[BloodDinner]을 소모하는 스킬을 보유한 인격이 3인 이상' }],
		giftTrigger: [{ giftId: '9795', triggerId: 'Bloodfiend Identities' }],
		triggerRef: [{ triggerId: 'Bloodfiend Identities', refKind: 'unit_keyword', refId: 'BLOODFIEND', evaluability: 'roster' }],
		associationKo: [],
		giftSlots: [],
		axisIds: [],
		refException: [
			{ kind: 'trigger', key: 'BLOODDINNER', refKind: 'unit_keyword', refId: 'BLOODFIEND' },
		],
	}, meta);

	// 토큰으로 못 닿으므로 게이트가 트리거에 안 붙는다
	assert.equal(rows.filter((r) => r.kind === 'min_count').length, 0);
});

test('DENOMINATOR 는 코드에 남는다 — 입력으로 안 받는다', () => {
	const meta = new Meta();
	const rows = buildGiftTriggerParam({
		giftDesc: [{ giftId: '9088', desc: '화상 스킬을 보유한 인격이 5인 이상. 대기 인원 제외' }],
		giftTrigger: [{ giftId: '9088', triggerId: 'Allies have Burn Skill' }],
		triggerRef: [{ triggerId: 'Allies have Burn Skill', refKind: 'axis', refId: 'BURN', evaluability: 'roster' }],
		associationKo: [],
		giftSlots: [],
		axisIds: ['BURN'],
		refException: [],
	}, meta);

	assert.equal(rows.find((r) => r.kind === 'denominator')?.value, 'field');
});
```

- [ ] **Step 6: 실패를 확인하고 `gift-trigger-param.ts` 를 고친다**

```bash
npx tsx --test src/v2/canonical/gift-trigger-param.test.ts 2>&1 | tail -20
```

기대: FAIL.

`const TOKEN_EXCEPTION: Record<...> = { BLOODDINNER: ... };` 블록(주석 포함 `gift-trigger-param.ts:45-56`)을 지운다. **`DENOMINATOR` 는 건드리지 않는다.** `GiftTriggerParamInput` 에 필드를 더한다.

```typescript
	/**
	 * `app.ref_exception` 에서 온다(ADR-08). **`kind='token'` 만 본다.**
	 * 같은 배열을 axis 도 받고 거기서는 `kind='trigger'` 만 본다.
	 */
	refException: Array<{ kind: string; key: string; refKind: string; refId: string }>;
```

토큰을 푸는 함수(`gift-trigger-param.ts:95` 부근의 지역 함수)가 `TOKEN_EXCEPTION` 을 직접 읽고 있다. 맵을 인자로 받게 바꾼다.

```typescript
// 시그니처에 더한다
	tokenExc: Map<string, { refKind: string; refId: string }>,
```

```typescript
		const ref = axes.has(id) ? { refKind: 'axis', refId: id } : tokenExc.get(id);
		if (ref === undefined) continue;
```

호출부(같은 파일 안)에서 맵을 만들어 넘긴다. 반복문 **밖**이다.

```typescript
	const tokenExc = new Map(
		input.refException
			.filter((e) => e.kind === 'token')
			.map((e) => [e.key, { refKind: e.refKind, refId: e.refId }]),
	);
```

- [ ] **Step 7: 통과를 확인한다**

```bash
npx tsx --test src/v2/canonical/gift-trigger-param.test.ts 2>&1 | tail -8
```

기대: 전부 pass.

- [ ] **Step 8: `identity-axis.ts` 의 테스트를 쓴다**

기존 `identity-axis.test.ts:3` 이 `EGO_GRANTED` 를 import 하고 `:79` 가 그 키를 단언한다. **그 두 줄을 지운다** — 상수가 사라지므로 컴파일이 안 된다. 대신 아래를 더한다.

```typescript
test('축을 주는 E.G.O 는 입력으로 온다 — 상수가 아니다', () => {
	const meta = new Meta();
	const rows = buildIdentityAxis({
		identityKeyword: [],
		identityStatus: [],
		statusCategory: [],
		axisIds: ['LACERATION', 'BREATH'],
		identity: [{ id: '10101', sinnerId: 1 }],
		ego: [{ id: '20509', sinnerId: 1 }],
		egoGranted: [
			{ egoId: '20509', axisId: 'LACERATION' },
			{ egoId: '20509', axisId: 'BREATH' },
		],
	}, meta);

	const got = rows.filter((r) => r.source === 'ego_granted').map((r) => r.axisId).sort();
	assert.deepEqual(got, ['BREATH', 'LACERATION']);
});

test('입력이 비면 ego_granted 행이 없다', () => {
	const meta = new Meta();
	const rows = buildIdentityAxis({
		identityKeyword: [],
		identityStatus: [],
		statusCategory: [],
		axisIds: ['LACERATION'],
		identity: [{ id: '10101', sinnerId: 1 }],
		ego: [{ id: '20509', sinnerId: 1 }],
		egoGranted: [],
	}, meta);

	assert.equal(rows.filter((r) => r.source === 'ego_granted').length, 0);
});
```

기존 「`EGO_GRANTED` 에 있으나 ego 에 없으면 결손으로 남는다」 테스트(`:90`)는 **결손 경로를 지키므로 남긴다.** 입력 주입 형태로 바꾼다.

```typescript
test('입력에 있으나 ego 에 없으면 결손으로 남는다', () => {
	const meta = new Meta();
	buildIdentityAxis({
		identityKeyword: [],
		identityStatus: [],
		statusCategory: [],
		axisIds: ['LACERATION'],
		identity: [{ id: '10101', sinnerId: 1 }],
		ego: [],
		egoGranted: [{ egoId: '20509', axisId: 'LACERATION' }],
	}, meta);

	assert.equal(meta.gaps.filter((g) => g.entity === 'ego' && g.entityId === '20509').length, 1);
});
```

- [ ] **Step 9: 실패를 확인하고 `identity-axis.ts` 를 고친다**

```bash
npx tsx --test src/v2/canonical/identity-axis.test.ts 2>&1 | tail -20
```

기대: FAIL.

`export const EGO_GRANTED: Record<string, string[]> = { ... };`(`identity-axis.ts:25` 부근, 주석 포함)을 지운다. `IdentityAxisInput` 에 더한다.

```typescript
	/**
	 * 축을 부여하는 E.G.O. `app.ego_granted_axis` 에서 온다(ADR-08).
	 * 증폭기는 여기 없다 — 위력 +1 은 「부여하는 인격으로 취급」이 아니다.
	 */
	egoGranted: Array<{ egoId: string; axisId: string }>;
```

소비 자리(`identity-axis.ts:93` 의 `for (const [egoId, axisIds] of Object.entries(EGO_GRANTED))`)를 바꾼다. **`egoId` 별로 묶어야 결손 보고가 E.G.O 당 한 번만 난다.**

```typescript
	const grantedByEgo = new Map<string, string[]>();
	for (const g of input.egoGranted) {
		const list = grantedByEgo.get(g.egoId);
		if (list === undefined) grantedByEgo.set(g.egoId, [g.axisId]);
		else list.push(g.axisId);
	}

	for (const [egoId, axisIds] of grantedByEgo) {
		const sinnerId = egoSinner.get(egoId);
		if (sinnerId === undefined) {
			// 저작 표가 실물을 앞질렀다. 조용히 넘기면 축이 통째로 빈다
			meta.gap('ego', egoId, 'axis', 'app.ego_granted_axis 에 있으나 ego 에 없다', EVIDENCE);
			continue;
		}
		for (const identityId of bySinner.get(sinnerId) ?? []) {
			for (const axisId of axisIds) {
				if (!axes.has(axisId)) continue;
				push(identityId, axisId, 'ego_granted', egoId);
			}
		}
	}
```

- [ ] **Step 10: 호출부를 임시로 채운다**

`load-canonical.ts` 가 아직 `app` 에서 안 읽으므로 컴파일이 깨진다. **이 Task 에서는 리터럴로 채워 넣는다** — Task 3 이 DB 읽기로 바꾼다.

`load-canonical.ts` 의 `const axisTables = buildAxis({` 앞에 넣는다.

```typescript
		// TODO(Task 3): app.ref_exception · app.ego_granted_axis 에서 읽는다
		const refException = [
			{ kind: 'trigger', key: 'Bloodfiend Identities', refKind: 'unit_keyword', refId: 'BLOODFIEND' },
			{ kind: 'trigger', key: 'Yurodivy Identities', refKind: 'association', refId: 'YURODIVY' },
			{ kind: 'token', key: 'BLOODDINNER', refKind: 'unit_keyword', refId: 'BLOODFIEND' },
		];
		const egoGranted = [
			{ egoId: '20509', axisId: 'LACERATION' },
			{ egoId: '20509', axisId: 'BREATH' },
			{ egoId: '20109', axisId: 'VIBRATION' },
			{ egoId: '20109', axisId: 'SINKING' },
		];
```

세 호출에 각각 더한다 — `buildAxis({ …, refException }, meta)` · `buildIdentityAxis({ …, egoGranted }, meta)` · `buildGiftTriggerParam({ …, refException }, meta)`.

- [ ] **Step 11: 전체 테스트와 타입 검사**

```bash
npm run typecheck
npm test 2>&1 | tail -8
```

기대: 타입 통과. 테스트는 **432 + 새로 더한 8 = 440 pass / 0 fail / 12 skip.**
(기존 `EGO_GRANTED` 키 단언 1건을 지웠으므로 실제 수는 439일 수 있다 — **실행 결과를 받아 적고, 0 fail 인지만 본다.**)

- [ ] **Step 12: 커밋**

```bash
git add src/v2/canonical/ src/v2/load-canonical.ts
git commit -m "refactor(v2): 저작 상수 셋을 입력으로 바꾼다

axis 의 TRIGGER_EXCEPTION · gift-trigger-param 의 TOKEN_EXCEPTION ·
identity-axis 의 EGO_GRANTED 를 지우고 입력으로 받는다. 순수 함수라
테스트가 값을 주입한다.

DENOMINATOR 는 남긴다. 정규식이고 순서가 의미를 가지며 desc 산문을 읽는
파싱 규칙이다 — 사실이 아니라 방법이다(ADR-08).

호출부는 아직 리터럴이다. app 에서 읽는 것은 다음 커밋이다."
```

---

### Task 3: `load-canonical` 이 `app` 에서 읽고 선검사한다

리터럴을 DB 읽기로 바꾸고, 저작이 가리키는 대상이 실재하는지 **굽기 전에** 확인한다.

**Files:**
- Create: `src/v2/authored.ts`
- Create: `src/v2/authored.test.ts`
- Modify: `src/v2/load-canonical.ts`

**Interfaces:**
- Consumes: Task 1 의 `prisma.refException` · `prisma.egoGrantedAxis`. Task 2 의 `refException` · `egoGranted` 입력 필드.
- Produces:
  - `readAuthored(prisma): Promise<Authored>` — `Authored = { refException: Array<{kind,key,refKind,refId}>; egoGranted: Array<{egoId,axisId}> }`
  - `unknownRefs(a: Authored, known: KnownIds): string[]` — 순수. 못 닿는 참조를 사람 말로 낸다
  - `KnownIds = { axisIds: Set<string>; unitKeywordIds: Set<string>; associationIds: Set<string>; egoIds: Set<string> }`
  - `authoredDigest(a: Authored): string` — 순수. sha256 hex

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`src/v2/authored.test.ts` 를 만든다. **DB 를 안 쓴다** — 순수부만 본다.

```typescript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { unknownRefs, authoredDigest, type Authored, type KnownIds } from './authored.js';

const KNOWN: KnownIds = {
	axisIds: new Set(['LACERATION', 'BREATH']),
	unitKeywordIds: new Set(['BLOODFIEND']),
	associationIds: new Set(['YURODIVY']),
	egoIds: new Set(['20509']),
};

const OK: Authored = {
	refException: [
		{ kind: 'trigger', key: 'Bloodfiend Identities', refKind: 'unit_keyword', refId: 'BLOODFIEND' },
		{ kind: 'trigger', key: 'Yurodivy Identities', refKind: 'association', refId: 'YURODIVY' },
	],
	egoGranted: [{ egoId: '20509', axisId: 'LACERATION' }],
};

test('전부 닿으면 빈 배열이다', () => {
	assert.deepEqual(unknownRefs(OK, KNOWN), []);
});

test('없는 ref_id 를 이름과 함께 낸다', () => {
	const bad: Authored = {
		refException: [{ kind: 'trigger', key: 'X Identities', refKind: 'unit_keyword', refId: 'NOPE' }],
		egoGranted: [],
	};
	const got = unknownRefs(bad, KNOWN);
	assert.equal(got.length, 1);
	assert.match(got[0] as string, /ref_exception/);
	assert.match(got[0] as string, /X Identities/);
	assert.match(got[0] as string, /NOPE/);
});

test('모르는 ref_kind 도 잡는다 — 조용히 통과시키지 않는다', () => {
	const bad: Authored = {
		refException: [{ kind: 'trigger', key: 'X', refKind: 'planet', refId: 'MARS' }],
		egoGranted: [],
	};
	assert.equal(unknownRefs(bad, KNOWN).length, 1);
});

test('없는 axis_id 를 잡는다', () => {
	const bad: Authored = { refException: [], egoGranted: [{ egoId: '20509', axisId: 'NOPE' }] };
	const got = unknownRefs(bad, KNOWN);
	assert.equal(got.length, 1);
	assert.match(got[0] as string, /ego_granted_axis/);
});

test('없는 ego_id 는 여기서 안 잡는다 — 결손으로 남는 경로다', () => {
	const bad: Authored = { refException: [], egoGranted: [{ egoId: '99999', axisId: 'LACERATION' }] };
	assert.deepEqual(unknownRefs(bad, KNOWN), []);
});

test('지문은 순서에 안 흔들린다', () => {
	const a: Authored = {
		refException: [
			{ kind: 'trigger', key: 'B', refKind: 'axis', refId: 'X' },
			{ kind: 'trigger', key: 'A', refKind: 'axis', refId: 'Y' },
		],
		egoGranted: [{ egoId: '2', axisId: 'Q' }, { egoId: '1', axisId: 'P' }],
	};
	const b: Authored = {
		refException: [
			{ kind: 'trigger', key: 'A', refKind: 'axis', refId: 'Y' },
			{ kind: 'trigger', key: 'B', refKind: 'axis', refId: 'X' },
		],
		egoGranted: [{ egoId: '1', axisId: 'P' }, { egoId: '2', axisId: 'Q' }],
	};
	assert.equal(authoredDigest(a), authoredDigest(b));
});

test('값이 하나만 달라도 지문이 달라진다', () => {
	const a: Authored = { refException: [{ kind: 'trigger', key: 'A', refKind: 'axis', refId: 'X' }], egoGranted: [] };
	const b: Authored = { refException: [{ kind: 'trigger', key: 'A', refKind: 'axis', refId: 'Y' }], egoGranted: [] };
	assert.notEqual(authoredDigest(a), authoredDigest(b));
});

test('note 는 지문에 안 들어간다 — 설명을 고쳐도 재빌드가 필요하지 않다', () => {
	const a: Authored = { refException: [{ kind: 'trigger', key: 'A', refKind: 'axis', refId: 'X' }], egoGranted: [] };
	assert.equal(authoredDigest(a).length, 64);
});
```

- [ ] **Step 2: 실패를 확인한다**

```bash
npx tsx --test src/v2/authored.test.ts 2>&1 | tail -10
```

기대: FAIL — `./authored.js` 를 못 찾는다.

- [ ] **Step 3: `authored.ts` 를 쓴다**

```typescript
/**
 * `app` 의 저작 사실을 읽고, 재는 곳.
 *
 * **읽는 것과 재는 것을 가른다** — `unknownRefs` 와 `authoredDigest` 는 순수라
 * DB 없이 테스트한다(`schema-ops.ts` 와 같은 방식).
 *
 * 지문에 `note` 는 안 넣는다. 설명을 고치는 것은 결과를 안 바꾸므로 재빌드를
 * 요구할 이유가 없다.
 */
import { createHash } from 'node:crypto';
import type { PrismaClient } from './generated/client.js';

export interface Authored {
	refException: Array<{ kind: string; key: string; refKind: string; refId: string }>;
	egoGranted: Array<{ egoId: string; axisId: string }>;
}

export interface KnownIds {
	axisIds: Set<string>;
	unitKeywordIds: Set<string>;
	associationIds: Set<string>;
	egoIds: Set<string>;
}

export async function readAuthored(prisma: PrismaClient): Promise<Authored> {
	const [refException, egoGranted] = await Promise.all([
		prisma.refException.findMany({
			select: { kind: true, key: true, refKind: true, refId: true },
		}),
		prisma.egoGrantedAxis.findMany({ select: { egoId: true, axisId: true } }),
	]);
	return { refException, egoGranted };
}

/**
 * 저작이 가리키는 대상이 실재하는가. **굽기 전에 본다.**
 *
 * `ego_id` 가 없는 것은 여기서 안 잡는다 — 그건 `identity-axis` 가 결손으로
 * 기록하는 경로이고, 저작 표가 실물을 앞지른 것이 곧 오류는 아니다.
 */
export function unknownRefs(a: Authored, known: KnownIds): string[] {
	const out: string[] = [];
	const pool: Record<string, Set<string>> = {
		axis: known.axisIds,
		unit_keyword: known.unitKeywordIds,
		association: known.associationIds,
	};

	for (const e of a.refException) {
		const set = pool[e.refKind];
		if (set === undefined) {
			out.push(`ref_exception ${e.kind}/${e.key} — 모르는 ref_kind '${e.refKind}'`);
			continue;
		}
		if (!set.has(e.refId)) {
			out.push(`ref_exception ${e.kind}/${e.key} — ${e.refKind} '${e.refId}' 가 canonical 에 없다`);
		}
	}

	for (const g of a.egoGranted) {
		if (!known.axisIds.has(g.axisId)) {
			out.push(`ego_granted_axis ${g.egoId} — axis '${g.axisId}' 가 canonical 에 없다`);
		}
	}

	return out;
}

/**
 * 저작 내용의 지문. **정렬해서 잰다** — DB 가 주는 순서에 흔들리면
 * 같은 입력이 다른 지문을 낸다.
 */
export function authoredDigest(a: Authored): string {
	const refs = a.refException
		.map((e) => `${e.kind} ${e.key} ${e.refKind} ${e.refId}`)
		.sort();
	const egos = a.egoGranted.map((g) => `${g.egoId} ${g.axisId}`).sort();
	const text = `ref_exception\n${refs.join('\n')}\nego_granted_axis\n${egos.join('\n')}\n`;
	return createHash('sha256').update(text).digest('hex');
}
```

- [ ] **Step 4: 통과를 확인한다**

```bash
npx tsx --test src/v2/authored.test.ts 2>&1 | tail -8
```

기대: 8 pass / 0 fail.

- [ ] **Step 5: `load-canonical.ts` 의 리터럴을 DB 읽기로 바꾼다**

Task 2 Step 10 에서 넣은 `TODO(Task 3)` 블록을 지우고, `import` 를 더한다.

```typescript
import { readAuthored, unknownRefs, type KnownIds } from './authored.js';
```

`buildAxis` 호출 **앞**에 넣는다 (`axisTables` 가 있어야 `axisIds` 를 알 수 있으므로 선검사는 그 **뒤**다).

```typescript
		const authored = await readAuthored(prisma);
		const { refException, egoGranted } = authored;
```

- [ ] **Step 6: 선검사를 건다**

`axisTables` 가 만들어진 **직후**, `buildIdentityAxis` **앞**에 넣는다. 이 자리여야 `axisIds` 를 알 수 있다.

```typescript
		// 저작이 가리키는 대상이 실재하는가. **굽기 전에 멈춘다** —
		// 못 닿는 참조를 안고 구우면 조용히 빈 축이 나온다
		const known: KnownIds = {
			axisIds: new Set(axisTables.axis.map((a) => a.id)),
			unitKeywordIds: new Set(vocab.unitKeyword.map((k) => k.id)),
			associationIds: new Set(sinners.association.map((a) => a.id)),
			egoIds: new Set(egos.ego.map((e) => e.id)),
		};
		const bad = unknownRefs(authored, known);
		if (bad.length > 0) {
			console.error('저작이 가리키는 대상이 canonical 에 없다. 굽지 않는다.');
			for (const line of bad) console.error(`  ${line}`);
			console.error('');
			console.error('  app.ref_exception · app.ego_granted_axis 를 고치거나,');
			console.error('  가리키는 대상이 원본에 생겼는지 확인한다.');
			throw new Error(`저작 참조 ${bad.length}건이 못 닿는다`);
		}
```

**`vocab.unitKeyword` 와 `sinners.association` 의 실제 이름을 먼저 확인한다:**

```bash
grep -n "unitKeyword\|association:" src/v2/canonical/vocab.ts src/v2/canonical/sinners.ts | head -10
```

이름이 다르면 위 코드의 접근 경로를 그 이름으로 바꾼다. **추측해서 쓰지 않는다.**

- [ ] **Step 7: 실제로 돌려 값이 안 바뀌는지 본다**

```bash
npm run v2:build 2>&1 | tail -20
npm run v2:diff 2>&1 | tail -30
```

기대: **표 셋이 늘고 `field_source` 에 열이 하나 느는 것 말고 값 차이가 0.**
(이 시점에는 아직 `build_info` 도 `snapshot_id` 열도 없으므로 **차이 0** 이 나와야 한다.)

차이가 있으면 멈추고 무엇이 달라졌는지 본다 — 저작을 데이터로 옮기면서 값이 바뀌었다는 뜻이다.

- [ ] **Step 8: 전체 검사와 커밋**

```bash
npm run typecheck
npm test 2>&1 | tail -8
```

```bash
git add src/v2/authored.ts src/v2/authored.test.ts src/v2/load-canonical.ts
git commit -m "feat(v2): 적재기가 app 에서 저작을 읽고 선검사한다

리터럴을 DB 읽기로 바꾼다. 굽기 전에 저작이 가리키는 대상이 canonical 에
실재하는지 확인하고, 못 닿으면 거기서 멈춘다 — 안고 구우면 조용히 빈 축이
나온다.

ego_id 결손은 여기서 안 잡는다. 저작 표가 실물을 앞지른 것이 곧 오류는
아니며 identity-axis 가 결손으로 기록하는 경로가 이미 있다.

지문에 note 를 안 넣는다. 설명을 고치는 것은 결과를 안 바꾼다."
```

---

### Task 4: `canonical.build_info` — 판 표식

「이 판이 무엇에서 나왔나」를 한 행으로 적는다.

**Files:**
- Modify: `prisma/v2/schema.prisma`
- Modify: `prisma/v2/views.sql`
- Modify: `src/v2/load-canonical.ts`
- Modify: `src/v2/verify-canonical.ts`

**Interfaces:**
- Consumes: Task 3 의 `authoredDigest`
- Produces: `prisma.buildInfo` — `{ id: 1, snapshotId, codeCommit, authoredDigest, builtAt, rowCount }`

- [ ] **Step 1: 모델을 넣는다**

`prisma/v2/schema.prisma` 의 `model FieldSource` 앞(canonical 공통 구역)에 넣는다.

```prisma
/// 이 판이 무엇에서 나왔나. **한 행만 존재한다** — CHECK (id = 1) 을 views.sql 이 건다.
///
/// snapshot_id 는 raw.snapshot 을 가리키지만 FK 는 걸지 않는다(ADR-08).
/// 걸면 canonical → raw 의존이 생겨 승격 때 재조준 대상이 는다.
model BuildInfo {
  id             Int      @id @default(1)
  snapshotId     String   @map("snapshot_id")
  /// 굽는 시점의 git HEAD. 더러운 작업트리는 뒤에 -dirty 가 붙는다
  codeCommit     String   @map("code_commit")
  /// app 저작 표 둘의 내용 sha256. note 는 안 들어간다
  authoredDigest String   @map("authored_digest")
  builtAt        DateTime @map("built_at") @db.Timestamptz(3)
  /// 구웠을 때의 canonical 행 수. 대조의 첫 관문
  rowCount       Int      @map("row_count")

  @@map("build_info")
  @@schema("canonical")
}
```

- [ ] **Step 2: `CHECK` 를 `views.sql` 에 더한다**

`prisma/v2/views.sql` 끝에 붙인다.

```sql
-- build_info 는 한 행만 존재한다. 두 행이 생기면 「어느 판이 진짜냐」에 답이 없다.
-- Prisma 가 CHECK 를 못 내므로 여기 둔다.
ALTER TABLE canonical.build_info
  DROP CONSTRAINT IF EXISTS build_info_single_row;
ALTER TABLE canonical.build_info
  ADD CONSTRAINT build_info_single_row CHECK (id = 1);
```

- [ ] **Step 3: `v2:build` 가 `views.sql` 을 어떻게 다루는지 확인한다**

**설계 10절의 열린 항목이다. 추측하지 않는다.**

```bash
grep -n "views.sql\|views" src/v2/build-canonical.ts src/v2/schema-ops.ts package.json
```

- `v2:build` 가 이미 `views.sql` 을 적용한다면 → 아무것도 안 한다.
- 안 한다면 → 지금 `canonical.v_identity_capability` 가 어떻게 살아남는지 확인하고(승격이 rename 으로 옮기므로 build 가 새로 만들어야 한다) 같은 자리에 `CHECK` 를 얹는다.

확인한 것을 설계 문서 10절에 실측으로 적는다.

- [ ] **Step 4: `load-canonical` 이 `build_info` 를 쓴다**

`import` 를 더한다.

```typescript
import { execFileSync } from 'node:child_process';
import { authoredDigest } from './authored.js';
```

git HEAD 를 얻는 함수를 `load-canonical.ts` 위쪽에 둔다.

```typescript
/**
 * 굽는 시점의 코드 판. 더러운 작업트리면 `-dirty` 를 붙인다 — 커밋만
 * 적으면 「그 커밋으로 구웠다」가 거짓이 된다.
 */
function codeCommit(): string {
	const head = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
	const dirty = execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim();
	return dirty === '' ? head : `${head}-dirty`;
}
```

적재의 **마지막**, `field_override` 적용이 끝난 뒤에 쓴다. 행 수는 그 시점에 센다.

```typescript
		// ── 판 표식 ────────────────────────────────────────────────
		// **맨 마지막이다.** 행 수가 최종값이어야 하고, 저작 지문도 이번에
		// 실제로 쓴 것이어야 한다
		const rowCount = await canonicalRowCount(prisma);
		await prisma.buildInfo.create({
			data: {
				id: 1,
				snapshotId,
				codeCommit: codeCommit(),
				authoredDigest: authoredDigest(authored),
				builtAt: new Date(),
				rowCount,
			},
		});
		console.log(`판 표식  스냅샷 ${snapshotId} · 커밋 ${codeCommit().slice(0, 12)} · ${rowCount.toLocaleString()}행`);
```

행 수를 세는 함수를 같은 파일에 둔다.

```typescript
/** canonical 전 표의 행 수 합계. build_info 자신은 뺀다 — 자기를 세면 값이 흔들린다 */
async function canonicalRowCount(prisma: PrismaClient): Promise<number> {
	const rows = await prisma.$queryRaw<Array<{ n: bigint }>>`
		SELECT COALESCE(SUM(n), 0) AS n FROM (
			SELECT (xpath('/row/c/text()',
			        query_to_xml(format('SELECT count(*) AS c FROM %I.%I', 'canonical', tablename),
			                     false, true, '')))[1]::text::bigint AS n
			  FROM pg_tables
			 WHERE schemaname = 'canonical' AND tablename <> 'build_info'
		) t`;
	return Number(rows[0]?.n ?? 0n);
}
```

- [ ] **Step 5: 검사를 더한다**

`src/v2/verify-canonical.ts` 에 넣는다. `eq` 헬퍼가 이미 있다(`:20`).

```typescript
		// ── 판 표식 ────────────────────────────────────────────────
		eq('build_info 행 수', await prisma.buildInfo.count(), 1);

		const bi = await prisma.buildInfo.findUnique({ where: { id: 1 } });
		checks.push({
			name: 'build_info 가 실재하는 스냅샷을 가리킨다',
			ok: bi !== null
			    && (await prisma.snapshot.count({ where: { id: bi.snapshotId } })) === 1,
			detail: bi === null ? '없다' : bi.snapshotId,
		});
		checks.push({
			name: 'build_info 의 커밋이 더럽지 않다',
			ok: bi !== null && !bi.codeCommit.endsWith('-dirty'),
			detail: bi === null ? '없다' : bi.codeCommit.slice(0, 20),
		});
```

**`-dirty` 검사는 경고성이다.** 개발 중에는 걸릴 수 있다. 검사 목록에는 두되, 이 PR 을 닫기 전 마지막 빌드는 깨끗한 트리에서 돌린다.

- [ ] **Step 6: 굽고 확인한다**

```bash
npm run v2:generate
npm run v2:schema:ddl
npm run v2:build 2>&1 | tail -20
```

```bash
docker exec limbus-postgres psql -U postgres -d limbus -tAc \
  "SELECT id, snapshot_id, left(code_commit,12), left(authored_digest,12), row_count FROM canonical.build_info"
```

기대: 1행 · `2026-07-25` · `152399` (또는 그 시점 행 수).

두 행이 안 들어가는지 본다:

```bash
docker exec limbus-postgres psql -U postgres -d limbus -c \
  "INSERT INTO canonical.build_info (id, snapshot_id, code_commit, authored_digest, built_at, row_count) VALUES (2,'x','y','z',now(),0)"
```

기대: `CHECK` 위반으로 거부.

- [ ] **Step 7: 커밋**

```bash
npm run typecheck && npm test 2>&1 | tail -6
git add prisma/v2/ src/v2/load-canonical.ts src/v2/verify-canonical.ts
git commit -m "feat(v2): canonical.build_info — 이 판이 무엇에서 나왔나

스냅샷 · 코드 커밋 · 저작 지문 · 행 수를 한 행에 적는다. 한 행 제약은
CHECK (id = 1) 로 DB 가 건다 — 두 행이 생기면 어느 판이 진짜냐에 답이 없다.

더러운 작업트리면 커밋 뒤에 -dirty 를 붙인다. 커밋만 적으면 「그 커밋으로
구웠다」가 거짓이 된다.

행 수에서 build_info 자신은 뺀다. 자기를 세면 값이 흔들린다."
```

---

### Task 5: `field_source.snapshot_id`

15,534행에 열을 더하고 백필한다. 스냅샷이 1건이라 추측이 없다.

**Files:**
- Modify: `prisma/v2/schema.prisma`
- Modify: `src/v2/load-canonical.ts`
- Modify: `src/v2/verify-canonical.ts`

**Interfaces:**
- Consumes: Task 4 의 `snapshotId` 지역 변수 (`load-canonical.ts:57` 의 `latestSnapshotId` 결과)
- Produces: `canonical.field_source.snapshot_id` 열

- [ ] **Step 1: 지금 스냅샷이 정말 1건인지 다시 확인한다**

**설계는 실측 시점의 사실이다. 구현 시점에 다시 잰다.**

```bash
docker exec limbus-postgres psql -U postgres -d limbus -tAc "SELECT id, version FROM raw.snapshot ORDER BY version"
docker exec limbus-postgres psql -U postgres -d limbus -tAc "SELECT count(*) FROM canonical.field_source"
```

기대: 1행 (`2026-07-25|1`) · `15534`.

**2건 이상이면 여기서 멈춘다.** 어느 스냅샷으로 백필할지가 추측이 되고, 그건 설계가 전제한 것이 아니다.

- [ ] **Step 2: 모델에 열을 더한다**

```prisma
model FieldSource {
  entity     String
  entityId   String   @map("entity_id")
  field      String
  /// mj-only · assets-only · loc-only · union · agreed · disagreed · game-verified · manual
  rule       String
  sources    String[]
  /// 이 값이 어느 스냅샷의 raw 에서 왔나. M6 증분이 오면 행마다 갈린다
  snapshotId String   @map("snapshot_id")

  @@id([entity, entityId, field])
  @@index([entity, rule])
  @@index([snapshotId])
  @@map("field_source")
  @@schema("canonical")
}
```

- [ ] **Step 3: 적재기가 채우게 한다**

`load-canonical.ts` 에서 `fieldSource` 행을 만드는 자리를 찾는다.

```bash
grep -n "fieldSource" src/v2/load-canonical.ts | head
```

행을 만드는 곳에 `snapshotId` 를 더한다. `snapshotId` 는 이미 `:57` 에서 잡혀 있으므로 그대로 쓴다.

**`meta.ts` 가 `fieldSource` 행을 모으고 있다면** 거기에 열을 더하는 대신, `load-canonical` 이 적재 직전에 `map` 으로 붙이는 쪽이 좁다.

```typescript
			data: meta.fieldSource.map((f) => ({ ...f, snapshotId })),
```

- [ ] **Step 4: 검사를 더한다**

`verify-canonical.ts` 에 넣는다.

```typescript
		eq('field_source snapshot_id 결손',
			await prisma.fieldSource.count({ where: { snapshotId: '' } }), 0);

		const fsSnaps = await prisma.fieldSource.groupBy({
			by: ['snapshotId'], _count: { _all: true },
		});
		checks.push({
			name: 'field_source 의 스냅샷이 전부 raw 에 있다',
			ok: (await Promise.all(fsSnaps.map(async (s) =>
				(await prisma.snapshot.count({ where: { id: s.snapshotId } })) === 1))).every(Boolean),
			detail: fsSnaps.map((s) => `${s.snapshotId} ${s._count._all.toLocaleString()}`).join(' · '),
		});
```

- [ ] **Step 5: 굽고 확인한다**

```bash
npm run v2:generate && npm run v2:schema:ddl
npm run v2:build 2>&1 | tail -20
```

```bash
docker exec limbus-postgres psql -U postgres -d limbus -tAc \
  "SELECT snapshot_id, count(*) FROM canonical.field_source GROUP BY 1"
```

기대: `2026-07-25|15534` 한 줄.

- [ ] **Step 6: 검사 203건이 그대로인지 본다**

```bash
npm run v2:verify:canonical 2>&1 | tail -15
```

기대: 전부 통과. **이 PR 은 `canonical` 의 값을 안 바꾼다.**

- [ ] **Step 7: 커밋**

```bash
npm run typecheck && npm test 2>&1 | tail -6
git add prisma/v2/ src/v2/load-canonical.ts src/v2/verify-canonical.ts
git commit -m "feat(v2): field_source 에 snapshot_id

지금은 15,534행 전부 2026-07-25 다 — 스냅샷이 1건이고 한 판을 통째로 굽기
때문이다. M6 증분이 오면 일부 필드만 새 스냅샷으로 갱신되고 그 순간
canonical 은 출처가 섞인다. 그때 이 열이 유일한 갱신 증거다.

지금 넣는 게 싸다. 채울 값의 후보가 하나뿐이라 추측이 없다."
```

---

### Task 6: `v2:verify:rebuild` — 등식을 검사한다

**이 PR 의 산출물이다.**

**Files:**
- Create: `src/v2/verify-rebuild.ts`
- Modify: `src/v2/diff-canonical.ts` (`entityDiff` · `tableNames` export)
- Modify: `package.json`

**Interfaces:**
- Consumes: Task 3 의 `readAuthored` · `authoredDigest`. Task 4 의 `prisma.buildInfo`. `diff-canonical.ts` 의 `entityDiff` · `tableNames`.
- Produces: `npm run v2:verify:rebuild`. 종료 코드 0(재현됨 · 입력이 바뀜) / 1(재현 실패 · 판정 불가).

- [ ] **Step 1: `diff-canonical.ts` 의 대조부를 export 한다**

`async function tableNames(` → `export async function tableNames(`
`async function entityDiff(` → `export async function entityDiff(`

`EntityDiff` 타입도 export 되어 있는지 본다. 안 되어 있으면 `export interface EntityDiff` 로 바꾼다.

```bash
grep -n "interface EntityDiff\|type EntityDiff" src/v2/diff-canonical.ts
```

- [ ] **Step 2: 실패하는 확인을 먼저 해 둔다**

이 Task 는 순수부가 얇아 단위 테스트보다 **실제 실행이 검증이다.** 대신 판정 문구를 상수로 빼서 테스트한다. `src/v2/verify-rebuild.ts` 에 둘 것을 먼저 `authored.test.ts` 에 더한다.

```typescript
import { verdictOf } from './verify-rebuild.js';

test('입력 같고 결과 같으면 재현됨', () => {
	assert.equal(verdictOf({ inputChanged: false, same: true }), 'reproduced');
});

test('입력이 바뀌었으면 결과가 달라도 실패가 아니다', () => {
	assert.equal(verdictOf({ inputChanged: true, same: false }), 'input-changed');
});

test('입력 같은데 결과가 다르면 경보다', () => {
	assert.equal(verdictOf({ inputChanged: false, same: false }), 'failed');
});

test('입력이 바뀌었는데 결과가 같아도 입력이 바뀐 것이다', () => {
	assert.equal(verdictOf({ inputChanged: true, same: true }), 'input-changed');
});
```

- [ ] **Step 3: 실패를 확인한다**

```bash
npx tsx --test src/v2/authored.test.ts 2>&1 | tail -10
```

기대: FAIL — `./verify-rebuild.js` 를 못 찾는다.

- [ ] **Step 4: `verify-rebuild.ts` 를 쓴다**

```typescript
/**
 * 등식 검사 — canonical = f(raw@스냅샷, app.저작, 코드@커밋) 이 참인가.
 *
 * **v2:reproduce 와 다르다.** 그건 수집기부터 전 과정을 다시 밟는 파괴적
 * 시험이다. 이건 canonical 만 다시 구워 전수 대조하고 아무것도 안 지운다.
 *
 * **v2:diff 와도 다르다.** diff 는 「승격하면 무엇이 바뀌나」(미래)를 보고,
 * 이건 「지금 것을 다시 만들 수 있나」(과거)를 본다.
 *
 * 실행: npm run v2:verify:rebuild
 */
import { execFileSync } from 'node:child_process';
import { PrismaClient } from './generated/client.js';
import { readAuthored, authoredDigest } from './authored.js';
import { entityDiff, tableNames } from './diff-canonical.js';

export type Verdict = 'reproduced' | 'input-changed' | 'failed' | 'undecidable';

/**
 * 판정. **입력이 먼저다** — 입력이 달라졌으면 결과가 다른 것이 정상이고,
 * 그때 「재현 실패」라고 말하면 거짓말이다(설계 결정 4).
 */
export function verdictOf(s: { inputChanged: boolean; same: boolean }): Verdict {
	if (s.inputChanged) return 'input-changed';
	return s.same ? 'reproduced' : 'failed';
}

function codeCommit(): string {
	const head = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
	const dirty = execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim();
	return dirty === '' ? head : `${head}-dirty`;
}

async function main(): Promise<void> {
	const prisma = new PrismaClient();
	try {
		console.log('등식 검사 — canonical = f(raw@스냅샷, app.저작, 코드@커밋)');
		console.log('');

		// ── 1. 판 표식 ────────────────────────────────────────────
		const n = await prisma.buildInfo.count();
		if (n !== 1) {
			console.error(`판정 불가 — build_info 가 ${n}행이다. 1행이어야 한다.`);
			console.error('  npm run v2:build 를 돌려 판 표식을 심는다.');
			process.exitCode = 1;
			return;
		}
		const bi = await prisma.buildInfo.findUniqueOrThrow({ where: { id: 1 } });
		console.log(`  구운 판   스냅샷 ${bi.snapshotId} · 커밋 ${bi.codeCommit.slice(0, 12)}`);
		console.log(`            저작 ${bi.authoredDigest.slice(0, 12)} · ${bi.rowCount.toLocaleString()}행`);

		// ── 2. 지금 입력의 지문 ────────────────────────────────────
		const nowAuthored = authoredDigest(await readAuthored(prisma));
		const nowCommit = codeCommit();
		const authoredChanged = nowAuthored !== bi.authoredDigest;
		const commitChanged = nowCommit !== bi.codeCommit;
		const inputChanged = authoredChanged || commitChanged;

		console.log('');
		console.log(`  저작      ${authoredChanged ? `바뀜 → ${nowAuthored.slice(0, 12)}` : '같다'}`);
		console.log(`  코드      ${commitChanged ? `바뀜 → ${nowCommit.slice(0, 12)}` : '같다'}`);

		// ── 3. 다시 굽고 대조한다 ──────────────────────────────────
		console.log('');
		console.log('  다시 굽는다 (npm run v2:build)');
		execFileSync('npm', ['run', 'v2:build'], { stdio: 'inherit' });

		const diffs = await prisma.$transaction(async (tx) => {
			await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
			const names = [...(await tableNames(tx, 'canonical'))].sort();
			const out = [];
			for (const t of names) {
				if (t === 'build_info') continue; // built_at 이 매번 다르다
				out.push(await entityDiff(tx, t));
			}
			return out;
		});

		const changed = diffs.filter((d) => d.added > 0 || d.removed > 0 || d.changed > 0);
		const same = changed.length === 0;

		// ── 4. 판정 ───────────────────────────────────────────────
		console.log('');
		const verdict = verdictOf({ inputChanged, same });
		if (verdict === 'reproduced') {
			console.log('재현됨 — 입력이 같고 결과가 같다');
			return;
		}
		if (verdict === 'input-changed') {
			console.log('입력이 바뀌었다 — 결과가 다른 것이 정상이다');
			if (authoredChanged) console.log('  app 저작 표가 달라졌다');
			if (commitChanged) console.log('  코드가 달라졌다');
			console.log(`  표 ${changed.length}개가 다르다`);
			for (const d of changed.slice(0, 10)) {
				console.log(`    ${d.table}  +${d.added} -${d.removed} ~${d.changed}`);
			}
			console.log('');
			console.log('  npm run v2:diff 로 자세히 보고 v2:promote 로 올린다.');
			return;
		}
		console.error('재현 실패 — 입력이 같은데 결과가 다르다');
		console.error('  누가 canonical 을 직접 건드렸을 수 있다.');
		for (const d of changed) {
			console.error(`    ${d.table}  +${d.added} -${d.removed} ~${d.changed}`);
		}
		process.exitCode = 1;
	} finally {
		await prisma.$disconnect();
	}
}

await main();
```

**`entityDiff` 의 반환 모양을 먼저 확인한다** — `added` · `removed` · `changed` · `table` 이 실제 이름인지 본다.

```bash
sed -n '/interface EntityDiff/,/^}/p' src/v2/diff-canonical.ts
```

이름이 다르면 위 코드를 그 이름으로 고친다. **추측해서 쓰지 않는다.**

- [ ] **Step 5: 통과를 확인한다**

```bash
npx tsx --test src/v2/authored.test.ts 2>&1 | tail -8
```

기대: 12 pass / 0 fail.

- [ ] **Step 6: 스크립트를 등록한다**

`package.json` 의 `"v2:verify:canonical"` 줄 바로 뒤.

```json
"v2:verify:rebuild": "tsx --env-file-if-exists=.env src/v2/verify-rebuild.ts",
```

- [ ] **Step 7: 세 갈래를 실제로 태운다**

**① 재현됨** — 깨끗한 트리에서 굽고 바로 검사한다.

```bash
git status --porcelain   # 비어야 한다
npm run v2:build && npm run v2:promote
npm run v2:verify:rebuild
```

기대: `재현됨`, 종료 코드 0.

**② 입력이 바뀜** — 저작을 한 줄 고친다.

```bash
docker exec limbus-postgres psql -U postgres -d limbus -c \
  "UPDATE app.ref_exception SET note = note || ' (시험)' WHERE key = 'BLOODDINNER'"
npm run v2:verify:rebuild
```

기대: **`재현됨`.** `note` 는 지문에 안 들어가므로(Task 3) 입력이 안 바뀐 것이다. 이게 그 설계의 실측 확인이다.

```bash
docker exec limbus-postgres psql -U postgres -d limbus -c \
  "UPDATE app.ref_exception SET ref_id = 'BLOODFIEND' WHERE key = 'BLOODDINNER'"
docker exec limbus-postgres psql -U postgres -d limbus -c \
  "INSERT INTO app.ego_granted_axis VALUES ('20509','BURN','시험')"
npm run v2:verify:rebuild
```

기대: `입력이 바뀌었다`, 종료 코드 0, 어느 표가 다른지 나온다.

되돌린다:

```bash
docker exec limbus-postgres psql -U postgres -d limbus -c \
  "DELETE FROM app.ego_granted_axis WHERE ego_id='20509' AND axis_id='BURN'"
docker exec limbus-postgres psql -U postgres -d limbus -c \
  "UPDATE app.ref_exception SET note = replace(note, ' (시험)', '')"
```

**③ 재현 실패** — `canonical` 을 직접 건드린다.

```bash
docker exec limbus-postgres psql -U postgres -d limbus -c \
  "UPDATE canonical.axis SET id = id WHERE false"   -- no-op 이라 안 잡힌다
docker exec limbus-postgres psql -U postgres -d limbus -c \
  "DELETE FROM canonical.identity_axis WHERE ctid IN (SELECT ctid FROM canonical.identity_axis LIMIT 1)"
npm run v2:verify:rebuild
```

기대: `재현 실패`, 종료 코드 1, `identity_axis` 가 목록에 나온다.

**되돌린다 — 반드시.**

```bash
npm run v2:build && npm run v2:promote
npm run v2:verify:canonical 2>&1 | tail -5
```

- [ ] **Step 8: 커밋**

```bash
npm run typecheck && npm test 2>&1 | tail -6
git add src/v2/verify-rebuild.ts src/v2/diff-canonical.ts src/v2/authored.test.ts package.json
git commit -m "feat(v2): v2:verify:rebuild — 등식을 전수로 검사한다

canonical = f(raw@스냅샷, app.저작, 코드@커밋) 이 참인지 다시 구워 대조한다.

입력 지문을 결과 대조보다 먼저 본다. 저작이나 코드가 바뀌었으면 결과가
다른 것이 정상이고, 그때 「재현 실패」라고 말하면 거짓말이다. 입력이 같은데
결과가 다를 때만 경보다.

검사 203건과 다른 것을 잡는다 — 203건은 우리가 정한 규칙의 표본이고
이건 규칙을 모르는 전수 대조다."
```

---

### Task 7: `v2:reproduce` 를 고친다

이 PR 이 깨는 자리 둘을 막는다 (설계 4.2 · 4.3).

**Files:**
- Modify: `src/v2/reproduce.ts`

**Interfaces:**
- Consumes: Task 4 의 `build_info.built_at`
- Produces: 없음 (기존 명령의 동작 수정)

- [ ] **Step 1: `app` 을 DROP 대상에서 뺀다**

`src/v2/reproduce.ts:31` 의 상수를 가른다.

```typescript
/** 덤프에 담는 스키마. app 도 대조 대상이다 — 저작이 안 바뀌었음을 보이려면 담아야 한다 */
const DUMP_SCHEMAS = ['raw', 'canonical', 'app'];

/**
 * 지우고 다시 만드는 스키마. **app 은 빠진다.**
 *
 * app 은 수집기·변환기가 만드는 것이 아니라 사람이 넣는 것이다. 저작 사실
 * (ref_exception · ego_granted_axis)과 값 정정(field_override)이 여기 있고,
 * 이건 재빌드의 **입력**이다(ADR-08). 지우고 구우면 자기가 검증하려는 입력을
 * 없애고 굽는 꼴이 된다.
 */
const REBUILD_SCHEMAS = ['raw', 'canonical'];
```

- [ ] **Step 2: DROP 문과 안내를 고친다**

`main()` 안의 모의 실행 안내:

```typescript
		console.log('    rm -rf data/entities');
		console.log('    npm run fetch');
		console.log('    npm run db:ddl -- -c "DROP SCHEMA raw, canonical CASCADE"');
		console.log('    npm run db:ddl < prisma/v2/schema.sql');
		console.log('    npm run v2:load && npm run v2:canonical');
		console.log('');
		console.log('  **app 은 안 지운다.** 저작과 정정은 재빌드의 입력이다(ADR-08).');
		return;
```

실제 DROP 자리:

```typescript
	sh('npm', ['run', 'db:ddl', '--', '-c',
		REBUILD_SCHEMAS.map((s) => `DROP SCHEMA IF EXISTS ${s} CASCADE`).join('; ')]);
```

**`schema.sql` 을 통째로 다시 넣으면 `app` 표를 또 만들려 든다.** `CREATE TABLE` 이 이미 있는 표에 부딪히므로 실패한다. 확인한다:

```bash
grep -n "IF NOT EXISTS" prisma/v2/schema.sql | head -3
```

없으면 `db:ddl` 호출을 `ON_ERROR_STOP` 없이 돌리는지 보고, 그래도 깨지면 `app` 문장을 걸러서 넣는다 — `schema-ops.ts` 의 `splitDdlBlocks` 가 이미 블록을 가른다. 재사용한다.

- [ ] **Step 3: `built_at` 을 덤프 대조에서 뺀다**

`dumpDatabase()` 의 필터를 넓힌다.

```typescript
	return raw
		.split('\n')
		.filter((l) => !l.startsWith('\\restrict') && !l.startsWith('\\unrestrict'))
		// build_info 의 built_at 은 굽는 순간이라 매번 다르다. 나머지 열
		// (snapshot_id · code_commit · authored_digest · row_count)은 같은
		// 입력이면 같으므로 대조에 남긴다
		.map((l) => l.replace(BUILT_AT, '<built_at>'))
		.join('\n');
```

파일 위쪽에 상수를 둔다.

```typescript
/** `COPY canonical.build_info` 행 안의 타임스탬프. ISO 꼴이며 초 소수까지 온다 */
const BUILT_AT = /\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(\.\d+)?\+\d{2}/g;
```

**이 정규식이 다른 타임스탬프도 지운다.** `app.field_override.created_at` 이 같은 꼴이다. 그건 재현 시험에서 안 지워지므로 값이 같고, 지워도 대조가 약해지지 않는다. `raw.snapshot.created_at` 도 같다 — 원본에서 오는 값이라 재수집해도 같다.

- [ ] **Step 4: 모의 실행으로 확인한다**

```bash
npm run v2:reproduce 2>&1 | tail -20
```

기대: 안내에 「`app` 은 안 지운다」가 나오고, DROP 목록이 `raw, canonical` 둘뿐이다.

- [ ] **Step 5: 커밋**

**실제 실행(`-- --run`)은 이 PR 에서 안 한다.** `data/entities` 를 지우고 재수집하는 작업이라 상류 상태에 걸리고, 이 PR 의 범위 밖이다. 안 돌린 것을 커밋 본문에 적는다.

```bash
npm run typecheck
git add src/v2/reproduce.ts
git commit -m "fix(v2): 재현 시험이 app 을 지우지 않게 한다

app 은 수집기·변환기가 만드는 것이 아니라 사람이 넣는 것이다. 저작 사실과
값 정정이 여기 있고 이건 재빌드의 입력이다 — 지우고 구우면 자기가 검증하려는
입력을 없애고 굽는 꼴이 된다. 지금까지는 경고 한 줄로만 막고 있었다.

built_at 은 덤프 대조에서 뺀다. 굽는 순간이라 매번 달라 바이트 단위 비교가
항상 실패하게 된다. 나머지 열은 같은 입력이면 같으므로 대조에 남긴다.

실제 실행(-- --run)은 안 돌렸다. data/entities 재수집이 상류 상태에 걸리고
이 PR 의 범위 밖이다. 모의 실행으로 DROP 목록과 안내만 확인했다."
```

---

### Task 8: ADR-08 · 문서 · 승격 왕복

경계를 문서로 남기고, 승격을 실제로 왕복해 M1 의 미검증 항목을 태운다.

**Files:**
- Create: `docs/adr/08-authored-facts-as-data.md`
- Modify: `docs/adr/07-canonical-promotion.md`
- Modify: `docs/superpowers/specs/2026-08-05-snapshot-anchor-design.md`

**Interfaces:**
- Consumes: Task 1~7 전부
- Produces: 없음 (문서)

- [ ] **Step 1: ADR-08 을 쓴다**

`docs/adr/08-authored-facts-as-data.md`. ADR-07 의 형식을 따른다 — 머리말에 결정일·설계 링크·선행 ADR.

담을 것:

```
1. 맥락        ADR-07 §3 이 「구조 저작 = 코드」로 그었다. 그 줄이 왜 안 맞나
2. 결정        규칙(방법)은 코드 · 규칙이 참조하는 사실은 app
               판별: 「이건 게임이 정한 것인가, 우리가 정한 것인가」
3. 무엇이 어디로  ref_exception 3 · ego_granted_axis 4 는 app
               DENOMINATOR 6 은 코드 — 정규식이고 순서가 의미를 가진다
4. FK 를 안 거는 이유  app → canonical FK 는 승격 때 재조준 대상이 된다(ADR-07 3.2)
               대신 적재기 선검사. 실패 방향이 안전하다
5. 결과        build_info 가 세 입력의 지문을 든다
               v2:verify:rebuild 가 등식을 전수로 검사한다
               v2:reproduce 가 app 을 안 지운다
6. 남은 것     M6 증분이 오면 field_source.snapshot_id 가 행마다 갈린다
```

**ADR-07 §3 의 표를 그대로 베끼지 않는다.** 「바뀐 줄」만 적고 나머지는 ADR-07 을 가리킨다.

- [ ] **Step 2: ADR-07 에 후속을 적는다**

`docs/adr/07-canonical-promotion.md` 의 §3 표 아래와 §7 「남은 것」에 넣는다.

§3 아래:

```markdown
> **후속 — [ADR-08](08-authored-facts-as-data.md) 이 이 표의 「구조 저작」 칸을 다시 그었다.**
> 규칙은 여전히 코드에 있지만, **규칙이 참조하는 사실**은 `app` 으로 내려갔다.
> `EGO_GRANTED` · `TRIGGER_EXCEPTION` · `TOKEN_EXCEPTION` 은 이제 `app.ego_granted_axis`
> 와 `app.ref_exception` 이다. `DENOMINATOR` 는 코드에 남았다.
```

§7 의 「저작 표가 아직 코드에 있다」 문단을 **해소로 바꾼다.** 좀비 진단이 정확하지 않았다는 것도 적는다 — `v2:build` 는 코드를 계속 읽었으므로 좀비가 아니었고, 진짜 위험은 재빌드가 무거워 `canonical` 을 직접 고치게 되는 쪽이었다.

- [ ] **Step 3: 설계 문서 10절을 실측으로 바꾼다**

`docs/superpowers/specs/2026-08-05-snapshot-anchor-design.md` 의 「10. 열린 것」을 「10. 구현에서 확인한 것」으로 바꾸고 네 항목의 실제 답을 적는다.

```
authored_digest 를 무엇으로 재나     정렬된 (kind,key,refKind,refId) · (egoId,axisId).  note 는 뺀다
code_commit 을 어떻게 얻나          git rev-parse HEAD.  더러우면 -dirty 를 붙인다
build_info 의 CHECK 를 어디에 두나   ← Task 4 Step 3 에서 확인한 것을 적는다
built_at 을 build_info 에 두나      둔다.  v2:reproduce 가 대조에서 걸러낸다
```

11절 뒤에 「12. 구현 결과」를 더한다 — 파일 목록, 검증 수치, 실측으로 기각한 것.

- [ ] **Step 4: 깨끗한 트리에서 마지막 빌드와 승격 왕복**

```bash
git status --porcelain    # 비어야 한다. 아니면 먼저 커밋한다
npm run v2:build
npm run v2:diff 2>&1 | tail -30
```

`diff` 가 내는 것을 **읽고 확인한다** — 표 셋이 늘고 열 하나가 늘 뿐 값이 안 바뀌어야 한다.

```bash
npm run v2:promote
npm run v2:verify:canonical 2>&1 | tail -10
npm run v2:verify:rebuild
```

```bash
npm run v2:rollback
npm run v2:verify:canonical 2>&1 | tail -10
```

**되돌린 뒤에는 `build_info` 도 `snapshot_id` 열도 없는 옛 판이다.** `v2:verify:rebuild` 는 「판정 불가」를 내야 한다.

```bash
npm run v2:verify:rebuild   # 판정 불가 · 종료 코드 1
```

다시 올린다:

```bash
npm run v2:promote
npm run v2:verify:canonical 2>&1 | tail -10
npm run v2:verify:rebuild   # 재현됨
```

- [ ] **Step 5: 수치를 받아 적고 커밋**

위에서 나온 실제 수치를 설계 문서 12절에 적는다. **추측한 숫자를 쓰지 않는다.**

```bash
npm run typecheck && npm test 2>&1 | tail -6
git add docs/
git commit -m "docs(adr): ADR-08 저작 사실은 데이터로 · 규칙은 코드로

ADR-07 §3 이 「구조 저작 = 코드」로 그은 줄을 다시 긋는다. 규칙은 여전히
코드에 있지만 규칙이 참조하는 사실은 app 으로 내려갔다.

판별은 「이건 게임이 정한 것인가, 우리가 정한 것인가」다. Bloodfiend 가
유닛 키워드라는 것은 게임의 사실이고, desc 에서 정규식으로 분모를 뽑는 것은
우리가 정한 방법이다.

ADR-07 §7 의 좀비 진단도 바로잡는다. v2:build 는 코드를 계속 읽었으므로
좀비가 아니었다. 진짜 위험은 재빌드가 무거워 canonical 을 직접 고치게 되고,
그러면 재빌드가 파괴 행위가 되는 쪽이었다."
```

- [ ] **Step 6: PR 을 draft 에서 올린다**

```bash
git push
gh pr ready 25
gh pr checks 25 --watch --interval 15
```

PR 본문의 WIP 머리말을 지우고 구현 결과로 갈아끼운다.

---

## Self-Review

**스펙 커버리지**

| 설계 절 | Task |
| --- | --- |
| 1 등식 | Task 4 (`build_info`) · Task 6 (`v2:verify:rebuild`) |
| 2 재현성/정확성/완전성 | Task 6 — 203검사 옆에 전수 대조를 세운다 |
| 3 실측 | Task 5 Step 1 이 스냅샷 1건을 다시 잰다 |
| 4.1 입력은 대상 밖에 | Task 1 (`app` 에 둔다) |
| 4.2 reproduce 가 app 을 지운다 | Task 7 Step 1·2 |
| 4.3 built_at 이 대조를 깬다 | Task 7 Step 3 |
| 4.4 넷 중 하나는 모양이 다르다 | Task 2 Step 5 (`DENOMINATOR` 는 남긴다) |
| 결정 1 사실은 app · 방법은 코드 | Task 1·2·3 · Task 8 (ADR-08) |
| 결정 2 판 표식 + 행 단위 | Task 4 · Task 5 |
| 결정 3 표 둘 | Task 1 Step 1 |
| 결정 4 입력 지문이 먼저 | Task 6 Step 4 (`verdictOf`) |
| 6.1 app 표 둘 | Task 1 |
| 6.2 build_info | Task 4 |
| 6.3 field_source 열 | Task 5 |
| 7 v2:verify:rebuild | Task 6 |
| 8 기존 것에 미치는 영향 | Task 2 (테스트) · Task 6 Step 1 (export) · Task 7 |
| 9 검증 계획 | Task 4 Step 5 · Task 5 Step 4 · Task 8 Step 4 |
| 10 열린 것 셋 | Task 3 (digest) · Task 4 Step 3·4 (CHECK · dirty) · Task 8 Step 3 |

**의도적으로 안 하는 것**

```
v2:reproduce -- --run    상류 재수집에 걸린다.  모의 실행만 확인한다 (Task 7 Step 5)
DENOMINATOR 데이터화      결정 1.  코드에 남는다
증분 파이프라인           M6
앱 전환                  M3
```

**타입 일관성**

`Authored` · `KnownIds` · `Verdict` 가 전부 `authored.ts` 와 `verify-rebuild.ts` 에 있고,
Task 3 → 6 순서로 쓰인다. `refException` 필드의 원소 타입
`{ kind, key, refKind, refId }` 는 Task 2 의 세 입력 인터페이스와 Task 3 의 `Authored`
에서 **같은 모양이다** — 같은 배열을 셋이 나눠 쓰고 각자 자기 `kind` 만 거른다.

`entityDiff` 의 반환 필드(`table` · `added` · `removed` · `changed`)는 **Task 6 Step 4
에서 실제 정의를 확인하고 쓴다.** 추측한 이름을 코드에 박지 않는다.

**위험한 자리 셋**

**Task 3 Step 6** — `vocab.unitKeyword` · `sinners.association` 의 실제 접근 경로를
모른다. 그 자리에 `grep` 을 먼저 넣어 둔 이유다.

**Task 4 Step 3** — `v2:build` 가 `views.sql` 을 어떻게 다루는지가 미확인이다.
승격이 스키마를 rename 으로 옮기므로 뷰는 따라가지만, **새로 굽는 판에 뷰와 CHECK 를
누가 만드는가**는 확인해야 한다. 여기서 막히면 Task 4 가 안 닫힌다.

**Task 6 Step 7 ③** — `canonical` 을 일부러 깨뜨린다. 되돌리는 명령을 같은 Step 에
붙여 둔 이유다. 그 앞에 `v2:build` 가 결정적이라는 것이 ①에서 확인되어 있어야 한다.
