# 엔진 전환 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 추천 화면이 `lib/engine/v2` 를 쓰게 하고, 레거시 엔진과 `public` 을 읽는 코드를 전부 없앤다.

**Architecture:** 새 질의 `lib/queries/canonical/recommend.ts` 가 `loadEngineData` → `Profile` → `evaluateGifts` → `chain` 을 엮어 층 후보 팩별 기프트 등급을 낸다. 순위는 안 매긴다 — 점수 모형이 없기 때문이며 그건 PR-B 다. `squad.ts` 의 `statusKeyOf` 의존을 `canonical.identity_axis` 로 바꾸면 `lib/engine` 을 통째로 지울 수 있다. 마지막에 `public` 을 덤프하고 이름만 바꾼다.

**Tech Stack:** Next.js App Router (서버 컴포넌트) · Prisma `multiSchema` · PostgreSQL 17 · TypeScript ESM · `node:test` · tsx

## Global Constraints

- 설계는 [`docs/superpowers/specs/2026-08-07-engine-cutover-design.md`](../specs/2026-08-07-engine-cutover-design.md). 절 번호는 그 문서를 가리킨다.
- **`canonical` 의 값을 바꾸지 않는다.** 이 PR 은 읽는 쪽만 건드린다. 검사 222건은 그대로 통과해야 한다.
- **`DROP SCHEMA public` 을 하지 않는다** (설계 6절). 덤프와 `ALTER SCHEMA … RENAME` 까지만이다.
- **팩 순위를 매기지 않는다** (설계 5절). 점수 모형이 없는데 순서를 붙이면 그 순서가 거짓말이 된다.
- **화면 구조는 최소로 바꾼다.** 정보 제공 화면의 디자인 작업이 진행 중이고 팩 추천은 엔진이 완성된 뒤에 세운다 — 미완성 디자인에 공을 들이면 그 작업이 두 번 된다.
- 새 질의는 `import { canonical } from '@/lib/db-canonical'` 를 쓴다.
- **`Locale` 타입은 `@prisma/client`(v1) 것을 그대로 쓴다.** v1 은 `ko|en`, v2 는 `ko|en|ja` 라 v1 → v2 대입만 성립한다. `lib/queries/canonical/*` 가 전부 이 방식이다.
- 캐노니컬 로케일 공통부는 `lib/queries/canonical/locale.ts` 를 쓴다. `@/lib/queries/shared` 에서는 순수 함수(`one` · `multi` · `pageOf`)만 가져온다.
- **v2 엔진의 id 는 문자열이다.** `Squad.roster[].identityId` · `GiftVerdict.giftId` 가 `string` 이고, 화면은 숫자를 쓴다 — 경계에서 바꾼다.
- import 는 `@/` 별칭을 쓴다.
- 테스트 실행은 `npm test`. 기준선은 **473 pass / 0 fail / 12 skip**.
- 타입 검사 `npm run typecheck`, 빌드 `npm run build`.
- DB 는 `docker exec limbus-postgres psql -U postgres -d limbus`.
- **워크트리는 이미 준비돼 있다** — `.env` 복사와 `npm run v2:generate` 를 마쳤다.
- 커밋 메시지는 한국어. Conventional Commits.

## 파일 구조

| 파일 | 책임 | 상태 |
| --- | --- | --- |
| `lib/queries/canonical/recommend.ts` | 층 후보 팩 + 기프트 판정. 엔진을 엮는 유일한 자리 | **신규** |
| `lib/queries/canonical/squad.ts` | `statusKeyOf` → `identity_axis` | 수정 |
| `app/[locale]/recommend/page.tsx` | 순위 대신 등급 분포 | 수정 |
| `lib/engine/{dsl,load,pack,score,state,tuning,vocab}.ts` | 레거시 | **삭제** |
| `lib/engine/{dsl,status-key,vocab}.test.ts` | 레거시 테스트 | **삭제** |
| `lib/queries/recommend.ts` | 레거시 질의 | **삭제** |
| `lib/db.ts` | `public` 클라이언트 | **삭제** |
| `prisma/schema.prisma` | v1 스키마 52모델 | **삭제** |
| `scripts/retire-public.ts` | 덤프 + 이름 바꾸기 | **신규** |

`lib/engine/v2/*` 는 안 건드린다 — 이미 옳고 테스트 411줄이 지킨다.

---

### Task 1: 골든 기준을 뜬다

**아무것도 바꾸기 전에 한다.** 산출물은 gitignore 대상이라 이 워크트리에는 없다.

**Files:** 없음 (도구는 이미 있다)

**Interfaces:**
- Consumes: `scripts/golden-queries.ts` 의 `cases()` 20건
- Produces: `build/golden/before/` 20개 JSON

- [ ] **Step 1: 지금 출력을 뜬다**

```bash
npm run golden:capture -- before
```

기대: 20건. `build/golden/before/` 에 파일이 선다.

**실패하면 거기서 멈춘다.** 기준이 없으면 대조할 것이 없다.

- [ ] **Step 2: squad 두 건을 따로 봐 둔다**

이 PR 이 실제로 손대는 유일한 자리다.

```bash
python3 -c "
import json
a=json.load(open('build/golden/before/squad.listSquad.json'))
i=a[0]['identities'][0]
print('인격', i['id'], i['text']['name'])
print('keywords', i['keywords'])
print('mechanics', i['mechanics'])
"
```

**나온 값을 받아 적는다.** Task 3 이 이것과 맞춘다.

- [ ] **Step 3: 커밋할 것이 없음을 확인한다**

```bash
git status --porcelain
```

기대: 비어 있다. `build/` 는 gitignore 대상이다.

---

### Task 2: `canonical/recommend.ts` — 엔진을 엮는다

**Files:**
- Create: `lib/queries/canonical/recommend.ts`

**Interfaces:**
- Consumes: `lib/engine/v2/{load,profile,evaluate,chain,types}`
- Produces:
  - `HWAJIN_DECK: number[]` — 화진 덱 7인
  - `recommendForDeck(locale, options): Promise<Recommendation>`
  - `Recommendation` — 아래 Step 4 가 정의한다

- [ ] **Step 1: 층별 팩 후보를 어떻게 얻는지 확인한다**

레거시는 `packIdsForFloor(difficulty, floor)` 를 썼다. 캐노니컬에서 같은 것을 낸다.

```bash
grep -n "packIdsForFloor" -A 16 lib/engine/load.ts
```

**층 구간이 `"1"` 과 `"6-10"` 처럼 섞여 있다.** `floor_pack.floor_range` 를 그대로 비교하면 3층이 `6-10` 에 안 걸린다 — 구간을 펴서 봐야 한다.

DB 로 확인한다.

```bash
docker exec limbus-postgres psql -U postgres -d limbus -tAc \
  "SELECT difficulty, floor_range, count(*) FROM canonical.floor_pack GROUP BY 1,2 ORDER BY 1,2"
```

- [ ] **Step 2: 층 구간 판정을 순수 함수로 쓴다**

`lib/queries/canonical/recommend.ts` 머리:

```typescript
import type { Locale } from '@prisma/client';
import type { $Enums } from '@/src/v2/generated/client';
import { canonical } from '@/lib/db-canonical';
import { giftIcon, identityImage, packIcon } from '@/lib/assets';
import { loadEngineData } from '@/lib/engine/v2/load';
import { Profile } from '@/lib/engine/v2/profile';
import { evaluateGifts } from '@/lib/engine/v2/evaluate';
import { chain } from '@/lib/engine/v2/chain';
import type { GiftVerdict, Squad } from '@/lib/engine/v2/types';
import { localeRows, nameOf } from './locale';

/**
 * 화면이 쓰는 추천 질의.
 *
 * **현행 `lib/queries/recommend.ts` 를 대체한다.** 층만 바뀌는 것이 아니라
 * 엔진이 바뀐다 — 레거시는 「기프트가 얼마나 세지나」를 수치로 쟀고 v2 는
 * 「켜지나」를 근거와 함께 답한다(설계 2절).
 *
 * **순위를 안 매긴다.** 점수 모형이 없는데 순서를 붙이면 그 순서가 거짓말이
 * 된다 — 팩 후보를 그대로 두고 기프트를 등급별로 센다. 점수는 PR-B 다.
 */

/** 화진 덱 — 새벽 사무소 3 + 엄지 4. 온필드 정원 7과 정확히 맞는다. */
export const HWAJIN_DECK = [10216, 11009, 11216, 10512, 10716, 10916, 11013];

/**
 * 층 구간이 이 층을 담는가.
 *
 * 원본 표기가 `"1"` 과 `"6-10"` 처럼 섞여 있다. 문자열로 비교하면 3층이
 * `6-10` 에 안 걸린다 — 양끝을 펴서 본다.
 */
export function rangeCovers(range: string, floor: number): boolean {
	const parts = range.split('-').map(Number);
	const lo = parts[0];
	if (lo === undefined || !Number.isFinite(lo)) return false;
	const hi = parts.length > 1 && Number.isFinite(parts[1] as number)
		? (parts[1] as number)
		: lo;
	return floor >= lo && floor <= hi;
}
```

- [ ] **Step 3: 순수부 테스트를 쓴다**

`lib/queries/canonical/recommend.test.ts`:

```typescript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rangeCovers } from './recommend';

test('한 자리 구간은 그 층만 담는다', () => {
	assert.equal(rangeCovers('3', 3), true);
	assert.equal(rangeCovers('3', 4), false);
});

test('범위 구간은 양끝을 포함한다', () => {
	assert.equal(rangeCovers('6-10', 6), true);
	assert.equal(rangeCovers('6-10', 10), true);
	assert.equal(rangeCovers('6-10', 5), false);
	assert.equal(rangeCovers('6-10', 11), false);
});

test('11-15 가 15층을 담는다 — hard 의 마지막 구간이다', () => {
	assert.equal(rangeCovers('11-15', 15), true);
});

test('숫자가 아닌 구간은 아무 층도 안 담는다 — 조용히 전부 담지 않는다', () => {
	assert.equal(rangeCovers('boss', 1), false);
	assert.equal(rangeCovers('', 1), false);
});
```

- [ ] **Step 4: 본체를 쓴다**

같은 파일에 이어 쓴다.

```typescript
export interface GiftLine {
	id: number;
	name: string | null;
	icon: string | null;
	grade: 'A' | 'B' | 'C';
	/** 판정 가능한 참조 중 충족한 수 */
	satisfied: number;
	decidable: number;
	total: number;
	/** 확정 충족이 아닌 몫이 있으면 「가능」이 섞였다는 뜻이다 */
	certain: number;
	reasons: GiftVerdict['reasons'];
	/** 보유 기프트가 이걸 켤 수 있나. 몇 홉인지 */
	chainDepth: number | null;
}

export interface PackLine {
	id: string;
	name: string | null;
	icon: string | null;
	/** 등급별 기프트 수 */
	tally: { A: number; B: number; C: number };
	gifts: GiftLine[];
}

export interface Recommendation {
	deck: Array<{ id: number; name: string | null; image: string | null; axes: string[] }>;
	floor: number;
	difficulty: $Enums.Difficulty;
	/** 후보 팩 수 */
	candidateCount: number;
	packs: PackLine[];
	owned: Array<{ id: number; name: string | null }>;
	/** 편성이 공급하는 축과 인원. 화면의 막대 */
	supply: Array<{ refKind: string; refId: string; count: number }>;
}

export async function recommendForDeck(
	locale: Locale,
	options: {
		identityIds?: number[];
		/** 출전 인격 id. 비우면 편성 전체를 출전으로 본다 */
		deployedIds?: number[];
		floor?: number;
		difficulty?: $Enums.Difficulty;
		ownedIds?: number[];
	} = {},
): Promise<Recommendation> {
	const identityIds = options.identityIds ?? HWAJIN_DECK;
	const floor = options.floor ?? 3;
	const difficulty = options.difficulty ?? 'hard';
	const ownedIds = options.ownedIds ?? [];

	const data = await loadEngineData(canonical);

	// 편성 12 와 출전 7 은 다르다 — 분모가 갈린다(v2/types.ts Squad 주석)
	const roster = identityIds.map((id) => ({ identityId: String(id), egoIds: [] }));
	const field = (options.deployedIds ?? identityIds).map(String);
	const squad: Squad = { roster, field };

	const profile = new Profile(squad, data.capabilities);
	const verdicts = evaluateGifts({
		squad,
		profile,
		giftTriggers: data.giftTriggers,
		refsByTrigger: data.refsByTrigger,
		params: data.params,
	});
	const byGift = new Map(verdicts.map((v) => [v.giftId, v]));

	const links = chain({
		heldGiftIds: ownedIds.map(String),
		giftEffects: data.giftEffects,
		effectRefs: data.effectRefs,
		giftRefs: data.giftRefs,
		verdicts,
	});
	const depthByGift = new Map(links.map((l) => [l.giftId, l.depth]));

	// 층 후보 팩. floor_pack 을 난이도로만 좁히고 구간은 코드로 편다
	const floorRows = await canonical.floorPack.findMany({
		where: { difficulty },
		select: { floorRange: true, packId: true },
	});
	const packIds = [
		...new Set(floorRows.filter((r) => rangeCovers(r.floorRange, floor)).map((r) => r.packId)),
	];

	const packRows = await canonical.pack.findMany({
		where: { id: { in: packIds } },
		orderBy: { id: 'asc' },
		include: {
			texts: localeRows(locale),
			gifts: {
				include: {
					gift: {
						include: { stages: { where: { level: 0 }, include: { texts: localeRows(locale) } } },
					},
				},
			},
		},
	});

	const packs: PackLine[] = packRows.map((p) => {
		const gifts: GiftLine[] = p.gifts.map((row) => {
			const v = byGift.get(row.giftId);
			return {
				id: Number(row.giftId),
				name: nameOf(row.gift.stages[0]?.texts ?? [], locale)?.name ?? null,
				icon: giftIcon(row.gift.sprite),
				// 판정이 없는 기프트는 트리거가 아예 없는 것이다 — C 로 둔다
				grade: v?.grade ?? 'C',
				satisfied: v?.satisfied ?? 0,
				decidable: v?.decidable ?? 0,
				total: v?.total ?? 0,
				certain: v?.certain ?? 0,
				reasons: v?.reasons ?? [],
				chainDepth: depthByGift.get(row.giftId) ?? null,
			};
		});
		// 등급 · 충족 수 순. **점수가 아니라 정렬 기준이다** — 순위를 뜻하지 않는다
		gifts.sort((a, b) => a.grade.localeCompare(b.grade) || b.satisfied - a.satisfied || a.id - b.id);
		return {
			id: p.id,
			name: nameOf(p.texts, locale)?.name ?? null,
			icon: packIcon(p.sprite),
			tally: {
				A: gifts.filter((g) => g.grade === 'A').length,
				B: gifts.filter((g) => g.grade === 'B').length,
				C: gifts.filter((g) => g.grade === 'C').length,
			},
			gifts,
		};
	});

	// 덱 표시와 공급 막대
	const identities = await canonical.identity.findMany({
		where: { id: { in: identityIds.map(String) } },
		include: { texts: localeRows(locale), axes: true },
	});
	const nameOfIdentity = (rows: Array<{ locale: string; name: string; title: string | null }>) => {
		const pick = rows.find((r) => r.locale === locale) ?? rows.find((r) => r.locale === 'en');
		return pick ? (pick.title ?? pick.name).replace(/\s+/g, ' ').trim() : null;
	};

	const ownedGifts = await canonical.gift.findMany({
		where: { id: { in: ownedIds.map(String) } },
		include: { stages: { where: { level: 0 }, include: { texts: localeRows(locale) } } },
	});

	// 공급 — Profile 이 센 것을 그대로 낸다. 화면이 다시 세지 않는다
	const supplyKeys = [...new Set(data.capabilities.map((c) => `${c.refKind}|${c.refId}`))];
	const supply = supplyKeys
		.map((k) => {
			const [refKind = '', refId = ''] = k.split('|');
			return { refKind, refId, count: profile.count(refKind, refId) };
		})
		.filter((s) => s.count > 0)
		.sort((a, b) => b.count - a.count || a.refId.localeCompare(b.refId));

	return {
		deck: identities.map((i) => ({
			id: Number(i.id),
			name: nameOfIdentity(i.texts),
			image: identityImage(Number(i.id), 'profile'),
			axes: [...new Set(i.axes.map((a) => a.axisId))].sort(),
		})),
		floor,
		difficulty,
		candidateCount: packs.length,
		packs,
		owned: ownedGifts.map((g) => ({
			id: Number(g.id),
			name: nameOf(g.stages[0]?.texts ?? [], locale)?.name ?? null,
		})),
		supply,
	};
}
```

- [ ] **Step 5: 테스트를 돌린다**

```bash
npx tsx --test lib/queries/canonical/recommend.test.ts 2>&1 | grep -E "ℹ (tests|pass|fail)"
```

기대: 4 pass / 0 fail.

```bash
npm run typecheck
```

**`canonical.identity` 에 `axes` 관계가 있는지, `loadEngineData` 가 `canonical` 클라이언트를 받는지 여기서 걸린다.** 타입이 안 맞으면 실제 이름을 확인하고 고친다 — 추측하지 않는다.

```bash
grep -n "axes" prisma/v2/schema.prisma | head -3
grep -n "loadEngineData" -A 2 lib/engine/v2/load.ts | head -5
```

- [ ] **Step 6: 실제로 돌려 본다**

```bash
npx tsx --env-file-if-exists=.env -e '
import { recommendForDeck } from "./lib/queries/canonical/recommend.js";
const r = await recommendForDeck("ko", { floor: 3, difficulty: "hard" });
console.log("후보 팩", r.candidateCount);
console.log("덱", r.deck.map((d) => d.name).join(" · "));
for (const p of r.packs.slice(0, 3)) {
  console.log(p.name, "A" + p.tally.A, "B" + p.tally.B, "C" + p.tally.C);
}
process.exit(0);
'
```

**나온 수를 받아 적는다.** 후보 팩 수가 0 이면 `rangeCovers` 나 난이도가 틀린 것이다.

- [ ] **Step 7: 커밋**

```bash
git add lib/queries/canonical/recommend.ts lib/queries/canonical/recommend.test.ts
git commit -m "feat(web): canonical/recommend — v2 엔진을 엮는다

loadEngineData → Profile → evaluateGifts → chain 을 한 자리에서 엮어 층
후보 팩별 기프트 등급을 낸다.

순위를 안 매긴다. 점수 모형이 없는데 순서를 붙이면 그 순서가 거짓말이 된다 —
팩을 id 순으로 두고 기프트를 등급별로 센다. 점수는 다음 PR 이다.

층 구간을 코드로 편다. 원본 표기가 「1」과 「6-10」처럼 섞여 있어 문자열로
비교하면 3층이 6-10 에 안 걸린다."
```

---

### Task 3: `squad.ts` 가 `identity_axis` 를 읽는다

**이걸 해야 `lib/engine` 을 지울 수 있다.**

**Files:**
- Modify: `lib/queries/canonical/squad.ts`

**Interfaces:**
- Consumes: `canonical.identity.axes` (`IdentityAxis[]`)
- Produces: `SquadIdentity.keywords` · `.mechanics` 의 값이 축 id 로 바뀐다

- [ ] **Step 1: 지금 값을 받아 적는다**

Task 1 Step 2 에서 뜬 것을 다시 본다.

```bash
python3 -c "
import json
a=json.load(open('build/golden/before/squad.listSquad.json'))
for s in a[:2]:
    for i in s['identities'][:2]:
        print(i['id'], i['keywords'], i['mechanics'])
"
```

- [ ] **Step 2: 축 id 로 무엇이 나올지 미리 잰다**

```bash
docker exec limbus-postgres psql -U postgres -d limbus -tAc \
  "SELECT identity_id, string_agg(DISTINCT axis_id, ',' ORDER BY axis_id)
     FROM canonical.identity_axis GROUP BY 1 ORDER BY 1 LIMIT 4"
```

**기믹 축(`BULLET` · `PROTECTION`)이 나머지와 같은 표에 있다.** 현행은 `ammo` · `protection` 으로 갈랐으므로 같은 갈래를 축 id 로 다시 만든다.

- [ ] **Step 3: 고친다**

`lib/queries/canonical/squad.ts` 의 import 에서 `statusKeyOf` 를 뺀다.

```typescript
import { EGO_RANKS } from '@/lib/storage/schema';
import { localeRows, nameOf } from './locale';
```

상수를 바꾼다.

```typescript
/**
 * 상태 기믹 축. **키워드와 갈라 담는다** — 기프트를 나누는 분류가 아니라
 * 인격이 공급하는 자원이다(backlog/04 3·4절).
 *
 * 현행은 `lib/engine/vocab` 의 정규식으로 상태 id 1,472종을 접었다.
 * **캐노니컬은 그 접기를 이미 데이터로 갖고 있다** — `identity_axis` 628행이며
 * 적재기가 축 어휘로 판정한 결과다. 검사 203건이 그것을 지킨다.
 */
const MECHANIC_AXES = new Set(['BULLET', 'PROTECTION']);
```

질의에서 `statuses` 대신 `axes` 를 가져온다.

```typescript
			identities: {
				orderBy: [{ star: 'desc' }, { id: 'asc' }],
				include: {
					texts: localeRows(locale),
					axes: { select: { axisId: true } },
					associations: { include: { association: { include: { texts: localeRows(locale) } } } },
					skills: {
						where: { skill: { kind: 'attack' } },
						select: { skill: { select: { sin: true, attackType: true } } },
					},
				},
			},
```

매핑에서 접기를 지운다.

```typescript
		identities: s.identities.map((i) => {
			const axes = [...new Set(i.axes.map((a) => a.axisId))].sort();
			return {
				id: Number(i.id),
				rarity: i.star,
				season: i.season,
				image: identityImage(Number(i.id), 'profile'),
				text: identityName(i.texts, locale),
				keywords: axes.filter((a) => !MECHANIC_AXES.has(a)),
				mechanics: axes.filter((a) => MECHANIC_AXES.has(a)),
				// … 나머지는 그대로
```

**E.G.O 쪽도 축으로 바꾼다.** 계획 초안은 「대응 표가 없으니 빈 배열로 둔다」였는데
**Task 1 의 실측이 그것을 뒤집었다** — E.G.O 110 중 **97 이 keywords 를 갖는다.**
비우면 실제 손실이다.

대체 경로가 있다. `ego_status → status_category → axis` 로 94종이 나오고, 20106 이
`SINKING` 으로 현행과 같다. **인격의 `special_status` 경로와 같은 유도다** — 다만
`identity_axis` 처럼 굳혀진 표가 없어 질의에서 조인한다.

```
현행 statusKeyOf 경로   97/110
캐노니컬 조인 경로       94/110
차이 3                 무엇인지 Step 4 에서 확인한다
```

```typescript
			return [{
				id: Number(e.id),
				rank: e.rank,
				image: egoImage(Number(e.id), 'awaken'),
				text: nameOf(e.texts, locale),
				awakenAffinity: e.sin,
				awakenAtkType: e.attackType,
				/**
				 * **빈 배열이다.** 현행은 `statusKeyOf` 로 ego_status 를 접었는데
				 * 캐노니컬에는 E.G.O 용 축 표가 없다(인격만 `identity_axis` 가 있다).
				 * 지어내지 않고 비운다 — 화면이 없는 것을 없다고 그린다.
				 */
				keywords: [] as string[],
				costs: e.costs.map((c) => ({ sin: c.sin, amount: c.count })),
			}];
```

`statuses` include 도 E.G.O 쪽에서 뺀다.

- [ ] **Step 4: 타입 검사와 대조**

```bash
npm run typecheck
npm run golden:capture -- after
npm run golden:compare -- before after
```

**`squad.listSquad` 만 달라야 한다.** 다른 19건이 달라지면 뭔가 잘못 건드린 것이다.

```bash
diff build/golden/before/squad.listSquad.json build/golden/after/squad.listSquad.json | head -30
```

**판정한다.**
```
keywords 값이 burn → COMBUSTION       예상된 어휘 변경
E.G.O keywords 가 [] 로               예상된 결손.  대응 표가 없다
인격 수 · 이름 · 소속이 달라짐          회귀다.  고친다
```

- [ ] **Step 5: 축 라벨이 화면에 나오는지 확인한다**

`listSquadAxes` 가 라벨을 준다. 축 id 가 바뀌었으니 라벨이 붙는지 본다.

```bash
python3 -c "
import json
ax=json.load(open('build/golden/after/squad.listSquadAxes.json'))
sq=json.load(open('build/golden/after/squad.listSquad.json'))
used=set()
for s in sq:
    for i in s['identities']:
        used.update(i['keywords']); used.update(i['mechanics'])
missing=[k for k in sorted(used) if k not in ax['labels']]
print('쓰이는 축', len(used), '| 라벨 없는 축', missing)
"
```

**라벨 없는 축이 나오면** `listSquadAxes` 가 그 축을 안 내는 것이다. `keyword` 표에 없는
축(예: `BLOODFEAST`)이 있을 수 있다 — 무엇인지 적고, 화면이 id 를 그대로 그려도
읽히는지 판단한다.

- [ ] **Step 6: 커밋**

```bash
npm test 2>&1 | grep -E "ℹ (tests|pass|fail)"
git add lib/queries/canonical/squad.ts
git commit -m "refactor(web): 편성이 identity_axis 를 읽는다 — statusKeyOf 를 뗀다

lib/engine/vocab 의 정규식 10개로 상태 1,472종을 접던 것을 캐노니컬이 이미
데이터로 갖고 있다(identity_axis 628행). 적재기가 축 어휘로 판정한 결과이고
검사 203건이 지킨다 — 정규식은 아무도 안 지켰다.

축 어휘가 원본 id 로 바뀐다(burn → COMBUSTION). PR #27 에서 키워드 id 를
받아들인 것과 같은 방향이다.

E.G.O 의 keywords 는 빈 배열이 된다. 캐노니컬에 E.G.O 용 축 표가 없다 —
인격만 identity_axis 가 있다. 지어내지 않고 비운다.

이걸로 lib/engine 에 남은 의존이 없다."
```

---

### Task 4: 추천 화면을 새 모양으로

**Files:**
- Modify: `app/[locale]/recommend/page.tsx`

**Interfaces:**
- Consumes: Task 2 의 `recommendForDeck` · `Recommendation` · `PackLine` · `GiftLine`
- Produces: 없음 (화면)

- [ ] **Step 1: 지금 화면이 무엇을 그리는지 읽는다**

```bash
sed -n '1,60p' 'app/[locale]/recommend/page.tsx'
```

**받아 적는다** — 어느 Panel 이 무엇을 담고 있는지. 구조를 최소로 바꾸려면 지금 구조를 알아야 한다.

- [ ] **Step 2: import 와 호출을 바꾼다**

```typescript
import { recommendForDeck } from '@/lib/queries/canonical/recommend';
```

`rec.feature.statusSupply` · `rec.feature.sinSupply` · `rec.feature.affiliation.deployed` 세 줄이
`rec.supply` 하나로 바뀐다. `refKind` 로 갈라 쓴다.

```typescript
	const axes = rec.supply.filter((s) => s.refKind === 'axis');
	const sins = rec.supply.filter((s) => s.refKind === 'sin');
	const affil = rec.supply.filter((s) => s.refKind === 'association');
```

- [ ] **Step 3: 순위 자리를 등급 분포로 바꾼다**

`rec.result.ranked` 를 그리던 Panel 을 `rec.packs` 로 바꾼다.

```tsx
					<Panel
						title={ko ? '이 층의 팩 후보' : 'Packs on this floor'}
						hint={`${rec.candidateCount}`}
					>
						{/* 순위를 안 매긴다 — 점수 모형이 없다(설계 5절). 등급 분포를 낸다 */}
						<ul className="stack">
							{rec.packs.map((p) => (
								<li key={p.id}>
									<Name>{p.name ?? p.id}</Name>
									<span className="card-meta">
										{`A ${p.tally.A} · B ${p.tally.B} · C ${p.tally.C}`}
									</span>
									<ul className="stack">
										{p.gifts
											.filter((g) => g.grade === 'A')
											.slice(0, 5)
											.map((g) => (
												<li key={g.id}>
													<Name>{g.name ?? String(g.id)}</Name>
													<span className="card-meta">
														{`${g.satisfied}/${g.decidable}`}
														{g.certain < g.satisfied ? (ko ? ' · 가능 포함' : ' · incl. possible') : ''}
														{g.chainDepth !== null
															? ko
																? ` · 연쇄 ${g.chainDepth}홉`
																: ` · chain ${g.chainDepth}`
															: ''}
													</span>
												</li>
											))}
									</ul>
								</li>
							))}
						</ul>
					</Panel>
```

**`dropped` Panel 은 지운다.** v2 에는 그 개념이 없다 — 후보를 거르지 않는다.

- [ ] **Step 4: 덱 Panel 을 고친다**

`rec.deck` 의 모양이 바뀌었다(`statuses`·`affiliations` → `axes`).

```tsx
							{rec.deck.map((i) => (
								<li key={i.id}>
									<Name>{i.name ?? String(i.id)}</Name>
									<span className="card-meta">{i.axes.join(' · ')}</span>
								</li>
							))}
```

- [ ] **Step 5: 타입 검사와 빌드**

```bash
npm run typecheck
npm run build 2>&1 | grep -E "Compiled|error|Failed" | head -5
```

**타입 오류가 남은 자리가 곧 화면이 옛 계약에 기대던 자리다.** 하나씩 위 모양으로 옮긴다.

- [ ] **Step 6: 커밋**

```bash
git add 'app/[locale]/recommend/page.tsx'
git commit -m "feat(web): 추천 화면이 v2 엔진의 등급을 그린다

팩 순위 대신 등급 분포를 낸다. 점수 모형이 없는데 순서를 붙이면 그 순서가
거짓말이 된다 — 후보 팩을 그대로 두고 A/B/C 를 센다.

dropped Panel 을 지운다. v2 는 후보를 거르지 않는다.

공급 막대 셋을 supply 하나로 합친다. refKind 로 갈라 axis · sin ·
association 을 그린다."
```

---

### Task 5: 레거시를 지운다

**`public` 을 읽는 코드가 0 이 되는 순간이다.**

**Files:**
- Delete: `lib/engine/{dsl,load,pack,score,state,tuning,vocab}.ts`
- Delete: `lib/engine/{dsl,status-key,vocab}.test.ts`
- Delete: `lib/queries/recommend.ts`
- Delete: `lib/db.ts`
- Delete: `prisma/schema.prisma`
- Modify: `package.json` (v1 스크립트)

- [ ] **Step 1: 남은 참조를 찾는다**

```bash
grep -rn "@/lib/engine/" app/ lib/ components/ scripts/ | grep -v "engine/v2"
grep -rn "@/lib/db'" app/ lib/ components/ scripts/
grep -rn "@/lib/queries/recommend'" app/ lib/ components/
```

기대: 전부 0줄.

**하나라도 나오면 거기서 멈춘다.** 무엇이 남았는지 적고 그것부터 옮긴다.

- [ ] **Step 2: v1 전용 npm 스크립트를 찾는다**

```bash
grep -n '"db:\|"fetch"\|prisma/schema.prisma' package.json
```

`prisma/schema.prisma` 를 가리키는 스크립트가 있으면 **지울지 남길지 정한다** — `npm run fetch`
는 원본 수집이라 v1 스키마와 무관할 수 있다. 실제로 무엇을 가리키는지 보고 판단한다.

- [ ] **Step 3: 지운다**

```bash
git rm -q lib/engine/dsl.ts lib/engine/load.ts lib/engine/pack.ts lib/engine/score.ts \
          lib/engine/state.ts lib/engine/tuning.ts lib/engine/vocab.ts \
          lib/engine/dsl.test.ts lib/engine/status-key.test.ts lib/engine/vocab.test.ts \
          lib/queries/recommend.ts lib/db.ts
```

`prisma/schema.prisma` 는 **Step 2 의 판단 뒤에 지운다.** 스크립트가 그것을 가리키면
스크립트도 함께 정리해야 한다.

- [ ] **Step 4: 검사**

```bash
npm run typecheck
npm test 2>&1 | grep -E "ℹ (tests|pass|fail|skipped)"
npm run build 2>&1 | grep -E "Compiled|Failed" | head -3
```

**테스트 수가 준다** — 레거시 테스트 281줄을 지웠다. **줄어든 수를 받아 적고 0 fail 인지만 본다.**

- [ ] **Step 5: `public` 참조가 0 임을 실측한다**

```bash
grep -rln "@/lib/db'" app/ lib/ components/ scripts/ || echo "0건 — 완료 조건 달성"
```

- [ ] **Step 6: 커밋**

```bash
git add -A
git commit -m "refactor: 레거시 엔진과 v1 클라이언트를 지운다 — public 참조가 0

lib/engine/* 1,334줄과 테스트 281줄, queries/recommend.ts, lib/db.ts 삭제.

vocab.ts 500줄이 저작층이었다. 그 판정을 캐노니컬이 구조로 갖게 되면서
읽는 곳이 없어졌다 — 마지막 소비자가 squad 의 statusKeyOf 였고 앞 커밋이
identity_axis 로 옮겼다.

public 을 읽는 코드가 0 이다. 스키마 자체를 물러나게 하는 것은 다음 커밋이다."
```

---

### Task 6: `public` 을 물러나게 한다

**되돌릴 수 있는 형태로만 한다** (설계 6절).

**Files:**
- Create: `scripts/retire-public.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: 없음
- Produces: `npm run public:retire` · `npm run public:restore`

- [ ] **Step 1: 지금 상태를 잰다**

```bash
docker exec limbus-postgres psql -U postgres -d limbus -tAc \
  "SELECT count(*) FROM information_schema.tables WHERE table_schema='public'"
docker exec limbus-postgres psql -U postgres -d limbus -tAc "SHOW search_path"
```

**`search_path` 를 받아 적는다.** `public` 이 거기 있으면 이름을 바꿀 때 무엇이 깨지는지
알아야 한다.

- [ ] **Step 2: 확장(extension)이 `public` 에 사는지 본다**

```bash
docker exec limbus-postgres psql -U postgres -d limbus -tAc \
  "SELECT extname, nspname FROM pg_extension e JOIN pg_namespace n ON n.oid = e.extnamespace"
```

**확장이 `public` 에 있으면 이름을 못 바꾼다** — 그 경우 여기서 멈추고 보고한다.
`plpgsql` 은 `pg_catalog` 에 있으므로 무관하다.

- [ ] **Step 3: 도구를 쓴다**

`scripts/retire-public.ts`:

```typescript
/**
 * `public` 스키마를 물러나게 한다 — **지우지 않는다.**
 *
 * 읽는 코드가 0 이 된 뒤에 돈다. 덤프를 저장소 밖에 남기고 이름만 바꾸므로
 * 되돌리기가 `ALTER SCHEMA` 한 줄이다(설계 6절).
 *
 * `DROP SCHEMA` 는 다음 PR 이다. 화면이 아직 미완성이라 되돌릴 일이 생길 수 있다.
 *
 * 실행:
 *   npm run public:retire     덤프 + 이름 바꾸기
 *   npm run public:restore    되돌리기
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const BACKUP_DIR = join(process.cwd(), '..', '..', '..', 'limbus-db-backups');
const RETIRED = 'public_retired';

function psql(sql: string): string {
	return execFileSync(
		'docker',
		['exec', 'limbus-postgres', 'psql', '-U', 'postgres', '-d', 'limbus', '-tAc', sql],
		{ encoding: 'utf8' },
	).trim();
}

function schemaExists(name: string): boolean {
	return psql(`SELECT count(*) FROM pg_namespace WHERE nspname = '${name}'`) === '1';
}

function retire(): void {
	if (!schemaExists('public')) {
		console.error('public 스키마가 없다. 이미 물러났거나 이름이 다르다.');
		process.exitCode = 1;
		return;
	}

	const tables = psql(
		"SELECT count(*) FROM information_schema.tables WHERE table_schema='public'",
	);
	console.log(`public — ${tables}테이블`);

	// 1. 덤프. 저장소 밖에 둔다 — 브랜치·워크트리 정리에 안 휩쓸린다
	mkdirSync(BACKUP_DIR, { recursive: true });
	const dump = execFileSync(
		'docker',
		['exec', 'limbus-postgres', 'pg_dump', '-U', 'postgres', '-d', 'limbus',
			'--schema=public', '--no-owner', '--no-privileges'],
		{ encoding: 'utf8', maxBuffer: 512 * 1024 * 1024 },
	);
	const path = join(BACKUP_DIR, 'public-retired.sql');
	writeFileSync(path, dump);
	console.log(`덤프 ${(dump.length / 1024 / 1024).toFixed(1)} MB → ${path}`);

	// 2. 이름 바꾸기. 지우지 않는다
	psql(`ALTER SCHEMA "public" RENAME TO "${RETIRED}"`);
	console.log(`ALTER SCHEMA "public" RENAME TO "${RETIRED}"`);
	console.log('');
	console.log('되돌리려면 npm run public:restore.');
	console.log('DROP 은 안 했다 — 다음 PR 이다.');
}

function restore(): void {
	if (!schemaExists(RETIRED)) {
		console.error(`${RETIRED} 가 없다. 물러난 적이 없거나 이미 되돌렸다.`);
		process.exitCode = 1;
		return;
	}
	psql(`ALTER SCHEMA "${RETIRED}" RENAME TO "public"`);
	console.log(`ALTER SCHEMA "${RETIRED}" RENAME TO "public" — 되돌렸다.`);
}

const mode = process.argv[2];
if (mode === 'restore') restore();
else if (mode === 'retire') retire();
else {
	console.error('쓰임: retire-public.ts <retire|restore>');
	process.exitCode = 1;
}
```

- [ ] **Step 4: 스크립트를 등록한다**

`package.json` 의 `"golden:compare"` 뒤에 넣는다.

```json
"public:retire": "tsx scripts/retire-public.ts retire",
"public:restore": "tsx scripts/retire-public.ts restore"
```

- [ ] **Step 5: 돌린다**

```bash
npm run public:retire
```

기대: `public — 52테이블` · 덤프 크기 · `ALTER SCHEMA`.

```bash
docker exec limbus-postgres psql -U postgres -d limbus -tAc \
  "SELECT nspname FROM pg_namespace WHERE nspname IN ('public','public_retired','canonical','raw','app') ORDER BY 1"
```

기대: `app · canonical · public_retired · raw`. `public` 이 없다.

- [ ] **Step 6: 앱이 도는지 확인한다**

```bash
npm run v2:verify:canonical 2>&1 | tail -2
npm run typecheck
npm test 2>&1 | grep -E "ℹ (tests|pass|fail)"
npm run build 2>&1 | grep -E "Compiled|Failed" | head -3
```

**하나라도 깨지면 `npm run public:restore` 로 되돌리고 원인을 본다.**

- [ ] **Step 7: 커밋**

```bash
git add scripts/retire-public.ts package.json
git commit -m "chore(db): public 을 물러나게 한다 — 지우지 않는다

읽는 코드가 0 이 된 뒤에 돈다. 덤프를 저장소 밖에 남기고 이름만 바꾸므로
되돌리기가 ALTER SCHEMA 한 줄이다.

DROP 은 다음 PR 이다. 화면이 아직 미완성이라 되돌릴 일이 생길 수 있고,
스키마가 남아 있어도 읽는 코드가 0 이면 이 PR 의 목적은 달성된다."
```

---

### Task 7: 앱을 띄워 확인한다

**앞 PR 에서 마지막에 몰아 했다가 낡은 Prisma 클라이언트를 늦게 발견했다.** 여기서는
지운 것이 많으므로 반드시 본다.

**Files:** 없음

- [ ] **Step 1: 개발 서버를 띄운다**

```bash
PORT=3210 npm run dev
```

배경으로 돌린다. 로그는 파일로 받는다.

- [ ] **Step 2: 화면 전부를 두드린다**

```bash
for p in /ko /ko/about /ko/dungeon /ko/floors /ko/glossary /ko/identities \
         /ko/identities/10208 /ko/egos /ko/egos/20509 /ko/gifts /ko/gifts/9088 \
         /ko/packs /ko/packs/1309 /ko/squad /ko/recommend /en /en/squad /en/recommend; do
  printf "%-24s %s\n" "$p" "$(curl -s -o /dev/null -w '%{http_code}' http://localhost:3210$p)"
done
```

기대: 전부 200.

- [ ] **Step 3: 추천 화면의 내용을 본다**

```bash
curl -s http://localhost:3210/ko/recommend | grep -oE "A [0-9]+ · B [0-9]+ · C [0-9]+" | head -5
```

**등급 분포가 실제로 나오는지 본다.** 전부 `A 0 · B 0 · C n` 이면 판정이 안 붙은 것이다.

- [ ] **Step 4: 서버 로그에 오류가 없는지 본다**

```bash
grep -cE "⨯|Error:" <로그파일>
grep -c " 500 " <로그파일>
```

기대: 둘 다 0.

- [ ] **Step 5: 서버를 멈추고 트리를 정리한다**

```bash
pkill -f "next dev"
git checkout next-env.d.ts 2>/dev/null || true
git status --porcelain
```

기대: 비어 있다. `next dev` 가 `next-env.d.ts` 를 고치므로 되돌린다.

---

### Task 8: 문서와 PR

**Files:**
- Modify: `docs/superpowers/specs/2026-08-07-engine-cutover-design.md`
- Modify: `docs/adr/05-web-serving.md`

- [ ] **Step 1: 설계 8절을 실측으로 바꾼다**

「열린 것」을 「구현에서 닫은 것」으로 바꾸고 셋의 실제 답을 적는다.

```
public 이름 바꾸기의 부작용   ← Task 6 Step 1·2 에서 잰 것
추천 화면의 최소 모양        ← Task 4 에서 실제로 바꾼 것
squad 의 축 어휘 변경        ← Task 3 Step 5 에서 라벨이 붙었는지
```

10절 「구현 결과」를 더한다 — 파일 목록 · 검증 수치 · 골든 대조 결과.

- [ ] **Step 2: ADR-05 의 후속을 갱신한다**

PR #27 이 넣은 후속 인용에 한 줄 더한다.

```markdown
> **2026-08-07 — `public` 이 물러났다.** 읽는 코드가 0 이 되어 스키마 이름을
> `public_retired` 로 바꿨다. `DROP` 은 아직 안 했다.
```

- [ ] **Step 3: 마지막 검증**

```bash
git status --porcelain     # 비어야 한다
npm run typecheck
npm test 2>&1 | grep -E "ℹ (tests|pass|fail|skipped)"
npm run build 2>&1 | grep -E "Compiled|Failed" | head -3
npm run v2:verify:canonical 2>&1 | tail -2
grep -rln "@/lib/db'" app/ lib/ components/ scripts/ || echo "public 참조 0"
```

- [ ] **Step 4: 커밋하고 PR 을 올린다**

```bash
git add docs/
git commit -m "docs: 엔진 전환 결과 · ADR-05 후속"
git push
gh pr ready 28
gh pr checks 28 --watch --interval 15
```

PR 본문의 WIP 머리말을 지우고 구현 결과로 갈아끼운다.

---

## Self-Review

**스펙 커버리지**

| 설계 절 | Task |
| --- | --- |
| 1 무엇을 바꾸나 | Task 2·4 (전환) · Task 5 (삭제) · Task 6 (public) |
| 2 두 엔진은 층위가 다르다 | Task 2 — 성분을 안 옮기고 등급을 그대로 낸다 |
| 3 둘로 나눈다 | Global Constraints — 순위를 안 매긴다 |
| 4 identity_axis 가 이미 접었다 | Task 3 |
| 5 화면이 잃는 것과 얻는 것 | Task 4 |
| 6 public 은 이름만 | Task 6 |
| 7 검증 | Task 1 (골든 before) · Task 3 Step 4 (after) · Task 7 (앱) |
| 8 열린 것 셋 | Task 6 Step 1·2 · Task 4 · Task 3 Step 5 · Task 8 Step 1 이 적는다 |

**의도적으로 안 하는 것**

```
팩 점수 모형        PR-B.  저울추는 이 PR 을 써 보고 정한다
DROP SCHEMA        그다음.  덤프와 이름 바꾸기까지
lib/engine/v2 수정   이미 옳고 테스트 411줄이 지킨다
```

**타입 일관성**

`Recommendation` · `PackLine` · `GiftLine` 이 Task 2 에서 정의되고 Task 4 의 화면이 쓴다.
`GiftLine.reasons` 는 `GiftVerdict['reasons']` 를 그대로 물려받으므로 v2 의 `Reason` 과
어긋날 수 없다.

**id 타입 경계** — v2 엔진은 전부 `string`, 화면은 `number` 다. Task 2 가 그 경계다:
`String(id)` 로 들어가고 `Number(id)` 로 나온다. Task 3 의 `squad.ts` 도 같은 규약을
이미 쓰고 있다.

**위험한 자리 셋**

**Task 2 Step 5** — `loadEngineData(canonical)` 의 인자 타입. 그 함수는
`PrismaClient` 를 받는데 `lib/db-canonical` 이 내보내는 것과 같은 클래스인지 확인해야 한다.
`golden.test.ts` 가 자기 인스턴스를 만들어 쓰므로 선례가 있으나, 같은 모듈에서 온
것인지는 봐야 한다.

**Task 3 Step 4** — `squad.listSquad` 외의 골든이 달라지면 회귀다. `identity_axis` 를
`include` 에 더하면서 다른 관계를 잘못 건드리기 쉽다.

**Task 6 Step 2** — 확장이 `public` 에 살면 이름을 못 바꾼다. 그 경우 멈추고 보고한다 —
억지로 옮기면 DB 가 깨진다.
