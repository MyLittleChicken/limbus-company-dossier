# 회차 3 — `limbus-assets` 업적 2파일

> `md__achievements.json` 88 KB · **시즌 7 · 93건**
> `md__md6__achievements.json` 105 KB · **시즌 6 · 90건**
> 출처 커밋 `774883d7` · 스냅샷 2026-07-25 · 정리 2026-07-31

## 파일 정체

거울 던전 업적이다. 두 파일이 **같은 구조로 시즌만 다르다.**

```
최상위   __Season__  +  분류 8종
항목 키  id · text · points · hardonly · tips  (+ replace 14건)
```

---

## 1. 분류 8종

| 분류 | 시즌 7 | 시즌 6 |
| --- | ---: | ---: |
| `Collection` | 25 | 25 |
| `Loadout` | 19 | 18 |
| `Combat` | 15 | 15 |
| `Adversity - EXTREME` | 13 | 12 |
| `Hidden` | 9 | 6 |
| `Shop` | 7 | 7 |
| `Clears` | 4 | 6 |
| `Completionist` | 1 | 1 |
| **합** | **93** | **90** |

`__Season__` 값이 `"7"` · `"6"` 인 **문자열**이다.

## 2. `points` — 총점이 다르다

```
시즌 7   5,870점        시즌 6   6,000점
```

`points` 는 정수이거나 **배열**이다. 배열인 14건이 다단계 업적이며 `replace` 를 짝으로 갖는다.

```json
{
  "id": "col_clear_with_count",
  "text": "Clear Mirror Dungeon at Floor 5 or higher with [count]+ E.G.O Gifts",
  "points": [10, 30, 50],
  "replace": { "count": [10, 20, 30] },
  "hardonly": [false, false, false]
}
```

**`text` 의 `[count]` 를 `replace` 로 치환**해 3개 업적을 만든다.
`points` · `hardonly` 도 같은 길이 배열이다.

> 다단계 업적이 **두 시즌 다 정확히 14건**이다.

## 3. `hardonly` — 40 / 34건

```
시즌 7  40건        시즌 6  34건
```

배열인 경우 단계별로 다를 수 있어 `any()` 로 셌다. 기프트 편의 `hardOnly` 와
같은 개념(하드 난이도)이지만 **별개 필드**다.

## 4. `tips` — 편집자 해설이다

**93건 · 90건 전부 보유**하며 `type` 이 12종이다.

| `type` | 시즌 7 | 뜻 |
| --- | ---: | --- |
| `text` | 106 | 자연어 공략 |
| `showGifts` | 21 | 기프트 목록 렌더 |
| `showIds` · `showIdsbySinner` | 13 + 7 | 인격 목록 |
| `showGiftList` | 11 | |
| `showThemePacks` · `showThemePacksByFloor` | 10 + 2 | 테마 팩 |
| `table` · `textList` | 2 + 2 | |
| `refreshCostSummary` · `enhanceCostSummary` · `showEGOs` | 1씩 | |

```
"This should be doable on either normal or hard as long as you're able to get
 a few theme pack specific gifts. Don't forget to use fusion and keyword refresh.

 WARNING: A fusion only counts as one gift, so fusing reduces your total number …"
```

**2인칭 조언 문투**다 — E.G.O 편 회차 5의 `notes`, 기프트 편 회차 4의
`md__universal_gifts.json` 과 같은 계열이다.

> **`limbus-assets` 가 게임 데이터와 도구 해설을 섞는 네 번째 사례**다
> (`extractable` · `notes` · 추천 묶음 · `tips`).

다만 여기는 **`showGifts` 처럼 렌더 지시까지 담는다.** 앞의 셋보다 도구 색이 짙다.

## 5. 두 시즌의 겹침

```
시즌 7 유일 id  93        시즌 6 유일 id  90
교집합 66 · 7에만 27 · 6에만 24
```

**약 70 %가 시즌을 넘겨 유지된다.** 시즌 7에만 있는 것은 `adv_no_lunar` ·
`cmb_10enemy` · `cmb_break2` 처럼 그 시즌 메카닉에 묶인 것들이다.

id 중복은 파일 안에서 **0건**이다.

---

## 우리는 읽지 않는다

업적 모델이 없다. **전량 미적재**다.

`tips` 가 도구 해설이므로 적재하더라도 `text` · `points` · `hardonly` 만 쓸 값이고,
`showGifts` 계열은 우리 화면에서 다시 만들어야 한다.

---

## 함정 요약

1. `__Season__` 이 **문자열**(`"7"`)이다. 정수가 아니다
2. `points` · `hardonly` 가 **정수/불리언이거나 배열**이다. 14건이 배열
3. `text` 에 **`[count]` 치환 자리**가 있다. `replace` 없이 쓰면 그대로 노출된다
4. `tips` 는 **게임 데이터가 아니다.** 편집자 공략이며 렌더 지시까지 담는다

## 미해결

없다. 2파일 183건 전부 확정했다.

## 근거 재현

```
data/entities/mirror-dungeon/limbus-assets/md__achievements.json        시즌 7 · 93건
data/entities/mirror-dungeon/limbus-assets/md__md6__achievements.json   시즌 6 · 90건
```
