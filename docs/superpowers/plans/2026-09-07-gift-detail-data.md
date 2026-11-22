# 범위 재설정 B — 기프트 상세가 기다리는 데이터 (D0 · D2 · D11 · D3 · D14 · D4) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 기프트 상세·팩 상세 화면이 판정 코드 없이 짤 수 있도록, 화면이 계산하던 다섯 가지(개수 · 팩 종류 · 강화 단계 diff · 저주·축복 짝과 획득 조건 · 이웃 기프트)를 데이터층이 낸다.

**Architecture:** 파이프라인에 들어가는 것은 D2 하나 — `canonical.pack` 에 `kind` · `step` 두 컬럼을 `buildPacks` 가 계산해 넣고, `lib/pack-label.ts` 는 이름표와 차례만 남긴다. 나머지는 이미 canonical 에 있는 값(`gift_stage_text.desc_raw` 의 `upgradeHighlight` 마크업 · `gift_locked_desc` 텍스트)을 질의층의 순수 함수로 풀어 `getGift` 반환에 얹는다. 순수 함수는 DB 없이 테스트하고, 질의 결과는 DB 를 띄워 실측으로 확인한다.

**Tech Stack:** TypeScript · Prisma 6 (schema.prisma → `v2:schema:ddl` 로 SQL 생성) · PostgreSQL 17 (Docker) · `node:test` via `tsx --test`

**Spec:** `docs/superpowers/specs/2026-09-07-scope-reset-design.md` §3.2 · design surface 요구(2026-09-07 회신: 순서 D2 → D11 → D3 → D4, D14 신규)

## Global Constraints

- `app/**` · `components/**` 는 design 소유. 이 계획이 손대는 예외는 `app/[locale]/packs/page.tsx:34-60` 한 곳 — `packKind` 호출을 걷어내는 최소 편집(spec §4 「D 처리 시점에 data 가 지우거나 줄인다」).
- `lib/engine/**` 무수정.
- canonical 은 `npm run v2:build` → `v2:diff` → `v2:promote` 로만 바뀐다(ADR-07). D2 는 이 절차를 탄다.
- 지어내지 않는다. 회차는 assets `bossEncounters` 의 `md|walpu-N` 이 1차 근거, 스프라이트 `Walpu<N>_` 은 대조용. 둘이 어긋나면 `meta.gap`.
- 반환 타입을 먼저 확정해 design surface 에 보낸다(Task 8). 이름은 design 회신의 요구대로: `kind` · `floors` · `segments` · `acquire` · `pair` · `neighbors`.
- 검증 명령: `npm test` · `npm run typecheck` · DB 작업은 `npm run db:up` 뒤 `npm run v2:build && npm run v2:diff && npm run v2:promote && npm run v2:verify:canonical`.
- 브랜치 `feat/gift-detail-data`. 태스크마다 커밋, PR 하나.

---

## 파일 지도

| 파일 | 작업 | D |
| --- | --- | --- |
| `lib/queries/canonical/scope.ts` | 신규. 목록과 개수가 같이 쓰는 where 상수 | D0 |
| `lib/queries/canonical/reference.ts:334-347` | `getCounts` 가 scope 를 쓴다 | D0 |
| `lib/queries/canonical/list.ts:120` · `gifts.ts:69` | scope import 로 교체 | D0 |
| `prisma/v2/schema.prisma` Pack 모델 | `kind PackKind` · `step Int` 추가 | D2 |
| `src/v2/canonical/packs.ts` | `PackRow` 확장 · `kindOf()` 계산 | D2 |
| `src/v2/canonical/packs.test.ts` | 종류 판정 8 케이스 | D2 |
| `src/v2/verify-canonical.ts:31-34` | kind 분포 검사 | D2 |
| `lib/pack-label.ts` | 판정 삭제. 이름표·차례만 | D2 |
| `lib/queries/canonical/packs.ts:40-77` | `listPacks` 가 `kind` 를 낸다 · `listCollabPackIds` 삭제 | D2 |
| `app/[locale]/packs/page.tsx:34-60` | `packKind` 호출 제거(최소 편집) | D2 |
| `lib/queries/canonical/gift-stage-diff.ts` (+test) | 신규. `segmentsOf` | D11 |
| `lib/queries/canonical/gift-acquire.ts` (+test) | 신규. `parseAcquire` | D3 |
| `lib/queries/canonical/gifts.ts:217-260` · `:286-378` | `listCursedGiftIds` 교체 · `getGift` 확장 | D2 · D11 · D3 · D14 |
| `docs/backlog/13-frontend-data-debt.md` | 2 · 3 · 4 처리 기록 | D4 |

---

### Task 1 (D0): 표시용 개수가 목록과 같은 범위를 센다

**Files:**
- Create: `lib/queries/canonical/scope.ts`
- Modify: `lib/queries/canonical/reference.ts:334-347`
- Modify: `lib/queries/canonical/list.ts:120` · `lib/queries/canonical/gifts.ts:69`
- Test: `lib/queries/canonical/scope.test.ts`

**Interfaces:**
- Produces: `export const GIFT_SCOPE = { domain: 'mirror_dungeon' } as const;` · `export const EGO_SCOPE = { presentationOnly: false } as const;`
- `getCounts()` 반환 모양은 그대로(`{ gifts, packs, identities, egos, skills, statuses, affiliations, relations }`). 값만 456 · 110 으로 바뀐다.

- [ ] **Step 1: 테스트**

`lib/queries/canonical/scope.test.ts`:

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GIFT_SCOPE, EGO_SCOPE } from './scope';

test('목록과 개수가 같은 범위 상수를 쓴다', () => {
	assert.deepEqual(GIFT_SCOPE, { domain: 'mirror_dungeon' });
	assert.deepEqual(EGO_SCOPE, { presentationOnly: false });
});
```

- [ ] **Step 2: 실패 확인** — `npx tsx --test lib/queries/canonical/scope.test.ts` → 모듈 없음.

- [ ] **Step 3: `scope.ts`**

```ts
/**
 * 화면이 다루는 범위. **목록과 개수가 같은 상수를 읽는다** — 홈이 표 전체
 * (E.G.O 115 · 기프트 582)를 세고 목록이 걸러 110 · 456 을 내던 불일치(spec D0).
 *
 * 기프트  캐노니컬이 스토리 던전 126종을 더 갖는다. 거울 던전만 낸다
 * E.G.O   presentationOnly 5종은 연출용이라 목록에서 뺀다
 */
export const GIFT_SCOPE = { domain: 'mirror_dungeon' } as const;
export const EGO_SCOPE = { presentationOnly: false } as const;
```

- [ ] **Step 4: 쓰는 곳 셋**

`gifts.ts:69` 의 `const MIRROR = { domain: 'mirror_dungeon' } as const;` → `import { GIFT_SCOPE as MIRROR } from './scope';` (파일 안 참조는 그대로 `MIRROR`).
`list.ts:120` 의 `where: { presentationOnly: false }` → `where: EGO_SCOPE` (import 추가).
`reference.ts:334-347`:

```ts
export async function getCounts() {
	const [gifts, packs, identities, egos, skills, statuses, affiliations, relations] =
		await Promise.all([
			canonical.gift.count({ where: GIFT_SCOPE }),
			canonical.pack.count(),
			canonical.identity.count(),
			canonical.ego.count({ where: EGO_SCOPE }),
			canonical.skill.count(),
			canonical.status.count(),
			canonical.association.count(),
			canonical.giftPack.count(),
		]);
	return { gifts, packs, identities, egos, skills, statuses, affiliations, relations };
}
```

- [ ] **Step 5: 검증·커밋** — `npm test && npm run typecheck` PASS.

```bash
git add lib/queries/canonical/scope.ts lib/queries/canonical/scope.test.ts lib/queries/canonical/reference.ts lib/queries/canonical/list.ts lib/queries/canonical/gifts.ts
git commit -m "fix(query): 홈 개수가 목록과 같은 범위를 센다 — 기프트 456 · E.G.O 110"
```

---

### Task 2 (D2 파이프라인): `canonical.pack.kind` · `step`

**Files:**
- Modify: `prisma/v2/schema.prisma` (`model Pack` · 새 `enum PackKind`)
- Modify: `src/v2/canonical/packs.ts` (`PackRow` · `buildPacks`)
- Modify: `src/v2/verify-canonical.ts:31-34`
- Test: `src/v2/canonical/packs.test.ts`

**Interfaces:**
- Produces: `canonical.pack.kind` (enum `generic | canto | railway | extreme | event | walpurgis | collab | hidden`) · `canonical.pack.step Int` (장 번호 또는 발푸르기스 회차, 없으면 0).
- Produces: `export function kindOf(input: { category: string; chapter: number | null; sprite: string; tags: string[]; categoryPath: string[]; bossEncounters: string[] }): { kind: PackKindKey; step: number; conflict: string | null }`

- [ ] **Step 1: 테스트 — 종류 8 + 어긋남 1**

`src/v2/canonical/packs.test.ts` 끝에 추가:

```ts
import { kindOf } from './packs.js';

const base = { category: 'extreme', chapter: null, sprite: 'X', tags: [] as string[], categoryPath: [] as string[], bossEncounters: [] as string[] };

test('kindOf — 콜라보 태그가 제일 먼저다', () => {
	assert.deepEqual(kindOf({ ...base, tags: ['Collab'] }), { kind: 'collab', step: 0, conflict: null });
});
test('kindOf — 히든은 분류 경로로 본다', () => {
	assert.deepEqual(kindOf({ ...base, sprite: 'HiddenTheme', categoryPath: ['Hidden'] }), { kind: 'hidden', step: 0, conflict: null });
});
test('kindOf — 발푸르기스 회차는 bossEncounters 가 근거다. 2·3회는 category 가 extreme', () => {
	assert.deepEqual(
		kindOf({ ...base, category: 'extreme', sprite: 'Walpu2_Something', bossEncounters: ['md|walpu-2'] }),
		{ kind: 'walpurgis', step: 2, conflict: null },
	);
});
test('kindOf — 회차 근거가 어긋나면 conflict 를 남기고 bossEncounters 를 믿는다', () => {
	const r = kindOf({ ...base, category: 'walpurgis', sprite: 'Walpu5_X', bossEncounters: ['md|walpu-4'] });
	assert.equal(r.kind, 'walpurgis');
	assert.equal(r.step, 4);
	assert.match(r.conflict ?? '', /sprite 5/);
});
test('kindOf — 범용은 attack_type · sin · keyword', () => {
	for (const category of ['attack_type', 'sin', 'keyword'])
		assert.deepEqual(kindOf({ ...base, category }), { kind: 'generic', step: 0, conflict: null });
});
test('kindOf — 장은 chapter 가 step', () => {
	assert.deepEqual(kindOf({ ...base, category: 'canto', chapter: 7 }), { kind: 'canto', step: 7, conflict: null });
});
test('kindOf — railway · event · extreme 은 분류 그대로', () => {
	assert.equal(kindOf({ ...base, category: 'railway' }).kind, 'railway');
	assert.equal(kindOf({ ...base, category: 'event' }).kind, 'event');
	assert.equal(kindOf({ ...base, category: 'extreme' }).kind, 'extreme');
});
test('buildPacks — pack 행에 kind · step 이 실린다', () => {
	const t = buildPacks(input(), new Meta());
	assert.equal(t.pack[0]?.kind, 'canto');
	assert.equal(t.pack[0]?.step, 1);
});
```

- [ ] **Step 2: 실패 확인** — `npx tsx --test src/v2/canonical/packs.test.ts` → `kindOf` export 없음.

- [ ] **Step 3: `packs.ts` — `kindOf` 와 행 확장**

`PackRow` 에 `kind: PackKindKey; step: number;` 추가. 파일 상단에:

```ts
export const PACK_KINDS = ['generic', 'canto', 'railway', 'extreme', 'event', 'walpurgis', 'collab', 'hidden'] as const;
export type PackKindKey = (typeof PACK_KINDS)[number];

const GENERIC = new Set(['attack_type', 'sin', 'keyword']);
const WALPU_BOSS = /^md\|walpu-(\d+)$/;
const WALPU_SPRITE = /^Walpu(\d+)[_.]/;

/**
 * 팩 종류와 단(장 번호 · 회차).
 *
 * 화면(`lib/pack-label.ts`)이 스프라이트 이름을 파싱해 판정하던 것을 데이터로 옮긴다
 * (backlog 13-2 · spec D2). 회차의 1차 근거는 assets `bossEncounters` 의 `md|walpu-N` —
 * 스프라이트는 대조용이며 어긋나면 `conflict` 로 돌려 `field_gap` 에 남긴다.
 * 발푸르기스 2·3 회는 `category` 가 `extreme` 이라 분류만으로는 못 가른다.
 */
export function kindOf(input: {
	category: string;
	chapter: number | null;
	sprite: string;
	tags: string[];
	categoryPath: string[];
	bossEncounters: string[];
}): { kind: PackKindKey; step: number; conflict: string | null } {
	if (input.tags.includes('Collab')) return { kind: 'collab', step: 0, conflict: null };
	if (input.categoryPath.includes('Hidden') || input.sprite === 'HiddenTheme')
		return { kind: 'hidden', step: 0, conflict: null };

	const bossRound = input.bossEncounters.map((b) => WALPU_BOSS.exec(b)?.[1]).find(Boolean);
	const spriteRound = WALPU_SPRITE.exec(input.sprite)?.[1];
	if (bossRound || spriteRound || input.category === 'walpurgis') {
		const step = Number(bossRound ?? spriteRound ?? 0);
		const conflict =
			bossRound && spriteRound && bossRound !== spriteRound
				? `회차 근거 불일치 — bossEncounters ${bossRound} · sprite ${spriteRound}`
				: null;
		return { kind: 'walpurgis', step, conflict };
	}

	if (GENERIC.has(input.category)) return { kind: 'generic', step: 0, conflict: null };
	if (input.category === 'canto') return { kind: 'canto', step: input.chapter ?? 0, conflict: null };
	if (input.category === 'railway') return { kind: 'railway', step: 0, conflict: null };
	if (input.category === 'event') return { kind: 'event', step: 0, conflict: null };
	return { kind: 'extreme', step: 0, conflict: null };
}
```

`buildPacks` 안, `pack.push({...})` 직전에:

```ts
		const tags = strArr(assets, 'tags');
		const path = arr(assets, 'category').map(String);
		const { kind, step, conflict } = kindOf({
			category,
			chapter: num(mj, 'chapter'),
			sprite,
			tags,
			categoryPath: path,
			bossEncounters: strArr(assets, 'bossEncounters'),
		});
		if (conflict) meta.gap('pack', id, 'step', conflict, EVIDENCE);
		meta.source('pack', id, 'kind', 'derived', [MJ, ASSETS]);
```

`pack.push` 에 `kind, step` 추가. 아래쪽에 이미 있는 `const tags = strArr(assets, 'tags');` · `const path = arr(assets, 'category');` 두 줄은 위로 올라갔으므로 지우고 `path.forEach` 는 `String(value)` 대신 `value` 를 쓴다.

- [ ] **Step 4: `schema.prisma`**

`enum PackCategory` 아래에:

```prisma
/// 화면 종류. buildPacks.kindOf 가 category · tags · categoryPath · bossEncounters 로 판정한다
enum PackKind {
  generic
  canto
  railway
  extreme
  event
  walpurgis
  collab
  hidden

  @@schema("canonical")
}
```

`model Pack` 의 `unlockCode` 아래에:

```prisma
  /// 종류. 늘 고를 수 있는 것(generic)부터 한정(hidden)까지 — 차례는 lib/pack-label.ts KIND_ORDER
  kind          PackKind
  /// 같은 종류 안의 단 — canto 는 장, walpurgis 는 회차. 없으면 0
  step          Int          @default(0)
```

Run: `npm run v2:schema:validate && npm run v2:schema:ddl && npm run v2:generate`
Expected: `prisma/v2/schema.sql` 에 `"kind" "canonical"."PackKind" NOT NULL` · `"step" INTEGER NOT NULL DEFAULT 0` 이 생긴다.

- [ ] **Step 5: 검사 규칙**

`src/v2/verify-canonical.ts:34` 다음에:

```ts
		// D2 — 종류 분포. 실측(2026-07-25 스냅샷): 범용 41 · 발푸르기스 6(회차 2·3·4·5·6·8) · 콜라보 1 · 히든 1
		eq('pack.kind generic', await prisma.pack.count({ where: { kind: 'generic' } }), 41);
		eq('pack.kind walpurgis', await prisma.pack.count({ where: { kind: 'walpurgis' } }), 6);
		eq('pack.kind collab', await prisma.pack.count({ where: { kind: 'collab' } }), 1);
		eq('pack.kind hidden', await prisma.pack.count({ where: { kind: 'hidden' } }), 1);
		eq(
			'pack.step walpurgis 회차',
			(await prisma.pack.findMany({ where: { kind: 'walpurgis' }, select: { step: true }, orderBy: { step: 'asc' } }))
				.map((p) => p.step)
				.join(','),
			'2,3,4,5,6,8',
		);
		eq('pack.kind canto 는 step 이 chapter 와 같다', await prisma.pack.count({ where: { kind: 'canto', step: 0 } }), 0);
```

`eq` 가 문자열 비교를 못 받으면(시그니처가 `number` 뿐이면) 그 자리에 `assert.equal` 을 쓰고 같은 이름표로 보고한다.

- [ ] **Step 6: 단위 테스트 통과** — `npx tsx --test src/v2/canonical/packs.test.ts && npm run typecheck` PASS.

- [ ] **Step 7: DB 재빌드와 승격**

```bash
npm run db:up
npm run v2:build
npm run v2:diff          # pack 표에 kind · step 두 컬럼이 더해진 것 외에 차이가 없어야 한다
npm run v2:promote
npm run v2:verify:canonical
```

Expected: verify 가 위 6건을 포함해 전부 통과. 실패하면 실측 분포를 verify 에 적기 전에 `v2:diff` 출력에서 실제 값을 확인해 **틀린 기대값을 고친다** — 데이터를 기대에 맞추지 않는다.

- [ ] **Step 8: 커밋**

```bash
git add prisma/v2/schema.prisma prisma/v2/schema.sql src/v2/canonical/packs.ts src/v2/canonical/packs.test.ts src/v2/verify-canonical.ts
git commit -m "feat(data): 팩 종류와 단을 canonical.pack.kind · step 으로 — 회차는 bossEncounters 가 근거"
```

---

### Task 3 (D2 질의): `pack-label.ts` 는 이름표만, `listPacks` · `getGift` 가 `kind` 를 낸다

**Files:**
- Modify: `lib/pack-label.ts` (판정 삭제)
- Modify: `lib/queries/canonical/packs.ts:18-24` (삭제) · `:40-77`
- Modify: `lib/queries/canonical/gifts.ts:286-378` (`getGift` 의 packs · exclusivePacks)
- Modify: `app/[locale]/packs/page.tsx:34-60` (최소 편집)
- Test: `lib/pack-label.test.ts`

**Interfaces:**
- Produces (두 화면 공용 팩 모양):

```ts
export interface PackRef {
	id: string;
	text: Named | null;                   // nameOf 반환형 { name; fellBack } — 화면 Name 컴포넌트가 EN 배지를 단다(05-ui §6.1)
	sprite: string;
	icon: string | null;
	kind: PackKind;                       // { key: PackKindKey; step: number; label: string }
	floors: Array<{ difficulty: 'normal' | 'hard'; range: string }>;
}
```

- `packKind(pack: { kind: PackKindKey; step: number }, locale): PackKind` — 입력이 바뀐다. `comparePackKind` 시그니처는 그대로.
- `listPacks` 반환 원소에 `kind: PackKind` 추가. `listCollabPackIds` 삭제.
- `getGift().packs` · `.exclusivePacks` 가 `PackRef[]` 이며 `comparePackKind` 순서로 정렬돼 온다.

- [ ] **Step 1: 테스트**

`lib/pack-label.test.ts`:

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { packKind, comparePackKind, KIND_ORDER } from './pack-label';

test('packKind — 데이터가 준 kind · step 에 이름표만 붙인다', () => {
	assert.deepEqual(packKind({ kind: 'walpurgis', step: 4 }, 'ko'), { key: 'walpurgis', step: 4, label: '4회 발푸르기스' });
	assert.deepEqual(packKind({ kind: 'walpurgis', step: 0 }, 'en'), { key: 'walpurgis', step: 0, label: 'Walpurgis Night' });
	assert.deepEqual(packKind({ kind: 'canto', step: 3 }, 'ko'), { key: 'canto', step: 3, label: '3장' });
	assert.deepEqual(packKind({ kind: 'collab', step: 0 }, 'ko'), { key: 'collab', step: 0, label: '콜라보 한정' });
});

test('comparePackKind — 종류 → 단 → id', () => {
	const a = packKind({ kind: 'generic', step: 0 }, 'ko');
	const b = packKind({ kind: 'canto', step: 2 }, 'ko');
	const c = packKind({ kind: 'canto', step: 1 }, 'ko');
	assert.ok(comparePackKind(a, b, '1', '2') < 0);
	assert.ok(comparePackKind(b, c, '1', '2') > 0);
	assert.equal(KIND_ORDER.length, 8);
});
```

- [ ] **Step 2: 실패 확인** — `npx tsx --test lib/pack-label.test.ts` → 타입 오류(`category` 없음).

- [ ] **Step 3: `pack-label.ts` 를 줄인다**

51~54행(`WALPURGIS_ROUND` · `HIDDEN_SPRITE`) · 24행 `GENERIC` · `OTHER` 삭제. `PackKindInput` 을 다음으로:

```ts
/** 데이터가 준 종류와 단(`canonical.pack.kind` · `step`). 판정은 파이프라인 `kindOf` 가 했다. */
export type PackKindInput = { kind: PackKindKey; step: number };
```

`packKind` 본문:

```ts
export function packKind(pack: PackKindInput, locale: Locale): PackKind {
	const ko = locale === 'ko';
	const { kind: key, step } = pack;
	const label =
		key === 'collab' ? (ko ? '콜라보 한정' : 'Collab only')
		: key === 'walpurgis' && step > 0 ? (ko ? `${step}회 발푸르기스` : `Walpurgis Night ${step}`)
		: key === 'canto' && step > 0 ? (ko ? `${step}장` : `Canto ${step}`)
		: PACK_KIND_LABEL[locale][key];
	return { key, step, label };
}
```

`PackKindKey` 는 `src/v2/canonical/packs.ts` 의 `PACK_KINDS` 와 같은 8종이어야 한다 — `KIND_ORDER` 는 차례를 담으므로 그대로 두고, 테스트 파일에 `assert.deepEqual([...KIND_ORDER].sort(), [...PACK_KINDS].sort())` 를 한 줄 더한다(`import { PACK_KINDS } from '@/src/v2/canonical/packs'` 가 tsconfig 경계를 넘으면 문자열 배열을 그대로 적어 비교한다).

- [ ] **Step 4: `listPacks` · `listCollabPackIds`**

`lib/queries/canonical/packs.ts:18-24` `listCollabPackIds` 삭제. `listPacks` 반환에 `kind: packKind({ kind: p.kind, step: p.step }, locale),` 추가(import `packKind` from `@/lib/pack-label`). 정렬은 그대로 id.

- [ ] **Step 5: `getGift` 의 팩 둘**

`gifts.ts` `getGift` 의 include 에서 `exclusivePacks` · `packs` 의 `pack` 에 `floors: true` 를 더하고, 반환을:

```ts
	const packRef = (p: {
		id: string; sprite: string; kind: PackKindKey; step: number;
		texts: Array<{ locale: string; name: string }>;
		floors: Array<{ difficulty: 'normal' | 'hard'; floorRange: string }>;
	}) => ({
		id: p.id,
		text: nameOf(p.texts, locale),
		sprite: p.sprite,
		icon: packIcon(p.sprite),
		kind: packKind({ kind: p.kind, step: p.step }, locale),
		floors: p.floors.map((f) => ({ difficulty: f.difficulty, range: f.floorRange })),
	});
	const byKind = (a: ReturnType<typeof packRef>, b: ReturnType<typeof packRef>) =>
		comparePackKind(a.kind, b.kind, a.id, b.id);
	// …
		exclusivePacks: gift.exclusivePacks.map((x) => packRef(x.pack)).sort(byKind),
		packs: gift.packs.map((x) => packRef(x.pack)).sort(byKind),
```

`packIcon` 은 `lib/assets.ts` 에 있다(`lib/queries/canonical/packs.ts` 가 쓰는 것과 같은 import).

- [ ] **Step 6: `app/[locale]/packs/page.tsx:34-60` 최소 편집**

```ts
	const packs = await listPacks(locale, filter);
	const all = packs
		.map((pack) => ({ pack, kind: pack.kind }))
		.sort((a, b) => comparePackKind(a.kind, b.kind, a.pack.id, b.pack.id));
```

`listCollabPackIds` · `packKind` import 제거. 이 파일의 다른 줄은 손대지 않는다.

- [ ] **Step 7: 검증**

`npm test && npm run typecheck` PASS. DB 켜진 상태에서 `npm run dev` 후 `http://localhost:3000/ko/packs` 를 열어 목록 차례가 이전과 같은지(범용 41 → 장 → … → 히든) 눈으로 확인하고, `/ko/gifts/9744`(발푸르기스 4회 전용 기프트) 의 `packs` 가 종류 순으로 오는지 서버 로그나 임시 `console.log` 로 확인한 뒤 지운다.

- [ ] **Step 8: 커밋**

```bash
git add lib/pack-label.ts lib/pack-label.test.ts lib/queries/canonical/packs.ts lib/queries/canonical/gifts.ts 'app/[locale]/packs/page.tsx'
git commit -m "refactor(query): 팩 종류 판정을 화면에서 걷어낸다 — kind 는 데이터가 준다"
```

---

### Task 4 (D11): 강화 단계의 바뀐 자리 — `segments`

**Files:**
- Create: `lib/queries/canonical/gift-stage-diff.ts` · `gift-stage-diff.test.ts`
- Modify: `lib/queries/canonical/gifts.ts` `getGift` 의 `stages`

**Interfaces:**
- Produces: `export function segmentsOf(descRaw: string | null, desc: string | null): Array<{ text: string; changed: boolean }>`
- `changed` 의 기준은 **직전 단계 대비**다 — 원본 실측(3단계 기프트 107종): + 에서 강조된 문구가 ++ 에 그대로 남아 있을 때 강조가 꺼진 경우 79, 다시 켜진 경우 11(짧은 문구의 우연 일치 포함). 화면 라벨은 「+ 에서 바뀐 것」.
- `getGift().stages[i]` 가 `{ level, text, segments }` 가 된다. `text` 는 지금 그대로(`DescribedNullable | null`).

게임이 `desc_raw` 에 `<style="upgradeHighlight">…</style>` 로 **바뀐 자리를 직접 표시한다**(실측 9001: level 1 `[Combustion] 위력 4` · level 2 `분노 공명`). 어절 diff 를 만들 필요가 없다 — 마크업이 곧 답이다. 마크업이 없는 단계(level 0 또는 `desc_raw` null)는 통째로 `changed: false` 한 조각이다.

- [ ] **Step 1: 테스트**

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { segmentsOf } from './gift-stage-diff';

test('upgradeHighlight 가 changed 조각이 된다', () => {
	const raw = '모든 적에게 <style="upgradeHighlight">[Combustion] 위력 4</style> 무작위로 나누어 부여.';
	assert.deepEqual(segmentsOf(raw, null), [
		{ text: '모든 적에게 ', changed: false },
		{ text: '[Combustion] 위력 4', changed: true },
		{ text: ' 무작위로 나누어 부여.', changed: false },
	]);
});

test('다른 마크업은 지우고 붙인다', () => {
	const raw = '<color=#ff0000>피해</color> <style="upgradeHighlight">+2</style>';
	assert.deepEqual(segmentsOf(raw, null), [
		{ text: '피해 ', changed: false },
		{ text: '+2', changed: true },
	]);
});

test('raw 가 없으면 desc 통째로 한 조각', () => {
	assert.deepEqual(segmentsOf(null, '그대로'), [{ text: '그대로', changed: false }]);
	assert.deepEqual(segmentsOf(null, null), []);
});
```

- [ ] **Step 2: 실패 확인** — 모듈 없음.

- [ ] **Step 3: 구현**

```ts
/**
 * 강화 단계의 바뀐 자리(spec D11).
 *
 * 게임이 `desc_raw` 에 `<style="upgradeHighlight">…</style>` 로 이전 단계 대비 바뀐
 * 부분을 표시한다 — 그것을 그대로 조각으로 낸다. 어절 diff 를 지어내지 않는다.
 * 나머지 Unity 마크업은 `src/v2/canonical/markup.ts` 와 같은 화이트리스트로 지운다.
 */
const HIGHLIGHT = /<style="upgradeHighlight">([\s\S]*?)<\/style>/g;
const OTHER_MARKUP =
	/<\/?(?:color|style|b|i|u|s|size|mark|sprite|link|noparse|font|br|align|cspace|indent|line-height|lowercase|uppercase|smallcaps|margin|nobr|pos|space|voffset|width|alpha|gradient|rotate|sup|sub)\b[^>]*>/gi;

export function segmentsOf(
	descRaw: string | null,
	desc: string | null,
): Array<{ text: string; changed: boolean }> {
	if (descRaw === null) return desc === null || desc === '' ? [] : [{ text: desc, changed: false }];
	const out: Array<{ text: string; changed: boolean }> = [];
	let last = 0;
	for (const m of descRaw.matchAll(HIGHLIGHT)) {
		const before = descRaw.slice(last, m.index).replace(OTHER_MARKUP, '');
		if (before) out.push({ text: before, changed: false });
		out.push({ text: m[1].replace(OTHER_MARKUP, ''), changed: true });
		last = m.index + m[0].length;
	}
	const tail = descRaw.slice(last).replace(OTHER_MARKUP, '');
	if (tail) out.push({ text: tail, changed: false });
	return out;
}
```

- [ ] **Step 4: `getGift` 에 얹는다**

include 의 `stages.texts` 가 `desc_raw` 를 가져오는지 본다 — `localeRows(locale)` 가 select 없이 행 전체를 가져오면 그대로 쓰고, select 를 두고 있으면 `descRaw: true` 를 더한다. 그 뒤:

```ts
	const stages = gift.stages.map((s) => {
		const text = textOf(s.texts, locale);
		const row = s.texts.find((t) => t.locale === locale) ?? s.texts[0];
		return { level: s.level, text, segments: segmentsOf(row?.descRaw ?? null, text?.desc ?? null) };
	});
```

- [ ] **Step 5: 검증·커밋** — `npm test && npm run typecheck`. DB 켜고 9001 의 level 1 `segments` 에 `changed: true` 가 둘(`[Combustion] 위력 4` · `[Combustion] 위력 6`) 있는지 임시 스크립트로 확인:

```bash
npx tsx --env-file-if-exists=.env -e "import('./lib/queries/canonical/gifts.ts').then(async m => { const g = await m.getGift(9001, 'ko'); console.log(JSON.stringify(g?.stages.map(s => s.segments.filter(x => x.changed)), null, 1)); process.exit(0); })"
```

```bash
git add lib/queries/canonical/gift-stage-diff.ts lib/queries/canonical/gift-stage-diff.test.ts lib/queries/canonical/gifts.ts
git commit -m "feat(query): 강화 단계의 바뀐 자리를 조각으로 낸다 — 게임 마크업 upgradeHighlight 가 근거"
```

---

### Task 5 (D3): 획득 조건과 저주·축복 짝 — `acquire`

**Files:**
- Create: `lib/queries/canonical/gift-acquire.ts` · `gift-acquire.test.ts`
- Modify: `lib/queries/canonical/gifts.ts:217-260` (`listCursedGiftIds`) · `getGift`

**Interfaces:**
- Produces: `export function parseAcquire(text: string | null): { kind: 'fusion' | 'choice' | 'curse_release' | 'event' | null; ref: string | null }`
- `getGift().acquire: { kind: 'cursed' | 'blessed' | 'fusion' | 'choice' | 'event' | null; conditionText: { text: string; fellBack: boolean } | null; pair: { id: number; icon: string | null; text: Named | null } | null }` — `conditionText.fellBack` 은 화면 로케일 행이 없어 ko 로 떨어졌다는 뜻(폴백 방향이 다른 곳과 반대라 배지 글자는 화면이 정한다)
- `listCursedGiftIds()` 시그니처 유지, 구현만 `gift_locked_desc` 기반으로.

원본 `gift_locked_desc`(ko 64건) 의 조건 줄 실측:

```
54  - 상점 「E.G.O 기프트 합성」
 5  - 선택지 「<이벤트/기프트 이름>」          ← 저주 3 + 그 외 2
 3  - 저주 해제 「<저주 기프트 이름>」          ← 축복. 짝이 여기 있다
 1  - 어떤 철학을 마주하기
 1  - 당신의 운을 시험해 보세요!
```

- [ ] **Step 1: 테스트**

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseAcquire } from './gift-acquire';

const wrap = (line: string) => `획득 기록 없음\n\n\n<획득 조건>\n- ${line}`;

test('상점 → fusion', () => {
	assert.deepEqual(parseAcquire(wrap('상점 「E.G.O 기프트 합성」')), { kind: 'fusion', ref: 'E.G.O 기프트 합성' });
});
test('선택지 → choice, ref 는 따옴표 안', () => {
	assert.deepEqual(parseAcquire(wrap('선택지 「귀기 서린 환도」')), { kind: 'choice', ref: '귀기 서린 환도' });
});
test('저주 해제 → curse_release, ref 는 저주 이름', () => {
	assert.deepEqual(parseAcquire(wrap('저주 해제 「그날의 기록」')), { kind: 'curse_release', ref: '그날의 기록' });
});
test('따옴표 없는 줄은 event, ref 는 줄 전체', () => {
	assert.deepEqual(parseAcquire(wrap('어떤 철학을 마주하기')), { kind: 'event', ref: '어떤 철학을 마주하기' });
});
test('없으면 null', () => {
	assert.deepEqual(parseAcquire(null), { kind: null, ref: null });
	assert.deepEqual(parseAcquire('획득 기록 없음'), { kind: null, ref: null });
});
```

- [ ] **Step 2: 실패 확인** — 모듈 없음.

- [ ] **Step 3: 구현**

```ts
/**
 * 획득 조건 텍스트(`canonical.gift_locked_desc`)를 읽는다(spec D3).
 *
 * 원본 `MirrorDungeonEgoGiftLockedDesc` 는 「<획득 조건>」 아래 `- ` 줄 하나로 조건을 말한다.
 * 저주·축복 짝은 축복 쪽의 「저주 해제 「저주 이름」」 에 있다 — 화면이 「id 하나 뒤」로
 * 짐작하던 것(backlog 13-3)을 원본으로 대체한다. 실측 64건이 전부 한 줄이다.
 */
const LINE = /^- (.+)$/m;
const QUOTED = /^(상점|선택지|저주 해제) 「([^」]+)」$/;

export function parseAcquire(text: string | null): {
	kind: 'fusion' | 'choice' | 'curse_release' | 'event' | null;
	ref: string | null;
} {
	const line = text === null ? null : LINE.exec(text)?.[1]?.trim() ?? null;
	if (!line) return { kind: null, ref: null };
	const q = QUOTED.exec(line);
	if (!q) return { kind: 'event', ref: line };
	const kind = q[1] === '상점' ? 'fusion' : q[1] === '선택지' ? 'choice' : 'curse_release';
	return { kind, ref: q[2] };
}
```

- [ ] **Step 4: `listCursedGiftIds` 를 원본 기반으로**

`gifts.ts:217-260` 을 통째로:

```ts
/**
 * 저주 셋과 축복 셋(spec D3).
 *
 * 축복의 획득 조건이 「저주 해제 「저주 이름」」 이다 — 짝은 원본에 있다. 저주 이름을
 * ko 이름으로 되찾아 (저주 id, 축복 id) 를 만든다. 실측 3짝: 9227→9228 · 9229→9230 · 9231→9232.
 * 색 속성이 짝마다 같다(INDIGO · AMBER · AZURE)는 것이 교차 근거다.
 */
export async function listCursePairs(): Promise<Array<{ cursedId: number; blessedId: number }>> {
	const blessed = await canonical.giftLockedDesc.findMany({
		where: { locale: 'ko', text: { contains: '저주 해제' } },
		select: { giftId: true, text: true },
	});
	const names = blessed.map((b) => parseAcquire(b.text).ref).filter((n): n is string => n !== null);
	const cursed = await canonical.giftStageText.findMany({
		where: { locale: 'ko', level: 0, name: { in: names } },
		select: { giftId: true, name: true },
	});
	const idByName = new Map(cursed.map((c) => [c.name, Number(c.giftId)]));
	return blessed.flatMap((b) => {
		const ref = parseAcquire(b.text).ref;
		const cursedId = ref === null ? undefined : idByName.get(ref);
		return cursedId === undefined ? [] : [{ cursedId, blessedId: Number(b.giftId) }];
	});
}

export async function listCursedGiftIds(): Promise<Set<number>> {
	const pairs = await listCursePairs();
	return new Set(pairs.flatMap((p) => [p.cursedId, p.blessedId]));
}
```

- [ ] **Step 5: `getGift` 에 `acquire`**

include 에 `lockedDescs: localeRows(locale)` 추가(관계 이름은 `schema.prisma:764` `lockedDescs GiftLockedDesc[]`). 반환 직전:

```ts
	const lockedRow = gift.lockedDescs.find((d) => d.locale === 'ko') ?? null; // 파싱은 ko 원문으로
	const own = gift.lockedDescs.find((d) => d.locale === locale) ?? null;
	const shown = own ?? lockedRow;
	const conditionText = shown === null ? null : { text: shown.text, fellBack: own === null };
	const parsed = parseAcquire(lockedRow?.text ?? null);
	const pairs = await listCursePairs();
	const asCursed = pairs.find((p) => p.cursedId === Number(gift.id));
	const asBlessed = pairs.find((p) => p.blessedId === Number(gift.id));
	const pairId = asCursed?.blessedId ?? asBlessed?.cursedId ?? null;
	const pairGift = pairId === null
		? null
		: await canonical.gift.findUnique({ where: { id: String(pairId) }, include: { stages: baseStage(locale) } });
	const acquire = {
		kind: asCursed ? 'cursed' as const
			: asBlessed ? 'blessed' as const
			: parsed.kind === 'curse_release' ? 'blessed' as const
			: parsed.kind,
		conditionText,
		pair: pairGift === null ? null : {
			id: Number(pairGift.id),
			icon: giftIcon(pairGift.sprite),
			text: nameOf(pairGift.stages[0]?.texts ?? [], locale),
		},
	};
```

`acquire` 를 반환 객체에 넣는다. 조건 텍스트가 없는 기프트(456 − 64)는 `{ kind: null, conditionText: null, pair: null }`.

- [ ] **Step 6: 검증**

`npm test && npm run typecheck`. DB 켜고:

```bash
npx tsx --env-file-if-exists=.env -e "import('./lib/queries/canonical/gifts.ts').then(async m => { console.log(await m.listCursePairs()); for (const id of [9227, 9228, 9088]) { const g = await m.getGift(id, 'ko'); console.log(id, JSON.stringify(g?.acquire)); } process.exit(0); })"
```

Expected: 짝 3 `[{9227,9228},{9229,9230},{9231,9232}]`. 9227 → `kind: 'cursed'`, pair 9228 신검합일. 9228 → `kind: 'blessed'`, pair 9227. 9088 → `kind: 'fusion'`, pair null. 짝이 3 이 아니면 이름 매칭(줄바꿈·공백)을 의심하고 `gift_stage_text.name` 실물을 본다 — 정규식을 느슨하게 풀지 않는다.

- [ ] **Step 7: 커밋**

```bash
git add lib/queries/canonical/gift-acquire.ts lib/queries/canonical/gift-acquire.test.ts lib/queries/canonical/gifts.ts
git commit -m "feat(query): 획득 조건과 저주·축복 짝을 원본 텍스트에서 낸다 — id 하나 뒤 추정 제거"
```

---

### Task 6 (D14): 이웃 기프트 — `neighbors`

**Files:**
- Modify: `lib/queries/canonical/gifts.ts` `getGift`

**Interfaces:**
- `getGift().neighbors: Array<{ id: number; icon: string | null; text: Named | null; tier: string }>` — 같은 키워드 · 같은 등급 · 거울 던전 범위 · 자기 제외 · id 오름차순 · 최대 6.

- [ ] **Step 1: 구현** (`getGift` 반환 직전)

```ts
	/**
	 * 이웃 — 같은 키워드·등급의 다른 기프트(spec D14). 목록으로 안 돌아가고 옆으로 넘어가게.
	 * 같은 축 안의 차례는 id 가 담고 있다(팩과 같은 이유).
	 */
	const neighborRows = await canonical.gift.findMany({
		where: {
			...MIRROR,
			keywordId: gift.keywordId,
			tier: gift.tier,
			tierLabel: gift.tierLabel,
			id: { not: gift.id },
		},
		orderBy: { id: 'asc' },
		take: 6,
		include: { stages: baseStage(locale) },
	});
	const neighbors = neighborRows.map((n) => ({
		id: Number(n.id),
		icon: giftIcon(n.sprite),
		text: nameOf(n.stages[0]?.texts ?? [], locale),
		tier: tierOf(n),
	}));
```

`keywordId` 가 null 인 기프트는 Prisma 가 `keywordId: null` 을 IS NULL 로 풀어 준다. `tier` null(EX 2건)도 같다.

- [ ] **Step 2: 검증** — typecheck. DB 켜고 9001(화상 I) 의 `neighbors` 가 6 이하이고 자기 자신이 없는지 위와 같은 임시 스크립트로 확인.

- [ ] **Step 3: 커밋**

```bash
git add lib/queries/canonical/gifts.ts
git commit -m "feat(query): 기프트 상세에 같은 키워드·등급의 이웃 6 을 낸다"
```

---

### Task 7 (D4): 등급 로마자 — 코드 무변경, 기록만

`GIFT_TIER_LABEL` 은 이미 data 소유 파일(`lib/queries/canonical/gifts.ts:39`)에 있고 `canonical.gift.tier_label` 이 EX 를 갖는다. 화면은 import 만 한다. 옮길 것이 없다.

- [ ] **Step 1: `docs/backlog/13-frontend-data-debt.md` 목록 표의 2 · 3 · 4 행 상태**

각 행 끝에 처리 기록을 붙인다:

```
| 2 | … | `pack_tag` 에 회차 | → **처리 (2026-09-xx)** `canonical.pack.kind` · `step` 컬럼. 회차 근거는 assets `bossEncounters` |
| 3 | … | 기프트 플래그 또는 짝 관계 | → **처리 (2026-09-xx)** 원본 `gift_locked_desc` 「저주 해제 「…」」 에 짝이 있었다. `listCursePairs` |
| 4 | … | 표시용 등급 필드 | → **닫음 (2026-09-xx)** 이미 data 소유 파일. `tier_label` 이 EX 를 갖는다. 옮길 것 없음 |
```

- [ ] **Step 2: 커밋**

```bash
git add docs/backlog/13-frontend-data-debt.md
git commit -m "docs(backlog): 13 의 2·3·4 처리 기록"
```

---

### Task 8: 타입 통보 · PR

- [ ] **Step 1: design surface 에 보낼 타입 요약을 `GiftDetail` 에서 뽑는다**

`npx tsc --noEmit -p tsconfig.json` 이 통과한 상태에서 `getGift` 반환 타입(`GiftDetail`)의 `packs` · `exclusivePacks` · `stages` · `acquire` · `neighbors` 다섯 필드 정의를 이 계획의 **Interfaces** 블록 그대로 메시지로 보낸다. `listPacks` 의 `kind` 도 함께.

- [ ] **Step 2: 전체 검증**

```bash
npm test && npm run typecheck && npm run build
npm run v2:verify:canonical
```

- [ ] **Step 3: PR**

```bash
git push -u origin feat/gift-detail-data
gh pr create --title "feat(data): 기프트 상세가 기다리는 값 — 팩 종류 · 강화 diff · 획득 조건과 저주·축복 짝 · 이웃" --body "$(cat <<'EOF'
spec: docs/superpowers/specs/2026-09-07-scope-reset-design.md §3.2 (D0 · D2 · D11 · D3 · D14 · D4)

- D0  홈 개수가 목록과 같은 범위 — 기프트 456 · E.G.O 110
- D2  canonical.pack.kind · step. 회차 근거는 bossEncounters. lib/pack-label.ts 는 이름표만
- D11 강화 단계 segments — 게임 마크업 upgradeHighlight 가 근거
- D3  획득 조건 텍스트 + 저주·축복 짝 3 — 원본 gift_locked_desc. 「id 하나 뒤」 추정 삭제
- D14 이웃 기프트 6
- D4  옮길 것 없음. 기록만

canonical 승격: v2:build → diff → promote. verify 222 + 6.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```
