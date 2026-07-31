# 회차 1 — `limbus-data-mj/packs.json`

> **테마 팩 본체** · `limbus-data-mj` · **117건** · 170 KB · 키 **16종**
> 출처 커밋 `774883d7` · 스냅샷 2026-07-25 · 정리 2026-07-31
> **팩 편(회차 1–4)의 첫 회차**

## 파일 정체

거울 던전의 **테마 팩** 117종이다. 기프트 편에서 `packs`·`uniquePacks`·`exclusiveTo` 가
가리키던 대상이며, 게임 화면의 「'검과 작품' 한정」 같은 표기가 여기서 나온다.

---

## 키 16종

### 1·2·3. `id` · `name` · `nameKo`

```
117건 · 1001–3001 · 유일 · 이름 중복 0
```

### 4. `category` — id 대역과 1:1 대응한다

| `category` | 건수 | id 대역 |
| --- | ---: | --- |
| `canto` | 27 | `10xx` |
| `extreme` | 21 | `15xx` 20 + **`3001` 1** |
| `sin` | 21 | `13xx` |
| `event` | 18 | `11xx` |
| `keyword` | 14 | `14xx` |
| `attack_type` | 6 | `12xx` |
| `railway` | 6 | `11xx` |
| `walpurgis` | 4 | `11xx` |

**`11xx` 만 셋을 섞고, `extreme` 만 `3001` 하나가 대역 밖**이다.

### 5·6. `chapter` · `variant` — `canto` 27건에만 있다

```
chapter   1–9        null 90
variant   normal 9 · mid 10 · hard 8    null 90
```

**둘의 결손 집합이 정확히 `canto` 가 아닌 90건**이다(예외 0).

```
1장  normal · hard              (mid 없음)
2·3·5·6·7장  normal · mid · hard
4·9장  normal · mid ×2 · hard   (mid 가 둘)
8장  normal · mid               (hard 없음)
```

### 7. `sprite` — 113종

`limbus-assets` 의 `image` 와 **113/113 동일**하다(회차 3).

중복 2종이 있다 — `AttackType_normal` 3건 · `AttackType_effective` 3건.
`attack_type` 6건이 스프라이트 2개를 나눠 쓴다.

### 8. `textColor` — **61건이 결손**

```
값 있음 56 · null 61
```

`af241c` 같은 6자리 16진수다. 화면 색을 담지만 절반이 비어 있다. **미적재.**

### 9·10. `normalFloors` · `hardFloors` — 층 배정

```
normalFloors  길이 0–2 · 빈 것 66      값 1–5
hardFloors    길이 0–3 · 빈 것 21      값 1–5
```

거울 던전 4~5층 구조에서 **이 팩이 몇 층에 나올 수 있는가**다.
하드 쪽이 더 넓게 배정된다(빈 것 21 vs 66).

### 11·12·13. `superposition` · `extreme` · `bokgak` — 불리언 3종

```
superposition  true 46 · false 71
extreme        true 24 · false 93
bokgak         true  6 · false 111
```

`bokgak`(복각) 6건은 기프트 편 회차 8에서 본 「워프특급 살인사건 BokGak」 계열이다.

### 14. `floorLength` — 층 수

```
2층 10 · 3층 3 · 4층 75 · 5층 29
```

### 15·16. `gifts` · `uniqueGifts` — **기프트 목록의 유일 출처**

```
gifts        길이 18–188 · 참조 깨짐 0
uniqueGifts  길이 0–12 · uniqueGifts ⊆ gifts 위반 0 · 총 236
```

#### 기프트 편과 역참조가 완전히 맞는다

```
팩 → 기프트  gifts        ↔  기프트 → 팩  packs          441/441 일치
팩 → 기프트  uniqueGifts  ↔  기프트 → 팩  uniquePacks    441/441 일치
```

**같은 관계를 양쪽에 중복 저장하는데 어긋난 곳이 하나도 없다.**
`limbus-assets` 에는 이 관계가 없다 — 기프트 편 회차 1의 "정본에 없는 단일 출처".

**적재** — `gifts` → `GiftPack`(기프트 쪽에서 읽는다). `uniqueGifts` 는 미적재이며
`GiftExclusivePack` 은 assets `exclusiveTo` 에서 온다.

---

## 함정 요약

1. `category` 는 **id 대역으로 알 수 있다.** 단 `11xx` 3종 혼재 · `3001` 예외
2. `chapter`·`variant` 는 **`canto` 27건에만** 있다
3. `textColor` 는 **61건 결손**이다
4. `sprite` 가 **6건에서 중복**된다. 팩당 유일하지 않다
5. 기프트 관계가 **양쪽에 중복 저장**돼 있다(어긋남 0)

## 미해결

없다. 키 16종 전부 확정했다.

## 근거 재현

```
data/entities/packs/limbus-data-mj/packs.json     117건 · 키 16종
data/entities/gifts/limbus-data-mj/gifts.json     역참조 441/441
data/entities/packs/limbus-assets/md_theme_packs.json   sprite 대조
```
