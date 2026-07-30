# E.G.O 계열 지도 (E.G.O Overview)

> 상태: **회차 1–2 완료** / 최종 수정 2026-07-30 · 스냅샷 2026-07-25
> 인격 편(회차 1–14)이 닫힌 뒤 시작했다. E.G.O 편은 9회차 예정이다.

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
| `limbus-assets/egos.json` | 3 | **정본** · 저항·상태·추출·침식 |
| `limbus-assets/egos_mini.json` · `ego_voicelines.json` · `ego_header_offsets.json` | 4 | 요약판·부속 (+`shared-library` 대조) |
| `ego-details/limbus-assets/{id}.json` 110개 | 5 | E.G.O 패시브가 여기에만 있다 |
| `loc-*/Egos.json` | 6 | 표시명·설명 |
| `loc-*/Skills_Ego*.json` 13파일 × 3 | 7 | E.G.O 스킬 문자열 |
| `loc-*/Passive_Ego.json` | 8 | E.G.O 패시브 문자열 |
| `data/assets/egos/` 318개 | 9 | 이미지 |

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
| 침식 속성 | — | `egos.corrosionType` | **assets** | mj 에 없다. 12종은 침식 자체가 없다 | 1 |
| 죄악 자원 비용 | `egos.resourceCost` | `egos.cost` | **assets** | 110/110 동일 | 1 |
| 시즌 | `egos.season` | `egos.season` | 동일 | 110/110. `8000`=콜라보 대역 | 1 |
| 출시일 | `egos.updatedDate`(정수) | `egos.date`(`YYYY-MM-DD`) | **assets** | 109/110 동일. 어긋난 1건이 mj 오타 | 1 |
| 한국어 E.G.O 명 | `egos.nameKo`(108/110) | — | **mj + loc-ko** | assets 는 영문뿐. 결손 2건은 loc-ko 가 덮는다 | 1 |
| 팀코드 적격 | `egos.teamCodeEligible`(전부 `true`) | — | **없음** | 정보량 0. 인격 편과 같은 판정 | 1 |
| 죄악 저항 | — | `egos.resists`(sin × 7) | **assets** | mj 에 없다 | 1 |
| E.G.O 가 다루는 상태 | — | `egos.statuses` | **assets** | mj 에 없다 | 1 |
| 추출 가능 여부 | — | `egos.extractable` | **assets** | mj 에 없다 | 1 |
| 죄악 저항(값) | `egos_detail.attributeResists`(9축) | `egos.resists`(7축) | 동일 | 죄악 7축 110/110 일치. `white`/`black` 은 상수 | 2 |
| 침식 확률 곡선 | `egos_detail.corrosion` | — | **mj** | 110건 전부 같은 상수. 수치 출처는 여기뿐 | 2 |
| E.G.O 스킬 연결 | `egos_detail.awakeningSkill`·`corrosionSkill`(208) | `ego-details/` | 미정 | 회차 5에서 판정 | 2 |
| E.G.O 패시브 연결 | `egos_detail.awakeningPassives`(113) | `ego-details.passiveList` | **assets** | 우리는 assets 를 쓴다 | 2 |
| 죄악 자원 비용(색 표기) | `egos_detail.requirements` | — | 중복 | `resourceCost` 와 110/110 동일 | 2 |
| 색 토큰 ↔ 죄악 치환표 | `mechanics/sins.json` | `skill_tags.json` 의 색 표기 | **mj** | 7종 완전 사전 | 2 |

## 6. 인격 편에서 미리 본 것

E.G.O 는 인격 편 회차 3·4·8에서 절반이 노출됐다. 그 관측을 여기서 닫는다.

| 인격 편 관측 | 회차 | E.G.O 편에서 닫을 곳 |
| --- | --- | --- |
| `skills.json` 의 `2xxxxxx` 대역 208건 · 접미 `11`(각성)/`21`(침식) | 3 | **회차 2에서 닫음** — `awakeningSkill`+`corrosionSkill`. 적재처는 회차 5 |
| `passives.json` 의 `2xxxxxx` 113건 — mj 로는 조회되지 않음 | 4 | **회차 2에서 닫음** — `awakeningPassives`. 다리가 `egos_detail.json` 이었다 |
| 각성/침식 구분의 정본이 어디인가 | 3 | **회차 1에서 닫음** — assets `awakeningType`/`corrosionType` |
| E.G.O 저항은 죄악 7종 축 (인격은 공격 타입 3종) | `docs/09-resistance.md` | 회차 3 |
| 조건부 기믹 — E.G.O 착용이 인격의 기믹 축을 바꾼다 | 1 | `docs/08-gimmick-keywords.md` |
