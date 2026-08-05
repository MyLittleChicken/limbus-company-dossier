# 기준점 심기 — `canonical` 이 자기 출처를 알게 한다

> 설계 2026-08-05 · 선행 [ADR-07 `canonical` 은 승격으로만 바뀐다](../../adr/07-canonical-promotion.md)
> 이 문서의 수치는 **실측이다.** 3절은 DB 에 직접 물어 얻었고, 4.2·4.3 은 기존
> 코드를 읽어 확인한 것이다. 아직 구현하지 않았으므로 6·7절은 계획이다.

## 1. 무엇을 바꾸나

[ADR-07](../../adr/07-canonical-promotion.md) 이 `canonical` 을 승격 대상으로 바꿨다.
이제 파괴적 적재가 그것을 못 지운다. **그 대가로 새 위험이 생겼다.**

```
1  새 저작 지식이 생긴다
2  전체 재빌드는 무겁다 — 152,399행을 다시 굽고 승격해야 하고,
   그 사이클이 대기 중인 다른 변경까지 끌고 온다
3  canonical 을 직접 UPDATE 하는 쪽이 훨씬 싸다.  그렇게 한다
4  canonical 에 코드로 재현 못 하는 값이 생긴다
5  재빌드가 그것을 지운다 → 아무도 v2:build 를 못 돌린다
```

**「canonical 을 안 지운다」를 보장했더니 「canonical 을 다시 만들 수 없게 되는」 길이
열렸다.** 이 PR 은 그 길을 막는다.

지킬 등식은 하나다.

```
canonical = f( raw@스냅샷 , app.저작 , 코드@커밋 )
```

**이 등식은 지금 참이다.** ADR-07 검증에서 새로 구운 판과 `canonical` 이
행 152,399=152,399 · 인덱스 130=130 · 제약 179=179 로 같았다. 그러니 이 PR 은 깨진
것을 고치는 작업이 아니라 **참인 것을 못 박고, 참인지 스스로 확인하게 만드는** 작업이다.
깨진 뒤에 하면 복구가 되고, 그건 훨씬 비싸다.

## 2. 세 가지를 가른다

「이 DB 를 신뢰할 수 있는가」는 한 질문이 아니다. 셋이고, 이 PR 은 그중 하나를 준다.

| | 묻는 것 | 지금 | 이 PR 뒤 |
| --- | --- | --- | --- |
| **재현성** | 이 DB 가 원본에서 나온 것이 맞나 | 물을 방법이 없다 | `v2:verify:rebuild` 가 **전수**로 답한다 |
| **정확성** | 담긴 값이 게임 사실과 맞나 | 검사 203건이 **표본**으로 답한다 | 그대로 + 전수 대조가 옆에 선다 |
| **완전성** | 메카닉이 빠짐없이 표현됐나 | `field_gap` 1,157행이 **없는 것을 적고 있다** | 안 바뀐다 |

**셋을 섞으면 안 된다.** 검사 203건은 우리가 「반드시 참이어야 한다」고 정한 규칙이지
152,399행 전수가 아니다. 검사가 안 보는 자리를 손대면 203건은 다 통과한다. 재현 대조는
그 반대다 — 규칙을 모르지만 모든 행을 본다. 둘은 서로 다른 것을 잡는다.

**완전성은 이 PR 이 못 바꾼다.** 그리고 못 바꾸는 것이 옳다 — 결손은 코드가 아니라
원본에 있다. 거울 던전 전투 풀 2,525종의 정의가 어느 저장소에도 없는 것은
([백로그 10](../../backlog/10-encounter-linkage.md)) 재현성과 무관한 문제다.

## 3. 지금 상태 — 실측

```
raw.snapshot            1건    2026-07-25 · version 1 · 「차원찢개 이상 인격 출시 시점」
canonical               94테이블 · 152,399행
canonical.field_source  15,534행    (entity, entity_id, field) → rule · sources
canonical.field_gap     1,157행     없는 것을 적어 둔 표
app.field_override      5행         위키 대조로 고친 값
```

`field_gap` 상위 — **엔진 영역은 12건뿐이다.**

```
reward.item                    400
achievement.text               366
encounter_target_part.resists  122
choice_event.text              112
pack.textColor                  61
encounter.bossPool              42   ← 백로그 10
gift.min_count                  12   ← 엔진 영역
skill.levels                     9
```

`trigger_ref` 평가가능성 150건.

```
roster_gated  57 · runtime 46 · roster 45 · always 1 · unclassified 1
```

**스냅샷이 1건이라는 것이 이 PR 을 싸게 만든다.** `field_source` 15,534행에
`snapshot_id` 를 백필할 때 후보가 하나뿐이라 추측이 없다.

## 4. 제약 — 이게 설계를 가른다

### 4.1 재빌드의 입력은 재빌드의 대상 밖에 있어야 한다

승격은 `canonical` 을 **통째로** 갈아치운다(`ALTER SCHEMA … RENAME`). 저작 지식이
`canonical` 안에 있으면 재빌드가 그것을 입력으로 못 쓴다 — 자기 자신을 입력으로 삼는
꼴이다.

따라서 저작 표가 갈 곳은 **`app`** 이다. `app.field_override` 가 이미 그 자리에 있고
같은 규칙을 따른다.

### 4.2 기존 `v2:reproduce` 가 `app` 을 지운다 — 이 PR 이 깬다

`src/v2/reproduce.ts` 는 전 과정 재현 시험이다.

```
1  DB 를 pg_dump 뜨고 체크섬을 남긴다
2  data/entities 를 지운다
3  npm run fetch 로 다시 받는다
4  파일 체크섬 대조                 ← 수집기가 같은 바이트를 냈나
5  DROP SCHEMA raw, canonical, app CASCADE → 재적재
6  덤프 대조                        ← 파이프라인이 같은 결과를 냈나
```

**5단계가 `app` 을 지운다.** 지금은 「수동 보정이 있으면 먼저 백업한다」는 경고로만
막고 있는데, 저작 표가 `app` 으로 내려가면 이 시험이 **자기가 검증하려는 입력을 지우고
굽는 것**이 된다. 결과가 다르게 나오고, 그 다름은 비결정성이 아니다.

**고친다.** `app` 은 수집기·변환기가 만드는 것이 아니라 사람이 넣는 것이므로,
그 결정성을 시험하는 데 `app` 을 지울 이유가 없다. `DROP` 대상에서 뺀다.

### 4.3 `built_at` 이 바이트 단위 덤프 대조를 깬다

`v2:reproduce` 는 덤프를 문자열로 비교한다(`\restrict` 줄만 걸러낸다). `build_info` 에
`built_at` 이 들어가면 **매 실행마다 달라져 대조가 항상 실패한다.**

`built_at` 줄을 걸러내는 것으로 막는다. 나머지 열(`snapshot_id` · `code_commit` ·
`authored_digest` · `row_count`)은 같은 입력이면 같으므로 대조에 남긴다.

### 4.4 저작 표 넷 중 하나는 모양이 다르다

```
EGO_GRANTED        identity-axis.ts:25        egoId → axisIds[]             1:N
TRIGGER_EXCEPTION  axis.ts:25                 트리거 표시명 → {refKind,refId}
TOKEN_EXCEPTION    gift-trigger-param.ts:54   브래킷 토큰 → {refKind,refId}
DENOMINATOR        gift-trigger-param.ts:35   정규식 → 분모.  순서 의존
```

앞 셋은 「이 id 는 이 값이다」라는 **사실**이다. `DENOMINATOR` 는 기프트 desc 산문에
정규식을 거는 **방법**이고, 순서가 의미를 갖는다 — 「대기 인원에」를 뒤에 두면 9778 이
엉뚱한 분모를 받는다. 분모를 틀리면 「N인 이상」 판정이 전부 틀린다(편성 12 vs 출전 7).

## 5. 결정 넷

### 결정 1 · 사실은 `app` 으로, 방법은 코드에

ADR-07 §3 은 「구조 저작 = 코드」로 그었다. **그 줄을 다시 긋는다.**

```
규칙 (어떻게 찾아 쓰는가)         →  코드.  테스트가 지킨다
규칙이 참조하는 사실 (게임의 진실)  →  app.  데이터로 산다
```

「Bloodfiend 가 소속이 아니라 유닛 키워드다」는 게임의 사실이다 → 데이터.
「desc 에서 정규식으로 분모를 뽑는다」는 우리가 정한 방법이다 → 코드.

DB 에 정규식을 두면 테스트가 못 지키고, 한 글자 틀리면 build 가 **조용히 틀린 분모**를
낸다. 실패 방향이 안전하지 않다.

`app` 이 코드보다 나은 점 셋 — 코드 배포 없이 고칠 수 있고, 값이 질의 대상이 되어
적재기가 **선검사로** 오타를 잡을 수 있고(TypeScript 상수는 그 자리에서 못 잡는다),
내용 지문을 잴 수 있다. 선검사로 가는 이유는 6.1 에 있다 — FK 는 안 건다.

**이 재정의는 ADR-07 §3 의 표를 바꾸므로 ADR-08 로 새로 남긴다.**

### 결정 2 · `snapshot_id` 는 판 표식과 행 단위 둘 다

```
canonical.build_info      판 단위.  「이 판이 무엇에서 나왔나」
canonical.field_source    행 단위.  「이 값이 어느 스냅샷에서 왔나」
```

지금은 행 단위가 잉여다 — 스냅샷이 1건이고 한 판을 통째로 굽는다. **M6 증분이 오면
아니다.** 증분은 일부 필드만 새 스냅샷으로 갱신하고 나머지는 옛 값을 둔다. 그 순간
`canonical` 은 출처가 섞이고, 행 단위 표식이 없으면 무엇이 갱신됐는지 DB 가 스스로
못 말한다.

**지금 넣는 것이 싸다.** 15,534행에 채울 값의 후보가 하나뿐이라 추측이 없다(3절).
나중에 넣으면 그때는 추측해야 한다.

### 결정 3 · 표 둘 — `ref_exception` 은 합치고 `ego_granted_axis` 는 따로

`TRIGGER_EXCEPTION` 과 `TOKEN_EXCEPTION` 은 **값 모양이 같다**(`{refKind, refId}`).
키의 출처만 다르다. `kind` 열로 갈라 한 표에 담는다. `EGO_GRANTED` 는 1:N 이라
모양이 달라 따로 둔다.

같은 모양을 두 번 적지 않고, 검사가 `kind` 별 행 수를 박을 수 있다.

### 결정 4 · 재현 대조는 **입력 지문을 먼저 본다**

다르다는 것이 곧 실패가 아니다.

```
저작이 바뀌었다        → 다른 게 정상이다
코드가 바뀌었다        → 다른 게 정상이다
입력이 같은데 다르다    → 이것만 경보다.  누가 canonical 을 직접 건드렸다
```

그래서 `authored_digest` 가 `build_info` 에 필요하다. `snapshot_id` 와 `code_commit`
만으로는 등식이 안 닫힌다 — 저작 표가 세 번째 입력이 됐기 때문이다.

## 6. 스키마 변경

### 6.1 `app` — 저작 표 둘

```prisma
/// 이름 매칭이 못 푸는 참조. 게임의 사실이며 규칙이 아니다.
/// kind='trigger'  키는 트리거 표시명
/// kind='token'    키는 desc 안의 브래킷 토큰
model RefException {
  kind    String
  key     String
  refKind String @map("ref_kind")
  refId   String @map("ref_id")
  note    String

  @@id([kind, key])
  @@map("ref_exception")
  @@schema("app")
}

/// 「이 인격은 [X]를 부여하는 인격으로 취급됨」을 명시한 E.G.O.
/// 증폭기(20705 홀리데이)는 여기 없다 — ego_status 로 축을 받지만 그 축의 인격이 아니다.
model EgoGrantedAxis {
  egoId  String @map("ego_id")
  axisId String @map("axis_id")
  note   String

  @@id([egoId, axisId])
  @@map("ego_granted_axis")
  @@schema("app")
}
```

들어갈 값 7행.

```
ref_exception     kind='trigger'  'Bloodfiend Identities' → unit_keyword · BLOODFIEND
                  kind='trigger'  'Yurodivy Identities'   → association  · YURODIVY
                  kind='token'    'BLOODDINNER'           → unit_keyword · BLOODFIEND
ego_granted_axis  20509 → LACERATION · BREATH
                  20109 → VIBRATION · SINKING
```

**FK 는 걸지 않는다.** 대상이 `canonical` 에 있는데 `app → canonical` FK 는 승격 때
재조준 대상이 되어(ADR-07 3.2) 교체를 무겁게 만든다. 대신 **적재기가 선검사한다** —
`ref_id` 나 `axis_id` 가 `canonical` 에 없으면 build 가 거기서 멈춘다. 실패 방향이
안전하다.

### 6.2 `canonical.build_info` — 판 표식

```prisma
/// 이 판이 무엇에서 나왔나. **한 행만 존재한다.**
model BuildInfo {
  id             Int      @id @default(1)
  snapshotId     String   @map("snapshot_id")
  codeCommit     String   @map("code_commit")
  /// app 저작 표 둘의 내용 해시. 무엇을 넣고 구웠나
  authoredDigest String   @map("authored_digest")
  builtAt        DateTime @map("built_at") @db.Timestamptz(3)
  rowCount       Int      @map("row_count")

  @@map("build_info")
  @@schema("canonical")
}
```

한 행 제약을 **DB 로 건다** — `CHECK (id = 1)`. 두 행이 생기면 「어느 판이 진짜냐」에
답이 없어진다. Prisma 가 `CHECK` 를 못 내므로 수동 DDL 로 둔다. **그 자리는 이미
있다** — `prisma/v2/views.sql` 이 `canonical.v_identity_capability` 를 같은 방식으로
만든다(`schema.sql` 에는 없다).

**`v2:build` 의 DDL 추출이 이걸 어떻게 다루는지 확인해야 한다.** 지금
`extractCanonicalDdl` 은 `schema.sql` 블록만 거른다. 수동 DDL 이 빌드 경로에
어떻게 들어가는지가 10절의 열린 항목이다.

`snapshot_id` 는 `raw.snapshot` 을 가리키지만 **FK 를 걸지 않는다.** 걸면
`canonical → raw` 의존이 생겨 승격 때 재조준 대상이 는다. 검사로 지킨다.

### 6.3 `canonical.field_source` — `snapshot_id` 열

```
+ snapshotId String @map("snapshot_id")
+ @@index([snapshotId])
```

백필은 15,534행 전부 `'2026-07-25'`. 스냅샷이 1건이라 추측이 없다.

## 7. `v2:verify:rebuild` — 등식을 검사한다

**이름이 `v2:reproduce` 가 아니다.** 그건 이미 있고 다른 일을 한다(4.2).

```
v2:reproduce         전 과정 재현.  수집기부터 다시 밟는다.  파괴적.  드물게
v2:verify:rebuild    canonical 만 다시 구워 대조.  비파괴적.  자주
v2:diff              승격하면 무엇이 바뀌나.  미래를 본다
v2:verify:canonical  규칙 203건.  표본
```

절차.

```
1  build_info 를 읽는다                       snapshot · 커밋 · 저작 지문 · 행 수
2  지금 입력의 지문을 다시 잰다                 app 저작 표 해시 · git HEAD
3  달라진 것이 있으면 그것부터 보고한다          「저작이 바뀌었다」 · 「코드가 바뀌었다」
4  그 snapshot 의 raw 로 wip 을 굽는다          v2:build 와 같은 경로
5  wip 과 canonical 을 대조한다                94테이블 · 행 수 · 내용
6  판정
```

**3단계가 5단계 앞에 오는 것이 이 명령의 요점이다.** 입력이 달라졌으면 결과가 다른
것이 정상이고, 그때 「재현 실패」라고 말하면 거짓말이다.

판정 넷.

```
재현됨          입력 같음 · 결과 같음
입력이 바뀜      저작 또는 코드가 다르다.  build 를 다시 돌릴 때다
재현 실패        입력 같음 · 결과 다름   ← 경보.  누가 canonical 을 직접 건드렸다
판정 불가        build_info 가 없거나 두 행이다
```

대조는 `v2:diff` 의 대조부를 쓴다 — `diff-canonical.ts` 의 `entityDiff` · `tableNames`
가 이미 두 스키마를 표 단위로 비교한다. **지금은 모듈 내부 함수라 export 가 필요하다.**
`schema-ops.ts` 가 그랬듯 순수한 부분을 밖으로 빼서 DB 없이 테스트한다.

## 8. 기존 것에 미치는 영향

```
src/v2/reproduce.ts    DROP 대상에서 app 을 뺀다 (4.2)
                       덤프 대조에서 built_at 줄을 걸러낸다 (4.3)
src/v2/canonical/      상수 셋을 지우고 app 에서 읽는다.  DENOMINATOR 는 남는다
src/v2/build-canonical.ts   build_info 를 쓴다.  저작 선검사를 건다
prisma/v2/schema.prisma     표 셋 추가 · field_source 열 하나
docs/adr/07 §3         경계를 다시 긋는다 → ADR-08 로 남기고 07 에 후속을 적는다
```

**적재기 테스트가 바뀐다.** 지금 `identity-axis.test.ts` 는 `EGO_GRANTED` 를 import
해서 단언한다(`assert.deepEqual(Object.keys(EGO_GRANTED).sort(), ['20109','20509'])`).
상수가 사라지므로 그 단언은 **입력을 주입받는 형태**로 바꾼다 — 순수 함수 부분은
그대로 두고 값만 밖에서 온다.

## 9. 검증 계획

```
검사 203건        그대로 통과해야 한다.  이 PR 은 canonical 의 값을 안 바꾼다
새 검사           build_info 1행 · field_source snapshot_id 결손 0
                  ref_exception kind 별 2·1 · ego_granted_axis 4행
                  저작 표의 ref_id · axis_id 가 canonical 에 전부 있다
v2:verify:rebuild  「재현됨」이 나와야 한다.  이게 이 PR 의 산출물이다
승격 왕복          build → diff → promote → verify → rollback → verify → promote
```

**이 PR 이 M1 의 미검증 항목 하나를 태운다.** ADR-07 6절이 「차이가 있는 새 판을
승격해 본 적이 없다」를 남겼다. 이 PR 은 스키마를 바꾸므로 반드시 차이가 있는 판을
승격하게 된다.

**값은 안 바뀌고 구조만 바뀐다**는 것이 `v2:diff` 로 확인되어야 한다 — 표 셋이 늘고
열 하나가 늘 뿐, 152,399행의 내용은 그대로다.

## 10. 열린 것

```
authored_digest 를 무엇으로 재나     표 둘의 정렬된 내용을 sha256.  열 순서·정렬 기준을 못 박아야 한다
code_commit 을 어떻게 얻나          git rev-parse HEAD.  더러운 작업트리는 어떻게 표시하나
build_info 의 CHECK 를 어디에 두나   views.sql 옆.  v2:build 의 DDL 추출이 수동 DDL 을 어떻게 다루나
built_at 을 build_info 에 두나      4.3 이 덤프 대조를 깬다.  걸러내는 대신 뺄 수도 있다
```

셋 다 구현 중에 실측으로 닫는다.

## 11. 범위 밖 — 그다음

```
증분 파이프라인        M6.  이 PR 은 그 기준점만 심는다
앱 전환 · public 폐기  M3.  읽는 곳을 바꾸는 작업
DENOMINATOR 데이터화   안 한다 (결정 1)
다른 canonical 표에 snapshot_id   field_source 하나로 충분하다.  나머지는 build_info 가 판 단위로 답한다
```
