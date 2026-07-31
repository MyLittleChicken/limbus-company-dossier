# 회차 3 — `limbus-assets/md_theme_packs.json` + `shared-library` 대조

> `limbus-assets` **117건** · 35 KB · 키 **8종**
> `shared-library` **56건** · 키 5종 · **id 체계가 다르다**
> 출처 커밋 `774883d7` · 스냅샷 2026-07-25 · 정리 2026-07-31

## 파일 정체

mj 와 id 집합이 같지만 **담는 것이 거의 겹치지 않는다.** 회차 1·2의 16+5 키 중
이 파일이 갖는 건 이름·이미지·분류뿐이고, 대신 `tags`·`overlayImage` 를 더 갖는다.

---

## 1. `name` · `image` — mj 와 완전 일치

```
name  == packs.name    117 / 117
image == packs.sprite  117 / 117
```

**어긋난 것이 하나도 없다.**

## 2. `category` — **배열이다.** mj 는 문자열

```json
"category": ["Canto", "I"]        조합 42종
```

| 조합 | 건수 |
| --- | ---: |
| `["Extreme"]` | 20 |
| `["Refraction Railway"]` | 6 |
| `["Canto", "IV"]` · `["Canto", "IX"]` | 4 + 4 |
| `["Walpurgisnacht"]` | 4 |
| `["Canto", "II"]` … | 3씩 |
| `["Affinity", "Wrath"]` … | 3씩 |

**2단 계층을 담는다.** mj 는 `category`(평평) + `chapter` + `variant` 로 쪼갠다.

```
mj      category "canto" · chapter 1 · variant "normal"
assets  category ["Canto", "I"]
```

**assets 는 난이도(`variant`)를 못 담고, mj 는 계층을 못 담는다.** 서로 보완한다.

## 3. `tags` — 47종. assets 고유

```
Affinity 21 · Extreme 20 · Intervallo 17 · Keyword 14 · Canto Name 9
Refraction Railway 6 · Attack Type 6 · Canto IV 4 · Walpurgisnacht 4 …
```

화면 필터용으로 보인다. **`Intervallo` 17건은 mj `category` 에 없는 개념**이다 —
mj 에서는 `event` 18건에 섞여 있다.

## 4. `bossEncounters` — **번호 체계가 mj 와 다르다**

```
75건 보유 · 유일 75종
"md|canto-1-1" · "md|canto-2-3" …
```

mj `packs_detail.bossPool` 은 **7자리 숫자**(`2060122`)다.

> **같은 것을 가리키는데 표기가 완전히 다르다.** 인카운터 편에서 맞춰야 한다.

## 5. `exclusive_gifts` — mj `uniqueGifts` 의 상위집합

```
mj uniqueGifts     236개 원소 · 71건 보유
assets exclusive_gifts  321개 원소 · 71건 보유

assets 추가 85 · mj 추가 0        ← mj 가 진부분집합
```

기프트 편 회차 1의 판정(`uniquePacks` ⊂ `exclusiveTo`)과 **같은 방향**이다.

### assets 내부 정합성이 완벽하다

```
팩쪽 exclusive_gifts  ↔  기프트쪽 exclusiveTo      230 / 230 일치
```

두 파일이 같은 관계를 양쪽에서 들고 있는데 **어긋난 곳이 0**이다.

## 6. `overlayImage` — 41건. assets 고유

```
attack_type 6 · keyword 14 · sin 21          canto·event·extreme 은 0건
```

```
1201 가르고 베는 이들   AttackTypeSlash_hard_boss
1202 베어낼 것         AttackTypeSlash_effective_boss
```

`_hard_boss` / `_effective_boss` 접미가 붙는다. **기본 이미지 위에 겹치는 배지**이며,
mj `sprite` 가 6건에서 중복되는 것(회차 1)을 이 필드가 보완한다.

## 7. `eventPool` — 19건뿐

mj `packs_detail.eventPool` 은 117건 전부 갖는다(유일 77종). assets 는 19건만이며
값도 6자리로 같은 체계다. **부분 사본**이다.

---

## `shared-library` 대조 — **id 체계가 다르다**

```
56건 · 키 5종 (category · image · name · tags · exclusive_gifts)
키가 "C1-1" · "C2-3" · "E1" 같은 문자열
```

**현행 assets 의 `1001` 같은 숫자 id 가 아니다.** 구버전은 사람이 읽는 코드를 썼다.

```
C1-1  The Forgotten        →  1001
C1-2  The Outcast          →  1002
C2-1  Flat-broke Gamblers  →  1003
```

### 이름으로는 55/56 이어진다

```
이름으로 assets 와 매칭   55 / 56
안 이어지는 것            E1  1건
```

**id 로는 전혀 못 잇고 이름으로만 이어진다.** 인격·E.G.O·기프트 편의
`shared-library` 는 같은 id 를 썼는데 **팩만 체계가 바뀌었다.**

`overlayImage`·`bossEncounters`·`eventPool` 3종은 구버전에 없다 — 나중에 붙었다.

---

## 함정 요약

1. `category` 가 **배열**이다. mj 의 문자열과 구조가 다르다
2. `bossEncounters` 는 **`md|canto-1-1` 문자열**이다. mj 의 7자리 숫자와 안 맞는다
3. `shared-library` 는 **id 가 문자열**이다. 숫자로 파싱하면 깨진다
4. `eventPool` 은 **19건뿐**인 부분 사본이다. mj 쪽이 완전하다

## 미해결

없다. 키 8종 전부 확정했다.

## 근거 재현

```
data/entities/packs/limbus-assets/md_theme_packs.json    117건 · 키 8종
data/entities/packs/shared-library/md_theme_packs.json    56건 · 문자열 id
data/entities/packs/limbus-data-mj/packs.json             name · sprite 대조
data/entities/gifts/limbus-assets/gifts.json              exclusiveTo 230/230
```
