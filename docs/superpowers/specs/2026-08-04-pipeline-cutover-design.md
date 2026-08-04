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

**권한이 아니라 검사로 막는다.** 적재기가 시작할 때 `canonical` 에 테이블이 있으면
거부한다.

```
npm run v2:canonical 맨손 실행   →  거부.  「canonical 이 비어 있지 않다」
npm run v2:build 안에서 실행     →  통과.  build 가 먼저 옆으로 치웠다
```

권한(`REVOKE`)은 접속 계정이 하나라 못 가르고, 마이그레이션도 같이 막힌다. 검사는
이유를 말해 주고 우회로를 알려 준다.

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

## 9. 구현에서 확인할 것 하나

**6.1 의 2단계 DDL 을 무엇으로 만드나.**

`prisma/v2/schema.sql` 은 `raw`·`canonical`·`app` 이 섞여 있다(canonical 참조 274 ·
raw/app 27). 통째로 돌리면 살아있는 `raw`·`app` 을 다시 만들려 든다.

후보는 `prisma migrate diff --from-url $DATABASE_URL --to-schema-datamodel` 이다.
1단계 뒤에는 `canonical` 이 없으므로 그 생성 DDL 만 나와야 한다. 다만 `app` → `canonical`
FK 가 함께 나오는지(그러면 `app` 을 건드린다) 구현 첫 단계에서 확인한다.

안 되면 대안은 `pg_dump --schema-only -n canonical_hold` 를 이름만 바꿔 쓰는 것이다 —
구조가 안 바뀐 경우에만 옳으므로 모델 변경이 있으면 못 쓴다.

## 10. 범위 밖 — 그다음 PR

```
snapshot_id 심기      canonical 이 자기 출처를 모른다.  증분의 기준점
저작 표 데이터화       EGO_GRANTED · TRIGGER_EXCEPTION · TOKEN_EXCEPTION · 분모 어휘.
                     코드에 있으면 파이프라인이 멈춘 뒤 좀비가 된다
증분 파이프라인        raw v1 vs v2 diff → 추가·변경 판정.
                     source='desc_derived' 자동 · 'authored' 는 사람에게
앱 전환 · public 폐기  읽는 곳을 바꾸는 작업.  데이터는 안 바뀐다
Neo4j 투영            canonical 이 안정된 뒤
```
