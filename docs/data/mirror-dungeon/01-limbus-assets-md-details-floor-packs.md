# 회차 1 — `limbus-assets/md__details.json` + `md_floor_packs.json`

> **거울 던전 기본 구조** · `md__details.json` 17 KB · `md_floor_packs.json` 4.3 KB
> `shared-library/md_floor_packs.json` 2.1 KB 대조
> 출처 커밋 `774883d7` · 스냅샷 2026-07-25 · 정리 2026-07-31
> **거울 던전 편(회차 1–7)의 첫 회차**

---

## 1. `md__details.json` — 최상위 3종

```
grace           10종     은총
startGiftPool   10축     시작 기프트
adversity        5단계   역경(난이도 보정)
```

### 1.1 `grace` — 은총 10종

```
index · id · name · cost · descs[3]
```

| # | id | 비용 |
| ---: | --- | ---: |
| 1 | `star-of-the-beginning` | 10 |
| 2 | `cumulating-starcloud` | 10 |
| 3 | `interstellar-travel` | 20 |
| 4 | `star-shower` | 20 |
| 5 | `binary-star-shop` | 30 |
| 6 | `moon-star-shop` | 30 |
| 7 | `favor-of-the-nebulae` | 40 |
| 8 | `starlight-guidance` | 40 |
| 9 | `chance-comet` | 50 |
| 10 | `perfected-possibility` | 50 |

**비용이 10·20·30·40·50 두 개씩 정확히 짝을 이룬다.** `descs` 는 전부 3단계다.

id 가 그대로 아이콘 파일명이다 — `data/assets/icons/` 에서 본
`star-of-the-beginning.webp` · `chance-comet.webp` 등이 이것이다(E.G.O 편 회차 9).

**영문만 있다.** 한국어는 회차 7의 `MirrorDungeonUI*` 에서 온다.

### 1.2 `startGiftPool` — 팩 편과 같은 30건

```
10축 × 3개 = 30
```

**`limbus-data-mj/start_gifts.json` 과 10/10 완전 일치**한다(팩 편 회차 4).

| | mj `start_gifts.json` | assets `startGiftPool` |
| --- | --- | --- |
| 위치 | 기프트 디렉토리 | 거울 던전 디렉토리 |
| 키 | `burn`(소문자) | `Burn`(대문자) |
| 값 | 동일 | 동일 |

**같은 사실이 두 출처·두 디렉토리에 있다.** 어긋난 곳이 없다.

### 1.3 `adversity` — 역경 5단계

키가 `"11"`–`"15"` 다. 각 단계에 6개 항목이며 `{name, desc, value}` 다.

```
11   value 합  9      Mark of Fire I · Inflation I · Ego Interference I …
12   value 합 11      Mental Psychosis I …
13   value 합 13      Tremor Barrier …
14   value 합 13      Vitality Boost …
15   value 합 14      Mental Psychosis II …
```

**`Level Boost`(적 레벨 +3)와 `Frailness`(아군 최대 체력 −10%)는 5단계 전부에 있다.**
나머지 4개가 단계마다 갈리며 `value` 합이 9 → 14 로 커진다.

키 `11`–`15` 가 **팩 편의 `extreme` 대역(`15xx`)** 과 관련 있어 보이지만 확정하지 못했다.
회차 3(업적)·회차 7(UI)에서 다시 본다.

---

## 2. `md_floor_packs.json` — 층별 출현 팩

```
최상위   hard · normal
층 키    normal  1 · 2 · 3 · 4 · 5
         hard    1 · 2 · 3 · 4 · 5 · 6-10 · 11-15
```

**하드에만 `6-10` · `11-15` 구간이 있다.** 무한 층(Infinity Floor) 구조이며,
회차 7의 `MirrorDungeonUI_5_InfinityFloor.json` 과 이어진다.

```
assets   hard 213개 참조 / 유일 116 · normal 75개 / 유일 51
```

참조 팩 116종이 **`packs.json` 117건에 전부 있다**(결손 0).

### 팩 편과 층 배정이 완전히 맞는다

```
md_floor_packs 의 (층, 팩) 쌍   ↔   packs.json 의 normalFloors · hardFloors
일치 218 · 불일치 0
```

**같은 관계를 두 출처가 반대 방향으로 저장하는데 어긋난 곳이 없다.**

```
packs.json      팩 → 층      "1013" 은 hard 1층에 나온다
md_floor_packs  층 → 팩      hard 1층에 1013 이 있다
```

기프트↔팩 역참조(팩 편 회차 1, 441/441)에 이은 **두 번째 완전 일치 쌍**이다.

### `shared-library` 대조

```
shared   hard 97개 / 유일 55 · normal 41개 / 유일 28
```

구조가 같고 **양이 절반이다.** 팩 편 회차 3의 `shared-library` 가 56건(현행 117)이었던
것과 맞는다 — 같은 시점의 스냅샷이다.

여기서는 **id 가 숫자 문자열**(`"1001"`)이라 팩 편의 `C1-1` 체계와 다르다.
같은 `shared-library` 안에서도 파일마다 id 체계가 갈린다.

---

## 함정 요약

1. `adversity` 키가 **문자열 `"11"`–`"15"`** 다. 정수가 아니다
2. 층 키에 **`"6-10"` · `"11-15"` 범위 문자열**이 섞인다. 정수 파싱이 깨진다
3. `startGiftPool` 키는 **대문자**(`Burn`), mj `start_gifts.json` 은 소문자(`burn`)
4. `shared-library` 의 `md_floor_packs.json` 은 **숫자 id**를 쓴다 — 같은 디렉토리의
   `md_theme_packs.json`(`C1-1`)과 체계가 다르다

## 미해결

없다. 2파일 + 구버전 대조 전부 확정했다.

### 이월 확인 1건

- ✔ **팩 편 회차 1** `normalFloors`·`hardFloors` 의 반대 방향 데이터 — **218/218 일치**

## 근거 재현

```
data/entities/mirror-dungeon/limbus-assets/md__details.json        grace 10 · adversity 5
data/entities/mirror-dungeon/limbus-assets/md_floor_packs.json     hard 7구간 · normal 5층
data/entities/mirror-dungeon/shared-library/md_floor_packs.json    구버전 · 숫자 id
data/entities/packs/limbus-data-mj/packs.json                      층 배정 218/218
data/entities/gifts/limbus-data-mj/start_gifts.json                30건 10/10 일치
data/assets/icons/limbus-assets/                                   은총 아이콘 10종
```
