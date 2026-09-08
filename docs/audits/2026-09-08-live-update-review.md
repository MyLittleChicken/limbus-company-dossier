# 인격·E.G.O 라이브 갱신 최종 검수 기록

상태: **격리 DB·운영 빌드에서 구현 인수 검수 완료. 실제 운영 DB 배포·OS 예약 등록은 수행하지 않음.**

사용자 승인 범위는 최신 원본 발견→정보·이미지 수집→변환→운영 중 추가/수정 적재를 수동 또는 예약 명령으로 수행하는 것이다. 기프트·팩·사용자 데이터는 보존한다. 운영 스키마 교체나 서비스 재시작 없이 동작해야 한다.

## 독립 확인 완료

- 디자인 문서: `docs/design-system.md`, `docs/design-system/tokens.md`. ops가 토큰 106개 선언값과 상대 링크를 자동 대조하고 주요 CSS·컴포넌트 계약을 직접 대조했다. 문서 범위 승인, 제품 반응형/언어 QA는 별도다.
- 이미지: `lib/assets.ts` 디렉터리 변경 감지와 파일 수정 버전, `/media/[...path]` 요청 시 파일 제공. 회귀 테스트 5개, typecheck, production build 통과. design의 읽기 전용 리뷰에서 추가 발견 없음.
- production3100 동일 프로세스에서 신규 파일404→게시200/정확 바이트→ETag304→atomic 교체200/새 ETag/정확 바이트 확인. 인격10101 상세200 및 `/media` URL 확인. 임시 검증 이미지 정리 완료.
- 실제 수집: `/tmp/limbus-update-live-20260908`, 4,500파일(본 수집4,464 + 누락된 UnitKeyword36 보강). snapshot `26fc724b4edb13c8fc332e24`. Git blob SHA와 staged SHA256 검증 후 후보 생성 성공.
- 후보 최초 결과: 인격185, E.G.O117(플레이112+연출5), 신규10616/20310/21210, 원본 삭제0. 신규 ko/en/ja 이름 존재.
- 격리 audit DB `127.0.0.1:15439/limbus`만 사용. 적용 전 pg_dump 및114테이블 digest 확보. 사용자 데이터 보존 검증용 account/setting/run/run_floor/run_gift fixture를 이 격리 DB에만 추가했다.

## 검수에서 발견해 수정한 항목

- 최초 후보의 신규 E.G.O 패시브 ID가 문자열 `undefined`였다. 원본 passiveList는 ID 없는 이름/설명 배열이며 locale 원본에 실제2031011/2121011이 있다. 유일성 검증을 통한 연결과 회귀 검증을 요청했다.
- 신규 인격의 키워드/소속/특성 매핑을 원본 근거로 점검한다. 모든 스킬에 키워드를 임의 배정하는 추정은 허용하지 않는다.
- 최초 적재 초안의 `createMany(skipDuplicates)`는 기존 ID 변경을 반영하지 못한다. 실제 upsert 및 소유 엔티티 범위의 자식 동기화를 재요청했다.
- 실행 잠금, 체크섬 검증, 이미지 게시 순서, DB transaction rollback, 무변경 재실행, 기존 ID 수정, 원본 삭제 보류, 기프트/팩/app 불변을 실제 DB와 HTTP에서 검증해야 한다.
- 수동/예약 공통 실행 명령과 운영 문서를 확인한다. OS 예약 등록·커밋·푸시는 수행하지 않는다.

임시 검수 로그와 데이터는 `/tmp/limbus-live-*`, `/tmp/limbus-update-*`에 있다. 이 기록은 실제 증거에 따라 갱신한다.


## 최종 인수 증거

- 공통 명령: `npm run update:run -- --collect --apply`. `.env`의 DATABASE_URL 대상, 서비스 호스트의 data/assets에 게시한다. 기본 원본/보고 저장 경로는 var/updates/<고유 run>이며 초기 원본4500파일은 var/updates/2026-09-08-initial에 보존했다.
- 신규 인격10616: 소속CINQ1·특성FIXER1·키워드Burn/Poise2, 스킬4(tier1/2/3/1; sin gloom/wrath/pride/null), 패시브 연결6. 신규 E.G.O20310/21210: 실제 locale ID2031011/2121011 패시브와 ko/en/ja 텍스트6. 없는 ID를 추정하지 않는다.
- 실제 CLI 적용: 9,886행 upsert(신규 및 기존 수정), 자식 삭제0, 이미지19추가/3,206유지/교체0. 총 인격185, E.G.O117(플레이112+연출5).
- production3100 PID51734를 유지한 채 신규 세 상세404→200. ko/en6상세와 목록 링크 확인, 상세별26/12/14 이미지 모두200. 기존 페이지 정상응답.
- 실제 transaction 회귀: 기존 HP 변경, 자식 키워드 삭제, 원본 누락 루트 유지, 기프트/팩/run 보존, 성공 쓰기 후 예외 발생으로 rollback. 별도 실DB 검사에서 누락 인격10101과 스킬/패시브 전체 의존 데이터도 전후 동일.
- 114테이블 digest로 모든 실패시험 전후 불변, 실제 적용 후 app/raw/기프트/팩 전체 불변. 같은 원본 재실행은 upsert0/자식삭제0/이미지변경0, 전체114테이블 digest 불변.
- PostgreSQL session advisory lock을 먼저 잡은 상태에서 두 번째 CLI가 게시/쓰기 전에 실패하는 것을 확인했다.
- 전체726테스트 통과, skip0. typecheck·production build·git diff --check 통과. 후속 검증 강화 후 정상 후보 허용 및 기존 스킬 이름/HP 유실 후보 거절을 실제 DB 비교로 확인했다.
- 원본집합/실제 core행, 필수 ko/en 이름, 신규 스킬 단계·패시브 이름, 명시된 원본관계, PK/enum/FK, 기존 정보의 null/빈값 퇴행, 이미지 파일/헤더·체크섬을 적용 전에 검증한다. 알려진 원본 결손16건은 provenance.json에 남긴다(기존15+신규 인격 teamCodeEligible 원본 부재1).

## 운영 계약과 범위

단일 DB·서비스 filesystem·writer가 전제다. GitHub hosted runner처럼 서비스 파일시스템과 분리된 곳에서 이 명령으로 운영 DB만 갱신하면 안 된다. OS cron 예시만 제공했고 등록하지 않았다. 원본 baseline data/manifest.json 및 raw DB는 그대로 두고 새 원본과 변환·계보는 run별 파일에 보존한다. 기존 공용 status/association은 수정하지 않고 새 참조만 추가한다.

이미지는 DB보다 먼저 게시한다. DB 실패 시 이미 게시한 이미지가 남을 수 있으며 각 게시 전후 journal과 기존 이미지 backup을 남긴다. 성공 재실행은 갱신을 완료하며, 이전 이미지로 복구할 때는 journal/backup을 사용한다. DB/파일 전체를 하나의 원자적 transaction으로 간주하지 않는다.

디자인 시스템 문서 인수는 완료했다. 반응형390/1440 전수 QA, en lang/내장문구, 구판 기프트 상세 통일은 후속 디자인 작업이다. 이 작업에서 해당 UI를 변경하거나 제품 MVP 전체 완성을 선언하지 않는다.

최종 빌드 후 검증 서버의 구 JavaScript 청크 참조가 발견되어 최신 빌드로 재실행했다(데이터 적재 시의 PID 유지 시험 이후). 최종 인격/두 E.G.O 상세에서 HTML과 JS/CSS/이미지 각각37/23/25개 리소스 모두200을 재확인했다. 데이터 갱신 명령은 빌드나 서버 재시작을 실행하지 않는다.
