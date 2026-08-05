# 앱 전환 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 정보 화면 13개가 `public` 대신 `canonical` 을 읽게 하고, `public` 을 읽는 곳을 `recommend` 하나로 좁힌다.

**Architecture:** 현행 질의를 제자리에서 고치지 않는다. `lib/queries/canonical/` 아래 새 파일을 세우고 화면이 import 를 바꾼다 — 두 층이 병존하므로 한 화면씩 옮기며 눈으로 대조할 수 있고 중간에 멈춰도 앱이 돈다. 옮기기 전에 현행 질의의 출력을 골든으로 떠 두고 옮긴 뒤 맞춘다. 마지막에 현행 8파일을 통째로 지운다.

**Tech Stack:** Next.js App Router (서버 컴포넌트) · Prisma `multiSchema` (클라이언트 둘) · PostgreSQL 17 · TypeScript ESM · `node:test` · tsx

## Global Constraints

- 설계는 [`docs/superpowers/specs/2026-08-05-app-cutover-design.md`](../specs/2026-08-05-app-cutover-design.md). 절 번호는 그 문서를 가리킨다.
- **`recommend` 화면과 `lib/engine` 을 건드리지 않는다** (설계 결정 1). `lib/queries/recommend.ts` 도 그대로 둔다.
- **`DROP SCHEMA public` 을 하지 않는다** (설계 2절). `recommend` 가 아직 읽는다.
- **화면 계약은 `dataset` 표기 하나만 바뀐다** (설계 5절). 나머지가 달라지면 그것은 백로그 해소이고 목록으로 남긴다.
- 새 질의는 `import { canonical } from '@/lib/db-canonical'` 를 쓴다. 현행은 `import { db } from '@/lib/db'`.
- **`Locale` 타입은 `@prisma/client`(v1) 것을 그대로 쓴다.** 실측: v1 은 `ko|en`, v2 는 `ko|en|ja` 라 v1 → v2 대입만 성립한다. `lib/locale.ts` 의 `LOCALES = ['ko','en']` 가 앱의 정본이며 이 PR 은 그것을 안 바꾼다. `lib/queries/canonical/list.ts` 가 이미 이 방식이다.
- 로케일 폴백은 ADR-03 5절 규칙이다 — 요청한 것이 없으면 영어로 물러서고 **폴백이 일어난 사실(`fellBack`)을 함께 돌려준다.**
- import 는 `@/` 별칭을 쓴다. 상대경로를 쓰지 않는다.
- 테스트 실행은 `npm test`. 기준선은 **458 pass / 0 fail / 12 skip**.
- 타입 검사는 `npm run typecheck`, 빌드는 `npm run build`.
- DB 는 `docker exec limbus-postgres psql -U postgres -d limbus`.
- 새 워크트리라 `npm run v2:generate` 가 이미 돌아 있다. `.env` 도 복사돼 있다.
- 커밋 메시지는 한국어. Conventional Commits.

## 파일 구조

| 파일 | 책임 | 상태 |
| --- | --- | --- |
| `src/v2/canonical/mirror-dungeon.ts` | 층 표에서 던전 메타를 유도한다. 순수 함수 | **신규** |
| `src/v2/canonical/mirror-dungeon.test.ts` | 유도 규칙 테스트. DB 없이 | **신규** |
| `prisma/v2/schema.prisma` | `mirror_dungeon` · `mirror_dungeon_text` | 수정 |
| `src/v2/load-canonical.ts` | 던전 표 적재 | 수정 |
| `src/v2/verify-canonical.ts` | 새 검사 | 수정 |
| `lib/queries/canonical/reference.ts` | about · dungeon · floors · glossary · 홈이 쓰는 참조 질의 | **신규** |
| `lib/queries/canonical/gifts.ts` | 기프트 목록·상세 | **신규** |
| `lib/queries/canonical/detail.ts` | 인격·E.G.O·팩 상세 | **신규** |
| `lib/queries/canonical/squad.ts` | 편성 편집이 쓰는 사전 | **신규** |
| `lib/queries/canonical/packs.ts` | 팩 목록. 지금 19줄인 것을 채운다 | 수정 |
| `app/[locale]/**/page.tsx` | import 를 바꾼다 | 수정 |
| `build/golden/*.json` | 골든 산출물. gitignore 대상 | **신규(임시)** |
| `scripts/golden-queries.ts` | 골든을 뜨고 대조하는 도구 | **신규** |

**파일을 넷으로 가르는 기준은 화면 묶음이다.** 목록(`list`)·기프트(`gifts`)·상세(`detail`)·참조(`reference`)·편성(`squad`)이 각각 다른 화면군을 받치고 서로 안 부른다.

---

### Task 1: 골든 도구 — 옮기기 전 출력을 떠 둔다

**옮기기 전에 만든다.** 이게 없으면 「같은 것이 같게 보인다」를 말로만 주장하게 된다.

**Files:**
- Create: `scripts/golden-queries.ts`
- Modify: `package.json`
- Modify: `.gitignore`

**Interfaces:**
- Consumes: 현행 `lib/queries/*` 의 export 전부
- Produces: `npm run golden:capture` · `npm run golden:compare`. 산출물은 `build/golden/<name>.json`

- [ ] **Step 1: `.gitignore` 에 산출물 자리를 판다**

`build/tmp/` 줄 아래에 붙인다.

```
build/golden/
```

- [ ] **Step 2: 무엇을 뜰지 정한다**

화면 13개가 실제로 부르는 함수 전부다. 인자는 화면이 주는 것과 같게 한다.

```
reference    listFloorPacks('ko') · getDungeon('ko') · listStatuses('ko', {}) ·
             listGlossaryAxes('ko') · getDataset() · getCounts()
search       searchAll('이상', 'ko') · searchAll('화상', 'ko')
gifts        listGifts('ko', {}) · listAllGifts('ko') · listCursedGiftIds() ·
             listKeywords('ko') · listSins('ko') · getGift(9088, 'ko') · getGift(9090, 'ko')
packs        listPacks('ko', {}) · getPack('1309', 'ko')
identities   listSinners('ko') · listAffiliations('ko') · listIdentities('ko', {}) ·
             getIdentity(10208, 'ko')
egos         listEgos('ko', {}) · getEgo(20509, 'ko')
squad        listSquad('ko') · listSquadAxes('ko')
```

**id 를 고른 근거** — 9088 진혼과 9090 피안개는 설계 문서들이 반복해 쓰는 실측 대상이다.
10208 홍매화는 `identity-axis` 테스트가 쓰는 인격이고, 20509 착영휘도는 `ego_granted`
저작 2건 중 하나다. 1309 는 마스터북이 「loc 후행 공백을 안 쓴다」로 실측한 팩이다.

- [ ] **Step 3: 도구를 쓴다**

`scripts/golden-queries.ts`:

```typescript
/**
 * 골든 대조 — 층을 옮겨도 화면이 같은 것을 보는가.
 *
 * **옮기기 전에 뜬다.** 현행 질의(public)의 출력을 파일로 남기고, 옮긴 뒤 새
 * 질의(canonical)의 출력과 맞춘다. 다르면 그것이 조사거리다 — 나아진 것인지
 * 깨진 것인지는 사람이 판정한다(설계 결정 4).
 *
 * 실행:
 *   npm run golden:capture -- v1     현행 질의를 뜬다
 *   npm run golden:capture -- v2     새 질의를 뜬다
 *   npm run golden:compare           둘을 맞춘다
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const OUT = join(ROOT, 'build', 'golden');

/** BigInt 와 Date 를 안정된 문자열로. JSON.stringify 가 BigInt 에서 던진다 */
function stable(value: unknown): string {
	return JSON.stringify(
		value,
		(_k, v) => {
			if (typeof v === 'bigint') return `${v}n`;
			if (v instanceof Date) return v.toISOString();
			if (v instanceof Set) return [...v].sort();
			return v;
		},
		'\t',
	);
}

type Case = { name: string; run: () => Promise<unknown> };

async function casesV1(): Promise<Case[]> {
	const ref = await import('../lib/queries/reference.js');
	const search = await import('../lib/queries/search.js');
	const gifts = await import('../lib/queries/gifts.js');
	const packs = await import('../lib/queries/packs.js');
	const ids = await import('../lib/queries/identities.js');
	const egos = await import('../lib/queries/egos.js');
	const squad = await import('../lib/queries/squad.js');

	return [
		{ name: 'reference.listFloorPacks', run: () => ref.listFloorPacks('ko') },
		{ name: 'reference.getDungeon', run: () => ref.getDungeon('ko') },
		{ name: 'reference.listStatuses', run: () => ref.listStatuses('ko', ref.readGlossaryFilter({})) },
		{ name: 'reference.listGlossaryAxes', run: () => ref.listGlossaryAxes('ko') },
		{ name: 'reference.getDataset', run: () => ref.getDataset() },
		{ name: 'reference.getCounts', run: () => ref.getCounts() },
		{ name: 'search.이상', run: () => search.searchAll('이상', 'ko') },
		{ name: 'search.화상', run: () => search.searchAll('화상', 'ko') },
		{ name: 'gifts.listGifts', run: () => gifts.listGifts('ko', gifts.readGiftFilter({})) },
		{ name: 'gifts.listAllGifts', run: () => gifts.listAllGifts('ko') },
		{ name: 'gifts.listCursedGiftIds', run: () => gifts.listCursedGiftIds() },
		{ name: 'gifts.listKeywords', run: () => gifts.listKeywords('ko') },
		{ name: 'gifts.listSins', run: () => gifts.listSins('ko') },
		{ name: 'gifts.getGift.9088', run: () => gifts.getGift(9088, 'ko') },
		{ name: 'gifts.getGift.9090', run: () => gifts.getGift(9090, 'ko') },
		{ name: 'packs.listPacks', run: () => packs.listPacks('ko', packs.readPackFilter({})) },
		{ name: 'packs.getPack.1309', run: () => packs.getPack('1309', 'ko') },
		{ name: 'identities.listSinners', run: () => ids.listSinners('ko') },
		{ name: 'identities.listAffiliations', run: () => ids.listAffiliations('ko') },
		{ name: 'identities.listIdentities', run: () => ids.listIdentities('ko', ids.readIdentityFilter({})) },
		{ name: 'identities.getIdentity.10208', run: () => ids.getIdentity(10208, 'ko') },
		{ name: 'egos.listEgos', run: () => egos.listEgos('ko', egos.readEgoFilter({})) },
		{ name: 'egos.getEgo.20509', run: () => egos.getEgo(20509, 'ko') },
		{ name: 'squad.listSquad', run: () => squad.listSquad('ko') },
		{ name: 'squad.listSquadAxes', run: () => squad.listSquadAxes('ko') },
	];
}

/**
 * 새 질의. **Task 를 진행하며 여기에 한 줄씩 는다.**
 * 아직 안 옮긴 것은 목록에 없으므로 compare 가 「안 뜬 것」으로 보고한다.
 */
async function casesV2(): Promise<Case[]> {
	return [];
}

async function capture(which: 'v1' | 'v2'): Promise<void> {
	mkdirSync(join(OUT, which), { recursive: true });
	const cases = which === 'v1' ? await casesV1() : await casesV2();
	for (const c of cases) {
		const value = await c.run();
		writeFileSync(join(OUT, which, `${c.name}.json`), stable(value));
		console.log(`  ${c.name}`);
	}
	console.log(`\n${which} — ${cases.length}건 떴다. ${join(OUT, which)}`);
}

function compare(): void {
	const v1 = join(OUT, 'v1');
	const v2 = join(OUT, 'v2');
	if (!existsSync(v1)) throw new Error('v1 골든이 없다. npm run golden:capture -- v1 을 먼저 돌린다.');

	const names = new Set<string>();
	for (const d of [v1, v2]) {
		if (!existsSync(d)) continue;
		for (const f of require('node:fs').readdirSync(d) as string[]) names.add(f);
	}

	let same = 0;
	const missing: string[] = [];
	const differing: string[] = [];

	for (const f of [...names].sort()) {
		const a = existsSync(join(v1, f)) ? readFileSync(join(v1, f), 'utf8') : null;
		const b = existsSync(join(v2, f)) ? readFileSync(join(v2, f), 'utf8') : null;
		if (a === null || b === null) { missing.push(f.replace(/\.json$/, '')); continue; }
		if (a === b) { same++; continue; }
		differing.push(f.replace(/\.json$/, ''));
	}

	console.log(`같다 ${same}건 · 다르다 ${differing.length}건 · 한쪽만 ${missing.length}건`);
	if (differing.length > 0) {
		console.log('\n다른 것 — 나아진 것인지 깨진 것인지 사람이 판정한다:');
		for (const n of differing) console.log(`  ${n}`);
		console.log(`\n  diff ${join(v1, '<이름>.json')} ${join(v2, '<이름>.json')}`);
	}
	if (missing.length > 0) {
		console.log('\n한쪽만 뜬 것 — 아직 안 옮겼거나 이름이 바뀌었다:');
		for (const n of missing) console.log(`  ${n}`);
	}
}

const mode = process.argv[2];
if (mode === 'compare') compare();
else if (mode === 'v1' || mode === 'v2') await capture(mode);
else {
	console.error('쓰임: golden-queries.ts <v1|v2|compare>');
	process.exitCode = 1;
}
```

- [ ] **Step 4: 스크립트를 등록한다**

`package.json` 의 `"v2:reproduce"` 줄 뒤에 넣는다.

```json
"golden:capture": "tsx --env-file-if-exists=.env scripts/golden-queries.ts",
"golden:compare": "tsx --env-file-if-exists=.env scripts/golden-queries.ts compare"
```

- [ ] **Step 5: 현행 골든을 뜬다**

```bash
npm run golden:capture -- v1
```

기대: 25건. 파일이 `build/golden/v1/` 에 선다.

**실패하면 거기서 멈춘다.** 현행 질의가 안 돌면 대조할 기준이 없다.

- [ ] **Step 6: 산출물을 눈으로 훑는다**

```bash
ls build/golden/v1/ | wc -l
head -30 build/golden/v1/reference.getDataset.json
head -40 build/golden/v1/gifts.getGift.9088.json
```

기대: `getDataset` 에 `gameVersion` · `mdVersion` · `snapshotDate` · `sourceAnchor` · `generatedAt` 이 있다. 이것이 설계 5절이 바꾸겠다고 한 그 자리다.

- [ ] **Step 7: 커밋**

```bash
npm run typecheck
git add scripts/golden-queries.ts package.json .gitignore
git commit -m "test(web): 골든 대조 도구 — 층을 옮겨도 화면이 같은 것을 보는가

옮기기 전에 현행 질의(public)의 출력을 파일로 남긴다. 옮긴 뒤 새 질의
(canonical)의 출력과 맞추고, 다르면 나아진 것인지 깨진 것인지 사람이 판정한다.

산출물은 gitignore 대상이다. 커밋에 152,399행에서 뽑은 JSON 을 남길 이유가 없고,
기준은 그때그때 현행에서 다시 뜨는 것이 옳다."
```

---

### Task 2: `canonical.mirror_dungeon` — 유일한 결손을 메운다

설계 3.3 이 실측으로 확인한 것: 현행도 원본에서 직접 읽지 않고 **층 표에서 유도한다.**

**Files:**
- Create: `src/v2/canonical/mirror-dungeon.ts`
- Create: `src/v2/canonical/mirror-dungeon.test.ts`
- Modify: `prisma/v2/schema.prisma`
- Modify: `src/v2/load-canonical.ts`
- Modify: `src/v2/verify-canonical.ts`
- Modify: `src/v2/schema-ops.test.ts` (블록 수)

**Interfaces:**
- Consumes: `canonical.floor_pack` 의 `difficulty` · `floor_range`
- Produces:
  - Prisma 모델 `MirrorDungeon { version, totalFloors, baseFloors }` · `MirrorDungeonText { version, locale, name }`
  - `floorBounds(rows: Array<{ difficulty: string; floorRange: string }>): { totalFloors: number; baseFloors: number }`
  - `buildMirrorDungeon(input: MirrorDungeonInput, meta: Meta): MirrorDungeonTables`

- [ ] **Step 1: 현행 유도 규칙을 다시 읽는다**

```bash
sed -n '218,236p' src/entities/egos.ts
```

핵심은 이것이다 — 구간 표기를 `-` 로 쪼개 최댓값을 취한다.

```
hard    "1" "2" "3" "4" "5" "6-10" "11-15"   → 15
normal  "1" "2" "3" "4" "5"                   → 5
```

DB 로도 확인한다.

```bash
docker exec limbus-postgres psql -U postgres -d limbus -tAc \
  "SELECT difficulty, floor_range FROM canonical.floor_pack GROUP BY 1,2 ORDER BY 1,2"
```

기대: 위와 같은 12줄.

- [ ] **Step 2: 실패하는 테스트를 쓴다**

`src/v2/canonical/mirror-dungeon.test.ts`:

```typescript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { floorBounds, buildMirrorDungeon } from './mirror-dungeon.js';
import { Meta } from './meta.js';

const FLOORS = [
	{ difficulty: 'normal', floorRange: '1' },
	{ difficulty: 'normal', floorRange: '2' },
	{ difficulty: 'normal', floorRange: '3' },
	{ difficulty: 'normal', floorRange: '4' },
	{ difficulty: 'normal', floorRange: '5' },
	{ difficulty: 'hard', floorRange: '1' },
	{ difficulty: 'hard', floorRange: '6-10' },
	{ difficulty: 'hard', floorRange: '11-15' },
];

test('층수는 구간 표기의 최댓값이다', () => {
	assert.deepEqual(floorBounds(FLOORS), { totalFloors: 15, baseFloors: 5 });
});

test('구간이 한 자리여도 읽는다', () => {
	const got = floorBounds([{ difficulty: 'hard', floorRange: '7' }, { difficulty: 'normal', floorRange: '3' }]);
	assert.deepEqual(got, { totalFloors: 7, baseFloors: 3 });
});

test('숫자가 아닌 구간은 0으로 친다 — 조용히 큰 수를 만들지 않는다', () => {
	const got = floorBounds([{ difficulty: 'hard', floorRange: 'boss' }, { difficulty: 'normal', floorRange: '2' }]);
	assert.deepEqual(got, { totalFloors: 0, baseFloors: 2 });
});

test('층 표가 비면 0이다', () => {
	assert.deepEqual(floorBounds([]), { totalFloors: 0, baseFloors: 0 });
});

test('이름은 로케일별 행이 된다', () => {
	const t = buildMirrorDungeon({
		version: 'MD7',
		floorPack: FLOORS,
		names: [
			{ locale: 'ko', name: '거울의 거울' },
			{ locale: 'en', name: 'Mirror of Mirrors' },
		],
	}, new Meta());

	assert.deepEqual(t.mirrorDungeon, [{ version: 'MD7', totalFloors: 15, baseFloors: 5 }]);
	assert.equal(t.mirrorDungeonText.length, 2);
	assert.equal(t.mirrorDungeonText.find((r) => r.locale === 'ko')?.name, '거울의 거울');
});

test('이름이 하나도 없으면 결손으로 남긴다', () => {
	const meta = new Meta();
	const t = buildMirrorDungeon({ version: 'MD7', floorPack: FLOORS, names: [] }, meta);

	assert.equal(t.mirrorDungeonText.length, 0);
	assert.equal(meta.gaps.filter((g) => g.entity === 'mirror_dungeon').length, 1);
});

test('층수가 0이면 결손으로 남긴다 — 층 표를 못 읽었다는 뜻이다', () => {
	const meta = new Meta();
	buildMirrorDungeon({ version: 'MD7', floorPack: [], names: [{ locale: 'ko', name: 'x' }] }, meta);

	assert.equal(meta.gaps.filter((g) => g.field === 'floors').length, 1);
});
```

- [ ] **Step 3: 실패를 확인한다**

```bash
npx tsx --test src/v2/canonical/mirror-dungeon.test.ts 2>&1 | tail -10
```

기대: FAIL — `./mirror-dungeon.js` 를 못 찾는다.

- [ ] **Step 4: 구현한다**

`src/v2/canonical/mirror-dungeon.ts`:

```typescript
/**
 * 거울 던전 메타. **층 표에서 유도한다.**
 *
 * 원본에 `totalFloors` 도 `baseFloors` 도 없다 — 현행 파이프라인
 * (`src/entities/egos.ts`)도 층 구간 표기에서 최댓값을 취해 만든다. 같은 유도를
 * `canonical.floor_pack` 위에서 한다.
 *
 * **적재 시점에 한 번 한다.** 질의 시점에 매번 다시 세지 않는다 — 산문 유도를
 * 적재 시점에 굳힌 것과 같은 이유다(2026-08-03 메카닉 축 그래프 설계).
 */
import type { Meta } from './meta.js';

const EVIDENCE = 'docs/superpowers/specs/2026-08-05-app-cutover-design.md';

export interface MirrorDungeonInput {
	/** "MD7". 파일명에서 뽑는다 — 유도가 아니라 관측이다 */
	version: string;
	floorPack: Array<{ difficulty: string; floorRange: string }>;
	names: Array<{ locale: string; name: string }>;
}

export interface MirrorDungeonRow {
	version: string;
	totalFloors: number;
	baseFloors: number;
}

export interface MirrorDungeonTextRow {
	version: string;
	locale: string;
	name: string;
}

export interface MirrorDungeonTables {
	mirrorDungeon: MirrorDungeonRow[];
	mirrorDungeonText: MirrorDungeonTextRow[];
}

/**
 * 구간 표기의 최댓값. `"11-15"` → 15 · `"7"` → 7.
 *
 * 숫자가 아닌 조각은 0 으로 친다. `Number('boss')` 는 `NaN` 이고 `Math.max` 에
 * 넣으면 결과가 통째로 `NaN` 이 되는데, 그러면 「층수를 모른다」가 아니라
 * 「층수가 NaN 이다」가 DB 에 들어간다.
 */
export function floorBounds(
	rows: Array<{ difficulty: string; floorRange: string }>,
): { totalFloors: number; baseFloors: number } {
	const maxOf = (difficulty: string): number => {
		let max = 0;
		for (const r of rows) {
			if (r.difficulty !== difficulty) continue;
			for (const part of r.floorRange.split('-')) max = Math.max(max, Number(part) || 0);
		}
		return max;
	};
	return { totalFloors: maxOf('hard'), baseFloors: maxOf('normal') };
}

export function buildMirrorDungeon(input: MirrorDungeonInput, meta: Meta): MirrorDungeonTables {
	const { totalFloors, baseFloors } = floorBounds(input.floorPack);

	if (totalFloors === 0 || baseFloors === 0) {
		// 층 표를 못 읽었다는 뜻이다. 0 을 조용히 넣으면 화면이 「0층 던전」을 그린다
		meta.gap('mirror_dungeon', input.version, 'floors',
			`층 구간에서 층수를 못 얻었다 (hard ${totalFloors} · normal ${baseFloors})`, EVIDENCE);
	}

	if (input.names.length === 0) {
		meta.gap('mirror_dungeon', input.version, 'name', '어느 로케일에도 이름이 없다', EVIDENCE);
	}

	return {
		mirrorDungeon: [{ version: input.version, totalFloors, baseFloors }],
		mirrorDungeonText: input.names.map((n) => ({
			version: input.version, locale: n.locale, name: n.name,
		})),
	};
}
```

- [ ] **Step 5: 통과를 확인한다**

```bash
npx tsx --test src/v2/canonical/mirror-dungeon.test.ts 2>&1 | grep -E "ℹ (tests|pass|fail)"
```

기대: 7 pass / 0 fail.

- [ ] **Step 6: 스키마에 모델 둘을 넣는다**

`prisma/v2/schema.prisma` 의 `model FloorPack` 바로 뒤에 붙인다.

```prisma
/// 거울 던전 판본. **층수는 floor_pack 에서 유도한다** — 원본에 그 값이 없다.
///
/// 현행 파이프라인(src/entities/egos.ts)도 같은 유도를 한다. 적재 시점에 한 번
/// 굳히고 질의 시점에 다시 세지 않는다.
model MirrorDungeon {
  /// "MD7". 파일명에서 뽑는다
  version     String @id
  /// hard 구간의 최댓값. 실측 15
  totalFloors Int    @map("total_floors")
  /// normal 구간의 최댓값. 실측 5
  baseFloors  Int    @map("base_floors")

  texts MirrorDungeonText[]

  @@map("mirror_dungeon")
  @@schema("canonical")
}

/// 판본 명칭. 내부 키 `MD7` 은 화면에 노출하지 않는다(05-ui-foundation 10절).
model MirrorDungeonText {
  version String
  locale  Locale
  name    String

  dungeon MirrorDungeon @relation(fields: [version], references: [version], onDelete: Cascade)

  @@id([version, locale])
  @@map("mirror_dungeon_text")
  @@schema("canonical")
}
```

- [ ] **Step 7: DDL 을 다시 내고 `canonical` 만 늘었는지 본다**

```bash
npm run v2:schema:validate
npm run v2:schema:ddl
git diff prisma/v2/schema.sql | grep -c '"app"'
```

기대: `0`. `app` 문장이 바뀌면 멈추고 왜인지 본다.

```bash
npx tsx -e '
import { readFileSync } from "node:fs";
import { splitDdlBlocks, extractCanonicalDdl, tallyCanonicalDdl } from "./src/v2/schema-ops.js";
const s = readFileSync("prisma/v2/schema.sql", "utf8");
console.log("blocks", splitDdlBlocks(s).length, "canonical", extractCanonicalDdl(s).length);
console.log(tallyCanonicalDdl(s));
'
```

**나온 수를 받아 적는다.** 기준은 블록 260 · canonical 229 · `CREATE TABLE` 95 였다.
표 둘이 늘면 각각 2씩 는다.

- [ ] **Step 8: `schema-ops.test.ts` 의 블록 수를 실측으로 맞춘다**

Step 7 이 낸 수로 아래 두 테스트를 고친다. **추측한 수를 쓰지 않는다.**

```
'진짜 schema.sql — 블록 260개 중 229개가 순수 canonical'
'진짜 schema.sql — 종류별 집계가 실측과 같다'
```

주석에 왜 늘었는지 한 줄 적는다 — `mirror_dungeon` · `mirror_dungeon_text` 둘이다.

- [ ] **Step 9: 적재기에 배선한다**

`src/v2/load-canonical.ts` 에서 `buildMirror` 가 층 표를 만드는 자리를 찾는다.

```bash
grep -n "buildMirror\|floorPack" src/v2/load-canonical.ts | head
```

`import` 를 더한다.

```typescript
import { buildMirrorDungeon } from './canonical/mirror-dungeon.js';
```

**층 표가 만들어진 뒤**에 넣는다. 이름은 `mirror-dungeon/loc-{ko,en,ja}/MirrorDungeonName.json`
에서 온다 — 그 파일을 읽는 방법은 같은 파일 안의 `readSourceGroup` 용례를 따른다.

```bash
grep -n "MirrorDungeonName\|mirror-dungeon" src/v2/load-canonical.ts | head
```

**용례가 없으면 새로 읽어야 한다.** `readSource(prisma, snapshotId, 'mirror-dungeon/loc-ko/MirrorDungeonName.json')`
꼴이며, 반환은 `id → payload` 맵이다. 실측으로 확인한 payload 모양:

```json
{"id": "mirrordungeon_name_7", "content": "..."}
```

**어느 id 가 지금 판본인지**를 정해야 한다. `detectVersion()` 이 v1 에서 하던 일이다.

```bash
grep -n "detectVersion" -A 12 src/entities/*.ts | head -20
```

그 규칙을 그대로 옮긴다. **추측하지 않는다** — 못 찾으면 거기서 멈추고 보고한다.

- [ ] **Step 10: 검사를 더한다**

`src/v2/verify-canonical.ts` 에 넣는다.

```typescript
		// ══ 거울 던전 판본 (앱 전환) ═══════════════════════════════
		eq('mirror_dungeon', await prisma.mirrorDungeon.count(), 1);

		const md = await prisma.mirrorDungeon.findFirst();
		checks.push({
			name: 'mirror_dungeon 층수가 실측과 같다',
			ok: md !== null && md.totalFloors === 15 && md.baseFloors === 5,
			detail: md === null ? '없다' : `hard ${md.totalFloors} · normal ${md.baseFloors} / 15 · 5`,
		});
		// 로케일 셋. loc-ko·en·ja 가 각각 MirrorDungeonName 을 낸다
		eq('mirror_dungeon_text', await prisma.mirrorDungeonText.count(), 3);
```

**`mirror_dungeon_text` 가 3이 아니면 Step 9 의 로케일 처리를 다시 본다.** `Locale` enum 이
`ko|en|ja` 셋이고 원본도 셋 다 있다(실측 각 20건).

- [ ] **Step 11: 굽는다**

**깨끗한 트리에서 돌린다** — 더러우면 `-dirty` 가 붙어 검사가 실패한다(ADR-08).

```bash
git status --porcelain    # 비어야 한다. 아니면 먼저 커밋한다
npm run v2:generate
npm run v2:build 2>&1 | tail -15
```

기대: 검사 전부 통과, `wip 97테이블` (95 + 2).

**「구조가 바뀐 판이다」 안내가 나온다.** 정상이다(ADR-08 §8).

- [ ] **Step 12: 대조하고 승격한다**

```bash
npm run v2:diff 2>&1 | tail -20
```

기대: 테이블 집합에 `mirror_dungeon` · `mirror_dungeon_text` 둘만 늘고 값 차이 없음.

```bash
npm run v2:promote 2>&1 | tail -3
npm run v2:verify:canonical 2>&1 | tail -3
npm run v2:verify:rebuild 2>&1 | tail -6
```

기대: 검사 전부 통과 · **「재현됨」.**

- [ ] **Step 13: 커밋**

```bash
npm run typecheck && npm test 2>&1 | grep -E "ℹ (tests|pass|fail)"
git add prisma/v2/ src/v2/
git commit -m "feat(v2): canonical.mirror_dungeon — 앱 전환의 유일한 결손

층수는 floor_pack 구간 표기에서 유도한다. 원본에 그 값이 없고 현행
파이프라인도 같은 유도를 한다 — 적재 시점에 한 번 굳히고 질의 시점에 다시
세지 않는다.

숫자가 아닌 구간은 0 으로 친다. Number('boss') 는 NaN 이고 Math.max 에 넣으면
결과가 통째로 NaN 이 되는데, 그러면 「층수를 모른다」가 아니라 「층수가 NaN 이다」가
DB 에 들어간다.

층수가 0 이거나 이름이 하나도 없으면 결손으로 남긴다. 0 을 조용히 넣으면
화면이 0층 던전을 그린다."
```

---

### Task 3: `canonical/reference.ts` — 참조 화면 넷과 홈

화면 다섯(about · dungeon · floors · glossary · 홈)이 걸려 있다. **`dataset` 표기가 바뀌는 자리도 여기다**(설계 5절).

**Files:**
- Create: `lib/queries/canonical/reference.ts`
- Modify: `scripts/golden-queries.ts` (`casesV2` 에 추가)
- Modify: `app/[locale]/about/page.tsx` · `dungeon/page.tsx` · `floors/page.tsx` · `glossary/page.tsx` · `app/[locale]/page.tsx`

**Interfaces:**
- Consumes: Task 2 의 `canonical.mirror_dungeon`
- Produces:
  - `listFloorPacks(locale: Locale)` — 현행과 같은 모양
  - `getDungeon(locale: Locale)` — 현행과 같은 모양
  - `GlossaryFilter` · `GLOSSARY_PAGE` · `readGlossaryFilter(params: SearchParams)` · `listStatuses(locale, filter)` · `listGlossaryAxes(locale)`
  - `getBuildInfo()` — **`getDataset` 을 대체한다.** 반환 `{ snapshotId, gameAnchor, snapshotAt, codeCommit, rowCount }`
  - `getCounts()` — 현행과 같은 모양

- [ ] **Step 1: 현행 반환 모양을 정확히 읽는다**

```bash
sed -n '14,52p' lib/queries/reference.ts     # listFloorPacks
sed -n '84,180p' lib/queries/reference.ts    # glossary · dataset · counts
```

**각 함수가 무엇을 돌려주는지 받아 적는다.** 새 질의는 그 모양을 그대로 내야 한다 —
`dataset` 하나만 예외다.

- [ ] **Step 2: 새 파일의 뼈대와 공통부를 쓴다**

`lib/queries/canonical/reference.ts` 머리:

```typescript
import type { Locale } from '@prisma/client';
import { canonical } from '@/lib/db-canonical';
import type { SearchParams } from '@/lib/queries/shared';

/**
 * 참조 화면이 쓰는 캐노니컬 질의 — about · dungeon · floors · glossary · 홈.
 *
 * **현행 `lib/queries/reference.ts` 를 대체한다.** 층만 다르고 반환 모양은 같다.
 * 하나만 예외다 — `getDataset` 이 `getBuildInfo` 가 된다(설계 5절). `public.dataset`
 * 의 `sourceAnchor` 문자열 하나가 `raw.snapshot` 과 `canonical.build_info` 의
 * 스냅샷·코드·저작 셋으로 갈리므로 같은 문구를 못 쓴다.
 *
 * 로케일 폴백은 ADR-03 5절 규칙이다 — 요청한 것이 없으면 영어로 물러서고
 * 폴백이 일어난 사실을 함께 돌려준다.
 */

const localeRows = (locale: Locale) => ({
	where: { locale: { in: [locale, 'en'] as Locale[] } },
});

type TextRow = { locale: string; name: string };

function nameOf(rows: TextRow[], locale: Locale) {
	const exact = rows.find((r) => r.locale === locale);
	if (exact) return { name: exact.name, fellBack: false };
	const en = rows.find((r) => r.locale === 'en');
	return en ? { name: en.name, fellBack: true } : null;
}
```

**`localeRows` 와 `nameOf` 가 `canonical/list.ts` 에도 있다.** 지금은 사본을 둔다 —
Task 7 이 파일 넷을 다 세운 뒤 공통부로 뺀다. 먼저 빼면 아직 모양이 안 정해진 것을
고정하게 된다.

- [ ] **Step 3: `getBuildInfo` 를 쓴다 — 바뀌는 하나**

```typescript
/**
 * 이 데이터가 무엇에서 나왔나.
 *
 * **`public.dataset` 을 대체한다.** 그쪽은 `sourceAnchor` 문자열 하나였는데,
 * 여기서는 스냅샷·코드·저작 셋으로 갈린다(ADR-08). 화면 문구가 바뀌는 유일한
 * 자리이며, 스냅샷 날짜와 게임 시점은 지금과 같은 것을 답한다.
 */
export async function getBuildInfo() {
	const [build, snapshot] = await Promise.all([
		canonical.buildInfo.findFirst(),
		canonical.snapshot.findFirst({ orderBy: { version: 'desc' } }),
	]);
	if (snapshot === null) return null;
	return {
		/** "2026-07-25" */
		snapshotId: snapshot.id,
		/** "차원찢개 이상 인격 출시 시점" */
		gameAnchor: snapshot.gameAnchor,
		snapshotAt: snapshot.createdAt,
		/** 굽는 데 쓴 코드. 없으면 판 표식 이전에 구워진 판이다 */
		codeCommit: build?.codeCommit ?? null,
		rowCount: build?.rowCount ?? null,
	};
}
```

**`canonical.snapshot` 이 맞는 접근자인지 확인한다** — `raw` 스키마의 모델이라 이름이
다를 수 있다.

```bash
grep -n "model Snapshot" -A 3 prisma/v2/schema.prisma
```

- [ ] **Step 4: 나머지 다섯을 쓴다**

`listFloorPacks` · `getDungeon` · `readGlossaryFilter` · `listStatuses` ·
`listGlossaryAxes` · `getCounts`.

**Step 1 에서 받아 적은 반환 모양을 그대로 낸다.** 소스 표만 바꾼다.

```
현행 db.floorPack          → canonical.floorPack
현행 db.mirrorDungeon      → canonical.mirrorDungeon      (Task 2)
현행 db.status             → canonical.status
현행 db.keyword            → canonical.keyword
현행 db.sinInfo            → canonical.sinInfo
```

`getCounts` 는 세는 대상이 같아야 한다. 현행이 무엇을 세는지 Step 1 에서 확인한 그대로다.

- [ ] **Step 5: 골든 목록에 넣는다**

`scripts/golden-queries.ts` 의 `casesV2` 를 채운다.

```typescript
async function casesV2(): Promise<Case[]> {
	const ref = await import('../lib/queries/canonical/reference.js');
	return [
		{ name: 'reference.listFloorPacks', run: () => ref.listFloorPacks('ko') },
		{ name: 'reference.getDungeon', run: () => ref.getDungeon('ko') },
		{ name: 'reference.listStatuses', run: () => ref.listStatuses('ko', ref.readGlossaryFilter({})) },
		{ name: 'reference.listGlossaryAxes', run: () => ref.listGlossaryAxes('ko') },
		{ name: 'reference.getCounts', run: () => ref.getCounts() },
	];
}
```

**`getDataset` 은 안 넣는다.** 대체되는 자리라 대조할 짝이 없다 — compare 가 「한쪽만」
으로 보고하고 그것이 맞다.

- [ ] **Step 6: 대조한다**

```bash
npm run golden:capture -- v2
npm run golden:compare
```

**다른 것이 나오면 하나씩 본다.**

```bash
diff build/golden/v1/reference.listStatuses.json build/golden/v2/reference.listStatuses.json | head -40
```

**판정 셋 중 하나로 적는다:**
```
나아졌다   canonical 이 더 안다.  백로그 해소 목록에 넣는다
같다       통과
깨졌다     새 질의를 고친다
```

- [ ] **Step 7: 화면 다섯의 import 를 바꾼다**

```bash
grep -rn "@/lib/queries/reference" app/
```

각 파일에서 경로만 바꾼다. `about` 과 홈은 `getDataset` 을 `getBuildInfo` 로 바꾸고
**표기도 함께 고친다** — 무엇을 보여줄지는 Step 3 의 반환 필드 안에서 정한다.

- [ ] **Step 8: 빌드로 확인한다**

```bash
npm run typecheck
npm run build 2>&1 | tail -20
```

기대: 통과. 화면이 실제로 선다.

- [ ] **Step 9: 커밋**

```bash
git add lib/queries/canonical/reference.ts scripts/golden-queries.ts app/
git commit -m "feat(web): 참조 화면 다섯이 canonical 을 읽는다

about · dungeon · floors · glossary · 홈. 반환 모양은 그대로 두고 층만 바꾼다.

getDataset 이 getBuildInfo 가 된다. public.dataset 의 sourceAnchor 문자열
하나가 raw.snapshot 과 canonical.build_info 의 스냅샷·코드·저작 셋으로 갈리므로
같은 문구를 못 쓴다 — 화면 문구가 바뀌는 유일한 자리다."
```

---

### Task 4: `canonical/gifts.ts` — 기프트 목록과 상세

가장 큰 덩이다(현행 340줄). 화면 둘.

**Files:**
- Create: `lib/queries/canonical/gifts.ts`
- Modify: `scripts/golden-queries.ts`
- Modify: `app/[locale]/gifts/page.tsx` · `app/[locale]/gifts/[id]/page.tsx`

**Interfaces:**
- Consumes: Task 3 의 `localeRows` · `nameOf` 패턴 (사본)
- Produces:
  - `GIFT_TIERS` · `GIFT_TIER_LABEL` · `NO_KEYWORD` — 현행과 같은 값
  - `GiftFilter` · `readGiftFilter(params: SearchParams)` · `listGifts(locale, filter)` · `GiftListItem`
  - `listCursedGiftIds(): Promise<Set<number>>` · `listAllGifts(locale)` · `listKeywords(locale)` · `listSins(locale)`
  - `getGift(id: number, locale: Locale)` · `GiftDetail`

- [ ] **Step 1: 현행을 읽는다**

```bash
sed -n '1,60p' lib/queries/gifts.ts      # 상수와 필터
sed -n '103,160p' lib/queries/gifts.ts   # listGifts
sed -n '194,325p' lib/queries/gifts.ts   # listAllGifts · getGift
```

**`getGift` 가 무엇을 include 하는지 받아 적는다.** 기프트 상세는 단계별 텍스트 ·
효과 · 트리거 · 팩 · 요구사항 · 합성 조리법이 붙는 화면이다.

- [ ] **Step 2: `canonical` 의 대응 표를 확인한다**

```bash
docker exec limbus-postgres psql -U postgres -d limbus -tAc \
  "SELECT table_name FROM information_schema.tables
    WHERE table_schema='canonical' AND table_name LIKE 'gift%' ORDER BY 1"
```

기대: `gift` · `gift_effect` · `gift_exclusive_pack` · `gift_locked_desc` · `gift_pack` ·
`gift_requirement` · `gift_stage` · `gift_stage_text` · `gift_trigger` · `gift_trigger_param`.

**현행 `public.gift_text` 와 `canonical.gift_stage_text` 는 모양이 다르다.** 현행은
기프트당 한 행이고 캐노니컬은 **단계별**이다. `level 0` 이 기본 단계다 —
`gift-trigger-param.ts` 가 그렇게 쓴다.

- [ ] **Step 3: 상수와 필터를 옮긴다**

`GIFT_TIERS` · `GIFT_TIER_LABEL` · `NO_KEYWORD` · `GiftFilter` · `readGiftFilter` 는
**순수하다** — DB 를 안 본다. 현행에서 그대로 옮긴다.

- [ ] **Step 4: 목록 질의를 쓴다**

`listGifts` · `listAllGifts` · `listCursedGiftIds` · `listKeywords` · `listSins`.

**`listCursedGiftIds` 는 `Set<number>` 를 돌려준다.** 골든 도구가 `Set` 을 정렬 배열로
직렬화하므로 대조가 된다(Task 1 의 `stable`).

- [ ] **Step 5: 상세 질의를 쓴다**

`getGift(id, locale)`. Step 1 에서 받아 적은 반환 모양을 그대로 낸다.

**단계별 텍스트는 `level` 로 고른다.** 현행이 기프트당 한 행이던 것이 여기서는 여러
행이므로, 현행과 같은 것을 내려면 어느 `level` 을 쓸지 정해야 한다. `getGift` 가
강화 단계를 보여주는 화면이면 전부 내고, 아니면 `level 0` 만 낸다 — **Step 1 에서
확인한 현행 동작을 따른다.**

- [ ] **Step 6: 골든에 넣고 대조한다**

`casesV2` 에 일곱을 더한다.

```typescript
		{ name: 'gifts.listGifts', run: () => gifts.listGifts('ko', gifts.readGiftFilter({})) },
		{ name: 'gifts.listAllGifts', run: () => gifts.listAllGifts('ko') },
		{ name: 'gifts.listCursedGiftIds', run: () => gifts.listCursedGiftIds() },
		{ name: 'gifts.listKeywords', run: () => gifts.listKeywords('ko') },
		{ name: 'gifts.listSins', run: () => gifts.listSins('ko') },
		{ name: 'gifts.getGift.9088', run: () => gifts.getGift(9088, 'ko') },
		{ name: 'gifts.getGift.9090', run: () => gifts.getGift(9090, 'ko') },
```

```bash
npm run golden:capture -- v2
npm run golden:compare
```

**`listKeywords` 는 다를 것이 예상된다** — 실측으로 `canonical` 12 vs `public` 10 이다
(설계 3.3). 어느 둘이 늘었는지 이름으로 확인하고 백로그 해소 목록에 적는다.

```bash
diff build/golden/v1/gifts.listKeywords.json build/golden/v2/gifts.listKeywords.json
```

- [ ] **Step 7: 화면 둘의 import 를 바꾸고 빌드한다**

```bash
grep -rn "@/lib/queries/gifts" app/
npm run typecheck && npm run build 2>&1 | tail -10
```

- [ ] **Step 8: 커밋**

```bash
git add lib/queries/canonical/gifts.ts scripts/golden-queries.ts app/
git commit -m "feat(web): 기프트 화면 둘이 canonical 을 읽는다

목록과 상세. 상수와 필터 파서는 순수라 그대로 옮기고 질의만 층을 바꾼다.

gift_text 가 gift_stage_text 로 바뀐다 — 현행은 기프트당 한 행이고 캐노니컬은
단계별이다. 어느 단계를 내려줄지는 현행 화면 동작을 따랐다.

listKeywords 가 10에서 12로 는다. canonical 이 더 아는 것이며 백로그 해소다."
```

---

### Task 5: `canonical/detail.ts` — 인격·E.G.O·팩 상세

화면 셋. 현행 `identities.ts`(212) · `egos.ts`(121) · `packs.ts`(170) 의 상세부.

**Files:**
- Create: `lib/queries/canonical/detail.ts`
- Modify: `lib/queries/canonical/packs.ts` (목록을 채운다)
- Modify: `scripts/golden-queries.ts`
- Modify: `app/[locale]/identities/[id]/page.tsx` · `egos/[id]/page.tsx` · `packs/page.tsx` · `packs/[id]/page.tsx`

**Interfaces:**
- Consumes: Task 3 의 로케일 패턴
- Produces:
  - `getIdentity(id: number, locale: Locale)` · `IdentityDetail`
  - `getEgo(id: number, locale: Locale)` · `EgoDetail`
  - `getPack(id: string, locale: Locale)` · `PackDetail`
  - `packs.ts` 에 `PackFilter` · `readPackFilter` · `listPacks(locale, filter)`
  - `identities.ts` 의 `listAffiliations` · `readIdentityFilter` · `IdentityFilter` · `listIdentities` · `egos.ts` 의 `EGO_RANKS` · `readEgoFilter` · `listEgos` 도 여기로 온다 — 목록 화면은 이미 `canonical/list.ts` 를 쓰지만 **필터 파서는 아직 현행에 있다**

- [ ] **Step 1: 목록 화면이 현행에서 무엇을 더 쓰는지 확인한다**

```bash
grep -rn "@/lib/queries/identities\|@/lib/queries/egos" app/
```

**인격·E.G.O 목록 화면은 `canonical/list.ts` 로 이미 옮겼지만**, 필터 파서(`readIdentityFilter`
· `readEgoFilter`)와 `listAffiliations` 를 현행에서 가져다 쓸 수 있다. 그러면 현행 파일을
못 지운다. 무엇이 남아 있는지 여기서 확정한다.

- [ ] **Step 2: 현행 상세 셋을 읽는다**

```bash
sed -n '105,212p' lib/queries/identities.ts
sed -n '78,121p' lib/queries/egos.ts
sed -n '70,170p' lib/queries/packs.ts
```

- [ ] **Step 3: `detail.ts` 를 쓴다**

머리에 Task 3 과 같은 로케일 공통부를 둔다(사본). 그 뒤 셋을 쓴다.

**인격 상세의 함정** — `identity_text.name` 은 **수감자 이름**이고 인격 이름은 `title` 에
있다. `canonical/list.ts:44` 의 주석이 그 실측을 적어 뒀다. 상세에서도 같다.

- [ ] **Step 4: `packs.ts` 의 목록을 채운다**

지금 19줄이고 `listCollabPackIds` 하나만 있다. `PackFilter` · `readPackFilter` ·
`listPacks` 를 더한다. **팩 목록 화면이 두 층을 동시에 읽던 것이 여기서 끝난다**(설계 3.1).

- [ ] **Step 5: 골든에 넣고 대조한다**

```typescript
		{ name: 'packs.listPacks', run: () => packs.listPacks('ko', packs.readPackFilter({})) },
		{ name: 'packs.getPack.1309', run: () => packs.getPack('1309', 'ko') },
		{ name: 'identities.listAffiliations', run: () => detail.listAffiliations('ko') },
		{ name: 'identities.listIdentities', run: () => detail.listIdentities('ko', detail.readIdentityFilter({})) },
		{ name: 'identities.getIdentity.10208', run: () => detail.getIdentity(10208, 'ko') },
		{ name: 'egos.listEgos', run: () => detail.listEgos('ko', detail.readEgoFilter({})) },
		{ name: 'egos.getEgo.20509', run: () => detail.getEgo(20509, 'ko') },
```

```bash
npm run golden:capture -- v2
npm run golden:compare
```

**`identities.listSinners` 는 짝이 없다** — `canonical/list.ts` 가 이미 같은 이름으로
내고 있다. 골든에 `list.listSinners` 로 따로 넣어 v1 의 것과 대조한다.

```typescript
		{ name: 'identities.listSinners', run: () => list.listSinners('ko') },
```

- [ ] **Step 6: 화면 넷의 import 를 바꾸고 빌드한다**

```bash
npm run typecheck && npm run build 2>&1 | tail -10
```

- [ ] **Step 7: 커밋**

```bash
git add lib/queries/canonical/ scripts/golden-queries.ts app/
git commit -m "feat(web): 인격·E.G.O·팩 상세가 canonical 을 읽는다

목록 화면이 쓰던 필터 파서도 같이 옮긴다 — 안 옮기면 현행 파일을 못 지운다.

팩 목록이 두 층을 동시에 읽던 것이 끝난다. canonical/packs.ts 가 19줄이었고
나머지를 queries/packs.ts 에서 가져다 썼다.

인격 이름은 title 이다. identity_text.name 은 수감자 이름이라 그걸 쓰면 한
수감자의 카드가 전부 같은 이름이 된다 — 목록에서 겪은 것과 같은 함정이다."
```

---

### Task 6: `canonical/squad.ts` — 편성 편집

화면 하나. 현행 200줄.

**Files:**
- Create: `lib/queries/canonical/squad.ts`
- Modify: `scripts/golden-queries.ts`
- Modify: `app/[locale]/squad/page.tsx`

**Interfaces:**
- Consumes: Task 3 의 로케일 패턴
- Produces: `listSquad(locale)` · `SquadSinner` · `SquadIdentity` · `SquadEgo` · `listSquadAxes(locale)` · `SquadAxes`

- [ ] **Step 1: 현행을 읽는다**

```bash
sed -n '37,200p' lib/queries/squad.ts
```

**쓰는 사전 넷을 실측으로 대조해 뒀다**(설계 7절):

```
              canonical   public
sinner            12        12
sin_info           7         7
status         1,472     1,472
keyword           12        10   ← 둘 늘었다
```

`listSquadAxes` 가 `keyword` 를 쓰면 **필터 축이 둘 는다.** 예상된 차이다.

- [ ] **Step 2: 쓴다**

`listSquad` 는 수감자별로 인격과 E.G.O 를 묶어 낸다. `canonical/list.ts` 의
`listIdentitiesFull` · `listEgosFull` 이 비슷한 일을 하므로 **그 모양을 참고한다** —
다만 편성 화면은 다른 필드를 쓸 수 있으니 Step 1 에서 확인한 것을 따른다.

- [ ] **Step 3: 골든에 넣고 대조한다**

```typescript
		{ name: 'squad.listSquad', run: () => squad.listSquad('ko') },
		{ name: 'squad.listSquadAxes', run: () => squad.listSquadAxes('ko') },
```

```bash
npm run golden:capture -- v2
npm run golden:compare
diff build/golden/v1/squad.listSquadAxes.json build/golden/v2/squad.listSquadAxes.json
```

- [ ] **Step 4: 화면 import 를 바꾸고 빌드한다**

```bash
npm run typecheck && npm run build 2>&1 | tail -10
```

- [ ] **Step 5: 커밋**

```bash
git add lib/queries/canonical/squad.ts scripts/golden-queries.ts app/
git commit -m "feat(web): 편성 편집이 canonical 을 읽는다

쓰는 사전 넷 중 keyword 만 다르다 — 10에서 12로 늘어 필터 축이 둘 는다.
나머지 셋(sinner 12 · sin_info 7 · status 1,472)은 행 수가 같다."
```

---

### Task 7: 현행 질의를 지우고 공통부를 뺀다

**`public` 을 읽는 곳이 `recommend` 하나로 줄어드는 순간이다.**

**Files:**
- Delete: `lib/queries/{gifts,identities,egos,packs,reference,search,squad}.ts`
- Create: `lib/queries/canonical/locale.ts`
- Modify: `lib/queries/canonical/*.ts` (사본 제거)
- Modify: `scripts/golden-queries.ts`

**Interfaces:**
- Produces: `localeRows(locale)` · `nameOf(rows, locale)` · `clean(s)` — 파일 넷이 공유

- [ ] **Step 1: `search.ts` 를 옮긴다**

앞 Task 들이 안 다룬 마지막 하나다. 홈 화면이 쓴다.

```bash
sed -n '1,115p' lib/queries/search.ts
```

`canonical/reference.ts` 에 `searchAll` 과 `SearchHit` 을 더한다 — 홈 화면이 이미 그
파일을 쓰므로 파일을 더 만들지 않는다.

골든에 넣고 대조한다.

```typescript
		{ name: 'search.이상', run: () => ref.searchAll('이상', 'ko') },
		{ name: 'search.화상', run: () => ref.searchAll('화상', 'ko') },
```

- [ ] **Step 2: 남은 참조가 없는지 확인한다**

```bash
grep -rn "@/lib/queries/gifts\|@/lib/queries/identities\|@/lib/queries/egos" app/ lib/ components/
grep -rn "@/lib/queries/packs\|@/lib/queries/reference\|@/lib/queries/search\|@/lib/queries/squad" app/ lib/ components/
```

기대: `lib/queries/recommend.ts` 만 나오거나 아무것도 안 나온다.

**`recommend.ts` 가 저 중 하나를 쓰면 지울 수 없다.** 그 경우 무엇을 쓰는지 적고
그 파일만 남긴다 — 범위 밖(설계 결정 1)이므로 억지로 옮기지 않는다.

- [ ] **Step 3: 지운다**

```bash
git rm lib/queries/gifts.ts lib/queries/identities.ts lib/queries/egos.ts \
       lib/queries/packs.ts lib/queries/reference.ts lib/queries/search.ts lib/queries/squad.ts
npm run typecheck
```

**타입 검사가 깨지면 Step 2 가 놓친 참조가 있다.** 하나씩 고친다.

- [ ] **Step 4: 골든 도구의 `casesV1` 을 지운다**

기준이 사라졌으므로 `casesV1` 도 못 돈다. 도구를 지울지 남길지 정한다.

**남긴다.** `casesV2` 는 그대로 쓸 수 있고, 다음 층 이동(M4 의 `recommend`)에서 같은
방식이 필요하다. `casesV1` 만 지우고 `capture` 를 `v2` 전용으로 좁힌다.

- [ ] **Step 5: 로케일 공통부를 뺀다**

파일 넷에 같은 `localeRows` · `nameOf` · `clean` 사본이 있다. `lib/queries/canonical/locale.ts`
로 옮기고 넷이 import 한다.

**이제 빼는 이유** — 넷의 모양이 다 정해졌다. 먼저 뺐으면 안 정해진 것을 고정하게 된다.

```bash
npm run typecheck && npm test 2>&1 | grep -E "ℹ (tests|pass|fail)"
```

- [ ] **Step 6: `public` 을 읽는 곳을 센다**

```bash
grep -rln "@/lib/db'" app/ lib/ components/ | sort
```

기대: `lib/queries/recommend.ts` 와 `lib/engine/*` 만. **그 목록을 받아 적는다** —
설계 2절의 완료 조건이 그것이다.

- [ ] **Step 7: 빌드하고 커밋**

```bash
npm run build 2>&1 | tail -10
git add -A
git commit -m "refactor(web): 현행 질의 일곱을 지운다

public 을 읽는 곳이 recommend 하나로 줄었다. 옮긴 뒤 지운다 — 두 층이 병존한
동안 화면씩 대조할 수 있었고, 이제 기준이 필요 없다.

로케일 공통부를 canonical/locale.ts 로 뺀다. 파일 넷의 모양이 다 정해진 뒤에
빼는 것이 맞다 — 먼저 뺐으면 안 정해진 것을 고정하게 된다."
```

---

### Task 8: 백로그 갱신과 문서

골든 대조가 낸 차이를 기록으로 남긴다.

**Files:**
- Modify: `docs/backlog/README.md` · `docs/backlog/0{1,2,7,8,9}-*.md`
- Modify: `docs/superpowers/specs/2026-08-05-app-cutover-design.md`
- Modify: `docs/adr/05-web-serving.md` (읽는 층)

**Interfaces:**
- Consumes: Task 3~7 의 골든 대조 결과
- Produces: 없음 (문서)

- [ ] **Step 1: 골든 차이를 모은다**

Task 3·4·5·6 에서 적어 둔 「다른 것」을 한자리에 모은다. 각각 셋 중 하나로 판정돼 있어야 한다.

```
나아졌다 — canonical 이 더 안다
같다
깨졌다 — 고쳤다
```

- [ ] **Step 2: 백로그 다섯의 상태를 바꾼다**

`docs/backlog/README.md` 의 표에서 01·02·07·08·09 의 상태를 고친다.

```
지금    신규 DB 해소 · 현행 미착수
이후    해소 (2026-08-05, PR #27)
```

**각 문서 파일에도 처리 시점과 실제로 한 일을 덧붙인다.** 백로그 규칙 1 이 「처리한
항목의 파일을 지우지 않는다. 상태를 바꾸고 처리 시점과 실제로 한 일을 덧붙인다」다.

**골든 대조에서 실제로 확인되지 않은 것은 「해소」로 적지 않는다.** 예를 들어 07
(변환 리포트)은 화면과 무관하므로 이 PR 이 안 건드렸을 수 있다 — 그러면 상태를 안
바꾼다.

- [ ] **Step 3: 설계 문서에 구현 결과를 더한다**

`docs/superpowers/specs/2026-08-05-app-cutover-design.md` 의 7절을 「구현에서 닫은 것」
으로 바꾸고, 9절 「구현 결과」를 더한다.

```
파일 목록
검증 수치 — 검사 · 테스트 · 빌드 · 골든 대조 몇 건 중 몇 건이 같았나
백로그 해소 목록 — 무엇이 어떻게 달라졌나
public 을 읽는 곳이 몇 개 남았나
```

- [ ] **Step 4: ADR-05 에 후속을 적는다**

```bash
grep -n "public\|스키마" docs/adr/05-web-serving.md | head
```

ADR-05 가 「이 클라이언트로 PostgreSQL 을 직접 질의한다」고 정했다. **어느 스키마를
읽는지가 바뀌었으므로** 그 자리에 후속 인용을 넣는다 — ADR-07 §3 에 ADR-08 후속을
넣은 것과 같은 방식이다.

- [ ] **Step 5: 마지막 검증과 커밋**

```bash
git status --porcelain     # 비어야 한다
npm run typecheck
npm test 2>&1 | grep -E "ℹ (tests|pass|fail|skipped)"
npm run build 2>&1 | tail -5
npm run v2:verify:canonical 2>&1 | tail -3
npm run v2:verify:rebuild 2>&1 | tail -6
```

```bash
git add docs/
git commit -m "docs: 앱 전환 결과와 백로그 갱신

골든 대조가 낸 차이를 백로그 다섯의 해소로 기록한다. 확인되지 않은 것은
해소로 적지 않는다.

ADR-05 에 후속을 적는다 — 어느 스키마를 읽는지가 바뀌었다."
```

- [ ] **Step 6: PR 본문을 갈고 draft 를 푼다**

```bash
git push
gh pr ready 27
gh pr checks 27 --watch --interval 15
```

---

## Self-Review

**스펙 커버리지**

| 설계 절 | Task |
| --- | --- |
| 1 무엇을 바꾸나 | Task 3~7 |
| 2 셋을 가른다 | Task 7 Step 6 이 「recommend 하나」를 실측으로 확인 |
| 3.1 화면과 질의 | Task 3(참조 5) · 4(기프트 2) · 5(상세 4) · 6(편성 1) · 7(홈 검색) |
| 3.2 클라이언트 둘 | Task 7 Step 6 |
| 3.3 mirror_dungeon | Task 2 |
| 3.3 dataset | Task 3 Step 3 (`getBuildInfo`) |
| 결정 1 범위 | Global Constraints · Task 7 Step 2 가 recommend 를 남긴다 |
| 결정 2 새 파일 | Task 3~6 이 세우고 Task 7 이 지운다 |
| 결정 3 mirror_dungeon | Task 2 |
| 결정 4 골든 대조 | Task 1 이 도구를 만들고 3~6 이 쓴다 |
| 5 화면 계약 | Task 3 Step 3·7 (dataset) · Task 8 Step 1 (나머지 차이) |
| 6 검증 | Task 2 Step 11~12 (승격) · Task 8 Step 5 |
| 7 열린 것 셋 | Task 3 Step 3 (dataset) · Task 2 Step 9 (detectVersion) · Task 8 Step 1 (백로그) |

**의도적으로 안 하는 것**

```
recommend 전환 · DROP SCHEMA public    M4 (설계 결정 1)
lib/engine 제거                        같이 간다
값이 바뀌는 판의 승격                   mirror_dungeon 은 새 표라 기존 행이 안 움직인다
```

**타입 일관성**

`Locale` 은 **전부 `@prisma/client`(v1) 것**이다 — Global Constraints 가 그 근거를 적었다.
`canonical/list.ts` 가 이미 그렇게 하고 있고 새 파일 넷도 같다.

`getBuildInfo` 의 반환 필드(`snapshotId` · `gameAnchor` · `snapshotAt` · `codeCommit` ·
`rowCount`)는 Task 3 Step 3 에서 정의하고 Task 3 Step 7 의 화면이 쓴다. `getDataset` 과
필드 이름이 하나도 안 겹친다 — 화면이 옛 이름을 쓰면 타입 검사가 잡는다.

`localeRows` · `nameOf` · `clean` 은 Task 3~6 에서 **사본**으로 두고 Task 7 Step 5 가
`canonical/locale.ts` 로 뺀다. 그 순서인 이유를 Task 7 Step 5 가 적었다.

**위험한 자리 셋**

**Task 2 Step 9** — `detectVersion()` 이 v1 에서 무엇을 하는지 아직 안 읽었다. 판본 id 를
못 정하면 `mirror_dungeon` 이 안 선다. 그 Step 에 「추측하지 않는다 — 못 찾으면 멈추고
보고한다」를 박아 뒀다.

**Task 4 Step 5** — `gift_text`(기프트당 한 행) → `gift_stage_text`(단계별)는 모양이
다른 유일한 자리다. 어느 `level` 을 낼지 틀리면 상세 화면이 통째로 바뀐다.

**Task 5 Step 1** — 인격·E.G.O 목록 화면이 현행 파일에서 **필터 파서를 아직 가져다
쓸 수 있다.** 그러면 Task 7 이 파일을 못 지운다. Step 1 이 그것부터 확인한다.
