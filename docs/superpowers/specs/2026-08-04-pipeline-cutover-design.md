# 파이프라인 끊기 — `canonical` 을 굽는 곳에서 승격하는 곳으로

> 설계 2026-08-04 · 선행 [ADR-06 3스키마 데이터베이스](../../adr/06-three-schema-database.md)
> 이 문서의 모든 수치와 동작은 **실측이다.** 3절의 제약과 6절의 교체 절차는
> 임시 스키마로 실제 실행해 확인했다.

## 1. 무엇을 바꾸나

지금 `canonical` 은 **계산 결과**다. `npm run v2:canonical` 이 매번 TRUNCATE 하고
`raw` 에서 다시 굽는다. 정정은 적재기 코드와 `app.field_override` 에 살고, 적재기가
매번 다시 적용한다.

이 모델은 **정정이 코드로 표현되는 동안만** 옳다. `canonical` 이 코드로 재현할 수 없는
값을 갖기 시작하면, 재적재는 그 값을 지우는 일이 된다.

```
지금    canonical = f(raw, 코드).  매번 다시 굽는다
이후    canonical 은 승격으로만 바뀐다.  파괴적 적재의 대상이 아니다
```

`raw` 는 그대로 매 패치마다 받는다. `canonical` 은 잃지 않는다.

## 2. 지금 상태

```
canonical    94테이블 · 152,399행 · 34 MB    + 뷰 v_identity_capability
raw           4테이블 ·  44,954행 · 33 MB    snapshot v1 (2026-07-25) 하나
public       52테이블 ·  52,781행 · 12 MB    현행 앱.  이 PR 범위 밖
app           6테이블 ·       5행           field_override 5 · run 0
```

## 3. 제약 — 이게 설계를 가른다

### 3.1 Prisma 가 스키마 이름을 하드코딩한다

`multiSchema` 는 `@@schema("canonical")` 을 정적으로 굳힌다. 실측:

```sql
SELECT COUNT(*) FROM (SELECT "canonical"."axis"."id" FROM "canonical"."axis" …) AS "sub"
```

**적재기를 `wip` 스키마로 돌릴 수 없다.** 모델 94개를 `@@schema("wip")` 로 한 벌 더
두는 것 말고는 방법이 없고, 그것은 유지가 안 된다. `?schema=` 접속 인자는
`multiSchema` 가 아닐 때의 기본 스키마만 정한다.

검사 203건과 골든도 전부 `prisma.<model>` 로 읽으므로 같은 제약을 받는다.

**따라서 새로 굽는 것은 `canonical` 이라는 이름으로 서 있는 순간이 필요하다.**

### 3.2 `app` 이 `canonical` 을 세 갈래로 참조한다

```
app.run.difficulty   →  canonical."Difficulty"   enum 타입
app.run_floor        →  canonical.pack           FK
app.run_gift         →  canonical.gift           FK
```

### 3.3 이름을 바꾸면 의존이 따라간다 — 실측

임시 스키마로 확인했다. `ALTER SCHEMA zz_c RENAME TO zz_c_live` 뒤:

```
FK     zz_c_live.pack       따라갔다
enum   zz_c_live.Diff       따라갔다
view   SELECT … FROM zz_c_live.pack    따라갔다
```

PostgreSQL 이 의존을 이름이 아니라 OID 로 들고 있어서다. **뷰와 FK 가 스키마 이동을
따라가는 것은 이 설계의 전제**이고, 동시에 **`app` 이 옛 판에 남는 원인**이다.

승격은 `app` 을 새 `canonical` 로 **다시 겨눠야** 한다. 안 하면 옛 판을 지우는 순간
`app` 이 깨진다.

### 3.4 DDL 은 트랜잭션 안에 들어간다

PostgreSQL 은 DDL 이 트랜잭션이다. 스키마 이름 교체와 `app` 재조준을 **한 트랜잭션**에
넣을 수 있고, 실측으로 확인했다. 반쯤 바뀐 상태가 존재하지 않는다.

## 4. 결정

### 결정 1 · 이름 돌려쓰기로 간다

굽기는 `canonical` 이름으로 하되, **살아있는 판을 먼저 옆으로 치운다.**

별도 데이터베이스(대조가 덤프 비교가 된다)나 적재기를 Prisma 에서 떼기(전면 수정)는
쓰지 않는다. 후자는 증분 파이프라인을 짤 때 자연히 필요해지면 그때 한다.

### 결정 2 · 정정은 성격으로 가른다

```
값 정정     app.field_override    「mj 가 틀렸다」.  데이터고, 자주 늘고, 근거가 외부다
구조 저작    코드                  EGO_GRANTED · TRIGGER_EXCEPTION · TOKEN_EXCEPTION ·
                                 분모 어휘.  규칙이고, 테스트가 필요하다
```

지금 실제로 이렇게 나뉘어 있다. **이 PR 이 하는 일은 그 경계를 문서로 못 박는 것**이고,
저작 표를 데이터로 내리는 것은 다음 PR 이다.

### 결정 3 · 이전 판은 하나만 남긴다

`canonical_bak` 하나. 다음 승격이 이전 `bak` 을 지운다.

**두 판 이상 거슬러 올라갈 일이 없다.** 34 MB × N 이 쌓이고, 되돌리기는 승격 직후에
하지 한 달 뒤에 하지 않는다. 더 오래 남겨야 하면 그건 백업의 일이지 스키마의 일이 아니다.

### 결정 4 · 적재기가 살아있는 `canonical` 을 못 건드리게 한다

**권한이 아니라 검사로 막는다.** 적재기가 시작할 때 `canonical` 에 **행**이 있으면
거부한다.

```
npm run v2:canonical 맨손 실행   →  거부.  「canonical 이 비어 있지 않다」
npm run v2:build 안에서 실행     →  통과.  build 가 먼저 옆으로 치웠다
```

권한(`REVOKE`)은 접속 계정이 하나라 못 가르고, 마이그레이션도 같이 막힌다. 검사는
이유를 말해 주고 우회로를 알려 준다.

**왜 테이블 수가 아니라 행 수인가(Task 2 실측으로 정정).** 처음에는 "테이블이
있으면 거부"로 적었는데, `v2:build` 3단계(DDL)가 끝난 직후는 `canonical` 이 테이블
94개·행 0개다 — 테이블 개수로 재면 그 순간에도 "안 비었다"고 걸려 `v2:build` 가
안에서 적재기를 못 부른다. 살아있는 판은 테이블 94개·행 152,399개다. 위험의
실체가 "테이블이 있다"가 아니라 "데이터가 있다"이므로, 갓 구운 빈 판과 살아있는
판을 가르는 조건은 **행 존재**여야 한다(`hasAnyRow`, `EXISTS` 로 직접 확인 —
`pg_stat_user_tables` 추정치는 ANALYZE 시점에 따라 틀려서 안 쓴다). 이 표는 조건이
행 기준일 때만 성립한다 — 다시 테이블 수로 되돌리지 않는다.

## 5. 명령 넷

```
npm run v2:build      살아있는 판을 옆으로 → 빈 canonical 에 적재 → 검사 →
                      새 판을 wip 으로, 살아있는 판을 canonical 로 복귀
npm run v2:diff       wip vs canonical 대조.  승격 전에 무엇이 달라지는지 본다
npm run v2:promote    한 트랜잭션 교체 + app 재조준.  이전 판은 canonical_bak
npm run v2:rollback   canonical_bak 으로 되돌린다
```

`v2:canonical` 은 남긴다 — `v2:build` 가 안에서 부른다. 맨손 실행만 결정 4가 막는다.

## 6. 절차

### 6.1 `v2:build`

```
1  ALTER SCHEMA canonical RENAME TO canonical_hold      살아있는 판을 옆으로
2  CREATE SCHEMA canonical + DDL                        Prisma 가 원하는 이름 그대로
3  npm run v2:canonical                                 적재기.  1 덕분에 결정 4를 통과한다
4  npm run v2:verify:canonical                          검사 203건.  여기서 깨지면 멈춘다
5  ALTER SCHEMA canonical RENAME TO wip                 방금 구운 것을 wip 으로
6  ALTER SCHEMA canonical_hold RENAME TO canonical      살아있는 판 복귀
```

**1–6 사이 `canonical` 이라는 이름은 새 판을 가리킨다.** 지금은 앱이 `public` 을 읽으므로
아무도 안 다친다. 앱 전환 뒤에는 이 창이 문제가 되지만, 그때는 전체 재적재가 아니라
증분이라 이 절차를 안 쓴다.

`app` 은 1–6 내내 `canonical_hold` 를 본다 — 건드리지 않는다.

4에서 실패하면 5·6만 되돌리면 된다. 새 판은 `wip` 에 남아 조사할 수 있다.

### 6.2 `v2:promote` — 한 트랜잭션

```sql
BEGIN;
  ALTER TABLE app.run_floor DROP CONSTRAINT …;      -- app 을 잠깐 떼고
  ALTER TABLE app.run_gift  DROP CONSTRAINT …;
  ALTER SCHEMA canonical RENAME TO canonical_bak;   -- 교체
  ALTER SCHEMA wip       RENAME TO canonical;
  ALTER TABLE app.run ALTER COLUMN difficulty
    TYPE canonical."Difficulty" USING difficulty::text::canonical."Difficulty";
  ALTER TABLE app.run_floor ADD CONSTRAINT … REFERENCES canonical.pack(id);
  ALTER TABLE app.run_gift  ADD CONSTRAINT … REFERENCES canonical.gift(id);
COMMIT;
```

실측으로 확인했다 — 교체·재조준이 한 트랜잭션에 들어가고, `app` 행이 그대로 살아남으며,
뷰가 새 `canonical` 을 가리킨다.

> **이 순서를 `prisma.$transaction` 안에서 내야 한다. 수동 `BEGIN` 은 안 된다**
> (Task 4 실측). 위 SQL 은 **문장의 순서**를 적은 것이고 구현이 내는 것과 같지만,
> `$executeRawUnsafe('BEGIN')` 으로 열면 안 된다 — Prisma 커넥션 풀은 동시 호출에서
> 커넥션을 가르고(실측 pid 51430/51431/51432), `BEGIN` 은 문장이 끝나는 즉시 커넥션을
> 반납하므로 다음 문장이 같은 커넥션이라는 보장이 없다. 갈리면 뒤따르는 DDL 이
> **자동 커밋으로 나가고**, 그 순간 3.4 가 「존재하지 않는다」고 못 박은 반쯤 바뀐
> 상태가 생긴다. `$transaction` 은 콜백이 도는 동안 커넥션을 점유하므로 그것만이
> 안전하다. 7절 `v2:diff` 의 읽기 전용을 세션이 아니라 **트랜잭션에** 건 것도 같은
> 판단이다.

**FK 재부착이 승격의 검사 역할을 한다.** `app.run_gift` 가 새 판에 없는 기프트를
가리키면 트랜잭션이 통째로 되돌아간다. 콜라보 기프트가 원본에서 빠지는 일이 실재하므로
(PR #21 의 1122 팩) 이 실패는 실제로 일어날 수 있고, **일어나야 옳다.**

승격 전에 이전 `canonical_bak` 이 있으면 지운다(결정 3).

### 6.3 `v2:rollback`

`promote` 의 역순. `canonical` → `wip`, `canonical_bak` → `canonical`, `app` 재조준.

## 7. `v2:diff` 가 무엇을 보나

승격 전에 **무엇이 달라지는지**를 사람이 읽을 수 있어야 한다.

```
테이블별 행수 차        wip vs canonical
사라진 개체             canonical 에 있고 wip 에 없는 id.  기프트·인격·에고·팩
새 개체                 반대
app 무결성 예고         app.run_gift·run_floor 가 가리키는 id 가 wip 에 있나
                        — 없으면 승격이 실패한다.  미리 안다
```

## 8. 검증

```
build 후    wip 이 지금 canonical 과 같다 (diff 0)
            canonical 이 한 행도 안 바뀌었다
            app 이 여전히 canonical 을 본다
promote 후  canonical == 옛 wip · canonical_bak 이 남아 있다
            app FK·enum 이 새 canonical 을 가리킨다 · app 행이 그대로다
            v_identity_capability 가 새 canonical 을 가리킨다
rollback 후 promote 직전 상태로 돌아온다
맨손 실행    v2:canonical 을 그냥 돌리면 거부된다
```

## 9. 구현에서 확인한 것 (Task 2 실측 — 더 이상 미확인이 아니다)

**6.1 의 2단계 DDL 을 무엇으로 만드나 — `--from-url` 은 못 쓴다.**

첫 확인: canonical 이 살아있는 채로 `prisma migrate diff --from-url $DATABASE_URL
--to-schema-datamodel prisma/v2/schema.prisma --script` 를 떠 보면 빈 마이그레이션이
나온다(`-- This is an empty migration.`) — 스키마와 DB 가 어긋나지 않았다는 뜻이고,
이 확인이 비어 있지 않았다면 여기서 멈췄어야 했다.

후보로 적었던 `prisma migrate diff --from-url` 은 실측으로 기각한다. `canonical` 을
`canonical_probe` 로 옆으로 치운 뒤(3.3 절의 그 실측과 같은 방법으로) 같은 명령을
다시 뜨면 두 갈래로 막힌다.

1. `canonical_probe` 를 datasource 의 `schemas` 목록에 안 넣으면 **P4002 로 죽는다**
   — `app.run_floor` 가 그 이름을 가리키는 FK 때문에("Cross schema references are
   only allowed when the target schema is listed in the schemas property").
2. 임시로 목록에 넣어서 통과시키면, 그 이름 밑에 딸려 있는 살아있는 94테이블이
   "목표 데이터모델에 없는 여분"으로 잡혀 **`DROP TABLE`/`DROP TYPE` 105건**이 나온다
   (94 테이블 + 11 타입). 그대로 실행하면 옆으로 치운 살아있는 판을 통째로 지운다 —
   `v2:build` 안에서는 못 쓴다.

`app` 을 건드리는 문장은 딱 하나 섞여 나온다 — `ALTER TABLE "app"."run" DROP COLUMN
"difficulty", ADD COLUMN "difficulty" ...`(옆으로 치운 뒤에는 `app.run.difficulty` 가
`canonical_probe."Difficulty"` 를 가리키므로, 목표 스키마의 `canonical."Difficulty"`
와 다르다고 diff 가 판단한다). `raw` 를 다시 만들려 드는 문장은 없었다.

**채택한 방법:** `--from-url` 대신 `--from-empty` 산물을 쓴다 —
`npm run v2:schema:ddl`(`prisma migrate diff --from-empty --to-schema-datamodel
prisma/v2/schema.prisma --script`)이 만드는 `prisma/v2/schema.sql`. 이 명령은
DB 접속이 필요 없고(재실행해도 바이트 단위로 같은 파일이 나온다), **빈 상태에서
만드는 것이니 DROP 문이 애초에 없다.**

이 파일은 여전히 `raw`·`canonical`·`app` 이 섞여 있다(주석 헤더로 구분되는 문장
블록 256개 중 227개가 canonical 전용, 3개는 `app` 문장에 canonical 참조가 섞여
있다 — 위의 `app.run.difficulty` 문장과 `app.run_floor`/`run_gift` 의
`REFERENCES "canonical"...` FK 문장 둘). `src/v2/schema-ops.ts` 의
`extractCanonicalDdl` 이 블록을 "`\"canonical\"` 을 포함하고 `\"app\"`·`\"raw\"` 를
포함하지 않으면 채택"으로 걸러 227개만 남긴다. `pg_dump --schema-only` 대안은
안 썼다 — 구조가 안 바뀐 경우에만 옳다는 제약이 있는데, `--from-empty` 걸러 쓰기는
그 제약이 없고(항상 `schema.prisma` 의 지금 정의를 반영한다) DB 접속도 안 필요해
더 낫다.

**부수적으로 발견한 것:** `load-canonical.ts` 의 설계 결정 4 가드(Task 1)는
`information_schema.tables` 의 테이블 개수로 "비었다"를 판정했다. 그런데 위 DDL 을
`canonical` 이름으로 구우면 그 순간 테이블이 94개가 되므로(행은 0개), `v2:build`
안에서 적재기를 불러도 가드가 그대로 막았다 — 결정 4 자신이 적어 둔 표("build
안에서 실행 → 통과")와 어긋났다. 처음엔 환경변수로 우회했다가(가드에 구멍을 내는
것이라 리뷰에서 기각), **가드의 조건 자체를 테이블 수에서 행 수로 고쳤다**
(`hasAnyRow`, 위 결정 4 갱신 참고) — 우회로가 아니라 조건이 원래 이래야 맞았다.
`load-canonical.ts` 는 과제 범위 밖 파일이지만, 이걸 고치지 않으면 `v2:build` 가
끝까지 못 돈다.

## 10. 구현 결과

결정 넷은 [ADR-07 `canonical` 은 승격으로만 바뀐다](../../adr/07-canonical-promotion.md)
로 옮겼다. 여기는 **이 PR 이 실제로 무엇을 만들었나**만 적는다.

### 10.1 명령 넷과 파일

```
npm run v2:build      src/v2/build-canonical.ts     신규
npm run v2:diff       src/v2/diff-canonical.ts      신규
npm run v2:promote    src/v2/promote-canonical.ts   신규 (promote)
npm run v2:rollback   src/v2/promote-canonical.ts   신규 (rollback)

src/v2/schema-ops.ts        신규.  스키마 이름 조작의 공통부.
                            SQL 을 **만드는 것과 실행하는 것**을 갈라서 만드는 쪽은
                            순수 함수로 둔다 — CI 가 DB 없이 테스트한다
src/v2/schema-ops.test.ts   신규
src/v2/load-canonical.ts    수정.  빈 canonical 가드(결정 4)
package.json                명령 넷
```

### 10.2 검증 수치

```
검사        203건 전부 통과 (v2:verify:canonical)
테스트      432건 전부 통과(건너뜀 12) · 타입 검사 둘 다 통과
canonical    94테이블 · 152,399행
raw          43,270 개체
app.field_override   5행
public       52테이블   안 건드림
```

승격 경로는 `promote → verify 203 → rollback → verify 203 → promote → verify 203`
으로 왕복까지 태웠다. `wip` 과 `canonical` 이 행 152,399=152,399 · 인덱스 130=130 ·
제약 179=179 로 완전히 같은 것을 따로 쟀다.

거부 경로도 인위적으로 셋 태웠다 — 승격 선검사 거부(종료 1, 트랜잭션·`bak` 정리
둘 다 시작 안 함) · `canonical_bak` 없는 rollback 거부 · 이전 `canonical_bak` 삭제.
FK 재부착 직전에 일부러 던져 실패시켰을 때 `canonical_bak` 이 **같은 oid(50458)로**
되살아났다 — 새로 만들어진 것이 아니라 그 객체가 돌아온 것이고, 그것이 원자성의
증거다.

### 10.3 실측으로 기각한 것

```
prisma migrate diff --from-url    9절.  P4002 또는 DROP 105건
수동 BEGIN/COMMIT                  6.2 의 주석.  풀이 커넥션을 가른다
통짜 pg_depend + pg_identify_object  아래
```

**`pg_depend` 를 통째로 훑어 스키마 밖 의존을 세는 방법은 못 쓴다.**
`pg_identify_object` 가 규칙(`pg_rewrite`)과 컬럼 기본값(`pg_attrdef`)의 스키마를
`NULL` 로 준다 — 그 카탈로그들에 namespace 컬럼이 없고 소유 테이블만 가리키기
때문이다. 스키마가 `NULL` 이면 "밖"과 구분이 안 되므로 **안쪽 의존이 전부 밖으로
잡히고**, 멀쩡한 `canonical_bak` 이 기본값 수십 건으로 걸린다. 대신 3.2 의 세 갈래
(FK · 컬럼 타입 · 뷰)를 따로 물어 `UNION` 한다(`schema-ops.ts` 의
`outsideDependents`). 살아있는 `canonical` 에 돌리면 3.2 가 적은 정확히 그 셋이 나온다.

### 10.4 검증하지 못한 것 넷

전문은 [ADR-07 6절](../../adr/07-canonical-promotion.md)에 있다. 요약하면,

```
차이 있는 새 판 승격      검증에 쓴 wip 은 전부 canonical 과 동일했다.
                        통과 경로의 첫 실전은 다음 패치다
enum 재지정의 값 이동     app.run 이 0행이라 USING …::text::<타입> 을 실측 못 했다
교체의 ACCESS EXCLUSIVE  지금은 앱이 public 을 읽어 무해하다.
                        앱 전환 뒤에는 승격이 짧게 앱을 멈춘다 — 6.1 의 그 창
outsideDependents 의 범위  FK·컬럼 타입·뷰 셋뿐이다. 지금 스키마에 함수·트리거·
                        도메인이 없어 충분하다. 쓰기 시작하면 같이 늘려야 한다
```

## 11. 범위 밖 — 그다음 PR

```
snapshot_id 심기      canonical 이 자기 출처를 모른다.  증분의 기준점
저작 표 데이터화       EGO_GRANTED · TRIGGER_EXCEPTION · TOKEN_EXCEPTION · 분모 어휘.
                     코드에 있으면 파이프라인이 멈춘 뒤 좀비가 된다
증분 파이프라인        raw v1 vs v2 diff → 추가·변경 판정.
                     source='desc_derived' 자동 · 'authored' 는 사람에게
앱 전환 · public 폐기  읽는 곳을 바꾸는 작업.  데이터는 안 바뀐다
Neo4j 투영            canonical 이 안정된 뒤
```
