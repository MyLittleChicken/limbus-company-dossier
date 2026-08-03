# 인격 (identity)

감사 대상: `canonical` 스키마의 인격 도메인. 기준: 현행 `public` 스키마와 실제 렌더 화면(`http://localhost:3000/ko/identities`, `/ko/identities/{10101,10715,11216}`).
모든 수치는 2026-08-02 시점 DB 실측이다. 질의는 `docker compose exec -T postgres psql -U postgres -d limbus` 로 수행했다.

---

## 1. 현행 화면이 읽는 것

### 1.1 목록 화면 `/ko/identities`

코드: `app/[locale]/identities/page.tsx`, `lib/queries/identities.ts::listIdentities` / `listSinners` / `listAffiliations`.

렌더 확인: 카드 184장. 카드 1장당 초상 아이콘 · 이름 · 등급 아이콘 · `S{season}` 태그.

| 화면 요소 | 읽는 public 컬럼 |
| --- | --- |
| 카드 이름 | `identity_text.name` (locale, en 폴백) |
| 등급 아이콘 | `identity.rarity` |
| 시즌 태그 | `identity.season` |
| 초상 | `identity.id` (파일명 규칙, DB 아님) |
| 정렬 | `identity.sinnerId`, `identity.id` |
| 필터: 수감자 | `identity.sinnerId` + `sinner_text.name` |
| 필터: 등급 | `identity.rarity` |
| 필터: 스킬 죄악 | `skill.affinity` (`identity.skills.some`) |
| 필터: 소속 | `identity_affiliation.affiliationId` + `affiliation_text.name`, 그리고 `_count.identities > 0` |
| 검색 | `identity_text.name` (locale + en, ILIKE) |

`listIdentities` 는 소속을 조회하지만 카드에는 렌더하지 않는다(질의만 하고 버린다).

### 1.2 상세 화면 `/ko/identities/{id}`

코드: `app/[locale]/identities/[id]/page.tsx`, `lib/queries/identities.ts::getIdentity`, `components/uptie-skills.tsx`.

렌더 확인(10101 · 10715 · 11216) 결과 화면에 실제로 뜨는 항목:

| 패널 | 화면에 뜨는 값 | 읽는 public 컬럼 |
| --- | --- | --- |
| 머리말 | 인격명 / 수감자명 | `identity_text.name`, `sinner_text.name` |
| 스킬(동기화 1–4 탭) | 스킬명 | `skill_stage_text.name` |
| | 스킬 설명 | `skill_stage_text.desc` |
| | `등급 n` | `skill.tier` |
| | `덱 n` | `skill.deckCount` |
| | `위력 n` | `skill_stage.baseValue` |
| | `코인 위력 n` | `skill_stage.coinValue` |
| | `공격 가중 n` | `skill_stage.atkWeight` |
| | 죄악 / 공격타입 / 방어타입 아이콘 | `skill.affinity`, `skill.atkType`, `skill.defType` |
| | 코인 번호 + `normal`/`unbreakable` | `skill_coin.index`, `skill_coin.type` |
| | 코인 효과 한국어 문장 | `skill_coin_text.desc` |
| 패시브 | 이름 · 설명 | `passive_text.name`, `passive_text.desc` |
| | `전투`/`지원` 태그 | `identity_passive.kind` |
| | `동기화 n` | `identity_passive.uptie` |
| | `조건 (res): gloom 4` | `passive.condType`, `passive_requirement.type` / `.value` |
| 스탯 | 등급 아이콘 | `identity.rarity` |
| | `체력 72 + 2.48/레벨` | `identity.hpBase`, `identity.hpPerLevel` |
| | `방어 보정 -2` | `identity.defCorrection` |
| | `스태거 구간 65 / 35 / 15` | `identity.breakSection` |
| | `시즌 0` | `identity.season` |
| | `출시일 2023-02-27` | `identity.releaseDate` |
| 저항 | `slash ×2` 등 3행 | `identity_resist.atkType`, `.value` |
| 속도 | `동기화 1 4–6` … `동기화 4 4–8` 4행 | `identity_speed.uptie`, `.min`, `.max` |
| 소속 | 태그 목록 | `identity_affiliation` + `affiliation_text.name` |
| 보유 상태 | 태그 목록 | `identity_status` + `status_text.name` |
| E.G.O | 수감자 id 링크 | `identity.sinnerId` |

**`levelCorrection` 은 public 에 있으나 화면에 뜨지 않는다.** 그 외 위 컬럼은 전부 화면에 노출된다.

---

## 2. canonical 대응 현황

행 수는 전부 실측이다.

| 항목 | public | canonical | 상태 |
| --- | --- | --- | --- |
| 인격 본체 | `identity` 184 | `identity` 184 | 대응. id 집합 완전 일치(양방향 차 0) |
| 인격 이름 | `identity_text` 368 (ko/en) | `identity_text` 552 (ko/en/ja) | **개선**. ja 추가, `name`(수감자명)/`title`(인격명) 분리 |
| 등급 | `identity.rarity` | `identity.star` | 대응. 값 불일치 0건 |
| 체력 | `hpBase` + `hpPerLevel` | `hp` (기본값만) | **결손** — `hpPerLevel` 컬럼 자체가 없다 (3절) |
| 방어 보정 | `defCorrection` | `def_correction` | 대응. 불일치 0건 |
| 스태거 구간 | `breakSection` 421개 원소 | `stagger` 421개 원소 | 대응. 불일치 0건 (PR #19 버그 수정 확인됨) |
| 시즌 | `season` NOT NULL | `season` NULL 2건 | 관측 (3절) |
| 출시일 | `releaseDate` date | `release_date` text | 대응. 1건 값 차이 (5절) |
| 저항 | `identity_resist` 552 | `identity_resist` 552 | 대응. 불일치 0건 |
| 속도 | `identity_speed` 736 (동기화 1–4) | `identity_speed` 184 (동기화 축 없음) | **결손** — 552행 상당 손실 (3절) |
| 보유 상태 | `identity_status` 1179 | `identity_status` 1179 | 대응. 양방향 차 0 |
| 소속 | `identity_affiliation` 434 / `affiliation` 93 | `identity_association` 241 / `association` 64 | 부분 대응 + 재배치 (5절) |
| 인격↔스킬 | `skill.identityId` 836 | `identity_skill` 1020 (역할 3종) | **개선**. 패닉 스킬 184건 신규 |
| 스킬 본체 | `skill` 836 | `skill` 1045 (208건은 E.G.O) | 인격 연결분 837 vs 836 (차이 1 = 패닉 스킬 1000104) |
| 덱 매수 | `skill.deckCount` | `identity_skill.copies` | 대응 (방어/패닉은 NULL 396) |
| 스킬 단계 | `skill_stage` 2386 (희소) | `skill_stage` 5180 (1036×5 전개) | 구조 변경. **수치 컬럼 전멸** (3절) |
| 단계 수치 | `baseValue`/`coinValue`/`atkWeight`/`levelCorrection` 각 2386 | 컬럼 없음 | **결손** — 9,544개 값 (3절) |
| 스킬 단계 텍스트 | `skill_stage_text` 4772 (ko/en) | `skill_stage_text` 12316 (ko 5180 · en 5180 · ja 1956) | 개선 + **토큰 미치환** (3절) |
| 코인 | `skill_coin` 5118 (`type` 보유) | `skill_coin` 10419 (`effects` 배열) | 구조 변경. **`type` 컬럼 없음** (3절) |
| 코인 한국어 문장 | `skill_coin_text` ko 5118 (한글 4196) | 없음 | **결손** — 전량 부재 (3절) |
| 코인 토큰 분해 | 없음 | `coin_token` 26942 | **신규** (5절) |
| 패시브 본체 | `passive` 590 | `passive` 709 (연결분 596) | 대응 + 6건 신규 |
| 패시브 텍스트 | `passive_text` 1180 (ko/en) | `passive_text` 1701 (ko/en/ja) | 개선 + 토큰 미치환 |
| 패시브 조건 종류 | `passive.condType` (owned 339 · res 146 · 없음 105) | 없음 | **결손** (3절) |
| 패시브 요구치 | `passive_requirement` 534 | 없음 | **결손** (3절) |
| 패시브 발동 코드 | 없음 | `passive.conditions` 599개 원소 | **신규** (5절) |
| 인격↔패시브 | `identity_passive` 590 (첫 등장 동기화) | `identity_passive` 768 (동기화별 누적) | 구조 변경 (4절 · 6절) |
| 수감자 | `sinner` 12 / `sinner_text` 24 | `sinner` 12 / `sinner_text` 24 | 대응 |
| 상태 | `status` 1472 / `status_text` 2944 | `status` 1472 / `status_text` 3913 | 개선(ja). ko 이름 결손 245건은 인격 보유 상태와 무관(4절) |
| 전투 키워드 | `keyword` 10 (인격 연결 없음) | `keyword` 12 + `identity_keyword` 266 | **신규** |
| 유닛 키워드 | 없음 (일부는 affiliation 에 섞여 있었다) | `identity_unit_keyword` 391 (36종) | **신규**, 단 표시명 없음 (6절) |
| 편성 코드 자격 | 없음 | `identity.team_code_eligible` 184건 전부 true | 신규 |

---

## 3. 채움률 이상

담당 테이블 23개 · 컬럼 82개에 대해 NULL 비율을 전수로 측정했다. **전량 NULL 인 컬럼은 없다.** PR #19 의 `identity.stagger` 는 수정되어 184/184 채워져 있고 원소 421개가 public 과 완전히 일치한다.

문제는 NULL 이 아니라 **컬럼이 아예 없는 쪽**에서 나왔다. 아래 5건은 원본에 값이 있는데 canonical 이 싣지 않은 것으로, PR #19 에서 나온 `stagger`/`cost` 버그와 같은 종류다.

### 3.1 `skill_stage` 의 위력 수치 4종이 통째로 없다 — 9,544개 값

`canonical.skill_stage` 의 컬럼은 `skill_id` · `uptie` · `changed_here` 셋뿐이다.
`public.skill_stage` 는 `baseValue` 2386 · `coinValue` 2386 · `atkWeight` 2386 · `levelCorrection` 2386 을 모두 NOT NULL 로 갖고 있다.

원본 확인:
- `raw.raw_object` `identity-details/limbus-assets/10101.json` → `skills["1010101"].data[0]` 에 `"baseValue": 2, "coinValue": 7, "atkWeight": 1, "levelCorrection": 0` 이 있다. `identity-details/shared-library/*.json` 도 동일 구조다.
- `canonical.field_source` 는 `skill|stages|mj-only-expanded|{limbus-data-mj}` 로 기록돼 있다. 즉 ETL 이 `identities/limbus-data-mj/skills.json` 만 읽었고, 이 파일의 `levels[]` 에는 `desc`/`name`/`coins`/`level` 만 있어 수치가 존재하지 않는다.

**영향:** 상세 화면 스킬 패널의 `위력 4 · 코인 위력 7 · 공격 가중 1` 세 줄이 전부 사라진다. 추천 엔진이 스킬 위력을 쓰고 있다면 계산 자체가 불가능하다. 화면에서 이 세 값은 스킬 카드마다 반복 노출되는 핵심 정보다(10101 렌더 결과 확인).

### 3.2 `identity.hp` 가 레벨당 증가량을 버렸다 — 184건

`canonical.identity.hp` 는 `integer` 스칼라 1개(184/184 채움, NULL 0). `public` 은 `hpBase`(int)와 `hpPerLevel`(double, 실측 범위 2.07–3.41) 쌍이다. 값 비교 결과 `canonical.hp = public.hpBase` 불일치 0건 — 즉 기본값만 실었다.

원본 확인: `identities/limbus-data-mj/identities_detail.json` 의 10101 payload 에 `"hp": {"defaultStat": 72, "incrementByLevel": 2.48}` 가 있다. `identities/limbus-assets/identities.json` 에도 `"hp": {"base": 72, "level": 2.48}` 가 있다. **ETL 이 읽은 바로 그 파일 안에 값이 있는데 스칼라로 접었다.** `stagger` 버그와 동형이다.

**영향:** 상세 화면 스탯 패널 `체력 72 + 2.48/레벨` 이 `72` 만 남는다. `lib/queries/identities.ts` 15–25행 주석이 "hp 는 스칼라가 아니라 기본값과 레벨당 증가량의 쌍이다"라고 명시한 함정에 canonical 이 그대로 빠졌다.

### 3.3 `identity_speed` 가 동기화 축을 잃었다 — 552행 상당

`canonical.identity_speed` 는 인격당 1행(184행, 컬럼 `identity_id`/`min`/`max`, NULL 0).
`public.identity_speed` 는 인격당 4행(736행), 동기화 1–4 별로 값이 다르다. **184개 인격 전부가 동기화에 따라 값이 변한다**(동기화별 (min,max) 조합이 2개 이상인 인격 = 184/184).

원본 확인: `identities_detail.json` 10101 에 `"minSpeed": [4,4,4,4]`, `"maxSpeed": [6,7,8,8]` 로 4원소 배열이 있다. canonical 은 마지막 원소만 남겼다(`canonical` (4,8) vs `public` 동기화4 (4,8), 불일치 0건).

**영향:** 상세 화면 속도 패널 4행이 1행으로 줄고, 동기화 1–3 의 속도를 표시할 수 없다. 배열을 스칼라로 읽은 `stagger` 버그와 동형이다.

### 3.4 코인의 한국어 설명이 전량 없다 — 4,200건

`canonical.skill_coin.effects` 는 로케일 축이 없는 단일 `text[]` 컬럼이다. 한글을 포함한 행 = **0 / 10419**. 내용은 전부 영어다(`{"[OnSucceedAttackHead] Inflict 1 [Sinking]"}`).
`public.skill_coin_text` 는 ko 5118행 중 4200행이 비어 있지 않고 4196행에 한글이 있다.

원본 확인: `identities/loc-ko/Skills.json` 의 payload 에 `levelList[].coinlist[].coindescs[].desc` 로 한국어 코인 문장이 있다. raw 계층 실측으로 **loc-ko 안에 코인 4,305개 · 문장 5,519줄**이 살아 있다. canonical 은 이 경로를 읽지 않고 mj 의 영어 `coins` 만 실었다.

**영향:** 상세 화면 스킬 카드의 코인별 설명(`[적중시] 침잠 2 부여`)이 한국어로 뜨지 않는다. 렌더 결과에서 이 문장은 스킬당 1–4줄씩 나오는 주요 본문이다.

### 3.5 패시브 발동 조건(공명 요구치)이 전량 없다 — condType 485건 + requirement 534건

`canonical.passive` 의 컬럼은 `id` 와 `conditions` 둘뿐이다. `conditions` 599개 원소를 전수 집계하면 `CheckAwakenLevel2` 286 · `CheckAwakenLevel3` 202 · `CheckAwakenLevel4` 105 · `CheckAwakenLevel5` 3 · `CheckAwakenLevelBetween_2_4` 3 — **전부 동기화 레벨 코드다.** 죄악 공명 요구치는 한 건도 없다.

`public` 은 `passive.condType`(owned 339 · res 146 · NULL 105)과 `passive_requirement` 534행(`type`=죄악, `value`=공명 수)을 갖는다.

원본 확인: `identity-details/limbus-assets/10101.json` 의 `passiveData["1010101"].condition` 에 `{"type":"res","requirement":[{"type":"gloom","value":4}]}` 가 있다. canonical 은 mj `passives.json`(`cost: null`)만 읽었다.

**영향:** 상세 화면 패시브 항목의 `조건 (res): gloom 4` 줄이 통째로 사라진다. 페이지 코드 60–69행이 `condType || requirements.length > 0` 로 분기하므로 canonical 로는 이 블록이 항상 렌더되지 않는다. 거울 던전 편성에서 공명 조건은 판단 근거이므로 실질 손실이 크다.

### 3.6 한국어 설명문에 영문 토큰이 치환되지 않은 채 남아 있다 — 4,387건

| 대상 | canonical (ko) | public (ko) |
| --- | --- | --- |
| `skill_stage_text.desc` 중 `[영문토큰]` 포함 | **3,951 / 5,180** | 0 / 2,386 |
| `passive_text.desc` 중 `[영문토큰]` 포함 | **436 / 703** | 0 / 590 |

실례: 스킬 1010203 동기화 1 — canonical `[WinDuel] 다음 턴에 마비 3 부여` / public `[합 승리시] 다음 턴에 마비 3 부여`.
빈도 상위 토큰: `[WhenUse]` 3884 · `[Breath]` 1161 · `[EndSkill]` 895 · `[BeforeAttack]` 882 · `[Combustion]` 791 · `[Laceration]` 765.

**단, 이것은 손실이 아니다.** 서로 다른 토큰 265종을 `canonical.term`(483행, ko 482행)에 대조한 결과 **265/265 전부 해소 가능**하다(`canonical.status` 로는 239/265). 즉 canonical 은 치환 전 문자열 + 사전을 따로 갖고 있고, public 은 치환된 결과를 갖고 있다. **소비자(질의 계층)가 치환을 구현해야 화면이 지금과 같아진다.**
`<sprite>`/`<color>`/`<link>` 마크업은 canonical 쪽 ko 설명에 0건으로, 이쪽 정제는 정상이다.

### 3.7 `desc_raw` 저채움 — 손실 아님(관측)

| 컬럼 | 채움 | 비고 |
| --- | --- | --- |
| `canonical.passive_text.desc_raw` | 216 / 1701 (ko 80 · en 75 · ja 61) | 마크업이 있을 때만 저장하는 규칙으로 보인다 |
| `canonical.skill_stage_text.desc_raw` | 3301 / 12316 | 동상 |
| `public.passive_text.descRaw` | 1180 / 1180 (그중 349행은 `desc` 와 동일) | 항상 저장 |

`desc_raw` 가 NULL 이어도 `desc` 는 있으므로 화면 표시에는 지장이 없다. 다만 3.6 의 토큰 미치환과 겹치는 행이 있어(1010721: `desc` 에 `[Breath]`, `desc_raw` NULL) 원본 대조가 필요할 때 근거가 없다.

### 3.8 그 밖의 NULL 관측

| 컬럼 | NULL | 판정 |
| --- | --- | --- |
| `identity.season` | 2 / 184 (10311, 10708) | public 은 같은 인격에 `0`. 원본에 season 키가 없어 canonical 이 NULL 로, public 이 0 으로 처리한 차이. **어느 쪽이 맞는지 단정하지 않는다**(7절) |
| `identity_skill.slot` · `.copies` | 각 396 / 1020 | 방어 212 + 패닉 184 = 396 과 정확히 일치. 정상 |
| `skill.attack_type` | 138 / 1045 | 방어 스킬(guard/counter/evade 216) 중 일부. public 도 `atkType` nullable |
| `skill.sin` | 1 / 1045 | public 은 "죄악이 없는 스킬 131건"이라 주석했는데 canonical 은 1건뿐 — 대상 범위가 달라(E.G.O 포함) 직접 비교 불가 |
| `coin_token.amount` | 18490 / 26942 | `kind='timing'` 12553행은 수치가 없는 것이 정상 |
| `coin_token.status_id` | 12553 / 26942 | `kind='timing'` 행 수와 정확히 일치. 정상 |
| `skill_coin.effects = '{}'` | 1502 / 10419 | public 도 `skill_coin_text.desc=''` 가 1836행. 효과 없는 코인 |
| `skill_stage_text.desc` NULL | ko 940 · en 940 · ja 368 | public 도 ko 빈 문자열 493행. 설명 없는 단계 |

---

## 4. 참조 무결성

### 4.1 고아 FK — 전부 0건

| 검사 | 결과 |
| --- | --- |
| `identity_skill` → `skill` / `identity` | 0 / 0 |
| `identity_text` → `identity` | 0 |
| `identity_association` → `association` | 0 |
| `identity_status` → `status` | 0 |
| `identity_keyword` → `keyword` | 0 |
| `skill_stage` → `skill` | 0 |
| `skill_coin` → `skill_stage` | 0 |
| `coin_token` → `skill_coin` | 0 |
| `coin_token` → `status` | 0 |
| `skill_stage_text` → `skill_stage` | 0 |
| `passive_text` → `passive` | 0 |
| `identity_passive` → `passive` | 0 |
| `identity` → `sinner` | 0 |

### 4.2 빈 자식

| 검사 | 결과 |
| --- | --- |
| 스킬 0개인 인격 | 0 |
| 공격 스킬 0개인 인격 | 0 |
| 패시브 0개인 인격 | 0 |
| 저항 0개인 인격 | 0 |
| 속도 0개인 인격 | 0 |
| 소속 0개인 인격 | 0 |
| ko 이름 없는 인격 | 0 |
| **단계 0개인 스킬** | **9** |
| 코인 0개인 단계 | 8 |
| ko 텍스트 없는 단계 | 0 |
| `identity_skill` 에 연결되지 않은 스킬 | 208 (id 접두 `2` = E.G.O 스킬, 인격 도메인 밖) |
| 어느 인격에도 붙지 않은 패시브 | 113 (대부분 E.G.O 패시브로 보인다) |

**단계 0개인 스킬 9건**: `1021207` `1071506` `1071507` `1081405` `1101205` `1101206` `1111510` `1111511` `1121607`. `canonical.field_gap` 의 `skill|levels|9` 및 `build/gap-report.md` 564행과 일치한다.
그런데 **public 에는 이 9개 스킬이 전부 존재하고, 그중 3개는 단계도 있다** — `1021207` 2단계 · `1101205` 4단계 · `1101206` 2단계, 합계 8단계. 즉 이 결손은 "어느 출처에도 없다"가 아니라 **mj 출처에만 없고 limbus-assets 에는 있는 것**이다. 소유 인격은 10212 · 10715 · 10814 · 11012 · 11115 · 11216.

### 4.3 값 대조 (public ↔ canonical)

| 항목 | 불일치 |
| --- | --- |
| `star` vs `rarity` | 0 |
| `hp` vs `hpBase` | 0 |
| `def_correction` vs `defCorrection` | 0 |
| `stagger` vs `breakSection` | 0 (원소 421개 동수) |
| `identity_resist` 3축 값 | 0 (full outer join 기준 양방향 0) |
| `identity_status` 집합 | 0 / 0 |
| `identity_speed`(canonical) vs `identity_speed`(public, uptie=4) | 0 |
| `identity_text.title` vs `identity_text.name` (개행 정규화 후) | 0 |
| `identity_skill.identity_id` vs `skill.identityId` | 0 |
| `release_date` vs `releaseDate` | **1건** (5절) |
| `season` | **2건** (3.8절) |

### 4.4 구조상 주의점 2가지

**(a) `identity_passive` 의 중복 키.** canonical 은 `(identity_id, passive_id)` 쌍이 **111건 중복**한다. 원본 `identities_detail.json` 의 `battlePassives` 가 동기화 레벨별 *누적 집합*이기 때문이다(10110: level 1 → [1011002, 1011003], level 2 → [1011002, 1011001, 1011003], level 4 → [1011002, 1011011, 1011003]). canonical 은 이를 그대로 9행으로 실었고, public 은 "처음 등장한 동기화" 1행으로 접어 4행으로 실었다.
상세 페이지는 `key={`${p.id}${p.kind}`}` 로 리스트를 렌더한다(45행). canonical 을 그대로 읽으면 **같은 패시브가 3번 반복 렌더되고 React key 가 충돌한다.** 질의 계층에서 `min(level)` 로 접어야 한다.

**(b) 역할과 방어타입의 축이 다르다.** `identity_skill.role` × `public.skill.defType` 교차표:
`attack×attack` 620 · `attack×counter` 4 · `defense×guard` 90 · `defense×evade` 48 · `defense×counter` 74.
즉 **반격 스킬 4건이 공격 슬롯에 편성**돼 있고 canonical 은 그것을 `role='attack'` 으로 구분해 표현한다(`skill.kind` 는 여전히 `counter`). public 은 `defType` 하나만 있어 이 구분을 못 한다. 손실이 아니라 canonical 쪽 정보가 더 많다.

---

## 5. 신규에만 있는 것

| 신규 항목 | 실측 | 화면이 새로 보여줄 수 있는 것 |
| --- | --- | --- |
| `identity_text.title` / `.name` 분리 | 552행, `title` NULL 0 | 지금은 `LCB 수감자` 만 뜬다. canonical 은 `이상`(name) + `LCB 수감자`(title) 를 분리 보유. 카드에 수감자명을 겹쳐 쓸 수 있다 |
| `ja` 로케일 | `identity_text` 184 · `skill_stage_text` 1956 · `passive_text` 295 · `status_text` · `sinner_text` | 일본어 화면 |
| `identity_skill.role='panic'` | 184행 (전 인격, 스킬 `1000104` 공유) | public 에 없는 패닉 스킬(E.G.O 침식). 원본 `panicSkill` 이 184건 모두 `1000104` 로 동일함을 확인 |
| `identity_skill.slot` / `.ordinal` | slot 1:200 · 2:195 · 3:229 | 스킬의 실제 편성 슬롯 위치. public 은 순서만 있다 |
| `identity.team_code_eligible` | 184건 전부 `true` | 편성 코드 가능 여부(현재 값이 모두 같아 화면 가치는 낮다) |
| `identity_keyword` + `keyword` 12종 | 266행, `skill_slots` NULL 0 | 인격의 전투 키워드(침잠·화상·출혈 등 12종)와 **어느 스킬 슬롯이 그 키워드를 쓰는지**(`{1,2,3}`). 지금 화면에 대응물이 전혀 없다. 목록 필터축으로 바로 쓸 수 있다 |
| `identity_unit_keyword` | 391행 / 36종 (`SMALL` 182 · `FIXER` 58 · `CLAN` 22 · `FINGER` 20 · `EGO_EQUIPMENT` 19 · `BASE_APPEARANCE` 12 …) | public 이 소속 태그에 섞어 넣었던 역할 태그를 별도 축으로 분리 |
| `coin_token` | 26942행 (`kind`: status 14389 · timing 12553), `status_id` 로 `status` 참조, 고아 0 | 코인 효과의 **구조화된 분해**. "이 코인이 어떤 상태를 몇 부여하는가"를 문자열 파싱 없이 질의할 수 있다. 추천 엔진에 직접 쓸 수 있는 형태다 |
| `passive.conditions` | 599개 원소 (`CheckAwakenLevel2/3/4/5`, `Between_2_4`) | 패시브가 활성화되는 동기화 레벨 코드. public 에 없다 |
| `identity_passive.level` 다중 | 768행 (중복 111쌍) | 동기화 레벨별로 활성 패시브 집합이 어떻게 누적되는지 |
| `skill_stage` 동기화 5 | 1036행, 그중 `changed_here=true` 6건 (텍스트가 4와 다른 것 12행) | 원본 mj `levels` 에 level 5 항목이 6건 존재. public 은 동기화 4 가 상한이라 표시 불가 |
| `skill_stage.changed_here` | true 2561 · false 2619 | "이 동기화에서 실제로 변경됐는가". 화면에서 변경 지점을 강조 표시할 수 있다 |
| `association` 정규화 id | 64종 (`LIMBUS_COMPANY_LCB` 등) | public 의 자유 문자열 태그(`LCB`)와 달리 코드화돼 있어 URL 필터 키로 안정적이다 |
| 이름 없는 패시브 6건 노출 | `1011003` `1021202` `1031102` `1050803` `1051102` `1100903` (인격 10110 · 10212 · 10311 · 10508 · 10511 · 11009) | public 은 이 6건을 아예 싣지 않았다. canonical 은 링크는 있고 이름/설명이 없다 — 화면의 `이름 없음` 분기가 새로 발동한다 |
| `field_gap` · `field_source` | 결손 대장 · 출처 대장 | 화면이 "이 값은 왜 비었나"를 표기할 근거 |

### 5.1 현행에는 있는데 신규에 없는 것 (요약)

3절의 5건(스킬 수치 · hpPerLevel · 동기화별 속도 · 코인 한국어 · 패시브 조건) 외에:

| 항목 | public | canonical | 비고 |
| --- | --- | --- | --- |
| `skill_coin.type` (`unbreakable`) | 275 / 5118 | 컬럼 없음 | 화면에 `unbreakable` 배지로 뜬다(10715 렌더 확인). 파괴 불가 코인은 전투 판단에 직결 |
| `skill_stage.levelCorrection` | 2386 | 컬럼 없음 | 현재 화면에는 안 뜬다. 영향 낮음 |
| 소속 태그 30종 | `Fixer`(58) `Base Identity`(12) `E.G.O Gear`(19) `Syndicate`(22) `The Fingers`(20) `Student` `Butler` `Docent` `Maestro` `War Hero` `Bloodfiend` `Mechanical Amalgam` `Heishou Pack` `The Backstreets` `L Corp.` `Lobotomy Corp. Branch` / `Headquarters` 등 | `association` 에 없음 | **대부분 `identity_unit_keyword` 로 옮겨갔다**(FIXER 58 · BASE_APPEARANCE 12 · EGO_EQUIPMENT 19 · LOBOTOMY_HEAD 9 등 개수까지 일치). 정보는 살아 있으나 축이 바뀌었다 |
| 소속 병합 | `Lobotomy Corp. Branch` + `Lobotomy Corp. Headquarters` | `Lobotomy Corp.` 1개로 병합 | canonical 에만 있는 이름 1건 |
| 출시일 1건 | 10116 = `2026-08-05` | 10116 = `2026-07-23` | 값 충돌. 7절 |

---

## 6. 결손과 영향

### 6.1 `canonical.field_gap` 중 인격 도메인

| entity | field | locale | 건수 | 비면 화면의 무엇이 깨지나 |
| --- | --- | --- | --- | --- |
| `skill` | `levels` | — | 9 | 해당 스킬의 동기화 탭 전체가 빈다. 소유 인격 6개(10212 · 10715 · 10814 · 11012 · 11115 · 11216)의 스킬 카드 하나가 이름·설명·코인 없이 렌더된다. **단 public 은 이 중 3건에 8단계를 갖고 있다** — 출처 선택 문제이지 원본 결손이 아니다 |
| `passive` | `name` | — | 6 | 상세 화면 패시브 항목이 `이름 없음`(`Nothing kind="missing"`)으로 뜬다. 설명도 없어 항목 전체가 빈 껍데기다. public 은 이 6건을 아예 싣지 않아 화면에 안 나왔다 — **canonical 로 바꾸면 빈 항목이 새로 6개 생긴다** |
| `association` | `name` | ja | 2 | 일본어 화면에서 소속 칩 2개가 비거나 폴백된다. ko/en 화면 영향 없음 |
| `status` | `name` | ko / ja | 245 / 258 | **인격 화면에는 영향 없음.** 인격이 보유한 상태 1179건 중 ko 이름이 없는 것은 **0건**으로 실측됐다. 결손분은 인격이 참조하지 않는 상태다 |

`build/gap-report.md`(646행) 에는 위 중 `skill.levels` 9건과 `passive.name` 6건이 인격 항목으로 올라 있다.

### 6.2 결손 대장에 없지만 화면을 깨는 것

`field_gap` 은 "원본에 값이 없는 것"만 기록한다. 3절의 5건은 **원본에 값이 있는데 canonical 이 안 실은 것**이라 대장에 한 줄도 없다. PR #19 의 147개 검사가 전부 통과한 것과 같은 사각지대다.

canonical 만으로 현재 상세 화면을 그대로 재현하면 다음이 깨진다.

| 화면 요소 | 결과 |
| --- | --- |
| 스킬 `위력 / 코인 위력 / 공격 가중` | 3줄 전부 사라짐 (스킬 카드마다) |
| 코인 `normal` / `unbreakable` 배지 | 사라짐 |
| 코인 한국어 설명문 | 사라짐 (영어로 대체하거나 공백) |
| 스킬·패시브 한국어 설명 | 뜨긴 하나 `[WhenUse]`, `[Breath]` 같은 영문 토큰이 그대로 노출 (스킬 3951행 · 패시브 436행) — `canonical.term` 으로 치환 구현 시 해소 |
| 스탯 `체력 72 + 2.48/레벨` | `72` 만 남음 |
| 속도 패널 4행 | 1행으로 축소, 동기화 1–3 표시 불가 |
| 패시브 `조건 (res): gloom 4` | 블록 전체가 렌더되지 않음 |
| 패시브 목록 | 같은 패시브가 최대 3회 중복 렌더 (4.4-a) |
| 소속 칩 | 3개 → 2개 (역할 태그가 유닛 키워드로 이동) |
| 유닛 키워드를 소속 자리에 쓰면 | **표시명이 없다** — `identity_unit_keyword.keyword` 36종 중 `keyword_text` 나 `term` 에 대응 행이 있는 것은 **0건**. `SMALL`, `FIXER` 같은 코드가 그대로 노출된다 |

---

## 7. 사용자 확인 필요 항목

게임 화면을 봐야 갈리는 판정이다. 감사자가 결정하지 않는다.

1. **동기화 5가 게임에 있는가.**
   canonical `skill_stage` 는 동기화 5까지 1036스킬 전부에 대해 행을 만들었고, 그중 실제로 값이 바뀌는 것은 6건이다(텍스트가 동기화 4와 다른 행 12개). public 은 동기화 4가 상한이다.
   - 볼 곳: 인격 상세 → 스킬 → 동기화 슬라이더의 최대치.
   - 예상 값: 최대 4 라면 canonical 의 동기화 5는 원본 잡음이므로 화면에서 잘라야 한다.

2. **인격 10116 의 출시일이 2026-07-23 인가 2026-08-05 인가.**
   canonical `2026-07-23`(출처 `limbus-assets`, `field_source: identity|releaseDate|assets-only`) / public `2026-08-05`. 184건 중 이 1건만 다르다.
   - 볼 곳: 게임 내 인격 10116 획득 정보 또는 공지 이력.

3. **인격 10311 · 10708 의 시즌이 0 인가 미정인가.**
   canonical `NULL` / public `0`. 나머지 182건은 완전 일치한다. 원본에 season 키가 없다.
   - 볼 곳: 인격 상세 화면의 시즌 표기. 예상 값: 시즌 표기가 아예 없으면 canonical 의 NULL 이 맞고, `S0` 이면 public 이 맞다.

4. **반격 스킬 4건이 공격 슬롯에 들어가는 것이 맞는가.**
   canonical 은 `role='attack'` 이면서 `kind='counter'` 인 조합을 4건 갖는다. public 은 `defType='counter'` 로만 분류한다.
   - 볼 곳: 해당 인격의 스킬 편성 화면에서 이 스킬이 공격 스킬 3종 중 하나로 뽑히는지, 아니면 방어 슬롯에만 뜨는지.

5. **동기화 3부터 시작하는 스킬 216건을 동기화 1·2 에서 어떻게 보여야 하는가.**
   mj `skills.json` 에서 `levels` 의 최소 레벨이 3 이상인 인격 스킬이 216건이다(예: 10101 의 `1010103` 연격). canonical 은 동기화 1·2 단계를 `changed_here=false` 로 **채워 넣었고**(가장 이른 레벨의 값을 앞으로 복사), public 은 동기화 3부터만 행을 갖는다.
   - 볼 곳: 인격 10101 → 스킬 `연격` → 동기화 1. 예상 값: 동기화 1에서도 스킬이 보이고 값이 동기화 3과 같다면 canonical 의 채우기가 맞다. 값이 다르면 canonical 이 잘못된 값을 만들어낸 것이다.

6. **이름 없는 패시브 6건을 화면에 노출할 것인가.**
   `1011003`(10110) · `1021202`(10212) · `1031102`(10311) · `1050803`(10508) · `1051102`(10511) · `1100903`(11009). 어느 출처에도 이름·설명이 없다(마스터북의 「유령」, 3회 확인됨). public 은 통째로 제외했고 canonical 은 링크를 남겼다.
   - 볼 곳: 위 6개 인격의 상세 → 패시브 목록. 예상 값: 게임에 실제로 항목이 뜨면 canonical 이 맞고 이름만 결손으로 표기하면 된다. 게임에 안 뜨면 canonical 이 유령을 노출하는 것이다.

7. **`identity_unit_keyword` 36종의 한국어 표시명을 어디서 가져올 것인가.**
   `SMALL` · `FIXER` · `CLAN` · `FINGER` · `EGO_EQUIPMENT` · `BASE_APPEARANCE` · `LOBOTOMY_HEAD` · `BLACK_BEAST` 등. raw 에 `identities/loc-*/UnitKeyword*.json` 파일이 로케일당 12개(총 133객체) 존재하지만 canonical 에는 대응 텍스트 테이블이 없다.
   - 볼 곳: 게임 인격 정보 화면에서 이 태그가 한국어로 어떻게 표기되는지(예: `FIXER` → `수사관`?).

---

## 부록 · 확인 못 한 것

- 추천 엔진(`lib/` 의 추천 관련 코드)이 인격의 어느 컬럼을 읽는지는 이번 감사 범위 밖이다. 3.1 의 스킬 위력 결손이 엔진에 미치는 영향은 확인 못 했다.
- `canonical.effect`(55행)는 코인 효과 분류 사전으로 보이나 `coin_token` 과 조인되지 않는다(토큰 265종 중 `effect.id` 와 맞는 것 0건). 용도 확인 못 했다.
- `identity_passive` 의 113개 미연결 패시브와 208개 미연결 스킬이 전부 E.G.O 도메인인지는 id 접두(`2`)로만 판단했고, E.G.O 테이블과 대조하지 않았다.
- `canonical.status` ko 이름 결손 245건이 E.G.O·적 도메인 화면을 깨는지는 인격 담당 범위 밖이라 보지 않았다.
