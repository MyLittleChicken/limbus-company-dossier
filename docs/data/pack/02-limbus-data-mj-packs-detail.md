# 회차 2 — `limbus-data-mj/packs_detail.json`

> **테마 팩 상세** · `limbus-data-mj` · **117건** · 250 KB · 키 **5종**
> 출처 커밋 `774883d7` · 스냅샷 2026-07-25 · 정리 2026-07-31

## 파일 정체

`packs.json` 과 id 집합이 완전히 같다. **거울 던전 맵이 어떻게 생성되는지**를 담은
유일한 파일이며, `limbus-assets` 에 대응물이 없다.

```
키   id · unlock · mapGen · exceptions · mapGenSequence
```

---

## 1. `unlock` — 해금 조건

```
null 1건 · unlockCode 115건 · 유일 26종
값   101–109 (본편 장) · 9103–9107 (발푸르기스) …
```

`10N` 은 N장 클리어를, `91NN` 은 발푸르기스 회차를 가리키는 것으로 보인다 —
인격·E.G.O 편의 `season` 어휘와 같은 자릿수 규칙이다.

**미적재.**

## 2. `mapGen` — 노드 풀 8종

| 키 | 보유 | 길이 | 유일 값 |
| --- | ---: | --- | ---: |
| `bossPool` | 117 | 1–4 | 204 |
| `battlePool` | 117 | 0–20 | 1,425 |
| `abBattlePool` | 117 | 0–15 | 397 |
| `hardBattlePool` | 117 | 0–5 | 382 |
| `hardAbBattlePool` | 113 | 0–5 | 117 |
| `eventPool` | 117 | 0–39 | 77 |
| `specialEventPool` · `specialEventProb` | 25 | | 84 |

```
전투 풀 합집합    2,525종    전부 7자리
이벤트 풀            77종    전부 6자리
```

**`ab` 는 환상체(Abnormality)** 다 — `abBattlePool` 은 환상체 전투 노드다.
E.G.O 편 회차 7의 `abName`, 기프트 편 회차 6·7의 `abnormalityName` 과 같은 축약이다.

### 인카운터 편의 재료다

`bossPool` 204 + 전투 풀 2,525 가 **인카운터 id 를 가리킨다.**
`data/entities/encounters/limbus-assets/` 는 251개 파일인데 **파일명이 숫자가 아니라**
교집합이 0이다. 인카운터 편에서 키 체계를 맞춰야 한다.

## 3. `exceptions` — 층 선택 예외

```
dungeonIdx 217 · selectableFloors 147
```

`{dungeonIdx, selectableFloors}` 쌍이며 던전 인덱스별로 고를 수 있는 층을 제한한다.

## 4. `mapGenSequence` — 맵 생성 절차

**타입 6종 285단계**다.

| `type` | 건수 | 뜻 |
| --- | ---: | --- |
| `CREATE_EMPTY_MD4_FLOOR` | 80 | 빈 층 만들기 |
| `FILL_MAP_BY_THEMEFLOOR_MAPGENOPTION` | 80 | 테마 옵션으로 채우기 |
| `OVERRIDE_RANDOM_EVENT_BY_CURSE_EVENT` | 50 | **무작위 이벤트를 저주 이벤트로 교체** |
| `CREATE_FIXED_FLOOR` | 37 | 고정 층 만들기 |
| `FILL_EMPTY_EVENT` | 36 | 빈 자리를 이벤트로 |
| `FILL_EMPTY_BOSS` | 2 | 빈 자리를 보스로 |

인자는 `numberList` 205 · `numberValue` 80 · `nodeList` 37 이다.

**`OVERRIDE_RANDOM_EVENT_BY_CURSE_EVENT` 50건**이 기프트 편 회차 7의
「저주 해제」 획득 경로(`cursedPair`/`blessedPair` 3쌍)와 이어진다.

```
CREATE_EMPTY_MD4_FLOOR    numberList [4, 3, 1]
FILL_MAP_BY_THEMEFLOOR…   numberValue 1001        ← 자기 팩 id
```

**미적재.** 우리는 맵을 생성하지 않는다 — 정보 제공 서비스라 필요가 없다.
다만 **거울 던전 구조를 아는 유일한 출처**이므로 기록해 둔다.

---

## 함정 요약

1. `unlock` 이 **1건 `null`** 이다
2. `hardAbBattlePool` 만 **4건에서 키가 없다**(나머지 7종은 117 전부 보유)
3. 전투 풀 2,525 가 인카운터를 가리키지만 **애셋 파일명과 체계가 다르다**
4. `mapGenSequence` 는 **절차형**이다. 선언적 구조가 아니라 순서가 의미를 갖는다

## 미해결

없다. 키 5종 전부 확정했다.

## 근거 재현

```
data/entities/packs/limbus-data-mj/packs_detail.json   117건 · 키 5종
data/entities/packs/limbus-data-mj/packs.json          id 집합 대조
data/entities/encounters/limbus-assets/                251개 · 체계 불일치 확인
```
