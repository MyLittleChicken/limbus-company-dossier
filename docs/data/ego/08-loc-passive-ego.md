# 회차 8 — `loc-*` 의 `Passive_Ego.json`

> **E.G.O 패시브 문자열** · 3로케일 × 최대 4파일 · 본편 **113건** · 델타 3파일(전부 빈 것)
> 출처 커밋 `774883d7` · 스냅샷 2026-07-25 · 정리 2026-07-30

## 파일 정체

E.G.O 패시브의 표시 문자열이다. 키는 4종 — `id` · `name` · `desc` · `summary`.

## 1. 113이 세 출처에서 일치한다

```
mj      egos_detail.awakeningPassives    113
assets  ego-details.passiveList          113
loc     Passive_Ego.json                 113
```

**mj 와 loc 는 id 집합이 완전히 같고**(차집합 양방향 0), assets 는 id 를 갖지 않는
배열이라 순서로 대응한다.

### 배열 순서가 서로 맞는다

`assets` 의 `passiveList[i]` 와 mj `awakeningPassives[i]` 를 같은 첨자로 이어
`loc-en` 의 `name` 과 대조했다.

```
name 일치   113/113
```

**`awakeningPassives` 의 배열 순서 = `passiveList` 의 배열 순서**다. 회차 5에서
`EgoPassive(egoId, index)` 로 적재하는 것이 이 순서에 기대고 있는데, 그 가정이 확인됐다.

## 2. `name` · `desc` — mj 와 글자까지 같다

```
loc-ko ↔ mj passives.json 의 nameKo    113/113
loc-ko ↔ mj passives.json 의 descKo    113/113
```

**완전 일치다.** 인격 편 회차 4·13에서 본 것과 같은 구도 — mj 는 로케일 파일의
한국어를 그대로 인라인으로 갖는다.

```
2010111  침묵
  "피격 시 다음 턴에 속박 3을 얻고, 대상을 약점, 취약인 속성으로 공격 시 피해량 +20%
   (턴 당 1회 발동)"
```

회차 2에서 `2010111` 이 **스킬이자 패시브**임을 확인했는데, 그 패시브 쪽 원문이 이것이다.

**적재** — `EgoPassiveText`. 다만 변환기는 `ego-details` 의 `passiveList` 를 읽으므로
**한국어는 `lookupTerm` 경유로 이 파일에서 온다**(`src/entities/egos.ts`).

## 3. `summary` — 축약 설명. 어느 출처에도 없다

```
키 있고 값 있음    17건
키 있고 빈 문자열   3건    (2120711 · 2090711 · 2040911)
키 자체가 없음     93건
```

**세 로케일이 정확히 같은 93건에서 키를 뺀다.** 로케일 차이가 아니라 원본 구조다.

```
2040212  4번째 성냥불
  summary  "4번째로 사용하는 스킬이 강화됨"
  desc     "4번째로 사용하는 스킬의 최종 위력 +4, 적중 시마다 [Combustion] 4 부여
            - 해당 스킬이 분노 속성이면, 추가로 피해량 +(모든 공격 대상의 화상 위력 / 2)% …"

2090611  집착
  summary  "스킬의 [Laceration] 위력 부여량 2배 증가"
  desc     "자신의 스킬 패널에서 가장 왼쪽에 위치한 스킬의 [Laceration] 위력 부여량이
            2배로 증가 (턴 당 1회 적용)"
```

**긴 패시브에만 붙는다.** 게임 UI 가 좁은 자리에서 쓰는 한 줄 요약으로 보인다.

`mj passives.json` · `ego-details.passiveList` 어디에도 없는 개념이다.

**적재** — 하지 않는다. 20건뿐이라 화면에서 일관되게 쓸 수 없다.

## 4. 함정 — 리터럴 꺾쇠가 있다

```
ko  "체력이 25%미만일 때 <나사빠진 일격> E.G.O 스킬 사용시 …"
en  "If the E.G.O Skill <Screwloose Wallop> is used when …"
ja  "体力が25%未満のとき<ネジの外れた一撃>E.G.Oスキル使用時 …"
```

`2050211` 마지막 개조(뫼르소) 하나이며 **3로케일 전부** 같은 표기다.

`<…>` 안이 **E.G.O 이름**이다. Unity 리치텍스트 태그가 아니라 인용 부호로 쓴 꺾쇠다.
정규식으로 `<[^>]*>` 를 지우면 **E.G.O 이름이 통째로 사라진다.**

### 우리 코드는 이미 안전하다

```ts
const MARKUP = new RegExp(`</?(?:${UNITY_TAGS.join('|')})\\b[^>]*>`, 'gi');
```

`src/text.ts:193` 이 **Unity 태그 화이트리스트만** 지운다. 주석도 "리터럴 꺾쇠 표기는
보존한다" 로 명시돼 있다. E.G.O 로케일 전체에서 태그가 아닌 꺾쇠는 **이 3건뿐**이다.

## 5. 마크업은 5종뿐이다

```
<style="highlight"> … </style>    7쌍
<noparse> … </noparse>            5쌍   (en 은 1쌍)
```

스킬 문자열(회차 7, 1087쌍)에 비해 훨씬 적다. 패시브는 조건부 강조를 거의 쓰지 않는다.

대괄호 토큰은 **56종**이다.

```
Combustion 19 · Laceration 16 · Sinking 11 · Charge 11
AlcoholKimPersonal 7 · Breath 6 · AttackUp 4 · DefenseDown 4
```

`AlcoholKimPersonal` 이 7회 나오는 것이 눈에 띈다 — 회차 3·5에서 본 `20509` 착영휘도
전용 상태이며, 조건부 기믹의 그 패시브다.

## 6. 델타 3파일은 전부 비어 있다

| 파일 | ko | en | ja |
| --- | --- | --- | --- |
| `Passive_Ego-a1c5p2.json` | `[{}]` | `[{}]` | `[{}]` |
| `Passive_Ego-a1c9p2.json` | `[]` | **파일 없음** | `[]` |
| `Passive_Ego-a1c9p3.json` | `[]` | `[]` | `[]` |

`a1c5p2` 는 회차 7의 `Skills_Ego-a1c5p2.json` 과 **같은 빈 객체 `[{}]`** 다.
같은 시점에 생성된 델타가 둘 다 껍데기다.

`a1c9p2` 가 `en` 에만 없는 것도 회차 7과 같다. **영문 로케일은 빈 델타 파일을 만들지 않는다.**

---

## 함정 요약

1. `2050211` 의 `<나사빠진 일격>` 은 **마크업이 아니다.** 지우면 E.G.O 이름이 사라진다
2. `summary` 는 **93건에서 키 자체가 없다.** 접근하면 `KeyError` 다
3. 델타 3파일 전부 비었고 `a1c5p2` 는 **빈 객체 `[{}]`** 다
4. `en` 에 `a1c9p2` 파일이 없다. 로케일마다 파일 목록이 다르다

## 미해결

없다. 3로케일 × 최대 4파일 전부 확정했다.

### 이월 확인 1건

- ✔ **회차 5** `EgoPassive.index` 가 기대는 배열 순서 — mj·assets·loc 셋이 같은 순서다(113/113)

## 근거 재현

```
data/entities/egos/loc-{ko,en,ja}/Passive_Ego.json          113 · 키 4종
data/entities/egos/loc-{ko,en,ja}/Passive_Ego-a1c*.json     델타 3종 (전부 빈 것)
data/entities/identities/limbus-data-mj/passives.json       2xxxxxx 113 대조
data/entities/egos/limbus-data-mj/egos_detail.json          awakeningPassives 순서
data/entities/ego-details/limbus-assets/*.json              passiveList 순서
src/text.ts:193                                             MARKUP 화이트리스트
```
