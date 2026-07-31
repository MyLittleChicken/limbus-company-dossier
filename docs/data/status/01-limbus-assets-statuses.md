# 회차 1 — `limbus-assets/statuses.json`

> **상태 사전** · `limbus-assets` · **1,472종** · 422 KB · 키 **6종**
> 출처 커밋 `774883d7` · 스냅샷 2026-07-25 · 정리 2026-07-31
> **상태 편(회차 1–6)의 첫 회차**

## 파일 정체

게임의 모든 버프·디버프·상태를 담은 사전이다. 인격 편 회차 6의 `identities.statuses`,
E.G.O 편 회차 3의 `egos.statuses` 가 가리키던 대상이며, 변환기가 외래 키 검사에 쓴다
(`src/entities/egos.ts:56`).

```
키가 문자열이다   "Combustion" · "A1c971a" · "ATL_Agility"
항목 키   buffType · desc · name · srcPath(1,218) · imageOverride(145) · categoryKeywordList(116)
```

---

## 1. `buffType` — 3종

```
Positive 678 · Neutral 416 · Negative 378
```

**긍정 효과가 절반에 가깝다.** 결손 0.

## 2. `name` · `desc`

```
name 결손 0 · 유일 1,215        desc 결손 10
```

### 이름 중복 상위

```
"버프 이름" 10 · Bloomed Rose 7 · Tribulation 6 · Withered 6
Level Boost 5 · Frailness 5
```

`Level Boost` · `Frailness` 는 거울 던전 편 회차 1의 **역경 5단계 공통 항목**이다.

### 함정 — 영문 파일에 한국어 플레이스홀더 11건

```
MRR504 · MRR514 · MRR519 · MRR531 · MRR535
MRR538 · MRR540 · MRR541 · MRR552 · MRR554      name = "버프 이름"
SingBulletSupport                                name = "(엄지 싱클 탄환 보급 받는 대상 이펙트)"
```

**`desc` 는 영문으로 제대로 들어 있는데 `name` 만 한국어 플레이스홀더**다.
`MRR5` 는 굴절 열차(Refraction Railway) 5 대역으로 보인다.

`SingBulletSupport` 는 아예 **개발 메모**다 — 괄호로 감싼 내부 설명이며 `desc` 도 비었다.

### `desc` 가 빈 10건

```
BabayagaTimeLimit · MD5Base · MD6LimitBaseN · MRR5BaseN · MRR5BaseP
RyoshuParryIndexFingerThey · RyoshuParryIndexFingerWe
SingBulletSupport · SupportProtectTypo · YesdragonBurst
```

`*Base*` 계열은 **내부 기반 상태**로 보이고 화면에 안 나온다.

### `SupportProtectTypo` — id 가 오타임을 자인한다

```json
"SupportProtectTypo": { "buffType": "Neutral", "desc": "", "name": "Assist Defense", "srcPath": "Assist Defense" }
```

**id 에 `Typo` 가 박혀 있다.** 잘못 만든 상태를 지우지 않고 이름에 표시만 해 뒀다.
`name` 과 `srcPath` 는 멀쩡하므로 실제로 쓰이는 것으로 보인다.

## 3. `categoryKeywordList` — 116건 · 24종

```
IGNORE_CHECED_CORRECTION_EXCLUSION 32 · SIN 20 · CHARGE 15 · BULLET 14
RESOURCE 14 · VIBRATION 12 · VIBRATION_CONVERTED 9 · BURSTREACTIVE 7
FREISHUTZ_OUTIS_EGO_BULLET 7 · LACERATION 5 · FAUVISM_CLAW_WOUND 4 …
```

**최빈값 `IGNORE_CHECED_CORRECTION_EXCLUSION` 이 오타다** — `CHECED` 는 `CHECKED` 여야 한다.
32건에 붙어 있어 **원본에서 가장 널리 퍼진 오타**다.

기믹 축(`CHARGE` · `VIBRATION` · `LACERATION` · `SINKING`)과 내부 분류
(`RESOURCE` · `BULLET` · `CAN_GET_ONLY_BY_SYSTEM`)가 섞여 있다.
`FREISHUTZ_OUTIS_EGO_BULLET` · `FAUVISM_CLAW_WOUND` 처럼 **특정 E.G.O 전용**도 있다.

`08-gimmick-keywords.md` 의 `status_gimmick` 근거가 될 후보이지만,
**1,472종 중 116건만 갖는다**(7.9 %). 나머지는 이 축으로 분류되지 않는다.

## 4. `srcPath` · `imageOverride` — 애셋 키

```
srcPath 보유 1,218 · 없음 254        유일 996
imageOverride 145                    유일  90
```

`srcPath` 가 없는 254건은 `Positive` 182 · `Negative` 36 · `Neutral` 36 이다.
**아이콘이 없는 상태**이며 내부 처리용으로 보인다.

### 애셋 대조

```
data/assets/statuses/limbus-assets/     1,192개
srcPath 996 → 애셋 있는 것 996 / 996      결손 0
imageOverride 90 → 애셋 있는 것 90 / 90   결손 0
애셋에만                                  191개
```

**결손 0**이다. 다섯 번째 엔티티도 애셋이 빠짐없이 있다.

`srcPath` 유일이 996 인데 보유가 1,218 — **222건이 아이콘을 공유**한다.
기프트 편 회차 8과 같은 이름 기반 조회다.

---

## 우리는 키 집합만 쓴다

```ts
const statusIds = new Set(Object.keys(readJson('mechanics','limbus-assets','statuses.json')));
```

`src/entities/egos.ts:56` 이 **키만 뽑아 외래 키 검사**에 쓴다.
`Status` 테이블에는 id 만 들어가고 `buffType`·`desc`·`name`·`categoryKeywordList` 는
**전부 미적재**다.

E.G.O 편 회차 3에서 확인했듯 E.G.O 상태 137종이 이 사전에 **미등록 0건**이었다.

---

## 함정 요약

1. 영문 파일인데 **한국어 플레이스홀더 11건**이 있다(`"버프 이름"`)
2. `IGNORE_CHECED_CORRECTION_EXCLUSION` — **`CHECKED` 오타가 32건**에 퍼져 있다
3. `SupportProtectTypo` — **id 자체가 오타임을 표시**한다
4. `srcPath` 가 **222건에서 공유**된다. 상태당 유일하지 않다
5. `categoryKeywordList` 는 **7.9 %만** 갖는다. 기믹 분류의 정본이 될 수 없다

## 미해결

없다. 1,472종 전부 확정했다.

## 근거 재현

```
data/entities/mechanics/limbus-assets/statuses.json   1,472종 · 키 6종
data/assets/statuses/limbus-assets/                   1,192개 · 결손 0
src/entities/egos.ts:56                               키 집합만 사용
```
