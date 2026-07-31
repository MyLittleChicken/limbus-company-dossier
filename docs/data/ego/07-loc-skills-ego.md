# 회차 7 — `loc-*` 의 `Skills_Ego*.json`

> **E.G.O 스킬 문자열** · 3로케일 × 최대 16파일 · 본편 **210건** · 델타 3파일
> 출처 커밋 `774883d7` · 스냅샷 2026-07-25 · 정리 2026-07-30

## 파일 정체

E.G.O 스킬의 표시 문자열이다. 인격 편 회차 12(`Skills_personality-NN.json`)와 같은 구조다.

```
항목 키      id · levelList
level 키     level · name · abName · desc · coinlist
coinlist     [ { coindescs: [ { desc } … ] } … ]
```

## 1. 본편 210건 — `ego-details` 와 정확히 같다

```
Skills_Ego.json                 80건
Skills_Ego_Personality-01..12  130건
                              ─────
                               210건    교집합 0
```

**`ego-details` 의 스킬 210개와 차집합 양방향 0이다.** 회차 5에서 assets 가 mj 보다 2건
많다고 했는데, loc 도 그 2건(`2060812` · `2120912`)을 갖는다.

```
mj    skills.json    208
loc   Skills_Ego*    210        ← assets 와 같다
```

**mj 만 2건이 없다.**

### 분할 경계는 2023-07-27 이고 예외가 1건이다

`Skills_Ego_Personality-NN` 의 `NN` 은 수감자 번호가 맞다(파일별로 id 자릿수가 하나뿐).
하지만 `Skills_Ego.json` 도 12수감자를 전부 담는다. **소유 E.G.O 는 하나도 겹치지 않는다.**

날짜순으로 늘어놓으면 경계가 보인다.

```
2023-06-29   20403 적안              Skills_Ego
2023-06-29   20404 적안(開)          Skills_Ego
──────────────────────────────────────────────  2023-07-27 전환
2023-07-27   20405 소다              Personality-04
2023-07-27   20604 소다              Personality-06
2023-10-05   21004 초롱              Personality-10
2023-10-12   20704 공즉시색           Skills_Ego      ← 예외
2023-10-26   20505 후회              Personality-05
```

**예외가 정확히 1건이고 한 방향으로만 샌다.**

```
Skills_Ego  46종 중 2023-07-27 이후 :  1건   (20704 공즉시색, 히스클리프)
Personality 64종 중 2023-07-27 이전 :  0건
```

`Personality-07`(히스클리프) 파일이 따로 있으므로 "넣을 곳이 없어서" 가 아니다.
**왜 이 하나만 옛 파일에 남았는지는 알 수 없다** — 출처 쪽 파일 생성 사정이며 데이터에
답이 없다.

> **우리에게는 문제가 아니다.** 두 파일을 합쳐 읽으면 210건이 온전하고, 적재 시점에
> 하나의 테이블로 정리되므로 분할 흔적이 남지 않는다.

## 2. `abName` — E.G.O 의 유래 환상체

**인격 편에도, mj·assets 어디에도 없던 개념이다.**

```
2010111  오감도          abName 이상
2010211  4번째 성냥불     abName 불타버린 소녀        (Scorched Girl)
2010311  소망석          abName 탑돌이               (Pagoda Veneration)
```

E.G.O 당 `abName` 이 **정확히 1개**다(110/110). 유일 72종.

| 구분 | 건수 | `abName` |
| --- | ---: | --- |
| 기본 E.G.O (`slotId: 1`) | 12 | **수감자 이름** |
| 나머지 | 98 | **환상체 이름** 60종 |

기본 12종이 여기서 **여섯 번째로** 같은 집합을 만든다 — 환상체에서 온 게 아니라
수감자 자신에게서 나온 E.G.O 라는 뜻이다.

### E.G.O 이름과 환상체는 1:1 이다

```
같은 E.G.O 이름인데 환상체가 다른 것    0건
환상체 하나가 여러 E.G.O 이름            없음
```

회차 1의 **이름 중복 32종**이 여기서 설명된다. `4th Match Flame` 을 3명이 갖는 것은
**같은 환상체(불타버린 소녀)에서 뽑은 E.G.O** 이기 때문이다.

```
불타버린 소녀 3 · 아파하는 테디 3 · 골목파수견 3 · 길 잃은 승객 3 · 어느 날의 초상 3
탑돌이 2 · 단수어 2 · 하늘 집행관의 보좌 2 …
```

> **E.G.O 는 환상체에서 추출한 것이고, 그 대응이 이 파일에만 적혀 있다.**

**적재** — 하지 않는다. `Ego` 에 환상체 컬럼이 없다.

## 3. 단계는 mj 와 같은 델타 규칙이다

```
levelList 길이    2개 23 · 3개 183 · 4개 4
level 값 분포     1: 210 · 3: 210 · 4: 185 · 5: 6
```

**2단계가 아예 없다.** 회차 5에서 assets `ego-details` 가 `uptie 2` 를 4건 가졌던 것과
다르다.

| 출처 | 규칙 | 4단계 |
| --- | --- | ---: |
| mj `skills.json` | 델타 | 183 (208 중) |
| **loc `Skills_Ego*`** | **델타** | **185 (210 중)** |
| assets `ego-details` | 전량 | 210 |

mj 183 + 새 스킬 2건 = 185. **loc 와 mj 가 같은 규칙을 쓰고 assets 만 다르다.**

## 4. 코인 수는 assets 와 완전히 맞는다

```
coinlist 길이     1개 419 · 2개 99 · 3개 48 · 4개 42 · 5개 3
coindescs 길이    1–9개
효과 없는 코인     21건 (coindescs 키 자체가 없다)

ego-details 의 coins 수와 대조   590쌍 · 불일치 0
```

**한국어 코인 효과의 유일한 출처**다. mj `skills.json` 은 `coins` 를 영문으로만 갖고,
assets 도 영문이다. 인격 편 회차 3과 같은 구도다.

## 5. 마크업 11종

```
<style="highlight"> … </style>     1087쌍     조건부·강조 구문
<noparse> … </noparse>               10쌍
<sprite name="GainSinStockAdder">     4        죄악 자원 아이콘
<color=#f8c200> · <u> · <link=…>      4씩
```

대괄호 토큰은 **134종**이며 `ego-details` 의 169종과 같은 어휘다.

```
OnSucceedAttack 1309 · BeforeAttack 471 · EndSkill 329 · Vibration 298
CantIdentify 282 · Combustion 240 · Laceration 231 · SuperCoin 202
```

`stripMarkup` 은 `<…>` 만 지우고 `[…]` 는 남겨야 한다 — 인격 편 회차 12와 같은 처리다.

## 6. 델타 3파일

### `Skills_Ego_Personality-a1c9p3.json` — 연출 전용 스킬 5건

```
2010112 · 2030112 · 2050112 · 2060112 · 2110112
level 4 하나뿐 · abName 은 수감자 이름
ego-details 에 있나:  전부 없음
```

회차 6의 **연출 전용 E.G.O 5건**(`201011`·`203011`·`205011`·`206011`·`211011`)에
대응하는 스킬이다. 원본 기본 E.G.O 의 스킬 id 에 접미 `12` 를 붙였다.

```
20101 오감도       스킬 2010111        기본
201011 오감도(연출) 스킬 2010112       ← 여기만
```

**접미 `12` 가 두 가지 뜻을 갖는다.**

| 접미 `12` | 뜻 | 건수 |
| --- | --- | ---: |
| `2060812` · `2120912` | 각성 스킬이 2개인 E.G.O 의 두 번째 | 2 |
| `2010112` 계열 5건 | **연출 전용 E.G.O 의 스킬** | 5 |

id 규칙만으로는 구분할 수 없다. **어느 파일에서 왔는지가 구분한다** — 회차 2의
「파일이 타입이다」 와 같은 이야기다.

### `Skills_Ego-a1c5p2.json` — 빈 객체 1개

```json
{ "dataList": [ {} ] }
```

**3로케일 전부 `[{}]`** 다. 키가 하나도 없는 객체 하나. 원본 결함이며 파싱하면
`id` 접근에서 깨진다.

### `Skills_Ego_Personality-a1c9p2.json` — 빈 배열

`ko`·`ja` 에만 있고 `en` 에는 파일 자체가 없다. 내용은 `{"dataList": []}` 다.

**로케일마다 파일 목록이 다르다** — `ko` 16 · `en` 15 · `ja` 16.

## 7. 세 로케일이 완전히 대칭이다

```
본편 항목 수      ko 210 · en 210 · ja 210
id 집합           동일
levelList 길이    210/210 동일
```

회차 6에서 나온 일본어 단독 오류 같은 것이 **여기에는 없다.**

---

## 함정 요약

1. **접미 `12` 가 두 가지다.** 두 번째 각성 스킬 2건과 연출 전용 5건
2. `Skills_Ego-a1c5p2.json` 은 **빈 객체 `[{}]`** 다. 3로케일 전부
3. `Skills_Ego_Personality-a1c9p2.json` 은 **`en` 에 파일이 없다**
4. `Skills_Ego.json` 과 `Personality-NN` 의 분할 경계는 **2023-07-27**이고 `20704` 1건이 예외다.
   수감자 기준이 아니다 — 두 파일을 **합쳐 읽어야** 210건이 온전하다
5. 2단계 항목이 없다. mj 와 같은 델타 규칙이며 assets 만 전량 기록한다
6. `abName` 은 **어느 출처에도 없는 개념**이다. 미적재 상태로 남는다

## 미해결

없다. 3로케일 × 최대 16파일 전부 확정했다.

## 근거 재현

```
data/entities/egos/loc-{ko,en,ja}/Skills_Ego.json                80
data/entities/egos/loc-{ko,en,ja}/Skills_Ego_Personality-NN.json 130
data/entities/egos/loc-{ko,en,ja}/Skills_Ego*-a1c*.json          델타 3종
data/entities/ego-details/limbus-assets/*.json                   210 대조 · 코인 590쌍
data/entities/identities/limbus-data-mj/skills.json              208 대조
```
