# 인격 태그 — 이름이 틀렸다 (분리는 불필요)

> 상태: **결론 변경 2026-07-29** / 최초 조사 2026-07-27
> 축을 둘로 나누기로 했으나, 실측 결과 **나눌 필요가 없다.** 남는 문제는 이름 하나다.
> 조사용 분류 시트가 저장소 루트 `tags-classify.csv` 에 있다(추적하지 않는다).

## 1. 무엇이 문제였나

인격에 붙는 태그를 **소속(Affiliation)** 이라는 이름으로 93종 적재했다.
그런데 이 목록은 성격이 다른 값을 한 축에 담고 있다.

인격 10916(태그 7종)이 그 증거다. 원본 값은 다음과 같다.

```
["<color=#d40000><s>Le Sette Famiglie<s></color>",
 "<color=#d40000><s>Sottocapo</s></color>",
 "Smoke War", "The Fingers", "The House of Spiders", "The Thumb", "War Hero"]
```

| 값 | 성격 |
| --- | --- |
| `The House of Spiders` · `Le Sette Famiglie` | 조직 |
| `The Fingers` → `The Thumb` | 상위 조직과 그 하위 분파 |
| `Sottocapo` | 그 조직 안에서의 계급 (언더보스) |
| `Smoke War` | 참전한 사건 (연기전쟁) |
| `War Hero` | 칭호 (전쟁영웅) |

조직·분파·계급·사건·칭호가 평탄화되어 하나의 배열에 들어 있다.

## 2. 게임은 이것을 "특성 키워드" 라 부른다

2026-07-29 확인. 게임 화면의 인격 정보에 **「특성 키워드」** 항목이 있고, 값이 원본 `tags` 와
정확히 일치한다.

```
게임 화면 (10916 거미집 엄지 아비 · 로쟈)
  엄지 · 거미집 · 7대 패밀리 · 언더보스 · 손가락 · 연기전쟁 · 전쟁영웅

assets.tags
  The Thumb · The House of Spiders · Le Sette Famiglie · Sottocapo ·
  The Fingers · Smoke War · War Hero
```

**7종 1:1 완전 일치.** 원본 필드명도 `affiliations` 가 아니라 **`tags`** 다.
`src/entities/basics.ts` 의 `buildAffiliations` 가 이것을 "소속" 으로 명명한 것이 오역이다.

`Smoke War`(연기전쟁) · `War Hero`(전쟁영웅) · `Dihui Star`(지혜성)를 소속이라 부를 수 없다.

## 3. 기능적으로 조건이 되는 것은 28종이다

기프트의 `triggers` 토큰이 `{태그} Identities` 형태로 소속 조건을 담는다.
**설명문 파싱이 아니라 구조화된 토큰이다.**

전수 집계 결과 **93종 중 28종**이 등장한다.

| 참조 횟수 | 태그 |
| ---: | --- |
| 10 | Blade Lineage(검계) |
| 8 | Kurokumo Clan(흑운회) · The Middle(중지) |
| 7 | The Ring(약지) |
| 5 | Bloodfiend(혈귀) |
| 3 | The Pequod · Limbus Company · N Corp. Fanatic · Heishou Pack - Mao Branch · W Corp. · MultiCrack Office |
| 2 | Cinq Assoc. · Technology Liberation Alliance · The Index · La Manchaland · Yurodivy |
| 1 | Shi/Seven/Zwei/Dieci/Liu Assoc. · Lobotomy Corp. · LCE · Dawn Office · The Thumb · T Corp. · Heishou Pack - You/Wu Branch |

나머지 65종은 조건으로 한 번도 등장하지 않는다.

## 4. 그런데 분리할 필요가 없다 — 실측 두 가지

### 4.1 계층이 이미 펼쳐져 있다

하위 태그를 가진 인격은 **상위 태그도 이미 갖고 있다.** 전수 확인.

| 하위 → 상위 | 일치 | | 하위 → 상위 | 일치 |
| --- | ---: | --- | --- | ---: |
| The Thumb → The Fingers | 4/4 | | Heishou Pack - Mao → Heishou Pack | 3/3 |
| The Index → The Fingers | 3/3 | | Heishou Pack - Wu → Heishou Pack | 1/1 |
| The Middle → The Fingers | 6/6 | | Heishou Pack - You → Heishou Pack | 2/2 |
| The Ring → The Fingers | 6/6 | | Heishou Pack - Wei → Heishou Pack | 1/1 |
| The Pinky → The Fingers | 1/1 | | Heishou Pack - Si → Heishou Pack | 2/2 |
| Lobotomy Corp. HQ → L Corp. | 9/9 | | Lobotomy Corp. Branch → L Corp. | 1/1 |

**12/12 전부 일치.** "손가락 소속 3인 이상" 조건은 `The Fingers` 태그를 세면 그만이다.
`parent` 컬럼이 필요 없다.

### 4.2 조인이 태그 종류를 가리지 않는다

기프트 참조 28종을 실제 인격 태그와 대조한 결과 **조인 실패 0건**이다.

```
Bloodfiend(종족)      → 인격 5    조인 성공
The Middle(분파)      → 인격 6    조인 성공
Dawn Office(사무소)   → 인격 3    조인 성공
Limbus Company(회사)  → 인격 22   조인 성공
```

종족이든 분파든 사무소든 **똑같이 태그 id 하나로 조인된다.** 분류 컬럼이 판정에 관여하지 않는다.

### 4.3 따라서

| 하려던 것 | 판정 |
| --- | --- |
| `kind` 컬럼 (organization / rank / species / meta) | **불필요.** 조인은 태그 id로 되고 분류는 사람이 읽을 때만 쓴다 |
| `parent` 컬럼 | **불필요.** 상위 태그가 이미 인격마다 붙어 있다 |
| 30종 수작업 분류 | **불필요** |

어떤 태그가 미래의 기프트·패시브 조건이 될지 알 수 없다. 지금 분류를 굳히면 그때마다
분류를 고쳐야 한다. **평평한 태그 + 조인**이 변화에 강하다.

현재 구조(`affiliation` 평평한 태그 + `identity_affiliation` N:M)가 이미 맞다.

## 5. ADR-04 2.2 의 근거가 성립하지 않는다

ADR-04 2.2 는 소속의 정본을 `limbus-assets` 로 두면서 이렇게 적었다.

> 인격–소속 | mj 가 주는 값 `LIMBUS_COMPANY_LCB` 형태의 64종 | 우리 테이블이 요구하는 값 `Limbus Company` 형태의 93종
> **어휘 체계가 다르다.**

**`LIMBUS_COMPANY_LCB` 는 `associations.json` 의 내부 키이고, 같은 파일의 `name` 필드는
`Limbus Company` 형태다.** 63종이 문자열까지 일치한다. 키만 보고 어휘가 다르다고 판단한 것으로 보인다.

다만 **정본은 그대로 `limbus-assets` 가 맞다.** mj의 64종은 좁다 — 10916 의 경우 mj는
`엄지 · 거미집` 2종만 주고 조직인 `7대 패밀리` 조차 빠진다. ADR 의 결론은 유지하되 근거 문장을
정정한다.

## 6. 옆 프로젝트와의 교차 검증

`limbus-ego-gift-recommender` 의 작업 세션에 같은 질문을 보내 답을 받았다(2026-07-27).

| 질문 | 답 |
| --- | --- |
| 소속과 태그를 구분하는가 | **안 한다.** 슬러그 정규화와 조인으로 우회한다 |
| 기프트 조건의 표현 | 빌드 시점 AST 정규화. **원본 `triggers` 토큰 기반이며 설명문 파싱이 아니다** |
| 복합 조건 | 구조상은 단일 토큰이고 복합은 설명문에만 있다 |
| 스포일러 마크업 | 그쪽에는 없다 |

**그쪽 판단이 옳았다.** 2026-07-29 실측이 같은 결론에 도달했다(4절).
당시 "우리는 필터를 노출하므로 통하지 않는다"고 적었으나, 그것은 **화면 문제**이지
스키마 문제가 아니다 — 필터에 무엇을 노출할지는 조회 조건으로 정한다.

그쪽이 남긴 미결도 함께 받았다 — **소속 조건의 판정 범위가 기프트마다 다르다.**
기프트 9282 는 `(편성 인원을 기준으로 함)`, 9263 은 `(출격 인원을 기준으로 함)` 이다.
`lib/engine/vocab.ts` 의 `refineAffiliation` 이 이를 다룬다.

## 7. 남은 일 둘

### 7.1 이름을 `trait` 으로 바꾼다 — 결정 2026-07-29

게임이 「특성 키워드」라 부르므로 `affiliation`(소속)은 오역이다.

| 층 | 지금 | 바꾼 뒤 |
| --- | --- | --- |
| 스키마 | `Affiliation` · `AffiliationText` · `IdentityAffiliation` | `Trait` · `TraitText` · `IdentityTrait` |
| 테이블 | `affiliation` · `affiliation_text` · `identity_affiliation` | `trait` · `trait_text` · `identity_trait` |
| 변환 | `buildAffiliations` (`src/entities/basics.ts`) | `buildTraits` |
| 엔진 | `COUNT_AFFILIATION` · `refineAffiliation` · `AFFILIATION_ALIAS` | `COUNT_TRAIT` · `refineTrait` · `TRAIT_ALIAS` |
| 질의 | `listAffiliations` (`lib/queries/identities.ts`) | `listTraits` |
| 화면 | 패널 "소속" · 필터 "소속" · `?affiliation=` | "특성 키워드" · `?trait=` |

**마이그레이션은 없다.** ADR-02 5절 원칙 2가 전체 재생성을 정했으므로 DDL 재생성 후
재적재하면 끝난다. 비용은 코드 편집량이며 UI 가 늘수록 커진다.

`?affiliation=` URL 이 바뀌므로 **인격 편 마스터북 작업이 끝난 뒤 한 번에 처리한다.**

### 7.2 별칭 표의 미해결 참조를 검사한다 — 결정 2026-07-29

기프트 토큰과 태그 목록의 표기가 달라 `lib/engine/vocab.ts:216` 이 별칭 표를 둔다.

```
Cinq Assoc.   → Cinq Association        Yurodivy        → Yurodiviye
Dieci Assoc.  → Dieci Association       Lobotomy Corp.  → Lobotomy Corp. Headquarters
Liu/Seven/Shi/Zwei/Öufi/Devyat' Assoc.  → ... Association
```

지금은 **28/28 전부 해소**되지만, 새 기프트가 새 줄임말을 쓰면 조건이 조용히 사라진다
(`resolveAffiliation` 이 `null` 을 반환하고 그 조건은 없던 것이 된다).

**`src/verify.ts` 에 "미해결 태그 참조 0건" 검사를 추가한다.** 별칭 표 자체는 코드에 둔다 —
데이터 파일로 빼면 로드 경로만 늘고 얻는 것이 없다.

## 8. 이 문서에서 취소된 계획

2026-07-27 판에 있던 다음 항목은 **하지 않는다.**

- ~~스키마를 두 축으로 나눈다~~ → 4절
- ~~`tags-classify.csv` 를 채워 분류를 확정한다~~ → 4절
- ~~인격 목록의 필터는 소속만 쓰고 인격 태그는 상세에만 표시한다~~ → 화면 조회 조건으로 정할 일이며 스키마와 무관
- ~~정본을 다시 정한다~~ → 5절. 정본은 `limbus-assets` 유지, ADR 근거 문장만 정정

## 9. 확인하지 못한 것

- 스포일러 마크업 5종(`Great Sister` · `Jia Family` · `Le Sette Famiglie` · `Maestro` ·
  `Sottocapo`)을 플래그로 남길지. 지금은 `stripMarkup` 이 지우고 기록하지 않는다.
  그중 2종은 닫는 태그가 `</s>` 가 아니라 `<s>` 로 깨져 있다.
- 기업 태그 중 `L Corp.` 만 한국어가 없는 이유. `H사` · `N사` · `W사` 등은 모두 있다.
- 패시브도 태그를 조건으로 쓰는지. 기프트만 확인했다.
