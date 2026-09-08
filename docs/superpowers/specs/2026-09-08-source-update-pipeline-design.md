# 인격·E.G.O 원본 갱신 파이프라인 설계

2026-09-08 승인 범위: 인격·E.G.O 본체와 스킬·패시브·번역·이미지. 기프트·팩은 제외한다. 수동 명령과 예약 실행이 같은 실행기를 사용하며, 기존 서비스 DB를 이동·삭제·교체하지 않는다.

## 단계

1. `scripts/update/`가 각 정본 저장소의 branch HEAD와 commit 시각을 읽고, pinned manifest의 파일 목록과 HEAD tree를 비교한다. 신규/변경/삭제 후보를 source별로 기록한다. 인격·E.G.O 본체 ID에서 details, skills, passives, locale, 이미지 파일까지 종속 집합을 확장한다. 원본에서 사라진 행은 삭제하지 않고 보고한다.
2. `/tmp/limbus-update/<run-id>/`에 임시 다운로드 후 LF 정규화·sha256 검증, atomic rename을 수행한다. source별 HEAD·파일 URL·checksum·수집 시각으로 candidate manifest를 만들고 모든 파일 성공 전에 게시하지 않는다. 기존 data/assets 경로는 삭제하지 않는다.
3. 기존 `src/v2/scan.ts`, `load-raw.ts`, canonical builders를 staging DB에서 재사용한다. raw 행에 원본 dataList 위치를 보존해 keyword 순서를 결정적으로 만들고, 승인된 override seed와 authored 데이터를 함께 연결한다.
4. staging에서 raw/canonical 검증, FK·PK, 필수값, source checksum, 신규 ID 종속 행과 이미지 checksum을 검사한다. 반드시 10616, 20310, 21210의 본체·ko/en 이름·스킬·패시브·상세 연결·대표 이미지가 존재해야 하며, 새로 참조하는 association/status/sinner/keyword도 FK와 번역을 확인한다.
5. 검증된 결과만 live 대상 엔티티를 한 transaction에서 upsert/synchronize한다. live schema rename, TRUNCATE, 전체 DB 교체는 금지한다. 신규는 insert, checksum이 다른 기존 행은 update, 원본 부재는 보존·보고한다. 실패는 rollback하여 기존 서비스 조회를 유지한다.
6. 이미지가 먼저 `data/assets/<category>/<source>/<file>`에 게시된 뒤 DB transaction을 수행한다. 최종 기록에는 run id, source HEAD, 변경 ID, 행 수, checksum, 검증 결과, 성공 시각을 남긴다.

## 실행·동시성

수동과 예약 모두 `npm run source:update -- --staging-url <URL>`을 사용한다. live DATABASE_URL은 거부하고 staging URL만 허용한다. run lock 또는 advisory lock으로 동시 실행을 하나로 제한한다. 수집은 병렬 가능하지만 staging 적재→검증→동기화는 순차다. 기존 사용자 DB와 원본 디렉터리는 update 실행 중 직접 쓰지 않는다.

## 소유권

data: `src/**`, `scripts/update/**`, `prisma/**`, `package.json`, `.github` schedule 예시, ETL 문서와 이미지 임시 수집/검증 계약. ops: `lib/assets.ts` 및 관련 테스트, `app/media/[...path]/route.ts`의 path/realpath/ETag와 `/media/...?...v=mtime-size` URL, 그리고 design이 넘긴 디자인 시스템 문서와의 통합. design은 UI와 이미지 캐시·앱 갱신 접점을 검수한다. data는 libs/assets, 기존 `public/assets`, 기프트·팩 데이터를 변경하지 않는다.

이미지 계약: data는 기존 파일을 삭제하지 않고 `data/assets/<category>/<source>/<file>.tmp`에 받은 뒤 checksum 검증 후 같은 디렉터리로 atomic rename한다. DB upsert 전 이미지가 존재해야 한다. ops resolver는 이 파일을 `/media`로 노출하고 mtime-size 버전 query, realpath 경계, ETag를 책임진다. `public/assets`와 기프트·팩 이미지 경로는 이번 작업에서 변경하지 않는다.

## 인수 기준

- assets HEAD의 신규 10616, 20310, 21210이 candidate→staging→live upsert 후 페이지 조회에 나타난다.
- 본체·종속 JSON·번역·대표 이미지 checksum과 source commit이 기록되고, staging 검증 및 FK orphan 0을 통과한다.
- 실패 주입 후 rollback으로 기존 행·schema 이름·볼륨이 보존된다. 원본 삭제 후보는 자동 삭제하지 않고 보고한다.
- 같은 candidate를 두 번 실행해 결과와 checksum이 같고 불필요한 update가 없다. 수동·예약 명령은 동일 실행기이며 동시 실행은 하나다.

현재 초안은 설계 검수용이다. 구현은 탐지/계획→staging 수집→검증→transaction 동기화의 작은 단계로 진행하며, 검수 전 원본·manifest·DB·제품 코드는 변경하지 않는다.

## 구현 인수 결과

2026-09-08 ops 인수검수 완료. 실제 구현/시험 결과는 [최종 검수](../../audits/2026-09-08-live-update-review.md), 실행법과 파일/DB 실패 계약은 [운영 문서](../../ops/source-update-runbook.md)를 따른다. 문서 위의 계획 단계에서 불확정했던 파일 계약은 data/assets/category/source/file 원자적 게시 + /media 동적 제공으로 확정했고, CLI/검증/적재·이미지 제공은 ops가 최종 수정·검수했다. design은 디자인 시스템과 원본매핑, data는 수집초안과 운영문서에 기여했다.
