# 회차 13 — `loc-*` 표시명 3종

> **패시브 · 특성 키워드 · 조직명의 표시 문자열** · 로케일 3종 · 각 16파일 · 각 **769항목**
> `Passives` 598 + 변종 35 · `UnitKeyword` 82 + 변종 51 · `AssociationName` 3
> 출처 커밋 `595947fc`(ko) · `ccfff8e3`(en) · `2f98ddb4`(ja) · 스냅샷 2026-07-25 · 정리 2026-07-30

## 파일 정체

**로케일 회차의 마지막이다.** 회차 2의 `unitKeywords` 표시명 133종과 회차 5의 조직명이
여기서 닫힌다.

```
                          ko / en / ja  동일
Passives.json              598항목  239KB
Passive-a1c971.json         29항목   10KB
Passive-walpu2.json          6항목    1KB
UnitKeyword.json            82항목    7KB
UnitKeyword-* 변종 11개      51항목
AssociationName.json         3항목    0KB
──────────────────────────────────────
총                         769항목
```

**세 로케일의 파일 수·항목 수가 완전히 같다.** 회차 11(`Personalities-a1c9p2` 결손)·
회차 12(`Skills_personality-a1c9p1·p2` 결손)에서 있던 `loc-en` 결손이 여기는 없다.

### 대조한 출처

| 출처 | 무엇을 대조했나 |
| --- | --- |
| `limbus-data-mj/passives.json` | 인격 패시브 596 커버리지 |
| `limbus-data-mj/identities_detail.json` | `unitKeywords` 36종의 표시명 |
| `limbus-data-mj/associations.json` | 조직 64종 대비 `AssociationName` 3종 |
| `identity-details/{id}.json` | 유령 6건 세 번째 확인 |

---

## `AssociationName.json` — 사문화된 구식 파일

| | |
| --- | --- |
| 타입·실측 | `{dataList: [...]}` · **3항목** · 0 KB |
| 원소 키 | `id` · `content` |
| 변환 | **쓰이지 않는다** |
| 적재 | 미적재 |

```
associationName_BLADE_LINEAGE  "검계"
associationName_BLACK_CLOUD    "흑운회"
associationName_YURODIVY       "유로지비"
```

**회차 5의 조직 64종 중 3종만 있다.** 그리고 이 3종은 `UnitKeyword.json` 에 **전부 중복**돼 있다.

```
UnitKeyword_BLADE_LINEAGE  "검계"      ← 같은 값
UnitKeyword_BLACK_CLOUD    "흑운회"
UnitKeyword_YURODIVY       "유로지비"
```

**조직명 표시가 `UnitKeyword` 로 옮겨가고 이 파일은 3종만 남은 것**으로 보인다.
파일명이 `AssociationName` 이라 조직명의 정본처럼 보이지만 실제로는 잔재다.

`affiliation_text.name` 은 회차 5에서 확인한 대로 **`limbus-assets` 의 영문 태그를 id 로 쓰고
한국어는 `UnitKeyword` 계열에서 온다.**

---

## `UnitKeyword` 12파일 133종

| | |
| --- | --- |
| 타입·실측 | 12파일 합계 **133항목** · **유일 133종** (중복 0) |
| 원소 키 | `id`(`UnitKeyword_XXX` 형식) · `content` |
| 변환 | 표시명 조회 |
| 적재 | `affiliation_text.name` (간접) |
| 화면 | 목록 "소속" 필터 · 상세 "소속" 패널 |

```
UnitKeyword.json       82종    기본
UnitKeyword-a1c9p3     17종    가장 큰 변종
UnitKeyword-x1p1c1      7종    이벤트 유닛 (회차 11·12의 x1p1c1 과 같은 계열)
UnitKeyword-a1c7p1      6종
나머지 8개 변종          21종
```

**회차 2에서 확인한 133종이 그대로다.** 인격이 쓰는 `unitKeywords` 36종 중 **25종이 여기
걸리고 11종은 표시명이 없다**(`SMALL` 182건 · `BASE_APPEARANCE` 12건 ·
`CAN_NOT_USING_INDEX_UNLOCK_PERSONALITY` 등).

변종 파일명이 이벤트·시즌 식별자로 보인다 — `a1c7p1`·`a1c8p2`·`a1c9p3` 는 시즌·챕터·파트,
`exem`·`pilgrimage`·`x1p1c1` 은 이벤트다.

---

## `Passives` 3파일 633종

| | |
| --- | --- |
| `Passives.json` | **598항목** — 7자리 591 + 6자리 `9xxx` 7(베르길리우스) |
| `Passive-a1c971.json` | 29항목 |
| `Passive-walpu2.json` | 6항목 |
| 합계 유일 id | **633종** |
| 원소 키 | `id` 598 · `name` 598 · `desc` 598 · `summary` **218** · `flavor` **23** · `undefined` **4** |
| 변환 | E.G.O 패시브 한국어 조회(`egos.ts:151`). 인격 패시브는 mj 를 쓴다 |
| 적재 | 간접 |

### 결손 21건 — 강화판 15 + 유령 6

**mj 인격 패시브 596 중 21건이 `loc` 3파일 어디에도 없다.**

```
접미 11 · 31 (강화판)  15건    mj 에 이름이 있다
  1010311 "냉정"(검계 살수)          1020211 "자가충전"
  1020411 "휘파람"                  1020431 "속삭임"
  1040511 "차원 마검"                1040531 "차원 굴절 칼날 - Type: Blade Mk7"
  1050311 "견뎌내기"                 1050611 "rrR-#4 슈트 가압 가동"
  1060611 "익숙해진 정리 업무"         1070311 "풀 뜯을 준비"
  1070411 "젠장..."                 1080211 "뇌파집속"
  1080511 "차오르는 액체"             1100211 "살수"
  1100511 "광염"

접미 02 · 03 (유령)     6건    mj 이름도 없다
  1011003 · 1021202 · 1031102 · 1050803 · 1051102 · 1100903
```

**강화판 15건은 문제가 아니다.** mj가 이름·설명을 갖고 있으므로 화면에 정상 출력된다.
`loc` 이 강화판(`11`·`31`)을 별도 항목으로 두지 않고 기본판(`01`)만 담는 정책으로 보인다.
회차 4에서 `01`→`11` 이 **같은 이름을 쓴다**고 확인한 것과 맞물린다.

**유령 6건은 여기서도 없다 — 세 번째 확인이다.**

| 회차 | 확인한 것 |
| --- | --- |
| 4 | mj `passives.json` 에서 이름·설명이 전부 `null` |
| 10 | `identity-details` 의 `passiveData` 590 = mj 596 − 6 |
| **13** | **`loc` 3파일 633종에도 없음** |

**어느 층에서도 패시브가 아니다.** 회차 4의 판정("`limbus-data-mj` 가 스킬을 패시브 목록에
잘못 올린 것")이 최종 확인됐다.

### `loc` 에만 있는 37건

```
1000xxx   14건    "분노" · "색욕" · "나태" · "탐식" …   죄악별 공용 패시브
1082xxx   11건
1079xxx    5건
1080·1081·1110·1111·1389xxx   나머지 7건
```

`1000101 "분노"` · `1000201 "색욕"` 같은 **죄악 이름 패시브**다. 인격에 붙는 것이 아니라
공용 표기로 보인다. `1389xxx` 는 인격 대역(`10101`–`11216`) 밖이다.

### 부가 필드 — `summary` · `flavor`

**`summary` 218/598** 은 게임 UI의 짧은 표기다.

```
1070601 "본능적 간파"
  desc     (전문)
  summary  "취약 속성으로 공격 시 파열 부여 값 +1"

1070611 "본능적 간파" (강화판)
  summary  "취약 속성으로 공격 시 파열 부여 값 +1
            아군 세븐 협회 해결사가 4명 이상이면, 추가로 +1"
```

**`flavor` 23/598** 은 스토리 인용문이다.

```
1041502 "재회[再会]"
  flavor "'다시 만나고 싶지 않은 것은 다시 만나게 되고, 다시 만나고 싶은 것은 다시 만날 수 없다.'
          '그렇기 때문에 재회의 순간에는 마음을 독하게 먹어야 한다.'"

1041503 "지혜성[地慧星]"
  flavor "「지혜성도. 천살성도. 별이 벼려진 검을 두 개나 손에 넣었다면, 그대는 대체 어떤
          별이라 할 수 있겠는가.」"
```

회차 4에서 본 **가장 긴 패시브 설명**(`1041502` 1,047자)이 이 인격이다.
`10415` 거미집의 검(료슈)은 회차 9의 별칭 최다(6개)이기도 하다.

**둘 다 우리가 쓰지 않는다.** `summary` 는 화면이 좁을 때 유용하고, `flavor` 는 상세 화면의
읽을거리가 된다.

### `undefined` 키 4건 — 원본 버그

```
1121301 "패밀리의 숙청인"   undefined = "-"
1121302 "고통 없는 자비"    undefined = "-"
1121311 "패밀리의 숙청인"   undefined = "-"
1121321 "틈새 노리기"       undefined = "-"
```

**JSON 키 이름이 문자열 `"undefined"`** 이고 값은 전부 `"-"` 다.
**4건 모두 `11213` 밤의 송곳 카피타노(그레고르)** 다. 로컬라이즈 도구가 필드명을 잃은
것으로 보인다.

회차 3의 `[[FirePunchFuel]`, 회차 9의 `"null"` 문자열, 회차 11의 `"사영 전투]["` 와 같은
계열의 원본 오타다.

---

## 함정 요약

1. **`AssociationName.json` 은 3항목뿐이고 전부 `UnitKeyword` 에 중복**이다. 파일명이 정본처럼 보이지만 잔재다
2. `loc` 이 패시브 **강화판(`11`·`31`)을 담지 않는다**. mj가 채워서 화면은 정상이다
3. **유령 6건이 `loc` 에도 없다** — 세 번째 확인. 어느 층에서도 패시브가 아니다
4. `summary` 218건 · `flavor` 23건을 **우리가 쓰지 않는다**
5. `undefined` 키 4건이 전부 `11213` 카피타노다 — 원본 버그
6. `UnitKeyword` 133종 중 인격이 쓰는 것은 25종이고 **11종은 표시명이 없다**(`SMALL` 등)

## 미해결

없다. 16파일 × 3로케일 전부 확정했다.

### 우리가 쓰지 않는 것

```
AssociationName            3항목. 사문화
Passives 의 summary·flavor  241건
Passive-a1c971 · walpu2     35항목 (E.G.O·이벤트 계열)
UnitKeyword 변종 일부        이벤트 유닛용
```

## 근거 재현

```
data/entities/identities/loc-ko/Passives.json                598항목
data/entities/identities/loc-ko/Passive-a1c971.json          29항목
data/entities/identities/loc-ko/Passive-walpu2.json           6항목
data/entities/identities/loc-ko/UnitKeyword*.json            12파일 133종
data/entities/identities/loc-ko/AssociationName.json          3항목
data/entities/identities/loc-en/** · loc-ja/**               로케일 대조
data/entities/identities/limbus-data-mj/passives.json        인격 패시브 596 대조
data/entities/identities/limbus-data-mj/identities_detail.json  unitKeywords 36종
```
