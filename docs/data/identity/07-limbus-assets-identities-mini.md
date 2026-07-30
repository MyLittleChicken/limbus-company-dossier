# 회차 7 — 요약판 3종과 구버전 대조

> **척추 3파일** · `limbus-assets/identities_mini.json`(10키 · 184건 · 67KB) ·
> `shared-library/identities.json`(15키 · 163건 · 250KB) ·
> `shared-library/identities_mini.json`(8키 · 163건 · 57KB)
> 출처 커밋 `774883d7`(assets) · `2b0bfb6b`(shared) · 스냅샷 2026-07-25 · 정리 2026-07-30

## 파일 정체

**구버전 대조가 처음 들어가는 회차다.** `shared-library` 는 `limbus-assets` 와 같은 추출
계보의 이전 스냅샷이며(ADR-04 2.3), 2차 출처라 척추가 되지 않는 대신 **시간축을 준다.**

```
limbus-assets/identities.json         17키 · 184건    ← 회차 6 (정본)
limbus-assets/identities_mini.json    10키 · 184건    ← 요약판 + 파생 2개
shared-library/identities.json        15키 · 163건    ← 구버전. event·eventReward 없음
shared-library/identities_mini.json    8키 · 163건    ← 구버전 요약판
```

### 대조한 출처

| 출처 | 무엇을 대조했나 |
| --- | --- |
| `limbus-assets/identities.json` | 요약판이 부분집합인가 · 파생 필드 계산 근거 |
| `limbus-data-mj/identities.json` | `affinities` ↔ `atkSins`+`altSins` |
| `limbus-data-mj/skills.json` | 삭제된 스킬이 mj에 남아 있는가 |
| `shared-library` 3파일 | 163건 × 15키 전수 대조 |

---

## `identities_mini.json` — 요약판이 아니라 요약 + 파생

| | |
| --- | --- |
| 타입·실측 | 최상위 객체(키 = 인격 id) · 184건 · **10키** |
| 키 | `affinities` · `types` · `name` · `rank` · `season` · `sinnerId` · `tags` · `skillKeywordList`(179) · `event`(31) · `eventReward`(13) |
| 변환 | — |
| 적재 | **미적재** |
| 화면 | 미표시 |

**부분집합이 아니다.**

```
mini 에만 있는 것   affinities · types                        ← 파생 필드 2개
mini 에 없는 것     breakSection · date · defCorrection ·
                   defenseSkillTypes · hp · resists ·
                   skillTypes · speedList · statuses           9키
```

도구가 목록 화면에서 쓰기 좋게 만든 형태로 보인다 — 상세 스탯을 버리고 **필터·정렬용 축을
계산해 넣었다.**

겹치는 8키(`name`·`rank`·`season`·`sinnerId`·`tags`·`skillKeywordList`·`event`·`eventReward`)는
`identities.json` 과 **184/184 완전 일치**한다. 중복 저장이다.

### `affinities` — 공격 + 방어 스킬의 죄악 집합

| | |
| --- | --- |
| 타입·실측 | `String[]` · 184/184 · 값 죄악 7종 |
| 계산식 | `(skillTypes 죄악) ∪ (defenseSkillTypes 죄악)` — **184/184 성립** |
| 함정 | 공격 스킬만으로 계산하면 **169/184** 로 어긋난다. 방어 스킬을 넣어야 맞는다 |

**회차 2에서 남긴 관찰의 답이다** — "방어 스킬의 죄악은 mj `atkSins` 에 안 잡힌다".

```
10508 검계 우두머리
  mini affinities        [envy, pride, wrath]
  mj atkSins + altSins   [pride, wrath]              방어 스킬의 envy 가 없다
  방어 스킬              1050804 envy · 1050805 pride
```

mj `atkSins`+`altSins` 와는 **169/184** 다. mj는 S1·S2·S3만 세기 때문이다.
`affinities` 는 방어 스킬까지 담아 **인격이 쓰는 죄악의 전체 집합**을 준다.

### `types` — 공격 + 방어 스킬의 타입 집합

| | |
| --- | --- |
| 타입·실측 | `String[]` · 184/184 |
| 계산식 | `(skillTypes 타입) ∪ (defenseSkillTypes 타입)` — **184/184 성립** |
| 함정 | 공격 타입(`slash`·`pierce`·`blunt`)과 방어 유형(`guard`·`evade`·`counter`)이 **한 배열에 섞인다** |

```
10101  types  ["guard", "pierce", "slash"]      공격 2종 + 방어 1종
```

회차 1의 `atkTypes`(공격 3스킬만, 개수 맵)와 다르다 — 여기는 **중복 없는 목록**이고 방어를
포함한다. `docs/backlog/06-atktypes-naming.md` 에 적은 "같은 이름 다른 단위" 문제에 이 필드가
하나 더 붙는다.

---

## 구버전 대조 — 163건 × 15키 전수

`shared-library/identities.json` 은 15키다. **`event`·`eventReward` 가 없다** — 회차 6에서
"mj 어디에도 없다"고 한 그 두 필드가 `limbus-assets` 안에서도 **신규**임을 알려준다.

```
완전 일치 (10키)
  breakSection · date · defCorrection · hp · name · rank ·
  resists · season · sinnerId · speedList

불일치 (5키)
  defenseSkillTypes  32건
  statuses           14건
  tags                2건
  skillTypes          1건
  skillKeywordList    1건
```

**ADR-04 2.3의 "겹치는 범위에서 불일치 0" 조건이 스탯에서는 지금도 성립한다.**
불일치 5키는 전부 **패치로 실제 변한 것**이며, 아래 셋이 앞선 회차의 관찰을 설명한다.

### `10104` 의 진동 제외는 패치로 생겼다

```
구버전 skillKeywordList   ["Sinking", "Tremor"]      ← 진동이 있었다
현행                      ["Sinking"]                 ← 제외됐다
statuses                  양쪽 동일 (Vibration 포함)
```

**회차 6의 발견이 시간축을 얻었다.** 게임이 이 인격을 진동 조건 카운트에서 빼는 조정을
패치로 했고, `statuses` 는 그대로 두었다.

mj `keywords` 가 `[tremor, sinking]` 인 것은 **구버전 상태를 유지**하고 있는 것이다 —
mj가 틀린 것이 아니라 갱신이 늦은 것이다.

이 사실이 `docs/08-gimmick-keywords.md` 4.1의 판정을 뒷받침한다. 기프트 조건 카운트는
`skillKeywordList` 를 따라야 하고, 그것은 **패치로 움직인다.**

### assets가 "누락"한 스킬 중 최소 2건은 삭제된 것이다

```
10712 흑운회 와카슈
  구버전 skillTypes   ["1071201","1071202","1071203","1071205"]      ← 1071205 있었다
  현행                ["1071201","1071202","1071203"]

10212 흑수 - 묘 필두
  구버전 defenseSkillTypes  1021204 · 1021206 · 1021207              ← 1021207 있었다
  현행                      1021204 · 1021206
```

**회차 2의 서술을 정정해야 한다.** "`limbus-assets/identities.json` 이 스킬 12개를 누락한다"고
적었는데, 최소 2건은 누락이 아니라 **삭제**다. 구버전에 있었고 현행에서 사라졌으며,
mj는 여전히 갖고 있다.

`1071205` "뒷골목의 규칙"(색욕 참격 tier1)은 회차 3에서 이름이 있던 유일한 건이고,
`1021207` 은 이름이 없던 9건 중 하나다.

### `clashable` 은 신규 필드다

```
구버전 10113  { affinity, atkType, tier, type }
현행   10113  { affinity, atkType, clashable, tier, type }      ← 추가됨
```

`defenseSkillTypes` 불일치 32건이 대부분 이 키 추가다. **합 가능 여부가 나중에 데이터에
들어왔다.** 회차 6에서 "assets 전용 축"이라 한 것에 "그것도 신규"가 붙는다.

### 나머지 둘은 세분화 방향이다

```
statuses 14건    전부 추가만 있고 제거는 없다
                 10101 +AttackDmgUp · 10106 +Agility · 10110 +Bullet,Vibration

tags 2건         10109 · 11109 약지 점묘파 스튜던트
                 구버전 [The Fingers, The Ring]
                 현행   [School of Pointillism, Student, The Fingers, The Ring]
```

상태가 더 촘촘히 기록되고, 태그가 더 세분됐다. **둘 다 정보가 늘어나는 방향**이다.

---

## `shared-library/identities_mini.json`

| | |
| --- | --- |
| 타입·실측 | 8키 · 163건 · assets mini 10키 − `event` − `eventReward` |
| 대조 | 163건 × 8키 → `tags` 2건 · `skillKeywordList` 1건만 불일치 |

`identities.json` 쪽 불일치와 **정확히 같은 건**이다(`10109`·`11109`·`10104`).
`affinities`·`types` 는 **불일치 0건** — 파생이므로 원본이 같으면 같다.

**파생 필드가 검증축이 된다.** 원본 4개(`skillTypes`·`defenseSkillTypes`)에서 계산되는 값이
양쪽에서 같다는 것은 그 원본의 죄악·타입 정보가 안 바뀌었다는 뜻이다.

---

## `shared-library` 에 없는 인격 21종

```
10115 거미집 검지 아비   10116 LCE E.G.O:: 차원찢개   10215 거미집 약지 제자
10216 새벽 사무소 해결사  10414 로보토미 E.G.O:: 잔향・외로움   10415 거미집의 검
10514 로보토미 E.G.O:: 호넷【변조】   10515 약지 야수파 스튜던트   10614 거미집 약지 아비
10615 S사 추노꾼        10715 중지 작은 형님        10716 거미집 엄지 제자
10814 거미집 중지 제자    10815 LCD 현장추리팀        10915 약지 야수파 도슨트
10916 거미집 엄지 아비    11015 거미집 소지 제자      11115 거미집 중지 아비
11214 로보토미 E.G.O:: 램프   11215 LCE E.G.O:: AEDD   11216 새벽 사무소 대표
```

**대부분 시즌 7 · 거미집 계열**이다. 구버전 스냅샷 이후 출시된 인격이라 정상이다.

`10115` 거미집 검지 아비가 없는 것이 눈에 띈다 — 회차 1·3·6에서 최다 기록을 계속 세운
인격이다(`altSins` Furioso-Replica · 코인 9개 · `statuses` 36종 · `atkTypes` 3종 유일).
**구버전 기준으로 분석하면 그 인격이 통째로 빠진다.**

---

## 함정 요약

1. `identities_mini.json` 은 **부분집합이 아니다.** `affinities`·`types` 파생 2개가 여기만 있다
2. `affinities` 는 **방어 스킬 죄악까지** 담는다. 공격만으로 계산하면 169/184로 어긋난다
3. `types` 는 공격 타입과 방어 유형을 **한 배열에 섞는다**
4. `event`·`eventReward` 는 **구버전에 없는 신규 필드**다
5. `clashable` 도 **신규 필드**다
6. assets가 "누락"한 스킬 중 최소 2건은 **삭제된 것**이다(`1071205`·`1021207`)
7. `10104` 의 진동 제외는 **패치로 생겼다.** mj는 구버전 상태를 유지한다
8. 구버전으로 분석하면 `10115` 등 21종이 빠진다

## 미해결

없다. 3파일 전부 확정했다.

### 다른 회차 문서 정정 필요

- **회차 2** — "`limbus-assets/identities.json` 이 스킬 12개를 누락한다" → 최소 2건은
  삭제된 것이다. 나머지 10건도 삭제인지 누락인지 회차 10에서 `identity-details` 로 확인
- **회차 6** — `clashable` 이 신규 필드임을 덧붙인다

## 근거 재현

```
data/entities/identities/limbus-assets/identities_mini.json        요약판 10키 · 184건
data/entities/identities/shared-library/identities.json            구버전 15키 · 163건
data/entities/identities/shared-library/identities_mini.json       구버전 요약판 8키
data/entities/identities/limbus-assets/identities.json             현행 대조
data/entities/identities/limbus-data-mj/identities.json            atkSins + altSins 대조
data/entities/identities/limbus-data-mj/skills.json                삭제된 스킬 확인
```
