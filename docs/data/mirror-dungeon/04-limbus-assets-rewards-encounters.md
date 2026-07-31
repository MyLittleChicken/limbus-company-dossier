# 회차 4 — `limbus-assets` 보상 2파일 + `encounters.json`

> `md__rewards.json` · `md__md6__rewards.json` 각 **100건** · 6.7 KB
> `encounters.json` 11 KB · 최상위 **5종**
> 출처 커밋 `774883d7` · 스냅샷 2026-07-25 · 정리 2026-07-31

---

## 1. 보상 — 주간 등급 1–100

```
키   "1" – "100"  (문자열)
값   { item, count }
```

두 시즌 파일이 **같은 구조에 100등급 전부**를 갖는다.

### 아이템 10종 · 분포가 같다

| 아이템 | 등급 수 | 총 개수 |
| --- | ---: | ---: |
| `Identity Training Ticket IV` | 34 | 170 / **140** |
| `Season N Uptie & Threadspinning only Shard (Universal)` | 30 | 150 |
| `Thread` | 20 | 400 |
| `Extraction Ticket` | 10 | 10 |
| 기념 배너 · 프로필 티켓 · 확정 추출권 등 | 1씩 | 1씩 |

**등급 수 분포(34·30·20·10·1×6)가 두 시즌 완전히 같다.** 시즌명만 갈아끼운 템플릿이다.

`Identity Training Ticket IV` 총합만 다르다 — 시즌 7 이 **170**, 시즌 6 이 **140**.

### 등급별 배치는 75건이 다르다

```
100등급 중 값이 다른 것 75
```

같은 아이템 집합을 **다른 순서로 배치**했다. 예를 들어 6·7·8등급이 시즌 7 에서는
`Ticket IV` → `Thread` → `Shard` 인데 시즌 6 은 `Thread` → `Ticket IV` → `Thread` 다.

### 「환상 해석」이 여기도 나온다

```
Season 7 Uptie & Threadspinning only Shard (Universal)
```

E.G.O 편 회차 3에서 확정한 어휘다 — **Uptie(동기화) + Threadspinning(환상 해석)**.
보상 아이템 이름이 두 축을 함께 부른다.

**미적재.** 보상 모델이 없다.

## 2. `encounters.json` — 인카운터 이름 사전

최상위가 **콘텐츠 5종**이다.

| 키 | 건수 | 뜻 |
| --- | ---: | --- |
| `story` | 113 | 본편 |
| `md` | **79** | 거울 던전 |
| `luxcavation` | 50 | 경험/증표 던전 |
| `reflectrial` · `rr` | 3 + 3 | 굴절 열차 |

값은 `키 → 표시명` 사전이다.

```
luxcavation   "18-pierce" → "Level 18 - Pierce"
md            "canto-1-1" → …
```

### 팩 편 회차 3의 `bossEncounters` 가 닫힌다

```
assets md_theme_packs 의 bossEncounters   "md|canto-1-1" 75종
encounters.json 의 md 키                             79종
교집합                                               75 / 75
```

**`md|` 접두를 떼면 정확히 이 사전의 키다.** 팩 편에서 "번호 체계가 다르다"고 남긴
관측이 여기서 풀린다 — 다른 체계가 아니라 **`콘텐츠|키` 형태의 복합 키**였다.

```
md_theme_packs   "md|canto-1-1"
                  ↑     ↑
                  콘텐츠  encounters.json 의 md 키
```

`md` 79종 중 4종은 어느 팩도 참조하지 않는다.

### 그래도 mj 쪽과는 여전히 안 맞는다

```
packs_detail 의 bossPool · battlePool …   7자리 숫자 2,525종
encounters.json                            문자열 키
```

**두 출처가 인카운터를 전혀 다른 방식으로 가리킨다.** mj 는 숫자 id, assets 는
사람이 읽는 키다. 이어주는 표가 아직 없다 — **인카운터 편에서 찾아야 한다.**

**미적재.**

---

## 함정 요약

1. 보상 키가 **문자열 `"1"`–`"100"`** 이다
2. 두 시즌 보상은 **아이템 분포가 같고 배치만 75건 다르다**. 템플릿이다
3. `bossEncounters` 는 **`콘텐츠|키` 복합 키**다. 세로줄로 쪼개야 한다
4. mj 의 7자리 숫자 인카운터 id 와 assets 의 문자열 키를 **잇는 표가 없다**

## 미해결

없다. 3파일 전부 확정했다.

### 이월 확인 1건

- ✔ **팩 편 회차 3** `bossEncounters` 의 `md|canto-1-1` 체계 — **`encounters.json` 의 md 키 75/75**

### 인카운터 편으로 넘기는 것 1건

- mj `bossPool`·`battlePool` (7자리 숫자 2,525종) ↔ assets 문자열 키 — 연결표 없음

## 근거 재현

```
data/entities/mirror-dungeon/limbus-assets/md__rewards.json        100등급
data/entities/mirror-dungeon/limbus-assets/md__md6__rewards.json   100등급 · 75건 배치 차이
data/entities/mirror-dungeon/limbus-assets/encounters.json         5콘텐츠 · md 79종
data/entities/packs/limbus-assets/md_theme_packs.json              bossEncounters 75/75
data/entities/packs/limbus-data-mj/packs_detail.json               숫자 id 2,525종
```
