# 데이터·ETL MVP 감사 — 2026-09-08

> 담당: data(surface:77), ops 검수·실행 결과 대조. 정보사이트 MVP 기준. **현재 출시 불가**.
> 범위 재설정 spec(2026-09-07)은 제안이며 구현 완료로 계산하지 않는다. 이 문서는 진단 결과와 위임된 타입 수정만 포함한다. 원본 재수집·덮어쓰기, 기존 DB·볼륨 변경, 보정 신규 저작은 하지 않았다.

## 1. 판정과 출시 차단 근거

1. **빈 DB 복원 후 canonical 검증 250건 중 246 통과 / 4 실패.** raw 13/13 통과와 테스트 703/703 통과만으로 데이터 릴리스 게이트를 대체할 수 없다.
2. **원본 순서 유실:** `keyword.None.order` 기대 11, 복원 결과 6. `data/entities/gifts/loc-en/EgoGiftCategory.json` 원본 12개 순서는 `Combustion,Laceration,Vibration,Burst,Sinking,Breath,Charge,Random,Slash,Penetrate,Hit,None`. `src/v2/scan.ts`는 개체 위치를 raw에 보존하지 않고 `src/v2/source.ts:readSource`는 `orderBy` 없이 조회한다. `src/v2/canonical/vocab.ts:85-89`는 Map 반환 순서에 순번을 매긴다. 알파벳순 None 위치가 정확히 6이다. **보정 누락과 다른 변환 결함**이며 DB 조회 순서에 의존해 재현성이 깨진다.
3. **기존 승인 보정의 복원 누락:** hardOnly 122(기대 117), 9212/9249/9427/9428/9431 모두 true(기대 false), 유지 표본 9841=true. 두 검증 실패는 동일 원인이다. `app.field_override` 5행의 사실·근거는 `docs/adr/07-canonical-promotion.md:101-112`, `docs/audit/wiki/03-gift.md §2`에 이미 기록되어 있다. 현재 seed에 이 5행을 복구하는 실행 데이터가 없다. 새로 원본 사실을 판정할 필요는 없지만, 원본+현행 seed만으로 기존 정본을 복원할 수 없다.
4. **dirty 커밋 릴리스 게이트:** `build_info.code_commit`의 `-dirty`로 실패. 기존 사용자 dirty 작업트리에서 복원했으므로 예상된 차단이다. 데이터 사실 오류로 세지 않는다. 사용자 변경을 지우거나 검증을 완화해서 통과시키지 않는다.
5. README의 과거 완전성·재현 완료 기록을 현행 빈 DB 복원 합격으로 사용할 수 없다. README 자체도 최신 데이터가 아닌 고정 스냅샷임을 밝힌다. 기준 스냅샷은 2026-07-25(MD7), 감사일 대비 45일 전이다. **최신 게임 버전과의 완전성은 이번에 검증하지 않았다.** 날짜와 지원 판본을 명시한 정보사이트로도 위 데이터 게이트와 UI 감사의 차단 항목 해결이 먼저다.

## 2. 실행 환경과 검증 증거

- 기존 localhost:5432는 ops 확인상 다른 프로젝트 `outis-db`; limbus 컨테이너는 없었다. 기존 볼륨은 보존했다. 최초 `/tmp/limbus-mvp-{raw,canonical}.log` 인증 실패는 데이터 검사 실패가 아니라 연결 대상 오류였다. 해당 로그는 후속 audit DB 검사 결과로 갱신되었다.
- ops가 별도 빈 DB `127.0.0.1:15439/limbus`를 만들어 로컬 원본에서 복원했다. 아래 수치는 이 **감사 DB** 실측이지 실제 배포 DB 실측이 아니다.
- data 샌드박스의 tsx IPC는 EPERM. 승인 재요청 없이 ops가 DB 접속 및 tsx 실행을 담당했다. data는 파일·코드 분석과 `npm run typecheck`를 직접 실행했다.

| 명령 | 결과 | 증거 |
| --- | --- | --- |
| audit DB에 `psql -v ON_ERROR_STOP=1 < prisma/v2/schema.sql` | 성공 (ops) | 분리 DB 복원 보고 |
| `DATABASE_URL=<audit> npm run v2:load` | raw 43,270행 / JSON 1,664파일 | ops 복원 + raw 검증 |
| `DATABASE_URL=<audit> npm run v2:seed:authored` | gift_ability_authored 1,295행 | ops seed 보고·소스 대조 |
| `DATABASE_URL=<audit> npm run v2:canonical` | 생성 성공, field_gap 1,272 | canonical 검증 로그 |
| `DATABASE_URL=<audit> npm run v2:verify` | **13/13 pass** | `/tmp/limbus-mvp-raw.log` |
| `DATABASE_URL=<audit> npm run v2:verify:canonical` | **250 = 246 pass + 4 fail** | `/tmp/limbus-mvp-canonical.log` |
| `npm test` (ops baseline) | 703 = 663 pass + 40 skip, 0 fail | ops 보고, DB 미연결 |
| `DATABASE_URL=<audit> npm test` (수정 후 ops) | **703 pass / 0 fail / 0 skip** | `/tmp/limbus-mvp-tests-db.log` |
| `npm run typecheck` 수정 전 | 실패: TS2322/TS2532/TS18048 총 19개 | `/tmp/limbus-data-audit-20260908/typecheck-before.log` |
| `npm run typecheck` 수정 후 | **pipeline + web 모두 통과** | `/tmp/limbus-data-audit-20260908/typecheck-after.log`, `/tmp/limbus-mvp-typecheck.log` |
| `npm run build` | baseline 및 타입 수정 후 모두 성공(ops) | `/tmp/limbus-mvp-build-final.log`. build는 별도 pipeline 타입 검사를 대체하지 않음 |
| `git diff --check` | 통과(data) | 직접 실행 |
| manifest 로컬 SHA-256 대조 | 아래 §3 | `/tmp/limbus-data-audit-20260908/files.json` |
| DB 전수 읽기 감사 | **exit 0, 114테이블 / 99 FK 고아 0** | `/tmp/limbus-data-audit-20260908/audit-db.mjs`, `db.json`, `db-error.log` |

정확한 복원 순서: **빈 DB DDL → raw → authored → canonical → raw 검증 → canonical 검증**. seed를 canonical 뒤에 돌리면 저작이 결과에 반영되지 않는다. 각 npm 명령에 audit DATABASE_URL을 명시해야 한다. 기존 `npm run db:ddl`은 compose 대상을 쓰므로 이 격리 검증에 사용하지 않는다.

## 3. 데이터 보유·품질

### 파일·체크섬·출처

- manifest 전체 **6,486파일** = entities 1,666 + meta 83 + assets 4,737. entities 1,666 중 2개는 `md-resource` SQL 참고 파일이고 실제 v2 JSON 입력은 **1,664**. README의 fetch 1,749는 entities+meta의 범위이며 raw 입력 수와 다르다.
- entities 1,666/1,666 LF 정규화 SHA-256 일치, 결손 0, 경로 중복 0, 변조 0.
- assets 4,737 중 **4,721 존재·체크섬 일치**, **16 결손**, 존재 파일 불일치 0, 경로 중복 0. 결손 전부 `v1-local`: Combo/SupportAtk/SupportDef 및 misc 아이콘 13종. 원래 로컬 저장소에 의존하고 원격 재수집으로 복구되지 않는다. 핵심 카드 이미지와 구분해서 평가해야 한다.
- `public/assets`는 현재 workspace의 `data/assets` 절대경로 symlink다. 다른 배포 경로에서 그대로 사용 가능한 산출물이 아니다. 배포 시 `npm run assets` 실행 또는 실제 애셋 패키징이 필요하다.
- manifest가 GitHub 출처의 commit을 고정한다. raw 출처별 행 수: loc-ja 11,218 / loc-en 11,013 / loc-ko 10,919 / limbus-data-mj 4,032 / limbus-assets 3,830 / shared-library 2,258. 과거 shared-library도 일부 보완에 쓰인다. 원격 서비스의 현재 가용성·게임 최신 패치는 이번에 조회하지 않았다.

### 엔티티별 기본 실측 (canonical 기존 검사)

| 엔티티 | 전체 / MVP 조회 범위 | 주요 완전성·참조 증거 | 판정 |
| --- | ---: | --- | --- |
| 인격 | 184 / 184 | identity_text 552(3언어); 저항 3축 미충족 0; season null 0; hp_level 184; 연결 스킬 1,020 | 기본 조회 데이터 보유 |
| E.G.O | 115 / **플레이용 110** | text 345; 연출용 5 제외; 플레이용 저항 7축 미충족 0; 단계 수치 baseValue/spCost 각 640/640 | 기본 조회 가능, 홈 개수와 불일치 |
| 기프트 | 582 / **MD 456** | 스토리 126 별도; stages 799 / texts 2,391; MD sprite 456 유일; 강화 가능 110; EX 2는 tier null 정상; ko 이름 결손 6개는 스토리 ID 1017/1031/1035/1036/1045/1047 | MD 핵심 조회 보유, hardOnly 보정 누락 차단 |
| 팩 | 117 / 117 | texts 351; 이름 없는 팩 0; tags 184; category paths 202; sprite 출처 불일치 0 | 기본 조회 보유, 실제 이미지 파일 결손 별도 확인 |
| 기프트–팩 | 10,116 | mj 원본 10,115와 차집합 0; 전용 팩 경로 없는 쌍 0; 전용 관계 321 | 저장·참조 증거는 있음. README가 밝힌 단일 출처 관계의 게임 전수 정확성 보증과는 다름 |
| 합성·획득 | recipe 68 / slot 179 / option 7 | gift_locked_desc **192 = 64×3언어** 이미 적재됨 | 최근 제안의 '미적재' 주장은 현 코드와 불일치. 짝·획득조건 표시용 파생은 별도 미구현 |
| 거울 던전 | MD7 1판본 | 이름 3언어, hard 15층 / normal 5층; grace 10 / grace_text 30 | 기본 조회 보유; 은총 desc의 화면 언어 처리 별도 |
| 층 | floor_pack 288 | normal/hard 1–5층 두 출처 218관계 완전 일치; 6–10층 46 / 11–15층 24 검증 | 관계 조회 보유 |
| 상세 공통 스킬·상태 | skill 1,045 / status 1,472 | skill_stage 4,768; coin 24,482; status_text 4,416; ko 상태 이름 결손 0; 설명 자리표시자 15(3언어), ko 내부 표제어 35 | 결손/치환 한계 표기 필요 |
| 이벤트·적 등 | 이벤트159 / 업적183 / 보상200 / 조우251 / 적870 | 기존 검사 pass, 상세 FK 전수 결과는 아래 보강 | 보조 정보 보유 |

`field_gap` 1,272는 행/필드/언어/사유가 있는 결손 대장이다. 필수 필드 전체의 의미상 완전성을 한 숫자로 환산해서는 안 된다. nullable 값은 EX tier나 침식 미보유처럼 정상일 수 있다. PK/FK 검증과 원본 교차 검증도 게임 사실의 완전성을 대신하지 않는다.

### 화면 소비 경계

- `lib/queries/canonical/*` → `lib/db-canonical.ts` → Prisma의 raw/canonical/app. 별도 `app/api` REST API는 없고 서버 조회 함수로 페이지가 소비한다. 배포 대상 DB·애셋이 실행 환경에 반드시 있어야 한다.
- `getCounts()`는 gift 582 / ego 115 전체를 센다. 목록은 `domain='mirror_dungeon'` 및 `presentationOnly=false`로 456/110을 보여준다. D0는 **실제 미해결**이다.
- `getGift()`의 데이터는 존재하지만 제안 D11 segments, D3 acquire/curse pair, D14 neighbors 등이 이미 제공된 것으로 계산하지 않는다. 현 구현·화면 완성도는 UI 감사와 함께 판정한다.
- `getBuildInfo()`는 snapshot을 '최신 version'으로 별도 조회해 buildInfo.snapshotId와 결합을 강제하지 않는다. 여러 raw 스냅샷을 보유하는 갱신 흐름에서는 실제 canonical과 표시 스냅샷이 달라질 여지가 있다.
- 추천 데이터 `gift-ability.jsonl`은 1,295행 / 기프트 456종 / 복합키 중복 0. origin auto **1,275**, hand **20**. origin만으로 사람 검수 여부를 확정할 수 없고 '모두 사람 검수 완료'라고 보고하지 않는다. 추천은 제안된 정보사이트 MVP 외 범위이며 기프트 조회 원문과 추천 신뢰도를 구분한다.

## 4. ETL 흐름·재현성·실패 처리

| 단계 | 실제 구현 | 재현성/실패/외부 의존 |
| --- | --- | --- |
| 입력 | `src/fetch.ts`, manifest commit+sha256Lf 고정; entities/meta 기본, assets 옵션 | LF 정규화 후 체크섬 대조; 네트워크/429/5xx 재시도, 불일치 실패. 성공 파일부터 직접 writeFileSync하므로 전체 수집 원자성은 없음. GitHub 및 미복구 v1-local 의존 |
| raw | `scanAll()` → snapshot/raw_object/raw_file | 같은 snapshot 삭제 후 재적재, version 유지. 전체 transaction 없음. 삭제가 스캔보다 앞서므로 읽기 실패도 기존 snapshot 손실 가능; 이번 기존 DB에 실행하지 않음 |
| 저작 | `seed-authored.ts` + 앱 DB의 수동 override | ref/ego/axis는 skipDuplicates. **gift_ability_authored는 deleteMany → createMany로 통째 교체, transaction 없음**. 중간 실패 시 능력 저작 소실 가능. 파일 정본과 DB 정본이 표마다 다름 |
| 변환 | raw 조회 → 순수 canonical 빌더 → app 보정 → 빈 canonical 적재 | raw 변환은 어휘 순서 유실. field_override 5행은 seed에 빠짐. 기존 canonical에 행이 있으면 시작부터 거부. 중간 적재 실패 시 부분 상태가 남아 단순 재실행도 거부됨 |
| 검증 | raw 13, canonical 250, 단위/DB 테스트, typecheck, rebuild digest | 이번 canonical 4fail. 과거 README222는 현 게이트 건수가 아님. 고정 행 수 검사라 새 snapshot 도입시 기대값 검토 필요 |
| 출력/승격 | `v2:build → v2:diff → v2:promote`, rollback | promote는 transaction으로 schema swap/FK 재결합. 하지만 **build가 live canonical을 canonical_hold로 먼저 이동**한 뒤 새 canonical DDL/적재/검증; live serving 중 격리된 무중단 빌드가 아니다. 에러 catch 복구와 별개로 SIGINT/crash는 수동복구 가능성 있음 |
| 재현 검증 | `v2:verify:rebuild`, `v2:reproduce` | rebuild도 내부에서 v2:build 실행, 읽기 전용이 아님. reproduce는 --run에서 원본 삭제·재수집·schema 재구축. 이번 둘 다 실행하지 않음; 재현 완료라고 결론내리지 않음 |
| 배포/자동화 | Next.js SSR, PostgreSQL+애셋; CI schema/DDL drift/type/test/build+데이터 커밋 가드 | `.github/workflows/ci.yml`에 데이터 수집·DB 복원·canonical 250 검사·승격·스케줄 갱신 없음. 로컬 DB 없는 CI 단위 통과는 data release gate가 아님. 배포 환경은 README상 미정 |

추가 seed 주석 불일치: 파일 머리는 '이미 있는 행 안 덮음'이나 능력 표는 명시적으로 파일 정본 replace. '형식 오류면 한 행도 안 심음'도 전체 seed에는 부정확하다. 실제 `readGiftAbilitySeed()`는 앞의 ref/ego/axis 삽입 **후** 실행한다. payload 검증 전에 일부 표가 바뀔 수 있다.

또한 build는 `v2:schema:ddl`로 workspace의 schema.sql도 재생성한다. audit DB URL만 바꾼다고 파일 영향까지 격리되지는 않는다. 서비스 중 실행·실패복구가 필요한 배포에서는 별도 staging DB/schema와 전환 계획이 선행되어야 한다.

## 5. 이번 수정: 타입 안전성만 복원

- 재현한 원인: pipeline tsconfig의 `noUncheckedIndexedAccess` 하에서 배열 `[0]`은 undefined일 수 있다. fixture spread는 필수값이 선택값으로 추론되고 결과 접근은 존재 검증이 없었다.
- `src/v2/ability-payload.test.ts`: 명시적인 `AbilityCond` fixture를 분리하고 이를 spread. 타입 단언·tsconfig 완화 없음.
- `src/v2/authored.test.ts`: base ability 존재 assert 후 payload 변경.
- `src/v2/canonical/gift-ability.test.ts`: 반환 조건/능력의 존재 assert 후 필드 검증. 값 검증을 optional chaining으로 약화하지 않음.
- `src/v2/canonical/gift-ability.ts`: 가장 앞 능력 선택 후 undefined면 명시적 invariant 오류. 비어 있는 그룹을 조용히 넘기지 않는다.
- 결과: 직접 typecheck 통과, ops typecheck 및 DB 포함 테스트 703/703 통과. ETL 데이터·기대값·UI·tsconfig는 변경하지 않았다.
- 시작 dirty: next-env.d.ts, 미추적 scope 문서 3개, rank.html. data는 이 파일들에 쓰지 않았다. 이후 status에서 next-env.d.ts 변경이 사라진 것은 동시 작업 상태이며 data가 복원한 것이 아니다.

## 6. 최소 후속 수정안 — 이번 회차 미구현

1. **복원 가능한 보정 seed**: ADR-07 §3 및 wiki 감사 §2의 기존 승인 사실을 근거 note와 함께 versioned override seed/backup으로 옮긴다. 5개 gift hardOnly=false, locale 빈 값. DB의 다른 수동 보정을 임의 덮지 않도록 충돌 검사/빈 DB 전용 복원 원칙을 둔다. canonical 생성 전에 적용. 117 및 5false+9841true 기대값 그대로 검증한다. 새로운 게임 사실 저작 아님.
2. **원본 순서 보존**: raw 개체에 원본 dataList 위치를 명시적으로 보존하고 readSource에서 필요한 순서를 지정하여 vocab에 전달. 원본 payload에 구현 메타데이터를 섞거나 None=11 하드코딩/알파벳 정렬로 무마하지 않는다. DB 읽기 순서를 바꿔도 같은 결과를 내는 회귀 검증 필요. 스키마 변경이므로 ops 조율 후 별도 구현.
3. **seed 원자성/정본 계약**: 모든 파일 validation을 쓰기 전에 수행하고 replace 구간을 transaction으로 묶는다. 머리 주석/README를 표별 정본에 맞춘다. DB 수동 편집과 파일 replace 충돌을 문서화한다.
4. **배포 가능 빌드 격리**: live schema를 비우거나 이동하지 않는 별도 staging 타깃에서 검증 후 transaction promote. 현 동작으로는 maintenance window와 복구절차가 필요하다. 재현 시험도 격리된 DB와 파일 작업영역에서 실행한다.
5. **MVP 표기 최소 정리**: 개수 필터 일치, MD7/스냅샷 날짜와 결손 폴백, 팩 이미지 결손 처리, UI 감사 차단 항목. README의 데이터 완성/재현/검증 수치를 현 상태로 수정한다.
6. 승인된 변경을 clean commit으로 고정하고 별도 빈 DB에서 복원 → canonical 250 전부 통과 → 화면 읽기 → 재현 digest까지 재검수한다. dirty 표식을 지우거나 현재 네 실패의 기대값을 낮추지 않는다.

## 7. 실측 추가 기록

ops가 읽기 전용 및 타깃 가드를 검토하고 `audit-db.mjs` 실행 **exit 0**을 확인했다. 근거: `/tmp/limbus-data-audit-20260908/db.json` 및 `db-error.log`. 이후 추가 DB 실행은 하지 않았다.

### 테이블·무결성·출처

| 스키마 | 테이블 | 행 |
| --- | ---: | ---: |
| raw | 4 | 44,954 (raw_object 43,270 + raw_file 1,664 + snapshot_source 19 + snapshot 1) |
| canonical | 100 | 154,546 (build_info 1 포함) |
| app | 10 | 1,320 |
| 합계 | **114** | **200,820** |

- **114테이블 모두 PK 존재, PK 중복 그룹 0.** 동일 이름/다른 ID나 의미상 중복은 이 검사 대상이 아니다.
- **FK 99개 전수 조회: 고아 행 0, 미검증 FK 0.** SQL FK가 없는 의미적 연결은 이 수치에 포함하지 않는다.
- field_source의 snapshot 참조 고아 0. build_info의 row_count=154,545는 자기 자신 1행을 제외하므로 실제 합계와 일치한다. 스냅샷 2026-07-25, code_commit `2f945da5b7c1c79bdb5f3fe7003ed437a4118cab-dirty`, built_at `2026-09-08T02:23:58.727Z`.
- 출처 기록은 선택된 필드 단위다. 인격 assets-only 552 / mj-only 368, 팩 agreed 117·assets-only 275 등, 기프트 union 456·assets-only 1,418 등 **field_source 총 15,534행**. 각 필드 전체의 출처 커버리지 100%를 증명한 검사는 아니다.

### 핵심 엔티티의 실제 이름·이미지 경로

| 조회 범위 | 건수 | ko 이름 결손 | en 이름 결손 | 이미지 resolver null | public 파일 경로 결손 |
| --- | ---: | ---: | ---: | ---: | ---: |
| 인격 | 184 | 0 | 0 | 0 | 0 |
| 플레이 E.G.O | 110 | 0 | 0 | 0 | 0 |
| MD 기프트(기본 단계 이름) | 456 | 0 | 0 | 0 | 0 |
| 팩 | 117 | 0 | 0 | 0 | 0 |

이미지는 `lib/assets.ts`의 기본 profile/awaken/giftIcon/packIcon 및 파일 존재 확인이다. **디코딩·시각적 정확성·팩 합성 아트/overlay·모든 상세 변형·HTTP 응답까지 검증한 것은 아니다.** 따라서 제안 문서의 팩 아트 결손 5종을 기본 아이콘 파일 결손으로 그대로 보고하지 않는다. 상세 아트 판정은 UI 감사에 따른다.

NULL 실측: 인격 핵심 행 0; E.G.O max_threadspin 107, corrosion_sin/attack_type 각 12; MD 기프트 sin/cost 각 15, tier 2(EX), tier_label 454(숫자등급); 팩 chapter/variant 각 90, overlay_sprite 76, text_color 61, unlock_code 2. 이들 모두 schema nullable이므로 자동 출시 차단 결측으로 계산하지 않는다. 기프트 sin/cost 15 및 팩 색/해금정보 결손은 폴백·안내가 필요한 데이터 한계다.

은총은 10개 모두 ko/en 이름이 있고 언어별 행 10개다. `descs` JSON의 언어 의미와 실제 화면 표시는 이번 추가 감사에서 확인하지 않았다. 던전의 이름은 기존 canonical 검사의 MD7 한국어 검증과 3언어 행 수를 근거로 한다(범용 감사 스크립트는 version 키 결합을 별도 검증하지 않는다).

필수(non-null) 열의 빈 문자열이 있는 표는 7개다: app.axis_grant.gate_ref 8, canonical.effect_ref.ref_id 27, encounter_target.name 2, field_gap.locale 386, identity_axis.gate_ref 279, trigger_ref.ref_id 34, raw.snapshot_source.branch 2. 빈 gate/ref/locale은 무조건·미분류·언어 비지정 같은 표현과 구분해야 한다. **적 이름 빈 값 2는 field_gap에도 원본 결함으로 기록된 실제 결손**이다. 주요 네 엔티티의 ko/en 이름 결측은 위 표대로 0이다.

### 남은 결손과 미검증 경계

field_gap 총 1,272의 계열별 집계는 아래와 같다. 결손 대장에는 행별 결손뿐 아니라 구조 미지원 사실도 1건으로 기록되므로 엔티티 결손 비율로 환산하지 않는다.

| 계열 | 결손 대장 행 |
| --- | ---: |
| achievement | 366 |
| association | 2 |
| choice_event | 112 |
| coin_token | 1 |
| encounter | 43 |
| encounter_target | 2 |
| encounter_target_part | 122 |
| enemy_part | 6 |
| gift | 131 |
| identity | 5 |
| identity_axis | 1 |
| pack | 63 |
| passive | 9 |
| reward | 400 |
| skill | 9 |

- **ops HTTP 검증:** 30개 요청 모두 HTTP 200(ops 최종검수 보고). data가 작성한 조회 함수 smoke(`audit-queries.mts`)는 별도로 실행하지 않았고 추가 실행은 불필요하다. HTTP 성공은 각 화면 내용의 정확성이나 모든 동선의 완성까지 보증하지 않는다.
- **미검증:** 모든 상세 이미지 변형과 설명 언어 의미, 실제 배포 환경, 네트워크 원본 최신성, 두 번 복원 비교·rebuild/reproduce. 이를 완료로 계산하지 않는다.
- **읽기 전용 감사 스크립트:** `/tmp/limbus-data-audit-20260908/audit-db.mjs` (ops 실행 exit 0, audit URL 가드 + READ ONLY transaction). 보조 SQL은 `/tmp/limbus-data-audit-20260908/audit-summary.sql` (미실행, 집계 명령 참조용).
- **참고 로그 보존:** 파일 검사 `files.json`, DB 검사 `db.json`, raw/canonical/test/typecheck 로그. `/tmp` 증거는 세션용이며 영구 감사 근거는 이 문서의 수치·명령·소스 참조다.
- cmux 소켓 접근이 data 샌드박스에서 차단되어 ops surface:115로 별도 전송하지 못했다. 권한 재요청 없이 공유 workspace의 이 문서와 대화 응답으로 제출한다.
