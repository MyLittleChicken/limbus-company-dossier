# 회차 8 — `limbus-assets/passives.json` + `skill_tags.json`

> **척추 2파일** · `passives.json`(147 KB · 최상위 키 2종) · `skill_tags.json`(5.2 KB · 72종)
> 출처 커밋 `774883d7` · 스냅샷 2026-07-25 · 정리 2026-07-30

## 파일 정체

성격이 같은 **사전 2종**을 묶었다. 하나는 패시브 발동 조건, 하나는 토큰 표시명이다.

```
passives.json     ego 110개 · support 184개        전투(battle) 절이 없다
skill_tags.json   토큰 72종 · text + color
```

**회차 4에서 미룬 `uptie` 중복 대조가 여기서 닫힌다.**

### 대조한 출처

| 출처 | 무엇을 대조했나 |
| --- | --- |
| `limbus-data-mj/passives.json` | 패시브 한국어 이름 · `cost` |
| `limbus-data-mj/identities_detail.json` | `supporterPassives` 의 `level` ↔ `uptie` |
| `mechanics/limbus-data-mj/terms.json` | 토큰 한국어 (`nameKo`) |
| 게임 인격 상세 화면 (스크린샷 6종) | `condition.type` 의 실제 표기 |
| `src/text.ts:159` · `src/entities/skills.ts:386` | 변환 경로 |

---

## `passives.json`

### 최상위 구조 — `battle` 절이 없다

```
ego      110개    { desc, name }
support  184개    { uptie, passives: [{ condition, desc, name }] }
```

**전투 패시브의 정의가 여기 없다.** 회차 4에서 확인한 대로 전투 패시브는
`identity-details/{id}.json` 의 `passiveData` 와 `combatPassives` 에 있다(회차 10).

이 파일이 담는 것은 **서포트 패시브의 발동 조건**과 **E.G.O 패시브의 영문 본문**이다.

### `support` — 서포트 패시브 조건

| | |
| --- | --- |
| 항목 수 | **214개** (기본 184 + 강화판 30) |
| `uptie` | **3:184 · 4:30** |
| `passives` 배열 | **전부 길이 1** |
| `condition.type` | `owned` 142 · `res` 71 · **없음 1** |
| `requirement.type` | 죄악 7종 |
| `requirement.value` | 1:8 · 2:7 · **3:91** · **4:65** · **5:45** · 6:9 · 7:1 |
| 변환 | `passive.condType` · `passive_requirement(passiveId, index, type, value)` — `src/entities/skills.ts:386` |
| 적재 | `passive.cond_type` · `passive_requirement` |
| 화면 | 상세 "패시브" 패널의 `조건 (…)` 줄 |

**mj `supporterPassives` 의 `level` 과 184/184 완전 일치.** 회차 4의 이월 질문이 닫혔다 —
`mj cost`(`CheckAwakenLevel3`) · `assets uptie`(3) · `mj level`(3) **세 곳이 같은 것을 말한다.**
우리는 mj detail 의 `level` 을 쓰며 실익 차이가 없다.

죄악 분포는 고르다 — `pride` 43 · `gluttony` 36 · `lust` 33 · `gloom` 32 · `wrath` 30 ·
`envy` 29 · `sloth` 23. 요구치는 **3·4·5가 201/214(94%)** 로 몰려 있다.

### `condition.type` = 보유 / 공명

**게임 스크린샷 6종이 그대로 증명한다.**

| `type` | 게임 표기 | 실측 |
| --- | --- | --- |
| `owned` | **보유** | 142건 |
| `res` | **공명** | 71건 |

```
10110 엄숙한 애도 이상    "구원의 손"        owned  gloom 6      화면: 🔷 × 6 보유
10212 흑수 - 묘 필두      "쾌도"            res    gluttony 4   화면: 🍀 × 4 공명
10311 동부 섕크 3과       "경신법"           res    wrath 3      화면: 🔥 × 3 공명
10508 검계 우두머리       "본국검술"          owned  pride 5      화면: × 5 보유
10511 서부 섕크 3과       "한 발 더 빠르게"    res    pride 3      화면: × 3 공명
11009 새벽 사무소 해결사    "이글거리는 검"      res    wrath 3      화면: × 3 공명
```

**6/6 완전 일치.**

**함정 — 화면에 영문이 그대로 나간다.**

```
app/[locale]/identities/[id]/page.tsx:64
  {p.condType ? ` (${p.condType})` : ''}
```

`조건 (owned)` · `조건 (res)` 로 출력된다. 한국어는 `보유` · `공명` 이며, 이 값이 어디서도
번역되지 않는다. `requirement` 도 `${r.type} ${r.value}` 로 나가 `gloom 6` 이 된다 —
죄악 표시명(`sin_text`)이 이미 적재돼 있는데 쓰이지 않는다.

### `condition` 없는 1건

```
10116 LCE E.G.O:: 차원찢개 (이상)  uptie 3
  "LetManOutrunEvenTheRayOfLight"
  "When 1 ally with the fastest Speed uses a Skill that gains or consumes [Charge] Count, …"
```

**조건 없이 항상 발동하는 서포트 패시브**다. 회차 1에서 픽업이 진행 중이던 최신 인격이며,
이름이 **영문 CamelCase 원본 키 그대로**다 — 표시명이 아직 붙지 않은 것으로 보인다.

`passive.cond_type` 이 `null` 이 되고 `passive_requirement` 행이 없으므로, 화면은
조건 줄을 그리지 않는다(`p.condType || p.requirements.length > 0` 검사).

### `ego` — E.G.O 패시브 영문 본문

| | |
| --- | --- |
| 항목 | 110개 · 배열 길이 **1:107 · 2:3** |
| 원소 키 | `desc` · `name` — **한국어 없음** |
| 변환 | 쓰이지 않는다. `ego-details/{id}.json` 의 `passiveList` 가 정본이고 한국어는 `loc-*` |
| 적재 | 간접 (`ego_passive` · `ego_passive_text`) |

**패시브가 2개인 3종이 「4번째 성냥불」이다.**

```
20102 이상 · 20402 료슈 · 20902 로쟈
```

회차 3의 **동기화 5**, 회차 4의 **`Between_2_4`·`CheckAwakenLevel5`** 와 같은 3종이다.
이 E.G.O만 패시브가 둘이며, 구형 E.G.O 밸런스 패치의 대상이라는 사실과 맞물린다.

---

## `skill_tags.json` — 토큰 표시명

| | |
| --- | --- |
| 타입·실측 | 최상위 객체(키 = 토큰명) · **72종** · 5.2 KB |
| 키 | `text` **72/72** · `color` **47/72** |
| 변환 | `buildTriggerTable`(`src/text.ts:159`) — 상태 표 4,426종 위에 얹어 4,497종을 만든다 |
| 적재 | **미적재** — 치환표로만 쓰인다 |
| 화면 | 간접 — 스킬·패시브 설명의 토큰 치환 결과 |

```
AMBER          { text: "Amber" }
AZURE          { text: "Azure" }
AllyKill       { color: "#8ADF3B", text: "[On Ally Kill]" }
AllyKillFail   { color: "#8ADF3B", text: "[On Ally Kill Fail]" }
AlwaysUse      { text: "[Constant]" }
```

**`text` 값이 대괄호를 품는다.** 회차 3에서 확인한 구조의 근원이다 — 발동 시점은 치환 후에도
대괄호를 유지하고(`[WhenUse]` → `[사용시]`), 상태는 벗는다(`[Breath]` → `호흡`).

**함정 — `color` 47건을 쓰지 않는다.** `#8ADF3B`(연두)가 발동 시점 표기 색이다. 게임은
설명문에서 이 토큰을 색으로 구분하는데 우리 화면은 평문으로만 낸다.

**함정 — 한국어가 이 파일에 없다.** `text` 는 영문뿐이고, 한국어는
`mechanics/limbus-data-mj/terms.json` 의 `nameKo` 가 채운다(ADR-04 2.3 · `src/text.ts:166`).

```
const en = tag.text ?? terms[key]?.name;
const value = locale === 'ko' ? (terms[key]?.nameKo ?? en) : en;
```

**둘 중 한쪽만으로는 치환표가 완성되지 않는다** — `limbus-assets` 가 키와 영문을, mj가 한국어를 준다.

`text` 가 **빈 문자열인 표기도 있다**(`TabExplain`). 게임이 지우는 UI 표식이므로 빈 값이
정답이며, `??` 를 써서 빈 문자열이 폴백으로 넘어가지 않게 한다(`src/text.ts:163`).

---

## 함정 요약

1. `passives.json` 에 **전투 패시브 절이 없다.** 정의는 `identity-details` 에 있다
2. `condition.type` 의 `owned`·`res` 가 **화면에 영문 그대로** 나간다. 한국어는 보유·공명이다
3. `requirement` 도 `gloom 6` 처럼 영문 죄악명으로 나간다. `sin_text` 가 적재돼 있는데 안 쓴다
4. `condition` 없는 1건(`10116`)은 조건 없이 항상 발동하며, 이름이 영문 원본 키 그대로다
5. `ego` 절은 **쓰이지 않는다.** `ego-details` 가 정본이고 한국어는 `loc-*` 에서 온다
6. `skill_tags.json` 의 `color` 47건을 우리가 쓰지 않는다
7. 치환표는 **양쪽 출처가 있어야 완성된다** — assets가 키·영문, mj `terms.json` 이 한국어

## 미해결

없다. 2파일 전부 확정했다.

### 회차 4 이월 해소

- ✔ **`assets uptie` 가 mj `cost` 와 중복인가** — 세 곳이 같은 것을 말한다.
  `mj cost`(`CheckAwakenLevel3`) · `assets uptie`(3) · `mj supporterPassives level`(3)이
  **184/184 일치**한다. 우리는 mj detail 의 `level` 을 쓰며 실익 차이가 없다

## 근거 재현

```
data/entities/identities/limbus-assets/passives.json               ego 110 · support 184
data/entities/identities/limbus-assets/skill_tags.json             토큰 72종
data/entities/identities/limbus-data-mj/passives.json              한국어 이름 · cost
data/entities/identities/limbus-data-mj/identities_detail.json     supporterPassives level
data/entities/mechanics/limbus-data-mj/terms.json                  토큰 한국어
src/text.ts:159 · src/entities/skills.ts:386                       변환 경로
app/[locale]/identities/[id]/page.tsx:64                           화면 출력
게임 인격 상세 화면 스크린샷 6종                                       보유 · 공명 표기
```
