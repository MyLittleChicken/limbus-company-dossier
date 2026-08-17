# 순위 표본과 저울추 (PR-A) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 사람이 매긴 순위 표본 60개를 모으고, 그것을 재현하는 저울추를 격자 탐색으로 찾아 정확도를 보고한다.

**Architecture:** 셈은 전부 **DB 를 모르는 순수 함수**로 `scripts/rank/` 아래에 두고, DB 를 읽는 것은 얇은 껍데기 셋(`rank-deck` · `rank-page` · `fit-weights`)만 한다. 그래야 표본이 오기 전에도 검사가 돌고, 엔진(`lib/engine/v2`)을 한 줄도 안 건드린다.

**Tech Stack:** TypeScript · Prisma(PostgreSQL) · node:test · tsx · 자기완결 HTML

## Global Constraints

- **`lib/engine/v2` 를 한 줄도 고치지 않는다.** 실서비스 추천은 이 PR 동안 지금 그대로 돈다. 격자 탐색은 `fitOf` 와 같은 셈을 스크립트 안에서 다시 한다.
- **판정 방식은 4단 바구니** — `반드시 집는다 3 · 좋다 2 · 보통 1 · 안 집는다 0`. 칸 안은 순서를 안 따진다.
- **표본은 3덱 × 20 = 60판정**, 그중 **6개는 세 덱 공통**이다. 겹침이 없으면 「적합도와 무관한 값」과 「적합도가 실재한다」를 못 가린다.
- **덱 셋의 성격** — A 화상(축이 선명) · B 소속(소속 요구가 켜짐) · C 섞임(축이 흩어져 적합도가 대부분 낮음). **C 가 `w_등급` 을 정한다.**
- **점수는 합이다** — `V = w_적합 · fit + w_등급 · tier + w_전용 · [전용]`. 곱이 아니다.
- **`fit` 의 분모는 둘 다 「그 덱이 가장 많이 가진 것」** — 축은 최대 축 공급, 공격 타입은 최대 타입 공급. 인원으로 나누지 않는다.
- **`tier` 정규화** — `(tier - 1) / 4`, `tier` 가 없으면(EX) `1.0`.
- **저울추 셈은 `fireable` 이 참인 짝만 센다.** 안 그러면 「죽는 기프트를 0점으로 두면 정확도가 오른다」는 가짜 이득이 생긴다.
- **저작 파일은 `src/v2/authored/` 에 둔다.** `data/` 아래는 커밋 훅이 막는다(Project Moon 저작물 스냅샷 정책).
- **페이지는 자기완결이어야 한다** — 외부 요청은 CSP 로 막힌다. CSS·JS 를 인라인한다.
- **모든 주석과 커밋 메시지는 한국어.** 무엇을 하는지가 아니라 왜 그런지를 적는다.
- **`scripts/` 안에서는 값 import 도 `.js` 를 붙인다.** 기존 스크립트가 그렇게
  쓴다(`scripts/split-clauses.ts` → `from './gift-shapes.js'`). 확장자를 빼는
  규칙은 `lib/` 에만 해당한다 — 그쪽은 Turbopack 이 번들하는데 TypeScript
  원본을 `.js` 로 못 풀기 때문이다. `scripts/` 는 tsx 만 돌리므로 상관없다.
- **`tsconfig.json` 의 `include` 는 `scripts/` 를 안 덮는다**(`app`·`lib`·
  `components`·`src` 만). `npx tsc --noEmit -p tsconfig.json | grep scripts`
  는 **언제나 비므로 검사가 아니다.** 타입을 보려면 파일을 직접 지목한다:
  `npx tsc --noEmit --strict --module nodenext --moduleResolution nodenext --target es2022 <파일들>`

---

## File Structure

```
scripts/rank/types.ts        Bucket · RankRow · GiftCard · DeckSpec — 공용 타입
scripts/rank/fit.ts          적합도 셈. DB 를 모른다
scripts/rank/fit.test.ts
scripts/rank/pairs.ts        바구니 → 순서 제약 짝. DB 를 모른다
scripts/rank/pairs.test.ts
scripts/rank/grid.ts         격자 탐색. DB 를 모른다
scripts/rank/grid.test.ts
scripts/rank/pick.ts         기프트 20개 고르기. DB 를 모른다
scripts/rank/pick.test.ts

scripts/rank-deck.ts         덱 셋을 짜고 후보를 뽑아 JSON 으로 낸다 (DB)
scripts/rank-page.ts         표본 수집 페이지를 만든다 (DB)
scripts/fit-weights.ts       표본을 읽어 저울추를 찾고 보고한다 (DB)

src/v2/authored/gift-rank.jsonl   표본 60줄 — 사람이 매긴 것
```

`scripts/rank/` 를 따로 둔 이유 — 셈이 스크립트 본문에 섞이면 검사가 DB 를 필요로 하게 된다. 표본이 오기 전에도 격자 탐색이 옳은지 확인할 수 있어야 한다.

---

### Task 1: 공용 타입과 적합도 셈

**Files:**
- Create: `scripts/rank/types.ts`
- Create: `scripts/rank/fit.ts`
- Test: `scripts/rank/fit.test.ts`

**Interfaces:**
- Produces:
  - `type Bucket = 0 | 1 | 2 | 3`
  - `interface DeckSupply { axis: Map<string, number>; attackType: Map<string, number> }`
  - `interface GiftCard { giftId: string; name: string; desc: string; tier: number | null; keywordId: string | null; exclusive: boolean; fireable: boolean }`
  - `interface RankRow { deck: string; giftId: string; bucket: Bucket }`
  - `fitOfKeyword(keywordId: string | null, supply: DeckSupply): number`
  - `tierOf(tier: number | null): number`

- [ ] **Step 1: 테스트를 쓴다**

`scripts/rank/fit.test.ts`

```typescript
/**
 * 적합도 셈 — **DB 를 모른다.** 덱 공급을 주입받는 순수 함수다.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fitOfKeyword, tierOf } from './fit.js';
import type { DeckSupply } from './types.js';

/** 화상 6 · 출혈 2 · 참격 5 · 타격 1 인 덱 */
const SUPPLY: DeckSupply = {
	axis: new Map([['COMBUSTION', 6], ['LACERATION', 2]]),
	attackType: new Map([['slash', 5], ['hit', 1]]),
};

test('축 키워드는 최대 축 공급으로 나눈다', () => {
	assert.equal(fitOfKeyword('Combustion', SUPPLY), 1);
	assert.equal(fitOfKeyword('Laceration', SUPPLY), 2 / 6);
});

test('덱에 없는 축은 0 이다', () => {
	assert.equal(fitOfKeyword('Sinking', SUPPLY), 0);
});

test('공격 타입은 최대 타입 공급으로 나눈다 — 인원이 아니다', () => {
	// 분모를 인원으로 두면 축과 다른 자가 되어 저울추 하나로 못 덮는다
	assert.equal(fitOfKeyword('Slash', SUPPLY), 1);
	assert.equal(fitOfKeyword('Hit', SUPPLY), 1 / 5);
	assert.equal(fitOfKeyword('Penetrate', SUPPLY), 0);
});

test('키워드가 없거나 None 이면 0 이다', () => {
	assert.equal(fitOfKeyword(null, SUPPLY), 0);
	assert.equal(fitOfKeyword('None', SUPPLY), 0);
});

test('공급이 비면 0 이다 — 0 으로 나누지 않는다', () => {
	const empty: DeckSupply = { axis: new Map(), attackType: new Map() };
	assert.equal(fitOfKeyword('Combustion', empty), 0);
	assert.equal(fitOfKeyword('Slash', empty), 0);
});

test('등급을 0~1 로 편다', () => {
	assert.equal(tierOf(1), 0);
	assert.equal(tierOf(3), 0.5);
	assert.equal(tierOf(5), 1);
	// EX 는 등급이 없다. 5등급 위이지만 5등급도 2건뿐이라 갈라 봐야 표본이 안 나온다
	assert.equal(tierOf(null), 1);
});
```

- [ ] **Step 2: 테스트를 돌려 실패를 확인한다**

Run: `npx tsx --test scripts/rank/fit.test.ts`
Expected: FAIL — `Cannot find module './fit.js'`

- [ ] **Step 3: `scripts/rank/types.ts` 를 쓴다**

```typescript
/**
 * 순위 표본이 쓰는 타입. **DB 를 모른다.**
 *
 * `lib/engine/v2` 의 타입을 안 빌려온다 — 이 PR 은 엔진을 한 줄도 안 건드리고,
 * 빌려오면 엔진 타입이 바뀔 때 여기가 따라 움직인다.
 */

/** 4단 바구니. 3 이 가장 좋다 */
export type Bucket = 0 | 1 | 2 | 3;

/** 한 덱이 무엇을 얼마나 공급하나 */
export interface DeckSupply {
	/** 축 id(대문자) → 인원 */
	axis: Map<string, number>;
	/** 공격 타입(소문자) → 인원 */
	attackType: Map<string, number>;
}

/** 페이지가 보여 줄 기프트 하나 */
export interface GiftCard {
	giftId: string;
	name: string;
	/** 설명문 전문. **이름과 등급만으로는 얼마나 센지 알 수 없다** */
	desc: string;
	tier: number | null;
	keywordId: string | null;
	exclusive: boolean;
	/** 이 덱에서 켜지나. 저울추 셈은 참인 것만 센다 */
	fireable: boolean;
}

/** 사람이 매긴 한 줄 */
export interface RankRow {
	deck: string;
	giftId: string;
	bucket: Bucket;
}

/** 덱 하나 */
export interface DeckSpec {
	/** 'A' · 'B' · 'C' */
	id: string;
	name: string;
	/** 편성 12인. 앞 7인이 출격이다 */
	roster: string[];
	supply: DeckSupply;
}
```

- [ ] **Step 4: `scripts/rank/fit.ts` 를 쓴다**

```typescript
/**
 * 적합도 — 「이 기프트가 내 덱을 얼마나 키우나」.
 *
 * **부여만 잰다.** 요구(「화상 인격 5인 필요」)는 엔진의 `L`(켜짐)이 이미
 * 재고 있어, 여기서 또 세면 같은 것을 두 번 센다.
 *
 * **`lib/engine/v2/score.ts` 의 `fitOf` 를 다시 쓴 것이다.** 엔진을 안
 * 건드리기로 했으므로 빌려오지 않는다. 저울추가 정해지면 그때 엔진 쪽을
 * 이 모양으로 맞춘다(PR-B).
 */
import type { DeckSupply } from './types.js';

/** 축 키워드 일곱. `keywordId` 는 첫 글자만 대문자라 대문자로 맞춰 본다 */
const AXES = new Set(['COMBUSTION', 'LACERATION', 'BURST', 'BREATH',
	'VIBRATION', 'SINKING', 'CHARGE']);

/** 공격 타입 셋. `keywordId` 에 축과 섞여 들어 있다 */
const ATTACK_TYPES = new Set(['SLASH', 'PENETRATE', 'HIT']);

/** 그 갈래에서 이 덱이 가장 많이 가진 수. 0 이면 나누지 않는다 */
function maxOf(m: Map<string, number>): number {
	const vs = [...m.values()];
	return vs.length > 0 ? Math.max(...vs) : 0;
}

/**
 * 0~1. **분모는 둘 다 「그 덱이 가장 많이 가진 것」이다.**
 *
 * 공격 타입만 인원으로 나누면 축과 다른 자가 되어 저울추 하나로 못 덮는다.
 */
export function fitOfKeyword(keywordId: string | null, supply: DeckSupply): number {
	if (keywordId === null) return 0;
	const k = keywordId.toUpperCase();

	if (AXES.has(k)) {
		const max = maxOf(supply.axis);
		return max === 0 ? 0 : (supply.axis.get(k) ?? 0) / max;
	}
	if (ATTACK_TYPES.has(k)) {
		const max = maxOf(supply.attackType);
		return max === 0 ? 0 : (supply.attackType.get(k.toLowerCase()) ?? 0) / max;
	}
	// 'None' 그리고 어휘 밖 — 범용 기프트다. 등급 항이 값을 낸다
	return 0;
}

/**
 * 등급을 0~1 로 편다. `fit` 과 같은 자로 재야 저울추를 견줄 수 있다.
 *
 * EX(등급 없음)는 1.0 이다 — 5등급 위이지만 5등급도 2건뿐이라 갈라 봐야
 * 표본이 안 나온다.
 */
export function tierOf(tier: number | null): number {
	if (tier === null) return 1;
	return Math.min(1, Math.max(0, (tier - 1) / 4));
}
```

- [ ] **Step 5: 테스트가 통과하는지 본다**

Run: `npx tsx --test scripts/rank/fit.test.ts`
Expected: PASS 6건

- [ ] **Step 6: 커밋**

```bash
git add scripts/rank/types.ts scripts/rank/fit.ts scripts/rank/fit.test.ts
git commit -m "feat(rank): 적합도 셈 — 부여만 재고 공격 타입까지 넓힌다

요구(「화상 인격 5인 필요」)는 엔진의 L(켜짐)이 이미 재고 있어 여기서 또 세면
같은 것을 두 번 센다. 그래서 부여만 잰다.

분모는 둘 다 「그 덱이 가장 많이 가진 것」이다. 공격 타입만 인원으로 나누면
축과 다른 자가 되어 저울추 하나로 못 덮는다.

lib/engine/v2 를 안 건드린다 — score.ts 의 fitOf 를 빌려오지 않고 다시 썼다.
저울추가 정해지면 그때 엔진 쪽을 이 모양으로 맞춘다(PR-B)."
```

---

### Task 2: 바구니를 순서 제약 짝으로

**Files:**
- Create: `scripts/rank/pairs.ts`
- Test: `scripts/rank/pairs.test.ts`

**Interfaces:**
- Consumes: Task 1 의 `Bucket` · `RankRow`
- Produces:
  - `interface Pair { deck: string; hi: string; lo: string }`
  - `pairsOf(rows: RankRow[], fireable: (deck: string, giftId: string) => boolean): Pair[]`

- [ ] **Step 1: 테스트를 쓴다**

`scripts/rank/pairs.test.ts`

```typescript
/**
 * 바구니 → 순서 제약 짝.
 *
 * 칸이 다르면 「가 나보다 위」가 생긴다. 칸 안은 순서를 안 따지므로 짝이 없다.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pairsOf } from './pairs.js';
import type { RankRow } from './types.js';

const ALL_FIRE = (): boolean => true;
const rows = (...xs: Array<[string, string, 0 | 1 | 2 | 3]>): RankRow[] =>
	xs.map(([deck, giftId, bucket]) => ({ deck, giftId, bucket }));

test('칸이 다르면 짝이 생긴다 — 높은 칸이 hi 다', () => {
	const p = pairsOf(rows(['A', 'g1', 3], ['A', 'g2', 1]), ALL_FIRE);
	assert.deepEqual(p, [{ deck: 'A', hi: 'g1', lo: 'g2' }]);
});

test('같은 칸은 짝이 없다 — 칸 안은 순서를 안 따진다', () => {
	assert.deepEqual(pairsOf(rows(['A', 'g1', 2], ['A', 'g2', 2]), ALL_FIRE), []);
});

test('덱이 다르면 짝이 없다 — 덱마다 적합도가 다르다', () => {
	assert.deepEqual(pairsOf(rows(['A', 'g1', 3], ['B', 'g2', 0]), ALL_FIRE), []);
});

test('세 칸이면 짝이 셋이다 — 모든 칸 사이를 잇는다', () => {
	const p = pairsOf(rows(['A', 'g1', 3], ['A', 'g2', 2], ['A', 'g3', 0]), ALL_FIRE);
	assert.equal(p.length, 3);
	assert.deepEqual(new Set(p.map((x) => `${x.hi}>${x.lo}`)),
		new Set(['g1>g2', 'g1>g3', 'g2>g3']));
});

test('안 켜지는 기프트는 짝에서 빠진다', () => {
	// scorePack 이 fireable 거짓을 후보에서 아예 빼므로 모형이 값을 안 매긴다.
	// 세면 「죽는 기프트를 0점으로 두면 정확도가 오른다」는 가짜 이득이 생긴다
	const fire = (_d: string, g: string): boolean => g !== 'g2';
	const p = pairsOf(rows(['A', 'g1', 3], ['A', 'g2', 0], ['A', 'g3', 1]), fire);
	assert.deepEqual(p, [{ deck: 'A', hi: 'g1', lo: 'g3' }]);
});

test('짝 순서가 입력 순서에 안 흔들린다', () => {
	const a = pairsOf(rows(['A', 'g1', 3], ['A', 'g2', 1]), ALL_FIRE);
	const b = pairsOf(rows(['A', 'g2', 1], ['A', 'g1', 3]), ALL_FIRE);
	assert.deepEqual(a, b);
});
```

- [ ] **Step 2: 테스트를 돌려 실패를 확인한다**

Run: `npx tsx --test scripts/rank/pairs.test.ts`
Expected: FAIL — `Cannot find module './pairs.js'`

- [ ] **Step 3: `scripts/rank/pairs.ts` 를 쓴다**

```typescript
/**
 * 바구니를 순서 제약으로 편다.
 *
 * 4단 바구니는 완전 순서가 아니다 — 칸이 다를 때만 「가 나보다 위」가 생긴다.
 * 칸 안을 순서로 읽으면 사람이 안 매긴 순서를 골든으로 굳히게 된다.
 */
import type { RankRow } from './types.js';

export interface Pair {
	deck: string;
	/** 위여야 하는 기프트 */
	hi: string;
	/** 아래여야 하는 기프트 */
	lo: string;
}

/**
 * **덱 안에서만** 짝을 만든다. 덱이 다르면 적합도가 달라 견줄 수 없다.
 *
 * `fireable` 이 거짓인 기프트는 뺀다 — `scorePack` 이 후보에서 아예 빼므로
 * 모형이 값을 안 매긴다. 세면 「죽는 기프트를 0점으로 두면 정확도가 오른다」는
 * 가짜 이득이 생긴다.
 */
export function pairsOf(
	rows: RankRow[],
	fireable: (deck: string, giftId: string) => boolean,
): Pair[] {
	const live = rows.filter((r) => fireable(r.deck, r.giftId));
	const byDeck = new Map<string, RankRow[]>();
	for (const r of live) byDeck.set(r.deck, [...(byDeck.get(r.deck) ?? []), r]);

	const out: Pair[] = [];
	for (const [deck, rs] of [...byDeck].sort((a, b) => a[0].localeCompare(b[0]))) {
		const sorted = [...rs].sort((a, b) => a.giftId.localeCompare(b.giftId));
		for (const x of sorted) {
			for (const y of sorted) {
				if (x.bucket > y.bucket) out.push({ deck, hi: x.giftId, lo: y.giftId });
			}
		}
	}
	return out;
}
```

- [ ] **Step 4: 테스트가 통과하는지 본다**

Run: `npx tsx --test scripts/rank/pairs.test.ts`
Expected: PASS 6건

- [ ] **Step 5: 커밋**

```bash
git add scripts/rank/pairs.ts scripts/rank/pairs.test.ts
git commit -m "feat(rank): 바구니를 순서 제약 짝으로 편다

4단 바구니는 완전 순서가 아니다 — 칸이 다를 때만 「가 나보다 위」가 생긴다.
칸 안을 순서로 읽으면 사람이 안 매긴 순서를 골든으로 굳히게 된다.

덱 안에서만 짝을 만든다. 덱이 다르면 적합도가 달라 견줄 수 없다.

fireable 이 거짓인 기프트는 뺀다. scorePack 이 후보에서 아예 빼므로 모형이
값을 안 매기고, 세면 「죽는 기프트를 0점으로 두면 정확도가 오른다」는 가짜
이득이 생긴다."
```

---

### Task 3: 격자 탐색

**Files:**
- Create: `scripts/rank/grid.ts`
- Test: `scripts/rank/grid.test.ts`

**Interfaces:**
- Consumes: Task 1 의 `GiftCard` · `DeckSupply`, Task 2 의 `Pair`
- Produces:
  - `interface Weights { fit: number; tier: number; exclusive: number }`
  - `valueOf(card: GiftCard, supply: DeckSupply, w: Weights): number`
  - `agreementOf(pairs: Pair[], value: (deck: string, giftId: string) => number): { hit: number; total: number }`
  - `searchWeights(pairs: Pair[], value: (deck: string, giftId: string, w: Weights) => number, scale?: readonly number[]): { best: Weights; hit: number; total: number }`
  - **`Pair` 는 `./pairs.js` 에서 가져온다** — `./types.js` 가 아니다. Task 2 가 거기 두었다.

- [ ] **Step 1: 테스트를 쓴다**

`scripts/rank/grid.test.ts`

```typescript
/**
 * 격자 탐색 — **표본이 오기 전에도 돌아야 한다.**
 *
 * 답을 아는 작은 표본에서 답을 못 찾으면 진짜 표본에서도 못 찾는다.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { valueOf, agreementOf, searchWeights, type Weights } from './grid.js';
import type { DeckSupply, GiftCard, Pair } from './types.js';

const SUPPLY: DeckSupply = {
	axis: new Map([['COMBUSTION', 6]]),
	attackType: new Map([['slash', 4]]),
};
const card = (o: Partial<GiftCard> = {}): GiftCard => ({
	giftId: 'g', name: '이름', desc: '설명', tier: 3,
	keywordId: null, exclusive: false, fireable: true, ...o,
});

test('값은 합이다 — 적합도가 0 이어도 등급이 값을 낸다', () => {
	// 곱이면 「범용 5등급이 화상 2등급보다 위」가 원리적으로 불가능하다
	const w: Weights = { fit: 1, tier: 1, exclusive: 0 };
	assert.equal(valueOf(card({ keywordId: null, tier: 5 }), SUPPLY, w), 1);
});

test('세 항이 각각 더해진다', () => {
	const w: Weights = { fit: 2, tier: 4, exclusive: 8 };
	// fit 1 · tier (3-1)/4 = 0.5 · exclusive 1
	const v = valueOf(card({ keywordId: 'Combustion', tier: 3, exclusive: true }), SUPPLY, w);
	assert.equal(v, 2 * 1 + 4 * 0.5 + 8 * 1);
});

test('전용은 적합도에 곱하지 않고 따로 더한다', () => {
	// 곱하면 키워드 없는 전용 기프트가 전용 여부를 아예 못 보인다
	const w: Weights = { fit: 1, tier: 0, exclusive: 1 };
	assert.equal(valueOf(card({ keywordId: null, exclusive: true }), SUPPLY, w), 1);
});

test('제약을 몇 개나 지켰는지 센다', () => {
	const pairs: Pair[] = [
		{ deck: 'A', hi: 'x', lo: 'y' },
		{ deck: 'A', hi: 'y', lo: 'z' },
	];
	const v = new Map([['x', 3], ['y', 2], ['z', 1]]);
	assert.deepEqual(agreementOf(pairs, (_d, g) => v.get(g) ?? 0), { hit: 2, total: 2 });
});

test('값이 같으면 안 지킨 것으로 센다 — 순서를 못 만들었다', () => {
	const pairs: Pair[] = [{ deck: 'A', hi: 'x', lo: 'y' }];
	assert.deepEqual(agreementOf(pairs, () => 1), { hit: 0, total: 1 });
});

test('짝이 없으면 total 0 이다 — 0 으로 나누지 않는다', () => {
	assert.deepEqual(agreementOf([], () => 1), { hit: 0, total: 0 });
});

test('답을 아는 표본에서 답을 찾는다 — 등급만 말하는 세상', () => {
	// 적합도는 전부 0(키워드 없음)이고 등급만 다르다. w_등급 이 커야 맞는다
	const cards = new Map<string, GiftCard>([
		['hi', card({ giftId: 'hi', tier: 5 })],
		['lo', card({ giftId: 'lo', tier: 1 })],
	]);
	const pairs: Pair[] = [{ deck: 'A', hi: 'hi', lo: 'lo' }];
	const r = searchWeights(pairs, (_d, g, w) =>
		valueOf(cards.get(g) as GiftCard, SUPPLY, w));
	assert.equal(r.hit, 1);
	assert.equal(r.total, 1);
	assert.ok(r.best.tier > 0, JSON.stringify(r.best));
});

test('답을 아는 표본에서 답을 찾는다 — 적합도만 말하는 세상', () => {
	// 등급이 같고 키워드만 다르다. w_적합 이 커야 맞는다
	const cards = new Map<string, GiftCard>([
		['hi', card({ giftId: 'hi', keywordId: 'Combustion' })],
		['lo', card({ giftId: 'lo', keywordId: null })],
	]);
	const pairs: Pair[] = [{ deck: 'A', hi: 'hi', lo: 'lo' }];
	const r = searchWeights(pairs, (_d, g, w) =>
		valueOf(cards.get(g) as GiftCard, SUPPLY, w));
	assert.equal(r.hit, 1);
	assert.ok(r.best.fit > 0, JSON.stringify(r.best));
});

test('못 맞히는 표본에서는 못 맞혔다고 답한다 — 억지로 채우지 않는다', () => {
	// 같은 카드 둘을 서로 위라고 하면 어떤 저울추로도 둘 다 못 지킨다
	const c = card({ giftId: 'a' });
	const cards = new Map<string, GiftCard>([['a', c], ['b', { ...c, giftId: 'b' }]]);
	const pairs: Pair[] = [
		{ deck: 'A', hi: 'a', lo: 'b' },
		{ deck: 'A', hi: 'b', lo: 'a' },
	];
	const r = searchWeights(pairs, (_d, g, w) =>
		valueOf(cards.get(g) as GiftCard, SUPPLY, w));
	assert.equal(r.total, 2);
	assert.ok(r.hit <= 1, `${r.hit}`);
});
```

- [ ] **Step 2: 테스트를 돌려 실패를 확인한다**

Run: `npx tsx --test scripts/rank/grid.test.ts`
Expected: FAIL — `Cannot find module './grid.js'`

- [ ] **Step 3: `scripts/rank/grid.ts` 를 쓴다**

```typescript
/**
 * 격자 탐색으로 저울추를 찾는다.
 *
 * **학습 라이브러리를 안 쓴다.** 저울추가 셋뿐이라 값 범위를 잘게 훑으면
 * 되고, 그래야 결과가 결정적이며 「왜 이 숫자인가」를 「표본 60개 중 55개를
 * 맞혔다」로 답할 수 있다.
 *
 * **DB 를 모른다.** 값 셈을 함수로 주입받아, 표본이 오기 전에도 검사가 돈다.
 */
import { fitOfKeyword, tierOf } from './fit.js';
import type { DeckSupply, GiftCard, Pair } from './types.js';

export interface Weights {
	fit: number;
	tier: number;
	exclusive: number;
}

/**
 * 기프트 하나의 값. **곱이 아니라 합이다.**
 *
 * 곱이면 적합도가 0 일 때 등급이 무엇이든 0 이라, 「범용 5등급이 화상
 * 2등급보다 위일 수 있다」가 원리적으로 불가능해진다.
 *
 * **전용은 적합도에 곱하지 않고 따로 더한다.** 곱하면 키워드 없는 전용
 * 기프트가 전용 여부를 아예 못 보인다.
 */
export function valueOf(card: GiftCard, supply: DeckSupply, w: Weights): number {
	return w.fit * fitOfKeyword(card.keywordId, supply)
		+ w.tier * tierOf(card.tier)
		+ w.exclusive * (card.exclusive ? 1 : 0);
}

/**
 * 제약을 몇 개나 지켰나.
 *
 * **값이 같으면 안 지킨 것이다** — 순서를 만들지 못했다는 뜻이고, 그것을
 * 지킨 것으로 세면 「전부 0점」인 저울추가 만점을 받는다.
 */
export function agreementOf(
	pairs: Pair[],
	value: (deck: string, giftId: string) => number,
): { hit: number; total: number } {
	let hit = 0;
	for (const p of pairs) {
		if (value(p.deck, p.hi) > value(p.deck, p.lo)) hit += 1;
	}
	return { hit, total: pairs.length };
}

/** 훑을 값. 0 은 「이 항을 안 쓴다」다 */
const SCALE = [0, 0.25, 0.5, 0.75, 1, 1.5, 2, 3];

/**
 * 격자를 훑어 가장 많이 맞히는 저울추를 고른다.
 *
 * **같은 점수면 저울추 합이 작은 쪽을 고른다.** 항을 덜 쓰고 같은 성적을
 * 내면 그쪽이 설명하기 쉽고, 표본에 억지로 맞춘 것일 가능성도 낮다.
 */
export function searchWeights(
	pairs: Pair[],
	value: (deck: string, giftId: string, w: Weights) => number,
	scale: readonly number[] = SCALE,
): { best: Weights; hit: number; total: number } {
	let best: Weights = { fit: 0, tier: 0, exclusive: 0 };
	let bestHit = -1;
	let bestSum = Number.POSITIVE_INFINITY;

	for (const fit of scale) {
		for (const tier of scale) {
			for (const exclusive of scale) {
				const w = { fit, tier, exclusive };
				const { hit } = agreementOf(pairs, (d, g) => value(d, g, w));
				const sum = fit + tier + exclusive;
				if (hit > bestHit || (hit === bestHit && sum < bestSum)) {
					best = w;
					bestHit = hit;
					bestSum = sum;
				}
			}
		}
	}
	return { best, hit: Math.max(0, bestHit), total: pairs.length };
}
```

- [ ] **Step 4: 테스트가 통과하는지 본다**

Run: `npx tsx --test scripts/rank/grid.test.ts`
Expected: PASS 9건

- [ ] **Step 5: 되돌려 확인한다**

검사가 자기 이유인 버그를 정말 잡는지 본다. `agreementOf` 의 `>` 를 `>=` 로 바꾸고 돌린 뒤 되돌린다.

```bash
# grid.ts 에서 `value(p.deck, p.hi) > value(p.deck, p.lo)` 를 `>=` 로 바꾸고
npx tsx --test scripts/rank/grid.test.ts
# 「값이 같으면 안 지킨 것으로 센다」가 실패해야 한다. 확인한 뒤 되돌린다
```

Expected: 되돌리기 전 실패, 되돌린 뒤 통과.

- [ ] **Step 6: 커밋**

```bash
git add scripts/rank/grid.ts scripts/rank/grid.test.ts
git commit -m "feat(rank): 격자 탐색으로 저울추를 찾는다

학습 라이브러리를 안 쓴다. 저울추가 셋뿐이라 값 범위를 잘게 훑으면 되고,
그래야 결과가 결정적이며 「왜 이 숫자인가」를 「표본 60개 중 55개를 맞혔다」로
답할 수 있다.

값은 곱이 아니라 합이다. 곱이면 적합도가 0 일 때 등급이 무엇이든 0 이라
「범용 5등급이 화상 2등급보다 위일 수 있다」가 원리적으로 불가능해진다.

값이 같으면 안 지킨 것으로 센다 — 지킨 것으로 세면 「전부 0점」인 저울추가
만점을 받는다. 같은 점수면 저울추 합이 작은 쪽을 고른다.

DB 를 모른다. 값 셈을 주입받아 표본이 오기 전에도 검사가 돈다 — 답을 아는
작은 표본에서 답을 못 찾으면 진짜 표본에서도 못 찾는다."
```

---

### Task 4: 기프트 20개 고르기

**Files:**
- Create: `scripts/rank/pick.ts`
- Test: `scripts/rank/pick.test.ts`

**Interfaces:**
- Consumes: Task 1 의 `GiftCard` · `DeckSupply`
- Produces: `pickTwenty(pool: GiftCard[], supply: DeckSupply, shared: string[]): GiftCard[]`

- [ ] **Step 1: 테스트를 쓴다**

`scripts/rank/pick.test.ts`

```typescript
/**
 * 기프트 20개 고르기 — 네 축을 고르게 덮어야 표본이 쓸모 있다.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pickTwenty } from './pick.js';
import type { DeckSupply, GiftCard } from './types.js';

const SUPPLY: DeckSupply = {
	axis: new Map([['COMBUSTION', 6], ['SINKING', 1]]),
	// 참격·타격을 둘 다 4로 둔다 — 둘 다 「강」이라 「약」은 침잠만 남는다
	attackType: new Map([['slash', 4], ['hit', 4]]),
};

/**
 * 등급·키워드·전용·켜짐을 골고루 섞은 못.
 *
 * **못의 모양이 곧 검사의 이빨이다.** 「앞에서 giftId 순으로 스물」만 집는
 * 엉터리 구현이 통과하면 안 되므로, 앞 스물이 어느 갈래도 다 덮지 못하게
 * 짠다.
 *
 * ```
 * 등급 한 덩어리 = 6키워드 × 2 × 2 = 24 > 20     앞 스물은 1등급뿐이다
 * 침잠(유일한 「약」)을 키워드 목록 맨 뒤에 둔다   앞 스물에 「약」이 없다
 * ```
 *
 * 이렇게 두면 엉터리 구현이 「등급 덮임」과 「키워드 셋」에서 걸린다.
 * **줄이지 마라** — 5키워드로 되돌리면 24가 20이 되어 1등급 덩어리 하나가
 * 모든 조합을 담고, 검사가 통째로 무력해진다.
 */
function makePool(): GiftCard[] {
	const out: GiftCard[] = [];
	const tiers: Array<number | null> = [1, 2, 3, 4, 5, null];
	const keywords = ['Combustion', 'Slash', 'Hit', 'None', null, 'Sinking'];
	let n = 0;
	for (const tier of tiers) {
		for (const keywordId of keywords) {
			for (const exclusive of [true, false]) {
				for (const fireable of [true, false]) {
					n += 1;
					out.push({
						giftId: `g${String(n).padStart(3, '0')}`,
						name: `기프트 ${n}`, desc: '설명', tier, keywordId, exclusive, fireable,
					});
				}
			}
		}
	}
	return out;
}

test('스무 개를 고른다', () => {
	assert.equal(pickTwenty(makePool(), SUPPLY, []).length, 20);
});

test('공통 기프트를 반드시 넣는다 — 앞 스물 밖에 있어도', () => {
	// g024·g100 은 giftId 순으로 스물 밖이다. 공통을 안 챙기는 구현은 여기서 걸린다
	const shared = ['g001', 'g024', 'g100'];
	const picked = pickTwenty(makePool(), SUPPLY, shared);
	for (const id of shared) {
		assert.ok(picked.some((c) => c.giftId === id), `${id} 이 빠졌다`);
	}
	assert.equal(picked.length, 20);
});

test('앞에서 스물을 집는 것과 다르다 — 검사에 이빨이 있는지 못 박는다', () => {
	// 이 검사가 없으면 나머지가 우연히 통과하는 못으로 되돌아가도 아무도 모른다
	const pool = makePool();
	const naive = [...pool].sort((a, b) => a.giftId.localeCompare(b.giftId)).slice(0, 20);
	const picked = pickTwenty(pool, SUPPLY, []);
	assert.notDeepEqual(picked.map((c) => c.giftId), naive.map((c) => c.giftId));
});

test('등급을 고르게 덮는다 — 한 등급에 몰리지 않는다', () => {
	const picked = pickTwenty(makePool(), SUPPLY, []);
	const byTier = new Map<string, number>();
	for (const c of picked) {
		const k = c.tier === null ? 'EX' : String(c.tier);
		byTier.set(k, (byTier.get(k) ?? 0) + 1);
	}
	// 여섯 갈래(1~5·EX)가 다 나와야 한다
	assert.equal(byTier.size, 6, JSON.stringify([...byTier]));
	assert.ok(Math.max(...byTier.values()) <= 8, JSON.stringify([...byTier]));
});

test('축 일치 · 축 불일치 · 키워드 없음을 다 넣는다', () => {
	const picked = pickTwenty(makePool(), SUPPLY, []);
	assert.ok(picked.some((c) => c.keywordId === 'Combustion'), '축 일치가 없다');
	assert.ok(picked.some((c) => c.keywordId === 'Sinking'), '축 불일치가 없다');
	assert.ok(picked.some((c) => c.keywordId === null || c.keywordId === 'None'),
		'키워드 없음이 없다');
});

test('전용과 공용을 다 넣는다', () => {
	const picked = pickTwenty(makePool(), SUPPLY, []);
	assert.ok(picked.some((c) => c.exclusive), '전용이 없다');
	assert.ok(picked.some((c) => !c.exclusive), '공용이 없다');
});

test('안 켜지는 기프트도 넣는다 — 거르기가 옳은지를 표본이 판정한다', () => {
	const picked = pickTwenty(makePool(), SUPPLY, []);
	assert.ok(picked.some((c) => !c.fireable), '안 켜지는 것이 없다');
});

test('같은 못이면 같은 답이 나온다 — 무작위가 아니다', () => {
	const a = pickTwenty(makePool(), SUPPLY, []).map((c) => c.giftId);
	const b = pickTwenty(makePool(), SUPPLY, []).map((c) => c.giftId);
	assert.deepEqual(a, b);
});

test('못이 스무 개보다 작으면 있는 만큼만 낸다', () => {
	const small = makePool().slice(0, 7);
	assert.equal(pickTwenty(small, SUPPLY, []).length, 7);
});
```

- [ ] **Step 2: 테스트를 돌려 실패를 확인한다**

Run: `npx tsx --test scripts/rank/pick.test.ts`
Expected: FAIL — `Cannot find module './pick.js'`

- [ ] **Step 3: `scripts/rank/pick.ts` 를 쓴다**

```typescript
/**
 * 덱 하나에 보여 줄 기프트 20개를 고른다.
 *
 * **네 축을 고르게 덮어야 한다.** 한쪽에 몰리면 그 축의 저울추만 정해지고
 * 나머지는 표본이 말해 주는 것이 없다.
 *
 * ```
 * 등급     1 · 2 · 3 · 4 · 5 · EX
 * 키워드   강(주력 축) · 약(곁다리) · 없음
 * 팩       전용 · 공용
 * 요구     켜짐 · 안 켜짐
 * ```
 *
 * **무작위를 안 쓴다.** 표본을 다시 짤 일이 생겼을 때 같은 기준으로 짜야 하고,
 * 무작위면 「왜 이 스물인가」를 답할 수 없다.
 */
import { fitOfKeyword } from './fit.js';
import type { DeckSupply, GiftCard } from './types.js';

const WANT = 20;

/** 등급 여섯. `null` 은 EX 다 */
const TIERS: ReadonlyArray<number | null> = [1, 2, 3, 4, 5, null];

/**
 * 이 기프트의 키워드가 이 덱에 얼마나 맞나 — **셋으로 나눈다.**
 *
 * 「맞는다 / 안 맞는다」로 가르면 안 된다. 인격은 축을 여럿 갖기 때문에 화상
 * 덱에도 침잠이 한둘 섞이고, 그러면 `fit > 0` 이라 침잠 기프트까지 「일치」가
 * 된다 — 「불일치」 칸이 영영 비어 세 갈래가 둘로 접힌다.
 *
 * 문턱을 두면 「이 덱의 주력 축인가(강)」와 「곁다리인가(약)」가 갈린다.
 */
function keywordClassOf(c: GiftCard, supply: DeckSupply): '강' | '약' | '없음' {
	if (c.keywordId === null || c.keywordId === 'None') return '없음';
	return fitOfKeyword(c.keywordId, supply) >= 0.5 ? '강' : '약';
}

/**
 * 반드시 하나씩은 들어가야 하는 갈래.
 *
 * **칸의 곱집합을 라운드 로빈으로 돌면 안 된다.** 칸 이름을 정렬하면 등급별로
 * 뭉쳐서, 0회차가 1등급 칸을 전부 돌다 스무 자리를 다 써 버린다 — 4·5·EX 는
 * 차례가 안 온다. 갈래마다 「아직 없으면 하나」를 먼저 채우는 쪽이 덮임을
 * 보장한다.
 */
function needsOf(supply: DeckSupply): Array<(c: GiftCard) => boolean> {
	return [
		...TIERS.map((t) => (c: GiftCard) => c.tier === t),
		...(['강', '약', '없음'] as const).map((k) =>
			(c: GiftCard) => keywordClassOf(c, supply) === k),
		(c: GiftCard) => c.exclusive,
		(c: GiftCard) => !c.exclusive,
		(c: GiftCard) => !c.fireable,
	];
}

export function pickTwenty(
	pool: GiftCard[],
	supply: DeckSupply,
	shared: string[],
): GiftCard[] {
	const sorted = [...pool].sort((a, b) => a.giftId.localeCompare(b.giftId));
	const byId = new Map(sorted.map((c) => [c.giftId, c]));
	const picked: GiftCard[] = [];
	const taken = new Set<string>();
	const add = (c: GiftCard): void => {
		picked.push(c);
		taken.add(c.giftId);
	};

	// ① 공통 기프트를 먼저 넣는다 — 겹침이 없으면 덱 간 견줌이 안 된다
	for (const id of shared) {
		if (picked.length >= WANT) break;
		const c = byId.get(id);
		if (c !== undefined && !taken.has(id)) add(c);
	}

	// ② 갈래마다 아직 없으면 하나 채운다
	for (const ok of needsOf(supply)) {
		if (picked.length >= WANT) break;
		if (picked.some(ok)) continue;
		const c = sorted.find((x) => !taken.has(x.giftId) && ok(x));
		if (c !== undefined) add(c);
	}

	// ③ 남은 자리는 등급을 돌아가며 채운다 — 한 등급에 몰리지 않게
	while (picked.length < WANT) {
		let added = false;
		for (const t of TIERS) {
			if (picked.length >= WANT) break;
			const c = sorted.find((x) => !taken.has(x.giftId) && x.tier === t);
			if (c === undefined) continue;
			add(c);
			added = true;
		}
		if (!added) break; // 못이 말랐다
	}
	return picked;
}
```

- [ ] **Step 4: 테스트가 통과하는지 본다**

Run: `npx tsx --test scripts/rank/pick.test.ts`
Expected: PASS 9건

- [ ] **Step 5: 커밋**

```bash
git add scripts/rank/pick.ts scripts/rank/pick.test.ts
git commit -m "feat(rank): 덱마다 기프트 20개를 고르게 고른다

등급 1~5·EX · 축 일치/불일치/없음 · 전용/공용 · 켜짐/죽음 — 네 축을 칸으로
만들고 라운드 로빈으로 집는다. 한쪽에 몰리면 그 축의 저울추만 정해지고
나머지는 표본이 말해 주는 것이 없다.

무작위를 안 쓴다. 표본을 다시 짤 일이 생겼을 때 같은 기준으로 짜야 하고,
무작위면 「왜 이 스물인가」를 답할 수 없다.

공통 기프트를 먼저 넣는다 — 겹침이 없으면 「적합도와 무관한 값」과 「적합도가
실재한다」를 못 가린다."
```

---

### Task 5: 덱 셋을 짜고 후보를 낸다

**Files:**
- Create: `scripts/rank-deck.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: Task 1 의 `DeckSpec` · `GiftCard` · `DeckSupply`, Task 4 의 `pickTwenty`
- Produces: `/tmp/rank-candidates.json` — `{ decks: Array<{ id, name, roster, supply: {axis, attackType}, cards: GiftCard[] }> }`

- [ ] **Step 1: 덱 셋을 짜는 스크립트를 쓴다**

`scripts/rank-deck.ts`

```typescript
/**
 * 덱 셋을 짜고 덱마다 기프트 20개를 골라 낸다.
 *
 * ```
 * A 화상   화상 인격 12(출격 7)        축이 선명하다 — 적합도가 살아 있는 덱
 * B 소속   한 소속 중심 12             소속을 요구하는 기프트가 켜지는 덱
 * C 섞임   축이 흩어지게 12            적합도가 대부분 낮다 — 등급만 남는 덱
 * ```
 *
 * **덱 C 가 핵심이다.** `w_등급` 은 저 덱에서만 정해진다.
 *
 * 실행: npm run rank:deck -- --out /tmp/rank-candidates.json
 */
import { writeFileSync } from 'node:fs';
import { PrismaClient } from '../src/v2/generated/client.js';
import { loadEngineData } from '../lib/engine/v2/load.js';
import { evaluateGifts } from '../lib/engine/v2/evaluate.js';
import { pickTwenty } from './rank/pick.js';
import type { DeckSupply, GiftCard } from './rank/types.js';

const ROSTER = 12;
const FIELD = 7;

/** 세 덱 공통으로 넣을 여섯. 성격이 갈리게 손으로 골랐다 */
const SHARED = [
	'9083', // 달의 기억 — 5등급 · 범용 · 모든 적 내성이 취약
	'9754', // 굴레 — 4등급 · 범용 · 최대 체력 +20%
	'9035', // 저주 인형 — 1등급 · 범용 · 적 전체에 고정 피해
	'9088', // 진혼 — 화상 전용 · 축이 맞을 때만 값이 오른다
	'9262', // 모든 것의 뼈대 — 4등급 · 약지 요구 · 덱 B 에서만 켜진다
	'9021', // 쪽빛 지포라이터 — 1등급 · 범용 · E.G.O 자원
];

const argv = process.argv.slice(2);
const outIdx = argv.indexOf('--out');
const out = outIdx >= 0 ? String(argv[outIdx + 1]) : '/tmp/rank-candidates.json';

const prisma = new PrismaClient();
const data = await loadEngineData(prisma);

const meta = await prisma.$queryRaw<Array<{
	giftId: string; name: string; desc: string;
	tier: number | null; keywordId: string | null; exclusive: boolean;
}>>`
	SELECT t.gift_id AS "giftId", t.name, t."desc",
	       g.tier, g.keyword_id AS "keywordId",
	       (x.gift_id IS NOT NULL) AS exclusive
	FROM canonical.gift_stage_text t
	JOIN canonical.gift g ON g.id = t.gift_id
	LEFT JOIN (SELECT DISTINCT gift_id FROM canonical.gift_exclusive_pack) x
	       ON x.gift_id = t.gift_id
	WHERE t.locale = 'ko' AND t.level = 0 AND g.domain = 'mirror_dungeon'
	ORDER BY t.gift_id
`;

/** 이 인격들이 무엇을 공급하나 */
function supplyOf(roster: string[]): DeckSupply {
	const field = roster.slice(0, FIELD);
	const count = (m: Map<string, Set<string>>): Map<string, number> => {
		const o = new Map<string, number>();
		for (const [k, ids] of m) {
			const n = field.filter((id) => ids.has(id)).length;
			if (n > 0) o.set(k, n);
		}
		return o;
	};
	return { axis: count(data.supply.axisTag), attackType: count(data.supply.attackType) };
}

const sortedIds = (s: Set<string> | undefined): string[] => [...(s ?? [])].sort();
const allIds = [...new Set([...data.supply.association.values()].flatMap((s) => [...s]))].sort();

/** 덱 A — 화상 인격으로 채운다 */
const deckA = [...sortedIds(data.supply.axisTag.get('COMBUSTION')),
	...allIds].slice(0, ROSTER);

/** 덱 B — 약지 소속 중심. 모자라면 나머지로 채운다 */
const deckB = [...sortedIds(data.supply.association.get('RING_FINGER')),
	...allIds].slice(0, ROSTER);

/**
 * 덱 C — 축이 흩어지게. 축마다 하나씩 돌아가며 뽑아 어느 축도 크지 않게 한다.
 * **이 덱에서 적합도가 낮아야 `w_등급` 이 정해진다.**
 */
const axes = [...data.supply.axisTag.keys()].sort();
const deckC: string[] = [];
for (let round = 0; deckC.length < ROSTER && round < 12; round += 1) {
	for (const ax of axes) {
		if (deckC.length >= ROSTER) break;
		const id = sortedIds(data.supply.axisTag.get(ax))[round];
		if (id !== undefined && !deckC.includes(id)) deckC.push(id);
	}
}

const specs = [
	{ id: 'A', name: '화상 덱 — 축이 선명하다', roster: deckA },
	{ id: 'B', name: '약지 소속 덱 — 소속 요구가 켜진다', roster: deckB },
	{ id: 'C', name: '섞인 덱 — 축이 흩어져 적합도가 낮다', roster: deckC },
];

const decks = specs.map((s) => {
	const squad = {
		roster: s.roster.map((identityId) => ({ identityId, egoIds: [] })),
		field: s.roster.slice(0, FIELD),
	};
	const fire = new Map(evaluateGifts({
		squad, abilities: data.abilities, abilityConds: data.abilityConds, supply: data.supply,
	}).map((v) => [v.giftId, v.fireable]));

	const supply = supplyOf(s.roster);
	const pool: GiftCard[] = meta.map((m) => ({
		giftId: m.giftId, name: m.name, desc: m.desc, tier: m.tier,
		keywordId: m.keywordId, exclusive: m.exclusive,
		fireable: fire.get(m.giftId) ?? true,
	}));
	const cards = pickTwenty(pool, supply, SHARED);
	return {
		id: s.id, name: s.name, roster: s.roster,
		supply: { axis: [...supply.axis], attackType: [...supply.attackType] },
		cards,
	};
});

for (const d of decks) {
	const byTier = new Map<string, number>();
	for (const c of d.cards) {
		const k = c.tier === null ? 'EX' : String(c.tier);
		byTier.set(k, (byTier.get(k) ?? 0) + 1);
	}
	console.log(`덱 ${d.id} ${d.name}`);
	console.log(`  축 공급   ${d.supply.axis.map(([k, v]) => `${k} ${v}`).join(' · ')}`);
	console.log(`  기프트    ${d.cards.length} · 등급 ${[...byTier].sort().map(([k, v]) => `${k}:${v}`).join(' ')}`);
	console.log(`  안 켜짐   ${d.cards.filter((c) => !c.fireable).length}`);
}

writeFileSync(out, JSON.stringify({ decks }, null, '\t'), 'utf8');
console.log(`\n→ ${out}`);
await prisma.$disconnect();
process.exit(0);
```

- [ ] **Step 2: `package.json` 에 명령을 더한다**

`scripts` 에 한 줄을 넣는다.

```json
    "rank:deck": "tsx --env-file-if-exists=.env scripts/rank-deck.ts",
```

- [ ] **Step 3: 돌려서 덱이 제대로 짜였는지 본다**

Run: `npm run rank:deck`

Expected:
- 덱 A 의 축 공급에서 `COMBUSTION` 이 가장 크다
- 덱 C 의 축 공급이 고르다(최댓값이 3 이하)
- 덱마다 기프트 20개 · 등급 여섯 갈래가 다 나온다
- 덱마다 안 켜지는 기프트가 1개 이상 있다

셋 중 하나라도 어긋나면 덱 짜기를 고친다. **특히 덱 C 의 축이 고르지 않으면 `w_등급` 이 안 정해지므로 그냥 넘어가지 않는다.**

- [ ] **Step 4: 커밋**

```bash
git add scripts/rank-deck.ts package.json
git commit -m "feat(rank): 덱 셋을 짜고 덱마다 기프트 20개를 낸다

A 화상(축이 선명) · B 약지 소속(소속 요구가 켜짐) · C 섞임(축이 흩어져 적합도가
낮다). 덱 C 가 핵심이다 — w_등급 은 저 덱에서만 정해진다.

덱 C 는 축마다 하나씩 돌아가며 뽑아 어느 축도 크지 않게 한다.

공통 여섯을 세 덱에 다 넣는다. 달의 기억·굴레·저주 인형(범용) · 진혼(화상
전용) · 모든 것의 뼈대(약지 요구) · 쪽빛 지포라이터(범용 1등급) — 성격이
갈리게 손으로 골랐다."
```

---

### Task 6: 표본 수집 페이지

**Files:**
- Create: `scripts/rank-page.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: Task 5 의 `/tmp/rank-candidates.json`
- Produces: 자기완결 HTML. 내보내기 형식은 `{"deck":"A","giftId":"9083","bucket":3}` 한 줄씩

- [ ] **Step 1: 페이지 스크립트를 쓴다**

`scripts/rank-page.ts`

```typescript
/**
 * 표본 수집 페이지 — 기프트를 네 칸에 던진다.
 *
 * **설명문 전문을 보여야 한다.** 이름과 등급만으로는 「달의 기억」이 얼마나
 * 센지 알 수 없다.
 *
 * **자기완결이어야 한다** — Artifact 는 외부 요청이 CSP 로 막힌다. CSS·JS 를
 * 인라인한다.
 *
 * 실행: npm run rank:page -- --in /tmp/rank-candidates.json --out /tmp/rank.html
 */
import { readFileSync, writeFileSync } from 'node:fs';

interface Card {
	giftId: string; name: string; desc: string;
	tier: number | null; keywordId: string | null; exclusive: boolean; fireable: boolean;
}
interface Deck {
	id: string; name: string; roster: string[];
	supply: { axis: Array<[string, number]>; attackType: Array<[string, number]> };
	cards: Card[];
}

const argv = process.argv.slice(2);
const arg = (k: string, d: string): string => {
	const i = argv.indexOf(k);
	return i >= 0 ? String(argv[i + 1]) : d;
};
const input = arg('--in', '/tmp/rank-candidates.json');
const out = arg('--out', '/tmp/rank.html');

const { decks } = JSON.parse(readFileSync(input, 'utf8')) as { decks: Deck[] };
const total = decks.reduce((s, d) => s + d.cards.length, 0);

const esc = (s: string): string => s
	.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const BUCKETS = [
	{ key: 3, label: '반드시 집는다' },
	{ key: 2, label: '좋다' },
	{ key: 1, label: '보통' },
	{ key: 0, label: '안 집는다' },
];

const page = `<!doctype html>
<html lang="ko"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>기프트 순위 표본 — ${total}판정</title>
<style>
:root { color-scheme: light dark; --bg:#fff; --fg:#111; --line:#d8d8d8; --muted:#666;
  --card:#fafafa; --dead:#c0392b; }
@media (prefers-color-scheme: dark) { :root {
  --bg:#15171a; --fg:#e8e8e8; --line:#333; --muted:#999; --card:#1d2024; --dead:#e8776a; } }
* { box-sizing: border-box; }
body { margin:0; padding:1.5rem; background:var(--bg); color:var(--fg);
  font: 15px/1.6 ui-sans-serif, system-ui, "Apple SD Gothic Neo", sans-serif; }
h1 { font-size:1.3rem; margin:0 0 .3rem; }
.lead { color:var(--muted); margin:0 0 1.5rem; max-width:60ch; }
.deck { border:1px solid var(--line); border-radius:8px; margin:0 0 2rem; padding:1rem; }
.deck > h2 { font-size:1.05rem; margin:0 0 .2rem; }
.supply { color:var(--muted); font-size:.85rem; margin:0 0 1rem; }
.cols { display:grid; grid-template-columns:repeat(5,1fr); gap:.6rem; align-items:start; }
@media (max-width:1000px) { .cols { grid-template-columns:1fr; } }
.col { border:1px dashed var(--line); border-radius:6px; padding:.5rem; min-height:6rem; }
.col > h3 { font-size:.85rem; margin:0 0 .5rem; color:var(--muted);
  text-transform:none; letter-spacing:.02em; }
.card { border:1px solid var(--line); border-radius:5px; background:var(--card);
  padding:.5rem; margin:0 0 .5rem; cursor:grab; }
.card.dead { border-color:var(--dead); }
.card > .nm { font-weight:600; }
.card > .tag { color:var(--muted); font-size:.8rem; margin:.15rem 0 .35rem; }
.card > .ds { font-size:.82rem; white-space:pre-wrap; color:var(--fg); opacity:.85; }
.bar { position:sticky; bottom:0; background:var(--bg); border-top:1px solid var(--line);
  padding:.8rem 0; margin-top:1rem; display:flex; gap:.6rem; align-items:center; }
button { font:inherit; padding:.4rem .9rem; border:1px solid var(--line);
  border-radius:5px; background:var(--card); color:var(--fg); cursor:pointer; }
#count { color:var(--muted); }
textarea { width:100%; height:11rem; margin-top:.6rem; font:12px/1.5 ui-monospace, monospace;
  background:var(--card); color:var(--fg); border:1px solid var(--line); border-radius:5px;
  padding:.5rem; }
</style></head><body>
<h1>기프트 순위 표본 — ${total}판정</h1>
<p class="lead">기프트를 네 칸 중 하나로 끌어다 놓으세요. <strong>칸 안의 순서는 안 봅니다.</strong>
붉은 테두리는 이 편성에서 <strong>안 켜지는</strong> 기프트입니다 — 그것도 판정해 주셔야
「안 켜지면 뺀다」는 지금 규칙이 옳은지 정해집니다.</p>
${decks.map((d) => `
<section class="deck" data-deck="${esc(d.id)}">
  <h2>덱 ${esc(d.id)} · ${esc(d.name)}</h2>
  <p class="supply">축 ${d.supply.axis.map(([k, v]) => `${esc(k)} ${v}`).join(' · ') || '없음'}
    &nbsp;|&nbsp; 공격 ${d.supply.attackType.map(([k, v]) => `${esc(k)} ${v}`).join(' · ') || '없음'}</p>
  <div class="cols">
    <div class="col" data-bucket="none"><h3>아직 안 정함</h3>
      ${d.cards.map((c) => `
      <div class="card${c.fireable ? '' : ' dead'}" draggable="true" data-gift="${esc(c.giftId)}">
        <div class="nm">${esc(c.name)}</div>
        <div class="tag">${c.tier === null ? 'EX' : `${c.tier}등급`} ·
          ${esc(c.keywordId ?? '키워드 없음')} · ${c.exclusive ? '전용' : '공용'}${c.fireable ? '' : ' · 안 켜짐'}</div>
        <div class="ds">${esc(c.desc)}</div>
      </div>`).join('')}
    </div>
    ${BUCKETS.map((b) => `<div class="col" data-bucket="${b.key}"><h3>${b.label}</h3></div>`).join('')}
  </div>
</section>`).join('')}
<div class="bar">
  <button id="export">내보내기</button>
  <span id="count"></span>
</div>
<textarea id="outbox" readonly placeholder="내보내기를 누르면 여기에 나옵니다"></textarea>
<script>
let dragged = null;
for (const c of document.querySelectorAll('.card')) {
  c.addEventListener('dragstart', () => { dragged = c; });
}
for (const col of document.querySelectorAll('.col')) {
  col.addEventListener('dragover', (e) => { e.preventDefault(); });
  col.addEventListener('drop', (e) => {
    e.preventDefault();
    if (dragged !== null) { col.appendChild(dragged); dragged = null; tally(); }
  });
}
function tally() {
  let done = 0;
  for (const col of document.querySelectorAll('.col')) {
    if (col.dataset.bucket === 'none') continue;
    done += col.querySelectorAll('.card').length;
  }
  document.getElementById('count').textContent = done + ' / ${total} 판정';
}
document.getElementById('export').addEventListener('click', () => {
  const lines = [];
  for (const sec of document.querySelectorAll('.deck')) {
    for (const col of sec.querySelectorAll('.col')) {
      const b = col.dataset.bucket;
      if (b === 'none') continue;
      for (const card of col.querySelectorAll('.card')) {
        lines.push(JSON.stringify({ deck: sec.dataset.deck, giftId: card.dataset.gift, bucket: Number(b) }));
      }
    }
  }
  const box = document.getElementById('outbox');
  box.value = lines.join('\\n');
  box.select();
});
tally();
</script>
</body></html>`;

writeFileSync(out, page, 'utf8');
console.log(`덱 ${decks.length} · 판정 ${total}`);
console.log(`→ ${out}`);
```

- [ ] **Step 2: `package.json` 에 명령을 더한다**

```json
    "rank:page": "tsx scripts/rank-page.ts",
```

- [ ] **Step 3: 만들어서 열어 본다**

```bash
npm run rank:deck
npm run rank:page -- --in /tmp/rank-candidates.json --out /tmp/rank.html
open /tmp/rank.html
```

확인할 것:
- 덱 셋이 다 보이고 덱마다 카드 20장이 「아직 안 정함」에 있다
- 카드를 네 칸으로 끌어 옮길 수 있다
- 안 켜지는 카드에 붉은 테두리가 있다
- 「내보내기」를 누르면 JSONL 이 나오고 줄 수가 옮긴 카드 수와 같다
- 설명문 전문이 줄바꿈째로 보인다

- [ ] **Step 4: 커밋**

```bash
git add scripts/rank-page.ts package.json
git commit -m "feat(rank): 표본 수집 페이지 — 네 칸에 던진다

설명문 전문을 보여 준다. 이름과 등급만으로는 「달의 기억」이 얼마나 센지
알 수 없다.

안 켜지는 기프트에 붉은 테두리를 준다. 그것도 판정해야 「안 켜지면 뺀다」는
지금 규칙이 옳은지 정해진다 — 【안 집는다】에 두면 거르기가 맞고, 【보통】
이상에 두면 거르기가 너무 세다는 뜻이다.

자기완결이다 — Artifact 는 외부 요청이 CSP 로 막힌다."
```

---

### Task 7: 저울추를 찾고 보고한다

**Files:**
- Create: `scripts/fit-weights.ts`
- Create: `src/v2/authored/gift-rank.jsonl` (빈 파일로 만들고, 표본이 오면 채운다)
- Modify: `package.json`

**Interfaces:**
- Consumes: Task 1~4 전부, Task 5 의 `/tmp/rank-candidates.json`
- Produces: 콘솔 보고 — 저울추 셋 · 맞춘 덱/확인 덱 정확도

- [ ] **Step 1: 빈 표본 파일을 만든다**

```bash
printf '' > src/v2/authored/gift-rank.jsonl
```

- [ ] **Step 2: 스크립트를 쓴다**

`scripts/fit-weights.ts`

```typescript
/**
 * 표본을 읽어 저울추를 찾고 보고한다.
 *
 * **두 덱으로 맞추고 남은 덱으로 확인한다.** 60개에 저울추 셋이면 외워버릴
 * 위험이 크진 않지만, 확인 없이 「맞췄다」고 하면 그것은 증명이 아니다.
 * 세 갈래를 모두 돌려 셋 다 보고한다.
 *
 * 확인 덱의 정확도가 맞춘 덱보다 **크게 낮으면 모양이 틀린 것**이다 —
 * 저울추를 더 늘리지 말고 그 사실을 적는다.
 *
 * 실행: npm run rank:fit
 */
import { readFileSync } from 'node:fs';
import { pairsOf } from './rank/pairs.js';
import { searchWeights, valueOf, agreementOf, type Weights } from './rank/grid.js';
import type { Bucket, DeckSupply, GiftCard, RankRow } from './rank/types.js';

const SAMPLE = 'src/v2/authored/gift-rank.jsonl';

interface DeckJson {
	id: string; name: string;
	supply: { axis: Array<[string, number]>; attackType: Array<[string, number]> };
	cards: GiftCard[];
}

const argv = process.argv.slice(2);
const arg = (k: string, d: string): string => {
	const i = argv.indexOf(k);
	return i >= 0 ? String(argv[i + 1]) : d;
};

const { decks } = JSON.parse(readFileSync(arg('--in', '/tmp/rank-candidates.json'), 'utf8'))
	as { decks: DeckJson[] };

const rows: RankRow[] = readFileSync(arg('--sample', SAMPLE), 'utf8')
	.split('\n').map((l) => l.trim()).filter((l) => l !== '')
	.map((l) => JSON.parse(l) as { deck: string; giftId: string; bucket: number })
	.map((r) => ({ deck: r.deck, giftId: r.giftId, bucket: r.bucket as Bucket }));

if (rows.length === 0) {
	console.error(`표본이 비었다 — ${SAMPLE}`);
	console.error('npm run rank:page 로 페이지를 만들어 판정한 뒤 내보낸 것을 넣어라.');
	process.exit(1);
}

const supplyOf = new Map<string, DeckSupply>(decks.map((d) => [d.id, {
	axis: new Map(d.supply.axis), attackType: new Map(d.supply.attackType),
}]));
const cardOf = new Map<string, GiftCard>();
for (const d of decks) for (const c of d.cards) cardOf.set(`${d.id}\t${c.giftId}`, c);

const fireable = (deck: string, giftId: string): boolean =>
	cardOf.get(`${deck}\t${giftId}`)?.fireable ?? false;
const value = (deck: string, giftId: string, w: Weights): number => {
	const c = cardOf.get(`${deck}\t${giftId}`);
	const s = supplyOf.get(deck);
	if (c === undefined || s === undefined) return 0;
	return valueOf(c, s, w);
};

const allPairs = pairsOf(rows, fireable);
const deckIds = [...new Set(rows.map((r) => r.deck))].sort();

console.log(`표본 ${rows.length}판정 · 덱 ${deckIds.join(' ')} · 순서 제약 ${allPairs.length}짝\n`);

const pct = (h: number, t: number): string =>
	t === 0 ? '  —  ' : `${((h / t) * 100).toFixed(1).padStart(5)}%`;

console.log('덱 하나를 빼고 맞춘 뒤, 뺀 덱으로 확인한다');
console.log('  확인 덱   맞춘 쪽            확인 쪽            저울추 (적합·등급·전용)');
for (const held of deckIds) {
	const train = allPairs.filter((p) => p.deck !== held);
	const test = allPairs.filter((p) => p.deck === held);
	const r = searchWeights(train, value);
	const t = agreementOf(test, (d, g) => value(d, g, r.best));
	console.log(`  ${held}         ${pct(r.hit, r.total)} (${r.hit}/${r.total})`
		+ `      ${pct(t.hit, t.total)} (${t.hit}/${t.total})`
		+ `      ${r.best.fit} · ${r.best.tier} · ${r.best.exclusive}`);
}

const all = searchWeights(allPairs, value);
console.log(`\n전부로 맞춘 저울추   적합 ${all.best.fit} · 등급 ${all.best.tier} · 전용 ${all.best.exclusive}`);
console.log(`정확도               ${pct(all.hit, all.total)} (${all.hit}/${all.total})`);

/** 어느 갈래를 못 맞히나 — 모양이 틀렸는지 여기서 보인다 */
const missed = allPairs.filter((p) =>
	value(p.deck, p.hi, all.best) <= value(p.deck, p.lo, all.best));
if (missed.length > 0) {
	console.log(`\n못 맞힌 짝 ${missed.length} (앞 12개)`);
	for (const p of missed.slice(0, 12)) {
		const hi = cardOf.get(`${p.deck}\t${p.hi}`);
		const lo = cardOf.get(`${p.deck}\t${p.lo}`);
		console.log(`  ${p.deck}  ${hi?.name ?? p.hi} > ${lo?.name ?? p.lo}`
			+ `   (${hi?.tier ?? 'EX'}등급 ${hi?.keywordId ?? '-'} vs ${lo?.tier ?? 'EX'}등급 ${lo?.keywordId ?? '-'})`);
	}
}
```

- [ ] **Step 3: `package.json` 에 명령을 더한다**

```json
    "rank:fit": "tsx scripts/fit-weights.ts",
```

- [ ] **Step 4: 표본이 비었을 때 제대로 멈추는지 본다**

Run: `npm run rank:fit`
Expected: `표본이 비었다 — src/v2/authored/gift-rank.jsonl` 를 내고 exit 1.

- [ ] **Step 5: 손으로 만든 작은 표본으로 돌려 본다**

표본이 오기 전에 도구가 도는지 확인한다. 임시 파일에 여섯 줄을 넣고 돌린다.

```bash
npm run rank:deck
node -e '
const fs=require("fs");
const {decks}=JSON.parse(fs.readFileSync("/tmp/rank-candidates.json","utf8"));
const out=[];
for (const d of decks) {
  const live=d.cards.filter(c=>c.fireable);
  // 등급이 높으면 위, 낮으면 아래 — 답을 아는 표본이다
  const sorted=[...live].sort((a,b)=>(b.tier??5)-(a.tier??5));
  sorted.slice(0,3).forEach(c=>out.push({deck:d.id,giftId:c.giftId,bucket:3}));
  sorted.slice(-3).forEach(c=>out.push({deck:d.id,giftId:c.giftId,bucket:0}));
}
fs.writeFileSync("/tmp/fake-rank.jsonl", out.map(o=>JSON.stringify(o)).join("\n"));
console.log("가짜 표본", out.length, "줄");
'
npm run rank:fit -- --sample /tmp/fake-rank.jsonl
```

Expected: 정확도가 **90% 넘게** 나오고 `등급` 저울추가 0 보다 크다. 등급만으로 갈리는 표본이므로 도구가 옳으면 거의 다 맞혀야 한다. 90% 미만이면 도구가 틀린 것이므로 고친다.

- [ ] **Step 6: 커밋**

```bash
git add scripts/fit-weights.ts src/v2/authored/gift-rank.jsonl package.json
git commit -m "feat(rank): 표본으로 저울추를 찾고 정확도를 보고한다

덱 하나를 빼고 맞춘 뒤 뺀 덱으로 확인한다. 세 갈래를 모두 돌려 셋 다 보고한다 —
확인 없이 「맞췄다」고 하면 그것은 증명이 아니다.

확인 덱의 정확도가 맞춘 덱보다 크게 낮으면 모양이 틀린 것이다. 저울추를 더
늘리지 말고 그 사실을 적는다.

못 맞힌 짝을 이름과 함께 낸다 — 어느 갈래에서 모양이 어긋나는지 거기서 보인다.

가짜 표본(등급만으로 갈리는 것)으로 도구가 도는지 먼저 확인했다. 답을 아는
표본에서 답을 못 찾으면 진짜 표본에서도 못 찾는다."
```

---

### Task 8: 표본을 받아 결과를 적는다

**Files:**
- Modify: `src/v2/authored/gift-rank.jsonl`
- Create: `docs/superpowers/specs/2026-08-17-gift-score-결과.md`

**Interfaces:**
- Consumes: Task 7 의 `npm run rank:fit`

> **이 태스크는 사람이 판정한 뒤에만 할 수 있다.** 앞 태스크가 끝나면 페이지를
> 사용자에게 내고 멈춘다.

- [ ] **Step 1: 페이지를 만들어 사용자에게 낸다**

```bash
npm run rank:deck
npm run rank:page -- --in /tmp/rank-candidates.json --out /tmp/rank.html
```

`/tmp/rank.html` 을 사용자에게 보낸다. **판정이 올 때까지 다음 단계로 가지 않는다.**

- [ ] **Step 2: 받은 JSONL 을 표본 파일에 넣는다**

사용자가 내보낸 줄을 `src/v2/authored/gift-rank.jsonl` 에 그대로 쓴다. 줄 수를 센다.

```bash
wc -l src/v2/authored/gift-rank.jsonl
```

Expected: 판정한 수와 같다.

- [ ] **Step 3: 저울추를 찾는다**

Run: `npm run rank:fit`

- [ ] **Step 4: 결과 문서를 쓴다**

`docs/superpowers/specs/2026-08-17-gift-score-결과.md` 에 적는다. **다음 넷을 반드시 담는다.**

```
저울추          적합 · 등급 · 전용 세 값
정확도          전부로 맞춘 값 · 덱을 하나씩 뺀 세 갈래
못 맞힌 짝       무엇이 어긋났나. 이름과 등급·키워드를 함께
판단            PR-B 를 열지 말지. 확인 덱이 크게 낮으면 「모양이 틀렸다」고 적는다
```

**「대체로 잘 맞았다」로 적지 않는다.** 수치를 적고, 확인 덱이 낮으면 낮다고
적는다.

- [ ] **Step 5: 커밋**

```bash
git add src/v2/authored/gift-rank.jsonl docs/superpowers/specs/2026-08-17-gift-score-결과.md
git commit -m "feat(rank): 순위 표본과 저울추 결과

사람이 매긴 판정과 그것을 재현하는 저울추. 이 저장소가 처음 갖는 「좋은
추천」의 기준이다.

수치는 결과 문서에 있다. 확인 덱 정확도를 함께 적었다 — 그것이 PR-B 를
열지 정하는 근거다."
```

---

## Self-Review

**1. 사양 覆蓋**

| 사양 | 태스크 |
|---|---|
| §2.2 적합도는 부여만 · 요구는 L | Task 1 (`fitOfKeyword` 가 조건을 안 본다) |
| §2.3 어휘 = 축 + 공격 타입 | Task 1 (`AXES` · `ATTACK_TYPES`) |
| §2.4 곱이 아니라 합 | Task 3 (`valueOf`) |
| §3.1 4단 바구니 | Task 2 · Task 6 |
| §3.2 덱 셋 (A·B·C) | Task 5 |
| §3.3 20개 고르기 · 겹침 6 · 죽는 것 포함 | Task 4 · Task 5 (`SHARED`) |
| §3.4 페이지 · 내보내기 형식 · 저작 파일 자리 | Task 6 · Task 7 |
| §4.1 격자 탐색 · 맞혔다의 뜻 | Task 3 |
| §4.2 두 덱으로 맞추고 남은 덱으로 확인 | Task 7 |
| §4.3 fit 셈 · exclusive 분리 | Task 1 · Task 3 |
| §4.4 tier 정규화 | Task 1 (`tierOf`) |
| §6 표본 전에도 검사가 돈다 | Task 1~4 전부 DB 없이 · Task 7 Step 5 |
| §8 3번에서 멈춘다 | Task 8 Step 1 |

**빠진 것 없음.**

**2. 자리 표시 검사** — 「TBD」·「적절히」 없음. 모든 코드 단계에 실제 코드가 있다.

**3. 타입 일관성**

- `Bucket` · `DeckSupply` · `GiftCard` · `RankRow` · `DeckSpec`(Task 1) → Task 2·3·4·5·7 에서 같은 이름으로 쓴다.
- `fitOfKeyword(keywordId, supply)` · `tierOf(tier)`(Task 1) → Task 3 `valueOf` 가 그 순서로 부른다.
- `Pair { deck, hi, lo }`(Task 2) → Task 3 `agreementOf` · Task 7 이 그대로 쓴다.
- `Weights { fit, tier, exclusive }`(Task 3) → Task 7 이 그대로 쓴다.
- `pickTwenty(pool, supply, shared)`(Task 4) → Task 5 가 그 순서로 부른다.
- `searchWeights(pairs, value, scale?)`(Task 3) → Task 7 이 두 인자로 부른다. 셋째는 기본값.

**한 가지 고침** — Task 5 가 `lib/engine/v2/load.ts` 와 `evaluate.ts` 를 **읽는다.**
「엔진을 한 줄도 안 고친다」는 제약은 **고치지 않는다**는 뜻이지 **읽지 않는다**가
아니다. `fireable` 을 다시 구현하면 엔진과 어긋날 수 있으므로 읽는 쪽이 옳다.
글로벌 제약에 이 뜻을 분명히 적었는지 확인했다 — 「한 줄도 고치지 않는다」로
쓰여 있어 맞다.

---

## 이 계획이 안 하는 것

- **`lib/engine/v2` 를 안 고친다.** 실서비스 추천은 이 PR 동안 지금 그대로 돈다.
- **손보정 표를 안 만든다.** 3등급 136건 안의 차이는 표본이 근거를 준 뒤에.
- **죄악 어휘를 안 넣는다.** 「그 기프트가 그 죄악을 키운다」는 보장이 약하다.
- **골든 테스트를 안 박는다.** 저울추가 정해지기 전엔 박을 수치가 없다 — PR-B 다.
