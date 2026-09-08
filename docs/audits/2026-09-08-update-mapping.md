# 신규 인격·EGO 입력 매핑

상태: ops 최종 인수 완료. design-system·tokens·매핑 승인 및 통합 검증 완료(2026-09-08). 아래 단계별 미검증·대기 서술은 조사 당시 기록이며 최종 결과는 다음 절을 따른다.

기준: `/tmp/limbus-update-live-20260908`, 기존 후보 `/tmp/limbus-live-candidate.json`.

1. EGO20310/21210 `passiveList`의 이름을 loc-en `Passive_Ego`의 유일한 이름과 정확히 연결한다. ID가 없고 이름이 누락/중복이면 임의 선택하지 않는다. MJ 상세가 있는 기존 엔티티는 보존한다.
2. 인격10616 `skillKeywordList` Burn/Poise는 canonical 어휘와 연결한다. `keywordSkills` 전 스킬 배정은 삭제하고 슬롯은 알 수 없으므로 빈 배열로 유지한다.
3. tags의 Cinq Association은 associations.json의 CINQ, Fixer는 loc UnitKeyword_FIXER를 근거로 연결한다. 소속과 unit keyword는 다른 관계이며 숫자/이름으로 추정하지 않는다.
4. 빌더와 소스 순서를 재사용하고 참조되는 신규 association/status만 의존 행으로 포함한다. 기존 엔티티 보존·이름 중복/누락·실제 관계 출력 회귀를 검사한다.
5. ops 지원으로 실제 후보를 별도 `/tmp` 파일에 재생성해 관계·패시브 번역·상태 외래키를 확인한다. 라이브 적재는 data/ops 소유다.

최초 관찰: 기존 후보의10616 keyword/association/unitKeyword 관계가0, EGO 신규 passiveId가 `undefined`. 현행 candidate의 이름 매핑은 supplementEgos 이후라 빌더가 읽는 MJ 상세 관계를 고치지 못한다. 최신 discovery에는 UnitKeyword가 미포함되어 ops/data에 수집 범위 보강을 요청했다.


## 구현 근거와 최종 매핑

원본 기준은 `/tmp/limbus-update-live-20260908/manifest.json`이다. ops가 동일 고정 HEAD의 UnitKeyword 3언어 36파일을 추가한 4500파일 수집본을 사용한다. 파일 경로는 아래에서 수집본의 `entities/` 기준이다.

| 대상 | 원본과 필드 | 최종 처리 |
| --- | --- | --- |
| 인격10616 키워드 | `identities/limbus-assets/identities.json`의 `skillKeywordList` | Burn → Combustion, Poise → Breath. `/tmp/limbus-update-vocab.json` DB keyword의 영어 texts와 일치. `keywordSkills` 추정 배정을 제거하여 `skillSlots: []` 유지 |
| 인격10616 소속 | 위 파일 `tags`, `identities/limbus-data-mj/associations.json`의 `name` | Cinq Association → CINQ. 정확한 이름이 여러 ID에 대응하면 중단 |
| 인격10616 특성 | 위 tags, `identities/loc-en/UnitKeyword*.json`의 `content` | Fixer → UnitKeyword_FIXER → FIXER. 소속으로 분류된 Cinq Association은 특성에 중복 삽입하지 않음. 기존 MJ의 CINQ 소속과 FIXER 특성 분리 관례를 따르며 근거 없는 SMALL 추가 없음 |
| 인격 스킬 tier | `identity-details/limbus-assets/10616.json`의 `skills[id].tier` | 1061601~1061604 순서로 1/2/3/1. wrapper tier 우선, 기존 명시적 row skillTier 보조; 슬롯/ID에서 숫자 추정 금지 |
| EGO20310 패시브 | `ego-details/limbus-assets/20310.json`의 passiveList name, `egos/loc-en/Passive_Ego*.json` | `'Tis Thy Turn to Swallow the Needle!` 정확한 이름의 유일한 ID2031011 연결 |
| EGO21210 패시브 | 같은 경로21210, 영어 Passive_Ego | `Processing Transfer Reg` → 유일한 ID2121011 연결 |

`src/update/adapter.ts`의 `supplement`/`supplementEgos`는 기존 MJ 행·상세·스킬·패시브가 있으면 대체하지 않는다. EGO 패시브 명시 ID는 유지하며 ID 없는 이름은 정확히 한 건일 때만 연결한다. 누락/중복 이름은 예외로 후보 생성을 중단한다. assets 원본 자체를 변경하지 않는다.

`src/update/candidate.ts`는 보완 입력을 **빌더 호출 전** 구성한다. 기존 `buildIdentities`, `buildSkills`, `buildEgos` 및 파일 정렬·merge 순서를 재사용한다. 신규 소속 의존 행은 `buildSinners`로 구성하여 DB에 없고 참조되는 ID만 association/associationText에 포함한다. status도 기존 행을 덮어쓰지 않고 새 참조 행만 포함한다. apply/validate/CLI/수집기 변경과 DB 쓰기는 이 작업 범위 밖이다.

## 검증과 후보 증거

- `node --import tsx --test src/update/adapter.test.ts`: 최종 6/6 통과. 실제 canonical 빌더를 이용한 키워드·소속·특성·스킬 tier·패시브 링크/번역 검증, 중복/누락 이름 거부, 기존 authoritative 입력 보존을 포함한다. 특성 중복과 누락 tier는 실패를 먼저 확인한 후 수정했다.
- `node node_modules/typescript/bin/tsc --noEmit --incremental false -p tsconfig.pipeline.json`: 종료0.
- ops 최초 재생성 결과: 신규10616 키워드2/소속1/상태7/스킬4/패시브관계6; 신규 EGO 패시브링크2와 ko/en/ja 텍스트6. 미해결 status 참조0. 신규 status는 DianxueHongLu, DuelSousTemoinsEast이며 신규 association0(CINQ 기존 존재).
- **최종 후보 확인:** ops 재실행 후 최신 summary는 unitKeyword1(FIXER), association1(CINQ)이다. design도 최신 candidate에서 1061601~1061604의 skillTier1/2/3/1을 확인했다. 최초 unitKeyword2 결과는 폐기된 이전 패치 결과다. ops는 shape/source/실제FK/images PASS 및 기존15 gap + 신규 teamCodeEligible1을 보고했다. 이후 추가된 enum 검증에서는 defense skill의 sin=none이 검출되어 ops/data가 수정 중이다. 따라서 검증 시점을 혼합해 최종 전체 PASS로 주장하지 않는다.

재생성 스크립트: `/tmp/limbus-regenerate-mapping.mts`. 저장소 루트에서 audit DB의 DATABASE_URL을 환경에 설정한 뒤 `node --import tsx /tmp/limbus-regenerate-mapping.mts` 실행. generated client 경로는 ops가 `src/v2/generated/client.js`로 정정했다. 읽기 전용 후보 생성이며 출력은 `/tmp/limbus-live-candidate-design.json`, `-design-summary.json`, `-design-meta.json`이다.

## 메타데이터·한계

후보의 `Meta`는 getters를 가진 객체이므로 후보 전체의 JSON 직렬화만으로 메타 증거가 보존되지 않는다. 위 스크립트는 `candidate.meta.gaps`와 `.sources`를 별도 `-design-meta.json`으로 저장한다. assets-only core/resists 출처와 teamCodeEligible 근거 누락은 candidate에서 명시한다. 신규10616의 eligibility는 추정하지 않고 false로 유지한다.

기존 canonical 빌더의 출처 메타는 보완된 MJ 입력을 받으므로 개별 필드의 실제 adapter 유래를 모두 표현하지 않는다. 특히 이름 기반 패시브·태그 매핑의 구체 근거는 위 표와 manifest를 함께 참조해야 한다. 이 문서는 자동 메타가 모든 필드 계보를 완전히 증명한다고 주장하지 않는다. 최종 schema/FK/images 검증, dry transaction rollback, 라이브 적재와 UI 반영 확인은 ops/data 검수 결과를 따른다.


## 후속 차단 수정: 죄악 부재 sentinel

ops가 dry transaction에서 발견한22P02에 대응하여 adapter의 assets 스킬 affinity `none`을 null로 정규화했다. 계약 근거는 `prisma/v2/schema.prisma`의 `enum Sin`(7종, none 없음)과 `Skill.sin Sin?`, `src/v2/canonical/skills.ts`의 `buildSkills`가 입력 sin을 `str`로 읽어 null을 보존하는 동작이다. 없는 helper를 새로 가정하지 않고 adapter 입력 경계만 수정했다. 원본 affinity와 기존 MJ 스킬은 변경하지 않으며 실제 죄악 값도 보존한다.

회귀는 변경 전 none≠null 실패를 확인하고 변경 후7/7 통과했다. pipeline typecheck 종료0. 최신 실제10616 detail을 adapter→buildSkills에 직접 통과시킨 결과1061601 gloom/tier1,1061602 wrath/tier2,1061603 pride/tier3,1061604 null/tier1을 확인했다. DB 연결 없이 실제 입력 변환을 검증한 것이며 ops의 후보 재생성·transaction 재검증은 별도다.


## 후속 P1 수정: 누락 인격의 스킬·패시브 보존

`candidate.ts`의 `preserveMissingIdentityDependencies`는 DB identity ID에서 최신 assets identities ID를 빼 보존 대상 인격을 산출한다. 실제 Prisma 모델 `IdentitySkill`(identityId/skillId), `IdentityPassive`(identityId/passiveId)의 DB 참조를 조회하며 이름이나 숫자에서 의존 ID를 추정하지 않는다.

최종 candidate 조립 후 반환 전에 다음 테이블에서 보존 대상 참조 ID의 행을 제외한다: skill, skillStage, skillStageText, skillCoin, passive, passiveRequirement, passiveText. skill/passive root도 제외하므로 apply의 자식 삭제 owner 집합에서도 빠진다. 현재 schema의 모든 해당 하위 모델을 포함하며 EGO 계열의 같은 문자열 ID는 건드리지 않는다. 공유 참조도 보류한다. 갱신 인격의 identitySkill/identityPassive 관계를 임의 삭제하거나 DB에서 복사해 후보에 다시 넣지 않는다.

메타: 누락 인격마다 `updateDependencies` gap에 원본 누락 사유와 DB에서 확인한 skill/passive ID를 JSON evidence로 남긴다. 각 보류 skill/passive에는 `updateScope` / `preserved-db` source를 남긴다. 앞선 빌더의 값 출처 메타가 있어도 이 updateScope는 실제 게시 보류를 의미한다. DB 값 누락 자체가 아니라 운영상 보류라는 의미이며 기존 gap 집계에는 추가될 수 있다.

검증: adapter.test.ts에 source에서 사라진 인격과 새 인격이 동일 스킬·패시브를 공유하는 회귀를 추가했다. DB 조회 경계만 fixture로 대체하고 실제 보류 함수를 실행하여 루트2개와 하위5개 테이블 제외, 관련 없는 행 및 공유하는 신규 관계/EGO행 유지, 조회 범위·메타 evidence를 확인했다. 누락 인격이 없으면 DB 참조 조회 없이 변경하지 않는 경로도 확인했다. 최종 회귀8/8, pipeline typecheck 종료0. 이 회귀는 실제 DB transaction 보존 증명이 아니므로 ops 통합 검증과 구분한다.

### 운영 절차

1. 기존 `/tmp/limbus-regenerate-mapping.mts`로 audit DB 기준 후보를 재생성한다. 이 변경은 candidate 소유 파일만 변경하며 apply/validate/publish는 ops 구현을 사용한다.
2. provenance의 `updateDependencies`와 `updateScope=preserved-db`를 확인한다. 해당 skill/passive ID가 위7테이블에 없는지 확인한다. 누락 루트와 직접 관계도 후보 동기화 owner에서 제외돼 있어야 한다.
3. audit transaction에서 적용 전후 보존 대상 identity/직접 관계 및 참조 skill/passive 루트·하위 행을 비교하고 rollback한다. 신규 인격이 보류 스킬/패시브를 공유하면 DB FK는 만족할 수 있으나 후보 내 ko/en 이름 검증은 차단할 수 있다. 보존 필터를 우회하지 말고 원본 복원 또는 ops의 명시적 보존/검증 정책 결정 후 재시도한다.
4. 원본 인격이 복원되면 해당 인격에서 유래한 보류는 자동 해제된다. 다른 누락 인격이 같은 의존을 참조하면 계속 보류된다.
5. 한 서비스 filesystem/root는 하나의 DB와 writer만 사용한다. 서로 다른 DB의 advisory lock은 같은 assets/result 파일을 보호하지 않으므로 동일 root에서 audit/live apply를 병렬 실행하지 않는다. 별도 DB 검증은 rollback만 하거나 독립 filesystem을 사용한다.


## 최종 인수 결과 — ops 확인

ops가 root726테스트/typecheck/build 통과, 실제 신규3종 ko/en 상세·이미지 정상, 재실행 변경0을 확인했다. 누락 인격10101의 전체 스킬·패시브 의존 행은 실제 DB transaction 적용 전후 동일했고 rollback까지 검증했다. 앞서 기록한 DB 보존 미검증 상태는 이 검수로 해소됐다. design-system·tokens·매핑 인수가 완료됐으며 추가 기능 작업은 시작하지 않는다.
