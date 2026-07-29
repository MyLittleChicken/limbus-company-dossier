# 회차 2 — `limbus-data-mj/identities_detail.json`

> **정본** · 인격 상세 · **184건** · 347 KB · 최상위 **객체**(키 = 인격 id 문자열) · 키 **16종**
> 출처 커밋 `97c38567` · 스냅샷 2026-07-25 · 정리 2026-07-29

## 파일 정체

회차 1이 요약만 갖고 있던 스탯의 **정본**이다. 그리고 회차 1에 없던 연결 고리가 여기 있다 —
스킬·패시브의 id 목록, 정신력 변동 조건, 유닛 키워드.

**회차 3(스킬)과 회차 4(패시브)의 진입점**이다.

| 회차 1과 겹침 | `id` · `hp` · `resists` · `stagger` · `associations` |
| --- | --- |
| **여기만 있음** | `defCorrection` · `minSpeed` · `maxSpeed` · `mentalCondition` · `attackSkills` · `defenseSkills` · `panicSkill` · `battlePassives` · `supporterPassives` · `unitKeywords` · `appearance` |

### 대조한 출처

| 출처 | 무엇을 대조했나 |
| --- | --- |
| `limbus-data-mj/identities.json` | 겹치는 5필드 |
| `limbus-data-mj/skills.json` | 스킬 이름·죄악·방어 유형 |
| `limbus-data-mj/passives.json` | 패시브 이름·설명·`cost` |
| `limbus-assets/identities.json` | `skillTypes` · `defenseSkillTypes` · `defCorrection` · `tags` |
| `limbus-assets/passives.json` | 패시브 발동 조건(죄악 자원) |
| `loc-ko/UnitKeyword*.json` 12개 | `unitKeywords` 표시명 133종 |
| [Limbus Company Wiki](https://limbuscompany.fandom.com) | 방어 레벨 계산식 · 패시브 해금 단계 · 패닉·침식 |

---

## 회차 1과 겹치는 5필드 — 차이만

184건 전수 대조 결과다.

| 필드 | 회차 1 | 회차 2 | 판정 |
| --- | --- | --- | --- |
| `id` | `Int` | `Int` + 객체 키 | **완전 일치.** 객체 키는 문자열, 내부 `id` 는 숫자 |
| `hp` | `72` | `{defaultStat: 72, incrementByLevel: 2.48}` | base **184/184 일치**. 회차 1엔 **증가량이 없다** |
| `resists` | `{slash:2,…}` | 동일 | **184/184 완전 일치.** 차이 없음 |
| `stagger` | `[65,35,15]` | 동일 | **184/184 완전 일치.** 차이 없음 |
| `associations` | `["LIMBUS_COMPANY",…]` | 동일 | **184/184 완전 일치.** 차이 없음 |

**실질 차이는 `hp` 하나뿐이다.** `resists`·`stagger`·`associations` 는 완전 중복이며,
detail 을 정본으로 두는 실익은 **레벨당 증가량**과 아래의 속도 단계뿐이다.

`id` 는 조회 키로만 쓴다(`src/entities/identities.ts:62`). 회차 1의 인격에 detail 이 없으면
`ctx.report.unmapped('인격 상세 없음')` 을 남기고 **그 인격을 통째로 건너뛴다**. 184/184라
발동하지 않는다. 조인 시 **객체 키가 문자열**이므로 `String(m.id)` 로 맞춘다.

---

## 스탯

### `hp` — 체력

| | |
| --- | --- |
| 타입·실측 | `{defaultStat: Int, incrementByLevel: Float}` · 184/184 |
| `defaultStat` | 범위 57–108 · 유일값 29종 · 중앙값 76 |
| `incrementByLevel` | **39종 · 2.07 ~ 3.41** · 최다 2.28(23건) · 2.82(20건) · 2.39(18건) |
| 의미 | 실제 체력 = `defaultStat + incrementByLevel × 레벨` |
| 변환 | `detail.hp?.defaultStat ?? 0` · `detail.hp?.incrementByLevel ?? 0` |
| 적재 | `identity.hp_base` · `identity.hp_per_level` |
| 화면 | 상세 "체력" — `72 + 2.48/레벨` |
| 함정 | 없음 |

레벨 성장이 있는 게임이라 기본값과 증가량이 나뉜 것은 정상이다.
**등급과 체력은 무관하다**(`000` 평균 76.4 < `00` 평균 76.9). 체력은 등급이 아니라 역할을 따른다 —
최고 체력 108의 `11210` 라만차랜드 신부(그레고르)는 혈귀 탱커다.

### `defCorrection` — 방어 레벨 보정치

| | |
| --- | --- |
| 타입·실측 | `Int` · 184/184 · 범위 **−4 ~ +5** · 값 10종 |
| 분포 | `0`:34 · `2`:28 · `-2`:26 · `3`:22 · `-1`:17 · `5`:16 · `-4`:15 · `1`:12 · `-3`:8 · `4`:6 |
| 의미 | **방어 레벨 보정치** |
| 교차대조 | `limbus-assets/identities.json` 의 `defCorrection` 과 184/184 일치 |
| 변환 | `detail.defCorrection ?? 0` 통과 |
| 적재 | `identity.def_correction` |
| 화면 | 상세 "방어 보정" — 숫자만 |
| 함정 | 66건이 0 이하다. 부호가 의미를 가르므로 절댓값만 보면 안 된다 |

[Battles](https://limbuscompany.fandom.com/wiki/Battles) 확인.

> Every unit possesses a base **offense level equal to their level**. Every unit also possesses a
> **defense level equal to their current level and the defense level modifier**, which may be
> positive or negative. For every point of offense level of the attacking skill **above** the
> defense level of the attacked target, the skill deals **3% more damage.**

```
공격 레벨 = 현재 레벨                       (보정 없음)
방어 레벨 = 현재 레벨 + defCorrection       (보정 있음)
피해 배율 = 1 + 0.03 × (공격 레벨 − 방어 레벨)
```

실측 범위 −4 ~ +5 는 동레벨 기준 **피해 ±12% ~ −15%** 에 해당한다.

등급과 약하게 상관한다 — `0`등급 평균 −1.17 · `00` +0.25 · `000` +0.71. 범위가 겹쳐
개별 인격은 추정할 수 없다.

### `minSpeed` / `maxSpeed` — 동기화 단계별 속도

| | |
| --- | --- |
| 타입·실측 | `Int[]` 둘 다 · 184/184 · **길이 4 고정** · 값 1–8 |
| 의미 | 인덱스가 **동기화 단계 1–4**. `minSpeed[i]` ~ `maxSpeed[i]` 가 그 단계의 속도 범위 |
| 변환 | 두 배열을 단계별로 짝지어 4행 생성(`buildIdentities` 의 `UPTIES` 루프) |
| 적재 | `identity_speed(identity_id, uptie, min, max)` — **736행**(184 × 4) |
| 화면 | 상세 "속도" 4행 — `동기화 1  4 – 6` |
| 함정 | 회차 1의 `speed` 는 이 배열의 **`[3]`(동기화 4)** 요약이다. 1단계와는 0/184 |

```
10101   minSpeed [4,4,4,4]   maxSpeed [6,7,8,8]
        동기화 1  4–6    2  4–7    3  4–8    4  4–8
```

**검증 184건 전수**

```
길이 4/4              184/184
모든 단계 min ≤ max    184/184
minSpeed 비감소        184/184
maxSpeed 비감소        183/184        ← 1건 예외
```

**성장은 동기화 2·3에 몰려 있다.**

```
평균 증가폭   min  1→2 +0.22   2→3 +0.53   3→4 +0.00
             max  1→2 +0.71   2→3 +0.67   3→4 +0.01
```

3→4에서 속도가 변하는 인격은 `10813` 정사무소 대표(이스마엘) **1건**뿐이다(`max` 7→8).

**역행 1건은 의도된 설계다.**

```
11214 로보토미 E.G.O:: 램프 (그레고르)
  minSpeed [1,1,1,1]   maxSpeed [6,5,4,4]      동기화할수록 상한이 내려간다
```

도발 기믹 탱커다. 느리게 행동하면서 적의 공격을 받아내거나 합을 거는 인격이라,
속도 상한이 내려가는 것이 **강화**다.

### `mentalCondition` — 정신력 변동 조건

| | |
| --- | --- |
| 타입·실측 | `{ add: Entry[], min: Entry[] }` · **184/184 둘 다 존재** |
| `Entry` | `{ level: Int, conditionIDList: [{conditionID: String}] }` |
| `level` | **368건 전부 `1`** — 분산 0 |
| 길이 | `add` 3개:179 · 4개:4 · 2개:1 / `min` 1개:180 · 2개:4 |
| 의미 | **`add` = 정신력 증가 조건 · `min` = 감소(minus) 조건** |
| 변환 | — |
| 적재 | **미적재** |
| 화면 | 미표시 |
| 함정 | 키 이름 `min` 이 "최소값"으로 읽히지만 **감소**다 |

인게임 정신력 안내 문구와 1:1로 대응한다. `10613` 홍원 군주로 확인했다.

```
add                                                  인게임 문구
  OnWinDuelAsParryingCountMultiply10AndPlus20Percent  합 승리 시 합 횟수 비례 증가
                                                      (기본 10, 2합부터 1합당 20%)
  OnKillEnemyMp10                                     적 처치 시 레벨 관계없이 10 증가
  OnKillEnemyByOtherAlly5                             아군이 처치 시 5 증가
  OnDieAllyMp5                                        아군 사망 시 5 증가
min
  OnLoseDuelAsParryingCountMultiply5AndPlus10Percent  합 패배 시 감소
```

**`conditionID` 는 문장을 이름에 인코딩한다 — 23종**

```
On + 사건 + [기준] + 수치

OnWinDuel   AsParryingCount Multiply10 AndPlus20Percent   합 승리 · 합 횟수 ×10 · +20%
OnKillEnemy AsLevelRatio    Multiply10                    적 처치 · 레벨 비례 ×10
OnKillEnemy Mp10                                          적 처치 · 고정 10
OnDieAlly   AsLevelRatio10                                아군 사망 · 레벨 비례 10
```

계산 방식이 두 갈래다 — `AsLevelRatio`/`AsParryingCount`(비례) vs `Mp{n}`(고정).
인게임 문구의 *"레벨에 관계 없이 10 증가"* 가 정확히 `Mp10` 이다.

**표준 조합이 167/184.**

```
add   합 승리 · 적 처치(레벨 비례) · 아군이 처치(레벨 비례)
min   OnDieAllyAsLevelRatio10
```

벗어난 17건이 개성이다. **아군 사망이 `add`(증가)에 든 인격 3건**이 대표적이다.

```
10613 홍원 군주 (홍루)          OnDieAllyMp5     흑수를 부리는 군주
10415 거미집의 검 (료슈)         OnDieAllyMp10    거미집 인격을 직접 죽이는 복수자
10808 피쿼드호 선장 (이스마엘)    OnDieAllyMp10
```

컨셉이 데이터에 그대로 드러난다.

---

## 스킬 연결

### `attackSkills` — 공격 스킬

| | |
| --- | --- |
| 타입·실측 | `Array<{slot, copies, skillId}>` · 184/184 |
| 길이 | **3개:146 · 4개:20 · 5개:7 · 6개:9 · 7개:1 · 10개:1** |
| `slot` | 1·2·3 (S1·S2·S3) |
| `copies` | 0:72 · 1:184 · 2:184 · 3:184 |
| 변환 | — (스킬은 회차 3 `skills.json` 이 정본) |
| 적재 | **미적재** — `skill.identity_id` 로 역참조한다 |
| 화면 | 스킬 패널이 이 관계로 그려진다 |

**`copies` = 덱 매수. 기본 3스킬이 고정 규칙이다.**

```
slot 1 → copies 3     184/184
slot 2 → copies 2     184/184
slot 3 → copies 1     184/184        예외 0건
```

회차 1의 `deckCount`(assets `num`)와 같은 값이다.

**`copies: 0` = 대체 스킬. 72개.**

```
slot 1 에 16개 · slot 2 에 11개 · slot 3 에 45개
```

대체 스킬은 **S3에 몰려 있다.** 보유 인격은 38건이며 최다는 `11115` 거미집 중지 아비 —
10개 중 7개가 대체 스킬이다.

**`skillId` 는 인격 id 로 시작한다** — `1011501 = 10115 + 01`. **624건 전부 준수**(예외 0).

**함정 — `limbus-data-mj` 가 `limbus-assets` 보다 넓다**

```
공격 스킬 id 집합 일치      180/184
limbus-data-mj 에만 있는 스킬  6개
limbus-assets 에만 있는 스킬   0개
```

```
10712 흑운회 와카슈 (히스클리프)   1071205  색욕 참격 tier1  "뒷골목의 규칙"
10715 중지 작은 형님              1071506  질투 타격 tier3
                                 1071507  분노 타격 tier1
11115 거미집 중지 아비             1111510  질투 타격 tier3
                                 1111511  질투 타격 tier3
11216 새벽 사무소 대표             1121607  분노 참격 tier3
```

**회차 1의 "대체 스킬 보유 37건"은 `limbus-assets/identities.json` 기준이었고,
이 파일 기준으로는 38건이다** — `10712` 흑운회 와카슈가 assets 쪽에서 누락돼 있다.

이 6개 중 5개는 `limbus-data-mj/skills.json` 에 이름이 비어 있다. 회차 3·12에서 볼 자리다.

### `defenseSkills` — 방어 스킬

| | |
| --- | --- |
| 타입·실측 | `Int[]` · 184/184 · **길이 1:159 · 2:22 · 3:3** |
| 값 | 스킬 id. `attackSkills` 와 달리 **객체가 아니라 id 배열** |
| 변환 | — |
| 적재 | **미적재** — `skill.def_type` 이 `attack` 이 아닌 행으로 구분된다 |
| 화면 | `components/uptie-skills.tsx` 가 공격 스킬과 같은 깊이로 표시(`05-ui-foundation` 4.3) |

**방어 유형 3종** — `guard` 90 · `counter` 74 · `evade` 48.
죄악은 고르다 — 우울 39 · 오만 34 · 색욕 34 · 폭식 33 · 질투 26 · 분노 25 · 나태 21.

**방어 스킬을 여럿 가진 인격 25건.** 죄악이 다른 방어 스킬을 함께 갖기도 한다.

```
10508 검계 우두머리      1050804 반격/질투 "살주"      1050805 반격/오만 "골단"
10916 거미집 엄지 아비    1091604 반격/오만 "꺼져!"     1091608 회피/우울 "예지"
11015 거미집 소지 제자    1101504 수비/오만 "수[守]"    1101505 회피/오만 "회[回]"
```

회차 1의 `atkSins` 는 공격 3스킬만 세므로 **이 죄악들은 거기 안 잡힌다.**

**함정 — 여기도 `limbus-data-mj` 가 넓다**

```
limbus-assets/identities.json 의 defenseSkillTypes 와 일치   179/184

10212 흑수 - 묘 필두      mj 3개 · assets 2개
10306 중지 작은 아우      mj 2개 · assets 1개
10710 와일드헌트          mj 2개 · assets 1개
10814 거미집 중지 제자     mj 2개 · assets 1개
11012 중지 작은 아우      mj 3개 · assets 1개
```

`limbus-assets/identities.json` 이 놓친 스킬은 공격 6개 + 방어 6개 = **총 12개**다.

### `panicSkill` — 패닉 스킬

| | |
| --- | --- |
| 타입·실측 | `Int` · 184/184 · **유일값 1종** `1000104` |
| 대상 스킬 | `sin: null` · `attackType: null` · `defType: "non_action"` · tier 1 · **"E.G.O 침식"** |
| 의미 | 패닉 상태의 자리표시 스킬. **전 인격 공용** |
| 변환 | — |
| 적재 | **미적재** — 분산 0 |
| 화면 | 미표시 |
| 함정 | ① id가 `1000` 대로 **인격 id 대역(`10101`–`11216`) 밖**이다 ② `defType: "non_action"` 은 스키마 enum 4종(`attack`/`guard`/`evade`/`counter`)에 **없는 값** — 회차 3에서 확인 |

[E.G.O/Gameplay](https://limbuscompany.fandom.com/wiki/E.G.O/Gameplay) · [Battles](https://limbuscompany.fandom.com/wiki/Battles) 확인.

```
패닉    SP −45 도달 → 스태거처럼 행동 불가, 다음 턴에 SP 0 으로 초기화
침식    E.G.O 사용으로 SP 가 −45 이하로 떨어지면 강제 발동
        SP 가 음수인 동안에는 확률적으로 발동 (확률이 UI에 % 표시)
        각성판보다 강하지만 조준 불가·무차별 — 아군을 칠 수 있다
        고유 E.G.O(ZAYIN)만 갖고 있으면 침식하지 않는다
```

**패닉과 침식은 별개 분기다.** 이 필드는 패닉 쪽 마커이며, 실제 침식판 스킬은 E.G.O에 붙으므로
E.G.O 편에서 다룬다.

---

## 패시브 연결

### `battlePassives` / `supporterPassives`

| | |
| --- | --- |
| 타입·실측 | `Array<{level: Int, passives: Int[]}>` · 184/184 둘 다 |
| `battlePassives` 길이 | 1:71 · 2:71 · 3:39 · 4:3 |
| `supporterPassives` 길이 | 1:154 · 2:30 |
| `passives` 길이 | 전투 1:202 · 2:87 · 3:39 · 4:10 · 5:3 · 6:1 / **지원은 전부 1** |
| 패시브 id | **768/768이 인격 id로 시작**(예외 0) |
| 변환 | `src/entities/skills.ts:415` — `kind` 를 `combat`/`support` 로 붙여 순회, `folded` Map으로 접는다 |
| 적재 | `identity_passive(identity_id, passive_id, kind, uptie)` |
| 화면 | 상세 "패시브" 패널 — `전투`/`지원` · `동기화 N` 태그 |

**두 패시브를 가르는 것은 발동 조건이다**([Identities](https://limbuscompany.fandom.com/wiki/Identities)).

```
전투 패시브   출전 중 발동
지원 패시브   편성돼 있으나 출전하지 않은 동안 발동
```

**대상과 효과는 패시브마다 다르다.** 위키의 "usually only affecting themselves" 는 경향
서술이므로 정의로 쓰지 않는다.

해금 단계도 위키가 확인해준다 — **전투 패시브는 동기화 2, 지원 패시브는 동기화 3.**
데이터의 `level` 분포와 맞는다.

```
battlePassives      level 1:72 · 2:171 · 3:17 · 4:82
supporterPassives   level 3:184 · 4:30        184건 전부 동기화 3
```

**함정 1 — 델타가 아니라 스냅샷이고, 교체가 일어난다**

각 `level` 의 `passives` 는 그 단계의 **전체 목록**이다. 상위 단계가 이전을 그대로 포함하지 않는다.

```
전이 158건 중   이전을 포함 63 · 교체 발생 95 · 개수 감소 0
```

```
11115 거미집 중지 아비
  lv1  [1111502, 1111503, 1111504, 1111505]
  lv2  [1111502, 1111503, 1111504, 1111505, 1111501]          ← 1개 추가
  lv3  [1111502, 1111513, 1111504, 1111505, 1111506, 1111501]
              ↑ 1111503 → 1111513 교체 + 1111506 추가
```

**함정 2 — `01` → `11` 은 강화판이다**

가장 흔한 교체 패턴이며, id 뒤 두 자리가 `01` → `11` 로 바뀐다.
`limbus-data-mj/passives.json` 을 보면 **이름은 같고 설명이 늘어난다.**

```
1010301 "냉정"  cost=[CheckAwakenLevel2]   합 승리 시 호흡 횟수 1 증가
1010311 "냉정"  cost=[CheckAwakenLevel4]   합 승리 시 호흡 횟수 1 증가
                                          + 호흡 횟수 5당 코인 위력 +1 (최대 3)

1010601 "비워낸 생각"  Lv2   … 신속 1 (최대 2)
1010611 "비워낸 생각"  Lv4   … 신속 1 (최대 3)        ← 상한만 상승
```

`cost` 는 **해금 동기화 단계**를 담는다. 709건 전수 분포는 다음과 같다.

```
cost 없음 105 · 빈 배열 5 · 길이 1 이 599

CheckAwakenLevel2            286
CheckAwakenLevel3            202
CheckAwakenLevel4            105
CheckAwakenLevelBetween_2_4    3
CheckAwakenLevel5              3        ← 게임 최대가 4인데 5가 있다
```

`CheckAwakenLevel5` 3건은 아직 없는 동기화 5를 가리킨다. 위키가
*"maximum level and Uptie Tiers are set to increase"* 라 한 것과 이어진다.

**함정 3 — 죄악 자원 요건은 이 파일에 없다**

패시브는 죄악 자원을 요구한다. 그 정보는 `limbus-assets/passives.json` 에만 있다.

```jsonc
// limbus-assets/passives.json
"support": {
  "10101": [{ "uptie": 3,
    "passives": [{ "name": "Information Neutralization",
      "condition": { "type": "owned",
                     "requirement": [{ "type": "gloom", "value": 4 }] } }] }]
}
```

우울 죄악 자원 4 이상 보유 시 발동한다는 뜻이며, `passive.cond_type` 과
`passive_requirement` 로 적재된다(`src/entities/skills.ts:386`).

**두 출처가 서로 다른 조각을 갖는다.**

```
limbus-data-mj/passives.json    이름 · 설명(한국어 포함) · cost(동기화 조건)
limbus-assets/passives.json     발동 조건(죄악 자원) · uptie · 영문 이름·설명
```

---

## 분류와 외형

### `unitKeywords` — 유닛 키워드

| | |
| --- | --- |
| 타입·실측 | `String[]` · 184/184 · 길이 1:35 · 2:102 · 3:41 · 4:3 · 5:2 · 7:1 |
| 값 | **36종** |
| 변환 | — |
| 적재 | **미적재** |
| 화면 | 미표시 |

**회차 1의 「특성 키워드」와 같은 계보다.** `loc-ko/UnitKeyword*.json` 12개 파일에 표시명
133종이 있고, 인격이 쓰는 36종 중 **25종이 여기 걸린다.**

```
FIXER            해결사        58건      BLOODFIEND       혈귀       5건
CLAN             조직          22건      SMOKE_WAR        연기전쟁    1건
FINGER           손가락        20건      WAR_HERO         전쟁영웅    1건
EGO_EQUIPMENT    E.G.O 장비    19건      UNDERBOSS_FIRED  언더보스    1건
LOBOTOMY_HEAD    로보토미 본사   9건      DIHUI_STAR       지혜성     1건
BLACK_BEAST      흑수           9건
```

**`limbus-data-mj` 는 특성 키워드를 두 필드로 쪼개 담는다** — 조직은 회차 1의 `associations`,
그 외(계급·이력·플래그)는 여기다.

```
10916 거미집 엄지 아비

  associations   THUMB_FINGER · SPIDER_HOUSE                        조직
  unitKeywords   SMALL · UNDERBOSS_FIRED · FINGER · SMOKE_WAR ·
                 WAR_HERO · SPIDER_HOUSE_FATHER ·
                 THUMB_LEVEL_MIDDLE_CAPO_UNDERBOSS                  계급·이력·플래그
  assets tags    7종을 한 배열에 전부
```

개수만 보면 **mj가 더 많음 181건 · 같음 3건 · assets가 더 많음 0건**으로 뒤집히지만,
담는 것이 다르다. `unitKeywords` 에는 **표시명이 없는 내부 플래그가 11종** 섞여 있다.

```
182  SMALL
 12  BASE_APPEARANCE                            기본 인격 (BaseAppearance 12건과 일치)
  5  SALSOO · SPIDER_HOUSE_FATHER
  4  BUTLER · SPIDER_HOUSE_DISCIPLE
  1  CAN_NOT_USING_INDEX_UNLOCK_PERSONALITY     ← 명백한 내부 조건
  1  LITTLE_FINGER_FATHER_ENEMY · WILD_HUNT_HEATH ·
     PEQUOD_CAPTAIN · THUMB_LEVEL_MIDDLE_CAPO_UNDERBOSS
```

`BUTLER`·`PEQUOD_CAPTAIN` 은 `limbus-assets` 쪽 태그에는 `Butler`·`Pequod Captain` 으로
표시명이 있다. **표시명 출처가 갈린다.**

두 필드를 합쳐도 `Le Sette Famiglie`(7대 패밀리)는 어디에도 없다.
**표시용 특성 키워드의 정본은 `limbus-assets/identities.json` 의 `tags` 로 유지한다.**

### `appearance` — 외형 식별자

| | |
| --- | --- |
| 타입·실측 | `String` · 184/184 · **유일값 184/184** |
| 형식 | `{인격 id}_{수감자 영문명}_{외형명}Appearance` · 인격 id 로 시작 **184/184** |
| 토막 수 | `_` 기준 3:151 · 4:32 · 5:1 |
| 변환 | — |
| 적재 | **미적재** |
| 화면 | 미표시 |
| 함정 | **수감자 영문명의 대소문자가 흔들린다** — `YiSang` 과 `Yisang` 이 섞여 있다. 문자열을 키로 쓰면 안 된다 |

```
10101_YiSang_BaseAppearance             기본 인격
10103_Yisang_SwordGroupAppearance       검계 살수
10110_Yisang_DeadButterflyAppearance    엄숙한 애도
10113_YiSang_DerSchutzeAppearance       N사 E.G.O:: 흉탄
```

`BaseAppearance` 로 끝나는 것은 **정확히 12건** — 수감자 12명의 기본 인격이다.
회차 1의 `star: 1` 12건 · `title: "LCB Sinner"` 12건, `unitKeywords` 의 `BASE_APPEARANCE`
12건과 모두 같은 집합이다.

이 값은 **원본 게임의 내부 애셋 이름**이라 우리 경로 규칙(`lib/assets.ts` 가 인격 id로 찾는다)과
다르다. 회차 14에서 대조한다.

---

## 함정 요약

1. 회차 1과 겹치는 5필드 중 실질 차이는 `hp` 의 **증가량**과 속도의 **단계** 둘뿐이다
2. `mentalCondition.min` 은 "최소값"이 아니라 **감소(minus)**
3. `attackSkills.copies: 0` 은 **대체 스킬**이며, S3에 몰려 있다(45/72)
4. `defenseSkills` 는 객체가 아니라 **id 배열**이다
5. `panicSkill` 은 전 인격 공용이고 id 대역이 인격 밖이다. `defType: "non_action"` 은 스키마 enum 밖
6. 패시브는 **스냅샷**이고 동기화 4에서 `01` → `11` 강화판으로 **교체**된다
7. 패시브의 죄악 자원 요건은 이 파일이 아니라 `limbus-assets/passives.json` 에 있다
8. `unitKeywords` 는 표시용 키워드와 내부 플래그가 **섞여** 있다
9. `appearance` 의 수감자 영문명 대소문자가 일정하지 않다
10. 공격·방어 스킬 모두 `limbus-assets/identities.json` 이 **총 12개를 누락**한다

## 미해결

### 남은 것

- ❓ **`SMALL` 의 뜻.** 182/184가 보유하며, 없는 2건은 `10110` 엄숙한 애도 이상 ·
  `10410` 적안・참회 료슈다. 둘 다 `unitKeywords` 가 `[LOBOTOMY_HEAD, EGO_EQUIPMENT]` 뿐이고
  특수 외형(`DeadButterflyAppearance` · `SpiderBudAppearance`)을 갖는다.
  `loc-ko/UnitKeyword*.json` 12개 파일 어디에도 표시명이 없다. 인격은 크기가 모두 같으므로
  **유닛 크기가 아니다.** 게임 내부 분류로 보이나 축을 알 수 없다
- ❓ `CheckAwakenLevel5` 3건이 어느 패시브인가. 아직 없는 동기화 5를 가리킨다

### 다음 회차로 넘긴 것

- → **회차 3** `defType: "non_action"` 이 몇 종·몇 건인가. 스키마 enum 확장이 필요한지
- → **회차 3** 이름이 비어 있는 스킬 5개(`1071506` · `1071507` · `1111510` · `1111511` · `1121607`)
- → **회차 4** 패시브 교체(`01` → `11`)를 우리 `identity_passive` 가 어떻게 접는지.
  동기화 4에서 사라지는 쪽이 여전히 행으로 남는 것으로 보인다
- → **회차 6** `limbus-assets/identities.json` 이 스킬 12개를 누락하는 이유
- → **회차 14** `appearance` 와 우리 애셋 경로 규칙의 대응

## 근거 재현

```
data/entities/identities/limbus-data-mj/identities_detail.json    인격 상세 184건
data/entities/identities/limbus-data-mj/identities.json           겹치는 5필드 대조
data/entities/identities/limbus-data-mj/skills.json               스킬 이름·죄악
data/entities/identities/limbus-data-mj/passives.json             패시브 이름·cost
data/entities/identities/limbus-assets/identities.json            skillTypes · defCorrection
data/entities/identities/limbus-assets/passives.json              죄악 자원 요건
data/entities/identities/loc-ko/UnitKeyword*.json                 표시명 133종
src/entities/identities.ts · src/entities/skills.ts               변환
```
