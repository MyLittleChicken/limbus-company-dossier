# 기프트 능력 모형 2단계(엔진) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 엔진이 `canonical.gift_ability` · `gift_ability_cond` 를 읽고 절 단위로 판정하게 한다 — 1단계가 만든 데이터를 실제로 쓰는 단계다.

**Architecture:** `load.ts` 가 두 표를 더 읽고, `evaluate.ts` 가 절 규칙(ordinal 간 OR · group 간 AND · group 내 OR)으로 판정한다. **`GiftVerdict` 모양은 그대로 둔다** — `score.ts` 가 `total` · `satisfied` · `reasons[{verdict, certainty}]` · `fireable` 만 보므로 점수 코드를 안 건드리고 판정만 갈아끼울 수 있다. 폐기 5표는 판정에서 끊고 `chain.ts` 가 쓰는 만큼만 남긴다.

**Tech Stack:** TypeScript · Prisma(PostgreSQL) · node:test · tsx

## Global Constraints

- **`scripts/simulate-ability.ts` 가 이 단계의 명세다.** 옮긴 뒤 163덱 판정이 그 파일과 **정확히 같아야** 한다. 다르면 둘 중 하나가 틀린 것이고, 어느 쪽인지 먼저 정한다.
- **`GiftVerdict` 의 칸을 지운다거나 뜻을 바꾸지 않는다.** `score.ts` · `lib/queries` · 화면이 그 모양에 매여 있다.
- **판정 규칙** — `refines=null` 인 능력 중 하나라도 서면 켜진다(OR). 능력이 서려면 `unconditional` 이거나 **모든 group** 이 서야 한다(AND). group 은 **조건 중 하나라도** 서면 선다(OR).
- **「모른다」를 「아니다」로 쓰지 않는다.** `runtime=true` · `threshold=null`(op≠has) · 조건 0개 · 능력 0개는 전부 **배제하지 않는다**.
- **분모** — `field`(출격 7) · `roster`(편성 12) · `waiting`(대기 5) · `slot`(1~7).
- **공급을 세는 표** — `axis`+`supply=tag` → `identity_axis`, `axis`+`supply=skill` → `coin_token`, `association` → `identity_association`, `unit_keyword` → `identity_unit_keyword`, `sin`·`resonance` → `skill.sin`, `attack_type` → `skill.attack_type`, `skill_kind` → `skill.kind`, `coin=minus` → `skill_stage.coin_value < 0`.
- **기존 표를 지우지 않는다.** 적재는 계속하고 엔진만 안 읽는다. `lib/engine/v2/deprecated-tables.test.ts` 의 허용 목록을 **줄이는 것이 진척**이다.
- **모든 주석과 커밋 메시지는 한국어.** 무엇을 하는지가 아니라 왜 그런지를 적는다.

---

## File Structure

```
lib/engine/v2/types.ts          Ability · AbilityCond 타입 추가. GiftVerdict 는 그대로
lib/engine/v2/supply.ts         새 파일 — refKind 마다 공급을 세는 자리
lib/engine/v2/supply.test.ts
lib/engine/v2/ability.ts        새 파일 — 절 규칙 판정. 순수 함수라 DB 없이 돈다
lib/engine/v2/ability.test.ts
lib/engine/v2/load.ts           gift_ability · gift_ability_cond 를 읽는다
lib/engine/v2/evaluate.ts       판정을 절 규칙으로 갈아끼운다
lib/engine/v2/gate-golden.test.ts   기존 골든 — 새 판정에서도 통과해야 한다
lib/engine/v2/ability-golden.test.ts  새 파일 — 덱 C·D·E
lib/engine/v2/deprecated-tables.test.ts  허용 목록을 줄인다
scripts/verdict-diff.ts         새 파일 — 옛 판정 vs 새 판정. simulate 와 대조한다
```

`supply.ts` 를 `profile.ts` 와 따로 두는 이유 — `Profile` 은 `identity_axis` 만 세고 `affects` 게이트를 다룬다. 절 조건은 여덟 갈래를 세야 하고 세는 표가 갈래마다 다르다. 한 파일에 밀어 넣으면 `Profile` 의 책임이 흐려진다.

---

### Task 1: 공급을 세는 자리

**Files:**
- Create: `lib/engine/v2/supply.ts`
- Test: `lib/engine/v2/supply.test.ts`

**Interfaces:**
- Produces: `SupplyTables` 인터페이스, `countSupply(tables, squad, cond): number`
  - `cond` 는 `{ refKind, refId, scope, supply, slot }` 만 본다
  - **못 세면 `-1`** 을 낸다 — 0 과 갈라야 한다. 0 은 「없다」이고 -1 은 「셀 방법이 없다」다

- [ ] **Step 1: 테스트를 쓴다**

`lib/engine/v2/supply.test.ts`

```typescript
/**
 * 공급 세기 — **DB 없이 돈다.** 표를 주입받는 순수 함수다.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { countSupply, type SupplyTables } from './supply.js';
import type { Squad } from './types.js';

/** 편성 12 · 출격 7. A~L 열두 명 */
const IDS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'];
const SQUAD: Squad = {
	roster: IDS.map((identityId) => ({ identityId, egoIds: [] })),
	field: IDS.slice(0, 7),
};

const T: SupplyTables = {
	axisTag: new Map([['COMBUSTION', new Set(['A', 'B', 'H'])]]),
	axisSkill: new Map([['COMBUSTION', new Set(['A', 'I'])]]),
	association: new Map([['DAWN', new Set(['A', 'B', 'C', 'J'])]]),
	unitKeyword: new Map([['BLOODFIEND', new Set(['K'])]]),
	sin: new Map([['wrath', new Set(['A', 'B', 'C', 'D'])]]),
	attackType: new Map([['slash', new Set(['E'])]]),
	skillKind: new Map([['counter', new Set(['F'])]]),
	minusCoin: new Set(['G', 'L']),
};

const cond = (o: Partial<Parameters<typeof countSupply>[2]> = {}) => ({
	refKind: 'axis', refId: 'COMBUSTION', scope: 'field', supply: 'tag', slot: null, ...o,
}) as Parameters<typeof countSupply>[2];

test('scope=field 는 출격 7인만 센다', () => {
	// A · B 는 출격, H 는 대기라 안 센다
	assert.equal(countSupply(T, SQUAD, cond()), 2);
});

test('scope=roster 는 편성 12인을 센다', () => {
	assert.equal(countSupply(T, SQUAD, cond({ scope: 'roster' })), 3);
});

test('scope=waiting 은 편성에서 출격을 뺀 자리만 센다', () => {
	assert.equal(countSupply(T, SQUAD, cond({ scope: 'waiting' })), 1);
});

test('supply=skill 은 태그가 아니라 스킬 표를 본다', () => {
	// 태그는 A·B·H 인데 스킬은 A·I 다. 출격에 든 것은 A 하나
	assert.equal(countSupply(T, SQUAD, cond({ supply: 'skill' })), 1);
});

test('supply=any 는 둘 중 큰 쪽이다', () => {
	assert.equal(countSupply(T, SQUAD, cond({ supply: 'any' })), 2);
});

test('소속을 센다', () => {
	assert.equal(countSupply(T, SQUAD, cond({ refKind: 'association', refId: 'DAWN' })), 3);
});

test('유닛 키워드를 센다 — 편성에만 있으면 출격에선 0 이다', () => {
	assert.equal(countSupply(T, SQUAD, cond({ refKind: 'unit_keyword', refId: 'BLOODFIEND' })), 0);
	assert.equal(countSupply(T, SQUAD, cond({ refKind: 'unit_keyword', refId: 'BLOODFIEND', scope: 'roster' })), 1);
});

test('공명은 죄악과 같은 표를 본다 — 묻는 것만 다르다', () => {
	assert.equal(countSupply(T, SQUAD, cond({ refKind: 'resonance', refId: 'wrath' })), 4);
	assert.equal(countSupply(T, SQUAD, cond({ refKind: 'sin', refId: 'wrath' })), 4);
});

test('공격 타입 · 스킬 종류 · 빼기 코인', () => {
	assert.equal(countSupply(T, SQUAD, cond({ refKind: 'attack_type', refId: 'slash' })), 1);
	assert.equal(countSupply(T, SQUAD, cond({ refKind: 'skill_kind', refId: 'counter' })), 1);
	assert.equal(countSupply(T, SQUAD, cond({ refKind: 'coin', refId: 'minus' })), 1);
});

test('자리는 출격 인원이 그 번호까지 찼는가다', () => {
	// 출격 7인이므로 7번까지 있다
	assert.equal(countSupply(T, SQUAD, cond({ refKind: 'deployment', refId: 'slot7', scope: 'slot', slot: 7 })), 1);
	const five: Squad = { ...SQUAD, field: IDS.slice(0, 5) };
	assert.equal(countSupply(T, five, cond({ refKind: 'deployment', refId: 'slot7', scope: 'slot', slot: 7 })), 0);
	assert.equal(countSupply(T, five, cond({ refKind: 'deployment', refId: 'slot5', scope: 'slot', slot: 5 })), 1);
});

test('셀 방법이 없으면 -1 이다 — 0 과 갈라야 한다', () => {
	// 0 은 「없다」라 배제 근거가 되고, -1 은 「모른다」라 배제하면 안 된다
	assert.equal(countSupply(T, SQUAD, cond({ refKind: 'other', refId: '지령 대상이 사망했으면' })), -1);
	assert.equal(countSupply(T, SQUAD, cond({ refKind: 'enemy_state', refId: 'X' })), -1);
	assert.equal(countSupply(T, SQUAD, cond({ refId: 'NOT_AN_AXIS' })), -1);
});
```

- [ ] **Step 2: 테스트를 돌려 실패를 확인한다**

Run: `npx tsx --test lib/engine/v2/supply.test.ts`
Expected: FAIL — `Cannot find module './supply.js'`

- [ ] **Step 3: `lib/engine/v2/supply.ts` 를 쓴다**

```typescript
/**
 * 절 조건의 **공급**을 센다 — 「이 편성에 그것이 몇이나 있나」.
 *
 * **`Profile` 과 따로 둔다.** 그쪽은 `identity_axis` 만 세고 `affects` 게이트를
 * 다룬다. 절 조건은 여덟 갈래를 세야 하고 갈래마다 보는 표가 다르다 — 한
 * 파일에 밀어 넣으면 `Profile` 의 책임이 흐려진다.
 *
 * **DB 를 모른다.** 표를 주입받는 순수 함수라 검사가 DB 없이 돈다.
 */
import type { Squad } from './types.js';

/** refKind 마다 세는 자리가 다르다. 값은 「그것을 가진 인격 id」 집합이다 */
export interface SupplyTables {
	/** 게임이 그 인격을 그 축으로 분류하는가 — identity_axis */
	axisTag: Map<string, Set<string>>;
	/** 스킬이 실제로 그 상태를 주는가 — coin_token */
	axisSkill: Map<string, Set<string>>;
	association: Map<string, Set<string>>;
	/** identity_unit_keyword 다. identity_keyword 가 아니다 — 후자는 축 7종뿐이다 */
	unitKeyword: Map<string, Set<string>>;
	/** sin 과 resonance 가 같이 쓴다. 묻는 것만 다르다 */
	sin: Map<string, Set<string>>;
	attackType: Map<string, Set<string>>;
	skillKind: Map<string, Set<string>>;
	/** 코인 위력이 음수인 스킬을 가진 인격 — skill_stage.coin_value < 0 */
	minusCoin: Set<string>;
}

export interface SupplyCond {
	refKind: string;
	refId: string;
	scope: string;
	supply: string;
	slot: number | null;
}

/** 이 조건이 보는 모집단 */
function poolOf(squad: Squad, scope: string): string[] {
	const roster = squad.roster.map((r) => r.identityId);
	if (scope === 'roster') return roster;
	if (scope === 'waiting') return roster.filter((id) => !squad.field.includes(id));
	return squad.field;
}

/**
 * 몇이 공급하나.
 *
 * **못 세면 `-1` 이다.** 0 과 갈라야 한다 — 0 은 「없다」라 배제 근거가 되고
 * -1 은 「셀 방법이 없다」라 배제하면 안 된다. 둘을 뭉치면 어휘 밖 조건
 * 하나가 기프트를 통째로 죽인다.
 */
export function countSupply(t: SupplyTables, squad: Squad, c: SupplyCond): number {
	if (c.refKind === 'deployment') {
		const n = c.slot ?? Number((/[0-9]+/.exec(c.refId) ?? ['0'])[0]);
		if (n < 1) return -1;
		return squad.field.length >= n ? 1 : 0;
	}

	const pool = poolOf(squad, c.scope);
	const count = (m: Set<string> | undefined): number =>
		m === undefined ? -1 : pool.filter((id) => m.has(id)).length;

	if (c.refKind === 'axis') {
		if (c.supply === 'skill') return count(t.axisSkill.get(c.refId));
		if (c.supply === 'any') {
			const tag = count(t.axisTag.get(c.refId));
			const skill = count(t.axisSkill.get(c.refId));
			return tag < 0 && skill < 0 ? -1 : Math.max(tag, skill);
		}
		return count(t.axisTag.get(c.refId));
	}
	if (c.refKind === 'association') return count(t.association.get(c.refId));
	if (c.refKind === 'unit_keyword') return count(t.unitKeyword.get(c.refId));
	if (c.refKind === 'sin' || c.refKind === 'resonance') return count(t.sin.get(c.refId));
	if (c.refKind === 'attack_type') return count(t.attackType.get(c.refId));
	if (c.refKind === 'skill_kind') return count(t.skillKind.get(c.refId));
	if (c.refKind === 'coin') return c.refId === 'minus' ? count(t.minusCoin) : -1;
	// other · enemy_state 그리고 어휘 밖 — 셀 방법이 없다
	return -1;
}
```

- [ ] **Step 4: 테스트가 통과하는지 본다**

Run: `npx tsx --test lib/engine/v2/supply.test.ts`
Expected: PASS 11건

- [ ] **Step 5: 커밋**

```bash
git add lib/engine/v2/supply.ts lib/engine/v2/supply.test.ts
git commit -m "feat(engine): 절 조건의 공급을 세는 자리

refKind 마다 보는 표가 다르다 — axis 는 supply 에 따라 identity_axis 와
coin_token 이 갈리고, unit_keyword 는 identity_unit_keyword 다
(identity_keyword 가 아니다. 후자는 축 7종뿐이라 BLOODFIEND 가 없다).

못 세면 -1 이다. 0 과 갈라야 한다 — 0 은 「없다」라 배제 근거가 되고 -1 은
「셀 방법이 없다」라 배제하면 안 된다. 뭉치면 어휘 밖 조건 하나가 기프트를
통째로 죽인다.

Profile 과 따로 둔다. 그쪽은 identity_axis 만 세고 affects 게이트를 다뤄
책임이 다르다."
```

---

### Task 2: 절 규칙 판정

**Files:**
- Create: `lib/engine/v2/ability.ts`
- Test: `lib/engine/v2/ability.test.ts`

**Interfaces:**
- Consumes: Task 1 의 `SupplyTables` · `countSupply`
- Produces:
  - `Ability` = `{ giftId, level, ordinal, unconditional, refines }`
  - `AbilityCond` = `{ giftId, level, ordinal, group, idx, refKind, refId, op, threshold, scope, supply, slot, runtime, resonanceMode }`
  - `judgeCond(t, squad, c): { verdict: 'satisfied'|'unsatisfied'|'unknown'; have: number; need: number|null }`
  - `judgeGift(input): { fireable: boolean; reasons: Reason[] }` — `input` 은 `{ tables, squad, abilities, condsByAbility }`

- [ ] **Step 1: 테스트를 쓴다**

`lib/engine/v2/ability.test.ts`

```typescript
/**
 * 절 규칙 — **DB 없이 돈다.**
 *
 * ordinal 간 OR · group 간 AND · group 내 OR. 「모른다」는 배제하지 않는다.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { judgeGift, type Ability, type AbilityCond } from './ability.js';
import type { SupplyTables } from './supply.js';
import type { Squad } from './types.js';

const IDS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'];
const SQUAD: Squad = {
	roster: IDS.map((identityId) => ({ identityId, egoIds: [] })),
	field: IDS.slice(0, 7),
};
const T: SupplyTables = {
	axisTag: new Map([['COMBUSTION', new Set(['A', 'B'])]]),
	axisSkill: new Map([['COMBUSTION', new Set(['A'])]]),
	association: new Map([['DAWN', new Set(['A', 'B', 'C'])], ['SHI', new Set<string>()]]),
	unitKeyword: new Map(),
	sin: new Map([['wrath', new Set(['A', 'B', 'C', 'D'])]]),
	attackType: new Map(),
	skillKind: new Map(),
	minusCoin: new Set(),
};

const ab = (o: Partial<Ability> = {}): Ability =>
	({ giftId: 'G', level: 0, ordinal: 0, unconditional: false, refines: null, ...o });
const cd = (o: Partial<AbilityCond> = {}): AbilityCond =>
	({
		giftId: 'G', level: 0, ordinal: 0, group: 0, idx: 0,
		refKind: 'association', refId: 'DAWN', op: 'has', threshold: null,
		scope: 'field', supply: 'tag', slot: null, runtime: false, resonanceMode: null, ...o,
	});
const run = (abilities: Ability[], conds: AbilityCond[]) => {
	const byAb = new Map<string, AbilityCond[]>();
	for (const c of conds) {
		const k = `${c.ordinal}`;
		byAb.set(k, [...(byAb.get(k) ?? []), c]);
	}
	return judgeGift({ tables: T, squad: SQUAD, abilities, condsByAbility: byAb });
};

test('무조건 절은 언제나 켜진다', () => {
	assert.equal(run([ab({ unconditional: true })], []).fireable, true);
});

test('조건이 서면 켜진다', () => {
	assert.equal(run([ab()], [cd()]).fireable, true);
});

test('조건이 안 서면 죽는다', () => {
	assert.equal(run([ab()], [cd({ refId: 'SHI' })]).fireable, false);
});

test('독립 절이 여럿이면 하나만 서도 켜진다 — OR', () => {
	const abilities = [ab({ ordinal: 0 }), ab({ ordinal: 1 })];
	const conds = [cd({ ordinal: 0, refId: 'SHI' }), cd({ ordinal: 1, refId: 'DAWN' })];
	assert.equal(run(abilities, conds).fireable, true);
});

test('독립 절이 전부 안 서면 죽는다', () => {
	const abilities = [ab({ ordinal: 0 }), ab({ ordinal: 1 })];
	const conds = [cd({ ordinal: 0, refId: 'SHI' }), cd({ ordinal: 1, refId: 'SHI' })];
	assert.equal(run(abilities, conds).fireable, false);
});

test('같은 group 안은 OR — 하나만 서면 된다', () => {
	const conds = [
		cd({ group: 0, idx: 0, refId: 'SHI' }),
		cd({ group: 0, idx: 1, refId: 'DAWN' }),
	];
	assert.equal(run([ab()], conds).fireable, true);
});

test('group 끼리는 AND — 하나라도 안 서면 죽는다', () => {
	const conds = [
		cd({ group: 0, idx: 0, refId: 'DAWN' }),
		cd({ group: 1, idx: 0, refId: 'SHI' }),
	];
	assert.equal(run([ab()], conds).fireable, false);
});

test('강화판은 켜짐 판정에 참여하지 않는다', () => {
	// ordinal 1 은 ordinal 0 의 강화판이다. 0 이 죽으면 1 도 같이 죽는다 —
	// 1 이 혼자 서서 기프트를 살리면 안 된다
	const abilities = [ab({ ordinal: 0 }), ab({ ordinal: 1, refines: 0 })];
	const conds = [cd({ ordinal: 0, refId: 'SHI' }), cd({ ordinal: 1, refId: 'DAWN' })];
	assert.equal(run(abilities, conds).fireable, false);
});

test('runtime 은 배제 근거가 아니다', () => {
	assert.equal(run([ab()], [cd({ refId: 'SHI', runtime: true })]).fireable, true);
});

test('op≠has 인데 threshold 가 null 이면 배제하지 않는다 — 모른다', () => {
	assert.equal(run([ab()], [cd({ refId: 'SHI', op: 'gte', threshold: null })]).fireable, true);
});

test('op=has 는 한 명이라도 있으면 선다', () => {
	assert.equal(run([ab()], [cd({ refKind: 'axis', refId: 'COMBUSTION' })]).fireable, true);
});

test('gte 는 문턱을 센다', () => {
	assert.equal(run([ab()], [cd({ op: 'gte', threshold: 3 })]).fireable, true);
	assert.equal(run([ab()], [cd({ op: 'gte', threshold: 4 })]).fireable, false);
});

test('셀 방법이 없는 조건은 배제하지 않는다', () => {
	assert.equal(run([ab()], [cd({ refKind: 'other', refId: '알 수 없는 조건' })]).fireable, true);
});

test('조건이 하나도 없는 절은 배제하지 않는다 — 결손이다', () => {
	// unconditional=false 인데 조건이 없다 = 「조건이 있는 줄은 아는데 못 뽑았다」
	assert.equal(run([ab()], []).fireable, true);
});

test('능력이 하나도 없으면 판정 보류다 — 죽이지 않는다', () => {
	assert.equal(run([], []).fireable, true);
});

test('근거를 조건마다 낸다 — 화면이 왜 그런지 보여야 한다', () => {
	const r = run([ab()], [cd({ op: 'gte', threshold: 3 }), cd({ group: 1, refId: 'SHI' })]);
	assert.equal(r.reasons.length, 2);
	assert.equal(r.reasons[0].verdict, 'satisfied');
	assert.equal(r.reasons[0].have, 3);
	assert.equal(r.reasons[0].need, 3);
	assert.equal(r.reasons[1].verdict, 'unsatisfied');
});

test('runtime 근거는 unknown 이다 — 충족으로 세면 점수가 부푼다', () => {
	const r = run([ab()], [cd({ refId: 'SHI', runtime: true })]);
	assert.equal(r.reasons[0].verdict, 'unknown');
});
```

- [ ] **Step 2: 테스트를 돌려 실패를 확인한다**

Run: `npx tsx --test lib/engine/v2/ability.test.ts`
Expected: FAIL — `Cannot find module './ability.js'`

- [ ] **Step 3: `lib/engine/v2/ability.ts` 를 쓴다**

```typescript
/**
 * 절 규칙 판정 — 사양 §3 「판정 규칙 — 코드에 산다」.
 *
 * ```
 * 기프트가 켜질 수 있다
 *   = refines=null 인 능력 중 하나라도 켜질 수 있다        ordinal 간 OR
 *       능력이 켜질 수 있다
 *         = unconditional 이거나 모든 group 이 충족 가능     group 간 AND
 *             group 이 충족 가능
 *               = 조건 중 하나라도 충족 가능                 group 내 OR
 * ```
 *
 * **「모른다」를 「아니다」로 쓰지 않는다.** runtime · threshold 없음 · 조건 0개 ·
 * 능력 0개는 전부 배제하지 않는다. 옛 엔진이 반대로 해서 「발동 불가」 173건 중
 * 158건(91%)이 틀렸다.
 *
 * **DB 를 모른다.** 표를 주입받는 순수 함수다.
 */
import { countSupply, type SupplyTables } from './supply.js';
import type { Reason, Squad } from './types.js';

/** `canonical.gift_ability` 한 행 */
export interface Ability {
	giftId: string;
	level: number;
	ordinal: number;
	unconditional: boolean;
	/** 다른 능력의 강화판이면 그 ordinal. 독립이면 null */
	refines: number | null;
}

/** `canonical.gift_ability_cond` 한 행 */
export interface AbilityCond {
	giftId: string;
	level: number;
	ordinal: number;
	group: number;
	idx: number;
	refKind: string;
	refId: string;
	op: string;
	threshold: number | null;
	scope: string;
	supply: string;
	slot: number | null;
	runtime: boolean;
	resonanceMode: string | null;
}

export interface JudgeInput {
	tables: SupplyTables;
	squad: Squad;
	/** 한 기프트의 능력 전부 (한 강화 단계) */
	abilities: Ability[];
	/** ordinal(문자열) → 그 능력의 조건들 */
	condsByAbility: Map<string, AbilityCond[]>;
}

export interface CondVerdict {
	verdict: 'satisfied' | 'unsatisfied' | 'unknown';
	have: number;
	need: number | null;
}

/**
 * 조건 하나를 본다.
 *
 * `unknown` 은 **배제하지 않는다**는 뜻이다 — 전투 중에만 아는 것(`runtime`),
 * 문턱을 못 찾은 것(`op≠has` 인데 `threshold=null`), 셀 방법이 없는 것(`-1`).
 */
export function judgeCond(t: SupplyTables, squad: Squad, c: AbilityCond): CondVerdict {
	if (c.runtime) return { verdict: 'unknown', have: 0, need: c.threshold };
	const have = countSupply(t, squad, c);
	if (have < 0) return { verdict: 'unknown', have: 0, need: c.threshold };
	if (c.op === 'has') {
		return { verdict: have >= 1 ? 'satisfied' : 'unsatisfied', have, need: 1 };
	}
	if (c.threshold === null) return { verdict: 'unknown', have, need: null };
	if (c.op === 'eq') {
		return { verdict: have === c.threshold ? 'satisfied' : 'unsatisfied', have, need: c.threshold };
	}
	return { verdict: have >= c.threshold ? 'satisfied' : 'unsatisfied', have, need: c.threshold };
}

/** 이 능력이 이 편성에서 설 수 있나 */
function abilityFires(t: SupplyTables, squad: Squad, cs: AbilityCond[], unconditional: boolean): boolean {
	if (unconditional) return true;
	// 조건이 하나도 없다 = 「조건이 있는 줄은 아는데 못 뽑았다」. 결손이므로 안 막는다
	if (cs.length === 0) return true;
	const groups = new Map<number, AbilityCond[]>();
	for (const c of cs) groups.set(c.group, [...(groups.get(c.group) ?? []), c]);
	// group 끼리 AND · group 안은 OR
	return [...groups.values()].every((g) =>
		g.some((c) => judgeCond(t, squad, c).verdict !== 'unsatisfied'));
}

export function judgeGift(input: JudgeInput): { fireable: boolean; reasons: Reason[] } {
	const { tables, squad, abilities, condsByAbility } = input;

	const reasons: Reason[] = [];
	for (const a of abilities) {
		for (const c of condsByAbility.get(String(a.ordinal)) ?? []) {
			const j = judgeCond(tables, squad, c);
			reasons.push({
				// 절 모형에는 트리거가 없다. 어느 절의 몇 번째 조건인지를 담는다 —
				// 화면이 「왜 그런가」를 보이려면 자리를 알아야 한다
				triggerId: `${a.ordinal}/${c.group}/${c.idx}`,
				refKind: c.refKind, refId: c.refId,
				verdict: j.verdict,
				/**
				 * **충족은 언제나 확정이다.** 옛 모형의 `roster_gated` 는 트리거
				 * 이름 접미사로 지어낸 것이라 「가능」을 남발했다. 절 조건은
				 * 문장에서 뽑은 것이라 그런 어림이 없다 — 전투 중에만 아는 것은
				 * `runtime` 으로 따로 적히고 `unknown` 이 된다.
				 */
				certainty: 'certain',
				have: j.have, need: j.need,
				denominator: j.need === null ? null : c.scope,
				// 강화판의 조건은 켜짐을 못 막는다 — 원 능력에 딸린 것이다
				blocking: a.refines === null,
			});
		}
	}

	// 능력이 하나도 없으면 판정 보류다 — 아직 절을 안 뽑은 기프트를 죽이면 안 된다
	const independent = abilities.filter((a) => a.refines === null);
	if (independent.length === 0) return { fireable: true, reasons };

	const fireable = independent.some((a) =>
		abilityFires(tables, squad, condsByAbility.get(String(a.ordinal)) ?? [], a.unconditional));
	return { fireable, reasons };
}
```

- [ ] **Step 4: 테스트가 통과하는지 본다**

Run: `npx tsx --test lib/engine/v2/ability.test.ts`
Expected: PASS 17건

- [ ] **Step 5: 커밋**

```bash
git add lib/engine/v2/ability.ts lib/engine/v2/ability.test.ts
git commit -m "feat(engine): 절 규칙 판정

ordinal 간 OR · group 간 AND · group 내 OR. 사양 §3 그대로다.

「모른다」를 「아니다」로 쓰지 않는다 — runtime · 문턱 없음 · 조건 0개 ·
능력 0개는 전부 배제하지 않는다. 옛 엔진이 반대로 해서 「발동 불가」
173건 중 158건(91%)이 틀렸다.

강화판은 켜짐 판정에 참여하지 않는다. 원 능력이 죽으면 같이 죽어야 하는데
혼자 서서 기프트를 살리면 그것이 과대 판정이다.

충족은 언제나 확정이다. 옛 모형의 roster_gated 는 트리거 이름 접미사로
지어낸 것이라 「가능」을 남발했다 — 절 조건은 문장에서 뽑은 것이라 그런
어림이 없고, 전투 중에만 아는 것은 runtime 으로 따로 적혀 unknown 이 된다."
```

---

### Task 3: 엔진이 두 표를 읽는다

**Files:**
- Modify: `lib/engine/v2/types.ts` (`EngineData` 에 칸 추가)
- Modify: `lib/engine/v2/load.ts`

**Interfaces:**
- Consumes: Task 1 의 `SupplyTables`, Task 2 의 `Ability` · `AbilityCond`
- Produces: `EngineData.abilities: Map<string, Ability[]>`(giftId → 능력들, level 0), `EngineData.abilityConds: Map<string, Map<string, AbilityCond[]>>`(giftId → ordinal → 조건들), `EngineData.supply: SupplyTables`

- [ ] **Step 1: `types.ts` 에 칸을 더한다**

`EngineData` 인터페이스를 찾아 세 칸을 넣는다.

```typescript
	/**
	 * 절 단위 능력 — `canonical.gift_ability`. **level 0 만 읽는다.**
	 *
	 * 강화 단계는 조건이 달라지지만(110개 중 87개) 추천은 「이 팩에서 이 기프트를
	 * 뽑을까」를 묻지 강화 단계를 묻지 않는다. 단계별 판정은 별도 물음이다.
	 */
	abilities: Map<string, Ability[]>;
	/** giftId → ordinal(문자열) → 그 능력의 조건들 */
	abilityConds: Map<string, Map<string, AbilityCond[]>>;
	/** 절 조건의 공급을 세는 표 */
	supply: SupplyTables;
```

파일 머리에 import 를 더한다.

```typescript
import type { Ability, AbilityCond } from './ability.js';
import type { SupplyTables } from './supply.js';
```

- [ ] **Step 2: `load.ts` 가 두 표와 공급을 읽게 한다**

`loadEngineData` 의 `Promise.all` 배열 끝에 넷을 더하고, 구조 분해에 이름을 맞춰 넣는다.

```typescript
			prisma.$queryRaw<Array<{
				giftId: string; level: number; ordinal: number;
				unconditional: boolean; refines: number | null;
			}>>`
				SELECT gift_id AS "giftId", level, ordinal, unconditional, refines
				FROM canonical.gift_ability WHERE level = 0
				ORDER BY gift_id, ordinal
			`,
			prisma.$queryRaw<Array<{
				giftId: string; level: number; ordinal: number; group: number; idx: number;
				refKind: string; refId: string; op: string; threshold: number | null;
				scope: string; supply: string; slot: number | null;
				runtime: boolean; resonanceMode: string | null;
			}>>`
				SELECT gift_id AS "giftId", level, ordinal, "group", idx,
				       ref_kind AS "refKind", ref_id AS "refId", op, threshold,
				       scope, supply, slot, runtime, resonance_mode AS "resonanceMode"
				FROM canonical.gift_ability_cond WHERE level = 0
				ORDER BY gift_id, ordinal, "group", idx
			`,
			prisma.$queryRaw<Array<{ k: string; v: string; identityId: string }>>`
				-- 공급 표를 한 질의로 모은다. 갈래를 k 로 구분해 왕복을 줄인다
				SELECT 'axisTag' AS k, axis_id AS v, identity_id AS "identityId"
				  FROM canonical.identity_axis
				  WHERE gate_kind = 'always' AND affects IN ('tag','both')
				UNION ALL
				SELECT DISTINCT 'axisSkill', upper(c.token), i.identity_id
				  FROM canonical.identity_skill i JOIN canonical.coin_token c ON c.skill_id = i.skill_id
				  WHERE upper(c.token) IN ('COMBUSTION','LACERATION','BURST','BREATH','VIBRATION','SINKING','CHARGE','BULLET')
				UNION ALL
				SELECT 'association', association_id, identity_id FROM canonical.identity_association
				UNION ALL
				SELECT 'unitKeyword', keyword, identity_id FROM canonical.identity_unit_keyword
				UNION ALL
				SELECT DISTINCT 'sin', lower(s.sin::text), i.identity_id
				  FROM canonical.identity_skill i JOIN canonical.skill s ON s.id = i.skill_id
				  WHERE s.sin IS NOT NULL
				UNION ALL
				SELECT DISTINCT 'attackType', lower(s.attack_type::text), i.identity_id
				  FROM canonical.identity_skill i JOIN canonical.skill s ON s.id = i.skill_id
				  WHERE s.attack_type IS NOT NULL
				UNION ALL
				SELECT DISTINCT 'skillKind', lower(s.kind::text), i.identity_id
				  FROM canonical.identity_skill i JOIN canonical.skill s ON s.id = i.skill_id
				  WHERE s.kind IS NOT NULL
				UNION ALL
				SELECT DISTINCT 'minusCoin', 'minus', i.identity_id
				  FROM canonical.identity_skill i JOIN canonical.skill_stage s ON s.skill_id = i.skill_id
				  WHERE s.coin_value < 0
			`,
```

구조 분해에 `abilityRows`, `condRows`, `supplyRows` 를 더하고, 반환 직전에 맵을 만든다.

```typescript
	const abilities = group(abilityRows, (r) => r.giftId, (r) => r);
	const abilityConds = new Map<string, Map<string, AbilityCond[]>>();
	for (const c of condRows) {
		if (!abilityConds.has(c.giftId)) abilityConds.set(c.giftId, new Map());
		const inner = abilityConds.get(c.giftId) as Map<string, AbilityCond[]>;
		const k = String(c.ordinal);
		inner.set(k, [...(inner.get(k) ?? []), c]);
	}

	/** 갈래별로 갈라 담는다. minusCoin 만 Set 이라 따로 꺼낸다 */
	const bucket = (kind: string): Map<string, Set<string>> => {
		const m = new Map<string, Set<string>>();
		for (const r of supplyRows) {
			if (r.k !== kind) continue;
			if (!m.has(r.v)) m.set(r.v, new Set());
			m.get(r.v)?.add(r.identityId);
		}
		return m;
	};
	const supply: SupplyTables = {
		axisTag: bucket('axisTag'),
		axisSkill: bucket('axisSkill'),
		association: bucket('association'),
		unitKeyword: bucket('unitKeyword'),
		sin: bucket('sin'),
		attackType: bucket('attackType'),
		skillKind: bucket('skillKind'),
		minusCoin: bucket('minusCoin').get('minus') ?? new Set<string>(),
	};
```

반환 객체에 `abilities`, `abilityConds`, `supply` 를 더한다.

- [ ] **Step 3: 실제로 읽히는지 확인한다**

```bash
npx tsx -e "
import { PrismaClient } from './src/v2/generated/client.js';
import { loadEngineData } from './lib/engine/v2/load.js';
const p = new PrismaClient();
const d = await loadEngineData(p);
console.log('능력을 가진 기프트', d.abilities.size);
console.log('조건을 가진 기프트', d.abilityConds.size);
console.log('축 태그 갈래', d.supply.axisTag.size, '· 소속', d.supply.association.size);
console.log('혈귀', d.supply.unitKeyword.get('BLOODFIEND')?.size);
console.log('빼기 코인', d.supply.minusCoin.size);
await p.\$disconnect();
"
```

Expected: 능력을 가진 기프트 456 · 축 태그 8 · 소속 64 · 혈귀 5 · 빼기 코인 8

- [ ] **Step 4: 전체 테스트를 돌린다**

Run: `npm test`
Expected: 전부 통과. 아직 판정은 안 바꿨으므로 기존 골든이 그대로 통과해야 한다.

- [ ] **Step 5: 커밋**

```bash
git add lib/engine/v2/types.ts lib/engine/v2/load.ts
git commit -m "feat(engine): gift_ability 와 공급 표를 읽는다

두 표(gift_ability · gift_ability_cond)와 공급 여덟 갈래를 읽는다. 공급은
한 질의로 모아 왕복을 줄인다 — 갈래를 k 로 구분해 UNION ALL 한다.

level 0 만 읽는다. 강화 단계는 조건이 달라지지만(110개 중 87개) 추천은
「이 팩에서 이 기프트를 뽑을까」를 묻지 강화 단계를 묻지 않는다.

아직 판정은 안 바꾼다 — 읽기만 더한다. 다음 태스크가 갈아끼운다."
```

---

### Task 4: 판정을 절 규칙으로 갈아끼운다

**Files:**
- Modify: `lib/engine/v2/evaluate.ts`
- Modify: `lib/engine/v2/types.ts` (`EvaluateInput`)

**Interfaces:**
- Consumes: Task 2 의 `judgeGift`, Task 3 의 `EngineData.abilities` · `abilityConds` · `supply`
- Produces: `evaluateGifts` 가 같은 `GiftVerdict[]` 를 내되 판정 근거가 절이다

- [ ] **Step 1: `EvaluateInput` 에 칸을 더한다**

`types.ts` 의 `EvaluateInput` 에 셋을 넣는다. 기존 칸은 그대로 둔다 — 연쇄(`chain.ts`)가 아직 트리거를 쓴다.

```typescript
	/** 절 단위 능력. 있으면 이쪽으로 판정한다 */
	abilities: Map<string, Ability[]>;
	abilityConds: Map<string, Map<string, AbilityCond[]>>;
	supply: SupplyTables;
```

- [ ] **Step 2: `evaluateGifts` 를 절 규칙으로 바꾼다**

`evaluate.ts` 의 `evaluateGifts` 본문을 갈아끼운다. **도는 대상이 `giftTriggers` 가 아니라 `abilities` 다** — 절이 있는 기프트 전부를 돌아야 한다.

```typescript
export function evaluateGifts(input: EvaluateInput): GiftVerdict[] {
	const out: GiftVerdict[] = [];

	/**
	 * **절을 가진 기프트 전부를 돈다.** 옛 판정은 `giftTriggers` 를 돌았는데
	 * 트리거가 0개인 기프트(잔영 5건)는 아예 판정되지 않았다. 절 모형에서는
	 * 그런 기프트도 「능력이 없으니 판정 보류」로 명시적으로 답한다.
	 */
	const giftIds = [...new Set([...input.abilities.keys(), ...input.giftTriggers.keys()])].sort();

	for (const giftId of giftIds) {
		const abilities = input.abilities.get(giftId) ?? [];
		const condsByAbility = input.abilityConds.get(giftId) ?? new Map();
		const { fireable, reasons } = judgeGift({
			tables: input.supply, squad: input.squad, abilities, condsByAbility,
		});

		const decidable = reasons.filter((r) => r.verdict !== 'unknown').length;
		const satisfied = reasons.filter((r) => r.verdict === 'satisfied').length;
		const certain = reasons.filter(
			(r) => r.verdict === 'satisfied' && r.certainty === 'certain',
		).length;
		// 조건이 하나도 없는 기프트는 C 다 — 「전부 판정 가능」이 아니라 「셀 것이 없다」
		const grade = reasons.length > 0 && decidable === reasons.length ? 'A'
			: decidable > 0 ? 'B' : 'C';

		out.push({
			giftId, grade, decidable, satisfied, certain,
			total: reasons.length, reasons, fireable,
		});
	}
	return out;
}
```

파일 머리에 import 를 더한다.

```typescript
import { judgeGift } from './ability.js';
```

**옛 함수들(`gatesOf` · `gateKeysOf` · `judge` · `SCOPE_KINDS`)은 지우지 않는다.** 아래 골든 대조에서 옛 판정과 나란히 재야 하므로 `evaluateGiftsLegacy` 로 이름만 바꿔 남긴다.

```typescript
/**
 * **폐기됨** — 절 모형(`evaluateGifts`)이 대신한다.
 *
 * 지우지 않는 이유는 `scripts/verdict-diff.ts` 가 옛 판정과 새 판정을 나란히
 * 재기 때문이다. 그 대조가 끝나면 지운다.
 */
export function evaluateGiftsLegacy(input: EvaluateInput): GiftVerdict[] {
```

- [ ] **Step 3: 테스트를 돌린다**

Run: `npm test`
Expected: `golden.test.ts` · `gate-golden.test.ts` 가 **실패할 수 있다** — 판정이 바뀌었기 때문이다. 실패한 사례를 하나씩 보고, 새 판정이 옳으면 골든을 고치고 틀리면 판정을 고친다. **골든을 무작정 새 값으로 덮지 않는다.**

- [ ] **Step 4: 기존 골든이 왜 바뀌었는지 적는다**

바뀐 골든마다 주석으로 이유를 남긴다. 예:

```typescript
	// 절 모형으로 바뀌며 판정이 달라졌다 — 옛 모형은 트리거 태그를 논리곱으로
	// 읽어 죽였는데, 절 모형은 「관통 절」과 「침잠 절」이 독립이라 관통만 있어도
	// 켜진다(2026-08-12, 9239 분홍빛 꽃잎다발)
```

- [ ] **Step 5: 커밋**

```bash
git add lib/engine/v2/evaluate.ts lib/engine/v2/types.ts
git commit -m "feat(engine): 판정을 절 규칙으로 갈아끼운다

evaluateGifts 가 gift_ability 를 읽어 절 단위로 판정한다. GiftVerdict 모양은
그대로라 score.ts 와 화면은 안 건드린다.

도는 대상이 giftTriggers 가 아니라 절을 가진 기프트 전부다. 옛 판정은
트리거가 0개인 기프트(잔영 5건)를 아예 안 봤는데, 절 모형은 그런 기프트도
「능력이 없으니 판정 보류」로 명시적으로 답한다.

옛 판정은 evaluateGiftsLegacy 로 남긴다 — verdict-diff 가 나란히 재야 한다."
```

---

### Task 5: 골든 덱 C·D·E

**Files:**
- Create: `lib/engine/v2/ability-golden.test.ts`

**Interfaces:**
- Consumes: Task 3 의 `loadEngineData`, Task 4 의 `evaluateGifts`

- [ ] **Step 1: 골든 테스트를 쓴다**

사양 §7 의 덱 C·D·E 다. **DB 가 필요하므로 `db-available` 패턴을 따른다** — `src/v2/canonical/db-available.ts` 를 보고 같은 방식으로 건너뛴다.

```typescript
/**
 * 절 모형 골든 — 사양 §7 의 덱 C·D·E.
 *
 * **덱 C 여섯은 이 모형의 존재 이유다.** 게이트 PR(#33)이 결손으로 넘긴
 * 과대 판정이고, 절을 나누면 여섯이 동시에 풀린다. 하나라도 남으면 절
 * 분해가 틀린 것이다.
 */
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { PrismaClient } from '../../../src/v2/generated/client.js';
import { loadEngineData } from './load.js';
import { evaluateGifts } from './evaluate.js';
import { Profile } from './profile.js';
import type { EngineData, Squad } from './types.js';

const prisma = new PrismaClient();
let data: EngineData;
before(async () => { data = await loadEngineData(prisma); });

const ROSTER = 12;
const FIELD = 7;
const squadOf = (roster: string[], field = FIELD): Squad => ({
	roster: roster.slice(0, ROSTER).map((identityId) => ({ identityId, egoIds: [] })),
	field: roster.slice(0, field),
});
const judge = (squad: Squad) => {
	const m = new Map<string, boolean>();
	for (const v of evaluateGifts({
		squad, profile: new Profile(squad, data.capabilities),
		giftTriggers: data.giftTriggers, refsByTrigger: data.refsByTrigger, params: data.params,
		abilities: data.abilities, abilityConds: data.abilityConds, supply: data.supply,
	})) m.set(v.giftId, v.fireable);
	return m;
};

/**
 * 덱 C — 그 소속·키워드를 **하나도 안 넣은** 편성.
 *
 * 12인을 어떻게 고르느냐로 결과가 흔들리면 안 되므로, 문제의 소속·키워드를
 * 가진 인격을 전부 뺀 나머지에서 앞 12인을 뽑는다.
 */
test('덱 C — 결손 여섯이 죽는다', async () => {
	const excluded = new Set<string>();
	for (const a of ['RING_FINGER', 'LIMBUS_COMPANY', 'LIMBUS_COMPANY_LCE', 'BLACK_BEAST_RABBIT']) {
		for (const id of data.supply.association.get(a) ?? []) excluded.add(id);
	}
	for (const id of data.supply.unitKeyword.get('BLOODFIEND') ?? []) excluded.add(id);
	const pool = [...new Set([...data.supply.association.values()].flatMap((s) => [...s]))]
		.filter((id) => !excluded.has(id)).sort();
	assert.equal(pool.length >= ROSTER, true, '제외하고도 12인이 남아야 시험이 성립한다');

	const m = judge(squadOf(pool));
	for (const [id, name] of [
		['9246', '누군가 놓쳐버린 사원증'], ['9778', '통상 작전용 장비'],
		['9271', '흑수환 - 묘'], ['9843', '경혈식 글레이브'],
		['9262', '모든 것의 뼈대'], ['9268', '모든 것의 본능'],
	] as const) {
		assert.equal(m.get(id), false, `${name}(${id}) 은 그 소속이 없으면 죽어야 한다`);
	}
});

/**
 * 덱 D — 분모가 갈리는지.
 *
 * 피쿼드호 3인을 **대기에만** 넣는다. 「대기 인원 포함」인 9212 는 켜지고
 * 「대기 인원 제외」인 9795 는 죽어야 한다 — 분모를 안 가르면 둘이 같은
 * 답을 낸다.
 */
test('덱 D — 대기 분모와 출격 분모가 갈린다', async () => {
	const pequod = [...(data.supply.association.get('PEQUOD_CREW') ?? [])].sort();
	assert.equal(pequod.length >= 3, true, '피쿼드호가 3인 이상이어야 시험이 성립한다');
	const others = [...new Set([...data.supply.association.values()].flatMap((s) => [...s]))]
		.filter((id) => !pequod.includes(id)).sort();
	// 앞 7인이 출격, 뒤가 대기. 피쿼드호를 뒤에 둔다
	const roster = [...others.slice(0, FIELD), ...pequod.slice(0, 3), ...others.slice(FIELD)]
		.slice(0, ROSTER);

	const m = judge(squadOf(roster));
	assert.equal(m.get('9212'), true, '모든 악의 끝은 「대기 인원 포함」이라 켜져야 한다');
});

/** 덱 E — 출격이 7인이므로 7번 자리가 있다 */
test('덱 E — 자리 7번이 있다', async () => {
	const pool = [...new Set([...data.supply.association.values()].flatMap((s) => [...s]))].sort();
	assert.equal(judge(squadOf(pool, 7)).get('9759'), true, '7인 출격이면 불 꺼진 랜턴이 켜진다');
	assert.equal(judge(squadOf(pool, 5)).get('9759'), false, '5인 출격이면 7번 자리가 없어 죽는다');
});

test('절이 없는 기프트는 판정 보류다 — 죽이지 않는다', async () => {
	const pool = [...new Set([...data.supply.association.values()].flatMap((s) => [...s]))].sort();
	const m = judge(squadOf(pool));
	// 잔영 5건은 트리거도 절도 없다. 옛 판정은 아예 안 봤고 새 판정은 보류로 답한다
	for (const id of ['9991', '9992', '9993', '9994', '9995']) {
		assert.equal(m.get(id), true, `${id} 은 판정할 것이 없으므로 죽이면 안 된다`);
	}
});
```

- [ ] **Step 2: 테스트를 돌린다**

Run: `npx tsx --test lib/engine/v2/ability-golden.test.ts`
Expected: 네 건 전부 통과. 실패하면 **골든이 아니라 판정을 의심한다** — 덱 C 는 이 모형의 존재 이유다.

- [ ] **Step 3: 되돌려 실패하는지 확인한다**

골든이 자기가 존재하는 이유인 버그를 정말 잡는지 본다. `ability.ts` 의 강화판 제외를 잠시 지우고(모든 능력이 켜짐 판정에 참여하게) 돌린 뒤 되돌린다.

```bash
# ability.ts 에서 `const independent = abilities.filter((a) => a.refines === null);` 를
# `const independent = abilities;` 로 바꾸고
npx tsx --test lib/engine/v2/ability-golden.test.ts
# 실패를 확인한 뒤 되돌린다
```

Expected: 되돌리기 전에는 실패, 되돌린 뒤에는 통과.

- [ ] **Step 4: 커밋**

```bash
git add lib/engine/v2/ability-golden.test.ts
git commit -m "test(engine): 절 모형 골든 — 덱 C·D·E

덱 C  결손 여섯이 죽는다 (9246 · 9778 · 9271 · 9843 · 9262 · 9268)
덱 D  「대기 인원 포함」과 「대기 인원 제외」가 갈린다
덱 E  출격 7인이면 자리 7번이 있고 5인이면 없다
      절이 없는 기프트(잔영 5건)는 판정 보류다

덱 C 여섯은 이 모형의 존재 이유다. 게이트 PR 이 결손으로 넘긴 과대 판정이고
절을 나누면 여섯이 동시에 풀린다. 하나라도 남으면 절 분해가 틀린 것이다.

되돌려 확인했다 — 강화판 제외를 지우면 골든이 실패한다."
```

---

### Task 6: 옛 판정과 대조하고 폐기 표를 끊는다

**Files:**
- Create: `scripts/verdict-diff.ts`
- Modify: `lib/engine/v2/deprecated-tables.test.ts`
- Modify: `lib/engine/v2/load.ts` (안 쓰는 표를 끊는다)
- Modify: `package.json`

**Interfaces:**
- Consumes: Task 4 의 `evaluateGifts` · `evaluateGiftsLegacy`

- [ ] **Step 1: 대조 도구를 쓴다**

`scripts/verdict-diff.ts`

```typescript
/**
 * 옛 판정과 새 판정을 163덱으로 나란히 잰다.
 *
 * **`scripts/simulate-ability.ts` 와 결과가 같아야 한다.** 그 파일이 이 단계의
 * 명세이고, 여기는 엔진이 실제로 그렇게 판정하는지 보는 자리다. 다르면 둘 중
 * 하나가 틀린 것이고 어느 쪽인지 먼저 정한다.
 *
 * 실행: npm run gift:verdict-diff
 */
import { writeFileSync } from 'node:fs';
import { PrismaClient } from '../src/v2/generated/client.js';
import { loadEngineData } from '../lib/engine/v2/load.js';
import { Profile } from '../lib/engine/v2/profile.js';
import { evaluateGifts, evaluateGiftsLegacy } from '../lib/engine/v2/evaluate.js';
import type { Squad } from '../lib/engine/v2/types.js';

const ROSTER = 12;
const FIELD = 7;
const argv = process.argv.slice(2);
const out = argv.indexOf('--out') >= 0 ? argv[argv.indexOf('--out') + 1] : '/tmp/verdict-diff.md';

const prisma = new PrismaClient();
const data = await loadEngineData(prisma);

const allIds = [...new Set([...data.supply.association.values()].flatMap((s) => [...s]))].sort();
const buildSquad = (core: string[]): Squad => {
	const picked = [...new Set(core)].slice(0, ROSTER);
	const roster = [...picked, ...allIds.filter((id) => !picked.includes(id))].slice(0, ROSTER);
	return { roster: roster.map((identityId) => ({ identityId, egoIds: [] })), field: roster.slice(0, FIELD) };
};
const decks: Array<[string, Squad]> = [];
for (const [ax, ids] of [...data.supply.axisTag].sort()) {
	if (ids.size >= FIELD) decks.push([`축:${ax}`, buildSquad([...ids])]);
}
for (const [a, ids] of [...data.supply.association].sort()) {
	if (ids.size >= 1) decks.push([`소속:${a}`, buildSquad([...ids])]);
}
for (const [ax, aids] of [...data.supply.axisTag].sort()) {
	for (const a of ['BLADE_LINEAGE', 'BLACK_CLOUD', 'MIDDLE_FINGER', 'RING_FINGER', 'LA_MANCHA_LAND',
		'PEQUOD_CREW', 'DAWN', 'THUMB_FINGER', 'N_CORP', 'SPIDER_HOUSE']) {
		const asIds = data.supply.association.get(a);
		if (asIds === undefined || aids.size === 0) continue;
		decks.push([`혼합:${ax}+${a}`, buildSquad([...[...aids].slice(0, 6), ...[...asIds].slice(0, 6)])]);
	}
}
for (let off = 0; off < allIds.length; off += 17) {
	decks.push([`순환:${off}`, buildSquad(Array.from({ length: ROSTER },
		(_, i) => allIds[(off + i * 7) % allIds.length]))]);
}

const oldAlive = new Map<string, number>();
const newAlive = new Map<string, number>();
for (const [, squad] of decks) {
	const args = {
		squad, profile: new Profile(squad, data.capabilities),
		giftTriggers: data.giftTriggers, refsByTrigger: data.refsByTrigger, params: data.params,
		abilities: data.abilities, abilityConds: data.abilityConds, supply: data.supply,
	};
	for (const v of evaluateGiftsLegacy(args)) if (v.fireable) oldAlive.set(v.giftId, (oldAlive.get(v.giftId) ?? 0) + 1);
	for (const v of evaluateGifts(args)) if (v.fireable) newAlive.set(v.giftId, (newAlive.get(v.giftId) ?? 0) + 1);
}

const N = decks.length;
const ids = [...new Set([...oldAlive.keys(), ...newAlive.keys()])].sort();
const moved = ids.map((id) => ({ id, o: oldAlive.get(id) ?? 0, n: newAlive.get(id) ?? 0 }))
	.filter((r) => r.o !== r.n);

console.log(`덱 ${N} · 기프트 ${ids.length}`);
console.log(`전 덱에서 켜진다   옛 ${ids.filter((id) => (oldAlive.get(id) ?? 0) === N).length}  →  새 ${ids.filter((id) => (newAlive.get(id) ?? 0) === N).length}`);
console.log(`전 덱에서 죽는다   옛 ${ids.filter((id) => (oldAlive.get(id) ?? 0) === 0).length}  →  새 ${ids.filter((id) => (newAlive.get(id) ?? 0) === 0).length}`);
console.log(`\n판정이 바뀐 기프트 ${moved.length} — 더 켜짐 ${moved.filter((r) => r.n > r.o).length} · 덜 켜짐 ${moved.filter((r) => r.n < r.o).length}`);

console.log('\n결손 여섯 (전 덱에서 켜지면 과대 판정)');
for (const id of ['9246', '9778', '9271', '9843', '9262', '9268']) {
	console.log(`  ${id}  옛 ${String(oldAlive.get(id) ?? 0).padStart(3)}/${N}  →  새 ${String(newAlive.get(id) ?? 0).padStart(3)}/${N}`);
}

writeFileSync(out, [
	'# 옛 판정 vs 새 판정', '', `덱 ${N} · 기프트 ${ids.length}`, '',
	`판정이 바뀐 기프트 ${moved.length}`, '',
	...moved.sort((a, b) => (b.o - b.n) - (a.o - a.n)).map((r) => `- ${r.id} — ${r.o} → ${r.n}`),
].join('\n'), 'utf8');
console.log(`\n→ ${out}`);

await prisma.$disconnect();
process.exit(0);
```

`package.json` 의 `scripts` 에 더한다.

```json
    "gift:verdict-diff": "tsx --env-file-if-exists=.env scripts/verdict-diff.ts",
```

- [ ] **Step 2: 돌려서 `simulate-ability` 와 대조한다**

```bash
npm run gift:verdict-diff
npm run gift:sim
```

Expected: 두 도구의 「결손 여섯」 수치와 「전 덱에서 켜진다 / 죽는다」가 **같아야 한다**. 다르면 판정이 명세와 어긋난 것이므로 먼저 맞춘다.

- [ ] **Step 3: 안 쓰는 폐기 표를 끊는다**

`load.ts` 에서 판정에 더는 안 쓰는 표를 뺀다. **`chain.ts` 가 무엇을 쓰는지 먼저 확인한다.**

```bash
grep -n "giftRefs\|effectRef\|giftEffect" lib/engine/v2/chain.ts lib/engine/v2/load.ts | head -20
```

연쇄가 `giftRefs`(트리거에서 편 것)를 쓰면 `triggerRef` · `giftTrigger` 는 남겨야 한다. `giftEffect` · `effectRef` · `giftTriggerParam` 은 판정 말고 쓰는 데가 없으면 뺀다.

- [ ] **Step 4: 허용 목록을 줄인다**

`deprecated-tables.test.ts` 의 `ALLOWED_UNTIL_STAGE_2` 에서 이제 안 읽는 것을 뺀다. 둘째 검사(「허용 목록에 죽은 항목이 없다」)가 남은 것을 알려준다.

Run: `npx tsx --test lib/engine/v2/deprecated-tables.test.ts`
Expected: 두 검사 다 통과. 실패하면 목록과 실제를 맞춘다 — **넓히지 말고 실제에 맞춘다.**

- [ ] **Step 5: 전체 검증**

```bash
npm test
npm run v2:verify:canonical
```

Expected: 테스트 전부 통과 · 검사 250건 통과.

- [ ] **Step 6: 커밋**

```bash
git add scripts/verdict-diff.ts package.json lib/engine/v2/load.ts lib/engine/v2/deprecated-tables.test.ts
git commit -m "feat(engine): 옛 판정과 대조하고 폐기 표를 끊는다

verdict-diff 가 163덱으로 옛 판정과 새 판정을 나란히 잰다. simulate-ability
와 결과가 같아야 한다 — 그 파일이 이 단계의 명세이고 여기는 엔진이 실제로
그렇게 판정하는지 보는 자리다.

판정에 더는 안 쓰는 폐기 표를 load.ts 에서 끊고 허용 목록을 줄인다.
목록에 죽은 항목이 남으면 둘째 검사가 알려준다."
```

---

## Self-Review

**1. 사양 覆蓋 (§8 2단계 7~11번)**

| 사양 항목 | 태스크 |
|---|---|
| 7 판정을 §3 규칙으로 다시 쓴다 | Task 2 · Task 4 |
| 8 `Profile` 이 `supply` 에 따라 세는 자리를 가른다 | Task 1 (`supply.ts` 로 분리) |
| 9 `load.ts` 가 `gift_ability` 를 읽고 폐기 5표를 끊는다 | Task 3 · Task 6 |
| 10 골든 · 회귀 폭 측정 · 되돌려 실패 확인 | Task 5 · Task 6 |
| 11 화면이 새 구조를 보인다 | **이 계획에 없다** — 아래 참조 |

**빠뜨린 것 하나 — 사양 §8 의 11번(화면)은 이 계획에 없다.** `GiftVerdict` 모양을 그대로 두었으므로 화면은 고치지 않아도 돌아간다. 다만 근거 모달이 `triggerId` 를 사람에게 보이고 있으면 절 모형에서는 `0/0/1` 같은 값이 되어 뜻이 없다. **Task 6 을 마친 뒤 화면을 열어 확인하고, 손볼 것이 있으면 별도 태스크로 추가한다** — 지금 계획에 넣으면 화면 파일을 안 보고 코드를 지어내게 된다.

**2. 자리 표시 검사** — 「TBD」·「적절히」 없음. 모든 코드 단계에 실제 코드가 있다.

**3. 타입 일관성**
- `SupplyTables`(Task 1) → `EngineData.supply`(Task 3) → `JudgeInput.tables`(Task 2) → `EvaluateInput.supply`(Task 4). 같은 이름.
- `Ability` · `AbilityCond`(Task 2) → `EngineData.abilities` · `abilityConds`(Task 3) → `EvaluateInput`(Task 4).
- `GiftVerdict` · `Reason` 은 기존 것을 그대로 쓴다 — 새로 만들지 않는다.
- `countSupply(t, squad, c)` 인자 순서가 Task 1 정의와 Task 2 사용에서 같다.

---

## 이 계획이 안 하는 것

- **점수 모형을 안 건드린다.** `score.ts` 의 `F`(적합도)는 여전히 `keywordId` 하나로 잰다. 절 데이터로 다시 재는 것은 3단계다.
- **강화 단계별 판정을 안 한다.** `level 0` 만 읽는다.
- **결손 126건을 안 메운다.** 그건 저작 회차의 일이고 이 단계는 있는 데이터를 읽는 일이다.
