# 기프트 능력 모형 1단계(데이터) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 기프트 발동 조건을 절(節) 단위 구조화된 사실로 갖는 데이터층을 세운다 — 표 셋, 굽는 경로, 검증, 그리고 456건 전건 검수를 돌릴 도구까지.

**Architecture:** 설명문을 LLM 이 오프라인에서 절로 나눠 `data/authored/gift-ability.jsonl` 에 적고, 사람이 전건 검수하고, `seed-authored` 가 `app.gift_ability_authored` 에 심고, `v2:build` 가 `canonical.gift_ability` · `gift_ability_cond` 로 굽는다. 빌드는 설명문을 다시 읽지 않는다 — 그래야 결정적이고 `v2:verify:rebuild` 가 성립한다(ADR-08). 판정 코드는 이 PR 에서 안 바꾼다(2단계).

**Tech Stack:** TypeScript · Prisma(PostgreSQL 3스키마 raw/canonical/app) · node:test · tsx

## Global Constraints

- **규칙은 코드 · 사실은 데이터** (ADR-08). 조건이 무엇인지는 저작 데이터가 정한다. 코드는 읽는 방법만 안다.
- **「모른다」를 「아니다」로 쓰지 않는다.** 문턱값을 못 찾으면 `threshold = null` 로 두고 `field_gap` 에 남긴다. **기본값 1을 넣지 않는다.**
- **기존 표를 지우지 않는다.** `gift_trigger` · `gift_effect` · `trigger_ref` · `effect_ref` · `gift_trigger_param` 은 적재를 계속하고 폐기 주석만 붙인다. 엔진만 읽지 않게 한다.
- **효과 크기를 담지 않는다.** 수량 · 배율 · 지속 · 적 쪽 효과는 뽑지 않는다.
- **판정 코드를 바꾸지 않는다.** `lib/engine/v2/evaluate.ts` · `profile.ts` · `load.ts` 는 이 PR 에서 손대지 않는다. 2단계 PR 의 몫이다.
- **편성 모형** — 편성 12인 · 출격 7인 · 대기 5인. `scope` 는 `field`(출격 7) · `roster`(편성 12) · `waiting`(대기 5) · `slot`(1~7) · `enemy` · `none` 여섯.
- **공급을 세는 표** — `association` → `identity_association`, `unit_keyword` → `identity_unit_keyword`(`identity_keyword` 가 아니다), `coin`+`minus` → `skill_stage.coin_value < 0`.
- **모든 주석과 커밋 메시지는 한국어.** 기존 코드베이스 문체를 따른다 — 무엇을 하는지가 아니라 왜 그런지를 적는다.
- **DB 스키마를 드롭하지 않는다.** 실패한 실험 스키마도 이름만 바꿔 남긴다.

---

## File Structure

```
prisma/v2/schema.prisma
  canonical.GiftAbility          능력 = 설명문 문단 하나
  canonical.GiftAbilityCond      능력의 조건. group 간 AND · group 내 OR
  app.GiftAbilityAuthored        저작 사실. payload 에 능력+조건을 통째로
  기존 5개 모델에 폐기 주석

src/v2/ability-payload.ts        payload 타입과 순수 검사기. DB 없이 테스트한다
src/v2/ability-payload.test.ts

src/v2/authored.ts               readAuthored · unknownRefs · authoredDigest 확장
src/v2/authored.test.ts

src/v2/canonical/gift-ability.ts       payload → canonical 행. 순수 함수
src/v2/canonical/gift-ability.test.ts

src/v2/seed-authored.ts          jsonl 을 읽어 app 에 심는다
src/v2/load-canonical.ts         buildGiftAbility 를 붙인다
src/v2/verify-canonical.ts       적재·결손 검사를 더한다

lib/engine/v2/deprecated-tables.test.ts   엔진이 폐기 표를 다시 읽지 못하게

data/authored/gift-ability.jsonl          저작 결과. 씨앗 10건으로 시작
scripts/extract-gift-ability.ts           LLM 추출 (2회 독립)
scripts/diff-gift-ability.ts              두 판 비교 → 검수 우선순위
scripts/review-gift-ability.ts            검수 화면. 회차 재개 가능
```

---

### Task 1: 표 셋과 payload 타입

**Files:**
- Modify: `prisma/v2/schema.prisma` (canonical 은 `GiftTriggerParam` 뒤 · app 은 `AxisGrant` 뒤)
- Create: `src/v2/ability-payload.ts`
- Test: `src/v2/ability-payload.test.ts`

**Interfaces:**
- Produces: `AbilityCond` · `AbilityPayload` 타입, `validatePayload(p: AbilityPayload): string[]`, 상수 `SCOPES` · `SUPPLIES` · `OPS` · `TIMINGS`

- [ ] **Step 1: payload 타입과 검사기 테스트를 쓴다**

`src/v2/ability-payload.test.ts` 를 만든다.

```typescript
/**
 * payload 검사기 — DB 없이 돈다.
 *
 * 저작 파일이 손으로 고쳐지므로 형식이 틀어질 수 있다. 심기 전에 여기서 막는다.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validatePayload, type AbilityPayload } from './ability-payload.js';

const ok: AbilityPayload = {
	timing: 'turn_start',
	unconditional: false,
	refines: null,
	sourceText: '약지 소속 인격이 가하는 피해량 +10%',
	conds: [{
		group: 0, idx: 0, refKind: 'association', refId: 'RING_FINGER',
		op: 'has', threshold: null, scope: 'roster', supply: 'tag',
		slot: null, runtime: false, resonanceMode: null,
	}],
};

test('제대로 된 payload 는 문제가 없다', () => {
	assert.deepEqual(validatePayload(ok), []);
});

test('unconditional 이면 조건이 없어야 한다', () => {
	const bad = { ...ok, unconditional: true };
	assert.deepEqual(validatePayload(bad), ['unconditional=true 인데 조건이 1개 있다']);
});

test('unconditional 이 아닌데 조건이 없으면 결손이지 오류가 아니다', () => {
	// 「조건이 있는 줄은 아는데 못 뽑았다」를 표현하는 자리다. 막지 않는다 —
	// 대신 굽는 쪽이 field_gap 을 남긴다(Task 4).
	const gap = { ...ok, conds: [] };
	assert.deepEqual(validatePayload(gap), []);
});

test('timing 어휘 밖은 잡는다', () => {
	const bad = { ...ok, timing: 'when_i_feel_like_it' };
	assert.deepEqual(validatePayload(bad), ['timing 이 어휘에 없다: when_i_feel_like_it']);
});

test('scope=slot 이면 slot 이 1~7 이어야 한다', () => {
	const c = { ...ok.conds[0], scope: 'slot' as const, slot: 9 };
	assert.deepEqual(validatePayload({ ...ok, conds: [c] }), ['조건 0/0 의 slot 이 1~7 이 아니다: 9']);
});

test('출격이 7인이므로 7번 자리는 있다', () => {
	// 9759 불 꺼진 랜턴이 「[편성 7번 인격 전용 효과]」다. 1~5 로 두면 죽는다.
	const c = { ...ok.conds[0], scope: 'slot' as const, slot: 7 };
	assert.deepEqual(validatePayload({ ...ok, conds: [c] }), []);
});

test('scope 가 slot 이 아니면 slot 은 null 이어야 한다', () => {
	const c = { ...ok.conds[0], slot: 3 };
	assert.deepEqual(validatePayload({ ...ok, conds: [c] }), ["조건 0/0 은 scope='slot' 이 아닌데 slot 이 있다: 3"]);
});

test('group 과 idx 는 0 부터 빈틈없이 이어져야 한다', () => {
	const conds = [
		{ ...ok.conds[0], group: 0, idx: 0 },
		{ ...ok.conds[0], group: 0, idx: 2 },
	];
	assert.deepEqual(validatePayload({ ...ok, conds }), ['group 0 의 idx 가 0..1 로 이어지지 않는다: 0,2']);
});

test('supply=skill 은 축으로만 셀 수 있다', () => {
	// 스킬이 실제로 그 상태를 주는가는 coin_token 으로 세는데, coin_token 은
	// 축만 안다. 소속을 스킬로 셀 방법이 없다.
	const c = { ...ok.conds[0], supply: 'skill' as const };
	assert.deepEqual(validatePayload({ ...ok, conds: [c] }), ["조건 0/0 은 supply='skill' 인데 refKind 가 axis 가 아니다: association"]);
});

test('threshold 는 null 이거나 1 이상이다', () => {
	const c = { ...ok.conds[0], threshold: 0 };
	assert.deepEqual(validatePayload({ ...ok, conds: [c] }), ['조건 0/0 의 threshold 가 1 미만이다: 0']);
});

test('resonanceMode 는 resonance 조건에만 붙는다', () => {
	const c = { ...ok.conds[0], resonanceMode: 'absolute' };
	assert.deepEqual(validatePayload({ ...ok, conds: [c] }), ["조건 0/0 은 refKind 가 resonance 가 아닌데 resonanceMode 가 있다: absolute"]);
});
```

- [ ] **Step 2: 테스트를 돌려 실패를 확인한다**

Run: `npx tsx --test src/v2/ability-payload.test.ts`
Expected: FAIL — `Cannot find module './ability-payload.js'`

- [ ] **Step 3: `src/v2/ability-payload.ts` 를 쓴다**

```typescript
/**
 * 기프트 능력 저작 payload — 타입과 형식 검사.
 *
 * 저작 파일(`data/authored/gift-ability.jsonl`)은 사람이 손으로 고친다.
 * 형식이 틀어진 채 DB 로 들어가면 굽는 쪽에서 뒤늦게 터지므로 여기서 막는다.
 *
 * **DB 를 안 본다.** 참조가 실재하는지(`refId` 가 진짜 소속인지)는 여기서
 * 안 보고 `unknownRefs`(authored.ts)가 굽기 직전에 본다 — `schema-ops.ts` 와
 * 같은 갈래다.
 */

/** 세는 모집단. 거울 던전은 편성 12인 · 출격 7인 · 대기 5인이다 */
export const SCOPES = ['field', 'roster', 'waiting', 'slot', 'enemy', 'none'] as const;
/** 공급을 어디서 세는가. skill 은 coin_token, tag 는 identity_axis */
export const SUPPLIES = ['skill', 'tag', 'any'] as const;
export const OPS = ['gte', 'eq', 'has'] as const;
/** 발동 시점. 닫힌 집합이다 — 밖의 것이 나오면 'other' 로 두고 결손을 남긴다 */
export const TIMINGS = [
	'combat_start', 'turn_start', 'turn_end', 'on_use', 'on_hit',
	'on_kill', 'on_clash', 'floor_start', 'none', 'other',
] as const;
/** 출격이 7인이므로 자리는 7번까지 있다 — 9759 불 꺼진 랜턴이 「편성 7번」이다 */
export const MAX_SLOT = 7;

export interface AbilityCond {
	group: number;
	idx: number;
	refKind: string;
	refId: string;
	op: (typeof OPS)[number];
	/** 문장에 없으면 null. **1 로 가정하지 않는다** */
	threshold: number | null;
	scope: (typeof SCOPES)[number];
	supply: (typeof SUPPLIES)[number];
	slot: number | null;
	/** 전투 중에만 아는가. 참이면 편성만 보고 배제할 수 없다 */
	runtime: boolean;
	/** activate(일반 공명) · absolute(완전 공명). resonance 조건에만 붙는다 */
	resonanceMode: string | null;
}

export interface AbilityPayload {
	timing: string;
	/**
	 * 조건 없이 도는가.
	 *
	 * 참이면 `conds` 가 반드시 비어 있다. **거짓인데 비어 있으면 결손이다** —
	 * 조건이 있는 줄은 아는데 못 뽑은 자리이고, 굽는 쪽이 `field_gap` 을 남긴다.
	 * 두 경우가 같은 모양이 되지 않게 이 칸을 따로 둔다.
	 */
	unconditional: boolean;
	/**
	 * 다른 능력의 강화판인가. 그 능력의 ordinal, 독립이면 null.
	 *
	 * **「- N인 이상」 티어는 여기 안 쓴다.** 티어는 원 능력과 독립으로 켜지고
	 * 꺼지므로 독립 능력이다. 데스페라도(9235)가 그 증거다 — 기본 절이 아예
	 * 없고 최저 티어가 2인이라 원 능력이라 부를 것이 없다. `refines` 는
	 * 「효과가 강화되어」처럼 앞 절의 결과를 전제하는 것에만 쓴다.
	 */
	refines: number | null;
	/** 설명문에서 이 능력에 해당하는 문단 원문. 검수와 재현의 근거다 */
	sourceText: string;
	conds: AbilityCond[];
}

const has = <T extends readonly string[]>(pool: T, v: string): boolean =>
	(pool as readonly string[]).includes(v);

/** 형식 문제를 사람 말로 낸다. 빈 배열이면 통과다 */
export function validatePayload(p: AbilityPayload): string[] {
	const out: string[] = [];

	if (!has(TIMINGS, p.timing)) out.push(`timing 이 어휘에 없다: ${p.timing}`);
	if (p.unconditional && p.conds.length > 0) {
		out.push(`unconditional=true 인데 조건이 ${p.conds.length}개 있다`);
	}
	if (p.sourceText.trim() === '') out.push('sourceText 가 비어 있다 — 근거 없이 굽지 않는다');

	for (const c of p.conds) {
		const at = `조건 ${c.group}/${c.idx}`;
		if (!has(OPS, c.op)) out.push(`${at} 의 op 가 어휘에 없다: ${c.op}`);
		if (!has(SCOPES, c.scope)) out.push(`${at} 의 scope 가 어휘에 없다: ${c.scope}`);
		if (!has(SUPPLIES, c.supply)) out.push(`${at} 의 supply 가 어휘에 없다: ${c.supply}`);
		if (c.threshold !== null && c.threshold < 1) {
			out.push(`${at} 의 threshold 가 1 미만이다: ${c.threshold}`);
		}
		if (c.scope === 'slot') {
			if (c.slot === null || c.slot < 1 || c.slot > MAX_SLOT) {
				out.push(`${at} 의 slot 이 1~${MAX_SLOT} 이 아니다: ${c.slot}`);
			}
		} else if (c.slot !== null) {
			out.push(`${at} 은 scope='slot' 이 아닌데 slot 이 있다: ${c.slot}`);
		}
		if (c.supply === 'skill' && c.refKind !== 'axis') {
			out.push(`${at} 은 supply='skill' 인데 refKind 가 axis 가 아니다: ${c.refKind}`);
		}
		if (c.resonanceMode !== null && c.refKind !== 'resonance') {
			out.push(`${at} 은 refKind 가 resonance 가 아닌데 resonanceMode 가 있다: ${c.resonanceMode}`);
		}
	}

	/** group 과 idx 가 0 부터 빈틈없이 이어지는가 — 빈틈은 뽑다 만 흔적이다 */
	const groups = new Map<number, number[]>();
	for (const c of p.conds) groups.set(c.group, [...(groups.get(c.group) ?? []), c.idx]);
	const gNums = [...groups.keys()].sort((a, b) => a - b);
	for (let i = 0; i < gNums.length; i += 1) {
		if (gNums[i] !== i) { out.push(`group 이 0..${gNums.length - 1} 로 이어지지 않는다: ${gNums.join(',')}`); break; }
	}
	for (const [g, idxs] of [...groups].sort((a, b) => a[0] - b[0])) {
		const sorted = [...idxs].sort((a, b) => a - b);
		const bad = sorted.some((v, i) => v !== i);
		if (bad) out.push(`group ${g} 의 idx 가 0..${sorted.length - 1} 로 이어지지 않는다: ${sorted.join(',')}`);
	}

	return out;
}
```

- [ ] **Step 4: 테스트가 통과하는지 본다**

Run: `npx tsx --test src/v2/ability-payload.test.ts`
Expected: PASS (11건)

- [ ] **Step 5: Prisma 모델 셋을 더한다**

`prisma/v2/schema.prisma` 의 `model GiftTriggerParam { … }` 블록 **바로 뒤**에 canonical 둘을 넣는다.

```prisma
/// 기프트 능력 — 설명문 문단 하나가 능력 하나다.
///
/// 강화 단계마다 따로 있다. 단계가 둘 이상인 기프트 110개 중 87개가 단계에
/// 따라 조건 자체가 바뀌기 때문이다(9001 은 2단계에서 완전 공명 → 공명으로
/// 느슨해진다).
///
/// `app.gift_ability_authored` 가 정본이다. 이 표는 그것을 편 것이고, 빌드는
/// 설명문을 다시 읽지 않는다 — 그래야 결과가 고정되고 재현 가능하다(ADR-08).
model GiftAbility {
  giftId        String @map("gift_id")
  level         Int
  ordinal       Int
  /// 발동 시점. 머리표(턴 시작 시)와 문말 시점구에서 온다. 모르면 'none'
  timing        String
  /// 조건 없이 도는가. 참이면 conds 가 비어 있다.
  /// **거짓인데 비어 있으면 결손이다** — field_gap 이 그 사실을 적는다
  unconditional Boolean
  /// 다른 능력의 강화판인가. 그 능력의 ordinal, 독립이면 null.
  /// 강화판은 켜짐 판정에 참여하지 않는다 — 원 능력이 죽으면 같이 죽는다
  refines       Int?
  /// 이 능력에 해당하는 설명문 문단 원문. 검수와 재현의 근거다
  sourceText    String @map("source_text")

  gift  Gift              @relation(fields: [giftId], references: [id], onDelete: Cascade)
  conds GiftAbilityCond[]

  @@id([giftId, level, ordinal])
  @@index([giftId])
  @@map("gift_ability")
  @@schema("canonical")
}

/// 능력 하나의 발동 조건.
///
/// `group` 이 AND/OR 를 가른다 — **같은 group 안은 OR, group 끼리는 AND.**
/// 9043 사원증 「분노 완전 공명을 발동하였거나 충전 … 스킬을 사용할 경우」가
/// group 0 에 조건 2개로 들어간다. 옛 모형이 이것을 AND 로 읽어 죽였다.
model GiftAbilityCond {
  giftId        String  @map("gift_id")
  level         Int
  ordinal       Int
  group         Int
  idx           Int
  /// axis · sin · resonance · attack_type · skill_kind · coin
  /// deployment · association · unit_keyword · enemy_state · other
  refKind       String  @map("ref_kind")
  /// COMBUSTION · RING_FINGER · … . refKind='other' 면 원문 조각을 그대로 둔다
  refId         String  @map("ref_id")
  /// gte · eq · has
  op            String
  /// 문턱값. 문장에 없으면 null — **1 로 가정하지 않는다**
  threshold     Int?
  /// 세는 모집단. 거울 던전은 편성 12인 · 출격 7인 · 대기 5인이다.
  ///   field    출격 7인    「출격 인원을 기준으로 함」(9283 상납된 시가)
  ///   roster   편성 12인   「편성 인원을 기준」(9282) · 「대기 인원 포함」(9212)
  ///   waiting  대기 5인    「대기 인원에 …」(9778 통상 작전용 장비)
  ///   slot · enemy · none
  scope         String
  /// 공급을 어디서 세는가.
  ///   skill  스킬이 실제로 그 상태를 주는가. coin_token 으로 센다
  ///   tag    게임이 그 인격을 그 축으로 분류하는가. identity_axis 로 센다
  ///   any    둘 중 하나면 된다
  /// refKind 마다 보는 표가 다르다 — association 은 identity_association,
  /// unit_keyword 는 **identity_unit_keyword**(identity_keyword 가 아니다.
  /// 후자는 축 7종뿐이라 BLOODFIEND 가 없다), coin=minus 는
  /// skill_stage.coin_value < 0
  supply        String
  /// scope='slot' 일 때 자리 번호 1~7. 출격이 7인이라 7번이 있다
  slot          Int?
  /// 전투 중에만 아는가. 참이면 편성만 보고 배제할 수 없다
  runtime       Boolean
  /// activate(일반 공명) · absolute(완전 공명). resonance 조건에만 붙는다.
  /// 공명은 스킬 슬롯에서 같은 속성이 얼마나 연속인가이고, 완전 공명은
  /// 연속 3개 이상이다
  resonanceMode String? @map("resonance_mode")

  ability GiftAbility @relation(fields: [giftId, level, ordinal], references: [giftId, level, ordinal], onDelete: Cascade)

  @@id([giftId, level, ordinal, group, idx])
  @@index([refKind, refId])
  @@map("gift_ability_cond")
  @@schema("canonical")
}
```

`model AxisGrant { … }` 블록 **바로 뒤**에 app 하나를 넣는다.

```prisma
/// 기프트 능력 저작 사실. 설명문에서 뽑아 사람이 전건 검수한 결과다.
///
/// 빌드는 이 표를 읽어 canonical.gift_ability 를 굽는다. 설명문을 다시
/// 파싱하지 않는다 — LLM 호출을 빌드에 넣으면 같은 입력에 다른 결과가 나올
/// 수 있어 v2:verify:rebuild 가 성립하지 않는다(ADR-08).
model GiftAbilityAuthored {
  giftId  String @map("gift_id")
  level   Int
  ordinal Int
  /// AbilityPayload — timing · unconditional · refines · sourceText · conds.
  /// 모양은 src/v2/ability-payload.ts 가 정하고 validatePayload 가 지킨다
  payload Json
  /// 왜 이렇게 판정했는가. 검수자가 남긴다. **지문에는 안 들어간다** —
  /// 설명을 고치는 것은 결과를 안 바꾸므로 재빌드를 요구할 이유가 없다
  note    String

  @@id([giftId, level, ordinal])
  @@map("gift_ability_authored")
  @@schema("app")
}
```

- [ ] **Step 6: DDL 을 다시 만들고 표가 늘었는지 본다**

```bash
npm run v2:schema:ddl
grep -c 'CREATE TABLE "canonical"' prisma/v2/schema.sql
grep -n 'gift_ability' prisma/v2/schema.sql | head
```

Expected: `gift_ability` · `gift_ability_cond` · `gift_ability_authored` 세 표가 보인다.

- [ ] **Step 7: Prisma 클라이언트를 다시 만들고 전체 테스트를 돌린다**

Run: `npm run v2:generate && npm test`
Expected: 기존 테스트 전부 통과 + 새 테스트 11건 통과. 실패 0.

- [ ] **Step 8: 커밋**

```bash
git add prisma/v2/schema.prisma prisma/v2/schema.sql src/v2/ability-payload.ts src/v2/ability-payload.test.ts
git commit -m "feat(schema): 기프트 능력 표 셋과 payload 검사기

canonical.gift_ability      능력 = 설명문 문단 하나. 강화 단계마다 따로
canonical.gift_ability_cond 조건. group 간 AND · group 내 OR
app.gift_ability_authored   저작 사실. payload 에 능력+조건을 통째로

scope 를 field(출격 7) · roster(편성 12) · waiting(대기 5) 로 가르고
slot 을 1~7 로 둔다 — 출격이 7인이라 9759 불 꺼진 랜턴의 「편성 7번」이 있다.

validatePayload 는 DB 를 안 본다. 저작 파일이 손으로 고쳐지므로 형식이
틀어진 채 들어가는 것을 심기 전에 막는다."
```

---

### Task 2: 폐기 표시와 엔진 경계 테스트

**Files:**
- Modify: `prisma/v2/schema.prisma` (모델 5개 주석)
- Modify: `src/v2/canonical/gift-trigger-param.ts` (파일 머리 주석)
- Create: `lib/engine/v2/deprecated-tables.test.ts`

**Interfaces:**
- Consumes: Task 1 의 `GiftAbility` 모델 이름
- Produces: 없음 (문서와 경계 테스트뿐)

- [ ] **Step 1: 경계 테스트를 쓴다 — 아직 통과한다**

`lib/engine/v2/deprecated-tables.test.ts` 를 만든다. **지금은 엔진이 폐기 표를 읽고 있으므로 이 테스트는 실패해야 정상이다.** 2단계 PR 이 끊을 때까지 「알려진 부채」로 남긴다. 그래서 지금은 **현재 읽는 표를 명시적으로 허용 목록에 적고**, 그 목록이 늘어나는 것만 막는다.

```typescript
/**
 * 엔진이 폐기된 표를 **새로** 읽지 못하게 한다.
 *
 * 폐기 5표는 canonical.gift_ability 가 대신한다. 다만 판정을 옮기는 것은
 * 2단계 PR 이므로 지금은 아직 읽고 있다 — 그 사실을 허용 목록에 적어 두고,
 * **목록이 늘어나는 것만** 막는다. 2단계가 판정을 옮기면 이 목록을 비운다.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const DEPRECATED = ['giftTrigger', 'giftEffect', 'triggerRef', 'effectRef', 'giftTriggerParam'];

/** 2단계 PR 이 끊을 때까지 남는 부채. **여기에 새로 더하지 마라** */
const ALLOWED_UNTIL_STAGE_2 = new Set(['giftTrigger', 'triggerRef', 'giftTriggerParam']);

test('엔진이 읽는 폐기 표가 허용 목록보다 늘지 않았다', () => {
	const src = readFileSync(new URL('./load.ts', import.meta.url), 'utf8');
	const read = DEPRECATED.filter((t) => src.includes(`prisma.${t}.`));
	const unexpected = read.filter((t) => !ALLOWED_UNTIL_STAGE_2.has(t));
	assert.deepEqual(
		unexpected, [],
		`폐기된 표를 새로 읽고 있다: ${unexpected.join(', ')} — canonical.gift_ability 를 써라`,
	);
});

test('허용 목록에 죽은 항목이 없다', () => {
	// 2단계가 하나씩 끊을 때 목록도 같이 줄어야 한다. 안 줄면 이 테스트가
	// 알려준다 — 「이제 안 읽는데 목록에 남아 있다」
	const src = readFileSync(new URL('./load.ts', import.meta.url), 'utf8');
	const stale = [...ALLOWED_UNTIL_STAGE_2].filter((t) => !src.includes(`prisma.${t}.`));
	assert.deepEqual(
		stale, [],
		`이제 안 읽는데 허용 목록에 남아 있다: ${stale.join(', ')} — 목록에서 빼라`,
	);
});
```

- [ ] **Step 2: 테스트를 돌린다**

Run: `npx tsx --test lib/engine/v2/deprecated-tables.test.ts`
Expected: PASS 2건. 실패하면 `ALLOWED_UNTIL_STAGE_2` 를 `load.ts` 가 실제로 읽는 표에 맞춘다 — **더 넓히지 말고 실제와 맞춘다.**

- [ ] **Step 3: 폐기 주석을 단다**

`prisma/v2/schema.prisma` 의 다섯 모델 위에 각각 `///` 주석을 넣는다. `model GiftTrigger` 위:

```prisma
/// **폐기됨 (2026-08-11)** — `canonical.gift_ability` 가 대신한다.
///
/// limbus-assets 만 갖는 제3자 큐레이터 태그다. 게임 데이터가 아니다.
/// 451 기프트 중 282(63%)가 트리거 수 ≠ 효과 수라 짝짓기가 원리상 불가능하고,
/// 이 표를 논리곱으로 읽어 「발동 불가」 173건 중 158건(91%)이 틀렸다.
///
/// **적재는 계속한다** — 출처가 말한 것을 지우지 않는다. 엔진만 읽지 않는다.
model GiftTrigger {
```

`model GiftEffect` 위:

```prisma
/// **폐기됨 (2026-08-11)** — `canonical.gift_ability` 가 대신한다.
///
/// effect 55종은 이름뿐이다 — 강화 단계별 구분도, 수량도, 시점도 없고
/// `effect_ref.ref_id` 는 55종 중 27종이 'none' 이다. 트리거와 짝지을 수 없다.
/// 적재는 계속한다. 엔진만 읽지 않는다.
model GiftEffect {
```

`model TriggerRef` 위:

```prisma
/// **폐기됨 (2026-08-11)** — `canonical.gift_ability_cond` 가 대신한다.
///
/// `evaluability` 150건은 **트리거 이름의 접미사로 우리가 지어냈다**
/// (`' Identities'` 로 끝나면 roster). `Allies have X Skill` 한 문형이
/// 최소 세 가지 뜻을 겹쳐 쓰는데(진짜 조건 · 적용 범위 · 우선순위 주석)
/// 이름만 보고는 못 가른다. 적재는 계속한다. 엔진만 읽지 않는다.
model TriggerRef {
```

`model EffectRef` 위:

```prisma
/// **폐기됨 (2026-08-11)** — `canonical.gift_ability_cond` 가 대신한다.
///
/// effect 어휘 자체가 이름뿐이라 이 참조도 가리킬 실체가 없다.
/// 적재는 계속한다. 엔진만 읽지 않는다.
model EffectRef {
```

`model GiftTriggerParam` 위:

```prisma
/// **폐기됨 (2026-08-11)** — `canonical.gift_ability_cond` 가 대신한다.
///
/// 설명문에서 정규식 6개로 수치를 뽑았고 (기프트,트리거) 1,081짝 중 122짝
/// (11%)만 건졌다. 2026-08-11 에 더한 `kind='gate'` 49건은 「첫 문단에
/// 「발동」이 있으면 게이트」라는 근사이고, 절 구조가 들어오면 조건이 어느
/// 절에 붙는지 데이터가 직접 말하므로 그 근사가 필요 없어진다.
/// 적재는 계속한다. 엔진만 읽지 않는다.
model GiftTriggerParam {
```

- [ ] **Step 4: 적재기 머리 주석에도 같은 내용을 적는다**

`src/v2/canonical/gift-trigger-param.ts` 의 파일 머리 주석 **맨 앞 줄**에 한 줄을 더한다.

```typescript
/**
 * **이 표는 폐기됐다 (2026-08-11)** — `canonical.gift_ability_cond` 가 대신한다.
 * 적재는 계속한다(출처가 말한 것을 지우지 않는다). 엔진만 읽지 않는다.
 *
 * (아래는 기존 주석 그대로)
 *
```

- [ ] **Step 5: DDL 을 다시 만들고 테스트를 돌린다**

Run: `npm run v2:schema:ddl && npm test`
Expected: 전부 통과. 주석만 바뀌었으므로 표 수는 그대로다.

- [ ] **Step 6: 커밋**

```bash
git add prisma/v2/schema.prisma prisma/v2/schema.sql src/v2/canonical/gift-trigger-param.ts lib/engine/v2/deprecated-tables.test.ts
git commit -m "docs(schema): 기프트 태그 5표에 폐기 표시 · 엔진 경계 테스트

gift_trigger · gift_effect · trigger_ref · effect_ref · gift_trigger_param.
적재는 계속한다 — 출처가 말한 것을 지우지 않는다. 엔진만 읽지 않는다.

경계 테스트는 지금 읽는 셋을 허용 목록에 적고 **늘어나는 것만** 막는다.
판정을 옮기는 것은 2단계 PR 이라 지금 끊으면 화면이 죽는다. 2단계가
하나씩 끊을 때 목록도 줄어야 하고, 안 줄면 두 번째 테스트가 알려준다."
```

---

### Task 3: 저작을 읽고 · 검사하고 · 지문에 넣는다

**Files:**
- Modify: `src/v2/authored.ts`
- Modify: `src/v2/authored.test.ts`

**Interfaces:**
- Consumes: Task 1 의 `AbilityPayload` · `validatePayload`
- Produces: `Authored.giftAbility: GiftAbilityAuthoredRow[]` 에 `{ giftId, level, ordinal, payload }`. `unknownRefs` 가 새 refKind 넷(`sin` · `attack_type` · `skill_kind` · `resonance`)을 검사. `KnownIds` 에 `sinIds` · `attackTypes` · `skillKinds` · `resonanceIds` 추가.

- [ ] **Step 1: 테스트를 더한다**

`src/v2/authored.test.ts` 끝에 붙인다.

```typescript
import { validatePayload } from './ability-payload.js';

const known = {
	axisIds: new Set(['COMBUSTION', 'BREATH']),
	unitKeywordIds: new Set(['BLOODFIEND']),
	associationIds: new Set(['RING_FINGER']),
	sinIds: new Set(['wrath', 'gloom']),
	attackTypes: new Set(['slash', 'pierce', 'blunt']),
	skillKinds: new Set(['counter', 'evade', 'guard']),
	resonanceIds: new Set(['wrath', 'gloom']),
};
const emptyAuthored = { refException: [], egoGranted: [], axisGrant: [], giftAbility: [] };
const ability = (conds: unknown[]) => ({
	giftId: '9262', level: 0, ordinal: 0,
	payload: { timing: 'none', unconditional: false, refines: null, sourceText: '문단', conds },
});

test('실재하는 참조는 통과한다', () => {
	const a = { ...emptyAuthored, giftAbility: [ability([
		{ group: 0, idx: 0, refKind: 'association', refId: 'RING_FINGER', op: 'has',
		  threshold: null, scope: 'roster', supply: 'tag', slot: null, runtime: false, resonanceMode: null },
	])] };
	assert.deepEqual(unknownRefs(a, known), []);
});

test('없는 소속은 잡는다', () => {
	const a = { ...emptyAuthored, giftAbility: [ability([
		{ group: 0, idx: 0, refKind: 'association', refId: 'NOT_A_CLAN', op: 'has',
		  threshold: null, scope: 'roster', supply: 'tag', slot: null, runtime: false, resonanceMode: null },
	])] };
	assert.deepEqual(unknownRefs(a, known), ['gift_ability 9262/0/0 조건 0/0 의 association 참조가 없다: NOT_A_CLAN']);
});

test('새 참조 종류 넷도 검사한다', () => {
	const a = { ...emptyAuthored, giftAbility: [ability([
		{ group: 0, idx: 0, refKind: 'attack_type', refId: 'kick', op: 'has',
		  threshold: null, scope: 'field', supply: 'tag', slot: null, runtime: false, resonanceMode: null },
	])] };
	assert.deepEqual(unknownRefs(a, known), ['gift_ability 9262/0/0 조건 0/0 의 attack_type 참조가 없다: kick']);
});

test("refKind='other' 는 검사에서 뺀다", () => {
	// 어휘에 못 담는 조건의 원문 조각을 담는 자리다. 실재를 물을 수 없다.
	const a = { ...emptyAuthored, giftAbility: [ability([
		{ group: 0, idx: 0, refKind: 'other', refId: '지령 대상이 사망했으면', op: 'has',
		  threshold: null, scope: 'enemy', supply: 'any', slot: null, runtime: true, resonanceMode: null },
	])] };
	assert.deepEqual(unknownRefs(a, known), []);
});

test('형식이 틀어진 payload 도 unknownRefs 가 함께 잡는다', () => {
	// 심을 때 막지만(Task 5) 손으로 DB 를 고칠 수 있으므로 굽기 직전에 다시 본다
	const a = { ...emptyAuthored, giftAbility: [ability([
		{ group: 0, idx: 0, refKind: 'association', refId: 'RING_FINGER', op: 'has',
		  threshold: null, scope: 'slot', supply: 'tag', slot: 9, runtime: false, resonanceMode: null },
	])] };
	assert.deepEqual(unknownRefs(a, known), ['gift_ability 9262/0/0 형식: 조건 0/0 의 slot 이 1~7 이 아니다: 9']);
});

test('지문은 payload 를 반영하고 note 는 무시한다', async () => {
	const base = { ...emptyAuthored, giftAbility: [ability([])] };
	const changed = { ...emptyAuthored, giftAbility: [{ ...ability([]), payload: { ...ability([]).payload, timing: 'turn_start' } }] };
	assert.notEqual(authoredDigest(base), authoredDigest(changed));
});
```

- [ ] **Step 2: 테스트를 돌려 실패를 확인한다**

Run: `npx tsx --test src/v2/authored.test.ts`
Expected: FAIL — `giftAbility` 가 `Authored` 에 없다는 타입 오류

- [ ] **Step 3: `src/v2/authored.ts` 를 고친다**

타입을 더한다.

```typescript
import { validatePayload, type AbilityPayload } from './ability-payload.js';

export interface GiftAbilityAuthoredRow {
	giftId: string;
	level: number;
	ordinal: number;
	payload: AbilityPayload;
}

export interface Authored {
	refException: Array<{ kind: string; key: string; refKind: string; refId: string }>;
	egoGranted: Array<{ egoId: string; axisId: string }>;
	axisGrant: AxisGrantRow[];
	giftAbility: GiftAbilityAuthoredRow[];
}

export interface KnownIds {
	axisIds: Set<string>;
	unitKeywordIds: Set<string>;
	associationIds: Set<string>;
	sinIds: Set<string>;
	attackTypes: Set<string>;
	skillKinds: Set<string>;
	resonanceIds: Set<string>;
}
```

`readAuthored` 에 한 줄을 더한다 — `Promise.all` 배열에 넣고 구조 분해를 늘린다.

```typescript
		prisma.giftAbilityAuthored.findMany({
			select: { giftId: true, level: true, ordinal: true, payload: true },
			orderBy: [{ giftId: 'asc' }, { level: 'asc' }, { ordinal: 'asc' }],
		}),
```

반환에 `giftAbility: giftAbility as GiftAbilityAuthoredRow[]` 를 더한다.

`unknownRefs` 의 `pool` 에 넷을 더하고, 기프트 능력을 도는 부분을 붙인다.

```typescript
	const pool: Record<string, Set<string>> = {
		axis: known.axisIds,
		unit_keyword: known.unitKeywordIds,
		association: known.associationIds,
		sin: known.sinIds,
		attack_type: known.attackTypes,
		skill_kind: known.skillKinds,
		resonance: known.resonanceIds,
	};

	// … 기존 refException · egoGranted · axisGrant 검사 …

	/**
	 * 기프트 능력 — 형식과 참조를 함께 본다.
	 *
	 * 심을 때도 막지만(seed-authored) 사람이 DB 를 직접 고칠 수 있으므로
	 * **굽기 직전에 다시 본다**. `refKind='other'` 는 어휘에 못 담는 조건의
	 * 원문 조각이라 실재를 물을 수 없다 — 검사에서 뺀다.
	 */
	for (const g of a.giftAbility) {
		const at = `gift_ability ${g.giftId}/${g.level}/${g.ordinal}`;
		for (const problem of validatePayload(g.payload)) out.push(`${at} 형식: ${problem}`);
		for (const c of g.payload.conds) {
			if (c.refKind === 'other') continue;
			const set = pool[c.refKind];
			if (set === undefined) {
				out.push(`${at} 조건 ${c.group}/${c.idx} 의 refKind 가 어휘에 없다: ${c.refKind}`);
			} else if (!set.has(c.refId)) {
				out.push(`${at} 조건 ${c.group}/${c.idx} 의 ${c.refKind} 참조가 없다: ${c.refId}`);
			}
		}
	}
```

`authoredDigest` 에 `giftAbility` 를 넣는다 — `note` 는 애초에 안 읽으므로 자동으로 빠진다.

- [ ] **Step 4: 테스트가 통과하는지 본다**

Run: `npx tsx --test src/v2/authored.test.ts && npm test`
Expected: 새 6건 포함 전부 통과. `KnownIds` 를 넓혔으므로 `load-canonical.ts` 의 호출부가 타입 오류를 낸다 — Task 6 에서 채운다. **지금은 `npx tsc --noEmit` 이 그 한 자리만 빨간 것이 정상이다.**

- [ ] **Step 5: 커밋**

```bash
git add src/v2/authored.ts src/v2/authored.test.ts
git commit -m "feat(authored): 기프트 능력 저작을 읽고 검사하고 지문에 넣는다

unknownRefs 가 참조 종류 넷을 더 본다 — sin · attack_type · skill_kind ·
resonance. refKind='other' 는 어휘에 못 담는 조건의 원문 조각이라
실재를 물을 수 없어 뺀다.

형식 검사(validatePayload)도 여기서 한 번 더 돌린다. 심을 때 막지만
사람이 DB 를 직접 고칠 수 있으므로 굽기 직전에 다시 본다.

authoredDigest 에 payload 를 넣는다. note 는 안 읽으므로 자동으로 빠진다 —
설명을 고치는 것은 결과를 안 바꾸므로 재빌드를 요구할 이유가 없다."
```

---

### Task 4: 굽기 — payload 를 canonical 행으로

**Files:**
- Create: `src/v2/canonical/gift-ability.ts`
- Test: `src/v2/canonical/gift-ability.test.ts`

**Interfaces:**
- Consumes: Task 3 의 `GiftAbilityAuthoredRow`, 기존 `Meta`(`src/v2/canonical/meta.ts`)
- Produces: `buildGiftAbility(input: GiftAbilityInput, meta: Meta): { abilities: AbilityRow[]; conds: CondRow[] }`
  - `AbilityRow = { giftId, level, ordinal, timing, unconditional, refines, sourceText }`
  - `CondRow = { giftId, level, ordinal, group, idx, refKind, refId, op, threshold, scope, supply, slot, runtime, resonanceMode }`

- [ ] **Step 1: 테스트를 쓴다**

`src/v2/canonical/gift-ability.test.ts` 를 만든다.

```typescript
/**
 * 굽기 — 저작 payload 를 canonical 행으로. **순수 함수라 DB 가 필요 없다.**
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildGiftAbility } from './gift-ability.js';
import { Meta } from './meta.js';
import type { GiftAbilityAuthoredRow } from '../authored.js';

const cond = (over: Record<string, unknown> = {}) => ({
	group: 0, idx: 0, refKind: 'association', refId: 'RING_FINGER', op: 'has' as const,
	threshold: null, scope: 'roster' as const, supply: 'tag' as const,
	slot: null, runtime: false, resonanceMode: null, ...over,
});
const row = (over: Record<string, unknown> = {}): GiftAbilityAuthoredRow => ({
	giftId: '9262', level: 0, ordinal: 0,
	payload: { timing: 'none', unconditional: false, refines: null, sourceText: '문단', conds: [cond()] },
	...over,
} as GiftAbilityAuthoredRow);

test('능력 하나와 조건 하나를 편다', () => {
	const meta = new Meta();
	const out = buildGiftAbility({ authored: [row()], giftIds: new Set(['9262']) }, meta);
	assert.equal(out.abilities.length, 1);
	assert.equal(out.conds.length, 1);
	assert.equal(out.conds[0].refId, 'RING_FINGER');
	assert.equal(out.conds[0].giftId, '9262');
	assert.equal(out.conds[0].ordinal, 0);
});

test('없는 기프트를 가리키면 버리고 결손으로 남긴다', () => {
	// 저작이 실물을 앞지를 수 있다 — 새 기프트가 나오기 전에 적어 둘 수 있어야
	// 한다. 다만 FK 가 걸려 있으므로 굽지는 않는다.
	const meta = new Meta();
	const out = buildGiftAbility({ authored: [row({ giftId: '9999' })], giftIds: new Set(['9262']) }, meta);
	assert.equal(out.abilities.length, 0);
	assert.equal(meta.gaps().some((g) => g.entityId === '9999' && g.field === 'gift_ability'), true);
});

test('unconditional 이 아닌데 조건이 없으면 결손을 남기고 굽는다', () => {
	// 「조건이 있는 줄은 아는데 못 뽑았다」이므로 능력 자체는 살린다.
	// 판정은 조건이 없으면 못 막으니 결과적으로 켜지는 쪽이고, 그것이
	// 「모른다를 아니다로 쓰지 않는다」에 맞다.
	const meta = new Meta();
	const p = { timing: 'none', unconditional: false, refines: null, sourceText: '문단', conds: [] };
	const out = buildGiftAbility({ authored: [row({ payload: p })], giftIds: new Set(['9262']) }, meta);
	assert.equal(out.abilities.length, 1);
	assert.equal(meta.gaps().some((g) => g.field === 'conds' && g.entityId === '9262'), true);
});

test('threshold 가 null 이면 결손을 남긴다', () => {
	// 「문턱값을 못 찾았다」를 정직하게 적는다. 1 로 가정하지 않는다 —
	// 그 가정이 Allies have% 118짝 중 76짝을 틀리게 만들었다.
	const meta = new Meta();
	const p = { timing: 'none', unconditional: false, refines: null, sourceText: '문단',
		conds: [cond({ op: 'gte', threshold: null })] };
	const out = buildGiftAbility({ authored: [row({ payload: p })], giftIds: new Set(['9262']) }, meta);
	assert.equal(out.conds[0].threshold, null);
	assert.equal(meta.gaps().some((g) => g.field === 'threshold'), true);
});

test("op='has' 의 threshold=null 은 결손이 아니다", () => {
	// 「약지 소속 인격이」는 수가 아니라 존재가 조건이다. 문턱값이 없는 것이 옳다.
	const meta = new Meta();
	const out = buildGiftAbility({ authored: [row()], giftIds: new Set(['9262']) }, meta);
	assert.equal(out.conds[0].threshold, null);
	assert.equal(meta.gaps().some((g) => g.field === 'threshold'), false);
});

test("timing='other' 는 결손을 남긴다", () => {
	const meta = new Meta();
	const p = { timing: 'other', unconditional: true, refines: null, sourceText: '문단', conds: [] };
	const out = buildGiftAbility({ authored: [row({ payload: p })], giftIds: new Set(['9262']) }, meta);
	assert.equal(out.abilities[0].timing, 'other');
	assert.equal(meta.gaps().some((g) => g.field === 'timing'), true);
});

test('refines 가 없는 ordinal 을 가리키면 버리고 결손으로 남긴다', () => {
	// 사슬이 끊기면 강화판이 영원히 안 켜진다. 조용히 두면 안 된다.
	const meta = new Meta();
	const p = { timing: 'none', unconditional: true, refines: 5, sourceText: '문단', conds: [] };
	const out = buildGiftAbility({ authored: [row({ payload: p })], giftIds: new Set(['9262']) }, meta);
	assert.equal(out.abilities[0].refines, null);
	assert.equal(meta.gaps().some((g) => g.field === 'refines'), true);
});

test('refines 사슬은 금지한다 — 강화판을 또 강화하지 않는다', () => {
	const meta = new Meta();
	const a0 = row({ ordinal: 0, payload: { timing: 'none', unconditional: true, refines: null, sourceText: 'A', conds: [] } });
	const a1 = row({ ordinal: 1, payload: { timing: 'none', unconditional: true, refines: 0, sourceText: 'B', conds: [] } });
	const a2 = row({ ordinal: 2, payload: { timing: 'none', unconditional: true, refines: 1, sourceText: 'C', conds: [] } });
	const out = buildGiftAbility({ authored: [a0, a1, a2], giftIds: new Set(['9262']) }, meta);
	assert.equal(out.abilities.find((x) => x.ordinal === 2)?.refines, null);
	assert.equal(meta.gaps().some((g) => g.field === 'refines'), true);
});

test('기프트마다 refines=null 인 능력이 하나는 남는다', () => {
	// 전부 강화판이면 켜짐 판정에 참여하는 능력이 없어 영영 죽는다.
	const meta = new Meta();
	const a0 = row({ ordinal: 0, payload: { timing: 'none', unconditional: true, refines: 1, sourceText: 'A', conds: [] } });
	const a1 = row({ ordinal: 1, payload: { timing: 'none', unconditional: true, refines: 0, sourceText: 'B', conds: [] } });
	const out = buildGiftAbility({ authored: [a0, a1], giftIds: new Set(['9262']) }, meta);
	assert.equal(out.abilities.filter((x) => x.refines === null).length >= 1, true);
});
```

- [ ] **Step 2: 테스트를 돌려 실패를 확인한다**

Run: `npx tsx --test src/v2/canonical/gift-ability.test.ts`
Expected: FAIL — `Cannot find module './gift-ability.js'`

- [ ] **Step 3: `src/v2/canonical/gift-ability.ts` 를 쓴다**

```typescript
/**
 * 저작 능력을 canonical 행으로 편다.
 *
 * 저작 `app.gift_ability_authored` 가 정본이다. 여기서 하는 일은 **펴기와
 * 결손 기록**뿐이다 — 무엇이 조건인지는 저작이 정한다(ADR-08).
 *
 * **설명문을 읽지 않는다.** LLM 추출은 오프라인에서 한 번 돌고 결과가 저장소에
 * 커밋된다. 빌드가 다시 파싱하면 같은 입력에 다른 결과가 나올 수 있어
 * `v2:verify:rebuild` 가 성립하지 않는다.
 *
 * **「모른다」를 「아니다」로 쓰지 않는다.** 문턱값을 못 찾은 자리는 `null` 로
 * 두고 결손에 남긴다. 옛 적재기가 `need = 1` 로 가정해 `Allies have%` 118짝
 * 중 76짝을 틀리게 만들었다.
 */
import type { Meta } from './meta.js';
import type { GiftAbilityAuthoredRow } from '../authored.js';

const EVIDENCE = 'docs/superpowers/specs/2026-08-10-gift-ability-model-design.md';

export interface GiftAbilityInput {
	authored: GiftAbilityAuthoredRow[];
	/** 실재하는 기프트 id. 저작이 실물을 앞지를 수 있어 굽기 전에 거른다 */
	giftIds: Set<string>;
}

export interface AbilityRow {
	giftId: string;
	level: number;
	ordinal: number;
	timing: string;
	unconditional: boolean;
	refines: number | null;
	sourceText: string;
}

export interface CondRow {
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

export function buildGiftAbility(
	input: GiftAbilityInput,
	meta: Meta,
): { abilities: AbilityRow[]; conds: CondRow[] } {
	const abilities: AbilityRow[] = [];
	const conds: CondRow[] = [];

	/** (gift,level) 마다 실재하는 ordinal — refines 를 검사하는 데 쓴다 */
	const ordinalsOf = new Map<string, Set<number>>();
	/** refines 가 null 인 ordinal — 사슬 금지를 검사하는 데 쓴다 */
	const independentOf = new Map<string, Set<number>>();
	for (const a of input.authored) {
		const key = `${a.giftId}\t${a.level}`;
		if (!ordinalsOf.has(key)) ordinalsOf.set(key, new Set());
		if (!independentOf.has(key)) independentOf.set(key, new Set());
		ordinalsOf.get(key)?.add(a.ordinal);
		if (a.payload.refines === null) independentOf.get(key)?.add(a.ordinal);
	}

	for (const a of input.authored) {
		const p = a.payload;
		const at = `${a.giftId} 단계 ${a.level} 능력 ${a.ordinal}`;

		if (!input.giftIds.has(a.giftId)) {
			// 저작이 실물을 앞지른 것이 곧 오류는 아니다 — 새 기프트가 나오기
			// 전에 사실을 적어 둘 수 있어야 한다. 다만 FK 가 있어 굽지는 못한다.
			meta.gap('gift', a.giftId, 'gift_ability',
				`${at} 이 실재하지 않는 기프트를 가리킨다 — 굽지 않고 남긴다`, EVIDENCE);
			continue;
		}

		const key = `${a.giftId}\t${a.level}`;
		let refines = p.refines;
		if (refines !== null) {
			const exists = ordinalsOf.get(key)?.has(refines) === true;
			const independent = independentOf.get(key)?.has(refines) === true;
			if (!exists) {
				meta.gap('gift', a.giftId, 'refines',
					`${at} 의 refines 가 없는 ordinal ${refines} 을 가리킨다 — 독립으로 굽는다`, EVIDENCE);
				refines = null;
			} else if (!independent) {
				// 사슬을 허용하면 「강화판의 강화판」이 생기고 켜짐 판정이
				// 몇 겹인지 알 수 없어진다. 한 겹으로 못박는다.
				meta.gap('gift', a.giftId, 'refines',
					`${at} 의 refines 가 또 다른 강화판 ${refines} 을 가리킨다(사슬 금지) — 독립으로 굽는다`, EVIDENCE);
				refines = null;
			}
		}

		if (p.timing === 'other') {
			meta.gap('gift', a.giftId, 'timing',
				`${at} 의 발동 시점이 어휘에 없다 — 'other' 로 둔다`, EVIDENCE);
		}
		if (!p.unconditional && p.conds.length === 0) {
			// 조건이 있는 줄은 아는데 못 뽑은 자리다. 능력은 살린다 — 조건이
			// 없으면 못 막으니 결과적으로 켜지는 쪽이고, 그것이 「모른다」를
			// 「아니다」로 쓰지 않는 것이다.
			meta.gap('gift', a.giftId, 'conds',
				`${at} 은 조건이 있다고 적혔는데 뽑힌 조건이 없다`, EVIDENCE);
		}

		abilities.push({
			giftId: a.giftId, level: a.level, ordinal: a.ordinal,
			timing: p.timing, unconditional: p.unconditional, refines, sourceText: p.sourceText,
		});

		for (const c of p.conds) {
			if (c.op !== 'has' && c.threshold === null) {
				// 「N인 이상」인데 N 을 못 찾았다. has 는 수가 아니라 존재를
				// 묻는 것이라 문턱값이 없는 것이 옳다 — 그건 결손이 아니다.
				meta.gap('gift', a.giftId, 'threshold',
					`${at} 조건 ${c.group}/${c.idx}(${c.refKind}/${c.refId}) 의 문턱값을 못 찾았다`, EVIDENCE);
			}
			conds.push({
				giftId: a.giftId, level: a.level, ordinal: a.ordinal,
				group: c.group, idx: c.idx,
				refKind: c.refKind, refId: c.refId, op: c.op, threshold: c.threshold,
				scope: c.scope, supply: c.supply, slot: c.slot,
				runtime: c.runtime, resonanceMode: c.resonanceMode,
			});
		}
	}

	/**
	 * 기프트마다 독립 능력이 하나는 있어야 한다.
	 *
	 * 전부 강화판이면 켜짐 판정에 참여하는 능력이 없어 영영 죽는다. 위에서
	 * 사슬을 끊었으므로 대개는 이미 남아 있지만, 전부가 서로를 가리키는
	 * 경우가 있을 수 있다 — 그때는 가장 앞 ordinal 을 독립으로 만든다.
	 */
	const byGift = new Map<string, AbilityRow[]>();
	for (const r of abilities) {
		const key = `${r.giftId}\t${r.level}`;
		byGift.set(key, [...(byGift.get(key) ?? []), r]);
	}
	for (const [key, rows] of byGift) {
		if (rows.some((r) => r.refines === null)) continue;
		const first = [...rows].sort((a, b) => a.ordinal - b.ordinal)[0];
		meta.gap('gift', first.giftId, 'refines',
			`${key.replace('\t', ' 단계 ')} 의 능력이 전부 강화판이라 켜질 수 없다 — ordinal ${first.ordinal} 을 독립으로 만든다`,
			EVIDENCE);
		first.refines = null;
	}

	return { abilities, conds };
}
```

- [ ] **Step 4: 테스트가 통과하는지 본다**

Run: `npx tsx --test src/v2/canonical/gift-ability.test.ts`
Expected: PASS 9건

- [ ] **Step 5: 커밋**

```bash
git add src/v2/canonical/gift-ability.ts src/v2/canonical/gift-ability.test.ts
git commit -m "feat(canonical): 저작 능력을 canonical 행으로 편다

설명문을 읽지 않는다 — 저작이 정본이고 여기서 하는 일은 펴기와 결손 기록뿐.

결손으로 남기는 것
  없는 기프트를 가리킴        굽지 않는다. 저작이 실물을 앞지를 수 있다
  refines 가 없는 ordinal     독립으로 굽는다
  refines 사슬                한 겹으로 못박는다
  timing='other'             어휘 밖
  unconditional=false + 조건 0  조건이 있는 줄 아는데 못 뽑았다
  op≠has 인데 threshold=null   「N인 이상」인데 N 을 못 찾았다

op='has' 의 threshold=null 은 결손이 아니다 — 「약지 소속 인격이」는 수가
아니라 존재가 조건이다."
```

---

### Task 5: 저작 파일 형식과 씨앗 열 건

**Files:**
- Create: `data/authored/gift-ability.jsonl`
- Create: `data/authored/README.md`
- Modify: `src/v2/seed-authored.ts`

**Interfaces:**
- Consumes: Task 1 의 `validatePayload`, Task 3 의 `GiftAbilityAuthoredRow`
- Produces: jsonl 한 줄 = `{ giftId, level, ordinal, payload, note }`. `seed-authored` 가 이 파일을 읽어 `app.gift_ability_authored` 에 심는다(있는 행은 안 덮는다).

- [ ] **Step 1: 저작 파일 형식을 적는다**

`data/authored/README.md` 를 만든다.

```markdown
# 저작 데이터

설명문에서 뽑아 **사람이 전건 검수한** 사실. 빌드는 이 파일을 읽고 설명문을
다시 파싱하지 않는다 — 그래야 결과가 고정되고 재현 가능하다(ADR-08).

## gift-ability.jsonl

한 줄이 능력 하나다. `(giftId, level, ordinal)` 이 열쇠다.

```json
{"giftId":"9262","level":0,"ordinal":0,"payload":{"timing":"none","unconditional":false,"refines":null,"sourceText":"약지 소속 인격 공격 종료시 …","conds":[{"group":0,"idx":0,"refKind":"association","refId":"RING_FINGER","op":"has","threshold":null,"scope":"roster","supply":"tag","slot":null,"runtime":false,"resonanceMode":null}]},"note":"두 문단 다 약지 소속을 요구한다"}
```

- `payload` 의 모양은 `src/v2/ability-payload.ts` 가 정한다.
- `note` 는 검수자가 남기는 근거다. **지문에 안 들어간다** — 설명을 고치는
  것은 결과를 안 바꾸므로 재빌드를 요구할 이유가 없다.
- 검수가 끝나기 전에도 값이 나온다. 이 파일에 없는 기프트는
  `canonical.gift_ability` 행이 없고, 엔진은 그런 기프트를 **판정 보류**로
  다룬다(2단계). 회차가 진행될수록 판정이 정밀해진다.

**456건 전건을 사람이 본다**(2026-08-11 사용자 확정). 회차 진행은
`scripts/review-gift-ability.ts` 가 돕고, 어디까지 봤는지는
`data/authored/gift-ability.progress.json` 이 기억한다.
```

- [ ] **Step 2: 씨앗 열 건을 손으로 쓴다**

`data/authored/gift-ability.jsonl` 을 만든다. **여기 열 건은 골든의 근거이므로 손으로 쓰고, 나머지 446건은 추출 도구(Task 8)가 채운다.**

`sourceText` 는 `canonical.gift_stage_text` 의 실제 문단이어야 한다. 아래 명령으로 원문을 확인하며 쓴다.

```bash
psql "$DATABASE_URL" -A -c "SELECT gift_id, \"desc\" FROM canonical.gift_stage_text WHERE locale='ko' AND level=0 AND gift_id IN ('9262','9268','9246','9271','9778','9843','9052','9043','9803','9235') ORDER BY gift_id;"
```

열 건은 이것이다 — **여섯은 게이트 PR 이 결손으로 넘긴 과대 판정**이고, 넷은 모형의 축을 각각 시험한다.

```
9262 모든 것의 뼈대        절 둘 다 약지 소속           → 죽어야 한다
9268 모든 것의 본능        절 둘 다 약지 + runtime 조건  → 죽어야 한다
9246 누군가 놓쳐버린 사원증  절 둘 다 소속 (OR 아님, 각 절이 각자 소속)
9271 흑수환 - 묘          절 둘 다 흑수-묘
9778 통상 작전용 장비      절 둘 다 림버스 컴퍼니 + waiting 분모
9843 경혈식 글레이브       혈귀 3명 문턱 (크기가 아니라 threshold 로)
9052 휴대용 전지 소켓      무조건 절이 있으면 산다
9043 사원증               group 내 OR — 「거나」
9803 거울 속의 꽃         무조건 절 + 「- N인 이상」 티어 둘 (독립 능력)
9235 데스페라도           기본 절 없이 티어만 — 최저 2인 미만이면 죽는다
```

씨앗 세 줄을 그대로 보인다. 나머지 일곱 줄도 같은 방식으로 쓴다.

```json
{"giftId":"9262","level":0,"ordinal":0,"payload":{"timing":"none","unconditional":false,"refines":null,"sourceText":"약지 소속 인격 공격 종료시 대상에게 무작위 물리 내성 약화 1 부여 (턴당 2회)","conds":[{"group":0,"idx":0,"refKind":"association","refId":"RING_FINGER","op":"has","threshold":null,"scope":"roster","supply":"tag","slot":null,"runtime":false,"resonanceMode":null}]},"note":"약지가 없으면 효과를 받을 대상 자체가 없다. 사용자 확인 2026-08-11"}
{"giftId":"9262","level":0,"ordinal":1,"payload":{"timing":"none","unconditional":false,"refines":null,"sourceText":"약지 소속 인격이 가하는 피해량 +10%","conds":[{"group":0,"idx":0,"refKind":"association","refId":"RING_FINGER","op":"has","threshold":null,"scope":"roster","supply":"tag","slot":null,"runtime":false,"resonanceMode":null}]},"note":"두 문단 다 약지를 요구한다 — 무조건 절이 없다"}
{"giftId":"9843","level":0,"ordinal":0,"payload":{"timing":"floor_start","unconditional":false,"refines":null,"sourceText":"스테이지 시작 시, 모든 아군이 주조된 경혈을 (편성된 수 - 2)만큼 얻음 (최대 3)","conds":[{"group":0,"idx":0,"refKind":"unit_keyword","refId":"BLOODFIEND","op":"gte","threshold":3,"scope":"roster","supply":"tag","slot":null,"runtime":false,"resonanceMode":null}]},"note":"(편성된 수 - 2)만큼이므로 혈귀가 3명은 있어야 1을 준다. 크기가 아니라 문턱값으로 표현한다 — 0개를 주는 것은 안 주는 것이다"}
```

- [ ] **Step 3: `seed-authored.ts` 가 파일을 읽게 한다**

파일 머리 import 에 더한다.

```typescript
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { validatePayload, type AbilityPayload } from './ability-payload.js';
```

`main()` 안, 다른 심기 뒤에 붙인다.

```typescript
	/**
	 * 기프트 능력 저작 — `data/authored/gift-ability.jsonl`.
	 *
	 * 다른 저작은 이 파일에 배열로 적혀 있지만 이것만 별도 파일이다.
	 * 456건이라 소스에 두면 읽을 수 없고, 검수 회차마다 커밋되므로
	 * diff 가 깨끗해야 한다.
	 *
	 * **형식이 틀어지면 여기서 멈춘다.** 사람이 손으로 고치는 파일이라
	 * 오타가 DB 로 들어가면 굽는 쪽에서 뒤늦게 터진다.
	 */
	const abilityPath = fileURLToPath(new URL('../../data/authored/gift-ability.jsonl', import.meta.url));
	const raw = await readFile(abilityPath, 'utf8');
	const lines = raw.split('\n').map((l) => l.trim()).filter((l) => l !== '');
	const problems: string[] = [];
	const rows: Array<{ giftId: string; level: number; ordinal: number; payload: AbilityPayload; note: string }> = [];
	for (const [i, line] of lines.entries()) {
		let parsed: { giftId: string; level: number; ordinal: number; payload: AbilityPayload; note: string };
		try {
			parsed = JSON.parse(line);
		} catch (e) {
			problems.push(`${i + 1}줄: JSON 이 아니다 — ${(e as Error).message}`);
			continue;
		}
		for (const p of validatePayload(parsed.payload)) {
			problems.push(`${i + 1}줄 (${parsed.giftId}/${parsed.level}/${parsed.ordinal}): ${p}`);
		}
		rows.push(parsed);
	}
	if (problems.length > 0) {
		throw new Error(
			`data/authored/gift-ability.jsonl 의 형식이 틀렸다. 심지 않는다:\n  ${problems.join('\n  ')}`,
		);
	}
	const abilityRes = await prisma.giftAbilityAuthored.createMany({ data: rows, skipDuplicates: true });
	console.log(`gift_ability_authored ${abilityRes.count}행 심음 (파일 ${rows.length}행)`);
```

- [ ] **Step 4: 형식 검사가 실제로 막는지 확인한다**

일부러 한 줄을 깨고 돌린다.

```bash
cp data/authored/gift-ability.jsonl /tmp/ability-backup.jsonl
printf '{"giftId":"9262","level":0,"ordinal":9,"payload":{"timing":"뭐시기","unconditional":true,"refines":null,"sourceText":"x","conds":[]},"note":"일부러 깬 줄"}\n' >> data/authored/gift-ability.jsonl
npm run v2:seed:authored
```

Expected: 「timing 이 어휘에 없다: 뭐시기」를 담은 오류로 멈춘다. **한 행도 안 심긴다.**

되돌린다.

```bash
cp /tmp/ability-backup.jsonl data/authored/gift-ability.jsonl
npm run v2:seed:authored
```

Expected: 열 건에 해당하는 행 수가 심긴다.

- [ ] **Step 5: 커밋**

```bash
git add data/authored/gift-ability.jsonl data/authored/README.md src/v2/seed-authored.ts
git commit -m "feat(authored): 기프트 능력 저작 파일과 씨앗 열 건

456건이라 소스에 배열로 두면 읽을 수 없어 별도 jsonl 로 둔다. 검수 회차마다
커밋되므로 한 줄이 능력 하나여야 diff 가 깨끗하다.

씨앗 열 건은 손으로 썼다 — 여섯은 게이트 PR 이 결손으로 넘긴 과대 판정
(9262 · 9268 · 9246 · 9271 · 9778 · 9843)이고 넷은 모형의 축을 각각
시험한다(9052 무조건 절 · 9043 group 내 OR · 9803 티어 · 9235 기본 절 없음).

심을 때 validatePayload 로 막는다. 사람이 손으로 고치는 파일이라 오타가
DB 로 들어가면 굽는 쪽에서 뒤늦게 터진다. 한 줄이라도 틀리면 한 행도
안 심는다."
```

---

### Task 6: 적재에 붙인다

**Files:**
- Modify: `src/v2/load-canonical.ts`

**Interfaces:**
- Consumes: Task 3 의 `KnownIds` 새 칸 넷, Task 4 의 `buildGiftAbility`
- Produces: `canonical.gift_ability` · `canonical.gift_ability_cond` 행

- [ ] **Step 1: import 를 더한다**

```typescript
import { buildGiftAbility } from './canonical/gift-ability.js';
```

- [ ] **Step 2: `KnownIds` 를 채운다**

`unknownRefs` 를 부르는 자리에서 `known` 을 만들 때 넷을 더한다. 값은 **저작이 쓸 수 있는 어휘**이고 코드가 정하는 닫힌 집합이다 — 게임이 정한 사실이 아니라 우리가 읽는 방법이므로 코드에 둔다(ADR-08).

```typescript
	/**
	 * 저작이 쓸 수 있는 참조 어휘.
	 *
	 * axis · unit_keyword · association 은 canonical 에 실물이 있어 거기서
	 * 읽는다. 나머지 넷은 **코드가 정하는 닫힌 집합**이다 — 게임이 정한
	 * 사실이 아니라 우리가 조건을 읽는 방법이라 코드에 둔다(ADR-08).
	 *
	 * sin 과 resonance 는 같은 일곱 죄악을 가리키지만 묻는 것이 다르다 —
	 * sin 은 「그 속성 스킬이 있는가」, resonance 는 「공명이 서는가」다.
	 */
	const SINS = ['wrath', 'lust', 'sloth', 'gluttony', 'gloom', 'pride', 'envy'];
	const known: KnownIds = {
		axisIds: new Set(axisRows.map((a) => a.id)),
		unitKeywordIds: new Set(unitKeywordRows.map((u) => u.keyword)),
		associationIds: new Set(associationRows.map((a) => a.id)),
		sinIds: new Set(SINS),
		attackTypes: new Set(['slash', 'pierce', 'blunt']),
		skillKinds: new Set(['counter', 'evade', 'guard']),
		resonanceIds: new Set(SINS),
	};
```

기존 `known` 을 만드는 자리의 변수 이름(`axisRows` 등)은 그 파일이 이미 쓰는 것을 따른다 — 새로 질의하지 말고 이미 읽은 것을 쓴다.

- [ ] **Step 3: 굽고 넣는다**

`buildAxisGrant` 를 부르고 넣는 자리 **바로 뒤**에 붙인다.

```typescript
	const giftAbility = buildGiftAbility(
		{ authored: authored.giftAbility, giftIds: new Set(gifts.map((g) => g.id)) },
		meta,
	);
	const abilityCount = await chunked(giftAbility.abilities, (part) =>
		prisma.giftAbility.createMany({ data: part }));
	const abilityCondCount = await chunked(giftAbility.conds, (part) =>
		prisma.giftAbilityCond.createMany({ data: part }));
	console.log(`gift_ability ${abilityCount} · gift_ability_cond ${abilityCondCount}`);
```

`gifts` 변수 이름은 그 파일이 기프트 행을 담는 이름을 따른다.

- [ ] **Step 4: 타입 검사와 전체 테스트**

Run: `npx tsc --noEmit && npm test`
Expected: 오류 0. Task 3 에서 남겨둔 `KnownIds` 타입 오류가 여기서 사라진다.

- [ ] **Step 5: 실제로 구워 본다**

```bash
npm run v2:seed:authored
npm run v2:build
```

Expected: `gift_ability` 행이 씨앗 열 건의 능력 수만큼, `gift_ability_cond` 가 그 조건 수만큼 나온다. `v2:build` 는 검사를 통과하고 새 판을 `wip` 으로 남긴다.

```bash
psql "$DATABASE_URL" -A -c "SELECT count(*) FROM wip.gift_ability;"
psql "$DATABASE_URL" -A -c "SELECT count(*) FROM wip.gift_ability_cond;"
```

- [ ] **Step 6: 커밋**

```bash
git add src/v2/load-canonical.ts
git commit -m "feat(canonical): 기프트 능력을 적재에 붙인다

저작이 쓸 수 있는 참조 어휘 넷(sin · attack_type · skill_kind · resonance)은
코드가 정하는 닫힌 집합이다 — 게임이 정한 사실이 아니라 우리가 조건을 읽는
방법이라 코드에 둔다(ADR-08).

sin 과 resonance 는 같은 일곱 죄악을 가리키지만 묻는 것이 다르다 —
sin 은 「그 속성 스킬이 있는가」, resonance 는 「공명이 서는가」다."
```

---

### Task 7: 검증

**Files:**
- Modify: `src/v2/verify-canonical.ts`

**Interfaces:**
- Consumes: Task 6 이 넣은 `canonical.gift_ability` · `gift_ability_cond`
- Produces: 검사 항목 (기존 239건에 더한다)

- [ ] **Step 1: 적재 검사를 더한다**

`checks.push(...)` 가 이어지는 자리, 기프트 관련 검사 근처에 붙인다.

```typescript
		// ── 기프트 능력 ────────────────────────────────────────────
		const abilityN = await prisma.giftAbility.count();
		const condN = await prisma.giftAbilityCond.count();
		checks.push({ name: '기프트 능력 행이 있다', ok: abilityN > 0, detail: `${abilityN}행` });

		// unconditional 이면 조건이 없어야 한다 — 둘 다 있으면 모형이 모순이다
		const uncondWithConds = await prisma.giftAbility.count({
			where: { unconditional: true, conds: { some: {} } },
		});
		checks.push({
			name: 'unconditional 인데 조건이 있는 능력 (0이어야 한다)',
			ok: uncondWithConds === 0, detail: `${uncondWithConds} / 0`,
		});

		// refines 는 같은 (gift,level) 안의 실재하는 ordinal 을 가리켜야 한다.
		// 굽는 쪽이 끊지만 손으로 DB 를 고칠 수 있으므로 여기서도 본다
		const danglingRefines = await prisma.$queryRaw<Array<{ n: bigint }>>`
			SELECT count(*) AS n FROM canonical.gift_ability a
			WHERE a.refines IS NOT NULL AND NOT EXISTS (
				SELECT 1 FROM canonical.gift_ability b
				WHERE b.gift_id = a.gift_id AND b.level = a.level AND b.ordinal = a.refines
			)`;
		checks.push({
			name: 'refines 가 없는 ordinal 을 가리킨다 (0이어야 한다)',
			ok: Number(danglingRefines[0]?.n ?? 0n) === 0,
			detail: `${Number(danglingRefines[0]?.n ?? 0n)} / 0`,
		});

		// 사슬 금지 — 강화판을 또 강화하지 않는다
		const refineChain = await prisma.$queryRaw<Array<{ n: bigint }>>`
			SELECT count(*) AS n FROM canonical.gift_ability a
			JOIN canonical.gift_ability b
			  ON b.gift_id = a.gift_id AND b.level = a.level AND b.ordinal = a.refines
			WHERE a.refines IS NOT NULL AND b.refines IS NOT NULL`;
		checks.push({
			name: 'refines 사슬 (0이어야 한다)',
			ok: Number(refineChain[0]?.n ?? 0n) === 0,
			detail: `${Number(refineChain[0]?.n ?? 0n)} / 0`,
		});

		// 기프트마다 독립 능력이 하나는 있어야 한다 — 전부 강화판이면 영영 죽는다
		const allRefined = await prisma.$queryRaw<Array<{ n: bigint }>>`
			SELECT count(*) AS n FROM (
				SELECT gift_id, level FROM canonical.gift_ability
				GROUP BY 1, 2 HAVING count(*) FILTER (WHERE refines IS NULL) = 0
			) x`;
		checks.push({
			name: '독립 능력이 없는 (기프트,단계) (0이어야 한다)',
			ok: Number(allRefined[0]?.n ?? 0n) === 0,
			detail: `${Number(allRefined[0]?.n ?? 0n)} / 0`,
		});

		// scope='slot' 이면 slot 이 1~7 — 출격이 7인이라 7번 자리가 있다
		const badSlot = await prisma.$queryRaw<Array<{ n: bigint }>>`
			SELECT count(*) AS n FROM canonical.gift_ability_cond
			WHERE (scope = 'slot' AND (slot IS NULL OR slot < 1 OR slot > 7))
			   OR (scope <> 'slot' AND slot IS NOT NULL)`;
		checks.push({
			name: "scope='slot' 과 slot 이 어긋난다 (0이어야 한다)",
			ok: Number(badSlot[0]?.n ?? 0n) === 0,
			detail: `${Number(badSlot[0]?.n ?? 0n)} / 0`,
		});

		// scope 어휘 — waiting 이 있어야 「대기 인원에 …」(9778)이 판정된다
		const badScope = await prisma.$queryRaw<Array<{ n: bigint }>>`
			SELECT count(*) AS n FROM canonical.gift_ability_cond
			WHERE scope NOT IN ('field','roster','waiting','slot','enemy','none')`;
		checks.push({
			name: 'scope 어휘 밖 (0이어야 한다)',
			ok: Number(badScope[0]?.n ?? 0n) === 0,
			detail: `${Number(badScope[0]?.n ?? 0n)} / 0`,
		});

		// supply='skill' 은 축으로만 셀 수 있다 — coin_token 은 축만 안다
		const badSupply = await prisma.$queryRaw<Array<{ n: bigint }>>`
			SELECT count(*) AS n FROM canonical.gift_ability_cond
			WHERE supply NOT IN ('skill','tag','any')
			   OR (supply = 'skill' AND ref_kind <> 'axis')`;
		checks.push({
			name: 'supply 어휘 밖이거나 skill 인데 축이 아니다 (0이어야 한다)',
			ok: Number(badSupply[0]?.n ?? 0n) === 0,
			detail: `${Number(badSupply[0]?.n ?? 0n)} / 0`,
		});

		// resonance_mode 는 resonance 조건에만
		const badResonance = await prisma.$queryRaw<Array<{ n: bigint }>>`
			SELECT count(*) AS n FROM canonical.gift_ability_cond
			WHERE resonance_mode IS NOT NULL AND ref_kind <> 'resonance'`;
		checks.push({
			name: 'resonance 가 아닌데 resonance_mode 가 있다 (0이어야 한다)',
			ok: Number(badResonance[0]?.n ?? 0n) === 0,
			detail: `${Number(badResonance[0]?.n ?? 0n)} / 0`,
		});
```

- [ ] **Step 2: 결손 검사를 더한다**

같은 자리에 이어 붙인다.

```typescript
		// threshold 를 못 정한 자리마다 결손이 있어야 한다. op='has' 는
		// 수가 아니라 존재를 묻는 것이라 문턱값이 없는 것이 옳다 — 뺀다
		const nullThreshold = await prisma.$queryRaw<Array<{ n: bigint }>>`
			SELECT count(*) AS n FROM canonical.gift_ability_cond
			WHERE threshold IS NULL AND op <> 'has'`;
		const thresholdGaps = await prisma.fieldGap.count({
			where: { entity: 'gift', field: 'threshold' },
		});
		checks.push({
			name: '문턱값 결손이 조건 수만큼 기록됐다',
			ok: thresholdGaps > 0 || Number(nullThreshold[0]?.n ?? 0n) === 0,
			detail: `조건 ${Number(nullThreshold[0]?.n ?? 0n)} · 결손 ${thresholdGaps}`,
		});

		// unconditional=false 인데 조건이 없는 능력마다 결손이 있어야 한다
		const emptyConds = await prisma.giftAbility.count({
			where: { unconditional: false, conds: { none: {} } },
		});
		const condGaps = await prisma.fieldGap.count({ where: { entity: 'gift', field: 'conds' } });
		checks.push({
			name: '조건이 있다고 적혔는데 없는 능력이 결손에 기록됐다',
			ok: condGaps > 0 || emptyConds === 0,
			detail: `능력 ${emptyConds} · 결손 ${condGaps}`,
		});
```

- [ ] **Step 3: 검사를 돌린다**

Run: `npm run v2:verify:canonical`
Expected: 239건 + 새 11건 = 250건 전부 통과.

- [ ] **Step 4: 검사가 실제로 잡는지 확인한다**

일부러 어긋난 행을 넣고 잡히는지 본다. **검사가 자기 존재 이유인 결함을 못 잡은 전례가 있으므로 반드시 확인한다.**

```bash
psql "$DATABASE_URL" -c "UPDATE canonical.gift_ability_cond SET scope='해괴한값' WHERE gift_id='9262' AND ordinal=0;"
npm run v2:verify:canonical
```

Expected: 「scope 어휘 밖」이 `1 / 0` 으로 실패한다.

되돌린다.

```bash
psql "$DATABASE_URL" -c "UPDATE canonical.gift_ability_cond SET scope='roster' WHERE gift_id='9262' AND ordinal=0;"
npm run v2:verify:canonical
```

Expected: 250건 전부 통과.

- [ ] **Step 5: 커밋**

```bash
git add src/v2/verify-canonical.ts
git commit -m "test(verify): 기프트 능력 적재·결손 검사 11건

적재
  unconditional 인데 조건이 있다 · refines 가 없는 ordinal 을 가리킨다 ·
  refines 사슬 · 독립 능력이 없는 (기프트,단계) · scope/slot 어긋남 ·
  scope 어휘 · supply 어휘와 skill=축 · resonance_mode 자리

결손
  문턱값을 못 정한 조건과 결손 기록이 짝을 이룬다.
  op='has' 는 수가 아니라 존재를 묻는 것이라 뺀다.
  조건이 있다고 적혔는데 없는 능력도 짝을 이룬다.

일부러 어긋난 행을 넣어 검사가 실제로 잡는지 확인했다."
```

---

### Task 8: 추출 · 비교 · 검수 페이지

**Files:**
- Create: `scripts/extract-gift-ability.ts`
- Create: `scripts/diff-gift-ability.ts`
- Create: `scripts/build-review-page.ts`
- Create: `scripts/import-verdicts.ts`
- Modify: `package.json` (스크립트 넷)

**Interfaces:**
- Consumes: Task 1 의 `validatePayload`, `canonical.gift_stage_text`, Task 5 의 저작 jsonl
- Produces: `data/authored/gift-ability.pass1.jsonl` · `.pass2.jsonl` · `.progress.json`, 그리고 검수 페이지 HTML

**검수는 페이지로 한다(2026-08-11 사용자 확정).** 터미널이 아니라 웹 페이지가 창구다 — 사용자가 절 단위로 직접 보고 「맞다 / 틀리다」를 누르면, 페이지가 판정을 모아 파일로 내보내고, 에이전트가 그 파일을 받아 반영한다.

```
scripts/build-review-page.ts   DB + 저작 jsonl  →  자기완결 HTML
      ↓  (Artifact 로 게시)
사용자가 절 단위로 훑으며 맞다/틀리다.  판정은 localStorage 에 남는다
      ↓  「내보내기」 → window.claude.downloads.save()
verdicts-<날짜>.json
      ↓  npm run gift:import <파일>
data/authored/gift-ability.progress.json
```

localStorage 에 남기므로 **여러 날에 나눠 봐도 이어진다.** 내보내기는 사용자가 누를 때만 일어난다.

- [ ] **Step 1: 추출 도구를 쓴다**

`scripts/extract-gift-ability.ts`.

**LLM 호출은 이 저장소가 쥐고 있는 열쇠가 없으므로 프롬프트 파일을 내는 데까지 한다.** 사람이 그 파일을 LLM 에 넣고 결과를 받아 `--pass N` 파일로 저장한다. 이렇게 두면 빌드가 LLM 을 안 부르므로 결정성이 지켜지고(ADR-08), 어떤 모델을 썼는지도 사람이 고른다.

```typescript
/**
 * 설명문을 절로 나누는 프롬프트를 낸다. **LLM 을 부르지 않는다.**
 *
 * 빌드가 LLM 을 부르면 같은 입력에 다른 결과가 나올 수 있어 v2:verify:rebuild
 * 가 성립하지 않는다(ADR-08). 그래서 이 도구는 프롬프트 파일까지만 만들고,
 * 사람이 그것을 모델에 넣어 받은 결과를 --pass N 파일로 저장한다.
 *
 * 실행:
 *   npx tsx scripts/extract-gift-ability.ts --from 0 --count 50 --out /tmp/batch-0.md
 */
import { writeFileSync } from 'node:fs';
import { PrismaClient } from '../src/v2/generated/client.js';
import { SCOPES, SUPPLIES, OPS, TIMINGS, MAX_SLOT } from '../src/v2/ability-payload.js';

const argv = process.argv.slice(2);
const arg = (name: string, fallback: string): string => {
	const i = argv.indexOf(`--${name}`);
	return i >= 0 && argv[i + 1] !== undefined ? argv[i + 1] : fallback;
};
const from = Number(arg('from', '0'));
const count = Number(arg('count', '50'));
const out = arg('out', '/tmp/gift-ability-batch.md');

const prisma = new PrismaClient();
const rows = await prisma.$queryRaw<Array<{ giftId: string; level: number; name: string; desc: string }>>`
	SELECT t.gift_id AS "giftId", t.level, t.name, t."desc"
	FROM canonical.gift_stage_text t JOIN canonical.gift g ON g.id = t.gift_id
	WHERE t.locale = 'ko' AND g.domain = 'mirror_dungeon'
	ORDER BY t.gift_id, t.level
	OFFSET ${from} LIMIT ${count}
`;

const lines: string[] = [
	'# 기프트 설명문을 절(節)로 나눠라',
	'',
	'각 기프트의 설명문을 **문단 단위 능력**으로 나누고, 능력마다 발동 조건을 적어라.',
	'jsonl 로 낸다 — 한 줄이 능력 하나다. 설명 문장을 덧붙이지 마라.',
	'',
	'## 절은 네 종류다',
	'',
	'```',
	'기본 효과   조건 없이 돈다                unconditional=true · conds 없음',
	'조건 효과   기본이지만 공급 조건이 붙는다    unconditional=false · conds 있음',
	'추가 효과   「- N인 이상」 티어            독립 능력이다. refines 를 쓰지 마라',
	'배수 효과   크기가 (편성 수 × k)          문턱값으로 적어라. 크기는 안 담는다',
	'```',
	'',
	'**「- N인 이상」 티어를 refines 로 적지 마라.** 티어는 원 능력과 독립으로 켜지고 꺼진다.',
	'`refines` 는 「효과가 강화되어」처럼 앞 절의 결과를 전제하는 것에만 쓴다.',
	'',
	'**「효과가 변경되어」는 담지 마라.** 조건이 같고 주는 효과만 갈리는 것이라 발동 판정과 무관하다.',
	'',
	'## 조건이 아닌 것',
	'',
	'```',
	'우선순위 주석  「(… 인격을 우선으로 지정)」   누구에게 먼저 줄지일 뿐이다',
	'적용 범위     「… 인격에게 효과 적용」        누구에게 적용되는지이지 켜지는 조건이 아니다',
	'횟수 제한     「(턴 당 1회 발동)」 · 「(최대 3)」',
	'효과 수량     「호흡 위력 3」',
	'```',
	'',
	'## 칸',
	'',
	'```',
	`timing    ${TIMINGS.join(' · ')}`,
	'          어휘 밖이면 other 로 두고 note 에 원문을 적어라',
	`op        ${OPS.join(' · ')}   has 는 수가 아니라 존재를 묻는다`,
	'threshold 문장에 없으면 null. **1 로 가정하지 마라**',
	`scope     ${SCOPES.join(' · ')}`,
	'          field=출격 7인 · roster=편성 12인 · waiting=대기 5인',
	'          설명문이 직접 말한다 — 「출격 인원을 기준」 · 「편성 인원을 기준」 ·',
	'          「대기 인원 포함」(roster) · 「대기 인원 제외」(field) · 「대기 인원에」(waiting)',
	`supply    ${SUPPLIES.join(' · ')}`,
	'          skill 은 「스킬 효과로 …할 때」처럼 스킬이 실제로 주는지 묻는 것.',
	'          refKind 가 axis 일 때만 쓸 수 있다',
	`slot      scope=slot 일 때 1~${MAX_SLOT}. 출격이 7인이라 7번 자리가 있다`,
	'runtime   전투 중에만 아는가. 적 상태·정신력·공명 발동 여부 등',
	'refKind   axis · sin · resonance · attack_type · skill_kind · coin ·',
	'          deployment · association · unit_keyword · enemy_state · other',
	'          어휘에 못 담으면 other 로 두고 refId 에 원문 조각을 그대로 넣어라',
	'resonanceMode  activate(일반 공명) · absolute(완전 공명). resonance 에만',
	'```',
	'',
	'## group 이 AND/OR 를 가른다',
	'',
	'**같은 group 안은 OR, group 끼리는 AND.**',
	'「분노 완전 공명을 발동하였**거나** 충전 스킬을 사용할 경우」는 group 0 에 조건 2개다.',
	'',
	'## 낼 모양',
	'',
	'```json',
	'{"giftId":"9262","level":0,"ordinal":0,"payload":{"timing":"none","unconditional":false,"refines":null,"sourceText":"약지 소속 인격 공격 종료시 …","conds":[{"group":0,"idx":0,"refKind":"association","refId":"RING_FINGER","op":"has","threshold":null,"scope":"roster","supply":"tag","slot":null,"runtime":false,"resonanceMode":null}]},"note":"두 문단 다 약지를 요구한다"}',
	'```',
	'',
	'`sourceText` 는 그 능력에 해당하는 **설명문 원문 그대로**여야 한다. 요약하지 마라.',
	'',
	'---',
	'',
	`## 대상 ${rows.length}건 (offset ${from})`,
	'',
];
for (const r of rows) {
	lines.push(`### ${r.name} — giftId ${r.giftId} · level ${r.level}`, '', '```', r.desc, '```', '');
}
writeFileSync(out, lines.join('\n'), 'utf8');
console.log(`${rows.length}건 → ${out}`);
console.log('이 파일을 모델에 넣고 받은 jsonl 을 data/authored/gift-ability.pass1.jsonl 등에 이어붙여라.');

await prisma.$disconnect();
process.exit(0);
```

- [ ] **Step 2: 두 판 비교 도구를 쓴다**

`scripts/diff-gift-ability.ts`.

```typescript
/**
 * 두 판을 견줘 검수 우선순위를 낸다.
 *
 * 같은 설명문을 독립적으로 두 번 뽑으면 판단이 갈린 자리가 드러난다.
 * **전건을 다 보되(2026-08-11 사용자 확정) 어긋난 것부터 본다** — 회차의
 * 앞쪽에 어려운 것을 두면 뒤로 갈수록 빨라진다.
 *
 * 실행: npx tsx scripts/diff-gift-ability.ts
 */
import { readFileSync, writeFileSync } from 'node:fs';

const read = (path: string): Map<string, string> => {
	const m = new Map<string, string>();
	for (const line of readFileSync(path, 'utf8').split('\n')) {
		const t = line.trim();
		if (t === '') continue;
		const o = JSON.parse(t);
		// note 는 견주지 않는다 — 설명이 달라도 판정이 같으면 같은 것이다
		const { note: _note, ...rest } = o;
		m.set(`${o.giftId}\t${o.level}\t${o.ordinal}`, JSON.stringify(rest));
	}
	return m;
};

const p1 = read('data/authored/gift-ability.pass1.jsonl');
const p2 = read('data/authored/gift-ability.pass2.jsonl');

const keys = [...new Set([...p1.keys(), ...p2.keys()])].sort();
const only1: string[] = [];
const only2: string[] = [];
const differ: string[] = [];
for (const k of keys) {
	const a = p1.get(k);
	const b = p2.get(k);
	if (a === undefined) only2.push(k);
	else if (b === undefined) only1.push(k);
	else if (a !== b) differ.push(k);
}

/** 기프트 단위로 모은다 — 검수는 기프트 하나가 한 화면이다 */
const giftOf = (k: string): string => k.split('\t')[0];
const suspect = [...new Set([...only1, ...only2, ...differ].map(giftOf))].sort();

console.log(`능력 열쇠  1판 ${p1.size} · 2판 ${p2.size}`);
console.log(`  1판에만 ${only1.length} · 2판에만 ${only2.length} · 내용이 다름 ${differ.length}`);
console.log(`어긋난 기프트 ${suspect.length}`);

writeFileSync('data/authored/gift-ability.priority.json', JSON.stringify(suspect, null, '\t'), 'utf8');
console.log('→ data/authored/gift-ability.priority.json (검수 우선순위)');
```

- [ ] **Step 3: 검수 페이지 생성기를 쓴다**

검수는 사용자 확정 절차를 따른다(사양 §5 「검수 절차」).

```
1차   사용자가 페이지에서 절 단위로 보고 「맞다 / 틀리다」만 누른다.
      이유를 안 적는다 — 456번 적게 하면 회차가 끝나지 않는다
2차   「틀리다」만 모아 에이전트가 읽고, 사용자가 무엇이 틀렸는지 서술한다
3차   에이전트가 고치면 그 건은 미판정으로 돌아가 1차를 다시 받는다
```

`scripts/build-review-page.ts` 는 DB 와 저작 파일을 읽어 **자기완결 HTML** 을 만든다. 외부 요청이 CSP 로 막히므로 데이터를 페이지 안에 넣는다.

```typescript
/**
 * 검수 페이지를 만든다. 절 단위로 보고 「맞다 / 틀리다」를 누르는 창구다.
 *
 * **자기완결이어야 한다** — Artifact 는 외부 요청이 CSP 로 막히므로 기프트
 * 데이터를 페이지 안에 통째로 넣는다. 456건이라 크지만 텍스트뿐이라 감당된다.
 *
 * 판정은 localStorage 에 남는다 — 여러 날에 나눠 봐도 이어진다. 내보내기는
 * 사용자가 누를 때만 일어나고(window.claude.downloads), 그 파일을
 * `npm run gift:import` 가 받아 progress.json 에 반영한다.
 *
 * 실행: npm run gift:page -- --out /tmp/gift-review.html
 */
import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import { PrismaClient } from '../src/v2/generated/client.js';
import { validatePayload, type AbilityPayload } from '../src/v2/ability-payload.js';

const AUTHORED = 'data/authored/gift-ability.jsonl';
const PROGRESS = 'data/authored/gift-ability.progress.json';
const PRIORITY = 'data/authored/gift-ability.priority.json';

const argv = process.argv.slice(2);
const out = argv.indexOf('--out') >= 0 ? argv[argv.indexOf('--out') + 1] : '/tmp/gift-review.html';

const prisma = new PrismaClient();
const texts = await prisma.$queryRaw<Array<{ giftId: string; level: number; name: string; desc: string }>>`
	SELECT t.gift_id AS "giftId", t.level, t.name, t."desc"
	FROM canonical.gift_stage_text t JOIN canonical.gift g ON g.id = t.gift_id
	WHERE t.locale = 'ko' AND g.domain = 'mirror_dungeon'
	ORDER BY t.gift_id, t.level
`;

interface Authored { giftId: string; level: number; ordinal: number; payload: AbilityPayload; note: string; }
const authored: Authored[] = existsSync(AUTHORED)
	? readFileSync(AUTHORED, 'utf8').split('\n').map((l) => l.trim()).filter((l) => l !== '').map((l) => JSON.parse(l))
	: [];

const progress: { round: number; verdicts: Record<string, { state: string; why?: string }> } =
	existsSync(PROGRESS) ? JSON.parse(readFileSync(PROGRESS, 'utf8')) : { round: 1, verdicts: {} };
const priority: string[] = existsSync(PRIORITY) ? JSON.parse(readFileSync(PRIORITY, 'utf8')) : [];

/** 페이지에 넣을 자료. 기프트 하나가 카드 하나다 */
const gifts = [...new Set(texts.map((t) => t.giftId))].map((id) => ({
	id,
	name: texts.find((t) => t.giftId === id)?.name ?? '',
	stages: texts.filter((t) => t.giftId === id).map((t) => ({ level: t.level, desc: t.desc })),
	abilities: authored.filter((a) => a.giftId === id).map((a) => ({
		level: a.level, ordinal: a.ordinal, note: a.note,
		timing: a.payload.timing, unconditional: a.payload.unconditional,
		refines: a.payload.refines, sourceText: a.payload.sourceText,
		conds: a.payload.conds,
		problems: validatePayload(a.payload),
	})),
	priority: priority.includes(id),
	seeded: progress.verdicts[id]?.state ?? null,
	why: progress.verdicts[id]?.why ?? null,
}));
// 어긋난 것을 앞에 둔다 — 어려운 것을 먼저 보면 뒤로 갈수록 빨라진다
gifts.sort((a, b) => Number(b.priority) - Number(a.priority) || a.id.localeCompare(b.id));

const DATA = JSON.stringify({ round: progress.round, gifts })
	.replaceAll('<', '\\u003c')   // </script> 로 페이지가 끊기는 것을 막는다
	.replaceAll('\u2028', '\\u2028').replaceAll('\u2029', '\\u2029');

writeFileSync(out, renderPage(DATA), 'utf8');
console.log(`기프트 ${gifts.length} · 능력 ${authored.length}  →  ${out}`);
console.log('Artifact 로 게시해 사용자에게 준다.');

await prisma.$disconnect();
process.exit(0);
```

`renderPage(data: string): string` 은 같은 파일 아래쪽에 둔다. **HTML 을 문자열로 짜되 데이터는 `JSON.parse` 로 읽는다** — 문자열 안에 기프트 설명문을 직접 끼워 넣으면 따옴표 하나에 페이지가 깨진다.

```typescript
function renderPage(data: string): string {
	return `<title>기프트 절 검수</title>
<style>
  :root {
    --panel:#fff; --panel-2:#f6f6f4; --line:#dddcd6; --ink:#0e1116;
    --text:#1a1e25; --dim:#666e7a; --faint:#9aa1ab;
    --ok:#2f7f6f; --bad:#b4423a; --warn:#b07d22; --struct:#4f5f92;
    --ok-bg:#e7f3f0; --bad-bg:#fbeceb; --warn-bg:#fbf3e3;
    --mono:ui-monospace,SFMono-Regular,Menlo,monospace;
    --sans:system-ui,-apple-system,"Apple SD Gothic Neo",sans-serif;
  }
  @media (prefers-color-scheme:dark){:root{
    --panel:#14181e; --panel-2:#0f1318; --line:#29303a; --ink:#f2f1ee;
    --text:#e6e7ea; --dim:#939aa5; --faint:#6b737e;
    --ok:#5fb8a5; --bad:#e0736a; --warn:#d9a545; --struct:#8e9dd0;
    --ok-bg:#16261f; --bad-bg:#2b1a19; --warn-bg:#2a2216;}}
  :root[data-theme="dark"]{
    --panel:#14181e; --panel-2:#0f1318; --line:#29303a; --ink:#f2f1ee;
    --text:#e6e7ea; --dim:#939aa5; --faint:#6b737e;
    --ok:#5fb8a5; --bad:#e0736a; --warn:#d9a545; --struct:#8e9dd0;
    --ok-bg:#16261f; --bad-bg:#2b1a19; --warn-bg:#2a2216;}
  :root[data-theme="light"]{
    --panel:#fff; --panel-2:#f6f6f4; --line:#dddcd6; --ink:#0e1116;
    --text:#1a1e25; --dim:#666e7a; --faint:#9aa1ab;
    --ok:#2f7f6f; --bad:#b4423a; --warn:#b07d22;
    --ok-bg:#e7f3f0; --bad-bg:#fbeceb; --warn-bg:#fbf3e3;}
  body{background:var(--panel-2);color:var(--text);font-family:var(--sans);
    line-height:1.6;margin:0;padding:0 16px 120px;-webkit-font-smoothing:antialiased}
  .wrap{max-width:960px;margin:0 auto}
  code{font-family:var(--mono);font-variant-numeric:tabular-nums}
  h1{font-size:26px;margin:0;letter-spacing:-.02em}

  /* 머리 — 진행률과 거르개가 스크롤을 따라온다 */
  header{position:sticky;top:0;z-index:10;background:var(--panel-2);
    border-bottom:2px solid var(--ink);padding:18px 0 12px;margin-bottom:20px}
  .bar{height:6px;background:var(--line);margin:12px 0 10px;display:flex;overflow:hidden}
  .bar i{display:block;height:100%}
  .bar .b-ok{background:var(--ok)} .bar .b-bad{background:var(--bad)}
  .tally{display:flex;gap:16px;font-family:var(--mono);font-size:12.5px;
    color:var(--dim);font-variant-numeric:tabular-nums;flex-wrap:wrap;align-items:center}
  .tally b{font-weight:700}
  .tally .t-ok b{color:var(--ok)} .tally .t-bad b{color:var(--bad)}
  .filters{display:flex;gap:6px;margin-left:auto;flex-wrap:wrap}
  button{font-family:inherit;font-size:12.5px;padding:5px 11px;border:1px solid var(--line);
    background:var(--panel);color:var(--text);cursor:pointer;border-radius:2px}
  button:hover{border-color:var(--dim)}
  button[aria-pressed="true"]{background:var(--ink);color:var(--panel-2);border-color:var(--ink)}
  button:focus-visible{outline:2px solid var(--struct);outline-offset:2px}
  .export{margin-left:6px;border-color:var(--struct);color:var(--struct);font-weight:600}

  /* 기프트 카드 */
  .gift{background:var(--panel);border:1px solid var(--line);margin-bottom:14px}
  .gift.v-ok{border-left:4px solid var(--ok)}
  .gift.v-bad{border-left:4px solid var(--bad)}
  .gift > .top{padding:14px 18px 12px;border-bottom:1px solid var(--line);
    display:flex;align-items:baseline;gap:10px;flex-wrap:wrap}
  .gift h2{font-size:16.5px;font-weight:680;margin:0}
  .gift h2 em{font-family:var(--mono);font-style:normal;font-size:10.5px;
    color:var(--faint);font-weight:400;margin-left:6px}
  .flag{font-family:var(--mono);font-size:10px;letter-spacing:.1em;text-transform:uppercase;
    padding:2px 7px;border-radius:2px;background:var(--warn-bg);color:var(--warn)}
  .body{padding:14px 18px 16px;display:grid;gap:13px}
  .lbl{font-family:var(--mono);font-size:10px;letter-spacing:.12em;text-transform:uppercase;
    color:var(--faint);margin-bottom:6px}
  pre{margin:0;padding:12px 14px;background:var(--panel-2);border:1px solid var(--line);
    overflow-x:auto;font-family:var(--mono);font-size:12px;line-height:1.7;
    white-space:pre-wrap;word-break:break-word;color:var(--text)}

  /* 절 하나 */
  .ab{border:1px solid var(--line);padding:11px 14px;background:var(--panel-2)}
  .ab + .ab{margin-top:8px}
  .ab .hd{font-family:var(--mono);font-size:11.5px;color:var(--dim);
    display:flex;gap:10px;flex-wrap:wrap;margin-bottom:7px}
  .ab .hd b{color:var(--text)}
  .ab .src{font-size:13px;margin-bottom:8px}
  .cond{font-family:var(--mono);font-size:11.5px;padding:3px 0 3px 12px;
    border-left:2px solid var(--struct);color:var(--text)}
  .cond .rt{color:var(--warn)}
  .none{font-family:var(--mono);font-size:11.5px;color:var(--bad)}
  .warn{font-family:var(--mono);font-size:11.5px;color:var(--bad);margin-top:5px}
  .note{font-size:12.5px;color:var(--dim);margin-top:7px}

  /* 판정 */
  .verdict{display:flex;gap:8px;align-items:center;padding:12px 18px;
    border-top:1px solid var(--line);flex-wrap:wrap}
  .verdict .y[aria-pressed="true"]{background:var(--ok);border-color:var(--ok);color:#fff}
  .verdict .n[aria-pressed="true"]{background:var(--bad);border-color:var(--bad);color:#fff}
  .why{width:100%;margin-top:8px;font-family:inherit;font-size:13px;padding:8px 10px;
    border:1px solid var(--line);background:var(--panel-2);color:var(--text);resize:vertical}
  .why:focus-visible{outline:2px solid var(--struct);outline-offset:-1px}
  .hint{font-size:12px;color:var(--faint)}
  footer{position:fixed;left:0;right:0;bottom:0;background:var(--panel);
    border-top:1px solid var(--line);padding:10px 16px;font-family:var(--mono);
    font-size:12px;color:var(--dim);display:flex;gap:14px;justify-content:center}
</style>

<div class="wrap">
<header>
  <h1>기프트 절 검수</h1>
  <div class="bar"><i class="b-ok"></i><i class="b-bad"></i></div>
  <div class="tally">
    <span class="t-ok">맞다 <b id="n-ok">0</b></span>
    <span class="t-bad">틀리다 <b id="n-bad">0</b></span>
    <span>미판정 <b id="n-pending">0</b></span>
    <span>합계 <b id="n-all">0</b></span>
    <span class="filters">
      <button data-filter="all" aria-pressed="true">전체</button>
      <button data-filter="pending" aria-pressed="false">미판정</button>
      <button data-filter="bad" aria-pressed="false">틀리다</button>
      <button data-filter="ok" aria-pressed="false">맞다</button>
      <button id="export" class="export">내보내기</button>
    </span>
  </div>
</header>
<main id="list"></main>
</div>
<footer><span>판정은 이 브라우저에 남는다 — 나눠 봐도 이어진다</span><span>다 보면 「내보내기」를 눌러 파일을 전달한다</span></footer>

<script>
const DATA = JSON.parse(${JSON.stringify(data)});
const KEY = 'gift-ability-verdicts-v1';
const load = () => { try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { return {}; } };
let V = load();
// 파일에 이미 있던 판정을 초깃값으로 — 다른 기계에서 이어받을 수 있게
for (const g of DATA.gifts) if (g.seeded && !V[g.id]) V[g.id] = { state: g.seeded, why: g.why || '' };
const save = () => localStorage.setItem(KEY, JSON.stringify(V));

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c]));
let filter = 'all';

function condLine(c) {
  const th = c.threshold === null ? '' : ' ' + c.threshold;
  const rt = c.runtime ? ' <span class="rt">· 전투 중</span>' : '';
  const sl = c.slot === null ? '' : ' · 자리 ' + c.slot;
  const rm = c.resonanceMode ? ' · ' + c.resonanceMode : '';
  return '<div class="cond">' + esc(c.group + '/' + c.idx) + '  ' +
    esc(c.refKind + '/' + c.refId + ' ' + c.op + th) + rm +
    esc(' · ' + c.scope + ' · ' + c.supply + sl) + rt + '</div>';
}

function abilityBlock(a) {
  const head = '<div class="hd"><b>[' + a.level + '/' + a.ordinal + ']</b>' +
    '<span>시점 ' + esc(a.timing) + '</span>' +
    '<span>' + (a.unconditional ? '무조건' : '조건부') + '</span>' +
    (a.refines === null ? '' : '<span>강화판 → ' + a.refines + '</span>') + '</div>';
  const src = '<div class="src">' + esc(a.sourceText) + '</div>';
  const conds = a.conds.length > 0
    ? a.conds.map(condLine).join('')
    : (a.unconditional ? '' : '<div class="none">조건 없음 — 결손이다(조건이 있다고 적혔는데 못 뽑았다)</div>');
  const note = a.note ? '<div class="note">note · ' + esc(a.note) + '</div>' : '';
  const warn = a.problems.map((p) => '<div class="warn">⚠ ' + esc(p) + '</div>').join('');
  return '<div class="ab">' + head + src + conds + note + warn + '</div>';
}

function card(g) {
  const v = V[g.id] || {};
  const cls = v.state === 'ok' ? ' v-ok' : v.state === 'bad' ? ' v-bad' : '';
  const stages = g.stages.map((s) =>
    '<div><div class="lbl">강화 ' + s.level + '단계 설명문</div><pre>' + esc(s.desc) + '</pre></div>').join('');
  const abilities = g.abilities.length > 0
    ? g.abilities.map(abilityBlock).join('')
    : '<div class="none">뽑힌 절이 없다 — 아직 안 뽑혔거나 추출이 빠뜨렸다</div>';
  return '<article class="gift' + cls + '" id="g-' + g.id + '" data-state="' + (v.state || 'pending') + '">' +
    '<div class="top"><h2>' + esc(g.name) + '<em>' + g.id + '</em></h2>' +
    (g.priority ? '<span class="flag">두 판 어긋남</span>' : '') + '</div>' +
    '<div class="body">' + stages +
      '<div><div class="lbl">뽑힌 절</div>' + abilities + '</div>' +
    '</div>' +
    '<div class="verdict">' +
      '<button class="y" data-v="ok" data-g="' + g.id + '" aria-pressed="' + (v.state === 'ok') + '">맞다</button>' +
      '<button class="n" data-v="bad" data-g="' + g.id + '" aria-pressed="' + (v.state === 'bad') + '">틀리다</button>' +
      '<span class="hint">1차는 맞다/틀리다만. 이유는 2차에 적는다</span>' +
      (v.state === 'bad'
        ? '<textarea class="why" data-g="' + g.id + '" rows="2" placeholder="선택 — 지금 아는 게 있으면 적어도 된다">' + esc(v.why || '') + '</textarea>'
        : '') +
    '</div></article>';
}

function tally() {
  const n = { ok: 0, bad: 0, pending: 0 };
  for (const g of DATA.gifts) n[(V[g.id] || {}).state || 'pending'] += 1;
  document.getElementById('n-ok').textContent = n.ok;
  document.getElementById('n-bad').textContent = n.bad;
  document.getElementById('n-pending').textContent = n.pending;
  document.getElementById('n-all').textContent = DATA.gifts.length;
  const t = DATA.gifts.length || 1;
  document.querySelector('.b-ok').style.width = (n.ok / t * 100) + '%';
  document.querySelector('.b-bad').style.width = (n.bad / t * 100) + '%';
}

function render() {
  const shown = DATA.gifts.filter((g) => filter === 'all' || ((V[g.id] || {}).state || 'pending') === filter);
  document.getElementById('list').innerHTML = shown.map(card).join('');
  tally();
}

document.addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  if (b.dataset.filter) {
    filter = b.dataset.filter;
    for (const x of document.querySelectorAll('[data-filter]')) x.setAttribute('aria-pressed', String(x === b));
    render();
    window.scrollTo({ top: 0 });
    return;
  }
  if (b.dataset.v) {
    const g = b.dataset.g;
    const prev = (V[g] || {}).state;
    // 같은 것을 다시 누르면 미판정으로 되돌린다 — 잘못 누른 것을 물릴 수 있어야 한다
    if (prev === b.dataset.v) delete V[g];
    else V[g] = { state: b.dataset.v, why: (V[g] || {}).why || '' };
    save();
    if (filter === 'all') {
      // 카드 하나만 갈아끼운다 — 전체를 다시 그리면 스크롤이 튄다
      const el = document.getElementById('g-' + g);
      const wrapper = document.createElement('div');
      wrapper.innerHTML = card(DATA.gifts.find((x) => x.id === g));
      el.replaceWith(wrapper.firstElementChild);
      tally();
    } else render();
    return;
  }
  if (b.id === 'export') exportVerdicts();
});

document.addEventListener('input', (e) => {
  const t = e.target;
  if (!t.classList.contains('why')) return;
  const g = t.dataset.g;
  if (V[g]) { V[g].why = t.value; save(); }
});

async function exportVerdicts() {
  const payload = { round: DATA.round, exportedAt: new Date().toISOString(), verdicts: V };
  const text = JSON.stringify(payload, null, '\\t');
  if (window.claude && window.claude.downloads) {
    try {
      await window.claude.downloads.save({ filename: 'gift-verdicts.json', data: text });
      return;
    } catch (err) {
      // 사용자가 거절했거나 저장이 안 됐다. 아래 대체 경로로 간다
    }
  }
  // 대체 — 새 창에 띄워 복사할 수 있게 한다
  const w = window.open('', '_blank');
  if (w) { w.document.write('<pre>' + esc(text) + '</pre>'); w.document.close(); }
  else alert('내려받기가 막혔다. 브라우저 콘솔에서 localStorage 를 복사해라.');
}

render();
</script>`;
}
```

- [ ] **Step 3b: 판정을 되받는 도구를 쓴다**

`scripts/import-verdicts.ts`.

```typescript
/**
 * 페이지가 내보낸 판정을 progress.json 에 반영한다.
 *
 * 페이지는 브라우저에 있고 저장소는 여기 있다 — 그 사이를 파일 하나가 잇는다.
 * 사용자가 「내보내기」로 받은 파일을 이 도구가 받아 넣는다.
 *
 * 실행: npm run gift:import -- ~/Downloads/gift-verdicts.json
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const PROGRESS = 'data/authored/gift-ability.progress.json';
const src = process.argv[2];
if (src === undefined) {
	console.error('파일을 달라: npm run gift:import -- ~/Downloads/gift-verdicts.json');
	process.exit(1);
}

interface Verdict { state: 'ok' | 'bad'; round: number; why?: string; }
interface Progress { round: number; verdicts: Record<string, Verdict>; }

const incoming = JSON.parse(readFileSync(src, 'utf8')) as {
	round: number; verdicts: Record<string, { state: string; why?: string }>;
};
const progress: Progress = existsSync(PROGRESS)
	? JSON.parse(readFileSync(PROGRESS, 'utf8'))
	: { round: 1, verdicts: {} };

let added = 0;
let changed = 0;
const bad: string[] = [];
for (const [giftId, v] of Object.entries(incoming.verdicts)) {
	if (v.state !== 'ok' && v.state !== 'bad') {
		console.error(`${giftId} 의 판정이 어휘 밖이다: ${v.state}`);
		process.exit(1);
	}
	const before = progress.verdicts[giftId];
	if (before === undefined) added += 1;
	else if (before.state !== v.state) changed += 1;
	progress.verdicts[giftId] = {
		state: v.state,
		round: incoming.round ?? progress.round,
		...(v.why !== undefined && v.why !== '' ? { why: v.why } : {}),
	};
	if (v.state === 'bad') bad.push(giftId);
}

writeFileSync(PROGRESS, `${JSON.stringify(progress, null, '\t')}\n`, 'utf8');

const total = Object.keys(progress.verdicts).length;
console.log(`새로 ${added} · 바뀜 ${changed} · 누적 ${total}`);
console.log(`  맞다   ${Object.values(progress.verdicts).filter((v) => v.state === 'ok').length}`);
console.log(`  틀리다 ${bad.length}`);
if (bad.length > 0) console.log(`\n2차 대상: ${bad.join(' · ')}`);
```


- [ ] **Step 4: `package.json` 에 스크립트 넷을 더한다**

`scripts` 안에 넣는다.

```json
    "gift:extract": "tsx --env-file-if-exists=.env scripts/extract-gift-ability.ts",
    "gift:diff": "tsx --env-file-if-exists=.env scripts/diff-gift-ability.ts",
    "gift:page": "tsx --env-file-if-exists=.env scripts/build-review-page.ts",
    "gift:import": "tsx --env-file-if-exists=.env scripts/import-verdicts.ts",
```

- [ ] **Step 5: 추출 도구가 도는지 확인한다**

```bash
npm run gift:extract -- --from 0 --count 3 --out /tmp/batch-check.md
head -60 /tmp/batch-check.md
```

Expected: 프롬프트 파일에 절 네 종류·칸 어휘·group 규칙과 기프트 3건의 설명문이 담긴다.

- [ ] **Step 6: 페이지가 만들어지는지 확인한다**

```bash
npm run gift:page -- --out /tmp/gift-review.html
ls -la /tmp/gift-review.html
```

Expected: `기프트 456 · 능력 <씨앗 수>` 가 찍히고 HTML 이 나온다.

**설명문에 든 따옴표·꺾쇠가 페이지를 깨지 않는지 본다.** 자료를 `JSON.parse` 로 읽고 `<` 를 이스케이프했으므로 깨지면 안 된다.

```bash
node -e "
const s = require('fs').readFileSync('/tmp/gift-review.html','utf8');
const m = s.match(/JSON\.parse\((\"(?:[^\"\\\\]|\\\\.)*\")\)/);
if (!m) throw new Error('자료 블록을 못 찾았다');
const d = JSON.parse(JSON.parse(m[1]));
console.log('기프트', d.gifts.length, '· 첫 건', d.gifts[0].name);
"
```

Expected: 기프트 수와 첫 건 이름이 찍힌다 — 페이지 안 자료가 온전한 JSON 이라는 뜻이다.

- [ ] **Step 7: 되받기가 도는지 확인한다**

페이지가 내보낼 모양을 손으로 만들어 넣어 본다.

```bash
cat > /tmp/verdicts-test.json <<'JSON'
{"round":1,"exportedAt":"2026-08-11T00:00:00.000Z","verdicts":{
  "9262":{"state":"ok","why":""},
  "9268":{"state":"bad","why":"2문단 조건이 빠졌다"}
}}
JSON
npm run gift:import -- /tmp/verdicts-test.json
cat data/authored/gift-ability.progress.json
```

Expected: `새로 2 · 바뀜 0 · 누적 2`, `맞다 1`, `틀리다 1`, 그리고 `2차 대상: 9268`. 진행 파일에 `9268` 이 `{"state":"bad","round":1,"why":"2문단 조건이 빠졌다"}` 로 남는다.

- [ ] **Step 8: 어휘 밖 판정을 막는지 확인한다**

```bash
printf '{"round":1,"verdicts":{"9262":{"state":"글쎄"}}}' > /tmp/verdicts-bad.json
npm run gift:import -- /tmp/verdicts-bad.json
```

Expected: `9262 의 판정이 어휘 밖이다: 글쎄` 로 멈춘다. **진행 파일이 안 바뀐다.**

되돌린다.

```bash
git checkout data/authored/gift-ability.progress.json 2>/dev/null || rm -f data/authored/gift-ability.progress.json
```

- [ ] **Step 9: 커밋**

```bash
git add scripts/extract-gift-ability.ts scripts/diff-gift-ability.ts scripts/build-review-page.ts scripts/import-verdicts.ts package.json
git commit -m "feat(scripts): 기프트 능력 추출·비교·검수 페이지

추출은 프롬프트 파일까지만 만들고 LLM 을 부르지 않는다. 빌드가 LLM 을
부르면 같은 입력에 다른 결과가 나올 수 있어 v2:verify:rebuild 가 성립하지
않는다(ADR-08). 사람이 그 파일을 모델에 넣고 결과를 --pass N 으로 저장한다.

검수는 페이지가 창구다(사용자 확정 2026-08-11). 터미널이 아니라 웹 페이지에서
절 단위로 보고 「맞다 / 틀리다」를 누른다.
  1차  이진 판정만. 이유를 안 적는다 — 456번 적게 하면 회차가 끝나지 않는다
  2차  「틀리다」만 모아 에이전트가 읽고 사용자가 서술한다
  3차  에이전트가 고치면 미판정으로 돌아가 1차를 다시 받는다

페이지는 자기완결이다 — Artifact 는 외부 요청이 CSP 로 막히므로 자료를
안에 넣는다. 설명문에 따옴표·꺾쇠가 있어 JSON.parse 로 읽고 '<' 를
이스케이프한다.

판정은 localStorage 에 남아 여러 날에 나눠 봐도 이어지고, 「내보내기」가
파일을 만들면 gift:import 가 progress.json 에 반영한다. 브라우저와 저장소
사이를 파일 하나가 잇는다."
```

---

## Self-Review

**1. 사양 覆蓋**

| 사양 절 | 담은 태스크 |
|---|---|
| §3 데이터 모형 (표 셋) | Task 1 |
| §3 절은 네 종류 | Task 1(payload 주석) · Task 8(프롬프트) |
| §3 공명 `resonance_mode` | Task 1(칸) · Task 7(자리 검사) |
| §4 추출 경로 · `app.gift_ability_authored` | Task 1 · Task 5 · Task 8 |
| §4 `unknownRefs` 확장 | Task 3 |
| §5 검수 (전건 · 두 판 · 재개) | Task 8 |
| §6 기존 표는 남긴다 | Task 2 |
| §7 적재 검증 · 결손 검증 | Task 7 |
| §8 1단계 6항목 | Task 1~8 전부 |

**빠진 것 하나** — §7 의 판정 검증(골든 덱 C·D·E)은 **2단계 PR 의 몫이다.** 판정 코드를 안 바꾸는 이 PR 에서는 덱을 짜도 결과가 안 바뀐다. 씨앗 열 건이 그 골든의 **데이터 근거**를 미리 깔아 둔다.

**2. 자리 표시 검사** — 「TBD」·「적절히」·「비슷하게」 없음. 모든 코드 단계에 실제 코드가 있다.

**3. 타입 일관성**
- `AbilityPayload` · `AbilityCond` (Task 1) → Task 3 `GiftAbilityAuthoredRow.payload` → Task 4 `buildGiftAbility` 입력. 같은 이름.
- `validatePayload` 는 Task 1 에서 정의하고 Task 3 · 5 · 8 에서 부른다.
- `KnownIds` 는 Task 3 에서 넓히고 Task 6 에서 채운다 — 그 사이 타입 오류가 나는 것을 Task 3 Step 4 에 적어 뒀다.
- Prisma 접근자는 `prisma.giftAbility` · `prisma.giftAbilityCond` · `prisma.giftAbilityAuthored` 로 일관.

---

## 실행 안내

이 계획은 **1단계(데이터)만** 담는다. 2단계(엔진)는 별도 PR 이고, 이 PR 이 만든 데이터가 있어야 검증된다.

검수 회차(456건)는 **태스크가 아니라 사용자와 에이전트가 왕복하는 작업**이다. Task 8 이 그 도구를 만들고, 회차는 이 PR 이 머지된 뒤 돈다.

```
에이전트  npm run gift:page      검수 페이지를 만들어 Artifact 로 게시한다
사용자   페이지에서 절 단위로 훑으며 맞다/틀리다. 판정은 브라우저에 남는다
사용자   「내보내기」                 verdicts.json 을 받아 전달한다
에이전트  npm run gift:import        progress.json 에 반영하고 틀리다를 읽는다
사용자   무엇이 틀렸는지 서술한다
에이전트  저작 jsonl 을 고치고 페이지를 다시 만든다
                               「틀리다」가 없어질 때까지 반복
```

검수가 끝나기 전에도 값이 나온다 — 저작 파일에 없는 기프트는 `gift_ability` 행이 없고, 2단계 엔진은 그런 기프트를 판정 보류로 다룬다.
