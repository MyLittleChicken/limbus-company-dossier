# 회차 12 — `loc-*/Skills_personality-NN.json` + `Skills.json`

> **코인 한국어의 정본** · 로케일 3종 · `loc-ko` 16파일 · `loc-en` 14파일 · `loc-ja` 16파일
> 로케일당 **892항목** · 코인 4,305개 · `coindescs` 5,519개
> 출처 커밋 `595947fc`(ko) · `ccfff8e3`(en) · `2f98ddb4`(ja) · 스냅샷 2026-07-25 · 정리 2026-07-30

## 파일 정체

**회차 3에서 미룬 마지막 조각이 여기 있다.** 코인 효과의 한국어 설명은 이 파일에만 있다.

```
                              ko      en      ja
Skills.json                265항목  265항목  265항목   공용·기타 모음
Skills_personality-01~12   579항목  579항목  579항목   수감자별 12파일
Skills_personality-x1p1c1   48항목   48항목   48항목   이벤트 유닛
Skills_personality-a1c9p1     0항목      —      0항목   빈 파일
Skills_personality-a1c9p2     0항목      —      0항목   빈 파일
──────────────────────────────────────────────────
총                         892항목  892항목  892항목
```

**`Skills_personality-NN` 이 수감자별로 갈린다** — `-01` 은 수감자 01만, `-05` 는 05만.
회차 11의 `Personalities.json` 이 한 파일에 다 담은 것과 구조가 다르다.

`loc-en` 에 `a1c9p1`·`a1c9p2` 가 없다. 회차 11의 `Personalities-a1c9p2` 와 같은 패턴이다.

### 대조한 출처

| 출처 | 무엇을 대조했나 |
| --- | --- |
| `limbus-data-mj/identities_detail.json` | 인격이 참조하는 스킬 837건 커버리지 |
| `limbus-data-mj/skills.json` | `levels` 델타 구조 · 빈 배열 9건 |
| `identity-details/{id}.json` | 코인 인덱스 대응 |
| `src/entities/skills.ts:91` | `(스킬 id, level, 코인 index)` 조인 |

---

## id 대역 5종

```
7자리 1xxx    832건    인격 스킬
8자리 4xxx     48건    이벤트 유닛 스킬 (x1p1c1)
6자리 9xxx      9건    999901–999909 — 베르길리우스
1자리           3건    "0" · "1" · "2"
```

`Skills.json` 265항목의 내역이 이렇게 갈린다.

```
7자리 253건   인격 스킬 250 + 공용 3
                공용 = 1000101 "방어" · 1000102 "회피" · 1000103 "반격"
6자리   9건   999901 "달구어 꿰뚫기" · 999902 "작열절삭" · 999903 "흐름을 따라" …
              999906 은 이름이 "?" 다
1자리   3건   "0" 방어 · "1" 회피 · "2" 반격
```

**`Skills.json` 은 공용·기타 모음**이고 인격 스킬 250건이 섞여 있다. 수감자별 파일 579건과
합쳐야 인격 스킬 전체가 된다.

`9999xx` 9건은 **회차 11의 베르길리우스(`9999`)** 스킬이다. 조력 유닛이므로 인격 편 밖이다.

1자리 `"0"`·`"1"`·`"2"` 는 **방어·회피·반격의 기본 표시명**으로 보인다. 회차 3에서 본
`"가드"` 34건 · `"회피"` 18건 · `"반격"` 12건 같은 중복 이름의 원형이다.

---

## 인격 스킬 커버리지 — 828/837

| | |
| --- | --- |
| 인격이 참조하는 스킬 | **837** |
| `loc-ko` 에 있는 것 | **828** |
| 없는 것 | **9** |

```
1021207 · 1071506 · 1071507 · 1081405 · 1101205 · 1101206 · 1111510 · 1111511 · 1121607
```

**회차 3의 `levels` 빈 배열 9건과 정확히 같다.**

네 출처를 모두 대조하면 이렇다.

| 출처 | 9건의 상태 |
| --- | --- |
| `limbus-data-mj/skills.json` | 분류만 있고 `levels` 가 빈 배열 |
| `identity-details/limbus-assets` | 목록에 없음 |
| `identity-details/shared-library` | 6건만 회수 (3건은 인격 파일 자체가 없음) |
| `loc-ko/en/ja` | **9건 전부 없음** |

**회차 10에서 "삭제 6 + 신규 미수록 6"이라 했는데, 표시 문자열 기준으로는 9건 전부 없다.**
구버전에서 수치를 회수한 6건도 이름·설명은 어디에도 없다.

---

## `levelList` — 델타 구조

```
{ id, levelList: [{ level, name, desc, coinlist: [ { coindescs: [{ desc }] } ] }] }
```

```
1010501  lv1  "침착하게"  desc="이 스킬이 버려지면 자신의 진동 횟수 3 증가"
              coinlist  [ {}, { coindescs:[{ desc:"[OnSucceedAttackHead] 진동 횟수 2 증가" }] } ]

         lv2  desc="…3 증가" → "…4 증가\n[WhenUse] 자신의 진동 횟수 2 증가"
         lv4  desc 에 "자신의 진동 횟수가 5 이상일 때 코인 위력 +1" 추가
```

**mj `skills.json` 의 `levels` 와 같은 델타 구조**다 — 변한 단계만 기록하고 빠진 단계는
앞 단계를 이어받는다. 회차 3에서 확인한 조합 패턴(`[1,2,4]` 351건 등)과 맞물린다.

변환도 같은 이월 로직을 쓴다.

```
src/entities/skills.ts:352
  로케일 파일도 변경된 단계만 담으므로 uptie 이하에서 가장 가까운 단계를 찾는다
```

---

## `coinlist` — 코인 한국어의 정본

| | |
| --- | --- |
| 길이 분포 | 0:18 · 1:583 · 2:747 · 3:482 · 4:176 · 5:12 · **9:2** |
| 코인 총 | **4,305개** |
| 빈 객체 `{}` | **656개 (15.2%)** |
| `coindescs` 총 | **5,519개** |
| 변환 | `collectCoinText`(`skills.ts:91`) — `(스킬 id, level, 코인 index)` 로 조인 |
| 적재 | `skill_coin_text.desc` · `.desc_raw` |
| 화면 | 스킬 패널의 코인별 효과 |

**빈 객체 `{}` 가 효과 없는 코인**이다. 회차 3의 빈 문자열 `[""]` 135개에 대응하지만 수가
다르다(656 vs 135) — **loc 쪽이 더 촘촘히 빈 자리를 표시한다.** 코인 위치를 인덱스로
맞춰야 하므로 빈 자리도 자리를 지켜야 한다.

**코인 9개인 것이 2건** — 회차 3의 `1011505` "Furioso-Replica" lv3·lv4 와 같다.
`10115` 거미집 검지 아비가 또 최대치를 만든다.

### 조인 키가 인덱스다

```
const key = `${entry.id}|${level.level ?? 1}|${index}`;
```

**정본(`identity-details`)의 코인 배열 위치와 인덱스로 대응**시킨다. 따라서 빈 객체를
건너뛰면 인덱스가 밀려 **엉뚱한 코인에 설명이 붙는다.** 빈 자리가 656개나 되는 이유다.

변환 주석이 이 구조를 설명한다.

> 정본(`limbus-assets`)의 `coins[].descs` 는 영문뿐이라, 로케일 구분 없이 그것만 쓰면
> `[OnSucceedAttackHead] Inflict 1 침잠` 처럼 영문에 상태명만 치환된 혼종이 나온다.
> `(스킬 id, level, 코인 index)` 로 조인하면 정본의 코인 위치와 정확히 대응한다.

---

## 회차 3의 마지막 조각이 맞춰졌다

코인은 **세 출처가 각각 다른 조각**을 준다.

| 조각 | 출처 | 회차 |
| --- | --- | --- |
| 코인 개수·순서·`type` | `identity-details/{id}.json` 의 `skills[].data[].coins` | 10 |
| 코인 효과 (영문) | 같은 곳의 `coins[].descs` | 10 |
| **코인 효과 (한국어)** | **`loc-*/Skills_personality-NN.json` 의 `coinlist`** | **12** |

mj `skills.json` 의 코인은 **영문뿐이라 쓰이지 않는다**(회차 3에서 한글 0개 확인).

---

## 함정 요약

1. `Skills_personality-NN` 이 **수감자별**이라 인격 스킬이 13파일에 흩어져 있다
2. `Skills.json` 은 공용 모음인데 **인격 스킬 250건이 섞여 있다**
3. **빈 객체 `{}` 656개를 건너뛰면 코인 인덱스가 밀린다**
4. 없는 9건은 **표시 문자열 기준으로 네 출처 전부에 없다.** 구버전에서 수치만 회수한 6건도 이름이 없다
5. `9999xx` 9건은 베르길리우스 스킬이다. `999906` 은 이름이 `"?"` 다
6. `loc-en` 에 `a1c9p1`·`a1c9p2` 가 없다

## 미해결

없다. 16파일 × 3로케일 전부 확정했다.

### 우리가 쓰지 않는 것

```
Skills.json 의 1자리·6자리 12건    공용 표시명 · 베르길리우스
Skills_personality-x1p1c1 48건    이벤트 유닛
a1c9p1 · a1c9p2                  빈 파일
```

## 근거 재현

```
data/entities/identities/loc-ko/Skills.json                        265항목
data/entities/identities/loc-ko/Skills_personality-01~12.json      579항목
data/entities/identities/loc-ko/Skills_personality-x1p1c1.json     48항목
data/entities/identities/loc-en/** · loc-ja/**                     로케일 대조
data/entities/identities/limbus-data-mj/identities_detail.json     스킬 참조 837건
data/entities/identities/limbus-data-mj/skills.json                levels 빈 배열 9건
src/entities/skills.ts:91 · :352                                   조인 · 이월
```
