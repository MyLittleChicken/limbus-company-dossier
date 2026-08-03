# 소비자 관점 데이터 감사 — 종합

> 감사일 2026-08-02 · 위키 대조 2026-08-03 · 대상 PR #20
> 대상 데이터: `canonical` 85테이블 · 324컬럼 (PR #19 로 적재)
> 방법: 7개 도메인 병렬 감사 + 교차 스캔 + 위키 전수 대조. 모든 수치는 실측이다.
>
> **13절이 초판 판정 9건을 정정한다.** 본문의 취소선·인용 블록이 그 지점이다.

## 1. 이 감사가 답한 질문

PR #19 는 **「원본이 준 것을 안 흘렸나」** 를 검증했다. 원본 1,664파일이 `raw` 에 누락 0으로
들어갔고, `canonical` 검사 147건이 통과했고, 재현 시험에서 덤프 해시가 바이트 단위로 같았다.

이 감사는 다른 질문에 답한다 — **「이 데이터로 화면을 띄우고 엔진을 돌릴 수 있나」**.

소비자 4종을 기준으로 잡았다.

```
인격 상세 · E.G.O 상세 · E.G.O 기프트 상세      있는 그대로 보여줄 수 있어야 한다
메카닉 기반 거울 던전 트래커의 추천 엔진         점수와 근거를 낼 수 있어야 한다
```

여기에 화면이 없는 두 도메인(인카운터 · 층별 등장 팩 · 팩별 기프트 목록)을 더해 7편으로 갈랐다.

## 2. 답

**아니다. 지금 `canonical` 로는 세 상세 화면 중 어느 것도 현행 수준으로 못 띄운다.**

현행 `public` 이 이미 보여주고 있는 것을 `canonical` 이 못 보여주는 지점이 도메인마다 나왔다.
결손이 아니라 **적재 누락**이며, 원본은 `data/entities/` 에 그대로 있다.

```
                        현행 public        신규 canonical      원본
기프트 아이콘            456종 표시         sprite 컬럼 없음     srcPath 에 있음
기프트 설명문            치환 완료          자리표시자 75% 잔존   치환 재료 119/125 존재
인격 스킬 위력           표시               컬럼 자체 없음       identity-details 에 있음
인격 체력 성장           「72 + 2.48/레벨」  「72」              hp.incrementByLevel 에 있음
E.G.O 스킬 수치          표시               컬럼 자체 없음       ego-details 에 있음
적 이름 한국어           124종              0종                 loc-ko 에 있음
은총 이름 한국어         「시작의 별」 렌더   0종                 loc-ko 에 있음
```

**엔진은 절반쯤 된다.** 어휘(효과 55 · 발동 150)는 문자열 수준까지 정확하고 팩 점수 계산은
`canonical` 만으로 끝까지 돈다. 그러나 입력 셋이 왜곡돼 있다 — 전용 기프트 85쌍이 도달 불가,
효과 토큰 1건 소실, 인카운터 저항 76% 미적재.

## 3. 심각도 1 — 화면이 현행보다 후퇴하는 것

이 목록은 `canonical` 로 전환하면 **지금 되던 것이 안 되는** 항목이다.

| # | 항목 | 실측 | 원인 | 원본 |
| --- | --- | --- | --- | --- |
| 1 | 기프트 아이콘 | `canonical.gift` 에 `sprite` 컬럼 없음 (public 456행 전부 유일값) | 미적재 | `raw` payload `srcPath` |
| 2 | 기프트 설명문 | 자리표시자 `[Combustion]` 류가 2,391행 중 **1,803행(75%)** 에 잔존. ko desc "화상" 검색 62 → 38 | 치환 결과를 어느 컬럼에도 안 담음 | 치환 재료 125종 중 119종이 `canonical` 에 있음 |
| 3 | 인격 스킬 위력·코인 위력·공격 가중 | `skill_stage` 에 컬럼 자체 없음 — **9,544값** | ETL 이 `limbus-assets/identity-details/*.json` 을 입력으로 안 받음 | 원본에 전량 |
| 4 | E.G.O 스킬 수치 | `ego_skill_stage` 가 `skill_id`·`uptie` 2컬럼뿐 | 같은 원인 (`ego-details` 미투입) | 원본에 전량 |
| 5 | 인격 체력 성장치 | `identity.hp` 스칼라 1개. `incrementByLevel` 184건 손실 | ETL 이 읽은 바로 그 파일 안의 값 | 원본에 있음 |
| 6 | 인격 속도 동기화 축 | `identity_speed` 184행 (public 736행). 4원소 배열의 마지막만 남김 | 배열 → 스칼라 축약 | 원본에 4원소 |
| 7 | 코인 한국어 설명 | `skill_coin.effects` 한글 포함 **0/10,419** (public 4,196건 보유) | 로케일 축 없음 | `loc-ko/Skills.json` 에 4,305코인·5,519줄 |
| 8 | 패시브 발동 조건 | 죄악 공명 요구치 없음 (`condType` 485 + `requirement` 534) | 미적재 | `passiveData[].condition` |
| 9 | 적 이름 한국어 | `encounter_target` 한글 포함 **0/398** (public ko 124 + en 124) | 로케일 축 없음 | `loc-ko` |
| 10 | 은총 이름 한국어 | `grace_text` en 10행뿐. **현행은 `/ko/dungeon` 에 「시작의 별」을 렌더한다** | 거짓 결손 (아래 4절) | `loc-ko` 에 3언어 전부 |
| 11 | 합성 수량 | `fusion_slot.count` **178/179 NULL** (public NOT NULL, 값 1) | 암묵 기본값 규약이 스키마에 없음 | — |

> **~~12. 보스 층 그림~~ — 철회했다.** 초판은 「현행이 7팩(1201–1206·1302)에서 파일명을 지어내
> 누락하고 `canonical.overlay_sprite` 가 그것을 고쳐 준다」고 적었다. 위키 조사에서 전제가
> 틀렸음이 드러났다 — `overlay_sprite` 는 「보스 층 카드」가 아니라 **같은 카드의 위 레이어**다.
> 애셋 규격이 갈랐다: `sprite` 계열은 전부 380×690(빈 카드 배경), `overlay_sprite` 계열은
> 전부 391×432(투명 배경 적 일러스트). 13절 참조.

## 4. 심각도 1 — 거짓 결손 (원본에 있는데 없다고 기록했다)

`build/gap-report.md` 가 「어느 출처에도 없다」고 적은 것 중 **원본에 실재하는 것**이 나왔다.

| 항목 | gap-report 기록 | 실측 |
| --- | --- | --- |
| `grace.name` ko·ja | 20건 결손 | `raw` 에 3언어 전부. 영문명 일치 10/10 검증 |
| `adversity.name` ko·ja | 60건 결손 | `MD6Limit1{fr-11}{idx+1}` / `MD7Limit1{fr-11}1` 규칙으로 30/30 전건 확인 |

직접 확인한 예:

```
mirror_dungeon_5_buffs_title_100
  loc-en   Star of the Beginning
  loc-ja   始まりの星
  loc-ko   시작의 별            ← canonical 에 없고, gap-report 는 「없음」으로 기록
```

**결손 대장을 믿고 「이건 못 채운다」고 판단하면 틀린다.** 규칙 기반 id 조합으로 풀리는
로케일 결손이 최소 80건 있다.

연쇄로 `canonical.status_text` 도 `MD6Limit*` en 26 · `MD7Limit*` en 5 만 있고 ko·ja 가 0이다.
`status_text` 전체는 ko 1,227 / ja 1,214 이므로 이 계열만 빠졌다.

## 5. 심각도 1 — 결손 대장 자체가 결손을 다 안 담는다

로케일별 텍스트 행 수를 전 테이블에서 실측한 결과, `field_gap` 1,549건에 **없는** 결손이 나왔다.

```
                     en 기준   ko 없음   ja 없음   field_gap
choice_option_text      372      125      125      없음
skill_stage_text       5180        0     3224      없음
term_text               482        0      482      없음
passive_text            703        0      408      없음
association_text         64        5        2      ja 2만
sinner_text              12        0       12      없음
sin_text                  7        0        7      없음
```

미기록 결손 — **ko 130건 · ja 4,258건.** 화면을 일본어로 띄우면 스킬 단계 텍스트 3,224개가 빈다.

`choice_event.text` ko 도 실제로는 56이 아니라 **133/159** 다. 행이 있는 103건 중 77건의
`name` 이 NULL 이다(원본이 `""`).

그리고 3절·6절의 미적재 항목은 **`field_gap` 에 한 줄도 없다.** 스키마에 컬럼이 없으면
결손으로도 잡히지 않기 때문이다.

**`app.field_override` 는 0행이다.** 보정 기구는 만들어졌고 아직 아무것도 안 들어갔다.

## 6. 심각도 1 — 관계가 어긋난 채 통과했다

### 6.1 전용 기프트 85쌍이 엔진에서 죽어 있다

`gift_exclusive_pack` 321쌍 중 **85쌍(26.5%)** 이 `gift_pack` 에 없다.

원인을 소스까지 특정했다 — 두 관계를 **다른 출처에서 가져와 검사 없이 합쳤다**.

```
gift_pack            = mj.packs          10,115행
gift_exclusive_pack  = assets.exclusiveTo   321행
mj.uniquePacks(236) ⊂ mj.packs           mj 내부는 정합
assets 단독 85쌍 ∩ mj.packs = 0          교집합 없음
```

엔진 영향: `lib/engine/pack.ts:103` 의 `exclusiveIds.has()` 가 `gift_pack` 루프 안에 있어
85쌍은 도달 불가다.

화면에 이미 모순으로 노출돼 있다 — `/ko/packs/1122` 가 「전용 기프트 9」를 나열하는데
같은 화면 「전체 풀 73」에 그 9종이 하나도 없다. `/ko/gifts/9831` 은 「전용 팩 1 · 등장 팩 0」.

#### 판정 — 위키 조사로 85쌍이 셋으로 갈렸다 (2026-08-02)

`limbuscompany.wiki.gg` 의 테마팩별 「Unique E.G.O Gifts」 목록과 전수 대조했다.

```
64쌍   합성 결과물          정상. 드랍 풀에 없는 것이 맞다
11쌍   완주·희귀 보상        정상. Extreme 팩 10 + Hidden 팩 1
10쌍   진짜 결손            gift_pack 에 있어야 하는데 없다
```

**대조군이 규칙을 확정했다.** 팩 1104 육참골단(Yield My Flesh to Claim Their Bones)의
전용 12종 중 풀에 있는 7종이 위키의 unique 7종과 **등급까지 정확히 일치**한다.

```
9712 Black Ledger II · 9713 Rusted Hilt III · 9714 Fractured Blade III
9715 Broken Blade III · 9716 Red Tassel III · 9719 Ragged Bamboo Hat IV
9720 Old Dopo Robe IV                                       ← 전부 gift_pack 에 있다

9280 本國劍譜 · 9717 Sublimity · 9718 Unbending · 9783 Resplendence · 9784 Cultivation
                                    ← 전부 fusion_recipe 결과물. 위키 unique 목록에도 없다
```

즉 **테마 전용 드랍 기프트는 `gift_pack` 에 들어간다**는 규칙이 성립한다.

**정상 1 — 합성 결과물 64쌍.** `fusion_recipe` 에 결과로 등록된 기프트다. 팩 안에서 만들어질
뿐 드랍되지 않으므로 풀에 없는 것이 맞다.

**정상 2 — 완주·희귀 보상 11쌍.** `Extreme` 태그 팩 10종(1511–1520)과 `Hidden` 태그 팩
1종(3001)이 각각 전용 기프트를 정확히 1개씩 갖는다. 위키 확인 — 팩 1511 코드 퍼플의
`Mid-range K Corp. Ampule`(9250)은 「awarded automatically upon completing the Code Purple
Theme Pack」이고, 3001 뽕.황의 `Bongy Plush`(9242)는 「requires specific conditions ...
rather than ... floor rewards」다. 드랍 풀 항목이 아니다.

**결손 1쌍 — 이것만 진짜다.**

| 팩 | 기프트 | 근거 |
| --- | --- | --- |
| **1124 호박색 어스름의 시련** | 9241 아직 따뜻한 커피 | 위키 unique 7종 중 **6종은 풀에 있고 이것만 없다**. 위키 등급 III = 우리 데이터 tier 3 |

**같은 팩 안에서 6종은 들어가고 1종만 빠졌다.** 규칙 위반이지 설계가 아니다.

> **정정 — 1122 선의의 순례 9종은 결손이 아니다.** 이 문서 초판은 9종을 결손으로 판정했다.
> 팩 1122 는 명일방주 콜라보 한정(2025-09-25 ~ 10-23)으로 **게임에서 삭제**됐고, 9종 전부가
> 위키 `List_of_E.G.O_Gifts/Unobtainable` 의 Removed 목록에 en 이름까지 1:1 로 올라 있다.
> 위키 팩 페이지도 `{{removed}}` 배너로 시작한다. 초판은 그 배너를 못 봤다.
> `gift_pack` 0행과 `floor_pack` 0행이 **둘 다 옳다.**

**조치** — `gift_pack` 에 1행을 보정한다. `app.field_override` 는 필드 단위 보정이므로
관계 행 보정에는 맞지 않는다.

> **검사 제안** — `gift_exclusive_pack` 의 각 쌍은 다음 넷 중 하나여야 한다.
> ① `gift_pack` 에 있다 ② `fusion_recipe` 결과물이다 ③ 팩이 `Extreme`·`Hidden` 태그다
> ④ 팩이 삭제된 콜라보 한정이다. 지금 이 검사를 걸면 1건이 걸린다.

### 6.2 인카운터가 원본의 28.8%만 담겼다

| 항목 | 원본 | canonical | 비율 |
| --- | ---: | ---: | ---: |
| `encounter_target` | 1,384 | 398 | 28.8% |
| 부위별 저항값 | 14,850 | 3,540 | 23.8% |

`src/v2/canonical/encounters.ts:79` 가 최상위 `targets` 만 순회하고 `waves`/`phases`/`battles`
안의 986건은 JSONB 에 갇혔다.

`encounter_target` 에 **적을 가리키는 컬럼이 없다.** 원본 `portrait` 가 398/398 존재하고
390건이 `canonical.enemy.id` 로 해석되는데 ETL 이 버렸다. 결과로 `canonical.enemy` 는
1컬럼·인바운드 FK 0 의 고아 섬이고, 적 942/1,342(70%)가 도달 불가다.

**「이 팩을 고르면 무엇과 싸우나」에 답할 수 있는 팩 — 117개 중 31개(26.5%).**
저항까지 아는 팩 25개. 일반·하드 전투는 0개.

원본이 `data/entities/` 에 다 있으므로 **재적재 없이 ETL 수정만으로 복구 가능**하다.
고치면 답 가능한 팩이 31 → 최대 75, 저항값이 3,540 → 최대 14,850 이 된다.

### 6.3 효과 토큰 1건이 PK 에 흡수됐다

`canonical.gift_effect` 가 `(gift_id, effect_id)` 2컬럼뿐이라 중복 효과 토큰이 합쳐진다.

```
public.gift_token (effect)  1,123
canonical.gift_effect       1,122     기프트 9429 「Gain Speed / Haste」 2개 → 1개
```

9429 는 팩 1015 소속이라 그 팩 점수가 달라진다. 두 테이블 다 `index` 컬럼이 없어
토큰 순서도 소실됐다. 팩 담당과 기프트 담당이 독립으로 같은 것을 잡았다.

### 6.4 보스 풀 — 초판 판정 철회

초판은 「mj `bossPool` 204 와 assets `bossEncounters` 75 가 갈린다」고 적었다.
**위키 조사로 어긋남이 아님이 확인됐다.**

`bossEncounters` 는 팩→파일 포인터이고, 보스 후보 열거는 그 파일의 `battles` 에 있다.
75팩 합계 100 = `bossPool` 합계 100 으로 맞는다. 남은 것은 불일치가 아니라
**미확보 42팩·105종**이다(13절).

## 7. 심각도 2 — 값 오류와 구조 손실

| 항목 | 실측 | 판정 |
| --- | --- | --- |
| `season 0` | `reward` 100행 + `achievement` 93행 | **실제 시즌 7.** 원본 `__Season__`=`"7"` 을 ETL 이 `continue` 로 건너뛰고 0 하드코딩. 교차 증거 — season=0 행의 아이템명이 `Season 7 …` 33건 |
| 연출 전용 E.G.O 5종 | 20101·20301·20501·20601·21101 이 각성 스킬 2개 보유, 201011 등 5종은 스킬 0개 | `skillId.length === id.length + 2` 접두 스캔 버그. 정상 2건(20608·21209)과 섞였다 |
| 효과 문자열 없는 코인 | 616 스테이지 중 9건이 코인 0개 | `if (effects.length === 0) return;` 로 통째 탈락. 원본 `coinlist` 엔 코인 1개 존재. 코인 수는 클래시 계산 입력 |
| `identity_passive` | (인격,패시브) 쌍 111건 중복 | 동기화별 누적 집합. 그대로 읽으면 패시브 최대 3회 중복 렌더 + React key 충돌 |
| `mirror_dungeon` 테이블 | canonical 에 **없음** | `/ko/dungeon` 의 명칭·내부키 4행을 만들 수 없다. raw 엔 3언어 다 있다 |
| `reward` | PK `(season, level)` · level 1~100 | **층별 보상이 아니다.** 층과 연결이 없다. 층별 보상 데이터는 canonical 어디에도 없다 |
| 원본에 있는데 자리도 기록도 없는 필드 | `mapGenSequence`(117) · `exceptions`(117) · `eventPool`(19) · `specialName`(1) · `advantages`(112) · `tips`(183) | `eventPool` 부재로 선택지 이벤트 159개를 팩에 붙일 수 없다. `advantages` 는 엔진 `sinSupply` 와 직결 |
| `ego_passive.index` | 순서 컬럼 없음 | 영향 E.G.O 3종 |
| `skill_coin.type` | 없음 | `unbreakable` 코인 275건 배지 소실 |
| `identity_unit_keyword` | 36종에 표시명 없음 | `SMALL`·`FIXER` 코드가 그대로 노출된다. **한국어명은 우리 raw 에 있다** — `identities/loc-ko/UnitKeyword*.json` 에서 25/36 이 즉시 나온다(13절) |
| `gift.keyword_id` | NULL 대신 `'None'` 센티넬 (mirror 120종) | 현행 `keywordId: null` 필터·분기를 그대로 옮기면 오작동 |
| `canonical.keyword` | `order` 컬럼 없음 | 필터 칩 순서 근거 소실. **위키 Starting Gift 표 순서로 채울 수 있다** |
| `canonical.enemy` | 1,342행 중 **472행(35%)이 적이 아니라 부위** | loc `Enemies*.json` 이 적 행(4~5자리)과 부위 행(6자리 = 적id×100+n)을 한 표에 섞는데 그대로 담았다. 「적 1,342종」은 **870종**으로 정정 |
| `identity.season` | 10311·10708 이 NULL (public 0) | **public 이 맞다.** 「원본에 season 키가 없다」는 mj 한정 오진 — assets·shared-library 둘 다 `season: 0` 을 갖는다. `hp`·`stagger`·`speed` 와 동형의 출처 오선택 |
| `skill_stage` 앞채우기 | 동기화 3부터 시작하는 스킬 216건의 1·2 단계를 지어냈다 | **canonical 이 틀렸다.** 216 중 206이 슬롯 3이고 게임은 Tier III 에서 해금한다 |
| `gift_requirement` | `kind='resonance'` 23행 중 6건이 `absolute` 누락 | 9001·9043·9049·9052·9053·9066. 원본 `mj` 가 같은 객체 안에서 `desc` 와 `requires` 를 모순되게 준다. 강화 단계 축이 없는 것이 더 큰 문제 |
| `gift.hard_only` | canonical 122 · public 116 | **둘 다 틀렸다. 정답 117**(13절) |

## 8. 검증이 왜 이걸 못 잡았나

`verify-canonical.ts:537-544` 가 인카운터 6테이블 전부 `eq(count, N)` 이다. 값 검사는 2건뿐이라
6.2 의 B1–B6 이 **전부 통과한다**.

ADR-06 5.4 가 같은 교훈을 이미 적었다 — 「전부 NULL 인 컬럼을 찾는 질의가 셋을 한 번에 잡았다.
행 수 검사로는 안 보인다」. 그 교훈이 인카운터 도메인에는 적용되지 않았다.

내가 돌린 전역 채움률 스캔(324컬럼)에서 전량 NULL 컬럼은 1개뿐이었다.

```
전량 NULL   ego_text.desc_raw (345행)   ← 설계대로. 마크업 없으면 null
저채움      gift.tier_label 2/582 · fusion_slot.count 1/179 · choice_event.illust_id 1/159
            ego.max_threadspin 3/115 (「3종만 5단계」와 일치 · 정상)
            encounter.phases 13/251 (원본 형태와 일치 · 정상)
행 0 테이블  없음
```

**5.4식 「행은 있고 값만 빈」 버그는 재발하지 않았다.** 이번에 나온 것은 한 단계 더 앞이다 —
**컬럼 자체가 없어서 결손으로도 안 잡히는 것.** 채움률 스캔으로는 원리적으로 못 잡는다.
필요한 검사는 「원본 JSON 의 키 중 canonical 어느 컬럼에도 도달하지 않은 것」이다.

## 9. 판정이 뒤집힌 것 — 정상 확인

감사 중 의심으로 올랐다가 실측으로 정상 확정된 것들이다.

| 항목 | 초기 의심 | 확정 |
| --- | --- | --- |
| `fusion_slot_option` 7행 | 「너무 작다」 | **정상.** 178 인라인 + 7 대체 = 185 = public 과 1:1. 원본 파싱과 일치 |
| `pack.textColor` 61 결손 | — | **원본 결손 확정.** raw mj 에서 `jsonb_typeof='null'` 이 정확히 61 |
| `pack.unlockCode` 2 결손 | — | **원본 결손 확정** (1122·3001) |
| 전투 풀 2,525 결손 | — | **원본 결손 확정.** 4풀 합집합 2,321 + bossPool 204 = 2,525. 변환 실패 아님 |
| `identity.stagger` | PR #19 버그 항목 | **수정 유지.** 421원소 public 과 완전 일치 |
| `choice_event.illust_id` 1/159 | PR #19 버그 항목 | **원본 그대로.** 스칼라 오독 아님 |
| `ego.max_threadspin` 3/115 | 저채움 | **정상.** 20102·20402·20902 뿐 |
| `ego_text.desc_raw` 0/345 | 전량 NULL | **설계대로.** 마크업 있을 때만 raw 를 채운다 |
| `hard_only` 122 | public 116 과 불일치 | **canonical 이 정답.** 122 = mj(53) ∪ assets(116). mj 단독 6건은 결과물 3 + 재료 3 |
| 엔진 어휘 55·150 | 문서 주장 | **실측 일치.** `canonical.effect`/`trigger` 와 문자열 수준까지 양방향 차 0 |

관계 본체는 재적재에서 하나도 안 잃었다 — `gift_pack`(10,115) · `gift_exclusive_pack`(321) ·
`floor_pack`(288) 이 canonical↔public 양방향 차집합 0. 고아 FK 는 인격 13종 · 기프트 14종 ·
팩 도메인 전부 0건이다.

`floor_pack` 288 의 내역도 확정됐다 — 1–5구간 218(hard 143 + normal 75) + hard 6-10(46) +
hard 11-15(24).

## 10. 신규가 새로 가능하게 한 것

전환 판단에 필요하므로 함께 적는다.

```
coin_token          26,942행   코인 효과 구조 분해 (상태 189종). 엔진 조건 평가의 근간
pack_tag            184행 47종  엔진 availabilityOf 하드코딩과 결과 집합이 정확히 일치
                               → 등장성을 데이터 기반으로 바꿀 수 있다
pack_category_path  202행      category 8종을 2단으로 세분
identity_keyword    266행      + skill_slots
identity_unit_keyword 391행
overlay_sprite      41건       팩 카드의 상단 레이어(팩별 보스 명단 그림). 위키 보스 목록과 일치해
                               보스 미확보 42팩 중 일부를 우회 확인하는 데 쓸 수 있다
ja 로케일           전 도메인
title/name 분리 · skill_stage.changed_here · ab_name(1848) · 패닉 스킬 184
tool_annotation     1,052행    도구 필드를 격리 (legacyResist 110 등)
choice_event 159 · choice_option 372 · achievement 183 · reward 200 · adversity 30 · grace 10
                               현행 파이프라인이 통째로 버리던 것
story_dungeon 기프트 126종     총계 456 → 582
```

## 11. 사용자 확인이 필요한 것

초판은 40건을 남겼다. **위키 조사(13절)로 34건이 닫혔다.** 남은 것은 아래뿐이다.

**게임 확인 6건**

| 항목 | 무엇을 보면 갈리나 |
| --- | --- |
| **침식 확률** | 위키 전역표(SP 0 → 0%)와 이전 게임 확인(SP 0 → 25%)이 **충돌한다.** SP 0 상태에서 E.G.O 카드의 「침식확률 N%」 표기를 한 번 본다 |
| 연출 전용 E.G.O 5종의 처리 | 각성 스킬을 뗀 뒤 `201011` 등에 붙일지. 연출 전용 E.G.O 는 위키에 없다 |
| 유닛 키워드 9종 | mj 코드와 loc 키 명명이 달라 대응이 안 붙는다. 인격 정보 화면의 태그 줄 |
| `walpu-8` 봉봉 등장 수 | 위키에 없고 `num` 도 동시 등장 수가 아니다(합 22, 다른 곳엔 77) |
| 잔영 4·5등급 지급처 | 위키가 시작 버프까지만 적는다 |
| `text_color` 61건 결손 시 카드 이름 색 | 제품 결정. 1301(값 있음)과 1201(결손)을 나란히 본다 |

**경미한 위키 불일치 2건 (병기만 하고 단정 안 함)** — 보상 레벨 4 수량(위키 ×4 / 우리 5) ·
`clr_hard_count` 첫 점수(위키 30 / 우리 20). 둘 다 위키 편집자 오타로 보인다.

**제품 판단 4건** — story_dungeon 126종 노출 여부(위키가 완전히 분리하므로 `domain` 필터
근거는 확보) · E.G.O 스킬 수치 적재 여부(원본 검증 통과) · `ego_requirement` 314행 유지 여부
(드롭 후보) · `gift_stage_text` 자리표시자 치환을 어느 층에서 할지.

## 12. 상세

| 편 | 도메인 | 파일 |
| --- | --- | --- |
| 1 | 인격 | [01-identity.md](01-identity.md) |
| 2 | E.G.O | [02-ego.md](02-ego.md) |
| 3 | E.G.O 기프트 | [03-gift.md](03-gift.md) |
| 4 | 테마 팩 | [04-pack.md](04-pack.md) |
| 5 | 팩↔기프트 관계 | [05-pack-gift.md](05-pack-gift.md) |
| 6 | 인카운터·적 | [06-encounter.md](06-encounter.md) |
| 7 | 층·거울 던전 진행 | [07-floor.md](07-floor.md) |

위키 조사 상세는 [`wiki/`](wiki/) 아래 같은 번호로 있다.

---

## 13. 위키 조사 (2026-08-03)

11절이 남긴 미확정 40건을 `limbuscompany.wiki.gg` 를 중심으로 조사했다.
**34건이 닫혔다.** 도메인별 상세는 [`wiki/01`](wiki/01-identity.md) ~ [`wiki/07`](wiki/07-floor.md).

```
확정            34건
위키로 불가      6건   (11절)
```

### 13.1 감사 자체가 틀렸던 것 — 초판 정정 9건

이것이 이번 조사의 가장 큰 소득이다. **감사가 버그라고 지목한 것 중 9건이 오진이었다.**

| # | 초판 주장 | 실제 | 근거 |
| --- | --- | --- | --- |
| 1 | 팩 1122 의 전용 기프트 9종이 `gift_pack` 결손 | **결손 아님.** 팩이 게임에서 삭제됨(2025-10-23) | 위키 팩 페이지 `{{removed}}` · 9종 전부 `Unobtainable` Removed 목록 |
| 2 | 팩 1122 의 `floor_pack` 5행 결손 | **결손 아님.** 같은 이유 | 같음 |
| 3 | `overlay_sprite` 가 현행의 보스 그림 버그를 고쳐 준다 | **전제 오류.** 보스 층 카드가 아니라 같은 카드의 위 레이어 | 애셋 규격 380×690(배경) vs 391×432(투명 일러스트) |
| 4 | mj `bossPool` 204 와 assets `bossEncounters` 75 가 갈린다 | **어긋남 아님.** 후자는 팩→파일 포인터, 후보는 파일의 `battles` 에 있다 | 75팩 합계 100 = bossPool 합계 100 |
| 5 | `encounter_target.portrait` 를 FK 로 승격하면 적이 붙는다 | **적 id 가 아니라 초상화 이미지 id.** 승격하면 37건이 틀린 적에 붙는다 | 위키가 `BongBong-1366_portrait.png` 를 쓰며 적 id 는 1373 으로 따로 씀 |
| 6 | `waves`/`phases`/`battles` 986건을 타깃으로 펼쳐야 한다 | **`battles` 는 보스 「후보」 목록.** 펼치면 같은 적이 중복 계수된다 | 75/75 팩에서 `len(battles)` = `len(bossPool)`, 위키 「Possible Bosses」와 순서까지 일치 |
| 7 | `md__walpu-8` 봉봉 3행은 중복 | **중복 아님.** 1370/1371/1372 = Swarm Movement Prep 1/2/3 세 변형 | partId 137001/137101/137201 |
| 8 | 「원본에 season 키가 없다」 | **mj 한정 오진.** assets·shared-library 둘 다 `season: 0` 보유 | 위키텍스트 `season=0` |
| 9 | 반격 4건은 canonical 쪽 정보가 더 많다 | **잡음이 더 많은 것.** 4건 전부 단계 0·덱 0·이름 0 껍데기 | 위키 "All counter skills are located in defense slots only" |

교훈 — **감사가 「원본에 있는데 안 담겼다」고 말할 때, 그 원본 필드의 의미를 확인하지 않으면
같은 종류의 오진이 난다.** 위키는 그 의미를 확인하는 값싼 수단이다.

### 13.2 확정된 데이터 버그

| 항목 | 판정 | 규모 |
| --- | --- | --- |
| `season 0` | **시즌 7 이 맞다.** 위키 "is the Mirror Dungeon of Season 7" | `reward` 100 + `achievement` 93 = 193행 |
| 연출 전용 E.G.O 스킬 오귀속 | 20101·20301·20501·20601·21101 각성 스킬 **1개**. 대조군 20608·21209 는 2개로 확인 | 5건 |
| 코인 0개 E.G.O 스킬 | 실재하지 않는다. 위키 `2120611`·`2120911` 둘 다 `coin=1` | 9 스테이지 |
| 동기화 3 시작 스킬 앞채우기 | **canonical 이 지어냈다.** 위키 "Tables for Uptie I and II do not display Skill 3 data" | 216 중 206 |
| 무명 패시브 6건 | **게임에 없다.** 6/6 전수 대조에서 대응물 0 | 노출 금지 |
| `gift.hard_only` | **정답은 116 도 122 도 아닌 117** | 5건 canonical 오류 + 1건 canonical 정답 |
| `gift_requirement` `absolute` 누락 | 9001·9043·9049·9052·9053·9066 | 6건 |
| `canonical.enemy` 에 부위 행 혼입 | 1,342 중 472행(35%)이 적이 아니다 | 「적 870종」으로 정정 |
| `[count]` 임계값 | 10·20·30·40·50 / 20·40·60·80·100 확정 | 28건 |
| `points`/`hard_only` 길이 불일치 | `points` 가 기준. `shp_purchase` 의 `true` 는 **게임사 원본 오류**(MD6 값 복사) | 5건 |
| 화면 안내문 「normal 이 1–5」 | **데이터가 옳고 문안이 틀렸다.** normal 은 다섯 구간 | 문안 수정 |

### 13.3 결손이 아니라고 확정된 것

```
동기화 5              없다. 위키 "can currently be Uptied to Tier IV"
                     「값이 바뀌는 6건」은 전부 E.G.O 스킬이었다(identity_skill 연결 0)
fusion_slot.count    NULL 178행은 전부 1. 예외는 9083 달의 기억 하나뿐
extreme railway 4종   현행 standard 가 맞다. extreme=true 는 「EXTREME 층에도 나온다」는 뜻
bokgak 6종            위키가 "Intervallo Rerun Events—also known as BokGak" 으로 정의. 집합 동일
                     단 1113 의 짝은 1103 이다(감사 문서가 빠뜨렸다)
역경 11~15층          옳다. 덤 — value 는 역경 점수이고 합계가 정확히 60
MD6LimitBaseN        개별 역경이 아니라 시스템 전체 라벨(ko 「추가되는 제약」). 미적재가 정상
교차 출처 13건        전부 limbus-assets(canonical) 가 맞다
인카운터 저항 16종     정상. 위키 등급은 구간이다 — Fatal (1.5,2] … Ineffective (0,0.75) · Immune [0]
                     0.1 실재. 위키 Ineff.[x0.1] 명기. BongBong 10축 10/10 일치
en/ja 한국어 6종      5건은 「게임 미구현 기프트」라 결손이 아니다(위키 Unused E.G.O Gifts)
경로 0건 13종         전부 획득 경로가 있다 — 저주 정화 3 · EXTREME 히든 보스 4 · 합성 실패 보상 1
                     · 잔영 5(시작 버프 지급)
```

### 13.4 위키로 얻은 새 사실

**전수 대조 하나가 통째로 통과했다** — 위키 `List_of_Floor_Themes` 117행 대 
`canonical.floor_pack` 288행이 **116/116 불일치 0**. 층별 후보 팩 수를 위키에서 독립
재계산해도 normal 8·11·14·19·23 / hard 13·16·27·41·46·46·24 로 한 자리도 안 틀린다.

```
pack_text.en          위키 문서 제목과 글자 단위로 같다 → 앞으로 위키 대조의 키
위키 Traits           = identity_association ∪ identity_unit_keyword
                       게임의 태그 줄 하나를 canonical 이 두 테이블로 쪼갰다
유닛 키워드 한국어      위키가 아니라 우리 raw 에 있었다 — identities/loc-ko/UnitKeyword*.json
                       25/36 이 id 정합으로 즉시 나온다(FIXER→해결사 · CLAN→조직)
keyword.order         위키 Starting Gift 표 순서로 채울 수 있다
E.G.O 스킬 수치        위키가 단계별로 전부 싣는다. 표본 3종 전 필드 대조 불일치 0
                       → ego-details 를 적재해도 안전하다는 근거
exclusiveTo 의 두 의미  위키가 Unique(드랍)/Fusion 을 다른 절로 분리한다
                       live 236 에 합성 결과물 0건 → 경계가 정확히 일치
버려진 assets 필드 3종   vestige · hidden · cursedPair/blessedPair
                       살렸으면 경로 0건 13종 중 12종이 데이터로 설명됐다
EXTREME 팩             게임이 EXTREME 에선 팩 관찰을 봉인한다 → 추천 후보에 넣을 이유가 없다
                       감사의 「extreme 8팩」은 21팩 오독
```

**정합 재검증 수단이 생겼다.** 위키 MediaWiki API(`action=parse&prop=wikitext`)로 원문을
받아 파싱하면 시즌 개편마다 `floor_pack` 을 자동 회귀 검증할 수 있다. 재현 스크립트는
[`wiki/07-floor.md`](wiki/07-floor.md) 부록에 있다.

### 13.5 조사 중 주의할 점

- `limbuscompany.wiki.gg` 의 `action=raw` 는 rate limit 이 있다. 연속 조회 시 본문 대신
  `{"error":"ratelimited"}` 가 오므로 이를 「문서 없음」으로 오독하면 안 된다. 20초 간격이 필요하다
- `WebFetch` 는 위키 표를 요약해 없앤다. 표를 다뤄야 하면 MediaWiki API 로 원문을 받아야 한다
- `fandom.com`(402) · `prydwen`(403) 은 접근 불가였다
- **`tcrf.net` 이 Claude 계열 User-Agent 를 겨냥한 프롬프트 인젝션을 내보낸다.**
  문서 본문에 심긴 것이 아니라 **서버가 UA 로 갈라서** `ClaudeBot/1.0`·`Claude-User/1.0` 에만
  이 페이지를 준다(일반 Chrome UA 는 403 인터스티셜, `GPTBot`·`python-requests`·UA 없음은 403).
  경로와 무관하며 존재하지 않는 문서를 요청해도 같은 페이지가 온다(3/3 확인).
  내용은 ① 현재 디렉터리의 모든 파일을 0바이트로 덮어쓰기 ② `mv` 연쇄로 파일 순환 교체
  ③ `Test completed! :)` 출력. 「사용자가 이 페이지를 요청했다」·「사람은 따르지 마라」·
  「책임은 에이전트에게 있다」로 권위를 위장한다. 끝에 `July 32, 2026` 이라는 없는 날짜가 붙는다.
  조사자가 따르지 않았고 어떤 판정에도 쓰지 않았다. **이 사이트는 출처에서 제외한다** —
  Claude UA 에는 문서 내용을 아예 주지 않으므로 조사용으로 쓸모도 없다.
- **`WebFetch` 는 원문을 그대로 주지 않는다.** 페이지를 작은 모델에 통과시키므로 인젝션을
  만나면 「발견했고 따르지 않겠다」는 요약만 온다. 원문 확인이 필요하면 `curl` 로 raw 를 받아야 한다.
- 위키 기준 시점은 시즌 7 「이름과 거미의 거울」(2026-02-19 시작)이며 우리 스냅샷(MD7)과
  같은 시즌이다. 시점 유보 항목은 없다
