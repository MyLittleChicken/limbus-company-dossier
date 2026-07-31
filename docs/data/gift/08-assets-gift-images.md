# 회차 8 — `data/assets/gifts` 기프트 이미지

> **애셋 명명 규칙** · `limbus-assets` · **476개** · 6.0 MB · 전부 `.webp`
> 출처 커밋 `774883d7` · 스냅샷 2026-07-25 · 정리 2026-07-31
> **기프트 편(회차 1–8)의 마지막 회차**

## 명명 규칙 — id 가 아니라 `srcPath` 다

```
파일명 400개   이름 문자열       "Sticky Resin.webp" · "Devil_s Share.webp"
파일명  76개   숫자              "9282.webp"
              ─────
              476개
```

인격(`{id}_{kind}.webp`) · E.G.O(`{id}_{kind}.webp`)와 **완전히 다르다.**
기프트는 **파일명 대부분이 사람이 읽는 이름**이다.

### `srcPath` 로 조회하면 결손이 0이다

```
assets gifts.json 의 srcPath 유일   456
그중 애셋이 있는 것                  456      ← 100 %
없는 것                              0
```

`prisma/schema.prisma:490` 주석이 정확하다 — "애셋 스프라이트 키. **애셋을 id로 추정해
찾으면 안 된다.**" `lib/assets.ts` 의 인덱스가 파일명을 그대로 키로 쓰므로
`Gift.sprite`(= `srcPath`)로 찾는다.

### `imageOverride` 19건은 `srcPath` 와 같다

```
imageOverride 값이 애셋에 있는 것    19 / 19
srcPath 와 다른 것                   0 / 19
```

```
9127  srcPath "Devil_s Share"  →  imageOverride "Devil_s Share"
9139  srcPath "Tailor_s Scissors" → imageOverride "Tailor_s Scissors"
```

**보정이 이미 `srcPath` 에 반영돼 있다.** 아포스트로피(`'`)를 `_` 로 바꾼 결과가
양쪽에 같이 들어 있어, `imageOverride` 는 **지금 아무것도 바꾸지 않는다.**
출처가 두 값을 따로 관리하다 동기화한 흔적으로 보인다.

## 잉여 20건 — 로케일 전용 기프트의 애셋

```
476 − 456 = 20
```

| | 건수 | 정체 |
| --- | ---: | --- |
| 이름 문자열 | 19 | 회차 6·7의 **로케일 전용 기프트** |
| `9815` | 1 | 숫자인데 `gifts.json` 에 없다 |

이름 19건 중 **17건이 로케일 파일의 기프트 이름과 일치**한다.

```
1004 Bloodied Mask of a Devotee    1038 Token of Innocence
1006 Etched Doomsday               1039 Token of Tears
1040 Sparkling Skull               1042 Sniggering Tongue
1043 Token of Atonement            1046 Green Skin
1049 Hammer                        1050 Nagel
2010 Memories of Fragments         2019 Melted LCCB Employee Badge
…                                                              17건
```

> **회차 6에서 "로케일에만 있는 122건" 이라 한 기프트들의 애셋이 여기 있다.**
> `limbus-assets/gifts.json` 은 그것들을 담지 않지만 **애셋은 받아 뒀다.**

이름이 안 맞는 2건과 `9815` 는 대응이 없다. 인격 편 회차 14의 `"1050401 2"` 계열,
E.G.O 편 회차 9의 연출 전용처럼 **정리되지 않은 잔재**로 보인다.

## 세 엔티티의 애셋 규칙이 전부 다르다

| | 인격 (회차 14) | E.G.O (회차 9) | **기프트** |
| --- | --- | --- | --- |
| 개수 | 712 | 318 | **476** |
| 파일명 | `{id}_{kind}` | `{id}_{kind}` | **`{srcPath}`** |
| 종당 파일 | 4 또는 2 | 3 또는 2 | **1** |
| 조회 키 | id | id | **문자열** |
| 결손 | 0 | 0 | **0** |
| 잉여 | 18 | 0 | **20** |

**기프트만 id 로 못 찾는다.** 강화 단계별 이미지도 없다 — 기프트당 정확히 1개다.

---

## 함정 요약

1. **파일명이 id 가 아니다.** 400/476 이 이름 문자열이다
2. `imageOverride` 는 **지금 아무것도 바꾸지 않는다.** `srcPath` 와 값이 같다
3. 잉여 20건은 **로케일 전용 기프트의 애셋**이다. `gifts.json` 에 없어도 이미지는 있다
4. 강화 단계별 이미지가 **없다.** 기프트당 1개다

## 미해결

없다. 476개 전부 확정했다.

## 근거 재현

```
data/assets/gifts/limbus-assets/                476개 · 6.0 MB
data/entities/gifts/limbus-assets/gifts.json    srcPath 456 · imageOverride 19
data/entities/gifts/loc-en/EGOgift*.json        잉여 17건 이름 대조
lib/assets.ts                                   파일명 인덱스
prisma/schema.prisma:490                        Gift.sprite 주석
```
