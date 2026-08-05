# 앱 전환 — 정보 화면이 `canonical` 을 읽는다

> 설계 2026-08-05 · 선행 [ADR-08 사실은 데이터로, 규칙은 코드로](../../adr/08-authored-facts-as-data.md) · [ADR-07 `canonical` 은 승격으로만 바뀐다](../../adr/07-canonical-promotion.md)
> 3절의 수치는 **실측이다.** DB 와 소스를 직접 물어 얻었다. 구현 전이므로 6절 이후는 계획이다.

## 1. 무엇을 바꾸나

**읽는 곳을 하나로 만든다.** 정보 화면이 `public` 대신 `canonical` 을 읽는다.

```
지금    화면 2개  → canonical      (인격·E.G.O 목록)
        화면 13개 → public         (나머지)
        화면 1개  → public + 레거시 엔진 (recommend)

이후    화면 15개 → canonical
        화면 1개  → public + 레거시 엔진 (recommend).  M4 가 닫는다
```

**M1·M2 의 이득이 처음 실현되는 자리다.** 지금 `public` 은 별도 파이프라인이 채우고
별도 저작층(`lib/engine/vocab.ts` 500줄)이 받친다. `canonical` 은 적재기가 굽고 검사
214건이 지키며 `v2:verify:rebuild` 가 재현을 보증한다. 두 층을 나란히 두는 비용이
패치마다 든다.

## 2. 세 가지를 가른다 — 이 PR 이 하는 것은 하나다

| | 이 PR 에서 |
| --- | --- |
| **읽는 층을 옮긴다** | 한다. 정보 화면 13개 · 질의 8파일 |
| **추천을 새 엔진으로** | **안 한다.** `lib/engine/v2` 를 화면에 물리는 것은 M4 |
| **`DROP SCHEMA public`** | **못 한다.** `recommend` 가 아직 그걸 읽는다 |

**「M3 완료 = `public` 폐기」가 아니다.** 로드맵은 그렇게 적었으나, 추천 화면을 새
엔진으로 옮기는 일은 화면 계약이 바뀌는 작업이라 성격이 다르다. 이 PR 은 `public` 을
읽는 곳을 **한 자리로 좁히는** 데까지 간다. 지우는 것은 그 한 자리가 사라질 때다.

## 3. 지금 상태 — 실측

### 3.1 화면과 질의

```
canonical 을 읽는다 — 화면 2개
  identities 목록 · egos 목록          lib/queries/canonical/list.ts   175줄
  packs 목록(일부)                     lib/queries/canonical/packs.ts   19줄

public 을 읽는다 — 화면 13개 · 질의 8파일 · 1,535줄
  gifts 목록 · gifts/[id]              queries/gifts.ts       340
  identities/[id]                      queries/identities.ts  212
  squad                                queries/squad.ts       200
  about · dungeon · floors · glossary  queries/reference.ts   177
  packs 목록 · packs/[id]              queries/packs.ts       170
  egos/[id]                            queries/egos.ts        121
  홈                                   queries/search.ts      115

층과 무관 — 안 건드린다
  queries/shared.ts   64줄   로케일 행 고르기 공통부

범위 밖
  recommend   queries/recommend.ts → lib/engine (vocab.ts 500줄)
```

**팩 목록 화면은 두 층을 동시에 읽는다** — `canonical/packs.ts` 와 `packs.ts` 를 함께
쓴다. 옮기면 그 이중성이 사라진다.

### 3.2 클라이언트 둘

```
lib/db.ts             PrismaClient (@prisma/client)      → public
lib/db-canonical.ts   PrismaClient (src/v2/generated)    → raw · canonical · app
```

같은 데이터베이스 안에서 병존하며 **화면이 어느 층을 읽는지가 import 로 드러난다.**
이 PR 이 끝나면 `lib/db.ts` 를 쓰는 곳이 `recommend` 계열만 남는다.

### 3.3 `canonical` 이 못 덮는 것 둘

`public` 52모델 중 질의가 쓰는 것은 15종이다. 그중 둘이 `canonical` 에 없다.

**`mirror_dungeon` — 유도값이다. 새 원본이 필요 없다.**

`src/entities/egos.ts:222-232` 를 읽어 확인했다. 현행 파이프라인도 원본에서 직접
읽지 않고 **층 표에서 유도한다.**

```
totalFloors   floor_pack 의 hard 구간 표기 최댓값     "11-15" → 15
baseFloors    floor_pack 의 normal 구간 최댓값        "5"     → 5
version       detectVersion() 이 파일명에서 뽑는다     MD7
이름          mirror-dungeon/loc-{ko,en,ja}/MirrorDungeonName.json   각 20건
```

`canonical.floor_pack` 에 그 구간이 그대로 있다 — 실측 `hard 11-15` · `normal 5`.
**같은 유도를 `canonical` 위에서 다시 할 수 있다.**

**`dataset` — 대체가 더 정확하다.**

```
public.dataset          gameVersion · mdVersion · snapshotDate · sourceAnchor · generatedAt
→ raw.snapshot          id · version · game_anchor · created_at
+ canonical.build_info  snapshot_id · code_commit · authored_digest · built_at · row_count
```

`sourceAnchor` 하나였던 것이 **스냅샷 · 코드 · 저작 셋으로 갈린다**(ADR-08). 화면
문구가 바뀌는 유일한 자리이며 5절이 그것을 정한다.

## 4. 결정 넷

### 결정 1 · 범위는 정보 화면까지

`recommend` 와 `lib/engine` 은 안 건드린다. 그쪽은 **화면 계약이 바뀌는 작업**이다 —
`lib/engine/v2` 는 기프트 등급 A/B/C 와 근거를 내는데 지금 화면은 그 모양이 아니고,
팩 순위는 아직 아무도 안 낸다. M4(팩 점수화)가 저울추를 정하면서 함께 닫는다.

**그래서 `DROP SCHEMA public` 을 이 PR 에서 안 한다.** 완료 조건을 「`public` 을 읽는
곳이 `recommend` 하나로 줄어든다」로 잡는다.

### 결정 2 · 새 파일을 옆에 세운다

`lib/queries/canonical/list.ts` 가 이미 그 선례다.

```
lib/queries/canonical/
  list.ts        있음.  인격·E.G.O 목록
  packs.ts       있음.  19줄
  gifts.ts       신규.  기프트 목록·상세
  detail.ts      신규.  인격·E.G.O·팩 상세
  reference.ts   신규.  about·dungeon·floors·glossary·홈
  squad.ts       신규.  편성 편집이 쓰는 사전
```

현행 파일을 제자리에서 고치지 않는다. **두 층이 병존하므로 한 화면씩 옮기며 눈으로
대조할 수 있고, 중간에 멈춰도 앱이 돈다.** 현행 8파일은 마지막에 통째로 지운다.

파일을 넷으로 가르는 기준은 **화면 묶음**이다. 목록(`list`)·상세(`detail`)·
참조(`reference`)·편성(`squad`)이 각각 다른 화면군을 받치고 서로 안 부른다.

### 결정 3 · `mirror_dungeon` 을 `canonical` 에 더한다

```
canonical.mirror_dungeon        version · total_floors · base_floors
canonical.mirror_dungeon_text   version · locale · name
```

**층 표에서 유도하는 것은 적재 시점에 한 번 한다.** 질의 시점에 매번 다시 세지 않는다 —
[메카닉 축 그래프 설계](2026-08-03-mechanic-axis-graph-design.md)가 산문 유도를 적재
시점에 굳힌 것과 같은 이유다. 유도 근거는 `field_source` 에 남긴다.

`grace` · `adversity` · `start_gift` 는 이미 `canonical` 에 있으므로 던전 화면의
나머지는 덮인다.

### 결정 4 · 골든 대조로 옮겼음을 증명한다

옮기기 전에 현행 질의의 출력을 떠 두고, 옮긴 뒤 새 질의의 출력과 맞춘다.

```
1  현행 질의를 돌려 화면별 산출물을 JSON 으로 뜬다
2  새 질의를 쓴다
3  같은 입력으로 돌려 대조한다
4  다르면 그것이 조사거리다 — 나아진 것인지 깨진 것인지
```

**다른 것이 나올 것을 예상한다.** `canonical` 이 `public` 보다 많이 안다. 마스터북
백로그 01·02·07·08·09 가 「신규 DB 해소 · 현행 미착수」로 갈려 있던 것이 **이 PR 에서
실제로 해소된다** — 그 차이 목록이 이 PR 의 산출물 중 하나다.

```
01 identity-tags     특성 키워드 이름
02 locale-fallback   한국어 폴백 표기
07 report-artifact   변환 리포트
08 gift-hardonly     하드 전용 기프트 6건
09 pack-model        테마 팩 보강 필드 6종
```

## 5. 화면 계약 — 하나만 바뀐다

**나머지는 안 바뀐다.** 같은 것이 같게 보여야 한다. 다르게 보이면 그것은 백로그 해소
(4절)이고, 무엇이 왜 달라졌는지 목록으로 남긴다.

**바뀌는 하나 — `dataset` 표기.**

```
지금    "게임 버전 X · 거울 던전 Y · 스냅샷 Z · 출처 W"
이후    스냅샷(raw.snapshot) + 판 표식(canonical.build_info)으로 다시 짠다
```

`sourceAnchor` 문자열 하나가 스냅샷 id · 코드 커밋 · 저작 지문 셋으로 갈리므로 같은
문구를 못 쓴다. **무엇을 보여줄지는 구현 계획에서 정한다** — 최소한 스냅샷 날짜와
게임 시점(`game_anchor`)은 지금과 같은 것을 답할 수 있다.

## 6. 검증

```
골든 대조        화면 13개의 산출물을 옮기기 전후로 맞춘다 (결정 4)
검사 214건       그대로 통과해야 한다.  이 PR 은 canonical 을 안 바꾼다
                 — mirror_dungeon 표 둘이 늘어 검사가 는다
타입 검사        tsconfig.pipeline · tsconfig 둘 다
빌드            next build.  화면이 실제로 서는지
승격            mirror_dungeon 을 더하므로 build → diff → promote 를 한 번 돈다
```

**`v2:verify:rebuild` 가 「재현됨」을 유지해야 한다.** 표를 더하는 것은 스키마 변경이라
승격이 필요하고, 승격 뒤 재현 검사가 다시 통과해야 한다.

**값이 바뀌는 판의 승격은 이 PR 도 안 태운다.** `mirror_dungeon` 은 새 표라 기존
152,399행이 안 움직인다. ADR-07 §6 의 그 항목은 여전히 미검증으로 남는다.

## 7. 열린 것

```
dataset 표기를 무엇으로 바꾸나        5절.  스냅샷 날짜 · game_anchor 는 유지 가능
detectVersion 을 canonical 로        MD7 을 파일명에서 뽑는 유도를 적재기가 다시 해야 한다
백로그 해소가 화면을 얼마나 바꾸나     골든 대조가 나온 뒤에 안다
```

셋 다 구현 중에 실측으로 닫는다.

**`squad` 가 쓰는 사전 넷은 확인했다.** 이름이 같고 행 수도 거의 같다 — **하나만 빼고.**

```
              canonical   public
sinner            12        12
sin_info           7         7
status         1,472     1,472
keyword           12        10   ← 둘 늘었다
```

`keyword` 차이 둘이 **4절이 말한 백로그 해소의 첫 실물이다.** 화면 필터 칩이 둘 늘어난다.
어느 것이 왜 늘었는지는 골든 대조에서 이름으로 나온다 — 그것이 백로그 01
(특성 키워드)의 해소인지 다른 것인지 그때 판정한다.

## 8. 범위 밖 — 그다음

```
recommend 전환 · DROP SCHEMA public   M4.  화면 계약이 바뀌는 작업
lib/engine 레거시 제거                 같이 간다.  vocab.ts 500줄
증분 파이프라인                        M6
Neo4j 투영                            M7
```
