# ADR-08. 사실은 데이터로, 규칙은 코드로 (Authored Facts as Data)

> 결정 2026-08-05 · 구현 완료 2026-08-05
> 설계 [`docs/superpowers/specs/2026-08-05-snapshot-anchor-design.md`](../superpowers/specs/2026-08-05-snapshot-anchor-design.md)
> 선행 [ADR-07 `canonical` 은 승격으로만 바뀐다](07-canonical-promotion.md) · [ADR-06 3스키마 데이터베이스](06-three-schema-database.md)

## 1. 맥락

ADR-07 이 `canonical` 을 승격 대상으로 바꿔 파괴적 적재로부터 지켰다. **그 대가로
새 길이 열렸다.**

```
1  새 저작 지식이 생긴다
2  전체 재빌드는 무겁다 — 152,399행을 다시 굽고 승격해야 하고,
   그 사이클이 대기 중인 다른 변경까지 끌고 온다
3  canonical 을 직접 UPDATE 하는 쪽이 훨씬 싸다.  그렇게 한다
4  canonical 에 코드로 재현 못 하는 값이 생긴다
5  재빌드가 그것을 지운다 → 아무도 v2:build 를 못 돌린다
```

「`canonical` 을 안 지운다」를 보장했더니 「`canonical` 을 다시 만들 수 없게 되는」
길이 열렸다.

**ADR-07 §7 의 진단은 정확하지 않았다.** 거기서는 저작 표가 「아무도 다시 읽지 않는
좀비」가 된다고 적었는데, `v2:build` 는 코드를 계속 읽는다. 좀비가 아니었다. 진짜
위험은 위의 3→5 이고, 이 ADR 은 그 길을 막는다.

## 2. 결정 — 경계를 다시 긋는다

ADR-07 §3 은 「구조 저작 = 코드」로 그었다. 그 줄을 이렇게 바꾼다.

```
규칙 (어떻게 찾아 쓰는가)         →  코드.  테스트가 지킨다
규칙이 참조하는 사실 (게임의 진실)  →  app.  데이터로 산다
```

**판별은 하나다 — 이건 게임이 정한 것인가, 우리가 정한 것인가.**

「Bloodfiend 가 소속이 아니라 유닛 키워드다」는 게임의 사실이다 → 데이터.
「desc 에서 정규식으로 분모를 뽑는다」는 우리가 정한 방법이다 → 코드.

`app` 인 이유는 [ADR-07 2.1](07-canonical-promotion.md) 의 승격 구조에서 나온다 —
**승격이 `canonical` 을 통째로 갈아치우므로 재빌드의 입력은 그 밖에 있어야 한다.**
자기 자신을 입력으로 삼을 수는 없다.

## 3. 무엇이 어디로 갔나

```
app.ref_exception        kind · key · ref_kind · ref_id · note          3행
  kind='trigger'  'Bloodfiend Identities' → unit_keyword · BLOODFIEND
  kind='trigger'  'Yurodivy Identities'   → association  · YURODIVY
  kind='token'    'BLOODDINNER'           → unit_keyword · BLOODFIEND

app.ego_granted_axis     ego_id · axis_id · note                        4행
  20509 착영휘도   → LACERATION · BREATH
  20109 엄숙한 애도 → VIBRATION · SINKING
```

**코드에 남은 것 — `DENOMINATOR` 정규식 6개** (`gift-trigger-param.ts`).

기프트 desc 산문에 정규식을 걸어 분모를 뽑는 파싱 규칙이고 **순서가 의미를 갖는다** —
「대기 인원에」를 뒤에 두면 9778 이 엉뚱한 분모를 받는다. DB 에 두면 테스트가 못
지키고, 한 글자 틀리면 build 가 **조용히 틀린 분모**를 낸다. 분모를 틀리면 「N인
이상」 판정이 전부 틀린다(편성 12 vs 출전 7). 실패 방향이 안전하지 않다.

`app.field_override`(값 정정 5행)는 ADR-07 §3 그대로다. 이 ADR 은 그 칸을 안 건드린다.

## 4. FK 를 안 거는 이유 — 선검사로 지킨다

`app → canonical` FK 는 걸지 않는다. 걸면 승격 때 재조준 대상이 되어([ADR-07 3.2](07-canonical-promotion.md))
교체가 무거워진다. `canonical.build_info → raw.snapshot` 도 같은 이유로 안 건다.

대신 **적재기가 굽기 전에 선검사한다**(`authored.ts` 의 `unknownRefs`). 저작이
가리키는 `ref_id` · `axis_id` 가 `canonical` 에 없으면 거기서 멈춘다.

**실측으로 확인했다.** 시험 삼아 `ego_granted_axis` 에 `('20509','BURN')` 을 넣었는데
`BURN` 은 축이 아니다(축은 COMBUSTION · LACERATION · VIBRATION · BURST · SINKING ·
BREATH · CHARGE · BULLET). 굽기가 그 자리에서 멈췄고, 살아있는 판은 `canonical_hold`
에 온전히 남았다. 안고 구웠으면 **조용히 빈 축**이 나왔을 것이고 그건 검사 214건이
못 잡는 자리다.

`ego_id` 가 없는 것은 선검사가 안 잡는다. 새 E.G.O 가 나오기 전에 그 사실을 먼저
적어 둘 수 있어야 하고, `identity-axis` 가 결손으로 기록하는 경로가 이미 있다.

## 5. 판 표식과 출처 추적

```
canonical.build_info      한 행.  CHECK (id = 1) 로 DB 가 건다
  snapshot_id             어느 raw 에서 왔나
  code_commit             어느 코드로 구웠나.  더러운 트리면 -dirty
  authored_digest         어떤 저작을 넣고 구웠나.  note 는 안 들어간다
  built_at · row_count

canonical.field_source    snapshot_id 열 추가.  15,534행 전부 2026-07-25
```

`authored_digest` 가 필요한 이유는 **저작이 세 번째 입력이 됐기 때문**이다.
`snapshot_id` 와 `code_commit` 만으로는 등식이 안 닫힌다.

`note` 를 지문에서 빼는 것은 **설명을 고치는 일이 결과를 안 바꾸기 때문**이다.
실측으로 확인했다 — `note` 에 문자열을 덧붙여도 지문이 `e13a5e3a0d0b` 그대로였다.

`field_source.snapshot_id` 는 지금 잉여다. 스냅샷이 1건이고 한 판을 통째로 굽는다.
**M6 증분이 오면 아니다** — 일부 필드만 새 스냅샷으로 갱신되고 나머지는 옛 값이 남아
행마다 갈린다. 그때 이 열이 유일한 갱신 증거다. 지금 넣는 것이 싼 이유는 채울 값의
후보가 하나뿐이라 추측이 없어서다.

## 6. `v2:verify:rebuild` — 등식을 전수로 검사한다

```
v2:reproduce         전 과정 재현.  수집기부터 다시 밟는다.  파괴적.  드물게
v2:verify:rebuild    canonical 만 다시 구워 대조.  비파괴적.  자주
v2:diff              승격하면 무엇이 바뀌나.  미래를 본다
v2:verify:canonical  규칙 214건.  표본
```

**입력 지문을 결과 대조보다 먼저 본다.** 저작이나 코드가 바뀌었으면 결과가 다른 것이
정상이고, 그때 「재현 실패」라고 말하면 거짓말이다.

```
재현됨        입력 같음 · 결과 같음
입력이 바뀜    저작 또는 코드가 다르다.  build 를 다시 돌릴 때다
재현 실패      입력 같음 · 결과 다름   ← 경보.  누가 canonical 을 직접 건드렸다
판정 불가      build_info 가 없거나 두 행이다
```

**대조는 표마다 전 컬럼을 해시로 잰다.** `v2:diff` 의 개체 대조를 쓰려다 말았다 —
그건 id 집합만 보므로 「id 도 행수도 그대로인 컬럼 값 변경」을 못 잡는데,
[ADR-07 §3](07-canonical-promotion.md) 이 그것을 정정의 전형이라고 적었다. 재현
검사가 잡아야 할 것이 바로 그 종류다.

세 갈래를 실제로 태웠다.

```
재현됨       표 94개 전수 대조 · 다른 표 0개 · 종료 0
입력이 바뀜   커밋을 바꾸고 실행 → 「코드가 달라졌다」 · 결과는 같음까지 구분 · 종료 0
재현 실패     canonical.identity_axis 에서 1행 삭제 → 그 표를 짚음 · 종료 1
```

## 7. 안 되는 것 — 정직하게 적는다

**「코드 배포 없이 저작을 고칠 수 있다」는 참이 아니다.**

설계에서 그렇게 적었으나 검증에서 틀렸음이 드러났다. 저작 1행을 늘리자
`ego_granted_axis` 정확 수치 검사뿐 아니라 **`identity_axis` 행 수 검사까지** 깨졌다.
검사 214건이 `canonical` 의 현재 모양을 실측으로 박아 두기 때문이다. 저작을 바꾸면
결국 검사도 고쳐야 하고, 그건 코드 변경이다.

**실제로 남는 이득 셋은 그대로다.**

```
재현성   저작이 승격 밖에 살아 재빌드가 안 지운다 — 이 ADR 의 목적 그 자체
선검사   없는 참조를 굽기 전에 잡는다 (4절의 BURN 실측)
지문     저작이 바뀌었는지 DB 가 스스로 답한다
```

## 8. 곁가지로 고친 것 둘

**`v2:build` 가 구조가 바뀌는 판을 못 굽고 있었다.** 새로 구운 표 수를 살아있는 판과
견주고 다르면 멈췄다 — 그러면 표를 더하는 변경을 영영 못 굽는다. 이 ADR 의
`build_info` 가 그 자리에서 막혔다(95 vs 94). 대조 상대를 **방금 실행한 DDL 의 선언
수**로 바꿨다. 잡고 싶은 것은 「내가 실행한 문장이 낸 표가 다 섰는가」이지 「구조가
그대로인가」가 아니다. 구조가 바뀐 것은 막지 않고 알린다.

[ADR-07 §6](07-canonical-promotion.md) 이 「차이가 있는 새 판을 승격해 본 적이 없다」를
미검증으로 남겼는데, **이 PR 이 그것을 태웠다.** 표 하나가 늘어난 판을 실제로 승격했고
검사 214건이 통과했다.

**`v2:reproduce` 가 `app` 을 지우고 있었다.** 저작이 `app` 으로 내려온 지금, 그 시험은
자기가 검증하려는 입력을 없애고 굽는 꼴이 된다. `app` 의 행을 따로 떠 두었다가 되넣게
고쳤다. `built_at` 이 바이트 단위 덤프 대조를 깨는 것도 함께 막았다.

## 9. 남은 것

```
snapshot_id 의 진짜 쓰임    M6 증분.  지금은 전 행이 같은 값이다
저작이 늘 때의 검사 갱신     7절.  검사 214건이 canonical 의 모양을 박고 있다
v2:reproduce 실전            --run 을 안 돌렸다.  상류 재수집에 걸린다
```
