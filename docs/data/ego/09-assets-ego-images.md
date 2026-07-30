# 회차 9 — `data/assets/egos` E.G.O 이미지

> **애셋 명명 규칙** · `limbus-assets` · **318개** · 25 MB · 전부 `.webp`
> 출처 커밋 `774883d7` · 스냅샷 2026-07-25 · 정리 2026-07-30
> **E.G.O 편(회차 1–9)의 마지막 회차**

## 명명 규칙

```
{E.G.O id 5자리}_{awaken_profile | erosion_profile | cg}.webp

awaken_profile    각성 프로필     110
cg                일러스트         110
erosion_profile   침식 프로필      98
                                 ───
                                  318
```

**E.G.O 110 중 애셋이 없는 것은 0건**이고, `egos.json` 에 없는 애셋도 0건이다.

```
318 = 110종 × 2 + 98종 × 1

조합 패턴 2종
   98종  [awaken_profile + cg + erosion_profile]
   12종  [awaken_profile + cg]
```

### 침식 없는 12종이 일곱 번째로 같다

`erosion_profile` 이 없는 12종이 **정확히 각 수감자의 `slotId: 1` 기본 ZAYIN** 이다.

| 회차 | 같은 12건 |
| --- | --- |
| 1 | `slotId: 1` · ZAYIN · `corrosionSkill` 대상 아님 |
| 2 | `corrosionSkill: null` |
| 3 | `corrosionType` 결손 |
| 4 | `erosion` 대사 0건 |
| 5 | `corrosionSkills` 그룹 0개 |
| 6 | `desc` 가 「기본」 |
| **9** | **`erosion_profile` 없음** |

일곱 출처가 독립적으로 같은 집합을 만든다. **인격 편의 「기본 인격 12명」에 대응하는
E.G.O 편의 상수**다.

## 인격과 구조가 다르다

| | 인격 (회차 14) | E.G.O |
| --- | --- | --- |
| 총 개수 | 712 | 318 |
| 종당 파일 | 4 또는 2 | 3 또는 2 |
| 프로필 | `_normal_profile` · `_gacksung_profile` | `_awaken_profile` · `_erosion_profile` |
| 전신·일러스트 | `_normal` · `_gacksung` **2종** | `_cg` **1종** |
| 비대칭 축 | 기본 인격 12명 | 침식 없는 12종 |

**E.G.O 는 일러스트가 하나뿐이다.** 각성·침식으로 프로필은 갈리지만 `cg` 는 갈리지 않는다.
인격이 기본·각성 전신을 따로 갖는 것과 다르다.

### 크기가 역할을 말한다

| 접미 | 개수 | 평균 | 범위 |
| --- | ---: | ---: | --- |
| `cg` | 110 | **187 KB** | 97 – 298 KB |
| `awaken_profile` | 110 | 21 KB | 10 – 30 KB |
| `erosion_profile` | 98 | 17 KB | 6 – 31 KB |

`cg` 가 프로필보다 **9배 크다**. 상세 화면 상단의 큰 일러스트이고 프로필은 작은 아이콘이다.

## 우리 코드가 정확하다

```ts
export type EgoImageKind = 'awaken' | 'cg' | 'erosion';

/**
 * E.G.O 이미지. 침식 프로필은 98종만 있다 — 침식이 없는 E.G.O 가 12종이기 때문이다.
 */
export function egoImage(id: number, kind: EgoImageKind = 'awaken'): string | null {
  const suffix = { awaken: '_awaken_profile', cg: '_cg', erosion: '_erosion_profile' }[kind];
  return lookup('egos', `${id}${suffix}`);
}
```

`lib/assets.ts:171` 의 주석이 **실측과 완전히 일치**한다. 기본값이 `awaken` 인 것도
110종 전부에 있는 유일한 프로필이기 때문이다.

상세 화면이 `erosion` 을 조건부로 그리는 것도 이 비대칭 때문이다.

```tsx
<Icon src={ego.images.awaken} size={110} />
{ego.images.erosion ? <Icon src={ego.images.erosion} size={110} /> : …}
```

`app/[locale]/egos/[id]/page.tsx:70`

## 연출 전용 E.G.O 는 애셋이 없다

회차 6에서 찾은 6자리 id 5건(`201011`·`203011`·`205011`·`206011`·`211011`)은
**애셋이 하나도 없다.** 로케일 파일에만 존재하는 개체임이 다시 확인된다.

## 곁가지 — `ALEPH` 등급 아이콘이 쓰이지 않는다

공용 아이콘 `data/assets/icons/` 54개에 등급 아이콘이 **5종** 있다.

```
zayin · teth · he · waw · aleph        (각각 아이콘 + 글자 2벌)
```

**`aleph` 는 E.G.O 데이터에 0건**이다(회차 1 실측: ZAYIN 20 · TETH 32 · HE 40 · WAW 18).
`egoRankIcon(rank)` 이 소문자 키로 조회하므로 언젠가 ALEPH 등급이 나오면 그대로 동작한다.

로보토미 코퍼레이션의 5단계 위험도 체계에서 최상위이며, **애셋만 먼저 준비돼 있다.**

---

## 함정 요약

1. E.G.O 는 **일러스트가 하나뿐**이다. 각성·침식으로 갈리지 않는다
2. `erosion_profile` 이 없는 12종이 있다. 기본값을 `erosion` 으로 두면 빈다
3. 연출 전용 E.G.O 5건은 **애셋이 없다.** 로케일에만 있다
4. `aleph` 등급 아이콘은 있지만 **데이터에는 0건**이다

## 미해결

없다. 318개 전부 확정했다.

## 근거 재현

```
data/assets/egos/limbus-assets/            318개 · 25 MB
data/entities/egos/limbus-assets/egos.json 110 대조
data/assets/icons/limbus-assets/           54개 · 등급 5종
lib/assets.ts:171                          egoImage 규칙
app/[locale]/egos/[id]/page.tsx:58,70      화면
```
