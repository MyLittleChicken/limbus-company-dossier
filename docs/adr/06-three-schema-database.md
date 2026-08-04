# ADR-06. 3스키마 데이터베이스 (Three-Schema Database)

> 결정 2026-07-31 · 구현 완료 2026-08-01
> 설계 [`docs/superpowers/specs/2026-07-31-database-redesign-design.md`](../superpowers/specs/2026-07-31-database-redesign-design.md)
> 계획 8건 [`docs/superpowers/plans/2026-07-31-*.md`](../superpowers/plans/)

## 1. 맥락

데이터 마스터북 51회차가 「하나의 repo 에 모든 데이터가 온전히 담겨있나」에
**아니다**로 답했다([`docs/data/00-final-review.md`](../data/00-final-review.md)).
단독 보유 개념 90개가 세 출처에 흩어져 있고, 셋을 합쳐도 결손 7건이 남는다.

현행 단일 스키마(`public` · 52모델)는 그 결론을 담을 그릇이 못 됐다.

```
원본이 DB 밖에 있다        판정이 뒤집히면 일회용 프로브를 매번 새로 짠다
전체 재생성이 무차별이다     수동 보정한 값이 다음 적재에 사라진다
버려지는 데이터가 많다       거울 던전 assets 8파일 중 읽는 건 grace 하나뿐
```

세 번째가 특히 컸다 — 선택지 이벤트 159 · 업적 183 · 층별 보상 200이 통째로
버려지고 있었다.

## 2. 결정

**데이터베이스를 세 스키마로 가른다.** 같은 PostgreSQL 데이터베이스(`limbus`)
안에 두어 외래 키가 스키마를 가로지를 수 있게 한다.

```
schema raw          출처가 준 그대로. 셋이 모순인 채로 공존
                    "원본이 뭐라고 했나?"
        ↓  판정 (마스터북 90개 개념)
schema canonical    모순 해소된 하나의 답. **최종 적재**
                    "그래서 정답이 뭔가?"
        ↓
schema app          재생성 대상이 아니다
                    수동 보정 · 트래커 런 기록
```

**재적재가 닿는 범위가 스키마로 갈린다.**

```
npm run v2:canonical  →  TRUNCATE canonical.*  후 재적재
                         raw · app 은 손대지 않는다
```

한 스키마에 섞이면 `TRUNCATE` 사고 한 번에 사용자 데이터가 날아간다.
**스키마 경계가 곧 안전장치다.**

### 2.1 현행 `public` 과 병존한다

현행 52모델은 손대지 않는다. 같은 데이터베이스 안에서 `public` 과
`raw`·`canonical`·`app` 이 충돌 없이 공존한다. 전환 여부는 별도로 판단한다.

```
prisma/schema.prisma      현행. 그대로
prisma/v2/schema.prisma   신규 97모델
```

## 3. 층별 결정

### 3.1 `raw` — 개체 1행으로 담는다

파일 단위가 아니라 개체 단위다. 출처 간 대조가 JOIN 한 줄이 되기 때문이다.

```
JSON 1,664파일  →  개체 43,270행 · 35.5 MB
```

**`srcPath` 가 기본키에 들어간다.** `(source, entity, id)` 만으로는 유일하지
않다 — 실측 충돌 8,530건이다. 같은 출처·같은 계열 안에서 파일이 다르면 다른
개체다(시즌별 판본 등).

**스캔한 파일 전량을 `raw_file` 에 기록한다.** 개체가 0개인 파일 16개는
`raw_object` 에 흔적을 못 남긴다. 그러면 두 사실이 사라진다 — 파일이 존재했다는
것, 그리고 `loc-en` 은 그중 5건에 대해 파일조차 안 만든다는 것.

**스냅샷은 덮어쓰지 않고 쌓는다.** 과거 스냅샷 비교가 업데이트 대응의 핵심
도구다. 스냅샷당 35.5 MB 라 비용이 없다.

### 3.2 `canonical` — 원본 전 필드를 컬럼으로

`raw` 가 무손실을 맡으므로 `canonical` 은 「우리가 쓸 형태」만 담아도 됐지만,
**전 필드를 컬럼으로 받기로 했다.** `raw` 를 들여다보지 않아도 답이 나오게 한다.

```
한 엔티티의 키 합집합   인격 45 · 기프트 37 · E.G.O 28 · 팩 26
```

대가는 컬럼 수와 마이그레이션이다. 아카이브 성격에서는 이게 장점이다 —
스키마가 원본의 현실을 문서화한다.

**도구 오염 필드는 격리한다.** `limbus-assets` 는 게임 데이터와 자기 웹도구용
데이터를 같은 트리에 둔다. 전 필드를 담되 `tool_annotation` 으로 테이블을
나눈다. 게임 데이터 테이블을 열었을 때 게임 사실만 보인다.

**단계는 전량 전개한다.** 원본이 출처마다 규칙이 다르다 — mj 는 델타,
assets 는 전량. `canonical` 은 전량으로 통일하고 `changedHere` 로 델타 정보를
보존한다. 조회가 `WHERE uptie = 3` 한 줄로 끝난다.

**로케일은 ko · en · ja 셋이다**(ADR-03 은 ko·en 이었다). `ja` 가 한국어 결손
6건을 전부 갖고 있어 교차 확인에 쓰인다.

**컬럼 이름은 snake_case 로 매핑한다.** 현행 `public` 은 Prisma 기본값
(camelCase)이지만, 이 층의 존재 이유가 손으로 쓰는 SQL 탐색이라 큰따옴표를
요구하면 안 된다. 스키마가 분리돼 있어 두 규약이 한 스키마 안에서 섞이지 않는다.

### 3.3 결손과 수동 보정

```
canonical.field_gap      세 출처 어디에도 없는 것. 값은 NULL 이고 사유가 남는다
canonical.field_source   이 값이 어디서 어떤 규칙으로 왔나
app.field_override       사람이 채운 값. canonical 을 이긴다
```

적용 순서가 중요하다.

```
1. raw 재적재
2. canonical 재계산 (판정 적용)
3. app.field_override 를 덮는다      ← 마지막
4. field_source.rule = 'manual' 로 기록 · field_gap 에서 해소
```

**ADR-02 의 「전체를 재생성한다」 원칙을 깨지 않는다.** 재생성 대상에서 `app` 을
뺐을 뿐이다.

`build/gap-report.md` 가 `field_gap` 을 작업 지시서로 낸다.

### 3.4 그래프 파생을 위한 조건

추천 엔진을 메카닉·트리거 기반 그래프(Neo4j)로 재설계할 계획이므로 **어휘를
문자열이 아니라 차원 테이블로 담는다.**

원본이 이미 유한 집합이다.

```
기프트 triggers 150종 · effects 55종
스킬 코인 효과 문자열 7,498개 → 대괄호 토큰 215종
  상태 189종 → canonical.status 로 FK
  발동 시점 26종
정확히 둘로 갈리고 남는 것이 없다
```

그러면 그래프 투영이 덤프 한 번이다.

```
(Skill)-[:INFLICTS {amount}]->(Status)   coin_token WHERE kind='status'
(Skill)-[:TIMED_AT]->(Timing)            coin_token WHERE kind='timing'
(Gift)-[:TRIGGERS_ON]->(Trigger)         gift_trigger
(Gift)-[:PRODUCES]->(Effect)             gift_effect
```

**원문은 `skill_coin.effects` 에 그대로 남는다.** 파싱이 틀려도 다시 뽑을 수 있다.

## 4. 기존 ADR 과 달라지는 것

기존 ADR 01–05 는 **현행 `public` 스키마의 기록으로 남긴다.** 두 시스템의 결정이
한 문서에서 뒤섞이면 안 된다.

| ADR | 현행 결정 | 신규 3스키마에서 |
| --- | --- | --- |
| **01** 데이터 저장 형식 | 「파일 하나 = 테이블 하나」 | `raw` 층 추가로 대체 |
| **02** 파이프라인 | 「전체를 재생성한다」 | 범위를 `raw`·`canonical` 로 한정. `app` 제외 |
| **03** 다국어 | ko · en | **ko · en · ja** |
| **04** 출처 권위 | 엔티티마다 정본 하나 | 유지. **팩은 mj** 로 정정(§4.1) |

### 4.1 ADR-04 의 「거울 던전 구성 = `limbus-assets`」 정정

마스터북 팩 편 실측이 **반대**였다.

```
팩 계열 단독 보유 개념   mj 6 · assets 2 · loc 1
mj 단독      기프트 목록 · 맵 생성 규칙 · 해금 코드 · 층 배정 · 장/난이도 · 텍스트 색
assets 단독  tags · overlayImage
```

**`limbus-assets` 에는 기프트 목록도 맵 생성 규칙도 없다.** 문장을 나눠 적어야
정확하다 — 「거울 던전 **은총**은 assets, **구조**는 mj」. 다만 층별 등장 팩
(`md_floor_packs`)은 assets 가 정본이다.

ADR-04 본문에 이 정정을 반영했다.

## 5. 결과

```
schema raw          4테이블 ·  44,954행
schema canonical   86테이블 · 124,000여 행
schema app          6테이블
schema public      52테이블 ·  52,781행   ← 현행. 무손상

검사   raw 13건 + canonical 147건 전부 통과
테스트 289건 전부 통과 (변환기 13개 전부 TDD)
```

### 5.1 스펙 완료 기준 3항 전부 통과

```
1. 원본 1,664파일의 모든 개체가 raw 에 들어갔다 (누락 0)
2. 마스터북 90개 개념이 canonical 컬럼으로 옮겨졌다
3. 검증 7쌍이 통과하고 결손이 field_gap 에 특정됐다
```

### 5.2 마스터북 완전 일치 쌍 7건이 전부 회귀 검사가 됐다

```
층 ↔ 팩 (1–5구간)       218/218   차집합 0
기프트 ↔ 팩 역참조       10,115    차집합 0
기프트 색 → 죄악         441/441   불일치 0
assets affinity 오류        4      게임 확인과 일치
E.G.O 스킬                 208     차집합 0
E.G.O 패시브               113     차집합 0
시작 기프트 assets ↔ mj    30/30   차집합 0
팩 ↔ 인카운터              75/75   차집합 0
```

마스터북이 「이것이 깨지면 곧 회귀 신호」라 적은 것이 코드가 됐다.

### 5.3 결손 1,549건이 특정됐다

```
status.name      ja 258 · ko 245      한국어 16.6 %
reward.item      ko 200 · ja 200
achievement.text ko 183 · ja 183
choice_event     ko  56 · ja  56
pack.textColor      61
adversity/grace  ko  40 · ja  40
그 밖               88
```

전부 사유·근거와 함께 `field_gap` 에 있고 `build/gap-report.md` 로 나온다.

### 5.4 독립 감사에서 찾은 것 (2026-08-01)

검사가 전부 통과한 뒤 **검사가 보지 않는 곳**을 따로 팠다. 버그 3건과 판단
누락 1건이 나왔다.

| 발견 | 원인 | 손실 |
| --- | --- | ---: |
| `identity.stagger` 전량 NULL | 원본이 **배열** `[65,35,15]` 인데 스칼라로 읽었다 | 구간 421개 |
| `passive.cost` 전량 NULL | 이름은 `cost` 지만 **발동 조건 코드 배열**이다 | 조건 599개 |
| `choice_event.illust_id` NULL | 원본이 **숫자**인데 문자열로 읽었다 | 1건 |

셋 다 **원본 타입을 확인하지 않고 스칼라로 읽은 것**이 원인이다. 계획 4에서
`defType`·`attackSkills`·`battlePassives` 로 세 번 겪고도 반복했다.

> **전부 NULL 인 컬럼을 찾는 질의가 셋을 한 번에 잡았다.** 행 수 검사로는
> 안 보인다 — 행은 다 있고 값만 비어 있었다.

**판단 누락** — 마크업 4,553건을 지울지 정한 적이 없었다. 현행 파이프라인은
`stripMarkup` 으로 지우는데 신규는 그냥 담았다. `canonical` 이 화면이 읽는
층이므로 지우기로 하고, 원문은 `*_raw` 컬럼에 남긴다.

```
desc      마크업을 지운 표시용
desc_raw  마크업이 있던 원문. 없으면 null (desc 가 곧 원문)
```

**화이트리스트로 지운다.** 실측 태그 24종 중 **절반이 리터럴 꺾쇠**다 —
`<Bloodfiend>` · `<La Manchaland>` · `<Mechanical>` 은 게임 텍스트지 마크업이
아니다. `<[^>]*>` 로 뭉뚱그리면 41건이 사라진다.

회귀 검사 8건을 더했다(검사 139 → 147).

### 5.5 재현 시험 — 지우고 다시 만들어도 같은가 (2026-08-01)

ADR-02 원칙 3(같은 입력이면 같은 결과)이 실제로 성립하는지 **전 과정을 다시
밟아** 확인했다.

```
1. pg_dump 로 스냅샷 · 원본 1,664파일 체크섬 기록
2. data/entities/ 삭제
3. npm run fetch          manifest 커밋 해시 고정으로 원격 재수집
4. 파일 체크섬 대조
5. DROP SCHEMA → DDL → v2:load → v2:canonical
6. 덤프 대조
```

**결과 — 바이트 단위로 같다.**

```
원본 파일   1,664/1,664 체크섬 일치   수집 1,749파일 49초
행 수       98테이블 전수 일치
덤프        해시 49ee6696b874e23a  →  49ee6696b874e23a
            차이는 pg_dump 가 매번 새로 만드는 세션 토큰 4줄뿐
검증        raw 13건 · canonical 147건 · 테스트 289건 전부 통과
```

두 번 돌려 두 번 다 같은 해시가 나왔다. `npm run v2:reproduce` 로 언제든
다시 돌린다(기본은 모의 실행, `--run` 이 실제 실행).

> **`data/assets/` 는 시험 범위 밖이다.** v2 파이프라인이 한 번도 읽지 않는다.
> 그중 16건(`v1-local`)은 지금 존재하지 않는 로컬 저장소에서 와 복원되지 않으므로
> 시험이 건드리지 않게 했다.

### 5.6 인카운터 재설계 (2026-08-03)

소비자 관점 감사([`docs/audit/06-encounter.md`](../audit/06-encounter.md))가 이 도메인을
최악으로 짚었다 — 원본 타깃 1,384건 중 398건(28.8%)만 적재됐고, 보스 이름을 낼 수 있는
팩이 117개 중 31개(26.5%)뿐이었다. 그런데 **감사가 그 자리에서 제시한 조치 두 건을 그대로
시행했으면 데이터가 틀어졌다.** 위키 대조([`docs/audit/wiki/06-encounter.md`](../audit/wiki/06-encounter.md))가
전제를 뒤집었기 때문이다.

```
감사의 조치                          위키로 확인된 실제
`waves`/`phases`/`battles` 986건을    `battles` 는 연속 전투가 아니라 서로 배타적인
타깃으로 평평하게 펼친다              보스 후보다. 그대로 펼치면 「이 보스전 등장 적」이
                                     최대 4배로 부풀고 저항이 뒤섞인다
`portrait` 를 적 FK 로 승격한다       `portrait` 는 적 id 가 아니라 초상화 이미지 id 다.
                                     398건 중 390건은 해석되지만 37건은 다른 적에 붙는다
                                     — FK 로 승격했으면 그 37건이 틀린 적에 연결됐다
```

그래서 「적재를 늘린다」가 아니라 **모델을 다시 짰다.** `encounter_target` 을
`(encounter_id, kind, group_index, index)` 4키로 넓혀 `top`·`wave`·`phase`·`battle`
네 갈래를 배타적으로 담고, `battle` 은 후보 하나하나를 `group_index` 로 구분해 펼치지
않고도 전부 담았다. `portrait` 는 FK로 승격하지 않고 그대로 담은 채, 부위 쪽은
`part_id`(6자리 id, `enemy_id = part_id / 100`)로 별도 조인 경로를 열어 두 키를 함께
남겼다. `canonical.enemy` 도 적(4~5자리)과 부위(6자리)가 한 표에 섞여 있던 것을 `enemy`
(적)와 `enemy_part`(부위)로 갈랐다.

**행 수 검사가 왜 이걸 못 잡았나** — `verify-canonical.ts` 의 인카운터 6테이블이 전부
`eq(count, N)` 이었다. 행은 다 있었다 — `encounter_target` 398행은 398개라는 기댓값과
정확히 맞았다. 문제는 **갈래가 통째로 없었다는 것**이다. `waves`·`phases`·`battles`
안의 986건이 JSONB 원문에만 있고 관계형 행으로 만들어지지 않았는데, 기댓값 자체가
「최상위 `targets` 만 센 값」이라 행 수 검사는 원리적으로 이 누락을 볼 수 없었다.
그래서 값 검사 8건을 더했다 — kind 별 분포(top·wave·phase·battle), 보스 이름을 낼 수
있는 팩 수, 적·부위 부모 해석(고아 검사·id 자릿수 검사), `enemy_part` 행 수(신규 테이블),
골든 표본 2종(`md__canto-1-2`·`md__walpu-8`, 위키 대조값), 보스 후보를 모르는 42팩의
결손 기록. **mj `bossPool` 합계와 대조하는 검사는 넣지 않았다** — 있는 것은
`field_gap` 의 `encounter.bossPool` 42건 계수뿐이다.

**실측**

```
encounter_target        398 → 1,371    top 398 · wave 461 · phase 67 · battle 445
encounter_target_part          → 1,302
encounter_part_resist  3,540 → 11,800   1,180부위 × 10축. 122부위는 원본에 resists 키
                                        자체가 없어 부위 단위 결손으로 남겼다
enemy                  1,342 → 적 870 + 부위 466
                                        (loc 원본의 6자리 부위 id 는 472개지만, 그중 6개는
                                        부모 적 id 가 loc 어디에도 없는 고아라 지어내지 않고
                                        결손으로 뺐다)
보스 이름 낼 수 있는 팩    31 → 75
검사                    170 → 178건 전부 통과
field_gap               973 → 1,137    = 973 + 42(mj bossPool 크로스워크 없는 팩) +
                                        122(부위 저항 결측). 결손을 새로 만든 게 아니라
                                        컬럼이 없어서 못 보던 것을 컬럼을 만들고 나서 기록했다
```

## 6. 범위 밖

```
schema service    조인 없이 읽히는 파생표. 화면 요구가 정해진 뒤
Neo4j 투영        canonical 이 준비를 끝냈고 그다음 작업
API·화면 수정      스키마가 근간이므로 그쪽이 맞춘다
현행 public 전환   신규 DB 가 완성된 지금 별도로 판단한다
```

> **`canonical` 재생성 모델은 [ADR-07](07-canonical-promotion.md) 이 대체한다**
> (2026-08-04). 2절의 「`TRUNCATE canonical.*` 후 재적재」는 더 이상 안 돈다 —
> `canonical` 은 승격으로만 바뀐다. 스키마 경계가 안전장치라는 것은 그대로다.

## 7. 실행 명령

```bash
npm run v2:schema:validate    스키마 검증
npm run v2:schema:ddl         DDL 생성 → prisma/v2/schema.sql
npm run v2:generate           Prisma Client 생성 (src/v2/generated)
npm run v2:load               raw 적재
npm run v2:canonical          canonical 재계산 + override 덮기
npm run v2:verify             raw 검증 13건
npm run v2:verify:canonical   canonical 검증 147건
npm run v2:gap-report         결손 대장 → build/gap-report.md
npm run v2:reproduce          재현 시험 (모의) · --run 으로 실제 실행
```

DDL 은 스크립트가 적용하지 않는다. `prisma/v2/schema.sql` 을 psql 로 직접 넣는다
(ADR-02 3.2 와 같은 방침).
