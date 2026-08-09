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

## 8. 열렸던 것 — 셋 다 실측으로 닫았다

### 8.1 `public` 이름 바꾸기의 부작용 — 없었다

```
public 의 확장       없음.  plpgsql 은 pg_catalog 에 있어 무관하다
search_path         "$user", public.  이름이 바뀌어도 v2 는 스키마를 명시해 질의한다
Prisma v1 클라이언트   함께 지웠다.  그것이 부작용을 없앤 방법이다
```

**v1 클라이언트를 남겨 두는 선택지가 실은 없었다.** 스키마 이름이 바뀌는 순간
`src/load.ts` · `src/verify.ts` · `src/engine-proof.ts` 셋이 못 돈다. 남기면
지뢰라서 `prisma/schema.prisma` 와 함께 지웠다 — **설계가 예상한 범위보다 넓다.**

### 8.2 추천 화면의 최소 모양 — 순위 자리를 등급 분포로

```
지웠다   rec.result.ranked (순위 · 점수 · 6성분 분해) · dropped Panel
넣었다   팩별 tally {A,B,C} 와 A 등급 기프트 5개까지의 근거
         충족/판정가능 · 「가능 포함」 표기 · 연쇄 홉수
합쳤다   공급 막대 3개 → rec.supply 하나
```

**공급은 설계가 적은 3묶음이 아니라 8묶음이었다.** `v_identity_capability` 가
`axis` · `sin` · `association` 말고도 `skill_kind` · `resonance` ·
`unit_keyword` · `coin` · `attack_type` 을 낸다. 조건 평가가 그 전부를 보므로
셋만 그리면 나머지 다섯은 왜 켜졌는지 설명할 자리가 없다 — 전부 그린다.

### 8.3 squad 의 축 어휘 — `COMBUSTION` 이 아니라 `Combustion` 이고, 라벨은 **원래 안 붙고 있었다**

설계는 「표시는 유지될 것이나 미확인」이라 적었다. 재 보니 **유지할 표시가
없었다.**

```
레거시   listSquad 가 poise · tremor 를 냈다
         listSquadAxes 의 라벨 표는 Breath · Vibration 로 키를 잡는다
         → 겹치는 키가 하나도 없다.  화면이 원본 id 를 날것으로 그리고 있었다
```

축 id 는 keyword id 의 대문자일 뿐이라(`Combustion` → `COMBUSTION`) 되돌리면
`canonical/list.ts` 와 어휘가 같아진다. 태그 9종이 전부 라벨을 얻었고, 이
결함이 함께 닫혔다.

**아이콘 9종은 여전히 `null` 이고 그것은 전과 같다.** 파일명이 영문 표시명이라
(`Combustion` 이 아니라 `Burn.webp`) `keywordIcon(id)` 이 못 찾는다. `list.ts`
는 `iconKey` 로 en 이름을 함께 내려 풀었다. **이 PR 에서 안 고쳤다** — 화면이
글자로 그리고 있고 디자인 범위다.

## 8.5 닫으면서 새로 연 것

```
VibrationExplosion    canonical.status_category 에 행이 아예 없다
BulletLament          BULLET 로 분류돼 있으나 id 직접 대조라 안 걸린다 (20109)
                      list.ts 가 제 주석에 적어 둔 「두 방식이 다르다」의 같은 사례
```

**이 PR 은 `canonical` 을 안 바꾸므로 여기서 안 고친다.** 관측으로 남긴다.

> **정정 (2026-08-09) — 앞의 첫 줄에 「판정 누락이다」라고 적었던 것은 틀렸다.**
>
> 결손이 아니라 **원본 그대로**다. `status_category` 는 우리가 유도하는 표가
> 아니라 게임 자산의 `categoryKeywordList` 를 옮긴 것이고(`canonical/statuses.ts`),
> 원본을 열어 보면 이렇다.
>
> ```
> Combustion           ["SIN", "COMBUSTION"]      태그 있음
> Vibration            ["SIN", "VIBRATION"]       태그 있음
> VibrationExplosion   (없음)                      게임이 안 붙였다
> ```
>
> **게임의 분류가 우리 8축보다 촘촘하다.** 진동 파생을 `VIBRATION_CONVERTED`
> (9종) · `VIBRATION_MERGED`(1종)로 따로 묶고, 진동 폭발에는 아무것도 안 붙인다.
> 「`status_category` 의 카테고리 중 **트리거가 참조하는 8종만** 축」이라는
> 규칙은 `canonical/axis.ts` 에 적힌 의도된 선택이며, 주살(`BURSTREACTIVE`) ·
> 마탄(`FREISHUTZ_OUTIS_EGO_BULLET`) · 원호 방어도 같은 이유로 축이 아니다.
>
> **태그를 잃은 넷은 회귀가 아니라 교정이었다.** 10705 를 게임은
> `Burst` · `Sinking` 인격으로 태그한다 — 진동 폭발을 걸어도 진동 인격이
> 아니다. 레거시 정규식이 `VibrationExplosion` 을 부분 문자열로 집어
> 없는 축을 붙이고 있었다.
>
> **이 판정은 이미 두 번 적혀 있었다.**
>
> ```
> 08-gimmick-keywords.md 4.1   「①이 기프트 조건 카운트의 판정 기준이다」
>                              ① 은 게임이 붙인 키워드다.  같은 문서의 표가
>                              10705 을 ① rupture·sinking / ③ tremor 로 갈라 적었다
> 2026-08-03-…-design.md       「status_category 0행 → 축 NULL」
> ```
>
> **확립된 판정을 다시 열어 「누락」이라 부른 것이 이 문서의 잘못이다.**
>
> 그대로 뒀으면 다음 회차가 없는 결손을 메우려 들어 `canonical` 을 원본과
> 어긋나게 만들었을 것이다.

## 9. 구현 결과

41 파일 · +1,928 / −4,247.

### 9.1 무엇이 오갔나

```
새로 생겼다
  lib/queries/canonical/recommend.ts          v2 엔진을 화면에 엮는다
  lib/queries/canonical/recommend.test.ts     rangeCovers 순수 검사 4건
  scripts/retire-public.ts                    덤프 + 이름 바꾸기 · 되돌리기

지웠다 — 앱 층
  lib/engine/{dsl,load,pack,score,state,tuning,vocab}.ts      1,334줄
  lib/engine/{dsl,status-key,vocab}.test.ts                     281줄
  lib/queries/recommend.ts · lib/db.ts

지웠다 — 파이프라인 층 (설계 범위 밖이었다.  8.1 절 참고)
  src/load.ts · src/verify.ts · src/engine-proof.ts
  prisma/schema.prisma · prisma/schema.sql
  npm 스크립트 7개 · CI 의 v1 DDL 드리프트 단계

옮겼다
  Locale 타입   @prisma/client → @/lib/locale   (화면 14곳)
```

**`Locale` 이 집을 옮긴 이유가 설계에 없었다.** v1 스키마의 `enum Locale` 을
화면이 가져다 쓰고 있었고 스키마를 지우면 그 출처가 사라진다. 캐노니컬
클라이언트의 `$Enums.Locale` 은 `ja` 를 포함해 여기와 다르다 — **데이터가 담은
로케일과 화면이 내보내는 로케일은 별개**이며, 그 차이를 타입으로 유지하려면
좁은 쪽을 따로 적어야 한다.

### 9.2 골든 대조 — 20건 중 squad 둘만 달랐다

어휘 변경(`burn` → `Combustion` 류)을 벗기면 294개체 중 10건이 갈린다.

```
얻는다 3   10208 · 10304 · 10504 가 Laceration 을 얻는다
           게임이 붙인 identity_keyword 태그인데 레거시는 상태만 봐서 놓쳤다

잃는다 5   10705 · 20503 · 20903 · 21104 가 Vibration,  20109 가 Bullet
           레거시 정규식의 부분 문자열 오탐 (VibrationExplosion · BulletLament)

잃는다 2   10807 · 11007 이 Protection 을 잃는다 — BurstProtection 이었다
           list.ts 가 이미 적어 둔 「보호 15」와 여기서 맞는다
```

### 9.3 앱 실측 — 이 단계에서 진짜 버그를 잡았다

경로 20개 전부 200 · 서버 에러 0.

```
추천   팩 후보 27 · 등급 A 965 · B 698 · C 327
       공급 8묶음.  axis COMBUSTION 7 · VIBRATION 6 · BULLET 3 · BREATH 1
       연쇄는 보유 3개면 120건에 붙고 0개면 0건
편성   페이로드에 keywords ["Breath"] 와 labels {"Breath":"호흡"} 이 함께 있다
```

**`[] ?? x` 는 `[]` 다.** 화면은 주소에 `deployed` 가 없으면 빈 배열을 넘기는데
`options.deployedIds ?? identityIds` 가 그것을 값으로 받았다. 출전 분모가 0 이
되고, 조건 판정의 기본 분모가 출전이라 `Profile` 이 세는 인원이 전부 0 이 됐다.
공급 패널이 통째로 비었고 기프트 충족 수도 낮게 나왔다(`1/2` 로 보이던 것이
실제 `3/4`).

**질의를 직접 부르면 41건이 나오는데 화면만 0 이었다.** 호출자가 넘기는 값이
달랐기 때문이며, **화면을 안 띄웠으면 못 봤을 자리다.** 앞 PR 에서 마지막에
몰아 확인했다가 낡은 Prisma 클라이언트를 늦게 발견한 것과 같은 종류다.

### 9.4 검증

```
public 참조      grep -rn "@/lib/db'"  → 0건.  이 PR 의 완료 조건
검사             222건 전부 통과.  캐노니컬을 안 바꿨으니 그대로여야 한다
단위 검사         489 → 457 (레거시 32건 삭제) · 0 실패
타입 검사 · 빌드   통과
덤프             4.9 MB → 저장소 밖 ../limbus-db-backups/public-retired.sql
```

**로컬 통과가 CI 통과를 뜻하지 않았다.** CI 가 `npm run generate` 를 부르는데
그 스크립트를 v1 스키마와 함께 지웠다. 로컬에서는 생성된 클라이언트가 이미
있어 그 단계를 건너뛸 수 있어서 안 걸렸다.

```
지우는 작업의 검증에는 한 줄이 더 든다
  rm -rf src/v2/generated && npm run v2:generate && npm run typecheck && npm run build
```

**「지웠다」의 검증 범위는 `grep` 이 닿는 코드보다 넓다** — CI 워크플로 ·
npm 스크립트 · tsconfig 처럼 문자열로만 참조하는 자리는 타입 검사가 못 잡는다.
이 PR 에서 그 셋을 다 고쳤지만, 마지막 하나는 CI 가 깨진 뒤에야 봤다.

## 10. 범위 밖 — 그다음

```
팩 점수 모형        PR-B.  저울추는 이 PR 을 써 보고 정한다
DROP SCHEMA        그다음.  덤프와 이름 바꾸기까지만 한다
증분 파이프라인      M6
Neo4j 투영         M7
```
