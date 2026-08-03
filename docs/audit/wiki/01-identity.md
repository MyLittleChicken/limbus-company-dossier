# 위키 조사 · 인격 도메인 미확정 7건 판정

조사일 2026-08-03. 주 출처는 `limbuscompany.wiki.gg`(영문 공식 팬위키). 보조로 raw 계층 원문(`raw.raw_object`)을 대조했다.
위키 인포박스는 `action=raw` 로 위키텍스트 원본을 받아 파라미터 값을 그대로 인용했다 — 렌더 결과가 아니라 소스 값이므로 요약 왜곡이 없다.

DB 실측은 전부 `docker compose exec -T postgres psql -U postgres -d limbus` 로 재측정했다.

---

### 1. 동기화(Uptie) 5가 게임에 있는가

**판정** 확정

**답** 없다. 게임의 동기화 상한은 **IV** 이고, canonical 이 만든 동기화 5 행은 인격 스킬에 대해서는 **전부 빈 패딩**이다.

**근거**

> "Identities begin at Uptie Tier I and can currently be Uptied to Tier IV."
> — https://limbuscompany.wiki.gg/wiki/Identities

같은 문서의 단계별 설명도 IV 에서 끝난다.

> Tier II: "upgrades the Identity's Skills and unlocks Combat Passives that require E.G.O Resources"
> Tier III: "further upgrades the Identity's Skills and unlocks its Support Passive and Skill 3"
> Tier IV: "further upgrades the Identity's Skills, and in some cases, its Passives"
> — 같은 URL

**우리 데이터**

| 측정 | 값 |
| --- | --- |
| `skill_stage` 동기화 5 행 (전체) | 1036 |
| 그중 `changed_here=true` | 6 |
| 동기화 5 행을 갖는 **인격** 스킬 수 | 828 |
| 그중 `changed_here=true` 인 인격 스킬 | **0** |

`changed_here=true` 6건의 정체를 특정했다 — `2010211` `2010221` `2040211` `2040221` `2090211` `2090221`. 전부 id 접두 `2`(E.G.O)이고 `identity_skill` 연결 0건이며 en 이름이 전부 **`4th Match Flame`** 이다. 즉 감사 보고서 5절이 "동기화 5에 값이 바뀌는 것 6건"이라 적은 것은 **인격 도메인 밖의 E.G.O 스킬**이다.

**조치**
- 인격 화면 기준으로는 논쟁의 여지가 없다. `skill_stage` 에서 `uptie=5` 행을 인격 스킬에 한해 **잘라내거나**, 질의 계층에서 `uptie <= 4` 로 고정한다. 828개 인격 스킬 × 1행 = 828행이 순수 잡음이다.
- E.G.O 의 `4th Match Flame` 6건은 E.G.O 담당 범위다. E.G.O 는 동기화가 아니라 **실뽑기(Threadspin)** 축을 쓰므로 축 자체가 다르다. mj 원본의 `levels` 5번째 항목이 무엇인지는 E.G.O 감사에서 따로 봐야 한다. 인격 담당으로서는 「인격 스킬에 동기화 5는 없다」까지만 확정한다.

---

### 2. 인격 10116 의 출시일

**판정** 확정 — **canonical 이 맞다**

**답** `2026-07-23`. public 의 `2026-08-05` 가 틀렸다.

**근거** 인격 10116 은 **이상(Yi Sang) · LCE E.G.O::차원찢개**(en `LCE E.G.O::Dimension Shredder`)다. 위키 인포박스 위키텍스트 원문:

> ```
> |releasedate=2026.07.23
> |season=7
> |keyword={{Keyword|Limbus Company}} {{Keyword|LCE}} {{Keyword|E.G.O Gear}}
> ```
> — https://limbuscompany.wiki.gg/index.php?title=LCE_E.G.O::Dimension_Shredder_Yi_Sang&action=raw

렌더된 인포박스도 동일하다.

> **Release: "2026.07.23"** (Info 섹션)
> — https://limbuscompany.wiki.gg/wiki/LCE_E.G.O::Dimension_Shredder_Yi_Sang

**교차 검증 — 출처의 `date` 필드가 실제 출시일임을 별건으로 확인했다.** 인격 10715(히스클리프 · 중지 작은 형님)는 raw `identities/limbus-assets/identities.json` 에 `"date": "2026-04-30"`, 위키 인포박스는 `Release: 2026.04.30` 로 정확히 일치한다. 즉 canonical 이 읽은 limbus-assets 의 `date` 는 출시일이지 예고일이 아니다.

**우리 데이터**

```
raw: identities/limbus-assets/identities.json | id=10116 | date=2026-07-23 | season=7
canonical.identity.release_date = 2026-07-23   (field_source: identity|releaseDate|assets-only)
public.identity."releaseDate"   = 2026-08-05
```

raw 전체를 훑어 10116 의 날짜 키를 가진 객체를 찾았더니 **limbus-assets 1건뿐**이었다(`date`/`releaseDate`/`releasedAt` 어느 키로도). 즉 public 의 `2026-08-05` 는 현재 raw 계층 어디에도 근거가 없다.

> 주의: 웹 검색 요약 중 "previewed on 2026.07.23 (KST)" 라는 서술이 있었다(비위키 2차 출처). 그러나 위키 인포박스의 `releasedate` 파라미터는 예고일이 아니라 출시일 슬롯이고, 10715 대조로 이 슬롯이 실제 출시일임을 확인했으므로 2026-07-23 을 출시일로 판정한다.

**조치** public 쪽 1건을 `2026-07-23` 로 고친다. canonical 은 손댈 것이 없다. 감사 보고서 5.1절 마지막 줄과 7절 2항의 「값 충돌」은 **canonical 승**으로 닫는다.

---

### 3. 인격 10311 · 10708 의 시즌

**판정** 확정 — **public 이 맞다(`0`). canonical 의 `NULL` 은 ETL 결손이다.**

**답** 두 인격 모두 **시즌 0**(위키 표기 `Standard Fare` · 상시 배포)이다. 원본에도 `season: 0` 이 명시돼 있다.

**대상 특정**

| id | 수감자 | 인격 | 출시일 |
| --- | --- | --- | --- |
| 10311 | 돈키호테 | 동부 섕크 협회 3과 (`Cinq Assoc. East Section 3`) | 2025-03-06 |
| 10708 | 히스클리프 | 남부 외우피 협회 3과 (`Öufi Assoc. South Section 3`) | 2024-03-21 |

**근거** 두 인격 모두 위키 인포박스 위키텍스트에 `|season=0` 이 박혀 있다.

> ```
> |season=0
> |releasedate=2025.03.06
> |keyword={{Keyword|Fixer}} {{Keyword|Cinq Association}}
> ```
> — https://limbuscompany.wiki.gg/index.php?title=Cinq_Assoc._East_Section_3_Don_Quixote&action=raw

> ```
> |season=0
> |releasedate=2024.03.21
> |keyword={{Keyword|Fixer}} {{Keyword|Öufi Association}}
> ```
> — https://limbuscompany.wiki.gg/index.php?title=%C3%96ufi_Assoc._South_Section_3_Heathcliff&action=raw

`season=0` 은 인포박스에서 **`Standard Fare`** 로 렌더된다. 렌더 결과 확인:

> "**Season:** Standard Fare / **Release Date:** 2025.03.06 / **Rarity:** 3-Star"
> — https://limbuscompany.wiki.gg/wiki/Cinq_Assoc._East_Section_3_Don_Quixote
>
> "Release: 2024.03.21 / Season: Standard Fare / Rarity: 3-Star"
> — https://limbuscompany.wiki.gg/wiki/%C3%96ufi_Assoc._South_Section_3_Heathcliff

`season=0 → Standard Fare` 라는 대응은 다른 인격으로도 확인된다. 출시 초기 인격 10101 도 동일하다.

> ```
> |season=0
> |releasedate=2023.02.27
> ```
> — https://limbuscompany.wiki.gg/index.php?title=LCB_Sinner_Yi_Sang&action=raw
> 렌더: "Release: 2023.02.27 / Season: Standard Fare / Rarity: 1-Star" — https://limbuscompany.wiki.gg/wiki/LCB_Sinner_Yi_Sang

숫자 시즌은 별도 문자열로 렌더된다(대조군):

> "Season: **Season 3 - Bon Voyage [Event]**" — https://limbuscompany.wiki.gg/wiki/Blade_Lineage_Mentor_Meursault (우리 데이터 season=3)
> "Season: **Season 5 - Oblivion**" — https://limbuscompany.wiki.gg/wiki/Cinq_Assoc._West_Section_3_Meursault (우리 데이터 season=5)
> "Season: **Walpurgisnacht - III**" — https://limbuscompany.wiki.gg/wiki/Dawn_Office_Fixer_Sinclair (우리 데이터 season=9103)

즉 우리 `season` 코드계는 위키와 완전히 정합한다. `0`=Standard Fare, `1–7`=정규 시즌, `91NN`=발푸르기스의 밤 N회차(9103 = Walpurgisnacht III 확인).

**우리 데이터 — 「원본에 season 키가 없다」는 감사 보고서 3.8절의 서술이 부분적으로 틀렸다**

```
raw | identities/limbus-assets/identities.json  | 10311 | season=0 | date=2025-03-06
raw | identities/shared-library/identities.json | 10311 | season=0 | date=2025-03-06
raw | identities/limbus-assets/identities.json  | 10708 | season=0 | date=2024-03-21
raw | identities/shared-library/identities.json | 10708 | season=0 | date=2024-03-21
```

**두 출처가 모두 `season: 0` 을 갖고 있다.** season 키가 없는 것은 canonical ETL 이 읽은 `identities/limbus-data-mj` 계열뿐이다. 이것은 `stagger` · `hp` · `identity_speed` 와 **정확히 같은 종류의 출처 선택 버그**다(감사 3.2 / 3.3절 참조).

또한 season 0 이 "출시 초기 인격"이 아니라는 것도 실측으로 확인된다.

```
canonical.identity WHERE season=0 : 65건, release_date 범위 2023-02-27 ~ 2025-12-18
```

10213(시 협회 동부 3과, 2025-10-09) · 10914(R사 4중대 순록, 2025-12-18) 같은 최근 인격도 season 0 이다. 즉 season 0 은 **상시 배포 풀** 버킷이고, 10311·10708 은 정확히 그 버킷의 구성원이다.

**조치**
- canonical ETL 의 `identity.season` 출처를 mj → limbus-assets(또는 shared-library) 로 바꾼다. 그러면 NULL 2건이 0 으로 채워지고 public 과 184/184 일치한다.
- `field_gap` 에 `identity|season|2` 가 올라 있다면 **결손이 아니라 출처 오선택**이므로 대장에서 내려야 한다.
- 화면 표기는 제품 판단이다. `S0` 대신 `상시`(Standard Fare) 로 부르는 편이 위키·게임 표현에 가깝다.

---

### 4. 반격(counter) 스킬 4건이 공격 슬롯에 들어가는가

**판정** 확정 — **아니다. canonical 의 `role='attack'` 은 잘못된 분류이고, 이 4건은 화면에 낼 스킬이 아니다.**

**답** 게임에서 반격(Counter)은 **방어 스킬 계열**(Guard / Evade / Counter) 이고 공격 스킬 슬롯 1·2·3 에 들어가지 않는다. 문제의 4건은 **어느 출처에도 이름·수치·단계가 하나도 없는 내부 전용 스킬**이며, 반격 발동 시 내부적으로 참조되는 숨은 엔트리로 보인다.

**대상 특정 (DB 실측)**

| 스킬 | 인격 | 인격명 | canonical role/slot/ordinal | kind | 단계 수 (canonical / public) | 이름 |
| --- | --- | --- | --- | --- | --- | --- |
| `1071506` | 10715 | 히스클리프 · 중지 작은 형님 | attack / 3 / 4 | counter | 0 / 0 | 없음 |
| `1111510` | 11115 | 오티스 · 거미집 중지 아비 | attack / 3 / 8 | counter | 0 / 0 | 없음 |
| `1111511` | 11115 | 오티스 · 거미집 중지 아비 | attack / 3 / 9 | counter | 0 / 0 | 없음 |
| `1121607` | 11216 | 그레고르 · 새벽 사무소 대표 | attack / 3 / 4 | counter | 0 / 0 | 없음 |

**4건 전부가 감사 보고서 4.2절의 「단계 0개인 스킬 9건」 목록에 들어 있다.** public 에서도 `deckCount=0` · 단계 0 · 이름 없음이다. 즉 "canonical 이 정보를 더 갖고 있다"(감사 4.4-b)가 아니라, **양쪽 다 껍데기이고 canonical 이 그것을 공격 슬롯으로 잘못 표시했다**.

**근거**

위키가 세 인격을 모두 「반격은 방어 슬롯 전용」으로 적는다.

> "**Counter Skill Location** — All counter skills are located in **defense slots only**. There are no counter skills in attack positions (Skills 1, 2, or 3)."
> 그레고르 방어 스킬: "**Guardian** — Type: Wrath Skill (Counter). Clashable Counter. Combat Start: Gain 1 Assist Defense (Max Stack: 3). **Converts unopposed ally attacks to self-redirects using unique counter skill.**"
> "**Heat Haze** — Type: Wrath Skill (Counter). Clashable Counter. Exclusive Skill with Assist Defense mechanics."
> — https://limbuscompany.wiki.gg/wiki/Dawn_Office_Rep_Gregor

밑줄 친 "**unique counter skill**" 이 `1121607` 의 정체로 보인다. 게임이 반격을 실행할 때 참조하는 내부 스킬이라 플레이어 화면의 스킬 목록에는 뜨지 않는다.

> 히스클리프 방어 스킬: "**Payback** (Counter/Blunt) — **occupies a defense skill slot, not an attack slot.** At high resonance levels, this skill can activate the 'MY HAIR COUPOOOOOOOOOOONS!!!!' attack as a counter trigger during combat start phases."
> — https://limbuscompany.wiki.gg/wiki/The_Middle_Big_Brother_Heathcliff

> 오티스: "No counter-type skills appear in attack slots."
> — https://limbuscompany.wiki.gg/wiki/The_House_of_Spiders:_The_Middle_Nursefather_Outis

세 인격의 위키 스킬 목록과 우리 DB 를 맞춰보면 **이름이 있는 스킬은 전부 대응하고, 이름 없는 4건만 위키에 대응물이 없다**.

- 10715 위키: Skill 1 Kicking / Skill 2 Watch Your Back! / Skill 3-1 MY HAIR COUPOOOOOOOOOOONS!!!! / Skill 3-2 COMPLETE AND TOTAL EXTERMINATION!! / 방어 Payback → DB `1071501` `1071502` `1071503` `1071505` `1071504`(defense). 남는 것은 `1071506`(counter, 무명) · `1071507`(attack, 무명, 단계 0) 둘뿐.
- 11216 위키: Flash of Sunup / Sunset Blade / Dawnsplitter / Crack of Dawn / 방어 Guardian · Heat Haze → DB `1121601` `1121602` `1121603` `1121605` `1121604` `1121606`. 남는 것은 `1121607` 하나.

**우리 데이터**

```
canonical: identity_skill.role='attack' AND skill.kind='counter'  → 4건 (위 표)
public   : 위 4건 모두 defType='counter', deckCount=0, skill_stage 0행
public   : 같은 9건 결손 목록 중 1021207 · 1101205 · 1101206 은 public 에 단계가 있다(각 2·4·2)
```

**조치**
- canonical ETL 이 `defenseSkills` 배열에 없는 counter 스킬을 무조건 attack 슬롯으로 떨어뜨리는 것으로 보인다. `kind='counter'` 이면서 단계 0 · 덱 0 인 스킬은 `role='attack'` 대상에서 제외해야 한다.
- 감사 보고서 4.4-(b) 의 「손실이 아니라 canonical 쪽 정보가 더 많다」는 **철회한다**. 정보가 더 많은 것이 아니라 잡음이 더 많다.
- 화면 관점: 이 4건을 스킬 카드로 렌더하면 이름·설명·코인이 전부 빈 카드가 3개 인격에 4장 생긴다. 질의 계층에서 제외하는 것이 맞다.

---

### 5. 동기화 3부터 시작하는 스킬 216건을 동기화 1·2 에서 어떻게 보여야 하는가

**판정** 확정 — **canonical 의 앞채우기가 틀렸다. 동기화 1·2 에서는 스킬 자체가 잠겨 있다.**

**답** 3번째 공격 스킬은 게임에서 **동기화 III 에서 해금**된다. 동기화 I·II 에는 그 스킬이 존재하지 않으므로, 동기화 3 의 값을 1·2 로 복사하는 것은 없는 것을 있는 것처럼 만든 것이다.

**근거** 위키 총론이 해금 시점을 명시한다.

> Tier III: "further upgrades the Identity's Skills and **unlocks its Support Passive and Skill 3**"
> — https://limbuscompany.wiki.gg/wiki/Identities

문제로 지목된 바로 그 스킬(인격 10101 이상 · `1010103` 연격 / en `Enjamb`)의 인격 페이지가 표 단위로 이를 확인한다.

> "**Skill 3 Availability** — The Enjamb skill becomes accessible at Tier 3. **Tables for Uptie I and II do not display Skill 3 data—it's marked "Locked until Tier 3."** Only Tier 3 and Tier 4 tables show Skill 3 statistics."
> — https://limbuscompany.wiki.gg/wiki/LCB_Sinner_Yi_Sang

같은 규칙이 지원 패시브에도 적용된다 — 아래 6항의 지원 패시브 인용 3건이 전부 "Tier 3 requirement" / "locked until Tier 3" 로 적혀 있다.

**우리 데이터**

216건의 정체를 슬롯별로 분해했다. 「동기화 3 이전에 변경 이력이 전혀 없는」 인격 스킬의 분포:

| role | slot | 최초 변경 동기화 | 건수 |
| --- | --- | --- | --- |
| attack | **3** | **3** | **206** |
| defense | — | 3 | 7 |
| attack | 1 | 3 | 1 |
| attack | 2 | 3 | 1 |
| attack | 3 | 4 | 1 |

**206 / 216 이 정확히 슬롯 3(=Skill 3)** 이다. 위키가 말하는 「Tier III 에서 해금되는 Skill 3」과 정확히 겹친다. 우연이 아니다.

`1010103` 실측:

```
uptie | changed_here | en name
  1   |      f       | Enjamb   ← canonical 이 만들어 넣은 행
  2   |      f       | Enjamb   ← canonical 이 만들어 넣은 행
  3   |      t       | Enjamb
  4   |      t       | Enjamb
  5   |      f       | Enjamb   ← 1항의 잡음
```

public 은 동기화 3·4 만 갖는다.

**조치**
- canonical 의 앞채우기(동기화 3 값을 1·2 로 복사)는 **제거**하거나, 최소한 `changed_here=false` 를 "미해금"과 "값 유지"를 구분하는 별도 플래그로 분리해야 한다. 지금은 두 의미가 같은 `false` 로 뭉개져 있어 소비자가 구분할 수 없다.
- 임시 대응이 필요하다면 질의 계층에서 `min(uptie WHERE changed_here) > 동기화` 인 스킬을 해당 탭에서 숨기면 된다. 다만 이는 canonical 이 잃어버린 정보를 소비자가 되계산하는 것이라 근본 수정은 ETL 쪽이다.
- 화면 표현(숨김 vs `Tier 3 해금` 자물쇠 표시)은 제품 판단이다. 위키는 자물쇠 표기를 쓴다("Locked until Tier 3").
- 위 표의 나머지 10건(방어 7 · 슬롯 1 · 슬롯 2 · 동기화 4 시작 1)은 Skill 3 규칙으로 설명되지 않는다. 별개 사유가 있을 수 있으므로 이번 판정 범위에 넣지 않는다. — **위키로 불가**, 개별 인격 페이지를 다시 봐야 한다.

---

### 6. 이름 없는 패시브 6건을 화면에 노출할 것인가

**판정** 확정 — **게임에 없다. canonical 이 유령을 노출하는 것이다.**

**답** 6개 인격 전부에 대해 위키가 세는 패시브 개수는 **우리 DB 의 「이름 있는」 패시브 개수와 정확히 일치**하고, 무명 6건에 대응하는 항목은 어느 페이지에도 없다.

**근거** — 6/6 전수 대조

| 인격 | 위키가 나열한 패시브 | 우리 DB 의 이름 있는 패시브 | 무명 |
| --- | --- | --- | --- |
| 10110 이상 · 로보토미 E.G.O::엄숙한 애도 | 전투 `ISeeTheDyingButterfly.` · 전투 `Fire.IShallFire.` · 지원 `Hand of Salvation` (3) | `1011002` · `1011001` · `1011021`(+T4판 `1011011`) (3종) | `1011003` |
| 10212 파우스트 · 흑수 - 묘 필두 | 전투 `Tianjiu Star` · 전투 `Heishou Mutation [Mao] / Mao Branch Adept` · 지원 `Blinkblade` (3) | `1021203` · `1021201` · `1021221` (3종) | `1021202` |
| 10311 돈키호테 · 동부 섕크 협회 3과 | 전투 `Virescent Pyrojade`(T2) · 지원 `Featherstride Technique`(T3) (2) | `1031101` · `1031121`(+T4판 `1031111` `1031131`) (2종) | `1031102` |
| 10508 뫼르소 · 검계 우두머리 | 전투 `In Memoriam` · 전투 `Swordplay of the Homeland` · 지원 `Swordplay of the Homeland`(T3) (3) | `1050802` · `1050801` · `1050821`(+T4판 `1050811`) (3종) | `1050803` |
| 10511 뫼르소 · 서부 섕크 협회 3과 | 전투 `Duel Livestream` · 지원 `One Step Ahead`(T3) (2) | `1051101` · `1051121`(+T4판 `1051111`) (2종) | `1051102` |
| 11009 싱클레어 · 새벽 사무소 해결사 | 전투 `Unstable Shell of Ego` · 전투 `Stigma Workshop Weaponry / Passion` · 지원 `Flaring Brand`(T3) (3) | `1100902` · `1100901` · `1100921`(+T4판 `1100911`) (3종) | `1100903` |

인용 (URL 은 각 행 순서대로):

> `|passive0={{Passive|ISeeTheDyingButterfly.|...}}`
> `|passive1={{Passive|Fire.IShallFire.|sin=Gloom|req=3 Res|...}}`
> `|passive2={{Passive|Hand of Salvation|sin=Gloom|req=6 Owned|...}}`
> — https://limbuscompany.wiki.gg/index.php?title=Lobotomy_E.G.O::Solemn_Lament_Yi_Sang&action=raw
> **위키텍스트에 패시브 파라미터는 `passive0`·`passive1`·`passive2` 셋뿐이다. 네 번째 슬롯이 없다.**

> "**Combat Passives (2 total)**: 1. "Tianjiu Star" (Tier 1) 2. "Heishou Mutation [Mao] / Mao Branch Adept" (Tier 1) — **Support Passives (1 total)**: "Blinkblade" (Locked until Tier 3)"
> — https://limbuscompany.wiki.gg/wiki/Heishou_Pack_-_Mao_Branch_Adept_Faust

> "**Combat Passives**: "Virescent Pyrojade" (Unlocked at Tier 2) — **Support Passives**: "Featherstride Technique" (Unlocked at Tier 3)"
> — https://limbuscompany.wiki.gg/wiki/Cinq_Assoc._East_Section_3_Don_Quixote

> "**Combat Passives**: 1. "In Memoriam" (Tier 1) 2. "Swordplay of the Homeland" (Tier 1) — **Support Passives**: 1. "Swordplay of the Homeland" (Tier 3 requirement) — **Total Count: 3 passives (2 combat, 1 support)**"
> — https://limbuscompany.wiki.gg/wiki/Blade_Lineage_Mentor_Meursault

> "**Combat Passives**: "Duel Livestream" — Requires 2× Pride and 2× Gluttony — **Support Passives**: "One Step Ahead" — Requires 3× Pride (locked until Tier 3) — **Total Count: 2 passives (1 combat, 1 support)**"
> — https://limbuscompany.wiki.gg/wiki/Cinq_Assoc._West_Section_3_Meursault

> "**Combat Passives (2 Total)**: "Unstable Shell of Ego", "Stigma Workshop Weaponry / Passion" — **Support Passive (1 Total)**: "Flaring Brand" (Locked until Tier 3)"
> — https://limbuscompany.wiki.gg/wiki/Dawn_Office_Fixer_Sinclair

**우리 데이터**

```
canonical.passive WHERE id IN (6건) → 전부 존재하나
  passive_text 행 수 = 0 (ko/en/ja 전부)
  conditions      = {} (빈 배열)
public.passive    WHERE id IN (6건) → 0건 (public 은 아예 싣지 않았다)
```

이름·설명·발동조건이 **모두** 비어 있다. 위키의 패시브 개수와도 어긋난다. 「어느 출처에도 없다」는 마스터북의 3회 확인과 위키 6/6 부재가 일치한다.

**조치**
- canonical `identity_passive` 에서 이 6건의 연결을 **끊는다**. 남겨두더라도 질의 계층이 `passive_text` 부재를 기준으로 걸러야 한다.
- `field_gap` 의 `passive|name|6` 은 "이름만 결손"이 아니라 "실체 없는 엔트리"로 재분류하는 편이 정확하다.
- 감사 보고서 6.1절이 예상한 "canonical 로 바꾸면 빈 항목이 새로 6개 생긴다"는 그대로 실현되며, **그 6개는 게임에 없는 항목**이다. 노출하면 안 된다.

---

### 7. `identity_unit_keyword` 36종의 한국어 표시명

**판정** 확정(대부분) + 위키로 불가(일부)

**답** 대부분은 **게임 화면에 실제로 표기되는 태그**다. 위키는 이것을 인포박스의 **`Traits`**(위키텍스트 파라미터 `|keyword=`) 로 렌더한다. 그리고 **한국어 표시명은 우리 raw 계층에 이미 전부 들어 있다** — 위키를 볼 필요가 없었다. 다만 canonical 의 36개 코드 중 **11개는 loc 파일의 키와 코드 체계가 달라** 자동 대응이 안 되고, 그중 `SMALL` · `BASE_APPEARANCE` 는 화면에 뜨는 태그가 아니다.

**근거 1 — 게임에 표기되는 태그다**

> `|keyword={{Keyword|Limbus Company}} {{Keyword|LCE}} {{Keyword|E.G.O Gear}}`
> — https://limbuscompany.wiki.gg/index.php?title=LCE_E.G.O::Dimension_Shredder_Yi_Sang&action=raw
> 렌더 결과 인포박스: "**Traits** — The Fingers / The Middle" (10715 예)
> — https://limbuscompany.wiki.gg/wiki/The_Middle_Big_Brother_Heathcliff

위키는 이를 분류 축으로도 쓴다.

> "Category:Identities by Trait Keyword" — 하위 분류에 `Fixer`, `Bloodfiend`, `E.G.O Gear`, `The Fingers`, `Mechanical Amalgam`, `Dihui Star`, `Smoke War`, `War Hero`, `The House of Spiders`, `The Ring Student`, `The Ring Docent`, `Wild Hunt`, `The Pequod`, `Lobotomy Corp. Branch`, `Lobotomy Corp. Headquarters`, `The Backstreets`, `Blade Lineage`, `Syndicate`, `Second Kindred`, `Third Kindred`, `Family Hierarch Candidate`, `Capo`, `Soldato`, **`Identities with Crossed-Out Traits`** 등
> — https://limbuscompany.wiki.gg/wiki/Category:Identities_by_Trait_Keyword

마지막 항목 **`Identities with Crossed-Out Traits`(취소선 그어진 태그)** 는 결정적이다. 우리 raw 의 한국어 값이 정확히 취소선 마크업을 갖고 있다:

```
UnitKeyword_UNDERBOSS_FIRED   → <color=#d40000><s>언더보스</s></color>
UnitKeyword_BIG_SISTER_PAST   → <color=#d40000><s>큰 누님</s></color>
UnitKeyword_MAESTRO_FORMER    → <color=#d40000><s>마에스트로<s></color>
```

게임 화면 렌더용 마크업이 문자열에 박혀 있다는 것은 이 값이 **화면 표시용**이라는 직접 증거다. 내부 분류 코드였다면 색·취소선이 붙을 이유가 없다.

**근거 2 — 위키 `Traits` = 우리 `association` ∪ `unit_keyword`**

canonical 은 게임의 한 축을 두 테이블로 쪼개 놓았다. 위키와 맞춰보면 이렇게 된다.

| 인격 | 위키 Traits | canonical `identity_association` | canonical `identity_unit_keyword` |
| --- | --- | --- | --- |
| 10103 검계 살수 이상 | `Syndicate`, `Blade Lineage` | `BLADE_LINEAGE` | `CLAN`(=조직/Syndicate), SMALL, SALSOO |
| 10715 중지 작은 형님 | `The Fingers`, `The Middle` | `MIDDLE_FINGER`(=중지) | `FINGER`(=손가락), SMALL |
| 10116 차원찢개 이상 | `Limbus Company`, `LCE`, `E.G.O Gear` | `LIMBUS_COMPANY`, `LIMBUS_COMPANY_LCE` | `EGO_EQUIPMENT`, SMALL |
| 10101 LCB 수감자 이상 | `Limbus Company`, `LCB` | `LIMBUS_COMPANY`, `LIMBUS_COMPANY_LCB` | BASE_APPEARANCE, SMALL |

> 10103 인용: "**Traits:** Syndicate, Blade Lineage" — https://limbuscompany.wiki.gg/wiki/Blade_Lineage_Salsu_Yi_Sang
> 10101 인용: `|keyword={{Keyword|Limbus Company}} {{Keyword|LCB}}` — https://limbuscompany.wiki.gg/index.php?title=LCB_Sinner_Yi_Sang&action=raw

**여기서 `SMALL` 과 `BASE_APPEARANCE` 는 위키의 Traits 어느 인격에도 나오지 않는다.** 그리고 이 둘은 raw loc 파일에도 대응 문자열이 없다. → **화면에 뜨지 않는 내부 분류 코드**로 판정한다. `SMALL` 은 182/184 에 붙고 안 붙는 2건은 `10110`(엄숙한 애도) · `10410`(붉은 눈 & 참회) 로, 로보토미 E.G.O 대형 유닛 계열이다 — 유닛 크기 코드로 보인다.

**근거 3 — 한국어 표시명은 raw 에 있다**

`raw.raw_object` 의 `identities/loc-ko/UnitKeyword*.json`(ko 133개 객체)에서 코드 id 로 직접 대응된다. **36종 중 25종이 정확히 매칭**됐다.

| 코드 | 건수 | 한국어 | 영어 |
| --- | --- | --- | --- |
| `FIXER` | 58 | 해결사 | Fixer |
| `CLAN` | 22 | 조직 | Syndicate |
| `FINGER` | 20 | 손가락 | The Fingers |
| `EGO_EQUIPMENT` | 19 | E.G.O 장비 | E.G.O Gear |
| `LOBOTOMY_HEAD` | 9 | 로보토미 본사 | Lobotomy Corp. Headquarters |
| `BLACK_BEAST` | 9 | 흑수 | Heishou Pack |
| `BACK_STREET` | 5 | 뒷골목 | The Backstreets |
| `BLOODFIEND` | 5 | 혈귀 | Bloodfiend |
| `MACHINE_BOUND_ORGANISM` | 4 | 기계 융화 생명체 | Mechanical Amalgam |
| `RING_FINGER_STUDENT` | 3 | 스튜던트 | Student |
| `THIRD_DEPENDENT` | 3 | 제3권속 | Third Kindred |
| `BLACK_BEAST_CHIEF` | 3 | 흑수 필두 | Heishou Pack Adept |
| `SECOND_DEPENDENT` | 2 | 제2권속 | Second Kindred |
| `UNDERBOSS_FIRED` | 1 | `<color=#d40000><s>언더보스</s></color>` | `<s>Sottocapo</s>` |
| `THUMB_LEVEL_CAPO_FOUR` | 1 | 카포 IIII | Capo IIII |
| `BIG_SISTER_PAST` | 1 | `<color=#d40000><s>큰 누님</s></color>` | `<s>Great Sister</s>` |
| `THUMB_LEVEL_SOLDATO_TWO` | 1 | 솔다토 II | Soldato II |
| `MAESTRO_FORMER` | 1 | `<color=#d40000><s>마에스트로<s></color>` | `<s>Maestro<s>` |
| `SMOKE_WAR` | 1 | 연기전쟁 | Smoke War |
| `DIHUI_STAR` | 1 | 지혜성 | Dihui Star |
| `TRUST_AGENT` | 1 | 신탁 대행자 | The Oracle's Proxy |
| `WAR_HERO` | 1 | 전쟁영웅 | War Hero |
| `FAMILY_GA_CANDIDATE` | 1 | 가주 후보 | Family Hierarch Candidate |
| `LOBOTOMY_BRANCH` | 1 | 로보토미 지부 | Lobotomy Corp. Branch |
| `RING_FINGER_DOCENT` | 1 | 도슨트 | Docent |

미매칭 11종은 아래와 같다. mj 의 `unitKeywords` 코드와 loc 파일의 `UnitKeyword_*` 키가 서로 다른 명명을 쓰기 때문이다.

| 코드 | 건수 | 상태 | loc 후보 |
| --- | --- | --- | --- |
| `SMALL` | 182 | **화면 표기 아님** (내부 코드) | 없음 |
| `BASE_APPEARANCE` | 12 | **화면 표기 아님** (LCB 기본 인격 12건 전용) | 없음 |
| `SALSOO` | 5 | 미매칭 | `UnitKeyword_BLADE_LINEAGE`(검계)? — 위키 Traits 는 `Blade Lineage` |
| `SPIDER_HOUSE_FATHER` | 5 | 미매칭 | `UnitKeyword_SPIDER_HOUSE`(거미집) 계열 |
| `SPIDER_HOUSE_DISCIPLE` | 4 | 미매칭 | 동상 |
| `BUTLER` | 4 | 미매칭 | 대상: 10209 · 10408 · 10809 · 11108 (집사 계열) |
| `THUMB_LEVEL_MIDDLE_CAPO_UNDERBOSS` | 1 | 미매칭 | `UnitKeyword_THUMB_*` 계열 |
| `CAN_NOT_USING_INDEX_UNLOCK_PERSONALITY` | 1 | 미매칭 | `UnitKeyword_INDEX_FINGER`(검지) 계열? |
| `WILD_HUNT_HEATH` | 1 | 미매칭 | `UnitKeyword_WILD_HUNT`(와일드헌트) |
| `PEQUOD_CAPTAIN` | 1 | 미매칭 (대상 10808 피쿼드호 선장) | `UnitKeyword_PEQUOD_CREW`(피쿼드호) |
| `LITTLE_FINGER_FATHER_ENEMY` | 1 | 미매칭 | `UnitKeyword_LITTLE_FINGER`(소지) 계열 |

위 「loc 후보」 열은 **추정이며 확정이 아니다**. 코드명이 유사할 뿐 위키·raw 어느 쪽도 mj 코드 ↔ loc 키의 매핑을 명시하지 않는다. → 이 11건의 정확한 표시명은 **위키로 불가**.

**조치**
- canonical 에 `unit_keyword_text` 테이블을 신설하고 `identities/loc-{ko,en,ja}/UnitKeyword*.json`(로케일당 12파일 · ko 133객체)을 실으면 25/36 이 즉시 해결된다. **위키가 아니라 raw 가 답이었다.** 감사 보고서 7절 7항의 "raw 에 파일이 있으나 canonical 에 대응 텍스트 테이블이 없다"가 정확한 진단이었고, 그 파일을 실으면 끝난다.
- `SMALL`(182) · `BASE_APPEARANCE`(12) 는 화면 태그가 아니다. 표시명을 찾을 것이 아니라 **표시 대상에서 제외**한다.
- 나머지 9종(391행 중 23행)은 게임에서 직접 확인해야 한다. **볼 곳**: 인격 정보 화면의 이름 아래 태그 줄.
  - `10103`(검계 살수 이상) → `SALSOO` 가 `검계` 로 뜨는지, 별도 문구(`살수` 등)로 뜨는지
  - `10808`(피쿼드호 선장 이슈메일) → `피쿼드호` 인지 `피쿼드호 선장` 인지
  - `10209` · `10408` · `10809` · `11108` → `BUTLER` 가 `집사` 로 뜨는지
  - `11115`(거미집 중지 아비 오티스) → `SPIDER_HOUSE_FATHER` 가 `거미집` 인지 `거미집 아비` 인지
  - 위키 Traits 를 그대로 믿는다면 `SALSOO`→`Blade Lineage`(검계), `PEQUOD_CAPTAIN`→`The Pequod`(피쿼드호) 로 축약되지만, 그러면 canonical 이 굳이 `_CAPTAIN`/`_FATHER` 접미를 붙여 세분한 이유가 설명되지 않는다. 이 불일치는 게임 화면으로만 갈린다.
- 태그를 목록 필터축으로 쓸지, 상세 화면 칩으로 쓸지는 제품 판단이다. 데이터 사실은 「`association` 과 `unit_keyword` 를 합쳐야 게임의 태그 줄 하나가 된다」는 것이다.

---

## 부록 · 이번 조사로 새로 드러난 것

감사 보고서가 놓쳤거나 잘못 적은 부분을 정리한다.

1. **`identity.season` 은 결손이 아니라 출처 오선택이다.** `limbus-assets/identities.json` 과 `shared-library/identities.json` 둘 다 10311·10708 에 `season: 0` 을 갖고 있다(실측). 감사 3.8절의 "원본에 season 키가 없다" 는 mj 출처에 한해서만 참이다. `stagger` · `hp` · `identity_speed` 와 동형의 버그가 하나 더 있는 셈이다.

2. **감사 4.4-(b) 「반격 4건은 canonical 쪽 정보가 더 많다」는 반대로 뒤집힌다.** 그 4건은 단계 0 · 덱 0 · 이름 0 의 껍데기이며, canonical 이 이를 공격 슬롯으로 승격시킨 것이 잘못이다.

3. **감사 5절 「동기화 5에 값이 바뀌는 것 6건」은 인격 도메인이 아니다.** 6건 전부 E.G.O 스킬 `4th Match Flame`(id 2010211·2010221·2040211·2040221·2090211·2090221) 이고 `identity_skill` 연결이 0이다. 인격 스킬 828건 중 동기화 5에서 변하는 것은 0건이다.

4. **동기화 3 시작 216건의 정체가 확정됐다.** 206건이 슬롯 3 = 게임의 "Skill 3, Tier III 해금". 나머지 10건(방어 7 등)은 별개 사유로 남는다.

5. **유닛 키워드 한국어명은 위키가 아니라 raw 에 있다.** 25/36 이 `identities/loc-ko/UnitKeyword*.json` 에서 id 정합으로 즉시 나온다. 위키의 역할은 "이것이 게임 화면에 뜨는 태그인가"를 확정해 준 것이다(뜬다. `Traits` 필드).

6. **우리 `season` 코드계는 위키와 완전히 정합하다.** `0`=Standard Fare, `1–7`=정규 시즌, `91NN`=발푸르기스의 밤 N회차(9103 ↔ Walpurgisnacht III 확인). 화면에 `S0` 이 아니라 `상시` 로 쓰는 것을 검토할 만하다.

## 부록 · 출처 신뢰도

- `limbuscompany.wiki.gg` — 인포박스가 위키텍스트 파라미터(`|season=`, `|releasedate=`, `|keyword=`, `|passiveN=`)로 구조화돼 있어 `action=raw` 로 원본을 읽을 수 있다. 이번 판정의 근거는 대부분 이 원본이다. 가장 신뢰도가 높다.
- `limbuscompany.fandom.com` — HTTP 402 로 접근 불가(유료화/차단). 대조 못 했다.
- `prydwen.gg` — HTTP 403. 대조 못 했다.
- 위키 간 상충은 발견되지 않았다(비교 자체가 성립하지 않았다). 위키 ↔ 우리 데이터 상충은 2항(public 출시일) · 3항(canonical season NULL) 두 건이며 둘 다 위키·raw 가 같은 편이라 위키 단독 근거가 아니다.
