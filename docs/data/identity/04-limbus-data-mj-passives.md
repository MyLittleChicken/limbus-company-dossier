# 회차 4 — `limbus-data-mj/passives.json`

> **정본** · 패시브 · **709건** · 490 KB · 최상위 **객체**(키 = 패시브 id 문자열) · 키 **6종**
> 출처 커밋 `97c38567` · 스냅샷 2026-07-25 · 정리 2026-07-30

## 파일 정체

회차 3의 `skills.json` 과 **같은 구조·같은 함정**이다. 6키가 709건 전부에 존재한다.

```
709건
  ├ 596  인격 패시브    1{인격 5자리}{순번 2자리}
  └ 113  E.G.O 패시브   2{E.G.O 5자리}{11|12}
```

E.G.O 패시브가 또 섞여 있다. 다만 스킬과 달리 `EgoPassive` 모델이 **존재한다** — 대신
이 파일을 쓰지 않는다(아래 `id` 절).

### 대조한 출처

| 출처 | 무엇을 대조했나 |
| --- | --- |
| `limbus-data-mj/identities_detail.json` | `battlePassives` · `supporterPassives` 참조 |
| `limbus-data-mj/skills.json` | **패시브 id와 스킬 id의 번호 공간 충돌** |
| `limbus-assets/passives.json` | `support` 절의 발동 조건(죄악 자원) · `uptie` |
| `limbus-assets/identity-details/{id}.json` | `combatPassives` · `supportPassives` · `passiveData` |
| `loc-ko/Skills_personality-NN.json` | 6건의 정체 확인 |
| 게임 인격 상세 화면 (스크린샷 6종) | 표시되는 패시브 개수·이름 |
| [Limbus Company Wiki](https://limbuscompany.fandom.com) | 패시브 해금 단계 |

---

## `id` — 패시브 식별자

| | |
| --- | --- |
| 타입·실측 | `Int` · 709/709 · **전부 7자리** · 키 === 내부 `id` 709/709 |
| 구조 | `{인격 또는 E.G.O id 5자리}{순번 2자리}` |
| 변환 | `String(id)` |
| 적재 | `passive.id` (`String` PK) — **인격 596건만** |
| 화면 | 미표시 |

### 접미가 종류를 가른다

```
접미    건수    참조                        뜻
01     184     전투 184                   수감자별 첫 전투 패시브
11     198     전투  88 (+E.G.O 110)      01 의 강화판
21     184     지원 184                   지원 패시브
31      30     지원  30                   21 의 강화판
02–06   103    전투 103                   추가 전투 패시브
12–13    10    전투   7 (+E.G.O 3)
```

**184가 세 번 나온다** — `01` · `21` · 그리고 인격 수. **모든 인격이 `01`(전투)과
`21`(지원)을 정확히 하나씩 갖는다.** 위키의 *"every identity possesses one of each"* 와 맞는다.

```
전투 382종 · 지원 214종 · 겹치는 것 0종
```

전투와 지원이 **완전히 분리**된다. 인격 대역 596건은 **미참조 0건**이고, 참조하는데 파일에
없는 것도 0건이다.

### 함정 1 — 패시브 id와 스킬 id가 같은 번호 공간을 쓴다

```
1010101   skills.json    "쳐내기"     우울 / 참격 / 공격
1010101   passives.json  "정보전달"    조작 패널에서 뒤 아군 2명에게 피해량 증가
```

**같은 7자리 id가 두 파일에서 다른 것을 가리킨다.** 스키마는 `Passive.id`(`String`)와
`Skill.id`(`Int`)로 테이블이 달라 PK 충돌이 없다. 다만 **사람이 id만 보고 판단하면 틀린다.**

### 함정 2 — E.G.O 패시브 113건은 적재되지 않는다

```
E.G.O 패시브 경로
  목록·영문   limbus-assets/ego-details/{id}.json 의 passiveList
  한국어      loc-* 에서 lookupTerm(egoId × 100 + 11 + index)     egos.ts:149

limbus-data-mj/passives.json 의 2xxxxxx 113건 → 조회되지 않는다
```

**id 규칙이 같은데 출처가 다르다.** `egos.ts:149` 가 `egoId × 100 + 11 + index` 로 로케일
파일을 직접 찾아가므로, mj가 같은 id로 한국어를 갖고 있어도 쓰지 않는다.

그리고 loc에 없으면 `report.unmapped('E.G.O 패시브 한국어 없음')` 로 **빌드를 세운다** —
mj에 있는데도. E.G.O 편에서 다룰 자리다.

E.G.O 113건 = 접미 `11` 110건 + 접미 `12` 3건. **110은 E.G.O 수와 정확히 같다.**

---

## `name` / `nameKo` — 패시브 이름

| | |
| --- | --- |
| 타입·실측 | `String \| null` · **비어 있음 6건**(4필드 전부 `null`) |
| `name === nameKo` | **0건** — 스킬(13건)과 달리 영문 고유명사가 없다 |
| 유일값 | **544종** / 703건 |
| 마크업 | 0건 |
| 변환 | `mjPassive?.nameKo ?? entry.name` (ko) · `mjPassive?.name ?? entry.name` (en) — `skills.ts:398` |
| 적재 | `passive_text.name` |
| 화면 | 상세 "패시브" 패널 제목 |

**이름 중복이 계보를 만든다.**

```
6  "흑운도"      5  "혈찬"      4  "각오"
3  "냉정" · "담.탐" · "흑수화[묘]" · "본국검술" · "마왕의 부름"
```

`01` → `11` 강화판이 **같은 이름을 쓰므로** 이름으로는 못 고른다(`1010301`·`1010311` 둘 다 "냉정").

이름에 대괄호가 리터럴로 들어간 것도 있다 — `"흑수화[묘]"` · `"재회[再会]"` ·
`"봉인된 검 [레바테인]"`. **토큰이 아니라 이름의 일부**다. 이름 필드는 `toDisplay` 를 거치지
않고 `stripMarkup` 만 통과하므로 치환되지 않는다.

### 빈 6건 — 스킬을 패시브로 잘못 올린 것

```
1011003  이상 · 엄숙한 애도        S3  나태/관통  "이상으로 장례는 이상이오"
1021202  파우스트 · 흑수-묘 필두    S2  오만/참격  "길을 뚫겠습니다. 주군."
1031102  돈키호테 · 동부 섕크 3과   S2  분노/관통  "초염장"
1050803  뫼르소 · 검계 우두머리     S3  분노/참격  "육참"
1051102  뫼르소 · 서부 섕크 3과     S2  폭식/관통  "팡트"
1100903  싱클레어 · 새벽 사무소     S3  분노/관통  "낙인"
```

확인한 것을 층별로 적는다.

| 층 | 결과 |
| --- | --- |
| `limbus-data-mj/passives.json` | id는 있고 `name`·`nameKo`·`desc`·`descKo` 전부 `null` |
| `limbus-data-mj/skills.json` | **6/6 정상 스킬로 존재.** 이름·죄악·타입·티어 완비 |
| `limbus-data-mj/identities_detail.json` `attackSkills` | **6/6 있다.** `copies` 정상(S2=2 · S3=1) |
| `limbus-data-mj/identities_detail.json` `battlePassives` | **6/6 참조한다** — 이것이 문제 |
| `limbus-assets/identity-details/{id}.json` `combatPassives` | **6/6 목록에 없다** |
| `limbus-assets/identity-details/{id}.json` `skills` | **6/6 있다** |
| 전투 패시브 집합 전수 대조 | 178/184 일치. 어긋나는 6건이 정확히 이것들 |
| 게임 인격 상세 화면 | 패시브 개수가 `limbus-assets` 와 일치. 6건은 **패시브로 없고 스킬로 있다** |

**변환은 이미 이 건을 알고 처리한다**(`src/entities/skills.ts:432`).

> **보강 출처가 스킬을 패시브로 잘못 올린 건이 있다.** 실측 **16건(고유 6종)** 이 전부 다음
> 세 조건을 동시에 만족한다 — 정본에 패시브 정의가 없고, mj `passives.json` 의 항목이
> 이름·설명이 모두 null 인 껍데기이며, **같은 인격의 정본 스킬 id 다.**
> 예를 들어 `1011003` 은 인격 `10110` 의 3번 공격 스킬이지 패시브가 아니다.

16건은 동기화 단계별 링크를 센 수다(`10110` 이 lv1·2·4 세 번 등장).

**조건 셋이 다 필요한 이유가 함정 1과 이어진다.** 껍데기라는 것만으로는 "스킬을 잘못
올린 것"인지 "패시브 정의가 빠진 것"인지 못 가른다. 번호 공간이 겹치므로 **"같은 인격의
정본 스킬 id 인가"** 가 결정적이다.

```
조건 셋 다 만족    → 링크째 버리고 note('보강 출처가 스킬을 패시브로 등재(링크 버림)')
껍데기인데 ③ 아님   → unmapped('패시브 정의를 어느 출처에서도 못 찾음') → 빌드 실패
껍데기 아님        → ADR-04 2.3 규칙대로 보강해 받는다 (현행 스냅샷에 해당 없음)
```

---

## `desc` / `descKo` — 패시브 설명

| | |
| --- | --- |
| 타입·실측 | `String \| null` · **둘 다 있음 703 · 둘 다 없음 6 · 한쪽만 0건** |
| `desc === descKo` | **0건** |
| 토큰 | **289종** (스킬 설명 266종보다 많다) |
| 마크업 | `style`:200 · `color`:52 · `u`:52 · `link`:52 · `noparse`:28 · `sprite`:26 |
| 길이 | 최소 16 · 중앙 **97** · 최대 **1,047**자 |
| 변환 | `mjPassive?.descKo ?? entry.desc` → `toDisplay` (`skills.ts:400`) |
| 적재 | `passive_text.desc` · `.desc_raw` |
| 화면 | 상세 "패시브" 패널의 설명 |

**번역 상태가 스킬보다 깨끗하다** — 한쪽만 있는 경우 0건, 영문 그대로 0건.
비어 있는 6건은 위의 그 6건이다.

### 토큰 구성이 스킬과 반대다

```
패시브 (상태·자원 주류)              스킬 설명 (발동 시점 주류)
123  [Charge]                    1845  [WhenUse]
117  [Combustion]                 511  [BeforeAttack]
 77  [Breath]                     444  [EndSkill]
 74  [Laceration]                 292  [CantIdentify]
 58  [Sinking]                    265  [StartBattle]
 50  [TabExplain]      ←          216  [WinDuel]
 47  [Burst] · [Bullet]
 40  [Agility] · 25 [AttackUp] · 21 [DefenseUp]
```

**패시브는 발동 조건을 문장으로 서술하고, 스킬은 `[WhenUse]` 같은 표지를 쓴다.**

`[TabExplain]` 50건은 회차 3에서 본 그 토큰이다(`src/text.ts:163` — "게임이 지우는 UI
표식이므로 빈 값 그대로가 정답"). **치환되면 사라진다.**

`[BlessingOfIndexPrescriptAlly]` 22건 — 회차 1의 `10115` 거미집 검지 아비 패시브에서 본 자원이다.

### 설명이 길다 — 패시브 하나가 스킬 전체보다 길다

```
1041502  "재회[再会]" (료슈)              1,047자
1111513  "봉인된 검 [레바테인]" (오티스)     928자
1091612  "예지안" (로쟈)                    908자
1011503  "신탁 대행자 / 해금" (이상)         878자
1120702  "총알은 비싸다고" (그레고르)         820자
```

회차 2에서 본 `11115` 거미집 중지 아비처럼 패시브 6개를 가진 인격이면 한 패널에 수천 자가
들어간다.

---

## `cost` — 해금 조건

| | |
| --- | --- |
| 타입·실측 | `String[] \| null` · **`null` 105 · 배열 604**(빈 배열 5 · 길이 1이 599) |
| 토큰 | **5종** — `CheckAwakenLevel2` 286 · `3` 202 · `4` 105 · `Between_2_4` 3 · `5` 3 |
| 의미 | **해금되는 동기화 단계** |
| 변환 | — (해금 단계는 `identities_detail.json` 의 `level` 에서 온다) |
| 적재 | **미적재** |
| 화면 | 미표시 (`identity_passive.uptie` 가 "동기화 N" 태그를 만든다) |

### 접미와 정확히 맞물린다

```
인격 접미 21  →  CheckAwakenLevel3    184/184        지원 패시브 = 동기화 3
인격 접미 31  →  Level4 29 · Level3 1                지원 강화판 = 동기화 4
인격 접미 01  →  Level2 166 · 없음 18                전투 기본 = 동기화 2
인격 접미 11  →  Level4 75 · Level2 7 · Level3 6     전투 강화판 = 동기화 4
E.G.O 접미 11 →  Level2 107 · Between_2_4 3
E.G.O 접미 12 →  Level5 3
```

**위키가 확인해준 해금 단계와 일치한다** — 전투 패시브 동기화 2, 지원 패시브 동기화 3.
그리고 **강화판은 동기화 4**다.

### `cost` 없는 인격 패시브 110건

```
접미 01:18 · 02:55 · 03:24 · 04:9 · 05:2 · 06:1 · 13:1
```

`02`–`06` 이 주류다. **추가 전투 패시브는 해금 조건이 없다** — 회차 2에서 본
`battlePassives` 의 `level: 1` 72건과 이어진다. `01` 인데 `cost` 가 없는 18건은 예외다.

### `Between_2_4` 와 `Level5` — 「4번째 성냥불」 전용

```
2010211  Between_2_4   "불티"        이상
2010212  Level5        "불티"
2040211  Between_2_4   "4번째 성냥불"   료슈
2040212  Level5        "4번째 성냥불"
2090211  Between_2_4   "불씨"        로쟈
2090212  Level5        "불씨"
```

회차 3에서 본 그 E.G.O다. 동기화 5가 실재하는 3인 공유 E.G.O이며 패시브도 같은 구조를 갖는다.

```
접미 11  Between_2_4   동기화 2~4 구간에서만 유효
접미 12  Level5        동기화 5에서 교체
```

**`Between_2_4` 는 상한이 있는 유일한 조건**이다. 동기화 5가 되면 `11` 이 꺼지고 `12` 가
켜지는 구조로 읽힌다. 회차 2에서 본 `01`→`11` 교체와 같은 방식이며, **상한을 명시한 것은
여기가 처음**이다.

패시브 이름이 수감자마다 다른 것도 눈에 띈다 — 같은 E.G.O인데 "불티"(이상) ·
"4번째 성냥불"(료슈) · "불씨"(로쟈)다.

---

## 함정 요약

1. **패시브 id와 스킬 id가 같은 번호 공간을 쓴다.** `1010101` 이 두 파일에서 각각 스킬 "쳐내기" 와 패시브 "정보전달" 이다
2. **E.G.O 패시브 113건은 적재되지 않는다.** id 규칙이 같은데 `EgoPassive` 는 `ego-details` + `loc-*` 에서만 온다
3. **빈 6건은 스킬을 패시브 목록에 잘못 올린 것**이다. 변환이 세 조건으로 판정해 링크째 버린다
4. `01`→`11`, `21`→`31` 강화판이 **같은 이름**을 쓰므로 이름으로 못 고른다
5. 이름의 대괄호는 **리터럴**이다(`"재회[再会]"`). 토큰이 아니다
6. `[TabExplain]` 50건은 **치환되면 사라지는** UI 표식이다
7. `Between_2_4` 는 상한이 있는 유일한 조건이며 동기화 5 도입과 함께 등장했다

## 미해결

### 남은 것

- ❓ `01` 인데 `cost` 가 없는 18건 — 전투 기본 패시브가 동기화 조건 없이 붙는 인격들이다
- ❓ E.G.O 패시브 한국어가 mj에 있는데도 loc에 없으면 빌드를 세운다. 실제로 그런 건이 있는지
  (E.G.O 편)

### 다음 회차로 넘긴 것

- → **회차 8** `limbus-assets/passives.json` — `support` 절의 죄악 자원 요건과 `ego` 절.
  `uptie` 가 이 파일의 `cost` 와 중복인지 대조
- → **회차 10** `identity-details/{id}.json` 의 `passiveData` — 정본 패시브 정의
- → **E.G.O 편** E.G.O 패시브 113건 · `egos.json` 의 `nameKo` 결손

### 해소된 것

- ✔ **패시브 교체를 `identity_passive` 가 어떻게 접는지**(회차 2 이월) — `folded` Map 이
  `identityId|passiveId|kind` 로 접고, `01`→`11` 은 **별개 id라 별개 행**이 된다.
  동기화 4에서 `01` 이 사라지는 것은 반영되지 않는다
- ✔ **빈 6건의 정체** — 스킬을 패시브로 잘못 올린 것. 게임 화면·스킬 파일·정본 목록
  3중으로 확인했다

## 근거 재현

```
data/entities/identities/limbus-data-mj/passives.json             패시브 709건
data/entities/identities/limbus-data-mj/skills.json               번호 공간 충돌 확인
data/entities/identities/limbus-data-mj/identities_detail.json    battlePassives 참조
data/entities/identity-details/limbus-assets/{id}.json            combatPassives 전수 대조
data/entities/identities/limbus-assets/passives.json              support · ego 절
src/entities/skills.ts:398 · :432                                 변환 · 스텁 판정
게임 인격 상세 화면 스크린샷 6종                                     표시 패시브 개수
```
