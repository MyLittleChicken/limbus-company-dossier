# 인격 계열 지도 (Identity Overview)

> 상태: 초안 / 최종 수정 2026-07-29 · 스냅샷 2026-07-25
> 회차가 진행되며 계속 고쳐진다. 처음부터 완성하지 않는다.

## 1. 인격 id 체계

```
1 | 수감자(2자리) | 순번(2자리)

10101 = 수감자 01(이상)의 1번째 인격
11216 = 수감자 12(그레고르)의 16번째 인격
```

**184건 전부 이 규칙을 지킨다**(위반 0). 순번 범위는 1–16이며, 원본의 `slotId` 와 뒤 2자리가
184/184 일치한다.

E.G.O는 같은 자리에 `2` 를 쓴다 — `20509` = 수감자 05(뫼르소)의 9번째 E.G.O.

## 2. 수감자별 인격 수

```
1 이상 16 · 2 파우스트 16 · 3 료슈 14 · 4 돈키호테 15 · 5 뫼르소 15 · 6 홍루 15
7 히스클리프 16 · 8 이스마엘 15 · 9 로쟈 16 · 10 싱클레어 15 · 11 오티스 15 · 12 그레고르 16
```

료슈만 14로 가장 적다.

## 3. 원본 파일 16종

| 파일 | 회차 | 성격 |
| --- | --- | --- |
| `limbus-data-mj/identities.json` | 1 | **정본** · 인격 본체 184건 |
| `limbus-data-mj/identities_detail.json` | 2 | **정본** · 스탯·정신 조건 |
| `limbus-data-mj/skills.json` | 3 | **정본** · 스킬 |
| `limbus-data-mj/passives.json` | 4 | **정본** · 패시브 |
| `limbus-data-mj/associations.json` | 5 | **정본** · 조직 64종 |
| `limbus-assets/identities.json` | 6 | 관계의 정본 · 태그·상태 |
| `limbus-assets/identities_mini.json` | 7 | 요약판 |
| `shared-library/identities.json` · `identities_mini.json` | 7 | 구버전 대조 |
| `limbus-assets/passives.json` · `skill_tags.json` | 8 | 태그 사전 |
| `limbus-assets/alt_names.json` | 9 | 별칭 |
| `limbus-assets/identity_tag_list.json` | 9 | 태그 목록 95항목(마크업 제거 후 93종) |
| `limbus-assets/identity_header_offsets.json` | 9 | 이미지 표시 오프셋 |
| `limbus-assets/identity_keyword_modifiers.json` | 9 | **조건부 기믹 3건** |
| `identity-details/limbus-assets/{id}.json` | 10 | 인격별 상세 184개 |
| `loc-ko` · `loc-en` · `loc-ja` | 11–13 | 표시 문자열 |

## 4. DB 모델 10종

```
Sinner ─┬─ SinnerText
        └─ Identity ─┬─ IdentityText
                     ├─ IdentityResist    (atkType × 3)
                     ├─ IdentitySpeed     (uptie × 4)
                     ├─ IdentityAffiliation ─ Affiliation ─ AffiliationText
                     ├─ IdentityStatus ─ Status
                     ├─ Skill ─ SkillStage ─ SkillCoin
                     └─ IdentityPassive ─ Passive
```

## 5. 출처별 개념 보유 장부

**회차마다 갱신하는 누적 장부다.** 인격 편(회차 1–14)을 마치면 이 표가 정본 배정을
필드 단위로 다시 짤 근거가 된다.

### 5.1 왜 필요한가

ADR-04는 정본을 **엔티티 단위**로 배정했다 — "인격은 `limbus-data-mj`, 관계는 `limbus-assets`".
그런데 실측은 **개념 단위**로 갈린다. 회차 1–2까지 확인된 것만 보아도 어느 쪽도 상대의
부분집합이 아니다.

```
limbus-data-mj 에만 있는 것          limbus-assets 에만 있는 것
  한국어 인라인(nameKo·titleKo)        statuses (인격이 다루는 상태 전부)
  mentalCondition (정신력 조건 23종)    identity_keyword_modifiers (조건부 기믹)
  passives 의 cost (해금 단계)          passives 의 condition (죄악 자원 요건)
  unitKeywords (내부 플래그 포함)        E.G.O 의 statuses · resists
  스킬 12개 (assets 누락분)             tags 의 Le Sette Famiglie
  appearance (내부 애셋명)              identity_tag_list · header_offsets · alt_names
```

성격이 다르다.

| 출처 | 성격 | 특징 |
| --- | --- | --- |
| `limbus-data-mj` | **DB형** | 정규화, 한국어 병기, 조건을 id 문자열로 인코딩 |
| `limbus-assets` | **도구형** | 화면에 뿌릴 것 위주, 표시 오프셋·별칭까지 |

**가설** — 두 출처는 각자 자기 도구에 필요한 만큼 완결적이며, 서로의 결손이 아니라
구조가 다른 것이다. 회차 6(`limbus-assets/identities.json`)에서 mj에 없는 필드가
무더기로 나오면 이 가설이 강화된다.

단, 실제 결손·오타도 존재한다(회차 1의 `20306` 연도 오타 · 회차 2의 스킬 12개 누락).
가설이 맞더라도 **교차 검증은 계속 필요하다.**

### 5.2 장부

| 개념 | `limbus-data-mj` | `limbus-assets` | 정본 | 근거 | 회차 |
| --- | --- | --- | --- | --- | --- |
| 체력 | `identities.hp`(base만) · `identities_detail.hp`(base+증가량) | `identities.hp` | **mj detail** | 증가량은 여기만 있다 | 1·2 |
| 저항(공격 타입) | `identities.resists` · `identities_detail.resists` | `identities.resists` | **mj detail** | 3곳 184/184 동일 | 1·2 |
| 스태거 | `identities.stagger` · `identities_detail.stagger` | — | **mj detail** | 값 동일, 요약 중복 | 1·2 |
| 속도 | `identities.speed`(만렙 1쌍) · `identities_detail.minSpeed`/`maxSpeed`(4쌍) | — | **mj detail** | 단계별 값은 여기만 | 1·2 |
| 방어 보정 | `identities_detail.defCorrection` | `identities.defCorrection` | **mj detail** | 184/184 동일 | 2 |
| 정신력 조건 | `identities_detail.mentalCondition` | — | **mj** | assets 에 없다 | 2 |
| 공격 스킬 | `identities_detail.attackSkills` | `identities.skillTypes` | **mj** | assets 가 6개 누락 | 2 |
| 방어 스킬 | `identities_detail.defenseSkills` | `identities.defenseSkillTypes` | **mj** | assets 가 6개 누락 | 2 |
| 패시브 목록 | `identities_detail.battlePassives`/`supporterPassives` | `passives.json` 의 `uptie` | **mj** | 단계별 스냅샷은 여기만 | 2 |
| 패시브 해금 단계 | `passives.json` 의 `cost` | `passives.json` 의 `uptie` | 미정 | 둘 다 있다 · 회차 4·8에서 대조 | 2 |
| 패시브 죄악 요건 | — | `passives.json` 의 `condition` | **assets** | mj 에 없다 | 2 |
| 조직 | `identities.associations`(64) · `associations.json` | `identities.tags` 중 조직 | **assets** | 표시용은 게임 표기와 1:1 | 1 |
| 특성 키워드 | `identities.associations` + `identities_detail.unitKeywords` | `identities.tags`(93) | **assets** | mj 는 두 필드로 쪼개고 `Le Sette Famiglie` 가 없다 | 1·2 |
| 기믹 키워드(기본) | `identities.keywords`(7종) | `identities.skillKeywordList` | 동일 | 표기만 대소문자 차이 | 1 |
| 인격이 다루는 상태 | — | `identities.statuses` | **assets** | mj 에 없다 | 1 |
| 조건부 기믹 | `identities.egoKeywords`(1건) | `identity_keyword_modifiers.json`(3건) | **합집합** | 서로 못 덮는다 | 1 |
| 대체 스킬 | `identities_detail.attackSkills` 의 `copies:0`(38건) | `identities.skillTypes` 의 `num:0`(37건) | **mj** | `10712` 가 assets 에 없다 | 1·2 |
| 출시일 | `identities.updatedDate` | `identities.date` | **mj + 보강** | 미래 날짜면 assets 로 채운다 | 1 |
| 시즌 | `identities.season`(182/184) | `identities.season` · `identities_mini.season` | **mj + 보강** | 결손 2건을 assets 로 채운다 | 1 |
| 표시 문자열(ko) | `identities.nameKo`/`titleKo` · `skills`·`passives` 의 `*Ko` | — | **mj** | assets 는 영문만 | 1 |
| 외형 애셋명 | `identities_detail.appearance` | `identity_header_offsets.json` | 다른 것 | 전자는 내부명, 후자는 표시 오프셋 | 2 |
| 스킬 분류 | `skills.json` 의 `sin`·`attackType`·`defType`·`skillTier` | `identities.skillTypes[].type` | **mj** | assets 가 12개 누락 | 3 |
| 죄악 해금 단계 | `skills.json` 의 `sinFrom`(131건) | `skillTypes[].type.affinityUptie`(131건) | 동일 | 131/131 값·집합 완전 일치 | 3 |
| **합 가능 여부** | — | `defenseSkillTypes[].type.clashable`(52건) | **assets** | mj 에 없다. 우리 `Skill` 모델에도 없다 | 3 |
| E.G.O 스킬 | `skills.json` 의 `2xxxxxx` 대역 208건 | `ego-details/` | **미적재** | `Skill` 이 `identityId` 필수라 담을 자리가 없다 | 3 |
| 스킬 이름·설명(ko) | `skills.json` 의 `levels[].nameKo`·`descKo` | — | **mj** | assets 는 영문만 | 3 |
| 코인 개수·순서·종류 | — | `identity-details/{id}.json` | **assets** | mj 는 효과 문자열만 | 3 |
| 코인 효과(영문) | `skills.json` 의 `levels[].coins` | `identity-details` 의 `coins[].descs` | **assets** | 우리는 assets 를 쓴다 | 3 |
| 코인 효과(한국어) | — | — | **loc-ko** | 양쪽 다 영문뿐. `Skills_personality-NN.json` 만 갖는다 | 3 |
| 각성/침식 구분 | `skills.json` id 접미 `11`/`21` | `egos.json` 의 `awakeningType`·`corrosionType` | 미정 | E.G.O 편에서 판정 | 3 |
| 패시브 이름·설명(ko) | `passives.json` 의 `nameKo`·`descKo` | — | **mj** | assets 는 영문만 | 4 |
| 패시브 해금 조건 | `passives.json` 의 `cost`(5종 토큰) | `passives.json` 의 `uptie` · `identity-details` 의 `combatPassives[].uptie` | **assets** | 우리는 detail 의 `level` 을 쓴다 | 4 |
| 패시브 목록 구성 | `identities_detail.json` 의 `battlePassives` | `identity-details` 의 `combatPassives` | **assets** | mj 는 스킬 6건을 패시브로 잘못 올린다 | 4 |
| E.G.O 패시브 | `passives.json` 의 `2xxxxxx` 113건 | `ego-details` 의 `passiveList` + `loc-*` | **assets+loc** | mj 는 조회되지 않는다 | 4 |
| 조직 코드 사전 | `associations.json`(64종 · UPPER_SNAKE) | `identity_tag_list.json`(93종 · 영문 표기) | **assets** | `affiliation.id` 가 영문 표기다 | 5 |
| 조직 계층 | 접두사 문자열에만 (`BLACK_BEAST_*`) | 인격마다 상위·하위 태그를 **둘 다** 붙임 | **assets** | 구조로 담은 출처가 없다 | 1·5 |
| 스포일러 마크업 | 없음 | `identity_tag_list.json` 5건 | **assets** | mj 는 해당 태그 자체가 없다 | 5 |
| 기프트 조건 기믹 축 | `keywords`(1건 다름) | `skillKeywordList` | **assets** | `10104` 가 게임 판정 기준을 드러냈다 · 08 문서 4.1 | 6 |
| 이벤트 출신 | — | `event`(31) · `eventReward`(13) | **assets** | mj 에 없다. 역사 정보라 대체 불가 | 6 |
| 합 가능·죄악 해금 세부 | — | `defenseSkillTypes[].type` 의 `atkType`·`affinityUptie`·`clashable` | **assets** | `atkType` 과 `affinityUptie` 는 상호 배타적 | 6 |

**미기입** — 회차 7 이후에 채운다. 스킬 상세 · 코인 · 패시브 본문 · 로컬라이즈 · 애셋.

## 6. 화면

| 화면 | 파일 |
| --- | --- |
| 목록 | `app/[locale]/identities/page.tsx` |
| 상세 | `app/[locale]/identities/[id]/page.tsx` |
| 스킬 패널 | `components/uptie-skills.tsx` |
| 질의 | `lib/queries/identities.ts` |
