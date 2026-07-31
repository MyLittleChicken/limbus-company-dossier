# 회차 4 — `loc-*/Bufs*.json`

> **버프 문자열** · 3로케일 × **43파일** · 유일 **1,496종**
> 출처 커밋 `774883d7` · 스냅샷 2026-07-25 · 정리 2026-07-31

## 파일 정체

회차 3의 `BattleKeywords*` 와 **짝을 이루는 파일**이다. 파일 접미가 같고
(`_Refraction2` · `-a1c9p3` · `-walpu6` …) 하나만 더 많다(43 vs 42).

```
키   id · name · desc(1,468) · summary(1,324) · undefined(844) · flavor(163)
     iconID(3) · iconId(1)
```

---

## 1. `BattleKeywords` 와 집합이 다르다

```
Bufs 1,496   BattleKeywords 1,409
Bufs 에만 115 · BK 에만 28 · 겹치는 1,381
```

**양쪽 다 상대에게 없는 것을 갖는다.** 합집합은 1,524종이다.

```
Bufs 에만   AaCfPaBa · AaCfPaBa_Alt1 · AaCfPbBg …     내부 코드형 id
BK 에만     Anger · Burn · Bleeding · AreaAtk · FullBloomRose_Amber …
```

**`BK 에만` 있는 것이 기본 기믹 이름**(`Burn` · `Bleeding`)이라는 게 눈에 띈다.

## 2. 겹치는 1,381종 중 **339건이 다르다**

```
값 완전 동일 1,042 / 1,381        다른 것 339
```

거울 던전 편 회차 7에서 본 `Bufs_Mirror*` ↔ `BattleKeywords_Mirror*` 관계가
**여기서는 훨씬 크게 갈린다.**

### 차이 ① — `{N}` 플레이스홀더

```
{N} 보유   Bufs 190 · BattleKeywords 14
```

```
ShardOfUmbrella
  Bufs  "턴 종료 시 {0}X5만큼 파열 얻음"
  BK    "턴 종료 시 수치당 5만큼 파열 얻음"
```

**`Bufs` 는 수치를 런타임에 끼우는 원형**이고, `BattleKeywords` 는 **사람이 읽도록
풀어 쓴 판**이다. 같은 뜻을 다른 목적으로 적었다.

`PinkRibbon_Ishmael` 처럼 `Bufs` 의 `summary` 가 `"속박 +{0}"` 인데
`BattleKeywords` 에는 `summary` 가 아예 없는 경우도 있다.

### 차이 ② — 문장 다듬기

```
PinkRibbon_Ishmael
  Bufs  "한 턴동안 공격 스킬의 코인을 사용할 때마다…"
  BK    "이번 턴 동안 공격 스킬의 코인을 사용할 때마다…"
```

`한 턴동안` → `이번 턴 동안`. **띄어쓰기까지 손본 개정판**이다.

## 3. 회차 1의 `"버프 이름"` 10건이 여기서 풀린다

회차 1에서 `limbus-assets/statuses.json` 의 `name` 이 `"버프 이름"` 플레이스홀더인
10건(`MRR5xx`)을 찾았다. 로케일 두 파일을 나란히 놓으면 **서로를 보완한다.**

| id | `Bufs` name | `Bufs` desc | `BattleKeywords` name | `BK` desc |
| --- | --- | ---: | --- | ---: |
| `MRR504` | **굴절된 호흡** | 0자 | `버프 이름` | 88자 |
| `MRR535` | **사생결단** | 0자 | `버프 이름` | 17자 |
| `MRR552` | **굴절된 투지** | 0자 | `버프 이름` | 50자 |
| `MRR554` | **사생결단** | 0자 | `버프 이름` | 19자 |
| `MRR514`·`519`·`531`·`538`·`540`·`541` | `버프 이름` | 0자 | `버프 이름` | 14–115자 |

```
Bufs            이름은 4건 제대로 · desc 는 10건 전부 비었다
BattleKeywords  이름은 10건 전부 플레이스홀더 · desc 는 10건 전부 있다
```

> **어느 한 파일로도 완전하지 않다.** 이름은 `Bufs`, 설명은 `BattleKeywords` 에서
> 가져와야 4건이 온전해지고, 나머지 6건은 **이름을 어디서도 얻지 못한다.**

`limbus-assets/statuses.json` 은 `BattleKeywords` 쪽을 따라가 10건 전부
플레이스홀더가 됐다.

## 4. `undefined` 844건 · `iconID` 오타

```
undefined  844건   (BattleKeywords 는 809건)
iconID       3건   ← 대문자 D
iconId       1건   ← 소문자 d
```

**같은 뜻의 키가 대소문자로 갈린다.** 4건뿐이라 영향은 없지만 원본 결함이다.

`flavor` 163건은 `BattleKeywords` 와 같은 수다.

---

## 함정 요약

1. `Bufs` 와 `BattleKeywords` 는 **집합도 값도 다르다**(115 · 28 · 339)
2. `Bufs` 의 `desc` 에 **`{0}` 플레이스홀더가 190건** 있다. 그대로 표시하면 안 된다
3. `MRR5xx` 10건은 **두 파일을 합쳐야** 4건이 온전해진다. 6건은 이름이 없다
4. `iconID` · `iconId` 가 **대소문자로 갈린다**
5. `undefined` 키가 844건 — 회차 3의 809건보다 많다

## 미해결

없다. 43파일 × 3로케일 전부 확정했다.

### 이월 확인 1건

- ✔ **회차 1** `"버프 이름"` 플레이스홀더 10건 — `Bufs` 가 4건의 진짜 이름을 갖는다.
  나머지 6건은 **어느 출처에도 이름이 없다**

## 근거 재현

```
data/entities/mechanics/loc-{ko,en,ja}/Bufs*.json              43파일 · 1,496종
data/entities/mechanics/loc-{ko,en,ja}/BattleKeywords*.json    42파일 · 1,409종
data/entities/mechanics/limbus-assets/statuses.json          1,472종 대조
```
