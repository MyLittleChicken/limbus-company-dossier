# 인카운터 계열 지도 (Encounter Overview)

> 상태: **인카운터 편 완료** / 최종 수정 2026-07-31 · 스냅샷 2026-07-25
> 회차 1–3 을 마쳤다. **마스터북의 마지막 편**이다.

예상 8회차였으나 실제 3회차로 닫혔다 — 적 스킬 문자열이 거울 던전 편 회차 7에서
이미 다뤄졌기 때문이다.

## 1. 원본 파일

| 파일 | 회차 | 성격 |
| --- | --- | --- |
| `limbus-assets/encounters/*.json` 251개 | 1 | 전투 조우 · 적 스탯 |
| `loc-*/Enemies*.json` 43파일 × 3 | 2 | 적 이름 1,342종 |
| `data/assets/encounters/` 506개 | 3 | 초상 |

## 2. DB 모델 — **없다**

`Encounter` 모델이 없다. **전량 미적재**다.

## 3. 개념 장부

| 개념 | `limbus-data-mj` | `limbus-assets` | `loc-*` | 정본 | 회차 |
| --- | --- | --- | --- | --- | --- |
| 전투 구조 | — | `targets`/`waves`/`battles`/`phases` | — | **assets** | 1 |
| 적 저항 | — | `resists` **10축** | — | **assets** | 1 |
| 적 부위 | — | `parts`(1,055 · 부위별 저항) | — | **assets** | 1 |
| 적을 대신하는 인격 | — | `identityOverride`(69종) | — | **assets** | 1 |
| 적이 쓰는 E.G.O | — | `egoList`(83종) | — | **assets** | 1 |
| 적 이름(ko) | — | — | `Enemies*` 1,342 | **loc** | 2 |
| 초상 | — | `portrait`(458) | — | **assets** | 1·3 |
| **전투 풀** | `packs_detail` 2,525종 | — | — | **정의 없음** | 2 |

### 3.1 결산

| 출처 | 단독 보유 개념 |
| --- | ---: |
| `limbus-assets` | **6** |
| `loc-ko/en/ja` | **1** |
| `limbus-data-mj` | **0** (참조만 하고 정의가 없다) |

```
인격 편     mj  9 · assets 15 · loc 6
E.G.O 편    mj  1 · assets  6 · loc 4
기프트 편    mj  5 · assets  6 · loc 6
팩 편       mj  6 · assets  2 · loc 1
거울 던전 편  mj  0 · assets  5 · loc 4
상태 편     mj  3 · assets  3 · loc 1
인카운터 편  mj  0 · assets  6 · loc 1
```

### 3.2 적 저항이 인격·E.G.O 와 다르다

```
인격      공격 타입 3축      값 [0.5, 1, 2]
E.G.O    죄악 7축          값 [0.5, 0.75, 1, 2]
적        10축 (3 + 7)     값 10종 — 0.6 · 0.8 · 1.2 · 1.6 이 추가
```

**적만 두 축을 다 갖고, 부위마다 또 따로 갖는다**(`parts[].resists` 1,140건).

### 3.3 미해결 1 — 전투 풀 정의가 없다

```
mj packs_detail 의 전투 풀   7자리 숫자 2,525종
그 실체를 담은 파일            없음
```

`data/` 전역을 훑었고 없다고 확정했다. 걸린 23건은 E.G.O 스킬과 **번호 공간이 겹친 것**이다.

→ `docs/backlog/10-encounter-linkage.md`

## 4. 원본 결함 3건

| 사례 | 회차 |
| --- | --- |
| `portrait` 이 **정수·문자열 혼재**(697 · 640) | 1 |
| `siteId` 중복 1건(`md__railway-5` / `-a`) | 1 |
| **애셋 결손 2건**(`1286` · `1307`) — 마스터북 유일 | 1·3 |
