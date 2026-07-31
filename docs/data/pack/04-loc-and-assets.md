# 회차 4 — `loc-*/MirrorDungeonTheme-1.json` + `data/assets/packs`

> 로케일 3종 × **117건** · 애셋 **155개** · 8.9 MB
> 출처 커밋 `774883d7` · 스냅샷 2026-07-25 · 정리 2026-07-31
> **팩 편(회차 1–4)의 마지막 회차**

---

## 1. `loc-*/MirrorDungeonTheme-1.json` — 표시명

```
최상위   { "dataList": [ … ] }
항목 키  id · name          (2종뿐)
건수     ko 117 · en 117 · ja 117 · id 집합 동일
```

`packs.json` 117건과 **집합이 완전히 같다.**

| 대조 | 결과 |
| --- | --- |
| `loc-en` ↔ mj `name` | **117 / 117** |
| `loc-en` ↔ assets `name` | **117 / 117** |
| `loc-ko` ↔ mj `nameKo` | **116 / 117** |

### 어긋난 1건은 후행 공백이다

```
1309   loc-ko  "감정 앞에 게으른 것 "      ← 끝에 공백
       mj      "감정 앞에 게으른 것"
```

`category` 가 `sin`(나태)인 팩이다. **원본 로케일에 공백이 들어갔고 mj 가 다듬었다.**
`stripMarkup` 이 `.trim()` 을 하므로(`src/text.ts:203`) 우리 파이프라인은 안전하다.

**적재** — 팩 모델이 없어 미적재다.

## 2. `data/assets/packs` — 애셋 155개

```
limbus-assets   154개
shared-library    1개    Collab_Pilgrimage.png     ← 유일한 .png
```

### 조회 키가 둘이다

```
assets image        113종   →  애셋 있는 것 113 / 113
assets overlayImage  40종   →  애셋 있는 것  40 / 40
                    ─────
                    153종      결손 0
```

`image` 는 mj `sprite` 와 같으므로(회차 3) **두 출처 어느 쪽으로 찾아도 된다.**
기프트(`srcPath` 문자열)와 달리 **팩은 이름이 곧 애셋 키**이고 결손이 없다.

### 애셋에만 있는 1건

```
AttackType_hard.webp
```

`image` 에도 `overlayImage` 에도 안 쓰인다. mj `sprite` 는 `AttackType_normal` ·
`AttackType_effective` 둘만 쓴다.

**세 번째 변형이 준비만 되고 배정되지 않았다.** E.G.O 편 회차 9의 `aleph` 등급
아이콘과 같은 성격이다.

### `shared-library` 의 `.png` 1개

```
Collab_Pilgrimage.png
```

**「선의의 순례」 — 명일방주 콜라보**다(E.G.O 편 회차 1의 `season: 8000`).
구버전에만 있고 현행 `limbus-assets` 에는 없으며, **팩 데이터 117건 중 어디에서도
참조되지 않는다.**

콜라보가 테마 팩으로 들어갈 예정이었거나, 배너 이미지가 여기 섞인 것으로 보인다.
확장자가 다른 것(`.png` vs `.webp`)도 이 파일만이다.

---

## 세 엔티티의 애셋 규칙 비교

| | 인격 | E.G.O | 기프트 | **팩** |
| --- | --- | --- | --- | --- |
| 개수 | 712 | 318 | 476 | **155** |
| 조회 키 | id | id | `srcPath` | **`image`/`overlayImage`** |
| 종당 파일 | 4 또는 2 | 3 또는 2 | 1 | **1 또는 2** |
| 결손 | 0 | 0 | 0 | **0** |
| 잉여 | 18 | 0 | 20 | **1 + 1** |

**네 엔티티 전부 결손 0**이다. 애셋 수집은 빠짐없이 됐다.

---

## 함정 요약

1. `1309` 의 `loc-ko` 이름에 **후행 공백**이 있다
2. 팩은 이미지가 **1개일 수도 2개일 수도** 있다(`overlayImage` 41건)
3. `AttackType_hard.webp` 는 **아무도 안 쓴다**
4. `shared-library` 에 **콜라보 `.png` 1개**가 참조 없이 남아 있다

## 미해결

없다. 로케일 3종 + 애셋 155개 전부 확정했다.

## 근거 재현

```
data/entities/packs/loc-{ko,en,ja}/MirrorDungeonTheme-1.json   117건 · 키 2종
data/assets/packs/limbus-assets/                                154개
data/assets/packs/shared-library/Collab_Pilgrimage.png            1개
data/entities/packs/limbus-assets/md_theme_packs.json           image · overlayImage
src/text.ts:203                                                 stripMarkup 의 trim
```
