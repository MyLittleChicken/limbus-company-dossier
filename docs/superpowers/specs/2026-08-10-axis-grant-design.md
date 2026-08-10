# 인격이 어느 축의 인격인가 — 부여와 제한

> 결정 2026-08-10 · 상태 제안

## 1. 왜

추천 엔진이 9073 엔도르핀 키트를 화상·진동 편성에서 「유효」로 판정했다. 그 편성에는 호흡을 부여하는 인격이 없다.

```
9073  스킬 효과로 호흡 위력을 획득할 때마다 대상이 호흡 위력 1, 호흡 횟수 1 얻음
편성  10216 11216 11009 10916 10716 10512
엔진  axis/BREATH have=1 need=1 satisfied → 유효
```

`have=1` 은 10916 로쟈(거미집 엄지 아비)다. 그 인격의 패시브 **1091603 「보냐텔리 가문의 수치」** 는 이렇게 말한다.

> 가속탄 소모한 수치 1당, 호흡 2 얻음, 자신의 호흡 횟수 2 증가
> …
> **이 인격은 화상, 진동을 부여하는 인격으로만 취급됨**

호흡을 얻지만 호흡 인격이 아니다. 게임이 명시적으로 제한한다.

### 우리 모형에 「빼기」가 없다

`buildIdentityAxis`(`src/v2/canonical/identity-axis.ts:42`)는 세 경로를 **합치기만** 한다.

```
keyword         identity_keyword → axis
special_status  identity_status → status_category → axis
ego_granted     app.ego_granted_axis (저작 4행)
```

제한을 표현할 자리가 없다.

### 그런데 원본은 이미 제한을 반영했다

적재기 주석(`identity-axis.ts:54-55`)이 이렇게 적어 두었다.

> `keyword.id` 를 대문자화하면 축 id 다. mj 가 특수 키워드 파생과 **「~로만 취급됨」을 이미 반영해 담았으므로** 그대로 옮긴다

**이 가정은 참이다.** 제한 패시브를 가진 인격 넷을 전수 대조했다.

| 인격 | 패시브가 말하는 제한 | `identity_keyword` |
|---|---|---|
| 10109 이상 · 약지 점묘파 스튜던트 | 출혈로만 | Laceration |
| 10916 로쟈 · 거미집 엄지 아비 | 화상 · 진동으로만 | Combustion, Vibration |
| 11109 오티스 · 약지 점묘파 스튜던트 | 출혈로만 | Laceration |
| 10415 료슈 · 거미집의 검 | 화상 · 출혈 · 호흡으로만 | Breath, Combustion, Laceration |

넷 다 정확히 일치한다.

### 결함은 우리가 더한 두 번째 경로다

`special_status` 가 `keyword` 가 지킨 제한을 도로 무너뜨린다.

```
10916  keyword       Combustion · Vibration
       special_status + BREATH · BULLET          ← 9073 이 여기서 통과했다
10109  special_status + BURST · COMBUSTION · SINKING · VIBRATION
11109  special_status + BURST · COMBUSTION · SINKING · VIBRATION
10415  special_status + SINKING
```

전수로 재면 `special_status` 는 **`keyword` 의 진상위집합**이다.

```
인격 184 · keyword 를 가진 인격 179
keyword 짝                266
special_status 짝         300
겹침                      266    ← keyword 를 전부 품는다
special_status 만 더하는 짝  34
keyword 가 없는 5인격의 special_status 짝   0
```

**`special_status` 경로가 보태는 것은 0 이고 과대 34짝뿐이다.** `keyword` 가 없는 다섯(10201 · 10205 · 10305 · 10903 · 11206)은 `special_status` 도 비어 있어 이 경로로 구제되지 않는다.

### 스킬 증거로도 못 고친다

「스킬이 실제로 그 상태를 주는가」(`coin_token`)로 갈아타는 것도 답이 아니다. 초과 34짝을 스킬 증거로 대조했다.

```
제한 패시브 인격의 초과 11짝 중 스킬 근거가 있는 것  10
```

10916 의 스킬은 **실제로 호흡을 준다**(가속탄 소모 시). 그런데 게임이 그것을 호흡 부여로 취급하지 않는다. 1010902 는 아예 명시한다.

> 랜덤으로 화상, 출혈, 진동, 파열, 침잠을 부여하는 스킬이 이 효과로 인해서 **해당 키워드를 부여하는 스킬로 취급되지 않음**

**제한은 태그와 스킬 양쪽에 걸린다.**

### 부여 경로도 반쪽이다

`app.ego_granted_axis` 4행은 E.G.O 두 종만 담는다.

```
20109 엄숙한 애도  → SINKING · VIBRATION
20509 착영휘도     → BREATH · LACERATION
```

같은 일을 하는 다른 출처가 더 있는데 표현할 자리가 없다. 전수로 뽑았다(`취급` 문형, ko).

```
패시브 703 · 에고 패시브 113 · 기프트 793 · 에고 스킬 611  →  「취급」 31행
그중 축 부여·제한        출처 9건 → 저작 17행 (축마다 한 행)
     소속·스킬 분류 변경  출처 4건 → 이 PR 밖 (§4)
     무관(등급·부위·발동 취급 등)  나머지
```

| 출처 | id | 하는 일 |
|---|---|---|
| 패시브 | 1091603 | 화상 · 진동으로만 제한 |
| 패시브 | 1041502 | 화상 · 출혈 · 호흡으로만 제한 |
| 패시브 | 1010902 | 출혈로만 제한 + 랜덤 부여 스킬 무효 |
| 패시브 | 1110902 | 출혈로만 제한 + 랜덤 부여 스킬 무효 |
| 에고 패시브 | 2010911 | 진동 · 침잠 부여 (엄숙한 애도) |
| 에고 패시브 | 2050911 | 출혈 · 호흡 부여 (착영휘도) |
| 패시브 | 1081402 | 화상 · 출혈 부여 — **열선 보유 시** |
| 패시브 | 1111502 | 화상 · 출혈 부여 — **검 봉인 해제 시** |
| 기프트 | 9282 | 새벽 사무소 **소속 전원**에게 화상 · 진동 — 편성 3인 이상일 때 |
| 기프트 | 9280 | S사 1인을 **검계 소속으로** 취급 |
| 기프트 | 9841 | W사 아닌 1인을 **W사 소속으로** 취급 |
| 패시브 | 1021504 · 1061404 | 기본공격 · 반격을 **충전 획득 스킬로** 취급 |

셋이 드러난다.

1. **부여는 조건부다.** 장착 · 보유 · 편성 인원 · 상태 보유.
2. **대상이 인격만이 아니다.** 9282 는 소속 단위로 걸고, 9280 · 9841 은 소속 자체를 바꾼다.
3. **태그와 스킬 양쪽에 걸린다.** 2050911 은 「이 인격은 출혈 · 호흡 인격으로 취급」과 「기본 스킬이 출혈 · 호흡 부여 스킬로 취급」을 함께 말한다.

## 2. 목표 · 비목표

### 목표

1. `identity_axis` 가 게임의 제한을 지킨다.
2. 축 부여 · 제한을 **한 표에서 공통으로** 다룬다 — 패시브 · 에고 패시브 · 기프트가 같은 구조를 쓴다.
3. 「이 인격은 어느 축의 인격인가(태그)」와 「이 인격의 스킬이 그 축을 주는가(스킬)」를 갈라 낸다.

### 비목표

- **패시브 효과 전반을 구조화하지 않는다.** 축 부여 · 제한 15행만 다룬다. `passive` 는 `id · conditions[] · cond_type` 뿐이고 효과는 `passive_text` 산문에만 있다는 사실은 §7 에 결손으로 기록한다.
- **기프트 발동 조건은 이 PR 에서 다루지 않는다.** 별도 스펙(`2026-08-10-gift-ability-model-design.md`)이 456 기프트를 다룬다. 이 PR 은 그 스펙이 딛고 설 바닥이다.
- **점수 모형을 손대지 않는다.**
- `identity_status` 표를 지우지 않는다 — 출처가 말한 사실이다. 축을 그것에서 **유도하지 않을** 뿐이다.

## 3. 데이터 모형

### `app.axis_grant` — 저작

```prisma
/// 축을 인격에 주거나 제한하는 효과. 패시브 · 에고 패시브 · 기프트가 같은 구조를 쓴다.
///
/// 게임이 「…을 부여하는 인격으로 취급됨」 · 「…으로만 취급됨」이라 말하는 자리다.
/// 전수 15행(2026-08-10 기준). 새 인격·기프트가 나오면 여기에 는다.
model AxisGrant {
  id         String
  /// passive · ego_passive · gift
  sourceKind String  @map("source_kind")
  /// 1091603 · 2050911 · 9282
  sourceId   String  @map("source_id")
  /// add        이 축을 더한다
  /// restrict   **이 축들로만** 취급한다 — 나머지를 덜어낸다
  mode       String
  /// self(그 패시브를 가진 인격) · association · unit_keyword
  targetKind String  @map("target_kind")
  /// targetKind 가 self 가 아닐 때의 대상. self 면 ''
  targetId   String  @map("target_id")
  /// COMBUSTION · VIBRATION · … . mode=restrict 면 남길 축들을 행마다 하나씩
  axisId     String  @map("axis_id")
  /// tag(인격 취급) · skill(스킬 취급) · both
  affects    String
  /// always · ego_equipped · gift_held · roster_count · status_held
  gateKind   String  @map("gate_kind")
  /// gateKind 가 가리키는 대상. always 면 ''
  gateRef    String  @map("gate_ref")
  /// roster_count 일 때의 최소 인원. 아니면 null
  gateMin    Int?    @map("gate_min")
  /// 왜 이렇게 적었는가. 원문 한 줄을 남긴다. 지문에는 안 들어간다
  note       String

  @@id([id])
  @@index([sourceKind, sourceId])
  @@map("axis_grant")
  @@schema("app")
}
```

`app.ego_granted_axis` 4행은 이 표에 흡수하고 그 표를 폐기 표시한다(§6).

### `canonical.identity_axis` — 바뀌는 것

```
source 어휘
  keyword       identity_keyword → axis          (정본. 제한이 이미 반영됨)
  granted       axis_grant 의 add 행             (ego_granted 를 대신한다)
  ✗ special_status                               경로를 없앤다
```

`identity_axis` 에 칸을 하나 더한다.

```prisma
/// 이 축이 태그로 오는가 스킬로 오는가.
/// tag · skill · both — axis_grant.affects 와 같은 어휘다.
/// keyword 경로는 언제나 'both' 다(게임이 인격을 그렇게 분류하면 스킬도 그렇게 친다).
affects String
```

`ego_id` 는 그대로 두되 뜻을 넓힌다 — `gate_ref` 를 담는다(E.G.O id · 기프트 id · 소속 id). 이름을 `gate_ref` 로 바꾼다.

### `canonical.axis_restrict` — 제한은 따로 굽는다

제한은 관계가 아니라 **필터**다. 합집합에 섞으면 안 된다.

```prisma
/// 이 인격은 이 축들로만 취급된다.
///
/// 소비자는 identity_axis 를 읽은 뒤 이 표로 교집합을 취한다.
/// affects 가 skill 이면 coin_token 으로 센 공급에도 같은 교집합을 건다 —
/// 10916 의 스킬은 실제로 호흡을 주지만 게임이 그것을 호흡 부여로 치지 않는다.
model AxisRestrict {
  identityId String @map("identity_id")
  axisId     String @map("axis_id")
  affects    String
  sourceId   String @map("source_id")

  @@id([identityId, axisId, affects])
  @@map("axis_restrict")
  @@schema("canonical")
}
```

### 공급을 세는 규칙 — 코드에 산다

```
tag 공급(이 인격은 어느 축의 인격인가)
  1  base   = identity_keyword → axis
  2  add    = axis_grant(mode=add, affects∈{tag,both}) 중 gate 를 충족한 것
  3  axes   = base ∪ add
  4  axis_restrict(affects∈{tag,both}) 가 있으면  axes = axes ∩ 그 축들

skill 공급(이 인격의 스킬이 그 축을 주는가)
  1  base   = coin_token → status_category → axis
  2  add    = axis_grant(mode=add, affects∈{skill,both}) 중 gate 를 충족한 것
  3  axes   = base ∪ add
  4  axis_restrict(affects∈{skill,both}) 가 있으면  axes = axes ∩ 그 축들

gate 충족
  always        언제나
  ego_equipped  편성이 그 E.G.O 를 장착했는가
  gift_held     그 기프트를 보유했는가
  roster_count  gate_ref 소속 인격이 편성에 gate_min 명 이상인가
  status_held   전투 중에만 안다 → 편성만 보고 배제하지 않는다(런타임)
```

## 4. 저작 17행 (출처 9건)

전수를 손으로 적는다. 산문에서 뽑지 않는다 — 이 규모는 파서를 만들 자리가 아니다.

```
제한 · 출처 4건 → 7행 · affects=both
  1091603  10916      COMBUSTION VIBRATION
  1041502  10415      BREATH COMBUSTION LACERATION
  1010902  10109      LACERATION
  1110902  11109      LACERATION

부여 · E.G.O 장착 · 출처 2건 → 4행
  2010911  ego_passive 20109  SINKING VIBRATION    gate=ego_equipped:20109  affects=both
  2050911  ego_passive 20509  BREATH LACERATION    gate=ego_equipped:20509  affects=both

부여 · 그 밖의 조건 · 출처 3건 → 6행
  1081402  passive     COMBUSTION LACERATION  gate=status_held:열선     affects=both
  1111502  passive     COMBUSTION LACERATION  gate=status_held:검봉인   affects=both
  9282     gift        COMBUSTION VIBRATION   gate=roster_count:DAWN_OFFICE min=3
                       target_kind=association target_id=DAWN_OFFICE  affects=both
```

소속을 바꾸는 9280 · 9841 과 스킬 종류를 바꾸는 1021504 · 1061404 는 **축이 아니라 소속/스킬 분류**를 건드린다. 이 PR 에서 다루지 않고 `field_gap` 에 기록한다(§7).

`gate_kind='status_held'` 두 건은 전투 중 상태라 편성만 보고 판정할 수 없다. 소비자가 「배제하지 않는다」로 다루도록 그대로 적재한다.

## 5. 검수

17행이라 전건을 사람이 본다. 원문 한 줄을 `note` 에 담아 대조할 수 있게 한다.

```
scripts/review-axis-grant.ts
  행마다: 출처 원문 한 줄 · 저작한 구조 · 그 인격의 현재 축
```

## 6. 폐기 표시

지우지 않는다. 주석과 경계 테스트만 둔다.

```
app.ego_granted_axis            axis_grant 가 흡수한다
identity_axis.source='special_status' 경로   과대 34짝만 만들었다
```

`identity_status` 는 폐기하지 않는다 — 출처가 말한 사실이고 `field_source` 에 정직하게 적혀 있다. 축을 그것에서 유도하지 않을 뿐이다.

`src/v2/canonical/identity-axis.ts:54-55` 의 주석은 **참이었으므로 지우지 않고** 왜 그것만으로 부족했는지를 덧붙인다.

## 7. 결손 기록

```
entity='identity_axis' field='special_status'
  reason  특수 상태로 축을 유도하면 게임의 「…으로만 취급됨」을 무너뜨린다.
          keyword 가 이미 제한을 반영하므로 이 경로를 쓰지 않는다
entity='passive' field='effect'
  reason  패시브 효과를 상태와 잇는 구조화된 표가 없다. passive 는
          id·conditions[]·cond_type 뿐이고 효과는 passive_text 산문에만 있다.
          축 부여·제한 15행만 저작으로 건졌다
entity='gift' field='association_grant'   (9280 · 9841)
  reason  소속 자체를 바꾸는 효과를 담을 자리가 없다
entity='passive' field='skill_kind_grant' (1021504 · 1061404)
  reason  스킬 분류를 바꾸는 효과를 담을 자리가 없다
```

## 8. 검증

### 적재 검증 (`v2:verify:canonical`)

```
identity_axis 에 source='special_status' 인 행이 없다
axis_restrict 를 가진 인격의 identity_axis 축이 전부 그 제한 안에 든다
axis_grant 의 axisId 가 전부 canonical.axis 에 실재한다
axis_grant 의 sourceId 가 sourceKind 에 맞는 표에 실재한다
mode='restrict' 인 행은 targetKind='self' 다
gateKind='roster_count' 면 gateMin 이 1 이상, 아니면 null
```

### 실측 대조

```
제한 인격 넷의 축이 패시브 문장과 정확히 일치한다
  10109 → LACERATION
  10415 → BREATH COMBUSTION LACERATION
  10916 → COMBUSTION VIBRATION
  11109 → LACERATION
identity_axis 짝이 266 + granted 분이다 (지금 300 에서 special_status 34 를 뺀 값)
```

### 판정 검증 (골든)

```
덱 A  10216 11216 11009 10916 10716 10512
  9073 엔도르핀 키트 → 발동 불가
     10916 의 스킬은 호흡을 주지만 1091603 이 화상·진동으로 제한한다
     tag 공급과 skill 공급 **양쪽에서** 0 이어야 한다
     지금은 유효로 판정한다 — 되돌리면 실패해야 한다

덱 C  E.G.O 장착 대조
  20509 착영휘도를 낀 뫼르소 → BREATH · LACERATION 이 생긴다
  안 낀 같은 편성        → 안 생긴다
     gate_kind='ego_equipped' 가 실제로 사는지 본다
```

**되돌려 확인한다.** 골든이 자기가 존재하는 이유인 버그를 못 잡은 전례가 있다.

### 회귀 폭 측정

```
scripts/axis-diff.ts
  옛 identity_axis vs 새 identity_axis 를 인격별로 나란히 낸다
  기대: 34짝이 빠지고 granted 조건부 행이 는다
  기프트 판정이 몇 건 바뀌는지도 함께 낸다
```

## 9. 남는 질문

- **`keyword` 가 언제나 옳은가.** 넷은 확인했다. 나머지 175 인격은 제한 패시브가 없어 대조할 것이 없다. `keyword` 짝 266 중 스킬 근거가 없는 것이 58 인데, 이는 패시브·에고가 주는 축으로 보이며 `keyword` 가 더 넓은 것이 정상이다. 그러나 전수 검증은 못 한다 — `field_gap` 에 적어 둔다.
- **`status_held` 게이트 둘을 어떻게 셀 것인가.** 편성만 보고는 모른다. 이번에는 「배제하지 않는다」로 두고, 점수 회차에서 확률로 다룰지 정한다.
- **9282 는 기프트가 축을 준다.** 추천 엔진이 「이 기프트를 얻으면 다른 기프트가 켜진다」를 이미 사슬로 다루는데, 축 부여는 그보다 강하다. 사슬과 어떻게 맞물릴지는 기프트 능력 스펙에서 정한다.
