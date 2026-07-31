# 회차 2 — `loc-*` 의 `Enemies*.json` + 연결표 탐색

> **적 이름 문자열** · 3로케일 × **43파일** · 유일 **1,342종**
> 출처 커밋 `774883d7` · 스냅샷 2026-07-25 · 정리 2026-07-31

---

## 1. `Enemies*.json` — 43파일 · 1,342종

**세 로케일이 파일 목록·건수·id 집합까지 완전히 대칭**이다.

```
키   id · name · desc(1,321)
id   정수 1058–999999 · 4자리 532 · 5자리 338 · 6자리 472
```

파일 접미가 콘텐츠 단위다 — `Enemies.json` · `Enemies_Refraction1–6` ·
`Enemies-a1c5p1 … a1c9p3` · `Enemies-walpu*` · `Enemies-mirror*` · `Enemies91-*`.

```json
{ "id": 90083, "name": "구멍 손바닥 고래 인어", "desc": "본체" }
```

`desc` 는 **부위 이름**이다(`"본체"`). 회차 1의 `parts[].name` 62종과 같은 축이다.

## 2. `portrait` 이 로케일 조인 키다

```
assets portrait 유일 458   ↔   loc id 1,342
교집합 375 · portrait 에만 83
```

**`portrait` 값으로 로케일에서 한국어 이름을 얻는다.**

```
Rigid Casino Security      →  각 잡힌 카지노 경호원
Confident Casino Security  →  자신있는 카지노 경호원
Mariachi Alegre            →  흥겨운 마리아치 조직원
```

이름으로도 이어진다.

```
assets 적 이름 394 ↔ loc-en 이름   교집합 392
```

**392/394 가 영문 이름으로 매칭된다.** id 조인(375/458)보다 이름 조인이 촘촘하다.

### `portrait` 에만 있는 83종

로케일에 이름이 없는 초상이다. 회차 1에서 `portrait` 458 중 애셋이 없는 것이
2건이었는데, **이름이 없는 것은 83건**이다.

---

## 3. 연결표 탐색 — **없다**

거울 던전 편 회차 4에서 넘긴 문제다.

```
mj   packs_detail 의 전투 풀        7자리 숫자 2,525종
assets encounters                  UUID + 문자열 키
```

### `data/` 전체를 훑었다

```
assets 인카운터 251개 파일에서 7자리 숫자   0건
loc-* Enemies 43파일에서 mj 풀 id          0건
```

`data/entities/` 전역에서 mj 풀 id 를 갖는 파일을 찾으면 **엉뚱한 것이 나온다.**

```
egos/limbus-data-mj/egos_detail.json          23건
identities/limbus-data-mj/skills.json         23건
egos/loc-*/Passive_Ego.json                   13건
```

**E.G.O 스킬 id 와 번호 공간이 겹칠 뿐이다.**

```
mj 전투 풀 앞자리   206xxxx 2,388 · 207xxxx 133 · 900xxxx 4
E.G.O 스킬          2060811(홍루) · 2070811(히스클리프) …
```

인격 편 회차 4의 **「번호 공간 충돌」과 같은 현상**이다. 같은 숫자가 전혀 다른 것을 가리킨다.

### 결론 — mj 전투 풀 2,525종은 **정의가 리포에 없다**

```
packs_detail 이 참조한다              2,525종
그 실체를 담은 파일                     없음
```

`limbus-assets` 는 251개 인카운터를 **다른 체계로** 갖는다. 두 출처가 인카운터를
독립적으로 수집했고 **번호가 이어지지 않는다.**

> **마스터북 최종 질문에 대한 가장 큰 결손이다.**
> 「하나의 repo 에 모든 데이터가 온전히 담겨있나」 — 거울 던전 맵 생성 규칙은
> `packs_detail` 에 있지만, **그 규칙이 뽑는 전투가 무엇인지는 알 수 없다.**

우리 파이프라인은 인카운터를 적재하지 않으므로 **지금은 영향이 없다.**
`docs/backlog/10-encounter-linkage.md` 에 남긴다.

---

## 함정 요약

1. mj 전투 풀 id 와 **E.G.O 스킬 id 가 같은 번호 공간**이다. 겹침 23건은 우연이다
2. `portrait` 458 중 **83종은 로케일에 이름이 없다**
3. 로케일 `desc` 는 설명이 아니라 **부위 이름**이다
4. 이름 조인(392/394)이 **id 조인(375/458)보다 촘촘하다**

## 미해결 1

**mj 전투 풀 2,525종의 정의가 리포에 없다.** 다른 출처를 더 받아야 채워진다 →
`backlog/10-encounter-linkage.md`

## 근거 재현

```
data/entities/encounters/loc-{ko,en,ja}/*.json             43파일 · 1,342종
data/entities/encounters/limbus-assets/*.json              portrait 458
data/entities/packs/limbus-data-mj/packs_detail.json       전투 풀 2,525종
data/entities/                                             전역 탐색 결과 0건
```
