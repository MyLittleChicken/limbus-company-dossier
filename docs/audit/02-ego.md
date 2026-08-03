# E.G.O (ego)

감사 대상: `canonical` 스키마의 E.G.O 계열 테이블 15종.
비교 기준: 현행 `public` 스키마와 실제 렌더 결과(`http://localhost:3000/ko/egos`, `/ko/egos/20101`).
모든 수치는 2026-08-02 시점 실제 질의 결과다.

---

## 1. 현행 화면이 읽는 것

### 1.1 소비 코드

| 파일 | 함수 | 화면 |
| --- | --- | --- |
| `lib/queries/egos.ts` | `listEgos` | `/[locale]/egos` 목록 |
| `lib/queries/egos.ts` | `getEgo` | `/[locale]/egos/[id]` 상세 |
| `lib/queries/squad.ts` | `listSquad` | `/[locale]/squad` 편성 |
| `lib/queries/search.ts` | 통합 검색 | 헤더 검색 |
| `lib/queries/reference.ts` | `db.ego.count()` | 홈 통계 |

### 1.2 목록 화면이 읽는 `public` 컬럼 (전수)

`ego.id` · `ego.sinnerId` · `ego.rank` · `ego.season` · `ego.awakenAffinity` · `ego.awakenAtkType` ·
`ego.corrosionAffinity`(NULL 여부만 → `hasCorrosion`) · `ego.extractable`(필터) ·
`ego_text.name`(+`locale`) · `ego_cost.sin` · `ego_cost.amount`.
정렬은 `sinnerId asc, id asc`. 필터 축은 수감자 · 등급 · 각성 죄악 · 침식 유무 · 추출 가능.
렌더 실측 건수 **110**.

### 1.3 상세 화면이 읽는 `public` 컬럼 (전수)

`ego.id` · `sinnerId` · `rank` · `season` · `releaseDate` · `awakenAffinity` · `awakenAtkType` ·
`corrosionAffinity` · `corrosionAtkType` · `extractable` · `maxThreadspin` ·
`ego_text.name` · `sinner_text.name` ·
`ego_cost.sin/amount` · `ego_resist.sin/value` ·
`ego_status.statusId` → `status_text.name` ·
`ego_passive.index` → `ego_passive_text.name/desc`(정렬 키가 `index`).

이미지 3종(`awaken`/`cg`/`erosion`)은 DB 가 아니라 `lib/assets.ts` 의 파일 매니페스트에서 온다 — DB 결손과 무관하다.

### 1.4 렌더 실측 (`/ko/egos/20101`)

패시브 1건(침묵) · CG · 침식 없음 · 죄악 자원 sloth 3 / wrath 1 ·
등급 ZAYIN · 각성 `sloth · pierce` · 침식 없음 · 추출 가능 X · 최대 실뽑기 없음 · 시즌 0 · 출시일 2023-02-27 ·
저항 7축 · 보유 상태 3건.

**현행 화면은 E.G.O 스킬을 한 글자도 보여주지 않는다.** 스킬·침식 확률표·색 토큰 요구는 전부 미사용이다.

---

## 2. canonical 대응 현황

### 2.1 테이블 행 수 (실측)

| 항목 | public | canonical | 상태 |
| --- | --- | --- | --- |
| `ego` | 110 | 115 | 신규가 넓다 — 연출 전용 5건(`presentation_only=true`) 추가 |
| `ego_text` | 220 (ko·en) | 345 (ko·en·ja) | 신규가 넓다 — ja 로케일 + `desc` 신규 |
| `ego_cost` | 314 | 314 | 일치 · 값 차이 0 |
| `ego_resist` | 770 | 770 | 일치 · 값 차이 0 |
| `ego_status` | 475 | 475 | 일치 · 값 차이 0 |
| `ego_passive` | 113 (egoId·index) | 113 (id) | 행 수 같음 · **키가 다르다**(§5.1) |
| `ego_passive_link` | — | 113 | 신규 전용 |
| `ego_passive_text` | 226 (ko·en) | 339 (ko·en·ja) | 신규가 넓다 |
| `ego_corrosion` | — | 330 | 신규 전용 |
| `ego_requirement` | — | 314 | 신규 전용 · `ego_cost` 와 완전 중복(§5.2) |
| `ego_skill` | — | 215 | 신규 전용 |
| `ego_skill_stage` | — | 616 | 신규 전용 |
| `ego_skill_stage_text` | — | 1,848 | 신규 전용 |
| `ego_skill_coin` | — | 2,745 | 신규 전용 |

참조되는 공용 테이블: `canonical.sinner` 12 · `sinner_text` 24(ko·en **만**) · `sin_info` 7 ·
`status` 1,472 · `status_text` 3,913 · `passive` 709 · `passive_text` 1,701 ·
`skill` 1,045 · `skill_stage` 5,180 · `coin_token` 26,942.

### 2.2 화면 항목별 대응

| 화면 항목 | public 컬럼 | canonical 대응 | 상태 |
| --- | --- | --- | --- |
| 이름 | `ego_text.name` | `ego_text.name` | 있음 (ja 추가) |
| 등급 | `ego.rank` | `ego.rank` | 있음 · 차이 0 |
| 수감자 | `ego.sinnerId` | `ego.sinner_id` | 있음 |
| 시즌 | `ego.season` | `ego.season` | 있음 · 차이 0 |
| 출시일 | `ego.releaseDate` (date) | `ego.release_date` (**text**) | 있음 · 차이 0 · 타입 변경 |
| 각성 죄악 | `ego.awakenAffinity` | `ego.sin` | 있음 · 차이 0 |
| 각성 공격 타입 | `ego.awakenAtkType` | `ego.attack_type` | 있음 · 차이 0 |
| **침식 죄악** | `ego.corrosionAffinity` | **컬럼 없음** | **간접만** (§3.1) |
| **침식 공격 타입** | `ego.corrosionAtkType` | **컬럼 없음** | **간접만** (§3.1) |
| 추출 가능 | `ego.extractable` | `ego.extractable` | 있음 · 차이 0 (28건) |
| 최대 환상 해석 | `ego.maxThreadspin` | `ego.max_threadspin` | 있음 · 차이 0 (3건) |
| 죄악 자원 소모 | `ego_cost.sin/amount` | `ego_cost.sin/count` | 있음 · 차이 0 |
| 저항 | `ego_resist.sin/value` | `ego_resist.sin/value` | 있음 · 차이 0 |
| 보유 상태 | `ego_status.statusId` | `ego_status.status_id` | 있음 · 차이 0 · 고아 0 |
| 패시브 이름/설명 | `ego_passive_text` | `ego_passive_text` | 있음 |
| **패시브 순서** | `ego_passive.index` | **없음** | **결손** (§5.1) |

---

## 3. 채움률 이상

### 3.1 `canonical.ego` — 침식 죄악·공격 타입 컬럼이 통째로 없다

`canonical.ego` 컬럼: `id · sinner_id · rank · sin · attack_type · season · release_date · max_threadspin · extractable · presentation_only`.
`corrosion_affinity`/`corrosion_atk_type` 에 해당하는 컬럼이 없다.

- 원본에는 있다 — `raw` 의 `egos/limbus-assets/egos.json` 에 `corrosionType` 키가 **98건** 존재한다.
- ETL(`src/v2/canonical/egos.ts`)은 `awakeningType` 도 안 읽는다(각성은 mj 의 `sin`/`attackType` 으로 받는다). `corrosionType` 은 어디서도 읽히지 않는다.
- **복원 경로는 있다.** `ego_skill(role='corrosion')` → `canonical.skill.sin` / `.attack_type`.
  실측: 침식 스킬 98건 전부 `skill.sin`·`skill.attack_type` 채워져 있고, `public.ego.corrosionAffinity/corrosionAtkType` 와 **불일치 0건**.
  각성도 같은 경로로 확인해 불일치 0건.
- 판정: **데이터 손실은 아니다. 모델링 변경이다.** 다만 현행 화면의 1컬럼 조회가 3테이블 조인이 되고, `hasCorrosion` 목록 필터가 `EXISTS(ego_skill role='corrosion')` 로 바뀐다.

### 3.2 전량 NULL 컬럼 — `ego_text.desc_raw` 0/345 (설계상 정상)

`ego_text`: `name` 345/345 · `desc` 345/345 · **`desc_raw` 0/345**.

`identity.stagger` 형 버그처럼 보이지만 아니다. `src/v2/canonical/markup.ts` 의 `descOf()` 는
**원문에 Unity 리치텍스트 마크업이 있을 때만** `desc_raw` 를 채운다(없으면 `desc` 가 곧 원문이므로 중복 저장하지 않음).
E.G.O 의 `desc` 는 `loc` 의 한 줄 설명(예: `"이상의 기본 EGO 장비"`)이라 마크업이 없다. 같은 규칙으로
`ego_passive_text.desc_raw` 15/339(4.4%), `ego_skill_stage_text.desc_raw` 539/1848(29.2%) 이 나온다 — 전부 정상.

> 다만 `desc_raw is null` 을 "원문 없음"으로 읽는 소비자는 틀린다. 원문은 `desc` 다. 문서화 필요.

### 3.3 낮은 채움률 — 전부 원본 대조로 정상 확인

| 컬럼 | 채움 | 원본 실측 | 판정 |
| --- | --- | --- | --- |
| `ego.max_threadspin` | 3/115 (2.6%) | `egos.json` 에 `maxThreadspin` 키를 가진 id 는 **20102 · 20402 · 20902 3건뿐** | 정상 (알려진 사실 "3종만 5단계"와 일치) |
| `ego.extractable=true` | 28/115 | `egos.json` 에 `extractable=true` 인 id **28건** | 정상 |
| `ego.rank/sin/attack_type/season/release_date` | 110/115 | 5건은 `presentation_only=true`(mj 에 없고 loc 에만 있는 연출 전용) | 정상 |
| `ego_skill_stage_text.desc` | 1,572/1,848 (85.1%) | 로케일별로 616 중 92건이 `desc` 없음 (3로케일 동일) | 원본 결손 · 이름은 100% |
| `ego_passive_text.desc` | 339/339 | — | 정상 |
| `ego_skill_stage_text.ab_name` | 1,848/1,848 (100%) | — | 정상. 값은 유래 환상체명(예: 응룡 · 불타버린 소녀). 기본 E.G.O 는 수감자명(20101 → "이상") |

### 3.4 `ego_corrosion` 330행이 전부 같은 값이다 (관측)

110종 × 3행. **모든 E.G.O 가 동일한 3쌍**을 갖는다:

| section | probability | 건수 |
| --- | --- | --- |
| 0 | 1 | 110 |
| 0.25 | 0.75 | 110 |
| 0.5 | 0.25 | 110 |

`section` 은 정규화된 SP 위치이므로 `0.5 = SP 0 → 25 %`, `0 = SP −45 → 100 %` 로 읽힌다(알려진 사실과 일치).
원본(`limbus-data-mj` ego detail)이 E.G.O 마다 같은 표를 되풀이해 싣고 있고 ETL 은 그대로 옮겼다.
**per-E.G.O 정보량이 0 이다.** 결손은 아니지만 330행을 3행 상수표로 접을 수 있다.

### 3.5 `ego_skill_coin` — 효과 문자열이 없는 코인이 사라진다 (버그)

`ego_skill_coin` 915행(로케일당). `effects` NULL 0건 · 빈 배열 0건.
그런데 **616 스테이지 중 9건이 코인 0개**다:

```
2010511/u1 · 2020811/u1 · 2020821/u1 · 2120611/u1,u3,u4 · 2120911/u1,u3,u4
```

원본 확인(`raw` loc-ko `2120611`): `levelList[].coinlist` 에 코인이 **1개 있고**, 그 `coindescs` 가 `[{}]`
— 효과 설명이 빈 객체다. ETL `pushSkillStages()` 의 `if (effects.length === 0) return;` 이
**코인 행 자체를 버린다.** 결과적으로 "코인이 없는 스킬"과 "효과 텍스트가 없는 코인을 가진 스킬"이 구분되지 않는다.
코인 개수는 클래시 계산의 입력이므로 추천 엔진에 직결된다.

> `index` 는 `forEach` 인덱스라 중간 코인이 빠져도 번호는 밀리지 않는다(실측 `max(index)+1 <> count(*)` 인 스테이지 0건 — 즉 빠진 코인은 항상 마지막이거나 전부다).

### 3.6 `ego_skill_stage` 에 수치가 하나도 없다 (원본에 있음 · 미적재)

`canonical.ego_skill_stage` 컬럼은 `skill_id · uptie` **둘뿐**이다. `ego_skill` 은 `id · ego_id · role · ordinal` 뿐이다.

원본 `raw` 의 `ego-details`(limbus-assets 110건 · shared-library 105건)에는 각성/침식 스킬의 단계별 수치가 그대로 있다:

```
spCost · atkType · defType · affinity · atkWeight · baseValue · coinValue · levelCorrection
coins[].type (normal / unbreakable) · bonuses[]
```

(20102 침식 스킬 2010221 실측: uptie1 `spCost 20 · atkWeight 3 · baseValue 24 · coinValue −12 · levelCorrection 2`,
uptie4 `atkWeight 5`, uptie5 `coins[0].type=unbreakable`.)

ETL 은 `ego-details` 를 **입력으로 받지도 않는다** — `load-canonical.ts:183` 이 넘기는 `mjDetail` 은
`egos/limbus-data-mj/egos_detail.json` 이고, E.G.O 스킬은 `loc-ko/en/ja` 의 `levelList` 만 읽는다.
`loc` 에는 이름·설명·코인 설명만 있고 수치가 없다.

- 현행 화면은 E.G.O 스킬을 안 쓰므로 **지금 깨지는 화면은 없다.**
- 그러나 canonical 로 E.G.O 스킬을 띄우려는 순간 위력·SP 소모·코인 수를 표시할 수 없다.
- 참고: 인격 쪽 `canonical.skill_stage` 도 `skill_id · uptie · changed_here` 뿐이라 같은 성격의 공백이 있다(인격 담당 영역).

---

## 4. 참조 무결성

### 4.1 고아 FK

| 검사 | 결과 |
| --- | --- |
| `ego_status.status_id` → `status.id` | 고아 0 |
| `ego_status.ego_id` → `ego.id` | FK 강제 · 고아 0 |
| `ego_corrosion` / `ego_cost` / `ego_requirement` / `ego_resist` / `ego_text` → `ego` | FK 강제 · 고아 0 |
| `ego_skill_stage` → `ego_skill` | 고아 0 |
| `ego_skill_coin` → `ego_skill_stage` | FK 강제 · 고아 0 |
| `ego_passive_link` → `ego` / `ego_passive` | FK 강제 · 고아 0 |
| `ego.sinner_id` → `sinner.id` | ETL 단계에서 검증 · `field_gap` 0건 |

### 4.2 빈 자식

| 검사 | 건수 | 판정 |
| --- | --- | --- |
| 스킬 0개인 E.G.O | 5 | 전부 `presentation_only=true`(201011 · 203011 · 205011 · 206011 · 211011) — §4.3 |
| 텍스트 0개인 E.G.O | 0 | 정상 |
| 자원 소모/저항/상태/침식표 0개인 E.G.O | 각 5 | 연출 전용 5건. ETL 이 `presentationOnly` 에서 조기 `continue` 한다 |
| 패시브 0개인 E.G.O | 5 | 동일 |
| 침식 스킬 0개인 플레이 E.G.O | **12** | `public.ego.corrosionAffinity is null` 12건과 정확히 일치. 정상(침식 없는 E.G.O 12종) |
| 스테이지 0개인 스킬 | 0 | 정상 |
| 코인 0개인 스테이지 | **9** | §3.5 버그 |

### 4.3 연출 전용 E.G.O 의 스킬이 기본 E.G.O 에 붙었다 (버그 후보)

`ego_skill` 에서 각성 스킬을 2개 가진 E.G.O 가 **7건**이다:

```
20101 · 20301 · 20501 · 20601 · 21101   ← 문제
20608 · 21209                            ← ETL 주석이 의도한 정상 2건
```

ETL 주석은 "두 번째 각성 스킬 2건 — 2060812 오혈읍루-종 · 2120912 눈부시지 않은 영광-광휘"라고만 적었다.
나머지 5건의 실측:

| 여분 스킬 | 붙은 E.G.O | 그 스킬의 단계 | 스킬명(ko) | 같은 이름의 연출 전용 E.G.O |
| --- | --- | --- | --- | --- |
| 2010112 | 20101 오감도 | uptie 4 **하나뿐** | 오감도 | 201011 오감도 (스킬 0개) |
| 2030112 | 20301 라 샹그레 데 산쵸 | uptie 4 하나뿐 | 라 샹그레 데 산쵸 | 203011 (스킬 0개) |
| 2050112 | 20501 타인의 사슬 | uptie 4 하나뿐 | — | 205011 (스킬 0개) |
| 2060112 | 20601 허환경 | uptie 4 하나뿐 | — | 206011 (스킬 0개) |
| 2110112 | 21101 토 파토스 마토스 | uptie 4 하나뿐 | — | 211011 (스킬 0개) |

원인은 ETL 의 loc 접두 스캔이다:

```ts
if (skillId.startsWith(id) && skillId.length === id.length + 2) awakenIds.add(skillId);
```

연출 전용 E.G.O 의 id 는 `기본 id + "1"`(20101 → 201011)이라 길이가 6 이고, 그 스킬 id 는 `2010112`(길이 7).
`201011` 기준으로는 `length+2 = 8` 이라 안 걸리고, `20101` 기준으로는 `length+2 = 7` 이라 **기본 E.G.O 쪽에 걸린다.**
정상 2건(2060812 · 2120912)은 이름이 다른 진짜 두 번째 스킬이지만, 이 5건은 이름이 기본 E.G.O 와 **완전히 같다**.

증상: canonical 로 스킬 목록을 띄우면 20101 에 "오감도"가 두 번 뜬다. 반대로 201011 은 스킬이 없다.

### 4.4 `ego_skill_stage.uptie` 에 2 가 없다 (관측 · 정상)

uptie 분포: **1 → 210 · 3 → 210 · 4 → 190 · 5 → 6**. 2 는 0건.
원본 `loc` 의 `levelList[].level` 이 1·3·4(그리고 3종만 5)만 싣는다. ETL 주석대로 "단계가 델타가 아니라 그 단계만 존재".
uptie 5 의 6행 = 3 E.G.O × 2 스킬(각성 + 침식)로 `max_threadspin=5` 3건과 정합.
uptie 1 이 없는 스킬 5건은 §4.3 의 그 5건이다.

### 4.5 canonical 내부 중복

- `ego_skill.id` **208/215** 가 `canonical.skill.id` 에도 있다. `ego_skill_stage` **605/616** 이 `skill_stage` 에도 있다.
  없는 7건은 §4.3 의 여분 각성 스킬(5) + 20608·21209 의 두 번째 스킬(2). 즉 그 7건만 `sin`/`attack_type`/`kind`/`skill_tier` 를 못 얻는다.
- `ego_passive.id` **113/113** 이 `canonical.passive.id` 에도 있고, `conditions` 는 113/113 채워져 있다.
  `ego_passive_text` 와 `passive_text` 는 ko·en 226행이 **완전히 동일**(이름·설명 불일치 0건). `ego_passive_text` 만 ja 를 추가로 갖는다.

---

## 5. 양방향 차이

### 5.1 현행에는 있는데 신규에 없는 것

| 항목 | public | canonical | 영향 |
| --- | --- | --- | --- |
| 침식 죄악 / 침식 공격 타입 | `ego.corrosionAffinity`, `ego.corrosionAtkType` (98건) | 컬럼 없음 | 상세 "침식" 패널 · 목록 `hasCorrosion` 필터. `ego_skill→skill` 로 복원 가능(§3.1) |
| 패시브 순서 | `ego_passive.index` (0:110건 · 1:3건) | `ego_passive_link` 에 순서 컬럼 없음 | 상세 패시브 정렬(`orderBy index asc`)이 불가. 실제로 순서가 문제 되는 E.G.O 는 3건 |
| id 정렬 | `ego.id` integer | `ego.id` **text** | `ORDER BY sinnerId, id` 가 사전순이 된다. `'201011'`(연출 전용)이 `'20101'`과 `'20102'` 사이에 낀다 |
| 출시일 타입 | `releaseDate` date | `release_date` text | 상세가 `.toISOString()` 을 부른다 — 캐스팅 필요 |
| `Locale` enum | ko · en | ko · en · **ja** | 신규가 넓다(문제 아님) |

값 자체가 어긋난 것은 **없다.** rank · 각성 죄악/공격 타입 · season · releaseDate · extractable ·
`ego_cost` · `ego_resist` · `ego_status` 전량 대조에서 불일치 0건. 등급 분포도 동일(HE 40 · TETH 32 · ZAYIN 20 · WAW 18 · ALEPH 0).

### 5.2 신규에만 있는 것

| 항목 | 건수 | 비고 |
| --- | --- | --- |
| `ego_text.desc` | 345 | E.G.O 설명 한 줄. 현행에 없는 새 표시 재료 |
| ja 로케일 | ego_text 115 · passive_text 113 · skill_stage_text 616 · skill_coin 915 | `sinner_text` 는 ko·en 뿐이라 상세 부제만 ja 가 빈다 |
| `ego_skill` 계열 4테이블 | 215 / 616 / 1,848 / 2,745 | E.G.O 스킬 이름·설명·코인 효과. 수치는 없다(§3.6) |
| `ego_skill_stage_text.ab_name` | 1,848 (100%) | 유래 환상체명 |
| `ego_corrosion` | 330 | 침식 확률표. 전 E.G.O 동일값(§3.4) |
| `ego_requirement` | 314 | **`ego_cost` 와 완전 중복.** `sin_info.attribute` 로 색↔죄악 매핑 시 양방향 차집합 0건 |
| `ego.presentation_only` + 연출 전용 5종 | 5 | 목록에 그대로 내보내면 110 → 115 가 된다. 이름·수감자 말고는 전부 NULL |
| `tool_annotation` `legacyResist` | 110 | mj 의 `white`/`black` 저항. 로보토미 유산으로 격리 — 좋은 처리 |

### 5.3 양쪽 어디에도 없는데 원본에는 있는 것

| 원본 | 필드 | 건수 | 쓰임 |
| --- | --- | --- | --- |
| `ego-details`(limbus-assets · shared-library) | 스킬 수치 전량 (`spCost`·`baseValue`·`coinValue`·`atkWeight`·`levelCorrection`·`atkType`·`defType`·`affinity`·`coins[].type`·`bonuses`) | 110 / 105 파일 | §3.6 — 추천 엔진의 클래시 계산 입력 |
| `ego-details`(limbus-assets) | `notes.main` (공략 메모, 영문) | 110 | 상세 화면 보조 텍스트 후보 |
| `ego-details` | `passiveList` (패시브 영문 이름·설명) | 110 / 105 | `ego_passive_text` en 과 중복 가능 — 미대조 |
| `egos/limbus-assets/ego_voicelines.json` | `dlg`·`duration`·`speechEnd` | 109 | 대사. 화면 요구 없음 |
| `egos/limbus-assets/ego_header_offsets.json` | 헤더 이미지 오프셋 | 1 파일 | 이미지 크롭용 |
| `egos/limbus-data-mj` | `teamCodeEligible` · `slotId` · `updatedDate` | 110 각 | `teamCodeEligible` 은 인격에는 canonical 컬럼이 있는데 E.G.O 에는 없다 |
| `loc-ko/en/ja` | 스킬 `summary`(짧은 요약) | 20 | 목록 카드 요약 후보 |
| `egos/limbus-assets/egos.json` | `corrosionType` | 98 | §3.1 |

---

## 6. 결손과 영향

### 6.1 결손 대장 실측

- `canonical.field_gap` 에서 `entity like '%ego%'` → **0건**. E.G.O 는 ETL 이 스스로 기록한 결손이 하나도 없다.
- `build/gap-report.md` 의 `ego` 문자열 4건은 전부 `achievement.text` 항목의 `adv_ego#0`/`adv_ego#6`(거울 던전 도전 과제 id)이며 E.G.O 도메인과 무관하다.
- `canonical.tool_annotation` 에 `ego.legacyResist` **110건**(white/black 저항 격리).

> 즉 **PR #19 의 자체 결손 대장은 E.G.O 에 대해 아무 문제도 보고하지 않았다.** 아래 항목들은 전부 대장 밖에서 발견된 것이다.

### 6.2 결손이 화면에 미치는 영향

| 결손 | 지금 깨지는 화면 | canonical 전환 시 깨지는 것 |
| --- | --- | --- |
| 침식 죄악/공격 타입 컬럼 없음(§3.1) | 없음 | 상세 "침식" 패널이 항상 "없음". 목록 `corrosion` 필터가 무력. → 3테이블 조인으로 우회 가능 |
| 패시브 `index` 없음(§5.1) | 없음 | 패시브 2개인 3종의 순서가 비결정적 |
| `id` text 정렬(§5.1) | 없음 | 목록 정렬이 어긋나고 연출 전용 5건이 섞여 110 → 115 |
| 연출 전용 스킬 오귀속(§4.3) | 없음 | 스킬을 띄우면 5종에서 같은 이름이 2번 뜬다 |
| 코인 0개 스테이지 9건(§3.5) | 없음 | 코인 수를 세는 계산이 9스테이지에서 1개 모자란다 |
| 스킬 수치 전량 미적재(§3.6) | 없음 | E.G.O 스킬 상세·클래시 계산·추천 엔진 확장이 전부 막힌다 |
| `sinner_text` ja 없음 | 없음 | ja 상세의 수감자 부제가 빈다(E.G.O 도메인 밖) |
| E.G.O 획득 경로 | 없음 | 원본 자체에 없다(확정 결손 · 재확인) |

---

## 7. 사용자 확인 필요 항목

1. **연출 전용 E.G.O 의 스킬 귀속**(§4.3) — 게임에서 확인.
   - 무엇을 보나: 20101 「오감도」(이상, ZAYIN)의 E.G.O 상세 화면에서 각성 스킬이 **1개인지 2개인지**.
   - 예상: 1개. 그러면 canonical 의 `ego_skill(2010112 → 20101)` 5건은 오귀속이고 `201011` 로 옮겨야 한다.
   - 같은 방식으로 20301 「라 샹그레 데 산쵸」(돈키호테) · 20501 「타인의 사슬」 · 20601 「허환경」 · 21101 「토 파토스 마토스」.
   - 대조군: 20608 「오혈읍루」 는 실제로 각성 스킬 2개(오혈읍루 / 오혈읍루-종[終])여야 한다. 21209 「눈부시지 않은 영광」도 2개(… / …-광휘(光輝)).

2. **침식 확률표가 전 E.G.O 공통인가**(§3.4) — 게임에서 확인.
   - 무엇을 보나: 침식이 있는 E.G.O 두 종(예: 20102 「4번째 성냥불」, 21209 「눈부시지 않은 영광」)의 E.G.O 사용 시 침식 확률 표기.
   - 예상: 둘 다 SP 0 에서 25 % · SP −22.5 에서 75 % · SP −45 에서 100 %. 같다면 330행을 상수 3행으로 접어도 된다.

3. **코인이 없는 E.G.O 스킬이 실재하는가**(§3.5) — 게임에서 확인.
   - 무엇을 보나: 2120611(21206 의 각성 스킬, ko 명 「지난 날」, abName 「어느 날의 초상」)과 2120911 의 스킬 카드에 **코인이 몇 개** 그려지는지.
   - 예상: 1개. 그러면 `ego_skill_coin` 이 이 스킬들의 코인을 통째로 잃은 것이 맞다.

4. **E.G.O 스킬 수치를 canonical 이 실어야 하는가**(§3.6) — 제품 판단.
   - 원본 `ego-details` 에 전부 있으나 파이프라인이 입력으로 받지 않는다. 실을지 말지는 PR #20 범위 결정 사항.

5. **`ego_requirement` 를 남길 것인가**(§5.2) — 제품 판단.
   - `ego_cost` 와 색 어휘만 다른 완전 중복(314행 · 양방향 차집합 0). 색 표기가 화면에 필요하면 `sin_info.attribute` 조인으로 충분하다.
