# 덱 특성 판정 정밀화 구현 계획 (엔진)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `06-recommendation-engine.md` 10절이 적어둔 근사 셋을 **설명문이 근거를 주는 범위 안에서** 걷어낸다 — 상태 기믹 축 부재, 소속 조건의 판정 범위, 소속 조건의 인원수. 근거가 없는 곳은 근사를 유지하며, **남는 쪽이 걷어내는 쪽보다 많다**(근거 절).

**Architecture:** 엔진의 **공개 시그니처와 반환 타입을 바꾸지 않는다.** 어휘 사전(`vocab.ts`)이 상태 id 를 축으로 접고(공급) 발동 토큰을 조건으로 옮기며(수요) 기프트 설명문에서 인원수와 판정 범위를 읽는다. 조건 평가(`dsl.ts`)가 그 범위를 그대로 쓴다. `StatusKey` 에 항목을 더하고 `Condition` 에 **선택** 필드를 더하는 방식이라 기존 코드가 깨지지 않는다.

**Tech Stack:** TypeScript · Prisma · `node:test` (러너는 `tsx --test`) · 기존 `src/engine-proof.ts` 골든 회귀

## Global Constraints

- Node **>=22.9** (`package.json` engines).
- **공개 시그니처를 바꾸지 않는다.** `rankPacks` · `scorePack` · `scoreState` · `marginalValue` · `contextOf` · `deckFeature` · `evaluate` · `activation` 의 인자와 반환 타입은 불변이다. `StatusKey` 에 항목을 더하는 것은 가산이라 허용된다. **`Condition` 에 더하는 필드는 선택 필드로 둔다** — `evaluate` 의 인자 타입이 `Condition` 이므로 필수 필드를 더하면 그 시그니처가 좁아진다.
- **웹 브랜치의 파일을 건드리지 않는다** — `app/**` · `components/**` · `lib/queries/**` · `lib/storage/**`. 유일한 예외는 `lib/queries/recommend.ts` 의 호출 한 줄이며, 이 계획에서는 손대지 않는다(`docs/07-recommendation-system.md` 9.1).
- **점수가 UI 언어에 따라 달라지지 않는다.** 조건 정밀화가 한국어 설명문을 읽으므로, 정밀화용 텍스트는 요청 로케일과 무관하게 항상 `ko` 를 쓴다(Task 4).
- **`src/engine-golden.json` 갱신은 의도된 변경이다.** 점수가 바뀌므로 기준선도 바뀐다. 다만 **무엇이 왜 바뀌었는지 커밋에 적는다.**
- **지어내지 않는다.** 설명문에 근거가 없는 조건은 근사를 유지하고, 근사임을 코드 주석과 문서에 남긴다.
- 커밋 제목은 Conventional Commits, 한국어 명사구, 마침표 없음.
- 새 npm 의존성을 추가하지 않는다.

## 근거 — 실측

기프트 설명문(한국어, `enhanceLevel=0`)에서 **소속 인원 조건을 말하는 것이 18건**이다. 설명문이 인원수와 판정 범위를 둘 다 말한다.

| 판정 범위 | 필요 인원 | 건수 |
| --- | ---: | ---: |
| 출전 (`출격 인원을 기준으로 함` · `대기 인원 제외`) | 2 | 3 |
| 출전 | 3 | 9 |
| 출전 | 4 | 1 |
| 편성 (`편성 인원을 기준으로 함` · `대기 인원 포함`) | 3 | 2 |
| 표지 없음 | 3 | 2 |
| 표지 없음 | 4 | 1 |
| **합계** | | **18** |

**지금 엔진은 전부 `atLeast: 3` 에 `max(편성, 출전)` 이다.** 인원수는 18건 중 4건에서 틀렸고, 판정 범위는 15건에서 확정할 수 있는데 버리고 있다.

### 이 18건이 전부가 아니다

**엔진이 `COUNT_AFFILIATION` 을 만드는 대상은 훨씬 넓다.** `{소속} Identities` 발동 토큰을 가진 기프트가 **74종 · 토큰 78건**이고, 그 전부에 `atLeast: 3` 이 붙는다. 위의 18건은 그중 **설명문이 조건을 말해주는 것**일 뿐이다.

| | 기프트 | 토큰 |
| --- | ---: | ---: |
| `COUNT_AFFILIATION` 이 만들어지는 것 | 74 | 78 |
| 설명문이 소속 인원 조건을 말하는 것 | 18 | 19 |
| 그중 판정 범위 표지가 있는 것 | 15 | 16 |

**나머지 56종은 이 계획 뒤에도 `atLeast: 3` · `max()` 로 남는다.** 근사가 남는 쪽이 걷어내는 쪽보다 훨씬 크며, 문서에 그렇게 적는다.

남는 56종의 대부분은 애초에 임계값 조건이 아니다. `자신을 제외한 다른 세븐 협회 소속 인격 수/2`(9194) · `동일한 소속 인격 수만큼 … (최대 4)`(9420) 처럼 **인원에 비례하는 효과**이며, 임계값 모델 자체가 맞지 않는다. 이것은 이 계획이 걷어내는 근사보다 크고, Task 5 에서 `06` 10절 근사표에 새 항목으로 적는다.

### 설명문은 절 단위로 읽어야 한다

**설명문 전체에 정규식을 걸면 다른 절의 숫자를 소속 조건의 인원수로 읽는다.** 실측으로 확인한 오탐이다.

| 기프트 | 설명문에 있는 문구 | 전체를 훑으면 | 실제 |
| --- | --- | --- | --- |
| 9216 리우 협회 | `화상 … 부여하는 공격 스킬을 보유한 인격이 5인 이상 … (대기 인원 제외)` | 소속 5인 · 출전 | **상태 공급 조건이다.** 소속 조건에는 인원수가 없다 |
| 9730 유로디비 | `진동 … 스킬을 보유한 인격이 5인 이상` | 소속 5인 | 같음 |
| 9740 멀티크랙 | `충전 … 스킬을 보유한 인격이 5인 이상` | 소속 5인 | 같음 |
| 9795 혈귀 | `혈찬을 소모하는 스킬을 보유한 인격이 3인 이상` | 소속 3인 | 같음 |
| 9216 · 9253 | `동일한 소속 인격을 편성한 수당 … (대기 인원 포함)` | 편성 기준 | **인원 비례 효과의 단서**다. 임계값의 판정 범위가 아니다 |

그래서 **`소속` 과 `N인 이상` 이 같은 줄에 있는 절에서만** 인원수와 판정 범위를 읽는다. 그 규칙으로 재면 위 표의 18건이 정확히 재현되고 오탐 다섯이 전부 걸러진다.

재현:

```sql
with clause as (
  select k."giftId", k.token,
         (select l from unnest(string_to_array(t."desc", E'\n')) as l
          where l like '%소속%' and l ~ '[0-9]+인 이상' limit 1) as line
  from gift_token k
  join gift_text t on t."giftId" = k."giftId" and t.locale = 'ko' and t."enhanceLevel" = 0
  where k.kind = 'trigger' and k.token like '% Identities'
)
select
  case when line is null then '조건 문구 없음'
       when line ~ '출격 인원을 기준|대기 인원 제외' then '출전'
       when line ~ '편성 인원을 기준|대기 인원 포함' then '편성'
       else '표지 없음' end as scope,
  coalesce(substring(line from '([0-9]+)인 이상'), '—') as need,
  count(distinct "giftId") as gifts, count(*) as tokens
from clause group by 1, 2 order by 1, 2;
```

`desc` 는 예약어라 **반드시 따옴표로 감싼다**(`t."desc"`). 감싸지 않으면 구문 오류다.

상태 기믹은 `docs/backlog/04-status-mechanics.md` 가 전수 확인해뒀다 — 기프트 발동 토큰 150종이 참조하는 기믹 중 **분류 밖이 탄환·보호 둘뿐**이다.

## 파일 구조

| 파일 | 변경 |
| --- | --- |
| `lib/engine/vocab.ts` | `StatusKey` 에 `ammo`·`protection` 추가 · `STATUS_MATCH`·`statusKeyOf` 이관 · 탄환·보호 토큰을 조건으로 매핑 · 설명문 정밀화 함수 |
| `lib/engine/vocab.test.ts` | 신규 — 설명문 파싱과 토큰 매핑 단위 테스트 |
| `lib/engine/dsl.ts` | `COUNT_AFFILIATION` 이 범위를 그대로 씀 |
| `lib/engine/dsl.test.ts` | 신규 — 판정 범위 평가 테스트 |
| `lib/engine/load.ts` | `statusKeyOf` 를 `vocab` 에서 가져다 씀 · 조건 정밀화에 한국어 설명문을 넘김 |
| `src/engine-golden.json` | 갱신 (의도된 변경) |
| `package.json` | `test` 스크립트 추가 |
| `.github/workflows/ci.yml` | 테스트 단계 추가 |

`lib/engine/state.ts` 는 건드리지 않는다. `EvalContext.affiliation` 이 이미 `deck`·`deployed` 를 따로 담고 있어 판정 범위는 `dsl.ts` 안에서 갈린다.

**`STATUS_MATCH` 와 `statusKeyOf` 를 `load.ts` 에서 `vocab.ts` 로 옮긴다.** 상태 id 를 축으로 접는 것은 저작이지 적재가 아니고(`vocab.ts` 가 저작층이다), `load.ts` 는 `@/lib/db` 를 통해 `PrismaClient` 를 인스턴스화하므로 거기 있는 한 **단위 테스트가 데이터베이스 연결 설정을 요구한다.** `vocab.ts` 는 `./tuning` 만 의존해 그 문제가 없다.

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

**웹 브랜치(`feat/recommendation-system`)도 같은 배선을 한다.** `package.json` 의 같은 자리와 `ci.yml` 의 같은 단계라 그대로 두면 충돌한다. 먼저 올라가는 쪽이 배선을 가져가고 나중 쪽은 리베이스해 이 Task 를 건너뛴다 — 어느 쪽이 먼저인지는 착수 시점에 확인한다.

- [ ] **Step 1: 실제 소속 id 를 확인한다**

테스트에 쓸 값을 먼저 확보한다. `identity_affiliation.affiliationId` 는 **영문 원문**이며 한국어 이름이 아니다.

```bash
npm run db:up
docker compose exec -T postgres psql -U postgres -d limbus -tAF'|' -c \
  "select a.id, at.name from affiliation a join affiliation_text at on at.\"affiliationId\"=a.id and at.locale='ko' where at.name in ('새벽 사무소','엄지','약지','중지','피쿼드호','검계') order by 1"
```

`Dawn Office` · `The Thumb` 같은 값이 나온다. 짐작하지 말고 나온 값을 그대로 쓴다.

- [ ] **Step 2: 실패하는 테스트를 쓴다**

`lib/engine/vocab.test.ts` — `AFFILIATIONS` 는 Step 1 에서 확인한 값으로 채운다.

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mapTrigger } from './vocab';

// Step 1 에서 확인한 실제 affiliationId. 한국어 이름도 kebab-case 도 아니다.
const AFFILIATIONS = new Set(['Dawn Office', 'The Thumb']);

test('소속 토큰이 조건이 된다', () => {
	const c = mapTrigger('Dawn Office Identities', AFFILIATIONS);
	assert.equal(c?.op, 'COUNT_AFFILIATION');
});

test('소속 목록에 없는 토큰은 조건이 아니다', () => {
	assert.equal(mapTrigger('Nonexistent Identities', AFFILIATIONS), null);
});
```

- [ ] **Step 3: 통과를 확인한다**

Run: `npx tsx --test "lib/engine/vocab.test.ts"`
Expected: PASS — tests 2 / pass 2. 실패하면 Step 1 의 id 를 다시 본다.

- [ ] **Step 4: npm script 와 CI 를 잇는다**

`package.json` scripts 에 `typecheck` 바로 아래로 추가:

```json
"test": "tsx --env-file-if-exists=.env --test \"lib/**/*.test.ts\"",
```

`--env-file-if-exists` 를 붙이는 이유는 다른 `tsx` 스크립트와 같다(커밋 16776cd). 이 계획의 테스트는 데이터베이스에 접속하지 않지만, `lib/**` 아래 테스트가 `lib/db` 를 물고 오는 순간 `PrismaClient` 생성자가 `DATABASE_URL` 을 요구한다. 붙여두면 로컬에서 환경 변수를 손으로 넣지 않아도 된다.

`.github/workflows/ci.yml` 의 `타입 검사` 단계 **앞**에 삽입한다. `Prisma Client 생성` 뒤여야 한다 — 생성된 타입 없이는 `lib/**` 임포트가 풀리지 않는다.

```yaml
      # 어휘 사전의 토큰 매핑·설명문 파싱 단위 테스트. 데이터베이스에 접속하지 않는다.
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
- Modify: `lib/engine/vocab.ts` (`StatusKey` · `STATUS_MATCH` · `statusKeyOf` · `STATUS_OF` · `mapTrigger`)
- Modify: `lib/engine/load.ts` (`statusKeyOf` 를 `vocab` 에서 가져다 씀)
- Create: `lib/engine/vocab.test.ts` 에 이어 붙임

**Interfaces:**
- Consumes: 없음
- Produces: `StatusKey` 에 `'ammo'` · `'protection'` 추가. `statusKeyOf` 가 `vocab` 에서 export 되고 두 축을 인식. `Ammo Skill Used` 등이 상황성이 아니라 공급 조건이 된다

`docs/backlog/04-status-mechanics.md` 가 전수 확인한 결과 분류 밖은 이 둘뿐이다. **키워드와 성격이 달라 별개 축(특수)으로 둔다** — 키워드는 기프트 분류이고, 상태 기믹은 인격이 공급하고 기프트가 조건으로 참조하는 자원이다.

**축을 더하는 것만으로는 근사가 걷히지 않는다.** `STATUS_MATCH` 는 인격이 축을 **공급**하게 할 뿐이고, 그 축을 **묻는** 조건이 없으면 `statusSupply` 에 숫자만 쌓이고 활성도는 그대로다. `backlog/04` 7절이 고치는 법을 다섯으로 적었는데 그중 3번이 그것이다.

> 3. `Ammo Skill Used` · `Allies with Shield` 등을 `SKILL_SUPPLIES` 로 옮긴다.

공급(Step 4)과 수요(Step 5)를 한 Task 로 묶는 이유가 이것이다. 하나만 하면 점수가 움직이지 않는다.

- [ ] **Step 1: 상태 id 와 공급 인원을 확인한다**

축을 문자열 매칭으로 잡으므로 **실제 id 를 봐야 정규식을 쓸 수 있다.** 짐작하지 않는다.

```bash
npm run db:up
docker compose exec -T postgres psql -U postgres -d limbus -tAF'|' -c \
  "select i.\"statusId\", count(distinct i.\"identityId\")
   from identity_status i where i.\"statusId\" ~* 'ammo|bullet|reload|protect|shield|barrier|guard'
   group by 1 order by 2 desc"
```

2026-07-25 스냅샷 기준 결과다. **어디까지 한 자원으로 볼지가 이 Task 의 유일한 판단이며, 폭에 따라 공급 인원이 크게 갈린다.**

| 상태 id | 인격 | 비고 |
| --- | ---: | --- |
| `Bullet` | 13 | 탄환 본체. `backlog/04` 3절이 센 13명이 이것이다 |
| `FullReload` · `ReloadLament` · `BulletLament` · `AccelBullet` · `BulletGodok` · `BulletPropellant*` · `MeursaultSporeBullet*` · `LCA_Bullet` · `Bullet_LogicAtelier` · `FireBulletPropellant` · `FellBulletPersonality` | 각 1~5 | 파생. **합쳐도 인격은 14명**(늘어나는 것은 `FellBulletPersonality` 만 가진 10113 하나) |
| `Protection` | 15 | 보호 본체. `backlog/04` 4절이 센 15명이 이것이다 |
| `BurstProtection` | 2 | 파열 보호. `backlog/04` 가 따로 센 2명 |
| `SupportProtect` 7 · `HeishouSupportProtect` 1 · `ProtectStanceRyoshu` 1 · `ProtectiveSword` 1 | | 파생. 전부 합치면 인격 **22명** |
| `CanDuelGuard` | 19 | **보호가 아니다.** 결투 기믹이며 `guard` 를 정규식에 넣으면 딸려 온다 |

`backlog/04` 7.2 가 남긴 미결(*"호표탄이 탄환과 같은 자원인지, 파열 보호가 보호와 같은지"*)이 바로 이 표다. **본체만 잡는 것으로 시작한다** — `backlog/04` 가 센 수와 일치하고, 파생을 넣을 근거가 아직 없기 때문이다. 넓힐 근거가 생기면 그때 넓히고 기준선을 다시 잰다.

- [ ] **Step 2: 정규식 충돌을 확인한다**

`STATUS_MATCH` 는 **선착순**이다(`for … if (re.test(id)) return key`). 새 줄을 끝에 붙이면 앞 규칙이 이긴다.

```
'BurstProtection' → ['rupture', /burst|rupture/i] 가 먼저 잡는다 → 'rupture'
```

파열 보호 2명이 보호로 들어오지 않고 파열 공급자로 계산된다. **본체만 잡기로 했으므로 이 계획에서는 `BurstProtection` 을 축에 넣지 않으며, 따라서 이 충돌은 발생하지 않는다.** 나중에 파생까지 넓힐 때 반드시 다시 걸리는 지점이므로 코드 주석으로 남긴다.

- [ ] **Step 3: 실패하는 테스트를 쓴다**

`lib/engine/vocab.test.ts` 에 이어 붙인다. Step 1 에서 확인한 **실제 id** 를 쓴다.

```ts
import { statusKeyOf } from './vocab';

test('기존 축은 그대로 잡힌다', () => {
	assert.equal(statusKeyOf('Combustion'), 'burn');
	assert.equal(statusKeyOf('Laceration'), 'bleed');
	assert.equal(statusKeyOf('Breath'), 'poise');
});

test('탄환과 보호를 잡는다', () => {
	assert.equal(statusKeyOf('Bullet'), 'ammo');
	assert.equal(statusKeyOf('Protection'), 'protection');
});

test('본체가 아닌 것은 아직 축이 아니다', () => {
	// 파생을 어디까지 셀지는 미결이다(backlog/04 7.2). 넓히면 이 테스트가 먼저 깨진다.
	assert.equal(statusKeyOf('SupportProtect'), null);
	assert.equal(statusKeyOf('FellBulletPersonality'), null);
	// 결투 기믹이지 보호가 아니다
	assert.equal(statusKeyOf('CanDuelGuard'), null);
});

test('축에 없는 상태는 null', () => {
	assert.equal(statusKeyOf('Paralysis'), null);
});

test('탄환 조건이 상황성이 아니라 공급으로 잡힌다', () => {
	assert.deepEqual(mapTrigger('Ammo Skill Used', AFFILIATIONS), {
		op: 'SKILL_SUPPLIES',
		status: 'ammo',
	});
	assert.deepEqual(mapTrigger('Allies have Ammo Skill', AFFILIATIONS), {
		op: 'SKILL_SUPPLIES',
		status: 'ammo',
	});
});

test('아군 보호는 공급으로, 적 보호는 상황성으로 남는다', () => {
	assert.deepEqual(mapTrigger('Allies with Shield', AFFILIATIONS), {
		op: 'HAS_STATUS',
		status: 'protection',
		side: 'ally',
	});
	// 적이 보호를 갖는 것은 우리 덱 구성으로 판정할 수 없다
	assert.equal(mapTrigger('Enemies with Shield', AFFILIATIONS)?.op, 'SITUATIONAL');
	// 방어 스킬은 상태 기믹이 아니다(backlog/04 2절이 별도 분류로 뒀다)
	assert.equal(mapTrigger('Guard Skill Used', AFFILIATIONS)?.op, 'SITUATIONAL');
});
```

- [ ] **Step 4: 실패를 확인한다**

Run: `npx tsx --test "lib/engine/vocab.test.ts"`
Expected: FAIL — `statusKeyOf` 가 `vocab` 에 없다

- [ ] **Step 5: 공급 쪽을 구현한다**

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

`STATUS_MATCH` 와 `statusKeyOf` 를 `load.ts` 에서 **`vocab.ts` 로 옮기고** 두 줄을 더한다. 정규식은 **Step 1 에서 확인한 실제 id 로** 쓴다.

```ts
/**
 * 상태 id 는 1,472종이라 키워드 축으로 접는다. 이름이 아니라 id 로 판정한다(02-data-model 3.10).
 *
 * **선착순이다.** 위에 있는 규칙이 이긴다. 파생 상태를 나중에 넓힐 때 `BurstProtection` 이
 * `rupture` 의 `/burst/` 에 먼저 잡히므로, 넓히려면 순서부터 정해야 한다(backlog/04 7.2).
 */
const STATUS_MATCH: Array<[StatusKey, RegExp]> = [
	['burn', /combustion|(^|[^a-z])burn/i],
	['bleed', /laceration|bleed/i],
	['tremor', /vibration|tremor/i],
	['rupture', /burst|rupture/i],
	['sinking', /sinking/i],
	['poise', /breath|poise/i],
	['charge', /charge/i],
	['bloodfeast', /bloodfeast/i],
	// 상태 기믹. 키워드가 아니라 인격이 공급하는 자원이며 별개 축이다(backlog/04).
	// 본체만 잡는다 — 파생(호표탄·파열 보호·엄호)을 한 자원으로 볼 근거가 아직 없다.
	// `CanDuelGuard` 는 결투 기믹이라 `guard` 를 넣으면 안 된다(인격 19명이 딸려 온다).
	['ammo', /^Bullet$/],
	['protection', /^Protection$/],
];

export function statusKeyOf(statusId: string): StatusKey | null {
	for (const [key, re] of STATUS_MATCH) if (re.test(statusId)) return key;
	return null;
}
```

`lib/engine/load.ts` 는 자기 정의를 지우고 임포트만 바꾼다.

```ts
import { mapEffect, mapTrigger, statusKeyOf, type Condition, type StatusKey } from './vocab';
```

- [ ] **Step 6: 수요 쪽을 구현한다**

여기가 근사가 실제로 걷히는 자리다. 실측으로 탄환·보호를 참조하는 발동 토큰은 다섯이다.

| 토큰 | 기프트 | 지금 | 이후 | 왜 |
| --- | ---: | --- | --- | --- |
| `Ammo Skill Used` | 7 | `SITUATIONAL 0.2` | `SKILL_SUPPLIES ammo` | 덱이 탄환을 공급하는지로 판정된다 |
| `Allies have Ammo Skill` | 1 | `SITUATIONAL 0.5` | `SKILL_SUPPLIES ammo` | 같음 |
| `Allies with Shield` | 2 | `SITUATIONAL 0.45` | `HAS_STATUS protection ally` | 아군 보호는 우리 덱이 공급한다 |
| `Enemies with Shield` | 3 | `SITUATIONAL 0.45` | **그대로** | 적이 보호를 갖는 것은 우리 덱 구성으로 판정할 수 없다. `HAS_STATUS` 의 `enemy` 갈래는 *우리가 부여할 수 있는가* 를 보는데 보호는 우리가 적에게 거는 것이 아니다 |
| `Guard Skill Used` | 2 | `SITUATIONAL 0.35` | **그대로** | 방어 스킬이지 상태 기믹이 아니다. `backlog/04` 2절이 방어(가드·회피·반격)를 별도 분류로 뒀다 |

`backlog/04` 3·4절이 센 것과 맞는다 — 탄환 조건 8건(7+1), 보호 조건 2종. 효과 쪽 `Gain Shield` 10건은 손대지 않는다(같은 문서 7.4).

`STATUS_OF` 에 `Ammo` 를 더하면 `Ammo Skill Used` 는 기존 `{X} Skill Used` 규칙이 자동으로 잡는다. `SKILL_SHAPE_RATE` 의 `Ammo: 0.2` 는 죽은 항목이 되므로 지운다.

```ts
const STATUS_OF: Record<string, StatusKey> = {
	Burn: 'burn',
	// … 기존 항목 …
	Bloodfeast: 'bloodfeast',
	// 상태 기믹. `Ammo Skill Used` 가 이 표를 타고 SKILL_SUPPLIES 로 간다.
	Ammo: 'ammo',
};
```

`mapTrigger` 에 두 갈래를 더한다. **`Allies have Ammo Skill` 은 기존 `/^Allies have (\w+)$/` 로 안 잡힌다** — `Ammo Skill` 에 공백이 있어서다. 명시로 둔다.

```ts
	// 탄환은 `{X} Skill Used` 와 표기가 다른 변형이 하나 있다.
	if (token === 'Allies have Ammo Skill') return { op: 'SKILL_SUPPLIES', status: 'ammo' };
	// 아군 보호는 우리 인격이 공급한다. 적 보호는 우리 덱으로 판정할 수 없어 상황성으로 남는다.
	if (token === 'Allies with Shield') return { op: 'HAS_STATUS', status: 'protection', side: 'ally' };
```

두 줄은 `/^(Allies|Enemies) with (Shield|.+)$/` 상황성 갈래보다 **위**에 둔다. 아래에 두면 도달하지 않는다.

- [ ] **Step 7: 통과와 회귀를 확인한다**

```bash
npx tsx --test "lib/engine/*.test.ts"
npm run typecheck
npm run db:up && npm run engine:proof
```

Expected: 테스트 통과 · 타입 오류 0 · **`engine:proof` 가 기준선 불일치로 실패한다.** 축이 늘고 토큰 세 종(기프트 10건)이 상황성에서 공급 판정으로 바뀌므로 점수가 움직인다. 그것이 정상이며 Task 5 에서 기준선을 갱신한다. **지금은 실패를 기록만 하고 넘어간다** — 무엇이 얼마나 바뀌었는지가 Task 5 의 근거다.

`dominant` 도 바뀔 수 있다. 보호 공급자가 15명이라 덱에 따라 최다 축이 보호로 넘어간다. 화면 요약용이며 계산 입력은 아니다(`state.ts` 주석).

- [ ] **Step 8: 커밋**

```bash
git add lib/engine/vocab.ts lib/engine/load.ts lib/engine/vocab.test.ts
git commit -m "feat(engine): 상태 기믹 축 — 탄환과 보호"
```

---

### Task 3: 소속 조건의 인원수와 판정 범위를 설명문에서 읽는다

**Files:**
- Modify: `lib/engine/vocab.ts`
- Modify: `lib/engine/vocab.test.ts`

**Interfaces:**
- Consumes: 기존 `Condition` 타입
- Produces: `COUNT_AFFILIATION` 조건에 **선택 필드** `scope?: 'deck' | 'deployed'` 추가 · `refineAffiliation(condition, desc, tokenCount): Condition`

**선택 필드로 둔다.** `Condition` 은 export 되어 있고 `evaluate(condition: Condition, …)` 의 인자 타입이다. 필수 필드를 더하면 그 시그니처가 좁아져 Global Constraints 를 스스로 깬다. 선택 필드면 기존에 조건을 만드는 자리가 전부 그대로 컴파일된다.

값이 `undefined` 인 것이 곧 "설명문에 표지가 없다"이며 예전 근사(둘 중 큰 쪽)를 뜻한다. 별도의 `'unknown'` 리터럴을 두지 않는다 — 상태가 둘로 표현되면 어느 쪽이 기본인지 매번 확인해야 한다.

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`lib/engine/vocab.test.ts` 에 이어 붙인다. **실측한 실제 문구를 그대로 쓴다.**

```ts
import { refineAffiliation } from './vocab';

const base = { op: 'COUNT_AFFILIATION', affiliation: 'x', atLeast: 3 } as const;

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

test('표지가 없으면 범위를 정하지 않는다', () => {
	const c = refineAffiliation(base, '중지 소속 인격이 3인 이상이면, 대신 기본 위력 +1');
	assert.equal(c.scope, undefined);
	assert.equal(c.atLeast, 3);
});

test('인원수가 없으면 기존 값을 유지한다', () => {
	assert.equal(refineAffiliation(base, '소속 인격이 있으면').atLeast, 3);
});

// ── 다른 절의 숫자를 읽으면 안 된다 ──

test('상태 공급 조건의 인원수를 소속 조건으로 읽지 않는다', () => {
	// 9216 — "5인 이상"은 화상 스킬 보유 인원이고, 리우 협회 조건에는 인원수가 없다.
	// 설명문 전체를 훑으면 소속 5인 · 출전 기준으로 잘못 읽는다.
	const desc = [
		'턴 시작 시, 화상 위력 또는 화상 횟수 또는 특수 화상을 부여하는 공격 스킬을 보유한 인격이 5인 이상이면, 이번 전투 동안 발동 (E.G.O 스킬 제외. 대기 인원 제외)',
		'리우 협회 소속 인격의 기본 공격 스킬의 더하기 코인 위력 +2',
	].join('\n');
	const c = refineAffiliation(base, desc);
	assert.equal(c.atLeast, 3, '근사를 유지한다');
	assert.equal(c.scope, undefined, '다른 절의 표지를 가져오지 않는다');
});

test('인원 비례 효과의 표지를 판정 범위로 읽지 않는다', () => {
	// 9253 — "대기 인원 포함"이 인원 비례 효과에 붙어 있다. 임계값의 범위가 아니다.
	const desc = '- 자신을 제외한 라만차랜드 소속 인격 1명당 최종 위력 +1 (최대 4, 대기 인원 포함)';
	assert.equal(refineAffiliation(base, desc).scope, undefined);
});

test('9270 처럼 단계가 줄로 나뉘면 첫 절의 임계값을 쓴다', () => {
	const desc = '- 턴 시작 시 중지 소속 인격이 3인 이상이면, 대신 기본 위력 +1\n- 5인 이상이면, 대신 기본 위력 +2';
	assert.equal(refineAffiliation(base, desc).atLeast, 3, '두 번째 줄에는 소속이 없다');
});

// ── 정밀화하면 안 되는 것 ──

test('소속 토큰이 둘인 기프트는 인원수를 건드리지 않는다', () => {
	// 9712 — "검계 또는 흑운회 소속이 4인 이상". 합집합 조건인데 엔진은 두 조건을 AND 로
	// 묶으므로, 4를 그대로 쓰면 "검계 4명 그리고 흑운회 4명"이 되어 지금보다 더 틀린다.
	const desc = '전투에 참여한 인격 중 검계 또는 흑운회 소속이 4인 이상일 경우 (출격 인원을 기준으로 함) 효과가 강화되어…';
	const c = refineAffiliation(base, desc, 2);
	assert.equal(c.atLeast, 3, '인원수는 근사를 유지한다');
	assert.equal(c.scope, 'deployed', '판정 범위는 합집합이든 아니든 같으므로 읽는다');
});

test('한 절에 인원수가 여러 개면 건드리지 않는다', () => {
	const desc = '중지 소속 인격이 3인 이상이면 … 5인 이상이면 …';
	assert.equal(refineAffiliation(base, desc).atLeast, 3);
});
```

**위 테스트의 문구는 실제 설명문에서 가져온 것이다.** 지어내면 통과하는 테스트만 남는다.

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
			 * **없으면 표지가 없었다는 뜻이며 예전 근사(둘 중 큰 쪽)를 쓴다.**
			 */
			scope?: 'deck' | 'deployed';
	  }
```

`mapTrigger` 는 그대로 둔다 — 선택 필드라 기본값을 넣을 필요가 없다. 아래 함수를 더한다.

```ts
/**
 * 설명문으로 소속 조건을 정밀화한다.
 *
 * 원본 토큰(`{소속} Identities`)에는 인원수도 판정 범위도 없다. 둘 다 설명문에만 있다.
 * 실측 74종 중 설명문이 조건을 말하는 것이 18종이고, 나머지 56종은 근사를 유지한다 —
 * **걷어내는 것보다 남는 것이 많다.** 없는 근거를 지어내지 않는다.
 *
 * **설명문 전체가 아니라 조건을 말하는 절 하나만 읽는다.** 기프트 설명문은 여러 절이
 * 붙어 있고 다른 축의 조건이 섞여 있다. 전체에 정규식을 걸면 9216 의 `화상 … 스킬을
 * 보유한 인격이 5인 이상` 을 소속 5인으로, 9253 의 인원 비례 효과에 붙은 `대기 인원 포함`
 * 을 판정 범위로 읽는다. 실측 오탐 다섯이 전부 그런 형태였다.
 *
 * 인원수는 두 경우에 읽지 않는다.
 *
 *   소속 토큰이 둘 이상인 기프트 — 설명문이 "검계 **또는** 흑운회가 4인"처럼 합집합을
 *   말하는데(9712) 엔진은 발동 조건을 AND 로 묶는다. 4를 그대로 넣으면 "검계 4명이면서
 *   흑운회 4명"이 되어 일괄 3인보다 더 틀린다.
 *
 *   한 절에 인원수가 여러 개인 기프트 — 단계별 강화라 임계값 하나로 담기지 않는다.
 *   실측에는 없다(9270 은 단계가 줄로 나뉘어 있어 절 단위로 읽으면 걸리지 않는다).
 *   앞으로 생길 경우를 막는 안전망이다.
 *
 * 판정 범위는 두 경우에도 읽는다. 합집합이든 단계별이든 **어느 인원을 세는가는 하나**다.
 */
export function refineAffiliation(
	condition: Extract<Condition, { op: 'COUNT_AFFILIATION' }>,
	desc: string,
	affiliationTokens = 1,
): Extract<Condition, { op: 'COUNT_AFFILIATION' }> {
	// 소속과 인원수가 함께 있는 절. 이것이 조건을 말하는 문장이다.
	const clause = desc.split('\n').find((l) => l.includes('소속') && /[0-9]+인 이상/.test(l));
	if (clause === undefined) return condition;

	const scope =
		/출격 인원을 기준|대기 인원 제외/.test(clause) ? ('deployed' as const)
		: /편성 인원을 기준|대기 인원 포함/.test(clause) ? ('deck' as const)
		: undefined;

	const found = [...clause.matchAll(/([0-9]+)인 이상/g)].map((m) => Number(m[1]));
	const tiered = new Set(found).size > 1;
	const atLeast =
		affiliationTokens > 1 || tiered ? condition.atLeast : (found[0] as number);

	// `exactOptionalPropertyTypes` 라 undefined 를 넣지 않고 키 자체를 빼야 한다.
	return scope === undefined
		? { ...condition, atLeast }
		: { ...condition, atLeast, scope };
}
```

- [ ] **Step 4: 통과를 확인한다**

Run: `npx tsx --test "lib/engine/vocab.test.ts" && npm run typecheck`
Expected: 테스트 통과 · 타입 오류 0

`scope` 가 선택 필드이므로 `Condition` 을 만드는 다른 자리는 손댈 것이 없어야 한다. 오류가 난다면 선택으로 두지 못한 이유가 있다는 뜻이니 그 자리를 먼저 본다.

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
	const c = { op: 'COUNT_AFFILIATION', affiliation: 'x', atLeast: 3 } as const;
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
			// 판정 범위는 설명문이 말한다(vocab.refineAffiliation). 표지가 없으면 예전 근사를
			// 유지한다 — 둘 중 큰 쪽. 소속 조건 78건 중 62건이 여기 해당하며 근사 쪽이 훨씬 많다.
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

`lib/engine/load.ts` 의 `loadGifts` 에서 `mapTrigger` 결과가 `COUNT_AFFILIATION` 이면 그 기프트의 설명문으로 정밀화한다.

**점수가 UI 언어를 타지 않게 하는 것이 이 Step 의 핵심이다.** 지금 질의는 이렇다.

```ts
texts: { where: { locale: { in: [locale, 'en'] }, enhanceLevel: 0 } },
```

`locale='en'` 이면 한국어 행이 아예 안 들어온다. `refineAffiliation` 의 정규식은 한국어 전용이므로 그대로 두면 **영어로 보는 사용자에게는 정밀화가 통째로 꺼지고 같은 덱이 다른 점수를 받는다.** `engine-golden.json` 기준선도 어느 로케일로 쟀는지에 묶인다. `ko` 를 항상 포함시킨다.

```ts
		include: {
			// `ko` 는 표시가 아니라 **조건 정밀화**에 쓴다. 소속 조건의 인원수와 판정 범위가
			// 한국어 설명문에만 있어서, 요청 로케일과 무관하게 항상 읽어야 점수가 언어를
			// 타지 않는다. 표시 이름은 아래 `nameOf(g.texts, locale)` 이 그대로 고른다.
			texts: { where: { locale: { in: [...new Set([locale, 'en', 'ko'])] }, enhanceLevel: 0 } },
			tokens: { orderBy: [{ kind: 'asc' }, { index: 'asc' }] },
		},
```

조건을 만드는 자리는 이렇게 바꾼다. **소속 토큰 수를 함께 넘긴다** — `refineAffiliation` 이 합집합 조건에서 인원수를 읽지 않으려면 그 수가 필요하다(Task 3).

```ts
		const koDesc = g.texts.find((t) => t.locale === 'ko')?.desc ?? '';
		const affiliationTokens = triggerTokens.filter((t) => / Identities$/.test(t.token)).length;

		const conditions = triggerTokens
			.map((t) => {
				const c = mapTrigger(t.token, affiliations);
				if (!c) unmapped.triggers.add(t.token);
				// 소속 조건만 설명문으로 정밀화한다. 나머지는 토큰만으로 결정된다.
				return c?.op === 'COUNT_AFFILIATION'
					? refineAffiliation(c, koDesc, affiliationTokens)
					: c;
			})
			.filter((c): c is Condition => c !== null);
```

`ko` 설명문이 없는 기프트가 있으면 빈 문자열이 되어 정밀화가 조용히 꺼진다. **그것을 세어 둔다** — `verify` 가 로케일 결손을 이미 보므로 여기서는 개수만 확인하고 0이 아니면 원인을 찾는다.

```bash
docker compose exec -T postgres psql -U postgres -d limbus -tAc \
  "select count(*) from gift g where not exists (
     select 1 from gift_text t where t.\"giftId\"=g.id and t.locale='ko' and t.\"enhanceLevel\"=0)"
```

Expected: `0`

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

- **탄환** — `Ammo Skill Used` 7건과 `Allies have Ammo Skill` 1건이 고정 빈도(0.2 · 0.5)에서 공급 판정으로 바뀐다. 화진 덱은 7명 중 3명이 탄환 공급자라(`backlog/04` 5절: 10512 · 10916 · 11013) `supply/(supply+SUPPLY_K)` 가 0.2 보다 크면 **상승**한다. `SUPPLY_K` 값을 보고 방향을 먼저 계산해 두고 diff 와 대조한다.
- **보호** — `Allies with Shield` 2건이 0.45 에서 공급 판정으로 바뀐다. 화진 덱의 보호 공급자 수에 따라 갈린다. `Enemies with Shield` 3건은 그대로 0.45 다.
- **판정 범위** — `engine-proof` 는 `deck === deployed` 인 상태를 재므로(`src/engine-proof.ts` 64행 `deployed: deck`) **`scope` 변경만으로는 점수가 움직이지 않는다.** `max(deck, deployed)` 와 각각이 같은 값이다. 여기서 diff 가 나면 구현이 틀린 것이다.
- **인원수** — 2인으로 내려간 3건은 충족이 쉬워져 상승, 4·5인으로 올라간 5건은 하락. 이 항목만은 `engine-proof` 에서도 실제로 움직인다.

**판정 범위 항목이 골든에서 관측되지 않는다는 사실을 그대로 적는다.** 이 계획이 고친 것이 검증되려면 `deck ≠ deployed` 인 상태가 필요하고, 그것은 `lib/queries/recommend.ts` 가 편성과 출전을 나눠 받은 뒤에 생긴다(`docs/07-recommendation-system.md` 6절, 웹 브랜치 몫). **그 전까지 이 항목은 "구현했으나 회귀로 잠기지 않은 상태"다.** Task 6 에서 임시 상태로 직접 확인한다.

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
| 소속 조건의 인원수 | `일괄 3인` → `설명문이 조건을 말하는 18종에서 읽는다. 나머지 56종은 3인 근사` |
| 소속 조건의 판정 범위 | `편성·출전 중 큰 쪽` → `표지가 있는 15종은 그 범위. 나머지 59종은 큰 쪽` |
| 탄환 · 보호 축 | `없음` → `본체(Bullet · Protection)만 축으로 들어왔다. 파생은 미결 — backlog/04 7.2` |

**근사표에 두 줄을 더한다.** 이 작업이 걷어낸 것보다 크고, 실측하다 드러난 것이라 감추지 않는다.

| 항목 | 지금 | 왜 |
| --- | --- | --- |
| 소속 조건 중 인원 비례 효과 | 임계값 3인으로 근사 | 조건 문구가 없는 56종 중 대부분이 `인격 수만큼`·`인격 수/2` 형태다. 임계값 모델 자체가 맞지 않는다 |
| 소속 합집합 조건 | 소속별 AND 로 근사 | `검계 또는 흑운회가 4인`(9712) 류 4종. 발동 토큰이 소속별로 쪼개져 나오는데 원본이 합집합임을 알려주지 않는다 |

12절 미결에서 해소된 항목에 취소선을 긋고 **무엇으로 해소했는지** 적는다. 기존 문서가 상태 축 항목에 쓴 방식과 같다. **판정 범위 항목은 해소로 적지 않는다** — 구현은 됐지만 `deck === deployed` 라 아직 관측되지 않으며, 웹 쪽이 편성과 출전을 나눠 받는 시점에 해소된다.

`docs/backlog/04-status-mechanics.md` 는 **해소로 바꾸지 않는다.** 7절 다섯 항목 중 1·2·3·4 를 이 계획이 하고, 5(인격 화면의 독립 구획)와 7.2 의 파생 상태 미결이 남는다. 남은 것을 그 문서에 남긴다.

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

- [ ] **Step 2: 판정 범위가 실제로 갈리는지 직접 확인한다**

골든이 `deck === deployed` 라 이 항목을 잡지 못한다(Task 5 Step 1). 편성과 출전이 다른 상태를 손으로 만들어 한 번 본다.

```bash
npx tsx --env-file-if-exists=.env -e "
import { loadAffiliations, loadGifts, loadIdentities } from './lib/engine/load';
import { contextOf, type RunState } from './lib/engine/state';
import { evaluate } from './lib/engine/dsl';
import { db } from './lib/db';

const affiliations = await loadAffiliations();
const [deck, { gifts }] = await Promise.all([
  loadIdentities('ko', [10216, 11009, 11216, 10512, 10716, 10916, 11013]),
  loadGifts('ko', affiliations),
]);
// 출전을 4명으로 줄인다 — 편성 7 / 출전 4
const state: RunState = { deck, deployed: deck.slice(0, 4), owned: [], floor: 3 };
const ctx = contextOf(state);
for (const id of [9282, 9283]) {           // 9282 편성 기준 · 9283 출격 기준
  const g = gifts.find((x) => x.id === id)!;
  const c = g.effects[0]!.condition;
  console.log(id, g.name, JSON.stringify(c), '→', evaluate(c, ctx).evidence);
}
console.log('편성', ctx.affiliation.deck, '출전', ctx.affiliation.deployed);
await db.\$disconnect();
"
```

Expected: 9282 는 `scope: 'deck'` 이라 편성 7명으로, 9283 은 `scope: 'deployed'` 라 출전 4명으로 판정된다. **근거 문자열에 `편성` 과 `출전` 이 각각 나오면 이 계획의 핵심이 동작한 것이다.** 둘이 같은 수를 보면 정밀화가 안 걸린 것이니 Task 4 Step 4 를 다시 본다.

결과를 커밋 메시지에 옮긴다. 골든이 못 잡는 항목이라 이 출력이 유일한 증거다.

- [ ] **Step 3: CI 를 로컬에서 돌린다**

```bash
act pull_request -W .github/workflows/ci.yml -j check -P ubuntu-latest=catthehacker/ubuntu:act-latest
act pull_request -W .github/workflows/ci.yml -j guard -P ubuntu-latest=catthehacker/ubuntu:act-latest
```

Expected: 두 job 모두 `Job succeeded`. `단위 테스트` 단계가 목록에 있어야 한다.

- [ ] **Step 4: 푸시하고 드래프트를 정식 PR 로 바꾼다**

```bash
git push -u origin feat/engine-deck-feature
gh pr ready
```

---

## 자체 검토

**명세 대응** — `docs/06-recommendation-engine.md` 10절 근사 중 이 계획이 덮는 것:

| 근사 | 대응 | 어디까지 |
| --- | --- | --- |
| 탄환 · 보호 축 없음 | Task 2 | 본체 둘. 파생은 미결로 남는다 |
| 소속 조건의 판정 범위 (편성·출전 중 큰 쪽) | Task 3·4 | 표지가 있는 15/74종 (토큰 16/78) |
| 소속 조건의 인원수 (일괄 3인) | Task 3 | 조건 문구가 있는 18/74종. 실제로 3에서 바뀌는 것은 4건 |

**덮지 않는 것** — 효과와 발동의 짝짓기 · 효과의 크기 · 합성 진행 가치 · 전투 상성 · 상태 파생 관계. 그리고 **특수 취급 7건**은 상류 `statuses` 가 조건부 효과를 무조건 포함하는지 검증이 선행되어야 해 이 계획 밖이다(`docs/07-recommendation-system.md` 9절). 실측하다 드러난 **인원 비례 효과**와 **소속 합집합 조건**도 밖이며 Task 5 에서 근사표에 새로 적는다.

**타입 일관성** — `StatusKey`(Task 2)에 더한 두 항목을 `STATUS_MATCH` 와 `STATUS_OF` 가 각각 공급·수요 쪽에서 쓴다. `Condition` 의 선택 필드 `scope`(Task 3)를 `evaluate`(Task 4)가 읽는다. `refineAffiliation`(Task 3)을 `loadGifts`(Task 4)가 부르며 소속 토큰 수를 함께 넘긴다.

**의존 순서** — Task 2 의 공급(Step 5)과 수요(Step 6)는 나눌 수 없다. 하나만 하면 점수가 움직이지 않아 Task 5 의 diff 가 근거를 잃는다.

**의도적으로 남긴 미확정** — 파생 상태를 어디까지 한 자원으로 볼지(Task 2 Step 1 표). 본체만으로 시작하되 넓힐 근거가 생기면 `BurstProtection` 의 정규식 충돌부터 정리해야 한다.

**이 계획만으로는 관측되지 않는 것** — 판정 범위. `engine:proof` 도 `/recommend` 도 `deck === deployed` 라 `scope` 가 갈려도 같은 값이 나온다. Task 6 Step 2 의 수동 확인이 유일한 증거이며, 회귀로 잠기는 것은 웹 쪽이 편성과 출전을 나눠 받은 뒤다(`docs/07` 6절).
