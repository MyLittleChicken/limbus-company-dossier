# 회차 5 — `data/assets/statuses` 상태 아이콘

> **애셋** · `limbus-assets` **1,192개** · 9.4 MB · 전부 `.webp`
> `shared-library` **1개** · `.png`
> 출처 커밋 `774883d7` · 스냅샷 2026-07-25 · 정리 2026-07-31
> **상태 편(회차 1–5)의 마지막 회차**

---

## 1. 조회 키가 둘, 결손이 0이다

```
srcPath 유일 996        →  애셋 있는 것 996 / 996
imageOverride 유일 90   →  애셋 있는 것  90 / 90
                          결손 0
```

**여섯 번째 엔티티도 결손이 없다.**

| 엔티티 | 애셋 | 결손 | 잉여 |
| --- | ---: | ---: | ---: |
| 인격 | 712 | 0 | 18 |
| E.G.O | 318 | 0 | 0 |
| 기프트 | 476 | 0 | 20 |
| 팩 | 155 | 0 | 2 |
| **상태** | **1,193** | **0** | **191** |

## 2. `srcPath` 를 134개가 공유한다

```
srcPath 보유 1,218 · 유일 996        →  222건이 남의 아이콘을 쓴다
공유되는 srcPath 134종
```

```
IndexPrescript_Base_2nd  17종이 공유
FavorBuffTwth            11
Prescript                 9
Bloomed Rose              7      ← 회차 1의 이름 중복 7건과 같다
BloodArmor                6
```

**단계·변형이 다른 상태들이 같은 아이콘을 쓴다.** 회차 1에서 본 `Bloomed Rose` 이름
중복 7건이 아이콘도 공유한다.

## 3. 애셋에만 있는 191개 — **파일명이 표시명이다**

```
"... For my Family, as their Father..."      "Affinity Res. Boost (Exc. Envy)"
"Accept the Pain!"                          "A Deep Wound"
"AaCePbBc"                                  "Agitated 1"
```

두 종류가 섞여 있다.

| 종류 | 예 |
| --- | --- |
| **영문 표시명** | `Affinity Res. Boost (Exc. Envy)` · `Accept the Pain!` |
| **내부 코드** | `AaCePbBc` · `AaCfPcBj` |

```
로케일 합집합 1,524종 중 이 191개와 겹치는 것   10
```

**대부분이 어느 사전에도 없다.** `statuses.json` 1,472종에도, 로케일 1,524종에도 없다.

문장부호(`!` · `...` · 괄호)까지 파일명에 들어 있어 **표시명을 그대로 파일명으로 쓴
잔재**로 보인다. 기프트 편 회차 8의 잉여 20건과 같은 성격이지만 규모가 훨씬 크다.

## 4. `shared-library` 에 `.png` 1개

```
Circle_EmptyPart.png
```

구버전 `imageOverride` 34종 중 **33종은 현행 `limbus-assets` 애셋으로 커버**되고
이 1개만 남았다. 팩 편 회차 4의 `Collab_Pilgrimage.png` 와 같은 패턴이다 —
**`shared-library` 애셋은 `.png`, 현행은 `.webp`** 다.

---

## 함정 요약

1. `srcPath` 를 **134종이 공유**한다. 상태당 유일하지 않다
2. 애셋에만 있는 **191개 중 181개는 어느 사전에도 없다**
3. 파일명에 **문장부호가 들어간다**(`!` · `...` · 괄호). 경로 처리에 주의
4. `shared-library` 애셋만 **`.png`** 다

## 미해결

없다. 1,193개 전부 확정했다.

## 근거 재현

```
data/assets/statuses/limbus-assets/                  1,192개 · webp
data/assets/statuses/shared-library/                     1개 · png
data/entities/mechanics/limbus-assets/statuses.json  srcPath 996 · imageOverride 90
data/entities/mechanics/loc-ko/                      로케일 합집합 1,524
```
