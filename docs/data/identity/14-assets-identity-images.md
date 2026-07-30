# 회차 14 — `data/assets/identities` 인격 이미지

> **애셋 명명 규칙** · `limbus-assets` · **712개** · 91.2 MB · 평균 131 KB · 전부 `.webp`
> 출처 커밋 `774883d7` · 스냅샷 2026-07-25 · 정리 2026-07-30
> **인격 편(회차 1–14)의 마지막 회차**

## 파일 정체

인격 초상·전신 이미지다. 회차 2의 `appearance`(내부 애셋명)와 회차 10의 `iconId` 가
여기서 우리 경로 규칙과 대응된다.

```
712개 = 172종 × 4 + 12종 × 2

조합 패턴 2종
  172종  [normal + gacksung + normal_profile + gacksung_profile]
   12종  [normal + gacksung_profile]
```

**인격 184 중 애셋이 없는 것은 0건.**

### 대조한 출처

| 출처 | 무엇을 대조했나 |
| --- | --- |
| `limbus-data-mj/identities_detail.json` | `appearance` ↔ 파일명 |
| `identity-details/{id}.json` | `iconId` ↔ 스킬 애셋 파일명 |
| `data/assets/skills/limbus-assets` | 스킬 아이콘 984개 |
| `lib/assets.ts:152` | 우리 경로 규칙 |

---

## 명명 규칙

```
{인격 id 5자리}_{normal|gacksung}[_profile].webp

normal            전신 · 기본        184
gacksung          전신 · 각성        172
normal_profile    프로필 · 기본      172
gacksung_profile  프로필 · 각성      184
```

`gacksung` = **각성**이다. 회차 11의 `Personality_Get_Condition` 접미
(`_getCondition_gacksung`), 회차 3·4의 `CheckAwakenLevel` 과 **같은 어휘**다.

```
어휘 통일 확인
  애셋 파일명          _gacksung
  loc 해금 조건 id     _getCondition_gacksung   "동기화 3단계 달성"
  mj passives cost    CheckAwakenLevel3
  위키                 Uptie Tier 3
```

**각성 = 동기화 3**이 네 층에서 같은 것을 가리킨다.

### 기본 인격 12명이 비대칭이다

```
12종  [normal + gacksung_profile]        gacksung(전신 각성) · normal_profile 이 없다
```

**2개만 있는 12종이 정확히 기본 인격**이다(`LCB 수감자`). 회차마다 나온 그 집합이다.

| 회차 | 같은 12건 |
| --- | --- |
| 1 | `star: 1` 12건 · `title: "LCB Sinner"` 12건 |
| 2 | `unitKeywords` 의 `BASE_APPEARANCE` 12건 · `appearance` 의 `BaseAppearance` 12건 |
| 11 | `desc` 가 `"~의 첫번째 인격"` 인 12건 |
| 13 | `Personality_Get_Condition` 에 없는 12건 |
| **14** | **애셋이 2개뿐인 12건** |

기본 인격은 각성 일러스트가 따로 없고, 프로필은 각성판만 쓰는 것으로 보인다.

---

## 우리 코드가 이미 정확히 안다

`lib/assets.ts:152` 의 주석이 실측과 **완전히 일치**한다.

```ts
export type IdentityImageKind = 'profile' | 'full' | 'profileBase' | 'fullAwakened';

/**
 * 네 변형이 있고 수가 다르다 — `_normal`(전신) 184 · `_gacksung_profile`(각성 프로필) 184 ·
 * `_normal_profile` 172 · `_gacksung`(각성 전신) 172.
 */
const suffix = {
  profile:      '_gacksung_profile',
  profileBase:  '_normal_profile',
  full:         '_normal',
  fullAwakened: '_gacksung',
};
```

**기본값이 `_gacksung_profile`** 인 것은 184종 전부에 있는 유일한 프로필이기 때문이다.
`_normal_profile` 을 기본으로 두면 기본 인격 12명이 빈다.

상세 화면이 `profile` 과 `profileBase` 를 나란히 그리되 후자가 없으면 생략하는 것도
이 비대칭 때문이다(`app/[locale]/identities/[id]/page.tsx:81`).

---

## `appearance` 는 애셋 경로와 무관하다

**회차 2에서 미룬 질문의 답이다.**

```
10101  appearance = "10101_YiSang_BaseAppearance"        게임 클라이언트 내부 애셋 키
       파일        = "10101_normal.webp"                 limbus-assets 가 붙인 이름

appearance 문자열이 파일명에 등장: 0건
```

**`limbus-assets` 가 추출하면서 id 기반으로 이름을 새로 붙였다.** 둘 사이에 문자열 대응이
없으므로 `appearance` 로는 파일을 찾을 수 없다.

`appearance` 는 여전히 **미적재**이며 쓸 일이 없다. 다만 회차 2에서 본
**수감자 영문명 대소문자 흔들림**(`YiSang` vs `Yisang`)이 파일명에는 영향을 주지 않는다.

---

## `iconId` 는 스킬 애셋 파일명 그대로다

**회차 10에서 미룬 질문의 답이다.**

```
iconId 유일        966종
스킬 애셋          984개
일치               966/966        누락 0
애셋에만 있는 것    18개
```

**완전 대응한다.** `identity-details` 의 `skills[].data[].iconId` 를 그대로 파일명으로 쓰면 된다.

### 애셋에만 있는 18개

```
1021305_CRIMSON · 1021305_INDIGO · 1021305_VIOLET      색상 변형 3종
1030605                                                 스킬 정의는 삭제됨
1050401 2 · 1050402 2 …                                파일명에 공백 + 숫자
```

**`1021305` 는 색상별 변형 아이콘 3종**을 갖는다. `_CRIMSON`·`_INDIGO`·`_VIOLET` 은
회차 8의 `skill_tags.json` 에서 본 `AMBER`·`AZURE` 계열 색 표기와 이어진다.
`10213` 동부 시 협회 3과(파우스트)의 스킬이며, 회차 3에서 `sinFrom = 3` 유일 인격이었던
`1021304` 와 같은 인격이다.

**`"1050401 2"` 처럼 공백과 숫자가 붙은 파일명**이 있다. 중복 다운로드 잔재로 보이며,
원본 오타 계열이다.

**`1030605` 는 회차 10에서 `shared-library` 에서 회수한 스킬 6건 중 하나**다.
아이콘은 현행 애셋에 남아 있는데 스킬 정의는 빠졌다 — **삭제가 데이터에만 반영되고
애셋은 남은 것**이다. 회차 7의 "삭제 6건" 판정을 애셋이 뒷받침한다.

---

## 함정 요약

1. **기본 인격 12명이 애셋 2개뿐**이다. `_normal_profile` 을 기본값으로 쓰면 빈다
2. `appearance` 는 **파일명과 문자열 대응이 없다**. 게임 내부 키일 뿐이다
3. 애셋에만 있는 18개 중 **`"1050401 2"` 계열은 파일명 오타**다
4. `1030605` 는 **스킬은 삭제됐는데 아이콘이 남았다**

## 미해결

없다. 712개 전부 확정했다.

### 이월 질문 2건 해소

- ✔ **회차 2** `appearance` 와 애셋 경로 대응 — 대응 없음. 내부 애셋명 vs id 기반 새 이름
- ✔ **회차 10** `iconId` 와 애셋 경로 대응 — **966/966 완전 일치**. 파일명 그대로

## 근거 재현

```
data/assets/identities/limbus-assets/                   712개 · 91.2 MB
data/assets/skills/limbus-assets/                       984개
data/entities/identities/limbus-data-mj/identities_detail.json   appearance
data/entities/identity-details/limbus-assets/{id}.json           iconId
lib/assets.ts:152                                       우리 경로 규칙
```
