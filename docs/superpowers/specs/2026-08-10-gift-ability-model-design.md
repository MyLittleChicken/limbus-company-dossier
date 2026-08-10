# 기프트 능력 모형 — 발동 조건을 구조화된 사실로

> 결정 2026-08-10 · 상태 제안

## 1. 왜

사용자가 추천 화면에서 기프트 판정이 **전반적으로** 틀렸다고 지적했다. 세 건을 짚었다.

| 기프트 | 실제 | 엔진 판정 |
|---|---|---|
| 9052 휴대용 전지 소켓 | 범용 효과 | 발동 불가 |
| 9043 사원증 | 분노 공명이면 발동 (0단계는 완전 공명, 1단계부터 공명) | 발동 불가 |
| 9073 엔도르핀 키트 | 우리 편성에 호흡 부여 인격이 없어 발동 불가 | 유효 |

원인을 세 층으로 나눠 실측했다.

### 층 1 — 원본

`triggers` / `effects` 는 **`limbus-assets` 에만** 있다. `loc-ko/en/ja` 에도, `shared-library` 에도, `limbus-data-mj` 에도 없다. 제3자 큐레이터가 붙인 태그이지 게임 데이터가 아니다.

```
451 기프트에 triggers · effects 가 있다
282 (63%) 이 트리거 수 ≠ 효과 수 → 짝짓기가 원리상 불가능
우리 적재기가 바꾼 트리거 수 0 · 효과 수 0   ← 적재는 충실하다
```

### 층 2 — 우리 적재기

`trigger_ref.evaluability` 150종은 **트리거 이름의 접미사로 우리가 지어냈다**.

```typescript
// src/v2/canonical/axis.ts
if (id.endsWith(' Identities') || id.endsWith(' Skill')) return 'roster';
```

`Allies have X Skill` 한 문형이 최소 세 가지 뜻을 겹쳐 쓴다.

```
9741  "5 or more"                                    진짜 조건 · 문턱값 있음
9414  "Effects apply to all Identities with…"        조건이 아니라 적용 범위
9052  "(Prioritizes Identities with Skills that…)"   조건이 아니라 우선순위 주석
```

`Allies have%` 118짝 중 76짝에 문턱값이 없다 → 우리는 `need = 1` 로 가정했다.

### 층 3 — 엔진

태그를 AND 로 읽었다.

```typescript
// lib/engine/v2/evaluate.ts
const fireable = !reasons.some((r) => r.verdict === 'unsatisfied' && r.certainty === 'certain');
```

결과: 「발동 불가」 174건 중 **159건(91%)이 틀렸다**. OR 로 읽으면 15건이 된다.

### 데이터베이스가 결손을 이미 알고 있었다

`canonical.field_gap` 은 「출처가 말하지 않았다」를 정직하게 기록한다. `gift-trigger-param.ts` 는 산문에서 수치를 못 뽑으면 그 자리에서 `meta.gap(...)` 을 남긴다.

**그런데 엔진은 `field_gap` 을 읽지 않는다.** (`lib/engine/v2/load.ts:48-63` 이 읽는 8개 표에 없다.) 결손이 적혀 있는데도 엔진은 `need = 1` 로 추측해 덮었다. **「모른다」와 「아니다」를 구별하지 못한다.**

### 기프트 쪽에는 메카닉 층이 아예 없다

인격 쪽과 견주면 격차가 분명하다.

```
인격·스킬                              기프트
────────────────────────────────────────────────────────────
coin_token          23,588행           effect              55종 (이름뿐)
  skill_id · uptie · coin_idx            ✗ 강화 단계별 구분 없음
  token · kind · amount                  ✗ 수량 없음
  status_id                              effect_ref.ref_id — 27/55 가 'none'
  kind='status'  12,521 (189종)
  kind='timing'  11,067 ( 26종)          ✗ 시점 없음

gift_trigger_param  188행 — (기프트,트리거) 1,081짝 중 122짝(11%)만 커버
```

### 설명문은 이 격차를 메울 수 있다

`canonical.gift_stage_text` 는 456 기프트 × ko/en/ja 가 100% 적재되어 있다. en 으로 실측했다.

```
거울 던전 기프트 456 · 단계 문장 673 · 문단 1,745

조건이 나타나는 자리
   423  24.2%  ② 머리표          Turn Start: · Combat Start:
   619  35.5%  ① 선행 조건절     When … / If … / On … / At … / Every …
    78   4.5%  ④ 대상 한정       … against enemies with Bleed
    31   1.8%  ③ 주어 한정       Allies with less than 0 SP deal …
     6   0.3%  ⑥ 괄호 주석       (max 3) · (3 times per turn)
   588  33.7%  표지 없음         상당수가 진짜 무조건 효과다
```

**설명문은 규칙적이다. 다만 조건이 한 자리가 아니라 대여섯 자리에 나온다.** 정규식 하나로는 안 된다 — `gift-trigger-param.ts` 가 정규식 6개로 11% 만 건진 이유이고, ADR-08 이 그 `DENOMINATOR` 정규식 6개를 순서 의존이라 데이터로 못 옮기고 코드에 남겨둔 이유다.

### 강화 단계가 조건을 바꾼다

```
단계가 둘 이상인 기프트        110  (나머지 346 은 단계 하나)
  전 단계 문장 동일              0   ← 하나도 없다
  수치만 달라짐                 23
  문장(조건)까지 달라짐         87   ← 110 중 79%

9001  0·1단계  When activating Wrath Absolute Resonance
      2단계    When activating Wrath Resonance          조건이 느슨해진다
```

`canonical.gift_stage` 는 `(gift_id, level)` 뿐 — **메카닉 칸이 하나도 없다.** 사용자가 지적한 사원증(9111)이 정확히 이 구조다.

## 2. 목표 · 비목표

### 목표

1. 기프트의 **발동 조건**을 구조화된 사실로 갖는다 — 강화 단계별로, AND/OR 를 표현할 수 있게.
2. 「모른다」가 「아니다」로 읽히지 않게 한다.
3. 규칙(어떻게 읽는가)은 코드에, 사실(무엇이 조건인가)은 데이터에 둔다 — ADR-08.

### 비목표

- **효과 시뮬레이션을 하지 않는다.** 수량 · 배율 · 지속 · 적 쪽 효과는 뽑지 않는다. 엔진에 필요한 것은 「이 기프트가 아예 켜질 수 있나」뿐이다.
- **기존 표를 지우지 않는다.** `gift_trigger` · `gift_effect` · `trigger_ref` · `effect_ref` · `gift_trigger_param` 은 그대로 두고 폐기 표시만 붙인다 (§6).
- **점수 모형을 이번에 손대지 않는다.** 조건 판정이 옳아진 뒤에 별도로 다룬다.
- **인격 쪽 데이터를 만들지 않는다.** `coin_token` 은 이미 정밀하다. 다만 2단계에서 엔진이 편성 공급을 **`identity_axis` 대신 `coin_token` 으로** 세게 바꾼다 — 9073 골든이 그것 없이는 서지 않는다(§8).

## 3. 데이터 모형

문단 하나가 능력 하나다. 능력마다 조건이 붙는다.

```prisma
/// 기프트 능력 — 설명문 문단 하나가 능력 하나다.
///
/// 강화 단계마다 따로 있다. 110개 기프트 중 87개가 단계에 따라 조건 자체가
/// 바뀌기 때문이다(9001 은 2단계에서 완전 공명 → 공명으로 느슨해진다).
model GiftAbility {
  giftId        String  @map("gift_id")
  level         Int
  ordinal       Int
  /// 발동 시점. 머리표(Turn Start:)와 문말 시점구(at Combat Start)에서 온다.
  /// 모르면 'none' — 비워두지 않는다.
  timing        String
  /// 조건 없는 상시 효과인가.
  ///
  /// 참이면 conds 가 반드시 비어 있다. **거짓인데 conds 가 비어 있으면 결손이다**
  /// — 조건이 있는 줄은 아는데 뽑지 못한 자리이고, field_gap 에 남는다.
  /// 두 경우가 같은 모양이 되지 않게 이 칸을 따로 둔다.
  unconditional Boolean
  /// 다른 능력의 강화판인가. 그 능력의 ordinal, 독립이면 null.
  ///
  /// 9073 엔도르핀 키트의 문단 2 「질투 속성 스킬을 사용할 경우, **효과가
  /// 강화되어** …」는 문단 1 에 종속된다. 호흡을 안 얻으면 질투 스킬을 써도
  /// 아무 일도 없다. 이것을 독립 능력으로 두면 ordinal 간 OR 가 「질투 스킬이
  /// 있으니 켜진다」로 읽어 사용자가 지적한 오판정이 그대로 재발한다.
  ///
  /// 강화판은 켜짐 판정에 **참여하지 않는다** — 원 능력이 죽으면 같이 죽는다.
  refines       Int?
  /// 설명문에서 이 능력에 해당하는 문단 원문. 검수와 재현의 근거다.
  sourceText    String  @map("source_text")

  gift  Gift               @relation(fields: [giftId], references: [id])
  conds GiftAbilityCond[]

  @@id([giftId, level, ordinal])
  @@index([giftId])
  @@map("gift_ability")
  @@schema("canonical")
}

/// 능력 하나의 발동 조건.
///
/// `group` 이 AND/OR 를 가른다 — 같은 group 안은 OR, group 끼리는 AND.
/// 9011 "When activating Sloth Absolute Resonance **or** using a Skill with
/// 2+ Atk Weight" 가 group 0 에 조건 2개로 들어간다.
model GiftAbilityCond {
  giftId    String  @map("gift_id")
  level     Int
  ordinal   Int
  group     Int
  idx       Int
  /// axis · sin · resonance · attack_type · skill_kind · coin
  /// deployment · association · unit_keyword · enemy_state · other
  refKind   String  @map("ref_kind")
  /// COMBUSTION · WRATH · … . refKind='other' 면 원문 조각을 그대로 둔다.
  refId     String  @map("ref_id")
  /// gte · eq · has
  op        String
  /// 문턱값. 문장에 없으면 null — **1 로 가정하지 않는다.**
  threshold Int?
  /// field(출전 6인) · roster(편성 전체) · slot(특정 자리) · enemy · none
  scope     String
  /// scope='slot' 일 때 게임 자리 번호 1~5. 아니면 null
  slot      Int?
  /// 전투 중에만 알 수 있는가. 참이면 편성만 보고 배제할 수 없다.
  runtime   Boolean

  ability GiftAbility @relation(fields: [giftId, level, ordinal], references: [giftId, level, ordinal], onDelete: Cascade)

  @@id([giftId, level, ordinal, group, idx])
  @@index([refKind, refId])
  @@map("gift_ability_cond")
  @@schema("canonical")
}
```

### 판정 규칙 — 코드에 산다

```
기프트가 켜질 수 있다
  = refines=null 인 능력 중 하나라도 켜질 수 있다   ordinal 간 OR
    (강화판은 세지 않는다 — 원 능력에 딸린다)
      능력이 켜질 수 있다
        = unconditional 이거나
          모든 group 이 충족 가능                  group 간 AND
            group 이 충족 가능
              = 조건 중 하나라도 충족 가능           group 내 OR
                조건이 충족 가능
                  = runtime 이면 참 (배제 못 한다)
                    threshold 가 null 이면 참 (모른다 → 배제 안 한다)
                    아니면 편성 공급 ≥ threshold
```

**모든 독립 능력이 죽을 때만 기프트가 죽는다.** 지금은 조건 하나만 어긋나도 죽였다.

### `refKind` 어휘

기존 `trigger_ref.refKind` 어휘를 그대로 쓴다 — 이미 `canonical` 에 있는 축 · 죄악 · 소속 · 유닛 키워드를 가리킨다. `enemy_state` 하나만 새로 만든다(적 상태를 보는 조건 — 언제나 `runtime = true`).

### `timing` 어휘

닫힌 집합으로 둔다. 여기 없는 시점이 나오면 `other` 로 두고 `field_gap` 에 남긴다 — 1회차 뒤 비율을 보고 어휘를 늘릴지 정한다(§9).

```
combat_start   전투 시작 시 · at Combat Start
turn_start     턴 시작 시 · Turn Start:
turn_end       턴 종료 시
on_use         스킬 사용 시 · When using …
on_hit         적중 시 · When hitting …
on_kill        처치 시 · After defeating …
on_clash       합 · Clash Win/Lose
floor_start    층 진입 시
none           시점 표지가 없다 (상시)
other          어휘에 없다 — field_gap 을 남긴다
```

### 조건이 아닌 것

문장에 있어도 **조건으로 세지 않는다.**

```
우선순위 주석   9052 「(스킬을 사용하여 충전 횟수를 획득하는 인격을 우선으로 지정)」
                누구에게 먼저 줄지를 말할 뿐, 켜짐과 무관하다.
                지금 엔진이 이것을 조건으로 읽어 9052 를 죽였다.
적용 범위       9414 「Effects apply to all Identities with …」
                누구에게 적용되는지이지 켜지는 조건이 아니다.
횟수 제한       「(턴 당 1회 발동)」 · 「(max 3)」
효과 수량       「호흡 위력 3」 — 비목표(§2)
```

### 저장하지 않는 것

문턱값을 못 찾았을 때 `threshold = null` 로 두고, 그 사실을 `field_gap` 에 남긴다. **기본값을 넣지 않는다.** 지금 `need = 1` 로 가정한 것이 `Allies have%` 118짝 중 76짝을 틀리게 만들었다.

### 세 사례로 본 모형

사용자가 짚은 세 건이 모형의 세 축을 각각 시험한다.

**9052 휴대용 전지 소켓 — 무조건 능력이 있으면 산다**
```
문단 1  턴 시작 시, 무작위 아군 둘이 충전 횟수 2 증가
        (스킬을 사용하여 … 인격을 우선으로 지정)      ← 우선순위 주석. 조건 아님
   → ordinal 0 · unconditional=true · timing=turn_start · conds 없음
문단 2  나태 완전 공명을 발동하였다면 전투 시작 시, …
   → ordinal 1 · resonance/SLOTH absolute · timing=combat_start

판정  ordinal 0 이 무조건 → 항상 켜진다
지금  괄호 주석을 조건으로 읽어 죽였다
```

**9043 사원증 — OR 와 단계별 조건 변화**
```
0단계  분노 완전 공명을 발동하였거나 | 충전 횟수 … 스킬을 사용할 경우
1단계  분노 공명을 발동하였거나      | 충전 횟수 … 스킬을 사용할 경우
   → ordinal 0 · group 0 에 조건 2개 (OR)
        idx 0  resonance/WRATH  op=has  (0단계는 absolute, 1단계부터 일반)
        idx 1  axis/CHARGE      op=has  scope=field

판정  둘 중 하나만 있어도 켜진다. 충전 스킬만으로도 산다
지금  AND 로 읽어 죽였다
```

**9073 엔도르핀 키트 — 강화판은 켜짐을 만들지 않는다**
```
문단 1  스킬 효과로 호흡 위력을 획득할 때마다 …
   → ordinal 0 · axis/BREATH · scope=field · op=gte · threshold=1
문단 2  질투 속성 스킬을 사용할 경우, 효과가 강화되어 …
   → ordinal 1 · refines=0   ← 독립 능력이 아니다

판정  ordinal 0 만 센다. 화진 덱은 호흡 부여 스킬이 10916 하나뿐(coin_token
      으로 확인) → 죽는다
지금  identity_axis 가 BREATH 공급이 있다고 보고해 통과시켰다
      refines 가 없으면 「질투 스킬이 있으니 켜진다」로 또 틀린다
```

## 4. 추출 경로

LLM 이 오프라인에서 한 번 뽑고, 사람이 검수하고, 결과를 저작 데이터로 굳힌다. 빌드는 설명문을 다시 읽지 않는다.

```
canonical.gift_stage_text (en · ko)
        │
        │  scripts/extract-gift-ability.ts   ← 한 번만 돌린다
        ▼
data/authored/gift-ability.jsonl            456 기프트 · 673 단계 · ~1,745 능력
        │
        │  사람 검수 (§5)
        ▼
src/v2/seed-authored.ts → app.gift_ability_authored
        │
        │  v2:build (매번 · 결정론적)
        ▼
canonical.gift_ability · canonical.gift_ability_cond
```

### 왜 LLM 을 코드가 아니라 오프라인에 두는가

ADR-08 의 판별 기준은 「게임이 정한 것인가, 우리가 정한 것인가」다. 조건은 게임이 정한 사실이므로 데이터다. LLM 호출을 빌드에 넣으면 같은 입력에 다른 결과가 나올 수 있어 `v2:verify:rebuild` 가 성립하지 않는다. 뽑는 일은 한 번, 결과는 저장소에 커밋된 파일.

### `app.gift_ability_authored`

```prisma
/// 기프트 능력 저작 사실. 설명문에서 뽑아 사람이 검수한 결과다.
///
/// 빌드는 이 표를 읽어 canonical.gift_ability 를 굽는다. 설명문을 다시
/// 파싱하지 않는다 — 그래야 결과가 고정되고 재현 가능하다(ADR-08).
model GiftAbilityAuthored {
  giftId  String @map("gift_id")
  level   Int
  ordinal Int
  /// GiftAbility + conds 를 통째로 담는다. 스키마는 §3 과 같다.
  payload Json
  /// 왜 이렇게 판정했는가. 검수자가 남긴다. 지문에는 안 들어간다.
  note    String

  @@id([giftId, level, ordinal])
  @@map("gift_ability_authored")
  @@schema("app")
}
```

`authoredDigest`(`src/v2/authored.ts`)에 이 표를 포함한다. `note` 는 지문에서 뺀다 — 설명을 고치는 것은 결과를 안 바꾸므로 재빌드를 요구할 이유가 없다(기존 방침 그대로).

### `unknownRefs` 확장

굽기 전에 `refKind`/`refId` 가 실재하는지 검사한다. `axis` · `association` · `unit_keyword` 는 기존 검사를 그대로 쓰고, `sin` · `attack_type` · `skill_kind` · `resonance` 를 더한다. `refKind='other'` 는 검사에서 뺀다(원문 조각을 담는 자리다).

## 5. 검수

전건을 사람이 본다. 다만 **주의를 어디에 먼저 둘지**를 데이터가 정하게 한다.

### 두 번 뽑아 어긋난 것을 앞세운다

같은 설명문을 **독립적으로 두 번** 추출한다. 두 판이 다른 능력은 판단이 갈린 자리이므로 먼저 본다.

```
scripts/extract-gift-ability.ts --pass 1  → gift-ability.pass1.jsonl
scripts/extract-gift-ability.ts --pass 2  → gift-ability.pass2.jsonl
scripts/diff-gift-ability.ts              → 불일치 목록 (검수 우선순위)
```

### 검수 도구

```
scripts/review-gift-ability.ts
  기프트마다 한 화면:
    설명문 원문 (ko · en)
    뽑힌 능력과 조건
    두 판의 불일치 표시
    지금 엔진 판정 vs 새 모형 판정
```

터미널 출력으로 충분하다. 화면은 만들지 않는다.

### 검수 단위

50 기프트씩 한 회차. 총 10회차 안팎. 회차마다 확정분을 `gift-ability.jsonl` 에 커밋한다. 마스터북 51회차와 같은 방식이다.

### 검수가 끝나기 전에도 값이 나온다

`gift-ability.jsonl` 에 없는 기프트는 `canonical.gift_ability` 행이 없다. 엔진은 그런 기프트를 **판정 보류**로 다룬다 — 죽이지 않는다. 회차가 진행될수록 판정이 정밀해진다.

## 6. 기존 표는 남긴다

지우지 않는다. 폐기 표시만 붙이고, **엔진이 읽지 않게** 한다.

```
canonical.gift_trigger        제3자 큐레이터 태그 1,081짝 — 짝짓기 불가
canonical.gift_effect         같음
canonical.trigger_ref         .evaluability 는 이름 접미사로 지어낸 150건
canonical.effect_ref          effect 55종은 이름뿐
canonical.gift_trigger_param  정규식 6개로 11% 만 건짐
```

### 표시 방법

1. **Prisma 스키마** — 각 모델 위 `///` 주석 첫 줄에 폐기 사유와 대체를 적는다.

```prisma
/// **폐기됨 (2026-08-10)** — canonical.gift_ability 가 대신한다.
///
/// limbus-assets 만 갖는 제3자 큐레이터 태그다. 게임 데이터가 아니다.
/// 451 기프트 중 282(63%)가 트리거 수 ≠ 효과 수라 짝짓기가 원리상 불가능하고,
/// 이 표를 AND 로 읽어 「발동 불가」 174건 중 159건(91%)이 틀렸다.
/// 적재는 계속한다 — 출처가 말한 것을 지우지 않는다. 엔진만 읽지 않는다.
model GiftTrigger { … }
```

2. **적재기** — `src/v2/canonical/axis.ts` 등 파일 머리 주석에 같은 내용.

3. **엔진 경계 테스트** — 엔진이 폐기 표를 다시 읽지 못하게 한다.

```typescript
// lib/engine/v2/deprecated-tables.test.ts
test('엔진은 폐기된 표를 읽지 않는다', () => {
  const src = readFileSync('lib/engine/v2/load.ts', 'utf8');
  for (const t of ['giftTrigger', 'giftEffect', 'triggerRef', 'effectRef', 'giftTriggerParam']) {
    assert.equal(src.includes(`prisma.${t}.`), false, `${t} 를 다시 읽고 있다`);
  }
});
```

`trigger` · `effect` 어휘 자체는 폐기하지 않는다 — 출처가 말한 이름이고 `field_source` 에 `assets-only` 로 정직하게 적혀 있다.

## 7. 검증

### 적재 검증 (`v2:verify:canonical`)

```
gift_ability 행이 있는 기프트 수 ≥ 지금까지 검수 확정한 수
unconditional=true 인 능력에 조건 행이 없다
ordinal / group / idx 가 0 부터 빈틈없이 이어진다
refines 는 같은 (gift,level) 안의 실재하는 ordinal 을 가리킨다
refines 가 가리키는 능력은 그 자신이 refines=null 이다 (사슬 금지)
refKind='other' 가 아닌 모든 refId 가 canonical 에 실재한다
scope='slot' 이면 slot 이 1~5, 아니면 null
timing 이 §3 의 닫힌 어휘에 든다
기프트마다 refines=null 인 능력이 하나 이상 있다
```

### 결손 검증

```
threshold=null 인 조건마다 field_gap 행이 있다
  entity='gift_ability' · field='threshold' · reason 에 왜 못 정했는지
unconditional=false 인데 조건이 없는 능력마다 field_gap 행이 있다
  entity='gift_ability' · field='conds' — 「조건이 있는데 못 뽑았다」
timing='other' 마다 field_gap 행이 있다
```

### 판정 검증 (골든)

기존 `lib/engine/v2/golden.test.ts` 의 화상·진동 덱을 그대로 쓴다. 사용자가 짚은 세 건을 골든 사례로 박는다. 각 사례가 모형의 다른 축을 시험한다(§3 「세 사례로 본 모형」).

```
9052 휴대용 전지 소켓  → 발동 가능   (지금: 불가)   무조건 능력
9043 사원증            → 발동 가능   (지금: 불가)   group 내 OR
9073 엔도르핀 키트     → 발동 불가   (지금: 가능)   refines
   근거: 화진 덱 7인격 중 호흡 부여 스킬을 가진 것은 10916 하나뿐이고
        그마저 스킬 1개다 — coin_token 으로 확인했다
```

**세 건 모두 코드를 되돌리면 실패해야 한다.** PR-B 6번 태스크에서 골든이 자기가 존재하는 이유인 버그를 못 잡은 전례가 있다(사례가 `deployedIds` 를 아예 안 넘겨 버그 유무와 무관하게 같은 답이 나왔다). 되돌려 확인한다.

### 회귀 폭 측정

```
scripts/verdict-diff.ts
  옛 모형 vs 새 모형의 456 기프트 판정을 나란히 낸다
  바뀐 건수와 방향(불가→가능 · 가능→불가)을 보고한다
  기대: 「불가→가능」이 150건 안팎 — 층 3 실측과 맞아야 한다
```

## 8. 단계

이 스펙은 두 단계를 담는다. **PR 은 나눈다** — 1단계가 크고, 2단계는 1단계의 데이터가 있어야 검증된다.

### 1단계 — 데이터 (PR 1)

```
1  스키마    canonical.gift_ability · gift_ability_cond
             app.gift_ability_authored
2  폐기표시  기존 5개 표에 주석 · 엔진 경계 테스트
3  추출      scripts/extract-gift-ability.ts (2회) · diff · review 도구
4  검수      50개씩 회차. 확정분을 jsonl 에 커밋
5  적재      seed-authored → app → v2:build → canonical
6  검증      §7 의 적재·결손 검증
```

### 2단계 — 엔진 (PR 2)

```
7  판정      lib/engine/v2/evaluate.ts 를 §3 규칙으로 다시 쓴다
             ordinal 간 OR · refines 제외 · group 간 AND · group 내 OR
             runtime · threshold=null 은 배제하지 않는다
8  공급      Profile 이 편성 공급을 coin_token 으로 센다
             지금은 identity_axis — 인격이 「그 축을 가진다」까지만 알고
             「그 축을 실제로 주는 스킬이 몇 개인가」를 모른다. 9073 이
             그래서 통과했다
9  적재      load.ts 가 gift_ability 를 읽는다. 폐기 5표를 끊는다
10 골든      §7 의 세 사례 · 회귀 폭 측정 · 되돌려 실패 확인
11 화면      근거 모달이 새 구조를 보인다 (사용자가 「대충」이라 한 자리)
```

점수 모형 개선은 2단계 뒤 별도로 다룬다.

## 9. 남는 질문

- **검수 회차를 누가 도나.** 50개씩 10회차는 사용자 시간이다. LLM 두 판이 일치하는 건은 표본만 보고 넘길지, 전건을 볼지 결정이 필요하다. 스펙은 전건으로 적어 두었다.
- **`refKind='other'` 를 얼마나 허용하나.** 어휘에 못 담는 조건이 얼마나 나올지는 추출을 돌려야 안다. 1회차 50개에서 비율을 재고, 높으면 어휘를 늘린다.
- **ko 와 en 이 어긋나는 경우.** 9001 의 en 은 `Wrath Absolute Resonance`, ko 는 `분노 완전 공명` 으로 맞다. 어긋나는 건이 나오면 `field_gap` 에 기록하고 en 을 따른다 — 기존 출처 간 차이 규칙과 같다.

## 10. 이 스펙이 답하지 않는 것

`field_source` 에 파생 여부 이름표를 붙이는 안은 **기각했다.** 이름표는 「이 값이 맞는지 모르겠다」를 소비자에게 떠넘기는 장치다. 값을 맞게 만들면 사라져야 할 물건이므로 만들지 않는다.

다만 `field_gap` 은 이미 있는 정직한 기록이고, **엔진이 그것을 읽게 하는 것**은 이 스펙의 목표 2에 들어 있다.
