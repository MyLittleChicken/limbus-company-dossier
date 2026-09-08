# 업데이트 검증 읽기 전용 리뷰

상태: ops 후속 보완·최종 검수 완료(2026-09-08). 아래 발견사항은 수정 전 리뷰 기록이며 현재 미해결 목록이 아니다. design은 제품 코드를 변경하지 않고 최종 확인 내용을 기록한다.

## 발견사항

1. **P1 — 신규 연관 스킬·패시브의 ko/en 이름 누락을 통과시킨다.** `src/update/validate.ts:36`은 identityText/egoText만 검사한다. `:41`/`:44`의 관계 존재와 FK 검사는 텍스트 자식 존재를 보장하지 않는다. 신규 인격의 identitySkill → skillStage → skillStageText 및 identityPassive → passiveText, 신규 EGO의 egoSkill → egoSkillStage → egoSkillStageText와 egoPassiveLink → egoPassiveText를 따라 실제 빌더가 내보낸 각 단계의 ko/en 비공백 이름을 검사할 필요가 있다. 신규 엔티티에 연결된 항목부터 필수화하고 기존의 알려진 결손은 별도 경고로 다루면 기존15 gap을 불필요하게 전부 출시 차단하지 않는다. desc는 정상적인 빈 설명도 있어 일괄 비공백 강제하지 않는다. 1~4단계를 임의 생성하거나 모든 단계가 반드시 있다고 가정하지 않는다.

2. **P1 — 기존 값 손실 방지 검증이 없다.** `src/update/validate.ts:49`는 upstream 삭제 ID를 경고할 뿐 기존 DB 값과 비교하지 않는다. `validateCandidateReferences`도 키만 읽는다. `src/update/apply.ts`의 ON CONFLICT UPDATE는 후보 nullable 값과 기본 false/빈 배열을 그대로 덮어쓴다. 기존 상세가 source에서 일시 누락되면 보완 입력의 unknown/default가 기존 알려진 값을 지울 수 있다. 보존 요구를 충족하려면 DB baseline과 후보를 비교해 알려진 값→근거 없는 null/default/빈 배열 퇴행을 차단 또는 보류하고, 근거 있는 상류 수정은 허용해야 한다. 모든 변경을 차단하는 단순 동등성 검사는 지속 갱신 목적에 맞지 않는다. 현재 라이브 손실을 관찰했다는 뜻은 아니며 방지 장치의 누락이다.

3. **P2 — 원본 완전성이 최소 건수로만 검사된다.** `src/update/validate.ts:33`은 candidate.identityIds/egoIds라는 별도 목록과 원본을 비교하고 실제 core table ID 집합은 대조하지 않는다. `:41`은 스킬1개, `:47`은 EGO 패시브1개만 남아도 만족한다. 변환기가 원본4스킬 중3개 또는 여러 패시브 중 일부를 누락해도 검사할 수 없다. 원본의 명시 ID/정확 매핑된 ID 집합과 관계를 대조하고 actual ID 집합은 실제 table에서 산출하거나 양쪽 일치를 확인하는 것이 최소 보완이다. buildCandidate의 현행 정상 경로는 core table에서 ID 목록을 만들므로 core 불일치가 현재 발생한 것은 아니다.

4. **P2 — 이미지 정책이 런타임 해석과 다르고 존재 검사만 한다.** `src/update/validate.ts:77`~`:80`은 limbus-assets의 고정 .webp만 인정하지만 `lib/assets.ts`는 shared-library/v1-local 및 png/jpg/jpeg도 지원한다. 합법적인 기존 대체 이미지가 있는 경우에도 갱신 전체를 차단할 수 있다. 신규 필수 이미지 계약과 기존 이미지 호환 허용을 구분하는 편이 안전하다. access 성공은 일반 파일/유효 이미지 보장이 아니며, CLI verifyDownload는 staging checksum을 검사하지만 기존 fallback 파일의 이미지 내용은 검사하지 않는다. 신규 이미지에는 최소 파일 종류·크기/디코딩 검증을 제안한다. 원본에 없는 optional 스킬 아이콘까지 일괄 필수화하면 기존 정상 결손을 차단하므로 피한다.

## 검토 증거와 범위

최신 `/tmp/limbus-live-candidate-design.json`을 읽어 메모리에서만 네 번 변형했다: (1) 스킬/패시브 텍스트4테이블 제거, (2) 신규10616 core행 제거·identityIds 유지, (3)10616 스킬관계를1개만 유지, (4)releaseDate를 null로 변경. 각 경우 validateCandidate 오류 목록은 baseline과 동일했다. 리뷰 시점 baseline의 유일 오류는 ops/data 수정 중인 `skill["1061604"].sin invalid enum none`이다. 따라서 위 결과는 전체 PASS 증명이 아니라 해당 결손에 대한 **추가 오류 미검출** 증거다. 파일·DB 변경이나 apply 실행은 하지 않았다. FK 함수까지 변형 후보로 실행한 결과를 주장하지 않는다.

DMMF 기반 실제 복합 PK 중복 검사와 DB+candidate 부모 합집합 FK 검사는 현행 append/upsert 모델에 적절하다. enum 검증도 리뷰 도중 추가된 것을 확인했다. scalar 자료형·unique 제약 전체 검증은 완전하지 않아 DB transaction 검증을 대체하지 않는다. 기존 부모가 FK를 만족해도 신규 child/번역 완전성을 보장하지 않으므로 위1/3은 별도 검사가 필요하다.

최종 매핑 후보는 identityUnitKeyword FIXER1/association CINQ1, skill tier1/2/3/1이다. 관련 근거는 [매핑 감사](2026-09-08-update-mapping.md). ops 최종 검수와 data의 apply 수정 검증은 별도다.


## 후속 리뷰: apply topology·publish·CLI

읽기 전용 검토 기준은 DMMF FK topology/PK/dbName 기반으로 재작성된 `src/update/apply.ts`, `src/update/publish.ts`, `scripts/update/run.mts`이다. 아래는 코드 경로 검토이며 실제 DB 삭제 시나리오를 직접 실행한 결과는 아니다.

- **P1 — 보존 루트의 간접 자식은 동기화 대상에서 제외되지 않는다.** `apply.ts:64`~`:65`는 candidate의 모든 skill/passive ID를 자식 삭제 owner로 사용한다. `candidate.ts:29`/`:39`는 전체 MJ skills를 빌더에 전달하고, `canonical/skills.ts:265`와 `canonical/identities.ts:208`은 전체 MJ skills/passives를 열거한다. assets top-level에서 인격이 사라져 root와 identitySkill/identityPassive가 보존돼도, MJ에 해당 스킬/패시브가 남으면 그 단계·번역·요구사항은 계속 upsert/삭제된다. 일부 locale/detail이 함께 빠지는 경우 보존된 인격의 표시 정보가 줄어들 수 있다. 보존 대상 인격이 참조하는 skill/passive 집합을 DB에서 확보하여 간접 변경도 보류하거나, 공유 owner가 있을 때 적용할 보존 정책을 명시하고 회귀로 검증해야 한다. 현재 신규3종에서 실제 손실이 관측됐다는 주장은 아니다.

- **P2 — 실패한 실행도 이미지를 변경할 수 있고 부분 게시 내역이 누락된다.** CLI `run.mts:46`은 DB transaction 이전에 publish하고 `publish.ts:18`은 기존 파일을 즉시 rename 교체한다. 이후 publish 중간 실패 또는 DB rollback 시 파일은 되돌아가지 않는다. 파일별 원자성은 있으나 전체 실행의 DB+파일 원자성은 없다. 특히 publish 함수가 중간에 throw하면 반환 counts가 report.images에 대입되지 않아 이미 변경한 파일도 실패 보고서에 남지 않는다. 최소한 파일별 게시 journal과 실패 시 부분 게시 상태를 보고하고, 기존 파일 교체 복구 또는 버전별 게시/활성화 계약을 확정할 필요가 있다. 신규 파일 선게시 자체는 DB FK를 깨지 않으며, 무조건 DB부터 commit하는 순서 변경을 권하는 것은 아니다.

확인한 정상 범위: DMMF 관계를 따라 부모 upsert 후 역순 자식 삭제하며 실제 dbName/복합PK를 사용한다. 갱신 EGO의 기존·신규 egoSkill ID 합집합으로 사라진 스킬의 단계·번역·코인을 먼저 정리한다. identity/ego 등 root는 삭제하지 않고 직접 자식 owner는 후보 root ID로 한정한다. status/association은 candidate에서 DB에 없고 참조되는 신규 ID만 제공하므로 정상 CLI 경로에서는 기존 shared 상태·소속과 그 자식을 동기화하지 않는다. 이 제한은 apply 자체가 기존 DB 여부를 검사해서 보장하는 것은 아니므로 직접 apply 호출자도 candidate 생성 계약을 지켜야 한다.

추가 운영 경계: CLI run advisory lock은 DB 단위다. audit/live 등 서로 다른 DB로 같은 root의 --apply를 동시에 실행하면 공용 data/assets와 last-success.json은 이 잠금으로 직렬화되지 않는다. 한 root당 writer 하나라는 운영 제약 또는 root별 파일 잠금이 필요하다. 일반 단일 DB 수동/예약 경로는 같은 run lock을 사용한다.


## 최종 처리 결과 — ops 확인

ops가 신규 명칭·기존 알려진 명칭·HP 퇴행 및 원본 관계 검사를 보완했다. 이미지 검증에는 기존 fallback과 헤더 검사가 반영됐고, 게시에는 journal/backup이 추가됐다. 보존 인격의 스킬·패시브 의존 제외는 design이 구현했으며 ops가 실제 DB에서10101 전체 의존 행의 적용 전후 동일성과 rollback을 확인했다.

통합 검증은 root726테스트/typecheck/build, 신규3종 ko/en 상세·이미지 정상, 재실행 변경0까지 완료됐다는 ops 최종 승인을 기준으로 한다. 후속 보완의 독립 재리뷰·재실행을 design이 수행했다는 의미는 아니다. 추가 검수 소견 없이 design/매핑 인수 완료로 대기한다.
