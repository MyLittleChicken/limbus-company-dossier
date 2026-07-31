# 회차 2 — `limbus-data-mj/egos_detail.json`

> **E.G.O 상세** · `limbus-data-mj` · **110건** · 88 KB · 키 **8종**
> 출처 커밋 `774883d7` · 스냅샷 2026-07-25 · 정리 2026-07-30

## 파일 정체

`egos.json` 과 id 집합이 정확히 같다(110/110). 회차 1이 "assets 의 진부분집합" 이었던 것과
달리, 이 파일은 **E.G.O ↔ 스킬 ↔ 패시브를 잇는 다리**다.

인격 편에서 미뤄둔 두 덩어리가 여기서 닫힌다.

| 인격 편 관측 | 이 파일 |
| --- | --- |
| 회차 3 — `skills.json` 의 `2xxxxxx` **208건**. 담을 자리가 없어 미적재 | `awakeningSkill` + `corrosionSkill` = **208** |
| 회차 4 — `passives.json` 의 `2xxxxxx` **113건**. "mj 로는 조회되지 않는다" | `awakeningPassives` 유일 **113** |

**차집합은 양방향 0이다.** 회차 4의 "조회되지 않는다" 는 다리를
`identities/passives.json` 에서 찾았기 때문이고, 실제 다리는 `egos/egos_detail.json` 이었다.

---

## 키 8종

### 1. `id`

`egos.json` 과 110/110 동일. 결손 0.

### 2. `attributeResists` — 저항 9축

죄악 7종 + `white` + `black`.

```json
{ "wrath":1, "lust":1, "sloth":0.75, "gluttony":1, "gloom":2, "pride":1, "envy":2,
  "white":2, "black":2 }
```

| 축 | 실측 | 판정 |
| --- | --- | --- |
| 죄악 7종 | `limbus-assets` 의 `resists` 와 **110/110 동일** | 중복 |
| `white` | **110건 전부 `2`** | 상수 |
| `black` | **110건 전부 `2`** | 상수 |

값은 4단계다 — `0.5`(내성) · `0.75` · `1`(보통) · `2`(치명).
인격의 공격 타입 저항이 `[0.5, 1, 2]` 3단계였던 것과 다르다(`docs/09-resistance.md`).

#### 패턴이 4종뿐이다

치명(`2`)이 **정확히 2개**인 것이 110/110 이다.

| 건수 | 죄악 7축 구성 |
| ---: | --- |
| 41 | `0.5`×1 · `0.75`×1 · `1`×3 · `2`×2 |
| 32 | `0.5`×1 · `1`×4 · `2`×2 |
| 20 | `0.75`×1 · `1`×4 · `2`×2 |
| 17 | `0.5`×2 · `0.75`×1 · `1`×2 · `2`×2 |

#### 함정 — 주 죄악이 최저 저항이 아닌 것이 17건

`egos.json` 의 `sin` 과 저항의 최저값이 **93/110** 만 일치한다.

```
20105 여우비    sin=sloth      sloth 0.75  인데 gluttony 0.5
20107 흉탄      sin=pride      pride 0.75  인데 gloom 0.5
21204 AEDD      sin=gloom      gloom 2     이고 wrath 0.5
```

`21204` 는 **주 죄악이 오히려 치명**이다. **속성과 약점은 별개 축이다** —
회차 1에서 `sin` 이 `resourceCost` 에서 유도되지 않았던 것과 같은 구조다.

#### `white` / `black` — 현재 게임에 없는 속성이다

**전작 로보토미 코퍼레이션의 백색·흑색 피해에서 온 개념**이며, 림버스 컴퍼니에는
해당 속성이 존재하지 않는다. 110건 전부 `2` 로 고정이라 정보량이 0이고,
`mechanics/sins.json` 의 죄악 색 사전에도 들어 있지 않다.

**적재** — 하지 않는다. 죄악 7축은 assets 경유로 `EgoResist` 에 들어간다.

### 3. `corrosion` — 침식 확률 곡선

**110건 전부 완전히 같은 배열이다.**

```json
[ {"section":0.5,  "probability":0.25},
  {"section":0.25, "probability":0.75},
  {"section":0,    "probability":1.0 } ]
```

정신력(SP) 구간별 침식 확률이다.

#### `section` 은 백분율이 아니라 정규화된 SP 위치다

림버스의 SP 범위는 **-45 ~ +45** 이며, 데이터가 두 곳에서 이를 말한다.

```
mechanics/loc-ko/Bufs.json      "정신력이 -45이하라면 다음 턴에 소음 공황을 얻는다"
스킬 desc 다수                   "0 미만의 정신력 1 당 피해량 +1% (최대 45%)"
```

`(SP + 45) / 90` 으로 정규화하면 값이 정확히 맞는다.

| `section` | 실제 SP | `probability` |
| ---: | ---: | ---: |
| 1.0 | +45 | (항목 없음 = 0) |
| **0.5** | **0** | **25 %** |
| **0.25** | **-22.5** | **75 %** |
| **0** | **-45** | **100 %** |

> **SP 0 이하부터 침식 확률이 생기고 -45 에서 100 % 다.**

위키가 확인한다 — "Sinners will have a chance of corroding **whenever their Sanity is in
the negatives**", "Automatic corrosion happens when … brings the Sinner's SP to
**-45 or lower**"([E.G.O/Gameplay](https://limbuscompany.wiki.gg/wiki/E.G.O/Gameplay)).

> **정정 (2026-07-31)** — 처음에는 `section` 을 "SP 50 % 이하" 처럼 **최대 SP 대비 백분율**로
> 읽었다. 방향이 반대였다. 게임 화면이 반증한다 — E.G.O 카드 상단에 `⚠ 침식확률 0%` 가
> 뜨고, SP 가 높을 때 0 % 다. 백분율 해석이면 만렙 SP 에서도 확률이 있어야 한다.

#### 화면에 나오는 값이다

E.G.O 카드 상단에 **`⚠ 침식확률 N%`** 로 표시된다. 상수 배열이지만 **표시되는 수치의
근거가 이 필드뿐**이다.

`EgoErode` 상태 정의도 데이터에 있다.

```
id      EgoErode
name    E.G.O침식
desc    "이번 턴 동안 명령 불가. E.G.O 침식 스킬만 사용 가능."
```

**침식이 없는 기본 E.G.O 12종도 같은 배열을 갖는다.** E.G.O 개별 속성이 아니라
게임 전역 규칙이 각 항목에 복사된 것이다.

**적재** — 하지 않는다. 상수다. 다만 **침식 확률 규칙의 수치 출처는 이 파일뿐**이므로
규칙 문서에 옮겨 둘 값이다.

### 4. `awakeningSkill` — 각성 스킬 id

```
awakeningSkill = id × 100 + 11        110/110 규칙 준수 · null 0
```

`20101` → `2010111`.

### 5. `corrosionSkill` — 침식 스킬 id

```
corrosionSkill = id × 100 + 21         98/110 · null 12
```

**null 12건이 정확히 회차 1의 "침식 없는 12종"** 이다.

```
20101 20201 20301 20401 20501 20601 20701 20801 20901 21001 21101 21201
```

전부 각 수감자의 `slotId: 1` ZAYIN 이다. `limbus-assets` 의 `corrosionType` 결손 12건과
**집합이 완전히 같다** — 두 출처가 독립적으로 같은 사실을 말한다.

#### 인격 편 회차 3의 208건이 닫힌다

```
awakeningSkill 110 + corrosionSkill 98 = 208
mj skills.json 의 2xxxxxx 대역          = 208
차집합 양방향 0
```

회차 3에서 본 접미 `11`(각성) / `21`(침식) 규칙이 **여기서 생성 규칙으로 확인된다.**
추측이 아니라 파일이 명시적으로 가리킨다.

**적재** — 미적재. E.G.O 스킬을 담는 모델이 아직 없다.

### 6. `passives` — 죽은 필드

```
null      109건
[]          1건   (20101 오감도)
```

값을 가진 항목이 0이다. `awakeningPassives` 와 짝을 이루는 이름이지만 채워지지 않았다.

**적재** — 하지 않는다.

### 7. `awakeningPassives` — 각성 패시브 id 배열

```
유일 113 = 접미 11 인 110건 + 접미 12 인 3건
길이 1 인 것 107건 · 길이 2 인 것 3건
```

#### 인격 편 회차 4의 113건이 닫힌다

```
awakeningPassives 유일          = 113
mj passives.json 의 2xxxxxx     = 113
차집합 양방향 0
```

#### 각성 패시브가 2개인 3건

전부 **`4번째 성냥불`** 이다.

| id | 수감자 | 패시브 |
| --- | --- | --- |
| `20102` | 이상 | `2010211` · `2010212` |
| `20402` | 료슈 | `2040211` · `2040212` |
| `20902` | 로쟈 | `2090211` · `2090212` |

회차 1에서 본 이름 중복 32종 중 3명이 공유하는 E.G.O 이며, 세 개체가 같은 구조를 갖는다.

**침식 전용 패시브는 없다** — 접미 `21` 인 패시브가 0건이다. 침식은 스킬만 갈린다.

**적재** — 미적재. 우리는 `ego-details/limbus-assets` 의 `passiveList` 를 쓴다.

### 8. `requirements` — 색 토큰으로 쓴 죄악 자원 비용

```json
[ {"attributeType":"CRIMSON","num":1}, {"attributeType":"AMBER","num":3} ]
```

**`egos.json` 의 `resourceCost` 와 같은 것이다.** 색 토큰을 죄악으로 치환하면
**110/110 완전 일치**하고 길이 분포도 같다.

치환표가 이미 리포에 있다 — `data/entities/mechanics/limbus-data-mj/sins.json`.

| 죄악 | 색 토큰 | 건수 |
| --- | --- | ---: |
| wrath 분노 | `CRIMSON` | 43 |
| lust 색욕 | `SCARLET` | 52 |
| sloth 나태 | `AMBER` | 40 |
| gluttony 탐식 | `SHAMROCK` | 30 |
| gloom 우울 | `AZURE` | 42 |
| pride 오만 | `INDIGO` | 61 |
| envy 질투 | `VIOLET` | 46 |

인격 편의 색 표기가 전부 이 어휘다 — 회차 8 `skill_tags.json` 의 `AMBER`·`AZURE` 계열,
회차 14의 `1021305_CRIMSON`·`_INDIGO`·`_VIOLET` 아이콘.

**적재** — 미적재(중복). `EgoCost` 는 assets 의 `cost` 에서 온다.

---

## 번호 공간 충돌이 E.G.O 에서는 110/110 전부다

같은 숫자가 두 파일에서 **완전히 다른 개체**를 가리킨다.

```
2010111  skills.json    "오감도"   sloth · pierce · skillTier 3 · 코인 효과
2010111  passives.json  "침묵"     피격 시 속박 3 · cost CheckAwakenLevel2
```

인격 편 회차 4에서 유령 패시브 6건을 판정하며 "번호 공간이 겹친다" 고 한 그 현상이다.
인격 쪽은 일부였지만 **E.G.O 는 각성 패시브 110건 전부가 각성 스킬 id 와 같다.**

> **id 만으로 스킬과 패시브를 구분할 수 없다. 어느 파일에서 왔는지가 타입이다.**

`egos_detail.json` 이 `awakeningSkill` 과 `awakeningPassives` 를 **다른 필드로** 두었기 때문에
같은 숫자를 두 역할로 읽을 수 있다. 이 파일이 없으면 판정이 불가능하다.

---

## 변환기는 이 파일을 읽지 않는다

`src/entities/egos.ts` 에 `egos_detail` 참조가 **0건**이다. 대신
`ego-details/limbus-assets/` 를 쓴다(`readJsonDir('ego-details','limbus-assets')`).

그 결과 **E.G.O 스킬 208건이 DB 에 없다.** 회차 5(`ego-details`)에서 assets 가 같은 것을
갖는지 확인하면 갈린다.

| 회차 5 결과 | 뜻 |
| --- | --- |
| assets 도 스킬을 갖는다 | 이 파일은 중복. 지금 구조 유지 |
| assets 가 안 갖는다 | **이 파일이 E.G.O 스킬의 유일한 출처**. 모델 추가 필요 |

---

## 함정 요약

1. **`2010111` 이 스킬이자 패시브다.** 110건 전부 겹친다. 파일이 타입을 정한다
2. `attributeResists` 의 `white`/`black` 은 **현재 게임에 없는 속성**이다(로보토미 유산). 전부 `2`
3. `corrosion` 은 **110건이 전부 같다.** E.G.O 속성이 아니라 전역 규칙의 복사본
   — `section` 은 백분율이 아니라 **정규화된 SP 위치**다(`0.5` = SP 0)
4. `passives` 는 **죽은 필드**다. `awakeningPassives` 와 헷갈리면 안 된다
5. **주 죄악이 최저 저항이 아닌 것이 17건**. `21204` 는 주 죄악이 치명이다
6. `requirements` 는 새 정보가 아니다. `resourceCost` 를 색 토큰으로 쓴 것

## 미해결

없다. 키 8종 전부 확정했다.

### 이월 질문 2건 해소

- ✔ **인격 편 회차 3** `2xxxxxx` 스킬 208건의 소유자 — `awakeningSkill`+`corrosionSkill`
- ✔ **인격 편 회차 4** `2xxxxxx` 패시브 113건의 조회 경로 — `awakeningPassives`

## 근거 재현

```
data/entities/egos/limbus-data-mj/egos_detail.json        110건 · 키 8종
data/entities/egos/limbus-data-mj/egos.json               resourceCost 대조
data/entities/egos/limbus-assets/egos.json                resists · corrosionType 대조
data/entities/identities/limbus-data-mj/skills.json       2xxxxxx 208건
data/entities/identities/limbus-data-mj/passives.json     2xxxxxx 113건
data/entities/mechanics/limbus-data-mj/sins.json          색 토큰 치환표
src/entities/egos.ts                                      egos_detail 참조 0건
```
