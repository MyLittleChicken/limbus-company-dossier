# 회차 4 — `start_gifts.json` + `md__universal_gifts.json`

> **부속 소파일 2종** · `limbus-data-mj/start_gifts.json` 0.9 KB ·
> `limbus-assets/md__universal_gifts.json` 10 KB
> 출처 커밋 `774883d7` · 스냅샷 2026-07-25 · 정리 2026-07-31

성격이 다른 두 파일을 한 회차로 묶었다. 둘 다 **기존 기프트를 묶어 보여주는 목록**이며
새 기프트를 정의하지 않는다.

---

## 1. `limbus-data-mj/start_gifts.json` — 시작 기프트 30종

```
10개 항목 × { keyword, gifts[3] }  =  30건
```

| `keyword` | 기프트 3종 |
| --- | --- |
| `burn` | 지옥나비의 꿈 · 작열우모 · 울화통 |
| `bleed` | 상처붙이 · 작고 나쁠 인형 · 경외심 |
| `tremor` | 진동형 팔찌 · 잔향 · 시큼한 주향 |
| `rupture` | 가시 올가미 · 형광색 램프 · 유연 화약 |
| `sinking` | 적색 지령 · 녹아내린 시계태엽 · 장엄 |
| `poise` | 물부리 · 돌무덤 · 낡은 목각 인형 |
| `charge` | 사원증 · 휴대용 전지 소켓 · 순찰용 손전등 |
| `slash` | 꿈을 꾸는 전기양 · 짧은 케인 소드 · 결의 |
| `pierce` | 수집하는 해골 · 증명의 깃털 · 찢어진 밴돌리어 |
| `blunt` | 오늘의 표정 · 포켓 암기 노트 · 시간 굴레 |

### 규칙이 완벽하게 지켜진다

```
keyword 일치     30/30      전부 그 축의 기프트다
tier             30/30 이 "2"
중복             0
gifts.json 결손  0
```

**10종이 회차 1의 `keyword` 어휘와 정확히 같다** — 기믹 7 + 공격 타입 3.
`Keywordless` 는 시작 기프트가 없다.

거울 던전 시작 시 축을 고르면 주어지는 tier 2 기프트 3종이며, **`limbus-assets` 에는
이 목록이 없다.**

**적재** — 하지 않는다. `Gift` 에 「시작 기프트」 표시가 없다.

## 2. `limbus-assets/md__universal_gifts.json` — 추천 묶음

최상위 2종 — `individual` · `combo`. 구조가 **서로 다르다.**

```
individual  8그룹 · 라벨 없음 · 기프트 104종
combo       7그룹 · [id, 라벨] 쌍 · 기프트 110종
교집합 4종
```

### `individual` — 8그룹 중 **6그룹이 비어 있다**

| 그룹 | 섹션 | 기프트 |
| --- | ---: | ---: |
| Power & Clashing | 5 | 60 |
| Damage | 5 | 67 |
| **E.G.O Resources** | **0** | **0** |
| **HP or Mitigation** | **0** | **0** |
| **SP** | **0** | **0** |
| **Cost** | **0** | **0** |
| **Speed** | **0** | **0** |
| **Others** | **0** | **0** |

**제목만 있고 내용이 없다.** 작성 중인 문서를 그대로 담은 것으로 보인다.

채워진 2그룹의 섹션은 `General` · `Slash` · `Pierce` · `Blunt` · `Affinity Specific` 5종이다 —
공격 타입 3종이 축이고 기믹은 축이 아니다.

### `combo` — 기믹 7종 × (Enablers / Exploiters)

```
Burn 13 · Bleed 20 · Tremor 18 · Rupture 15 · Sinking 20 · Poise 25 · Charge 13
```

**공격 타입 3종이 없다.** `individual` 이 공격 타입으로 나누고 `combo` 가 기믹으로
나눈다 — 두 축을 나눠 담았다.

`Enablers`(축을 깔아주는 것)와 `Exploiters`(깔린 축을 활용하는 것)로 나뉘며,
항목마다 **발동 조건 라벨**이 붙는다.

```json
[9001, "Apply Burn\nWrath Res"]
[9251, "Offense Level\nAdditional Trigger"]
```

라벨은 회차 3의 `triggers`·`effects` 어휘와 겹치지만 **더 짧고 개행이 섞인 표시용**이다.

### 그룹 이름과 기프트 `keyword` 가 어긋나는 것이 9건

| 그룹 | 기프트 수 | `keyword` 분포 |
| --- | ---: | --- |
| Burn | 13 | burn 12 · **bleed 1** |
| Bleed | 20 | bleed 18 · **poise 2** |
| Tremor | 18 | tremor 17 · **sinking 1** |
| Rupture | 15 | rupture 13 · **bleed 2** |
| **Sinking** | 20 | sinking 20 |
| Poise | 25 | poise 22 · **slash 3** |
| **Charge** | 13 | charge 13 |

**오류가 아니다.** 「진동 축에 쓰는 침잠 기프트」처럼 **실제로 함께 쓰는 조합**을 담은
것이다. `keyword` 는 기프트 자신의 축이고 이 그룹은 **용도**다.

편집자가 손으로 고른 추천 묶음이며, 회차 3의 `notes` 와 같은 도구 도메인이다.

### 참조 무결성

```
참조 기프트 유일 210
gifts.json 에 없는 것 0
```

**적재** — 하지 않는다.

---

## 두 파일의 성격이 반대다

| | `start_gifts.json` | `md__universal_gifts.json` |
| --- | --- | --- |
| 출처 | `limbus-data-mj` | `limbus-assets` |
| 성격 | **게임 규칙** — 시작 시 실제로 주어진다 | **도구 해설** — 편집자 추천 |
| 축 | `keyword` 10종 그대로 | 공격 타입(individual) + 기믹(combo) |
| 규칙 준수 | 30/30 완벽 | **의도적으로 어긋난다**(9건) |
| 완성도 | 완결 | **6그룹이 비어 있다** |

`extractable`·`notes` 와 마찬가지로, **`limbus-assets` 는 게임 데이터와 도구 자산을
같은 파일 트리에 섞어 둔다.** 층을 구분해 읽어야 한다.

---

## 함정 요약

1. `md__universal_gifts.json` 의 **`individual` 6그룹이 비어 있다.** 미완성 문서다
2. `combo` 그룹 이름과 기프트 `keyword` 가 **9건 어긋난다.** 오류가 아니라 용도 분류다
3. `individual` 은 라벨이 없고 `combo` 만 `[id, 라벨]` 쌍이다. **같은 파일 안에서 구조가 다르다**
4. `start_gifts.json` 은 **mj 에만 있다.** assets 에 대응 파일이 없다

## 미해결

없다. 2파일 전부 확정했다.

## 근거 재현

```
data/entities/gifts/limbus-data-mj/start_gifts.json         10 × 3 = 30
data/entities/gifts/limbus-assets/md__universal_gifts.json  individual 8 + combo 7
data/entities/gifts/limbus-data-mj/gifts.json               keyword · tier 대조
data/entities/gifts/limbus-assets/gifts.json                참조 무결성
```
