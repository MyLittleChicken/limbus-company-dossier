# 회차 2 — `limbus-assets/md_choice_events.json`

> **선택지 이벤트** · `limbus-assets` · **159건** · 465 KB · 키 **8종**
> 출처 커밋 `774883d7` · 스냅샷 2026-07-25 · 정리 2026-07-31

## 파일 정체

거울 던전의 선택지 노드다. 팩 편 회차 2에서 본 `eventPool` 이 가리키던 대상이며,
기프트 편 회차 3의 `events` 156종도 여기를 가리킨다.

```
키   name · desc · type · messages · options · gifts(156) · advantages(112) · illustId(1)
id   901001–971112 · 6자리 문자열
```

**`type` 은 159건 전부 `"Choice"`** 다. 상수다.

---

## 1. 세 출처가 같은 이벤트를 가리킨다

```
packs_detail  eventPool 77 + specialEventPool 84  =  합집합 153
gifts(assets) events                                          156
md_choice_events                                              159
```

| 대조 | 결과 |
| --- | --- |
| 기프트 `events` ↔ 이 파일 | **156 / 156 완전 포함** · 기프트에만 0 |
| 팩 풀 ↔ 이 파일 | 교집합 151 · 이 파일에만 8 · **풀에만 2** |

### 풀에만 있는 2건은 정의가 없다

```
971071 · 971072      packs_detail 이 참조하는데 md_choice_events 에 없다
```

**참조 깨짐 2건**이다. 거울 던전 맵 생성이 이 둘을 뽑으면 정의를 찾지 못한다.

### 이 파일에만 있는 8건

```
971048  (이름이 빈 문자열)
971057 The Carousel               971058 Refracted Sleeping Bag of a Bygone Day
971059 Refracted Four-hundred Roses  971085 Yield My Flesh
971086 T Corp. Time Prepayment Apparatus
971087 Audio Logs of That Day     971089 Poultry Memory
```

어느 팩 풀에서도 안 뽑힌다. **`971048` 은 `name` 이 빈 문자열**이라 원본 결함으로 보이고,
나머지 7건은 배정되지 않은 이벤트다.

## 2. `id` 앞자리가 둘뿐이다

```
901xxx  74건        971xxx  85건
```

팩 편 회차 2의 `eventPool` 표본(`901001`–`901040` · `971055`)과 같은 대역이다.

## 3. `options` — 선택지 구조

```
길이   2개 106 · 3개 52 · 4개 1
키     message · messageDesc(297) · result · lockCondition(10)
```

`lockCondition` 10건은 **잠긴 선택지**다.

### `result` — 조건부 분기

```
키   condition(382) · results(146) · nextEvent(164)
```

`nextEvent` 164건이 있어 **선택지가 다음 이벤트로 이어진다.** 단일 노드가 아니라 트리다.

#### `condition` 10종

```
None 362 · 50.0% Chance 10 · 80.0%/20.0% Chance 2씩
Average SP under 0 / not less than 0 / under 25 / not less than 25   각 1
1.0% / 99.0% Chance   각 1
```

**확률 분기와 평균 SP 분기 두 종류**다. 문자열로 적혀 있어 파싱해야 한다.

#### 결과 `type` 16종

| 종류 | 건수 |
| --- | ---: |
| `getEgoGift` · `getEgoGiftOnWin` | 72 + 52 |
| `battle` | 25 |
| `loseHp` · `loseSp` | 15 + 15 |
| `gainCost` · `loseCost` | 15 + 3 |
| `healHp` · `healHpSp` · `healSp` · `loseHpSp` | 10 · 7 · 5 · 5 |
| `special` | 4 |
| `healSpFull` · `healHpFull` · `healHpPercent` | 1씩 |
| **`type` 없음** | **3** |

**`type` 키가 없는 결과 3건**이 있다 — 원본 결함이다.

`battle` 25건은 `{id, label, type}` 형태이며 **7자리 인카운터 id**(`2060032`)를 갖는다.
팩 편 회차 2의 전투 풀 2,525종과 같은 체계다.

`special` 4건은 구조가 아니라 **자연어 문장**이다(`text` 키).

## 4. `advantages` — 죄악 7종

```
112건 보유 · pride 47 · lust 43 · envy 41 · gluttony 39 · gloom 38 · sloth 37 · wrath 32
```

**이벤트가 유리해지는 죄악**이다. 한 이벤트가 여러 죄악을 가질 수 있다.
`illustId` 는 1건뿐이다.

---

## 우리는 이 파일을 읽지 않는다

`src/entities/egos.ts:211` 이 `md__details.json` 의 `grace` 만 읽고, 선택지 이벤트는
어느 변환기도 다루지 않는다. **`ChoiceEvent` 모델이 없다.**

`data/assets/choice-events/` 에 이미지 158개가 있는데(인격 편 회차 14의 애셋 조사)
그것도 미적재다.

---

## 함정 요약

1. **`971071` · `971072` 는 참조 깨짐**이다. 팩이 뽑는데 정의가 없다
2. `971048` 은 **`name` 이 빈 문자열**이다
3. 결과 3건에 **`type` 키가 없다**
4. `condition` 이 **자연어 문자열**이다(`"50.0% Chance"`). 구조가 아니다
5. `nextEvent` 164건 — **이벤트가 트리**다. 단일 노드로 보면 안 된다

## 미해결

없다. 159건 전부 확정했다.

### 이월 확인 2건

- ✔ **팩 편 회차 2** `eventPool` 77 · `specialEventPool` 84 의 정체 — 선택지 이벤트
- ✔ **기프트 편 회차 3** `events` 156종 — **156/156 이 여기 있다**

## 근거 재현

```
data/entities/mirror-dungeon/limbus-assets/md_choice_events.json   159건 · 키 8종
data/entities/packs/limbus-data-mj/packs_detail.json               eventPool 대조
data/entities/gifts/limbus-assets/gifts.json                       events 156/156
data/assets/choice-events/                                         이미지 158개
```
