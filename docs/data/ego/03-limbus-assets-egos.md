# 회차 3 — `limbus-assets/egos.json`

> **E.G.O 정본** · `limbus-assets` · **110건** · 67 KB · 키 **12종**
> 출처 커밋 `774883d7` · 스냅샷 2026-07-25 · 정리 2026-07-30

## 파일 정체

변환기가 **척추로 쓰는 파일**이다(`src/entities/egos.ts:48`). `Ego` 모델의 거의 모든
컬럼이 여기서 나온다.

id 필드가 없다 — JSON 키가 id다(`"20101": {...}`). `slotId`·`nameKo` 도 없다.

키 12종 중 7종은 회차 1·2에서 mj 와 110/110 동일함을 확인했다. 이 회차는 **고유 5종**을 판다.

| 키 | 상태 |
| --- | --- |
| `sinnerId` · `name` · `rank` · `season` · `date` · `cost` · `awakeningType` | 회차 1에서 대조 완료 |
| `resists` | 회차 2에서 대조 완료 |
| `corrosionType` · `statuses` · `extractable` · `maxThreadspin` | **이 회차** |

---

## 고유 키 4종

### 1. `corrosionType` — 침식 시 속성

98건. 결손 12건은 회차 1·2에서 확인한 **침식 없는 기본 ZAYIN 12종**이다.

```
corrosionType.affinity == awakeningType.affinity    98/98    예외 0
corrosionType.type     != awakeningType.type         8/98
```

> **침식은 죄악 속성을 바꾸지 않는다. 공격 타입만 바뀐다.**

#### 공격 타입이 바뀌는 8건

| id | E.G.O | 각성 → 침식 |
| --- | --- | --- |
| `20103` | 소망석 (이상) | pierce → blunt |
| `20106` | 지난 날 (이상) | pierce → blunt |
| `20209` | 명령 : 용해 (파우스트) | pierce → slash |
| `20609` | 영작오 [宁作吾] (홍루) | slash → pierce |
| `20803` | 홍염살 (이스마엘) | pierce → blunt |
| `20904` | 들끓는 부식 (로쟈) | blunt → pierce |
| `20905` | 집행 (로쟈) | slash → blunt |
| `21206` | 지난 날 (그레고르) | pierce → blunt |

#### 함정 — `Ego.corrosionAffinity` 는 중복 컬럼이다

```prisma
awakenAffinity    Sin
corrosionAffinity Sin?      // 값이 항상 awakenAffinity 와 같다
```

98건 전부 같으므로 **조회 조건에 둘 다 쓸 이유가 없다.** null 여부는 `corrosionAtkType`
하나로도 판별된다.

**적재** — `Ego.corrosionAffinity` · `Ego.corrosionAtkType`(`src/entities/egos.ts:103`).
화면은 「침식」 행에 `속성 · 공격타입` 을 함께 쓰고, 없으면 「침식 없음」을 표시한다
(`app/[locale]/egos/[id]/page.tsx:75`).

### 2. `statuses` — E.G.O 가 다루는 상태

```
유일 137종 · 총 475 · 길이 1–11 · 빈 것 0
```

`mechanics/limbus-assets/statuses.json`(1,472종) 기준 **미등록 0건**이다. 변환기의
「E.G.O 상태가 상태 목록에 없음」 리포트가 나오지 않는다(`src/entities/egos.ts:137`).

최빈 상태는 기믹 축 그대로다.

```
Binding 24 · Combustion 24 · Sinking 24 · Laceration 23 · Vibration 23
Burst 22 · VibrationExplosion 21 · SuperCoin 19 · Charge 15 · Breath 13
```

#### ③ 접점 축이 64종 넓어진다

인격의 `statuses`(342종)에 **없는 것이 64종**이다.

```
Cianjing · SeniorCianjing        영작오 전용 (천경)
AlcoholKimPersonal · GhostKimPersonal · RootSoupKimPersonal · GrudgePersonal
                                 착영휘도 전용
CuredFilm · BirdCage · DragonLance · CentipedePoison · EmittedCurrent …
AmberDamageUp · AmberTakeDamageUp · CrimsonResultUp …   색 토큰 계열
```

`docs/08-gimmick-keywords.md` 의 3층 구조에서 **③ 접점(`statuses`)** 이 E.G.O 쪽으로
확장되는 지점이다. 개별 E.G.O 전용 상태가 많아 `STATUS_MATCH` 정규식(`lib/engine/vocab.ts:72`)
으로는 대부분 걸리지 않는다.

**적재** — `EgoStatus(egoId, statusId)`.

### 3. `extractable` — 게임 사실이 아니라 도구 필드다

```
28건 · 값은 true 뿐 · 나머지 82건은 키가 아예 없다
shared-library(구버전)에는 키 자체가 없다
```

정체가 `limbus-assets` 의 변경 로그에 있다.

```
data/meta/limbus-assets/updates__55.json          2026-07-03
"Removed Lifetime Stew Sinclair from the general extractable E.G.O pool
 in the Extraction Simulator."
```

> **`limbus-assets` 사이트의 「추출 시뮬레이터」 일반 풀 구성 플래그다.**

실측이 로그와 맞는다 — `21003` 평생 스튜(싱클레어)는 지금 `extractable` 이 없다.
동명이인 `20304` 평생 스튜(돈키호테)도 없다.

#### 함정 — 우리 화면이 이것을 게임 사실처럼 쓴다

| 위치 | 표기 |
| --- | --- |
| `app/[locale]/egos/[id]/page.tsx:102` | `[ko ? '추출 가능' : 'Extractable', ego.extractable ? 'O' : 'X']` |
| `app/[locale]/egos/page.tsx:70` | `<TriFilter param="extractable" label="추출 가능" />` |

**게임의 획득 가능 여부가 아니다.** 남의 시뮬레이터 풀 구성을 「추출 가능 O/X」 로
표시하고 있다. 실제 획득 경로(상시 추출 · 이벤트 보상 · 시즌 · 기본 지급)를 나타내는
필드는 어느 출처에도 아직 없다.

**적재** — `Ego.extractable`(`default(false)`). 키 없음을 `false` 로 접는다.

### 4. `maxThreadspin` — 「환상 해석」 최대 단계

**3건뿐이고 전부 `5`** 다.

| id | E.G.O | 수감자 |
| --- | --- | --- |
| `20102` | 4번째 성냥불 | 이상 |
| `20402` | 4번째 성냥불 | 료슈 |
| `20902` | 4번째 성냥불 | 로쟈 |

회차 2에서 **각성 패시브가 2개였던 3건과 같은 집합**이다.

#### 한국어 정식 명칭은 「환상 해석」이다

```
인격    Uptie       동기화
E.G.O   Threadspin  환상 해석
```

> `mirror-dungeon/loc-ko/TutorialMirrorDungeon.json`
> "단, 인격의 **동기화 단계**와 E.G.O의 **환상 해석 단계**는 별도로 보정되지 않습니다."

> `gifts/loc-ko/EGOgift_StoryDungeon-a1c7p3.json`
> "돈키호테 인격의 **동기화 단계**, E.G.O의 **환상해석 단계**가 4단계로 상승"

같은 문장의 영문판이 `Uptie and Threadspin Tiers` 다. **두 축은 별개이며 이름도 다르다.**

`ego-details` 의 `uptie` 최대값과 정확히 일치한다 — 107건이 4, 3건이 5.
**기본 4단계, 이 3종만 5단계다.**

`ego-details` 의 서술이 이유를 말한다.

```
"At Threadspin 5, the E.G.O has significantly higher damage and clashing.
 Its passive also now gives him additional Clash Power and [Combustion] application."
```

**적재** — `Ego.maxThreadspin`(nullable). 화면은 없으면 「없음」을 표시한다
(`app/[locale]/egos/[id]/page.tsx:105`).

---

## mj 가 못 갖는 개념은 하나뿐이다

`docs/adr/04-source-authority.md` 는 E.G.O 정본을 `limbus-assets` 로 두는 근거를
**"mj 에는 6개 필드가 없다"** 로 썼다. 실측하니 **필드 이름이 없을 뿐 개념은 넷이 있다.**

| 개념 | mj 재구성 경로 | 결과 |
| --- | --- | --- |
| `resists` | `egos_detail.attributeResists` 의 죄악 7축 | **110/110** |
| `awakeningType` | `egos_detail.awakeningSkill` → `skills.json` 의 `sin`·`attackType` | **110/110** |
| `corrosionType` | `egos_detail.corrosionSkill` → `skills.json` | **110/110** (null 12건 포함) |
| `maxThreadspin` | `skills.json` 의 `level: 5` — 정확히 `20102`·`20402`·`20902` 의 6스킬 | **3/3** |
| `statuses` | 없음 | **assets 고유** |
| `extractable` | 없음 | **도구 필드** |

> **진짜 assets 고유 개념은 `statuses` 하나다.**

정본 배정 자체는 유지된다 — assets 는 한 파일에 담아 조인이 필요 없고, 수치
(`baseValue`·`coinValue`·`atkWeight`)를 갖는다. **ADR 의 근거 문장만 부정확했다.**

이 회차에서 문장을 고쳤다.

---

## 곁가지 — 단계 표기가 두 출처에서 다르다

```
mj     skills.json  level   {1: 208, 3: 208, 4: 183, 5: 6}      ← 2가 없다
assets ego-details  uptie   {1: 210, 2: 4, 3: 210, 4: 210, 5: 6}
```

`level 4` 는 183인데 `uptie 4` 는 210이다. 차이 27. mj 는 값이 바뀌는 단계만 적는
델타 방식으로 보인다. **회차 5에서 닫는다.**

## 함정 요약

1. **`extractable` 은 게임 필드가 아니다.** 추출 시뮬레이터 풀 플래그이며 화면 레이블이 오해를 만든다
2. `corrosionType.affinity` 는 **98/98 이 `awakeningType.affinity` 와 같다**. 컬럼이 중복이다
3. 침식은 **공격 타입만** 바꾼다. 8건뿐이다
4. `maxThreadspin` 은 「실뽑기」가 아니라 **「환상 해석」**이다. 인격의 「동기화」와 다른 축
5. `statuses` 137종 중 **64종이 인격 축에 없다**. 기믹 매칭 정규식으로 안 걸린다

## 미해결

없다. 키 12종 전부 확정했다.

### 이월 관측 2건 해소

- ✔ **회차 1** `corrosionAffinity` 중복 여부 — **98/98 동일. 중복 컬럼이다**
- ✔ **회차 1** 침식 없는 12종의 정체 — 각 수감자 `slotId: 1` ZAYIN. mj `corrosionSkill` null 12건과 집합 일치

## 근거 재현

```
data/entities/egos/limbus-assets/egos.json            110건 · 키 12종
data/entities/egos/shared-library/egos.json           키 10종 (extractable·maxThreadspin 없음)
data/entities/egos/limbus-data-mj/egos_detail.json    재구성 경로
data/entities/identities/limbus-data-mj/skills.json   sin·attackType·level
data/entities/mechanics/limbus-assets/statuses.json   1,472종 등록 확인
data/meta/limbus-assets/updates__55.json              extractable 정체
data/entities/mirror-dungeon/loc-ko/TutorialMirrorDungeon.json   환상 해석
src/entities/egos.ts:48                               척추
app/[locale]/egos/[id]/page.tsx:75,102,105            화면
```
