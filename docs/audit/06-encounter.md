# 인카운터와 적 (encounter · enemy)

> 감사 시점 2026-08-02 · 대상 PR #20 (재적재 아님, 소비자 관점 계측)
> 모든 수치는 `docker compose exec postgres psql` 실측 또는 `data/entities/` 원본 JSON 직접 계수다.

---

## 1. 현행 public 의 상태 (읽는 곳이 있나)

### 1.1 테이블과 행 수

| 테이블 | 컬럼 | 행 수 |
| --- | --- | --- |
| `public.encounter` | 1 (`id`) | 82 |
| `public.encounter_target` | 3 (`encounterId`, `index`, `count`) | 124 |
| `public.encounter_target_text` | 4 (`encounterId`, `index`, `locale`, `name`) | 248 |
| `public.pack_boss_encounter` | 2 | 75 |
| `public.enemy` | — | **테이블 없음** |

`encounter_target_text` 248 = `ko` 124 + `en` 124.
`encounter_target.count` 채움 44/124 (80건 NULL).

### 1.2 읽는 곳이 있다 — 「적재만 되고 아무도 안 읽는다」가 아니다

`lib/queries/packs.ts` `getPack()` 이 `pack → bosses → encounter → targets → texts` 를
Prisma include 로 읽고, `app/[locale]/packs/[id]/page.tsx:159` 가 「보스전 등장 적」
섹션으로 그린다.

`lib/queries/packs.ts:158-163`

```ts
bosses: pack.bosses.map((b) => ({
  encounterId: b.encounterId,
  targets: b.encounter.targets.map((t) => ({
    index: t.index,
    count: t.count,          // 원본에 없으면 null 로 둔다
    text: nameOf(t.texts, locale),
  })),
})),
```

「층별 등장 팩」 화면(`/ko/dungeon`)과 `lib/queries/reference.ts` 는 인카운터를
전혀 참조하지 않는다(grep 0건).

### 1.3 화면에서 실제로 보이는 것 (실측)

`curl http://localhost:3000/ko/packs/1201` → 「보스전 등장 적 0 · 보스전 없음」.
1201 은 보스 인카운터가 없는 42개 팩 중 하나다.

팩 117개의 화면 결과는 셋으로 갈린다.

```
31개   적 이름이 실제로 나온다 (targets 117행)
44개   보스 인카운터는 붙었으나 targets 0 → 빈 목록(kind="absent")
42개   보스 인카운터 자체가 없음 → 「보스전 없음」
```

**관측** — 현행 화면이 인카운터로 답을 주는 팩은 117개 중 31개(26.5%)다.

---

## 2. canonical 적재 현황

### 2.1 행 수 (전부 계획치와 일치)

| 테이블 | 컬럼 수 | 행 수 |
| --- | --- | --- |
| `canonical.encounter` | 7 | 251 |
| `canonical.encounter_target` | 3 | 398 |
| `canonical.encounter_target_part` | 9 | 354 |
| `canonical.encounter_part_resist` | 5 | 3,540 |
| `canonical.pack_boss_encounter` | 2 | 75 |
| `canonical.enemy` | **1** (`id` 뿐) | 1,342 |
| `canonical.enemy_text` | 4 | 4,026 |

### 2.2 `encounter` — 네 가지 모양이 배타적이다

원본 `encounters/limbus-assets/*.json` 251파일의 최상위 키 조합을 전수 계수했다.

```
targets  152    waves  59    battles  27    phases  13      (교집합 0 · 합 251)
```

DB 채움률이 정확히 그것을 따른다.

```
group 251/251 · waves 59 · phases 13 · battles 27 · JSON null 로 들어간 행 0
```

`group` 분포와 모양 교차표(실측):

| group | targets | waves | battles | phases | 계 |
| --- | --- | --- | --- | --- | --- |
| story | 75 | 24 | 8 | 6 | 113 |
| md | 35 | 29 | 16 | 2 | 82 |
| luxcavation | 42 | 6 | — | 2 | 50 |
| rr | — | — | 3 | — | 3 |
| reflectrial | — | — | — | 3 | 3 |

`site_id` 는 251개 중 250개가 고유하고 1개 UUID(`a268e619-…`)만 2회 쓰인다.

### 2.3 `encounter_target_part` 채움률

```
name 354 · hp_base 354 · hp_level 131 · def_correction 354 · speed_min 354 · speed_max 354
```

`hp_level` 131/354 는 **버그가 아니다.** 원본 `part.hp` 의 타입을 세면
`dict{base,level}` 131 · `float` 205 · `int` 18 이고, ETL 이
`hpBase = num(hp,'base') ?? hpFlat` / `hpLevel = num(hp,'level')` 로 처리한다.
숫자 하나뿐인 223건은 level 이 원본에 없다. 채움률과 원본 타입 분포가 정확히 맞는다.

### 2.4 `enemy_text` 채움률

```
locale 별로 각 1,342행 (ko/en/ja) · name 1,342 · part 1,233 (109건 NULL) · 빈 name 0
```

---

## 3. 연결 사슬 추적

### 3.1 단계별 숫자

```
pack 117
  └─ pack_boss_encounter        75 팩 (42 끊김)      고아 0 / 양방향 FK 정상
      └─ encounter              75/75 해석됨          고아 0
          ├─ encounter_target   31/75 인카운터만 붙음 (44 끊김)
          │   └─ target_part     285/398 타깃만 붙음 (113 끊김)
          │       └─ part_resist 354/354 부위 전부 (10축 완전)
          └─ enemy              **FK 없음 · 컬럼 없음 — 사슬이 존재하지 않는다**
                └─ enemy_text   1,342 → 4,026 (완전)
```

인카운터 전체 기준으로도 같은 계측을 했다.

```
encounter 251 → target 이 붙은 것 152 (99 끊김)
             → part 가 붙은 것    123
             → resist 가 붙은 것  123
```

### 3.2 끊긴 지점 판정 — 「원본에 없어서」인가 「변환이 놓쳐서」인가

#### (a) pack 117 → boss 75 : **원본에 없어서**

`data/entities/packs/limbus-assets/md_theme_packs.json` 을 직접 셌다.

```
117개 팩 중 bossEncounters 키를 가진 팩 75개 · 참조 총 75건
```

`shared-library/md_theme_packs.json`(56팩)에는 `bossEncounters` 가 0건이다.
ETL 도 미해석 0건을 기록한다(`field_gap` 에 `pack/bossEncounters` 행 없음).
**변환은 원본 75건을 100% 옮겼다.**

#### (b) encounter 251 → target 152 : **변환이 놓쳐서** ← 이 감사 최대 발견

`src/v2/canonical/encounters.ts:79` 는 최상위 `arr(e, 'targets')` 만 순회한다.
`waves` · `phases` · `battles` 는 **JSONB 원문으로만 남기고 안을 열지 않는다.**

그런데 원본에서 그 안에도 동일 구조의 `targets` 가 들어 있다. 재귀 계수 결과:

```
최상위 targets            398   → 관계형에 적재됨
waves/phases/battles 안   986   → JSONB 안에만 있음 · 관계형 0행
─────────────────────────────
원본 targets 총계        1,384   관계형 적재율 28.8%
```

```
중첩 targets 986건의 내역
  distinct name          329  (그중 328이 enemy_text.en 이름과 일치)
  distinct portrait      388
  중첩 parts             963  (encounter_target_part 에 0행)
```

**관측** — 행 수 검사(`encounter_target = 398`)는 통과한다. 원본이 398이 아니라
1,384이기 때문에 「기대값 자체가 최상위만 센 값」이다. PR #19 에서 나온 버그 3건과
같은 계열(원본 형태를 확인하지 않고 얕게 읽음)이되, 이번에는 컬럼이 NULL 이 되는
대신 **행이 애초에 만들어지지 않았다.**

보스 인카운터 75개를 모양별로 쪼개면 영향이 그대로 드러난다.

| 보스 인카운터 모양 | 팩 수 |
| --- | --- |
| `targets` (적재됨) | **31** |
| `waves` (JSONB) | 26 |
| `battles` (JSONB) | 16 |
| `phases` (JSONB) | 2 |

**보스전 적을 못 보는 44개 팩은 전부 이 누락 때문이다.** 데이터는 원본에 있다.

#### (c) target 398 → part 285 : **원본에 없어서 (다만 저항은 변환이 놓쳤다)**

최상위 타깃 398건의 필드 빈도(원본 전수):

```
name 398 · portrait 398 · skills 387 · passives 358 · parts 285 · num 152 · resists 111
```

`parts` 가 없는 113건 중 111건은 **타깃 레벨에 `resists` 를 직접 갖는다.**
ETL 은 저항을 `part['resists']` 에서만 읽으므로 이 111건 × 10축 = **1,110개 저항값이
어느 테이블에도 들어가지 않았다.** 부위가 없는 것은 원본 사실이지만, 저항이
사라진 것은 변환 쪽이다.

#### (d) encounter_target → enemy : **연결 자체가 만들어지지 않았다** ← 두 번째 큰 발견

`canonical.enemy` 를 참조하는 FK 는 `enemy_text.enemy_id` 하나뿐이다(실측
`pg_constraint`). `encounter_target` 은 `(encounter_id, index, name)` 3컬럼이고
**적을 가리키는 id 컬럼이 없다.**

원본에는 있다. 최상위 타깃 398건 **전부** `portrait` 를 갖는다.

```json
{"name": "Rigid Casino Security", "portrait": "90020", "resists": {…}, "skills": […]}
```

`portrait` 를 `canonical.enemy.id` 와 대조했다.

```
최상위 portrait  distinct 226 → enemy 에 있는 것 219 (7건 미해석: 1277 1278 1279 1307 1336 1460 91016)
전체 portrait    distinct 458 → enemy 에 있는 것 375
타깃 단위        398건 중 390건이 enemy 로 해석된다
```

`portrait` 가 빠졌으므로 지금 적을 잇는 유일한 방법은 **영문 이름 문자열 조인**이다.
그 품질을 쟀다.

```
398 타깃 중  이름이 고유하게 1개 적으로 해석  185 (46.5%)
             이름이 2개 이상 적에 걸림        212 (53.3%)   최대 후보 12개
             일치하는 적 없음                  1 (story__9-5-24 #3, 빈 문자열 — gap-report 기록됨)

이름 중복 실태: enemy_text.en 1,342행 → distinct name 635 · 중복 이름 220종
```

게다가 `portrait` 로 찾은 적의 영문명과 타깃의 `name` 이 **37건 불일치**한다.
(390건 중 353 일치 / 37 불일치)

**관측** — 이름 조인은 절반 이상이 다의적이고, 다의적이지 않은 곳에서도 37건은
`portrait` 와 다른 답을 준다. 현행 `public` 파이프라인은 같은 이름 조인
방식(`src/entities/egos.ts:305` 「영문명을 열쇠로」)을 쓰며 주석에
「실측 498/498 이 이어진다」고 적혀 있으나, 그것은 **연결이 되었다**는 뜻이지
**옳은 적에 연결되었다**는 뜻이 아니다.

결과적으로 `enemy` 1,342종 중 어떤 인카운터에서도 이름으로 도달되지 않는 것이
**942종(70.2%)** 이다.

### 3.3 public 과 canonical 대조 (md 82개 인카운터 한정)

```
인카운터 id 집합      public 82 · canonical md 82 · 차집합 양방향 0
타깃 행 수            public 124 · canonical 124 · 인카운터별 불일치 0건
```

**md 범위에서는 두 DB 가 정확히 같다.** canonical 은 story/luxcavation/rr/reflectrial
169개를 추가로 담아 상위집합이다. 다만 아래 두 가지를 **잃었다.**

| 잃은 것 | public | canonical |
| --- | --- | --- |
| 등장 수 (`num` → `count`) | 있음, 44/124 채움 (원본 152/398) | **컬럼 없음** |
| 적 이름 다국어 | `encounter_target_text` ko 124 · en 124 | `name` 단일 컬럼, **영문 전용** |

canonical.encounter_target 398행 중 한글이 든 것 **0건**(정규식 `[가-힣]` 실측).
반면 `enemy_text` 에는 ko 1,342행이 이미 들어 있다 — **한국어를 갖고 있으면서
타깃에 붙이지 못하는 상태**다. `portrait` 만 있으면 붙는다.

대조 예(public ko ↔ canonical name):

```
md|canto-1-1 #0   기억속 어긋난 패잔병   /  Recollected Awry Soldier
md|canto-1-1 #3   옛 G사 부장            /  Old G Corp. Head Manager
```

---

## 4. 전투 풀 2,525종 결손 재검

### 4.1 2,525 는 지금도 맞는 수다

`data/entities/packs/limbus-data-mj/packs_detail.json` 117팩을 전수 계수했다.

| 풀 | 고유 id | 등장 횟수 | 키를 가진 팩 |
| --- | --- | --- | --- |
| `bossPool` | 204 | 205 | 117 |
| `battlePool` | 1,425 | 1,445 | 117 |
| `abBattlePool` | 397 | 402 | 117 |
| `hardBattlePool` | 382 | 387 | 117 |
| `hardAbBattlePool` | 117 | 119 | 113 |
| `eventPool` | 77 | 1,969 | 117 |

```
전투 4풀 합집합              2,321
전투 4풀 ∪ bossPool          2,525   ← 마스터북 수치와 정확히 일치
```

(`specialEventPool` · `specialEventProb` 가 25팩에 추가로 있다. 마스터북 언급
5개 풀 외 항목이며 전투 풀은 아니다.)

### 4.2 canonical 이 해석할 수 있는 것 — 0개

```
canonical.encounter.id  형식: 슬러그 (luxcavation__18-pierce, md__canto-1-1)
                        숫자 id 인 행: 0 / 251
전투 풀 id              형식: 7자리 정수 (2060101)
                        canonical 어디에도 대응 없음 → 해석 0 / 2,525 (0.0%)
```

### 4.3 「원본에 없어서」로 확정

```
grep -rl "2060101" data/     →  data/entities/packs/limbus-data-mj/packs_detail.json  1건뿐
raw.raw_object payload LIKE '%2060101%'  →  1행 (그 파일 자체)
```

전투 풀 id 는 **참조하는 파일 한 곳에만 존재하고 정의가 어느 출처에도 없다.**
변환 실패가 아니라 원본 결손이다. `docs/backlog/10-encounter-linkage.md` 의 판정
(「data/ 전역에 연결표가 없다」)이 그대로 유효하다.

DB 에 기록도 되어 있다 — `canonical.field_gap` 에 `encounter/battlePool` 1행,
`build/gap-report.md:629`.

### 4.4 추가 관측 — 보스도 두 체계가 갈린다

```
mj    bossPool           고유 204종 (117팩 전부가 가짐)
assets bossEncounters     75건 (75팩만 가짐)  →  pack_boss_encounter 75행
```

같은 「보스」를 가리키는 표기가 둘인데 개수가 204 대 75로 맞지 않고, 잇는 표가 없다.
**팩 117개 전부에 보스 풀이 있는데 우리는 75개만 안다** — mj 쪽을 쓸 수 있으면
42개 팩의 보스가 채워질 여지가 있다. (백로그 10 은 전투 풀만 다루고 이 보스
불일치는 다루지 않는다.)

---

## 5. 적 저항 데이터

### 5.1 적재된 것 — 완전하되 좁다

```
encounter_part_resist   3,540행  =  354 부위 × 10축 (예외 0)
덮는 범위               인카운터 123 / 251 · 타깃 285 / 398 · 부위 354 / 354
축 10종                 slash pierce blunt / wrath lust sloth gluttony gloom pride envy
                        각 축 정확히 354행
```

`src/v2/verify-canonical.ts:546` 이 「10축이 아닌 부위 0」을 검사하고 통과한다.

### 5.2 값 분포 (3,540건 전수)

| 값 | 건수 | | 값 | 건수 |
| --- | --- | --- | --- | --- |
| 0.1 | 12 | | 1.1 | 9 |
| 0.2 | 2 | | 1.2 | 240 |
| 0.5 | 371 | | 1.25 | 104 |
| 0.6 | 2 | | 1.5 | 228 |
| 0.7 | 16 | | 1.75 | 3 |
| 0.75 | **698** | | 1.8 | 2 |
| 0.8 | 136 | | 2 | 223 |
| 0.9 | 10 | | **1** | **1,484** |

축별 최소·최대: 물리 3축은 0.1–2, 죄악 7축은 0.5–2 (wrath 만 0.2–2).

### 5.3 적재되지 않은 저항 — 원본의 76%

원본 251파일에서 저항값을 전수 계수했다.

```
적재됨   최상위 타깃의 부위 저항                 3,540
누락     최상위 타깃 레벨 저항 (부위 없는 111건)  1,110   ← 변환이 놓침
누락     waves/phases/battles 안 타깃 레벨 저항   1,790   ← 변환이 놓침
누락     waves/phases/battles 안 부위 저항        8,410   ← 변환이 놓침
─────────────────────────────────────────────────────
원본 총계                                       14,850
적재율                                            23.8%
```

### 5.4 `docs/09-resistance.md` 와 대조

해당 문서는 **인카운터 저항을 다루지 않는다.**
`인카운터` · `조우` · `10축` · `부위` 로 grep 해 0건이다. 문서가 정의하는 것은 둘뿐이다.

| 문서가 정의한 축 | 테이블 | 축 수 |
| --- | --- | --- |
| 공격 타입 저항 (인격) | `identity_resist` | 3 |
| 죄악 저항 (E.G.O) | `ego_resist` | 7 |

적 저항 10축(물리 3 + 죄악 7, **부위마다 따로**)의 정의는
`src/v2/canonical/encounters.ts:1-12` 주석과 마스터북 인카운터 편에만 있고
`docs/09-resistance.md` 에 반영되지 않았다.

문서와 **어긋나는 관측이 하나 있다.** 문서 §2 는 값 체계를 `2 / 1 / 0.5` 3단으로,
§3 은 인격이 「취약 하나 · 보통 하나 · 내성 하나」 고정이라고 적는다.
인카운터 저항은 값이 **16종**(0.1 – 2)이고 부위마다 10축 전부에 값이 있어
같은 규칙을 따르지 않는다. 배수 해석(값이 클수록 많이 맞는다)이 인카운터에도
그대로 적용되는지는 문서에 근거가 없다 → §8 로 넘긴다.

---

## 6. 채움률 이상

### 6.1 버그로 볼 수 있는 것 (근거 있음)

| # | 대상 | 관측 | 근거 |
| --- | --- | --- | --- |
| B1 | `encounter_target` | 원본 targets 1,384 중 398(28.8%)만 적재. 986건이 JSONB 안에 갇힘 | `src/v2/canonical/encounters.ts:79` 가 최상위 `targets` 만 순회 · 원본 재귀 계수 |
| B2 | `encounter_target` | 적을 가리키는 컬럼 없음. 원본 `portrait` 398/398 존재, 390건이 `enemy.id` 로 해석되는데 버려짐 | 원본 필드 빈도 · portrait↔enemy 대조 |
| B3 | `encounter_part_resist` | 부위 없는 타깃 111건의 타깃 레벨 저항 1,110값 미적재 | ETL 이 `part['resists']` 만 읽음 |
| B4 | `canonical.enemy` | 1컬럼 테이블 · 인바운드 FK 0 · 이름 조인으로 도달 안 되는 적 942/1,342(70.2%) | `pg_constraint` 실측 |
| B5 | `encounter_target` | 다국어 상실. public 은 ko 124 + en 124 를 가졌으나 canonical 은 영문 단일. 한글 포함 행 0/398 | 두 DB 대조 |
| B6 | `encounter_target` | `num`(등장 수) 상실. 원본 152/398 보유, public 은 `count` 로 담음 | 원본 필드 빈도 |

B5·B6 은 **canonical 이 public 보다 후퇴한 지점**이다. 화면을 canonical 로 옮기면
지금 나오는 한국어 적 이름이 영어로 바뀐다.

### 6.2 이상이 아닌 것 (확인 완료)

| 대상 | 관측 | 판정 |
| --- | --- | --- |
| `encounter.waves/phases/battles` 각 59/13/27 | 네 모양이 배타적 | 원본 그대로. JSON null 0건 |
| `encounter_target_part.hp_level` 131/354 | 원본 hp 타입 dict 131 / 숫자 223 | 원본 그대로 |
| `enemy_text.part` 1,233/1,342 | 109건 NULL | 원본 `desc` 없음 |
| `encounter_part_resist` 3,540 | 354 × 10 정확 | 완전 |
| `encounter_target.name` 빈 문자열 1건 | `story__9-5-24 #3` | gap-report 기록됨 · 의도적 보존 |
| 이름 속 `[...]` 12건 | `BongBong [Orange]` 등 | 마크업 아님, 실제 이름 |

### 6.3 부수 관측

- **`enemy_text.part` 의 의미가 주석과 다르다.** ETL 주석은 「`desc` 가 부위 이름이다」
  라고 적지만 en 1,342행의 값 분포는 대부분 종류 라벨이다.
  ```
  Core 465 · Part 437 · Enemy Unit 175 · (NULL) 109 · Unit 68 · Enemy Boss 10 · Boss 4
  실제 부위명으로 보이는 것: BongBong [Orange] Body 9 · KoD Sword Part 4 · …
  ```
  1,342건 중 1,145건(85%)이 「Core/Part/Unit/Enemy Unit/Boss」 류의 분류어다.
- **ja 로케일 2건에 마크업이 남아 있다.** `閃光現象 - イム・ギョンオ<size=75%>プ</size>`
  (enemy 1450, 1451). public 경로는 `stripMarkup` 을 거쳤다. ko/en 은 0건.
- **`field_source` 가 이 계열을 거의 덮지 않는다.** `encounter/core` 251 ·
  `enemy/name` 1,342 만 있고 `encounter_target` · `encounter_target_part` ·
  `encounter_part_resist` · `pack_boss_encounter` 는 출처 기록이 0행이다.
- **검증이 행 수뿐이다.** `src/v2/verify-canonical.ts:537-544` 는 6개 테이블을 모두
  `eq(count, 고정수)` 로만 본다. 값 검사는 「저항 10축」과 「JSON null 0」 둘뿐이다.
  B1–B6 은 전부 이 검사를 통과한다.

---

## 7. 트래커가 할 수 있는 것과 못 하는 것

### 7.1 「이 팩을 고르면 무엇과 싸우나」

| 질문 | 답할 수 있는 팩 | 근거 |
| --- | --- | --- |
| 보스전에서 무엇과 싸우나 (이름) | **31 / 117 (26.5%)** | boss 75 중 targets 모양 31 · 타깃 117행 |
| 보스의 저항을 아는가 | **25 / 117 (21.4%)** | `pack_boss_encounter ⋈ encounter_part_resist` |
| 보스의 부위·HP·속도를 아는가 | 25 / 117 | 위와 같은 집합 |
| 일반 전투에서 무엇과 싸우나 | **0 / 117 (0%)** | 전투 풀 2,525종 정의 부재 |
| 하드 전투 / 변형(ab) 전투 | 0 / 117 | 위와 같음 |
| 이벤트 노드에서 무엇이 나오나 | 0 / 117 | `eventPool` 77종도 미적재 |

### 7.2 지금 못 하지만 **원본이 있어서 고칠 수 있는 것**

```
waves/phases/battles 안 targets 986건을 풀면
   → 보스전 적 이름을 아는 팩  31 → 최대 75 (+44)
   → 저항을 아는 팩            25 → 최대 75 근처
   → 저항값                  3,540 → 최대 14,850
portrait 를 담으면
   → encounter_target ↔ enemy 가 확정 조인이 된다 (390/398)
   → enemy_text 의 ko/ja 이름이 붙어 다국어가 복구된다
```

이 둘은 **재적재 없이 ETL 수정만으로 가능**하다(원본 `data/entities/` 에 다 있다).

### 7.3 원본이 없어서 못 하는 것

- **일반·하드 전투 풀 2,525종** — 어떤 출처에도 정의가 없다. §4.3 확정.
- **팩별 보스 204종 중 129종** — mj `bossPool` 과 assets `bossEncounters` 를 잇는 표가 없다.
- 편성 추천에 적 저항을 반영하는 기능은 보스 25팩에만 근거를 댈 수 있다.

### 7.4 화면 이관 판단

canonical 로 화면을 옮기면 **인카운터 범위는 넓어지지 않고(md 82개 동일) 한국어와
등장 수를 잃는다**(B5·B6). B1·B2 를 먼저 고치지 않으면 이관 이득이 없다.

---

## 8. 사용자 확인 필요 항목

1. **`portrait` 가 적 id 가 맞는가.**
   `encounters/limbus-assets/*.json` 의 `targets[].portrait` 와
   `encounters/loc-*/Enemies*.json` 의 `id` 를 동일 번호 공간으로 보았다.
   398건 중 390건이 해석되지만 **이름이 37건 불일치**한다.
   확인 방법 — 거울 던전 1테마(`md__canto-1-1`) 보스전에 들어가 등장 적 4종의
   이름이 `기억속 어긋난 패잔병 / 기억속 절망하는 패잔병 / 기억속 침식된 패잔병 /
   옛 G사 부장` 인지 보고, `portrait` 값(원본 파일 참조)으로 찾은 이름과 갈리는지 본다.
   해석 실패 7건(`1277 1278 1279 1307 1336 1460 91016`)이 무엇인지도 갈린다.

2. **`waves` · `phases` · `battles` 가 무엇인가.**
   각각 「웨이브가 나뉜 전투」 「보스 페이즈 전환」 「연속 전투」로 보이나 확정하지 못했다.
   셋을 한 테이블에 펼치면 「같은 적이 여러 번 세어지는」 문제가 생길 수 있다.
   확인 방법 — `waves` 모양인 팩(예: 1002 → `md__canto-1-2`)과 `battles` 모양인 팩의
   보스전을 실제로 치러 전투가 몇 번 끊기는지, 같은 적이 다시 나오는지 본다.

3. **인카운터 저항값의 해석.**
   `docs/09-resistance.md` 는 `2 / 1 / 0.5` 3단 배수를 정의하는데 인카운터 저항은
   0.1 · 0.2 · 0.6 · 0.75 · 1.25 · 1.75 등 16종이다. 같은 곱셈 배수인지,
   부위별 값이 인격 저항과 곱해지는지 문서에 근거가 없다.
   확인 방법 — 저항 0.1 인 부위(12건)를 실제로 때려 피해가 1/10로 줄어드는지 본다.

4. **mj `bossPool` 204 와 assets `bossEncounters` 75 의 관계.**
   전자는 117팩 전부에, 후자는 75팩에만 있다. 같은 보스의 두 표기인지, 아니면
   전자가 「보스 노드 후보」이고 후자가 「대표 보스」인지 갈린다.
   확인 방법 — 같은 테마 팩으로 거울 던전을 두세 번 돌아 보스가 매번 같은지 다른지 본다.
   매번 다르면 mj 쪽이 후보 목록이고, 우리가 아는 75건은 대표 하나뿐이다.

5. **`enemy_text.part` 의 정체.**
   `Core` 465 · `Part` 437 · `Enemy Unit` 175 처럼 분류어가 대부분이다.
   부위 이름인지 적의 종류 구분인지 확인이 필요하다.
   확인 방법 — 부위가 여럿인 보스(예: 「기억속…」 계열)의 전투 화면에서 부위 이름이
   실제로 어떻게 표시되는지 본다.

6. **`encounter_target` 중복 행의 의미.**
   `md__walpu-8` 은 `BongBong [Orange]` 를 index 0·1·2 로 세 번 갖는다.
   원본 `num` 과 중복 행 중 어느 쪽이 등장 수를 뜻하는지 갈린다(둘 다 있는 경우가 있다).
   확인 방법 — 해당 전투에서 봉봉이 몇 마리 나오는지 센다.
