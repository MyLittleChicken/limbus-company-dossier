# 회차 3 — `limbus-data-mj/skills.json`

> **정본** · 스킬 · **1,045건** · 2.13 MB · 최상위 **객체**(키 = 스킬 id 문자열)
> 최상위 키 **7종** + `levels` 서브키 **6종** · 레벨 항목 2,561개
> 출처 커밋 `97c38567` · 스냅샷 2026-07-25 · 정리 2026-07-30

## 파일 정체

인격 스킬의 **정본**. 회차 2의 `attackSkills`·`defenseSkills`·`panicSkill` id가 전부 여기로 이어진다.

**파일 이름이 `skills.json` 이지만 인격 스킬만 담지 않는다.**

```
1045건
  ├   1  공용 스킬       1000104 패닉 "E.G.O 침식"
  ├ 836  인격 스킬       1{인격 5자리}{순번 2자리}
  └ 208  E.G.O 스킬     2{E.G.O 5자리}{11|21}
```

인격이 참조하는 837건 중 **파일에 없는 것은 0건**이다. 반대로 파일에만 있는 208건은 전부 E.G.O 스킬이며 **적재되지 않는다**(아래 `id` 절).

### 대조한 출처

| 출처 | 무엇을 대조했나 |
| --- | --- |
| `limbus-data-mj/identities_detail.json` | 스킬 id 참조 · 슬롯 · 덱 매수 |
| `limbus-data-mj/egos.json` | E.G.O 등급 · `slotId` · 한국어 이름 |
| `limbus-assets/identities.json` | `skillTypes[].type` — `tier` · `affinityUptie` · `clashable` |
| `loc-ko/*` 전량 | 토큰 치환표 4,497종 실측 |
| `src/text.ts` · `src/entities/skills.ts` | 변환 경로 · `toDisplay` 커버리지 |
| [Limbus Company Wiki](https://limbuscompany.fandom.com) | 침식 조건 · S3 해금 단계 |

---

## `id` — 스킬 식별자

| | |
| --- | --- |
| 타입·실측 | `Int` · 1045/1045 · **전부 7자리** · 범위 1000104 ~ 2120921 |
| 키 일치 | 객체 키(문자열) === 내부 `id` · **1045/1045** |
| 변환 | 통과 |
| 적재 | `skill.id` (PK) — **인격 스킬 837건만** |
| 화면 | 미표시 |
| 함정 | 아래 |

### 대역이 셋이다

```
1000104                      공용 스킬 대역. 인격 id 대역(10101–11216) 밖
1{인격 id 5자리}{순번 2자리}   1011501 = 10115 + 01
2{E.G.O id 5자리}{11|21}     2050911 = E.G.O 20509 + 11
```

### `11` / `21` = 각성 / 침식

```
접미 11    110종 전부      각성 스킬
접미 21     98종           침식 스킬
```

**침식 스킬이 없는 12종은 정확히 각 수감자의 `slotId = 1` 이다.**

```
20101 오감도(이상)         20201 표상 방출기(파우스트)   20301 라 샹그레 데 산쵸(돈키호테)
20401 삼라염상(료슈)        20501 타인의 사슬(뫼르소)      20601 허환경(홍루)
20701 시체자루(히스클리프)   20801 작살박이(이스마엘)       20901 던져지는 것(로쟈)
21001 지식나무의 가지(싱클레어) 21101 토 파토스 마토스(오티스) 21201 어느날 갑자기(그레고르)
```

[E.G.O/Gameplay](https://limbuscompany.fandom.com/wiki/E.G.O/Gameplay) 의 서술과 맞는다.

> all twelve Sinners possess their own **unique ZAYIN-grade E.G.O which are stable enough to
> avoid Corrosion**

**조건은 등급이 아니라 "기본 지급 E.G.O(`slotId` 1)인가" 다.** ZAYIN 20종 중 8종
(`20106` 지난 날 · `20405` 소다 · `20705` 홀리데이 · `21006` 낮은울음 · `20809` 즉저살 ·
`20909` 노을 속으로 · `21109` 난 가위를 낼게 너는? · `21202` 눈속임)은 나중에 추가된
일반 ZAYIN 이며 침식 스킬을 갖는다.

```
등급 × 접미
  ZAYIN | 11만    12종   ← 기본 지급 E.G.O
  ZAYIN | 11,21    8종
  TETH  | 11,21   32종
  HE    | 11,21   40종
  WAW   | 11,21   18종
```

> **회차 2 정정.** `panicSkill` 항목에 "고유 E.G.O(ZAYIN)만 갖고 있으면 침식하지 않는다"고
> 적었는데, 정확히는 **"기본 지급 E.G.O(`slotId` 1)"** 다.

### 함정 — E.G.O 스킬 208건은 적재되지 않는다

```
스킬 목록의 출처   identity-details/limbus-assets/{인격 id}.json   ← 회차 10
                  파일명이 인격 id 이므로 E.G.O 스킬은 들어올 길이 없다

이 파일의 역할     skills.ts:136  Map 으로 읽음
                  skills.ts:270  분류 보강 (sin · attackType · defType · tier)
                  skills.ts:321  이름·설명 이월
                  → 조회만 한다. 키를 순회하지 않는다

src/entities/egos.ts   스킬을 다루는 코드가 없다
```

오류가 아니라 설계다. `Skill` 모델이 `identityId` 를 필수로 요구하므로 담을 자리가 없다.

**결정 2026-07-30 — 기록만 하고 E.G.O 편에서 다룬다.** 인격 편 진행 중이며, E.G.O 스킬은
E.G.O 편에서 척추가 된다. 그때 `limbus-assets/ego-details/` 와 함께 본다.

지금 없는 것: 각성/침식 구분 · E.G.O 스킬의 죄악·공격 타입·티어 · 코인 효과와 수치 ·
E.G.O 스킬 이름.

---

## 분류

### `sin` — 죄악 속성

| | |
| --- | --- |
| 타입·실측 | `String \| null` · 1045/1045 존재 |
| 분포 | `pride`:163 · `lust`:162 · `gloom`:156 · `envy`:154 · `wrath`:152 · `gluttony`:140 · `sloth`:117 · **`null`:1** |
| 인격 스킬만 | `pride`:135 · `lust`:130 · `gloom`:124 · `wrath`:124 · `envy`:123 · `gluttony`:109 · `sloth`:91 |
| 변환 | `base.affinity && base.affinity !== 'none' ? base.affinity : null` (`skills.ts:296`) |
| 적재 | `skill.affinity` (`Sin?`) |
| 화면 | 스킬 패널 죄악 아이콘·색 |
| 함정 | 아래 |

`null` 은 `1000104` 패닉 스킬 1건뿐이다. **나태가 눈에 띄게 적다** — 인격 스킬 91건으로
최다인 오만(135)의 67% 수준이다.

**함정 — 이 파일에 `"none"` 은 0건이다**

```
prisma/schema.prisma:244
  "죄악 속성이 없는 스킬이 131건 있다. 원본이 none 으로 표기하며 패닉·조건부 스킬이 해당한다"
```

숫자는 맞지만 **설명이 틀렸다.** `"none"` 표기는 스킬 수치의 정본인
`identity-details/limbus-assets/{id}.json`(회차 10) 쪽이며, 해당하는 것은 패닉·조건부 스킬이
아니라 **수비·회피 스킬**이다. 아래 `sinFrom` 참조.

### `sinFrom` — 죄악이 붙는 동기화 단계

| | |
| --- | --- |
| 타입·실측 | `Int?` · **131/1045** · 값 `4`:130 · `3`:1 |
| 보유 스킬 | 전부 인격 대역 · `defType` 은 **`guard` 84 · `evade` 47** |
| 의미 | **이 단계부터 죄악 속성이 붙는다.** 그 전에는 죄악이 없다 |
| 교차대조 | `limbus-assets/identities.json` 의 `type.affinityUptie` 와 **131/131 완전 일치**(집합도 동일) |
| 변환 | — |
| 적재 | **미적재** |
| 화면 | 미표시 |

스키마 주석의 "131건"이 이것이다. 숫자가 정확히 일치한다.

```
1010104  "가드"   sin=gloom   sinFrom=4      동기화 4부터 우울 속성
1010704  "회피"   sin=pride   sinFrom=4
```

**반격은 처음부터 죄악을 갖는다.**

```
인격 방어 스킬 216건
  guard   84  전부 sinFrom 보유
  evade   47  전부 sinFrom 보유
  counter 85  sinFrom 없음
```

`3` 인 1건이 예외다.

```
1021304  파우스트 · 동부 시 협회 3과   "궁도[弓刀] 전개"   guard/lust
  레벨 [1, 3, 4]      ← 죄악이 3에서 붙으니 3단계 항목이 있다
```

`sinFrom = 4` 인데 레벨 4 항목이 없는 스킬도 있다(`1010104` · `1010204` · `1010404`).
죄악만 붙고 수치는 그대로인 경우로 보인다.

**따라서 `skill.affinity` 가 `null` 인 것은 "죄악이 없다"가 아니라 "우리가 담은 단계에
아직 없다"는 뜻일 수 있다.** 회차 10에서 단계별 값을 볼 때 확인한다.

### `attackType` / `defType` — 공격 타입과 스킬 구분

| | `attackType` | `defType` |
| --- | --- | --- |
| 타입·실측 | `String \| null` · 1045/1045 | `String` · 1045/1045 |
| 분포 | `slash`:338 · `blunt`:324 · `pierce`:245 · **`null`:138** | `attack`:828 · `guard`:90 · `counter`:78 · `evade`:48 · **`non_action`:1** |
| 변환 | `base.atkType ?? null` | `base.defType ?? 'attack'` |
| 적재 | `skill.atk_type` (`AtkType?`) | `skill.def_type` (`DefType`) |
| 화면 | 스킬 패널 아이콘 | 공격/방어 구분 |

교차하면 규칙이 드러난다.

```
attack     | slash 298 · blunt 295 · pierce 235
counter    | slash 39 · blunt 29 · pierce 10
evade      | null 48
guard      | null 89 · slash 1
non_action | null 1
```

**공격 타입이 있는 것** — `attack` 828 · `counter` 78 · `guard` 1.
**없는 것** — `guard` 89 · `evade` 48 · `non_action` 1. 합 138로 `null` 개수와 맞는다.

**스키마 enum 밖의 값은 `non_action` 1건뿐이다**(회차 2에서 넘긴 질문의 답).
enum 확장은 필요 없다. 다만 변환이 `base.defType ?? 'attack'` 로 담으므로
`non_action` 이 그대로 적재되면 enum 위반이다 — 실제 적재값 확인이 필요하다.

E.G.O 스킬 208건은 **전부 `attack`** 이다. E.G.O에는 방어 스킬이 없다.

**합 가능 여부는 별도 축이다.** `limbus-assets` 의 `defenseSkillTypes[].type.clashable` 에만
있고(52건), 이 파일에도 우리 `Skill` 모델에도 없다.

```
counter  clashable=true  32건   전부 attackType 있음
counter  clashable=없음   36건   전부 attackType 있음
guard    clashable=true  20건   null 19 · slash 1
guard    clashable=없음   70건   전부 null
evade    clashable=없음   48건   전부 null
```

**반격은 합 가능 여부와 무관하게 항상 공격 타입을 갖는다.** 합 가능 수비 20건 중 19건은
공격 타입이 없다. `guard | slash` 유일 1건은 다음이다.

```
1061307  홍루 · 홍원 군주   "호위"   gluttony / slash / guard / clashable=true
```

회차 2에서 본 그 인격이다 — 방어 스킬 2개를 갖고 `add` 에 `OnDieAllyMp5` 가 든 흑수 군주.

### `skillTier` — 스킬 티어

| | |
| --- | --- |
| 타입·실측 | `Int` · 1045/1045 · **1:404 · 2:196 · 3:445** |
| 교차대조 | `limbus-assets` 의 `type.tier` 와 **823/824 일치** |
| 변환 | `meta.skillTier ?? 1` |
| 적재 | `skill.tier` |
| 화면 | 스킬 패널 정렬 |

**공격 스킬은 슬롯과 완전히 맞물린다**(예외 0건).

```
slot 1 → tier 1     copies 3: 184 · copies 0: 16
slot 2 → tier 2     copies 2: 184 · copies 0: 11
slot 3 → tier 3     copies 1: 184 · copies 0: 45
```

대체 스킬(`copies: 0`)도 슬롯과 티어가 일치한다. 즉 **공격 스킬의 `tier` 는 슬롯 번호와
같은 정보**다.

방어 스킬은 다르다 — `guard` 90건과 `evade` 48건은 전부 티어 1인데 **`counter` 만 흩어진다**
(tier1 65 · tier2 1 · tier3 8). E.G.O 스킬은 **208건 전부 티어 3**이다.

**불일치 1건**

```
1041206  료슈 · N사 E.G.O:: 경멸, 경외   "쏘아내겠소 / 언제든지"
  limbus-data-mj  tier = 3
  limbus-assets   tier = 4
```

회차 1의 `altSins` 5건 중 하나다. **티어 4는 어느 쪽 분포에도 없고**, 슬롯 3에 붙은
스킬이므로 mj의 `3` 이 규칙에 맞다. **assets 쪽 오기로 보인다.** 우리는 `base`(assets 상세)를
우선하므로 적재값이 `4` 일 가능성이 있다 — 회차 10에서 확인한다.

---

## `levels` — 동기화 단계별 정의

| | |
| --- | --- |
| 타입·실측 | `Array<{level, name, nameKo, desc, descKo, coins}>` · 1045/1045 존재 · **2,561항목** |
| 배열 길이 | 0:9 · 1:66 · 2:424 · 3:537 · 4:9 |
| `level` 값 | 1:815 · 2:388 · 3:435 · 4:917 · **5:6** · 오름차순 위반 **0건** |
| 의미 | **변한 단계만 기록한다.** 빠진 단계는 앞 단계를 이어받는다 |
| 변환 | `skills.ts:321` — `level <= uptie` 중 가장 큰 것을 골라 이월 |
| 적재 | `skill_stage` · `skill_stage_text` · `skill_coin` |

**조합 패턴 15종.**

```
[1,2,4]   351건      [1,3]      25건       [1,3,4,5]   4건
[3,4]     199건      [3]        16건       [1,3,5]     2건
[1,3,4]   183건      []          9건       [2,3,4]     1건
[1,4]     169건      [1,2,3,4]   5건       [4]         1건
[1]        49건      [2,4]       4건
[1,2]      27건
```

### 첫 레벨이 해금 시점을 드러낸다

```
slot 1 → 첫 레벨 1  195건 · 2  3건 · 3  1건
slot 2 → 첫 레벨 1  193건 · 2  1건 · 3  1건
slot 3 → 첫 레벨 3  206건 · 1  18건 · 4  1건
```

**S3만 대부분 레벨 3에서 시작한다.** 위키의 *"Uptie Tier 3 … unlocks its third skill"* 과
맞는다. 예외 18건은 처음부터 3스킬을 갖는 인격이다.

방어 스킬은 대부분 레벨 1에서 시작한다(`counter` 65 · `evade` 47 · `guard` 88).

### 빈 `levels` 9건 — 분류만 있고 수치가 없다

```
1021207 흑수-묘 필두(파우스트)    counter tier3 폭식
1071506 중지 작은 형님           counter tier3 질투
1071507 중지 작은 형님           attack  tier1 분노
1081405 거미집 중지 제자          counter tier3 질투
1101205 중지 작은 아우(싱클레어)   counter tier2 질투
1101206 중지 작은 아우           counter tier3 질투
1111510 거미집 중지 아비          counter tier3 질투
1111511 거미집 중지 아비          counter tier3 질투
1121607 새벽 사무소 대표          counter tier3 분노
```

**9건 중 8건이 반격**이고, 회차 2에서 `limbus-assets/identities.json` 이 누락한 12건과
겹친다. 변환은 `'스킬 수치가 어느 출처에도 없음(분류만 적재)'` note 를 남기고 단계 없이
담는다(`skills.ts:284`).

### `level: 5` 6건 — E.G.O 동기화 5

```
2010211 · 2010221   이상   「4번째 성냥불」 (TETH)
2040211 · 2040221   료슈   「4번째 성냥불」 (HE)
2090211 · 2090221   로쟈   「4번째 성냥불」 (HE)
```

**동기화 5는 실제로 존재한다.** 신규 업데이트이며 구형 E.G.O부터 밸런스 패치처럼 적용하고
있다. 「4번째 성냥불」은 시즌 1 산물로 세 수감자가 같은 이름의 E.G.O를 갖고, 각성·침식
양쪽 모두 레벨 5를 갖는다. 회차 2의 `CheckAwakenLevel5` 3건과 같은 계열이다.

**파이프라인은 5를 받을 수 있다.**

```
skills.ts:308   const uptie = delta.uptie ?? merged.uptie ?? 1     상한 없음
skill_stage(skillId, uptie)                                        Int 컬럼
levels.reduce((carried, l) => l.level <= uptie ? l : carried)       상한 없음
```

**반면 속도는 하드코딩이다** — `src/entities/identities.ts:21` 의 `UPTIES = [1,2,3,4]`.
인격 동기화가 5로 늘면 `identity_speed` 가 4단계에서 멈춘다. 지금 인격에 5는 없다.

---

## `levels` 서브키

### `name` / `nameKo` — 스킬 이름

| | |
| --- | --- |
| 타입·실측 | `String` · **2,561/2,561 둘 다 존재** · null·빈 문자열 **0건** |
| 유일값 | 최종 레벨 기준 **768종** / 스킬 1,036건 |
| 레벨 변화 | **0건** — 1,036건 전부 모든 레벨에서 이름이 같다 |
| 마크업 | 0건 |
| 변환 | `mjLevel?.nameKo ?? merged.name` → `stripMarkup` |
| 적재 | `skill_stage_text.name` — **단계마다 같은 문자열이 중복 저장된다** |
| 화면 | 스킬 패널 제목 |

**이름이 유일하지 않다.**

```
34  "가드"   18  "회피"   12  "반격"        초기 인격의 기본 방어 스킬
 6  "4번째 성냥불" · "차원찢개" · "지난 날" · "저주못" · "전봇대"
    → 3인 공유 E.G.O × (각성 + 침식) = 6
```

**`name === nameKo` 13건은 결손이 아니라 영문 고유명사다.**

```
1011505  "Furioso-Replica"   이상 · 거미집 검지 아비           lv3 · lv4
2070311 · 2070321  "AEDD"   히스클리프 E.G.O 20703 (각성·침식)
2120411 · 2120421  "AEDD"   그레고르 E.G.O 21204 (각성·침식)
```

13건 모두 `descKo` 는 있다. 회차 1의 `titleKo` 결손 1건(`11215` "LCE E.G.O:: AEDD")과
같은 계열로, 한국판도 같은 표기를 쓴다.

변환은 `!mjLevel?.nameKo` 일 때만 note 를 남기므로 **`nameKo` 가 존재하되 영문과 같은
경우는 조용히 지나간다.** 지금은 정상이라 문제없다.

**부수 발견** — `limbus-data-mj/egos.json` 의 `nameKo` 가 비어 있는 E.G.O가 있다
(`20703` 히스클리프 · `21204` 그레고르). 인격은 `titleKo` 결손이 1건인데 E.G.O는 더 많을
가능성이 있다. E.G.O 편 진입 시 확인한다.

### `desc` / `descKo` — 스킬 설명

| | |
| --- | --- |
| 타입·실측 | `String \| null` · **둘 다 있음 2,104 · 둘 다 없음 457 · 한쪽만 0건** |
| `desc === descKo` | 1건 |
| 토큰 | **266종** |
| 마크업 | `style`:2,680 · `color`:37 · `u`:28 · `link`:28 · `noparse`:28 · `sprite`:14 |
| 의미 | **사람이 읽는 표시 설명.** 레벨마다 달라질 수도, 같을 수도 있다 |
| 변환 | `toDisplay` = `stripMarkup` → 토큰 치환 → `stripMarkup`. 원문은 `descRaw` 로 보존(ADR-03 2절) |
| 적재 | `skill_stage_text.desc` · `.desc_raw` |
| 화면 | 스킬 패널 설명 |

**설명이 없는 457항목은 공격 스킬에 몰려 있다**(attack 377 · guard 37 · evade 22 ·
counter 20 · non_action 1 / 인격 368 · E.G.O 89). 부가 효과가 없는 순수 공격 스킬이다.

**한쪽만 있는 경우가 0건**이라 번역 결손이 없다. `nameKo` 와 다르다.

### `[*]` 는 발동 조건·시점이다

토큰이 두 갈래로 갈리고, 치환 규칙도 갈린다.

```
발동 시점은 대괄호를 유지
  [WhenUse]      → [사용시]         1,845회
  [BeforeAttack] → [공격 시작 전]      511회
  [EndSkill]     → [공격 종료시]       444회
  [CantIdentify] → [피아식별불가]      292회
  [StartBattle]  → [전투 시작시]       265회
  [WinDuel]      → [합 승리시]         216회
  [DuelCounter]  → [합 가능 반격]       65회

상태는 대괄호를 벗는다
  [Breath]     → 호흡     577회
  [Combustion] → 화상     388회
  [Laceration] → 출혈     370회
  [Charge] · [Burst] · [Vibration] · [Sinking] …
```

`skill_tags.json` 의 `text` 값이 대괄호를 품고 있어서 나오는 차이다. **게임 UI 표기와 같다.**

### `toDisplay` 커버리지 검증 — 99.99%

전수 실측이다.

```
치환표 크기          상태 4,426 + 발동 시점 얹으면 4,497 (ko)
스킬 설명 토큰        265종 / 8,897회 치환 성공
미치환               1종 / 1회
치환 후 Unity 마크업 잔존   0건
```

**미치환 1건은 한국어 원문의 오타다.**

```
1121102 lv4  descKo "…[[FirePunchFuel]를 소모할 때…"     ← 여는 대괄호가 하나 더
             desc   "…Coins that consumed [FirePunchFuel] deal…"   ← 영문은 정상
치환표        FirePunchFuel → "12구산 연료"                ← 표에는 정상적으로 있다
```

정규식이 `[[FirePunchFuel]` 를 토큰 `[FirePunchFuel` 로 읽어 못 찾는다. 화면에는 여는
대괄호가 남은 채 나간다. `report.note('표에 없는 대괄호 표기(원문 유지)')` 가 남으므로
조용히 실패하지는 않지만, **그 기록이 산출물로 남지 않는다** —
`docs/backlog/07-report-artifact.md`.

### `coins` — 코인 효과

| | |
| --- | --- |
| 타입·실측 | `String[][]` 2차원 배열 · 2,561/2,561 존재(`null` 0건) |
| 바깥 배열 | **코인 수** · 1:970 · 2:835 · 3:524 · 4:213 · 5:15 · **9:2** · 0:2 |
| 안쪽 배열 | **코인당 효과 줄 수** · 0:660 · 1:2,532 · 2:1,289 · 3:464 · 4:121 · 5:64 · 6:13 · 7:6 · 8:4 · 9:2 · **11:2** |
| 총량 | 코인 **5,157개** · 효과 문자열 **7,498개** |
| 언어 | **영문뿐. 한글 0개** |
| 토큰 | 215종 |
| 변환 | **이 파일의 코인 문자열은 쓰이지 않는다** |
| 적재 | `skill_coin(skillId, uptie, index, type)` · `skill_coin_text(…, desc, descRaw)` |
| 화면 | 스킬 패널의 코인별 효과 |

**스키마 주석의 "실측 최대 9개"가 여기서 확인된다.**

```
1011505  "Furioso-Replica"  lv3 · lv4   코인 9개
```

거미집 검지 아비 이상의 분노 대체 스킬 하나가 분포의 꼬리를 만든다. 회차 1의 `altSins`,
회차 3의 이름 미번역 13건에서도 같은 스킬이 나왔다.

**효과 줄 11개인 코인**

```
1011303 lv3·lv4  코인2  "대상 조정 사격"  (N사 E.G.O:: 흉탄 이상)
   1. [SuperCoin]
   2. This Coin deals damage only against the sub-targets
   4. - If the first Coin failed to kill an ally, 1 random sub-target takes damage
   5. Deal +15% damage for every [BoseProjektil] on self (max 105%)
  11. - If the first Coin killed an ally, inflict 3 [Laceration] and +1 Count instead
```

**아군을 죽이는 것이 조건인 코인**이다. 회차 2의 `10415` 거미집의 검 · `10613` 홍원 군주의
`OnDieAllyMp10` 과 같은 설계 계열이다.

**빈 문자열 135개 = 효과 없는 코인.** 위력만 있는 코인이며 `""` 로 자리를 유지한다
(`1010203` "리포스트" 코인1 · `1010704` "회피" 코인1).

**코인 0개 2항목** — `1000104` 패닉 · `1040204` "반격" lv1.

**함정 — 코인은 세 출처가 각각 다른 조각을 준다**

```
코인 개수·순서·type    limbus-assets/identity-details/{id}.json     회차 10
코인 효과 (영문)        limbus-assets 또는 이 파일                    회차 3·10
코인 효과 (한국어)      loc-ko/Skills_personality-NN.json            회차 12
                       (스킬 id, level, 코인 index) 로 조인
```

`src/entities/skills.ts:75` 가 이유를 적어두었다.

> 정본(`limbus-assets`)의 `coins[].descs` 는 영문뿐이라, 로케일 구분 없이 그것만 쓰면
> `[OnSucceedAttackHead] Inflict 1 침잠` 처럼 영문에 상태명만 치환된 혼종이 나온다.

**이 파일의 코인도 영문뿐이다**(한글 0개). 따라서 한국어는 `loc-ko` 에서만 온다.

**토큰이 설명문과 다르다**

```
5,073  [OnSucceedAttack]          코인 적중 시 — 압도적 1위
  922  [Vibration]   795 [Laceration]   767 [Combustion]   672 [Burst]   601 [Sinking]
  583  [OnSucceedAttackHead]      앞면 적중 시
  467  [SuperCoin]                229 [CriticalOnSucceedAttack]
```

설명문 최다는 `[WhenUse]`(1,845)인데 코인 최다는 `[OnSucceedAttack]`(5,073)이다.
**설명문은 스킬 단위 조건, 코인은 적중 단위 조건**이다.

---

## 함정 요약

1. 파일 이름이 `skills.json` 이지만 **E.G.O 스킬이 20%**(208/1045)를 차지하고, 그 208건은 적재되지 않는다
2. E.G.O 스킬 접미 `11`/`21` 이 각성/침식이며, **침식이 없는 것은 `slotId` 1 인 12종**이다
3. 스키마 주석의 "죄악 없는 스킬 131건"은 패닉·조건부가 아니라 **수비·회피** 스킬이다(`sinFrom`)
4. `skill.affinity` 가 `null` 인 것은 "죄악이 없다"가 아니라 **"담은 단계에 아직 없다"** 일 수 있다
5. **합 가능 여부(`clashable`)는 `limbus-assets` 에만 있다.** 우리 `Skill` 모델에도 없다
6. `levels` 는 **변한 단계만** 담는다. 빠진 단계는 앞 단계를 이어받는다
7. **동기화 5가 실재한다.** 스킬 쪽은 받을 수 있으나 `identity_speed` 는 `UPTIES` 하드코딩이다
8. 스킬 이름은 레벨이 올라도 **안 바뀌는데**(0건) `skill_stage_text` 에 단계마다 중복 저장된다
9. `name === nameKo` 13건은 **영문 고유명사**다(`Furioso-Replica` · `AEDD`)
10. **코인 문자열은 영문뿐**이다. 한국어는 `loc-ko` 에서만 온다
11. `[*]` 는 **발동 조건·시점**이며, 발동 시점은 치환 후에도 대괄호를 유지한다

## 미해결

### 남은 것

- ❓ `non_action` 1건이 `skill.def_type` 에 실제로 어떻게 적재되나. `DefType` enum 4종에
  없는 값이라 위반이거나 `'attack'` 으로 뭉개진다
- ❓ `1121102` lv4 의 `[[FirePunchFuel]` — 원본 오타를 어떻게 추적할지는 설계했으나
  구현 미착수(`../../backlog/07-report-artifact.md`)

### 다음 회차로 넘긴 것

- → **회차 4** 패시브 본문. 이 회차에서 `passives.json` 의 `cost` 만 봤다
- → **회차 10** `identity-details` 의 `"none"` 131건과 `sinFrom` 의 대응. 단계별 죄악이
  실제로 어떻게 담기는가
- → **회차 10** `1041206` 의 `tier` — mj `3` vs assets `4` 중 적재값이 무엇인가
- → **회차 12** `loc-*/Skills_personality-NN.json` 의 코인 한국어 설명 조인
- → **E.G.O 편** E.G.O 스킬 208건 · 각성/침식 · `egos.json` 의 `nameKo` 결손

### 해소된 것

- ✔ **`defType: "non_action"` 이 몇 종인가**(회차 2 이월) — **1종 1건**뿐이다. enum 확장 불필요
- ✔ **이름 없는 스킬 5개**(회차 2 이월) — `levels` 가 빈 배열인 9건에 포함되며,
  분류만 있고 수치·이름·코인이 없다. 8건이 반격이다
- ✔ **`CheckAwakenLevel5` 의 정체**(회차 2 이월) — 동기화 5는 실재하며 구형 E.G.O부터
  적용 중이다

## 근거 재현

```
data/entities/identities/limbus-data-mj/skills.json               스킬 1,045건
data/entities/identities/limbus-data-mj/identities_detail.json    슬롯·덱 매수 참조
data/entities/identities/limbus-data-mj/egos.json                 E.G.O 등급·slotId
data/entities/identities/limbus-assets/identities.json            tier·affinityUptie·clashable
data/entities/identities/loc-ko/**                                토큰 치환표 4,497종
src/text.ts · src/entities/skills.ts                              toDisplay 커버리지 검증
```
