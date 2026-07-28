# 덱 특성 판정 정밀화 구현 계획 (엔진)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `06-recommendation-engine.md` 10절이 적어둔 근사 중 셋을 걷어낸다 — 상태 기믹 축 부재, 소속 조건의 판정 범위, 소속 조건의 인원수.

**Architecture:** 엔진의 **공개 시그니처와 반환 타입을 바꾸지 않는다.** 어휘 사전(`vocab.ts`)이 기프트 설명문에서 조건의 인원수와 판정 범위를 읽어내고, 조건 평가(`dsl.ts`)가 그 범위를 그대로 쓴다. 상태 축은 `StatusKey` 에 항목을 **더하는** 방식이라 기존 코드가 깨지지 않는다.

**Tech Stack:** TypeScript · Prisma · `node:test` (러너는 `tsx --test`) · 기존 `src/engine-proof.ts` 골든 회귀

## Global Constraints

- Node **>=22.9** (`package.json` engines).
- **공개 시그니처를 바꾸지 않는다.** `rankPacks` · `scorePack` · `scoreState` · `marginalValue` · `contextOf` · `deckFeature` · `evaluate` · `activation` 의 인자와 반환 타입은 불변이다. `StatusKey` 에 항목을 더하는 것은 가산이라 허용된다.
- **웹 브랜치의 파일을 건드리지 않는다** — `app/**` · `components/**` · `lib/queries/**` · `lib/storage/**`. 유일한 예외는 `lib/queries/recommend.ts` 의 호출 한 줄이며, 이 계획에서는 손대지 않는다(`docs/07-recommendation-system.md` 9.1).
- **`src/engine-golden.json` 갱신은 의도된 변경이다.** 점수가 바뀌므로 기준선도 바뀐다. 다만 **무엇이 왜 바뀌었는지 커밋에 적는다.**
- **지어내지 않는다.** 설명문에 근거가 없는 조건은 근사를 유지하고, 근사임을 코드 주석과 문서에 남긴다.
- 커밋 제목은 Conventional Commits, 한국어 명사구, 마침표 없음.
- 새 npm 의존성을 추가하지 않는다.

## 근거 — 실측

기프트 설명문(한국어, `enhanceLevel=0`)에서 소속 조건을 담은 것이 **18건**이다. 설명문이 인원수와 판정 범위를 **둘 다** 말한다.

| 판정 범위 | 필요 인원 | 건수 |
| --- | ---: | ---: |
| 출전 (`출격 인원을 기준으로 함` · `대기 인원 제외`) | 2 | 3 |
| 출전 | 3 | 9 |
| 출전 | 4 | 1 |
| 편성 (`편성 인원을 기준으로 함` · `대기 인원 포함`) | 3 | 2 |
| 표지 없음 | 3 | 2 |
| 표지 없음 | 4 | 1 |
| 표지 없음 | 미상 | 1 |

**지금 엔진은 전부 `atLeast: 3` 에 `max(편성, 출전)` 이다.** 인원수는 18건 중 4건에서 틀렸고, 판정 범위는 15건에서 확정할 수 있는데 버리고 있다.

상태 기믹은 `docs/backlog/04-status-mechanics.md` 가 전수 확인해뒀다 — 기프트 발동 토큰 150종이 참조하는 기믹 중 **분류 밖이 탄환·보호 둘뿐**이다.

## 파일 구조

| 파일 | 변경 |
| --- | --- |
| `lib/engine/vocab.ts` | `StatusKey` 에 `ammo`·`protection` 추가 · 설명문에서 조건을 정밀화하는 함수 |
| `lib/engine/vocab.test.ts` | 신규 — 설명문 파싱 단위 테스트 |
| `lib/engine/state.ts` | `Condition` 의 새 필드를 받는 판정 범위 |
| `lib/engine/dsl.ts` | `COUNT_AFFILIATION` 이 범위를 그대로 씀 |
| `lib/engine/load.ts` | 상태 축 매칭에 탄환·보호 추가 · 설명문을 조건 매핑에 넘김 |
| `src/engine-golden.json` | 갱신 (의도된 변경) |
| `package.json` | `test` 스크립트 추가 |
| `.github/workflows/ci.yml` | 테스트 단계 추가 |

---

### Task 1: 테스트 러너 배선

**Files:**
- Modify: `package.json`
- Modify: `.github/workflows/ci.yml`
- Create: `lib/engine/vocab.test.ts`

**Interfaces:**
- Consumes: 기존 `mapTrigger` (`lib/engine/vocab.ts`)
- Produces: 없음 (배선만)

이 저장소엔 테스트 러너가 없다. `tsx` 가 이미 devDependency 이므로 **새 의존성 없이** Node 내장 러너를 쓴다.

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`lib/engine/vocab.test.ts`:

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mapTrigger } from './vocab';

const AFFILIATIONS = new Set(['dawn-office', 'thumb']);

test('소속 토큰이 조건이 된다', () => {
	const c = mapTrigger('Dawn Office Identities', AFFILIATIONS);
	assert.equal(c?.op, 'COUNT_AFFILIATION');
});

test('소속 목록에 없는 토큰은 조건이 아니다', () => {
	assert.equal(mapTrigger('Nonexistent Identities', AFFILIATIONS), null);
});
```

`Dawn Office` 가 실제 소속 id 로 어떻게 해석되는지는 `resolveAffiliation` 이 정한다. 테스트가 실패하면 **실제 소속 id 를 확인해 토큰을 맞춘다** — 아래 Step 2 에서 확인한다.

- [ ] **Step 2: 실제 소속 id 를 확인한다**

```bash
npm run db:up
docker compose exec -T postgres psql -U postgres -d limbus -tAF'|' -c \
  "select a.id, at.name from affiliation a join affiliation_text at on at.\"affiliationId\"=a.id and at.locale='ko' where at.name in ('새벽 사무소','엄지','약지','중지','피쿼드호','검계') order by 1"
```

여기서 나온 id 를 위 테스트의 `AFFILIATIONS` 와 토큰에 반영한다. 짐작하지 말고 나온 값을 쓴다.

- [ ] **Step 3: 실패를 확인한다**

Run: `npx tsx --test "lib/engine/vocab.test.ts"`
Expected: 두 테스트 중 최소 하나가 의도대로 동작하는지 확인. 전부 통과하면 다음으로, 실패하면 Step 2 의 id 를 다시 본다.

- [ ] **Step 4: npm script 와 CI 를 잇는다**

`package.json` scripts 에 `typecheck` 바로 아래로 추가:

```json
"test": "tsx --test \"lib/**/*.test.ts\"",
```

`.github/workflows/ci.yml` 의 `타입 검사` 단계 **앞**에 삽입:

```yaml
      # 어휘 사전의 설명문 파싱 단위 테스트. 데이터베이스를 쓰지 않는다.
      - name: 단위 테스트
        run: npm test
```

- [ ] **Step 5: 확인하고 커밋**

Run: `npm test && npm run typecheck`
Expected: 통과

```bash
git add package.json .github/workflows/ci.yml lib/engine/vocab.test.ts
git commit -m "test: 어휘 사전 단위 테스트 러너 배선"
```

---

### Task 2: 상태 기믹 축 — 탄환과 보호

**Files:**
- Modify: `lib/engine/vocab.ts` (`StatusKey`)
- Modify: `lib/engine/load.ts` (`STATUS_MATCH`)
- Create: `lib/engine/load.test.ts`

**Interfaces:**
- Consumes: 없음
- Produces: `StatusKey` 에 `'ammo'` · `'protection'` 추가. `statusKeyOf` 가 두 축을 인식

`docs/backlog/04-status-mechanics.md` 가 전수 확인한 결과 분류 밖은 이 둘뿐이다. **키워드와 성격이 달라 별개 축(특수)으로 둔다** — 키워드는 기프트 분류이고, 상태 기믹은 인격이 공급하고 기프트가 조건으로 참조하는 자원이다.

- [ ] **Step 1: 실제 상태 id 를 확인한다**

축을 문자열 매칭으로 잡으므로 **실제 id 를 봐야 정규식을 쓸 수 있다.** 짐작하지 않는다.

```bash
npm run db:up
docker compose exec -T postgres psql -U postgres -d limbus -tAF'|' -c \
  "select s.id, st.name from status s left join status_text st on st.\"statusId\"=s.id and st.locale='ko'
   where s.id ~* 'ammo|bullet|protect|shield|barrier' order by 1 limit 40"
```

`docs/backlog/04-status-mechanics.md` 3·4절이 탄환·보호의 실측 내역을 적어뒀다. 함께 읽고 대조한다.

- [ ] **Step 2: 실패하는 테스트를 쓴다**

`lib/engine/load.test.ts` — Step 1 에서 확인한 **실제 id 로** 채운다. 아래는 형태이며 `'...'` 자리에 확인한 id 를 넣는다.

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { statusKeyOf } from './load';

test('기존 축은 그대로 잡힌다', () => {
	assert.equal(statusKeyOf('Combustion'), 'burn');
	assert.equal(statusKeyOf('Laceration'), 'bleed');
	assert.equal(statusKeyOf('Breath'), 'poise');
});

test('탄환을 잡는다', () => {
	// Step 1 에서 확인한 실제 id 를 쓴다
	assert.equal(statusKeyOf('<탄환 상태 id>'), 'ammo');
});

test('보호를 잡는다', () => {
	assert.equal(statusKeyOf('<보호 상태 id>'), 'protection');
});

test('축에 없는 상태는 null', () => {
	assert.equal(statusKeyOf('Paralysis'), null);
});
```

- [ ] **Step 3: 실패를 확인한다**

Run: `npx tsx --test "lib/engine/load.test.ts"`
Expected: FAIL — `statusKeyOf` 가 export 되어 있지 않거나 새 축을 모른다

- [ ] **Step 4: 구현한다**

`lib/engine/vocab.ts` 의 `StatusKey` 에 두 항목을 더한다.

```ts
/**
 * 상태 키워드. 게임의 내부 식별자가 아니라 우리 축의 이름이다.
 *
 * 마지막 둘은 **상태 기믹**이며 앞의 것들과 성격이 다르다. 키워드는 기프트를 나누는
 * 분류이고 소속은 인격의 배경 태그인데, 탄환·보호는 인격이 공급하고 기프트가 조건으로
 * 참조하는 자원이다. 축이 셋이라는 것은 backlog/04 가 전수 확인했다 — 기프트 발동 토큰
 * 150종이 참조하는 기믹 중 분류 밖은 이 둘뿐이다.
 */
export type StatusKey =
	| 'burn'
	| 'bleed'
	| 'tremor'
	| 'rupture'
	| 'sinking'
	| 'poise'
	| 'charge'
	| 'bloodfeast'
	// ── 상태 기믹 (특수) ──
	| 'ammo'
	| 'protection';
```

`lib/engine/load.ts` 의 `STATUS_MATCH` 에 두 줄을 더하고 `statusKeyOf` 를 export 한다. 정규식은 **Step 1 에서 확인한 실제 id 로** 쓴다.

```ts
const STATUS_MATCH: Array<[StatusKey, RegExp]> = [
	['burn', /combustion|(^|[^a-z])burn/i],
	['bleed', /laceration|bleed/i],
	['tremor', /vibration|tremor/i],
	['rupture', /burst|rupture/i],
	['sinking', /sinking/i],
	['poise', /breath|poise/i],
	['charge', /charge/i],
	['bloodfeast', /bloodfeast/i],
	// 상태 기믹. 키워드가 아니라 자원이며 별개 축이다(backlog/04).
	['ammo', /<Step 1 에서 확인한 패턴>/i],
	['protection', /<Step 1 에서 확인한 패턴>/i],
];

export function statusKeyOf(statusId: string): StatusKey | null {
```

- [ ] **Step 5: 통과와 회귀를 확인한다**

```bash
npx tsx --test "lib/engine/*.test.ts"
npm run typecheck
npm run engine:proof
```

Expected: 테스트 통과 · 타입 오류 0 · **`engine:proof` 가 기준선 불일치로 실패할 수 있다.** 축이 늘면 덱 특성이 바뀌므로 점수가 움직인다. 그것이 정상이며 Task 5 에서 기준선을 갱신한다. **지금은 실패를 기록만 하고 넘어간다** — 무엇이 얼마나 바뀌었는지가 Task 5 의 근거다.

- [ ] **Step 6: 커밋**

```bash
git add lib/engine/vocab.ts lib/engine/load.ts lib/engine/load.test.ts
git commit -m "feat(engine): 상태 기믹 축 — 탄환과 보호"
```

---

### Task 3: 소속 조건의 인원수와 판정 범위를 설명문에서 읽는다

**Files:**
- Modify: `lib/engine/vocab.ts`
- Modify: `lib/engine/vocab.test.ts`

**Interfaces:**
- Consumes: 기존 `Condition` 타입
- Produces: `COUNT_AFFILIATION` 조건에 `scope: 'deck' | 'deployed' | 'unknown'` 필드 추가 · `refineAffiliation(condition, desc): Condition`

`Condition` 은 내부 타입이며 공개 시그니처가 아니다. 필드를 더하는 것은 가산이다.

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`lib/engine/vocab.test.ts` 에 이어 붙인다. **실측한 실제 문구를 그대로 쓴다.**

```ts
import { refineAffiliation } from './vocab';

const base = { op: 'COUNT_AFFILIATION', affiliation: 'x', atLeast: 3, scope: 'unknown' } as const;

test('출격 인원 표지를 출전으로 읽는다', () => {
	const c = refineAffiliation(base, '턴 시작시, 엄지 소속 인격이 3인 이상일 때 발동 (출격 인원을 기준으로 함)');
	assert.equal(c.scope, 'deployed');
	assert.equal(c.atLeast, 3);
});

test('편성 인원 표지를 편성으로 읽는다', () => {
	const c = refineAffiliation(base, '턴 시작시, 새벽 사무소 소속 인격이 3인 이상일 때 발동 (편성 인원을 기준으로 함)');
	assert.equal(c.scope, 'deck');
});

test('대기 인원 포함은 편성이다', () => {
	const c = refineAffiliation(base, '편성된 피쿼드호 소속 인격이 3인 이상일 때 발동 (대기 인원 포함)');
	assert.equal(c.scope, 'deck');
});

test('대기 인원 제외는 출전이다', () => {
	const c = refineAffiliation(base, '... 5인 이상이면 ... (E.G.O 스킬 제외. 대기 인원 제외)');
	assert.equal(c.scope, 'deployed');
});

test('인원수를 설명문에서 읽는다', () => {
	assert.equal(refineAffiliation(base, '약지 소속 인격이 2인 이상일 때 발동 (출격 인원을 기준으로 함)').atLeast, 2);
	assert.equal(refineAffiliation(base, '중지 소속 인격이 4인 이상 있다면, 스테이지 시작 시').atLeast, 4);
});

test('표지가 없으면 unknown 을 유지한다', () => {
	const c = refineAffiliation(base, '중지 소속 인격이 3인 이상이면, 대신 기본 위력 +1');
	assert.equal(c.scope, 'unknown');
	assert.equal(c.atLeast, 3);
});

test('인원수가 없으면 기존 값을 유지한다', () => {
	assert.equal(refineAffiliation(base, '소속 인격이 있으면').atLeast, 3);
});
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npx tsx --test "lib/engine/vocab.test.ts"`
Expected: FAIL — `refineAffiliation` 이 없다

- [ ] **Step 3: 구현한다**

`lib/engine/vocab.ts` 의 `Condition` 유니온에서 `COUNT_AFFILIATION` 갈래에 필드를 더한다.

```ts
	| {
			op: 'COUNT_AFFILIATION';
			affiliation: string;
			atLeast: number;
			/**
			 * 판정 범위. 원본 토큰에는 없고 설명문에만 있다.
			 * `unknown` 은 설명문에도 표지가 없는 경우이며 근사를 유지한다.
			 */
			scope: 'deck' | 'deployed' | 'unknown';
	  }
```

`mapTrigger` 가 만드는 기본값에 `scope: 'unknown'` 을 넣고, 아래 함수를 더한다.

```ts
/**
 * 설명문으로 소속 조건을 정밀화한다.
 *
 * 원본 토큰(`{소속} Identities`)에는 인원수도 판정 범위도 없다. 둘 다 설명문에만 있다.
 * 실측 18건 중 15건이 범위 표지를 갖고, 인원수는 2·3·4인으로 갈린다 — 일괄 3인 가정은
 * 그중 4건에서 틀렸다.
 *
 * 표지가 없는 3건은 `unknown` 으로 두고 근사를 유지한다. 없는 근거를 지어내지 않는다.
 */
export function refineAffiliation(
	condition: Extract<Condition, { op: 'COUNT_AFFILIATION' }>,
	desc: string,
): Extract<Condition, { op: 'COUNT_AFFILIATION' }> {
	const scope: 'deck' | 'deployed' | 'unknown' =
		/출격 인원을 기준|대기 인원 제외/.test(desc) ? 'deployed'
		: /편성 인원을 기준|대기 인원 포함/.test(desc) ? 'deck'
		: 'unknown';

	const matched = /([0-9]+)인 이상/.exec(desc);
	const atLeast = matched ? Number(matched[1]) : condition.atLeast;

	return { ...condition, scope, atLeast };
}
```

- [ ] **Step 4: 통과를 확인한다**

Run: `npx tsx --test "lib/engine/vocab.test.ts" && npm run typecheck`
Expected: 테스트 통과 · 타입 오류 0

`scope` 를 필수 필드로 더했으므로 `Condition` 을 만드는 다른 자리에서 타입 오류가 날 수 있다. 나면 그 자리에 `scope: 'unknown'` 을 넣는다.

- [ ] **Step 5: 커밋**

```bash
git add lib/engine/vocab.ts lib/engine/vocab.test.ts
git commit -m "feat(engine): 소속 조건의 인원수와 판정 범위를 설명문에서 읽는다"
```

---

### Task 4: 판정 범위를 평가에 반영한다

**Files:**
- Modify: `lib/engine/load.ts` (조건을 만들 때 설명문을 넘김)
- Modify: `lib/engine/dsl.ts` (`COUNT_AFFILIATION` 평가)
- Create: `lib/engine/dsl.test.ts`

**Interfaces:**
- Consumes: `refineAffiliation` · `scope` (Task 3)
- Produces: 없음 (`evaluate` 시그니처 불변)

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`lib/engine/dsl.test.ts`:

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluate } from './dsl';
import type { EvalContext } from './state';

function ctx(deck: number, deployed: number): EvalContext {
	return {
		statusSupply: {},
		sinSupply: {},
		atkTypes: {},
		affiliation: { deck: { x: deck }, deployed: { x: deployed } },
	} as unknown as EvalContext;
}

test('출전 기준은 출전 인원만 본다', () => {
	const c = { op: 'COUNT_AFFILIATION', affiliation: 'x', atLeast: 3, scope: 'deployed' } as const;
	assert.equal(evaluate(c, ctx(6, 2)).ratio, 2 / 3);
});

test('편성 기준은 편성 인원만 본다', () => {
	const c = { op: 'COUNT_AFFILIATION', affiliation: 'x', atLeast: 3, scope: 'deck' } as const;
	assert.equal(evaluate(c, ctx(6, 2)).ratio, 1);
});

test('표지가 없으면 큰 쪽을 쓰는 근사를 유지한다', () => {
	const c = { op: 'COUNT_AFFILIATION', affiliation: 'x', atLeast: 3, scope: 'unknown' } as const;
	assert.equal(evaluate(c, ctx(6, 2)).ratio, 1);
});

test('근거에 판정 범위가 드러난다', () => {
	const c = { op: 'COUNT_AFFILIATION', affiliation: 'x', atLeast: 3, scope: 'deployed' } as const;
	assert.match(evaluate(c, ctx(6, 2)).evidence[0] ?? '', /출전/);
});
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npx tsx --test "lib/engine/dsl.test.ts"`
Expected: FAIL — 지금은 `scope` 와 무관하게 `max` 를 쓴다

- [ ] **Step 3: 구현한다**

`lib/engine/dsl.ts` 의 `COUNT_AFFILIATION` 갈래를 바꾼다.

```ts
		case 'COUNT_AFFILIATION': {
			// 판정 범위는 설명문이 말한다(vocab.refineAffiliation). 표지가 없는 경우에만
			// 예전 근사를 유지한다 — 둘 중 큰 쪽. 실측 18건 중 3건이 여기 해당한다.
			const inDeck = ctx.affiliation.deck[condition.affiliation] ?? 0;
			const inField = ctx.affiliation.deployed[condition.affiliation] ?? 0;
			const have =
				condition.scope === 'deck' ? inDeck
				: condition.scope === 'deployed' ? inField
				: Math.max(inDeck, inField);
			const label =
				condition.scope === 'deck' ? '편성'
				: condition.scope === 'deployed' ? '출전'
				: '편성·출전 중 많은 쪽';
			const ratio = clamp(have / condition.atLeast);
			return {
				ratio,
				rate: 1,
				evidence:
					have > 0
						? [`${condition.affiliation} ${label} ${have}명 (필요 ${condition.atLeast})`]
						: [],
			};
		}
```

- [ ] **Step 4: 설명문을 조건 매핑에 넘긴다**

`lib/engine/load.ts` 의 `loadGifts` 에서 발동 토큰을 조건으로 바꾸는 자리를 찾아, `COUNT_AFFILIATION` 이 나오면 그 기프트의 설명문으로 정밀화한다.

먼저 현재 코드를 읽는다.

```bash
grep -n "mapTrigger" lib/engine/load.ts
sed -n '66,125p' lib/engine/load.ts
```

`mapTrigger(...)` 결과가 `COUNT_AFFILIATION` 이면 `refineAffiliation(condition, desc)` 를 통과시킨다. 설명문은 이미 로드되는 `texts` 에 있다 — **새 질의를 만들지 않는다.** 어느 필드가 설명문인지 위 `sed` 출력으로 확인해 쓴다.

- [ ] **Step 5: 통과와 회귀를 확인한다**

```bash
npx tsx --test "lib/engine/*.test.ts"
npm run typecheck
npm run db:up && npm run engine:proof
```

Expected: 테스트 통과 · 타입 오류 0 · `engine:proof` 는 기준선 불일치로 실패할 수 있다(정상, Task 5 에서 갱신).

- [ ] **Step 6: 커밋**

```bash
git add lib/engine/dsl.ts lib/engine/load.ts lib/engine/dsl.test.ts
git commit -m "feat(engine): 소속 조건을 설명문이 말한 판정 범위로 평가한다"
```

---

### Task 5: 기준선 갱신과 변화 기록

**Files:**
- Modify: `src/engine-golden.json`
- Modify: `docs/06-recommendation-engine.md` (10절 근사표 · 12절 미결)

**Interfaces:**
- Consumes: Task 2·3·4 의 변경
- Produces: 갱신된 회귀 기준선

**기준선을 조용히 덮지 않는다.** 무엇이 얼마나 바뀌었는지가 이 작업의 산출물이다.

- [ ] **Step 1: 변화 전후를 기록한다**

```bash
npm run db:up
git stash                      # 변경을 잠시 덜어낸다
npm run engine:proof 2>&1 | tee /tmp/proof-before.txt | tail -30
git stash pop
npm run engine:proof 2>&1 | tee /tmp/proof-after.txt | tail -30
diff /tmp/proof-before.txt /tmp/proof-after.txt
```

diff 를 읽고 **점수가 왜 그 방향으로 움직였는지 설명할 수 있어야 한다.** 설명이 안 되면 구현이 틀린 것이다 — 기준선을 갱신하지 말고 원인을 찾는다.

기대되는 방향:
- 탄환·보호 축이 늘었으므로 그 축을 참조하는 기프트의 조건이 이제 켜진다 → 해당 팩 점수 상승
- 출전 기준 조건은 이제 출전 7명만 보므로 편성이 더 많던 경우 점수 하락
- 인원수가 2인이던 조건은 더 쉽게 충족 → 상승, 4인이던 조건은 하락

- [ ] **Step 2: 기준선을 갱신한다**

`src/engine-proof.ts` 가 기준선을 어떻게 읽고 쓰는지 확인한다.

```bash
grep -n "engine-golden" src/engine-proof.ts
sed -n '210,240p' src/engine-proof.ts
```

갱신 방법이 스크립트에 있으면 그것을 쓰고, 없으면 `engine-proof` 출력에서 팩 순위·점수와 축 순위를 읽어 `src/engine-golden.json` 을 손으로 맞춘다.

- [ ] **Step 3: 통과를 확인한다**

Run: `npm run engine:proof`
Expected: `전부 통과`

- [ ] **Step 4: 문서를 갱신한다**

`docs/06-recommendation-engine.md` 10절 근사표에서 걷어낸 세 줄을 고친다.

| 항목 | 고치는 방향 |
| --- | --- |
| 소속 조건의 인원수 | `일괄 3인` → `설명문에서 읽는다. 표지가 없는 3건만 3인 근사` |
| 소속 조건의 판정 범위 | `편성·출전 중 큰 쪽` → `설명문이 말한 범위. 표지가 없는 3건만 큰 쪽` |
| 탄환 · 보호 축 | `없음` → `축으로 들어왔다. backlog/04 참조` |

12절 미결에서 해소된 항목에 취소선을 긋고 **무엇으로 해소했는지** 적는다. 기존 문서가 상태 축 항목에 쓴 방식과 같다.

`docs/backlog/04-status-mechanics.md` 의 상태를 `미착수` 에서 해소로 바꾼다.

- [ ] **Step 5: 커밋**

```bash
git add src/engine-golden.json docs/06-recommendation-engine.md docs/backlog/04-status-mechanics.md
git commit -m "refactor(engine): 회귀 기준선 갱신과 근사표 정정"
```

---

### Task 6: CI 확인과 마무리

- [ ] **Step 1: 전체를 돌린다**

```bash
npm test && npm run typecheck && npm run build
npm run db:up && npm run engine:proof && npm run verify
```

Expected: 전부 통과. `verify` 는 데이터 검증이라 이 변경과 무관하게 40/40 이어야 한다 — 바뀌었다면 엔진이 데이터에 손댄 것이므로 원인을 찾는다.

- [ ] **Step 2: CI 를 로컬에서 돌린다**

```bash
act pull_request -W .github/workflows/ci.yml -j check -P ubuntu-latest=catthehacker/ubuntu:act-latest
act pull_request -W .github/workflows/ci.yml -j guard -P ubuntu-latest=catthehacker/ubuntu:act-latest
```

Expected: 두 job 모두 `Job succeeded`. `단위 테스트` 단계가 목록에 있어야 한다.

- [ ] **Step 3: 푸시하고 드래프트를 정식 PR 로 바꾼다**

```bash
git push -u origin feat/engine-deck-feature
gh pr ready
```

---

## 자체 검토

**명세 대응** — `docs/06-recommendation-engine.md` 10절 근사 중 이 계획이 덮는 것:

| 근사 | 대응 |
| --- | --- |
| 탄환 · 보호 축 없음 | Task 2 |
| 소속 조건의 판정 범위 (편성·출전 중 큰 쪽) | Task 3·4 |
| 소속 조건의 인원수 (일괄 3인) | Task 3 |

**덮지 않는 것** — 효과와 발동의 짝짓기 · 효과의 크기 · 합성 진행 가치 · 전투 상성 · 상태 파생 관계. 그리고 **특수 취급 7건**은 상류 `statuses` 가 조건부 효과를 무조건 포함하는지 검증이 선행되어야 해 이 계획 밖이다(`docs/07-recommendation-system.md` 9절).

**타입 일관성** — `StatusKey`(Task 2)에 더한 두 항목을 `STATUS_MATCH` 가 쓴다. `Condition` 의 `scope`(Task 3)를 `evaluate`(Task 4)가 읽는다. `refineAffiliation`(Task 3)을 `loadGifts`(Task 4)가 부른다.

**의도적으로 남긴 미확정** — Task 1·2 의 테스트에 실제 소속 id 와 상태 id 자리를 비워뒀다. **짐작해서 채우면 틀린다.** 각 Task 의 첫 Step 이 데이터베이스에서 확인하는 절차이며, 확인한 값으로 채운 뒤 진행한다.
