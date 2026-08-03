# E.G.O — 위키 조사로 판정한 미확정 5건

조사일 2026-08-03. 주 출처는 `limbuscompany.wiki.gg`(영문 공식 팬위키). 이 위키는 E.G.O 문서를
`{{EGPage}}` 템플릿의 정형 필드(`askill` / `cskill` / `coin` / `spower` / `cpower` / `atkmod` / `atkweight` /
`asanity` / `csanity` / `<sin>cost`)로 싣기 때문에, 렌더된 HTML 이 아니라 **원본 위키텍스트**(`?action=raw`)를
직접 받아 대조했다. 아래 인용은 전부 그 원문이다.

> 주의 — wiki.gg 는 `action=raw` 에 rate limit 이 있다. 연속 조회 시 `{"error":{"code":"ratelimited"}}` 가
> 본문 대신 돌아오므로, 빈 결과를 "문서 없음"으로 오독하지 않도록 20초 이상 간격을 두어야 한다.

---

### 1. 연출 전용 E.G.O 의 스킬 귀속

**판정** 확정 — 감사자의 오귀속 판단이 맞다.

**답** 문제의 5종은 위키에서 각성 스킬이 **1개**뿐이고, 대조군 2종은 **2개**로 확인된다. canonical 의 여분 5건
(`2010112` · `2030112` · `2050112` · `2060112` · `2110112`)은 기본 E.G.O 에 붙어서는 안 된다.

**근거**

wiki.gg 의 E.G.O 문서는 각성 스킬을 `|askill=`(Threadspin 4단계) · `|askill3=`(3단계) · `|askill2=`(2단계)
세 필드로 싣는다. 각 필드 안의 `{{Skill}}` 템플릿 **개수**가 그 E.G.O 의 각성 스킬 수다.

| E.G.O | 위키 `askill` 안의 `{{Skill}}` | 스킬명 | `cskill` | URL |
| --- | --- | --- | --- | --- |
| 20101 오감도 | **1** | `Crow's Eye View` | 없음 | https://limbuscompany.wiki.gg/wiki/Crow%27s_Eye_View_Yi_Sang |
| 20301 라 샹그레 데 산쵸 | **1** | `La Sangre de Sancho` | 없음 | https://limbuscompany.wiki.gg/wiki/La_Sangre_de_Sancho_Don_Quixote |
| 20501 타인의 사슬 | **1** | `Chains of Others` | 없음 | https://limbuscompany.wiki.gg/wiki/Chains_of_Others_Meursault |
| 20601 허환경 | **1** | `Land of Illusion` | 없음 | https://limbuscompany.wiki.gg/wiki/Land_of_Illusion_Hong_Lu |
| 21101 토 파토스 마토스 | **1** | `To Páthos Máthos` | 없음 | https://limbuscompany.wiki.gg/wiki/To_P%C3%A1thos_M%C3%A1thos_Outis |
| **20608 오혈읍루** (대조군) | **2** | `… - Inception ['''始''']` / `… - The End ['''終''']` | 1 | https://limbuscompany.wiki.gg/wiki/Tears_of_the_Tarnished_Blood_%E6%B1%9A%E8%A1%80%E6%B3%A3%E6%B7%9A_Hong_Lu |
| **21209 눈부시지 않은 영광** (대조군) | **2** | `… - Flowing` / `… - Incandescence` | 1 | https://limbuscompany.wiki.gg/wiki/Unbrilliant_Glory_Gregor |

원문 인용 (20101, `Crow's_Eye_View_Yi_Sang?action=raw`) — `askill` 이 하나의 `{{Skill}}` 로 끝난다:

```
<!--Awakening Skill-->
|askill={{Skill
|sin=Sloth
|name=Crow's Eye View
|type=Pierce
...
|ce1={{SkillCon|On Hit}} Inflict 2 {{StatusEffect|Attack Power Down|d}} ...
}}
<!--Passive-->
|passive={{Passive|Silence|...}}
```

원문 인용 (21209, `Unbrilliant_Glory_Gregor?action=raw`) — `askill` 안에 `<tabber>` 로 두 스킬이 들어 있다:

```
|askill=
<tabber>
|-| Flowing = {{Skill
|name=Unbrilliant Glory - Flowing
|spower=5
|cpower=+ 5
|coin=1
...
|-| Incandescence = {{Skill
|name=Unbrilliant Glory - Incandescence
|spower=10
|cpower=+ 5
|coin=1
...
</tabber>
```

원문 인용 (20608) — 같은 `<tabber>` 구조로 `Inception ['''始''']` / `The End ['''終''']` 2개.

**우리 데이터**

```
20101 | 2010111 awakening ordinal 0 | uptie 1,3,4
20101 | 2010112 awakening ordinal 1 | uptie 4        ← 위키에 없음
20301 | 2030112 · 20501 | 2050112 · 20601 | 2060112 · 21101 | 2110112   ← 전부 uptie 4 뿐, 위키에 없음
20608 | 2060811(1,3,4) · 2060812(1,3,4) · 2060821 corrosion             ← 위키와 일치
21209 | 2120911(1,3,4) · 2120912(1,3,4) · 2120921 corrosion             ← 위키와 일치
```

**추가 확증 — 원본 안에 이미 정답이 있다.**
`data/entities/ego-details/limbus-assets/*.json` 의 `awakeningSkills[].data[].id` 집합이 위키와 **완전히 일치**한다:

```
20101 awakening ['2010111']              corrosion []
20301 awakening ['2030111']              corrosion []
20501 awakening ['2050111']              corrosion []
20601 awakening ['2060111']              corrosion []
21101 awakening ['2110111']              corrosion []
20608 awakening ['2060811','2060812']    corrosion ['2060821']
21209 awakening ['2120911','2120912']    corrosion ['2120921']
21206 awakening ['2120611']              corrosion ['2120621']
```

반면 `egos/limbus-data-mj/egos_detail.json` 의 `awakeningSkill` 은 **스칼라 1개**라서 20608·21209 의
진짜 두 번째 각성 스킬을 표현하지 못한다(`21209 → awakeningSkill: 2120911` 만 있음).
ETL 이 loc 접두 스캔이라는 우회로를 만든 이유가 이것이고, 그 우회로가 연출 전용 5건을 잘못 끌어온다.

**조치**

1. `src/v2/canonical/egos.ts` 의 loc 접두 스캔
   (`if (skillId.startsWith(id) && skillId.length === id.length + 2)`)을 버리고,
   각성 스킬 id 집합을 **`ego-details` 의 `awakeningSkills[].data[].id`** 에서 받는다.
   `ego-details` 는 limbus-assets 110건 + shared-library 105건으로 플레이 E.G.O 110종을 모두 덮는다.
2. 이행 전 임시 방편이 필요하면 "uptie 1 이 없고(=4 뿐) 이름이 첫 각성 스킬과 동일" 조건으로 5건만 배제한다.
3. 떨어져 나온 `2010112` 등 5건을 `201011`·`203011`·`205011`·`206011`·`211011`(연출 전용)에 붙일지는
   별도 판단이다. 위키는 연출 전용 E.G.O 를 문서화하지 않으므로 **귀속처는 위키로 불가**.
   확실한 것은 "기본 E.G.O 에 붙어서는 안 된다"까지다. 안전한 선택은 `presentation_only` E.G.O 에 붙이고
   소비 쿼리에서 `presentation_only=false` 로 거르는 것.

---

### 2. 침식 확률표가 전 E.G.O 공통인가

**판정** 확정 — 공통 규칙이다. 330행을 상수 3행으로 접어도 된다.

**답** 침식 확률은 E.G.O 별 값이 아니라 **E.G.O 사용 후 SP 값에 대한 전역 표**다. 위키는 이 표를 E.G.O 문서가
아니라 `E.G.O/Gameplay` 총론 문서에 **딱 한 번** 싣고, 개별 E.G.O 문서에는 확률 필드 자체가 없다.

**근거** — https://limbuscompany.wiki.gg/wiki/E.G.O/Gameplay (`?action=raw`)

```
Using E.G.O without the required amount of Sanity has a chance of leading to the Awakening Skill
being replaced by its Corrosion variant. ... However, Sinners will have a chance of corroding
whenever their Sanity is in the negatives, not just at -45 SP. This chance is listed as a
percentage beneath the Sanity requirement.
{| class="wikitable" style="text-align:center"
! SP After E.G.O   ! Chance to Corrode
| 0 to -22 SP      | 0%
| -23 to -33 SP    | 25%
| -34 to -44 SP    | 75%
| -45 SP and lower | 100%
|}
```

보강 — https://limbuscompany.wiki.gg/wiki/Sanity (`?action=raw`):
`"Sanity ... has a valid range of [-45, 45]."`

개별 E.G.O 문서(`{{EGPage}}`)에는 `asanity` / `csanity`(SP 소모량)만 있고 **침식 확률 파라미터가 존재하지 않는다.**
실제로 조회한 6개 E.G.O 문서 전문에서 확률 관련 표기는 0건이다(스킬 효과의 `+30% damage` 류만 검출).
그림 캡션 `"Sinclair's "Hex Nail" E.G.O with a 75% chance of Corroding."` 도 E.G.O 고유값이 아니라
그 시점 SP 에서 계산된 값임을 위 표가 말한다.

**우리 데이터**

`canonical.ego_corrosion` 330행 = 110종 × 3행, 값은 전 종 동일. 원본
`egos/limbus-data-mj/egos_detail.json` 이 E.G.O 마다 같은 배열을 되풀이한다:

```json
"corrosion": [{"section":0.5,"probability":0.25},
              {"section":0.25,"probability":0.75},
              {"section":0,"probability":1.0}]
```

**⚠ `section` 해석 정정 (중요)**

지시서에 배경 지식으로 주어진 "`section` 은 [-45,+45]→[0,1] 정규화이므로 0.5 = SP 0 에서 25 %"는
**위키 표와 모순된다.** 위키는 SP 0 에서 0 % 라고 명시한다.

`section` 을 **음수 SP 구간 [-45, 0] → [0, 1]** 정규화(즉 `SP = -45 × (1 - section)`)로 읽으면
위키 표와 경계까지 정확히 맞는다:

| section | 그 해석의 SP | 우리 probability | 위키 구간 |
| --- | --- | --- | --- |
| 0 | −45 | 1.00 | `-45 SP and lower → 100%` ✅ |
| 0.25 | −33.75 | 0.75 | `-34 to -44 SP → 75%` ✅ (경계 −33.75 → −34) |
| 0.5 | −22.5 | 0.25 | `-23 to -33 SP → 25%` ✅ (경계 −22.5 → −23) |
| (없음) | −22.5 초과 | — | `0 to -22 SP → 0%` ✅ (그래서 4번째 행이 없다) |

[-45,+45] 해석이면 0.25 가 SP −22.5 → 75 % 여야 하는데 위키는 그 구간을 25 % 라 한다. 따라서
**[-45, 0] 해석이 맞고, 표에 행이 3개뿐인 것도 "−22.5 위쪽은 0 %"로 자연히 설명된다.**

**조치**

- `ego_corrosion` 330행 → 상수 3행(또는 코드 상수)으로 접는다. per-E.G.O 정보량 0 이 위키로 확인됐다.
- 접을 때 `section` 의 의미를 스키마 주석에 못 박는다: `SP = -45 * (1 - section)`, 즉 "이 SP 이하일 때 이 확률".
- 화면에 침식 확률을 띄우려면 E.G.O 의 `asanity`(SP 소모)와 현재 SP 로 사후 SP 를 구해 이 표를 찾는다.
  E.G.O 마다 다른 것은 확률이 아니라 **SP 소모량**이다.

---

### 3. 코인이 없는 E.G.O 스킬이 실재하는가

**판정** 확정 — 실재하지 않는다. 코인은 **1개**이고 우리 ETL 이 잃었다.

**답** `2120611`(Bygone Days)과 `2120911`(Unbrilliant Glory - Flowing) 모두 위키에서 `coin=1` 이다.
두 스킬은 "코인 효과 텍스트가 없는 코인 1개"를 가진 스킬이지 코인 0개 스킬이 아니다.

**근거**

`Bygone_Days_Gregor?action=raw` — 각성/침식 모두 `coin=1`:

```
|askill={{Skill
|sin=Gloom
|name=Bygone Days
|type=Pierce
|spower=20
|cpower=+ 4
|coin=1
|atkmod=-3
|atkweight=1
|se={{SkillCon|Attack End}} Heal 15 SP to self and 2 other allies with the least SP ...
}}          ← ce1(코인 효과) 필드 자체가 없다
|cskill={{Skill
|name=Bygone Days
|type=Blunt
|spower=27
|cpower=- 8
|coin=1
...
```

`Unbrilliant_Glory_Gregor?action=raw` — `Flowing` 은 `coin=1` 이고 `ce1` 이 없다:

```
|-| Flowing = {{Skill
|name=Unbrilliant Glory - Flowing
|spower=5
|cpower=+ 5
|coin=1
|atkmod=+0
|atkweight=1
|se={{SkillCon|Unclashable}} <br> ... This Skill does not hit an enemy, does not trigger Defense
Skills ... {{SkillCon|Attack End}} Heal 25 SP ...
}}
```

즉 두 스킬 다 **"공격하지 않는/효과가 스킬 본문에 몰린" 설계**라서 코인에 붙일 효과 문구가 없을 뿐,
코인 슬롯은 1개 존재한다.

원본도 같은 말을 한다 — `ego-details/limbus-assets/21206.json`:
`"coins": [{"type": "normal"}]` (descs 키 자체가 없음), `21209.json` 의 `2120911`:
`"coins": [{"type":"normal"}]`, 반면 `2120912` 는 `"coins":[{"type":"unbreakable", descs 6~7개}]`.

**우리 데이터**

```
2120611 uptie 1/3/4 → 코인 0개
2120911 uptie 1/3/4 → 코인 0개
2120912 uptie 1/3/4 → 코인 1개   (정상)
2120921 uptie 1/3/4 → 코인 4개   (정상, 위키 cskill coin=4 와 일치)
```

**조치**

`src/v2/canonical/egos.ts` `pushSkillStages()` 의 `if (effects.length === 0) return;` 를 제거하고
빈 `effects`(빈 배열)로 코인 행을 남긴다. 소비 측은 `effects = '{}'` 를 "효과 문구 없음"으로 읽으면 된다.
현재는 `effects NULL 0건 · 빈 배열 0건`이 오히려 이 손실을 감추고 있다.
영향 범위는 감사에 적힌 9스테이지(`2010511/u1` · `2020811/u1` · `2020821/u1` · `2120611/u1,u3,u4` · `2120911/u1,u3,u4`).
코인 수는 클래시 계산 입력이므로 추천 엔진에 직결된다.

---

### 4. 위키가 E.G.O 스킬 수치를 표로 제공하는가 (원본 검증용)

**판정** 확정 — 제공한다. 그리고 우리 원본(`ego-details`)은 표본 3종에서 **불일치 0건**이다.
(canonical 이 이 수치를 실을지 말지는 제품 판단이라 여기서 판정하지 않는다.)

**답** wiki.gg 의 `{{EGPage}}` 는 각성/침식 스킬을 Threadspin 단계별로 전부 싣고, 필드는
`spower`(위력) · `cpower`(코인 위력) · `coin`(코인 수) · `atkmod`(레벨 보정) · `atkweight`(공격 가중치) ·
`type`(공격 타입) · `sin`(죄악) · `asanity`/`csanity`(SP 소모) · `se`(스킬 효과) · `ce1..n`(코인별 효과)다.
우리 `ego-details` 의 `baseValue` · `coinValue` · `coins[]` · `levelCorrection` · `atkWeight` ·
`atkType` · `affinity` · `spCost` · `desc` · `coins[].descs` 와 **1:1 대응**한다.

**표본 대조 1 — 20101 오감도 / Crow's Eye View (Yi Sang, ZAYIN)**

| 항목 | 우리 원본 `ego-details/20101.json` | wiki.gg | 판정 |
| --- | --- | --- | --- |
| SP 소모 | `spCost 10` | `asanity=10` | 일치 |
| 죄악 자원 | (mj `CRIMSON 1 · AMBER 3`) | `wrathcost=1` · `slothcost=3` | 일치 |
| 공격 타입/죄악 | `atkType pierce` · `affinity sloth` | `type=Pierce` · `sin=Sloth` | 일치 |
| uptie 1 위력 | `baseValue 14` | `askill2 spower=14` | 일치 |
| uptie 3 위력 | `baseValue 18` | `askill3 spower=18` | 일치 |
| uptie 4 위력 | (변화 없음 → 18) | `askill spower=18` | 일치 |
| 코인 위력 | `coinValue 6` | `cpower=+ 6` | 일치 |
| 레벨 보정 | `levelCorrection -4` | `atkmod=-4` | 일치 |
| 공격 가중치 | `atkWeight 1` | `atkweight=1` | 일치 |
| 코인 수 | `coins` 1개 (`type normal`) | `coin=1` | 일치 |
| uptie 1 코인 효과 | `[OnSucceedAttackHead] Inflict 2 [Reduction]` / `Apply 1 [Agility]` | `[Heads Hit] Inflict 2 Attack Power Down` / `Apply 1 Haste` | 일치(어휘만 내부코드↔UI) |
| uptie 4 코인 효과 | 3줄 (Binding 추가) | `askill ce1` 3줄 (Bind 추가) | 일치 |

**표본 대조 2 — 21206 지난 날 / Bygone Days (Gregor, TETH)**

| 항목 | 우리 원본 | wiki.gg | 판정 |
| --- | --- | --- | --- |
| SP 소모 (각성/침식) | `spCost 20` / `20` | `asanity=20` / `csanity=20` | 일치 |
| 죄악 자원 | (mj `AZURE 4 · SCARLET 2`) | `gloomcost=4` · `lustcost=2` | 일치 |
| 각성 위력·코인위력·보정·가중치·코인수 | `20 · +4 · -3 · 1 · 1` | `spower=20 · cpower=+ 4 · atkmod=-3 · atkweight=1 · coin=1` | 일치 |
| 침식 위력·코인위력·보정·타입·코인수 | `27 · -8 · +3 · blunt · 1` | `spower=27 · cpower=- 8 · atkmod=+3 · type=Blunt · coin=1` | 일치 |
| uptie 1/3/4 회복량 | `Heal 10 / 12 / 15 SP` | `askill2 / askill3 / askill` = `10 / 12 / 15` | 일치 |
| 유래 환상체 | (`ego_skill_stage_text.ab_name` = 어느 날의 초상) | `abnormality=Portrait of a Certain Day` | 일치 |

**표본 대조 3(덤) — 21209 눈부시지 않은 영광 / Unbrilliant Glory (Gregor, WAW)**

| 스킬 | 우리 원본 | wiki.gg |
| --- | --- | --- |
| 2120911 Flowing | `base 5 · coin +5 · atkW 1 · lc 0 · sp 30 · coins 1 normal` | `spower=5 · cpower=+ 5 · atkweight=1 · atkmod=+0 · asanity=30 · coin=1` |
| 2120912 Incandescence | `base 10 · coin +5 · atkW 3 · lc 3 · sp 30 · coins 1 unbreakable` | `spower=10 · cpower=+ 5 · atkweight=3 · atkmod=+3 · coin=1`(Unbreakable Coin) |
| 2120921 corrosion | `base 20 · coin -4 · atkW 3 · lc 6 · sp 35 · coins 4 unbreakable` | `spower=20 · cpower=- 4 · csanity=35 · coin=4` |

**부수 확인 — `uptie` 에 2 가 없는 이유가 위키로 설명된다.**
`E.G.O/Gameplay`: `"Upgrading E.G.O to Threadspin Tier 2 unlocks its Passive, Threadspin Tier 3 and 4
upgrades both the Awakening and Corrosion Skills, and Threadspin Tier 5 ... upgrades all three."`
→ 2단계는 **패시브만** 올린다. 그래서 스킬 수치에 2단계 항목이 존재하지 않는다(감사 §4.4 관측이 옳다).
우리 `uptie 1` = 위키의 Tier 1–2 표기(askill2), `uptie 3` = Tier 3, `uptie 4` = Tier 4 로 대응한다.

**조치**

- **우리 원본 `ego-details` 는 신뢰할 수 있다.** 3종 표본에서 수치 불일치 0건. canonical 로 실을 때
  위키 재확인은 필요 없고, 파이프라인이 `ego-details` 를 입력으로 받게만 하면 된다
  (`load-canonical.ts` 가 지금 넘기는 것은 `egos_detail.json` 뿐이다).
- 적재할 최소 컬럼: `ego_skill_stage` 에 `sp_cost · base_value · coin_value · atk_weight ·
  level_correction · atk_type · def_type · affinity`, `ego_skill_coin` 에 `coin_type(normal|unbreakable)`.
- 회귀 테스트용 골든 표본으로 위 3종(20101 · 21206 · 21209)을 그대로 쓸 수 있다.
- 다만 위키 수치는 **최고 단계 기준이 델타가 아니라 전량 재기술**이므로, 우리 원본의 델타(uptie 3·4 에서
  변한 필드만 존재)를 소비할 때는 uptie 1 값을 상속시켜야 한다. 위 대조도 그 상속을 적용한 결과다.

---

### 5. `ego_requirement` 를 남길 것인가 — 게임 표기는 색인가 죄악 이름인가

**판정** 확정(어휘 판정) — 게임/플레이어 어휘는 **죄악 이름**이다. 색 이름은 **게임 파일 내부 식별자**다.
(테이블을 남길지 자체는 제품 판단.)

**답** 위키는 E.G.O 사용 조건을 예외 없이 **죄악 이름 + 죄악 아이콘**으로 적는다.
`CRIMSON`/`AMBER`/`AZURE`/`SCARLET` 같은 색 이름은 위키 전체에서 **단 한 문서**에만, 그것도
"게임 파일에는 이렇게 들어 있다"는 **Trivia · 데이터마이닝 표기**로만 등장한다.

**근거 1 — 색 이름은 내부 식별자라고 위키가 직접 말한다.**
https://limbuscompany.wiki.gg/wiki/Sin (`?action=raw`, `==Trivia==` 절, `{{Datamined Info}}` 표시)

```
* In the game files, each of the Sins are associated with a particular color:
** {{Icons|Wrath}}Wrath — CRIMSON
** {{Icons|Lust}}Lust — SCARLET
** {{Icons|Sloth}}Sloth — AMBER
** {{Icons|Gluttony}}Gluttony — SHAMROCK
** {{Icons|Gloom}}Gloom — AZURE
** {{Icons|Pride}}Pride — INDIGO
** {{Icons|Envy}}Envy — VIOLET
** Two additional Sin Affinities, associated with the colors BLACK and WHITE, are present in the
   game files. Respectively, they are referred to as "Angst" and "Mad."
```

위키 전문 검색(MediaWiki `insource:/CRIMSON|AMBER|SHAMROCK/`) 결과 **총 2건**이며, 그중 하나는 위 `Sin` 문서,
다른 하나는 소설 대사(`THE ALL-WITHERING CRIMSON WHALE!!!`)다. 즉 **게임플레이 어휘로는 0건**이다.

**근거 2 — E.G.O 문서의 사용 조건은 죄악 이름 필드다.**
`Crow's_Eye_View_Yi_Sang?action=raw`:

```
<!--Cost-->
|asanity=10
|wrathcost=1
|lustcost=
|slothcost=3
|gluttonycost=
|gloomcost=
|pridecost=
|envycost=
```

렌더 결과도 죄악 아이콘 + 개수(`LcbSinWrath.png x1`, `LcbSinSloth.png x3`)다.

**근거 3 — 총론도 "Affinity"(죄악)로 말한다.**
`E.G.O/Gameplay`: `"Each individual E.G.O has its own requirements for the amount and Affinity of
E.G.O Resources needed to be used. To use E.G.O, hold down on any of the Sinner's Skill Slots on the
Dashboard and select the desired E.G.O (if the E.G.O Resource requirements are not met, it will be
grayed out)."`

**위키로 불가한 부분** — 실제 게임 클라이언트의 E.G.O 상세 패널이 아이콘 옆에 **텍스트 라벨을 띄우는지**,
띄운다면 한국어로 "분노/나태"인지는 위키가 스크린샷 캡션 수준으로만 다루므로 단정할 수 없다.
게임에서 볼 것: **E.G.O 상세 화면의 사용 조건 줄**. 아이콘만 있고 텍스트가 없다면 우리 화면도 아이콘 + 개수로
가면 되고, 텍스트가 있다면 그것이 "분노"인지 "진홍"인지를 그대로 따르면 된다. 어느 쪽이든 색 **이름**이
UI 에 나올 가능성은 위 근거상 매우 낮다.

**우리 데이터**

```
canonical.ego_requirement (314행): 20101 → AMBER 3 · CRIMSON 1 ,  21206 → AZURE 4 · SCARLET 2
canonical.ego_cost        (314행): 20101 → sloth 3 · wrath 1   ,  21206 → gloom 4 · lust 2
```

원본에서도 둘은 같은 뿌리다 — `egos_detail.json` 의 `"requirements":[{"attributeType":"CRIMSON","num":1},
{"attributeType":"AMBER","num":3}]` 가 곧 `ego_requirement` 이고, 색↔죄악 매핑(`sin_info.attribute`)으로
`ego_cost` 와 양방향 차집합 0 이다.

**조치**

- `ego_requirement` 는 **드롭 후보**다. 색 이름은 데이터마이닝 식별자이지 사용자 어휘가 아니므로 화면에
  나갈 일이 없고, 314행 전부가 `ego_cost` 와 중복이다.
- 색이 필요한 곳(아이콘 색상 토큰 등)은 `sin_info` 에 죄악→색 매핑 7행을 두고 조인하면 끝난다.
  E.G.O 마다 반복 저장할 이유가 없다.
- 남기기로 한다면 최소한 이름을 바꿔라 — `requirement`(요구 조건)는 `cost`(소모)와 의미가 겹쳐서
  소비자가 "둘 다 충족해야 하는 별개 조건"으로 오독한다. 실측은 완전 동일 데이터다.

---

## 부록 — 조사 방법 재현

```bash
# 위키텍스트 원문 (렌더 HTML 보다 정확하다. 20초 이상 간격 필수)
curl -sL -A "your-agent/1.0" \
  "https://limbuscompany.wiki.gg/index.php?title=Crow%27s_Eye_View_Yi_Sang&action=raw"

# 전문 검색 API
curl -sL "https://limbuscompany.wiki.gg/api.php?action=query&list=search\
&srsearch=insource%3A%2FCRIMSON%2F&format=json"
```

조사한 문서: `E.G.O/Gameplay` · `Sanity` · `Sin` · `Crow's Eye View Yi Sang` ·
`La Sangre de Sancho Don Quixote` · `Chains of Others Meursault` · `Land of Illusion Hong Lu` ·
`To Páthos Máthos Outis` · `Tears of the Tarnished Blood [汚血泣淚] Hong Lu` · `Unbrilliant Glory Gregor`.

fandom·Cogitopedia·나무위키는 보조로 검색만 했고, wiki.gg 와 어긋나는 서술은 발견되지 않았다.
`E.G.O Resources` 라는 단독 문서는 wiki.gg 에 존재하지 않는다(내용은 `E.G.O/Gameplay` 와 `Battles` 에 분산).
