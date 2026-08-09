# 팩 점수 모형 v2 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 켜질 수 없는 기프트를 점수에서 빼고, 전용 기프트를 무겁게 세고, 합성 도달을 점수에 넣고, 근거를 전량 볼 수 있게 한다.

**Architecture:** 판정은 `lib/engine/v2/evaluate.ts` 가 `fireable` 로 답하고 자리 조건을 다른 조건에 씌운다. 합성 도달은 새 순수 함수 `lib/engine/v2/fusion.ts` 다. 점수는 `score.ts` 에서 `(F + C) × L` 로 합친다. 질의는 재료를 모아 넘기고, 화면은 모달로 전량을 보인다.

**Tech Stack:** TypeScript ESM · `node:test` · Prisma `multiSchema` · Next.js App Router · tsx

## Global Constraints

- 설계는 [`docs/superpowers/specs/2026-08-09-pack-scoring-v2-design.md`](../specs/2026-08-09-pack-scoring-v2-design.md). 절 번호는 그 문서를 가리킨다.
- **`canonical` 을 바꾸지 않는다.** 읽는 쪽만 건드린다. 검사 222건은 그대로 통과해야 한다.
- **새 저울추를 만들지 않는다** (설계 5.1). 전용 1.0/범용 0.5 와 합성 도달 1.0/0.5/0.25 는 전부 기존 `HALF = 0.5` 의 거듭제곱이다.
- **`fireable === false` 인 기프트는 `F` · `L` · `C` 어디에도 안 들어간다. 목록에는 남는다** (설계 2.2).
- **자리 조건이 있는 기프트는 그 자리 인격만을 분모로 그 기프트의 다른 조건 전부를 판정한다** (설계 2.4).
- **2단 합성은 1단으로만 본다** (설계 4.4). 중간 결과물을 재료로 안 친다.
- **결과물을 이미 보유했으면 그 레시피는 안 센다** (설계 8절).
- `lib/engine/v2/` 의 **생산 코드**는 상대경로 + `.js` 확장자. 앱·질의 층은 `@/` 별칭에 확장자 없음.
- **검사 파일의 import 확장자는 혼재한다.** `score.test.ts` 는 `'./score.js'`, `chain.test.ts` · `evaluate.test.ts` 는 `'./chain'` 처럼 확장자가 없다. 둘 다 돈다 — **고치는 파일의 기존 방식을 따르고 통일하려 들지 마라.** 새로 만드는 검사 파일은 `.js` 를 붙인다(생산 코드와 같게).
- 주석은 한국어로 「왜 그렇게 했는가」를 적는다.
- 테스트 실행은 `npm test`. **기준선은 472 tests / 460 pass / 0 fail / 12 skip.**
- 타입 검사 `npm run typecheck`, 빌드 `npm run build`.
- DB 는 `docker exec limbus-postgres psql -U postgres -d limbus`.
- **워크트리는 이미 준비돼 있다** — `.env` 복사와 `npm run v2:generate` 를 마쳤다.
- 확인 스크립트는 **저장소 안(`scripts/`)에 둔다.** `/tmp` 에 두면 `package.json` 의 `"type": "module"` 이 안 닿아 `Top-level await is currently not supported with the "cjs" output format` 로 죽는다.
- 커밋 메시지는 한국어. Conventional Commits. **PR 제목에도 접두사를 붙인다.**

## 파일 구조

| 파일 | 책임 | 상태 |
| --- | --- | --- |
| `lib/engine/v2/profile.ts` | `countInSlots` 추가 — 자리 범위로 센다 | 수정 |
| `lib/engine/v2/evaluate.ts` | 자리 범위를 다른 조건에 씌운다 · `fireable` | 수정 |
| `lib/engine/v2/fusion.ts` | 합성 도달. 순수 함수 | **신규** |
| `lib/engine/v2/fusion.test.ts` | 위의 검사 | **신규** |
| `lib/engine/v2/load.ts` | 합성 세 표를 싣는다 | 수정 |
| `lib/engine/v2/score.ts` | `fireable` 제외 · 전용 가중 · `C` 항 | 수정 |
| `lib/queries/canonical/recommend.ts` | 전용 표와 합성 데이터를 넘긴다 | 수정 |
| `app/[locale]/recommend/page.tsx` | 근거 모달 | 수정 |
| `components/gift-evidence.tsx` | 모달 본체. 클라이언트 컴포넌트 | **신규** |

---

### Task 1: 골든 기준을 뜬다

**아무것도 바꾸기 전에 한다.** `build/` 는 gitignore 대상이라 이 워크트리에 없다.

**Files:** 없음

**Interfaces:**
- Consumes: `scripts/golden-queries.ts` 의 `cases()` 23건
- Produces: `build/golden/before/` 23개 JSON

- [ ] **Step 1: 지금 출력을 뜬다**

```bash
npm run golden:capture -- before
```

기대: `before — 23건 떴다.`

**실패하면 거기서 멈춘다.** 기준이 없으면 대조할 것이 없다.

- [ ] **Step 2: 지금 순위를 받아 적는다**

```bash
python3 -c "
import json
d=json.load(open('build/golden/before/recommend.floor3.hard.json'))
for p in d['packs'][:3]: print(f\"{p['score']:.4f} {p['fit']:.3f} {p['live']:.3f} {p['name']}\")
"
```

기대: `0.1396 0.273 0.511 타오르는 일렁임` 이 첫 줄. 뒤 태스크가 이것과 대조한다.

- [ ] **Step 3: 커밋할 것이 없음을 확인한다**

```bash
git status --porcelain
```

기대: 비어 있다.

---

### Task 2: `Profile` 이 자리 범위로 센다

**Files:**
- Modify: `lib/engine/v2/profile.ts`
- Create: `lib/engine/v2/profile.test.ts`

**Interfaces:**
- Consumes: `lib/engine/v2/types.js` 의 `Squad` · `Capability`
- Produces: `Profile.countInSlots(refKind: string, refId: string, slots: readonly number[]): number`

- [ ] **Step 1: 검사를 먼저 쓴다**

`lib/engine/v2/profile.test.ts` — **새 파일이다.** 기존에 `profile` 전용 검사 파일이 없다.

```typescript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Profile } from './profile.js';
import type { Capability, Squad } from './types.js';

/** 출전 순서가 곧 자리 번호다 — 1번이 A, 2번이 B, 3번이 C */
const SQUAD: Squad = {
	roster: [
		{ identityId: 'A', egoIds: [] },
		{ identityId: 'B', egoIds: [] },
		{ identityId: 'C', egoIds: [] },
	],
	field: ['A', 'B', 'C'],
};

const CAPS: Capability[] = [
	{ identityId: 'A', refKind: 'axis', refId: 'COMBUSTION', egoId: '' },
	{ identityId: 'B', refKind: 'axis', refId: 'COMBUSTION', egoId: '' },
	// 파열은 3번 자리에만 있다 — 이 덱의 함정이다
	{ identityId: 'C', refKind: 'axis', refId: 'BURST', egoId: '' },
];

test('자리 범위로 세면 그 자리 인격만 걸린다', () => {
	const p = new Profile(SQUAD, CAPS);
	assert.equal(p.count('axis', 'BURST'), 1);
	// 1·2번 자리에는 파열이 없다. 전체로는 있어도 여기서는 0 이다
	assert.equal(p.countInSlots('axis', 'BURST', [1, 2]), 0);
	assert.equal(p.countInSlots('axis', 'BURST', [3]), 1);
});

test('자리 범위 안의 것은 정상으로 센다', () => {
	const p = new Profile(SQUAD, CAPS);
	assert.equal(p.countInSlots('axis', 'COMBUSTION', [1, 2]), 2);
	assert.equal(p.countInSlots('axis', 'COMBUSTION', [1]), 1);
});

test('편성보다 큰 자리 번호는 없는 자리다 — 지어내지 않는다', () => {
	const p = new Profile(SQUAD, CAPS);
	assert.equal(p.countInSlots('axis', 'COMBUSTION', [4, 5]), 0);
	// 있는 자리와 없는 자리가 섞이면 있는 것만 센다
	assert.equal(p.countInSlots('axis', 'COMBUSTION', [1, 9]), 1);
});

test('빈 자리 목록은 0 이다', () => {
	const p = new Profile(SQUAD, CAPS);
	assert.equal(p.countInSlots('axis', 'COMBUSTION', []), 0);
});

test('없는 갈래는 0 이다', () => {
	const p = new Profile(SQUAD, CAPS);
	assert.equal(p.countInSlots('sin', 'wrath', [1, 2, 3]), 0);
});
```

- [ ] **Step 2: 검사가 깨지는지 본다**

```bash
npx tsx --test lib/engine/v2/profile.test.ts
```

기대: `countInSlots is not a function` 류로 실패.

- [ ] **Step 3: `Profile` 에 자리 목록과 새 메서드를 더한다**

`lib/engine/v2/profile.ts` 의 `Profile` 클래스를 이렇게 고친다. **`counts` 와 `count` 는 그대로 둔다.**

```typescript
export class Profile {
	private readonly counts = new Map<string, Set<string>>();
	/**
	 * 자리 번호 → 인격 id. **출전 순서가 곧 자리 번호다.**
	 *
	 * 거울 던전은 편성과 전투 순서까지 정하고 진입하므로(설계 2.4) 「1번 인격」은
	 * 추측이 아니라 확정이다. `Squad.field` 가 그 순서를 담고 있다.
	 */
	private readonly bySlot: string[];

	constructor(squad: Squad, capabilities: Capability[]) {
		this.bySlot = [...squad.field];
		const denom = denominatorsOf(squad);
		const active = activeCapabilities(squad, capabilities);
		for (const c of active) {
			for (const [name, members] of Object.entries(denom)) {
				if (!(members as Set<string>).has(c.identityId)) continue;
				const key = `${c.refKind}|${c.refId}|${name}`;
				const seen = this.counts.get(key);
				if (seen === undefined) this.counts.set(key, new Set([c.identityId]));
				else seen.add(c.identityId);
			}
		}
	}

	/** 분모 기본값은 `field` 다 — 실측 49/59 가 출전이고 그것이 게임의 기본이다 */
	count(refKind: string, refId: string, denominator = 'field'): number {
		return this.counts.get(`${refKind}|${refId}|${denominator}`)?.size ?? 0;
	}

	/**
	 * 이 자리들에 있는 인격 중 몇이 이 갈래를 공급하나.
	 *
	 * **「파열 인격이 있나」가 아니라 「1·2번 자리가 파열을 주나」를 묻는다.**
	 * 죽음바라기의 「[편성 1번, 2번 인격 전용 효과]」가 그 조건이고, 전체로는
	 * 공급되는데 그 자리에는 없는 덱에서 켜진다고 판정하는 사고를 막는다.
	 *
	 * 편성보다 큰 자리 번호는 없는 자리다 — 지어내지 않고 뺀다.
	 */
	countInSlots(refKind: string, refId: string, slots: readonly number[]): number {
		const members = this.counts.get(`${refKind}|${refId}|field`);
		if (members === undefined) return 0;
		let n = 0;
		for (const s of slots) {
			const id = this.bySlot[s - 1];
			if (id !== undefined && members.has(id)) n += 1;
		}
		return n;
	}
}
```

- [ ] **Step 4: 검사가 통과하는지 본다**

```bash
npx tsx --test lib/engine/v2/profile.test.ts
npm run typecheck
```

기대: 5건 전부 pass · 0 fail · 타입 통과.

- [ ] **Step 5: 커밋**

```bash
git add lib/engine/v2/profile.ts lib/engine/v2/profile.test.ts
git commit -m "feat(engine): Profile 이 자리 범위로 센다

거울 던전은 편성과 전투 순서까지 정하고 진입하므로 「1번 인격」은 추측이
아니라 확정이다. Squad.field 가 그 순서를 담고 있고 counts 가 이미 인격
집합을 들고 있어 교집합만 하면 된다.

「파열 인격이 있나」가 아니라 「1·2번 자리가 파열을 주나」를 묻는다.
전체로는 공급되는데 그 자리에는 없는 덱에서 켜진다고 판정하는 사고를 막는다.

편성보다 큰 자리 번호는 없는 자리로 친다. 지어내지 않는다."
```

---

### Task 3: `evaluate` 가 자리를 씌우고 `fireable` 을 낸다

**Files:**
- Modify: `lib/engine/v2/types.ts`
- Modify: `lib/engine/v2/evaluate.ts`
- Modify: `lib/engine/v2/evaluate.test.ts`

**Interfaces:**
- Consumes: Task 2 의 `Profile.countInSlots`
- Produces: `GiftVerdict.fireable: boolean`

- [ ] **Step 1: 검사를 더한다**

`lib/engine/v2/evaluate.test.ts` 끝에 붙인다. **기존 검사를 건드리지 마라.** 그 파일의 기존 헬퍼와 import 를 그대로 쓴다 — 파일을 먼저 읽고 같은 방식으로 픽스처를 만든다.

```typescript
test('하나라도 미충족·확정이면 켜질 수 없다', () => {
	// 조건 둘: 하나는 충족, 하나는 편성에 없어 확정 미충족
	const squad: Squad = { roster: [{ identityId: 'A', egoIds: [] }], field: ['A'] };
	const profile = new Profile(squad, [
		{ identityId: 'A', refKind: 'sin', refId: 'wrath', egoId: '' },
	]);
	const out = evaluateGifts({
		squad,
		profile,
		giftTriggers: new Map([['g1', ['t-sin', 't-axis']]]),
		refsByTrigger: new Map([
			['t-sin', [{ triggerId: 't-sin', refKind: 'sin', refId: 'wrath', evaluability: 'roster_gated' }]],
			['t-axis', [{ triggerId: 't-axis', refKind: 'axis', refId: 'BURST', evaluability: 'roster_gated' }]],
		]),
		params: [],
	});
	const v = out[0]!;
	assert.equal(v.satisfied, 1);
	assert.equal(v.fireable, false);
});

test('미충족이 없으면 켜질 수 있다', () => {
	const squad: Squad = { roster: [{ identityId: 'A', egoIds: [] }], field: ['A'] };
	const profile = new Profile(squad, [
		{ identityId: 'A', refKind: 'sin', refId: 'wrath', egoId: '' },
	]);
	const out = evaluateGifts({
		squad,
		profile,
		giftTriggers: new Map([['g1', ['t-sin']]]),
		refsByTrigger: new Map([
			['t-sin', [{ triggerId: 't-sin', refKind: 'sin', refId: 'wrath', evaluability: 'roster_gated' }]],
		]),
		params: [],
	});
	assert.equal(out[0]!.fireable, true);
});

test('판정 불가만 있으면 켜질 수 있다 — 모른다와 못 켠다는 다르다', () => {
	const squad: Squad = { roster: [{ identityId: 'A', egoIds: [] }], field: ['A'] };
	const profile = new Profile(squad, []);
	const out = evaluateGifts({
		squad,
		profile,
		giftTriggers: new Map([['g1', ['t-rt']]]),
		refsByTrigger: new Map([
			['t-rt', [{ triggerId: 't-rt', refKind: 'axis', refId: 'BURST', evaluability: 'runtime' }]],
		]),
		params: [],
	});
	assert.equal(out[0]!.reasons[0]!.verdict, 'unknown');
	assert.equal(out[0]!.fireable, true);
});

test('자리 조건이 있으면 다른 조건을 그 자리로만 판정한다', () => {
	// 파열은 3번 자리에만 있다. slots {1,2} 기프트는 켜질 수 없어야 한다
	const squad: Squad = {
		roster: [
			{ identityId: 'A', egoIds: [] },
			{ identityId: 'B', egoIds: [] },
			{ identityId: 'C', egoIds: [] },
		],
		field: ['A', 'B', 'C'],
	};
	const profile = new Profile(squad, [
		{ identityId: 'C', refKind: 'axis', refId: 'BURST', egoId: '' },
	]);
	const out = evaluateGifts({
		squad,
		profile,
		giftTriggers: new Map([['g1', ['t-slot', 't-axis']]]),
		refsByTrigger: new Map([
			['t-slot', [{ triggerId: 't-slot', refKind: 'deployment', refId: '', evaluability: 'roster_gated' }]],
			['t-axis', [{ triggerId: 't-axis', refKind: 'axis', refId: 'BURST', evaluability: 'roster_gated' }]],
		]),
		params: [{ giftId: 'g1', triggerId: 't-slot', kind: 'slot', tier: 0, value: '', slots: [1, 2] }],
	});
	const v = out[0]!;
	const axis = v.reasons.find((r) => r.refKind === 'axis')!;
	assert.equal(axis.verdict, 'unsatisfied');
	assert.equal(v.fireable, false);
});

test('자리 조건이 없으면 편성 전체로 판정한다', () => {
	const squad: Squad = {
		roster: [{ identityId: 'A', egoIds: [] }, { identityId: 'C', egoIds: [] }],
		field: ['A', 'C'],
	};
	const profile = new Profile(squad, [
		{ identityId: 'C', refKind: 'axis', refId: 'BURST', egoId: '' },
	]);
	const out = evaluateGifts({
		squad,
		profile,
		giftTriggers: new Map([['g1', ['t-axis']]]),
		refsByTrigger: new Map([
			['t-axis', [{ triggerId: 't-axis', refKind: 'axis', refId: 'BURST', evaluability: 'roster_gated' }]],
		]),
		params: [],
	});
	assert.equal(out[0]!.reasons[0]!.verdict, 'satisfied');
});
```

**이 파일은 확장자 없이 import 한다**(`from './evaluate'`). 기존 방식을 따르고 위 코드의 `.js` 는 무시한다.

**픽스처 타입이 기존 파일과 다르면 기존 파일 것을 따라라.** 위는 의도를 보이는 것이고, `TriggerRef` · `TriggerParam` 의 실제 필드는 `lib/engine/v2/types.ts` 가 정한다. 기존 파일이 `SQUAD` 와 `burn(id)` 같은 헬퍼를 이미 갖고 있으니 **먼저 읽고 그것을 재사용하라.**

- [ ] **Step 2: 검사가 깨지는지 본다**

```bash
npx tsx --test lib/engine/v2/evaluate.test.ts
```

기대: `fireable` 관련 4건이 실패. 기존 검사는 통과.

- [ ] **Step 3: `GiftVerdict` 에 `fireable` 을 더한다**

`lib/engine/v2/types.ts` 의 `GiftVerdict` 에 넣는다.

```typescript
	/**
	 * 이 편성에서 켜질 수 있나.
	 *
	 * **하나라도 「미충족·확정」 조건이 있으면 false 다.** 편성에 없는 것은 전투
	 * 중에도 안 생기므로(불충족은 언제나 확정) 그 기프트는 이 편성에서 영영 안 켜진다.
	 *
	 * **이것이 조건 결합 문제의 출구다.** 「셋 중 둘이 맞았다」가 AND 인지 OR 인지는
	 * 데이터가 답하지 않지만(`gift_effect` 와 `gift_trigger` 를 잇는 표가 없다),
	 * 「하나가 확정 불가라 못 켠다」는 결합을 몰라도 참이다.
	 *
	 * **판정 불가(`unknown`)는 false 로 안 만든다** — 모른다와 못 켠다는 다르다.
	 */
	fireable: boolean;
```

- [ ] **Step 4: `evaluate.ts` 를 고친다**

`evaluateGifts` 의 루프를 이렇게 바꾼다.

```typescript
export function evaluateGifts(input: EvaluateInput): GiftVerdict[] {
	const gates = gatesOf(input.params);
	const out: GiftVerdict[] = [];

	for (const [giftId, triggerIds] of input.giftTriggers) {
		/**
		 * **자리 범위를 먼저 모은다.** 자리 조건은 독립 효과가 아니라 다른 조건에
		 * 씌우는 한정자다 — 「[편성 1번, 2번 인격 전용 효과] 파열 … 을 부여하는
		 * 공격 스킬」이 한 문장이기 때문이다.
		 *
		 * **이것은 추론이다**(설계 2.5). `gift_effect` 와 `gift_trigger` 를 잇는
		 * 표가 없어 어느 조건이 어느 효과를 켜는지 데이터가 답하지 않는다.
		 */
		const scope: number[] = [];
		for (const triggerId of triggerIds) {
			const g = gates.get(`${giftId}|${triggerId}`);
			if (g !== undefined && g.slots.length > 0) scope.push(...g.slots);
		}

		const reasons: Reason[] = [];
		for (const triggerId of triggerIds) {
			const gate = gates.get(`${giftId}|${triggerId}`)
				?? { need: null, denominator: null, slots: [] };
			for (const ref of input.refsByTrigger.get(triggerId) ?? []) {
				const j = judge(ref, gate, input.profile, input.squad, scope);
				reasons.push({
					triggerId, refKind: ref.refKind, refId: ref.refId,
					verdict: j.verdict,
					// **불충족은 언제나 확정이다** — 편성에 없으면 전투 중에도 안 생긴다.
					// 충족 쪽만 roster_gated 에서 「가능」으로 내려간다
					certainty: j.verdict === 'satisfied' && ref.evaluability === 'roster_gated'
						? 'possible' : 'certain',
					have: j.have, need: j.need,
					denominator: j.need === null ? null : gate.denominator ?? 'field',
				});
			}
		}

		const decidable = reasons.filter((r) => r.verdict !== 'unknown').length;
		const satisfied = reasons.filter((r) => r.verdict === 'satisfied').length;
		const certain = reasons.filter(
			(r) => r.verdict === 'satisfied' && r.certainty === 'certain',
		).length;
		// 참조가 하나도 없는 기프트는 C 다 — 「전부 판정 가능」이 아니라 「셀 것이 없다」
		const grade = reasons.length > 0 && decidable === reasons.length ? 'A'
			: decidable > 0 ? 'B' : 'C';
		// 하나라도 확정 미충족이면 이 편성에서 영영 안 켜진다
		const fireable = !reasons.some(
			(r) => r.verdict === 'unsatisfied' && r.certainty === 'certain',
		);

		out.push({
			giftId, grade, decidable, satisfied, certain,
			total: reasons.length, reasons, fireable,
		});
	}
	return out;
}
```

`judge` 의 시그니처에 `scope` 를 더하고 두 자리를 고친다.

```typescript
function judge(
	ref: TriggerRef,
	gate: Gate,
	profile: Profile,
	squad: Squad,
	/** 이 기프트의 자리 한정. 비어 있으면 편성 전체로 본다 */
	scope: readonly number[],
): { verdict: RefVerdict; have: number; need: number | null } {
	if (ref.evaluability === 'always') return { verdict: 'satisfied', have: 0, need: null };
	if (ref.evaluability === 'runtime' || ref.evaluability === 'unclassified') {
		return { verdict: 'unknown', have: 0, need: null };
	}
	// 참조 대상이 없으면 셀 것이 없다. 등급 규칙이 이것을 C 로 몬다
	if (ref.refKind === 'none') return { verdict: 'unknown', have: 0, need: null };

	const denom = gate.denominator ?? 'field';

	// 배치 — 출전 **순서**가 슬롯 번호다. 요구 슬롯 중 하나라도 차 있으면 켜진다
	if (ref.refKind === 'deployment') {
		if (gate.slots.length === 0) return { verdict: 'unknown', have: 0, need: null };
		const filled = gate.slots.filter((s) => s >= 1 && s <= squad.field.length).length;
		return { verdict: filled > 0 ? 'satisfied' : 'unsatisfied', have: filled, need: 1 };
	}

	// 공명 — `Any Resonance` 는 refId 가 비어 있어 죄악별 최댓값을 봐야 한다
	const have = ref.refKind === 'resonance' && ref.refId === ''
		? Math.max(...SINS.map((s) =>
			scope.length > 0
				? profile.countInSlots('resonance', s, scope)
				: profile.count('resonance', s, denom)))
		// **자리 한정이 있으면 그 자리 인격만 센다**(설계 2.4). 분모 지정보다 우선한다 —
		// 「1·2번 자리」가 「출전 전체」보다 좁은 한정이기 때문이다
		: scope.length > 0
			? profile.countInSlots(ref.refKind, ref.refId, scope)
			: profile.count(ref.refKind, ref.refId, denom);

	const need = gate.need ?? (ref.refKind === 'resonance' ? RESONANCE_MIN : 1);
	return { verdict: have >= need ? 'satisfied' : 'unsatisfied', have, need };
}
```

- [ ] **Step 5: 검사가 통과하는지 본다**

```bash
npx tsx --test lib/engine/v2/evaluate.test.ts
npm run typecheck
```

**타입 오류가 날 것이다** — `GiftVerdict` 에 `fireable` 이 필수라 `golden.test.ts` 나 다른 곳의 픽스처가 깨진다. 나오는 자리를 전부 고친다.

- [ ] **Step 6: 전체 검사와 골든**

```bash
npm test 2>&1 | grep -E "ℹ (tests|pass|fail|skipped)"
npm run golden:capture -- t3
npm run golden:compare -- before t3
```

**추천 3건이 달라져야 한다.** 자리 판정이 엄격해졌으므로 점수가 움직인다. 나머지 20건은 같아야 한다 — 다르면 엔진을 잘못 건드린 것이다.

- [ ] **Step 7: 커밋**

```bash
git add lib/engine/v2/
git commit -m "feat(engine): 켜질 수 없는 것을 판정하고 자리를 조건에 씌운다

GiftVerdict 에 fireable 을 더한다. 하나라도 미충족·확정이면 이 편성에서
영영 안 켜진다 — 편성에 없는 것은 전투 중에도 안 생기기 때문이다.

이것이 조건 결합 문제의 출구다. 「셋 중 둘이 맞았다」가 AND 인지 OR 인지는
데이터가 답하지 않지만(gift_effect 와 gift_trigger 를 잇는 표가 없다),
「하나가 확정 불가라 못 켠다」는 결합을 몰라도 참이다.

판정 불가는 false 로 안 만든다. 모른다와 못 켠다는 다르다.

자리 조건은 독립 효과가 아니라 다른 조건에 씌우는 한정자로 다룬다.
「[편성 1번, 2번 인격 전용 효과] 파열 … 을 부여하는 공격 스킬」이 한
문장이기 때문이다. 이것은 추론이며 데이터가 보장하지 않는다."
```

---

### Task 4: 점수가 `fireable` 을 존중한다

**Files:**
- Modify: `lib/engine/v2/score.ts`
- Modify: `lib/engine/v2/score.test.ts`
- Modify: `lib/queries/canonical/recommend.ts`

**Interfaces:**
- Consumes: Task 3 의 `GiftVerdict.fireable`
- Produces: `ScoreGift.fireable: boolean` · `PackLine.fireable` 은 만들지 않는다(기프트 단위다)

- [ ] **Step 1: 검사를 더한다**

`lib/engine/v2/score.test.ts` 끝에 붙인다. 위쪽의 `SUPPLY` 와 `gift` 헬퍼를 그대로 쓴다.

```typescript
test('켜질 수 없는 기프트는 후보에서 빠진다', () => {
	const dead = gift({
		keywordId: 'Combustion',
		total: 2,
		satisfied: 1,
		reasons: [
			{ verdict: 'satisfied', certainty: 'certain' },
			{ verdict: 'unsatisfied', certainty: 'certain' },
		],
		fireable: false,
	});
	const alive = gift({
		keywordId: 'Vibration',
		total: 1,
		satisfied: 1,
		reasons: [{ verdict: 'satisfied', certainty: 'certain' }],
	});
	const s = scorePack([dead, alive], SUPPLY);
	// 후보는 살아있는 하나뿐이다
	assert.equal(s.candidates, 1);
	assert.equal(s.fit, 6 / 7);
	assert.equal(s.live, 1);
});

test('전부 켜질 수 없으면 점수가 0 이다', () => {
	const s = scorePack([gift({ keywordId: 'Combustion', total: 1, fireable: false })], SUPPLY);
	assert.equal(s.candidates, 0);
	assert.equal(s.score, 0);
});
```

**`gift` 헬퍼의 기본값에 `fireable: true` 를 더해야 한다.** 헬퍼 정의를 찾아 고친다.

- [ ] **Step 2: 검사가 깨지는지 본다**

```bash
npx tsx --test lib/engine/v2/score.test.ts
```

기대: `fireable` 이 `ScoreGift` 에 없어 타입 오류 또는 단언 실패.

- [ ] **Step 3: `ScoreGift` 와 `scorePack` 을 고친다**

`lib/engine/v2/score.ts` 의 `ScoreGift` 에 더한다.

```typescript
	/**
	 * 이 편성에서 켜질 수 있나. **false 면 F · L · C 어디에도 안 들어간다**(설계 2.2).
	 *
	 * 목록에서 빼는 것이 아니라 **점수에서** 빼는 것이다. 왜 빠졌는지 볼 수 없으면
	 * 판정을 검증할 수 없으므로 근거 모달은 그대로 보여준다.
	 */
	fireable: boolean;
```

`scorePack` 의 첫 줄을 고친다.

```typescript
	// 보유는 다시 못 얻고, 켜질 수 없는 것은 고를 이유가 없다
	const pool = gifts.filter((g) => !g.owned && g.fireable);
```

- [ ] **Step 4: 질의가 `fireable` 을 넘긴다**

`lib/queries/canonical/recommend.ts` 의 `GiftLine` 에 더한다.

```typescript
	/** 이 편성에서 켜질 수 있나. false 면 점수에 안 들어간다 */
	fireable: boolean;
```

`gifts` 를 만드는 자리에 더한다. **판정이 없는 기프트는 트리거가 아예 없는 것이라 켜질 수 있다고 본다** — 못 켠다는 증거가 없다.

```typescript
				fireable: v?.fireable ?? true,
```

`scoreInput` 에 더한다.

```typescript
			fireable: g.fireable,
```

- [ ] **Step 5: 검사와 골든**

```bash
npx tsx --test lib/engine/v2/score.test.ts
npm run typecheck
npm test 2>&1 | grep -E "ℹ (tests|pass|fail|skipped)"
npm run golden:capture -- t4
npm run golden:compare -- t3 t4
```

**추천 3건이 또 달라진다.** 이번엔 후보가 줄어서다.

- [ ] **Step 6: 붕괴 감시 — 생존율을 잰다**

**설계 2.3 이 연 위험이다.** 너무 많이 빠지면 순위가 다시 안 갈린다.

```bash
cat > scripts/survival-check.ts <<'EOF'
const r = await import('../lib/queries/canonical/recommend.js');
const rec = await r.recommendForDeck('ko', { floor: 3, difficulty: 'hard' });
const rows = rec.packs.map((p) => {
  const alive = p.gifts.filter((g) => g.fireable).length;
  return { name: p.name ?? p.id, n: p.gifts.length, alive, ratio: alive / p.gifts.length };
});
for (const t of [...rows.slice(0, 3), ...rows.slice(-3)]) {
  console.log(`  ${String(t.alive).padStart(3)}/${String(t.n).padStart(3)} (${(t.ratio * 100).toFixed(0)}%)  ${t.name}`);
}
const rs = rows.map((t) => t.ratio);
console.log(`생존율 최소 ${(Math.min(...rs) * 100).toFixed(0)}% · 최대 ${(Math.max(...rs) * 100).toFixed(0)}%`);
console.log('1위', rec.packs[0]?.score.toFixed(4), rec.packs[0]?.name);
EOF
npx tsx --env-file-if-exists=.env scripts/survival-check.ts
rm -f scripts/survival-check.ts
```

**기대: 생존율이 70% 아래로 떨어지지 않는다.** 설계 2.3 의 실측은 75~98% 였고, 자리 판정이 엄격해졌으니 조금 더 낮아질 수 있다. **60% 아래면 멈추고 보고하라** — 모형이 붕괴한 것이다.

- [ ] **Step 7: 커밋**

```bash
git add lib/engine/v2/score.ts lib/engine/v2/score.test.ts lib/queries/canonical/recommend.ts
git commit -m "feat(score): 켜질 수 없는 기프트를 점수에서 뺀다

fireable === false 는 F 에도 L 에도 안 들어간다. 목록에서 빼는 것이 아니라
점수에서 빼는 것이다 — 왜 빠졌는지 볼 수 없으면 판정을 검증할 수 없다.

판정이 없는 기프트는 트리거가 아예 없는 것이라 켜질 수 있다고 본다.
못 켠다는 증거가 없다."
```

---

### Task 5: 전용 기프트를 무겁게 센다

**Files:**
- Modify: `lib/engine/v2/score.ts`
- Modify: `lib/engine/v2/score.test.ts`
- Modify: `lib/queries/canonical/recommend.ts`

**Interfaces:**
- Consumes: Task 4 의 `ScoreGift`
- Produces: `ScoreGift.exclusive: boolean` · `fitOf(keywordId, supply, exclusive)`

- [ ] **Step 1: 검사를 더한다**

`lib/engine/v2/score.test.ts` 끝에 붙인다.

```typescript
test('전용은 온전히, 범용은 반으로 친다', () => {
	// 화상은 최대 축이라 축 비가 1.0 이다. 전용/범용만 갈린다
	assert.equal(fitOf('Combustion', SUPPLY, true), 1);
	assert.equal(fitOf('Combustion', SUPPLY, false), 0.5);
});

test('전용 가중은 축 비에 곱해진다 — 안 맞는 축이면 전용이어도 작다', () => {
	assert.equal(fitOf('Bullet', SUPPLY, true), 3 / 7);
	assert.equal(fitOf('Bullet', SUPPLY, false), 3 / 14);
});

test('덱에 없는 축은 전용이어도 0 이다', () => {
	assert.equal(fitOf('Sinking', SUPPLY, true), 0);
});

test('팩 점수가 전용 여부를 반영한다', () => {
	const ex = gift({ keywordId: 'Combustion', total: 1, satisfied: 1, reasons: [{ verdict: 'satisfied', certainty: 'certain' }], exclusive: true });
	const gen = gift({ keywordId: 'Combustion', total: 1, satisfied: 1, reasons: [{ verdict: 'satisfied', certainty: 'certain' }] });
	assert.equal(scorePack([ex], SUPPLY).fit, 1);
	assert.equal(scorePack([gen], SUPPLY).fit, 0.5);
	assert.equal(scorePack([ex, gen], SUPPLY).fit, 0.75);
});
```

**`gift` 헬퍼의 기본값에 `exclusive: false` 를 더한다.**

- [ ] **Step 2: 검사가 깨지는지 본다**

```bash
npx tsx --test lib/engine/v2/score.test.ts
```

기대: `fitOf` 가 인자 셋을 안 받아 실패.

- [ ] **Step 3: `fitOf` 와 `ScoreGift` 를 고친다**

`lib/engine/v2/score.ts` — `fitOf` 의 주석에 한 문단을 더하고 인자를 늘린다.

```typescript
/**
 * 이 키워드가 내 덱에 얼마나 맞나. 0~1.
 *
 * 축 id 는 키워드 id 의 대문자다(`Combustion` → `COMBUSTION`). 다리 표가 따로
 * 없고 필요도 없다 — `canonical/squad.ts` 와 같은 판정이다.
 *
 * **축이 아닌 키워드는 0 이다.** 키워드 표에 공격 타입 3종(`Slash` · `Penetrate` ·
 * `Hit`)과 `Random` · `None` 이 섞여 있다.
 *
 * **범용은 반으로 친다**(설계 3.2). 아무 팩에서나 얻을 수 있는 것은 이 팩을 고를
 * 이유가 못 된다 — 팩당 전용이 3~7개(5~9%)이고 나머지 90%는 어디서나 나온다.
 * 아무 편성에서나 켜지는 조건이 변별을 죽인 것과 같은 구조다.
 */
export function fitOf(
	keywordId: string | null,
	supply: AxisSupply,
	exclusive: boolean,
): number {
	if (keywordId === null || supply.max === 0) return 0;
	const axis = (supply.counts.get(keywordId.toUpperCase()) ?? 0) / supply.max;
	return axis * (exclusive ? 1 : HALF);
}
```

`ScoreGift` 에 더한다.

```typescript
	/** 이 팩에서만 얻을 수 있나. 범용은 반으로 친다 */
	exclusive: boolean;
```

`scorePack` 의 `fit` 계산을 고친다.

```typescript
	const fit = pool.reduce((s, g) => s + fitOf(g.keywordId, supply, g.exclusive), 0) / pool.length;
```

- [ ] **Step 4: 질의가 전용 표를 읽는다**

`lib/queries/canonical/recommend.ts` — `packRows` 질의 **뒤에** 더한다. 후보 팩에 걸린 전용만 가져온다.

```typescript
	/**
	 * 이 팩에서만 얻는 기프트. **팩마다 다르다** — 같은 기프트가 A 팩 전용이면서
	 * B 팩에서는 범용일 수 있으므로 `기프트|팩` 짝으로 담는다.
	 */
	const exclusiveRows = await canonical.giftExclusivePack.findMany({
		where: { packId: { in: packIds } },
		select: { giftId: true, packId: true },
	});
	const exclusiveSet = new Set(exclusiveRows.map((r) => `${r.giftId}|${r.packId}`));
```

`GiftLine` 에 더한다.

```typescript
	/** 이 팩에서만 얻을 수 있나 */
	exclusive: boolean;
```

`gifts` 를 만드는 자리에 더한다.

```typescript
				exclusive: exclusiveSet.has(`${row.giftId}|${p.id}`),
```

`scoreInput` 에 더한다.

```typescript
			exclusive: g.exclusive,
```

- [ ] **Step 5: 검사와 골든**

```bash
npx tsx --test lib/engine/v2/score.test.ts
npm run typecheck
npm test 2>&1 | grep -E "ℹ (tests|pass|fail|skipped)"
npm run golden:capture -- t5
npm run golden:compare -- t4 t5
```

**추천 3건이 달라지고 나머지 20건은 같아야 한다.**

- [ ] **Step 6: 커밋**

```bash
git add lib/engine/v2/score.ts lib/engine/v2/score.test.ts lib/queries/canonical/recommend.ts
git commit -m "feat(score): 전용 기프트를 온전히, 범용을 반으로 센다

팩당 전용이 3~7개(5~9%)이고 나머지 90%는 어느 팩에서나 나온다. 그것들은
이 팩을 고를 이유가 못 된다 — 아무 편성에서나 켜지는 조건이 변별을 죽인
것과 같은 구조다.

새 저울추가 아니다. 기존 「한 단계 멀어지면 반」 규칙을 그대로 쓴다.

전용은 팩마다 다르다. 같은 기프트가 A 팩 전용이면서 B 팩에서는 범용일 수
있으므로 기프트|팩 짝으로 담는다."
```

---

### Task 6: 합성 도달 — 순수 함수

**Files:**
- Create: `lib/engine/v2/fusion.ts`
- Create: `lib/engine/v2/fusion.test.ts`

**Interfaces:**
- Consumes: 없음 (순수)
- Produces:
  - `Recipe` — `{ giftId: string; slots: ReadonlyArray<ReadonlyArray<string>> }`
  - `reachOf(recipe: Recipe, have: ReadonlySet<string>): number`

- [ ] **Step 1: 검사를 먼저 쓴다**

`lib/engine/v2/fusion.test.ts`:

```typescript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { reachOf, type Recipe } from './fusion.js';

/** 서릿발 발자국 = 귀신 들린 신발 + 얼어붙은 아우성. 실제 레시피다 */
const FROST: Recipe = { giftId: '9410', slots: [['9408'], ['9409']] };

test('재료가 다 있으면 완성이다', () => {
	assert.equal(reachOf(FROST, new Set(['9408', '9409'])), 1);
});

test('한 개 모자라면 반이다', () => {
	assert.equal(reachOf(FROST, new Set(['9408'])), 0.5);
	assert.equal(reachOf(FROST, new Set(['9409'])), 0.5);
});

test('둘 모자라면 4분의 1 — 한 단계 멀어지면 반이다', () => {
	const three: Recipe = { giftId: 'X', slots: [['a'], ['b'], ['c']] };
	assert.equal(reachOf(three, new Set(['a'])), 0.25);
	assert.equal(reachOf(three, new Set(['a', 'b'])), 0.5);
	assert.equal(reachOf(three, new Set(['a', 'b', 'c'])), 1);
});

test('하나도 없으면 0 이다 — 반의 거듭제곱으로 안 내려간다', () => {
	assert.equal(reachOf(FROST, new Set()), 0);
	const three: Recipe = { giftId: 'X', slots: [['a'], ['b'], ['c']] };
	assert.equal(reachOf(three, new Set()), 0);
});

test('선택지형 칸은 하나라도 있으면 찬 것이다', () => {
	// 실측 1건. material_id 가 null 이고 fusion_slot_option 이 후보를 담는다
	const opt: Recipe = { giftId: 'Y', slots: [['p', 'q', 'r'], ['s']] };
	assert.equal(reachOf(opt, new Set(['q', 's'])), 1);
	assert.equal(reachOf(opt, new Set(['r'])), 0.5);
});

test('칸이 없는 레시피는 0 이다 — 지어내지 않는다', () => {
	assert.equal(reachOf({ giftId: 'Z', slots: [] }, new Set(['a'])), 0);
});
```

- [ ] **Step 2: 검사가 깨지는지 본다**

```bash
npx tsx --test lib/engine/v2/fusion.test.ts
```

기대: `Cannot find module './fusion.js'` 로 실패.

- [ ] **Step 3: `fusion.ts` 를 쓴다**

`lib/engine/v2/fusion.ts`:

```typescript
/**
 * 합성 도달 — 설계 4절.
 *
 * **층이 서로 이어지는 자리다.** 1층에서 「공장 자동화」를 골라 귀신 들린 신발을
 * 얻었으면 2층의 「사랑할 수 없는」이 갑자기 값어치가 생긴다 — 둘을 합쳐 서릿발
 * 발자국이 되고, 그것은 `gift_pack` 에 없어 합성이 유일한 경로다.
 *
 * **런 이력은 필요 없다.** 이미 보유를 입력받으므로 「보유 + 이 팩으로 재료가
 * 얼마나 모이나」로 좁혀진다.
 *
 * **DB 를 모른다.** 순수 함수라 검사가 DB 없이 돈다.
 */

/** 한 단계 멀어지면 반. `score.ts` 의 것과 같은 규칙이다 */
const HALF = 0.5;

/**
 * 레시피 하나.
 *
 * `slots` 의 한 원소가 한 칸이고, 그 안의 배열이 **그 칸을 채울 수 있는 재료들**이다.
 * 대개 하나지만 선택지형 칸이 실측 1건 있다 — `material_id` 가 null 이고
 * `fusion_slot_option` 이 후보 7종을 담는다.
 */
export interface Recipe {
	giftId: string;
	slots: ReadonlyArray<ReadonlyArray<string>>;
}

/**
 * 이 레시피에 얼마나 가까운가. 0 또는 `0.5 ** 모자란칸수`.
 *
 * **모자란 칸 수만큼 반씩 깎는다** — 완성 1.0, 하나 모자람 0.5, 둘 모자람 0.25,
 * 셋 모자람 0.125. 레시피가 최대 4칸이므로 0.125 까지 난다.
 * 새 저울추가 아니라 「한 단계 멀어지면 반」의 거듭제곱이다.
 *
 * **하나도 안 모였으면 0 이다.** 거듭제곱을 끝까지 밀면 재료 넷짜리에서 0.0625 가
 * 남는데, 그건 「가깝다」가 아니라 「아무 관계 없다」이므로 0 으로 끊는다.
 */
export function reachOf(recipe: Recipe, have: ReadonlySet<string>): number {
	if (recipe.slots.length === 0) return 0;
	let filled = 0;
	for (const options of recipe.slots) {
		// 선택지형 칸은 하나라도 있으면 찬 것으로 센다
		if (options.some((m) => have.has(m))) filled += 1;
	}
	if (filled === 0) return 0;
	const missing = recipe.slots.length - filled;
	return HALF ** missing;
}
```

- [ ] **Step 4: 검사가 통과하는지 본다**

```bash
npx tsx --test lib/engine/v2/fusion.test.ts
npm run typecheck
```

기대: 6건 전부 pass · 0 fail · 타입 통과.

- [ ] **Step 5: 커밋**

```bash
git add lib/engine/v2/fusion.ts lib/engine/v2/fusion.test.ts
git commit -m "feat(engine): 합성 도달 — 순수 함수

층이 서로 이어지는 자리다. 1층에서 공장 자동화를 골라 귀신 들린 신발을
얻었으면 2층의 사랑할 수 없는이 값어치가 생긴다 — 둘이 서릿발 발자국이
되고 그것은 gift_pack 에 없어 합성이 유일한 경로다.

런 이력은 필요 없다. 이미 보유를 입력받으므로 「보유 + 이 팩으로 재료가
얼마나 모이나」로 좁혀진다.

모자란 칸 수만큼 반씩 깎되 하나도 안 모였으면 0 이다. 거듭제곱을 끝까지
밀면 재료 넷짜리에서 0.0625 가 남는데 그건 「가깝다」가 아니라 「아무 관계
없다」이므로 끊는다.

선택지형 칸은 하나라도 있으면 찬 것으로 센다. 실측 1건이다."
```

---

### Task 7: 합성 데이터를 싣고 `C` 항을 더한다

**Files:**
- Modify: `lib/engine/v2/load.ts`
- Modify: `lib/engine/v2/score.ts`
- Modify: `lib/engine/v2/score.test.ts`
- Modify: `lib/queries/canonical/recommend.ts`
- Modify: `scripts/golden-queries.ts` (Step 6 — `summarize` 에 `fusion` 추가)

**Interfaces:**
- Consumes: Task 6 의 `Recipe` · `reachOf`, Task 5 의 `fitOf`
- Produces:
  - `EngineData.recipes: Recipe[]`
  - `fusionOf(input): number`
  - `PackScore.fusion: number` · `PackLine.fusion: number`

- [ ] **Step 1: 검사를 더한다**

`lib/engine/v2/score.test.ts` 끝에 붙인다.

```typescript
test('합성 항은 도달과 결과물 적합도의 곱이다', () => {
	const recipes = [{ giftId: 'R', slots: [['a'], ['b']] }];
	// 결과물 R 은 화상 전용이라 fit 1.0
	const resultFit = new Map([['R', 1]]);
	// 이 팩에 a 가 있고 보유에 b 가 있다 → 완성
	const c = fusionOf({
		recipes,
		resultFit,
		have: new Set(['a', 'b']),
		owned: new Set<string>(),
		candidates: 2,
	});
	assert.equal(c, 0.5); // (1.0 도달 × 1.0 fit) / 후보 2
});

test('절반만 모이면 절반만 친다', () => {
	const c = fusionOf({
		recipes: [{ giftId: 'R', slots: [['a'], ['b']] }],
		resultFit: new Map([['R', 1]]),
		have: new Set(['a']),
		owned: new Set<string>(),
		candidates: 1,
	});
	assert.equal(c, 0.5);
});

test('이미 보유한 결과물은 안 센다 — 다시 만들 이유가 없다', () => {
	const c = fusionOf({
		recipes: [{ giftId: 'R', slots: [['a'], ['b']] }],
		resultFit: new Map([['R', 1]]),
		have: new Set(['a', 'b']),
		owned: new Set(['R']),
		candidates: 1,
	});
	assert.equal(c, 0);
});

test('결과물이 덱과 안 맞으면 도달해도 작다', () => {
	const c = fusionOf({
		recipes: [{ giftId: 'R', slots: [['a'], ['b']] }],
		resultFit: new Map([['R', 0]]),
		have: new Set(['a', 'b']),
		owned: new Set<string>(),
		candidates: 1,
	});
	assert.equal(c, 0);
});

test('후보가 0 이면 0 이다 — 나누기 0 을 안 만든다', () => {
	const c = fusionOf({
		recipes: [{ giftId: 'R', slots: [['a'], ['b']] }],
		resultFit: new Map([['R', 1]]),
		have: new Set(['a', 'b']),
		owned: new Set<string>(),
		candidates: 0,
	});
	assert.equal(c, 0);
});

test('점수는 (적합도 + 합성) × 켜짐이다', () => {
	const g = gift({
		keywordId: 'Combustion',
		total: 2,
		satisfied: 1,
		reasons: [
			{ verdict: 'satisfied', certainty: 'certain' },
			{ verdict: 'unsatisfied', certainty: 'possible' },
		],
		exclusive: true,
	});
	// fit 1.0 · live 1/2 · fusion 0.25 → (1 + 0.25) × 0.5
	const s = scorePack([g], SUPPLY, 0.25);
	assert.equal(s.fit, 1);
	assert.equal(s.live, 0.5);
	assert.equal(s.fusion, 0.25);
	assert.equal(s.score, 0.625);
});
```

**`import` 에 `fusionOf` 를 합쳐 넣는다.** 새 import 문을 만들지 마라.

- [ ] **Step 2: 검사가 깨지는지 본다**

```bash
npx tsx --test lib/engine/v2/score.test.ts
```

기대: `fusionOf is not exported` 류로 실패.

- [ ] **Step 3: `score.ts` 에 `fusionOf` 와 `fusion` 을 더한다**

`lib/engine/v2/score.ts` 에 붙인다. 파일 위쪽 import 에 `import { reachOf, type Recipe } from './fusion.js';` 를 더한다.

```typescript
/**
 * 합성으로 얻는 몫.
 *
 * **`F` 와 같은 분모(후보 기프트 수)를 쓴다.** 둘을 더해야 하고, 레시피 수로
 * 나누면 큰 팩이 유리해지기 때문이다.
 *
 * **레시피 전부를 훑는다.** 도달이 0 이면 안 더해지므로 실질적으로 이 팩이
 * 기여하는 것만 남는다.
 */
export function fusionOf(input: {
	recipes: ReadonlyArray<Recipe>;
	/** 결과물 기프트 id → 그 기프트의 fit. 덱과 안 맞으면 0 이다 */
	resultFit: ReadonlyMap<string, number>;
	/** 보유 ∪ 이 팩의 기프트 */
	have: ReadonlySet<string>;
	/** 이미 보유한 기프트. 결과물을 이미 갖고 있으면 안 센다 */
	owned: ReadonlySet<string>;
	candidates: number;
}): number {
	if (input.candidates === 0) return 0;
	let sum = 0;
	for (const r of input.recipes) {
		// 이미 가진 것을 또 만들 이유가 없다
		if (input.owned.has(r.giftId)) continue;
		const fit = input.resultFit.get(r.giftId) ?? 0;
		if (fit === 0) continue;
		sum += reachOf(r, input.have) * fit;
	}
	return sum / input.candidates;
}
```

`PackScore` 에 더한다.

```typescript
	/** 합성으로 얻는 몫. `fit` 과 같은 분모다 */
	fusion: number;
```

`scorePack` 의 시그니처와 반환을 고친다.

```typescript
export function scorePack(
	gifts: ReadonlyArray<ScoreGift>,
	supply: AxisSupply,
	/** `fusionOf` 가 낸 값. 호출자가 미리 셈해 넘긴다 — 레시피가 팩 밖의 것이라서다 */
	fusion = 0,
): PackScore {
	const pool = gifts.filter((g) => !g.owned && g.fireable);
	const rankable = supply.max > 0;
	if (pool.length === 0) {
		return { fit: 0, live: 0, fusion: 0, score: 0, candidates: 0, rankable };
	}

	const fit = pool.reduce((s, g) => s + fitOf(g.keywordId, supply, g.exclusive), 0) / pool.length;

	// 발동 조건이 없는 기프트는 분모에서 빠진다. 0 으로 세지 않는다
	const total = pool.reduce((s, g) => s + g.total, 0);
	const live = total > 0 ? pool.reduce((s, g) => s + liveOf(g), 0) / total : 0;

	return {
		fit,
		live,
		fusion,
		// **안쪽은 합, 바깥은 곱**(설계 5절). F 와 C 는 둘 다 「이 팩에서 무엇을
		// 얻나」를 답하고, L 은 「그것이 내 편성에서 도나」라 성격이 다르다
		score: rankable ? (fit + fusion) * live : 0,
		candidates: pool.length,
		rankable,
	};
}
```

- [ ] **Step 4: `load.ts` 가 합성 세 표를 싣는다**

`lib/engine/v2/load.ts` 의 `Promise.all` 배열에 셋을 더하고 `EngineData` 에 `recipes` 를 더한다.

```typescript
		prisma.fusionSlot.findMany({
			select: { giftId: true, recipeIdx: true, slotIdx: true, materialId: true },
			orderBy: [{ giftId: 'asc' }, { recipeIdx: 'asc' }, { slotIdx: 'asc' }],
		}),
		prisma.fusionSlotOption.findMany({
			select: { giftId: true, recipeIdx: true, slotIdx: true, materialId: true },
			orderBy: [{ giftId: 'asc' }, { recipeIdx: 'asc' }, { slotIdx: 'asc' }],
		}),
```

받은 뒤 레시피로 접는다.

```typescript
	/**
	 * 레시피를 칸 단위로 접는다.
	 *
	 * `material_id` 가 있으면 그 칸의 재료는 하나다. null 이면 선택지형이고
	 * `fusion_slot_option` 이 후보를 담는다(실측 1건).
	 */
	const optionsBySlot = new Map<string, string[]>();
	for (const o of fusionOption) {
		const k = `${o.giftId}|${o.recipeIdx}|${o.slotIdx}`;
		optionsBySlot.set(k, [...(optionsBySlot.get(k) ?? []), o.materialId]);
	}
	const slotsByRecipe = new Map<string, string[][]>();
	for (const s of fusionSlot) {
		const k = `${s.giftId}|${s.recipeIdx}`;
		const opts = s.materialId !== null
			? [s.materialId]
			: optionsBySlot.get(`${s.giftId}|${s.recipeIdx}|${s.slotIdx}`) ?? [];
		slotsByRecipe.set(k, [...(slotsByRecipe.get(k) ?? []), opts]);
	}
	const recipes: Recipe[] = [...slotsByRecipe].map(([k, slots]) => ({
		giftId: k.split('|')[0] as string,
		slots,
	}));
```

`EngineData` 에 `recipes: Recipe[]` 를 더하고 반환에 넣는다. 파일 위쪽에 `import type { Recipe } from './fusion.js';` 를 더한다.

**`fusionRecipe` 표는 안 읽는다** — `fusion_slot` 이 `gift_id` 와 `recipe_idx` 를 이미 갖고 있어 레시피를 복원할 수 있다. 칸이 하나도 없는 레시피는 도달이 0 이라 셈에 영향이 없다.

- [ ] **Step 5: 질의가 `C` 를 셈해 넘긴다**

`lib/queries/canonical/recommend.ts` — `PackLine` 에 더한다.

```typescript
	/** 합성으로 얻는 몫 */
	fusion: number;
```

팩 순회 **앞**에 결과물 적합도 표를 만든다. 결과물이 팩 밖에 있을 수 있으므로 따로 조회한다.

```typescript
	// 합성 결과물의 적합도. **결과물은 팩 밖에 있을 수 있다** — 합성으로만 얻는
	// 59종은 gift_pack 에 아예 없다
	const resultIds = [...new Set(data.recipes.map((r) => r.giftId))];
	const resultGifts = await canonical.gift.findMany({
		where: { id: { in: resultIds } },
		select: { id: true, keywordId: true },
		orderBy: { id: 'asc' },
	});
	// 결과물의 전용 여부는 팩과 무관하게 본다 — 합성 결과는 팩에서 안 나오므로
	// 「이 팩에서만」이라는 물음이 성립하지 않는다. 전용으로 친다
	const resultFit = new Map(
		resultGifts.map((g) => [g.id, fitOf(g.keywordId, axisSupply, true)]),
	);
	const ownedSetStr = new Set(ownedIds.map(String));
```

팩 순회 안, `scorePack` 을 부르기 전에 더한다.

```typescript
		// 보유 ∪ 이 팩. 「이 팩을 고르면 재료가 얼마나 모이나」를 묻는다
		const have = new Set([...ownedSetStr, ...p.gifts.map((row) => row.giftId)]);
		const fusion = fusionOf({
			recipes: data.recipes,
			resultFit,
			have,
			owned: ownedSetStr,
			candidates: scoreInput.filter((g) => !g.owned && g.fireable).length,
		});
		const s = scorePack(scoreInput, axisSupply, fusion);
```

반환에 `fusion: s.fusion,` 을 더한다. 파일 위쪽 import 에 `fitOf` · `fusionOf` 를 합쳐 넣는다.

- [ ] **Step 6: 검사와 골든**

```bash
npx tsx --test lib/engine/v2/score.test.ts
npm run typecheck
npm test 2>&1 | grep -E "ℹ (tests|pass|fail|skipped)"
npm run golden:capture -- t7
npm run golden:compare -- t5 t7
```

**추천 3건이 달라지고 나머지 20건은 같아야 한다.**

**골든 요약에 `fusion` 을 더한다** — `scripts/golden-queries.ts` 의 `summarize` 에 `fusion: Number(p.fusion.toFixed(6)),` 를 넣는다. 안 넣으면 이 항의 회귀를 못 잡는다.

- [ ] **Step 7: 상식 검사 — 서릿발 발자국**

```bash
cat > scripts/fusion-check.ts <<'EOF'
const r = await import('../lib/queries/canonical/recommend.js');
// 공장 자동화(1004)는 1·2층 팩이다. 보유에 얼어붙은 아우성(9409)을 넣으면
// 이 팩으로 서릿발 발자국(9410)이 완성된다
const withMat = await r.recommendForDeck('ko', { floor: 1, difficulty: 'hard', ownedIds: [9409] });
const without = await r.recommendForDeck('ko', { floor: 1, difficulty: 'hard' });
const find = (rec: Awaited<ReturnType<typeof r.recommendForDeck>>) =>
  rec.packs.find((p) => p.id === '1004');
console.log('보유 없음  fusion', find(without)?.fusion.toFixed(4), '· 점수', find(without)?.score.toFixed(4));
console.log('9409 보유  fusion', find(withMat)?.fusion.toFixed(4), '· 점수', find(withMat)?.score.toFixed(4));
console.log('순위 (보유 없음)', without.packs.findIndex((p) => p.id === '1004') + 1, '/', without.packs.length);
console.log('순위 (9409 보유)', withMat.packs.findIndex((p) => p.id === '1004') + 1, '/', withMat.packs.length);
EOF
npx tsx --env-file-if-exists=.env scripts/fusion-check.ts
rm -f scripts/fusion-check.ts
```

**기대: 9409 를 보유하면 「공장 자동화」의 `fusion` 이 오르고 순위가 올라간다.** 안 오르면 합성 항이 안 도는 것이다 — 멈추고 보고하라.

- [ ] **Step 8: 커밋**

```bash
git add lib/engine/v2/ lib/queries/canonical/recommend.ts scripts/golden-queries.ts
git commit -m "feat(score): 합성 도달을 점수에 더한다 — (F + C) × L

합성으로만 얻는 59종이 gift_pack 에 없어 지금까지 점수에 한 번도 안 잡혔다.
층이 서로 이어지는데 층마다 독립으로 평가하고 있었다.

안쪽은 합, 바깥은 곱이다. F 와 C 는 둘 다 「이 팩에서 무엇을 얻나」를 답하고
(직접 얻는 것과 합성으로 얻는 것), L 은 「그것이 내 편성에서 도나」라 성격이
다르다.

C 의 분모는 레시피 수가 아니라 후보 기프트 수다. F 와 같은 분모라야 둘을
더할 수 있고 큰 팩이 유리해지는 것도 막는다.

결과물의 전용 여부는 팩과 무관하게 전용으로 친다 — 합성 결과는 팩에서 안
나오므로 「이 팩에서만」이라는 물음이 성립하지 않는다.

fusion_recipe 표는 안 읽는다. fusion_slot 이 gift_id 와 recipe_idx 를 이미
갖고 있어 레시피를 복원할 수 있다."
```

---

### Task 8: 근거 모달

**Files:**
- Create: `components/gift-evidence.tsx`
- Modify: `app/[locale]/recommend/page.tsx`

**Interfaces:**
- Consumes: Task 7 의 `PackLine` (`gifts` · `score` · `fit` · `live` · `fusion`)
- Produces: 없음 (화면)

**계측기다. 대충 만들고 나중에 제거한다**(설계 7절). 레이아웃·색·간격에 공들이지 않는다.

- [ ] **Step 1: 모달 컴포넌트를 쓴다**

`components/gift-evidence.tsx` — **클라이언트 컴포넌트다.** `<dialog>` 를 쓰면 브라우저가 모달 동작을 준다.

```tsx
'use client';

import { useRef } from 'react';

/**
 * 판정 근거 전량 조회 — **계측기다**(설계 7절).
 *
 * 팩당 상위 5만 보면 왜 이 순위인지 검증할 수 없다. 여기서는 그 팩의 기프트를
 * 전부 내고 조건마다 충족/미충족/확정을 그대로 보인다. **왜 0.0 인지가 보여야 한다.**
 *
 * **대충 만들고 나중에 제거한다.** 레이아웃·색·간격에 공들이지 않는다 —
 * 정보 제공 화면의 디자인 작업은 별도 세션의 몫이고 이 모달은 그 대상이 아니다.
 */
export interface EvidenceGift {
	id: number;
	name: string | null;
	grade: 'A' | 'B' | 'C';
	fireable: boolean;
	exclusive: boolean;
	keywordId: string | null;
	satisfied: number;
	decidable: number;
	total: number;
	chainDepth: number | null;
	reasons: ReadonlyArray<{
		triggerId: string;
		refKind: string;
		refId: string;
		verdict: string;
		certainty: string;
		have: number;
		need: number | null;
	}>;
}

export function GiftEvidence({
	packName,
	gifts,
	label,
}: {
	packName: string;
	gifts: ReadonlyArray<EvidenceGift>;
	label: string;
}) {
	const ref = useRef<HTMLDialogElement>(null);
	const dead = gifts.filter((g) => !g.fireable).length;

	return (
		<>
			<button type="button" className="chip" onClick={() => ref.current?.showModal()}>
				{label}
			</button>
			<dialog ref={ref} style={{ maxWidth: '52rem', width: '90vw' }}>
				<form method="dialog">
					<button type="submit" className="chip">닫기</button>
				</form>
				<h3>{packName}</h3>
				<p className="card-meta">
					{`기프트 ${gifts.length} · 켜질 수 없음 ${dead}`}
				</p>
				<ul className="plain">
					{gifts.map((g) => (
						<li key={g.id} style={{ marginBottom: '0.75rem' }}>
							<strong>{`[${g.fireable ? g.grade : 'X'}] ${g.name ?? g.id}`}</strong>
							<span className="card-meta">
								{` ${g.satisfied}/${g.decidable} (전체 ${g.total})`}
								{g.keywordId !== null ? ` · ${g.keywordId}` : ''}
								{g.exclusive ? ' · 전용' : ''}
								{g.chainDepth !== null ? ` · 연쇄 ${g.chainDepth}홉` : ''}
								{!g.fireable ? ' · 켜질 수 없음' : ''}
							</span>
							<ul className="comp">
								{g.reasons.map((r, i) => (
									<li key={i}>
										<span className="comp-k">{`${r.triggerId} · ${r.refKind}:${r.refId}`}</span>
										<span className="comp-v">
											{`${r.verdict}/${r.certainty} ${r.have}${r.need !== null ? `/${r.need}` : ''}`}
										</span>
									</li>
								))}
							</ul>
						</li>
					))}
				</ul>
			</dialog>
		</>
	);
}
```

- [ ] **Step 2: 화면이 모달을 단다**

`app/[locale]/recommend/page.tsx` — 위쪽 import 에 더한다.

```typescript
import { GiftEvidence } from '@/components/gift-evidence';
```

분해 줄 아래, A등급 상위 5 목록 **뒤**에 더한다. 기존 `{p.tally.A === 0 ? … : …}` 블록을 건드리지 말고 그 다음에 붙인다.

```tsx
										<GiftEvidence
											packName={p.name ?? p.id}
											gifts={p.gifts}
											label={ko ? `… 전체 ${p.gifts.length}개 근거` : `… all ${p.gifts.length}`}
										/>
```

분해 줄에 `합성` 을 더한다.

```tsx
												{ko
													? `${p.score.toFixed(3)} — 적합 ${p.fit.toFixed(3)} + 합성 ${p.fusion.toFixed(3)} × 켜짐 ${p.live.toFixed(3)}`
													: `${p.score.toFixed(3)} — fit ${p.fit.toFixed(3)} + fusion ${p.fusion.toFixed(3)} × live ${p.live.toFixed(3)}`}
```

- [ ] **Step 3: 타입 검사와 빌드**

```bash
npm run typecheck
npm run build 2>&1 | grep -E "Compiled|error|Failed" | head -5
```

기대: 타입 통과 · `✓ Compiled successfully`.

**`GiftLine` 이 `EvidenceGift` 를 만족하는지 확인한다.** 안 맞으면 `EvidenceGift` 를 `GiftLine` 에 맞춰 좁힌다 — 화면이 질의 모양을 따른다.

- [ ] **Step 4: 커밋**

```bash
git add components/gift-evidence.tsx "app/[locale]/recommend/page.tsx"
git commit -m "feat(web): 근거 모달 — 판정 전량 조회

팩당 상위 5만 보면 왜 이 순위인지 검증할 수 없다. 말줄임표를 누르면 그 팩의
기프트를 전부 내고 조건마다 충족/미충족/확정을 그대로 보인다. 왜 0.0 인지가
보여야 한다.

계측기다. 대충 만들고 나중에 제거한다 — 레이아웃·색·간격에 공들이지 않는다.

분해 줄에 합성 항을 더한다."
```

---

### Task 9: 앱을 띄워 확인한다

**앞 PR 에서 이 단계가 진짜 버그를 잡았다.** 질의를 직접 부르면 정상인데 화면만 틀렸다.

**Files:** 없음. **코드를 안 고친다.**

- [ ] **Step 1: 개발 서버를 띄운다**

```bash
lsof -ti:3210 | xargs kill 2>/dev/null || true
PORT=3210 npm run dev > /tmp/dev-v2.log 2>&1 &
sleep 12
grep -E "Ready in|Error" /tmp/dev-v2.log | head -3
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

- [ ] **Step 3: 죽음바라기가 사라졌는지 본다**

**이 PR 의 출발점이다.** 사용자가 7층 「LCB 정기검진」 2위 팩의 근거로 봤다.

```bash
curl -s "http://localhost:3210/ko/recommend?floor=7" > /tmp/rec7.html
python3 -c "
import re, html
s = open('/tmp/rec7.html', encoding='utf-8').read()
t = re.sub(r'<script.*?</script>', '', s, flags=re.S)
t = html.unescape(re.sub(r'\s+', ' ', re.sub(r'<[^>]+>', ' ', t)))
print('죽음바라기 등장', t.count('죽음바라기'))
m = re.findall(r'0\.\d{3} — 적합 0\.\d{3} \+ 합성 0\.\d{3} × 켜짐 0\.\d{3}', t)
print('분해 줄', len(m), m[:2])
"
```

**기대: 상위 5 근거에 죽음바라기가 0회.** 모달 안에는 「켜질 수 없음」으로 남아 있어야 하지만, 그것은 페이로드에 있고 이 추출은 서버 렌더 텍스트만 본다.

- [ ] **Step 4: 모달이 실제로 열리는지 본다**

`<dialog>` 는 클라이언트에서 열린다. **HTML 에 내용이 들어 있는지**만 확인한다.

```bash
curl -s "http://localhost:3210/ko/recommend" | grep -c "전체 .*개 근거"
```

기대: 후보 팩 수만큼(3층이면 27). 0 이면 모달이 안 달린 것이다.

- [ ] **Step 5: 서버 로그와 정리**

```bash
grep -ciE "error|unhandled|⨯" /tmp/dev-v2.log
pkill -f "next dev" || true
rm -f /tmp/dev-v2.log /tmp/rec7.html
```

기대: 오류 `0`.

---

### Task 10: 문서와 PR

**Files:**
- Modify: `docs/superpowers/specs/2026-08-09-pack-scoring-v2-design.md`
- Modify: `docs/superpowers/plans/2026-08-09-pack-scoring-v2.md`

- [ ] **Step 1: 설계에 구현 결과를 더한다**

10절 뒤에 「## 11. 구현 결과」를 더한다. **Task 1·4·7·9 에서 실제로 나온 값을 적는다.** 계획서 숫자를 옮겨 적지 마라.

담을 것 — 오간 파일, 검사 수 변화, 골든 단계별 순위 이동(before → t3 → t4 → t5 → t7 의 1위와 점수), 팩별 생존율, 서릿발 발자국 상식 검사 결과, 앱 확인 결과.

**골든 단계별 대조가 이 PR 의 핵심 산출물이다.** 어느 변경이 순위를 얼마나 움직였는지 표로 남긴다.

- [ ] **Step 2: 계획서 단계를 완료로 표시한다**

```bash
python3 - <<'PY'
p = 'docs/superpowers/plans/2026-08-09-pack-scoring-v2.md'
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

기대: 타입 통과 · 0 fail · `✓ Compiled successfully` · `검사 222건 전부 통과` · `git status` 는 커밋 뒤 비어 있다.

- [ ] **Step 4: 커밋하고 PR 을 올린다**

```bash
git add docs/
git commit -m "docs: 팩 점수 v2 구현 결과"
git push
gh pr edit 31 --title "feat: 팩 점수 v2 — 켜질 수 없는 것 · 전용 · 합성"
gh pr ready 31
gh pr checks 31
```

**제목에서 `WIP: ` 만 떼고 `feat: ` 는 남긴다.**

PR 본문 머리의 WIP 경고 줄을 지우고 구현 결과로 갈아끼운다. 골든 단계별 표를 담는다.

---

## 자체 검토

**스펙 대조**

```
1  무엇이 잘못됐나        전체
2  켜질 수 없음           Task 3 (판정) · Task 4 (점수)
2.3 붕괴하지 않는다       Task 4 Step 6 이 회귀로 건다
2.4 배치는 자리까지       Task 2 (Profile) · Task 3 (씌우기)
2.5 이것은 추론이다       Task 3 Step 4 주석 · 커밋 메시지
3  전용 기프트            Task 5
4  합성 경로              Task 6 (순수) · Task 7 (배선)
4.4 선택지형 칸           Task 6 검사
5  모형 (F+C)×L           Task 7 Step 3
5.1 저울추 하나의 규칙     Task 5·6 이 HALF 만 쓴다
6  구조                   파일 구조 표
7  근거 모달              Task 8
8  지어내지 않는 자리      Task 2·4·6·7 검사
9  검증                   Task 1·4·7·9
10 범위 밖                안 건드린다
```

**빠진 것 없음.**

**타입 일관성** — `fireable` · `exclusive` 가 `GiftVerdict` · `ScoreGift` · `GiftLine` · `EvidenceGift` 넷에서 같은 이름이다. `Recipe` · `reachOf` · `fusionOf` 의 시그니처가 Task 6·7 에서 같다. `scorePack` 의 세 번째 인자 `fusion` 은 Task 7 에서 처음 생기고 기본값 0 이라 Task 4·5 의 두 인자 호출이 안 깨진다.

**빈칸 없음** — 모든 단계에 실제 코드와 실제 기대값이 있다.
