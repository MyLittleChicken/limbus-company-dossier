# 데이터 마스터북 (Data Masterbook) — 설계

> 상태: 확정 v1.0 / 작성 2026-07-29
> 대상 스냅샷: 2026-07-25 (`data/manifest.json` 기준)

## 1. 목적

`data/` 에 수집한 원본 JSON의 **모든 프로퍼티**가 각각 무슨 뜻이고, ETL을 거쳐 어디로 가고,
화면에 어떤 레이블로 나타나는지를 필드 단위로 기록한다.

기존 문서와의 경계:

| 문서 | 다루는 것 |
| --- | --- |
| `docs/01-data-source.md` | 어떤 출처를 왜 골랐나 |
| `docs/02-data-model.md` | 우리가 만든 엔티티가 어떤 모양인가 |
| `docs/03-data-provenance.md` | 원본이 어떤 경로로 생성되었나 |
| `docs/04-data-inventory.md` | 빠짐없이 수집했다는 근거 |
| **마스터북 (이 설계)** | **원본 필드 하나하나가 무슨 뜻이고 어디로 가는가** |

마스터북은 위 문서들을 대체하지 않는다. 중복 서술 대신 링크한다.

## 2. 구조

### 2.1 척추

**수집 원본 JSON 파일의 필드**가 척추다. DB 스키마나 화면이 아니다.
원본 파일 순서대로 종주하고, 각 필드마다 변환·적재·표시 단계를 따라 붙인다.

이 선택의 결과: 수집했지만 **쓰지 않는 필드도 문서에 남는다.** 그것이 목적이다 —
"왜 안 쓰나"가 "무엇을 쓰나"만큼 중요한 기록이다.

### 2.2 산출물 배치

```
docs/data/
  README.md                      저장소 전체 데이터 지도 · 마스터북 읽는 법 · 진행 현황
  identity/
    00-overview.md               인격 계열 지도 (파일 16종 → DB 모델 10개 → 화면 3곳)
    01-limbus-data-mj-identities.md         회차별 파일 문서
    02-limbus-data-mj-identities-detail.md
    ...
  ego/ · gift/ · pack/ · mirror-dungeon/    (인격 편 완료 후 착수)
```

### 2.3 회차 배열 — 인격 편 (14회차)

| # | 대상 | 성격 |
| --- | --- | --- |
| 1 | `limbus-data-mj/identities.json` | 정본 · 인격 본체 184건 |
| 2 | `limbus-data-mj/identities_detail.json` | 정본 · 스탯·정신 조건 |
| 3 | `limbus-data-mj/skills.json` | 정본 · 스킬 (2.2 MB) |
| 4 | `limbus-data-mj/passives.json` | 정본 · 패시브 |
| 5 | `limbus-data-mj/associations.json` | 정본 · 소속 93종 |
| 6 | `limbus-assets/identities.json` | 대조군 · 같은 개념 다른 표현 |
| 7 | `limbus-assets/identities_mini.json` + `shared-library` 동형 2종 | 요약판 · 구버전 대조 |
| 8 | `limbus-assets/passives.json` + `skill_tags.json` | 태그 사전 |
| 9 | assets 부속 4종 (`alt_names` · `identity_tag_list` · `identity_header_offsets` · `identity_keyword_modifiers`) | 도구 전용 메타 |
| 10 | `identity-details/limbus-assets/{id}.json` 184개 | 인격별 상세 (동형 1스키마) |
| 11 | `loc-*/Personalities*.json` + `Personality_Get_Condition.json` | 표시 문자열 · 인격명 |
| 12 | `loc-*/Skills_personality-NN.json` + `Skills.json` | 표시 문자열 · 스킬 |
| 13 | `loc-*/Passives*.json` + `UnitKeyword*.json` + `AssociationName.json` | 표시 문자열 · 패시브·키워드·소속 |
| 14 | `data/assets/` 인격 이미지 712개 | 애셋 명명 규칙 |

한 회차 = 한 대화 라운드 = 한 커밋.

## 3. 회차 문서 템플릿

````markdown
# 회차 N — <출처>/<파일명>

> <정본 여부> · <내용 한 줄> · <레코드 수> · <파일 크기> · <최상위 형태>
> 출처 커밋 <hash> · 스냅샷 2026-07-25

## 파일 정체

이 파일이 무엇인지, 왜 이 출처를 정본으로/대조군으로 삼았는지 2–4문장.

## 필드

### `<원본 키>` — <한국어 이름>

| | |
|---|---|
| 타입·실측 | 타입 + 실제 분포·범위·결손 건수 |
| 의미 | 게임에서 뭘 뜻하는지. 필요하면 위키 링크 |
| 변환 | `src/entities/<파일>.ts` 의 어느 함수가 어떻게. 통과·개명·계산·병합 |
| 적재 | `<테이블>.<컬럼>`, 또는 **미적재** + 사유 |
| 화면 | 화면 파일과 레이블 문자열, 또는 **미표시** |
| 함정 | 이름이 거짓말하거나 직관과 다른 점. 없으면 생략 |

(필드 수만큼 반복)

## 함정 요약

회차 전체에서 걸린 함정을 한 곳에 모은다.

## 미해결

- ❓ <질문> — <어디서 확인해야 하나>
````

**칸 작성 규칙**

- **타입·실측**: 숫자를 추정하지 않는다. 반드시 세어본 값만 적는다.
- **변환**: 라인 번호는 썩으므로 **파일 경로 + 함수명**을 주로 쓴다. 라인은 보조.
- **적재**: 미적재면 사유를 반드시 쓴다 — "파생 값이라 저장 안 함(원칙 2)", "쓸 화면이 없음", "출처가 정본이 아님(ADR-04)" 등.
- **화면**: 레이블은 화면에 뜨는 **문자열 그대로** 인용한다.

## 4. 방법

### 4.1 실측값 산출

회차마다 스크래치패드에 일회용 tsx 프로브를 써서 집계한다.

```
<scratchpad>/probe-<NN>-<파일>.ts
```

문서에는 **숫자와 산출 명령만** 남기고 프로브는 커밋하지 않는다.
프로브를 리포에 쌓으면 유지보수 부채가 되고, 값은 2026-07-25 스냅샷 고정이라 재실행 빈도가 낮다.

### 4.2 변환·적재 추적

필드 하나의 경로를 코드에서 실제로 확인한다.

```
원본 JSON → src/convert.ts → src/entities/*.ts → src/load.ts
          → DB 컬럼 → lib/queries/*.ts → app/[locale]/**/page.tsx
```

### 4.3 게임 지식 확인

정본 위키: **Limbus Company Wiki (limbuscompany.fandom.com)**.
JSON 키가 영문이라 어휘가 직접 대응한다. 한국어 표시 문자열은 `loc-ko` 원문을 따른다 —
위키의 한국어 번역을 쓰지 않는다.

문서에 게임 메커닉을 서술할 때 위키 URL을 각주로 남긴다.

### 4.4 미해결 처리

| 갈래 | 처리 |
| --- | --- |
| 위키로 풀리는 것 | 그 자리에서 조회하고 URL 각주 |
| 출처 저장소를 봐야 하는 것 | 그 자리에서 조사 |
| 데이터·위키 어디에도 없는 것 | `❓ 미확인` 표기 + `docs/backlog/` 항목 추가 + 회차 끝에 질문 |

### 4.5 진행 방식

내가 조사해 초안을 제시하고, 사용자가 게임 지식으로 정정한다.
확실한 것은 단정해 쓰고, 데이터만으로 못 정하는 것만 질문한다.

## 5. 착수 순서

1. `docs/data/README.md` 와 `identity/00-overview.md` 를 **뼈대만** 먼저 만든다.
   나머지 회차가 이 두 문서의 골격에 매달린다.
2. 회차 1부터 순서대로 진행한다.
3. 오버뷰 두 문서는 회차가 진행되며 계속 고쳐진다. 처음부터 완성하려 하지 않는다.

## 6. 범위 밖

- 추천 엔진의 파생 필드 — `docs/06-recommendation-engine.md`
- 사용자 생성 데이터(런 기록·편성) — 범위 밖
- 인격 편이 끝나기 전의 다른 엔티티 — 순서대로 간다
