# E.G.O 기프트 계열 지도 (Gift Overview)

> 상태: **기프트 편 완료** / 최종 수정 2026-07-31 · 스냅샷 2026-07-25
> 회차 1–8 을 모두 마쳤다. 미해결 1건(색 4건 불일치)만 남았다.

## 1. 기프트 id 체계

```
9 | 대역(1자리) | 순번(2자리)

9001 = 90 대역 1번
9843 = 98 대역 43번
```

인격은 `1xxxx`, E.G.O 는 `2xxxx` 5자리인데 **기프트는 4자리**다. 대역이 6개이며
**`93` · `95` · `96` 은 비어 있다.**

```
90xx  99      91xx 100      92xx  81
94xx  28      97xx  99      98xx  34        합 441 (mj) / 456 (assets)
```

## 2. 원본 파일

| 파일 | 회차 | 성격 |
| --- | --- | --- |
| `limbus-data-mj/gifts.json` | 1 | 441건 · 키 15종. **`requires` 구조가 여기만 있다** |
| `limbus-data-mj/gifts_detail.json` | 2 | 441건 · **한국어 강화 텍스트가 여기만 있다** |
| `limbus-assets/gifts.json` | 3 | **정본** · 456건 완전집합 (+`shared-library` 대조) |
| `limbus-data-mj/start_gifts.json` · `limbus-assets/md__universal_gifts.json` | 4 | 시작 기프트 30(게임 규칙) · 추천 묶음(도구 해설) |
| `loc-*/EGOgift_MirrorDungeon*.json` 12파일 × 3 | 5 | 거울 던전 계열 604건. 강화 단계가 id 에 들어 있다 |
| `loc-*/EGOgift_StoryDungeon*` + 이벤트·발푸르기스 계열 | 6 | 16파일 · 189건. 회차 5와 456건을 빈틈없이 나눈다 |
| `loc-*/EGOgift.json` · `EgoGiftCategory.json` · `MirrorDungeonEgoGiftLockedDesc.json` | 7 | **`loc-ko` 에 `EGOgift.json` 이 없다** |
| `data/assets/gifts/` 476개 | 8 | 이미지. **파일명이 id 가 아니다** · 결손 0 · 잉여 20 |

## 3. DB 모델 7종

```
Gift ─┬─ GiftText
      ├─ GiftPack           (packs)
      ├─ GiftExclusivePack  (exclusiveTo)
      ├─ GiftToken
      ├─ Keyword            (기믹 7 + 공격 타입 3)
      └─ FusionRecipe ─ FusionSlotOption
```

`prisma/schema.prisma:472` 부근. **정본은 `limbus-assets`** 이며(456종 완전집합),
mj 는 `cost`·`packs` 만 보강한다(`src/entities/gifts.ts:1`).

## 4. 개념 장부

| 개념 | `limbus-data-mj` | `limbus-assets` | 정본 | 근거 | 회차 |
| --- | --- | --- | --- | --- | --- |
| 등급 | `gifts.tier`(문자열) | `gifts.tier` | 동일 | 441/441 일치. 화면은 로마 숫자 | 1 |
| 기믹·공격 타입 키워드 | `gifts.keyword`(null 109) | `gifts.keyword`(`Keywordless`) | 동일 | 109건은 같은 사실의 다른 표현 | 1 |
| 거울 던전 비용 | `gifts.cost` | — | **mj** | 게임 화면 코스트와 일치. 15종은 빈다 | 1 |
| 팩 소속 | `gifts.packs`(117종) | — | **mj** | **정본에 없는 단일 출처** | 1 |
| 테마 한정 | `gifts.uniquePacks`(171) | `gifts.exclusiveTo`(230) | **assets** | mj ⊂ assets · 겹치는 171건 값까지 동일 | 1 |
| **하드 난이도 전용** | `gifts.hardOnly`(53) | `gifts.hardonly`(116) | **합집합 122** | **둘 다 결손이 있다** | 1 |
| 발동 조건(구조) | `gifts.requires`(126) | — | **mj** | 5종 구조. **미적재** | 1 |
| 발동 조건(문자열) | — | `gifts.triggers`(451) | **assets** | 엔진이 정규식으로 파싱 | 1 |
| 융합 그래프 | `gifts.combinesFrom`(59)·`fusesInto`(132) | `gifts.recipes`(60)·`ingredientOf`(142) | **assets** | 겹치는 것은 값까지 동일. `9083` 대체 슬롯은 mj 가 표현 못 한다 | 1·3 |
| 엔진 조건 어휘 | — | `gifts.effects`(55)·`triggers`(150) | **assets** | 구버전에 없다. `Other Uncommon` 이 뭉개져 있다 | 3 |
| 저주/축복 쌍 | — | `cursedPair`·`blessedPair`(3+3) | **assets** | 서로 참조. **미적재** | 3 |
| 애셋 스프라이트 키 | — | `gifts.srcPath` | **assets** | 381건이 이름. id 로 추정 불가 | 3 |
| 죄악 / 색 | `gifts_detail.attributeType`(색 7종) | `gifts.affinity` | **assets** | mj `gifts.sin` 은 파생값. 441/441 일치 | 1·2 |
| 상태명 키워드 | `gifts_detail.keyword`(상태명 12종) | — | 중복 | `gifts.keyword` 와 1:1 | 2 |
| **키워드 공식 사전** | — | — | **loc-\*** | `EgoGiftCategory.json` 12종. `None`=「범용」·`Random` 추가 | 7 |
| 획득 조건 문구 | — | — | **loc-\*** | `LockedDesc` 64건. 전부 `packs` 0개 | 7 |
| 강화 단계 | `gifts_detail.upgrades`(0–2) | `gifts.enhanceable` | **mj** | 110 = 3단계 107 + 2단계 3. 완전 일치 | 2 |
| 한국어 강화 텍스트 | `gifts_detail.upgrades[].effectKo` | — | **mj + loc** | loc 도 갖는다(id 에 단계). 유일 출처 아님 | 2·5 |
| 능력 단위 한 줄 | — | — | **loc-\*** | `simpleDesc` 배열 1,087항목. `abilityID` 분해가 mj 와 105건 다르다 | 5 |
| 이벤트 테마 전용 기프트 | — | — | **loc-\*** | 회차 5의 `2xxx` 12건 + 회차 6의 122건. assets 에 없다 | 5·6 |
| 이벤트판 ↔ 상시판 이중 id | — | — | **loc-\*** | 이름 같고 id 다른 쌍 **30건**. id 조인 불가 | 6 |
| 한국어 이름·설명 | `gifts.nameKo`·`descKo` | — | **mj + loc** | 441 전부 유일 | 1 |
| 시작 기프트 | `start_gifts.json`(10축 × 3) | — | **mj** | 전부 tier 2 · keyword 30/30 일치. **미적재** | 4 |
| 추천 묶음 | — | `md__universal_gifts.json` | **도구 해설** | `individual` 6그룹이 비어 있다 | 4 |
| 기프트 이미지 | — | `assets/gifts/` 476개 | **assets** | 파일명이 `srcPath`. **id 로 못 찾는다** | 8 |

### 4.1 결산 — loc 이 가장 많이 갖는 첫 사례다

| 출처 | 단독 보유 개념 | 내용 |
| --- | ---: | --- |
| `limbus-data-mj` | **5** | `cost` · `packs` · `requires` 구조 · 색 원본 · 시작 기프트 |
| `limbus-assets` | **6** | `triggers`/`effects` · 저주·축복 쌍 · `srcPath` · 이미지 · 대체 슬롯 레시피 · 추천 묶음 |
| `loc-ko/en/ja` | **6** | **키워드 공식 사전** · 획득 조건 문구 · `simpleDesc` · 로케일 전용 기프트 134건 · 이중 id 30쌍 · 한국어 카테고리명 |
| `shared-library` | 0 | 구버전 시간축만 |

```
인격 편    mj  9 · assets 15 · loc 6
E.G.O 편   mj  1 · assets  6 · loc 4
기프트 편   mj  5 · assets  6 · loc 6      ← 셋이 거의 균등
```

**세 출처가 처음으로 비슷해졌다.** 어느 하나를 골라도 3분의 1을 잃는다.

### 4.2 기프트 편에서 확인된 원본 결함 5건

| 사례 | 성격 | 회차 |
| --- | --- | --- |
| `hardOnly` 65건 불일치 | **mj·assets 양쪽 다 결손.** 게임 확인으로 판정 | 1 |
| `9726` 낙수의 잔 `desc` 가 `"excep"` 로 잘림 | 단어 절단 | 2 |
| `keyword` 에 `null` 과 문자열 `"None"` 혼재 | 64 + 45 | 2 |
| `attributeType` ↔ `affinity` 4건 어긋남 | 색·죄악 대응 실패 | 3 |
| `loc-ko` 에 `EGOgift.json` 없음 — **6건 한국어 결손** | 일본어는 갖는다 | 7 |

### 4.3 회차를 가로지른 기프트

| 대상 | 나온 곳 |
| --- | --- |
| `9282` 날개 모양 양초 | 조건부 기믹 원문 · 소속 3인 조건 · `hardonly` 불일치 |
| `9212` 모든 악의 끝 | 「구매불가」 = `packs []` · 합성 · `hardOnly` mj 단독 · `LockedDesc` |
| `9801`·`9804` ↔ `2066`·`2070` | `abilityIDs` 가 다른 번호 공간을 가리킨 2건 |
| `9083` 달의 기억 | 유일한 **대체 슬롯 레시피**. mj 가 표현 못 한다 |
| `9227`–`9232` 저주·축복 3쌍 | `cursedPair`/`blessedPair` · 「저주 해제」 획득 경로 |

## 5. 다른 편에서 미리 본 것

| 관측 | 나온 곳 | 기프트 편에서 |
| --- | --- | --- |
| `9282` 날개 모양 양초 — 조건부 기믹 | 인격 편 회차 1 · `08-gimmick-keywords.md` | **회차 1에서 원문 확보** |
| `Tremor Skill Used` 계열 25건에서 엔진 과대 계상 | `08-gimmick-keywords.md` 4.2 | **회차 3에서 원본 확인** — `triggers` 150종 |
| 기프트 색 표기(`attributeType`) | `backlog/03-gift-affinity.md` | 회차 2 |
