# 거울 던전 계열 지도 (Mirror Dungeon Overview)

> 상태: **거울 던전 편 완료** / 최종 수정 2026-07-31 · 스냅샷 2026-07-25
> 회차 1–7 을 모두 마쳤다. 미해결 없이 닫혔다.

## 1. 원본 파일

| 파일 | 회차 | 성격 |
| --- | --- | --- |
| `limbus-assets/md__details.json` · `md_floor_packs.json` | 1 | 은총 10 · 시작 기프트 30 · 역경 5 · 층별 팩 |
| `limbus-assets/md_choice_events.json` | 2 | 선택지 이벤트 159 |
| `limbus-assets/md__achievements.json` · `md__md6__achievements.json` | 3 | 업적 93 + 90 |
| `limbus-assets/md__rewards.json` · `md__md6__rewards.json` · `encounters.json` | 4 | 보상 100등급 × 2 · 인카운터 이름 사전 |
| **`md-resource/*.sql`** | 5 | **게임 데이터가 아니다** — 다른 도구의 DB 스키마 |
| `loc-*` 이벤트 계열 12파일 | 6 | 364건 |
| `loc-*` UI·버프·스킬 38파일 | 7 | 2,672건 |
| `shared-library/md_floor_packs.json` | 1 | 구버전 대조 |

## 2. DB 모델 — **거의 없다**

```
MirrorDungeonGrace     은총 10종만 적재된다  (src/entities/egos.ts:211)
```

선택지 이벤트 · 업적 · 보상 · 시작 버프 · 역경 · 층별 팩이 **전부 미적재**다.
`limbus-assets` 8파일 중 실제로 읽는 것은 `md__details.json` 의 `grace` 하나뿐이다.

## 3. 개념 장부

| 개념 | 출처 | 정본 | 실측 | 회차 |
| --- | --- | --- | --- | --- |
| 은총 | `md__details.grace` | **assets** | 10종 · 비용 10–50 두 개씩 · 3단계 | 1 |
| 시작 기프트 | `md__details.startGiftPool` · mj `start_gifts.json` | 동일 | **10/10 일치** | 1 |
| 역경 | `md__details.adversity` | **assets** | 5단계 · value 합 9→14 | 1 |
| 층별 출현 팩 | `md_floor_packs` · 팩 `normalFloors`/`hardFloors` | 동일 | **218/218 일치** | 1 |
| 선택지 이벤트 | `md_choice_events`(159) · loc `ActionEvents`(128) | **양쪽 필요** | 구조 vs 문자열 · 어긋남 25·56 | 2·6 |
| 환상체 이벤트 | loc `AbEvents`(108) | **loc** | 선택지와 교집합 0 | 6 |
| 업적 | `md__achievements` 93 + 90 | **assets** | 교집합 66 · `tips` 는 편집자 해설 | 3 |
| 주간 보상 | `md__rewards` 100등급 × 2 | **assets** | 템플릿 · 배치만 75건 다름 | 4 |
| 인카운터 이름 | `encounters.json` 5콘텐츠 | **assets** | 팩 `bossEncounters` 75/75 | 4 |
| 시작 버프 「별빛」 | loc `DungeonStartBuffs*`(116) | **loc** | 은총과 다른 축 | 7 |
| 환상체 스킬 | loc `Skills_Abnormality_Mirror*`(323) | **loc** | `keywords`·`coindescs` 새 키 | 7 |

### 3.1 결산 — assets 와 loc 이 반씩 갖는다

| 출처 | 단독 보유 개념 | 내용 |
| --- | ---: | --- |
| `limbus-assets` | **5** | 은총 · 역경 · 업적 · 보상 · 선택지 이벤트 구조 |
| `loc-ko/en/ja` | **4** | 환상체 이벤트 · 시작 버프 · 환상체 스킬 · 선택지 문구 |
| `limbus-data-mj` | 0 | 맵 생성 규칙은 **팩 편**(`packs_detail`)에 있다 |
| `md-resource` | — | 게임 데이터가 아니다 |

```
인격 편     mj  9 · assets 15 · loc 6
E.G.O 편    mj  1 · assets  6 · loc 4
기프트 편    mj  5 · assets  6 · loc 6
팩 편       mj  6 · assets  2 · loc 1
거울 던전 편  mj  0 · assets  5 · loc 4      ← mj 가 0인 첫 사례
```

**거울 던전 디렉토리에 `limbus-data-mj` 가 없다.** 다만 맵 생성 규칙(`mapGen` ·
`mapGenSequence`)은 팩 편의 `packs_detail.json` 에 있으므로, **거울 던전 구조 전체로
보면 mj 가 여전히 핵심**이다.

### 3.2 거울 던전 편에서 확인된 원본 결함 5건

| 사례 | 성격 | 회차 |
| --- | --- | --- |
| `971071` · `971072` 참조 깨짐 | 팩이 뽑는데 이벤트 정의가 없다 | 2 |
| `971048` `name` 이 빈 문자열 | | 2 |
| 결과 3건에 `type` 키 없음 | | 2 |
| `GiveMeCandy_LowMorale` / `LowMoral` | 두 파일이 같은 상태를 다른 id 로 부른다 | 7 |
| **BOM 붙은 파일 4종** | 3로케일 전부 · `utf-8-sig` 필요 | 7 |

### 3.3 완전 일치 쌍이 셋 나왔다

같은 관계를 두 곳에 저장하는데 어긋남이 0인 사례다.

```
기프트 ↔ 팩          gifts/packs · uniqueGifts/uniquePacks     441/441   팩 편 1
층 ↔ 팩             md_floor_packs ↔ normalFloors/hardFloors  218/218   회차 1
팩 ↔ 인카운터        bossEncounters ↔ encounters.json 의 md      75/75   회차 4
```

## 4. 다른 편으로 넘긴 것

| 관측 | 넘긴 곳 |
| --- | --- |
| mj 7자리 인카운터 id 2,525종 ↔ assets 문자열 키 — **연결표 없음** | 인카운터 편 |
| `md_choice_events` 의 `battle` 25건이 갖는 7자리 id | 인카운터 편 |
