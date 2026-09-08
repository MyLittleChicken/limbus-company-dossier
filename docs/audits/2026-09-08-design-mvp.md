# 디자인 MVP 진단 — 2026-09-08

상태: **ops 감사검수완료·제품출시보류**. ops가 12=6+6 분류 및 감사 근거를 승인했으며, 제품 QA 전수 합격을 의미하지 않는다. 제품 코드 수정 없음.
기준: HEAD `2f945da`와 현재 workspace. 기존 untracked 범위 제안·계획 3개 및 `rank.html` 보존. 최초 dirty `next-env.d.ts`도 이 감사에서 수정하지 않았다.

## 판단 요약

- `app/**/page.tsx`는 **16개**: `/` 리다이렉트 1 + 로케일별 화면 15. 화면 15는 **정보 12 + 실험 3**이다. ko/en은 동일 템플릿이므로 중복 집계하지 않는다.
- 정보 화면 12는 **새 디자인 6 / 구 디자인 6**. 새 디자인이라는 뜻은 코드상 시각 체계 구현이며, 동작·접근성까지 출시 승인했다는 뜻이 아니다.
- README·`docs/00-product.md`는 여전히 정보·추천 제품 정의다. 9월 7일 scope-reset spec은 **상태 제안이며 미적용**. 그 문서의 11종/새 디자인 7종은 실제 목록과 불일치한다. about 포함 12종/6종으로 정정해야 한다.
- 최소 출시 제안은 **정적 스냅샷 정보 조회 사이트**다. 네 엔티티 목록·상세 8종 + 홈·층·던전·고지 4종을 유지하되 기존 상세의 외형 전면 재구현은 별도 개선으로 둔다. 편성·추천·용어 3종은 이번 제품 범위 제외를 ops가 확정하고 진입 표면을 정리한다.

## 페이지 전수 분류

아래 경로는 `/[locale]` 접두사(ko/en)를 생략했다. `app/[locale]/` 기준으로 모든 행에 해당 `page.tsx`가 존재한다. **완성은 새 시각 디자인 구현 기준**, 부분 완성은 구판 또는 요구 동선 부족이다. DB 연동은 코드 확인이며 실제 값의 완전성은 data 감사가 판정한다.

| 경로 | 디자인 분류 | 근거 파일 / 실제 데이터 연동 | 주요 사용자 흐름 / 최소 보완 |
|---|---|---|---|
| `/` (로케일 내부 홈) | 부분 완성·구판 | `app/[locale]/page.tsx`; `reference.ts`의 `getCounts/getBuildInfo/searchAll`, canonical | 통합 검색→상세, 개수 카드→목록. 목록과 개수 필터 통일, 용어 진입 제거 필요 |
| `/identities` | 완성·새 디자인 | `identities/page.tsx`, `components/unit-list.tsx`; `canonical/list.ts`의 `listIdentitiesFull` | 수감자·축 필터→상세. 필터 URL 공유/복원 미구현 |
| `/identities/[id]` | 완성·새 디자인 | `identities/[id]/page.tsx`, `components/identity-sheet.tsx`; `canonical/detail.ts`의 `getIdentity` | 레벨·동기화·그림 전환, 스킬/패시브 조회. 표시 토큰 실측 필요 |
| `/egos` | 완성·새 디자인 | `egos/page.tsx`, `components/unit-list.tsx`; `listEgosFull` | 수감자·등급·축 필터→상세. 필터 URL 미구현 |
| `/egos/[id]` | 완성·새 디자인 | `egos/[id]/page.tsx`, `components/ego-sheet.tsx`; `getEgo` | 동기화·각성/침식 그림, 자원·스킬 조회. 좁은 화면 죄악 저항 검수 필요 |
| `/gifts` | 완성·새 디자인 | `gifts/page.tsx`, `components/unit-list.tsx`; `canonical/gifts.ts`의 `listAllGifts/listCursedGiftIds` | 키워드·등급·분류→상세. 필터 URL 미구현, 저주 판정 의존성 data 확인 |
| `/gifts/[id]` | 부분 완성·구판 | `gifts/[id]/page.tsx`; `getGift` | 강화 단계 본문·합성 재료·사용처·등장/전용 팩 링크는 이미 구현. 단계 차이 강조·팩 그룹화·이웃 기프트는 없음. 현재 정보 정확성·링크 검수 우선 |
| `/packs` | 완성·새 디자인 | `packs/page.tsx`, `components/pack-art.tsx`; `canonical/packs.ts`의 `listPacks` | 이름·종류·난이도 필터→상세. URL 필터 구현. 아트 결손의 실제 대상 확인 필요 |
| `/packs/[id]` | 부분 완성·구판 | `packs/[id]/page.tsx`; `getPack` | 전용 기프트→기프트 상세, 전체 풀 details 펼침, 층·보스 정보. 전체 풀 필터 없음(`05-ui` §4.2 요구); 읽을 수 있으면 MVP에서는 접힌 목록 유지 가능 |
| `/floors` | 부분 완성·구판 | `floors/page.tsx`; `reference.ts`의 `listFloorPacks` | 난이도/층 그룹→팩 상세. 카드·아이콘 결손 표기 보강 후보 |
| `/dungeon` | 부분 완성·구판 | `dungeon/page.tsx`; `getDungeon/getBuildInfo` | 층 구조·은총 단계·버전 조회. 영문 폴백 문구/결손 실측 필요; 트래커 화면 아님 |
| `/about` | 부분 완성·구판 | `about/page.tsx`; `getBuildInfo/getCounts`+정적 고지 | 출처·스냅샷·한계 확인. 고정 결손 숫자를 data 결과와 정합화; 외형은 MVP 차단 아님 |
| `/squad` | 범위 제외 제안·기존 구현 | `squad/page.tsx`, `components/deck-editor.tsx`, `lib/storage/decks.ts`; canonical roster+브라우저 저장 | 편집·덱 코드·로컬 저장. 서버 저장/OAuth는 미구현이며 이번 정보 MVP 차단 아님 |
| `/recommend` | 범위 제외 제안·슬라이스 | `recommend/page.tsx`, `canonical/recommend.ts`; 실DB+v2 엔진 | 층/보유 기프트 기반 고정 `HWAJIN_DECK` 시연. 사용자의 편성 추천 완료로 표기하면 안 됨 |
| `/glossary` | 범위 제외 제안·구판 | `glossary/page.tsx`; `listStatuses/listGlossaryAxes` | 상태 검색·분류. 현재 nav와 홈에 모두 노출됨 |
| `/` (로케일 없는 실제 루트) | 완성·진입 처리 | `app/page.tsx` | 기본 `/ko` 리다이렉트. 별도 디자인 화면으로 세지 않음 |

`/lab/squad`, `/lab/recommend`, `/lab/glossary`는 **미구현 경로**다. 현재 위 세 기존 URL에서 실행되므로 “실험실 이전 완료”가 아니다. 별도 트래커/로그인/서버 덱 저장 화면도 미구현이며 이번 범위 제외 후보다. 인카운터는 `05-ui`에서 팩 상세 종속 정보로 정해 전용 화면이 없는 것이 누락은 아니다.

## 출시 차단과 최소 수정안

| 우선순위 | 근거와 영향 | 최소 조치 / 담당 |
|---|---|---|
| P0 범위 합의 | README·제품 정의는 추천 중심, scope-reset은 제안. `lib/ui-text.ts:83` NAV_SECONDARY에 squad/recommend/**glossary** 모두 존재. 홈 `page.tsx:117`도 glossary 링크 | 정보 MVP 범위를 ops 확정. 기존 코드 보존하며 제품 nav/홈에서 실험 진입 제거, `/lab` 이동 여부 정하고 문서 동시 반영. 제안 소유권상 ops/data와 조율 |
| P1 개수 의미 | `reference.ts:337-340` 전체 count, 기프트 목록 mirror_dungeon / EGO 목록 presentationOnly=false. 홈의 목록 진입 숫자가 다른 집합을 표현 | data가 표시용 count 계약 제공; 홈 적용. about의 “적재 규모” 전체 개수는 의도상 유지 가능 |
| P1 탐색 복원 | `components/unit-list.tsx:93` 이후 `picked/q` 로컬 state만 사용. `05-ui:55` URL 공유 요구와 불일치. 편성 roster의 `?sinner=` 진입도 목록이 읽지 않음 | design이 URL 초기화/변경·뒤로가기 복원을 최소 구현하거나, 이번 MVP에서 공유 필터를 제외한다고 명시. 팩 필터는 이미 URL 사용 |
| P1 언어 접근성 | `app/layout.tsx:11` html lang=ko 고정. 하위 locale layout에 실제 언어 재지정 없음 | en 공개 시 문서 lang을 실제 로케일과 맞춤. 검색 입력 두 구현은 placeholder만 있어 명시적 label/aria-label 추가 권장 |
| P1 정보 판독성 | 스킬·코인 표시 토큰/은총 번역/기프트 짝/팩 아트는 과거 문서상 부채. 현재 runtime 상세는 `canonical/detail.ts`만 import하며 v1 DB 이중 조회 근거 없음 | data 실측과 화면 증거로 항목 확정. “현재 상세가 v1도 읽음”을 완료 사실/현행 결함으로 복사하지 말 것 |
| P2 시각 통일 | 구판 6종은 정보·링크 자체가 이미 존재 | 전면 재구현을 MVP 필수로 묶지 않음. 원 제안 진행 시 기프트 상세→팩 상세→홈→나머지 순서 |

강화 차이 강조(D11), 이웃 기프트(D14), 아트 상수 전체 ETL 이관은 좋은 개선이지만, 정보 정확성과 핵심 동선 검수에 통과하면 최소 정보 MVP의 필수 차단 항목으로 자동 승격하지 않는다. 반대로 잘못된 짝/값/깨진 링크는 외형 완성과 별도로 차단한다.

## 검증 범위와 인계

- 코드: 전체 라우트·레이아웃·공통 목록/상세 컴포넌트·canonical query 진입·README·05-ui·9월 7일 spec 및 계획·backlog13 대조.
- 환경: 최초 dev3100 권한/기존3000 DB 인증 실패는 디자인 미완성과 별개. ops가 별도 audit DB를 적재한 **production `http://localhost:3100/ko`**를 제공했다. 기존3000/타 프로젝트 DB는 이 감사에서 변경하지 않았다.
- ops 제공 검증: 초기 build 성공, ko/en 15개씩 HTTP smoke 30개 모두200. 이는 ops 보고이며 이 감사의 시각 검수 통과가 아니다.
- CUA 기본 브라우저는 없음. 사용자 안내로 cmux 별도 **surface:117** 생성 성공. ops surface:116은 변경하지 않는다. 캡처/실화면 관찰은 아래에 보강한다.
- 모바일 CSS는 grid2 1020px, 상세 카드 860px, EGO 죄악 4열 전환 등 구현. 미디어쿼리 존재만으로 모바일 통과 처리하지 않는다.

### ops 최종 검수 체크리스트

1. 1440px/390px에서 홈→기프트 검색→상세→등장 팩→전용 기프트 왕복. 강화 0/+/++ 본문, 합성 재료, 빈값/미상 구분.
2. 인격·EGO 목록 검색/복합 필터→상세→브라우저 뒤로가기. 직접 `?sinner=` 진입·새로고침 시 복원 여부.
3. 인격 레벨·동기화 전환, EGO 각성/침식·동기화 전환. 수치/스킬 변화와 텍스트 토큰 잔여.
4. 팩 전체 풀 펼침(대량 사례), 층→팩 상세, 은총 폴백. 깨진 이미지와 가로 넘침.
5. 키보드 Tab/Enter/Escape로 필터·details·상세 제어. focus-visible은 CSS 구현됨; 실제 순서와 팝업 종료 확인.
6. `/en` 언어 전환, 긴 이름, 검색 결과 0건, 잘못된 locale/상세 ID의 404. 코드 구현과 실제 응답을 별도 판정.

## 실화면 보강 기록

2026-09-08, 별도 cmux surface:117. 새 디자인 6/구판 6은 코드 분류로 승인되었으며 아래 표본 검수를 보강했다. **1440px 데스크톱 및 목표 390px 모바일은 이번 design surface에서 미검증**이다. 브라우저 분할 뒤 실제 viewport가 251×712 CSS px였다. PNG는 2배 픽셀 이미지이므로 파일 너비 502px를 viewport로 오인하지 않는다.

| 표본 / 실제 폭 | 확인 결과 | 증거 |
|---|---|---|
| `/ko` DOM | EGO 115, 기프트 582, 인격 184, 팩 117. squad/recommend/glossary nav와 홈 glossary 링크 노출 | cmux snapshot. 최초 숨겨진 pane의 viewport=0 캡처 실패는 검수에서 제외 |
| `/ko/gifts`, 251px | 실제 표시 총 456, 초기 200/456 더 보기. scrollWidth=251로 가로 넘침 없음. 검색 입력 `fill`만 수행했으므로 React 검색 동작 통과/실패 판정 제외 | `/tmp/design-mvp-gifts-251.png` |
| `/ko/gifts/9063`, 251px | 목록 링크 클릭→추억의 펜던트 상세. 기본/+/++ 본문 각각 존재, 합성 사용처 2·전용 팩 0·등장 팩 71. scrollWidth=251. 목록 로마자 I가 상세 숫자 1로 바뀌는 표기 불일치 | `/tmp/design-mvp-gift-detail-251.png` |
| `/ko/packs/1001`, 251px | 위 기프트의 팩 링크 클릭→잊혀진 자들. 전체 풀 73, details 펼침 open=true 및 링크73개. broken image 0, scrollWidth=251. 전체 풀 기프트 링크는 `/ko/gifts/9002`로 이어짐 | `/tmp/design-mvp-pack-251.png` |
| `/ko/identities`→`/ko/identities/10101`, 251px | 목록 scrollWidth=251. 상세 scrollWidth=344로 **93px 넘침**, 이미지 broken0. 레벨·동기화 제어 존재는 DOM 확인; 변화 동작은 이번 표본에서 미검증 | `/tmp/design-mvp-identity-251.png` |
| `/en/egos`→`/en/egos/20101`, 251px | 목록 scrollWidth=251. 상세 scrollWidth=337로 **86px 넘침**, broken0. 두 페이지 모두 html.lang=`ko`. 상세 Season 값이 `통상`으로 남음 | `/tmp/design-mvp-ego-en-251.png` |

캡처 5개를 열어 확인했다. 좁은 화면에서 기프트 목록·상세 본문은 줄바꿈되지만 헤더/nav가 화면 높이를 많이 사용한다. 인격·EGO 상세는 큰 제목과 스킬 summary 영역이 넘친다. 251px는 목표 모바일보다 좁으므로 **출시 차단으로 단정하지 않는다**. 390px/320px 검수 후 재현되면 제목 줄바꿈·최소 너비·summary 태그 wrapping을 제한적으로 보완한다. 전면 재설계 필요 근거는 아니다.

ops 제공 별도 실측(직접 재실행 아님): 503px 기프트 목록·gift9001 상세 가로 넘침 없음, 목록 이미지201개 broken0, 정렬 토글 동작. 루트307→`/ko`, 잘못된 locale·네 엔티티 invalid ID 모두404. 영문 EGO 상세 lang=ko도 ops가 재확인했다.

최종 권고: **정보 12종을 후보 MVP로 유지하고 구판 외형은 허용**한다. 먼저 범위/표면·개수 의미·언어 태그를 맞추고, 필터 URL 요구를 구현 또는 명시적으로 축소한다. data가 실제 값/번역 부채를 확인하고 390px 핵심 동선만 추가 검수하면 된다. 강화 차이 강조·관련 기프트·전체 아트 이관과 구판6종 리디자인은 후속 개선으로 분리할 수 있다. 공개 배포 승인과 제품 완료 판정은 ops 최종 검수에 남긴다.

이 감사가 생성한 것은 이 문서와 `/tmp/design-mvp-*.png`뿐이다. 동시 작업으로 생긴 `src/v2/**` 변경은 data 소유이며 수정·복구하지 않았다. 테스트/build 재실행은 제품 코드 변경이 없고 ops가 수행 중이므로 중복하지 않았다.
