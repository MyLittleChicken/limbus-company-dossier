# 회차 10 — `identity-details/{id}.json` 184 + 163개

> **스킬 수치·코인·패시브 정의의 정본** · 동형 파일 묶음
> `limbus-assets` 184개 · 총 2.53 MB · 평균 14 KB · 최상위 키 **7종**
> `shared-library` 163개 (구버전 보강)
> 출처 커밋 `774883d7` · `2b0bfb6b` · 스냅샷 2026-07-25 · 정리 2026-07-30

## 파일 정체

**인격 편에서 가장 무거운 회차다.** 회차 2·3·4·6·7에서 미룬 질문 5건이 여기 모여 있고
전부 여기서 닫힌다.

```
최상위 키 7종
  skills            184/184    스킬 수치·코인의 정본 — 824건
  passiveData       184/184    패시브 정의 (전투 + 지원) — 590건
  combatPassives    184/184    전투 패시브 목록 (회차 4에서 확인)
  supportPassives   184/184    지원 패시브 목록 (회차 8에서 확인)
  notes             184/184    사람이 쓴 운용 설명 — 698항목
  passiveBonuses    108/184    패시브를 수치로 환산 — 242항목
  passiveBonusNotes  11/184    그 수치의 계산 가정
```

**뒤 셋은 게임 데이터가 아니다.** `eldritchtools` 가 만든 저작 데이터다.

### 대조한 출처

| 출처 | 무엇을 대조했나 |
| --- | --- |
| `limbus-data-mj/skills.json` | `sinFrom` 131건 ↔ `affinity: "none"` · `skillTier` 적재값 |
| `limbus-data-mj/passives.json` | 인격 패시브 596 ↔ `passiveData` 590 |
| `limbus-data-mj/identities_detail.json` | `attackSkills`·`defenseSkills` 참조 12건 |
| `limbus-assets/identities.json` | `1041206` 의 `tier` |
| `identity-details/shared-library/{id}.json` | 삭제된 스킬 6건 회수 |
| `src/entities/skills.ts` | 변환 경로 |

---

## `skills` — 스킬 수치의 정본

| | |
| --- | --- |
| 스킬 수 | **824건** (인격 스킬만. E.G.O 스킬 없음) |
| `bonusesEnabled` | **824/824 전부 `true`** — 분산 0 |
| `data` 배열 길이 | 1:27 · 2:409 · 3:25 · 4:363 |
| `uptie` | 1:590 · 2:386 · 3:613 · 4:783 |
| 변환 | `collect(details, 'canonical')` → `skill` · `skill_stage` · `skill_coin` (`skills.ts:216`) |
| 적재 | `skill` · `skill_stage` · `skill_coin` · `skill_stage_text` · `skill_coin_text` |
| 화면 | `components/uptie-skills.tsx` |

### 단계 키 15종 — 델타 구조다

필드가 성기게 나타나는 것이 곧 델타의 증거다.

```
2372  iconId · id · uptie                모든 단계
2369  desc · name
1823  coinValue · coins
1307  baseValue
1064  bonuses
 957  affinity
 824  atkWeight · defType · levelCorrection      스킬 수와 정확히 같다 = 1단계에만
 687  atkType
  52  clashable
```

`atkWeight`·`defType`·`levelCorrection` 이 **정확히 824** — **1단계에만 있고 이후 이월된다.**
변환이 `merged = { ...merged, ...delta }` 로 앞 단계부터 병합하는 이유다(`skills.ts:305`).

코인 키는 `type`(4,030) · `descs`(3,323) · `bonuses`(418) 셋이다.

### `affinity: "none"` 131건 = mj `sinFrom` 131건

**회차 3의 질문이 닫혔다.**

```
affinity="none" 인 스킬   131종 · 항목 131건 · 전부 uptie 1
mj sinFrom 보유          131종
두 집합 완전 동일          차집합 양쪽 0
```

단계별로 보면 뜻이 분명하다.

```
1010104 "가드"
  uptie1  affinity = "none"      죄악이 없다
  uptie4  affinity = "gloom"     우울이 붙는다
```

**같은 사실을 다르게 적었다.**

| 출처 | 적는 방식 |
| --- | --- |
| mj `sinFrom: 4` | **바뀌는 단계**를 적는다 |
| assets `affinity: "none"` | **바뀌기 전 값**을 적는다 |

**회차 3에서 남긴 우려가 맞았다.** 변환이 `base.affinity !== 'none' ? … : null` 로 1단계를
담으므로, `skill.affinity` 가 `null` 인 것은 "죄악이 없다"가 아니라 **"1단계에는 없다"** 다.
수비·회피 스킬 131건이 여기 해당한다.

### `1041206` 의 `tier` — 적재값은 mj 것이다

**회차 3의 질문이 닫혔다.**

```
identity-details 의 data 단계에 tier 필드가 없다      (15종 어디에도)
assets identities.json    tier = 4                  ← 이 파일만 4를 말한다
mj skills.json            skillTier = 3
변환 skills.ts:279        meta.skillTier ?? 1        = mj 값
```

**적재값은 `3`** 이다. `identities.json` 의 `4` 는 어디에도 쓰이지 않는다.
회차 3의 우려("적재값이 4일 가능성")는 **틀렸다.**

### 누락 스킬 12건 — ADR-04 2.3의 근거

**회차 2·7의 질문이 닫혔다.**

```
identity-details 의 skills 에 없는 mj 스킬   12건 / 인격 9종

shared-library 에서 건진 것 (6건)
  10212 흑수-묘 필두       1021207
  10306 중지 작은 아우      1030605
  10710 와일드헌트         1071006
  10712 흑운회 와카슈       1071205
  11012 중지 작은 아우      1101205 · 1101206

shared-library 파일 자체가 없는 인격 (6건)
  10715 중지 작은 형님      1071506 · 1071507
  10814 거미집 중지 제자     1081405
  11115 거미집 중지 아비     1111510 · 1111511
  11216 새벽 사무소 대표     1121607
```

**ADR-04 2.3의 "스킬 정의 6종"이 앞의 6건이다.** 구버전에서 수치까지 갖춰 건졌다.
나머지 6건은 **어디에도 없다** — 회차 3의 `levels` 빈 배열 9건 중 6건이며,
`'스킬 수치가 어느 출처에도 없음(분류만 적재)'` note 가 남는다.

**회차 7의 서술을 정밀화한다.** "최소 2건은 삭제"라 했는데 정확히는 이렇다.

| 갈래 | 건수 | 성격 |
| --- | --- | --- |
| 삭제 | 6 | 구버전에 있었고 현행에서 사라졌다. mj는 유지 |
| 신규 미수록 | 6 | `shared-library` 에 인격 파일 자체가 없다(시즌 7 계열) |

---

## `passiveData` — 패시브 정의

| | |
| --- | --- |
| 총 | **590건** · 유일 id 590 |
| 파일당 | 2:68 · 3:47 · 4:42 · 5:22 · 6:2 · 7:1 · 8:2 |
| 키 | `desc` 590 · `name` 590 · `condition` **485** |
| `condition.type` | `owned` 339 · `res` 146 · **없음 105** |
| 변환 | `passive.condType` · `passive_requirement` (`skills.ts:386`) |
| 적재 | `passive` · `passive_requirement` · `passive_text` |
| 화면 | 상세 "패시브" 패널 |

**전투와 지원 패시브를 한 객체에 담는다.** 회차 8의 `passives.json` 에는 `support` 절만
있었으므로, **전투 패시브 정의는 이 파일이 유일한 출처**다.

### mj 596과의 차이가 정확히 6건 — 유령의 최종 확인

```
passiveData 유일 id  590
mj 인격 패시브        596

mj 에만       1011003 · 1021202 · 1031102 · 1050803 · 1051102 · 1100903
details 에만  없음
```

**회차 4의 유령 6건이 여기서 최종 확인된다.** 변환의 세 조건 중 첫 번째
("정본 `passiveData` 에 정의가 없다")의 근거가 이 파일이다.

### 조건 분포 — 전투가 조건 없는 쪽에 몰린다

회차 8의 `support` 절과 합쳐 계산하면 이렇게 갈린다.

```
전체 590   owned 339 · res 146 · 없음 105
서포트 214  owned 142 · res  71 · 없음   1        ← 회차 8
전투  376  owned 197 · res  75 · 없음 104        ← 차집합
```

**전투 패시브 376건 중 104건이 조건 없이 발동한다.** 회차 4의 `cost` 없는 110건과 근사하다.

---

## 저작 데이터 3종 — 게임 원본이 아니다

`eldritchtools` 가 도구를 위해 만든 것이다. 우리 파이프라인은 쓰지 않으며, 쓰려면
출처 표기가 필요하다(`03-data-provenance.md` 관할).

### `notes` 184/184 · 총 698항목

```
usage  184    "Have him lose clashes on his S3 to trigger a much stronger skill with 4 coins,
               {status:Paralysis} application, Atk Weight and damage bonuses from his
               {status:Breath} stacks…"
other  132    "Support passive heals SP for an ally who lost SP during the turn,
               which is useful for E.G.O spamming in MD."
main     2
```

**사람이 쓴 운용 설명**이다. `{status:Sinking}` 같은 **자체 토큰 문법**을 쓰며, 우리
치환표(`skill_tags` + `terms`)와 다른 체계다.

`usage` 가 184/184 인 것이 눈에 띈다 — **모든 인격에 운용 해설이 있다.**

### `passiveBonuses` 108/184 · 242항목

```
type   damage:128 · offlevel:27 · clash:25 · base:18 · final:15 ·
       coin:10 · critdamage:10 · deflevel:7 · skilllevel:2
키     type · value · extra{ op, skillId, cond, type }

10103 검계 살수         [{ type:"coin", value:3 }]
10104 개화 E.G.O:: 동백  [{ type:"damage", value:0.3, extra:{ op:"mul", skillId:1010402 } }]
10113 N사 E.G.O:: 흉탄   [{ type:"critdamage", value:0.18 }]
```

**패시브 효과를 수치로 환산한 것**이다. `extra.op: "mul"` 처럼 연산까지 담아 딜 계산기에
바로 넣을 수 있게 했다.

스킬 단계와 코인 안에도 같은 `bonuses` 구조가 있다.

```
스킬 단계   coin:757 · damage:387 · clash:197 · final:160 · base:115 ·
            atkweight:67 · skilllevel:42 · critdamage:31 · typeconverteddamage:30
코인        damage:305 · critdamage:94 · reuse:93
```

**`bonusesEnabled` 가 824/824 `true`** 인 것은 이 계산 체계를 전 스킬에 켜두었다는 뜻이다.

### `passiveBonusNotes` 11/184

```
10215 거미집 약지 제자    "Includes Somatic Frisson-inspiring Melody."
10216 새벽 사무소 해결사   "Assumes max stacks of Dawn Office from Dawn Office Rep. Gregor"
10310 라만차랜드 실장     "Ignores Responsibility."
10716 거미집 엄지 제자     "Assumes max The Duel Escalates + Maturing Textbook"
10916 거미집 엄지 아비     "Assumes max Accelerating Future, attacking Game Target,
                        and target has shield"
11009 새벽 사무소 해결사   "Assumes max stacks … Assumes both other Dawn Office identities
                        are present and alive."
11115 거미집 중지 아비     "Includes Avenging My Family and fully unlocked sword."
11216 새벽 사무소 대표     "Assumes max stacks of Dawn Office."
```

**`passiveBonuses` 수치가 어떤 가정 아래 계산됐는지 적은 주석**이다.
11건 모두 **조건부 강화가 복잡한 최신 인격**이며, 회차 1·6·7에서 계속 나온 그 인격들이다.

---

## 함정 요약

1. **`affinity: "none"` 은 "죄악 없음"이 아니라 "1단계에 없음"** 이다. mj `sinFrom` 과 같은 사실
2. `atkWeight`·`defType`·`levelCorrection` 이 **1단계에만** 있다. 이월하지 않으면 사라진다
3. `tier` 필드가 **이 파일에 없다.** `identities.json` 의 `1041206` tier 4 는 적재되지 않는다
4. 누락 스킬 12건은 **삭제 6 + 신규 미수록 6** 이다. 앞 6건만 구버전에서 건진다
5. `passiveData` 가 **전투 패시브 정의의 유일한 출처**다
6. `notes`·`passiveBonuses`·`passiveBonusNotes` 는 **게임 데이터가 아니라 저작물**이다
7. `notes` 가 `{status:X}` 자체 토큰 문법을 쓴다 — 우리 치환표와 다른 체계

## 미해결

없다. 7항목 전부 확정했다.

### 이월 질문 5건 전부 해소

- ✔ **회차 3** `"none"` 131건 ↔ `sinFrom` 131건 — 두 집합 완전 동일. 같은 사실의 다른 표현
- ✔ **회차 3** `1041206` 의 `tier` 적재값 — mj의 `3`. 이 파일에 `tier` 필드가 없다
- ✔ **회차 2·7** 누락 스킬 12건의 정체 — 삭제 6(구버전에서 회수) + 신규 미수록 6
- ✔ **회차 4** 유령 6건이 정본에 없다는 근거 — `passiveData` 590 = mj 596 − 6
- ✔ **회차 8** 전투 패시브 정의의 위치 — `passiveData` 가 전투+지원 590건을 함께 담는다

### 다음 회차로 넘긴 것

- → **회차 12** 코인 `descs` 의 한국어. 이 파일은 영문뿐이다
- → **회차 14** `iconId` 와 애셋 경로의 대응

## 근거 재현

```
data/entities/identity-details/limbus-assets/{id}.json    184개 · 스킬 824 · 패시브 590
data/entities/identity-details/shared-library/{id}.json   163개 · 삭제 스킬 6건 회수
data/entities/identities/limbus-data-mj/skills.json       sinFrom · skillTier 대조
data/entities/identities/limbus-data-mj/passives.json     인격 패시브 596 대조
data/entities/identities/limbus-data-mj/identities_detail.json  스킬 참조 12건
data/entities/identities/limbus-assets/identities.json    1041206 tier
src/entities/skills.ts:216 · :279 · :305 · :386           변환 경로
```
