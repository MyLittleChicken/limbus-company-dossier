# 인카운터·적 재설계 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 원본 전투 정의의 네 갈래(`top`·`wave`·`phase`·`battle`)를 뜻을 잃지 않고 담아, 「이 팩의 마지막 보스가 누구인가」에 답할 수 있는 팩을 31 → 75 로 늘린다.

**Architecture:** `canonical.encounter_target` 의 키를 `(encounter_id, index)` 에서 `(encounter_id, kind, group_index, index)` 4키로 넓히고, 자식인 `encounter_target_part`·`encounter_part_resist` 도 같은 키를 따라가게 한다. 그다음 `canonical.enemy` 에 섞여 있는 적 870행과 부위 472행을 `enemy`/`enemy_part` 로 가른다. 변환기는 `src/v2/canonical/encounters.ts` 하나이며 재귀 없이 네 갈래를 명시적으로 순회한다.

**Tech Stack:** TypeScript (ESM) · Prisma 6 · PostgreSQL 17 · `tsx --test` (node:test)

## Global Constraints

- **`raw` 스키마는 건드리지 않는다.** 재수집·재적재 없이 `npm run v2:canonical` 만으로 끝난다.
- **변환기는 파일을 읽지 않는다.** `raw.raw_object` 를 질의해 만든다. `src/v2/source.ts` 의 `readSource`·`readSourceGroup`·`str`·`num`·`arr` 도우미만 쓴다.
- **지어내지 않는다.** 원본에 없는 값을 채우지 않는다. 해석 실패는 `meta.gap(...)` 으로 남긴다.
- **주석은 한국어**로 「무엇을 왜」를 적는다. 기존 파일의 톤을 따른다.
- **`portrait` 는 FK 가 아니다.** 적 id 로 승격하면 37건이 틀린 적에 붙는다.
- **적 이름의 정본은 asset `targets[].name`** 이다. loc 이름으로 덮지 않는다.
- **스키마 파일은 `prisma/v2/schema.prisma` 하나다.** 고친 뒤 반드시 `npm run v2:schema:validate` → `npm run v2:schema:ddl` → `npm run v2:generate` 를 돌린다.
- **DDL 은 델타로 적용한다.** `schema.sql` 은 from-empty 라 그대로 쓰면 `raw` 43,270행과 `app.field_override` 가 날아간다. 아래 명령으로 ALTER 만 뽑아 적용한다.
  ```bash
  set -a; . ./.env; set +a
  npx prisma migrate diff --from-url "$DATABASE_URL" \
    --to-schema-datamodel prisma/v2/schema.prisma --script > build/tmp/delta.sql
  grep -nE 'DROP (SCHEMA|TABLE)|TRUNCATE' build/tmp/delta.sql   # 나오면 멈추고 사람에게 묻는다
  docker compose exec -T postgres psql -U postgres -d limbus -v ON_ERROR_STOP=1 -q < build/tmp/delta.sql
  ```
- **검사 기준값을 내릴 때는 사유를 주석으로 남긴다.** 앞선 작업에서 「리터럴 꺾쇠 41 → 35」를 회귀로 오인할 뻔했다.
- DB 질의는 이렇게 한다.
  ```bash
  docker compose exec -T postgres psql -U postgres -d limbus -t -A -F'|' -c "SQL"
  ```

---

## File Structure

| 파일 | 책임 | 변경 |
| --- | --- | --- |
| `prisma/v2/schema.prisma` | 스키마 정의 | `TargetKind` enum 신설 · `EncounterTarget`/`EncounterTargetPart`/`EncounterPartResist` 4키화 · `EnemyPart`/`EnemyPartText` 신설 · `EnemyText.part` → `roleLabel` 개명 |
| `src/v2/canonical/encounters.ts` | 전투 정의 변환기 | 네 갈래 순회 · 적/부위 분리 · 보스 후보 |
| `src/v2/canonical/encounters.test.ts` | 위 테스트 | 신규 테스트 추가 |
| `src/v2/load-canonical.ts` | 적재 | 새 테이블 `createMany` 추가 (287–295 · 547–553 구간) |
| `src/v2/verify-canonical.ts` | 검증 | 인카운터 검사 교체·추가 |

---

## Task 1: `TargetKind` 축을 스키마에 넣는다

**Files:**
- Modify: `prisma/v2/schema.prisma` (`model Encounter` ~ `model EncounterPartResist` 구간)

**Interfaces:**
- Produces: `TargetKind` enum (`top`·`wave`·`phase`·`battle`), `EncounterTarget` 의 새 PK `[encounterId, kind, groupIndex, index]`, 새 컬럼 `portrait Int?` · `num Int?`

- [ ] **Step 1: `TargetKind` enum 을 추가한다**

`model Encounter` 바로 앞에 넣는다. 다른 enum 들과 같은 자리(`@@schema("canonical")`)를 쓴다.

```prisma
/// 원본이 타깃을 담는 네 갈래. **뜻이 서로 다르므로 한 축으로 뭉개면 안 된다.**
///
/// `wave` 와 `phase` 는 별개 전투가 아니라 **한 보스전의 내용**이다 —
/// 증원과 페이즈 전환이다. `battle` 만이 대안 관계이며
/// 게임이 그중 하나를 뽑는다(위키의 「Possible Bosses」).
enum TargetKind {
  /// 최상위 targets[]
  top
  /// waves[i].targets[] — 같은 전투 안의 증원. 같은 적이 반복 등장한다
  wave
  /// phases[i].targets[] — 페이즈 전환. Golden Apple → False Apple
  phase
  /// battles[i].targets[] — 서로 배타적인 보스 후보
  battle

  @@schema("canonical")
}
```

- [ ] **Step 2: `EncounterTarget` 을 4키로 바꾼다**

기존 모델을 통째로 아래로 바꾼다.

```prisma
/// 전투에 나오는 적.
///
/// 초판은 최상위 `targets` 만 담아 398행이었다. `waves`(26팩) · `battles`(16팩) ·
/// `phases`(2팩) 를 통째로 건너뛰어 **보스 데이터가 있는 44팩이 한 줄도 없었다.**
model EncounterTarget {
  encounterId String     @map("encounter_id")
  kind        TargetKind
  /// battles[i] · waves[i] · phases[i] 의 i. top 은 0
  groupIndex  Int        @map("group_index")
  /// 그룹 안의 순서
  index       Int
  /// 정본은 asset `targets[].name` 이다. loc 이름으로 덮지 않는다
  name        String
  /// 초상화 이미지 id. **FK 가 아니다** — 적 id 와 번호 공간이 겹치지만 37건이 어긋난다
  portrait    Int?
  /// 원본 `num`. 동시 등장 수인지 확정되지 않았다(합 22 · 다른 곳엔 77). 담되 해석하지 않는다
  num         Int?

  encounter Encounter             @relation(fields: [encounterId], references: [id], onDelete: Cascade)
  parts     EncounterTargetPart[]

  @@id([encounterId, kind, groupIndex, index])
  @@map("encounter_target")
  @@schema("canonical")
}
```

- [ ] **Step 3: `EncounterTargetPart` 와 `EncounterPartResist` 를 같은 키로 넓힌다**

```prisma
/// 적의 부위. **저항이 부위마다 따로 있고 10축이다** —
/// 물리 3축 + 죄악 7축. 인격 3축 · E.G.O 7축과 다르다.
model EncounterTargetPart {
  encounterId   String     @map("encounter_id")
  kind          TargetKind
  groupIndex    Int        @map("group_index")
  targetIndex   Int        @map("target_index")
  partId        String     @map("part_id")
  name          String
  hpBase        Float?     @map("hp_base")
  hpLevel       Float?     @map("hp_level")
  defCorrection Int?       @map("def_correction")
  speedMin      Int?       @map("speed_min")
  speedMax      Int?       @map("speed_max")

  target  EncounterTarget       @relation(fields: [encounterId, kind, groupIndex, targetIndex], references: [encounterId, kind, groupIndex, index], onDelete: Cascade)
  resists EncounterPartResist[]

  @@id([encounterId, kind, groupIndex, targetIndex, partId])
  @@map("encounter_target_part")
  @@schema("canonical")
}

/// 부위별 저항 10축.
model EncounterPartResist {
  encounterId String     @map("encounter_id")
  kind        TargetKind
  groupIndex  Int        @map("group_index")
  targetIndex Int        @map("target_index")
  partId      String     @map("part_id")
  /// slash · pierce · blunt · 죄악 7종
  axis        String
  value       Float

  part EncounterTargetPart @relation(fields: [encounterId, kind, groupIndex, targetIndex, partId], references: [encounterId, kind, groupIndex, targetIndex, partId], onDelete: Cascade)

  @@id([encounterId, kind, groupIndex, targetIndex, partId, axis])
  @@map("encounter_part_resist")
  @@schema("canonical")
}
```

- [ ] **Step 4: 스키마를 검증하고 DDL·클라이언트를 재생성한다**

```bash
npm run v2:schema:validate && npm run v2:schema:ddl && npm run v2:generate
```
Expected: `The schema at prisma/v2/schema.prisma is valid 🚀`

- [ ] **Step 5: 커밋**

```bash
git add prisma/v2/schema.prisma prisma/v2/schema.sql
git commit -m "feat(v2): encounter_target 을 4키로 넓힌다 — top·wave·phase·battle"
```

---

## Task 2: 변환기가 네 갈래를 순회한다

**Files:**
- Modify: `src/v2/canonical/encounters.ts`
- Test: `src/v2/canonical/encounters.test.ts`

**Interfaces:**
- Consumes: Task 1 의 `TargetKind`
- Produces: `EncounterTables.encounterTarget` 원소가 `{ encounterId, kind, groupIndex, index, name, portrait, num }`, `encounterTargetPart`·`encounterPartResist` 원소에 `kind`·`groupIndex` 추가

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`src/v2/canonical/encounters.test.ts` 의 `input()` 에 네 갈래를 다 가진 표본을 넣는다. 기존 `input()` 의 `encounters` Map 에 아래 세 항목을 **추가**한다(기존 두 항목은 그대로 둔다).

```ts
['md__waves', {
  name: 'Wave Boss', siteId: 'uuid-w',
  waves: [
    { targets: [{ name: 'Neighbor', portrait: 1101 }] },
    { targets: [{ name: 'Neighbor', portrait: 1101 }, { name: 'Miner', portrait: 1102, num: 2 }] },
  ],
}],
['md__phases', {
  name: 'Phase Boss', siteId: 'uuid-p',
  phases: [
    { targets: [{ name: 'Golden Apple', portrait: 8008 }] },
    { targets: [{ name: 'False Apple', portrait: 8009 }] },
  ],
}],
['md__battles', {
  name: 'Boss Options', siteId: 'uuid-b',
  battles: [
    { targets: [{ name: 'Ebony Queen', portrait: 8001,
        parts: [{ partId: 800101, name: 'Fruit', resists: { blunt: 2 } }] }] },
    { phases: [{ targets: [{ name: 'Golden Apple', portrait: 8008 }] }] },
  ],
}],
```

그리고 테스트 세 개를 파일 끝에 더한다.

```ts
test('waves 는 groupIndex 로 갈려 담긴다 — 같은 적이 반복 등장한다', () => {
	const t = buildEncounters(input(), new Meta());
	const rows = t.encounterTarget
		.filter((r) => r.encounterId === 'md__waves')
		.map((r) => [r.kind, r.groupIndex, r.index, r.name]);
	assert.deepEqual(rows, [
		['wave', 0, 0, 'Neighbor'],
		['wave', 1, 0, 'Neighbor'],
		['wave', 1, 1, 'Miner'],
	]);
});

test('battles 안의 phases 도 battle 로 담기고 groupIndex 가 보존된다', () => {
	const t = buildEncounters(input(), new Meta());
	const rows = t.encounterTarget
		.filter((r) => r.encounterId === 'md__battles')
		.map((r) => [r.kind, r.groupIndex, r.index, r.name]);
	assert.deepEqual(rows, [
		['battle', 0, 0, 'Ebony Queen'],
		['battle', 1, 0, 'Golden Apple'],
	]);
});

test('portrait 와 num 을 담는다 — portrait 는 FK 가 아니다', () => {
	const t = buildEncounters(input(), new Meta());
	const miner = t.encounterTarget.find((r) => r.name === 'Miner');
	assert.equal(miner?.portrait, 1102);
	assert.equal(miner?.num, 2);
	const neighbor = t.encounterTarget.find((r) => r.name === 'Neighbor');
	assert.equal(neighbor?.num, null);
});
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npx tsx --test src/v2/canonical/encounters.test.ts`
Expected: FAIL — `kind` 가 `undefined` 이고 `md__waves` 행이 0개다

- [ ] **Step 3: 변환기를 고친다**

`src/v2/canonical/encounters.ts` 에서 타입에 축을 더한다.

```ts
export type TargetKind = 'top' | 'wave' | 'phase' | 'battle';

export interface EncounterTables {
	encounter: Array<{ id: string; group: string | null; name: string; siteId: string; waves?: unknown; phases?: unknown; battles?: unknown }>;
	encounterTarget: Array<{ encounterId: string; kind: TargetKind; groupIndex: number; index: number; name: string; portrait: number | null; num: number | null }>;
	encounterTargetPart: Array<{ encounterId: string; kind: TargetKind; groupIndex: number; targetIndex: number; partId: string; name: string; hpBase: number | null; hpLevel: number | null; defCorrection: number | null; speedMin: number | null; speedMax: number | null }>;
	encounterPartResist: Array<{ encounterId: string; kind: TargetKind; groupIndex: number; targetIndex: number; partId: string; axis: string; value: number }>;
	enemy: Array<{ id: string }>;
	enemyText: Array<{ enemyId: string; locale: Loc; name: string; roleLabel: string | null }>;
	packBossEncounter: Array<{ packId: string; encounterId: string }>;
}
```

기존 `arr(e, 'targets').forEach(...)` 블록을 **함수로 뽑고** 네 갈래에서 부른다. 기존 블록을 아래로 바꾼다.

```ts
		// 원본은 타깃을 네 갈래로 담는다. **뜻이 서로 달라 한 축으로 뭉개면 안 된다** —
		// battle 은 서로 배타적인 보스 후보고, wave·phase 는 같은 보스전의 내용이다.
		// 초판은 top 만 읽어 보스 데이터가 있는 44팩을 통째로 잃었다.
		const pushTargets = (kind: TargetKind, groupIndex: number, rawTargets: unknown[]) => {
			rawTargets.forEach((rawTarget, index) => {
				const target = obj(rawTarget);
				// **이름이 비어도 버리지 않는다.** 실측 1건(story__9-5-24)이 빈 문자열이며
				// 버리면 부위와 저항까지 통째로 사라진다.
				const targetName = str(target, 'name');
				if (targetName === null) {
					meta.gap(
						'encounter_target', `${id}#${kind}#${groupIndex}#${index}`, 'name',
						'적 이름이 비어 있다 (원본 결함)', EVIDENCE,
					);
				}
				t.encounterTarget.push({
					encounterId: id, kind, groupIndex, index, name: targetName ?? '',
					portrait: num(target, 'portrait'),
					num: num(target, 'num'),
				});

				for (const rawPart of arr(target, 'parts')) {
					const part = obj(rawPart);
					const partId = part['partId'] === undefined ? null : String(part['partId']);
					const partName = str(part, 'name');
					if (partId === null || partName === null) continue;
					// hp 는 {base, level} 이 보통이지만 숫자만 있는 경우도 있다
					const hpRaw = part['hp'];
					const hp = obj(hpRaw);
					const hpFlat = typeof hpRaw === 'number' ? hpRaw : null;
					const speed = arr(part, 'speed');
					t.encounterTargetPart.push({
						encounterId: id, kind, groupIndex, targetIndex: index, partId, name: partName,
						hpBase: num(hp, 'base') ?? hpFlat, hpLevel: num(hp, 'level'),
						defCorrection: num(part, 'defCorrection'),
						speedMin: speed.length === 2 ? Number(speed[0]) : null,
						speedMax: speed.length === 2 ? Number(speed[1]) : null,
					});
					const resists = obj(part['resists']);
					for (const axis of AXES) {
						const value = num(resists, axis);
						if (value === null) continue;
						t.encounterPartResist.push({
							encounterId: id, kind, groupIndex, targetIndex: index, partId, axis, value,
						});
					}
				}
			});
		};

		pushTargets('top', 0, arr(e, 'targets'));
		arr(e, 'waves').forEach((w, i) => pushTargets('wave', i, arr(obj(w), 'targets')));
		arr(e, 'phases').forEach((p, i) => pushTargets('phase', i, arr(obj(p), 'targets')));
		// **battle 안에 다시 waves·phases 가 들어간다**(md__canto-1-2 의 Golden Apple).
		// 중첩된 것도 같은 battle 의 내용이므로 groupIndex 를 그대로 이어 쓴다 —
		// 그래야 「이 보스 후보의 전체 등장 적」이 한 groupIndex 로 모인다.
		arr(e, 'battles').forEach((b, i) => {
			const battle = obj(b);
			pushTargets('battle', i, arr(battle, 'targets'));
			for (const w of arr(battle, 'waves')) pushTargets('battle', i, arr(obj(w), 'targets'));
			for (const p of arr(battle, 'phases')) pushTargets('battle', i, arr(obj(p), 'targets'));
		});
```

> **주의** — 중첩 때문에 같은 `(kind, groupIndex, index)` 가 겹칠 수 있다. Step 5 에서 실측으로 확인하고, 겹치면 Task 3 에서 다룬다.

- [ ] **Step 4: 테스트가 통과하는지 확인한다**

Run: `npx tsx --test src/v2/canonical/encounters.test.ts`
Expected: PASS (기존 테스트 포함 전부)

- [ ] **Step 5: 키 충돌이 실제로 있는지 실측한다**

한 `battle` 이 `targets` 와 `phases`(또는 `waves`)를 **둘 다** 가지면 `(kind, groupIndex, index)` 가 겹친다. 겹치는지를 **테스트로 판별한다** — DB 를 돌릴 필요 없다.

앞 Step 의 `md__battles` 표본은 `battles[1]` 이 `phases` 만 갖고 `targets` 가 없어 충돌하지 않는다. 둘 다 가진 표본을 더해 확인한다.

`input()` 의 `encounters` 에 추가:

```ts
['md__battle-mixed', {
  name: 'Mixed', siteId: 'uuid-m',
  battles: [{
    targets: [{ name: 'Front', portrait: 1 }],
    phases: [{ targets: [{ name: 'Second Form', portrait: 2 }] }],
  }],
}],
```

테스트 추가:

```ts
test('한 battle 이 targets 와 phases 를 둘 다 가지면 index 가 겹친다 — 키 설계를 확인한다', () => {
	const t = buildEncounters(input(), new Meta());
	const rows = t.encounterTarget
		.filter((r) => r.encounterId === 'md__battle-mixed')
		.map((r) => `${r.kind}/${r.groupIndex}/${r.index}`);
	// 겹치면 같은 문자열이 두 번 나온다
	assert.equal(new Set(rows).size, rows.length, `키 충돌: ${rows.join(', ')}`);
});
```

Run: `npx tsx --test src/v2/canonical/encounters.test.ts`
- **PASS 면** 충돌이 없다. Task 3 의 Step 1–3 을 건너뛴다.
- **FAIL 이면** 충돌이 있다. Task 3 에서 `index` 를 그룹 안에서 이어 붙이도록 고친다.

- [ ] **Step 6: 커밋**

```bash
git add src/v2/canonical/encounters.ts src/v2/canonical/encounters.test.ts
git commit -m "feat(v2): 전투 정의의 네 갈래를 전부 담는다 — wave·phase·battle"
```

---

## Task 3: 중첩 battle 의 index 를 이어 붙인다

> Task 2 Step 5 가 PASS 였다면 이 Task 를 통째로 건너뛰고 Task 4 로 간다.

**Files:**
- Modify: `src/v2/canonical/encounters.ts`
- Test: `src/v2/canonical/encounters.test.ts`

**Interfaces:**
- Consumes: Task 2 의 `pushTargets`
- Produces: 같은 `(kind, groupIndex)` 안에서 `index` 가 0부터 이어지는 연속값

- [ ] **Step 1: `pushTargets` 가 시작 index 를 받게 고친다**

`pushTargets` 시그니처와 본문 첫 줄을 바꾼다.

```ts
		/** 같은 (kind, groupIndex) 안에서 index 를 이어 붙인다. 넣은 개수를 돌려준다 */
		const pushTargets = (kind: TargetKind, groupIndex: number, rawTargets: unknown[], base = 0): number => {
			rawTargets.forEach((rawTarget, offset) => {
				const index = base + offset;
				const target = obj(rawTarget);
				// … 이하 본문은 그대로. forEach 의 두 번째 인자 이름만 offset 으로 바뀌고
				//    index 는 위에서 계산한 값을 쓴다
			});
			return rawTargets.length;
		};
```

- [ ] **Step 2: battle 순회가 이어 붙이게 고친다**

```ts
		arr(e, 'battles').forEach((b, i) => {
			const battle = obj(b);
			// 한 보스 후보 안에서 targets · waves · phases 가 함께 올 수 있다.
			// 같은 후보의 등장 적이므로 index 를 이어 붙여 한 묶음으로 만든다
			let n = pushTargets('battle', i, arr(battle, 'targets'));
			for (const w of arr(battle, 'waves')) n += pushTargets('battle', i, arr(obj(w), 'targets'), n);
			for (const p of arr(battle, 'phases')) n += pushTargets('battle', i, arr(obj(p), 'targets'), n);
		});
```

- [ ] **Step 3: 테스트가 통과하는지 확인한다**

Run: `npx tsx --test src/v2/canonical/encounters.test.ts`
Expected: PASS — `md__battle-mixed` 가 `battle/0/0`, `battle/0/1` 로 갈린다

- [ ] **Step 4: 커밋**

```bash
git add src/v2/canonical/encounters.ts src/v2/canonical/encounters.test.ts
git commit -m "fix(v2): 중첩 battle 의 타깃 index 를 이어 붙인다"
```

---

## Task 4: 적과 부위를 가른다

**Files:**
- Modify: `prisma/v2/schema.prisma` (`model Enemy` · `model EnemyText`)
- Modify: `src/v2/canonical/encounters.ts`
- Test: `src/v2/canonical/encounters.test.ts`

**Interfaces:**
- Produces: `EncounterTables.enemyPart: Array<{ id: string; enemyId: string }>`, `EncounterTables.enemyPartText: Array<{ partId: string; locale: Loc; name: string }>`, `enemyText` 의 `part` → `roleLabel` 개명

- [ ] **Step 1: 스키마에 `EnemyPart` 를 넣고 `EnemyText` 를 고친다**

기존 `model Enemy` 와 `model EnemyText` 를 아래로 바꾼다.

```prisma
/// 적 870종.
///
/// **초판은 1,342행이었다.** loc `Enemies*.json` 이 적 행과 부위 행을 한 표에 섞는데
/// ETL 이 무차별 적재했다 — 472행(35%)이 적이 아니라 부위였다.
/// 4·5자리가 적, 6자리가 부위(= 적id × 100 + n)다.
model Enemy {
  id String @id

  texts EnemyText[]
  parts EnemyPart[]

  @@map("enemy")
  @@schema("canonical")
}

/// 적의 부위 472종. `id // 100` 이 부모 적이다.
///
/// `encounter_target_part.part_id` 가 같은 번호 공간이라 곧바로 조인된다.
model EnemyPart {
  id      String @id
  enemyId String @map("enemy_id")

  enemy Enemy          @relation(fields: [enemyId], references: [id], onDelete: Cascade)
  texts EnemyPartText[]

  @@index([enemyId])
  @@map("enemy_part")
  @@schema("canonical")
}

model EnemyText {
  enemyId String @map("enemy_id")
  locale  Locale
  name    String
  /// 원본 `desc`. **부위 이름이 아니다** — 적의 역할 라벨이다
  /// (Core 463 · Enemy Unit 173 · Boss 3 …). 초판의 컬럼명 `part` 는 거짓말이었다
  roleLabel String? @map("role_label")

  enemy Enemy @relation(fields: [enemyId], references: [id], onDelete: Cascade)

  @@id([enemyId, locale])
  @@map("enemy_text")
  @@schema("canonical")
}

/// 부위 표시명. 부위 행에서는 `name` 이 실제 부위 이름이다
/// (Body 260 · Head 36 · Left Arm 27 …).
model EnemyPartText {
  partId String @map("part_id")
  locale Locale
  name   String

  part EnemyPart @relation(fields: [partId], references: [id], onDelete: Cascade)

  @@id([partId, locale])
  @@map("enemy_part_text")
  @@schema("canonical")
}
```

- [ ] **Step 2: 스키마를 검증하고 재생성한다**

```bash
npm run v2:schema:validate && npm run v2:schema:ddl && npm run v2:generate
```
Expected: valid

- [ ] **Step 3: 실패하는 테스트를 쓴다**

`input()` 의 `enemyKo`/`enemyEn` 에 부위 행을 더한다(기존 `8605` 는 그대로 둔다).

```ts
enemyKo: new Map<string, Record<string, unknown>>([
  ['8605', { id: 8605, name: '굴절된 어느 날의 초상', desc: '본체' }],
  ['860501', { id: 860501, name: '몸통', desc: '굴절된 어느 날의 초상' }],
]),
enemyEn: new Map<string, Record<string, unknown>>([
  ['8605', { id: 8605, name: 'Portrait', desc: 'Core' }],
  ['860501', { id: 860501, name: 'Body', desc: 'Portrait' }],
]),
```

테스트를 더한다.

```ts
test('6자리 id 는 적이 아니라 부위다 — id // 100 이 부모다', () => {
	const t = buildEncounters(input(), new Meta());
	assert.deepEqual(t.enemy.map((e) => e.id), ['8605']);
	assert.deepEqual(t.enemyPart, [{ id: '860501', enemyId: '8605' }]);
});

test('부위 이름은 enemy_part_text 로 가고 적의 desc 는 역할 라벨이다', () => {
	const t = buildEncounters(input(), new Meta());
	assert.deepEqual(
		t.enemyPartText.filter((x) => x.locale === 'en'),
		[{ partId: '860501', locale: 'en', name: 'Body' }],
	);
	const en = t.enemyText.find((x) => x.enemyId === '8605' && x.locale === 'en');
	assert.equal(en?.name, 'Portrait');
	assert.equal(en?.roleLabel, 'Core');
});
```

- [ ] **Step 4: 실패를 확인한다**

Run: `npx tsx --test src/v2/canonical/encounters.test.ts`
Expected: FAIL — `t.enemyPart` 가 없다

- [ ] **Step 5: 변환기를 고친다**

`EncounterTables` 에 두 테이블을 더한다.

```ts
	enemy: Array<{ id: string }>;
	enemyPart: Array<{ id: string; enemyId: string }>;
	enemyText: Array<{ enemyId: string; locale: Loc; name: string; roleLabel: string | null }>;
	enemyPartText: Array<{ partId: string; locale: Loc; name: string }>;
```

초기화에도 더한다.

```ts
	const t: EncounterTables = {
		encounter: [], encounterTarget: [], encounterTargetPart: [],
		encounterPartResist: [], enemy: [], enemyPart: [], enemyText: [],
		enemyPartText: [], packBossEncounter: [],
	};
```

적 표시명 블록을 아래로 바꾼다.

```ts
	// ── 적 표시명 ────────────────────────────────────────────────
	// **loc Enemies*.json 은 적 행과 부위 행을 한 표에 섞는다.**
	// 4·5자리가 적(870), 6자리가 부위(472 = 적id × 100 + n)다.
	// 초판이 둘을 무차별 적재해 「적 1,342종」이라는 잘못된 수가 나왔다.
	const enemyLoc: Record<Loc, RawIndex> = {
		ko: input.enemyKo, en: input.enemyEn, ja: input.enemyJa,
	};
	const allIds = new Set<string>();
	for (const locale of LOCALES) for (const id of enemyLoc[locale].keys()) allIds.add(id);

	const enemyIds = [...allIds].filter((id) => id.length <= 5).sort();
	const partIds = [...allIds].filter((id) => id.length === 6).sort();
	const enemyIdSet = new Set(enemyIds);

	for (const id of enemyIds) {
		t.enemy.push({ id });
		for (const locale of LOCALES) {
			const o = enemyLoc[locale].get(id);
			const name = str(o ?? {}, 'name');
			if (name === null) {
				meta.gap('enemy', id, 'name', `${locale} 표시명이 없다`, EVIDENCE, locale);
				continue;
			}
			// desc 는 **부위 이름이 아니라 역할 라벨**이다(Core · Enemy Unit · Boss)
			t.enemyText.push({ enemyId: id, locale, name, roleLabel: str(o ?? {}, 'desc') });
		}
		meta.source('enemy', id, 'name', 'loc-only', [LOC]);
	}

	for (const id of partIds) {
		const enemyId = id.slice(0, -2);
		if (!enemyIdSet.has(enemyId)) {
			// 부모 적이 loc 에 없다. 부위만 담을 수 없으므로 결손으로 남긴다
			meta.gap('enemy_part', id, 'enemy_id', `부모 적 ${enemyId} 가 loc 에 없다`, EVIDENCE);
			continue;
		}
		t.enemyPart.push({ id, enemyId });
		for (const locale of LOCALES) {
			const o = enemyLoc[locale].get(id);
			const name = str(o ?? {}, 'name');
			if (name === null) {
				meta.gap('enemy_part', id, 'name', `${locale} 부위 이름이 없다`, EVIDENCE, locale);
				continue;
			}
			t.enemyPartText.push({ partId: id, locale, name });
		}
		meta.source('enemy_part', id, 'name', 'loc-only', [LOC]);
	}
```

- [ ] **Step 6: 테스트가 통과하는지 확인한다**

Run: `npx tsx --test src/v2/canonical/encounters.test.ts`
Expected: PASS

- [ ] **Step 7: 커밋**

```bash
git add prisma/v2/schema.prisma prisma/v2/schema.sql src/v2/canonical/encounters.ts src/v2/canonical/encounters.test.ts
git commit -m "feat(v2): 적 870 과 부위 472 를 가른다 — enemy_text.part 는 역할 라벨이었다"
```

---

## Task 5: 적재기를 새 테이블에 잇는다

**Files:**
- Modify: `src/v2/load-canonical.ts` (287–295 입력 구간 · 353–355 보정 구간 · 547–553 적재 구간)

**Interfaces:**
- Consumes: Task 2·3·4 의 `EncounterTables`

- [ ] **Step 1: 텍스트 보정의 필드명을 고친다**

`src/v2/load-canonical.ts:353-355` 의 `applyTextOverrides` 호출은 `enemyText` 의 `name` 을 덮는다. 필드명이 안 바뀌었으므로 **그대로 둔다.** 다만 `part` → `roleLabel` 개명으로 타입이 바뀌었는지 `npm run typecheck` 로 확인한다.

Run: `npm run typecheck`
Expected: `encounters.enemyText` 관련 오류가 있으면 그 자리만 고친다

- [ ] **Step 2: `TRUNCATE` 목록에 새 테이블을 넣는다**

`src/v2/load-canonical.ts:376` 근처의 `TRUNCATE` 문에 `canonical.enemy_part` 를 더한다. `canonical.enemy` 와 나란히 둔다(부모–자식이라 CASCADE 로 함께 지워지지만 명시한다).

- [ ] **Step 3: 적재 구간에 두 테이블을 더한다**

`src/v2/load-canonical.ts:551-552` 사이에 넣는다. **`enemy` 다음, `enemy_text` 앞**이어야 한다 — `enemy_part` 가 `enemy` 를 참조한다.

```ts
		counts.push(['enemy', await chunked(encounters.enemy, (d) => prisma.enemy.createMany({ data: d }))]);
		counts.push(['enemy_part', await chunked(encounters.enemyPart, (d) => prisma.enemyPart.createMany({ data: d }))]);
		counts.push(['enemy_text', await chunked(encounters.enemyText, (d) => prisma.enemyText.createMany({ data: d as never }))]);
		counts.push(['enemy_part_text', await chunked(encounters.enemyPartText, (d) => prisma.enemyPartText.createMany({ data: d as never }))]);
```

- [ ] **Step 4: 타입체크와 테스트를 돌린다**

```bash
npm run typecheck && npm test
```
Expected: 타입 오류 0 · 테스트 전부 통과

- [ ] **Step 5: DDL 을 델타로 적용한다**

```bash
set -a; . ./.env; set +a
npx prisma migrate diff --from-url "$DATABASE_URL" \
  --to-schema-datamodel prisma/v2/schema.prisma --script > build/tmp/delta.sql
grep -nE 'DROP (SCHEMA|TABLE)|TRUNCATE' build/tmp/delta.sql
```
Expected: 파괴적 구문이 **없어야** 한다. 나오면 멈추고 사람에게 묻는다.

```bash
docker compose exec -T postgres psql -U postgres -d limbus -v ON_ERROR_STOP=1 -q < build/tmp/delta.sql
```

- [ ] **Step 6: 재적재하고 실측한다**

```bash
npm run v2:canonical
docker compose exec -T postgres psql -U postgres -d limbus -t -A -F'|' -c "
select kind::text, count(*) from canonical.encounter_target group by 1 order by 1;
select 'resist', count(*) from canonical.encounter_part_resist;
select 'enemy', count(*) from canonical.enemy;
select 'enemy_part', count(*) from canonical.enemy_part;
select '보스 이름 낼 수 있는 팩', count(distinct b.pack_id) from canonical.pack_boss_encounter b
  join canonical.encounter_target t on t.encounter_id=b.encounter_id;"
```

Expected (설계 4절 기준):
```
top 398 · wave 461 · phase 67 · battle 445    합 1,371
resist 14,850
enemy 870 · enemy_part 472
보스 이름 낼 수 있는 팩 75
```

**수치가 다르면 그 자체가 발견이다.** 설계 4절이 「타깃 총계 1,371 (구현 때 확정)」이라 적었다 — 감사 문서는 1,384 였고 차이 13은 중첩 계수 방식 차이로 본다. **실측값을 적고 왜 그런지 밝힌 뒤 Task 6 의 기준값으로 삼는다.**

- [ ] **Step 7: 커밋**

```bash
git add src/v2/load-canonical.ts
git commit -m "feat(v2): 새 인카운터 테이블을 적재기에 잇는다"
```

---

## Task 6: 검사를 값 검사로 바꾼다

**Files:**
- Modify: `src/v2/verify-canonical.ts` (인카운터 구간)

**Interfaces:**
- Consumes: Task 5 Step 6 의 실측값

- [ ] **Step 1: 기존 기준값을 실측값으로 갱신하고 사유를 남긴다**

`src/v2/verify-canonical.ts` 에서 `encounter_target` · `encounter_target_part` · `encounter_part_resist` · `enemy` · `enemy_text` 의 `eq(...)` 를 찾아 Task 5 Step 6 의 실측값으로 바꾼다. **각 줄 위에 왜 바뀌는지 주석을 단다.**

```ts
		// 초판은 최상위 targets 만 담아 398이었다. waves(26팩)·battles(16팩)·phases(2팩)를
		// 통째로 건너뛰어 보스 데이터가 있는 44팩이 한 줄도 없었다(설계 3.1)
		eq('encounter_target', await prisma.encounterTarget.count(), 1_371);
		// 부위 저항도 같은 이유로 3,540 이었다
		eq('encounter_part_resist', await prisma.encounterPartResist.count(), 14_850);
		// loc Enemies*.json 이 적 행과 부위 행을 섞는데 초판이 무차별 적재해 1,342 였다
		eq('enemy', await prisma.enemy.count(), 870);
		eq('enemy_part', await prisma.enemyPart.count(), 472);
```

- [ ] **Step 2: kind 분포 검사를 더한다**

```ts
		// 네 갈래가 각각 얼마나 담겼나. 한 갈래가 0이면 그 갈래를 다시 잃은 것이다
		const kindDist = await prisma.$queryRaw<Array<{ kind: string; n: bigint }>>`
			SELECT kind::text AS kind, count(*)::bigint AS n
			FROM canonical.encounter_target GROUP BY 1 ORDER BY 1
		`;
		const dist = Object.fromEntries(kindDist.map((r) => [r.kind, Number(r.n)]));
		checks.push({
			name: '타깃 kind 분포 (한 갈래도 0이면 안 된다)',
			ok: dist['top'] === 398 && dist['wave'] === 461 && dist['phase'] === 67 && dist['battle'] === 445,
			detail: `top ${dist['top']} · wave ${dist['wave']} · phase ${dist['phase']} · battle ${dist['battle']}`,
		});
```

- [ ] **Step 3: 보스 후보 검사를 더한다**

```ts
		// **이 도메인의 소비자 요구다** — 「이 팩의 마지막 보스가 누구인가」에
		// 답할 수 있는 팩. 초판은 31이었다(설계 3.1)
		const bossPacks = await prisma.$queryRaw<Array<{ n: bigint }>>`
			SELECT count(DISTINCT b.pack_id)::bigint AS n
			FROM canonical.pack_boss_encounter b
			JOIN canonical.encounter_target t ON t.encounter_id = b.encounter_id
		`;
		checks.push({
			name: '보스 이름을 낼 수 있는 팩 (초판 31)',
			ok: Number(bossPacks[0]?.n ?? 0n) === 75,
			detail: `${Number(bossPacks[0]?.n ?? 0n)} / 75`,
		});
```

- [ ] **Step 4: 적·부위 무결성 검사를 더한다**

```ts
		// 부위는 id // 100 이 부모 적이다. 부모가 없는 부위가 있으면 분리가 틀렸다
		const orphanPart = await prisma.$queryRaw<Array<{ n: bigint }>>`
			SELECT count(*)::bigint AS n FROM canonical.enemy_part p
			WHERE NOT EXISTS (SELECT 1 FROM canonical.enemy e WHERE e.id = p.enemy_id)
		`;
		checks.push({
			name: '부모 없는 부위 (0이어야 한다)',
			ok: Number(orphanPart[0]?.n ?? 1n) === 0,
			detail: `${Number(orphanPart[0]?.n ?? 0n)} / 0`,
		});

		// 적 id 는 4·5자리, 부위 id 는 6자리다. 섞이면 분리가 안 된 것이다
		const badLen = await prisma.$queryRaw<Array<{ n: bigint }>>`
			SELECT (SELECT count(*) FROM canonical.enemy WHERE length(id) > 5)
			     + (SELECT count(*) FROM canonical.enemy_part WHERE length(id) <> 6) AS n
		`;
		checks.push({
			name: '적·부위 id 자릿수가 섞였다 (0이어야 한다)',
			ok: Number(badLen[0]?.n ?? 1n) === 0,
			detail: `${Number(badLen[0]?.n ?? 0n)} / 0`,
		});
```

- [ ] **Step 5: 골든 표본 검사를 더한다**

위키로 확인된 세 표본이다. 하나라도 깨지면 축이 틀어진 것이다.

```ts
		// 위키 「Possible Bosses」와 대조된 표본이다(docs/audit/wiki/06-encounter.md §2)
		const canto12 = await prisma.encounterTarget.findMany({
			where: { encounterId: 'md__canto-1-2', kind: 'battle', index: 0 },
			orderBy: { groupIndex: 'asc' },
			select: { name: true },
		});
		checks.push({
			name: 'md__canto-1-2 보스 후보 3종 (위키 Possible Bosses)',
			ok: canto12.map((r) => r.name).join(' · ')
				=== "Ebony Queen's Apple · Doomsday Calendar · Golden Apple",
			detail: canto12.map((r) => r.name).join(' · '),
		});

		// 봉봉 세 변형. 중복 행이 아니라 Swarm Movement Prep 1/2/3 이다(§6)
		const walpu8 = await prisma.$queryRaw<Array<{ n: bigint }>>`
			SELECT count(*)::bigint AS n FROM canonical.enemy_part
			WHERE id IN ('137001','137101','137201')
		`;
		checks.push({
			name: 'md__walpu-8 봉봉 부위 3종이 적 1370·1371·1372 로 갈린다',
			ok: Number(walpu8[0]?.n ?? 0n) === 3,
			detail: `${Number(walpu8[0]?.n ?? 0n)} / 3`,
		});
```

- [ ] **Step 6: 미확보 42팩을 결손으로 기록한다**

`src/v2/canonical/encounters.ts` 의 전투 풀 `meta.gap(...)` 바로 아래에 더한다.

```ts
	// **보스 후보를 모르는 42팩.** mj bossPool 은 117팩 전부에 보스를 주는데
	// id 가 숫자(2060122)고 canonical.encounter 는 문자열 키다. 크로스워크 표가
	// 원본에 없다. 위키가 이름을 주지만 위키 값을 canonical 에 담는 것은
	// 새로운 출처 개념이라 별도 판단이 필요하다(설계 6절).
	const bossPacks = new Set(t.packBossEncounter.map((b) => b.packId));
	for (const packId of [...input.knownPacks].sort()) {
		if (bossPacks.has(packId)) continue;
		meta.gap(
			'encounter', packId, 'bossPool',
			'mj bossPool 의 숫자 id 와 assets 조우 이름표를 잇는 표가 원본에 없다',
			'docs/superpowers/specs/2026-08-03-encounter-redesign-design.md',
		);
	}
```

검사를 더한다.

```ts
		// 위키에서 긁지 않기로 했다. 42팩이 결손으로 기록돼 있어야 한다(설계 6절)
		eq('보스 미확보 팩 결손 기록',
			await prisma.fieldGap.count({ where: { entity: 'encounter', field: 'bossPool' } }),
			42);
```

- [ ] **Step 7: 전체를 돌린다**

```bash
npm run typecheck && npm test && npm run v2:canonical && npm run v2:verify:canonical
```
Expected: 검사 전부 통과. `field_gap` 총계가 966 + 42 = **1,008** 로 늘어난다 — `verify-canonical.ts` 의 「결손 합계」 검사 기준값도 1,008 로 올리고 **왜 늘었는지 주석을 단다**(결손을 새로 만든 게 아니라 몰랐던 것을 기록한 것이다).

- [ ] **Step 8: 결손 대장을 다시 만든다**

```bash
npm run v2:gap-report
head -30 build/gap-report.md
```
Expected: `encounter.bossPool` 42건이 목록에 있다

- [ ] **Step 9: 커밋**

```bash
git add src/v2/verify-canonical.ts src/v2/canonical/encounters.ts build/gap-report.md
git commit -m "test(v2): 인카운터 검사를 행 수에서 값 검사로 바꾼다"
```

---

## Task 7: 감사 문서와 ADR 을 정정한다

**Files:**
- Modify: `docs/audit/00-summary.md`
- Modify: `docs/audit/06-encounter.md`
- Modify: `docs/adr/06-three-schema-database.md`

**Interfaces:**
- Consumes: Task 5·6 의 실측값

- [ ] **Step 1: `docs/audit/00-summary.md` 6.2 절을 해소로 표시한다**

「인카운터가 원본의 28.8%만 담겼다」 절 끝에 아래를 더한다. 실측값은 Task 5 Step 6 의 것을 쓴다.

```markdown
> **해소됨 (2026-08-03).** `encounter_target` 을 `(encounter_id, kind, group_index, index)`
> 4키로 넓혀 네 갈래를 전부 담았다. 타깃 398 → 1,371 · 저항 3,540 → 14,850 ·
> 보스 이름을 낼 수 있는 팩 31 → 75. 설계는
> [`docs/superpowers/specs/2026-08-03-encounter-redesign-design.md`](../superpowers/specs/2026-08-03-encounter-redesign-design.md).
> 남은 42팩은 크로스워크가 원본에 없어 `field_gap` 에 기록만 했다.
```

- [ ] **Step 2: 「적 1,342종」을 870종으로 정정한다**

`docs/audit/00-summary.md` 7절 표의 `canonical.enemy` 행과 `docs/audit/06-encounter.md` 안의 `1,342` 를 찾아 고친다.

```bash
grep -n '1,342\|1342' docs/audit/00-summary.md docs/audit/06-encounter.md docs/adr/06-three-schema-database.md
```

각 자리에 「적 870 + 부위 472 = 1,342. 초판이 둘을 섞어 담았다」는 뜻이 드러나게 고친다.

- [ ] **Step 3: ADR-06 5절 결과에 이번 변경을 더한다**

`docs/adr/06-three-schema-database.md` 5절 끝에 절을 하나 더한다.

```markdown
### 5.6 인카운터 재설계 (2026-08-03)

소비자 관점 감사가 이 도메인을 최악으로 짚었고, 위키 대조가 감사의 조치 두 건을
뒤집었다 — `battles` 는 연속 전투가 아니라 서로 배타적인 보스 후보이고,
`portrait` 는 적 id 가 아니라 초상화 이미지 id 다. 그대로 시행했으면 데이터가 틀어졌다.

```
encounter_target   (encounter_id, index) → (encounter_id, kind, group_index, index)
타깃                398 → 1,371
부위 저항           3,540 → 14,850
enemy              1,342 → 적 870 + 부위 472
보스 이름 낼 수 있는 팩   31 → 75
```

**행 수 검사가 왜 이걸 못 잡았나** — 인카운터 6테이블이 전부 `eq(count, N)` 이었다.
행은 다 있고 **갈래가 통째로 없었다.** 값 검사 7건을 더했다.
```

- [ ] **Step 4: 커밋**

```bash
git add docs/audit/00-summary.md docs/audit/06-encounter.md docs/adr/06-three-schema-database.md
git commit -m "docs: 인카운터 재설계 결과를 감사·ADR 에 반영한다"
```

---

## Self-Review

**스펙 커버리지**

| 설계 절 | Task |
| --- | --- |
| 3.0 용어 | 문서 전용. Task 7 Step 3 |
| 3.1 4키 | Task 1 · 2 · 3 |
| 3.2 적·부위 분리 | Task 4 |
| 3.3 두 키를 다 담고 실패를 남긴다 | Task 2 Step 3(`portrait`) · Task 4 Step 5(부모 없는 부위 결손) |
| 3.4 보스 후보 | Task 6 Step 3 · Step 6 |
| 4 검증 | Task 6 |
| 5 리스크 (`num` 담되 해석 안 함) | Task 1 Step 2 · Task 2 Step 3 |
| 6 범위 밖 | Task 6 Step 6 (위키 크로스워크 안 함, 결손 기록) |

**미포함 한 건** — 설계 3.3 의 「적 이름 한국어를 `part_id` 조인으로 복구」는 `enemy_part` 가 생기면 조인이 가능해지지만 **화면이 보스 이름만 쓰므로 이번 계획에 넣지 않았다.** `encounter_target.name` 은 asset 영문이 정본이고, 한국어가 필요해지면 `encounter_target_part.part_id → enemy_part_text` 조인으로 별도 작업하면 된다. 설계 2절이 「엔진 상성 계산」을 비목표로 두었고 한국어 적 이름은 그쪽 요구다.

**타입 일관성**

- `TargetKind` — Task 1 에서 Prisma enum, Task 2 에서 TS union. 두 값 집합이 같다(`top`·`wave`·`phase`·`battle`).
- `pushTargets` — Task 2 에서 `(kind, groupIndex, rawTargets)`, Task 3 에서 `(kind, groupIndex, rawTargets, base = 0)` 로 넓히고 반환형이 `number` 가 된다. Task 3 을 건너뛰면 반환값을 안 쓰므로 문제없다.
- `enemyText.roleLabel` — Task 4 Step 1(스키마) · Step 5(변환기) · Task 5 Step 1(적재) 세 곳에서 같은 이름을 쓴다.
- `enemyPart` / `enemyPartText` — Task 4 에서 정의하고 Task 5 Step 3 에서 `prisma.enemyPart` · `prisma.enemyPartText` 로 적재한다.

**플레이스홀더** — 없다. Task 5 Step 6 과 Task 6 의 기준값은 「실측하고 그 값을 쓴다」로 절차가 명시돼 있으며, 예상값(1,371 · 14,850 · 870 · 472 · 75)도 함께 적었다.
