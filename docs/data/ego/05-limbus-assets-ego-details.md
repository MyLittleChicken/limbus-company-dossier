# 회차 5 — `ego-details/limbus-assets/{id}.json`

> **E.G.O 개별 상세** · `limbus-assets` · **110개 파일** · 924 KB · 최상위 키 **5종**
> 출처 커밋 `774883d7` · 스냅샷 2026-07-25 · 정리 2026-07-30

## 파일 정체

E.G.O 하나당 파일 하나다. 인격 편 회차 10(`identity-details`)과 같은 구조이며,
**스킬 수치와 패시브 원문이 여기에만 있다.**

```
최상위 키
  awakeningSkills   110      각성 스킬 그룹
  corrosionSkills    98      침식 스킬 그룹 (없는 12종 = 기본 ZAYIN)
  passiveList       110      패시브 113개
  notes             110      편집자 해설
  maxThreadspin       3      egos.json 과 중복
```

---

## 1. 회차 2의 질문이 닫힌다 — assets 가 더 갖는다

회차 2에서 "변환기가 `egos_detail.json` 을 안 읽는데 assets 가 같은 것을 갖는가" 를 미뤘다.

```
mj    egos_detail.awakeningSkill + corrosionSkill    208
assets ego-details 의 스킬 id 유일                    210
mj 에만 있는 것                                        0
assets 에만 있는 것                                    2
```

### 각성 스킬이 2개인 E.G.O 2종

| id | E.G.O | 스킬 |
| --- | --- | --- |
| `20608` | 오혈읍루 [汚血泣淚] (홍루) | `2060811` · **`2060812`** |
| `21209` | 눈부시지 않은 영광 (그레고르) | `2120911` · **`2120912`** |

**mj 는 이 2건을 담지 못한다.** `egos_detail.awakeningSkill` 이 단일 값이라 두 번째 스킬을
쓸 자리가 없고, `skills.json` 에도 `2060812`·`2120912` 자체가 없다.

회차 2의 갈림길에서 **"assets 도 갖는다" 쪽**으로 닫혔다. 더 정확히는 **assets 가 상위집합**이다.

## 2. 스킬 그룹 구조

```
awakeningSkills   그룹 1개 108건 · 2개 2건    (20608 · 21209)
corrosionSkills   그룹 0개  12건 · 1개 98건
그룹 type         awakening 112 · corrosion 98
```

그룹 키는 `type` · `bonusesEnabled` · `data`(+ `bonusNotes` 16건)다.
`bonusesEnabled` 는 **210 그룹 전부 `true`** — 상수다.

### `data` 항목 키 14종

| 키 | 건수 | 뜻 |
| --- | ---: | --- |
| `id` · `name` · `desc` · `uptie` | 640 | 모든 단계에 있다 |
| `coins` · `coinValue` | 592 | 코인 |
| `baseValue` | 335 | 기본 위력 |
| `atkWeight` | 292 | 공격 가중치 |
| `bonuses` | 281 | 환상 해석 보너스 |
| `levelCorrection` | 212 | 레벨 보정 |
| `affinity` · `atkType` · `defType` · `spCost` | 210 | **그룹당 1번**(1단계에만) |

`affinity`·`atkType`·`defType`·`spCost` 가 정확히 210 인 것은 그룹 수와 같다 —
**1단계 항목에만 적고 이후 단계는 생략한다.**

#### `spCost` 는 화면에서 로마 숫자 등급이 된다

원본은 정수(`20509` 착영휘도 = 20)인데 게임 상세는 **「정신 소모량 ⎯ Ⅳ」** 로 표시한다.
정수를 그대로 쓰지 않고 **등급으로 접는 변환이 화면 쪽에 있다.** 우리 화면은 아직
`spCost` 를 표시하지 않으므로 지금은 영향이 없다.

## 3. 환상 해석 단계는 1·3·4 다

```
스킬별 uptie 집합
  (1, 3, 4)      200개     ← 표준
  (1, 3, 4, 5)     6개     4번째 성냥불 3종의 각성·침식
  (1, 2, 3, 4)     4개     20209 명령 : 용해 · 20210 홍염살
```

> **2단계에는 보통 변화가 없다.** 그래서 항목 자체를 만들지 않는다.

예외 4건은 `20209`·`20210` 의 각성·침식 스킬이며, 그 2단계 항목은 **`bonuses` 만 갖는다**
(`desc`·`id`·`name`·`uptie`·`bonuses`). 위력이 아니라 보너스만 바뀐다는 뜻이다.

### mj 는 델타, assets 는 전량 기록

```
mj     skills.json level 집합   (1,3) 23 · (1,3,4) 179 · (1,3,4,5) 4 · (1,3,5) 2
assets ego-details uptie 집합   (1,3,4) 200 · (1,2,3,4) 4 · (1,3,4,5) 6
```

회차 3에서 남긴 「단계 표기 차이 27」의 답이다.

**mj 는 값이 바뀌지 않으면 단계를 적지 않는다.** `level 4` 가 없는 스킬이 25개이고
(`2010311` 소망석 각성 등), assets 는 같은 스킬에 4단계 항목을 두되 바뀐 키만 담는다.

**두 출처가 같은 사실을 다른 규칙으로 적었다.** 어느 쪽도 결손이 아니다.

## 4. `bonuses` — 환상 해석 보너스

인격 편에 없던 개념이다.

```json
{ "type": "final", "value": 4 }
{ "type": "damage", "value": 0.3, "extra": { "op": "mul" } }
{ "type": "damage", "value": 0.75, "extra": { "op": "mul", "type": "pride" } }
```

| 위치 | `type` |
| --- | --- |
| 스킬 | `damage` 176 · `atkweight` 134 · `base` 36 · `clash` 28 · `final` 26 |
| 코인 | `damage` 124 · `critdamage` 33 · `coin` 55 · `reuse` 21 · `final` 5 · `coin` 4 |

`extra` 는 4종뿐이다 — 없음 276 · `{op: mul}` 168 · `{cond: tolastcoin}` 3 ·
`{op: add}` 2 · `{cond: tolastcoin, op: mul}` 6.

`extra.type` 에 죄악 이름(`pride`)이 오면 **해당 죄악 공격에만 걸리는 보너스**다.

**적재** — 미적재. `Ego` 계열에 스킬 모델이 없다.

## 5. 코인은 두 종류다

```
coin type    normal 717 · unbreakable 194
```

`unbreakable`(부술 수 없는 코인)이 194개다. 인격 편 회차 10의 코인 구조와 같은 축이며,
E.G.O 쪽 비중이 훨씬 높다.

## 6. `passiveList` — 113개, mj 와 정확히 같다

```
passiveList 총 113        mj awakeningPassives 총 113
길이 1인 것 107 · 2인 것 3
```

2개를 갖는 3건이 **회차 2·3에서 나온 4번째 성냥불 3종**(`20102`·`20402`·`20902`)이다.
mj 의 `awakeningPassives` 길이와도 일치한다.

키는 `name` · `desc` 둘뿐이다. **영문만 있다** — 한국어는 회차 8(`loc-*/Passive_Ego.json`).

### `desc` 앞머리는 화면에서 헤더로 치환되는 동적 토큰이다

```
[AlwaysUseEGOPassive2050911]  →  "[검계 우두머리 뫼르소 전용 상시 효과]"
[WhenUseEGOPassive]           →  "[사용 효과]"
```

`20509` 착영휘도의 게임 화면에서 확인했다. **`AlwaysUseEGOPassive` 뒤에 패시브 id 가
붙는다** — 인격 편 회차 8·10의 토큰 치환표는 전부 고정 키였고, **id 를 접미로 갖는
동적 토큰은 이것이 처음**이다.

`[Token]` 을 표시명으로 바꿀 때 정확히 일치하는 키만 찾으면 이 토큰은 못 찾는다.
`substituteTokens`(`src/text.ts:216`)는 표에 없으면 원문을 남기고 리포트에 올리므로
깨지지는 않지만, **리포트에 계속 뜬다.**

위키가 뜻을 확인해준다 — 착영휘도는 "the **first identity to gain passive effects from an
EGO skill before that EGO skill is used**" 로, 장착만으로 발동하는 첫 사례다.

**적재** — `EgoPassive(egoId, index)` + `EgoPassiveText`(`src/entities/egos.ts`).
E.G.O 패시브가 **요약 파일에 없고 이 파일에만 있다**는 스키마 주석이 실측과 맞는다.

## 7. 조건부 기믹의 원문이 여기 있다

`docs/08-gimmick-keywords.md` 의 ② 조건부 축 3건 중 **E.G.O 조건 2건의 자연어 근거**다.

```
20109 엄숙한 애도 (이상)
  "This Identity counts as an \"Identity that inflicts [Vibration] and [Sinking]\""

20509 착영휘도 (뫼르소)
  "This Identity counts as an \"Identity that applies [Laceration] and [Breath]\""
```

`identity_keyword_modifiers.json` 의 구조 데이터와 정확히 대응한다.

| 인격 | 기믹 | 조건 | 이 파일의 문장 |
| --- | --- | --- | --- |
| `10110` (이상) | `Tremor` | E.G.O `20109` | inflicts [Vibration] and [Sinking] |
| `10508` (뫼르소) | `Bleed` | E.G.O `20509` | applies [Laceration] and [Breath] |
| `11009` (싱클레어) | `Tremor` | **기프트 `9282`** | — (E.G.O 가 아니므로 없다) |

**08 문서 5.1 의 "조인으로는 재현 불가" 결론은 유지된다** — 구조 데이터끼리의 차집합으로는
안 나온다. 다만 **텍스트에는 명시돼 있다.** 조건부 기믹을 자동 수집하려면 구조가 아니라
`passiveList[].desc` 를 읽어야 한다.

동사가 다른 것도 기록해 둔다 — 진동·침잠은 `inflicts`, 출혈·호흡은 `applies` 다.

## 8. `notes` — 편집자 해설이다

```
notes.main    110건 (전부)      리스트 길이 1–5
notes.other    18건             리스트 길이 1–2
```

**게임 원문이 아니라 `limbus-assets` 가 쓴 공략 설명**이다. 근거 셋이다.

**① 2인칭 조언 문투** — 게임 데이터는 독자에게 권하지 않는다.

```
20101 오감도   "Reduces enemy power for the rest of the turn, useful if Yi Sang
                clashes before the other sinners."
20304 평생 스튜 "Converts non-{keyword:Lust} resources into {keyword:Lust}.
                Careful when using this ego if you're lacking other E.G.O resources."
20509 착영휘도  "Use with {id:10508} to give it {st:Laceration} application and to
                unlock the maximum bonuses from this E.G.O."
```

`useful if you` · `Careful when` · `Use with` — **`{id:10508}` 로 특정 인격을 지목해
조합을 권한다.** 게임 클라이언트가 하지 않는 일이다.

**② 토큰 접두가 흔들린다** — 기계 생성이면 일어나지 않는다(9절).

**③ 같은 출처가 `extractable` 을 붙였다** — 회차 3에서 확인한 추출 시뮬레이터 필드와
같은 파일 계열이다. **도구 도메인을 데이터에 섞는 전례가 있다.**

### 토큰 표기가 이중화돼 있다

```
{status:…} 202   ↔   {st:…}  26
{keyword:…} 61   ↔   {kw:…}   4
{id:…}       5   ↔   {identity:…} 4 · {ego:…} 1 · {sinner:…} 3
```

같은 뜻에 접두가 둘 이상이다. 인격 편 회차 8·10의 토큰 치환표를 그대로 쓸 수 없다.

**적재** — 하지 않는다.

## 9. 대괄호 토큰 169종

`desc` 안의 `[Token]` 은 169종이다.

```
OnSucceedAttack 1251 · BeforeAttack 482 · Combustion 374 · EndSkill 349
Vibration 346 · CantIdentify 296 · Charge 289 · Laceration 260 · Breath 218
```

발동 시점(`OnSucceedAttack` · `BeforeAttack` · `EndSkill`)과 상태가 같은 문법으로 섞여 있다.
인격 편 회차 3의 코인 효과 문자열과 같은 구조다.

---

## 함정 요약

1. **`2060812` · `2120912` 는 mj 에 없다.** 각성 스킬이 2개인 E.G.O 가 2종 있다
2. 환상 해석 **2단계는 보통 항목이 없다.** 없는 것이 결손이 아니다
3. mj 와 assets 의 단계 기록 규칙이 다르다 — **델타 vs 전량**
4. `notes` 는 **게임 원문이 아니다.** 편집자 해설이며 토큰 표기가 흔들린다
5. `bonusesEnabled` 는 210 그룹 전부 `true` — **사실상 상수**다. `false` 표본이 없어
   무엇을 끄는 플래그인지 알 수 없고, `teamCodeEligible` 과 같이 의미를 두지 않는다
6. 조건부 기믹은 **구조가 아니라 텍스트에** 있다
7. `[AlwaysUseEGOPassive{패시브 id}]` 는 **동적 토큰**이다. 고정 키 치환표로는 안 잡힌다

## 미해결

없다. 110개 파일 전부 확정했다.

### 이월 질문 1건 해소

- ✔ **회차 2** `ego-details` 가 E.G.O 스킬을 갖는가 — **갖는다. 게다가 mj 보다 2건 많다**

## 근거 재현

```
data/entities/ego-details/limbus-assets/*.json                110개 · 최상위 5종
data/entities/egos/limbus-data-mj/egos_detail.json            208 대조
data/entities/identities/limbus-data-mj/skills.json           level 집합 대조
data/entities/identities/limbus-assets/identity_keyword_modifiers.json   조건부 3건
src/entities/egos.ts                                          passiveList 적재
prisma/schema.prisma  EgoPassive · EgoPassiveText
```
