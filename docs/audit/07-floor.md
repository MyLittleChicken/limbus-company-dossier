# 층과 거울 던전 진행 (floor · dungeon)

감사 시점 2026-08-02 · 대상 DB `limbus` (`public` · `canonical` · `raw` · `app`)
모든 수치는 이 문서 작성 중 실제 질의로 얻은 것이다. 질의하지 않은 것은 「확인 못 함」으로 적었다.

---

## 1. 현행 화면이 읽는 것

### 1.1 `/ko/floors` — `app/[locale]/floors/page.tsx`

질의는 `lib/queries/reference.ts` 의 `listFloorPacks(locale)` 하나다. Prisma 로 `public.floor_pack` 전체를 읽고 `pack` → `pack_text` 를 조인한다.

읽는 `public` 컬럼 전수:

| 테이블 | 컬럼 | 쓰임 |
|---|---|---|
| `public.floor_pack` | `difficulty` | 그룹 키 · 정렬 |
| `public.floor_pack` | `floorRange` | 그룹 키 · `split('-')` 로 시작 층 뽑아 정렬 |
| `public.floor_pack` | `packId` | 링크 대상 · 그룹 내 정렬 키 |
| `public.pack` | `id` | `key` |
| `public.pack` | `sprite` | `packIcon()` 아이콘 경로 |
| `public.pack_text` | `packId` · `locale` · `name` | 표시명 (`nameOf` 로 locale 폴백) |

그 외 `public.pack` 의 `category` · `chapter` · `variant` · `superposition` · `extreme` · `floorLength` 와 `public.pack_boss_encounter` 는 이 화면이 **읽지 않는다**.

렌더 실측 (`curl -s -L http://localhost:3000/ko/floors`, HTTP 200, 241,606 bytes):
- 구간 12개 — `hard` 1·2·3·4·5·6-10·11-15 (7개), `normal` 1·2·3·4·5 (5개)
- 각 Panel hint 의 팩 수: hard 13·16·27·41·46·46·24, normal 8·11·14·19·23
- 합 288. DB 행 수와 일치한다
- 화면 상단 안내문은 「normal 이 1–5 다」라고 쓰지만 **데이터는 normal 을 1·2·3·4·5 다섯 구간으로 나눠 갖고 있고 화면도 다섯 구간으로 렌더한다.** 문안과 렌더가 어긋난다(코드 주석 `lib/queries/reference.ts:11` 도 같은 문안)

### 1.2 `/ko/dungeon` — `app/[locale]/dungeon/page.tsx`

질의는 `getDungeon(locale)` + `getDataset()`.

| 테이블 | 컬럼 | 쓰임 |
|---|---|---|
| `public.mirror_dungeon` | `version` | 「내부 키」 행 |
| `public.mirror_dungeon` | `totalFloors` | 「전체 층」 행 |
| `public.mirror_dungeon` | `baseFloors` | 「기본 층」 행 |
| `public.mirror_dungeon_text` | `version` · `locale` · `name` | 제목 · 「명칭」 행 |
| `public.grace_option` | `id` · `index` · `cost` | 은총 목록 · 정렬 · 비용 태그 |
| `public.grace_option_text` | `graceId` · `locale` · `name` · `descs` | 은총 이름 · 단계별 설명 |

실측값: `public.mirror_dungeon` = 1행 (`MD7`, totalFloors 15, baseFloors 5). `public.mirror_dungeon_text` = 2행 (ko 「이름과 거미의 거울」 · en `Mirror of Names and Spiders`) — **ja 없음**.

렌더 실측 (HTTP 200, 41,610 bytes): 제목 「이름과 거미의 거울」, 은총 10개가 **한국어 이름**으로 나온다 — 시작의 별 / 쌓여가는 별무리 / 성간여행 / 쏟아지는 유성우 / 쌍성계 상점 / … 설명(`descs`)은 영문이다.

`public.grace_option_text` 실측: ko 10행 · en 10행, `name` 결손 0, `descs` 결손 0. ko 행의 `descs` 는 영문 문자열이다(이름만 한국어).

### 1.3 이 도메인에서 현행 화면이 **전혀 읽지 않는 것**

`public` 에 `reward` · `achievement` · `choice_event` · `choice_option` · `adversity` 테이블 자체가 없다. 층별 보상·업적·선택지 이벤트·역경은 현행 파이프라인이 통째로 버렸고 화면도 없다.

---

## 2. canonical 적재 현황

### 2.1 행 수 실측

| 테이블 | 행 | 비고 |
|---|---|---|
| `canonical.floor_pack` | 288 | `difficulty` · `floor_range` · `pack_id` 3컬럼, 전부 PK |
| `canonical.reward` | 200 | `season` · `level` · `item` · `count` |
| `canonical.achievement` | 183 | `id` · `season` · `category` · `points int[]` · `hard_only bool[]` |
| `canonical.achievement_text` | 183 | **en 183 만.** ko 0 · ja 0 |
| `canonical.choice_event` | 159 | `id` · `type` · `illust_id` |
| `canonical.choice_event_text` | 365 | en 159 · ko 103 · ja 103 |
| `canonical.choice_event_gift` | 219 | |
| `canonical.choice_option` | 372 | `results jsonb` |
| `canonical.choice_option_text` | 866 | en 372 · ko 247 · ja 247 |
| `canonical.adversity` | 30 | `floor_range` · `index` · `value` |
| `canonical.adversity_text` | 30 | **en 30 만.** ko 0 · ja 0 |
| `canonical.grace` | 10 | `id` · `index` · `cost` |
| `canonical.grace_text` | 10 | **en 10 만.** ko 0 · ja 0 |
| `canonical.pack` | 117 | |
| `canonical.pack_text` | 351 | ko 117 · en 117 · ja 117 (public 은 234 = ko·en 만) |

참고로 `public.pack_text` 234행 대비 `canonical.pack_text` 351행 — canonical 이 ja 를 새로 담았다. 팩 표시명 쪽은 canonical 이 앞선다.

### 2.2 층 자체를 담은 테이블은 없다

`canonical` 85테이블 전수 조회 결과 `floor` · `dungeon` · `mirror` 를 이름에 가진 테이블은 `floor_pack` **하나뿐**이다.

즉 **층 목록은 `floor_pack.floor_range` 가 암묵적으로 담는다.** 문자열 `'1'`~`'5'` · `'6-10'` · `'11-15'` 를 파싱해야 층 번호가 나온다. `canonical.adversity.floor_range` 는 별도 표기 체계 `'11'`~`'15'`(단일 층)를 쓴다 — 두 테이블의 `floor_range` 는 같은 이름이지만 값 공간이 다르다.

### 2.3 canonical 에 없어진 것 — `mirror_dungeon` · `mirror_dungeon_text`

`public.mirror_dungeon`(version MD7 · totalFloors 15 · baseFloors 5)과 `public.mirror_dungeon_text`(ko·en 명칭)에 대응하는 canonical 테이블이 **없다.**

결과: `/ko/dungeon` 의 「명칭」·「내부 키」·「전체 층」·「기본 층」 네 행은 canonical 만으로는 만들 수 없다.

- `totalFloors` / `baseFloors` 는 `floor_pack.floor_range` 최대값에서 유도 가능하다 (실측: hard 최대 15, normal 최대 5 — public ETL `src/entities/egos.ts` 의 `bounds()` 가 하던 계산과 같다)
- 명칭은 유도 불가. 원본은 `raw.raw_object` 의 `mirrordungeon_name_7` 에 3언어 전부 있다 — loc-ko 「이름과 거미의 거울」 · loc-en `Mirror of Names and Spiders` · loc-ja 「名と蜘蛛の鏡」. canonical 은 이 파일을 읽지 않는다
- 버전 키(`MD7`)도 canonical 어디에도 없다

**관측**: canonical 은 pack·gift 쪽은 늘렸지만 dungeon 메타 3값은 잃었다. 화면 회귀에 해당한다.

---

## 3. 층↔팩 관계 실측 (288행의 내역)

### 3.1 분포

```
difficulty | floor_range | 행 수 | distinct pack
-----------+-------------+------+--------------
hard       | 1           |  13  | 13
hard       | 2           |  16  | 16
hard       | 3           |  27  | 27
hard       | 4           |  41  | 41
hard       | 5           |  46  | 46
hard       | 6-10        |  46  | 46
hard       | 11-15       |  24  | 24
normal     | 1           |   8  |  8
normal     | 2           |  11  | 11
normal     | 3           |  14  | 14
normal     | 4           |  19  | 19
normal     | 5           |  23  | 23
합계                       288
```

- 전체 288행 · distinct pack **116** · 구간(difficulty×range) 12개
- 각 (난이도, 구간) 안에서 `pack_id` 중복 0 — 행 수 = distinct 팩 수

### 3.2 「1–5구간 218/218」의 재현

- hard 1~5 = 13+16+27+41+46 = **143**
- normal 1~5 = 8+11+14+19+23 = **75**
- 합 **218** — 마스터북이 말한 218 이 그대로 재현된다
- **288 − 218 = 70 = hard 6-10(46) + hard 11-15(24)** 다. 즉 218 은 「1–5 층 구간만」이고, 나머지 70 은 hard 전용 후반 구간이다. 결손이 아니다

### 3.3 canonical ↔ public 차집합

(`difficulty`, `floor_range`, `pack_id`) 3튜플 기준:
- canonical − public = **0**
- public − canonical = **0**

두 스키마의 `floor_pack` 은 **완전 일치**한다(288/288).

### 3.4 어느 층에도 안 붙은 팩

`canonical.pack` 117 중 `floor_pack` 에 없는 것 **1개**:

| pack_id | category | chapter | variant | floor_length | ko | en |
|---|---|---|---|---|---|---|
| `1122` | `event` | (null) | (null) | 4 | 선의의 순례 | Pilgrimage of Compassion |

카테고리별 커버리지: attack_type 6/6 · canto 27/27 · **event 17/18** · extreme 21/21 · keyword 14/14 · railway 6/6 · sin 21/21 · walpurgis 4/4.

**관측**: `1122` 는 기간 한정 이벤트 팩으로 보이나(카테고리 `event`), 원본 `md_floor_packs.json` 에 배정이 없어 「어느 층에도 안 나오는 팩」으로 남는다. 트래커의 후보 그리드에는 영원히 안 뜬다.

### 3.5 난이도별 팩 집합

- hard 에 붙은 팩 116, normal 에 붙은 팩 51
- normal 에만 있고 hard 에 없는 팩: **0**
- hard 에만 있고 normal 에 없는 팩: **65**

normal 은 hard 의 진부분집합이다.

### 3.6 출처가 둘인데 하나만 읽는다 — 교차 출처 차이

`raw` 에 `md_floor_packs.json` 이 **두 개** 있다.

| 출처 | 파일 | (난이도,구간,팩) 쌍 수 | 팩 식별자 |
|---|---|---|---|
| `limbus-assets` | `mirror-dungeon/limbus-assets/md_floor_packs.json` | **288** | 숫자 id (`1001` …) |
| `shared-library` | `mirror-dungeon/shared-library/md_floor_packs.json` | **138** | 코드 (`C1-1` …) |

canonical 과 public 은 **`limbus-assets` 만** 읽는다. `canonical.field_source` 에 `floor_pack` 항목이 **없다** — 이 층의 출처 계보가 기록되지 않았다.

`shared-library` 는 팩 56종만 다루므로(캐노니컬 117 중), 영문명으로 키를 맞춰 그 56종에 한정해 비교했다(55종 매칭, `E1` = `N Corp. New League of Nine Litterateurs` 는 이름이 안 맞아 제외):

- shared-library 에만 있는 쌍 **3건**
  - hard·4 → `1108` 1호선
  - normal·4 → `1123` 워프특급 살인사건 BokGak
  - normal·5 → `1123` 워프특급 살인사건 BokGak
- canonical 에만 있는 쌍 **10건**
  - hard·2 → `1008` 마주하지 않는
  - hard·3 → `1010` 낙화 / `1102` 우.미.다
  - hard·4 → `1103` 20번구의 기적 / `1107` 자색 정오의 시련 / `1114` 탄환이 찍은 마침표 / `1115` LCB 정기검진 / `1117` 심야청소
  - hard·5 → `1109` 2호선
  - hard·6-10 → `1109` 2호선

**관측**: 어느 쪽이 옳은지 여기서는 판정하지 않는다. 이름 기반 매칭이라 오차 가능성이 있고(1종 미매칭), shared-library 가 부분 관측일 가능성도 있다. 다만 **차집합이 0 이 아니다** — 「층↔팩 218/218 차집합 0」은 canonical↔public 비교(같은 출처)에서만 성립하고, 교차 출처 비교에서는 성립하지 않는다.

---

## 4. 선택지 이벤트 사슬

### 4.1 사슬 무결성 — 전부 이어진다

| 검사 | 결과 |
|---|---|
| `choice_event` | 159 |
| 옵션 없는 이벤트 | **0** |
| 이벤트 없는 옵션(FK 위반) | 0 (FK 제약이 강제) |
| 옵션 수 분포 | 2개 106건 · 3개 52건 · 4개 1건 → 합 372 |
| 원본 `options` 배열 합계 | **372** — 유실 0 |
| `choice_event_gift` | 219, distinct gift 218 |
| 원본 `gifts` 배열 합계 | **219**, distinct **218** — 유실 0 |
| 기프트 없는 이벤트 | 3건 |
| 이벤트당 기프트 수 | 1개 98건 · 2개 53건 · 3개 5건 |
| `choice_option.results` | 372/372 전부 jsonb 배열, 빈 배열 **0** |

**219 = 218 + 1** 은 한 이벤트가 같은 기프트를 두 번 참조한 것이 아니라, 서로 다른 두 이벤트가 같은 기프트 1종을 공유한 결과다(distinct 218, 총 참조 219).

### 4.2 이벤트에 층 정보가 없다

`canonical.choice_event` 컬럼은 `id` · `type` · `illust_id` 셋뿐이다. **층·구간·팩 어느 쪽과도 연결되지 않는다.** 원본 `md_choice_events.json` 에도 층 키가 없다(키 전수: `advantages` · `desc` · `gifts` · `illustId` · `messages` · `name` · `options` · `type`).

→ 「지금 3층인데 이 층에서 뜰 수 있는 이벤트」는 **현재 데이터로 낼 수 없다.**

### 4.3 채움률 이상 — `illust_id`

`canonical.choice_event.illust_id` 는 159행 중 **1행만** 채워져 있다(158 NULL).

**버그 아님**으로 판정한다. 근거: `raw.raw_object` 에서 `md_choice_events.json` 의 `illustId` 키 타입 분포가 `number` 1건 · **키 없음 158건**이다. 원본이 그렇다. ETL 주석(`src/v2/canonical/mirror.ts` 「원본이 숫자다 — 문자열로 읽으면 null 이 된다」)은 옳게 `num()` 을 쓰고 있다.

### 4.4 `type` 이 단일값

`canonical.choice_event.type` 은 159행 전부 `'Choice'`. 원본도 159/159 `'Choice'`. 컬럼이 정보를 담지 않는다(관측).

### 4.5 원본에서 버려진 키 — `advantages`

원본 이벤트 159건 중 **112건**이 `advantages` 키를 갖는다. 값은 죄악 배열이다:

```
901002 → ["wrath","gloom"]
901003 → ["wrath","lust","envy"]
901006 → ["lust","sloth","pride"]
```

canonical 은 이 키를 **읽지 않고, 결손으로도 기록하지 않는다**(`field_gap` 에 `choice_event.advantages` 항목 없음). 추천 엔진이 덱의 죄악 분포(`sinSupply`, `lib/engine/state.ts`)를 이미 계산하므로 이벤트 유불리 판정에 직결되는 값인데 사라졌다.

`messages` 키도 159/159 존재하나 옵션 `message` 의 중복이므로 유실 영향 없음.

---

## 5. 채움률 이상

### 5.1 `choice_event_text.name` — 결손 대장이 세지 않는 결손

| locale | 행 | `name` 비NULL | `desc` 비NULL | `desc_raw` 비NULL |
|---|---|---|---|---|
| en | 159 | **139** | 159 | 6 |
| ko | 103 | **26** | 103 | 0 |
| ja | 103 | **26** | 103 | 0 |

`build/gap-report.md` 는 `choice_event.text` ko 56 · ja 56 만 센다 — **행이 아예 없는 56건**이다. 실제로는 행이 있는 103건 중 **77건이 `name` NULL** 이다. 원본 loc 파일이 `"name": ""` 를 담고 있고 `str()` 이 빈 문자열을 null 로 바꾼다(`src/v2/source.ts:59-62`).

→ **한국어 이벤트 이름의 실제 커버리지는 159 중 26 (16.4%)** 이다. 대장이 말하는 「103/159 있음」과 다르다.

영문도 159 중 139 — 20건은 영문 이름조차 없다.

### 5.2 `choice_option_text` — 옵션 텍스트

| locale | 행 | `message` 비NULL | `desc` 비NULL |
|---|---|---|---|
| en | 372 | 372 | 271 |
| ko | 247 | 247 | 165 |
| ja | 247 | 247 | 165 |

옵션 문구 자체는 ko/ja 247/372(66.4%)로 살아 있다. 결손 125건은 5.1 의 56개 이벤트에 딸린 것이다.

### 5.3 `achievement.points` / `hard_only` — 배열 채움률

| cardinality | `points` | `hard_only` |
|---|---|---|
| 0 | 155 | 155 |
| 2 | 6 | 6 |
| 3 | 7 | 5 |
| 4 | 4 | 7 |
| 5 | 8 | 7 |
| 6 | 1 | 1 |
| 15 | 2 | 2 |

- 183 중 **155건이 빈 배열**. 원본 확인 결과 `replace` 키(단계 임계값)를 가진 업적이 정확히 **28건**이고 그 28건이 비어 있지 않은 것과 일치한다 → **원본 그대로**, ETL 버그 아님
- 두 배열의 길이가 **다른 행 5건**. 원본 실측 예: `shp_purchase` 는 `points` 5개 `hardonly` 4개, `shp_cost` 는 `points` 3개 `hardonly` 2개 → **원본 자체가 어긋나 있다**. canonical 은 원본을 그대로 옮겼다. 소비 측이 인덱스로 짝지으면 마지막 단계의 hard 전용 여부를 못 읽는다

카테고리별 빈 배열: Adversity-EXTREME 23/25 · Clears 4/10 · Collection 43/50 · Combat 28/30 · Completionist 2/2 · Hidden 15/15 · Loadout 37/37 · Shop 3/14.

### 5.4 `achievement.season` — 값이 틀렸다 (버그)

ETL(`src/v2/canonical/mirror.ts`)이 `md__achievements.json` → `season 0`, `md__md6__achievements.json` → `season 6` 으로 **하드코딩**한다.

원본 실측:
- `md__achievements.json` 의 `__Season__` = **`"7"`**
- `md__md6__achievements.json` 의 `__Season__` = **`"6"`**

즉 `canonical.achievement` 의 **season=0 인 93행은 실제로는 시즌 7** 이다. `__Season__` 키는 ETL 루프에서 `continue` 로 건너뛰어진다.

같은 문제가 `canonical.reward` 에도 있다. 교차 검증:

| season | 행 | `item` 에 "Season 7" 포함 | "Season 6" 포함 |
|---|---|---|---|
| 0 | 100 | **33** | 0 |
| 6 | 100 | 0 | 33 |

season=0 행의 아이템명이 `Season 7 Uptie & Threadspinning only Shard (Universal)` 등이다. **season 0 = 시즌 7.**

**버그로 판정한다.** 근거: 원본이 `"7"` 을 명시하고 있고, 적재값 0 이 아이템명과 모순된다. 영향 200행(reward 100 + achievement 93).

### 5.5 `reward` 는 「층별 보상」이 아니다

`canonical.reward` PK 는 `(season, level)`. 실측: season 0 · 6 각각 `level` 1~100 빠짐없이 100행.

`level` 은 **층이 아니라 시즌 보상 트랙 레벨 1~100** 이다. 거울 던전 최대 층은 15다. 아이템 분포도 트랙 성격이다:

```
Identity Training Ticket IV                                   68
Thread                                                        40
Season 7 Uptie & Threadspinning only Shard (Universal)        30
Season 6 Uptie & Threadspinning only Shard (Universal)        30
Extraction Ticket                                             20
Decaextraction Ticket                                          2
(그 외 1건씩 10종 — 기념 배너 · 프로필 티켓 등)
```

**관측**: 작업 지시서와 마스터북이 이 테이블을 「층별 보상 200행」이라 부르지만, 데이터에는 층과의 연결이 없다. 층별 보상 데이터는 canonical 어디에도 **없다**.

---

## 6. 결손과 영향 (보상·업적·이벤트 텍스트)

`canonical.field_gap` 중 이 도메인 항목:

| entity | field | locale | 건수 |
|---|---|---|---|
| `reward` | `item` | ko / ja | 200 / 200 |
| `achievement` | `text` | ko / ja | 183 / 183 |
| `choice_event` | `text` | ko / ja | 56 / 56 |
| `adversity` | `name` | ko / ja | 30 / 30 |
| `grace` | `name` | ko / ja | 10 / 10 |

아래는 각 결손에 대해 (a) 영문이 있는가 (b) 화면에 무엇을 띄울 수 있나 (c) 원본에 정말 없나 를 실측한 것이다.

### 6.1 `grace.name` ko·ja 10/10 — **거짓 결손 (버그)**

ETL 주석: 「은총도 영문만 있다 — `${locale}` 표시명이 **어느 출처에도 없다**」.

**원본에 있다.** `raw.raw_object` 실측:

```
mirror_dungeon_5_buffs_title_100  en Star of the Beginning  ko 시작의 별      ja 始まりの星
mirror_dungeon_5_buffs_title_101  en Cumulating Starcloud   ko 쌓여가는 별무리 ja 積もりゆく星群
…
mirror_dungeon_5_buffs_title_109  en Perfected Possibility  ko 완전한 가능성   ja 完全なる可能性
```

`grace.index` 1~10 ↔ 키 접미사 100~109 로 **10/10 전부** 대응한다(영문명 일치로 10/10 검증). ko 10건 · ja 10건 모두 존재.

게다가 **현행 `public` 파이프라인은 이미 한국어를 담고 있다** — `public.grace_option_text` ko 10행, `name` 결손 0, `/ko/dungeon` 화면에 「시작의 별」이 실제로 렌더된다. `src/entities/egos.ts:239-247` 이 영문명을 열쇠로 삼아 대응을 찾는다.

**판정: 버그이자 회귀.** canonical 은 public 이 이미 해결한 것을 「출처 없음」으로 20건 등록했다.
- 화면 영향: canonical 로 갈아타면 `/ko/dungeon` 의 은총 이름이 한국어 → 영문으로 **후퇴**한다
- 단, `descs`(단계별 효과)는 canonical·public 모두 영문이다. 한국어 설명은 `DungeonStartBuffs*.json` 에 있으나 키 체계가 다르고(`ADDITIONAL_COST_RATE_ON_CLEAR_FLOOR` 류) `{0}` 자리표시자를 쓴다 — 대응 확인 못 함

### 6.2 `adversity.name` ko·ja 30/30 — **거짓 결손 (버그)**

ETL 주석: 「역경도 영문만 있다 — 어느 출처에도 없다」.

**원본에 있다.** 키 체계가 규칙적이다:

- `floor_range` 11~15, `index` 0~4 → `MD6Limit1{floor_range-11}{index+1}`
- `index` 5 → `MD7Limit1{floor_range-11}1`

30건 전부에 대해 이 매핑으로 조회한 결과 **영문명 일치 30/30 · ko 30/30 · ja 30/30**:

```
MD6Limit101  en Level Boost          ko 레벨 강화    ja レベル強化
MD6Limit102  en Frailness            ko 쇠약        ja 衰弱
MD7Limit101  en Force Redistribution   ko 전력 재분배    ja 戦力の再分配
MD7Limit111  en Psychological Elation  ko 정신적 고양    ja 精神的高揚
MD7Limit121  en Shield Generation      ko 보호막 생성    ja バリア生成
MD7Limit131  en Fracture Proliferation ko 균열 증식      ja 亀裂増殖
MD7Limit141  en Status Infliction      ko 상태이상 부여   ja 状態異常付与
```

출처: `mirror-dungeon/loc-{ko,en,ja}/BattleKeywords_Mirror6.json` · `Bufs_Mirror6.json` · `BattleKeywords_Mirror7.json` · `Bufs_Mirror7.json`.

**연쇄 관측**: 같은 id 가 `canonical.status_text` 에도 들어 있는데 **거기도 en 만** 있다 — `MD6Limit*` en 26행(ko·ja 0), `MD7Limit*` en 5행(ko·ja 0). `canonical.status_text` 전체는 en 1472 · ko 1227 · ja 1214 로 대부분 3언어를 갖고 있으므로, MD*Limit 만 빠진 것이다. 원인 추정: 이 id 들의 ko/ja 는 `mechanics/loc-*` 가 아니라 `mirror-dungeon/loc-*` 에 있는데 status ETL 이 `mechanics` 만 읽는다. (status 도메인 소관 — 여기서는 관측으로만 남긴다)

**판정: 버그.** 60건이 거짓 결손이며, 역경 화면은 지금 영문만 띄울 수 있으나 원본에서 한국어·일본어를 그대로 가져올 수 있다.

### 6.3 `achievement.text` ko·ja 183/183 — 진짜 결손이나 대체 출처 후보 있음

- **영문은 있다** — `achievement_text` en 183/183, 결손 0
- 화면에 띄울 수 있는 것: 영문 조건문, `category`(8종), `points` 배열(28건만), `season`(단 5.4 의 값 오류)
- 화면에 못 띄우는 것: 한국어·일본어 조건문. 그리고 **`[count]` 자리표시자를 채울 값** — 영문 텍스트가 `"…use the Shop Refresh function [count] or more times…"` 인데 canonical 은 `replace` 키를 담지 않아 `[count]` 를 무엇으로 바꿔야 하는지 알 수 없다. 원본 183건 중 28건이 `replace.count`(예: `[10,20,30,40,50]`)를 갖는다 → **그 28건은 영문조차 온전히 못 띄운다**
- 원본이 함께 버린 것: `tips` 키가 **183/183 전건**에 있다. 공략 텍스트 · 관련 기프트 목록 · 표 컴포넌트 지시가 들어 있는 풍부한 콘텐츠다. canonical 은 담지 않고 결손 기록도 없다

**대체 출처 후보(미검증)**: `mirror-dungeon/loc-ko/UI_Mission_MirrorDungeon{5,6,7}Event.json` 에 한국어 업적 조건문이 있다 — 실측 예:

```
mission_ui_condition_tags_201004010 → "스킬 교체 관측을 1회 이상 사용하고 거울 던전 5층 이상 클리어"
                                       (en: shp_replace_search "…using the Skill Search function once or more…")
```

ko 건수는 70 + 49 + 28 = **147** 이고 업적은 183 이다. 키 체계가 숫자(`201004010`)와 슬러그(`shp_replace_search`)로 갈려 있어 **대응표가 필요하다 — 여기서는 확인 못 함**. 그리고 `MirrorDungeonUI_{6,7}_Achievement.json` 에 카테고리 8종의 한국어 이름이 있다(수집 · 클리어 · 편성 · 상점 · 전투 · 제약 - 익스트림 · 달성도 · 히든) — 이것은 즉시 쓸 수 있다.

### 6.4 `reward.item` ko·ja 200/200 — 진짜 결손, 스키마에 자리도 없다

- **영문은 있다** — `reward.item` NOT NULL, 빈 문자열 0, 200/200
- `reward` 에는 **`_text` 짝 테이블이 아예 없다.** `item` 은 본표의 `text` 컬럼이므로 ko/ja 를 담을 자리가 구조적으로 없다. 결손 200×2 를 해소하려면 스키마 변경이 필요하다
- 원본 확인: `md__rewards.json` · `md__md6__rewards.json` 은 `limbus-assets` 에만 있고 `loc-ko` / `loc-ja` 에 대응 파일이 **없다**. `raw` 전체에서 `"인격 성장권"` 0건, `"Extraction Ticket"` 이 loc-ko/loc-ja 에 0건 → **한국어 아이템명은 raw 에 없다**
- 화면에 띄울 수 있는 것: 레벨 1~100, 영문 아이템명, 수량, 시즌(값 오류 있음)
- 못 띄우는 것: 한국어·일본어 아이템명. 그리고 애초에 **층별 보상이 아니다**(5.5) — 「층별 보상」 화면은 이 데이터로 만들 수 없다

### 6.5 `choice_event.text` ko·ja 56/56 — 실제 결손은 훨씬 크다

5.1 참조. 대장은 56 을 세지만 실제 한국어 이벤트 **이름** 결손은 133/159 이다. 설명(`desc`)은 103/159 있다.

- 화면에 띄울 수 있는 것: 한국어 본문(103건) · 한국어 선택지 문구(247/372) · 획득 가능 기프트(219 연결, 기프트명은 별도 도메인)
- 못 띄우는 것: 한국어 이벤트 제목 133건 · 영문 제목도 20건 · 이벤트 삽화(`illust_id` 158/159 NULL) · 이벤트가 어느 층에 뜨는지

---

## 7. 트래커 요구 재검증

`docs/07-recommendation-system.md` 5.2절이 정의한 흐름을 항목별로 질의로 확인했다.

```
런 없음 → [덱 고르기][난이도] → 런 시작
런 있음 → 현재 층
          후보 팩 그리드 — 그 난이도·층에서 등장 가능한 팩 전부
          [이 팩 선택] → 획득 기프트 모달(한정/공용 분리) → 층 +1
          하단: 층 이력 · [마지막 층 되돌리기] · [런 종료]
```

| 요구 | canonical 에 있나 | 실측 근거 |
|---|---|---|
| 난이도 2종 | **있음** | `floor_pack.difficulty` = `normal`·`hard` |
| 층 1~15 범위 | **유도만 가능** | 층 테이블 없음. `floor_range` 최대값 hard 15 · normal 5 로 유도. `mirror_dungeon.totalFloors/baseFloors` 는 canonical 에 **없음**(2.3) |
| 난이도·층 → 후보 팩 | **있음** | `floor_pack` 288행. `lib/engine/load.ts:170 packIdsForFloor()` 가 `floorRange.split('-')` 로 하는 계산이 canonical 에도 그대로 성립 |
| 후보 수 실측 | **있음** | hard 1층 13 · 3층 27 · 7층 46 · 12층 24. normal 1층 8 · 5층 23 |
| 팩 표시명·아이콘 | **있음, public 보다 낫다** | `pack_text` ko/en/ja 각 117 · `pack.sprite` 117/117 |
| 팩별 등장 기프트(공용) | **있음** | `gift_pack` 10,115행 / 117팩 / 358기프트 |
| 팩별 한정 기프트 | **있음** | `gift_exclusive_pack` 321행 / **71팩** / 230기프트 → 문서가 말한 「71팩이 전용 기프트 보유, 46팩은 없음」과 일치(117−71=46) |
| 팩 보스 | **있음** | `pack_boss_encounter` 75행 / 75팩 (42팩은 보스 없음) |
| 팩 배제 규칙 입력 | **있음** | `pack.category`(extreme 21 · walpurgis 4) · `pack.extreme` — `availabilityOf()` 가 쓰는 두 값이 canonical 에도 존재 |
| 층 이력 저장 | **있음(app)** | `app.run(id·account_id·difficulty·started_at·ended_at·floor)` · `app.run_floor(run_id·floor·pack_id)` · `app.run_gift(run_id·gift_id·level)` — 문서의 `StoredRun` 모양과 대응한다 |
| 시작 기프트 풀 | **있음** | `start_gift` 30행 / 키워드 10 / 기프트 30 |
| 은총(런 시작 시 선택) | **있음, 이름은 영문만** | `grace` 10 · `grace_text` en 10 (6.1) |
| 층별 역경 | **있음, 11~15층 한정** | `adversity` 30행 = 5층(11~15) × 6. 1~10층에는 역경 데이터 **없음**. 이름은 영문만 |
| 층별 보상 | **없음** | `reward` 는 시즌 트랙 레벨 1~100 이며 층과 무관(5.5) |
| 층별 선택지 이벤트 | **연결 없음** | `choice_event` 159건에 층·팩 연결 컬럼 없음(4.2). 「이 층에 뜰 이벤트」 불가 |
| 업적 진행 추적 | **부분** | `achievement` 183 · 조건문 영문만 · `[count]` 임계값 미적재 · season 값 오류(5.4) |

### 결론

**후보 팩 제시까지는 canonical 로 충분하다.** 층 → 팩 → 기프트(공용/한정) → 보스 사슬이 끊긴 데 없이 이어지고, 팩 표시명은 3언어로 public 보다 낫다. `app.run_floor` 도 준비되어 있다.

**부족한 것 셋:**
1. 층 상한(15/5)과 던전 명칭을 담은 테이블이 없다 — 파생으로 때울 수는 있으나 명칭은 불가(2.3)
2. 이벤트와 층/팩의 연결이 없다 — 「이 층의 이벤트」 화면은 만들 수 없다(4.2)
3. 층별 보상이 없다 — 「이 층 클리어 보상」 화면도 만들 수 없다(5.5)

---

## 8. 사용자 확인 필요 항목

게임 화면을 봐야 갈리는 것만 적는다.

### 8.1 normal 난이도의 구간이 1~5 다섯 개인가, `1-5` 하나인가

- **데이터**: `floor_pack` 은 normal 을 `1`·`2`·`3`·`4`·`5` 다섯 구간으로 나누고 각각 팩 8·11·14·19·23종을 배정한다
- **문안**: `/ko/floors` 안내문과 `lib/queries/reference.ts:11` 주석은 「normal 이 1–5 다」(단일 구간)라고 쓴다
- **어디서 갈리나**: 거울 던전 → 보통 난이도 입장 → **1층과 4층의 테마팩 선택 화면**. 두 층의 후보 팩 목록이 같으면 단일 구간, 다르면 층별 구간
- **예상**: 데이터대로면 1층 8종 · 4층 19종으로 확연히 다르다

### 8.2 팩 `1122` 「선의의 순례」가 실제로 등장하는가

- **데이터**: `canonical.pack` 에 있으나 `floor_pack` 에 **없다**. 117팩 중 유일
- **어디서 갈리나**: 거울 던전 → 테마팩 도감(테마팩 목록) 에서 「선의의 순례」 항목이 잠금 해제 가능한지 · 「기간 한정」 표기가 붙는지
- **예상**: 기간 한정 이벤트 팩이라 상시 등장하지 않음. 그렇다면 결손이 아니라 부재다

### 8.3 교차 출처 13건 중 어느 쪽이 맞나 (3.6)

- **어디서 갈리나**: 하드 난이도 해당 층의 테마팩 후보 목록. 확인이 쉬운 두 건:
  - **하드 4층** — 「1호선」(`1108`) 이 후보에 뜨는가? shared-library 는 뜬다고 하고 canonical/public 은 안 뜬다고 한다
  - **하드 5층과 6~10층** — 「2호선」(`1109`) 이 후보에 뜨는가? canonical/public 은 뜬다고 하고 shared-library 는 안 뜬다고 한다
- 나머지 11건(하드 2·3·4층의 8팩, normal 4·5층의 `1123`)도 같은 방식으로 확인 가능

### 8.4 시즌 번호 — season 0 이 시즌 7 인가 (5.4)

- **데이터**: 원본 `__Season__` = `"7"` 이고 아이템명이 `Season 7 …` 인데 적재값은 0
- **어디서 갈리나**: 거울 던전 → 보상 목록(시즌 보상 트랙) 상단의 시즌 표기, 그리고 레벨 3 보상 아이템 이름이 「시즌 7 동기화 및 실타래뽑기 전용 조각」인지
- **예상**: 시즌 7. 그렇다면 `season 0` 은 명백한 적재 오류다

### 8.5 역경(`adversity`)이 정말 11~15층에만 있는가

- **데이터**: `adversity.floor_range` 는 `11`~`15` 다섯 값뿐. 각 6종
- **어디서 갈리나**: 하드 난이도로 진행 중 **10층 → 11층 진입 시점**에 역경 목록이 처음 뜨는지, 그 전 층에서도 뜨는지. 그리고 11층 목록에 「레벨 강화 · 쇠약 · 불의 낙인 I · 인플레이션 I · 에고 간섭 I · 전력 재분배」 6개가 맞는지
- 참고: `MD6LimitBaseN` (`Mounting Adversities`) 라는 키가 원본에 따로 있는데 canonical 에 없다 — 층별 누적 규칙일 가능성이 있으나 확인 못 함

### 8.6 업적 `[count]` 임계값 (6.3)

- **데이터**: 영문 텍스트에 `[count]` 가 남고 치환값(`replace.count`)은 미적재. 28건 해당
- **어디서 갈리나**: 거울 던전 → 달성도 → 상점 → 「상점 새로고침」 업적의 단계별 요구 횟수. 원본 `replace.count` 는 `[10,20,30,40,50]`, `points` 는 `[20,40,60,80,100]`
- 확인되면 「10회/20회/…」와 「20점/40점/…」 중 어느 쪽이 화면 표기인지 갈린다

### 8.7 `points`/`hard_only` 길이 불일치 5건 (5.3)

- **데이터**: `shp_purchase` 는 points 5단계 · hardonly 4개, `shp_cost` 는 3 · 2
- **어디서 갈리나**: 거울 던전 → 달성도 → 상점 → 「상점 기프트 구매」 업적의 **마지막(5)단계**에 「어려움 난이도 전용」 표기가 붙는가
- 붙는다면 hardonly 마지막 원소가 누락된 것이고, 안 붙는다면 앞쪽 정렬이 맞는 것이다
