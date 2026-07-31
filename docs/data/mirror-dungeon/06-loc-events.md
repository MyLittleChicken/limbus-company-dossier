# 회차 6 — `loc-*` 의 거울 던전 이벤트 계열

> **선택지·환상체 이벤트 문자열** · 3로케일 × **12파일** · 유일 **364건**
> 출처 커밋 `774883d7` · 스냅샷 2026-07-25 · 정리 2026-07-31

**세 로케일이 파일 목록·건수·id 집합까지 완전히 대칭**이다(4계열 전부).

| 계열 | 파일 | 건수 | 항목 키 |
| --- | ---: | ---: | --- |
| `ActionEvents_Mirror*` | 5 | 128 | `id` · `name` · `desc` · `subDesc` · `options` |
| `AbEvents_Mirror*` | 5 | 108 | `id` · `title` · `eventDesc` · `prevDesc` · `behaveDesc` · `successDesc` · `failureDesc` |
| `ChoiceEventEffect.json` | 1 | 116 | `id`(**문자열**) · `content` |
| `AbnormalityGuides_Mirror.json` | 1 | 12 | `id` · `name` · `codeName` · `clue` · `storyList` |

파일 접미(`Mirror3` · `Mirror4` · `Mirror6` · `Mirror7`)가 **거울 던전 판 번호**다.
접미 없는 것이 가장 크다(`ActionEvents_Mirror.json` 77 · `AbEvents_Mirror.json` 58).

---

## 1. `ActionEvents_Mirror*` — 회차 2와 대응한다

```
128건 · id 900011–97111201
options 길이  1개 5 · 2개 81 · 3개 41 · 4개 1
option 키     message(294) · result(261) · messageDesc(193)
```

`limbus-assets/md_choice_events.json`(159건) 과 **id 로 이어진다.**

```
교집합                 103
ActionEvents 에만       25
md_choice_events 에만   56
```

**양쪽 다 상대에게 없는 것을 갖는다.** assets 는 구조(결과 타입·확률)를,
로케일은 문자열(선택지 문구)을 담는데 **커버 범위가 어긋난다.**

`options` 의 `message` · `messageDesc` 는 회차 2의 같은 이름 필드와 대응하며,
회차 2의 `options` 길이 분포(2개 106 · 3개 52 · 4개 1)와 **비슷하지만 다르다** —
`ActionEvents` 만 길이 1인 것이 5건 있다.

## 2. `AbEvents_Mirror*` — 환상체 이벤트

```
108건 · id 90100201–97111202 (8자리)
```

`md_choice_events` 와 **교집합이 0**이다. 완전히 다른 계열이다.

```
title · eventDesc · prevDesc     ← 빈 문자열인 것이 많다
behaveDesc                       "누구를 앞세워야 할까?"
successDesc · failureDesc        배열 — 성공/실패 서사
```

**성공·실패로 갈리는 서사형 이벤트**다. 선택지 이벤트(`ActionEvents`)와 달리
결과가 둘로 고정된다.

id 가 **8자리**로 `md_choice_events` 의 6자리보다 길다 — `90100201` 은
`901002` + `01` 로 읽히므로 **선택지 이벤트의 하위 노드**로 보인다.

## 3. `ChoiceEventEffect.json` — **id 가 문자열이다**

```
116건 · id 가 "Choice_901001" · "ChangeEventIllust" · "UnlockHiddenRoute" 형태
```

`Choice_` 접두를 뗀 나머지가 이벤트 id 다. 그 밖에 `ChangeEventIllust` ·
`UnlockHiddenRoute` 같은 **동작 이름**도 섞인다.

`content` 는 **색 마크업이 짙다.**

```
<color=#ebcaa2>다음 전투 시작 시 모든 아군이</color> <color=#f8c200>공격 위력 증가 3</color>…
<color=#ff0000>전투 발생!</color>
```

회차 2의 `results[].type`(`getEgoGift` · `battle` …)을 **사람이 읽는 문장으로 옮긴 것**이다.
`ChangeEventIllust` 는 `content` 가 빈 문자열이다.

## 4. `AbnormalityGuides_Mirror.json` — 환상체 도감 12종

```
id 8082–8096 · name · codeName · clue · storyList
```

```
8082  크로머             codeName 00-00-00      storyList 3
8083  첫사람이 되려한 크로머  codeName ??-??-??-??   storyList 1
8084  단수어             codeName O-02-11-26    storyList 2
8085  골목파수견           codeName O-02-10-11    storyList 3
```

**`codeName` 이 로보토미 코퍼레이션의 환상체 코드**다(`O-02-11-26` 형식).
`8083` 은 `??-??-??-??` 로 **의도적으로 가려져 있다.**

E.G.O 편 회차 7의 `abName`(유래 환상체 72종)과 같은 세계관 축이지만
**이름 집합이 다르다** — 여기 12종은 거울 던전에 등장하는 환상체다.

---

## 우리는 읽지 않는다

이벤트 모델이 없어 **364건 전부 미적재**다. 회차 2의 `md_choice_events` 와 마찬가지다.

---

## 함정 요약

1. `ChoiceEventEffect` 의 **id 가 문자열**이다. 정수로 파싱하면 깨진다
2. `AbEvents` 는 `md_choice_events` 와 **교집합이 0**이다. 다른 계열이다
3. `ActionEvents` ↔ `md_choice_events` 가 **양방향으로 어긋난다**(25 · 56)
4. `AbEvents` 의 `title` · `eventDesc` · `prevDesc` 는 **빈 문자열인 것이 많다**
5. `content` 에 **`<color=…>` 마크업이 짙다**. 지우면 강조가 사라진다

## 미해결

없다. 12파일 × 3로케일 전부 확정했다.

## 근거 재현

```
data/entities/mirror-dungeon/loc-{ko,en,ja}/ActionEvents_Mirror*.json      128
data/entities/mirror-dungeon/loc-{ko,en,ja}/AbEvents_Mirror*.json          108
data/entities/mirror-dungeon/loc-{ko,en,ja}/ChoiceEventEffect.json         116
data/entities/mirror-dungeon/loc-{ko,en,ja}/AbnormalityGuides_Mirror.json   12
data/entities/mirror-dungeon/limbus-assets/md_choice_events.json           159 대조
```
