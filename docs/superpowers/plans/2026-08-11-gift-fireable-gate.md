# 게이트 판정 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 기프트가 「이 편성에서 켜질 수 없다」를 **게이트가 있을 때만** 말하게 한다.

**Architecture:** 빌드가 설명문 첫 문단에서 게이트를 알아내 `gift_trigger_param` 에 `kind='gate'` 로 굳힌다. 엔진은 그 구조만 읽어, 게이트가 있으면 게이트만 발동을 막고 없으면 소속·유닛 키워드를 막지 않는다. 설명문 파싱은 빌드에만 있다(ADR-08).

**Tech Stack:** TypeScript · Prisma(멀티 스키마) · PostgreSQL · `node:test` · Next.js

## Global Constraints

- 스펙: `docs/superpowers/specs/2026-08-11-gift-fireable-gate-design.md`. 값이 어긋나면 스펙이 정본이다.
- **게이트의 정의**: 설명문(ko · level 0) **첫 문단**이 「…N인 이상」을 담고 그 첫 문단에 「발동」이 있는 것. 그 짝에는 이미 `min_count` 가 있다.
- **막는 규칙 둘**
  - 게이트가 있는 기프트 → **게이트 짝만** 발동을 막는다
  - 게이트가 없는 기프트 → `association` · `unit_keyword` 는 안 막고, 나머지는 막는다
- **`reasons` 에서 아무것도 빼지 않는다.** 근거 목록과 `satisfied`/`total` 은 그대로다 — 죽이지 않되 점수는 깎는다.
- 실측 기대: 게이트를 가진 기프트 **49** · 죽는 기프트 **178 → 130** · 발동 가능 **273 → 321**.
- `axis` · `attack_type` · `resonance` · `deployment` 의 판정을 바꾸지 않는다. 9005 · 9023 · 9048 · 9041 은 여전히 죽어야 한다.
- `evaluability` 를 손대지 않는다.
- `canonical` 은 승격으로만 바뀐다(ADR-07): `v2:build` → `v2:diff` → `v2:promote`.
- 주석은 한국어, 코드 식별자는 영어. `src/v2/` 상대 import 는 `.js`, `lib/` 는 기존 파일을 따른다.
- 검사: `npm test` · `npm run typecheck` · `npm run build` **셋 다**. 값 import 에 `.js` 를 붙이면 typecheck 는 통과하고 build 가 깨진 전례가 있다.

---

## 파일 구조

| 파일 | 책임 |
|---|---|
| `src/v2/canonical/gift-trigger-param.ts` | 첫 문단 게이트를 알아내 `kind='gate'` 행을 낸다 |
| `src/v2/canonical/gift-trigger-param.test.ts` | 위의 단위 테스트 |
| `lib/engine/v2/types.ts` | `Reason` 에 `blocking` 추가 |
| `lib/engine/v2/load.ts` | `params` 에 `gate` 종류가 실려 오는지 확인 (이미 전량을 읽으면 변경 없음) |
| `lib/engine/v2/evaluate.ts` | 막는 규칙 둘 |
| `lib/engine/v2/evaluate.test.ts` | 위의 단위 테스트 |
| `lib/engine/v2/gate-golden.test.ts` | **새 파일.** 손판정 10건 골든 |
| `src/v2/verify-canonical.ts` | 게이트 적재 검사 |

---

## Task 1: 빌드가 게이트를 표시한다

**Files:**
- Modify: `src/v2/canonical/gift-trigger-param.ts`
- Test: `src/v2/canonical/gift-trigger-param.test.ts`

**Interfaces:**
- Produces: `GiftTriggerParamRow` 에 `kind='gate'` 인 행. `value` 는 `min_count` 와 같은 문턱값 문자열, `tier` 는 0, `source` 는 `'desc_derived'`.

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`gift-trigger-param.test.ts` 에 더한다. 기존 테스트를 지우지 마라.

```typescript
test('첫 문단이 「…N인 이상일 때 발동」이면 게이트다', () => {
	const input = baseInput();
	input.giftDesc = [{
		giftId: '9718',
		desc: '턴 시작 시, 검계 소속 인격이 3인 이상일 때 발동 (출격 인원을 기준으로 함).\n\n아군이 턴 시작 시 참격 위력 증가 2 얻음.',
	}];
	input.giftTrigger = [{ giftId: '9718', triggerId: 'Blade Lineage Identities' }];
	input.triggerRef = [{
		triggerId: 'Blade Lineage Identities',
		refKind: 'association', refId: 'BLADE_LINEAGE', evaluability: 'roster',
	}];
	input.associationKo = [{ associationId: 'BLADE_LINEAGE', name: '검계' }];

	const rows = buildGiftTriggerParam(input, new Meta());
	const gate = rows.find((r) => r.kind === 'gate');
	assert.equal(gate?.giftId, '9718');
	assert.equal(gate?.triggerId, 'Blade Lineage Identities');
	assert.equal(gate?.value, '3');
	// 게이트는 min_count 와 함께 나온다 — 같은 문장에서 왔다
	assert.ok(rows.some((r) => r.kind === 'min_count' && r.triggerId === 'Blade Lineage Identities'));
});

test('첫 문단이 아니면 게이트가 아니다', () => {
	const input = baseInput();
	// 9220 도둑맞은 해결사 잡지 — 본 효과가 먼저 오고 소속 조건은 나중 문단이다
	input.giftDesc = [{
		giftId: '9220',
		desc: '턴 시작 시, 타격 위력 증가 1 얻음\n\n중지 소속 인격이 4인 이상 있다면, 스테이지 시작 시 무작위 적 1명에게 앙갚음 대상 부여',
	}];
	input.giftTrigger = [{ giftId: '9220', triggerId: 'Middle Finger Identities' }];
	input.triggerRef = [{
		triggerId: 'Middle Finger Identities',
		refKind: 'association', refId: 'MIDDLE_FINGER', evaluability: 'roster',
	}];
	input.associationKo = [{ associationId: 'MIDDLE_FINGER', name: '중지' }];

	const rows = buildGiftTriggerParam(input, new Meta());
	assert.equal(rows.some((r) => r.kind === 'gate'), false);
	// min_count 는 그대로 나와야 한다 — 게이트가 아닐 뿐 문턱값은 사실이다
	assert.ok(rows.some((r) => r.kind === 'min_count'));
});

test('첫 문단에 「발동」이 없으면 게이트가 아니다', () => {
	const input = baseInput();
	input.giftDesc = [{
		giftId: '9778',
		desc: '림버스 컴퍼니 소속 인격이 4인 이상이면 스킬 2의 공격 레벨 +1',
	}];
	input.giftTrigger = [{ giftId: '9778', triggerId: 'Limbus Company Identities' }];
	input.triggerRef = [{
		triggerId: 'Limbus Company Identities',
		refKind: 'association', refId: 'LIMBUS_COMPANY', evaluability: 'roster',
	}];
	input.associationKo = [{ associationId: 'LIMBUS_COMPANY', name: '림버스 컴퍼니' }];

	const rows = buildGiftTriggerParam(input, new Meta());
	assert.equal(rows.some((r) => r.kind === 'gate'), false);
});
```

`baseInput()` 은 이 파일에 이미 있는 픽스처 헬퍼다. 없으면 기존 테스트가 만드는 입력 리터럴을 함수로 뽑아 쓰고, **기존 테스트의 뜻을 바꾸지 마라.**

- [ ] **Step 2: 테스트가 실패하는지 본다**

```bash
npx tsx --test src/v2/canonical/gift-trigger-param.test.ts
```
Expected: 세 테스트 중 첫째가 FAIL (`gate` 행이 없다). 둘째·셋째는 우연히 통과할 수 있다 — 아직 `gate` 를 아무것도 안 만들기 때문이다. 정상이다.

- [ ] **Step 3: 게이트 판정을 넣는다**

`buildGiftTriggerParam` 의 `for (const g of input.giftDesc)` 루프 첫머리에 첫 문단 범위를 구한다.

```typescript
	for (const g of input.giftDesc) {
		GATE.lastIndex = 0;
		const denom = DENOMINATOR.find(([re]) => re.test(g.desc))?.[1] ?? null;
		// 같은 (기프트, 트리거) 안에서 몇 번째 단인가. 9206 은 5인·10인 두 단이다
		const tierOf = new Map<string, number>();

		/**
		 * **게이트는 첫 문단에만 있다.**
		 *
		 * 「턴 시작 시, 검계 소속 인격이 3인 이상일 때 발동」처럼 기프트 전체를
		 * 여는 문은 설명문 맨 앞에 온다. 뒤 문단의 「…4인 이상 있다면」은 그
		 * 문단만 여는 조건이라 기프트를 죽일 근거가 못 된다(9220 · 9270).
		 *
		 * 「발동」이라는 낱말을 함께 본다 — 9778 「…4인 이상이면 공격 레벨 +1」은
		 * 첫 문단이지만 효과 서술이지 여는 문이 아니다.
		 */
		const firstPara = g.desc.split(/\n+/).find((p) => p.trim().length > 0) ?? '';
		const gateZone = firstPara.includes('발동') ? firstPara.length : -1;
```

그 다음 `min_count` 를 push 하는 자리(`rows.push({ … kind: 'min_count' … })`) **바로 뒤**에 게이트 행을 더한다.

```typescript
			// 첫 문단 안에서 왔고 그 문단이 여는 문이면 게이트다. 엔진은 이 표시가
			// 있는 짝만 발동을 막는다
			if (m.index < gateZone) {
				rows.push({
					giftId: g.giftId, triggerId, kind: 'gate', tier: 0,
					value: m[1] ?? null, slots: [], source: 'desc_derived',
				});
			}
```

같은 트리거에 다단 임계가 있어도 게이트는 한 행이면 된다 — 첫 문단에 두 번 나오는 경우가 실측에 없다. 그래도 중복이 생기면 `(giftId, triggerId)` 로 한 번만 넣도록 `Set` 으로 막아라(`denomSeen` 과 같은 방식).

- [ ] **Step 4: 테스트가 통과하는지 본다**

```bash
npx tsx --test src/v2/canonical/gift-trigger-param.test.ts
npm run typecheck
```
Expected: 세 테스트 전부 PASS. 기존 테스트도 전부 PASS.

- [ ] **Step 5: 실제 데이터로 게이트 수를 확인한다**

```bash
npm run v2:build 2>&1 | tail -20
```

**`v2:promote` 는 아직 하지 마라.** 빌드가 끝나면 `wip` 에서 센다.

```bash
docker exec limbus-postgres psql -U postgres -d limbus -c "
SELECT count(DISTINCT gift_id) AS 게이트_기프트, count(*) AS 게이트_행
FROM wip.gift_trigger_param WHERE kind='gate';"
```
Expected: `게이트_기프트 49`.

49 가 아니면 **멈추고 왜 다른지 보고하라.** 숫자를 맞추려고 판정을 느슨하게 하지 마라.

`v2:build` 가 실패하면 거기서 멈추고 보고하라. 스키마 이름을 바꾸거나 지워 우회하지 마라.

- [ ] **Step 6: 커밋**

```bash
git add src/v2/canonical/gift-trigger-param.ts src/v2/canonical/gift-trigger-param.test.ts
git commit -m "feat(canonical): 설명문 첫 문단의 게이트를 kind='gate' 로 굳힌다"
```

---

## Task 2: 엔진이 게이트만 막는다

**Files:**
- Modify: `lib/engine/v2/types.ts` (`Reason` 78-95행 부근)
- Modify: `lib/engine/v2/evaluate.ts` (`evaluateGifts` 105-161행)
- Test: `lib/engine/v2/evaluate.test.ts`

**Interfaces:**
- Consumes: Task 1 의 `kind='gate'` 행. `evaluate.ts` 의 `gatesOf(input.params)` 가 이미 `params` 를 받으므로 같은 배열에서 읽는다.
- Produces: `Reason.blocking: boolean` — 이 근거가 발동을 막을 수 있는가.

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`lib/engine/v2/evaluate.test.ts` 에 더한다. 기존 테스트를 지우지 마라.

```typescript
test('게이트가 있으면 게이트만 막는다 — 다른 참조가 미충족이어도 산다', () => {
	const verdicts = evaluateGifts({
		squad: SQUAD_NO_BLADE,          // 검계가 없는 편성
		profile: profileOf(SQUAD_NO_BLADE),
		giftTriggers: new Map([['9718', ['Blade Lineage Identities', 'Slash Skill Used']]]),
		refsByTrigger: new Map([
			['Blade Lineage Identities', [{ refKind: 'association', refId: 'BLADE_LINEAGE', evaluability: 'roster' }]],
			['Slash Skill Used', [{ refKind: 'attack_type', refId: 'slash', evaluability: 'roster_gated' }]],
		]),
		params: [
			{ giftId: '9718', triggerId: 'Blade Lineage Identities', kind: 'min_count', tier: 0, value: '3', slots: [] },
			{ giftId: '9718', triggerId: 'Blade Lineage Identities', kind: 'gate', tier: 0, value: '3', slots: [] },
		],
	});
	const v = verdicts.find((x) => x.giftId === '9718');
	// 게이트가 미충족이므로 죽는다
	assert.equal(v?.fireable, false);
	const gate = v?.reasons.find((r) => r.refId === 'BLADE_LINEAGE');
	assert.equal(gate?.blocking, true);
	// 수혜 대상은 막지 않는다
	const slash = v?.reasons.find((r) => r.refId === 'slash');
	assert.equal(slash?.blocking, false);
});

test('게이트가 없으면 소속·유닛키워드는 안 막는다', () => {
	const verdicts = evaluateGifts({
		squad: SQUAD_NO_SHI,
		profile: profileOf(SQUAD_NO_SHI),
		giftTriggers: new Map([['9140', ['Shi Assoc. Identities', 'Allies have Slash Skill']]]),
		refsByTrigger: new Map([
			['Shi Assoc. Identities', [{ refKind: 'association', refId: 'SHI', evaluability: 'roster' }]],
			['Allies have Slash Skill', [{ refKind: 'attack_type', refId: 'slash', evaluability: 'roster' }]],
		]),
		params: [],
	});
	const v = verdicts.find((x) => x.giftId === '9140');
	assert.equal(v?.fireable, true);
	assert.equal(v?.reasons.find((r) => r.refId === 'SHI')?.blocking, false);
});

test('게이트가 없으면 축은 막는다', () => {
	const verdicts = evaluateGifts({
		squad: SQUAD_NO_BLEED,
		profile: profileOf(SQUAD_NO_BLEED),
		giftTriggers: new Map([['9005', ['Bleed Skill Used']]]),
		refsByTrigger: new Map([
			['Bleed Skill Used', [{ refKind: 'axis', refId: 'LACERATION', evaluability: 'roster' }]],
		]),
		params: [],
	});
	const v = verdicts.find((x) => x.giftId === '9005');
	assert.equal(v?.fireable, false);
	assert.equal(v?.reasons[0]?.blocking, true);
});
```

`SQUAD_*` 와 `profileOf` 는 이 파일에 이미 있는 헬퍼를 쓰거나, 없으면 기존 테스트가 만드는 방식을 그대로 따라 만들어라. **편성은 해당 축·소속이 없는 것으로 구성해야 한다** — 그래야 미충족이 나온다.

- [ ] **Step 2: 테스트가 실패하는지 본다**

```bash
npx tsx --test lib/engine/v2/evaluate.test.ts
```
Expected: FAIL — `blocking` 이 `Reason` 에 없어 타입 오류가 나거나 `undefined` 다.

- [ ] **Step 3: `Reason` 에 `blocking` 을 더한다**

`lib/engine/v2/types.ts` 의 `Reason` 에 넣는다.

```typescript
	/**
	 * 이 근거가 발동을 막을 수 있는가.
	 *
	 * 제3자 트리거 태그는 조건만 담지 않는다 — 발동 조건 · 적용 범위 · 수혜
	 * 대상이 한 목록에 섞여 있다. 9718 검계 기프트의 `association/BLADE_LINEAGE`
	 * 는 게이트지만 `attack_type/slash` 는 효과가 무엇을 키우는지다.
	 *
	 * 막지 않는 근거도 `reasons` 에 그대로 남는다 — 근거 모달이 보여야 하고
	 * `satisfied`/`total` 에도 계속 센다. 죽이지 않되 점수는 깎는다.
	 */
	blocking: boolean;
```

- [ ] **Step 4: 막는 규칙을 넣는다**

`evaluate.ts` 의 `gatesOf` 가 `min_count` · `denominator` · `slot` 만 본다면 `gate` 도 읽도록 넓혀라. 게이트가 붙은 `(giftId, triggerId)` 짝의 집합을 만든다.

```typescript
/** 게이트가 붙은 (기프트, 트리거) 짝. 이 짝만 발동을 막을 수 있다 */
function gateKeysOf(params: readonly Param[]): Set<string> {
	const out = new Set<string>();
	for (const p of params) {
		if (p.kind === 'gate') out.add(`${p.giftId}|${p.triggerId}`);
	}
	return out;
}
```

`evaluateGifts` 안에서 기프트마다 판정한다.

```typescript
	const gateKeys = gateKeysOf(input.params);

	// … 기프트 루프 안, reasons 를 다 모은 뒤 …

	/**
	 * 이 기프트에 게이트가 있는가. 있으면 게이트만 막고, 없으면 적용 범위를
	 * 뺀 나머지가 막는다.
	 */
	const hasGate = triggerIds.some((t) => gateKeys.has(`${giftId}|${t}`));
	/** 「누구에게 적용되는가」를 말하는 참조. 켜짐의 조건이 아니다 */
	const SCOPE_KINDS = new Set(['association', 'unit_keyword']);

	for (const r of reasons) {
		r.blocking = hasGate
			? gateKeys.has(`${giftId}|${r.triggerId}`)
			: !SCOPE_KINDS.has(r.refKind);
	}

	// 막을 수 있는 근거가 확정 미충족일 때만 죽는다
	const fireable = !reasons.some(
		(r) => r.blocking && r.verdict === 'unsatisfied' && r.certainty === 'certain',
	);
```

`SCOPE_KINDS` 는 파일 상단 상수로 빼라 — 루프 안에서 매번 만들지 마라.

`Reason` 을 만드는 자리(`reasons.push({ … })`)에 `blocking: false` 를 넣어 초기화하고, 위 루프가 덮게 하라. 타입이 요구한다.

- [ ] **Step 5: 테스트가 통과하는지 본다**

```bash
npx tsx --test lib/engine/v2/evaluate.test.ts
npm run typecheck
npm run build
```
Expected: 새 세 테스트와 기존 테스트 전부 PASS. `build` 통과.

- [ ] **Step 6: 커밋**

```bash
git add lib/engine/v2/types.ts lib/engine/v2/evaluate.ts lib/engine/v2/evaluate.test.ts
git commit -m "feat(engine): 게이트가 있으면 게이트만 발동을 막는다"
```

---

## Task 3: 골든 · 검증 · 결손 · 승격

**Files:**
- Create: `lib/engine/v2/gate-golden.test.ts`
- Modify: `src/v2/verify-canonical.ts`
- Modify: `src/v2/canonical/gift-trigger-param.ts` (결손 기록)
- Modify: `lib/engine/v2/golden.test.ts` (실측 숫자)

- [ ] **Step 1: 골든을 쓴다**

```typescript
/**
 * 게이트 골든 — 적재된 `canonical` 로 실제 편성을 판정한다.
 *
 * 열 건 전부 설명문을 손으로 읽어 판정한 것이다. 규칙이 이 열을 맞히면
 * 「게이트만 막는다」가 실제 데이터에서 선다.
 */
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { PrismaClient } from '../../../src/v2/generated/client.js';
import { NO_DB, canonicalReachable } from '../../../src/v2/canonical/db-available.js';
import { loadEngineData } from './load';
import { Profile } from './profile';
import { evaluateGifts } from './evaluate';
import type { Squad } from './types';

const prisma = new PrismaClient();
after(async () => { await prisma.$disconnect(); });
const DB = { skip: (await canonicalReachable(prisma)) ? false : NO_DB };

const IDS = ['10216', '11216', '11009', '10916', '10716', '10512'];
const SQUAD: Squad = { roster: IDS.map((identityId) => ({ identityId, egoIds: [] })), field: IDS };

const data = DB.skip === false ? await loadEngineData(prisma) : null;
const verdicts = DB.skip === false
	? evaluateGifts({
		squad: SQUAD, profile: new Profile(SQUAD, data!.capabilities),
		giftTriggers: data!.giftTriggers, refsByTrigger: data!.refsByTrigger, params: data!.params,
	})
	: [];
const byId = new Map(verdicts.map((v) => [v.giftId, v]));

/** 손으로 설명문을 읽어 판정한 열 건 */
const EXPECTED: Array<[string, boolean, string]> = [
	['9140', true, '결의 — 시 협회는 적용 범위, 참격으로 발동한다'],
	['9194', true, '짧은 케인 소드 — 세븐 협회는 적용 범위'],
	['9005', false, '상처붙이 — 출혈이 진짜 조건'],
	['9023', false, '벼락가지 — 파열이 진짜 조건'],
	['9048', false, '녹슨 커터 나이프 — 출혈이 조건, 색욕은 강화판'],
	['9041', false, '적색 지령 — 침잠이 조건'],
	['9718', false, '검계 3인 게이트 — 이 덱에 검계가 없다'],
	['9717', false, '흑운회 3인 게이트'],
	['9043', false, '사원증 — 진짜 OR 이지만 이 PR 로는 못 고친다'],
	['9052', false, '휴대용 전지 소켓 — 우선순위 주석 문제, 이 PR 밖'],
];

for (const [giftId, want, why] of EXPECTED) {
	test(`${giftId} 는 ${want ? '산다' : '죽는다'} — ${why}`, DB, () => {
		assert.equal(byId.get(giftId)?.fireable, want);
	});
}

test('게이트 기프트는 게이트만 막는다 — 수혜 대상은 blocking 이 아니다', DB, () => {
	const v = byId.get('9718');
	const gate = v?.reasons.find((r) => r.refKind === 'association');
	const payoff = v?.reasons.find((r) => r.refKind === 'attack_type');
	assert.equal(gate?.blocking, true);
	assert.equal(payoff?.blocking, false);
});

test('실측 — 죽는 기프트 130 · 발동 가능 321', DB, () => {
	const dead = verdicts.filter((v) => !v.fireable).length;
	assert.equal(dead, 130);
	assert.equal(verdicts.length - dead, 321);
});
```

- [ ] **Step 2: 적재 검증을 더한다**

`src/v2/verify-canonical.ts` 의 기프트 파라미터 검사 근처에 넣는다.

```typescript
	// ── 게이트 (2026-08-11) ────────────────────────────────────
	const gateGifts = await prisma.$queryRaw<Array<{ n: bigint }>>`
		SELECT count(DISTINCT gift_id)::bigint AS n
		FROM canonical.gift_trigger_param WHERE kind = 'gate'
	`;
	eq('게이트를 가진 기프트', Number(gateGifts[0]?.n ?? 0), 49);

	// 게이트는 언제나 같은 짝의 min_count 와 함께 온다 — 같은 문장에서 왔다
	const orphan = await prisma.$queryRaw<Array<{ n: bigint }>>`
		SELECT count(*)::bigint AS n
		FROM canonical.gift_trigger_param g
		WHERE g.kind = 'gate' AND NOT EXISTS (
			SELECT 1 FROM canonical.gift_trigger_param m
			WHERE m.gift_id = g.gift_id AND m.trigger_id = g.trigger_id AND m.kind = 'min_count')
	`;
	checks.push({
		name: 'min_count 없는 게이트가 없다',
		ok: Number(orphan[0]?.n ?? 1) === 0,
		detail: `${orphan[0]?.n ?? 0} / 0`,
	});
```

- [ ] **Step 3: 결손을 기록한다**

`src/v2/canonical/gift-trigger-param.ts` 의 `buildGiftTriggerParam` 끝에 넣는다. 전량 검수가 찾았으나 이 PR 이 담지 않는 것이다.

```typescript
	// 456개 전량 검수(2026-08-11)가 찾았으나 이 회차가 담지 않는 것. 기프트
	// 능력 PR 의 입력이다
	meta.gap('gift', '*', 'clause_structure',
		'절마다 조건이 다른데 태그가 평면이라 어느 조건이 어느 효과를 켜는지 모른다. ' +
		'편성쪽 게이트를 가진 절 16건을 포함해, 전량 검수가 86건을 「편성으로 판정해야 ' +
		'하는데 못 담는다」로 분류했다', EVIDENCE);
	for (const id of ['9220', '9270']) {
		meta.gap('gift', id, 'clause_gate',
			'문단 단위 게이트다. 첫 문단이 아니라 이 회차의 규칙이 못 가린다. 본 효과는 ' +
			'실제로 켜지므로 「막지 않는다」가 방향은 맞다', EVIDENCE);
	}
	meta.gap('gift', '9052', 'priority_hint',
		'「(스킬을 사용하여 충전 횟수를 획득하는 인격을 우선으로 지정)」은 우선순위 ' +
		'주석인데 조건으로 읽힌다. 이 기프트의 첫 문단은 무조건 효과라 실제로는 항상 켜진다',
		EVIDENCE);
	meta.gap('gift', '9043', 'or_condition',
		'원문이 「분노 완전 공명을 발동하였거나 충전 … 스킬을 사용할 경우」로 OR 인데 ' +
		'태그에 그 정보가 없다', EVIDENCE);
```

결손이 늘면 `verify-canonical.ts` 의 결손 합계 상수를 **실측값으로** 맞춰라.

- [ ] **Step 4: 굽고 승격한다**

```bash
npm run v2:build
npm run v2:diff
npm run v2:promote
```

`v2:diff` 출력을 보고서에 담아라. `gift_trigger_param` 이 49행 늘고 `field_gap` 이 5행 느는 것 말고 **예상 못 한 표가 바뀌면 멈추고 보고하라.**

실패하면 거기서 멈춰라. 스키마 이름을 바꾸거나 지워 우회하지 마라 — 컨트롤러가 복구한다.

- [ ] **Step 5: 골든과 기존 실측을 맞춘다**

```bash
npx tsx --env-file-if-exists=.env --test lib/engine/v2/gate-golden.test.ts
npx tsx --env-file-if-exists=.env --test lib/engine/v2/golden.test.ts
```

`golden.test.ts` 의 실측 등급 단정(A146 · B219 · C86)과 「전부 충족 89 · 확정 49」가 바뀌면 **실제 값으로 고치고 왜 바뀌었는지 주석을 남겨라.** 단정을 무르게 하지 마라.

- [ ] **Step 6: 되돌려 확인한다**

골든이 자기가 존재하는 이유인 버그를 못 잡은 전례가 있다. 반드시 확인한다.

`evaluate.ts` 의 `blocking` 계산을 잠시 `r.blocking = true` 로 되돌리고(즉 옛 규칙) 골든을 돌려라.

Expected: **`9140` 과 `9194` 가 실패해야 한다**(살아야 하는데 죽는다). 실패하지 않으면 골든이 아무것도 안 지키는 것이니 멈추고 보고하라.

확인 뒤 코드를 되돌려라. **DB 는 안 건드린다** — 이 되돌리기는 엔진만이라 재적재가 필요 없다.

- [ ] **Step 7: 전체 검사**

```bash
npm test
npm run typecheck
npm run build
npm run v2:verify:canonical
```
Expected: 전부 통과 · 검증 실패 0.

- [ ] **Step 8: 커밋**

```bash
git add lib/engine/v2/gate-golden.test.ts lib/engine/v2/golden.test.ts src/v2/verify-canonical.ts src/v2/canonical/gift-trigger-param.ts
git commit -m "test: 게이트 골든 열 건 · 적재 검증 · 담지 않는 것을 결손으로"
```

---

## 자체 검토

**1. 스펙 커버리지**

| 스펙 절 | 태스크 |
|---|---|
| §3 게이트의 정의 (첫 문단 + 「발동」) | Task 1 Step 3 |
| §3 규칙 둘 | Task 2 Step 4 |
| §3 `blocking` 을 `Reason` 에 | Task 2 Step 3 |
| §3 `reasons` 에서 빼지 않는다 | Task 2 Step 4 — `blocking` 만 붙이고 필터하지 않는다 |
| §4 실측 (49 · 130 · 321) | Task 1 Step 5 · Task 3 Step 1 |
| §5 단위 검증 | Task 1 Step 1 · Task 2 Step 1 |
| §5 골든 열 건 · 되돌려 확인 | Task 3 Step 1 · Step 6 |
| §5 적재 검증 | Task 3 Step 2 |
| §6 결손 | Task 3 Step 3 |
| §7 안 하는 것 | 어느 태스크도 `axis`·`evaluability`·저작을 건드리지 않는다 |

**2. 자리표시자** — 없다. `baseInput()` · `SQUAD_*` · `profileOf` 는 기존 테스트 파일의 헬퍼를 쓰라고 명시했고, 없을 때의 대처도 적었다.

**3. 타입 일관성**

- `kind='gate'` — Task 1 이 만들고 Task 2 의 `gateKeysOf` 가 읽는다. `GiftTriggerParamRow` 의 기존 필드만 쓴다.
- `Reason.blocking: boolean` — Task 2 Step 3 에서 정의, Step 4 에서 채움, Task 3 골든이 읽는다.
- `gateKeysOf(params)` 의 키는 `` `${giftId}|${triggerId}` `` — Task 2 안에서만 쓰이고 두 자리(`hasGate` · `r.blocking`)가 같은 형식을 쓴다.

**4. 남는 것**

`gift-trigger-param.ts:50` 의 주석이 「강화 단계는 조건이 같아 중복이다」라 말하는데, 전량 검수가 **14건은 단계마다 조건이 다르다**는 것을 찾았다(9117 · 9138 · 9148). 이 회차는 level 0 만 쓰므로 동작에 영향이 없지만 주석이 틀렸다. Task 1 에서 그 주석에 한 줄을 덧붙여 사실을 바로잡되, **동작은 바꾸지 마라** — 단계별 조건은 기프트 능력 PR 의 몫이다.
