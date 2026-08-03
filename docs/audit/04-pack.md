# 테마 팩 (pack)

감사 대상: `canonical` 스키마의 팩 도메인. 기준: 현행 `public` 스키마를 읽는 화면·엔진 코드와
`raw` 원본. 모든 수치는 2026-08-02 기준 실측 질의 결과다.

---

## 1. 현행 화면이 읽는 것

### 1.1 코드에서 뽑은 컬럼 전수

`lib/queries/packs.ts` · `app/[locale]/packs/page.tsx` · `app/[locale]/packs/[id]/page.tsx`.

| 화면 | 읽는 `public` 컬럼 / 관계 | 쓰임 |
| --- | --- | --- |
| 목록 `listPacks` | `pack.id` | 링크 |
| | `pack.category` | 칩 필터 · 정렬 1키 · 태그 표시 |
| | `pack.variant` | 반환하지만 목록 JSX 에서 미사용 |
| | `pack.chapter` | 반환하지만 목록 JSX 에서 미사용 |
| | `pack.superposition` | 3상 필터 · 「중첩」 태그 |
| | `pack.extreme` | 3상 필터 · 「극한」 태그 |
| | `pack.sprite` | `packIcon(sprite)` → 카드 그림 |
| | `pack_text.locale`·`name` | 이름(ko 우선, en 폴백) |
| | `floor_pack.difficulty`·`floorRange` | 「hard 1」 식 태그 |
| | `gift_pack` count | 「기프트 n」 |
| | `gift_exclusive_pack` count | 「전용 n」 |
| | `pack_boss_encounter` count | 반환하나 목록 JSX 에서 미사용 |
| 목록 `listPackCategories` | `pack.category` groupBy | 칩 필터 옵션 + 건수 |
| 상세 `getPack` | 위 전부 + `pack.floorLength` | 「차지 층 수」 |
| | `pack.sprite` → `packBossIcon` = `` `${sprite}_boss` `` | 「보스 층」 그림 |
| | `pack_boss_encounter.encounterId` → `encounter.targets` (`index`·`count`·텍스트) | 「보스전 등장 적」 |
| | `gift_exclusive_pack` → `gift.tier`·`sprite`·`keyword`·텍스트 | 전용 기프트 목록 |
| | `gift_pack` → 같은 필드 | 전체 풀 · 등급/키워드 분포 막대 |

**`public.pack` 8컬럼 전부**(id·category·chapter·variant·sprite·superposition·extreme·floorLength)가
질의에 실려 나온다. 그중 `chapter`·`variant`·`floorLength` 는 상세에서만 화면에 찍힌다.

### 1.2 렌더 확인 (localhost:3000)

| URL | HTTP | 관측 |
| --- | --- | --- |
| `/ko/packs` | 200 · 261,012 B | `/ko/packs/{id}` 링크 **117개** 유일. 「일반 층 순환에 등장하지 않음」 1건 |
| `/ko/packs/1201` | 200 · 76,288 B | 그림 `AttackType_normal.webp` **1장만**. 「보스 층」 figure 없음 |
| `/ko/packs/1301` | 200 · — | `Crimson_normal.webp` + `Crimson_normal_boss.webp` **2장** |
| `/ko/packs/1302` | 200 · — | `Crimson_hard.webp` **1장만**. 「보스 층」 figure 없음 |
| `/ko/packs/3001` | 200 · 199,782 B | `HiddenTheme.webp`. 목록·상세 모두 정상 노출(엔진만 제외함) |
| `/ko/packs/1122` | 200 · 105,350 B | 「보스전 등장 적」 패널 출력 |

---

## 2. canonical 대응 현황

### 2.1 테이블 대조 (실측 행 수)

| 항목 | public | canonical | 상태 |
| --- | ---: | ---: | --- |
| `pack` | 117 | 117 | 동일. id 집합 차 0/0 |
| `pack_text` | 234 (ko 117 · en 117) | 351 (ko 117 · en 117 · **ja 117**) | 신규가 ja 117 추가 |
| `pack_tag` | — (테이블 없음) | 184 (유일 태그 47종) | **신규 전용** |
| `pack_category_path` | — (테이블 없음) | 202 (depth0 117 · depth1 85) | **신규 전용** |
| `pack_boss_encounter` | 75 | 75 | 행 수 동일. `encounterId` 구분자만 `\|`→`__` (정규화 후 차 0) |
| `floor_pack` | 288 | 288 | 3열 완전 일치(차 0/0) |
| `gift_pack` | 10,115 | 10,115 | 완전 일치(차 0/0) |
| `gift_exclusive_pack` | 321 | 321 | 완전 일치(차 0/0) |
| `encounter`(참조 대상) | 82 | 251 | 신규가 169개 많음 — 인카운터 담당 영역 |
| `gift`(참조 대상) | 456 | 582 | 신규가 126개 많음 — 기프트 담당 영역 |

### 2.2 컬럼 대조

| 컬럼 | public | canonical | 상태 |
| --- | --- | --- | --- |
| `id` | text | text | 동일 |
| `category` | **text** | **enum**(canto,event,walpurgis,railway,attack_type,sin,keyword,extreme) | 타입 승격. 값 불일치 0/117 |
| `chapter` | **text** nullable | **integer** nullable | 타입 변경. 텍스트 캐스트 비교 시 불일치 0/117, NULL 90/117 양쪽 동일 |
| `variant` | **text** | **enum**(normal/mid/hard) | 타입 승격. 불일치 0/117, NULL 90/117 |
| `sprite` | text | text | 불일치 0/117 |
| `superposition` | boolean | boolean | 불일치 0/117 (true 46) |
| `extreme` | boolean | boolean | 불일치 0/117 (true 24) |
| `floorLength` / `floor_length` | integer **nullable** | integer **NOT NULL** | 불일치 0/117. 양쪽 NULL 0 |
| `overlay_sprite` | **없음** | text nullable, 41건 | **신규 전용** |
| `text_color` | **없음** | text nullable, 56건 | **신규 전용**(결손 61) |
| `unlock_code` | **없음** | integer nullable, 115건 | **신규 전용**(결손 2) |
| `bokgak` | **없음** | boolean NOT NULL, true 6건 | **신규 전용** |
| `gift_pack.giftId` | **integer** | **text** | 타입 변경. 값은 전부 숫자 문자열(비숫자 0/10,115) |
| `gift_exclusive_pack.giftId` | integer | text | 동일 사유(비숫자 0/321) |

**현행에는 있는데 신규에 없는 컬럼은 0개다.** 팩 도메인은 순수 확장 관계다.

---

## 3. 채움률 이상

### 3.1 `canonical.pack` 전수 (분모 117)

| 컬럼 | NULL | 채움률 | 판정 |
| --- | ---: | ---: | --- |
| `id` `category` `sprite` `superposition` `extreme` `bokgak` `floor_length` | 0 | 100 % | 정상 |
| `chapter` | 90 | 23.1 % | **정상** — `category='canto'` 27종에만 값이 있다. public 도 동일하게 90 NULL |
| `variant` | 90 | 23.1 % | **정상** — 같은 27종. public 동일 |
| `overlay_sprite` | 76 | 35.0 % | **정상** — 원본 `limbus-assets.overlayImage` 가 41개 객체에만 있다(실측 41) |
| `text_color` | **61** | 47.9 % | **원본 결손 확인** (아래 3.3) |
| `unlock_code` | **2** | 98.3 % | **원본 결손 확인** (아래 3.4) |

### 3.2 자식 테이블

| 테이블 | 컬럼 | NULL | 비고 |
| --- | --- | ---: | --- |
| `pack_text` | `name` | 0 (빈 문자열도 0) | ko/en/ja 각 117 |
| `pack_tag` | `tag` | 0 | 팩당 1–2개 |
| `pack_category_path` | `value`,`depth` | 0 | depth0 117 · depth1 85 |
| `floor_pack` | 전 컬럼 | 0 | |
| `pack_boss_encounter` | 전 컬럼 | 0 | |
| `gift_pack` / `gift_exclusive_pack` | 전 컬럼 | 0 | |

**전량 NULL 컬럼은 없다.** PR #19 이후 감사에서 나온 「스칼라로 읽어 전량 NULL」 유형은
팩 테이블에서 재현되지 않았다.

### 3.3 `text_color` 61건 — 재검 결과 원본 결손이 맞다

```
raw.raw_object (entity='packs', src_path ~ 'limbus-data-mj/packs.json'):
  jsonb_typeof(payload->'textColor') = 'string' → 56
  jsonb_typeof(payload->'textColor') = 'null'   → 61
  값이 빈 문자열이 아닌 것                       → 56
canonical.pack.text_color IS NOT NULL            → 56  (유일값 28종)
canonical.field_gap (entity='pack', field='textColor') → 61행
build/gap-report.md 32행 · 317행                  → 61
```

원본 키 자체는 117개 객체 전부에 있으나 **값이 JSON null 인 것이 61개**다. ETL 손실이
아니다. 61 = 117 − 56 이고, 56 은 `shared-library/md_theme_packs.json` 의 객체 수(실측 56)와
같다. 결손 대장·`field_gap`·실측이 모두 61로 일치한다. **재검 통과.**

### 3.4 `unlock_code` 2건 — 원본 결손이 맞고, 구조도 확인했다

```
raw packs_detail.json  payload->'unlock' :
  jsonb_typeof = 'object' → 116   (그중 'unlockCode' 키를 가진 것 115)
  jsonb_typeof = 'null'   → 1     (id=1122)
canonical.pack.unlock_code IS NULL → 2  (id = 1122, 3001)
canonical.field_source (field='unlockCode') → 115
```

`unlock` 은 **스칼라가 아니라 객체**(`{"unlockCode": 101}`)인데 canonical 이 정수 한 개로
접었다. 실측한 결과 이 객체는 `unlockCode` 키 하나만 갖는다(키 집계 결과 `unlockCode` 115가
유일). **따라서 접기로 잃은 값은 없다.** 결손 2건은 1122(`unlock` 이 JSON null) ·
3001(`unlock` 이 객체지만 `unlockCode` 키 없음)이며 원본 결손이다.

### 3.5 원본에 있는데 canonical 에 아무 자리도 없는 필드 (실측)

`raw.raw_object` 의 팩 페이로드 키를 전수로 뽑아 대조했다.

| 원본 필드 | 출처 | 객체 수 | canonical | 비고 |
| --- | --- | ---: | --- | --- |
| `mapGen` (bossPool·eventPool·battlePool·abBattlePool·hardBattlePool·hardAbBattlePool) | mj `packs_detail.json` | **117** | **없음** | `backlog/09` §0 · `gap-report` 631행이 의도적 보류로 기록. 전투 풀 id 가 어느 표에도 없다 |
| `mapGenSequence` (array) | mj `packs_detail.json` | **117** | **없음** | `field_gap` 기록 **없음** |
| `exceptions` (array, 비어 있지 않은 것 116) | mj `packs_detail.json` | **117** | **없음** | `dungeonIdx`·`selectableFloors` 구조. `field_gap` 기록 **없음** |
| `eventPool` (array) | assets `md_theme_packs.json` | **19** | **없음** | 971xxx 선택이벤트 id. `field_gap` 기록 **없음** |
| `specialName` | loc-ko/en/ja | **각 1** (id=1119) | **없음** | 색 마크업 포함 이름. `field_gap` 기록 **없음** |

`canonical.field_source` 는 팩에 대해 16필드만 기록한다(bokgak · category · categoryPath ·
chapter · extreme · floorLength · name.en/ja/ko · overlaySprite · sprite · superposition ·
tags · textColor · unlockCode · variant). 위 5종은 **field_source 에도 field_gap 에도 없다** —
즉 "안 담았다"는 사실이 어디에도 기록돼 있지 않다(`mapGen` 만 문서에 있다).

### 3.6 `mapGen.bossPool` — 42개 팩의 보스 공백과 관계

```
raw packs_detail  jsonb_array_length(mapGen->'bossPool') > 0 → 117 / 117
canonical.pack_boss_encounter 가 있는 팩                      →  75 / 117
canonical.encounter 중 id 가 숫자인 것                        →   0 / 251
```

「관측」: mj 는 117개 팩 전부에 보스 풀을 준다(예: 1001 → `[2060122]`). assets 는 75개 팩에
`bossEncounters`(예: `["md|canto-1-1"]`)를 준다. **두 id 공간이 겹치지 않는다** — canonical
인카운터 id 는 전부 문자열 키다. 따라서 나머지 42개 팩의 보스 정보를 mj 에서 끌어오려면
숫자↔문자열 대응표가 필요한데 `gap-report` 631행이 그 표가 리포에 없다고 적고 있다.
어느 쪽이 틀렸다고 판정하지 않는다.

---

## 4. 참조 무결성

### 4.1 고아 FK — **전부 0건**

| 검사 | 결과 |
| --- | ---: |
| `pack_text.pack_id` → `pack` | 0 |
| `pack_tag.pack_id` → `pack` | 0 |
| `pack_category_path.pack_id` → `pack` | 0 |
| `pack_boss_encounter.pack_id` → `pack` | 0 |
| `pack_boss_encounter.encounter_id` → `encounter` | 0 |
| `floor_pack.pack_id` → `pack` | 0 |
| `gift_pack.pack_id` → `pack` / `gift_id` → `gift` | 0 / 0 |
| `gift_exclusive_pack.pack_id` → `pack` / `gift_id` → `gift` | 0 / 0 |

### 4.2 빈 자식

| 검사 | canonical | public | 판정 |
| --- | ---: | ---: | --- |
| 태그 0개인 팩 | **0** | (테이블 없음) | 정상 |
| 카테고리 경로 0개인 팩 | **0** | (테이블 없음) | 정상 |
| `gift_pack` 0개인 팩 | **0** | **0** | 정상 |
| `floor_pack` 0개인 팩 | **1** (id=1122) | **1** (id=1122) | 양쪽 동일. 화면이 「일반 층 순환에 등장하지 않는다」로 명시 처리 |
| 전용 기프트 0개인 팩 | 46 | 46 | 정상(전용이 없는 팩이 있다) |
| 보스 인카운터 0개인 팩 | 42 | 42 | §3.6 관측 참조 |

`app/[locale]/packs/[id]/page.tsx` 주석은 층 없는 팩이 「21종」이라고 적었으나 실측은 **1종**
(1122)이다. 렌더된 `/ko/packs` 에서도 「일반 층 순환에 등장하지 않음」 문구가 **1회**만 나온다.
주석이 낡았다(두 스키마 모두 동일하므로 데이터 문제가 아니다).

### 4.3 분포 (canonical 실측)

- 팩당 기프트: 최소 18 · 중앙 73 · 최대 188 (`packs.ts` 주석의 「median 73 · 최대 188」과 일치)
- 팩당 전용 기프트: 최소 1 · 최대 17 (보유 팩 71종)
- 팩당 태그: 1–2
- `floor_length`: 2→10 · 3→3 · 4→75 · 5→29
- `floor_pack`: hard 213행/116팩(구간 1,2,3,4,5,6-10,11-15) · normal 75행/51팩(구간 1–5만)

---

## 5. 엔진 요구 재검증

### 5.1 코드에서 뽑은 팩 측 입력 (`lib/engine/load.ts`·`pack.ts`·`score.ts`)

| 입력 | 쓰는 곳 | canonical 대응 | 상태 |
| --- | --- | --- | --- |
| `pack.id` | `PackCandidate.id` | `canonical.pack.id` | 있음 |
| `pack_text.name`(locale) | `PackCandidate.name` · 근거 문장 | `canonical.pack_text` (ko/en/ja) | 있음. ja 추가 |
| `pack.category` | `availabilityOf(category, extreme)` | `canonical.pack.category` **enum** | 있음. `'extreme'`·`'walpurgis'` 라벨 존재 확인 |
| `pack.extreme` | 같음 | `canonical.pack.extreme` | 있음 |
| `gift_pack.giftId` | `PackCandidate.gifts` | `canonical.gift_pack.gift_id` **text** | 있음. **타입이 int→text** |
| `gift_exclusive_pack.giftId` | `PackCandidate.exclusiveIds: Set<number>` | `canonical.gift_exclusive_pack.gift_id` **text** | 있음. **타입이 int→text** |
| `floor_pack.difficulty`·`floorRange`·`packId` | `packIdsForFloor()` | `canonical.floor_pack` 3열 동일 | 있음. 값 완전 일치 |
| `gift.tier`·`keywordId`·텍스트 | `loadGifts` | `canonical.gift` 등 | 기프트 담당 영역 |
| `gift_token`(kind=effect/trigger, index) | `mapEffect`·`mapTrigger` | `canonical.gift_effect`·`gift_trigger` | **아래 5.3** |

`score.ts` 는 팩 테이블을 직접 읽지 않는다 — `Gift.effects` 만 본다. 따라서 팩 점수의 실제
민감점은 `gift_pack` 연결과 기프트 효과 토큰이다.

### 5.2 등장성 판정을 실측으로 재현

`availabilityOf` 는 하드코딩 규칙이다. canonical 로 재현하면:

```
category='extreme' AND extreme=false  →  3001  (1건, 'hidden')
category='walpurgis'                  →  1107,1114,1119,1124  (4건, 'limited')
```

`canonical.pack_tag` 가 같은 판정을 **데이터로** 준다:

```
tag='Hidden'          →  3001                     (1건)
tag='Walpurgisnacht'  →  1107,1114,1119,1124      (4건)
```

**두 방식의 결과 집합이 정확히 같다.** 즉 `availabilityOf` 의 하드코딩을 `pack_tag` 조회로
바꿔도 현행과 동일한 답이 나온다. 이것이 신규 스키마가 새로 가능하게 하는 것 중 하나다.

「관측」: `extreme=true` 인데 `category<>'extreme'` 인 팩이 4건 있다(1110·1111·1112·1118,
전부 `category='railway'`). 현행 규칙은 이들을 `standard` 로 둔다. 규칙 자체는 바뀌지 않는다.

### 5.3 엔진이 쓰는 효과 토큰 — canonical 에서 1건 사라진다 (버그)

```
public.gift_token   kind='effect'  → 1,123
public.gift_token   kind='trigger' → 1,081
canonical.gift_effect              → 1,122   ← 1건 적다
canonical.gift_trigger             → 1,081
```

차이가 나는 기프트를 특정했다.

```
public.gift_token (giftId=9429, kind='effect'), index 순:
  0  Gain Speed / Haste
  1  Gain Offense Level Up
  2  Gain Buff
  3  Gain Speed / Haste      ← 중복 토큰

canonical.gift_effect (gift_id='9429'):
  Gain Buff / Gain Offense Level Up / Gain Speed / Haste     (3행)
```

`canonical.gift_effect` 의 컬럼은 `(gift_id, effect_id)` 둘뿐이라 **같은 토큰이 두 번 나오면
합쳐진다.** `score.ts` 의 `scoreState` 는 효과를 하나씩 더하므로 9429 의 `own` 값이
현행 대비 낮아지고, `ceiling(gift)` 도 낮아진다. 9429 는 **팩 1015 에 속한다**(실측) —
그 팩의 `immediate`·`futureOption` 점수가 두 스키마에서 달라진다.

`gift_trigger` 는 (gift_id, trigger_id) 중복이 0건이라 같은 문제가 없다.
또한 두 테이블 모두 `index` 컬럼이 없어 **원본 토큰 순서가 보존되지 않는다.** 현행 엔진은
모든 트리거를 AND 로 묶으므로 순서에 의존하지 않지만, 앞으로 효과↔발동 짝짓기를 하려면
순서가 필요하다(`load.ts` 주석이 후속 슬라이스로 적어 둔 작업).

이것은 기프트 도메인의 테이블이지만 **팩 점수화의 직접 입력**이라 여기 적는다.

### 5.4 `packIdsForFloor` 재검

`floor_pack` 이 두 스키마에서 완전히 같으므로 후보 집합은 동일하다. 실측 구간:

- `normal`: `1`,`2`,`3`,`4`,`5` 만 존재 → floor 6 이상을 넣으면 후보 0개
- `hard`: `1`,`2`,`3`,`4`,`5`,`6-10`,`11-15`

`floorRange.split('-')` 파싱은 위 7개 값 전부에서 성립한다.

---

## 6. 신규에만 있는 것

| 신규 구조 | 실측 | 무엇을 가능하게 하는가 |
| --- | ---: | --- |
| `pack_tag` | 184행 · 유일 47종 | ① 등장성(`Hidden`/`Walpurgisnacht`)을 하드코딩 대신 데이터로 판정 — §5.2 에서 현행과 동일 결과 확인. ② `Bleed`·`Burn`·`Sinking` 등 상태 키워드 태그 14종이 있어 **덱 축과 팩을 직접 맞출 수 있다**(현행은 `category='keyword'` 14종이라는 사실만 알고 어느 축인지 모른다). ③ `Collab`(1122) 로 콜라보 팩 식별 |
| `pack_category_path` | 202행 (depth0 117 · depth1 85) | 2단 분류. depth0 은 `Canto` 27 · `Affinity` 21 · `Extreme` 20 · `Intervallo` 17 · `Keyword` 14 · `Attack Type` 6 · `Refraction Railway` 6 · `Walpurgisnacht` 4 · `Collab` 1 · `Hidden` 1. depth1 은 `I`~`IX` 같은 장 번호. **현행 `pack.category` 8종보다 세분화돼 있고**(`event` 18종이 `Intervallo`/`Walpurgisnacht`/`Collab` 등으로 갈린다) 목록 필터를 2단 드릴다운으로 만들 수 있다. 원본 `assets.category` 배열과 불일치 0/117 |
| `pack.overlay_sprite` | 41건 | **현행 화면의 그림 누락을 고친다** — §7.1 |
| `pack.text_color` | 56건 · 유일 28색 | 팩 카드 이름 띠 색. `backlog/05`(팩 카드 렌더 검증)가 필요로 하는 값 |
| `pack.unlock_code` | 115건 · 유일 26종 | 해금 조건. 「이 팩을 아직 못 여는 계정」 표시가 가능해진다 |
| `pack.bokgak` | true 6건 (1113·1116·1120·1123·1125·1127, 전부 `category='event'`) | 복각 인터발로 식별 |
| `pack_text` ja | +117행 | 일본어 화면 |
| `pack.category`·`variant` enum | — | 오타 유입 차단. 현행은 자유 text |

---

## 7. 결손과 영향

### 7.1 `overlay_sprite` — 신규가 채우는 현행의 실제 버그 (근거 있음)

현행 상세 화면은 보스 층 그림을 **`` `${sprite}_boss` `` 로 지어서** 찾는다
(`lib/assets.ts:113` `packBossIcon`). 실측:

```
data/assets/packs/**  중 '_boss' 파일             →  40개
117개 팩 sprite 에 '_boss' 를 붙여 파일이 있는 것 →  34개
canonical.pack.overlay_sprite IS NOT NULL         →  41건 (유일값 40)
overlay_sprite 값 중 파일이 없는 것               →  0건
overlay_sprite <> sprite||'_boss' 인 것           →  7건
```

34 + 7 = 41 이다. **즉 현행 규칙은 41건 중 34건만 맞히고 7건을 놓친다.**

| 팩 | `sprite` | 현행이 찾는 키 | 파일 | `overlay_sprite` | 파일 |
| --- | --- | --- | --- | --- | --- |
| 1201 | `AttackType_normal` | `AttackType_normal_boss` | 없음 | `AttackTypeSlash_hard_boss` | 있음 |
| 1202 | `AttackType_effective` | `AttackType_effective_boss` | 없음 | `AttackTypeSlash_effective_boss` | 있음 |
| 1203 | `AttackType_normal` | 〃 | 없음 | `AttackTypePierce_hard_boss` | 있음 |
| 1204 | `AttackType_effective` | 〃 | 없음 | `AttackTypePierce_effective_boss` | 있음 |
| 1205 | `AttackType_normal` | 〃 | 없음 | `AttackTypeBlunt_hard_boss` | 있음 |
| 1206 | `AttackType_effective` | 〃 | 없음 | `AttackTypeBlunt_effective_boss` | 있음 |
| 1302 | `Crimson_hard` | `Crimson_hard_boss` | 없음 | `Crimson_normal_boss` | 있음 |

렌더로 확인했다 — `/ko/packs/1201` 과 `/ko/packs/1302` 는 그림이 **1장만** 나오고
「보스 층」 figure 가 없다. 같은 계열 `/ko/packs/1301` 은 2장 나온다.
`canonical.pack.overlay_sprite` 를 읽으면 7건 전부 해결된다.

곁들여 관측: `sprite` 가 중복인 팩이 6종 있다 — `AttackType_normal`(1201·1203·1205) ·
`AttackType_effective`(1202·1204·1206). **현행 목록·상세에서 이 6종은 서로 구분되지 않는
동일한 그림을 보여준다.** `overlay_sprite` 는 이들을 Slash/Pierce/Blunt 로 구분한다.

### 7.2 `text_color` 61건 (`field_gap` · `gap-report` 32·317행)

- 원본 결손이며 ETL 손실이 아니다(§3.3).
- **현행 화면·엔진에는 영향이 0이다** — `public.pack` 에 컬럼 자체가 없어 아무도 읽지 않는다.
- 영향은 **앞으로 생긴다.** `docs/backlog/05-pack-art-verification.md` 가 기록한 팩 카드 렌더
  (이름 띠 색)에서 61종은 색을 지정할 수 없다. 기본색으로 떨어뜨리든 안 쓰든 선택이 필요하다.
- 결손 61종은 전부 1201 이후 id(attack_type·sin·keyword·extreme 계열)이고, 값이 있는 56종은
  `limbus-assets`/`shared-library` 가 커버하는 범위와 같다.

### 7.3 `unlock_code` 2건 (`gap-report` 42·609행)

- 1122(Collab 팩, 원본 `unlock` 이 null) · 3001(Hidden 팩, `unlockCode` 키 없음).
- 현행 화면·엔진 영향 0(컬럼 없음). 해금 표시를 붙이면 이 2종만 「해금 조건 미상」이 된다.
- 두 팩 다 특수 팩(콜라보·히든)이라 **원본에 해금 코드가 없는 것이 자연스러운 상태**로 보인다.

### 7.4 `mapGen`·`mapGenSequence`·`exceptions`·`eventPool`·`specialName` 미적재

- 화면·엔진 어느 쪽도 지금 이 값을 쓰지 않으므로 **깨지는 것은 없다.**
- 앞으로 막히는 것: ① 팩별 층 구성(`mapGenSequence`·`exceptions`)을 보여주려면 재적재 필요.
  ② 팩별 선택이벤트 풀(`eventPool` 19건 + `mapGen.eventPool` 117건)이 없어
  `canonical.choice_event`(159) · `choice_event_gift`(219) 를 **팩에 붙일 수 없다** —
  「이 팩에서 나오는 이벤트」 화면을 만들 수 없다. ③ 1119 의 색 마크업 이름(`specialName`).
- `mapGen` 만 `backlog/09` §0 과 `gap-report` 631행에 보류 근거가 적혀 있고,
  나머지 4종은 **`field_source`·`field_gap` 어디에도 기록이 없다.**

### 7.5 팩 도메인에서 「전량 NULL」 유형 재발 여부

PR #19 이후 감사가 잡은 3건과 같은 유형(원본이 객체/배열인데 스칼라로 읽어 전량 NULL)을
팩 테이블 전 컬럼에서 찾았다. **재발 0건.** 다만 같은 뿌리의 변종 2건을 찾았다.

1. `unlock` 은 실제로 **객체**인데 정수로 접었다 — 이번엔 객체가 키 1개뿐이라 손실이 없었다
   (§3.4). 원본이 키를 늘리면 조용히 잃는다.
2. `gift_effect` 가 **중복 원소를 가진 배열**을 집합으로 접었다 — 1건 실제 손실(§5.3).

---

## 8. 사용자 확인 필요 항목

1. **팩 1201–1206 의 보스 층 카드가 게임에서 실제로 무엇인가.**
   `overlay_sprite` 가 1201→`AttackTypeSlash_hard_boss`, 1203→`AttackTypePierce_hard_boss`,
   1205→`AttackTypeBlunt_hard_boss` 라고 말한다. 그런데 세 팩의 `sprite` 는 모두
   `AttackType_normal` 로 같다. **확인처**: 거울 던전 하드, 층 선택 화면에서 참격/관통/타격
   테마 팩 카드 3종을 나란히 볼 것. **갈리는 지점**: 일반 층 카드가 세 팩 모두 같은 그림인가
   (그렇다면 `sprite` 중복이 원본대로), 아니면 각각 다른가(그렇다면 `sprite` 쪽이 부정확하고
   `overlay_sprite` 가 옳은 그림이다). 예상: 보스 층에서는 세 팩이 서로 다른 카드를 쓴다.

2. **팩 1302 의 보스 층 카드.**
   `sprite='Crimson_hard'` 인데 `overlay_sprite='Crimson_normal_boss'` 로 1301(`Crimson_normal`)
   과 **같은 파일**을 가리킨다. 41건 중 값이 겹치는 유일한 쌍이다.
   **확인처**: 붉은 시선(진홍) 계열 팩의 하드 보스 층 카드. **갈리는 지점**: 1301 과 1302 의
   보스 층 카드가 같은 그림이면 원본이 맞고, 다르면 원본 `overlayImage` 가 틀렸거나
   `Crimson_hard_boss` 애셋을 우리가 안 받은 것이다.

3. **`extreme=true` 인데 `category='railway'` 인 4종(1110·1111·1112·1118)의 등장성.**
   현행 `availabilityOf` 는 이들을 `standard` 로 둔다. `pack_tag` 는 이들에게
   `Refraction Railway` 태그만 주고 `Extreme` 태그는 주지 않는다(Extreme 태그는 1501–1520 의
   20종). **확인처**: 거울 던전 일반 순환에서 굴절 철도 계열 팩이 후보로 뜨는지.
   **갈리는 지점**: 뜨지 않으면 `hidden`/`limited` 로 빼야 하고, 뜨면 현행 판정이 맞다.

4. **`bokgak=true` 6종(1113·1116·1120·1123·1125·1127)이 「복각」이 맞는가.**
   전부 `category='event'` 이고 짝이 되는 원본 인터발로 팩(1104↔1116, 1105↔1120, 1106↔1123,
   1115↔1125, 1117↔1127)이 `eventPool` 을 공유한다(실측: 1116 의 eventPool 이 1104 의
   eventPool 을 포함). **확인처**: 게임 내 인터발로 목록에서 이 6종이 복각 표기인지.
   **갈리는 지점**: 아니라면 `bokgak` 의 의미를 다시 정의해야 한다.

5. **`text_color` 61건 결손 시 팩 카드 이름 색을 무엇으로 할 것인가.**
   데이터 문제가 아니라 제품 결정이다. 결손 61종은 attack_type·sin·keyword·extreme 계열이다.

6. **팩 1122(콜라보)의 층 배정이 정말 없는가.**
   두 스키마 모두 `floor_pack` 0행이고 화면이 「일반 층 순환에 등장하지 않는다」로 처리한다.
   **확인처**: 이 팩이 상시 순환에 뜨는지, 콜라보 기간 전용인지.
   **갈리는 지점**: 상시라면 층 배정 원본이 결손이다.

---

## 부록 — 이 문서의 수치를 낸 주요 질의

```sql
-- 2.1 관계 테이블 완전 대조 (양방향 EXCEPT)
SELECT count(*) FROM (SELECT "giftId"::text,"packId" FROM public.gift_pack
                      EXCEPT SELECT gift_id,pack_id FROM canonical.gift_pack) x;

-- 3.1 pack 전 컬럼 NULL 계수
SELECT count(*) FILTER (WHERE text_color IS NULL) FROM canonical.pack;

-- 3.3 원본 textColor 타입 분포
SELECT jsonb_typeof(payload->'textColor'), count(*) FROM raw.raw_object
 WHERE entity='packs' AND src_path LIKE '%limbus-data-mj/packs.json' GROUP BY 1;

-- 3.5 원본 키 전수
SELECT source, src_path, jsonb_object_keys(payload), count(*) FROM raw.raw_object
 WHERE entity='packs' GROUP BY 1,2,3;

-- 5.3 효과 토큰 개수 차
SELECT * FROM (SELECT "giftId"::text g,count(*) c FROM public.gift_token
               WHERE kind='effect' GROUP BY 1) p
 FULL JOIN (SELECT gift_id g,count(*) c FROM canonical.gift_effect GROUP BY 1) c USING (g)
 WHERE p.c IS DISTINCT FROM c.c;

-- 7.1 sprite||'_boss' 해상도 (셸)
--   ls data/assets/packs/*/ | sed 's/\.webp$//' | sort -u > /tmp/pfiles.txt
--   각 sprite 에 대해 grep -qxF "${s}_boss" /tmp/pfiles.txt
```
