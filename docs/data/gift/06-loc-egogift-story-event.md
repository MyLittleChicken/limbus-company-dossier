# 회차 6 — `loc-*` 의 스토리 던전·이벤트·발푸르기스 기프트

> **스토리 던전 · 이벤트 · 발푸르기스 계열** · 3로케일 × **16파일** · 유일 **189건**
> 출처 커밋 `774883d7` · 스냅샷 2026-07-25 · 정리 2026-07-31

## 파일 정체

세 로케일이 파일 목록·건수·id 집합까지 완전히 대칭이다(189/189/189).

| 파일 | 건수 | 성격 |
| --- | ---: | --- |
| `EGOgift_StoryDungeon.json` | 54 | **`abnormalityName` 키가 여기만 있다** |
| `EGOgift_a1c8p2.json` | 19 | 8장 2막 |
| `EGOgift_cultivation.json` | 14 | 이벤트 |
| `EGOgift_StoryDungeon-a1c7p3.json` | 14 | 7장 3막 |
| `EGOgift_walpu8.json` | 13 | 발푸르기스 8회 |
| `EGOgift_StoryDungeon-tkt.json` · `EGOgift_TwiningThreads.json` | 11 + 11 | |
| `EGOgift_StoryDungeon-a1c5p3.json` · `EGOgift_tktRe.json` | 10 + 10 | |
| `EGOgift_pilgrimage.json` | 9 | **선의의 순례 — 명일방주 콜라보** |
| `EGOgift_walpu4.json` · `EGOgift_walpu6.json` | 7 + 7 | 발푸르기스 4·6회 |
| `EGOgift_lcbcheckup-re.json` | 6 | |
| `EGOgift_night-clean-up-re.json` | 4 | |
| `EGOgift_StoryDungeon-a1c5p1.json` · `-a1c5p2.json` | **0** + **0** | 빈 배열 |

`EGOgift_pilgrimage.json` 은 E.G.O 편 회차 1의 **`season: 8000` 콜라보**와 같은 이벤트다.

---

## 1. 회차 5와 정확히 맞물린다

```
회차 5(거울 던전)  assets 456 중 389건
회차 6(이 회차)    assets 456 중  67건
                   ────────────────
                   389 + 67 = 456    겹침 0
```

**회차 5에서 "없는 67건" 이라 한 것이 정확히 이 회차의 assets 교집합**이다.
두 회차가 456건을 빈틈없이 나눠 갖는다.

```
없던 67건의 앞자리   98xx 32 · 92xx 28 · 97xx 7      ← 회차 5 기록
```

## 2. `id` — 로케일에만 있는 122건

```
189 = assets 와 겹치는 67 + 로케일 전용 122

앞자리   20xx 70 · 10xx 38 · 29xx 7 · 19xx 7 · (92·97·98 = 67)
```

`19xx`·`29xx` 는 `10xx`·`20xx` 의 강화판이다(`+10000` / `+20000`).

`10xx` 38건은 `1001` 신도의 가면 · `1011` 장난감 주먹처럼 **스토리 던전 전용**이다.

## 3. 회차 2의 `2xxx` 참조가 닫힌다

회차 2에서 `9801` 강인환 · `9804` 물 속의 달의 `abilityIDs` 가 `2066` · `2070` 을
가리키는데 **어느 파일에도 없다**고 기록했다. 여기 있다.

```
2066  강인환        ↔  9801 강인환
2070  물 속의 달     ↔  9804 물 속의 달
```

**같은 기프트가 두 번호 공간에 존재한다.**

### 이름이 같은 쌍이 30건이다

```
2036 은빛 시계 케이스  ↔  9721        2058 늘어붙은 쇠말뚝  ↔  9008
2037 빛바랜 시계 케이스 ↔  9722        2059 가시 올가미      ↔  9047
2048 라만차랜드 자유이용권 ↔ 9437       2060 카르밀라         ↔  9036
2052 퍼레이드의 가면    ↔  9440        …                          30건
```

그런데 **`abilityIDs` 가 loc id 를 가리키는 것은 2건뿐**이다(`9801`·`9804`).
나머지 28건은 **이름만 같고 번호가 이어져 있지 않다.**

> **이벤트 판과 상시 판이 따로 존재한다**는 뜻으로 읽힌다. 같은 기프트를 이벤트에서
> 먼저 내고 나중에 상시 기프트로 편입하면서 새 id 를 받은 것으로 보인다.
>
> **id 로 조인하면 30건이 서로 다른 기프트가 된다.** 이름으로는 이어지지만
> 회차 1에서 확인했듯 mj 기프트 이름은 441건 전부 유일하므로 이름 조인이 성립한다.

## 4. `abnormalityName` — 사실상 비어 있다

`EGOgift_StoryDungeon.json` 54건에만 있는 키다.

```
값 있음   1건   ("강화 인간")
결손     53건
```

E.G.O 편 회차 7의 `abName`(유래 환상체 72종)과 같은 이름이지만 **여기서는 채워지지
않았다.** 스토리 던전 기프트에도 환상체 유래를 붙이려다 만 흔적으로 보인다.

**미적재.**

## 5. `simpleDesc` — 한 파일만 없다

```
있음   179건 (15파일)
없음    10건 (EGOgift_StoryDungeon-a1c5p3.json)
```

`-a1c5p3` 만 키가 `id`·`name`·`desc` 3종이다. 회차 5와 같은 배열 구조
(`[{abilityID, simpleDesc}]`)를 쓴다.

---

## 함정 요약

1. **이름이 같은데 id 가 다른 기프트가 30건**이다. id 조인으로는 안 이어진다
2. `abnormalityName` 은 54건 중 **1건만 값이 있다.** 있는 줄 알고 쓰면 안 된다
3. `EGOgift_StoryDungeon-a1c5p3.json` 만 `simpleDesc` 가 없다
4. `-a1c5p1` · `-a1c5p2` 는 **3로케일 전부 빈 배열**이다

## 미해결

없다. 16파일 × 3로케일 전부 확정했다.

### 이월 질문 2건 해소

- ✔ **회차 2** `9801`·`9804` 의 `abilityIDs` 가 가리키는 `2066`·`2070` — **여기 있다**
- ✔ **회차 5** assets 456 중 없던 67건 — **이 회차가 갖는다.** 389 + 67 = 456

## 근거 재현

```
data/entities/gifts/loc-{ko,en,ja}/EGOgift_StoryDungeon*.json     16파일 · 189건
data/entities/gifts/loc-{ko,en,ja}/EGOgift_walpu*.json
data/entities/gifts/loc-{ko,en,ja}/EGOgift_{cultivation,pilgrimage,tktRe,…}.json
data/entities/gifts/limbus-assets/gifts.json                      456 분할 확인
data/entities/gifts/limbus-data-mj/gifts_detail.json              abilityIDs 대조
data/entities/gifts/limbus-data-mj/gifts.json                     이름 대조
```
