# E.G.O 계열 지도 (E.G.O Overview)

> 상태: **E.G.O 편 완료** / 최종 수정 2026-07-31 · 스냅샷 2026-07-25
> 회차 1–9 를 모두 마쳤다. 미해결 없이 닫혔다.

## 1. E.G.O id 체계

```
2 | 수감자(2자리) | 순번(2자리)

20101 = 수감자 01(이상)의 1번째 E.G.O
21209 = 수감자 12(그레고르)의 9번째 E.G.O
```

**110건 전부 이 규칙을 지킨다**(위반 0). 원본의 `sinnerId`·`slotId` 와 자릿값이
110/110 일치한다 — 두 필드는 id 파생이다.

인격은 같은 자리에 `1` 을 쓴다(`10101`). E.G.O **스킬**은 `2xxxxxx` 7자리 대역이며
인격 편 회차 3에서 208건을 보았다.

## 2. 수감자별 E.G.O 수

```
1 이상 9 · 2 파우스트 10 · 3 돈키호테 9 · 4 료슈 9 · 5 뫼르소 9 · 6 홍루 9
7 히스클리프 9 · 8 이스마엘 10 · 9 로쟈 9 · 10 싱클레어 9 · 11 오티스 9 · 12 그레고르 9
```

파우스트와 이스마엘만 10이다. 두 건 다 `slotId: 10` 이며 **콜라보 배급과 시즌 7**에서 나왔다.

인격(14–16개)보다 적고 편차도 작다.

## 3. 원본 파일

| 파일 | 회차 | 성격 |
| --- | --- | --- |
| `limbus-data-mj/egos.json` | 1 | 본체 110건. **한국어명 외에는 assets 와 중복** |
| `limbus-data-mj/egos_detail.json` | 2 | **스킬·패시브로 가는 다리.** 208 + 113 을 여기서 연다 |
| `limbus-assets/egos.json` | 3 | **정본** · 척추. 고유 개념은 `statuses` 하나 |
| `limbus-assets/egos_mini.json` · `ego_voicelines.json` · `ego_header_offsets.json` | 4 | 요약판·부속. 전량 중복이거나 미적재 |
| `shared-library/egos.json` · `egos_mini.json` | 4 | 구버전 대조. **2026-03-05 직전 스냅샷** |
| `ego-details/limbus-assets/{id}.json` 110개 | 5 | E.G.O 패시브가 여기에만 있다 |
| `loc-*/Egos.json` | 6 | 표시명·설명 |
| `loc-*/Skills_Ego*.json` 13파일 × 3 | 7 | E.G.O 스킬 문자열 |
| `loc-*/Passive_Ego.json` | 8 | E.G.O 패시브 문자열 |
| `data/assets/egos/` 318개 | 9 | 이미지. 결손 0 · 잉여 0 |

## 4. DB 모델 7종

```
Ego ─┬─ EgoText
     ├─ EgoCost     (sin × N)
     ├─ EgoResist   (sin × 7)
     ├─ EgoStatus ─ Status
     └─ EgoPassive ─ EgoPassiveText
```

`prisma/schema.prisma:380` 부근. **변환기는 `limbus-assets` 를 척추로 쓴다**
(`src/entities/egos.ts:47`) — 인격 편이 `limbus-data-mj` 를 척추로 쓴 것과 반대다.

## 5. 개념 장부

각 회차에서 확인한 개념을 누적한다. 편이 끝나면 5.2 에 결산한다.

### 5.1 장부

| 개념 | `limbus-data-mj` | `limbus-assets` | 정본 | 근거 | 회차 |
| --- | --- | --- | --- | --- | --- |
| 등급 | `egos.rarity`(소문자) | `egos.rank`(대문자) | **assets** | 110/110 동일. 표기만 다르다 | 1 |
| 각성 속성 | `egos.sin` · `egos.attackType` | `egos.awakeningType` | **assets** | 110/110 동일. mj 는 침식을 못 담는다 | 1 |
| 침식 속성 | `egos_detail.corrosionSkill` → `skills.json` | `egos.corrosionType` | **assets** | mj 도 조인으로 110/110 재구성. 죄악은 각성과 항상 같고 공격 타입만 8건 다르다 | 1·3 |
| 죄악 자원 비용 | `egos.resourceCost` | `egos.cost` | **assets** | 110/110 동일 | 1 |
| 시즌 | `egos.season` | `egos.season` | 동일 | 110/110. `8000`=콜라보 대역 | 1 |
| 출시일 | `egos.updatedDate`(정수) | `egos.date`(`YYYY-MM-DD`) | **assets** | 109/110 동일. 어긋난 1건은 구버전 assets 도 같은 값이었다 | 1·4 |
| 한국어 E.G.O 명 | `egos.nameKo`(108/110) | — | **mj + loc-ko** | assets 는 영문뿐. loc-ko 가 108/108 일치하고 결손 2건도 덮는다 | 1·6 |
| 연출 전용 E.G.O | — | — | **loc-\*** | `Egos-a1c9p3.json` 5건. **id 가 6자리** | 6 |
| E.G.O 스킬 문자열(ko) | `skills.json` 의 `nameKo`·`descKo`(208) | — | **loc-ko** | 코인 효과 한국어는 여기뿐. 210건으로 mj 보다 2건 많다 | 7 |
| **유래 환상체** | — | — | **loc-\*** | `abName`. 72종. **어느 출처에도 없는 개념** | 7 |
| E.G.O 패시브 문자열(ko) | `passives.json` 의 `nameKo`·`descKo`(113) | — | 동일 | loc-ko 와 113/113 글자까지 같다 | 8 |
| 패시브 축약 설명 | — | — | **loc-\*** | `summary`. 20건만. loc 공통 필드이며 화면 미표시 | 8 |
| 팀코드 적격 | `egos.teamCodeEligible`(전부 `true`) | — | **없음** | 정보량 0. 인격 편과 같은 판정 | 1 |
| 죄악 저항 | `egos_detail.attributeResists`(9축) | `egos.resists`(sin × 7) | 동일 | 죄악 7축 110/110 일치. `white`/`black` 은 상수 | 1·2 |
| E.G.O 가 다루는 상태 | — | `egos.statuses`(137종) | **assets** | **mj 가 못 갖는 유일한 개념.** 64종은 인격 축에도 없다 | 1·3 |
| 상시 추출 풀 | — | `egos.extractable`(28건) | **assets** | 게임 추출 확률표와 일치. `20509` 착영휘도는 이벤트라 `X` | 3 |
| 환상 해석 최대 단계 | `skills.json` 의 `level: 5` | `egos.maxThreadspin`(3건) | 동일 | 기본 4. 4번째 성냥불 3종만 5 | 3 |
| 침식 확률 곡선 | `egos_detail.corrosion` | — | **mj** | 110건 전부 같은 상수. `section` 은 정규화 SP 위치(`0.5`=SP 0) | 2 |
| E.G.O 스킬 | `egos_detail` 의 id 208 + `skills.json` 의 수치 없음 | `ego-details` 의 스킬 **210** + 수치 전량 | **assets** | assets 가 상위집합. `2060812`·`2120912` 는 mj 에 없다 | 2·5 |
| E.G.O 패시브 | `egos_detail.awakeningPassives`(113) | `ego-details.passiveList`(113) | **assets** | 개수 일치. mj 는 id 만, assets 는 원문 | 2·5 |
| 환상 해석 보너스 | — | `ego-details` 의 `bonuses` | **assets** | mj 에 없다 | 5 |
| 조건부 기믹 원문 | — | `ego-details.passiveList[].desc` · `loc-*/Passive_Ego.json` | **assets + loc** | "~로 취급됨" 2건. **게임 화면에 그대로 나온다** | 5·8 |
| 죄악 자원 비용(색 표기) | `egos_detail.requirements` | — | 중복 | `resourceCost` 와 110/110 동일 | 2 |
| 색 토큰 ↔ 죄악 치환표 | `mechanics/sins.json` | `skill_tags.json` 의 색 표기 | **mj** | 7종 완전 사전 | 2 |
| E.G.O 이미지 | — | `assets/egos/` 318개 | **assets** | `iconId` 같은 중간 키 없이 id 로 직접 조회 | 9 |
| 전투 대사 | — | `ego_voicelines.json`(237) | **assets** | 미적재 | 4 |

### 5.2 결산 — 어느 출처도 혼자서는 부족하다

E.G.O 편 9회차의 결론이다. **인격 편과 같은 답이지만 분포가 다르다.**

| 출처 | 단독 보유 개념 | 내용 |
| --- | ---: | --- |
| `limbus-data-mj` | **1** | 침식 확률 곡선(`corrosion`) |
| `limbus-assets` | **7** | `statuses` · 스킬 수치 전량 · `bonuses` · 조건부 기믹 원문 · 전투 대사 · 이미지 · `extractable` |
| `loc-ko/en/ja` | **4** | **유래 환상체**(`abName`) · 코인 효과 한국어 · 연출 전용 E.G.O · 패시브 `summary` |
| `shared-library` | 0 | 구버전 시간축만 제공 |

**인격 편은 mj 9 · assets 15 · loc 6 이었다.** E.G.O 편은 mj 가 1로 줄었다. 개념 수가
준 것은 E.G.O 가 단순해서가 아니라 **두 출처의 중복이 크기 때문**이다 — 회차 3에서
mj 가 조인으로 4개 개념을 재구성함을 실측했다.

도구 도메인 필드는 **없다.** `extractable` 을 한때 그렇게 판정했으나 게임의 상시 추출
풀과 일치함이 확인돼 철회했다(회차 3).

> **그래도 어느 하나로는 안 된다.** `loc-*` 이 4개를 단독으로 갖고, 그중 `abName`(환상체)은
> **다른 어떤 파일에도 없다.**

### 5.3 E.G.O 편에서 확인된 원본 결함 4건

| 사례 | 성격 | 회차 |
| --- | --- | --- |
| `20306` 전기울음 날짜 `2023-04-11` | mj·구버전 assets 가 같은 오타. 현행 assets 만 정정 | 1·4 |
| 일본어 `20302` 물주머니 `基本E.G.O装備` | **ja 단독 오기.** `slotId` 2 · HE 인데 기본으로 표기 | 6 |
| `Skills_Ego-a1c5p2.json` · `Passive_Ego-a1c5p2.json` | 3로케일 전부 **빈 객체 `[{}]`** | 7·8 |
| `en` 에 `*-a1c9p2.json` 없음 | 로케일마다 파일 목록이 다르다 | 7·8 |

### 5.4 회차를 가로지른 E.G.O

| 대상 | 나온 곳 |
| --- | --- |
| **침식 없는 12종** (각 수감자 `slotId: 1` ZAYIN) | 회차 1·2·3·4·5·6·**9** — 일곱 번 같은 집합 |
| `20102`·`20402`·`20902` **4번째 성냥불** | 각성 패시브 2개 · `maxThreadspin` 5 · uptie 5 · 환상체 「불타버린 소녀」 |
| `20509` 착영휘도 (뫼르소) | 조건부 기믹 원문 · 전용 상태 4종 · `AlcoholKimPersonal` |
| `20109` 엄숙한 애도 (이상) | 조건부 기믹 원문 · 대사 결손 · shared 미수록 · season 9109 |
| `8000` 콜라보 4종 | 복각 없음 · `MlynarWaiting` · `extractable` 없음 |
| `20608`·`21209` | **각성 스킬 2개.** mj 에 없는 `2060812`·`2120912` |

### 5.5 강화 축은 인격과 이름이 다르다

```
인격    Uptie       동기화        1–5 · 3단계가 각성(gacksung)
E.G.O   Threadspin  환상 해석     1–4 · 3종만 5
```

`mirror-dungeon/loc-ko/TutorialMirrorDungeon.json` 이 두 이름을 한 문장에 쓴다 —
"인격의 **동기화 단계**와 E.G.O의 **환상 해석 단계**". 영문판은
`Uptie and Threadspin Tiers` 다. **섞어 쓰면 안 된다.**

## 6. 인격 편에서 미리 본 것

E.G.O 는 인격 편 회차 3·4·8에서 절반이 노출됐다. 그 관측을 여기서 닫는다.

| 인격 편 관측 | 회차 | E.G.O 편에서 닫을 곳 |
| --- | --- | --- |
| `skills.json` 의 `2xxxxxx` 대역 208건 · 접미 `11`(각성)/`21`(침식) | 3 | **회차 2에서 닫음** — `awakeningSkill`+`corrosionSkill`. 적재처는 회차 5 |
| `passives.json` 의 `2xxxxxx` 113건 — mj 로는 조회되지 않음 | 4 | **회차 2에서 닫음** — `awakeningPassives`. 다리가 `egos_detail.json` 이었다 |
| 각성/침식 구분의 정본이 어디인가 | 3 | **회차 1에서 닫음** — assets `awakeningType`/`corrosionType` |
| E.G.O 저항은 죄악 7종 축 (인격은 공격 타입 3종) | `docs/09-resistance.md` | 회차 3 |
| 조건부 기믹 — E.G.O 착용이 인격의 기믹 축을 바꾼다 | 1 | `docs/08-gimmick-keywords.md` |
