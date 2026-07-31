# 상태(메카닉) 계열 지도 (Status Overview)

> 상태: **상태 편 완료** / 최종 수정 2026-07-31 · 스냅샷 2026-07-25
> 회차 1–5 를 모두 마쳤다. 미해결 없이 닫혔다.

## 1. 원본 파일

| 파일 | 회차 | 성격 |
| --- | --- | --- |
| `limbus-assets/statuses.json` | 1 | **상태 사전 1,472종** · 영문만 |
| `limbus-data-mj/keywords.json` · `sins.json` · `terms.json` | 2 | 기믹 10 · 죄악 7 · 한국어 토큰 483 |
| `shared-library/statuses.json` · `loc-*/BattleKeywords*` 42파일 | 3 | 구버전 869 · 로케일 1,409 |
| `loc-*/Bufs*` 43파일 | 4 | 로케일 1,496 |
| `data/assets/statuses/` 1,193개 | 5 | 아이콘 |

## 2. DB 모델 — id 만 들어간다

```
Status { id }        ← 이름도 설명도 분류도 없다
```

`src/entities/egos.ts:56` 이 **키 집합만 뽑아 외래 키 검사**에 쓴다.
`buffType` · `name` · `desc` · `categoryKeywordList` 가 **전부 미적재**다.

`IdentityStatus` · `EgoStatus` 가 이 id 를 참조한다.

## 3. 개념 장부

| 개념 | `limbus-data-mj` | `limbus-assets` | `loc-*` | 정본 | 회차 |
| --- | --- | --- | --- | --- | --- |
| 상태 id 집합 | — | `statuses.json` 1,472 | 1,524 | **합집합** | 1·3·4 |
| 긍정/중립/부정 | — | `buffType` 3종 | — | **assets** | 1 |
| 영문 이름·설명 | `terms.json` 435 | `statuses.json` 1,472 | 1,524 | **assets** | 1·2 |
| **한국어 이름·설명** | `terms.json` 483 | — | 1,524 | **loc + terms** | 2·3·4 |
| 기믹·공격 타입 10종 | `keywords.json` | — | — | **mj** | 2 |
| 죄악 7종 + 색 | `sins.json` | — | — | **mj** | 2 |
| 토큰 치환표 | `terms.json`(발동 시점 48 포함) | — | — | **mj** | 2 |
| 상태 분류 태그 | — | `categoryKeywordList` 116 | — | **assets** | 1 |
| 아이콘 | — | `srcPath` · `imageOverride` | — | **assets** | 1·5 |

### 3.1 결산 — 세 출처가 서로를 메운다

| 출처 | 단독 보유 개념 | 내용 |
| --- | ---: | --- |
| `limbus-assets` | **3** | `buffType` · `categoryKeywordList` · 아이콘 |
| `limbus-data-mj` | **3** | 기믹 10종 · 죄악 7종+색 · 토큰 치환표 |
| `loc-ko/en/ja` | **1** | 한국어 이름·설명의 **주력**(1,214/1,472) |
| `shared-library` | 0 | 구버전 시간축 |

```
인격 편     mj  9 · assets 15 · loc 6
E.G.O 편    mj  1 · assets  6 · loc 4
기프트 편    mj  5 · assets  6 · loc 6
팩 편       mj  6 · assets  2 · loc 1
거울 던전 편  mj  0 · assets  5 · loc 4
상태 편     mj  3 · assets  3 · loc 1
```

**개념 수는 적지만 셋 다 없으면 안 된다.** 특히 한국어는 세 곳을 합쳐도
**245종(16.6 %)이 비어 있다.**

### 3.2 한국어 커버리지

```
statuses 1,472
  loc BattleKeywords            1,214
  terms.json                      435
  합집합                        1,227
  ──────────────────────────────────
  어디서도 못 얻는 것              245   (16.6 %)

단독 기여   로케일 792 · terms.json 13
```

`terms.json` 단독 13종에 **E.G.O 편 회차 5의 `AlwaysUseEGOPassive` 2건**이 든다.

### 3.3 상태 편에서 확인된 원본 결함 6건

| 사례 | 규모 | 회차 |
| --- | ---: | --- |
| **`undefined` 키** (값이 전부 `"-"`) | **BattleKeywords 809 · Bufs 844** | 3·4 |
| `IGNORE_CHECED_CORRECTION_EXCLUSION` — `CHECKED` 오타 | 32 | 1 |
| `"버프 이름"` 플레이스홀더 (`MRR5xx`) | 10 | 1·4 |
| `SupportProtectTypo` — id 가 오타임을 자인 | 1 | 1 |
| `SingBulletSupport` — name 이 개발 메모 | 1 | 1 |
| `iconID` / `iconId` 대소문자 혼재 | 4 | 4 |

`undefined` 키는 **마스터북 전체에서 가장 큰 원본 버그**다(인격 편 4 → 여기 1,653).

### 3.4 두 로케일 파일이 서로를 보완한다

```
Bufs 1,496   ↔   BattleKeywords 1,409
Bufs 에만 115 · BK 에만 28 · 겹치는 1,381 중 339건이 값도 다르다
```

| | `Bufs` | `BattleKeywords` |
| --- | --- | --- |
| 성격 | **런타임 원형** (`{0}` 190건) | **표시용** (풀어 쓴 문장) |
| `MRR5xx` 10건 | **이름 4건 정답** · desc 0건 | 이름 0건 · **desc 10건** |

**어느 하나로도 완전하지 않다.**

## 4. 다른 편과의 연결

| 관측 | 나온 곳 | 상태 편에서 |
| --- | --- | --- |
| 인격 `statuses` 342종 · E.G.O `statuses` 137종 | 인격 6 · E.G.O 3 | **미등록 0건** — 전부 이 사전에 있다 |
| `status_gimmick` 근거 | `08-gimmick-keywords.md` | `categoryKeywordList` 는 **7.9 %만** 갖는다 |
| 기믹 축 10종 | `08-gimmick-keywords.md` | `keywords.json` 이 **원본 어휘**이며 다르다 |
| `AlwaysUseEGOPassive` 동적 토큰 | E.G.O 5 | **정정** — `terms.json` 에 개별 등재 |
