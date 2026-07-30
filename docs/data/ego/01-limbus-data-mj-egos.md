# 회차 1 — `limbus-data-mj/egos.json`

> **E.G.O 본체** · `limbus-data-mj` · **110건** · 37 KB · 키 **12종**
> 출처 커밋 `774883d7` · 스냅샷 2026-07-25 · 정리 2026-07-30
> **E.G.O 편(회차 1–9)의 첫 회차**

## 파일 정체

E.G.O 110종의 요약이다. 인격 편 회차 1(`identities.json`)과 **키 구성이 거의 같다** —
`id`·`sinnerId`·`slotId`·`teamCodeEligible`·`name`·`nameKo`·`season`·`updatedDate` 8종이
그대로 대응하고, 인격의 `star`·`title`·`keywords` 자리에 E.G.O 고유의
`rarity`·`sin`·`attackType`·`resourceCost` 가 들어간다.

```
E.G.O 110 = 12수감자 × 9 + 파우스트 +1 + 이스마엘 +1
```

---

## 키 12종

### 1. `id` — 기본키

```
2 | 수감자(2자리) | 순번(2자리)

20101 = 수감자 01(이상)의 1번째 E.G.O
21209 = 수감자 12(그레고르)의 9번째 E.G.O
```

범위 `20101`–`21209` · 유일 110건 · 결손 0.

### 2. `sinnerId` — 수감자

`1`–`12`. 수감자당 9개, 파우스트(2)와 이스마엘(8)만 10개다.

### 3. `slotId` — 순번

`1`–`10`. **`id % 100` 과 110/110 일치한다.** id 에서 그대로 나오는 파생 필드다.

`slotId: 10` 은 2건뿐이다.

| id | E.G.O | 수감자 | 시즌 |
| --- | --- | --- | --- |
| `20210` | 홍염살 | 파우스트 | 7 |
| `20810` | 파도의 만가 | 이스마엘 | **8000**(콜라보) |

**적재** — 하지 않는다. `Ego.id` 가 이미 담고 있다.

### 4. `teamCodeEligible` — 미상

**110건 전부 `true`** 다. 인격 편 회차 1의 같은 이름 필드와 동일한 상태이며,
그때 "전부 `t` 인 값을 가지는 아직 고려할 만한 데이터는 아니다" 로 정의했다.

정보량 0이므로 판정을 바꿀 근거가 없다. **미적재.**

### 5. `name` — 영문 E.G.O 명

결손 0. **유일하지 않다** — 32종이 중복이며 최대 3명이 같은 이름을 쓴다.

```
4th Match Flame     3명       Dimension Shredder  3명
Bygone Days         3명       Hex Nail            3명
Telepole            3명       AEDD                2명
```

같은 E.G.O 를 여러 수감자가 갖는 게임 설계 그대로다. **이름은 식별자가 아니다.**

### 6. `nameKo` — 한국어 E.G.O 명

**110건 중 108건.** 결손 2건이 모두 `AEDD` 다.

| id | 수감자 | `name` | `nameKo` | loc-ko |
| --- | --- | --- | --- | --- |
| `20703` | 히스클리프 | `AEDD` | `null` | `"AEDD"` |
| `21204` | 그레고르 | `AEDD` | `null` | `"AEDD"` |

**결손이 아니다.** loc-ko 도 `"AEDD"` 라서 한국어명이 영문과 같다. 인격 편 회차 1에서
`11215` LCE E.G.O:: AEDD 가 한국 서버에서도 `AEDD` 로 표기되는 것을 확인했고 같은 사례다.

**적재** — `EgoText.name`. 변환기가 `mj.nameKo ?? loc-ko ?? assets.name` 순으로 폴백하므로
(`src/entities/egos.ts:107`) 두 건도 정상적으로 `"AEDD"` 가 된다.

### 7. `rarity` — 등급

```
zayin 20 · teth 32 · he 40 · waw 18
```

`limbus-assets` 의 `rank` 와 **110/110 같은 값**이며 대소문자만 다르다(`zayin` ↔ `ZAYIN`).

**등급이 죄악 자원 비용 총합의 범위를 결정한다** — 구간이 겹치지 않는다.

| 등급 | 건수 | 비용 총합 |
| --- | ---: | --- |
| ZAYIN | 20 | 4–6 |
| TETH | 32 | 5–8 |
| HE | 40 | 5–10 |
| WAW | 18 | 7–14 |

**적재** — `Ego.rank`. assets 의 대문자 표기를 쓴다. 화면은 등급 아이콘과 함께 원문 그대로
표시한다(`app/[locale]/egos/page.tsx:88`).

### 8. `sin` — 죄악 속성

```
gloom 17 · lust 17 · envy 16 · gluttony 16 · pride 16 · sloth 14 · wrath 14
```

`limbus-assets` 의 `awakeningType.affinity` 와 **110/110 일치**한다.
mj 는 **각성 값만** 담고 침식은 담지 못한다.

**비용에서 유도되지 않는다.** 주 죄악이 `resourceCost` 에 아예 없는 E.G.O 가 7건이다.

```
20104 차원찢개    sin=pride    cost={sloth:3, gluttony:3}
21201 어느날 갑자기 sin=sloth    cost={lust:3, gloom:1}
20904 들끓는 부식  sin=gluttony cost={sloth:2, gloom:2, pride:2}
```

주 죄악이 최대 비용인 것은 98/110 이다. **두 축은 별개다.**

**적재** — `Ego.awakenAffinity`(assets 경유).

### 9. `attackType` — 공격 타입

```
blunt 43 · pierce 36 · slash 31
```

`awakeningType.type` 과 **110/110 일치**. `sin` 과 같은 한계를 갖는다 — 침식 쪽을 담지 못한다.

**적재** — `Ego.awakenAtkType`(assets 경유).

### 10. `resourceCost` — 죄악 자원 소모량

```json
{ "wrath": 1, "sloth": 3 }
```

죄악 → 수량. 소모가 없는 죄악은 키 자체가 없다. `limbus-assets` 의 `cost` 와 **110/110 일치**.

| 축 | 실측 |
| --- | --- |
| 죄악 종류 수 | 1종 2건 · 2종 37 · 3종 50 · 4종 19 · 5종 1 · 7종 1 |
| 개별 수량 | 1–7 |
| 총합 | 4–14 |

**특이 4건**

| id | E.G.O | 비용 |
| --- | --- | --- |
| `20203` | 저주못 | `{envy: 6}` — 단일 죄악 최대 |
| `20304` | 평생 스튜 | `{lust: 5}` — 단일 죄악 |
| `21205` | 가시 화원 | 7종 각 2 — **모든 죄악을 쓰는 유일한 E.G.O** |
| `21009` | 하모니 | 5종 |

**적재** — `EgoCost(egoId, sin, amount)`. 소모가 0인 죄악은 행을 만들지 않는다
(`src/entities/egos.ts:118`).

### 11. `season` — 배급 구분

```
0     통상        33
1–7   시즌        65      (1:15 · 2:8 · 3:9 · 4:9 · 5:12 · 6:5 · 7:7)
8000  콜라보       4
91NN  발푸르기스    8      (9101·9103·9104·9105·9106·9108·9109)
```

`limbus-assets` 와 110/110 일치한다. **시즌 번호가 아니라 배급 대역이다.**

#### `8000` = 명일방주 콜라보 「선의의 순례」

**인격 편 어휘에 없던 값이다.** 인격의 `season` 은 `0` · `1–7` · `9101–9109` 뿐이었다.

2025-09-25 하루에 **E.G.O 4종만** 나왔고 인격은 0명이다.

| id | E.G.O | 수감자 | 배급 경로 | 명일방주 원본 |
| --- | --- | --- | --- | --- |
| `20209` | 명령 : 용해 | 파우스트 | E.G.O 특정 추출 | 켈시 · Monst3r |
| `20609` | 영작오 [宁作吾] | 홍루 | E.G.O 특정 추출 | 령 |
| `21209` | 눈부시지 않은 영광 | 그레고르 | E.G.O 특정 추출 | 므위나르 |
| `20810` | 파도의 만가 | 이스마엘 | **이벤트 보상** | 스카디 |

데이터에도 흔적이 남았다.

```
21209 statuses: ["Aggro","AttackDmgUp",...,"MlynarWaiting","Protection",...]
                                            ^^^^^^^^^^^^^ 므위나르(Młynar)
```

외부 IP 이름이 상태 id 에 박힌 것은 이 4종뿐이다.

**날짜가 시즌 소속을 부정한다.** 2025-09-25 는 시즌 6 한복판이다(인격 season 6 이
2025-08-14 ~ 2025-11-20). 그런데도 `6` 이 아니라 `8000` 이다 — 시즌에 속하지 않는다는 표시다.

#### 함정 — `8000` 은 영구 획득 불가다

복각이 없음을 명시한 **림버스 컴퍼니 최초의 타 게임 한정 콜라보**였다. 이벤트 종료 후
전투·서사가 극장(Theater)에도 들어가지 않았고 E.G.O 는 완전히 얻을 수 없다.

```
20209 · 20609 · 20810 · 21209    extractable 없음
```

추출 가능 28종에 들어가지 않는다. 화면에서 획득 경로를 다룰 때
**`season === 8000` 은 "복각 없음"** 으로, 시즌 한정 배포와 구분해 취급해야 한다.

#### `91NN` — 발푸르기스의 밤

인격과 같은 `91` + 회차 2자리 규칙이다. 다만 **회차 2와 7에는 E.G.O 가 없다** —
인격만 2명씩 나왔다.

| 회차 | E.G.O |
| --- | --- |
| 9101 | `20505` 후회 |
| 9102 | — |
| 9103 | `20806` 날갯짓 · `20906` 핏빛욕망 |
| 9104 | `21207` 엄숙한 애도 |
| 9105 | `21108` 마탄 |
| 9106 | `20309` 사랑과 증오의 이름으로 |
| 9107 | — |
| 9108 | `21009` 하모니 |
| 9109 | `20109` 엄숙한 애도 |

**적재** — `Ego.season` 에 원본 정수 그대로. 레이블 변환은 백로그 05.

### 12. `updatedDate` — 출시일

`20230227`–`20260709` 정수. `limbus-assets` 의 `date`(`YYYY-MM-DD`)와 **109/110 일치**한다.

어긋난 1건은 인격 편 회차 1에서 이미 잡은 오타다.

```
20306 전기울음(돈키호테)   mj 2023-04-11   assets 2024-04-11
```

시즌 4의 다른 E.G.O 가 전부 2024년이므로 assets 가 맞다. **연도 한 자리 오타.**

**적재** — `Ego.releaseDate`. assets 의 `date` 를 `toIsoDate` 로 변환한다
(`src/entities/egos.ts:88`). mj 의 `updatedDate` 는 읽지 않는다.

---

## 변환기가 이 파일에서 읽는 것은 두 필드뿐이다

`src/entities/egos.ts:47` 이 **`limbus-assets` 를 척추로** 잡는다. 인격 편이
`limbus-data-mj` 를 척추로 쓴 것과 **반대**다.

```ts
interface MjEgo {
    id: number;
    nameKo?: string;
}
```

mj 에서 쓰는 건 `id`(조인 키)와 `nameKo` 뿐이다.

| 필드 | 왜 안 읽나 |
| --- | --- |
| `sinnerId` · `slotId` | id 파생 · assets 도 갖는다 |
| `teamCodeEligible` | 전부 `true` · 정보량 0 |
| `name` | assets `name` 과 동일 |
| `rarity` | assets `rank` 의 소문자판 |
| `sin` · `attackType` | assets `awakeningType` 이 침식까지 담는다 |
| `resourceCost` | assets `cost` 와 동일 |
| `season` | assets 와 동일 |
| `updatedDate` | assets `date` 가 오타 1건을 고쳐 갖는다 |

**미적재 10필드는 결손이 아니라 중복이다.** mj/`egos.json` 은 assets/`egos.json` 의
진부분집합이며, 유일한 고유 기여가 **한국어 E.G.O 명**이다.

인격 편에서 mj 가 정본이었던 것과 정확히 뒤집힌 구도다.

---

## 함정 요약

1. **`season: 8000` 은 시즌 8이 아니다.** 명일방주 콜라보이며 **영구 획득 불가**다
2. `name` 은 **32종이 중복**이다. 식별자로 쓰면 안 된다
3. `nameKo` null 2건은 **결손이 아니다**. `AEDD` 는 한국어명이 영문과 같다
4. `sin` 은 `resourceCost` 에서 유도되지 않는다 — **7건은 주 죄악을 아예 안 쓴다**
5. `sin`·`attackType` 은 **각성 값만**이다. 침식은 mj 로 알 수 없다
6. `20306` 전기울음 `updatedDate` 는 **연도 오타**(2023 → 2024)

## 미해결

없다. 키 12종 전부 확정했다.

## 곁가지 관측 2

회차 3(`limbus-assets/egos.json`)에서 닫는다.

- **`corrosionAffinity` 는 항상 `awakenAffinity` 와 같다** — 침식 보유 98건 전부.
  `Ego.corrosionAffinity` 는 중복 컬럼일 수 있다. 공격 타입은 8건이 다르다
- **침식이 없는 12종이 정확히 각 수감자의 `slotId: 1` ZAYIN** 이다. 기본 E.G.O 이며
  인격 편의 "기본 인격 12명" 과 같은 자리다

## 근거 재현

```
data/entities/egos/limbus-data-mj/egos.json          110건 · 키 12종
data/entities/egos/limbus-assets/egos.json           대조 대상
data/entities/egos/loc-ko/Egos.json                  AEDD 확인
src/entities/egos.ts:47                              척추 배정
prisma/schema.prisma:380                             Ego 모델
app/[locale]/egos/page.tsx:88                        등급·각성 표시
```

## 출처

- [Limbus Company 공식 X — 파도의 만가](https://x.com/LimbusCompany_B/status/1970059417728192957)
- [Limbus Company 공식 X — 눈부시지 않은 영광](https://x.com/LimbusCompany_B/status/1970059755386527909)
- [Pilgrimage of Compassion — Limbus Company Wiki](https://limbuscompany.wiki.gg/wiki/Pilgrimage_of_Compassion)
