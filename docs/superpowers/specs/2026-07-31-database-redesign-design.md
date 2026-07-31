# 데이터베이스 재설계 — 3스키마 구조

> 작성 2026-07-31 · 근거 `docs/data/` 마스터북 51회차 · 스냅샷 2026-07-25
> 대체 대상 현행 단일 스키마 58모델 (`prisma/schema.prisma`)

## 0. 목적

두 가지 서비스를 하나의 데이터 기반 위에 세운다.

```
데이터 아카이브        림버스 컴퍼니에서 추출된 데이터를 모두 취합해 보관·조회
거울 던전 트래커        추천 시스템 기반. 사용자의 런을 기록하고 다음 수를 제안
```

**데이터가 근간이다.** 기존 API·화면 설계를 참조하지 않는다. 스키마가 확정된 뒤
API·화면이 여기 맞춘다.

### 기존 데이터베이스와 병존한다

이 작업은 **현행 58모델 스키마를 고치지 않는다.** 새 데이터베이스를 따로 세운다.
현행 파이프라인·API·화면은 그대로 돌아간다. 호환을 맞추려 설계를 굽히지 않는다.

```
현행    prisma/schema.prisma  58모델   → 지금 서비스가 쓴다. 손대지 않는다
신규    3스키마 구조                   → 이 스펙. 독립 구축
```

전환은 신규 DB 가 완성된 뒤 별도 작업으로 판단한다.

### 이 데이터베이스에서 파생될 것

```
정보 제공        아카이브 조회·검색           canonical 을 직접 읽는다
추천 엔진 재설계  메카닉·트리거 기반 그래프     canonical 에서 Neo4j 로 투영
```

추천 엔진과 Neo4j 는 이 스펙의 범위가 아니다. 다만 **canonical 이 그래프 투영의
원천이 되어야 하므로** §6 의 조건을 지킨다.

### 이 설계가 답하는 질문

마스터북 최종 검토가 「하나의 repo 에 모든 데이터가 온전히 담겨있나」에 **아니다**로
답했다(`docs/data/00-final-review.md`). 단독 보유 개념 90개가 세 출처에 흩어져 있고
셋을 합쳐도 결손 7건이 남는다.

이 설계는 그 결론을 전제로 한다 — **합집합으로 세우고, 결손 7건을 알고 시작한다.**

---

## 1. 층 구조

```
    림버스 추출 repo 4종                        JSON 1,664파일 · 35.5 MB
    limbus-data-mj · limbus-assets · loc-ko/en/ja · shared-library
                 │
                 │  E — 수집 (현행 fetch.ts 유지)
                 ▼
┌────────────────────────────────────────────────────────────────┐
│  schema raw          판정하지 않는다. 버리지 않는다              │
│    snapshot · snapshot_source · raw_object · raw_blob           │
│    45,868행 / 스냅샷 · 스냅샷은 덮어쓰지 않고 쌓는다              │
└────────────────────────────────────────────────────────────────┘
                 │
                 │  T — 판정 (마스터북 90개 개념)
                 ▼
┌────────────────────────────────────────────────────────────────┐
│  schema canonical    모순 해소된 하나의 답. 최종 적재            │
│    엔티티 7계열 · *_text(ko/en/ja)                              │
│    field_gap · field_source · tool_annotation                   │
└────────────────────────────────────────────────────────────────┘
                 │
                 │  L — app 은 건드리지 않는다
                 ▼
┌────────────────────────────────────────────────────────────────┐
│  schema app          재생성 대상이 아니다                       │
│    field_override · run · run_floor · run_gift · account        │
└────────────────────────────────────────────────────────────────┘

    ( schema service — 파생 뷰. 화면 요구가 정해진 뒤. 이번 범위 밖 )
```

### 층마다 답하는 질문

| 층 | 질문 | 성격 |
| --- | --- | --- |
| `raw` | **원본이 뭐라고 했나?** | JSONB. 타입 없음. 출처별 모순 공존 |
| `canonical` | **그래서 정답이 뭔가?** | 평범한 RDB. 컬럼·FK·인덱스 |
| `app` | 사용자가 뭘 했나 | 평범한 RDB. 재생성 안 됨 |

### 재적재가 닿는 범위가 스키마로 갈린다

```
npm run load  →  TRUNCATE raw.*, canonical.*  후 재적재
                 app.*  은 손대지 않는다
```

한 스키마에 섞이면 `TRUNCATE` 사고 한 번에 사용자 데이터가 날아간다. 스키마 경계가
곧 안전장치다.

---

## 2. `schema raw` — 원본층

### 2.1 왜 원본을 DB 에 두나

현행은 원본이 `data/` 디렉토리 JSON 파일로만 존재하고, Project Moon IP 준수를 위해
`.gitignore` 로 저장소에서 제외된다(`docs/01-data-source.md` §7). 「우리 DB」라고
부를 것이 없다.

DB 에 두면 셋을 얻는다.

**① 판정이 뒤집혀도 재조사가 SQL 한 줄**

마스터북 51회차 동안 판정이 다섯 번 뒤집혔다 — `corrosion.section` 방향 오독 ·
`attributeType`↔`affinity` 4건 · `AlwaysUseEGOPassive` 토큰 · `extractable` ·
`Pack` 모델 존재 여부. 앞으로도 뒤집힌다.

```sql
SELECT id FROM raw.raw_object
WHERE src_path = 'gifts/limbus-assets/gifts.json'
  AND payload->>'hardonly' = 'true';
```

지금은 이걸 하려면 일회용 프로브를 매번 새로 짜야 한다. 마스터북 51회차 내내
그렇게 했다.

**② 「모두 취합」이 말 그대로 된다**

`limbus-assets/gifts.json` 은 키가 22종인데 현행 변환기는 일부만 읽고 나머지를
버린다. 원본층이 있으면 버릴지 말지를 나중에 정할 수 있다.

**③ 스냅샷 비교로 업데이트 대응**

마스터북의 두 목적 중 하나가 「업데이트 대응을 위한 분석 자료」였다. 이것이 그 자동화다.

```sql
SELECT src_path, id FROM raw.raw_object a
JOIN raw.raw_object b USING (source, src_path, id)
WHERE a.snapshot_id = '2026-07-25' AND b.snapshot_id = '2026-09-01'
  AND a.payload IS DISTINCT FROM b.payload;
```

### 2.2 개체 1행

파일 단위가 아니라 **개체 단위**로 담는다. 출처 간 대조가 JOIN 한 줄이 되기 때문이다.

```
파일 1,664개  →  개체 45,868행
```

id 확보 경로는 셋이며, 실측상 거의 다 확보된다.

```
{dataList: [...]} 안의 id      774파일     loc 계열 전부
dict[id → obj] 의 키            34         assets 계열
list[obj] 안의 id                4         mj 거대 파일
파일명이 곧 id                 814         identity-details · ego-details · encounters
───────────────────────────────────────
id 없는 설정형 blob              13         md__details.json 등 → raw_blob 으로
```

### 2.3 모델

```prisma
model Snapshot {
  id          String   @id              // "2026-07-25"
  version     Int      @unique          // 단조 증가. 1, 2, 3 …
  createdAt   DateTime                  // 수집 시각 (timestamptz)
  gameAnchor  String?                   // "차원찢개 이상 인격 출시 시점"
  note        String?
  sources     SnapshotSource[]
  objects     RawObject[]
  blobs       RawBlob[]
  @@schema("raw")
}

model SnapshotSource {
  snapshotId  String
  sourceId    String                    // limbus-data-mj · limbus-assets · loc-ko …
  repo        String                    // github.com/monthofjune/limbus_data
  branch      String
  commit      String                    // 97c385678e3bc…
  fileCount   Int
  status      String                    // current · removed
  snapshot    Snapshot @relation(fields: [snapshotId], references: [id], onDelete: Cascade)
  @@id([snapshotId, sourceId])
  @@schema("raw")
}

model RawObject {
  snapshotId  String
  source      String                    // 어느 repo 에서 왔나
  srcPath     String                    // 원래 파일 경로. 키의 일부다 — 아래 주석
  id          String                    // payload → 파일명 → 순서 순으로 확보
  entity      String                    // gifts · identities · mirror-dungeon … (조회 라벨)
  payload     Json                      // 손대지 않은 원본 객체
  snapshot    Snapshot @relation(fields: [snapshotId], references: [id], onDelete: Cascade)
  @@id([snapshotId, source, srcPath, id])
  @@index([entity, id])                 // 출처 대조 조인용
  @@index([snapshotId, source])
  @@schema("raw")
}
```

> **`srcPath` 가 기본키에 들어가는 이유** — `(source, entity, id)` 만으로는 유일하지
> 않다. 실측 **충돌 8,530건**이다.
>
> ```
> loc-ja · mirror-dungeon · ADDITIONAL_FLOOR_THEME_SLOT
>   DungeonStartBuffs.json · DungeonStartBuffs_MD6.json · DungeonStartBuffs_MD7.json
> ```
>
> 같은 출처·같은 계열 안에서 **파일이 다르면 다른 개체**다(시즌별 판본·강화판 등).
> `entity` 는 키가 아니라 조회 라벨로만 쓴다.
>
> 따라서 **출처 대조 조인은 `(entity, id)` 만으로 하면 안 된다.** 어느 파일끼리
> 맞대볼지 `srcPath` 로 좁혀야 한다.
>
> ```sql
> SELECT a.id FROM raw.raw_object a
> JOIN raw.raw_object b USING (snapshot_id, entity, id)
> WHERE a.src_path = 'gifts/limbus-data-mj/gifts.json'
>   AND b.src_path = 'gifts/limbus-assets/gifts.json'
>   AND (a.payload->>'hardOnly')::bool IS DISTINCT FROM (b.payload->>'hardonly')::bool;
> ```

/// id 를 뽑을 수 없는 설정형 파일 13개. 파일 통째로 한 행.
model RawBlob {
  snapshotId  String
  source      String
  srcPath     String
  payload     Json
  snapshot    Snapshot @relation(fields: [snapshotId], references: [id], onDelete: Cascade)
  @@id([snapshotId, source, srcPath])
  @@schema("raw")
}
```

**스냅샷 메타는 `data/manifest.json` 에 이미 있다.** `generatedAt` · `gameStateAnchor` ·
`sources[]`(repo·branch·commit·fileCount·status)를 그대로 옮긴다. 「버전」이 우리 것인지
게임 것인지 갈리지 않도록 `version`(우리 일련)과 `gameAnchor`(게임 시점)를 **둘 다** 담는다.

### 2.4 스냅샷은 쌓는다

덮어쓰지 않는다. 스냅샷당 35.5 MB 라 비용이 없고, 아카이브 목적에 맞는다.
과거 스냅샷 비교가 업데이트 대응의 핵심 도구다.

---

## 3. `schema canonical` — 정본층

**이 층이 최종 적재다.** 화면도 엔진도 여기를 읽는다. 완전히 평범한 관계형 모델이다.

### 3.1 원본 전 필드를 컬럼으로

```
한 엔티티의 키 합집합 (loc 제외)
  인격     mj 23 + detail 16 + assets 17  →  45키
  기프트    mj 15 + detail  4 + assets 22  →  37키
  E.G.O   mj 12 + detail  8 + assets 12  →  28키
  팩       mj 16 + detail  5 + assets  8  →  26키
```

전부 컬럼으로 받는다. raw 를 들여다보지 않아도 canonical 만으로 답이 나오게 한다.

```prisma
model Gift {
  id             Int      @id
  // ── mj 계열 ───────────────────────────────
  sin            Sin?
  tier           Int?
  cost           Int?
  keywordId      String?                 // null 은 "없음" 아니라 "범용"(EgoGiftCategory)
  hardOnly       Boolean                 // mj ∪ assets = 122 (게임 5건 확인)
  requiresSlots  Int[]
  // ── assets 계열 ───────────────────────────
  enhanceable    Boolean
  affinity       Sin?                    // mj sin 과 4건 다름 → sin 이 정본
  // ── 관계 ─────────────────────────────────
  texts          GiftText[]              // ko · en · ja
  stages         GiftStage[]             // 강화 1–3단계 전량 전개
  effects        GiftEffect[]
  triggers       GiftTrigger[]
  packs          GiftPack[]
  exclusivePacks GiftExclusivePack[]
  recipes        FusionRecipe[]
  @@schema("canonical")
}
```

**대가**는 컬럼 수와 마이그레이션이다. 새 필드가 생기면 스키마를 고쳐야 한다.
아카이브 성격에서는 이게 오히려 장점이다 — 스키마가 원본의 현실을 문서화한다.

### 3.2 도구 오염 필드는 격리한다

`limbus-assets` 는 게임 데이터와 자기 웹도구용 데이터를 같은 트리에 둔다
(마스터북 §5 「도구 오염」). 전 필드를 담되 **테이블을 나눈다.**

```prisma
/// limbus-assets 가 자기 도구를 위해 붙인 필드. 게임 사실이 아니다.
/// 예외: extractable 은 게임과 값이 일치함을 게임 확인으로 밝혔다(마스터북 기프트 편).
model ToolAnnotation {
  source   String                        // limbus-assets
  entity   String
  entityId String
  field    String                        // notes · tips · search_desc · srcPath · 추천묶음
  value    Json
  @@id([source, entity, entityId, field])
  @@index([entity, entityId])
  @@schema("canonical")
}
```

게임 데이터 테이블을 열었을 때 게임 사실만 보인다. 도구 필드는 버려지지 않고 옆에 있다.

### 3.3 단계는 전량 전개 + 변경 플래그

원본은 출처마다 규칙이 다르다 — **mj 는 델타, assets 는 전량**(마스터북 E.G.O 편
27건 차이). canonical 은 전량으로 통일한다.

```
mj skills.json  1,045 스킬
  델타 행 합계   2,561      값이 바뀐 단계만 기록
  전량 전개 시   5,225      1,045 × 5
```

```prisma
model SkillStage {
  skillId     Int
  uptie       Int                        // 1–5 전부 채운다
  changedHere Boolean                    // 원본 델타가 이 단계에 있었나
  coins       SkillCoin[]
  texts       SkillStageText[]
  @@id([skillId, uptie])
  @@schema("canonical")
}
```

```
1010101  uptie 3   Inflict 3 [Sinking]   changedHere true
1010101  uptie 4   Inflict 3 [Sinking]   changedHere false   ← 복사본임을 안다
1010101  uptie 5   Inflict 3 [Sinking]   changedHere false
```

`changedHere` 가 델타 정보를 보존하므로 원본 충실성을 잃지 않으면서 조회는
`WHERE uptie = 3` 한 줄로 끝난다.

기프트도 같다 — `GiftStage(giftId, level, changedHere)`. 실측 분포는
1단계 346 · 2단계 3 · 3단계 107 이다.

### 3.4 결손 대장

세 출처 어디에도 없는 것. **값은 NULL 로 두고 사유를 별도 테이블에 남긴다.**

```prisma
model FieldGap {
  entity    String
  entityId  String
  field     String
  locale    Locale?                      // 한국어만 없는 경우
  reason    String                       // "loc-ko 에 EGOgift.json 자체가 없음"
  evidence  String                       // "docs/data/gift/07-loc-egogift-common.md"
  @@id([entity, entityId, field, locale])
  @@index([entity, field])
  @@schema("canonical")
}
```

적재가 끝나면 이 표를 **문서로 뽑아 전달한다** — `build/gap-report.md`.
그 문서가 곧 수동 보정 작업 지시서다.

마스터북이 특정한 결손 7건이 초기 내용이다.

| # | 결손 | 규모 |
| ---: | --- | ---: |
| 1 | 거울 던전 전투 풀 정의 | 2,525종 |
| 2 | 한국어 상태 이름 | 245종 (16.6 %) |
| 3 | E.G.O 획득 경로 필드 | 전량 |
| 4 | 상태 이름 `MRR5xx` | 6 |
| 5 | 기프트 한국어 | 6 |
| 6 | 선택지 이벤트 정의 | 2 |
| 7 | 적 초상 애셋 | 2 |

### 3.5 값의 출처를 남긴다

```prisma
model FieldSource {
  entity   String
  entityId String
  field    String
  rule     String       // union · mj-only · assets-only · loc-only · game-verified · manual
  sources  String[]     // ["limbus-data-mj", "limbus-assets"]
  @@id([entity, entityId, field])
  @@schema("canonical")
}
```

「이 값 왜 이렇지?」를 DB 안에서 답한다. 현행은 마스터북 문서를 사람이 찾아 읽어야 한다.

### 3.6 로케일 3종

현행은 `ko`·`en` 만 적재한다. **`ja` 를 추가해 3종 전부 담는다.**

- 「모두 취합」 원칙에 맞는다
- `ja` 가 한국어 결손 6건(기프트 `1017`·`1031`·`1035`·`1036`·`1045`·`1047`)을 전부
  갖고 있어 교차 확인에 쓰인다
- 로케일별 행 분리 방식(ADR-03)은 유지한다

### 3.7 테이블 목록

```
공통        sin_info · sin_text · keyword · keyword_text · dataset

인격        sinner · sinner_text
           identity · identity_text · identity_resist · identity_speed
           identity_status · identity_passive · identity_affiliation
           affiliation · affiliation_text
           skill · skill_stage · skill_coin · skill_stage_text · skill_coin_text
           passive · passive_requirement · passive_text

E.G.O      ego · ego_text · ego_cost · ego_resist · ego_status
           ego_skill · ego_skill_stage · ego_passive · ego_passive_text
           ego_abnormality                     ← abName 72종 (loc 단독)

기프트      gift · gift_text · gift_stage · gift_effect · gift_trigger
           gift_token · gift_pack · gift_exclusive_pack
           fusion_recipe · fusion_slot · fusion_slot_option
           gift_locked_desc · gift_category    ← 신규

팩          pack · pack_text · pack_tag · pack_unlock       ← tag·unlock 신규
           pack_boss_encounter · floor_pack

거울던전     mirror_dungeon · mirror_dungeon_text
           grace_option · grace_option_text
           choice_event · choice_option · choice_outcome · *_text   ← 신규
           achievement · achievement_text                          ← 신규
           reward · reward_item · adversity · adversity_text       ← 신규
           start_gift

상태        status · status_text · battle_keyword

인카운터     encounter · encounter_target · encounter_target_text
           enemy · enemy_text · enemy_resist                       ← 신규

메타        field_gap · field_source · tool_annotation
```

대략 60–70 테이블. 현행 58 대비 큰 폭증은 아니다.

### 3.8 id 충돌은 문제가 되지 않는다

마스터북이 찾은 번호 공간 충돌(`2010111` 이 스킬이자 패시브)은 **엔티티별 테이블로
나누면 자동 해소된다.** `raw_object` 도 `(snapshot, source, entity, id)` 복합키라
안전하다. 별도의 전역 네임스페이스를 도입하지 않는다.

---

## 4. `schema app` — 재생성 안 되는 층

### 4.1 수동 보정

```prisma
/// 사람이 게임에서 직접 확인해 채운 값. canonical 을 덮어쓴다.
/// 재적재가 이 테이블을 건드리지 않는다.
model FieldOverride {
  entity    String
  entityId  String
  field     String
  locale    Locale?
  value     Json
  note      String                       // "게임에서 직접 확인 2026-08-02"
  createdAt DateTime @default(now())
  @@id([entity, entityId, field, locale])
  @@schema("app")
}
```

적용 순서:

```
1. raw 재적재
2. canonical 재계산 (판정 규칙 적용)
3. app.field_override 를 canonical 위에 덮는다        ← 마지막
4. 덮인 것은 canonical.field_source.rule = 'manual' 로 기록
```

**ADR-02 의 「전체 재생성」 원칙을 깨지 않는다.** 재생성 대상에서 `app` 을 뺐을 뿐이다.

### 4.2 트래커

```prisma
model Run {
  id         String   @id
  accountId  String
  difficulty Difficulty
  startedAt  DateTime
  endedAt    DateTime?
  floors     RunFloor[]
  gifts      RunGift[]
  @@schema("app")
}

model RunFloor {
  runId  String
  floor  Int
  packId String
  pack   Pack @relation(fields: [packId], references: [id])   // canonical 로 FK
  @@id([runId, floor])
  @@schema("app")
}

model RunGift {
  runId  String
  giftId Int
  gift   Gift @relation(fields: [giftId], references: [id])   // canonical 로 FK
  @@id([runId, giftId])
  @@schema("app")
}
```

같은 DB 이므로 **FK 가 스키마를 가로질러 걸린다.** 트래커가 기프트 이름을 조인
한 번으로 읽는다.

---

## 5. 지금 버려지는 것을 담는다

마스터북이 「미적재」로 표시한 것을 전부 담는다.

### 5.1 대량 3종

| 대상 | 규모 | 출처 | 신규 테이블 |
| --- | ---: | --- | --- |
| 선택지 이벤트 | 159 | `md_choice_events.json` | `choice_event` · `choice_option` · `choice_outcome` · `*_text` |
| 업적 | 183 | `md__achievements` 2파일 · 9범주 | `achievement` · `achievement_text` |
| 층별 보상 | 200 | `md__rewards` 2파일 · 각 100단계 | `reward` · `reward_item` |
| 역경(adversity) | 5 | `md__details.adversity` | `adversity` · `adversity_text` |

업적 9범주 — `Collection` 25 · `Loadout` 19 · `Combat` 15 · `Adversity - EXTREME` 13 ·
`Hidden` 9 · `Shop` 7 · `Clears` 4 · `Completionist` 1 · `__Season__` 1 (한 파일 기준).

`md__details.json` 3키 중 `grace`(10)만 현행이 읽는다. `startGiftPool`(10)은
`start_gift` 로, `adversity`(5)는 신규 테이블로 담는다.

거울 던전 편 결산이 「`limbus-assets` 8파일 중 변환기가 읽는 것은 `grace` 하나뿐」이었다.
이제 8파일을 다 읽는다.

> **주의** — `md__achievements.json` 과 `md__md6__achievements.json` 은 범주 구성이
> 같다(9범주). 시즌별 판본으로 보이나 마스터북 거울 던전 편 회차 3이 두 파일을 합해
> 183건으로 셌다. 적재 시 시즌 구분 컬럼이 필요한지 T 착수 때 실측해 정한다.
> `md__rewards` 2파일도 같은 관계다.

### 5.2 편별로 늘어나는 것

```
팩        pack_tag(47) · overlaySprite · unlockCode(26) · bokgak · textColor   ← 백로그 09
기프트     gift_locked_desc(64 획득 문구) · gift_category(12 공식 사전)
인카운터   enemy(1,342 loc) · 부위별 저항 10축
상태      loc BattleKeywords 1,214 · Bufs 1,496 전량
E.G.O    abName(유래 환상체 72) · 연출 전용 개체
로케일     ja 전량
```

---

## 6. 그래프 파생을 위한 조건

추천 엔진을 메카닉·트리거 기반 그래프(Neo4j 등)로 재설계할 계획이다. canonical 이
그 원천이 되므로 **어휘를 문자열로 두지 않고 차원 테이블로 담는다.**

### 6.1 어휘는 이미 유한 집합이다

원본 실측 결과 자유 문장이 아니라 토큰화된 값이다.

```
기프트  triggers   150종   "Clash Win" · "Bleed Skill Used" · "Staggered Ally" · "Always"
       effects     55종   "Deal More Damage" · "Gain Skill Power" · "Inflict Debuff"
                          (451/456 이 배열. 5건은 null)

스킬 코인 효과 문자열 7,498개
       대괄호 토큰 215종   [OnSucceedAttack] 5,073 · [Vibration] 922 · [Laceration] 795
                          [Combustion] 767 · [Burst] 672 · [Sinking] 601 …
```

`lib/engine/vocab.ts` 의 `mapTrigger` 가 지금 이 문자열을 런타임에 파싱한다.
canonical 이 미리 풀어 담으면 그 파싱이 사라진다.

### 6.2 차원 테이블 + 연결 테이블

```prisma
model Trigger {                          // 150종
  id     String @id                      // 정규화 키
  raw    String                          // 원본 문자열
  gifts  GiftTrigger[]
  @@schema("canonical")
}

model Effect {                           // 55종
  id     String @id
  raw    String
  gifts  GiftEffect[]
  @@schema("canonical")
}

/// 코인 효과 문자열에서 뽑은 토큰. 215종.
/// 상태 토큰([Vibration] 등)은 status 로, 발동 시점 토큰([OnSucceedAttack])은 timing 으로 나뉜다.
model CoinToken {
  coinId    Int
  ordinal   Int                          // 문자열 안 등장 순서
  token     String                       // Vibration · OnSucceedAttack
  kind      String                       // status · timing · modifier
  amount    Int?                         // "Inflict 1 [Sinking]" 의 1
  @@id([coinId, ordinal])
  @@index([token])
  @@schema("canonical")
}
```

### 6.3 그러면 그래프 투영이 덤프 한 번이 된다

```
(Gift)      -[:TRIGGERS_ON]-> (Trigger)      gift_trigger 그대로
(Gift)      -[:PRODUCES]->    (Effect)       gift_effect 그대로
(Skill)     -[:INFLICTS]->    (Status)       coin_token where kind='status'
(Skill)     -[:TIMED_AT]->    (Timing)       coin_token where kind='timing'
(Identity)  -[:HAS_SKILL]->   (Skill)        identity_skill
(Pack)      -[:CONTAINS]->    (Gift)         gift_pack
```

재파싱도 재해석도 없다. **canonical 의 연결 테이블이 곧 간선이다.**

### 6.4 이 절이 요구하는 것

- 코인 효과 문자열을 **원문과 파싱 결과 둘 다** 담는다. 파싱이 틀려도 원문에서 다시 뽑는다
- `kind` 분류(status · timing · modifier)는 T 착수 때 215종을 실측해 확정한다
- 상태 토큰은 `canonical.status` 로 FK 를 건다. 못 잇는 토큰은 `field_gap` 에 남긴다

---

## 7. 검증

마스터북 §4.1 의 **완전 일치 쌍 7건**을 적재 후 검사로 옮긴다. 이것이 깨지면
곧 회귀 신호다.

| 관계 | 규모 |
| --- | ---: |
| 기프트 ↔ 팩 (`gifts`/`packs` · `uniqueGifts`/`uniquePacks`) | 441/441 |
| 층 ↔ 팩 (`md_floor_packs` ↔ `normalFloors`/`hardFloors`) | 218/218 |
| 팩 ↔ 인카운터 (`bossEncounters` ↔ `encounters.json`) | 75/75 |
| 기프트 색 (`attributeType` → `sin`) | 441/441 |
| E.G.O 스킬 (`awakeningSkill`+`corrosionSkill` ↔ `skills.json`) | 208 차집합 0 |
| E.G.O 패시브 (mj · assets · loc 3중) | 113 순서까지 |
| 시작 기프트 (`start_gifts` ↔ `startGiftPool`) | 10/10 |

그 밖에 인격 `iconId` ↔ 애셋 966/966, E.G.O 죄악 저항 mj ↔ assets 110/110,
기프트 `exclusive_gifts` 양방향 230/230.

**원본 결함 31건**(마스터북 §6)은 T 단계 정규화 규칙 + 리포트 항목으로 옮긴다.
가장 큰 것은 `undefined` 키 1,657건과 BOM 4파일이다.

---

## 8. ADR 처리

신규 DB 는 현행과 **병존**하므로 기존 ADR 01–05 를 고쳐 쓰면 두 시스템의 결정이
한 문서에서 뒤섞인다. **새 ADR 을 추가하고 기존은 현행 DB 의 기록으로 남긴다.**

```
ADR-06  3스키마 데이터베이스        신규. 이 스펙의 결정을 기록
        · raw / canonical / app 의 역할과 재생성 경계
        · 원본 전 필드 정규화 · 단계 전량 전개 · 로케일 3종
        · 수동 보정이 재생성을 이긴다
```

기존 ADR 과 달라지는 지점을 ADR-06 안에 명시한다.

| ADR | 현행 결정 | ADR-06 에서 |
| --- | --- | --- |
| **01** 데이터 저장 형식 | 「파일 하나 = 테이블 하나」 | `raw` 층 추가로 대체 |
| **02** 파이프라인 | 「전체를 재생성한다」 | 범위를 `raw`·`canonical` 로 한정. `app` 제외 |
| **03** 다국어 | ko · en | ko · en · ja |
| **04** 출처 권위 | 엔티티마다 정본 하나 | 유지. **팩은 mj** 로 정정 (백로그 09 §4) |

**단 하나 기존 문서를 직접 고친다** — ADR-04 의 「거울 던전 구성 = `limbus-assets`」
문장은 현행 DB 에도 틀린 서술이므로 정정한다(백로그 09 §4).

---

## 9. 기술 제약

### Prisma 다중 스키마

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
  schemas  = ["raw", "canonical", "app"]
}
```

모델마다 `@@schema("...")` 를 붙인다. enum 에도 붙여야 한다.

### 병존 방식 — 같은 데이터베이스, 다른 스키마

현행 스키마는 `public` 에 있다(`.env.example` 의 `?schema=public`). 신규는
`raw`·`canonical`·`app` 이므로 **같은 Postgres 데이터베이스 `limbus` 안에서 충돌 없이
공존한다.** 컨테이너도 접속 URL 도 새로 만들 필요가 없다.

```
DB limbus
  schema public                현행 58모델 — 손대지 않는다
  schema raw / canonical / app 신규
```

Prisma 스키마 파일과 생성 클라이언트는 분리한다.

```
prisma/schema.prisma          현행. 그대로
prisma/v2/schema.prisma       신규. generator output 을 따로 지정
```

`npm run schema:ddl` 이 현행 것을 덮어쓰지 않도록 신규용 스크립트를 따로 만든다.

**착수 전 확인** — 현행 Prisma 6.1.0 에서 `multiSchema` 가 `previewFeatures` 없이
동작하는지 검증하고, 필요하면 버전을 올린다. ADR-02 는 Prisma 를 DDL 생성기와
ORM 으로만 쓰고 마이그레이션 러너는 쓰지 않으므로, 스키마 생성 시 세 스키마가
모두 만들어지는지도 확인한다.

### 규모

```
raw         45,868행 / 스냅샷 · 35.5 MB       스냅샷 누적
canonical   대략 60–70 테이블
애셋 이미지   3,360개는 DB 에 넣지 않는다. 파일로 둔다
```

Postgres 에게 부담이 되는 규모가 아니다. 규모는 설계 제약이 아니다.

---

## 10. 범위 밖

- **현행 DB·파이프라인·API·화면** — 손대지 않는다. 병존한다. 전환 여부는 신규 DB 가
  완성된 뒤 별도로 판단한다.
- **`schema service`** — 조인 없이 읽히는 파생표. 화면 요구가 정해진 뒤에 만든다.
  `canonical` 만으로 서비스가 완전히 돌아가므로 속도 문제일 뿐이다.
- **추천 엔진 재설계와 Neo4j 구축** — 이 DB 에서 파생될 다음 작업이다. 이 스펙은
  §6 으로 **투영 가능한 형태를 보장**하는 데까지만 책임진다.
- **결손 7건의 데이터 자체를 메우는 일** — 수동 보정으로 처리한다. 파이프라인은
  결손을 정확히 특정해 `field_gap` 과 리포트로 전달하는 데까지 책임진다.

### 완료 기준

이 스펙은 **데이터베이스가 완벽하게 구축되면 끝난다.** 판정 기준은 셋이다.

```
1. 원본 1,664파일의 모든 개체가 raw 에 들어갔다        (누락 0)
2. 마스터북 90개 개념이 canonical 컬럼으로 옮겨졌다
3. 검증 7쌍이 전부 통과하고, 결손이 field_gap 에 특정됐다
```
