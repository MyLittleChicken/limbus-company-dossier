# 팩 점수 모형 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 팩마다 `점수 = 적합도 × 켜짐` 을 내고 추천 화면이 그 순으로 정렬한다.

**Architecture:** 점수 계산은 `lib/engine/v2/score.ts` 의 순수 함수다 — DB 도 Prisma 도 모른다. `lib/queries/canonical/recommend.ts` 가 기프트 키워드를 실어 오고 그 함수를 불러 `PackLine` 에 `{ score, fit, live }` 를 더한 뒤 정렬한다. 화면은 순위 번호와 분해 한 줄만 더한다.

**Tech Stack:** TypeScript ESM · `node:test` · Prisma `multiSchema` · Next.js App Router (서버 컴포넌트) · tsx

## Global Constraints

- 설계는 [`docs/superpowers/specs/2026-08-09-pack-scoring-design.md`](../specs/2026-08-09-pack-scoring-design.md). 절 번호는 그 문서를 가리킨다.
- **`canonical` 을 바꾸지 않는다.** 읽는 쪽만 건드린다. 검사 222건은 그대로 통과해야 한다.
- **저울추는 둘뿐이다** (설계 5.3) — `확정 1.0 / 가능 0.5`, `연쇄 1홉 1.0 / 2홉 0.5`. 새 상수를 만들지 않는다.
- **`tier` · `cost` · `hard_only` · `gift_requirement` 를 안 쓴다** (설계 5.4).
- **화면은 정렬과 분해 한 줄만.** 레이아웃 · 색 · 간격을 안 건드린다.
- **`ego_granted` 를 안 본다** — 이미 `recommend.ts` 가 걸러서 가져온다.
- 점수 계산은 `lib/engine/v2/` 에 둔다. 그쪽은 `@/` 별칭 대신 상대경로 + `.js` 확장자를 쓴다(기존 파일 전부 그렇다).
- import 는 앱 층에서 `@/` 별칭을 쓴다.
- 테스트 실행은 `npm test`. **기준선은 457 tests / 445 pass / 0 fail / 12 skip.**
- 타입 검사 `npm run typecheck`, 빌드 `npm run build`.
- DB 는 `docker exec limbus-postgres psql -U postgres -d limbus`.
- **워크트리는 이미 준비돼 있다** — `.env` 복사와 `npm run v2:generate` 를 마쳤다.
- 커밋 메시지는 한국어. Conventional Commits. **PR 제목도 접두사를 붙인다** (#28 에서 빠뜨렸다).

## 파일 구조

| 파일 | 책임 | 상태 |
| --- | --- | --- |
| `lib/engine/v2/score.ts` | 적합도 · 켜짐 · 점수. 순수 함수만 | **신규** |
| `lib/engine/v2/score.test.ts` | 위의 검사. DB 없이 돈다 | **신규** |
| `lib/queries/canonical/recommend.ts` | 키워드를 싣고 `scorePack` 을 부르고 정렬 | 수정 |
| `app/[locale]/recommend/page.tsx` | 순위 번호 · 분해 한 줄 | 수정 |
| `scripts/golden-queries.ts` | 추천 요약을 골든에 더한다 | 수정 |

`lib/engine/v2/{load,profile,evaluate,chain,types}.ts` 는 **안 건드린다.** 점수는 그것들의 출력을 읽기만 한다.

---

### Task 1: 골든 기준을 뜬다

**아무것도 바꾸기 전에 한다.** `build/` 는 gitignore 대상이라 이 워크트리에 없다.

**Files:** 없음

**Interfaces:**
- Consumes: `scripts/golden-queries.ts` 의 `cases()` 20건
- Produces: `build/golden/before/` 20개 JSON

- [ ] **Step 1: 지금 출력을 뜬다**

```bash
npm run golden:capture -- before
```

기대: `before — 20건 떴다.`

**실패하면 거기서 멈춘다.** 기준이 없으면 대조할 것이 없다.

- [ ] **Step 2: 커밋할 것이 없음을 확인한다**

```bash
git status --porcelain
```

기대: 비어 있다.

---

### Task 2: `score.ts` — 적합도와 켜짐의 순수 함수

**Files:**
- Create: `lib/engine/v2/score.ts`
- Create: `lib/engine/v2/score.test.ts`

**Interfaces:**
- Consumes: `lib/engine/v2/types.js` 의 `RefVerdict`
- Produces:
  - `AxisSupply` — `{ counts: Map<string, number>; max: number }`
  - `axisSupplyOf(rows): AxisSupply`
  - `fitOf(keywordId: string | null, supply: AxisSupply): number`
  - `ScoreGift` — `{ keywordId, total, satisfied, reasons, chainDepth, owned }`
  - `liveOf(gift: ScoreGift): number`

- [ ] **Step 1: 검사를 먼저 쓴다**

`lib/engine/v2/score.test.ts`:

```typescript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { axisSupplyOf, fitOf, liveOf, type ScoreGift } from './score.js';

const SUPPLY = axisSupplyOf([
	{ refKind: 'axis', refId: 'COMBUSTION', count: 7 },
	{ refKind: 'axis', refId: 'VIBRATION', count: 6 },
	{ refKind: 'axis', refId: 'BULLET', count: 3 },
	// 축이 아닌 갈래가 섞여 온다. 분모를 여기서 가져오면 축의 차이가 뭉개진다
	{ refKind: 'sin', refId: 'wrath', count: 7 },
	{ refKind: 'skill_kind', refId: 'attack', count: 7 },
]);

test('축 공급은 axis 갈래만 본다', () => {
	assert.equal(SUPPLY.max, 7);
	assert.equal(SUPPLY.counts.get('COMBUSTION'), 7);
	assert.equal(SUPPLY.counts.has('wrath'), false);
});

test('적합도는 최대 축 공급으로 나눈 값이다', () => {
	assert.equal(fitOf('Combustion', SUPPLY), 1);
	assert.equal(fitOf('Vibration', SUPPLY), 6 / 7);
	assert.equal(fitOf('Bullet', SUPPLY), 3 / 7);
});

test('덱에 없는 축은 0 이다', () => {
	assert.equal(fitOf('Sinking', SUPPLY), 0);
});

test('축이 아닌 키워드는 0 이다 — 공격 타입 3종과 범용이 키워드 표에 섞여 있다', () => {
	assert.equal(fitOf('None', SUPPLY), 0);
	assert.equal(fitOf('Slash', SUPPLY), 0);
	assert.equal(fitOf('Penetrate', SUPPLY), 0);
	assert.equal(fitOf(null, SUPPLY), 0);
});

test('축 공급이 없는 덱은 적합도가 전부 0 이다 — 나누기 0 을 안 만든다', () => {
	const empty = axisSupplyOf([{ refKind: 'sin', refId: 'wrath', count: 7 }]);
	assert.equal(empty.max, 0);
	assert.equal(fitOf('Combustion', empty), 0);
});

const gift = (over: Partial<ScoreGift> = {}): ScoreGift => ({
	keywordId: null,
	total: 0,
	satisfied: 0,
	reasons: [],
	chainDepth: null,
	owned: false,
	...over,
});

test('확정은 1.0 · 가능은 0.5', () => {
	const g = gift({
		total: 2,
		satisfied: 2,
		reasons: [
			{ verdict: 'satisfied', certainty: 'certain' },
			{ verdict: 'satisfied', certainty: 'possible' },
		],
	});
	assert.equal(liveOf(g), 1.5);
});

test('미충족과 판정불가는 안 센다', () => {
	const g = gift({
		total: 3,
		satisfied: 1,
		reasons: [
			{ verdict: 'satisfied', certainty: 'certain' },
			{ verdict: 'unsatisfied', certainty: 'certain' },
			{ verdict: 'unknown', certainty: 'possible' },
		],
	});
	assert.equal(liveOf(g), 1);
});

test('연쇄 1홉은 1.0 · 2홉은 0.5 를 더한다', () => {
	const base = { total: 2, satisfied: 0, reasons: [] };
	assert.equal(liveOf(gift({ ...base, chainDepth: 1 })), 1);
	assert.equal(liveOf(gift({ ...base, chainDepth: 2 })), 0.5);
	assert.equal(liveOf(gift({ ...base, chainDepth: null })), 0);
});

test('연쇄는 미충족 효과 수를 넘지 않는다 — L 이 1 을 넘으면 안 된다', () => {
	// 효과 하나가 이미 확정 충족이다. 켤 것이 남아 있지 않으므로 연쇄가 0 이다
	const g = gift({
		total: 1,
		satisfied: 1,
		reasons: [{ verdict: 'satisfied', certainty: 'certain' }],
		chainDepth: 1,
	});
	assert.equal(liveOf(g), 1);
});
```

- [ ] **Step 2: 검사가 깨지는지 본다**

```bash
npx tsx --test lib/engine/v2/score.test.ts
```

기대: `Cannot find module './score.js'` 로 실패.

- [ ] **Step 3: `score.ts` 를 쓴다**

`lib/engine/v2/score.ts`:

```typescript
/**
 * 팩 점수 — 설계 5절.
 *
 * ```
 * 점수 = 적합도 F × 켜짐 L
 * ```
 *
 * **DB 를 모른다.** `Profile` 과 `evaluateGifts` 가 낸 것을 받아 셈만 한다.
 * 순수 함수라 검사가 DB 없이 돌고, 저울추가 코드로 잠긴다
 * (ADR-08 「규칙은 코드 · 사실은 데이터」).
 *
 * **저울추가 둘뿐이다** — 확정 1.0 / 가능 0.5, 연쇄 1홉 1.0 / 2홉 0.5.
 * 같은 규칙이고(한 단계 멀어지면 반) 나머지는 전부 실측값에서 나온다.
 */
import type { RefVerdict } from './types.js';

/** 한 단계 불확실해지거나 한 홉 멀어지면 반. 이 파일의 저울추 전부다 */
const HALF = 0.5;

/**
 * 덱이 축을 얼마나 공급하나.
 *
 * **`refKind === 'axis'` 만 본다.** `Profile` 은 죄악 · 공명 · 코인 · 스킬 갈래 ·
 * 소속 · 유닛 키워드 · 공격 타입까지 여덟을 함께 내는데(PR-A 실측), 그중 가장 큰
 * 값으로 나누면 축의 차이가 뭉개진다.
 */
export interface AxisSupply {
	/** 축 id → 인원 */
	counts: Map<string, number>;
	/** 최대 인원. **0 이면 축을 하나도 공급하지 않는 덱이다** */
	max: number;
}

export function axisSupplyOf(
	rows: ReadonlyArray<{ refKind: string; refId: string; count: number }>,
): AxisSupply {
	const counts = new Map<string, number>();
	for (const r of rows) {
		if (r.refKind !== 'axis') continue;
		counts.set(r.refId, Math.max(counts.get(r.refId) ?? 0, r.count));
	}
	const values = [...counts.values()];
	return { counts, max: values.length > 0 ? Math.max(...values) : 0 };
}

/**
 * 이 키워드가 내 덱에 얼마나 맞나. 0~1.
 *
 * 축 id 는 키워드 id 의 대문자다(`Combustion` → `COMBUSTION`). 다리 표가 따로
 * 없고 필요도 없다 — `canonical/squad.ts` 와 같은 판정이다.
 *
 * **축이 아닌 키워드는 0 이다.** 키워드 표에 공격 타입 3종(`Slash` · `Penetrate` ·
 * `Hit`)과 `Random` · `None` 이 섞여 있다. 그것들은 축이 아니므로 덱 적합도에
 * 기여하지 않는다.
 */
export function fitOf(keywordId: string | null, supply: AxisSupply): number {
	if (keywordId === null || supply.max === 0) return 0;
	return (supply.counts.get(keywordId.toUpperCase()) ?? 0) / supply.max;
}

/** 점수가 보는 기프트 하나. **id 를 안 받는다** — 셈에 필요 없다 */
export interface ScoreGift {
	keywordId: string | null;
	/** 전체 효과 수 */
	total: number;
	/** 그중 충족한 수 (확정·가능 합) */
	satisfied: number;
	reasons: ReadonlyArray<{ verdict: RefVerdict; certainty: 'certain' | 'possible' }>;
	/** 보유 기프트가 이걸 켜 주는가. 몇 홉인지 */
	chainDepth: number | null;
	/** 이미 보유한 기프트인가. 후보에서 뺀다 */
	owned: boolean;
}

/**
 * 이 기프트에서 살아 있는 효과의 무게.
 *
 * **연쇄는 편성이 못 켜는 몫까지만 센다.** 안 그러면 편성으로 이미 전부 켜진
 * 기프트에 연쇄가 덧붙어 `L` 이 1 을 넘고, 「효과 중 몇 %가 사나」라는 정의와
 * 어긋난다. 연쇄는 편성이 못 켜는 것을 보유가 대신 켜 주는 경우다.
 */
export function liveOf(gift: ScoreGift): number {
	let live = 0;
	for (const r of gift.reasons) {
		if (r.verdict !== 'satisfied') continue;
		live += r.certainty === 'certain' ? 1 : HALF;
	}
	const unmet = gift.total - gift.satisfied;
	if (unmet > 0 && gift.chainDepth !== null) {
		live += Math.min(gift.chainDepth <= 1 ? 1 : HALF, unmet);
	}
	return live;
}
```

- [ ] **Step 4: 검사가 통과하는지 본다**

```bash
npx tsx --test lib/engine/v2/score.test.ts
```

기대: 9건 전부 pass · 0 fail. (전체 `npm test` 는 457 → 466)

- [ ] **Step 5: 커밋**

```bash
git add lib/engine/v2/score.ts lib/engine/v2/score.test.ts
git commit -m "feat(engine): 적합도와 켜짐의 순수 함수

설계 5절. 점수 = 적합도 F × 켜짐 L 의 두 조각을 만든다.

축 공급은 refKind === 'axis' 만 본다. Profile 은 죄악·공명·코인까지 여덟
갈래를 함께 내는데 그중 최대값으로 나누면 축의 차이가 뭉개진다.

연쇄는 미충족 효과 수를 넘지 않는다. 안 그러면 편성으로 이미 전부 켜진
기프트에 연쇄가 덧붙어 L 이 1 을 넘고 「효과 중 몇 %가 사나」라는 정의와
어긋난다.

저울추는 둘뿐이고 같은 규칙이다 — 한 단계 멀어지면 반."
```

---

### Task 3: `scorePack` — 팩 단위 집계

**Files:**
- Modify: `lib/engine/v2/score.ts`
- Modify: `lib/engine/v2/score.test.ts`

**Interfaces:**
- Consumes: Task 2 의 `AxisSupply` · `ScoreGift` · `fitOf` · `liveOf`
- Produces:
  - `PackScore` — `{ fit: number; live: number; score: number; candidates: number; rankable: boolean }`
  - `scorePack(gifts: ReadonlyArray<ScoreGift>, supply: AxisSupply): PackScore`

- [ ] **Step 1: 검사를 더한다**

`lib/engine/v2/score.test.ts` 끝에 붙인다. 위쪽의 `SUPPLY` 와 `gift` 를 그대로 쓴다.

```typescript
import { scorePack } from './score.js';

test('적합도는 후보의 평균이고 켜짐은 효과 비율이다', () => {
	const s = scorePack(
		[
			// 화상 · 효과 2개 다 확정 충족
			gift({
				keywordId: 'Combustion',
				total: 2,
				satisfied: 2,
				reasons: [
					{ verdict: 'satisfied', certainty: 'certain' },
					{ verdict: 'satisfied', certainty: 'certain' },
				],
			}),
			// 범용 · 효과 2개 중 하나도 안 켜짐
			gift({
				keywordId: 'None',
				total: 2,
				satisfied: 0,
				reasons: [
					{ verdict: 'unsatisfied', certainty: 'certain' },
					{ verdict: 'unsatisfied', certainty: 'certain' },
				],
			}),
		],
		SUPPLY,
	);
	assert.equal(s.candidates, 2);
	assert.equal(s.fit, 0.5); // (1 + 0) / 2
	assert.equal(s.live, 0.5); // 2 / 4
	assert.equal(s.score, 0.25);
	assert.equal(s.rankable, true);
});

test('보유한 기프트는 후보에서 뺀다 — 다시 얻을 수 없다', () => {
	const owned = gift({
		keywordId: 'Combustion',
		total: 2,
		satisfied: 2,
		reasons: [
			{ verdict: 'satisfied', certainty: 'certain' },
			{ verdict: 'satisfied', certainty: 'certain' },
		],
		owned: true,
	});
	const fresh = gift({
		keywordId: 'None',
		total: 2,
		satisfied: 0,
		reasons: [
			{ verdict: 'unsatisfied', certainty: 'certain' },
			{ verdict: 'unsatisfied', certainty: 'certain' },
		],
	});
	const s = scorePack([owned, fresh], SUPPLY);
	assert.equal(s.candidates, 1);
	assert.equal(s.fit, 0);
	assert.equal(s.live, 0);
});

test('후보가 0 이면 점수가 0 이다 — 나누기 0 을 안 만든다', () => {
	const s = scorePack([gift({ owned: true })], SUPPLY);
	assert.equal(s.candidates, 0);
	assert.equal(s.fit, 0);
	assert.equal(s.live, 0);
	assert.equal(s.score, 0);
});

test('효과가 하나도 없는 팩은 켜짐이 0 이다 — 0 으로 세지 않고 분모에서 뺀다', () => {
	const s = scorePack([gift({ keywordId: 'Combustion', total: 0 })], SUPPLY);
	assert.equal(s.candidates, 1);
	assert.equal(s.fit, 1);
	assert.equal(s.live, 0);
	assert.equal(s.score, 0);
});

test('축 공급이 없는 덱은 순위를 매길 수 없다', () => {
	const empty = axisSupplyOf([{ refKind: 'sin', refId: 'wrath', count: 7 }]);
	const s = scorePack([gift({ keywordId: 'Combustion', total: 1, satisfied: 1, reasons: [{ verdict: 'satisfied', certainty: 'certain' }] })], empty);
	assert.equal(s.rankable, false);
	assert.equal(s.score, 0);
});

test('켜짐은 1 을 안 넘는다 — 연쇄가 붙어도', () => {
	const s = scorePack(
		[
			gift({
				keywordId: 'Combustion',
				total: 1,
				satisfied: 1,
				reasons: [{ verdict: 'satisfied', certainty: 'certain' }],
				chainDepth: 1,
			}),
		],
		SUPPLY,
	);
	assert.equal(s.live, 1);
});
```

**`import { scorePack }` 을 파일 위쪽 import 에 합친다** — 검사 파일에 import 문이 둘이면 안 된다.

- [ ] **Step 2: 검사가 깨지는지 본다**

```bash
npx tsx --test lib/engine/v2/score.test.ts
```

기대: `scorePack is not exported` 류로 실패.

- [ ] **Step 3: `scorePack` 을 더한다**

`lib/engine/v2/score.ts` 끝에 붙인다.

```typescript
/**
 * 팩 하나의 점수.
 *
 * **곱이지 합이 아니다(설계 5.1).** 두 축이 다른 질문에 답하므로 합으로 하면
 * 한쪽이 0 이어도 다른 쪽이 메운다 — 덱과 전혀 안 맞는 팩은 켜짐이 높아도
 * 고를 이유가 없다. 실측으로 「내쉬어진 한숨」이 켜짐 최고(0.568)이면서
 * 적합도 최하(0.052)다.
 */
export interface PackScore {
	/** 후보 기프트의 평균 적합도. 0~1 */
	fit: number;
	/** 후보 기프트의 전체 효과 중 살아 있는 비율. 0~1 */
	live: number;
	/** `fit × live`. **순위를 매길 수 없으면 0 이다** */
	score: number;
	/** 보유를 뺀 기프트 수 */
	candidates: number;
	/**
	 * 이 점수로 순위를 매겨도 되나.
	 *
	 * 축을 하나도 공급하지 않는 덱은 적합도가 전부 0 이라 순서가 무의미하다.
	 * **0 점을 매겨 늘어놓으면 그 순서가 거짓말이 된다** — 화면이 「순위를 매길
	 * 수 없다」고 적고 등급 분포만 낸다.
	 */
	rankable: boolean;
}

export function scorePack(
	gifts: ReadonlyArray<ScoreGift>,
	supply: AxisSupply,
): PackScore {
	const pool = gifts.filter((g) => !g.owned);
	const rankable = supply.max > 0;
	if (pool.length === 0) {
		return { fit: 0, live: 0, score: 0, candidates: 0, rankable };
	}

	const fit = pool.reduce((s, g) => s + fitOf(g.keywordId, supply), 0) / pool.length;

	// 효과가 없는 기프트는 분모에서 빠진다. 0 으로 세지 않는다
	const total = pool.reduce((s, g) => s + g.total, 0);
	const live = total > 0 ? pool.reduce((s, g) => s + liveOf(g), 0) / total : 0;

	return {
		fit,
		live,
		score: rankable ? fit * live : 0,
		candidates: pool.length,
		rankable,
	};
}
```

- [ ] **Step 4: 검사가 통과하는지 본다**

```bash
npx tsx --test lib/engine/v2/score.test.ts
npm run typecheck
```

기대: 15건 전부 pass · 0 fail · 타입 통과. (전체 `npm test` 는 466 → 472)

- [ ] **Step 5: 커밋**

```bash
git add lib/engine/v2/score.ts lib/engine/v2/score.test.ts
git commit -m "feat(engine): scorePack — 적합도 × 켜짐

곱이지 합이 아니다. 두 축이 다른 질문에 답하므로 합으로 하면 한쪽이 0 이어도
다른 쪽이 메운다 — 덱과 안 맞는 팩은 켜짐이 높아도 고를 이유가 없다.

축을 하나도 공급하지 않는 덱은 rankable 이 false 다. 0 점을 매겨 늘어놓으면
그 순서가 거짓말이 된다."
```

---

### Task 4: `recommend.ts` 가 점수를 낸다

**Files:**
- Modify: `lib/queries/canonical/recommend.ts`

**Interfaces:**
- Consumes: Task 3 의 `axisSupplyOf` · `scorePack` · `AxisSupply` · `PackScore` · `ScoreGift`
- Produces:
  - `GiftLine` 에 `keywordId: string | null` 추가
  - `PackLine` 에 `score: number` · `fit: number` · `live: number` 추가
  - `Recommendation` 에 `rankable: boolean` 추가
  - `packs` 가 `score` 내림차순 정렬

- [ ] **Step 1: 키워드가 이미 온다는 것을 확인한다**

`packRows` 질의가 `gift` 를 `include` 로 가져오므로 **스칼라 열이 전부 따라온다.**
`keywordId` 를 위해 질의를 고칠 필요가 없다. 계획 작성 중 실측했다.

```
9001  keywordId "Combustion"  tier 2
9002  keywordId "None"        tier 1
```

```bash
grep -n "include: { stages" lib/queries/canonical/recommend.ts
```

기대: `packRows` 안에 `gift: { include: { stages: … } }` 가 보인다. **고치지 않는다.**

- [ ] **Step 2: import 와 타입을 더한다**

`import { localeRows, nameOf } from './locale';` 아래에 더한다.

```typescript
import { axisSupplyOf, scorePack, type ScoreGift } from '@/lib/engine/v2/score';
```

`GiftLine` 에 한 줄 더한다.

```typescript
	/** 기프트 분류. 덱 적합도의 재료다 — 축이 아닌 값(None · Slash …)도 그대로 낸다 */
	keywordId: string | null;
```

`PackLine` 에 세 줄 더한다.

```typescript
	/** `fit × live`. 순위의 근거다 */
	score: number;
	/** 후보 기프트의 평균 덱 적합도 */
	fit: number;
	/** 후보 기프트의 효과 중 살아 있는 비율 */
	live: number;
```

`Recommendation` 에 한 줄 더한다.

```typescript
	/** 순위를 매길 수 있나. 축을 안 공급하는 덱은 false 다 */
	rankable: boolean;
```

- [ ] **Step 3: 점수를 계산하고 정렬한다**

`const packs: PackLine[] = packRows.map((p) => {` 블록을 통째로 갈아 끼운다.

```typescript
	// 축 공급을 먼저 접는다 — 팩마다 다시 세지 않는다
	const supplyRows = [...new Set(data.capabilities.map((c) => `${c.refKind}|${c.refId}`))]
		.map((k) => {
			const [refKind = '', refId = ''] = k.split('|');
			return { refKind, refId, count: profile.count(refKind, refId) };
		})
		.filter((s) => s.count > 0)
		.sort((a, b) => b.count - a.count || a.refId.localeCompare(b.refId));
	const axisSupply = axisSupplyOf(supplyRows);
	const ownedSet = new Set(ownedIds.map(String));

	const packs: PackLine[] = packRows.map((p) => {
		const gifts: GiftLine[] = p.gifts.map((row) => {
			const v = byGift.get(row.giftId);
			return {
				id: Number(row.giftId),
				name: nameOf(row.gift.stages[0]?.texts ?? [], locale)?.name ?? null,
				icon: giftIcon(row.gift.sprite),
				keywordId: row.gift.keywordId,
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

		// 점수는 엔진이 센다. 화면도 질의도 다시 세지 않는다.
		// **`gifts` 를 재료로 쓴다** — `p.gifts` 를 두 번 순회하며 `byGift` 를 다시
		// 조회하면 같은 셈이 두 벌이 되고, 한쪽만 고쳐질 때 조용히 갈린다
		const scoreInput: ScoreGift[] = gifts.map((g) => ({
			keywordId: g.keywordId,
			total: g.total,
			satisfied: g.satisfied,
			reasons: g.reasons,
			chainDepth: g.chainDepth,
			owned: ownedSet.has(String(g.id)),
		}));
		const s = scorePack(scoreInput, axisSupply);

		return {
			id: p.id,
			name: nameOf(p.texts, locale)?.name ?? null,
			icon: packIcon(p.sprite),
			score: s.score,
			fit: s.fit,
			live: s.live,
			tally: {
				A: gifts.filter((g) => g.grade === 'A').length,
				B: gifts.filter((g) => g.grade === 'B').length,
				C: gifts.filter((g) => g.grade === 'C').length,
			},
			gifts,
		};
	});

	// **점수 순이다.** 순위를 못 매기는 덱이면 팩 id 순으로 둔다 — 0 점을
	// 늘어놓은 순서가 의미 있는 것처럼 보이면 안 된다
	packs.sort((a, b) =>
		axisSupply.max > 0 ? b.score - a.score || a.id.localeCompare(b.id) : a.id.localeCompare(b.id),
	);
```

**기존 `supply` 계산 블록(`const supplyKeys = …` 부터 `.sort(…)` 까지)을 지운다.**
위에서 `supplyRows` 로 옮겼다. 반환문의 `supply,` 를 `supply: supplyRows,` 로 고친다.

반환문에 한 줄 더한다.

```typescript
		rankable: axisSupply.max > 0,
```

- [ ] **Step 4: 타입 검사와 골든 대조**

```bash
npm run typecheck
npm run golden:capture -- after
npm run golden:compare -- before after
```

**20건 전부 같아야 한다.** 추천은 아직 골든에 없고 다른 질의는 안 건드렸다.
하나라도 다르면 `supply` 계산을 옮기다 무언가 깨뜨린 것이다.

- [ ] **Step 5: 순위가 상식과 맞는지 실측한다**

**확인 스크립트를 저장소 안에 둔다.** `/tmp` 에 두면 `package.json` 의
`"type": "module"` 이 안 닿아 `Top-level await is currently not supported with
the "cjs" output format` 로 죽는다. 실측으로 확인한 함정이다.

```bash
cat > scripts/rank-check.ts <<'EOF'
const r = await import('../lib/queries/canonical/recommend.js');
const rec = await r.recommendForDeck('ko', { floor: 3, difficulty: 'hard' });
console.log('rankable', rec.rankable);
for (const p of rec.packs.slice(0, 3)) {
  console.log(p.score.toFixed(4), p.fit.toFixed(3), p.live.toFixed(3), p.name);
}
console.log('L 최대', Math.max(...rec.packs.map((p) => p.live)).toFixed(3));
process.exit(0);
EOF
npx tsx --env-file-if-exists=.env scripts/rank-check.ts
```

**기대 (설계 6절 실측과 같아야 한다):**

```
rankable true
0.1396 0.273 0.511 타오르는 일렁임
0.1209 0.247 0.490 어지러운 파동
0.0890 0.213 0.417 흘리는 것들
L 최대 0.568
```

**숫자가 다르면 멈추고 원인을 본다.** 설계가 이 값으로 승인됐다.

- [ ] **Step 6: 커밋**

```bash
rm -f scripts/rank-check.ts
git add lib/queries/canonical/recommend.ts
git commit -m "feat(web): 추천 질의가 팩 점수를 내고 그 순으로 정렬한다

PR #28 이 비워 둔 순위를 채운다. 점수 = 적합도 × 켜짐이고 계산은 엔진의
순수 함수가 한다 — 질의는 재료를 모아 넘기고 결과를 실을 뿐이다.

축 공급 계산을 팩 순회 앞으로 옮겼다. 팩마다 다시 세지 않는다.

순위를 못 매기는 덱(축 공급 0)이면 팩 id 순으로 둔다. 0 점을 늘어놓은
순서가 의미 있는 것처럼 보이면 안 된다.

실측 — 화진 덱 3층 hard 1위가 「타오르는 일렁임」(화상·진동 테마)이고
187개짜리 「뽕.황」은 15위다. 크기 편향이 사라졌다."
```

---

### Task 5: 화면이 순위와 분해를 낸다

**Files:**
- Modify: `app/[locale]/recommend/page.tsx`

**Interfaces:**
- Consumes: Task 4 의 `PackLine.score` · `fit` · `live`, `Recommendation.rankable`
- Produces: 없음 (화면)

- [ ] **Step 1: 순위를 못 매기는 경우를 먼저 처리한다**

`<Panel title={ko ? '이 층의 팩 후보' : 'Packs on this floor'}` 의 `hint` 를 고친다.

```tsx
					<Panel
						title={ko ? '이 층의 팩 후보' : 'Packs on this floor'}
						hint={
							rec.rankable
								? `${rec.candidateCount}`
								: ko
									? `${rec.candidateCount} · 순위 없음`
									: `${rec.candidateCount} · unranked`
						}
					>
						{/* 축을 안 공급하는 편성은 적합도가 전부 0 이라 순서가 무의미하다.
						    0 점을 늘어놓고 순위인 척하지 않는다 */}
						{!rec.rankable && (
							<Nothing kind="absent">
								{ko
									? '이 편성이 상태 축을 공급하지 않아 팩 순위를 매길 수 없다. 등급 분포만 낸다.'
									: 'This squad supplies no status axis, so packs cannot be ranked.'}
							</Nothing>
						)}
```

- [ ] **Step 2: 순위 번호와 분해 한 줄을 더한다**

`{rec.packs.map((p) => (` 안의 `<div className="row-head">` 블록을 갈아 끼운다.

```tsx
								{rec.packs.map((p, i) => (
									<li key={p.id}>
										<div className="row-head">
											{/* 순위를 못 매기면 번호를 안 붙인다 */}
											{rec.rankable && <span className="coin-i">{i + 1}</span>}
											<strong>
												<Link href={`/${locale}/packs/${p.id}`}>{p.name ?? p.id}</Link>
											</strong>
											{/* 순위가 아니라 분포다. 셋을 함께 내야 A 3 이 「12 중 3」인지 「3 중 3」인지 보인다. */}
											<span className="tag">{`A ${p.tally.A} · B ${p.tally.B} · C ${p.tally.C}`}</span>
										</div>
										{/* 점수 하나로 답하지 않는다. 무엇을 곱해 나온 값인지 함께 낸다 */}
										{rec.rankable && (
											<span className="card-meta">
												{ko
													? `${p.score.toFixed(3)} — 적합 ${p.fit.toFixed(3)} × 켜짐 ${p.live.toFixed(3)}`
													: `${p.score.toFixed(3)} — fit ${p.fit.toFixed(3)} × live ${p.live.toFixed(3)}`}
											</span>
										)}
```

**닫는 태그를 안 건드린다.** 기존 `{p.tally.A === 0 ? (…) : (…)}` 블록이 그대로 이어진다.

- [ ] **Step 3: 설명문을 지금 상태에 맞춘다**

`<p className="lede">` 의 한국어·영어 문장을 갈아 끼운다.

```tsx
			<p className="lede">
				{ko
					? 'v2 추천 엔진이 캐노니컬 위에서 도는지 보이는 화면이다. 팩 점수는 「이 팩이 내 덱 축과 맞는 정도」 × 「이 팩 기프트의 효과 중 실제로 켜지는 비율」이다. 이미 보유한 기프트는 후보에서 빠지고, 대신 다른 기프트를 켜는 연쇄로 센다.'
					: 'A slice showing the v2 engine running on canonical data. A pack score is how well the pack matches the deck axes, times the share of its gift effects that actually fire. Owned gifts leave the candidate pool and count instead as chain enablers.'}
			</p>
```

- [ ] **Step 4: 타입 검사와 빌드**

```bash
npm run typecheck
npm run build 2>&1 | grep -E "Compiled|error|Failed" | head -5
```

기대: 타입 통과 · `✓ Compiled successfully`.

- [ ] **Step 5: 커밋**

```bash
git add "app/[locale]/recommend/page.tsx"
git commit -m "feat(web): 추천 화면이 순위와 점수 분해를 낸다

순위 번호와 「0.140 — 적합 0.273 × 켜짐 0.511」 한 줄을 더한다. 점수 하나로
답하지 않고 무엇을 곱해 나온 값인지 함께 낸다.

순위를 못 매기는 편성(축 공급 0)이면 번호도 점수도 안 붙이고 그 사실을
적는다. 0 점을 늘어놓고 순위인 척하지 않는다.

레이아웃·색·간격은 안 건드렸다."
```

---

### Task 6: 골든이 추천을 잡는다

**PR-A 의 `[] ?? x` 버그를 화면 띄워서야 잡았다.** 골든에 있었으면 대조로 잡혔다.

**Files:**
- Modify: `scripts/golden-queries.ts`

**Interfaces:**
- Consumes: Task 4 의 `recommendForDeck` · `HWAJIN_DECK`
- Produces: 골든 케이스 2건 — `recommend.floor3.hard` · `recommend.floor3.owned`

- [ ] **Step 1: 요약만 뜨도록 케이스를 더한다**

`scripts/golden-queries.ts` 의 `cases()` 안, `const squad = await import(…)` 아래에 더한다.

```typescript
	const recommend = await import('../lib/queries/canonical/recommend.js');

	/**
	 * **기프트 목록을 통째로 뜨지 않는다.** 후보 팩 27개에 기프트 1,990건이고
	 * 근거까지 실으면 골든 한 건이 수 MB 가 된다 — 대조할 때 사람이 못 읽는다.
	 * 회귀가 나는 자리는 순위와 점수이므로 그것만 남긴다.
	 */
	const summarize = (r: Awaited<ReturnType<typeof recommend.recommendForDeck>>) => ({
		floor: r.floor,
		difficulty: r.difficulty,
		rankable: r.rankable,
		candidateCount: r.candidateCount,
		deck: r.deck.map((d) => ({ id: d.id, name: d.name, axes: d.axes })),
		supply: r.supply,
		owned: r.owned,
		packs: r.packs.map((p) => ({
			id: p.id,
			name: p.name,
			// 부동소수 꼬리가 판마다 흔들리면 대조가 시끄러워진다. 여섯 자리로 자른다
			score: Number(p.score.toFixed(6)),
			fit: Number(p.fit.toFixed(6)),
			live: Number(p.live.toFixed(6)),
			tally: p.tally,
		})),
	});
```

`return [` 배열의 `squad.listSquadAxes` 줄 다음에 두 건을 더한다.

```typescript
		{
			name: 'recommend.floor3.hard',
			run: async () => summarize(await recommend.recommendForDeck('ko', { floor: 3, difficulty: 'hard' })),
		},
		{
			// 보유가 후보를 줄이고 연쇄를 켜는 경로. PR-A 의 빈 배열 버그가 여기 걸린다
			name: 'recommend.floor3.owned',
			run: async () =>
				summarize(
					await recommend.recommendForDeck('ko', {
						floor: 3,
						difficulty: 'hard',
						ownedIds: [9001, 9005, 9009, 9029, 9041, 9052, 9066, 9088, 9090, 9092, 9103, 9110],
					}),
				),
		},
```

- [ ] **Step 2: 뜨고 내용을 눈으로 본다**

```bash
npm run golden:capture -- after
```

기대: `after — 22건 떴다.`

```bash
python3 -c "
import json
d=json.load(open('build/golden/after/recommend.floor3.hard.json'))
print('rankable', d['rankable'], '· 후보', d['candidateCount'])
for p in d['packs'][:3]: print(f\"{p['score']:.4f} {p['fit']:.3f} {p['live']:.3f} {p['name']}\")
"
```

기대: `0.1396 0.273 0.511 타오르는 일렁임` 이 첫 줄.

- [ ] **Step 3: 파일 크기를 확인한다**

```bash
ls -la build/golden/after/recommend.floor3.hard.json
```

**100 KB 를 넘으면 요약이 덜 접힌 것이다** — 기프트 목록이 새어 들어갔는지 본다.

- [ ] **Step 4: 커밋**

```bash
git add scripts/golden-queries.ts
git commit -m "test(golden): 추천을 골든에 더한다 — 순위와 점수만

PR #28 에서 options.deployedIds ?? identityIds 가 빈 배열을 값으로 받아
출전 분모가 0 이 된 버그를 화면을 띄워서야 잡았다. 골든에 있었으면 대조로
잡혔다.

기프트 목록은 안 뜬다. 후보 27팩에 기프트 1,990건이고 근거까지 실으면 골든
한 건이 수 MB 가 되어 사람이 못 읽는다. 회귀가 나는 자리는 순위와 점수다.

보유 12개 판을 따로 둔다. 후보 축소와 연쇄가 그 경로에서만 돈다."
```

---

### Task 7: 앱을 띄워 확인한다

**PR-A 에서 이 단계가 진짜 버그를 잡았다.** 질의를 직접 부르면 정상인데 화면만 틀렸다.

**Files:** 없음

- [ ] **Step 1: 개발 서버를 띄운다**

```bash
PORT=3210 npm run dev > /tmp/dev-scoring.log 2>&1 &
sleep 12
tail -3 /tmp/dev-scoring.log
```

- [ ] **Step 2: 화면 전부를 두드린다**

```bash
for p in /ko /ko/about /ko/dungeon /ko/floors /ko/glossary /ko/identities \
         /ko/identities/10208 /ko/egos /ko/egos/20509 /ko/gifts /ko/gifts/9088 \
         /ko/packs /ko/packs/1309 /ko/squad /ko/recommend /en /en/squad /en/recommend; do
  printf "%-24s %s\n" "$p" "$(curl -s -o /dev/null -w '%{http_code}' http://localhost:3210$p)"
done
```

기대: 전부 200.

- [ ] **Step 3: 순위가 실제로 그려지는지 본다**

**200 은 빈 화면도 200 이다.** 내용을 본다.

```bash
curl -s "http://localhost:3210/ko/recommend" > /tmp/rec.html
python3 -c "
import re, html
s = open('/tmp/rec.html', encoding='utf-8').read()
t = re.sub(r'<script.*?</script>', '', s, flags=re.S)
t = html.unescape(re.sub(r'\s+', ' ', re.sub(r'<[^>]+>', ' ', t)))
m = re.findall(r'0\.\d{3} — 적합 0\.\d{3} × 켜짐 0\.\d{3}', t)
print('분해 줄', len(m))
print('첫 3개', m[:3])
i = t.find('이 층의 팩 후보')
print(t[i:i+200])
"
```

기대: 분해 줄 27개 · 첫 줄이 `0.140 — 적합 0.273 × 켜짐 0.511` · 발췌 첫 팩이 「타오르는 일렁임」.

- [ ] **Step 4: 서버 로그에 오류가 없는지 본다**

```bash
grep -ciE "error|unhandled|⨯" /tmp/dev-scoring.log
```

기대: `0`.

- [ ] **Step 5: 서버를 내린다**

```bash
pkill -f "next dev" || true
rm -f /tmp/dev-scoring.log /tmp/rec.html
```

---

### Task 8: 문서와 PR

**Files:**
- Modify: `docs/superpowers/specs/2026-08-09-pack-scoring-design.md`
- Modify: `docs/superpowers/plans/2026-08-09-pack-scoring.md`

- [ ] **Step 1: 설계에 구현 결과를 더한다**

설계 문서 끝(10절 뒤)에 절을 더한다. **실제로 나온 값을 적는다** — Task 4 Step 5 와
Task 7 Step 3 의 출력을 옮긴다.

```markdown
## 11. 구현 결과

```
파일        lib/engine/v2/score.ts (신규) · score.test.ts (신규)
           lib/queries/canonical/recommend.ts · app/[locale]/recommend/page.tsx
           scripts/golden-queries.ts
검사        순수 15건 추가.  전체 457 → 472 · 0 실패
골든        20 → 22건.  기존 20건 변화 없음
앱          경로 18개 200 · 서버 에러 0
순위        1위 타오르는 일렁임 0.1396 (적합 0.273 × 켜짐 0.511)
```

**설계 6절의 실측값이 구현에서 그대로 나왔다.** 다르면 모형이 아니라 배선이
틀린 것이므로 여기서 확인한다.
```

**Task 4 · 7 의 실제 출력이 위와 다르면 그 값을 적는다.** 계획서 숫자를 옮겨 적지 않는다.

- [ ] **Step 2: 계획서 단계를 완료로 표시한다**

```bash
python3 - <<'PY'
p = 'docs/superpowers/plans/2026-08-09-pack-scoring.md'
s = open(p, encoding='utf-8').read()
print('체크한 단계', s.count('- [ ] '))
open(p, 'w', encoding='utf-8').write(s.replace('- [ ] ', '- [x] '))
PY
```

- [ ] **Step 3: 마지막 검증**

```bash
npm run typecheck
npm test 2>&1 | grep -E "ℹ (tests|pass|fail|skipped)"
npm run build 2>&1 | grep -E "Compiled|Failed" | head -3
npm run v2:verify:canonical 2>&1 | tail -2
git status --porcelain
```

기대: 타입 통과 · 0 fail · `✓ Compiled successfully` · `검사 222건 전부 통과` ·
`git status` 는 커밋 뒤 비어 있다.

- [ ] **Step 4: 커밋하고 PR 을 올린다**

```bash
git add docs/
git commit -m "docs: 팩 점수 구현 결과"
git push
gh pr edit 30 --title "feat: 팩 점수 모형 — 적합도 × 켜짐"
gh pr ready 30
gh pr checks 30
```

**PR 제목에서 `WIP: ` 를 떼되 `feat: ` 는 남긴다** — #28 에서 접두사째 날려
컨벤션이 깨졌다.

PR 본문 머리의 WIP 경고 줄을 지우고 구현 결과로 갈아끼운다.

---

## 자체 검토

**스펙 대조** — 설계 1~10절이 전부 태스크에 걸린다.

```
1 무엇을 만드나            Task 4·5
2 제품 흐름                Task 3 (보유 제외) · Task 4 (연쇄)
3 두 모형 기각             근거이지 구현 대상이 아니다
4 결합 모호함 없음          Task 2 (liveOf 가 효과를 그대로 센다)
5 점수 모형                Task 2·3
5.1 왜 곱인가              Task 3 검사
5.2 확정과 가능             Task 2 검사
5.3 저울추 둘               Task 2 (HALF 상수 하나)
5.4 안 쓰는 것              계획 전체에서 tier·cost 를 안 만진다
6 실측 결과                Task 4 Step 5 가 회귀로 건다
7 구조                     파일 구조 표
8 지어내지 않는 자리         Task 2·3 검사 (0 나누기 · rankable)
9 검증                     Task 1·4·6·7
10 범위 밖                 안 건드린다
```

**빠진 것 없음.**

**타입 일관성** — `ScoreGift` · `AxisSupply` · `PackScore` 의 이름과 필드가
Task 2·3·4 에서 같다. `scorePack` 은 단수형이며 팩 하나를 받는다(복수형
`scorePacks` 를 쓰지 않는다 — 호출자가 `map` 한다).

**빈칸 없음** — 모든 단계에 실제 코드와 실제 기대값이 있다.
