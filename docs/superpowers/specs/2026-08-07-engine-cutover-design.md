# 엔진 전환 — 추천 화면이 `lib/engine/v2` 를 쓰고 `public` 이 물러난다

> 설계 2026-08-07 · 선행 [ADR-05 웹 서빙](../../adr/05-web-serving.md) · [ADR-08 사실은 데이터로](../../adr/08-authored-facts-as-data.md)
> 이 문서의 수치는 **실측이다.** 2절과 4절은 코드를 읽고 DB 에 물어 얻었다.
> 구현 전이므로 5절 이후는 계획이다.

## 1. 무엇을 바꾸나

**마지막 `public` 소비자를 없앤다.**

[앱 전환](2026-08-05-app-cutover-design.md)이 정보 화면 15개를 `canonical` 로 옮기고
`public` 을 읽는 곳을 하나로 좁혔다. 그 하나가 `lib/engine/load.ts` 이고, 추천 화면이
레거시 엔진을 통해 그것을 본다.

```
지금    recommend → queries/recommend → lib/engine{load,pack,state,vocab} → public
이후    recommend → queries/canonical/recommend → lib/engine/v2 → canonical
        lib/engine/* 삭제 · public → public_retired
```

**완료 조건은 하나다 — `public` 을 읽는 코드가 0.**

## 2. 두 엔진은 층위가 다르다 — 옮기는 게 아니라 바꾸는 것이다

로드맵은 M4 를 「기프트 등급 → 팩 순위」로 적었지만, **레거시에는 팩 순위가 이미 있다.**
실측하면 이렇다.

```
레거시 lib/engine (1,334줄 + 테스트 281줄)     v2 lib/engine/v2 (500줄 + 테스트 411줄)
  rankPacks → PackScore[]                        evaluateGifts → GiftVerdict[]
    score · 6성분 분해                              grade A/B/C
    top 기프트 · reasons(문자열)                     decidable/satisfied/certain/total
    dropped (뺀 팩과 이유)                          reasons (구조화)
                                                 chain — 연쇄 1~2홉
  vocab.ts 500줄 저작층                           canonical 이 구조로 답한다
  public 을 읽는다                                canonical 을 읽는다
```

**레거시 점수가 기대는 것이 `canonical` 에 없다.**

```
marginalValue        기프트가 얼마나 세지나 — 수치 델타.  없다
ceiling              최대 페이오프.  없다
gift.effects[].condition   조건 DSL.  canonical 은 trigger_ref 로 구조화했다
statusSupply         Profile 이 다른 모양으로 갖는다
fusionProgress       레거시에서도 0 이다 — 구현 안 됨
```

레거시는 「이 기프트가 **얼마나 세지나**」를 수치로 재고, v2 는 「이 기프트가 **켜지나**」를
근거와 함께 답한다. 성분을 그대로 옮길 수 없다.

## 3. 그래서 둘로 나눈다

```
PR-A (이 PR)   추천 화면을 v2 로 · 레거시 엔진 삭제 · public 물러남
               팩 순위가 일시적으로 사라진다

PR-B           그 위에 새 점수 모형.  저울추는 PR-A 를 써 보고 정한다
```

**로드맵이 「M3 뒤 실제로 써 보고 정해야 한다」고 적은 것이 이 순서의 근거다.** 지금
저울추를 정하면 추측이 된다 — v2 의 등급과 근거를 화면에서 실제로 보고 나서 정한다.

## 4. 마지막 걸림돌이 없다 — `identity_axis` 가 이미 접었다

`canonical/squad.ts` 가 `lib/engine/vocab` 의 `statusKeyOf` 를 쓴다. 그것만 남으면
`lib/engine` 을 못 지운다. **실측으로 대체가 확인됐다.**

```
statusKeyOf          정규식 10개로 상태 id 1,472종을 축으로 접는다 (코드)
canonical.identity_axis   같은 접기가 이미 데이터로 있다 (628행)
                     source = keyword 266 · special_status 300 · ego_granted 62

실측 — 인격 10208
  statusKeyOf 경로     bleed · poise
  identity_axis        LACERATION(keyword·special_status) · BREATH(keyword·special_status)
```

같은 판정이다. 어휘만 원본 id 로 바뀐다 — [앱 전환](2026-08-05-app-cutover-design.md)에서
`burn → Combustion` 을 받아들인 것과 같은 방향이다.

**이게 오히려 옳다.** 정규식 표(코드)가 아니라 적재기가 판정한 결과(데이터)를 읽는 것이고,
[ADR-08](../../adr/08-authored-facts-as-data.md) 의 「규칙은 코드 · 사실은 데이터」와
같은 판단이다. `identity_axis` 는 검사 203건이 지키고 `v2:verify:rebuild` 가 재현을
보증하지만, `vocab.ts` 의 정규식은 아무도 안 지킨다.

## 5. 화면이 잃는 것과 얻는 것

**화면은 아직 미완성이다.** 정보 제공 화면의 디자인 작업이 진행 중이고, 팩 추천은
엔진이 완성된 뒤에 세운다. 그러니 추천 화면은 **제품 표면이 아니라 엔진이 실제로
도는지 보이는 창**이다. 이 절은 그 전제 위에 있다.

```
잃는다   팩 점수 · 6성분 분해 · 팩 순위 · dropped
얻는다   기프트 등급 A/B/C 와 구조화된 근거
        「진혼 화상 6 ≥ 5 출전 분모 → 발동」
        연쇄 1~2홉 — 보유 기프트가 아직 안 켜진 기프트를 켠다
유지     덱 표시 · 상태/죄악/소속 공급 · 출전 수.  Profile 이 같은 것을 갖는다
```

**순위를 매기지 않고 늘어놓는다.** 점수 모형이 없는데 순서를 붙이면 그 순서가
거짓말이 된다. 층 후보 팩을 그대로 두고 각 팩의 기프트를 등급별로 센다 — 사람이
분포를 보고 고른다. PR-B 가 그 위에 점수를 얹는다.

**화면 구조는 최소로 바꾼다.** 미완성 디자인에 공을 들이면 그 작업이 두 번 된다.

## 6. `public` 은 이름만 바꾼다 — 지우지 않는다

```
1  코드에서 public 참조를 0 으로 만든다
2  덤프를 뜬다 — 저장소 밖 ../limbus-db-backups/.  M1 의 canonical_bak 과 같은 자리
3  ALTER SCHEMA public RENAME TO public_retired
4  앱이 도는지 확인한다 (화면 21개)
5  검사 222건 · 테스트 · 빌드
6  DROP 은 안 한다 — 다음 PR
```

**되돌리기가 `ALTER SCHEMA` 한 줄이다.** 화면이 아직 미완성이라 되돌릴 일이 생길 수
있고, 스키마가 남아 있어도 읽는 코드가 0 이면 이 PR 의 목적은 달성된다.

**주의 — `public` 은 PostgreSQL 의 기본 스키마다.** 이름을 바꾸면 `search_path` 에
기대는 것이 깨질 수 있다. 무엇이 그러는지는 구현 중에 실측한다(8절).

## 7. 검증

```
골든 대조     아무것도 바꾸기 전에 before 를 뜬다.  산출물은 gitignore 대상이라
             워크트리마다 새로 떠야 한다 — 지금 build/golden/ 은 비어 있다
             squad 회귀가 핵심이다 — statusKeyOf → identity_axis 로 바꾸므로
앱 실행       화면 21개.  이번엔 처음부터 한다(앱 전환 때 마지막에 몰아 했다)
검사 222건    그대로 통과해야 한다.  이 PR 은 canonical 을 안 바꾼다
public 참조   grep -rln "@/lib/db'" 가 0
Prisma 생성   워크트리·브랜치를 바꿀 때마다 npm run v2:generate 가 필요하다.
             앱 전환에서 두 번 밟았다 — src/v2/generated 가 gitignore 대상이다
             (이 워크트리는 판 뒤에 바로 돌려 뒀다)
```

**추천 화면은 골든으로 못 맞춘다.** 계약이 바뀌므로 before/after 가 다른 것이 정상이다.
골든이 지키는 것은 **나머지 20건이 안 깨졌다**는 것이며, 그중 `squad.listSquad` 와
`squad.listSquadAxes` 가 이 PR 에서 실제로 손대는 유일한 자리다.

## 8. 열린 것

```
public 이름 바꾸기의 부작용   search_path · 확장(extension) · 기본 권한이 걸릴 수 있다
                          Prisma v1 클라이언트도 그 이름을 굳혀 갖고 있다
추천 화면의 최소 모양        미완성 디자인이라 구조를 얼마나 건드릴지
squad 의 축 어휘 변경        keywords 배열의 값이 burn → COMBUSTION 이 된다.
                          화면 라벨은 listSquadAxes 가 주므로 표시는 유지될 것이나 미확인
```

셋 다 구현 중에 실측으로 닫는다.

## 9. 범위 밖 — 그다음

```
팩 점수 모형        PR-B.  저울추는 이 PR 을 써 보고 정한다
DROP SCHEMA        그다음.  덤프와 이름 바꾸기까지만 한다
증분 파이프라인      M6
Neo4j 투영         M7
```
