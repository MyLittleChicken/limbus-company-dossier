# 파이프라인 끊기 — `canonical` 을 굽는 곳에서 승격하는 곳으로

> 문제 정의 2026-08-04 · **설계 미확정.** 이 문서는 지금까지 잰 사실과 제약만 담는다.
> 선행 [ADR-06 3스키마 데이터베이스](../../adr/06-three-schema-database.md)
> 이 문서의 모든 수치는 실측이다.

## 1. 무엇을 바꾸나

지금 `canonical` 은 **계산 결과**다. `npm run v2:canonical` 이 매번 TRUNCATE 하고
`raw` 에서 다시 굽는다. 정정은 적재기 코드와 `app.field_override` 에 살고, 적재기가
매번 다시 적용한다.

이 모델은 **정정이 코드로 표현되는 동안만** 옳다. `canonical` 이 코드로 재현할 수 없는
값을 갖기 시작하면, 재적재는 그 값을 지우는 일이 된다.

목표는 이것이다.

```
지금    canonical = f(raw, 코드).  매번 다시 굽는다
이후    canonical 은 승격으로만 바뀐다.  파괴적 적재의 대상이 아니다
```

`raw` 는 그대로 매 패치마다 받는다. `canonical` 은 잃지 않는다.

## 2. 재는 것부터 — 지금 상태

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

**적재기를 `wip` 스키마로 돌릴 수 없다.** 같은 모델 94개를 `@@schema("wip")` 로 한 벌 더
두는 것 말고는 방법이 없고, 그것은 유지가 안 된다.

`?schema=` 접속 인자는 `multiSchema` 가 아닐 때의 기본 스키마만 정한다. 여기서는 안 듣는다.

### 3.2 검사와 골든도 Prisma 를 쓴다

`verify-canonical.ts` 203건과 골든이 전부 `prisma.<model>` 로 읽는다. 새로 구운 것을
검사하려면 그것이 **`canonical` 이라는 이름으로 서 있는 순간**이 필요하다.

### 3.3 뷰와 FK 가 스키마를 따라간다

`v_identity_capability` 는 `canonical.*` 을 참조한다. FK 도 스키마 한정이다.
스키마를 통째로 옮기면(`ALTER SCHEMA … RENAME`) 둘 다 따라간다 — PostgreSQL 이
의존성을 이름이 아니라 OID 로 들고 있어서다. 테이블 단위로 옮기면 안 따라간다.

### 3.4 승격은 되돌릴 수 있어야 한다

되돌릴 수 없는 순간이 있으면 「잃고 싶지 않다」가 지켜지지 않는다.

## 4. 열린 판단 — 이 PR 이 답해야 하는 것

```
① 새로 굽는 것을 어디에 두는가        Prisma 가 canonical 이름을 요구한다
② 승격을 무엇으로 하는가              스키마 rename · 테이블 교체 · 덤프 복원
③ 정정은 어디에 사는가                지금 코드와 app.field_override 로 갈려 있다
④ 되돌리기를 어떻게 보장하는가         이전 판을 얼마나 오래 남기는가
⑤ 적재기가 canonical 을 못 건드리게    검사로 막을 것인가 권한으로 막을 것인가
```

## 5. 범위 밖 — 그다음 PR

```
snapshot_id 심기      canonical 이 자기 출처를 모른다.  증분의 기준점
저작 표 데이터화       EGO_GRANTED · TRIGGER_EXCEPTION · TOKEN_EXCEPTION ·
                     분모 어휘.  코드에 있으면 동결과 함께 죽는다
증분 파이프라인        raw v1 vs v2 diff → 추가·변경 판정
앱 전환 · public 폐기  읽는 곳을 바꾸는 작업.  데이터는 안 바뀐다
Neo4j 투영            canonical 이 안정된 뒤
```
