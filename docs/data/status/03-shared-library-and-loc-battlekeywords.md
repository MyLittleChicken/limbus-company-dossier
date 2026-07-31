# 회차 3 — `shared-library/statuses.json` + `loc-*/BattleKeywords*.json`

> `shared-library` **869종** · 키 5종 · 229 KB
> `loc-*` `BattleKeywords*` **42파일 × 3로케일** · 유일 **1,409종**
> 출처 커밋 `774883d7` · 스냅샷 2026-07-25 · 정리 2026-07-31

---

## 1. `shared-library/statuses.json` — 구버전 869종

```
assets 1,472   shared 869   shared 에만 0건
```

**구버전은 현행의 부분집합**이다. 603종이 나중에 추가됐다.

### `srcPath` 가 통째로 없다

```
shared 키   buffType · desc · name · categoryKeywordList(81) · imageOverride(53)
assets 에만 있는 키   srcPath
```

회차 1에서 본 애셋 조회 키가 **구버전에는 아예 없었다.** 팩 편·기프트 편의
`shared-library` 와 같은 패턴이다 — 애셋 연결이 나중에 붙었다.

### 공통 869종의 변화

| 키 | 다른 건수 |
| --- | ---: |
| `buffType` | **0** |
| `name` | **1** |
| `desc` | 57 |
| `srcPath` | 803 (구버전에 없음) |

**`buffType` 은 하나도 안 바뀌었다.** 상태의 긍정/중립/부정 분류가 안정적이다.

`name` 이 바뀐 1건이 **설명형 → 축약형**이다.

```
CriticalDamageUp   구버전 "Deal more damage on Critical Hit"
                   현행   "Crit DMG Up"
```

`desc` 57건은 텍스트 개정이다.

## 2. `loc-*/BattleKeywords*.json` — 42파일 · 1,409종

**세 로케일이 파일 목록·건수·id 집합까지 완전히 대칭**이다(1,409 × 3).

```
키   id · name · desc · summary(1,148) · undefined(809) · flavor(163) · iconId(1)
```

파일 접미가 **콘텐츠 단위**다.

```
BattleKeywords.json                    가장 크다 (183 KB)
BattleKeywords_Refraction2–6           굴절 열차
BattleKeywords-a1c5p1 … a1c9p3         본편 장·막
BattleKeywords-walpu4·5·6·8            발푸르기스
BattleKeywords-BossRaid · -exme · -tkt · -twth · -pilgrimage · -ycgd …   이벤트
```

`-pilgrimage` 는 E.G.O 편 회차 1의 **명일방주 콜라보**다.

### `undefined` 키 809건 — 값이 전부 `"-"`

```
undefined 키 있음 809 · 값 809 · 값 종류 1가지 (`"-"`)
```

인격 편 회차 13에서 4건 봤던 원본 버그가 **여기서는 809건**이다.
JSON 키 이름이 문자열 `"undefined"` 이고 값이 전부 `"-"` 다.

> **마스터북 전체에서 가장 큰 원본 버그**다.

### `summary` — 키는 많은데 값은 적다

```
키 있음 1,148 · 값 있음 206
```

기프트 편 회차 7·E.G.O 편 회차 8에서 본 `summary` 와 같은 필드다.
**942건이 키만 있고 빈 문자열**이다.

`flavor` 163건 중 값이 있는 것은 123건이다.

## 3. 한국어 커버리지 — **245종이 비어 있다**

회차 2에서 `terms.json` 이 435종만 덮는다고 했다. 로케일을 더하면 크게 늘어난다.

```
statuses 1,472
  loc BattleKeywords 가 덮는 것        1,214
  terms.json 이 덮는 것                  435
  둘의 합집합                          1,227
  ────────────────────────────────────────
  어느 쪽도 못 덮는 것                    245   (16.6 %)
```

| 출처 | 단독 기여 |
| --- | ---: |
| 로케일만 | 792 |
| `terms.json` 만 | **13** |

**로케일이 압도적이고 `terms.json` 은 13종만 단독으로 덮는다.**
다만 그 13종에 E.G.O 편 회차 5의 `AlwaysUseEGOPassive` 2건이 들어간다 —
**적은 수지만 없으면 안 되는 사전**이다.

### 로케일에만 있고 `statuses.json` 에 없는 195종

```
BattleKeywords 1,409 − statuses 와 겹치는 1,214 = 195
```

상태 사전에 등재되지 않은 전투 키워드다. **발동 시점·규칙 설명**으로 보이며
회차 2의 `terms` 전용 48건과 같은 성격이다.

---

## 함정 요약

1. `undefined` 키가 **809건**이다. 값은 전부 `"-"` — 원본 버그 최대 규모
2. `summary` 는 **키 1,148 · 값 206**이다. 키 존재로 판단하면 안 된다
3. `shared-library` 에는 **`srcPath` 가 없다**. 애셋 조회가 불가능하다
4. 상태 1,472종 중 **245종(16.6 %)이 한국어를 어디서도 못 얻는다**
5. 로케일 `BattleKeywords` 에만 있는 **195종**은 상태가 아니다

## 미해결

없다. `shared-library` 869종 + 로케일 42파일 × 3 전부 확정했다.

## 근거 재현

```
data/entities/mechanics/shared-library/statuses.json          869종 · 키 5종
data/entities/mechanics/loc-{ko,en,ja}/BattleKeywords*.json   42파일 · 1,409종
data/entities/mechanics/limbus-assets/statuses.json         1,472종 대조
data/entities/mechanics/limbus-data-mj/terms.json             483종 대조
```
