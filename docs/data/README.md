# 데이터 마스터북 (Data Masterbook)

> 상태: 진행 중 / 착수 2026-07-29 · 스냅샷 2026-07-25
> 설계는 `docs/superpowers/specs/2026-07-29-data-masterbook-design.md` 에 있다.

`data/` 에 수집한 원본 JSON의 **모든 프로퍼티**가 각각 무슨 뜻이고, 변환을 거쳐 어디에 적재되고,
화면에 어떤 레이블로 나타나는지를 필드 단위로 기록한다.

## 1. 다른 문서와의 경계

| 문서 | 다루는 것 |
| --- | --- |
| `docs/01-data-source.md` | 어떤 출처를 왜 골랐나 |
| `docs/02-data-model.md` | 우리가 만든 엔티티가 어떤 모양인가 |
| `docs/03-data-provenance.md` | 원본이 어떤 경로로 생성되었나 |
| `docs/04-data-inventory.md` | 빠짐없이 수집했다는 근거 |
| **여기** | **원본 필드 하나하나가 무슨 뜻이고 어디로 가는가** |

중복 서술 대신 링크한다.

## 2. 파일 이름 규칙

```
<엔티티>/<회차 2자리>-<출처 id>-<원본 파일명>.md

identity/01-limbus-data-mj-identities.md          ← limbus-data-mj/identities.json
identity/02-limbus-data-mj-identities-detail.md   ← limbus-data-mj/identities_detail.json
identity/06-limbus-assets-identities.md           ← limbus-assets/identities.json
```

**출처 id를 줄이지 않는다.** `mj` 같은 축약은 처음 읽는 사람이 해독할 수 없다.
출처 id는 `data/` 디렉토리 규약(`<성격>/<분류>/<출처>/<파일>`)과 `04-data-inventory.md` 의
표기를 그대로 쓴다. 원본 파일명의 `_` 는 `-` 로 바꾼다.

## 3. 읽는 법

필드마다 표 하나가 붙는다. 칸의 뜻은 다음과 같다.

| 칸 | 내용 |
| --- | --- |
| 타입·실측 | 타입 + **실제로 세어본** 분포·범위·결손 건수. 추정치를 적지 않는다 |
| 의미 | 게임에서 무엇을 뜻하는지. 필요하면 위키 링크 |
| 변환 | `src/entities/*.ts` 의 어느 함수가 어떻게 다루는지. 통과·개명·계산·병합·폐기 |
| 적재 | `테이블.컬럼`, 또는 **미적재 + 사유** |
| 화면 | 화면 파일과 레이블 문자열, 또는 **미표시** |
| 함정 | 이름이 거짓말하거나 직관과 다른 점. 없으면 "없음" |

### 층을 섞지 않는다

같은 개념이 층마다 다른 값을 갖는다. 어느 층의 이야기인지 밝히지 않으면 잘못된 결론이 나온다.

```
척추   원본 JSON 필드          ← 이 문서의 기준
변환   src/entities/*.ts
적재   PostgreSQL 테이블
화면   app/[locale]/**/page.tsx
```

## 4. 방법

- **실측**: 회차마다 일회용 프로브를 돌려 집계한다. 프로브는 커밋하지 않고 숫자만 남긴다.
- **게임 지식**: 정본 위키는 [Limbus Company Wiki](https://limbuscompany.fandom.com) 다.
  한국어 표시 문자열은 위키 번역이 아니라 `loc-ko` 원문을 따른다.
- **미해결**: 위키로 풀리면 그 자리에서 각주를 단다. 어디에도 없으면 `❓ 미확인` 으로 남기고
  `docs/backlog/` 에 항목을 만든다.

### 출처 간 불일치는 회차 중에 단정하지 않는다

두 출처는 **각자 자기 도구에 맞는 구조**를 갖는다(`identity/00-overview.md` 5.1).
한쪽에만 있는 값을 보고 "결손"·"유령 데이터"로 판정하면 틀릴 수 있다.

| 하는 것 | 하지 않는 것 |
| --- | --- |
| 양쪽 값과 개수를 실측해 적는다 | 어느 쪽이 틀렸다고 단정한다 |
| 게임 화면·위키로 확인한 범위를 명시한다 | 확인 범위를 넘어 일반화한다 |
| 「관측」으로 기록하고 회차를 계속한다 | 판정을 근거로 스키마·변환을 바꾼다 |

**판정은 인격 편(회차 1–14)을 모두 마친 뒤 일괄로 한다.** 그때 `00-overview.md` 5.2 장부가
차 있고, 같은 개념을 여러 각도에서 본 결과가 모여 있다.

게임 화면 확인도 범위가 있다. 인격 상세 화면에 없다는 것은 **그 화면에 없다**는 뜻이며,
게임 데이터에 없다는 뜻이 아니다. 적으로 등장할 때나 내부 처리용일 수 있다.

## 5. 진행 현황

### 인격 (Identity) — 14회차 · **완료 2026-07-30**

| # | 대상 | 상태 |
| --- | --- | --- |
| 1 | [`limbus-data-mj/identities.json`](identity/01-limbus-data-mj-identities.md) | **완료** 2026-07-29 · 키 23종 |
| 2 | [`limbus-data-mj/identities_detail.json`](identity/02-limbus-data-mj-identities-detail.md) | **완료** 2026-07-29 · 키 16종 |
| 3 | [`limbus-data-mj/skills.json`](identity/03-limbus-data-mj-skills.md) | **완료** 2026-07-30 · 키 7종 + 서브키 6종 |
| 4 | [`limbus-data-mj/passives.json`](identity/04-limbus-data-mj-passives.md) | **완료** 2026-07-30 · 키 6종 |
| 5 | [`limbus-data-mj/associations.json`](identity/05-limbus-data-mj-associations.md) | **완료** 2026-07-30 · 키 2종 |
| 6 | [`limbus-assets/identities.json`](identity/06-limbus-assets-identities.md) | **완료** 2026-07-30 · 키 17종 |
| 7 | [`limbus-assets/identities_mini.json` + `shared-library` 동형 2종](identity/07-limbus-assets-identities-mini.md) | **완료** 2026-07-30 · 키 10+15+8종 |
| 8 | [`limbus-assets/passives.json` + `skill_tags.json`](identity/08-limbus-assets-passives.md) | **완료** 2026-07-30 · 최상위 2종 + 토큰 72종 |
| 9 | [assets 부속 4종](identity/09-limbus-assets-aux.md) | **완료** 2026-07-30 · 4파일 |
| 10 | [`identity-details/{id}.json` 184 + 163개](identity/10-limbus-assets-identity-details.md) | **완료** 2026-07-30 · 최상위 7종 |
| 11 | [`loc-*/Personalities*.json` + `Personality_Get_Condition.json`](identity/11-loc-personalities.md) | **완료** 2026-07-30 · 4파일 × 3로케일 |
| 12 | [`loc-*/Skills_personality-NN.json` + `Skills.json`](identity/12-loc-skills.md) | **완료** 2026-07-30 · 16파일 × 3로케일 |
| 13 | [`loc-*/Passives*.json` + `UnitKeyword*.json` + `AssociationName.json`](identity/13-loc-passives-keywords.md) | **완료** 2026-07-30 · 16파일 × 3로케일 |
| 14 | [`data/assets/` 인격 이미지 712개](identity/14-assets-identity-images.md) | **완료** 2026-07-30 · 712개 |

**인격 편 결산** — 14회차 전부 미해결 없이 닫혔다. 정본 판정과 원본 오타 목록은
`identity/00-overview.md` 5.3–5.5 에 있다.

### E.G.O — 9회차 · **완료 2026-07-30**

계열 지도는 [`ego/00-overview.md`](ego/00-overview.md).

| # | 대상 | 상태 |
| --- | --- | --- |
| 1 | [`limbus-data-mj/egos.json`](ego/01-limbus-data-mj-egos.md) | **완료** 2026-07-30 · 키 12종 |
| 2 | [`limbus-data-mj/egos_detail.json`](ego/02-limbus-data-mj-egos-detail.md) | **완료** 2026-07-30 · 키 8종 |
| 3 | [`limbus-assets/egos.json`](ego/03-limbus-assets-egos.md) | **완료** 2026-07-30 · 키 12종 |
| 4 | [`limbus-assets/egos_mini.json` + 부속 2종 + `shared-library` 대조](ego/04-limbus-assets-egos-mini-aux.md) | **완료** 2026-07-30 · 5파일 |
| 5 | [`ego-details/limbus-assets/{id}.json` 110개](ego/05-limbus-assets-ego-details.md) | **완료** 2026-07-30 · 최상위 5종 |
| 6 | [`loc-*/Egos.json`](ego/06-loc-egos.md) | **완료** 2026-07-30 · 3로케일 × 2파일 |
| 7 | [`loc-*/Skills_Ego*.json` 최대 16파일 × 3로케일](ego/07-loc-skills-ego.md) | **완료** 2026-07-30 · 210건 |
| 8 | [`loc-*/Passive_Ego.json`](ego/08-loc-passive-ego.md) | **완료** 2026-07-30 · 113건 |
| 9 | [`data/assets/egos/` 318개](ego/09-assets-ego-images.md) | **완료** 2026-07-30 · 318개 |

**E.G.O 편 결산** — 9회차 전부 미해결 없이 닫혔다. 정본 판정과 원본 결함 목록은
`ego/00-overview.md` 5.2–5.4 에 있다.

척추가 인격 편과 뒤집힌다 — `limbus-assets` 가 정본이다(`src/entities/egos.ts:47`).
단독 보유 개념은 **mj 1 · assets 6 · loc 4** 이며, 그중 `abName`(유래 환상체)은
**로케일 파일에만 있다.**

### E.G.O 기프트 — 8회차 · 진행 중

계열 지도는 [`gift/00-overview.md`](gift/00-overview.md).

| # | 대상 | 상태 |
| --- | --- | --- |
| 1 | [`limbus-data-mj/gifts.json`](gift/01-limbus-data-mj-gifts.md) | **완료** 2026-07-31 · 키 15종 |
| 2 | [`limbus-data-mj/gifts_detail.json`](gift/02-limbus-data-mj-gifts-detail.md) | **완료** 2026-07-31 · 키 4종 |
| 3 | [`limbus-assets/gifts.json` + `shared-library` 대조](gift/03-limbus-assets-gifts.md) | **완료** 2026-07-31 · 키 22종 |
| 4 | [`mj/start_gifts.json` + `assets/md__universal_gifts.json`](gift/04-gifts-aux.md) | **완료** 2026-07-31 · 2파일 |
| 5 | `loc-*/EGOgift_MirrorDungeon*.json` 9파일 × 3로케일 | 미착수 |
| 6 | `loc-*/EGOgift_StoryDungeon*` + 이벤트·발푸르기스 계열 | 미착수 |
| 7 | `loc-*/EGOgift.json` + `EgoGiftCategory` + `LockedDesc` | 미착수 |
| 8 | `data/assets/gifts/` 476개 | 미착수 |

### 그 밖의 엔티티

파일 규모로 잡은 예상 회차다. 인격 편에서 공통 어휘(죄악 7 · 공격 타입 3 · 기믹 축 10 ·
토큰 치환표 4,497종)와 구조 패턴(델타 · 접미 규칙 · 번호 공간 충돌 · id 대역)이 이미
잡혔으므로 뒤로 갈수록 가벼워진다.

| 편 | 파일 | 예상 회차 | 비고 |
| --- | ---: | ---: | --- |
| 팩 | 7 | ~3 | 가장 작다 |
| 거울 던전 | 163 | ~6 | |
| 상태(메카닉) | 260 | ~6 | 08 문서의 `status_gimmick` 근거 |
| 인카운터 | 380 | ~8 | `assets` 251개가 동형이면 묶인다 |

## 6. 회차 문서와 주제 문서

문서가 두 종류다. **역할이 다르므로 섞지 않는다.**

| | 회차 문서 | 주제 문서 |
| --- | --- | --- |
| 예 | `identity/01-limbus-data-mj-identities.md` | `../08-gimmick-keywords.md` · `../09-resistance.md` |
| 단위 | 원본 파일 하나(척추) | 개념 하나 |
| 역할 | **커버리지 장부** — 이 파일의 키를 하나도 빠뜨리지 않았다 | **변환·적재 결정** — 여러 출처를 종합하면 이렇게 담아야 한다 |
| 독자 | 나중에 "이 필드 왜 안 쓰지?" 물을 사람 | 스키마와 파이프라인을 고칠 사람 |

회차 문서의 **이름은 척추를 가리킬 뿐 범위가 아니다.** 필드의 뜻을 가리려면 다른 출처를
끌어와야 하며, 무엇을 봤는지는 각 회차 문서의 「대조한 출처」 절에 적는다.

파일 순으로 도는 이유는 **빠뜨림을 막기 위해서다.** 개념 단위로만 가면 `slotId` ·
`teamCodeEligible` 처럼 쓰이지 않는 필드를 건너뛰게 되고 나중에 "이건 왜 없지"가 남는다.
반대로 결정은 개념 단위여야 한다 — 기믹 축 하나를 정하는 데 mj 4필드 + assets 3파일 +
스킬 코인을 전부 봐야 했다.

주제 문서는 **미리 목차를 짜지 않는다.** 필요해질 때 갈라져 나온다.

### 갈라져 나온 것

| 문서 | 내용 | 나온 회차 |
| --- | --- | --- |
| [`../08-gimmick-keywords.md`](../08-gimmick-keywords.md) | 기믹 축이 인격·E.G.O·기프트 조합으로 정해지는 구조 | 1 |
| [`../09-resistance.md`](../09-resistance.md) | 저항의 두 축과 E.G.O 종속 관계 | 1 |
| [`../backlog/01-identity-tags.md`](../backlog/01-identity-tags.md) | 인격 태그의 이름이 틀렸다(→ `trait`) | 1 |
| [`../backlog/05-season-label.md`](../backlog/05-season-label.md) | 시즌 값이 원본 정수 그대로 화면에 나간다 | 1 |
| [`../backlog/06-atktypes-naming.md`](../backlog/06-atktypes-naming.md) | `atkTypes` 가 세 곳에서 다른 단위를 가리킨다 | 1 |
| [`../backlog/08-gift-hardonly.md`](../backlog/08-gift-hardonly.md) | 하드 전용 기프트를 한 출처만 보고 적재한다 | 기프트 1 |
