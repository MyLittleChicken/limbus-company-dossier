# 회차 5 — `loc-*` 의 `EGOgift_MirrorDungeon*.json`

> **거울 던전 기프트 문자열** · 3로케일 × **12파일** · 유일 **604건**
> 출처 커밋 `774883d7` · 스냅샷 2026-07-25 · 정리 2026-07-31

## 파일 정체

```
항목 키   id · name · desc · simpleDesc
```

**세 로케일이 파일 목록·건수·id 집합까지 완전히 대칭**이다(604/604/604).

| 파일 | 건수 |
| --- | ---: |
| `EGOgift_MirrorDungeon.json` | 362 |
| `EGOgift_MirrorDungeon-EventTheme_2.json` | 60 |
| `EGOgift_MirrorDungeon_7.json` | 53 |
| `EGOgift_MirrorDungeon-EventTheme.json` | 31 |
| `EGOgift_MirrorDungeon_2.json` | 20 |
| `EGOgift_MirrorDungeon-StoryTheme.json` | 18 |
| `EGOgift_MirrorDungeon-StoryTheme_2.json` | 17 |
| `EGOgift_MirrorDungeon-mowe.json` · `-mowe-re.json` | 12 + 12 |
| `EGOgift_MirrorDungeon_6.json` | 10 |
| `EGOgift_MirrorDungeon-ycgd.json` | 9 |
| `EGOgift_MirrorDungeon-x1p1c1.json` | **0** |

**id 중복이 파일 간에 0건**이다. 12파일이 서로 겹치지 않는다.

---

## 1. `id` — 강화 단계가 id 에 들어 있다

```
604 = 4자리 401 + 5자리 203
      1xxxx  103        2xxxx  100
```

### `ENHANCE_ID_STRIDE` 가 여기서는 정확하다

```
1xxxx − 10000 이 기본 id 에 있다     103 / 103
2xxxx − 20000 이 기본 id 에 있다     100 / 100
어긋난 것 0
```

변환기 상수 `ENHANCE_ID_STRIDE = 10_000`(`src/entities/gifts.ts:17`)이
**로컬라이즈 파일에는 예외 없이 맞는다.**

> 회차 2에서 본 `gifts_detail.abilityIDs` 의 prefix 규칙과 **다른 규칙**이다.
> 같은 「강화 단계」를 두 파일이 다르게 인코딩한다.
>
> ```
> loc 기프트 id        9001 → 19001 → 29001      +10000
> abilityIDs          90011 → 190011 → 290011   문자열 prefix
> ```
>
> 기프트 id 가 4자리라 두 규칙이 우연히 같아 보이지만, `abilityIDs` 는 5자리라 갈린다.

### `2xxx` 4자리 12건 — assets 에 없는 기프트

```
2027 검은 장부 · 2028 녹슨 칼자루 · 2029 조각난 칼날 · 2030 부서진 칼날
2031 붉은 색술 · 2032 장관 · 2033 부동 · 2034 해진 삿갓 · 2035 낡은 도포   ← ycgd
2080 낡은 칼자루 · 2081 절경 · 2082 탁마                                ← EventTheme_2
```

**`limbus-assets/gifts.json` 456건에 하나도 없다.** 검계·흑운회 조건이 붙은
**이벤트 테마 전용 기프트**이며, 로케일 파일에만 존재한다.

회차 2에서 `9801` 강인환 → `2066`, `9804` 물 속의 달 → `2070` 을 가리키는 `abilityIDs` 를
봤는데, **그 두 id 는 이 회차에도 없다.** 회차 6·7에서 나오는지 확인한다.

### `assets` 456건 중 67건이 이 회차에 없다

```
없는 67건의 앞자리   98xx 32 · 92xx 28 · 97xx 7
```

거울 던전 밖에서 얻는 기프트다 — 회차 6(스토리 던전·이벤트)·7(공용)에서 나온다.

## 2. `name` · `desc` — 표시 문자열

604건 전부 값이 있다. 결손 0.

## 3. `simpleDesc` — **배열이다**

```json
"simpleDesc": [ { "abilityID": 9701, "simpleDesc": "스킬로 [Combustion] 부여 시 …" } ]
```

키 이름이 같은 것이 중첩된다. **604건 전부 보유**하며 길이는 1–9다.

```
길이 1  242 · 2  271 · 3  67 · 4  18 · 5  3 · 6  1 · 9  2      총 1,087 항목
```

**기프트 하나가 여러 능력으로 쪼개진다.** `desc` 는 전체 설명이고 `simpleDesc` 는
능력 단위 한 줄이다.

### `abilityID` 가 `gifts_detail.abilityIDs` 와 이어진다

```
일치       438
대조 불가   61      (mj 에 없는 기프트 · 해당 단계 없음)
다름      105
```

**절반 넘게 맞고 105건이 어긋난다.** 어긋나는 방식이 두 가지다.

```
9709   loc [9709, 97091]    mj [9709]              loc 가 더 많다
9721   loc [9709, 97211]    mj [97211, 97212]      집합이 다르다
```

`9721`·`9722`·`9723`·`9724`·`9725` 처럼 **mj 가 기프트 id 자신을 빼고 하위 id 만
갖는 경우**가 다수다. 회차 2에서 본 「일부 원소만 강화되는 21건」과 같은 계열이며,
**두 출처가 능력 분해를 다르게 한다.**

> 우리는 어느 쪽도 적재하지 않는다. `GiftText` 는 `desc` 만 쓴다.

## 4. 마크업 6종

```
<style="upgradeHighlight"> … </style>    373쌍
<noparse> … </noparse>                    22쌍
<혈귀>                                     3      ← 리터럴
<기계 융화 생명체>                          1      ← 리터럴
```

**회차 2의 `gifts_detail` 과 같은 어휘**다. `upgradeHighlight` 가 강화로 바뀐 부분을
감싸는 것도 같고, `<혈귀>`·`<기계 융화 생명체>` 리터럴 꺾쇠도 같은 3+1건이다.

두 파일이 같은 원본에서 나왔음을 보여준다.

---

## 회차 2의 질문 하나가 닫힌다

회차 2에서 "한국어 강화 텍스트(`effectKo`)의 유일한 출처인가" 를 미뤘다.

```
gifts_detail.upgrades[].effectKo    강화 단계별 전문
loc EGOgift_MirrorDungeon*.desc      강화 단계별 전문 (id 에 단계가 들어 있다)
```

**로케일 파일도 갖는다.** `19001` 의 `desc` 가 `9001` 강화 1단계의 한국어 전문이다.

> **`gifts_detail` 은 유일 출처가 아니다.** 다만 `simpleDesc`(능력 단위 한 줄)는
> 로케일 파일에만 있고, `abilityIDs` 분해는 두 출처가 105건에서 다르다.

---

## 함정 요약

1. `simpleDesc` 는 **배열**이다. 같은 이름 키가 중첩된다
2. 기프트 id 의 강화 규칙(`+10000`)과 `abilityIDs` 의 prefix 규칙은 **다르다**
3. `2xxx` 4자리 12건은 **assets 에 없는 기프트**다. 로케일에만 있다
4. `abilityID` 분해가 mj 와 **105건 다르다**
5. `EGOgift_MirrorDungeon-x1p1c1.json` 은 **3로케일 전부 빈 배열**이다

## 미해결

없다. 12파일 × 3로케일 전부 확정했다.

### 이월 확인 1건

- ✔ **회차 2** `effectKo` 가 한국어 강화 텍스트의 유일 출처인가 — **아니다.** 로케일도 갖는다

## 근거 재현

```
data/entities/gifts/loc-{ko,en,ja}/EGOgift_MirrorDungeon*.json   12파일 · 604건
data/entities/gifts/limbus-assets/gifts.json                     456 대조
data/entities/gifts/limbus-data-mj/gifts_detail.json             abilityIDs 대조
src/entities/gifts.ts:17                                         ENHANCE_ID_STRIDE
```
