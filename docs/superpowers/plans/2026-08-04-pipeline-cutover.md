# 파이프라인 끊기 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `canonical` 을 파괴적 적재의 대상에서 빼고, 승격으로만 바뀌게 한다.

**Architecture:** 살아있는 `canonical` 을 옆으로 치우고 그 이름으로 새 판을 굽는다(Prisma 가 스키마 이름을 하드코딩하므로 이 방법뿐이다). 다 구우면 새 판을 `wip` 으로 옮기고 살아있는 판을 되돌린다. 승격은 스키마 이름 교체와 `app` 재조준을 한 트랜잭션에 넣는다.

**Tech Stack:** PostgreSQL 16 · Prisma 6 multiSchema · tsx · node:test

## Global Constraints

- **`raw` 와 `app` 의 데이터를 잃지 않는다.** `raw.raw_object` 43,270행 · `app.field_override` 5행은 모든 작업 뒤에도 그대로여야 한다.
- **살아있는 `canonical` 을 지우지 않는다.** 이 계획이 끝날 때 152,399행이 그대로 있거나, `canonical_bak` 에 보존돼 있어야 한다.
- **`public` 스키마를 건드리지 않는다.** 현행 앱이 읽는다. 이 계획의 범위 밖이다.
- 설계 문서는 `docs/superpowers/specs/2026-08-04-pipeline-cutover-design.md` 다. 절 번호로 인용한다.
- 새 스크립트는 `src/v2/` 아래에 두고 `package.json` 의 `v2:` 접두사를 따른다.
- SQL 실행은 기존 방식대로 `PrismaClient.$executeRawUnsafe` 를 쓴다. `psql` 셸 호출에 기대지 않는다.
- 파괴적 SQL 을 담은 스크립트는 **무엇을 할지 먼저 출력하고 실행한다.** 조용히 지우지 않는다.
- 주석과 커밋 메시지는 한국어. 기존 파일의 밀도와 어투를 따른다.
- `app` FK 실명은 아래와 같다. 하드코딩하지 말고 `pg_constraint` 에서 읽는다.
  ```
  app.run_floor  run_floor_pack_id_fkey  FOREIGN KEY (pack_id) REFERENCES canonical.pack(id) ON UPDATE CASCADE ON DELETE RESTRICT
  app.run_gift   run_gift_gift_id_fkey   FOREIGN KEY (gift_id) REFERENCES canonical.gift(id) ON UPDATE CASCADE ON DELETE RESTRICT
  app.run.difficulty  타입 canonical."Difficulty"
  ```

---

## 파일 구조

```
src/v2/schema-ops.ts        스키마 이름 조작의 공통부.  존재 확인 · 이름 바꾸기 · 의존 읽기
src/v2/schema-ops.test.ts   순수 함수(SQL 생성)만 테스트한다
src/v2/build-canonical.ts   v2:build.  6.1 절차
src/v2/diff-canonical.ts    v2:diff.  7절
src/v2/promote-canonical.ts v2:promote · v2:rollback.  6.2 · 6.3
src/v2/load-canonical.ts    수정 — 시작할 때 canonical 이 비었는지 본다 (결정 4)
package.json                수정 — 스크립트 넷 추가
docs/adr/07-canonical-promotion.md   결정 넷을 ADR 로 남긴다
```

`schema-ops.ts` 가 SQL 문자열을 만들고, 나머지 셋이 그것을 실행한다. **SQL 생성은 순수
함수라 DB 없이 테스트한다** — CI 가 DB 를 안 쓰기 때문이다.

---

### Task 1: `canonical` 이 비었는지 보는 가드

설계 결정 4. 맨손 `npm run v2:canonical` 을 거부한다.

**Files:**
- Create: `src/v2/schema-ops.ts`
- Create: `src/v2/schema-ops.test.ts`
- Modify: `src/v2/load-canonical.ts` (`main()` 시작부, 현재 43–47행)

**Interfaces:**
- Produces: `tableCount(prisma, schema): Promise<number>` · `EMPTY_REQUIRED` 오류 메시지 상수
- Consumes: 없음

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`src/v2/schema-ops.test.ts`:

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyRequiredMessage } from './schema-ops.js';

test('거부 메시지가 우회로를 알려 준다', () => {
	const m = emptyRequiredMessage(94);
	assert.match(m, /canonical/);
	assert.match(m, /94/);
	// 무엇을 하라는지 없으면 사람이 막힌다
	assert.match(m, /v2:build/);
});
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npx tsx --test src/v2/schema-ops.test.ts`
Expected: FAIL — `Cannot find module './schema-ops.js'`

- [ ] **Step 3: 최소 구현**

`src/v2/schema-ops.ts`:

```ts
/**
 * 스키마 이름 조작의 공통부.
 *
 * **SQL 문자열을 만드는 것과 실행하는 것을 가른다.** 만드는 쪽은 순수 함수라
 * DB 없이 테스트한다 — CI 는 데이터베이스를 쓰지 않는다.
 */
import type { PrismaClient } from './generated/client.js';

export function emptyRequiredMessage(n: number): string {
	return [
		`canonical 에 테이블이 ${n}개 있다. 적재기는 빈 canonical 에만 굽는다.`,
		'살아있는 판을 지우지 않기 위한 가드다(설계 결정 4).',
		'새로 구우려면 npm run v2:build 를 쓴다 — 살아있는 판을 먼저 옆으로 치운다.',
	].join('\n');
}

export async function tableCount(prisma: PrismaClient, schema: string): Promise<number> {
	const rows = await prisma.$queryRaw<Array<{ n: bigint }>>`
		SELECT count(*)::bigint AS n FROM information_schema.tables
		WHERE table_schema = ${schema} AND table_type = 'BASE TABLE'
	`;
	return Number(rows[0]?.n ?? 0n);
}
```

- [ ] **Step 4: 통과를 확인한다**

Run: `npx tsx --test src/v2/schema-ops.test.ts`
Expected: PASS

- [ ] **Step 5: 적재기에 가드를 건다**

`src/v2/load-canonical.ts` 의 `main()` 시작부, `latestSnapshotId` 호출 **앞**에 넣는다.

```ts
		// **살아있는 canonical 을 지우지 않기 위한 가드다**(설계 결정 4).
		// 적재기는 빈 canonical 에만 굽는다. v2:build 가 먼저 옆으로 치워 준다.
		const existing = await tableCount(prisma, 'canonical');
		if (existing > 0) throw new Error(emptyRequiredMessage(existing));

		const snapshotId = await latestSnapshotId(prisma);
```

import 를 파일 위쪽 import 무리에 더한다:

```ts
import { emptyRequiredMessage, tableCount } from './schema-ops.js';
```

- [ ] **Step 6: 실제로 거부되는지 본다**

Run: `npm run v2:canonical`
Expected: 실패한다. 메시지에 `canonical 에 테이블이 94개 있다` 와 `npm run v2:build` 가 보인다.

**이 시점부터 전체 재적재가 막힌다.** Task 2 가 `v2:build` 를 만들 때까지는 굽는 방법이 없다 — 의도한 순서다.

- [ ] **Step 7: 커밋**

```bash
git add src/v2/schema-ops.ts src/v2/schema-ops.test.ts src/v2/load-canonical.ts
git commit -m "feat(v2): 적재기가 빈 canonical 에만 굽는다

살아있는 판을 지우지 않기 위한 가드다(설계 결정 4). 맨손 v2:canonical 이
거부되고, 메시지가 v2:build 를 알려 준다."
```

---

### Task 2: `v2:build` — 옆으로 치우고 굽는다

설계 6.1. **9절의 미확인 하나를 여기서 확인한다** — 새 `canonical` 의 DDL 을 무엇으로 만드나.

**Files:**
- Modify: `src/v2/schema-ops.ts`
- Modify: `src/v2/schema-ops.test.ts`
- Create: `src/v2/build-canonical.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: `tableCount` (Task 1)
- Produces: `renameSchema(from, to): string` · `schemaExists(prisma, name): Promise<boolean>`

- [ ] **Step 1: DDL 생성 방법을 먼저 확인한다**

**이것을 먼저 하지 않으면 나머지가 무의미하다.** 살아있는 데이터를 건드리지 않고 확인한다.

```bash
# 지금 상태에서 diff 를 떠 본다 — canonical 이 있으므로 비어야 정상이다
npx prisma migrate diff \
  --from-url "$(grep -o 'postgresql://[^\"]*' .env)" \
  --to-schema-datamodel prisma/v2/schema.prisma --script
```

Expected: `-- This is an empty migration.` 또는 빈 출력. 여기서 뭔가 나오면 스키마와
DB 가 이미 어긋난 것이므로 **멈추고 보고한다.**

그다음 임시 스키마로 「canonical 이 없을 때」를 흉내 낸다. **살아있는 canonical 은
건드리지 않는다** — 아래는 이름만 바꿨다가 즉시 되돌린다.

```sql
ALTER SCHEMA canonical RENAME TO canonical_probe;
-- 여기서 위 migrate diff 를 다시 떠서 무엇이 나오는지 본다
ALTER SCHEMA canonical_probe RENAME TO canonical;
```

확인할 것:
- `CREATE SCHEMA "canonical"` 과 canonical 테이블 생성문이 나오는가
- **`app` 을 건드리는 문장이 섞이는가** (`ALTER TABLE "app"...`). 섞이면 그 문장을 걸러야 한다
- `raw` 를 다시 만들려 드는가

결과를 설계 9절에 적는다. `app` 문장이 섞이면 **걸러내는 것이 아니라** Task 3 의 승격이
어차피 `app` 을 재조준하므로, build 단계에서는 `app` 문장을 빼고 실행한다.

- [ ] **Step 2: 이름 바꾸기 SQL 의 테스트를 쓴다**

`src/v2/schema-ops.test.ts` 에 더한다:

```ts
import { renameSchema } from './schema-ops.js';

test('스키마 이름 바꾸기 SQL', () => {
	assert.equal(renameSchema('canonical', 'wip'), 'ALTER SCHEMA "canonical" RENAME TO "wip"');
});

test('이름에 따옴표가 들어오면 거부한다 — 주입을 막는다', () => {
	assert.throws(() => renameSchema('a"b', 'c'), /스키마 이름/);
});
```

- [ ] **Step 3: 실패를 확인한다**

Run: `npx tsx --test src/v2/schema-ops.test.ts`
Expected: FAIL — `renameSchema is not a function`

- [ ] **Step 4: 구현**

`src/v2/schema-ops.ts` 에 더한다:

```ts
/**
 * 스키마 이름은 식별자라 파라미터로 못 넘긴다. 문자열로 박아야 하므로
 * **모양을 좁혀서 주입을 막는다.** 우리가 쓰는 이름은 소문자·숫자·밑줄뿐이다.
 */
function ident(name: string): string {
	if (!/^[a-z_][a-z0-9_]*$/.test(name)) throw new Error(`스키마 이름이 이상하다: ${name}`);
	return `"${name}"`;
}

export function renameSchema(from: string, to: string): string {
	return `ALTER SCHEMA ${ident(from)} RENAME TO ${ident(to)}`;
}

export async function schemaExists(prisma: PrismaClient, name: string): Promise<boolean> {
	const rows = await prisma.$queryRaw<Array<{ n: bigint }>>`
		SELECT count(*)::bigint AS n FROM information_schema.schemata WHERE schema_name = ${name}
	`;
	return Number(rows[0]?.n ?? 0n) > 0;
}
```

- [ ] **Step 5: 통과를 확인한다**

Run: `npx tsx --test src/v2/schema-ops.test.ts`
Expected: PASS

- [ ] **Step 6: `build-canonical.ts` 를 쓴다**

설계 6.1 의 여섯 단계를 그대로 옮긴다. **각 단계를 먼저 출력하고 실행한다.**

```ts
/**
 * v2:build — 살아있는 canonical 을 옆으로 치우고 그 이름으로 새 판을 굽는다.
 *
 * Prisma multiSchema 가 스키마 이름을 하드코딩하므로(설계 3.1) 새 판도 잠깐은
 * `canonical` 이라는 이름이어야 한다. 살아있는 판은 그동안 `canonical_hold` 에 있다.
 *
 * 끝나면 새 판은 `wip`, 살아있는 판은 `canonical` 이다. **canonical 은 한 행도
 * 안 바뀐다.** 승격은 v2:promote 가 따로 한다.
 */
```

절차:

1. `wip` 이 이미 있으면 거부한다 — 앞선 build 결과를 말없이 덮지 않는다
2. `canonical_hold` 가 있으면 거부한다 — 앞선 build 가 중간에 죽은 흔적이다
3. `renameSchema('canonical', 'canonical_hold')` 실행
4. Step 1 에서 정한 방법으로 새 `canonical` DDL 실행
5. `npm run v2:canonical` 을 자식 프로세스로 실행 (`node:child_process` 의 `spawnSync`, `stdio: 'inherit'`)
6. `npm run v2:verify:canonical` 을 같은 방식으로 실행. 실패하면 **7·8 을 건너뛰고 멈춘다** — 새 판이 `canonical` 이름으로 남아 조사할 수 있게. 되돌리는 방법을 출력한다
7. `renameSchema('canonical', 'wip')`
8. `renameSchema('canonical_hold', 'canonical')`

각 단계 앞에 `console.log` 로 무엇을 하는지 적는다.

- [ ] **Step 7: 스크립트를 등록한다**

`package.json` 의 `v2:verify:canonical` 다음 줄에 더한다:

```json
    "v2:build": "tsx --env-file-if-exists=.env src/v2/build-canonical.ts",
```

- [ ] **Step 8: 실제로 돌린다**

Run: `npm run v2:build`
Expected:
```
canonical 94테이블 · wip 94테이블
검사 203건 전부 통과
```
그리고 `canonical` 의 행수가 build 전과 같다. 확인:

```sql
SELECT count(*) FROM canonical.gift;          -- 582
SELECT count(*) FROM wip.gift;                -- 582
SELECT count(*) FROM app.field_override;      -- 5
SELECT count(*) FROM raw.raw_object;          -- 43270
```

- [ ] **Step 9: 커밋**

```bash
git add src/v2/schema-ops.ts src/v2/schema-ops.test.ts src/v2/build-canonical.ts package.json docs/
git commit -m "feat(v2): v2:build — 옆으로 치우고 canonical 이름으로 굽는다

Prisma 가 스키마 이름을 하드코딩하므로 새 판도 잠깐은 canonical 이어야 한다.
끝나면 새 판이 wip, 살아있는 판이 canonical 이다. canonical 은 안 바뀐다."
```

---

### Task 3: `v2:diff` — 승격 전에 무엇이 달라지는지 본다

설계 7절. 승격은 되돌릴 수 있어야 하지만, **되돌릴 일을 미리 아는 편이 낫다.**

**Files:**
- Create: `src/v2/diff-canonical.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: `schemaExists` (Task 2)
- Produces: 없음 (실행 스크립트)

- [ ] **Step 1: 무엇을 낼지 정한다**

네 가지다. 설계 7절 그대로.

```
테이블별 행수 차        wip vs canonical.  0 이 아닌 것만 낸다
사라진 개체             canonical 에 있고 wip 에 없는 id.  gift · identity · ego · pack
새 개체                 반대
app 무결성 예고         app.run_gift.gift_id · app.run_floor.pack_id 가 wip 에 있나
```

- [ ] **Step 2: 구현**

`src/v2/diff-canonical.ts`:

```ts
/**
 * v2:diff — wip 과 canonical 을 대조한다.
 *
 * **승격 전에 사람이 읽는 것이 목적이다.** 무엇이 사라지고 무엇이 새로 생기는지
 * 모르고 바꾸면, 되돌릴 수 있다는 사실만으로는 부족하다.
 *
 * `app 무결성 예고` 가 특히 그렇다 — 승격의 FK 재부착이 실패할지를 미리 알려 준다.
 */
```

행수 차:

```sql
SELECT t.table_name,
       (SELECT n_live_tup FROM pg_stat_user_tables s
         WHERE s.schemaname='canonical' AND s.relname=t.table_name) AS live,
       (SELECT n_live_tup FROM pg_stat_user_tables s
         WHERE s.schemaname='wip' AND s.relname=t.table_name) AS wip
  FROM information_schema.tables t
 WHERE t.table_schema='canonical' AND t.table_type='BASE TABLE'
```

`n_live_tup` 은 추정치다. **차이가 보이는 테이블만 `count(*)` 로 다시 센다** — 94테이블을
전부 정확히 세면 느리고, 대부분은 안 바뀐다.

개체 차 — 네 테이블만 본다:

```sql
SELECT 'gift' AS entity, id FROM canonical.gift
EXCEPT SELECT 'gift', id FROM wip.gift
```

`app` 무결성 예고:

```sql
SELECT g.gift_id FROM app.run_gift g
 WHERE NOT EXISTS (SELECT 1 FROM wip.gift w WHERE w.id = g.gift_id)
```

- [ ] **Step 3: 스크립트 등록**

```json
    "v2:diff": "tsx --env-file-if-exists=.env src/v2/diff-canonical.ts",
```

- [ ] **Step 4: 돌린다**

Run: `npm run v2:diff`
Expected: 지금은 `wip` 이 `canonical` 을 그대로 다시 구운 것이므로 **전부 차이 0** 이다.

```
행수 차 없음
사라진 개체 없음 · 새 개체 없음
app 무결성 예고 — 문제 없음 (run_gift 0행 · run_floor 0행)
```

차이가 나오면 적재가 결정적이지 않다는 뜻이므로 **멈추고 보고한다.**

- [ ] **Step 5: 커밋**

```bash
git add src/v2/diff-canonical.ts package.json
git commit -m "feat(v2): v2:diff — 승격 전에 무엇이 달라지는지 본다

행수 차 · 사라진 개체 · 새 개체 · app 무결성 예고 넷을 낸다.
마지막 것이 승격의 FK 재부착이 실패할지를 미리 알려 준다."
```

---

### Task 4: `v2:promote` · `v2:rollback` — 한 트랜잭션 교체

설계 6.2 · 6.3. **이 계획에서 가장 위험한 자리다.**

**Files:**
- Modify: `src/v2/schema-ops.ts`
- Modify: `src/v2/schema-ops.test.ts`
- Create: `src/v2/promote-canonical.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: `renameSchema` · `schemaExists`
- Produces: `appDependencies(prisma): Promise<AppDep[]>` — `app` 이 `canonical` 을 참조하는 곳

- [ ] **Step 1: `app` 의존을 읽는 테스트를 쓴다**

**실명을 하드코딩하지 않는다.** 모델이 바뀌면 이름이 바뀐다.

```ts
import { rebindSql } from './schema-ops.js';

test('FK 재부착 SQL 을 정의문에서 만든다', () => {
	const sql = rebindSql([{
		table: 'run_gift', name: 'run_gift_gift_id_fkey',
		def: 'FOREIGN KEY (gift_id) REFERENCES canonical.gift(id) ON UPDATE CASCADE ON DELETE RESTRICT',
	}]);
	assert.deepEqual(sql.drop, ['ALTER TABLE "app"."run_gift" DROP CONSTRAINT "run_gift_gift_id_fkey"']);
	assert.match(sql.add[0] ?? '', /ADD CONSTRAINT "run_gift_gift_id_fkey" FOREIGN KEY \(gift_id\) REFERENCES canonical\.gift\(id\)/);
	// 옵션을 잃으면 삭제 동작이 바뀐다
	assert.match(sql.add[0] ?? '', /ON DELETE RESTRICT/);
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx tsx --test src/v2/schema-ops.test.ts`
Expected: FAIL — `rebindSql is not a function`

- [ ] **Step 3: 구현**

```ts
export interface AppFk { table: string; name: string; def: string }

/**
 * `app` 의 FK 를 뗐다 다시 붙이는 SQL.
 *
 * **정의문을 그대로 다시 쓴다.** `ON DELETE RESTRICT` 같은 옵션을 손으로 옮겨 적으면
 * 언젠가 하나를 빠뜨리고, 그러면 삭제 동작이 조용히 바뀐다.
 */
export function rebindSql(fks: AppFk[]): { drop: string[]; add: string[] } {
	return {
		drop: fks.map((f) => `ALTER TABLE "app".${ident(f.table)} DROP CONSTRAINT ${ident2(f.name)}`),
		add: fks.map((f) => `ALTER TABLE "app".${ident(f.table)} ADD CONSTRAINT ${ident2(f.name)} ${f.def}`),
	};
}
```

`ident2` 는 제약 이름용이다 — 대문자가 없으므로 `ident` 와 같은 규칙을 쓰되, 함수를
나누지 말고 `ident` 를 재사용해도 된다(구현자 판단).

`appDependencies` 는 `pg_constraint` 를 읽는다:

```sql
SELECT cl.relname AS "table", co.conname AS name, pg_get_constraintdef(co.oid) AS def
  FROM pg_constraint co
  JOIN pg_class cl ON cl.oid = co.conrelid
  JOIN pg_namespace ns ON ns.oid = cl.relnamespace
  JOIN pg_class fcl ON fcl.oid = co.confrelid
  JOIN pg_namespace fns ON fns.oid = fcl.relnamespace
 WHERE co.contype = 'f' AND ns.nspname = 'app' AND fns.nspname <> 'app'
```

`fns.nspname <> 'app'` 이 핵심이다 — `app` 안끼리의 FK(`run_floor → app.run` 등 넷)는
건드리면 안 된다.

- [ ] **Step 4: 통과 확인**

Run: `npx tsx --test src/v2/schema-ops.test.ts`
Expected: PASS

- [ ] **Step 5: `promote-canonical.ts` 를 쓴다**

`process.argv` 로 `promote` 와 `rollback` 을 가른다.

**promote** — 한 트랜잭션(`prisma.$transaction` 이 아니라 `$executeRawUnsafe` 로
`BEGIN`/`COMMIT` 을 직접 낸다. Prisma 의 인터랙티브 트랜잭션은 DDL 에 쓰기 번거롭다):

```
0  wip 이 없으면 거부.  canonical_bak 이 있으면 지운다(결정 3) — 지운다고 먼저 출력한다
1  BEGIN
2  app → canonical FK 를 전부 DROP
3  canonical → canonical_bak
4  wip → canonical
5  app.run.difficulty 타입 재지정
     ALTER TABLE "app"."run" ALTER COLUMN "difficulty"
       TYPE canonical."Difficulty" USING "difficulty"::text::canonical."Difficulty"
6  app FK 를 정의문 그대로 ADD
7  COMMIT
```

**enum 재지정은 `app.run` 이 비어 있어도 필요하다.** 컬럼 타입이 옛 스키마의 타입을
가리키고 있으면 `canonical_bak` 을 지울 수 없다.

**rollback** — 역순. `canonical_bak` 이 없으면 거부한다.

```
canonical → wip · canonical_bak → canonical · app 재조준
```

- [ ] **Step 6: 스크립트 등록**

```json
    "v2:promote": "tsx --env-file-if-exists=.env src/v2/promote-canonical.ts promote",
    "v2:rollback": "tsx --env-file-if-exists=.env src/v2/promote-canonical.ts rollback",
```

- [ ] **Step 7: 승격 → 되돌리기 → 승격을 실제로 돌린다**

**세 번 다 돌려야 한다.** 되돌리기가 되는지 확인하지 않으면 안전장치가 아니다.

```bash
npm run v2:promote
```
확인:
```sql
SELECT count(*) FROM canonical.gift;         -- 582
SELECT count(*) FROM canonical_bak.gift;     -- 582
SELECT count(*) FROM app.field_override;     -- 5
-- app FK 가 canonical 을 가리키나
SELECT fns.nspname FROM pg_constraint co
  JOIN pg_class cl ON cl.oid=co.conrelid JOIN pg_namespace ns ON ns.oid=cl.relnamespace
  JOIN pg_class fcl ON fcl.oid=co.confrelid JOIN pg_namespace fns ON fns.oid=fcl.relnamespace
 WHERE co.contype='f' AND ns.nspname='app' AND fns.nspname<>'app';   -- canonical
-- 뷰가 새 canonical 을 가리키나
SELECT pg_get_viewdef('canonical.v_identity_capability'::regclass);
```

```bash
npm run v2:verify:canonical    # 203건 전부 통과해야 한다
npm run v2:rollback
npm run v2:verify:canonical    # 여기서도 203건
npm run v2:promote             # 다시 앞으로
npm run v2:verify:canonical
```

- [ ] **Step 8: 커밋**

```bash
git add src/v2/schema-ops.ts src/v2/schema-ops.test.ts src/v2/promote-canonical.ts package.json
git commit -m "feat(v2): v2:promote · v2:rollback — 한 트랜잭션 교체

스키마 이름 교체와 app 재조준이 한 트랜잭션에 들어간다. 반쯤 바뀐 상태가 없다.
FK 정의문을 그대로 다시 써서 ON DELETE 옵션을 잃지 않는다.
FK 재부착이 승격의 검사 역할을 한다 — 새 판에 없는 기프트를 app 이 가리키면
트랜잭션이 통째로 되돌아간다."
```

---

### Task 5: ADR-07 과 문서 갱신

결정은 코드보다 오래 산다. 코드를 읽어서 「왜」를 복원할 수 없는 것만 적는다.

**Files:**
- Create: `docs/adr/07-canonical-promotion.md`
- Modify: `docs/adr/06-three-schema-database.md` (6절 「현행 public 전환」 부근)
- Modify: `docs/superpowers/specs/2026-08-04-pipeline-cutover-design.md` (9절 → 구현 결과)

**Interfaces:** 없음

- [ ] **Step 1: ADR-07 을 쓴다**

기존 ADR 의 형식을 따른다(`06-three-schema-database.md` 를 본보기로).

담을 것:

```
맥락      canonical 이 코드로 재현할 수 없는 값을 갖기 시작했다.
          재적재가 그 값을 지우는 일이 된다
결정 1    이름 돌려쓰기.  Prisma 가 스키마 이름을 하드코딩하는 것이 이유다
결정 2    정정을 성격으로 가른다 — 값은 app.field_override · 구조는 코드
결정 3    canonical_bak 은 하나만
결정 4    맨손 적재는 검사로 거부한다.  권한은 계정이 하나라 못 가른다
결과      canonical 은 승격으로만 바뀐다.  명령 넷
남은 것   저작 표가 아직 코드에 있다 — 파이프라인이 멈춘 뒤 좀비가 된다.
          다음 PR 이 데이터로 내린다
```

**결정 2 의 경계를 예로 못 박는다.** 다음에 정정이 생겼을 때 어디에 넣을지가
이 문서 하나로 정해져야 한다.

```
값 정정 (app.field_override)
  9212 hardOnly = false.  「위키가 맞고 mj 가 틀렸다」
  판별: raw 의 한 필드가 틀렸고, 옳은 값을 안다

구조 저작 (코드)
  EGO_GRANTED — 어느 E.G.O 가 축을 주는가
  TRIGGER_EXCEPTION — Bloodfiend Identities 는 소속이 아니라 유닛 키워드다
  판별: 값 하나가 아니라 규칙이고, 테스트로 지켜야 한다
```

- [ ] **Step 2: ADR-06 에 후속을 적는다**

6절 「현행 public 전환 — 신규 DB 가 완성된 지금 별도로 판단한다」 아래에 한 줄:

```
canonical 재생성 모델은 ADR-07 이 대체한다 — 승격으로만 바뀐다
```

- [ ] **Step 3: 설계 9절을 구현 결과로 바꾼다**

Task 2 Step 1 에서 확인한 것을 적는다 — DDL 을 무엇으로 만들었고, `app` 문장이
섞였는지, 섞였으면 어떻게 처리했는지.

- [ ] **Step 4: 커밋**

```bash
git add docs/
git commit -m "docs(adr): ADR-07 canonical 은 승격으로만 바뀐다

결정 넷과 정정이 어디 사는지의 경계. 다음에 정정이 생겼을 때
어디에 넣을지가 이 문서 하나로 정해지도록 예를 박았다."
```

---

## Self-Review

**스펙 커버리지**

| 설계 절 | Task |
| --- | --- |
| 3.1 Prisma 하드코딩 | Task 2 — 이름 돌려쓰기로 우회 |
| 3.2 `app` 세 갈래 참조 | Task 4 Step 3 `appDependencies` · Step 5 |
| 3.3 이름 바꾸면 따라간다 | Task 4 Step 7 검증 |
| 3.4 DDL 트랜잭션 | Task 4 Step 5 |
| 결정 1 이름 돌려쓰기 | Task 2 |
| 결정 2 값/구조 | Task 5 Step 1 |
| 결정 3 bak 하나 | Task 4 Step 5 절차 0 |
| 결정 4 맨손 거부 | Task 1 |
| 5절 명령 넷 | Task 2·3·4 |
| 6.1 build 절차 | Task 2 Step 6 |
| 6.2 promote | Task 4 Step 5 |
| 6.3 rollback | Task 4 Step 5 |
| 7절 diff | Task 3 |
| 8절 검증 | Task 2 Step 8 · Task 3 Step 4 · Task 4 Step 7 |
| 9절 미확인 | Task 2 Step 1 · Task 5 Step 3 |

**의도적으로 안 하는 것**

```
snapshot_id 심기      다음 PR.  이 PR 은 구조만 바꾸고 데이터는 안 바꾼다
저작 표 데이터화       다음 PR.  ADR-07 이 「남은 것」으로 적는다
증분 파이프라인        그다음
앱 전환 · public      읽는 곳을 바꾸는 작업이라 성격이 다르다
```

**타입 일관성**

`renameSchema` · `schemaExists` · `tableCount` · `appDependencies` · `rebindSql` ·
`emptyRequiredMessage` 가 전부 `schema-ops.ts` 에 있고, Task 1→2→4 순서로 늘어난다.
`AppFk` 는 Task 4 에서 처음 나오고 `rebindSql` 과 `appDependencies` 가 공유한다.

**위험한 자리**

Task 4 Step 7 이다. 승격을 실제로 돌리는 첫 순간이며, `canonical` 152,399행이 걸려 있다.
그 앞에 Task 3 의 `v2:diff` 가 서 있는 것이 그래서다 — 무엇이 달라지는지 보고 나서
바꾼다. 되돌리기도 같은 Step 에서 확인한다.
