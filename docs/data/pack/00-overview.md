# 거울 던전 테마 팩 계열 지도 (Pack Overview)

> 상태: **팩 편 완료** / 최종 수정 2026-07-31 · 스냅샷 2026-07-25
> 회차 1–4 를 모두 마쳤다. 미해결 없이 닫혔다.

## 1. 팩 id 체계 — **대역이 곧 분류다**

```
1 | 분류(2자리) | 순번(2자리)          117건 · 1001–3001
```

| 대역 | `category` | 건수 |
| --- | --- | ---: |
| `10xx` | `canto` (본편 장) | 27 |
| `11xx` | `event` 18 · `railway` 6 · `walpurgis` 4 | 28 |
| `12xx` | `attack_type` | 6 |
| `13xx` | `sin` | 21 |
| `14xx` | `keyword` | 14 |
| `15xx` | `extreme` | 20 |
| `3001` | `extreme` | 1 |

**`category` 와 id 대역이 1:1 대응한다.** `11xx` 만 셋을 섞고, `extreme` 만 `3001` 하나가
대역 밖에 있다.

## 2. 원본 파일

| 파일 | 회차 | 성격 |
| --- | --- | --- |
| `limbus-data-mj/packs.json` | 1 | 117건 · 키 16종. **기프트 목록이 여기만 있다** |
| `limbus-data-mj/packs_detail.json` | 2 | 117건 · 키 5종. **맵 생성 규칙이 여기만 있다** |
| `limbus-assets/md_theme_packs.json` | 3 | 117건 · 키 8종 (+`shared-library` 56건 대조) |
| `loc-*/MirrorDungeonTheme-1.json` · `data/assets/packs/` 155개 | 4 | 표시명 · 이미지 |

## 3. DB 모델

**팩 전용 모델이 없다.** `GiftPack` · `GiftExclusivePack` 이 팩 id 를 정수로 들고 있을 뿐
`Pack` 테이블이 없다(`prisma/schema.prisma`).

```
Gift ─┬─ GiftPack           (packId: Int)      ← 이름도 분류도 없다
      └─ GiftExclusivePack  (packId: Int)
```

> **팩은 이름조차 적재되지 않는다.** 화면에서 「'검과 작품' 한정」을 보여주려면
> 모델이 필요하다 → `backlog/09-pack-model.md`

## 4. 개념 장부

| 개념 | `limbus-data-mj` | `limbus-assets` | 정본 | 근거 | 회차 |
| --- | --- | --- | --- | --- | --- |
| 분류 | `packs.category`(문자열 8종) | `md_theme_packs.category`(배열 2단) | **assets** | 계층을 담는다. mj 는 평평하다 | 1·3 |
| 본편 장·난이도 | `packs.chapter`·`variant` | `category[1]` 로마 숫자 | **mj** | `normal`/`mid`/`hard` 는 여기만 | 1 |
| 표시명(ko) | `packs.nameKo` | — | **loc-ko** | 116/117 일치. 1건은 mj 에 후행 공백 없음 | 1·4 |
| 표시명(en) | `packs.name` | `md_theme_packs.name` | 동일 | 셋 다 117/117 일치 | 1·3·4 |
| 기프트 목록 | `packs.gifts`(18–188개) | — | **mj** | **정본에 없다.** 역참조 441/441 일치 | 1 |
| 테마 한정 기프트 | `packs.uniqueGifts`(236) | `exclusive_gifts`(321) | **assets** | mj ⊂ assets · 추가 85 · 제거 0 | 1·3 |
| 층 배정 | `packs.normalFloors`·`hardFloors` | — | **mj** | 1–5층 | 1 |
| 맵 생성 규칙 | `packs_detail.mapGen`·`mapGenSequence` | — | **mj** | 전투 풀 2,525 · 이벤트 풀 77 | 2 |
| 해금 조건 | `packs_detail.unlock.unlockCode` | — | **mj** | 26종 | 2 |
| 보스 인카운터 | `packs_detail.bossPool`(7자리 숫자) | `bossEncounters`(`md\|canto-1-1`) | 미정 | **번호 체계가 다르다.** 인카운터 편에서 판정 | 2·3 |
| 태그 | — | `md_theme_packs.tags`(47종) | **assets** | 화면 필터용 | 3 |
| 이미지 | `packs.sprite` | `image` · `overlayImage` | 동일 | `sprite` == `image` 113/113 | 1·3·4 |
| 텍스트 색 | `packs.textColor`(56건) | — | **mj** | 61건 결손. 미적재 | 1 |

### 4.1 결산 — mj 가 압도적이다

| 출처 | 단독 보유 개념 | 내용 |
| --- | ---: | --- |
| `limbus-data-mj` | **6** | 기프트 목록 · 맵 생성 규칙 · 해금 코드 · 층 배정 · 장/난이도 · 텍스트 색 |
| `limbus-assets` | **2** | `tags` · `overlayImage` |
| `loc-ko/en/ja` | **1** | 표시명(한국어 후행 공백 포함) |
| `shared-library` | 0 | 구버전 · **id 체계가 다르다**(`C1-1`) |

```
인격 편    mj  9 · assets 15 · loc 6
E.G.O 편   mj  1 · assets  6 · loc 4
기프트 편   mj  5 · assets  6 · loc 6
팩 편      mj  6 · assets  2 · loc 1      ← mj 로 쏠린 첫 사례
```

**거울 던전 구조는 `limbus-data-mj` 가 사실상 유일 출처다.** ADR-04 가
「거울 던전 구성 = `limbus-assets`」로 적은 것과 다르다 → `backlog/09` 에 기록.

### 4.2 팩 편에서 확인된 원본 결함 2건

| 사례 | 성격 | 회차 |
| --- | --- | --- |
| `1309` 「감정 앞에 게으른 것 」 `loc-ko` 에 **후행 공백** | mj `nameKo` 는 없다 | 4 |
| `textColor` 61건 결손 | 56건만 값이 있다 | 1 |

## 5. 다른 편에서 이어진 것

| 관측 | 나온 곳 | 팩 편에서 |
| --- | --- | --- |
| 기프트 `packs`(117종) · `uniquePacks` | 기프트 편 회차 1 | **역참조 441/441 완전 일치** |
| 기프트 `exclusiveTo`(230) | 기프트 편 회차 1·3 | 팩쪽 `exclusive_gifts` 와 **230/230 일치** |
| 「'검과 작품' 한정」 게임 표기 | 기프트 편 회차 1 | `1026` = Blade and Artwork |
