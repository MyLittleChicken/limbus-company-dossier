# 인카운터·적 재설계

> 설계 2026-08-03 · 상태 승인됨
> 근거 [`docs/audit/06-encounter.md`](../../audit/06-encounter.md) · [`docs/audit/wiki/06-encounter.md`](../../audit/wiki/06-encounter.md)
> 선행 [ADR-06 3스키마 데이터베이스](../../adr/06-three-schema-database.md)

## 1. 왜 다시 짜나

소비자 관점 감사에서 이 도메인이 최악으로 나왔다.

```
encounter_target    원본 1,384 중 398 적재 (28.8%)
부위별 저항          원본 14,850 중 3,540 적재 (23.8%)
적 이름 한국어       0 / 398
「이 팩 고르면 뭐랑 싸우나」  117팩 중 31팩만 답 가능
```

그런데 **감사가 제시한 조치 두 건은 그대로 하면 데이터를 틀어놓는다.** 위키 대조가 전제를
뒤집었다.

| 감사의 조치 | 실제 |
| --- | --- |
| `waves`/`phases`/`battles` 986건을 타깃으로 펼친다 | `battles` 는 **서로 배타적인 보스 후보**다. 펼치면 「이 보스전 등장 적」이 최대 4배로 부풀고 저항이 뒤섞인다 |
| `portrait` 를 적 FK 로 승격한다 | `portrait` 는 **초상화 이미지 id** 다. FK 로 올리면 37건이 틀린 적에 붙는다 |

그래서 「적재를 늘린다」가 아니라 **모델을 다시 짜는 일**이다.

## 2. 목표와 비목표

**목표**

1. 원본 타깃 1,384건과 저항 14,850값을 **뜻을 잃지 않고** 담는다
2. 「이 팩의 보스 후보는 누구인가」를 canonical 만으로 답한다
3. `canonical.enemy` 에 섞여 있는 적과 부위를 가른다
4. 이름 해석 실패를 조용히 넘기지 않고 `field_gap` 에 남긴다

**비목표**

- **엔진 상성 계산.** 화면은 보스 후보 이름만 낸다. 저항은 담되 점수화에 쓰지 않는다
- **위키에서 보스 이름을 긁어 미확보 42팩을 채우는 것.** 위키 값을 canonical 에 적재하는 것은
  새로운 출처 개념이라 별도 판단이 필요하다. 42팩은 결손으로 기록만 한다
- 현행 `public` 스키마와 화면. 이 작업은 `canonical` 안에서 끝난다

## 3. 설계

### 3.1 `encounter_target` 을 4키로 넓힌다

원본은 한 인카운터 안에 네 갈래로 타깃을 담는다. 셋의 뜻이 서로 다르므로 한 축으로 뭉개면
안 된다.

```
targets   152 인카운터   최상위. 단일 전투
waves      59 인카운터   같은 전투 안의 증원.  같은 적이 반복 등장한다
phases     13 인카운터   보스 페이즈 전환.     Golden Apple → False Apple
battles    27 인카운터   서로 배타적인 보스 후보
```

네 갈래의 교집합은 0이다 — 한 인카운터는 한 갈래만 쓴다.

```prisma
enum TargetKind {
  top      // 최상위 targets[]
  wave     // waves[i].targets[] — 같은 전투 안의 증원
  phase    // phases[i].targets[] — 페이즈 전환
  battle   // battles[i].targets[] — 서로 배타적인 보스 후보
}

model EncounterTarget {
  encounterId String     @map("encounter_id")
  kind        TargetKind
  /// battles[i] · waves[i] · phases[i] 의 i. top 은 0
  groupIndex  Int        @map("group_index")
  /// 그룹 안의 순서
  index       Int
  /// 정본은 asset `targets[].name` 이다. loc 이름으로 덮지 않는다
  name        String
  /// 초상화 이미지 id. **FK 가 아니다** — 적 id 와 번호 공간이 겹치지만 37건이 어긋난다
  portrait    Int?
  /// 원본 `num`. 동시 등장 수인지 확정되지 않았다(합 22 · 다른 곳엔 77)
  num         Int?

  @@id([encounterId, kind, groupIndex, index])
}
```

`EncounterTargetPart` 와 `EncounterPartResist` 도 같은 4키를 참조하게 넓힌다. 저항은 부위에
달려 있으므로 축만 바로잡으면 **3,540 → 14,850 이 같은 변환기로 따라온다.**

### 3.2 적과 부위를 가른다

loc `Enemies*.json` 이 적 행과 부위 행을 한 표에 섞는데 ETL 이 무차별 적재했다.

```
4·5자리   870행   적     name = 적 이름      desc = 역할 라벨 (Core 463 · Enemy Unit 173)
6자리     472행   부위   name = 부위 이름     desc = 소유자 라벨 (Part 437)
          1,342 = canonical.enemy 행 수와 정확히 같다
```

부모가 `id // 100` 으로 정확히 결정된다.

```prisma
model Enemy      { id String @id }                        // 870행
model EnemyPart  { id String @id
                   enemyId String @map("enemy_id") }      // 472행 · enemyId = id / 100

model EnemyText     { enemyId, locale, name, roleLabel }  // part → roleLabel 개명
model EnemyPartText { partId,  locale, name }
```

`enemy_text.part` 는 이름이 거짓말이다 — 부위 이름이 아니라 **적의 역할 라벨**이다. 실제 부위
이름은 부위 행의 `name` 에 있다. ETL 주석 「`desc` 가 부위 이름이다」도 함께 고친다.

**부수 소득** — `encounter_target_part.part_id` 가 이 6자리와 같은 번호 공간이라
`enemy_part` 와 곧바로 조인된다. 지금은 FK 가 없다.

**마스터북·감사의 「적 1,342종」을 870종으로 정정한다.**

### 3.3 이름 해석은 두 키를 다 담고 실패를 남긴다

어느 한 키로도 전부 풀리지 않는다.

```
portrait        398/398 존재 · 390 해석 · 이름 불일치 37 · 미해석 7
partId // 100   일치 386 · 불일치 26 · 미해석 690
```

그래서 `portrait` 와 `part_id` 를 **둘 다 담는다.** 적 이름 한국어(지금 0/398)는 `part_id`
조인으로 닿는 만큼만 복구하고, 나머지는 `field_gap` 에 사유와 함께 남긴다.

미해석 7건의 정체는 이미 밝혀져 있다 — 번호 공간 문제가 아니라 **로컬라이즈 스냅샷 결손**이다
(`1277`·`1278`·`1279`·`1307`·`1336` 은 loc 파일에 행이 없고, `1460` 은 원본이 빈 이름,
`91016` 은 `partId 820401 → 8204` 로 풀린다).

### 3.4 보스 후보를 어떻게 낸다

화면이 쓰는 질의는 하나다.

```
pack → pack_boss_encounter → encounter
     → encounter_target where kind='battle'   groupIndex 하나가 보스 후보 하나
     → kind='top' 인 경우 후보가 하나뿐인 것으로 본다
```

`battles` 총 항목 수 100 = 같은 75팩의 mj `bossPool` 합계 100 으로 이미 대조됐다.

**미확보 42팩** — mj `bossPool` 은 117팩 전부에 보스를 주는데 id 가 숫자(`2060122`)고
`canonical.encounter` 는 문자열 키다. 크로스워크 표가 원본에 없다. 42팩·105종을 `field_gap` 에
`encounter.bossPool` 로 기록한다.

## 4. 검증

행 수 검사만으로는 이 도메인의 버그가 안 잡힌다는 것이 이미 증명됐다 — 기존 검사가
6테이블 전부 `eq(count, N)` 이라 감사가 찾은 6건이 **전부 통과했다.** 그래서 값 검사를 넣는다.

```
타깃 총계        1,384 (kind 별 분포도 함께)
저항 총계        14,850 · 부위당 10축이 아닌 것 0
kind 교집합      한 인카운터는 한 갈래만 쓴다 — 두 갈래를 가진 인카운터 0
battles 대조     len(battles) == len(mj bossPool)  75/75
적·부위 분리      enemy 870 + enemy_part 472 = 1,342
부모 해석        enemy_part 전건이 enemy 에 부모를 갖는다
골든 표본        md__canto-1-1 보스전 등장 적 4종이 위키와 일치
                md__canto-1-2 battles 3종 = Ebony Queen's Apple · Doomsday Calendar · Golden Apple
                md__walpu-8 partId 137001/137101/137201 → 적 1370/1371/1372
결손 기록        미해석 이름 · 미확보 42팩이 field_gap 에 있다
```

## 5. 리스크

**`num` 의 뜻이 확정되지 않았다.** 동시 등장 수인지 아닌지 갈리지 않았다(합 22인데 다른 곳엔
77이 있다). **담되 해석하지 않는다** — 화면·엔진이 쓰지 않으므로 지금 판정할 필요가 없다.

**`battles` 를 쪼갤 때 `encounter` 를 나누지 않는다.** 팩당 N개 인카운터로 쪼개는 안도 있었으나
`pack_boss_encounter` 75/75 대조가 깨지고 마스터북 완전 일치 쌍 하나를 잃는다. 축을 더하는
쪽이 안전하다.

**기존 검사 기준값이 바뀐다.** `encounter_target` 398 · `encounter_part_resist` 3,540 을
기대하는 검사가 있다. 새 값으로 갱신하되 **왜 바뀌는지를 주석으로 남긴다** — 앞선 작업에서
「리터럴 꺾쇠 41 → 35」를 회귀로 오인할 뻔한 전례가 있다.

## 6. 범위 밖

```
엔진 상성 계산       화면은 보스 후보 이름만 낸다
위키 크로스워크       42팩 보스 이름을 위키에서 긁는 것. 새로운 출처 개념이라 별도 판단
전투 풀 2,525종      원본 결손으로 확정됐다. 채울 수 없다
public 스키마와 화면  이 작업은 canonical 안에서 끝난다
```
