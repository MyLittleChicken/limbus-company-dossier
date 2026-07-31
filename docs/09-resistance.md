# 저항 (Resistance)

> 상태: 초안 v0.1 / 작성 2026-07-29 · 스냅샷 2026-07-25
> 데이터 마스터북 회차 1(`limbus-data-mj/identities.json`) 인터뷰 중 정리했다.
> 엔티티 정의는 `02-data-model.md`, 기믹 축은 `08-gimmick-keywords.md` 를 함께 본다.

## 1. 저항은 두 축이고 성격이 다르다

| 축 | 값의 주인 | 전투 중 변화 | 키 | 우리 테이블 |
| --- | --- | --- | --- | --- |
| **공격 타입 저항** | **인격** | 없음 — 고정 | 참격 · 관통 · 타격 3종 | `identity_resist` |
| **죄악 저항** | **E.G.O** | **있음** — 마지막에 쓴 E.G.O의 것으로 교체 | 죄악 7종 | `ego_resist` |

같은 "저항"이라는 이름을 쓰지만 **하나는 인격에 붙박이고 하나는 전투 중 갈아끼워진다.**
스키마가 두 테이블로 나뉘어 있으나 이 관계는 어디에도 적혀 있지 않았다.

## 2. 값은 배수다 — 클수록 나쁘다

받는 피해의 **곱셈 배수**다([Battles](https://limbuscompany.fandom.com/wiki/Battles)).

```
2     취약 — 2배로 맞는다
1     보통
0.5   내성 — 절반만 맞는다
```

**이름은 "저항"인데 값 `2` 는 저항이 아니라 취약이다.** 화면·질의에서 반복해 헷갈릴 자리다.

두 축은 **곱해진다.**

> a foe weak to slash and wrath attack would take at least **4x** of the original damage

```
참격 취약(2) × 분노 취약(2) = 4배
```

## 3. 인격의 공격 타입 저항 — 조합이 고정이다

184건 전수 실측.

```
값 분포        0.5: 184건 · 1: 184건 · 2: 184건
조합 패턴      [0.5, 1, 2] : 184건 전부 (예외 0)
```

**모든 인격이 취약 하나 · 보통 하나 · 내성 하나를 정확히 갖는다.** 위키 서술과 일치한다.

> one damage type they take fatal damage against (2x), one damage type they take normal damage
> against (1x) and one damage type that is ineffective against them
> — [Identities](https://limbuscompany.fandom.com/wiki/Identities)

```
10101 LCB 수감자   {slash: 2, pierce: 0.5, blunt: 1}
                     참격 취약        관통 내성       타격 보통
```

E.G.O를 무엇을 쓰든 이 값은 바뀌지 않는다.

## 4. 죄악 저항 — E.G.O가 정하고 전투 중 바뀐다

[E.G.O/Gameplay](https://limbuscompany.fandom.com/wiki/E.G.O/Gameplay) 확인.

> After using an E.G.O skill, **the sin resistances of the Sinner will be replaced by the
> E.G.O's resistances.**
> A Sinner's resistances and weaknesses to sin affinities are **sourced from the E.G.O last used.**
> **At the start of combat, ZAYIN-grade's E.G.O resistances and weaknesses are applied.**

```
전투 시작        편성에 착용한 ZAYIN 등급 E.G.O 의 죄악 저항
E.G.O 사용 후    마지막에 사용한 E.G.O 의 죄악 저항으로 교체
```

**인격 자체는 죄악 저항을 갖지 않는다.** 원본 인격 데이터에 죄악 저항 필드가 없는 것도
이 때문이다.

### 4.1 시작 저항은 "착용한" ZAYIN 이다

수감자 12명 전원이 ZAYIN 등급 E.G.O를 갖지만 **8명은 2종을 갖는다.**

```
ZAYIN 1종   파우스트 · 돈키호테 · 뫼르소 · 홍루                     4명
ZAYIN 2종   이상 · 료슈 · 히스클리프 · 이스마엘 · 로쟈 ·
            싱클레어 · 오티스 · 그레고르                            8명

전체 등급 분포   ZAYIN 20 · TETH 32 · HE 40 · WAW 18
```

둘 중 무엇이 시작 저항인지는 **편성에서 어느 것을 착용했는가**로 정해진다.

덱 코드 구조가 이를 뒷받침한다. 수감자 블록이 **등급별로 슬롯을 하나씩만** 담는다
(`07-recommendation-system.md` 7.1).

```
비트 16–19   ZAYIN E.G.O      ← 편성당 ZAYIN 은 정확히 하나
비트 23–26   TETH
비트 30–33   HE
비트 37–40   WAW
비트 41–46   ALEPH (가이드의 추정)
```

## 5. E.G.O 저항의 값 분포는 인격과 다르다

110종 전수.

| | 인격 | E.G.O |
| --- | --- | --- |
| 키 | 3종(공격 타입) | 7종(죄악) |
| 값 종류 | `0.5` · `1` · `2` | `0.5` · **`0.75`** · `1` · `2` |
| 값 분포 | 각 184건 | `0.5`:107 · `0.75`:78 · `1`:365 · `2`:220 |
| 조합 | `[0.5, 1, 2]` 고정 | **패턴 4종.** `2` 가 정확히 2개 |

**`0.75` 는 E.G.O에만 있다.**

```
20509 착영휘도  {오만 0.5, 색욕 0.75, 분노 1, 폭식 1, 질투 1, 우울 2, 나태 2}
20101 오감도    {나태 0.75, 폭식 1, 색욕 1, 오만 1, 분노 1, 우울 2, 질투 2}
```

### 치명이 정확히 2개다

마스터북 E.G.O 편 회차 2 전수. **110/110 이 치명(`2`)을 정확히 2개** 갖는다.

| 건수 | 구성 |
| ---: | --- |
| 41 | `0.5`×1 · `0.75`×1 · `1`×3 · `2`×2 |
| 32 | `0.5`×1 · `1`×4 · `2`×2 |
| 20 | `0.75`×1 · `1`×4 · `2`×2 |
| 17 | `0.5`×2 · `0.75`×1 · `1`×2 · `2`×2 |

**주 죄악이 최저 저항이라고 가정하면 안 된다** — 93/110 만 그렇다.
`21204` AEDD 는 주 죄악(우울)이 오히려 치명이다.

### `white`/`black` 축은 쓰지 않는다

`limbus-data-mj/egos_detail.json` 의 `attributeResists` 는 죄악 7 + `white` + `black`
**9축**이다. 죄악 7축은 assets 와 110/110 같고, `white`·`black` 은 **110건 전부 `2`** 인
상수다.

**전작 로보토미 코퍼레이션의 백색·흑색 피해에서 온 개념이며 현재 게임에는 존재하지 않는
속성**이다. `mechanics/sins.json` 의 죄악 색 사전에도 없다. 적재하지 않는다.

## 6. 데이터 현황

| | 원본 | 우리 테이블 | 상태 |
| --- | --- | --- | --- |
| 인격 공격 타입 저항 | `identities_detail.json` `resists` | `identity_resist(identityId, atkType, value)` | 적재됨 |
| E.G.O 죄악 저항 | `limbus-assets/egos.json` `resists` | `ego_resist(egoId, sin, value)` | 적재됨 |
| **어느 E.G.O가 착용 중인가** | — | — | **없음** — 편성 정보이며 게임 데이터가 아니다 |

값은 둘 다 있다. 없는 것은 **둘을 잇는 문맥**이다. 어떤 편성에서 어떤 E.G.O를 착용했는지는
사용자 데이터이며 `lib/storage/decks.ts` 가 브라우저에 보관한다.

따라서 "이 편성의 죄악 저항"을 계산하려면 **편성 → 착용 ZAYIN → `ego_resist`** 경로가 필요하다.
지금 화면은 인격 상세에 공격 타입 저항만 보여주고 죄악 저항은 E.G.O 상세에만 있다.

## 7. 미해결

- ❓ 화면에서 "저항 2 = 취약"을 어떻게 표기할지. 지금은 `×2` 로만 나가 오해 소지가 있다
- ❓ 편성 화면에서 죄악 저항을 보여줄지. 보여준다면 착용 ZAYIN 기준으로 계산해야 한다
- ❓ E.G.O를 사용한 뒤 저항이 바뀌는 것을 추천 엔진이 고려해야 하는가. 거울 던전 추천은
  전투 전 판단이므로 시작 저항(ZAYIN)만으로 충분할 수 있다
- ❓ `0.75` 가 E.G.O에만 있는 이유. 등급별 설계 차이인지 확인 안 했다
