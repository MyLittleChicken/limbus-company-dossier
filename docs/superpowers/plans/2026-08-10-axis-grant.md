# 축 부여·제한 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 게임이 「이 인격은 …으로만 취급됨」이라 말하는 제한을 `canonical` 이 지키게 하고, 패시브·에고 패시브·기프트가 축을 주는 일을 한 표에서 공통으로 다룬다.

**Architecture:** 저작 17행(`app.axis_grant`)이 정본이다. 빌더가 그것을 읽어 `canonical.identity_axis` 의 `granted` 행과 `canonical.axis_restrict` 를 굽고, **제한은 굽는 자리에서 이미 적용한다** — 소비자가 교집합을 다시 취하지 않아도 `identity_axis` 가 옳다. 과대 34짝을 만들던 `special_status` 경로는 없앤다. 엔진은 게이트(장착·보유·편성 인원)를 두 단계로 평가한다.

**Tech Stack:** TypeScript · Prisma(멀티 스키마) · PostgreSQL · `node:test` · Next.js

## Global Constraints

- 스펙: `docs/superpowers/specs/2026-08-10-axis-grant-design.md`. 값이 어긋나면 스펙이 정본이다.
- **표를 지우지 않는다.** `app.ego_granted_axis` · `canonical.identity_status` 는 남기고 폐기 주석만 붙인다.
- 축 id 8종: `COMBUSTION`(화상) `LACERATION`(출혈) `BURST`(파열) `SINKING`(침잠) `VIBRATION`(진동) `BREATH`(호흡) `CHARGE`(충전) `BULLET`(가속).
- 저작 데이터에 `note` 를 반드시 남긴다. `note` 는 `authoredDigest` 에 넣지 않는다 (`src/v2/authored.ts:7` 의 기존 방침).
- `canonical` 은 승격으로만 바뀐다(ADR-07). 개발 중 재적재는 `npm run v2:canonical`, 판 교체는 `v2:build → v2:diff → v2:promote`.
- 결손은 반드시 `meta.gap(...)` 으로 남긴다. 기본값으로 덮지 않는다.
- 검사: `npm test` (`tsx --test "lib/**/*.test.ts" "src/**/*.test.ts"`) · `npm run typecheck` · `npm run build`. **세 개 모두** 태스크마다 돌린다 — 값 import 에 `.js` 확장자를 붙이면 `typecheck` 는 통과하고 `build` 가 깨진 전례가 있다.
- 주석과 커밋 메시지는 한국어. 코드 식별자는 영어.

---

## 파일 구조

| 파일 | 책임 |
|---|---|
| `prisma/v2/schema.prisma` | `AxisGrant`(app) · `AxisRestrict`(canonical) 추가 · `IdentityAxis` 칸 변경 |
| `prisma/v2/views.sql` | `v_identity_capability` 가 게이트 세 칸을 나른다 |
| `src/v2/canonical/axis-grant.ts` | **새 파일.** 저작 17행 → `identity_axis` granted 행 + `axis_restrict` 행 |
| `src/v2/canonical/axis-grant.test.ts` | 위의 단위 테스트 |
| `src/v2/canonical/identity-axis.ts` | `special_status` 경로 제거 · 제한 적용 · `affects`/게이트 칸 채우기 |
| `src/v2/canonical/identity-axis.test.ts` | 위의 단위 테스트 갱신 |
| `src/v2/authored.ts` | `axisGrant` 를 `Authored` · `readAuthored` · `unknownRefs` · `authoredDigest` 에 |
| `src/v2/seed-authored.ts` | 저작 17행 |
| `src/v2/load-canonical.ts` | 배선 |
| `src/v2/verify-canonical.ts` | 검사 |
| `lib/engine/v2/profile.ts` | 게이트 2단계 평가 |
| `lib/engine/v2/load.ts` | 뷰의 새 칸을 읽는다 |
| `lib/engine/v2/axis-grant-golden.test.ts` | **새 파일.** 덱 A · 덱 C 골든 |

---

## Task 1: 스키마 — 저작 표와 제한 표

**Files:**
- Modify: `prisma/v2/schema.prisma` (`IdentityAxis` 467-482행 · `EgoGrantedAxis` 2036-2044행 뒤)
- Modify: `prisma/v2/views.sql:25-27` 부근

**Interfaces:**
- Produces: Prisma 모델 `AxisGrant`(app, `axis_grant`) · `AxisRestrict`(canonical, `axis_restrict`) · `IdentityAxis` 의 새 칸 `affects`/`gateKind`/`gateRef`/`gateMin`.

- [ ] **Step 1: `AxisGrant` 를 `app` 스키마에 더한다**

`prisma/v2/schema.prisma` 의 `EgoGrantedAxis` 모델(2036-2044행) 바로 뒤에 넣는다.

```prisma
/// 축을 인격에 주거나 제한하는 효과. 패시브 · 에고 패시브 · 기프트가 같은 구조를 쓴다.
///
/// 게임이 「…을 부여하는 인격으로 취급됨」 · 「…으로만 취급됨」이라 말하는 자리다.
/// 「취급」 문형을 전수로 뽑아(패시브 703 · 에고 패시브 113 · 기프트 793 ·
/// 에고 스킬 611 → 31행) 축에 해당하는 출처 9건을 저작 17행으로 굳혔다.
///
/// 축 하나가 한 행이다 — 「화상, 진동으로만 취급」은 두 행이 된다.
model AxisGrant {
  /// `<sourceId>:<axisId>` — 저작이라 사람이 읽을 수 있어야 한다
  id         String  @id
  /// passive · ego_passive · gift
  sourceKind String  @map("source_kind")
  /// 1091603 · 2050911 · 9282
  sourceId   String  @map("source_id")
  /// add       이 축을 더한다
  /// restrict  **이 축들로만** 취급한다 — 나머지를 덜어낸다
  mode       String
  /// self          그 패시브를 가진 인격 (targetId 는 그 인격 id)
  /// association   그 소속의 인격 전부
  /// unit_keyword  그 유닛 키워드를 가진 인격 전부
  targetKind String  @map("target_kind")
  targetId   String  @map("target_id")
  axisId     String  @map("axis_id")
  /// tag(인격 취급) · skill(스킬 취급) · both
  affects    String
  /// always · ego_equipped · gift_held · roster_count · status_held
  gateKind   String  @map("gate_kind")
  /// gateKind 가 가리키는 대상. always 면 ''
  gateRef    String  @map("gate_ref")
  /// roster_count 일 때의 최소 인원. 아니면 null
  gateMin    Int?    @map("gate_min")
  /// 원문 한 줄. 검수가 대조할 근거다. 지문에는 안 들어간다
  note       String

  @@index([sourceKind, sourceId])
  @@map("axis_grant")
  @@schema("app")
}
```

- [ ] **Step 2: `AxisRestrict` 를 `canonical` 스키마에 더한다**

`IdentityAxis` 모델(467-482행) 바로 뒤에 넣는다.

```prisma
/// 이 인격은 이 축들로만 취급된다.
///
/// `identity_axis` 는 이 제한을 **이미 적용한 결과**다 — 소비자가 교집합을
/// 다시 취할 필요가 없다. 이 표는 스킬 공급(coin_token)에 같은 제한을 걸려는
/// 소비자를 위해 남긴다. 10916 의 스킬은 실제로 호흡을 주지만 게임이 그것을
/// 호흡 부여로 치지 않는다(1010902 는 「해당 키워드를 부여하는 스킬로
/// 취급되지 않음」이라 명시한다).
model AxisRestrict {
  identityId String @map("identity_id")
  axisId     String @map("axis_id")
  /// tag · skill · both
  affects    String
  /// 어느 패시브가 말했는가
  sourceId   String @map("source_id")

  identity Identity @relation(fields: [identityId], references: [id], onDelete: Cascade)
  axis     Axis     @relation(fields: [axisId], references: [id], onDelete: Cascade)

  @@id([identityId, axisId, affects])
  @@map("axis_restrict")
  @@schema("canonical")
}
```

`Identity` 모델(1025-1061행)과 `Axis` 모델(443-457행)에 역관계를 더한다.

```prisma
  axisRestricts AxisRestrict[]
```

- [ ] **Step 3: `IdentityAxis` 에 칸 넷을 더하고 `egoId` 를 없앤다**

467-482행의 `IdentityAxis` 를 이렇게 바꾼다. `egoId` 는 `gateRef` 가 대신한다.

```prisma
/// 인격이 가진 축.
///
/// **제한이 이미 적용된 결과다.** 게임이 「…으로만 취급됨」이라 말하면 그
/// 축들만 남는다(axis_restrict 참조).
model IdentityAxis {
  identityId String @map("identity_id")
  axisId     String @map("axis_id")
  /// keyword  identity_keyword → axis (정본. mj 가 제한을 이미 반영해 담았다)
  /// granted  app.axis_grant 의 add 행
  ///
  /// special_status 는 없앴다 — keyword 의 진상위집합이면서 게임의 제한을
  /// 무너뜨렸다. 보태는 것 0 · 과대 34짝(2026-08-10 실측)
  source     String
  /// tag · skill · both. keyword 경로는 언제나 both
  affects    String
  /// always · ego_equipped · gift_held · roster_count · status_held
  gateKind   String @default("always") @map("gate_kind")
  /// gateKind 가 가리키는 대상. always 면 ''
  gateRef    String @default("")       @map("gate_ref")
  /// roster_count 일 때의 최소 인원
  gateMin    Int?                      @map("gate_min")

  identity Identity @relation(fields: [identityId], references: [id], onDelete: Cascade)
  axis     Axis     @relation(fields: [axisId], references: [id], onDelete: Cascade)

  @@id([identityId, axisId, source, gateKind, gateRef])
  @@index([axisId])
  @@map("identity_axis")
  @@schema("canonical")
}
```

- [ ] **Step 4: 뷰가 게이트를 나르게 한다**

`prisma/v2/views.sql` 의 `v_identity_capability` 정의에서 `identity_axis` 갈래(25-27행 부근)를 바꾸고, 나머지 모든 갈래의 `'' AS ego_id` 를 세 칸으로 바꾼다.

```sql
-- identity_axis 갈래
SELECT identity_id,
       'axis'   AS ref_kind,
       axis_id  AS ref_id,
       gate_kind,
       gate_ref,
       gate_min
FROM canonical.identity_axis
UNION
-- 나머지 갈래는 전부 조건이 없다
SELECT identity_id,
       'association' AS ref_kind,
       association_id AS ref_id,
       'always'::text AS gate_kind,
       ''::text       AS gate_ref,
       NULL::integer  AS gate_min
FROM canonical.identity_association
UNION
-- … unit_keyword · sin · attack_type · skill_kind · resonance · coin 갈래도
-- 같은 방식으로 세 칸을 붙인다. 기존 WHERE 절과 JOIN 은 그대로 둔다
```

- [ ] **Step 5: DDL 을 다시 뽑고 스키마가 유효한지 본다**

```bash
npm run v2:schema:validate
npm run v2:schema:ddl
npm run v2:generate
npm run typecheck
```
Expected: `v2:schema:validate` 통과. `prisma/v2/schema.sql` 에 `axis_grant` · `axis_restrict` 가 생기고 `identity_axis` 에 `gate_kind` 가 생긴다. `typecheck` 는 이 시점에 **실패한다** — `egoId` 를 쓰던 자리가 남아 있다. 실패 목록을 기록해 두고 다음 태스크에서 지운다.

- [ ] **Step 6: 커밋**

```bash
git add prisma/v2/schema.prisma prisma/v2/views.sql prisma/v2/schema.sql src/v2/generated
git commit -m "feat(schema): axis_grant · axis_restrict 와 identity_axis 게이트 칸"
```

---

## Task 2: 저작 17행

**Files:**
- Modify: `src/v2/seed-authored.ts` (`EGO_GRANTED_AXIS` 31-36행 뒤)
- Modify: `src/v2/authored.ts` (`Authored` 13-16행 · `readAuthored` 24-32행 · `unknownRefs` 41-67행 · `authoredDigest` 76-83행)

**Interfaces:**
- Consumes: Task 1 의 `AxisGrant` 모델.
- Produces: `Authored.axisGrant: AxisGrantRow[]` — `readAuthored` 가 채운다.

```typescript
export interface AxisGrantRow {
	id: string; sourceKind: string; sourceId: string; mode: string;
	targetKind: string; targetId: string; axisId: string; affects: string;
	gateKind: string; gateRef: string; gateMin: number | null;
}
```

- [ ] **Step 1: `seed-authored.ts` 에 17행을 적는다**

`EGO_GRANTED_AXIS` 상수 뒤에 넣는다. `EGO_GRANTED_AXIS` 는 지우지 않는다(Task 8 에서 폐기 주석만 붙인다).

```typescript
/**
 * 축 부여·제한 — 출처 9건 · 17행.
 *
 * 「취급」 문형을 ko 전수로 뽑아(패시브 703 · 에고 패시브 113 · 기프트 793 ·
 * 에고 스킬 611 → 31행) 축에 해당하는 것만 남겼다. 소속을 바꾸는 9280·9841 과
 * 스킬 분류를 바꾸는 1021504·1061404 는 축이 아니라 다른 차원이라 뺐다.
 *
 * 10814·11115 는 태그 부분을 `identity_keyword` 가 이미 담고 있어(둘 다
 * Combustion·Laceration) 스킬 취급만 적는다.
 */
const AXIS_GRANT = [
	// ── 제한 4건 · 7행 ──────────────────────────────────────────
	{
		id: '1091603:COMBUSTION', sourceKind: 'passive', sourceId: '1091603', mode: 'restrict',
		targetKind: 'self', targetId: '10916', axisId: 'COMBUSTION', affects: 'both',
		gateKind: 'always', gateRef: '', gateMin: null,
		note: '보냐텔리 가문의 수치 — 「이 인격은 화상, 진동을 부여하는 인격으로만 취급됨」',
	},
	{
		id: '1091603:VIBRATION', sourceKind: 'passive', sourceId: '1091603', mode: 'restrict',
		targetKind: 'self', targetId: '10916', axisId: 'VIBRATION', affects: 'both',
		gateKind: 'always', gateRef: '', gateMin: null,
		note: '보냐텔리 가문의 수치 — 「이 인격은 화상, 진동을 부여하는 인격으로만 취급됨」',
	},
	{
		id: '1041502:BREATH', sourceKind: 'passive', sourceId: '1041502', mode: 'restrict',
		targetKind: 'self', targetId: '10415', axisId: 'BREATH', affects: 'both',
		gateKind: 'always', gateRef: '', gateMin: null,
		note: '「이 인격은 화상, 출혈, 호흡을 부여하는 인격으로만 취급됨」',
	},
	{
		id: '1041502:COMBUSTION', sourceKind: 'passive', sourceId: '1041502', mode: 'restrict',
		targetKind: 'self', targetId: '10415', axisId: 'COMBUSTION', affects: 'both',
		gateKind: 'always', gateRef: '', gateMin: null,
		note: '「이 인격은 화상, 출혈, 호흡을 부여하는 인격으로만 취급됨」',
	},
	{
		id: '1041502:LACERATION', sourceKind: 'passive', sourceId: '1041502', mode: 'restrict',
		targetKind: 'self', targetId: '10415', axisId: 'LACERATION', affects: 'both',
		gateKind: 'always', gateRef: '', gateMin: null,
		note: '「이 인격은 화상, 출혈, 호흡을 부여하는 인격으로만 취급됨」',
	},
	{
		id: '1010902:LACERATION', sourceKind: 'passive', sourceId: '1010902', mode: 'restrict',
		targetKind: 'self', targetId: '10109', axisId: 'LACERATION', affects: 'both',
		gateKind: 'always', gateRef: '', gateMin: null,
		note: '「이 인격은 출혈을 부여하는 인격으로만 취급됨. 랜덤으로 화상, 출혈, 진동, 파열, 침잠을 부여하는 스킬이 이 효과로 인해서 해당 키워드를 부여하는 스킬로 취급되지 않음.」',
	},
	{
		id: '1110902:LACERATION', sourceKind: 'passive', sourceId: '1110902', mode: 'restrict',
		targetKind: 'self', targetId: '11109', axisId: 'LACERATION', affects: 'both',
		gateKind: 'always', gateRef: '', gateMin: null,
		note: '「이 인격은 출혈을 부여하는 인격으로만 취급됨. 랜덤으로 화상, 출혈, 진동, 파열, 침잠을 부여하는 스킬이 이 효과로 인해서 해당 키워드를 부여하는 스킬로 취급되지 않음.」',
	},

	// ── E.G.O 장착 부여 2건 · 4행 ────────────────────────────────
	{
		id: '2010911:SINKING', sourceKind: 'ego_passive', sourceId: '2010911', mode: 'add',
		targetKind: 'self', targetId: '', axisId: 'SINKING', affects: 'both',
		gateKind: 'ego_equipped', gateRef: '20109', gateMin: null,
		note: '엄숙한 애도 — 「이 인격은 진동, 침잠을 부여하는 인격으로 취급됨」',
	},
	{
		id: '2010911:VIBRATION', sourceKind: 'ego_passive', sourceId: '2010911', mode: 'add',
		targetKind: 'self', targetId: '', axisId: 'VIBRATION', affects: 'both',
		gateKind: 'ego_equipped', gateRef: '20109', gateMin: null,
		note: '엄숙한 애도 — 「이 인격은 진동, 침잠을 부여하는 인격으로 취급됨」',
	},
	{
		id: '2050911:BREATH', sourceKind: 'ego_passive', sourceId: '2050911', mode: 'add',
		targetKind: 'self', targetId: '', axisId: 'BREATH', affects: 'both',
		gateKind: 'ego_equipped', gateRef: '20509', gateMin: null,
		note: '착영휘도 — 「이 인격은 출혈, 호흡을 부여하는 인격으로 취급됨」',
	},
	{
		id: '2050911:LACERATION', sourceKind: 'ego_passive', sourceId: '2050911', mode: 'add',
		targetKind: 'self', targetId: '', axisId: 'LACERATION', affects: 'both',
		gateKind: 'ego_equipped', gateRef: '20509', gateMin: null,
		note: '착영휘도 — 「이 인격은 출혈, 호흡을 부여하는 인격으로 취급됨」',
	},

	// ── 상태 조건 부여 2건 · 4행 · 스킬 취급만 ───────────────────
	// 태그(「이 인격은 화상, 출혈을 부여하는 인격으로 취급됨」)는 조건이 없고
	// identity_keyword 가 이미 담았다(10814·11115 둘 다 Combustion·Laceration).
	{
		id: '1081402:COMBUSTION', sourceKind: 'passive', sourceId: '1081402', mode: 'add',
		targetKind: 'self', targetId: '10814', axisId: 'COMBUSTION', affects: 'skill',
		gateKind: 'status_held', gateRef: 'HeatRay', gateMin: null,
		note: '「열선 효과를 보유하고 있을 시, 출혈을 부여하는 스킬이 이 효과로 인해서 화상과 출혈을 부여하는 스킬로 취급됨.」',
	},
	{
		id: '1081402:LACERATION', sourceKind: 'passive', sourceId: '1081402', mode: 'add',
		targetKind: 'self', targetId: '10814', axisId: 'LACERATION', affects: 'skill',
		gateKind: 'status_held', gateRef: 'HeatRay', gateMin: null,
		note: '「열선 효과를 보유하고 있을 시, 출혈을 부여하는 스킬이 이 효과로 인해서 화상과 출혈을 부여하는 스킬로 취급됨.」',
	},
	{
		id: '1111502:COMBUSTION', sourceKind: 'passive', sourceId: '1111502', mode: 'add',
		targetKind: 'self', targetId: '11115', axisId: 'COMBUSTION', affects: 'skill',
		gateKind: 'status_held', gateRef: 'SwordUnseal', gateMin: null,
		note: '「자신의 검이 1단계 봉인 해제, 2단계 봉인 해제 상태면, 출혈을 부여하는 스킬이 이 효과로 인해서 화상과 출혈을 부여하는 스킬로 취급됨.」',
	},
	{
		id: '1111502:LACERATION', sourceKind: 'passive', sourceId: '1111502', mode: 'add',
		targetKind: 'self', targetId: '11115', axisId: 'LACERATION', affects: 'skill',
		gateKind: 'status_held', gateRef: 'SwordUnseal', gateMin: null,
		note: '「자신의 검이 1단계 봉인 해제, 2단계 봉인 해제 상태면, 출혈을 부여하는 스킬이 이 효과로 인해서 화상과 출혈을 부여하는 스킬로 취급됨.」',
	},

	// ── 기프트 부여 1건 · 2행 · 소속 단위 ────────────────────────
	{
		id: '9282:COMBUSTION', sourceKind: 'gift', sourceId: '9282', mode: 'add',
		targetKind: 'association', targetId: 'DAWN', axisId: 'COMBUSTION', affects: 'both',
		gateKind: 'roster_count', gateRef: 'DAWN', gateMin: 3,
		note: '날개 모양 양초 — 「새벽 사무소 소속 인격을 화상, 진동을 부여하는 인격으로 취급됨」. 발동 조건은 「새벽 사무소 소속 인격이 3인 이상일 때 (편성 인원을 기준으로 함)」',
	},
	{
		id: '9282:VIBRATION', sourceKind: 'gift', sourceId: '9282', mode: 'add',
		targetKind: 'association', targetId: 'DAWN', axisId: 'VIBRATION', affects: 'both',
		gateKind: 'roster_count', gateRef: 'DAWN', gateMin: 3,
		note: '날개 모양 양초 — 「새벽 사무소 소속 인격을 화상, 진동을 부여하는 인격으로 취급됨」. 발동 조건은 「새벽 사무소 소속 인격이 3인 이상일 때 (편성 인원을 기준으로 함)」',
	},
];
```

- [ ] **Step 2: `main()` 에 적재와 합계 검증을 더한다**

`seed-authored.ts` 의 `main()` 안, 기존 두 `createMany` 뒤에 넣는다.

```typescript
	const c = await prisma.axisGrant.createMany({ data: AXIS_GRANT, skipDuplicates: true });
	const totalC = await prisma.axisGrant.count();
	console.log(`axis_grant        새로 ${c.count}행 · 합계 ${totalC}`);
	if (totalC !== AXIS_GRANT.length) {
		console.error(`axis_grant 합계가 ${AXIS_GRANT.length} 이 아니다`);
		process.exitCode = 1;
	}
```

- [ ] **Step 3: `authored.ts` 를 넓힌다**

`Authored` 인터페이스(13-16행)에 필드를 더한다.

```typescript
export interface AxisGrantRow {
	id: string; sourceKind: string; sourceId: string; mode: string;
	targetKind: string; targetId: string; axisId: string; affects: string;
	gateKind: string; gateRef: string; gateMin: number | null;
}

export interface Authored {
	refException: Array<{ kind: string; key: string; refKind: string; refId: string }>;
	egoGranted: Array<{ egoId: string; axisId: string }>;
	axisGrant: AxisGrantRow[];
}
```

`readAuthored`(24-32행)의 `Promise.all` 에 더한다.

```typescript
		prisma.axisGrant.findMany({
			select: {
				id: true, sourceKind: true, sourceId: true, mode: true,
				targetKind: true, targetId: true, axisId: true, affects: true,
				gateKind: true, gateRef: true, gateMin: true,
			},
			orderBy: { id: 'asc' },
		}),
```

- [ ] **Step 4: `unknownRefs` 에 검사를 더한다**

`unknownRefs`(41-67행)의 `egoGranted` 루프 뒤에 넣는다. 굽기 전에 저작이 가리키는 대상이 실재하는지 본다.

```typescript
	const MODES = new Set(['add', 'restrict']);
	const TARGETS = new Set(['self', 'association', 'unit_keyword']);
	const AFFECTS = new Set(['tag', 'skill', 'both']);
	const GATES = new Set(['always', 'ego_equipped', 'gift_held', 'roster_count', 'status_held']);

	for (const g of a.axisGrant) {
		if (!known.axisIds.has(g.axisId)) {
			out.push(`axis_grant ${g.id} — axis '${g.axisId}' 가 canonical 에 없다`);
		}
		if (!MODES.has(g.mode)) out.push(`axis_grant ${g.id} — 모르는 mode '${g.mode}'`);
		if (!TARGETS.has(g.targetKind)) out.push(`axis_grant ${g.id} — 모르는 target_kind '${g.targetKind}'`);
		if (!AFFECTS.has(g.affects)) out.push(`axis_grant ${g.id} — 모르는 affects '${g.affects}'`);
		if (!GATES.has(g.gateKind)) out.push(`axis_grant ${g.id} — 모르는 gate_kind '${g.gateKind}'`);
		if (g.targetKind === 'association' && !known.associationIds.has(g.targetId)) {
			out.push(`axis_grant ${g.id} — association '${g.targetId}' 가 canonical 에 없다`);
		}
		if (g.targetKind === 'unit_keyword' && !known.unitKeywordIds.has(g.targetId)) {
			out.push(`axis_grant ${g.id} — unit_keyword '${g.targetId}' 가 canonical 에 없다`);
		}
		if (g.mode === 'restrict' && g.targetKind !== 'self') {
			out.push(`axis_grant ${g.id} — restrict 는 target_kind='self' 여야 한다`);
		}
		if ((g.gateKind === 'roster_count') !== (g.gateMin !== null)) {
			out.push(`axis_grant ${g.id} — gate_min 은 roster_count 일 때만 있어야 한다`);
		}
	}
```

`self` 의 `targetId` 가 실재하는 인격인지는 여기서 보지 않는다 — `identity` 목록이 `KnownIds` 에 없고, 저작이 실물을 앞지르는 것은 기존 방침상 오류가 아니다(`authored.ts:36-38`). 대신 빌더가 `meta.gap` 으로 남긴다(Task 3).

- [ ] **Step 5: `authoredDigest` 에 넣는다**

`authoredDigest`(76-83행)에 정렬 직렬화를 더한다. `note` 는 넣지 않는다.

```typescript
	for (const g of [...a.axisGrant].sort((x, y) => x.id.localeCompare(y.id))) {
		h.update(`axis_grant\t${g.id}\t${g.sourceKind}\t${g.sourceId}\t${g.mode}\t` +
			`${g.targetKind}\t${g.targetId}\t${g.axisId}\t${g.affects}\t` +
			`${g.gateKind}\t${g.gateRef}\t${g.gateMin ?? ''}\n`);
	}
```

- [ ] **Step 6: `authored.test.ts` 에 검사 테스트를 더한다**

```typescript
test('axis_grant — restrict 는 self 여야 한다', () => {
	const a: Authored = {
		refException: [], egoGranted: [],
		axisGrant: [{
			id: 'x:COMBUSTION', sourceKind: 'passive', sourceId: 'x', mode: 'restrict',
			targetKind: 'association', targetId: 'DAWN', axisId: 'COMBUSTION',
			affects: 'both', gateKind: 'always', gateRef: '', gateMin: null,
		}],
	};
	const known = {
		axisIds: new Set(['COMBUSTION']), unitKeywordIds: new Set<string>(),
		associationIds: new Set(['DAWN']),
	};
	const out = unknownRefs(a, known);
	assert.equal(out.length, 1);
	assert.match(out[0], /restrict 는 target_kind='self'/);
});

test('axis_grant — gate_min 은 roster_count 일 때만 있다', () => {
	const a: Authored = {
		refException: [], egoGranted: [],
		axisGrant: [{
			id: 'y:BREATH', sourceKind: 'gift', sourceId: 'y', mode: 'add',
			targetKind: 'self', targetId: '', axisId: 'BREATH',
			affects: 'both', gateKind: 'ego_equipped', gateRef: '20509', gateMin: 3,
		}],
	};
	const known = {
		axisIds: new Set(['BREATH']), unitKeywordIds: new Set<string>(),
		associationIds: new Set<string>(),
	};
	assert.match(unknownRefs(a, known)[0], /gate_min 은 roster_count 일 때만/);
});

test('지문은 note 를 안 본다', () => {
	const base: Authored = { refException: [], egoGranted: [], axisGrant: [] };
	assert.equal(authoredDigest(base), authoredDigest({ ...base }));
});
```

- [ ] **Step 7: 테스트를 돌린다**

```bash
npm test 2>&1 | tail -20
npm run typecheck
```
Expected: 새 테스트 세 개 통과. 기존 `authored.test.ts` 가 `Authored` 리터럴을 만드는 자리에 `axisGrant: []` 를 더해야 통과한다 — 컴파일 오류를 따라가 전부 채운다.

- [ ] **Step 8: 저작을 실제로 심고 확인한다**

```bash
npm run v2:seed:authored
```
Expected: `axis_grant  새로 17행 · 합계 17`

- [ ] **Step 9: 커밋**

```bash
git add src/v2/seed-authored.ts src/v2/authored.ts src/v2/authored.test.ts
git commit -m "feat(data): 축 부여·제한 저작 17행 — 출처 9건"
```

---

## Task 3: 빌더 — 저작을 인격 행으로 편다

**Files:**
- Create: `src/v2/canonical/axis-grant.ts`
- Create: `src/v2/canonical/axis-grant.test.ts`

**Interfaces:**
- Consumes: Task 2 의 `AxisGrantRow`.
- Produces:

```typescript
export interface AxisGrantInput {
	axisGrant: AxisGrantRow[];
	axisIds: string[];
	/** 인격 id 와 그 수감자. E.G.O 는 수감자에 딸리므로 장착 후보를 여기서 편다 */
	identity: Array<{ id: string; sinnerId: number }>;
	ego: Array<{ id: string; sinnerId: number }>;
	identityAssociation: Array<{ identityId: string; associationId: string }>;
	identityUnitKeyword: Array<{ identityId: string; keyword: string }>;
}
export interface GrantedAxisRow {
	identityId: string; axisId: string; affects: string;
	gateKind: string; gateRef: string; gateMin: number | null;
}
export interface AxisRestrictRow {
	identityId: string; axisId: string; affects: string; sourceId: string;
}
export function buildAxisGrant(
	input: AxisGrantInput, meta: Meta,
): { granted: GrantedAxisRow[]; restrict: AxisRestrictRow[] };
```

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`src/v2/canonical/axis-grant.test.ts`

```typescript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildAxisGrant, type AxisGrantInput } from './axis-grant.js';
import { Meta } from './meta.js';

function input(): AxisGrantInput {
	return {
		axisGrant: [
			// 제한 — 10916 은 화상·진동으로만
			{ id: '1091603:COMBUSTION', sourceKind: 'passive', sourceId: '1091603', mode: 'restrict',
				targetKind: 'self', targetId: '10916', axisId: 'COMBUSTION', affects: 'both',
				gateKind: 'always', gateRef: '', gateMin: null },
			{ id: '1091603:VIBRATION', sourceKind: 'passive', sourceId: '1091603', mode: 'restrict',
				targetKind: 'self', targetId: '10916', axisId: 'VIBRATION', affects: 'both',
				gateKind: 'always', gateRef: '', gateMin: null },
			// 부여 — 소속 단위. DAWN 인격 둘에게 각각 간다
			{ id: '9282:VIBRATION', sourceKind: 'gift', sourceId: '9282', mode: 'add',
				targetKind: 'association', targetId: 'DAWN', axisId: 'VIBRATION', affects: 'both',
				gateKind: 'roster_count', gateRef: 'DAWN', gateMin: 3 },
			// 부여 — self 인데 targetId 가 비어 있다(에고 장착형).
			// 그 E.G.O 수감자(5)의 인격만 후보가 되어야 한다
			{ id: '2050911:BREATH', sourceKind: 'ego_passive', sourceId: '2050911', mode: 'add',
				targetKind: 'self', targetId: '', axisId: 'BREATH', affects: 'both',
				gateKind: 'ego_equipped', gateRef: '20509', gateMin: null },
			// 축이 아닌 것 — 조용히 버리지 않고 결손으로 남아야 한다
			{ id: 'zz:NOT_AN_AXIS', sourceKind: 'passive', sourceId: 'zz', mode: 'add',
				targetKind: 'self', targetId: '10916', axisId: 'NOT_AN_AXIS', affects: 'both',
				gateKind: 'always', gateRef: '', gateMin: null },
		],
		axisIds: ['COMBUSTION', 'VIBRATION', 'BREATH', 'LACERATION'],
		// 10916·11001 은 수감자 5, 11002 는 9. 20509 는 수감자 5 의 E.G.O 다
		identity: [
			{ id: '10916', sinnerId: 5 },
			{ id: '11001', sinnerId: 5 },
			{ id: '11002', sinnerId: 9 },
		],
		ego: [{ id: '20509', sinnerId: 5 }],
		identityAssociation: [
			{ identityId: '11001', associationId: 'DAWN' },
			{ identityId: '11002', associationId: 'DAWN' },
		],
		identityUnitKeyword: [],
	};
}

test('제한은 restrict 행으로 나온다', () => {
	const { restrict } = buildAxisGrant(input(), new Meta());
	assert.deepEqual(restrict.sort((a, b) => a.axisId.localeCompare(b.axisId)), [
		{ identityId: '10916', axisId: 'COMBUSTION', affects: 'both', sourceId: '1091603' },
		{ identityId: '10916', axisId: 'VIBRATION', affects: 'both', sourceId: '1091603' },
	]);
});

test('소속 단위 부여는 그 소속 인격 전부로 펴진다', () => {
	const { granted } = buildAxisGrant(input(), new Meta());
	const dawn = granted.filter((g) => g.gateRef === 'DAWN');
	assert.deepEqual(dawn.map((g) => g.identityId).sort(), ['11001', '11002']);
	assert.equal(dawn[0].gateKind, 'roster_count');
	assert.equal(dawn[0].gateMin, 3);
});

test('E.G.O 장착형은 그 수감자의 인격만 후보가 된다', () => {
	const { granted } = buildAxisGrant(input(), new Meta());
	const ego = granted.filter((g) => g.gateRef === '20509');
	// 11002 는 수감자 9 라 20509 를 낄 수 없다. 10916 은 후보였으나 제한이 지운다
	assert.deepEqual(ego.map((g) => g.identityId).sort(), ['11001']);
});

test('제한은 부여보다 세다 — 제한 밖의 축은 granted 에서도 빠진다', () => {
	// 10916 은 화상·진동으로만인데 2050911 이 호흡을 주려 한다. 남으면 안 된다
	const { granted } = buildAxisGrant(input(), new Meta());
	assert.equal(granted.some((g) => g.identityId === '10916' && g.axisId === 'BREATH'), false);
});

test('E.G.O 가 실물에 없으면 던지지 않고 결손으로 남는다', () => {
	const i = input();
	i.ego = [];
	const meta = new Meta();
	const { granted } = buildAxisGrant(i, meta);
	assert.equal(granted.some((g) => g.gateRef === '20509'), false);
	assert.ok(meta.gaps.some((g) => g.entityId === '2050911:BREATH' && g.field === 'gate_ref'));
});

test('모르는 축은 조용히 버리지 않고 결손으로 남는다', () => {
	const meta = new Meta();
	buildAxisGrant(input(), meta);
	assert.ok(meta.gaps.some((g) => g.entity === 'axis_grant' && g.entityId === 'zz:NOT_AN_AXIS'));
});

test('저작이 실물을 앞질러도 던지지 않고 결손으로 남는다', () => {
	const i = input();
	i.axisGrant.push({
		id: 'qq:COMBUSTION', sourceKind: 'passive', sourceId: 'qq', mode: 'restrict',
		targetKind: 'self', targetId: '99999', axisId: 'COMBUSTION', affects: 'both',
		gateKind: 'always', gateRef: '', gateMin: null,
	});
	const meta = new Meta();
	const { restrict } = buildAxisGrant(i, meta);
	assert.equal(restrict.some((r) => r.identityId === '99999'), false);
	assert.ok(meta.gaps.some((g) => g.entityId === 'qq:COMBUSTION'));
});
```

- [ ] **Step 2: 테스트가 실패하는지 본다**

```bash
npx tsx --test src/v2/canonical/axis-grant.test.ts
```
Expected: FAIL — `Cannot find module './axis-grant.js'`

- [ ] **Step 3: `axis-grant.ts` 를 쓴다**

```typescript
/**
 * 축 부여·제한을 인격 행으로 편다.
 *
 * 저작 `app.axis_grant` 17행이 정본이다. 여기서 하는 일은 **펴기와 제한 적용**
 * 뿐이다 — 무엇이 조건인지는 저작이 정한다(ADR-08 「규칙은 코드 · 사실은 데이터」).
 *
 * **제한은 여기서 이미 적용한다.** `identity_axis` 를 읽는 쪽이 교집합을 다시
 * 취하지 않아도 옳게 만든다. 게임이 「이 인격은 화상, 진동을 부여하는 인격으로만
 * 취급됨」(1091603)이라 말하면 그 인격의 축은 둘뿐이다.
 */
import type { Meta } from './meta.js';
import type { AxisGrantRow } from '../authored.js';

const EVIDENCE = 'docs/superpowers/specs/2026-08-10-axis-grant-design.md';

export interface AxisGrantInput {
	axisGrant: AxisGrantRow[];
	axisIds: string[];
	identity: Array<{ id: string; sinnerId: number }>;
	ego: Array<{ id: string; sinnerId: number }>;
	identityAssociation: Array<{ identityId: string; associationId: string }>;
	identityUnitKeyword: Array<{ identityId: string; keyword: string }>;
}

export interface GrantedAxisRow {
	identityId: string;
	axisId: string;
	affects: string;
	gateKind: string;
	gateRef: string;
	gateMin: number | null;
}

export interface AxisRestrictRow {
	identityId: string;
	axisId: string;
	affects: string;
	sourceId: string;
}

/**
 * 저작 한 행이 어느 인격들에 걸리는가.
 *
 * `targetKind='self'` 이면서 `targetId` 가 빈 것은 E.G.O 장착형이다.
 * **전 인격이 아니라 그 E.G.O 를 낄 수 있는 인격만** 후보다 — E.G.O 는
 * 수감자에 딸리므로 같은 수감자의 인격 전부가 후보이고, 실제로 끼는지는
 * 게이트가 정한다. 여기서 수감자로 좁히지 않으면 184 인격 전부에 행이 생겨
 * 편성에 없는 인격이 축을 갖는 것처럼 보인다.
 */
function targetsOf(g: AxisGrantRow, input: AxisGrantInput, meta: Meta): string[] {
	if (g.targetKind === 'association') {
		return input.identityAssociation
			.filter((a) => a.associationId === g.targetId)
			.map((a) => a.identityId);
	}
	if (g.targetKind === 'unit_keyword') {
		return input.identityUnitKeyword
			.filter((k) => k.keyword === g.targetId)
			.map((k) => k.identityId);
	}
	if (g.targetId !== '') return [g.targetId];

	if (g.gateKind !== 'ego_equipped') {
		meta.gap('axis_grant', g.id, 'target_id',
			`target_id 가 비었는데 gate_kind 가 '${g.gateKind}' 다 — 대상을 정할 수 없다`, EVIDENCE);
		return [];
	}
	const sinnerId = input.ego.find((e) => e.id === g.gateRef)?.sinnerId;
	if (sinnerId === undefined) {
		// 저작이 실물을 앞질렀다. 조용히 넘기면 축이 통째로 빈다
		meta.gap('axis_grant', g.id, 'gate_ref',
			`E.G.O '${g.gateRef}' 가 canonical 에 없다`, EVIDENCE);
		return [];
	}
	return input.identity.filter((i) => i.sinnerId === sinnerId).map((i) => i.id);
}

export function buildAxisGrant(
	input: AxisGrantInput,
	meta: Meta,
): { granted: GrantedAxisRow[]; restrict: AxisRestrictRow[] } {
	const axes = new Set(input.axisIds);
	const ids = new Set(input.identity.map((i) => i.id));
	const granted: GrantedAxisRow[] = [];
	const restrict: AxisRestrictRow[] = [];

	for (const g of input.axisGrant) {
		if (!axes.has(g.axisId)) {
			meta.gap('axis_grant', g.id, 'axis_id', `축 '${g.axisId}' 가 canonical 에 없다`, EVIDENCE);
			continue;
		}
		const targets = targetsOf(g, input, meta).filter((id) => {
			if (ids.has(id)) return true;
			meta.gap('axis_grant', g.id, 'target_id', `인격 '${id}' 가 canonical 에 없다`, EVIDENCE);
			return false;
		});
		if (targets.length === 0 && g.targetKind !== 'self') {
			meta.gap('axis_grant', g.id, 'target_id',
				`${g.targetKind} '${g.targetId}' 에 속한 인격이 하나도 없다`, EVIDENCE);
		}
		for (const identityId of targets) {
			if (g.mode === 'restrict') {
				restrict.push({ identityId, axisId: g.axisId, affects: g.affects, sourceId: g.sourceId });
			} else {
				granted.push({
					identityId, axisId: g.axisId, affects: g.affects,
					gateKind: g.gateKind, gateRef: g.gateRef, gateMin: g.gateMin,
				});
			}
		}
	}

	return { granted: applyRestrict(granted, restrict), restrict };
}

/**
 * 제한을 부여에 건다.
 *
 * 제한이 있는 인격은 그 축들만 남는다. `affects` 가 겹칠 때만 건다 —
 * 태그 제한이 스킬 부여를 지우지 않는다.
 */
export function applyRestrict(
	granted: GrantedAxisRow[],
	restrict: AxisRestrictRow[],
): GrantedAxisRow[] {
	if (restrict.length === 0) return granted;
	/** 인격 → 그 인격이 남길 수 있는 축 (affects 별) */
	const allow = new Map<string, Set<string>>();
	for (const r of restrict) {
		for (const a of expand(r.affects)) {
			const key = `${r.identityId}|${a}`;
			const set = allow.get(key);
			if (set === undefined) allow.set(key, new Set([r.axisId]));
			else set.add(r.axisId);
		}
	}
	return granted.filter((g) =>
		expand(g.affects).some((a) => {
			const set = allow.get(`${g.identityId}|${a}`);
			return set === undefined || set.has(g.axisId);
		}),
	);
}

/** both 는 tag 와 skill 둘 다를 뜻한다 */
export function expand(affects: string): string[] {
	return affects === 'both' ? ['tag', 'skill'] : [affects];
}
```

- [ ] **Step 4: 테스트가 통과하는지 본다**

```bash
npx tsx --test src/v2/canonical/axis-grant.test.ts
npm run typecheck
```
Expected: 여섯 테스트 전부 PASS.

- [ ] **Step 5: 커밋**

```bash
git add src/v2/canonical/axis-grant.ts src/v2/canonical/axis-grant.test.ts
git commit -m "feat(canonical): 축 부여·제한 빌더 — 펴기와 제한 적용"
```

---

## Task 4: `identity-axis` — `special_status` 를 없애고 granted 를 받는다

**Files:**
- Modify: `src/v2/canonical/identity-axis.ts` (전면)
- Modify: `src/v2/canonical/identity-axis.test.ts`

**Interfaces:**
- Consumes: Task 3 의 `GrantedAxisRow` · `AxisRestrictRow` · `applyRestrict` · `expand`.
- Produces:

```typescript
export interface IdentityAxisInput {
	identityKeyword: Array<{ identityId: string; keywordId: string }>;
	axisIds: string[];
	identityIds: string[];
	granted: GrantedAxisRow[];
	restrict: AxisRestrictRow[];
}
export interface IdentityAxisRow {
	identityId: string; axisId: string; source: string; affects: string;
	gateKind: string; gateRef: string; gateMin: number | null;
}
export function buildIdentityAxis(input: IdentityAxisInput, meta: Meta): IdentityAxisRow[];
```

`identityStatus` · `statusCategory` · `identity` · `ego` · `egoGranted` 입력은 **없앤다.** E.G.O 를 수감자별로 펴는 일은 Task 3 의 `targetsOf` 가 `targetKind='self'` · `targetId=''` 로 대신한다.

- [ ] **Step 1: 테스트를 새로 쓴다**

`identity-axis.test.ts` 를 통째로 바꾼다.

```typescript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildIdentityAxis, type IdentityAxisInput } from './identity-axis.js';
import { Meta } from './meta.js';

function input(): IdentityAxisInput {
	return {
		identityKeyword: [
			// 10916 — 패시브 1091603 이 화상·진동으로만 제한한다. mj 가 이미 반영했다
			{ identityId: '10916', keywordId: 'Combustion' },
			{ identityId: '10916', keywordId: 'Vibration' },
			// 축이 아닌 키워드는 무시된다
			{ identityId: '10916', keywordId: 'Poise' },
			{ identityId: '11001', keywordId: 'Laceration' },
		],
		axisIds: ['COMBUSTION', 'VIBRATION', 'BREATH', 'LACERATION'],
		identityIds: ['10916', '11001', '11002'],
		granted: [
			// 착영휘도를 끼면 호흡·출혈. 10916 은 제한이 있어 살아남지 못한다
			{ identityId: '10916', axisId: 'BREATH', affects: 'both',
				gateKind: 'ego_equipped', gateRef: '20509', gateMin: null },
			{ identityId: '11001', axisId: 'BREATH', affects: 'both',
				gateKind: 'ego_equipped', gateRef: '20509', gateMin: null },
		],
		restrict: [
			{ identityId: '10916', axisId: 'COMBUSTION', affects: 'both', sourceId: '1091603' },
			{ identityId: '10916', axisId: 'VIBRATION', affects: 'both', sourceId: '1091603' },
		],
	};
}

test('keyword 경로 — 축인 것만, affects 는 both, 조건 없음', () => {
	const rows = buildIdentityAxis(input(), new Meta());
	const kw = rows.filter((r) => r.source === 'keyword' && r.identityId === '10916');
	assert.deepEqual(kw.map((r) => r.axisId).sort(), ['COMBUSTION', 'VIBRATION']);
	assert.ok(kw.every((r) => r.affects === 'both' && r.gateKind === 'always' && r.gateRef === ''));
});

test('제한이 keyword 도 깎는다 — 제한 밖의 축은 남지 않는다', () => {
	const i = input();
	// mj 가 반영을 안 한 경우를 가정한다. 제한이 최종 방어선이어야 한다
	i.identityKeyword.push({ identityId: '10916', keywordId: 'Breath' });
	const rows = buildIdentityAxis(i, new Meta());
	assert.equal(rows.some((r) => r.identityId === '10916' && r.axisId === 'BREATH'), false);
});

test('granted 경로 — 제한이 없는 인격은 살아남는다', () => {
	const rows = buildIdentityAxis(input(), new Meta());
	const g = rows.filter((r) => r.source === 'granted');
	assert.deepEqual(g.map((r) => r.identityId), ['11001']);
	assert.equal(g[0].axisId, 'BREATH');
	assert.equal(g[0].gateKind, 'ego_equipped');
	assert.equal(g[0].gateRef, '20509');
});

test('special_status 는 없다 — source 어휘가 둘뿐이다', () => {
	const rows = buildIdentityAxis(input(), new Meta());
	assert.deepEqual([...new Set(rows.map((r) => r.source))].sort(), ['granted', 'keyword']);
});

test('축이 하나도 없는 인격은 결손으로 남는다 — granted 는 안 센다', () => {
	const meta = new Meta();
	buildIdentityAxis(input(), meta);
	// 11002 는 keyword 도 granted 도 없다
	assert.ok(meta.gaps.some((g) => g.entity === 'identity' && g.entityId === '11002' && g.field === 'axis'));
	// 11001 은 keyword 가 있으므로 결손이 아니다
	assert.equal(meta.gaps.some((g) => g.entity === 'identity' && g.entityId === '11001'), false);
});

test('같은 행이 두 번 나오지 않는다', () => {
	const i = input();
	i.identityKeyword.push({ identityId: '10916', keywordId: 'Combustion' });
	const rows = buildIdentityAxis(i, new Meta());
	const keys = rows.map((r) => `${r.identityId}|${r.axisId}|${r.source}|${r.gateKind}|${r.gateRef}`);
	assert.equal(keys.length, new Set(keys).size);
});
```

- [ ] **Step 2: 테스트가 실패하는지 본다**

```bash
npx tsx --test src/v2/canonical/identity-axis.test.ts
```
Expected: FAIL — `IdentityAxisInput` 의 모양이 달라 타입 오류가 나고 테스트가 안 돈다.

- [ ] **Step 3: `identity-axis.ts` 를 다시 쓴다**

```typescript
/**
 * 인격이 가진 축.
 *
 * 두 경로를 한 관계로 통일한다.
 *   keyword  identity_keyword → axis
 *   granted  app.axis_grant 의 add 행 (Task 3 의 buildAxisGrant 가 편 것)
 *
 * **`keyword` 가 정본이다.** `keyword.id` 를 대문자화하면 축 id 이고, mj 가
 * 특수 키워드 파생과 「~로만 취급됨」을 이미 반영해 담았다. 제한 패시브를 가진
 * 인격 넷을 전수 대조해 확인했다(2026-08-10).
 *
 *   10109 「출혈로만」              keyword = Laceration
 *   10916 「화상·진동으로만」       keyword = Combustion, Vibration
 *   11109 「출혈로만」              keyword = Laceration
 *   10415 「화상·출혈·호흡으로만」  keyword = Breath, Combustion, Laceration
 *
 * **`special_status` 경로는 없앴다.** `identity_status → status_category → axis`
 * 로 축을 유도하면 게임의 제한이 무너진다. 전수로 재면 그 경로는 `keyword` 의
 * 진상위집합이라(겹침 266 = keyword 전부) 보태는 것이 0 이고 과대 34짝만
 * 만들었다. `keyword` 가 없는 다섯 인격은 `special_status` 도 비어 있어 이
 * 경로로 구제되지도 않는다. `identity_status` 표 자체는 남는다 — 출처가 말한
 * 사실이고, 축을 그것에서 유도하지 않을 뿐이다.
 *
 * 그래도 `restrict` 를 여기서 한 번 더 건다. mj 가 앞으로도 반영해 준다는
 * 보장은 없고, 제한은 최종 방어선이어야 한다.
 */
import type { Meta } from './meta.js';
import { applyRestrict, type AxisRestrictRow, type GrantedAxisRow } from './axis-grant.js';

const EVIDENCE = 'docs/superpowers/specs/2026-08-10-axis-grant-design.md';

export interface IdentityAxisInput {
	identityKeyword: Array<{ identityId: string; keywordId: string }>;
	axisIds: string[];
	identityIds: string[];
	granted: GrantedAxisRow[];
	restrict: AxisRestrictRow[];
}

export interface IdentityAxisRow {
	identityId: string;
	axisId: string;
	source: string;
	affects: string;
	gateKind: string;
	gateRef: string;
	gateMin: number | null;
}

export function buildIdentityAxis(input: IdentityAxisInput, meta: Meta): IdentityAxisRow[] {
	const axes = new Set(input.axisIds);

	// ── keyword 경로 ───────────────────────────────────────────
	const fromKeyword: GrantedAxisRow[] = [];
	for (const k of input.identityKeyword) {
		const axisId = k.keywordId.toUpperCase();
		if (!axes.has(axisId)) continue;
		fromKeyword.push({
			identityId: k.identityId, axisId, affects: 'both',
			gateKind: 'always', gateRef: '', gateMin: null,
		});
	}

	// 제한은 keyword 에도 건다. granted 는 buildAxisGrant 가 이미 걸었지만
	// 두 번 걸어도 결과가 같다(교집합은 멱등이다)
	const keyword = applyRestrict(fromKeyword, input.restrict);

	const seen = new Set<string>();
	const rows: IdentityAxisRow[] = [];
	const push = (r: GrantedAxisRow, source: string): void => {
		const key = `${r.identityId}|${r.axisId}|${source}|${r.gateKind}|${r.gateRef}`;
		if (seen.has(key)) return;
		seen.add(key);
		rows.push({ ...r, source });
	};
	for (const r of keyword) push(r, 'keyword');
	for (const r of input.granted) push(r, 'granted');

	// ── 축이 하나도 없는 인격을 기록한다 ─────────────────────────
	// granted 는 세지 않는다 — 결손의 뜻이 「조건 없이는 트리거에 안 걸린다」다
	const withAxis = new Set(rows.filter((r) => r.source === 'keyword').map((r) => r.identityId));
	for (const id of [...input.identityIds].sort()) {
		if (withAxis.has(id)) continue;
		meta.gap('identity', id, 'axis', '축이 하나도 없다 — 조건 없이는 트리거에 안 걸린다', EVIDENCE);
	}

	return rows;
}
```

- [ ] **Step 4: 테스트가 통과하는지 본다**

```bash
npx tsx --test src/v2/canonical/identity-axis.test.ts
```
Expected: 여섯 테스트 전부 PASS.

- [ ] **Step 5: 커밋**

```bash
git add src/v2/canonical/identity-axis.ts src/v2/canonical/identity-axis.test.ts
git commit -m "feat(canonical): special_status 경로를 없애고 제한을 최종 방어선으로"
```

---

## Task 5: 적재 배선

**Files:**
- Modify: `src/v2/load-canonical.ts` (import 23행 · 호출 309-317행 · 적재 694행)

**Interfaces:**
- Consumes: Task 3 `buildAxisGrant` · Task 4 `buildIdentityAxis`.

- [ ] **Step 1: import 를 더한다**

23행 옆에 넣는다.

```typescript
import { buildAxisGrant } from './canonical/axis-grant.js';
```

- [ ] **Step 2: 309-317행의 호출을 바꾼다**

```typescript
		// 저작 축 부여·제한을 인격 행으로 편다. 제한은 여기서 이미 적용된다
		const axisGrant = buildAxisGrant({
			axisGrant: authored.axisGrant,
			axisIds: axisTables.axis.map((a) => a.id),
			identity: identities.identity.map((i) => ({ id: i.id, sinnerId: i.sinnerId })),
			ego: egos.ego.map((e) => ({ id: e.id, sinnerId: e.sinnerId })),
			identityAssociation: identities.identityAssociation.map((a) => ({
				identityId: a.identityId, associationId: a.associationId,
			})),
			identityUnitKeyword: identities.identityUnitKeyword.map((k) => ({
				identityId: k.identityId, keyword: k.keyword,
			})),
		}, meta);

		const identityAxis = buildIdentityAxis({
			identityKeyword: identities.identityKeyword.map((k) => ({
				identityId: k.identityId, keywordId: k.keywordId,
			})),
			axisIds: axisTables.axis.map((a) => a.id),
			identityIds: identities.identity.map((i) => i.id),
			granted: axisGrant.granted,
			restrict: axisGrant.restrict,
		}, meta);
```

필드명은 확인해 두었다 — `identities.identityAssociation`(`identities.ts:172`) · `identities.identityKeyword`(`:173`) · `identities.identityUnitKeyword`(`:174`). `egos.ego` 는 기존 `buildIdentityAxis` 호출(315행)이 이미 쓰던 것이다.

- [ ] **Step 3: 적재를 더한다**

694행의 `identity_axis` 적재 바로 뒤에 넣는다. `axis_restrict` 는 `identity` 와 `axis` 둘 다 FK 이므로 이 자리가 맞다.

```typescript
		counts.push(['axis_restrict', await chunked(axisGrant.restrict, (d) => prisma.axisRestrict.createMany({ data: d }))]);
```

- [ ] **Step 4: TRUNCATE 목록에 더한다**

`src/v2/load-canonical.ts:549` 부근의 TRUNCATE 문에 `canonical.axis_restrict` 를 더한다. 재적재 때 남지 않게 한다.

- [ ] **Step 5: 실제로 굽고 행수를 본다**

```bash
npm run typecheck
npm run v2:canonical 2>&1 | grep -E "identity_axis|axis_restrict"
```
Expected:
```
identity_axis   338
axis_restrict     7
```
`338 = keyword 266 + granted 72`. `granted 72 = 20109 32(16인격×2축) + 20509 30(15인격×2축) + 10814 2 + 11115 2 + 9282 6(DAWN 3인격×2축)`.

숫자가 다르면 **멈추고 왜 다른지 밝힌다.** 저작이나 빌더 중 하나가 틀렸다는 뜻이다.

- [ ] **Step 6: 제한이 실제로 걸렸는지 눈으로 본다**

```bash
docker exec limbus-postgres psql -U postgres -d limbus -c "
SELECT identity_id, string_agg(axis_id, ' ' ORDER BY axis_id) AS axes
FROM canonical.identity_axis
WHERE identity_id IN ('10109','10415','10916','11109') GROUP BY 1 ORDER BY 1;"
```
Expected:
```
10109  LACERATION
10415  BREATH COMBUSTION LACERATION
10916  COMBUSTION VIBRATION
11109  LACERATION
```
패시브 문장과 정확히 일치해야 한다.

- [ ] **Step 7: 커밋**

```bash
git add src/v2/load-canonical.ts
git commit -m "feat(canonical): 축 부여·제한 적재 배선"
```

---

## Task 6: 검증

**Files:**
- Modify: `src/v2/verify-canonical.ts` (`checks` 배열에 push · `eq` 헬퍼는 22-28행)

- [ ] **Step 1: 검사를 더한다**

`identity_axis` 관련 기존 검사 근처에 넣는다. 기존 `eq(...)` 호출 중 `identity_axis` 총 행수를 재는 것이 있으면 값을 338 로 고친다.

```typescript
	// ── 축 부여·제한 ──────────────────────────────────────────
	eq('axis_grant (저작)', await prisma.axisGrant.count(), 17);
	eq('axis_restrict', await prisma.axisRestrict.count(), 7);
	eq('identity_axis', await prisma.identityAxis.count(), 338);

	// special_status 경로는 없앴다. 남아 있으면 되살아난 것이다
	const ss = await prisma.identityAxis.count({ where: { source: 'special_status' } });
	checks.push({
		name: 'identity_axis 에 special_status 가 없다',
		ok: ss === 0, detail: `${ss} / 0`,
	});

	// 제한 밖의 축이 남으면 안 된다
	const leaked = await prisma.$queryRaw<Array<{ n: bigint }>>`
		SELECT count(*) AS n
		FROM canonical.identity_axis ia
		WHERE EXISTS (SELECT 1 FROM canonical.axis_restrict r WHERE r.identity_id = ia.identity_id)
		  AND NOT EXISTS (
			SELECT 1 FROM canonical.axis_restrict r
			WHERE r.identity_id = ia.identity_id AND r.axis_id = ia.axis_id)
	`;
	checks.push({
		name: '제한 밖의 축이 identity_axis 에 없다',
		ok: Number(leaked[0].n) === 0, detail: `${leaked[0].n} / 0`,
	});

	// 제한 인격 넷의 축이 패시브 문장과 일치한다
	const EXPECTED: Record<string, string[]> = {
		'10109': ['LACERATION'],
		'10415': ['BREATH', 'COMBUSTION', 'LACERATION'],
		'10916': ['COMBUSTION', 'VIBRATION'],
		'11109': ['LACERATION'],
	};
	for (const [identityId, want] of Object.entries(EXPECTED)) {
		const got = (await prisma.identityAxis.findMany({
			where: { identityId }, select: { axisId: true },
		})).map((r) => r.axisId).sort();
		const uniq = [...new Set(got)];
		checks.push({
			name: `제한 인격 ${identityId} 의 축`,
			ok: JSON.stringify(uniq) === JSON.stringify(want),
			detail: `${uniq.join(' ')} / ${want.join(' ')}`,
		});
	}

	// 게이트 어휘
	const badGate = await prisma.identityAxis.count({
		where: { gateKind: { notIn: ['always', 'ego_equipped', 'gift_held', 'roster_count', 'status_held'] } },
	});
	checks.push({ name: 'identity_axis 의 gate_kind 어휘', ok: badGate === 0, detail: `${badGate} / 0` });

	// gate_min 은 roster_count 일 때만 있다
	const badMin = await prisma.$queryRaw<Array<{ n: bigint }>>`
		SELECT count(*) AS n FROM canonical.identity_axis
		WHERE (gate_kind = 'roster_count') <> (gate_min IS NOT NULL)
	`;
	checks.push({ name: 'gate_min 은 roster_count 일 때만', ok: Number(badMin[0].n) === 0, detail: `${badMin[0].n} / 0` });
```

- [ ] **Step 2: 검증을 돌린다**

```bash
npm run v2:verify:canonical 2>&1 | grep -E "실패|axis"
```
Expected: 축 관련 검사가 전부 `OK`. 실패가 있으면 그 자리를 고친다.

- [ ] **Step 3: 표 개수 검사를 맞춘다**

`v2:build` 가 「방금 실행한 DDL 의 선언 수」와 실제 표 개수를 견준다(ADR-08 157-171행). 표가 97 → 98 로 늘었으므로 하드코딩된 기대값이 있으면 고친다.

```bash
grep -rn "97" src/v2/verify-canonical.ts src/v2/build-canonical.ts src/v2/schema-ops.ts 2>/dev/null | head
```

- [ ] **Step 4: 커밋**

```bash
git add src/v2/verify-canonical.ts
git commit -m "test(canonical): 축 제한 검사 — 제한 밖 축 0 · 인격 넷 실측 대조"
```

---

## Task 7: 엔진 — 게이트를 두 단계로 평가한다

**Files:**
- Modify: `lib/engine/v2/load.ts:43-47` (뷰 조회) · `lib/engine/v2/types.ts` (`Capability`)
- Modify: `lib/engine/v2/profile.ts:33-45` (`activeCapabilities`) · `62-75` (생성자)

**Interfaces:**
- Produces:

```typescript
export interface Capability {
	identityId: string; refKind: string; refId: string;
	gateKind: string; gateRef: string; gateMin: number | null;
}
export class Profile {
	constructor(squad: Squad, capabilities: Capability[], heldGiftIds?: string[]);
}
```

- [ ] **Step 1: `Capability` 를 넓히고 뷰 조회를 고친다**

`lib/engine/v2/types.ts` 의 `Capability` 에서 `egoId` 를 지우고 세 칸을 더한다. `lib/engine/v2/load.ts:43-47` 의 raw SQL 을 고친다.

```typescript
			prisma.$queryRaw<Capability[]>`
				SELECT identity_id AS "identityId", ref_kind AS "refKind",
				       ref_id AS "refId", gate_kind AS "gateKind",
				       gate_ref AS "gateRef", gate_min AS "gateMin"
				FROM canonical.v_identity_capability
			`,
```

- [ ] **Step 2: 게이트 평가 테스트를 쓴다**

`lib/engine/v2/profile.test.ts` 에 더한다(없으면 만든다).

```typescript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Profile } from './profile';
import type { Capability, Squad } from './types';

const SQUAD: Squad = {
	roster: [
		{ identityId: 'A', egoIds: ['20509'] },
		{ identityId: 'B', egoIds: [] },
		{ identityId: 'C', egoIds: [] },
	],
	field: ['A', 'B', 'C'],
};

const always = (identityId: string, refKind: string, refId: string): Capability =>
	({ identityId, refKind, refId, gateKind: 'always', gateRef: '', gateMin: null });

test('always 는 언제나 센다', () => {
	const p = new Profile(SQUAD, [always('A', 'axis', 'COMBUSTION')]);
	assert.equal(p.count('axis', 'COMBUSTION', 'field'), 1);
});

test('ego_equipped 는 그 E.G.O 를 낀 인격만 센다', () => {
	const caps: Capability[] = [
		{ identityId: 'A', refKind: 'axis', refId: 'BREATH', gateKind: 'ego_equipped', gateRef: '20509', gateMin: null },
		{ identityId: 'B', refKind: 'axis', refId: 'BREATH', gateKind: 'ego_equipped', gateRef: '20509', gateMin: null },
	];
	const p = new Profile(SQUAD, caps);
	assert.equal(p.count('axis', 'BREATH', 'field'), 1);
});

test('gift_held 는 그 기프트를 보유해야 켜진다', () => {
	const caps: Capability[] = [
		{ identityId: 'A', refKind: 'axis', refId: 'VIBRATION', gateKind: 'gift_held', gateRef: '9282', gateMin: null },
	];
	assert.equal(new Profile(SQUAD, caps).count('axis', 'VIBRATION', 'field'), 0);
	assert.equal(new Profile(SQUAD, caps, ['9282']).count('axis', 'VIBRATION', 'field'), 1);
});

test('roster_count 는 그 소속 인원이 문턱을 넘어야 켜진다', () => {
	// A·B·C 가 전부 DAWN 이면 3명 → 켜진다. 둘뿐이면 안 켜진다
	const dawn3 = [always('A', 'association', 'DAWN'), always('B', 'association', 'DAWN'), always('C', 'association', 'DAWN')];
	const dawn2 = [always('A', 'association', 'DAWN'), always('B', 'association', 'DAWN')];
	const gated: Capability = { identityId: 'A', refKind: 'axis', refId: 'VIBRATION', gateKind: 'roster_count', gateRef: 'DAWN', gateMin: 3 };
	assert.equal(new Profile(SQUAD, [...dawn3, gated]).count('axis', 'VIBRATION', 'field'), 1);
	assert.equal(new Profile(SQUAD, [...dawn2, gated]).count('axis', 'VIBRATION', 'field'), 0);
});

test('status_held 는 전투 중에만 아는 조건이라 세지 않는다', () => {
	const caps: Capability[] = [
		{ identityId: 'A', refKind: 'axis', refId: 'COMBUSTION', gateKind: 'status_held', gateRef: 'HeatRay', gateMin: null },
	];
	assert.equal(new Profile(SQUAD, caps).count('axis', 'COMBUSTION', 'field'), 0);
});
```

- [ ] **Step 3: 테스트가 실패하는지 본다**

```bash
npx tsx --test lib/engine/v2/profile.test.ts
```
Expected: FAIL — `Profile` 이 세 번째 인자를 안 받고 `gateKind` 를 모른다.

- [ ] **Step 4: `activeCapabilities` 를 두 단계로 만든다**

`lib/engine/v2/profile.ts:33-45` 를 바꾼다.

```typescript
/**
 * 게이트를 평가해 살아 있는 능력만 남긴다.
 *
 * **두 단계로 돈다.** `roster_count` 게이트가 「그 소속 인격이 편성에 N명
 * 이상인가」를 묻는데, 그 인원은 조건 없는 능력에서 나온다. 그래서 조건 없는
 * 것을 먼저 세고, 그 수를 근거로 조건부를 판정한다.
 *
 * `status_held` 는 전투 중에만 아는 조건이다. 편성만 보고는 켜졌다고 할 수
 * 없으므로 **세지 않는다** — 다만 「켜질 수 없다」는 뜻은 아니다. 이 값을
 * 근거로 기프트를 죽이지 않도록 소비자가 조심해야 한다.
 */
export function activeCapabilities(
	squad: Squad,
	capabilities: Capability[],
	heldGiftIds: string[] = [],
): Capability[] {
	const inSquad = new Set(squad.roster.map((r) => r.identityId));
	const equipped = new Map<string, Set<string>>();
	for (const r of squad.roster) equipped.set(r.identityId, new Set(r.egoIds));
	const held = new Set(heldGiftIds);

	const unconditional = capabilities.filter(
		(c) => inSquad.has(c.identityId) && c.gateKind === 'always',
	);

	/** 1단계 — 조건 없는 것으로 (refKind, refId) 별 편성 인원을 센다 */
	const tally = new Map<string, Set<string>>();
	for (const c of unconditional) {
		const key = `${c.refKind}\t${c.refId}`;
		const set = tally.get(key);
		if (set === undefined) tally.set(key, new Set([c.identityId]));
		else set.add(c.identityId);
	}
	const rosterCount = (refId: string): number =>
		tally.get(`association\t${refId}`)?.size ?? 0;

	/** 2단계 — 게이트를 판정한다 */
	const open = (c: Capability): boolean => {
		switch (c.gateKind) {
			case 'always': return true;
			case 'ego_equipped': return equipped.get(c.identityId)?.has(c.gateRef) === true;
			case 'gift_held': return held.has(c.gateRef);
			case 'roster_count': return rosterCount(c.gateRef) >= (c.gateMin ?? 1);
			// 전투 중에만 안다. 편성만 보고 켰다고 하지 않는다
			case 'status_held': return false;
			// 모르는 게이트는 켜지 않는다 — 조용히 통과시키면 과대 판정이 된다
			default: return false;
		}
	};

	return capabilities.filter((c) => inSquad.has(c.identityId) && open(c));
}
```

- [ ] **Step 5: 생성자가 보유 기프트를 받게 한다**

`lib/engine/v2/profile.ts:62-65` 를 바꾼다.

```typescript
	constructor(squad: Squad, capabilities: Capability[], heldGiftIds: string[] = []) {
		// … 기존 초기화 …
		const active = activeCapabilities(squad, capabilities, heldGiftIds);
```

- [ ] **Step 6: 테스트가 통과하는지 본다**

```bash
npx tsx --test lib/engine/v2/profile.test.ts
npm test 2>&1 | tail -20
npm run typecheck
npm run build
```
Expected: 다섯 테스트 PASS. `npm test` 전체 통과. `build` 통과.

`lib/queries/canonical/recommend.ts` 가 `new Profile(...)` 을 부르는 자리에 보유 기프트를 넘긴다. 그 파일이 이미 보유 기프트 목록을 갖고 있다(`chain({ heldGiftIds, … })` 에 넘기는 값과 같은 것). 없으면 세 번째 인자를 비워 두고, **왜 비웠는지 주석으로 남긴다.**

- [ ] **Step 7: 커밋**

```bash
git add lib/engine/v2/types.ts lib/engine/v2/load.ts lib/engine/v2/profile.ts lib/engine/v2/profile.test.ts lib/queries/canonical/recommend.ts
git commit -m "feat(engine): 게이트 2단계 평가 — 장착 · 보유 · 편성 인원"
```

---

## Task 8: 골든과 회귀 폭

**Files:**
- Create: `lib/engine/v2/axis-grant-golden.test.ts`
- Create: `scripts/axis-diff.ts`
- Modify: `src/v2/canonical/axis-golden.test.ts` (실측 숫자)
- Modify: `lib/engine/v2/golden.test.ts` (실측 등급 숫자)

- [ ] **Step 1: 골든 테스트를 쓴다**

```typescript
/**
 * 축 제한·부여 골든 — 적재된 `canonical` 로 실제 편성을 판정한다.
 *
 * 사용자가 지적한 오판정이 이 자리에서 났다. 9073 엔도르핀 키트는 「스킬
 * 효과로 호흡 위력을 획득할 때마다」 켜지는데, 화상·진동 덱의 유일한 호흡
 * 공급원인 10916 은 패시브 1091603 이 「화상, 진동을 부여하는 인격으로만
 * 취급됨」이라 못 박는다. 호흡을 얻지만 호흡 인격이 아니다.
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

const IDS_A = ['10216', '11216', '11009', '10916', '10716', '10512'];
const DECK_A: Squad = { roster: IDS_A.map((identityId) => ({ identityId, egoIds: [] })), field: IDS_A };

const data = DB.skip === false ? await loadEngineData(prisma) : null;

test('덱 A — 10916 은 호흡 인격이 아니다 (패시브 1091603 이 제한한다)', DB, () => {
	const p = new Profile(DECK_A, data!.capabilities);
	assert.equal(p.count('axis', 'BREATH', 'field'), 0);
	// 제한이 남긴 두 축은 그대로 있어야 한다
	assert.ok(p.count('axis', 'COMBUSTION', 'field') > 0);
	assert.ok(p.count('axis', 'VIBRATION', 'field') > 0);
});

test('덱 A — 9073 엔도르핀 키트가 죽는다', DB, () => {
	const verdicts = evaluateGifts({
		squad: DECK_A, profile: new Profile(DECK_A, data!.capabilities),
		giftTriggers: data!.giftTriggers, refsByTrigger: data!.refsByTrigger, params: data!.params,
	});
	const v = verdicts.find((x) => x.giftId === '9073');
	assert.equal(v?.fireable, false);
});

test('덱 C — 착영휘도(20509)를 끼면 호흡·출혈이 생긴다', DB, () => {
	// 뫼르소 10512 는 20509 를 낄 수 있다(같은 수감자). 제한 패시브가 없다
	const bare: Squad = { roster: [{ identityId: '10512', egoIds: [] }], field: ['10512'] };
	const worn: Squad = { roster: [{ identityId: '10512', egoIds: ['20509'] }], field: ['10512'] };
	const b = new Profile(bare, data!.capabilities).count('axis', 'BREATH', 'field');
	const w = new Profile(worn, data!.capabilities).count('axis', 'BREATH', 'field');
	assert.equal(b, 0);
	assert.equal(w, 1);
});

test('제한 인격 넷의 축이 패시브 문장과 일치한다', DB, async () => {
	const want: Record<string, string[]> = {
		'10109': ['LACERATION'],
		'10415': ['BREATH', 'COMBUSTION', 'LACERATION'],
		'10916': ['COMBUSTION', 'VIBRATION'],
		'11109': ['LACERATION'],
	};
	for (const [id, axes] of Object.entries(want)) {
		const rows = await prisma.identityAxis.findMany({
			where: { identityId: id }, select: { axisId: true },
		});
		assert.deepEqual([...new Set(rows.map((r) => r.axisId))].sort(), axes, id);
	}
});
```

- [ ] **Step 2: 되돌려 실패를 확인한다**

골든이 자기가 존재하는 이유인 버그를 못 잡은 전례가 있다. **반드시 확인한다.**

```bash
npx tsx --test lib/engine/v2/axis-grant-golden.test.ts
```
Expected: 전부 PASS.

그 다음 `src/v2/canonical/identity-axis.ts` 의 `applyRestrict(fromKeyword, input.restrict)` 를 잠시 `fromKeyword` 로 되돌리고 `npm run v2:canonical` 을 다시 돌린 뒤 같은 테스트를 돌린다.
Expected: **「덱 A — 9073 이 죽는다」와 「제한 인격 넷」이 실패해야 한다.** 실패하지 않으면 골든이 아무것도 안 지키고 있는 것이다 — 멈추고 원인을 밝힌다.

확인 뒤 코드를 되돌리고 `npm run v2:canonical` 을 다시 돌린다.

- [ ] **Step 3: 회귀 폭을 잰다**

`scripts/axis-diff.ts` 를 만든다. 옛 판과 새 판의 기프트 판정을 나란히 낸다.

```typescript
/**
 * 축 제한이 기프트 판정을 몇 건 바꾸는가.
 *
 * 조사만 한다. 수를 보고 스펙의 기대(과대 34짝 제거)와 맞는지 본다.
 */
import { PrismaClient } from '../src/v2/generated/client.js';
import { loadEngineData } from '../lib/engine/v2/load.js';
import { Profile } from '../lib/engine/v2/profile.js';
import { evaluateGifts } from '../lib/engine/v2/evaluate.js';
import type { Squad } from '../lib/engine/v2/types.js';

const prisma = new PrismaClient();
const data = await loadEngineData(prisma);
const IDS = ['10216', '11216', '11009', '10916', '10716', '10512'];
const squad: Squad = { roster: IDS.map((identityId) => ({ identityId, egoIds: [] })), field: IDS };

const verdicts = evaluateGifts({
	squad, profile: new Profile(squad, data.capabilities),
	giftTriggers: data.giftTriggers, refsByTrigger: data.refsByTrigger, params: data.params,
});
const n = { A: 0, B: 0, C: 0 };
for (const v of verdicts) n[v.grade] += 1;
console.log(`등급 A ${n.A} · B ${n.B} · C ${n.C}`);
console.log(`발동 가능 ${verdicts.filter((v) => v.fireable).length} / ${verdicts.length}`);

const axes = await prisma.$queryRaw<Array<{ source: string; n: bigint }>>`
	SELECT source, count(*) AS n FROM canonical.identity_axis GROUP BY 1 ORDER BY 1
`;
for (const a of axes) console.log(`identity_axis ${a.source} ${a.n}`);

await prisma.$disconnect();
process.exit(0);
```

```bash
npx tsx --env-file-if-exists=.env scripts/axis-diff.ts
```
결과를 커밋 메시지에 적는다.

- [ ] **Step 4: 기존 골든의 실측 숫자를 맞춘다**

`lib/engine/v2/golden.test.ts:137` 의 `assert.deepEqual(n, { A: 146, B: 219, C: 86 })` 와 `:148-149` 의 `93` · `50` 이 바뀐다. Step 3 의 실제 값으로 고치고, **왜 바뀌었는지 주석으로 남긴다.**

`src/v2/canonical/axis-golden.test.ts` 도 `identity_axis` 를 직접 조회하므로 숫자를 맞춘다.

- [ ] **Step 5: 전체 검사**

```bash
npm test 2>&1 | tail -20
npm run typecheck
npm run build
npm run v2:verify:canonical 2>&1 | grep -c 실패
```
Expected: 전부 통과. 실패 0.

- [ ] **Step 6: 커밋**

```bash
git add lib/engine/v2/axis-grant-golden.test.ts lib/engine/v2/golden.test.ts src/v2/canonical/axis-golden.test.ts scripts/axis-diff.ts
git commit -m "test(engine): 축 제한 골든 — 9073 이 화상·진동 덱에서 죽는다"
```

---

## Task 9: 폐기 표시와 문서

**Files:**
- Modify: `prisma/v2/schema.prisma` (`EgoGrantedAxis` 2036-2044행)
- Modify: `src/v2/seed-authored.ts` (`EGO_GRANTED_AXIS` 31-36행)
- Modify: `docs/adr/08-authored-facts-as-data.md`
- Modify: `README.md`
- Modify: `src/v2/canonical/identity-axis.ts` (결손 기록)

- [ ] **Step 1: `EgoGrantedAxis` 에 폐기 주석을 붙인다**

지우지 않는다. 모델 위 `///` 주석을 이렇게 바꾼다.

```prisma
/// **폐기됨 (2026-08-10)** — `app.axis_grant` 가 대신한다.
///
/// E.G.O 장착이 축을 주는 경우만 담았다. 같은 일을 하는 다른 출처(제한 패시브
/// 넷 · 조건부 패시브 둘 · 기프트 9282)를 담을 자리가 없었고, 「빼기」가 아예
/// 없어 게임의 「…으로만 취급됨」을 표현하지 못했다.
///
/// 행은 남긴다 — 출처가 말한 사실을 지우지 않는다. 빌더만 읽지 않는다.
model EgoGrantedAxis { … }
```

`seed-authored.ts` 의 `EGO_GRANTED_AXIS` 상수 위에도 같은 뜻의 주석을 한 줄 남긴다.

- [ ] **Step 2: 빌더 경계 테스트를 더한다**

폐기 표를 다시 읽지 못하게 한다. `src/v2/canonical/axis-grant.test.ts` 에 더한다.

```typescript
import { readFileSync } from 'node:fs';

test('빌더는 폐기된 ego_granted_axis 를 읽지 않는다', () => {
	for (const f of ['src/v2/canonical/identity-axis.ts', 'src/v2/canonical/axis-grant.ts']) {
		const src = readFileSync(f, 'utf8');
		assert.equal(src.includes('egoGranted'), false, `${f} 가 egoGranted 를 다시 읽고 있다`);
	}
});
```

`src/v2/authored.ts` 는 예외다 — `readAuthored` 가 표를 계속 읽어 지문에 남긴다. 빌더만 안 쓴다.

- [ ] **Step 3: 결손을 기록한다**

`identity-axis.ts` 의 `buildIdentityAxis` 끝에 넣는다. 「없다는 것조차 기록하지 않은 것」이 이번 결함의 뿌리였다.

```typescript
	// 우리가 다루지 못하는 것을 적어 둔다. 없다는 사실을 안 적으면 다음에
	// 같은 자리에서 또 넘어간다
	meta.gap('identity_axis', '*', 'special_status',
		'특수 상태로 축을 유도하면 게임의 「…으로만 취급됨」이 무너진다. keyword 가 ' +
		'이미 제한을 반영하므로 이 경로를 쓰지 않는다 (과대 34짝 · 보탬 0, 2026-08-10 실측)',
		EVIDENCE);
	meta.gap('passive', '*', 'effect',
		'패시브 효과를 상태와 잇는 구조화된 표가 없다. passive 는 id·conditions[]·cond_type ' +
		'뿐이고 효과는 passive_text 산문에만 있다. 축 부여·제한 출처 9건만 저작으로 건졌다',
		EVIDENCE);
	meta.gap('gift', '9280', 'association_grant',
		'소속 자체를 바꾸는 효과를 담을 자리가 없다 — 「S사 소속 인격 1인을 검계 소속으로 취급」',
		EVIDENCE);
	meta.gap('gift', '9841', 'association_grant',
		'소속 자체를 바꾸는 효과를 담을 자리가 없다 — 「W사 소속이 아닌 인격 1인을 W사 소속으로 취급」',
		EVIDENCE);
	for (const id of ['1021504', '1061404']) {
		meta.gap('passive', id, 'skill_kind_grant',
			'스킬 분류를 바꾸는 효과를 담을 자리가 없다 — 「기본 공격 스킬과 합 가능 반격 스킬이 ' +
			'충전 횟수를 얻는 스킬로 취급됨」', EVIDENCE);
	}
```

- [ ] **Step 4: ADR-08 에 저작 표를 더한 사실을 적는다**

`docs/adr/08-authored-facts-as-data.md` 의 이관 목록(59-64행 부근)에 한 줄 더한다.

```markdown
- `app.axis_grant`(17행) — 축 부여·제한. 「이 인격은 …으로만 취급됨」은 게임이
  정한 사실이므로 데이터다. `app.ego_granted_axis`(4행)를 흡수했다.
```

- [ ] **Step 5: README 의 로드맵과 표 개수를 갱신한다**

`canonical` 표가 97 → 98 로 늘었다. README 에 그 수를 적은 자리가 있으면 고친다.

```bash
grep -n "97" README.md docs/adr/*.md | head
```

- [ ] **Step 6: 전체 검사**

```bash
npm test 2>&1 | tail -20
npm run typecheck
npm run build
npm run v2:canonical 2>&1 | tail -5
npm run v2:verify:canonical 2>&1 | grep -c 실패
npm run v2:gap-report 2>&1 | tail -20
```
Expected: 전부 통과. 결손 보고에 새 항목 여섯이 보인다.

- [ ] **Step 7: 커밋**

```bash
git add -A
git commit -m "docs: ego_granted_axis 폐기 표시 · 다루지 못한 것을 결손으로 기록"
```

---

## 자체 검토

**1. 스펙 커버리지**

| 스펙 절 | 태스크 |
|---|---|
| §3 `app.axis_grant` | Task 1 Step 1 · Task 2 |
| §3 `canonical.axis_restrict` | Task 1 Step 2 · Task 3 |
| §3 `identity_axis` 변경 (`special_status` 제거 · `affects` · `gate_ref`) | Task 1 Step 3 · Task 4 |
| §3 공급 규칙 (tag) | Task 4 · Task 7 |
| §3 공급 규칙 (skill) | **이번 PR 밖.** `axis_restrict` 와 `affects='skill'` 행은 적재하되 소비자가 없다. 기프트 능력 스펙이 쓴다 |
| §3 게이트 다섯 | Task 7 Step 4 |
| §4 저작 17행 | Task 2 Step 1 |
| §5 검수 도구 | **뺐다.** 17행이라 `seed-authored.ts` 의 `note` 를 읽는 것으로 충분하다. 별도 스크립트는 YAGNI |
| §6 폐기 표시 | Task 9 Step 1-2 |
| §7 결손 기록 | Task 9 Step 3 |
| §8 적재 검증 | Task 6 |
| §8 골든 (덱 A · 덱 C) | Task 8 Step 1-2 |
| §8 회귀 폭 측정 | Task 8 Step 3 |

**2. 자리표시자** — 없다. 모든 코드 단계에 실제 코드가 있다. Task 5 Step 2 의 `identityAssociation` 필드명만 확인이 필요한데, 확인 방법과 대처를 함께 적었다.

**3. 타입 일관성**

- `AxisGrantRow` — Task 2 에서 `src/v2/authored.ts` 에 정의, Task 3 이 import.
- `GrantedAxisRow` · `AxisRestrictRow` · `applyRestrict` · `expand` — Task 3 에서 정의, Task 4 가 import.
- `IdentityAxisRow` 의 칸이 Prisma `IdentityAxis`(Task 1 Step 3)와 일치한다: `identityId · axisId · source · affects · gateKind · gateRef · gateMin`.
- `Capability` 의 칸이 뷰(Task 1 Step 4)와 일치한다: `identityId · refKind · refId · gateKind · gateRef · gateMin`.
- `Profile` 생성자 세 번째 인자 `heldGiftIds?: string[]` — Task 7 에서 정의, Task 8 골든은 두 인자만 쓴다(기본값 `[]`).

**4. 남는 것**

`§3 skill 공급` 은 이 PR 이 데이터만 깔고 소비자를 만들지 않는다. `affects='skill'` 행 넷(1081402 · 1111502)과 `axis_restrict` 의 `skill` 쪽은 기프트 능력 PR 이 쓴다. 그 사실을 Task 9 Step 3 의 결손이 아니라 **스펙 §2 비목표**가 이미 적고 있다.
