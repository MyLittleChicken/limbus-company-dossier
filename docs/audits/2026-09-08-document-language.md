# 문서 언어 정합성

상태(2026-09-09): **ops가 정상 문서 수정의 분리 인수(A)를 확정했다.** 정상16경로 SSR·위조헤더 방어와 클라이언트 전환은 검증 PASS다. 초기 notFound 오류 문서의 SSR lang 누락은 이번 인수 범위 밖의 잔여 P1이다. PR 준비 검증이 완료됐다: ops729테스트·타입검사·build와 HTTP/media 검증, design 새 문서 전환 재검수 PASS. 현재 요청은 검증이며 커밋·푸시·PR 생성은 수행하지 않는다. 승인 브랜치는 `fix/document-language`다.

이번 인수 대상은 기존4개 제품파일·최소 회귀·이 감사 문서다. 실패한 not-found 경계2파일은 ops가 제거했으며 최종 변경에 포함하지 않는다. design은 제품 코드·커밋·푸시·DB·빌드·서버를 변경하지 않는다. 아래 build/3100 재기동 기록은 ops가 수행한 과거 검증이며, 새 PR 준비 검증 결과와 구분한다.

## 변경과 계약

- `lib/locale.ts`: `localeFromPathname`은 첫 경로 조각만 decode하여 ko/en인지 검증하고 그 외·잘못된 encoding은 기본 ko를 반환한다. 서버와 클라이언트가 같은 함수를 사용한다. 내부 요청 헤더 이름은 `DOCUMENT_PATH_HEADER`다.
- `proxy.ts`: 실제 `request.nextUrl.pathname`으로 내부 헤더를 항상 덮어쓴 뒤 request headers로만 전달한다. 사용자 입력 헤더에 의존하지 않는다. root layout이 이 경로를 검증해 최초 SSR의 lang을 결정한다.
- `app/layout.tsx`: async headers로 전달 경로를 읽고 `<html lang={locale}>`을 최초 HTML에 출력한다. 기존 CSS와 레이아웃 계층을 유지한다.
- `components/document-language.tsx`: root body에 return-null 컴포넌트를 배치했다. `usePathname` 변경 시 `useLayoutEffect`로 문서 언어만 맞춘다. 초기 SSR의 정확성을 이 사후 동기화로 대신하지 않는다. 강제 key/remount/reload, hydration 경고 억제를 추가하지 않았다.

matcher는 실제 `/media` 및 `/_next` 경계만 제외한다. `/mediafoo`, `/_nextfoo`, `/en/missing.html`, `/ko/missing.html`, 잘못된 locale 문서는 포함한다. 현재 public 파일이 없으므로 favicon 등의 추정 정적 파일도 제외하지 않는다. 미래 정적 파일 예외는 실제 파일 확인 후 정확한 경계로 추가한다.

`/`의 기존307→/ko와 locale layout의 잘못된 locale notFound 처리를 유지한다. 유효 en/ko 아래 잘못된 문서 경로에도 해당 언어를 헤더로 전달한다. 단, 초기 notFound 오류가 root를 우회하면 오류 HTML에는 lang이 반영되지 않는 미해결 한계가 있다. media 경로는 Proxy를 우회하므로 이미지 응답·캐시·ETag 처리를 변경하지 않는다. root가 headers를 읽어 요청별 동적 렌더링을 사용하며 locale 하위의 기존 force-dynamic 정책은 유지한다.

언어 전환의 기존 Link/query 보존 계약과 locale segment에 따른 기존 페이지 상태 정책을 유지한다. 이번 변경은 상태 보존 기능을 추가하지 않는다. 한국어 UI 문구 누수·필터 URL·홈 집계·EGO 정렬은 변경하지 않았다.

## 기존 검증 결과 — PR 준비 재검수 전 기록

`lib/document-language.test.ts`의 3개 회귀 그룹을 구현 전 실행해 parser/proxy 미구현으로 실패하는 RED를 확인했다. 구현 후 GREEN 3/3:

1. 지원 locale·encoded 첫 조각·잘못된 locale/encoding·점이 포함된 문서404의 파싱.
2. Next 설치버전의 실제 matcher 검사기로 namespace 경계 및 문서 포함 확인. Next16.2.12의 테스트 API 이름은 `unstable_doesMiddlewareMatch`다.
3. 실제 NextRequest/NextResponse로 내부 요청 헤더 위조 덮어쓰기, 잘못된 경로의 기본 언어, 다른 헤더 유지와 redirect/직접 응답 헤더 미추가 확인.

실행 명령:

```sh
node --import tsx --test lib/document-language.test.ts
node node_modules/typescript/bin/tsc --noEmit --incremental false -p tsconfig.json
node node_modules/typescript/bin/tsc --noEmit --incremental false -p tsconfig.pipeline.json
```

모두 종료0. root proxy.ts는 회귀 파일 import를 통해 웹 타입검사 대상에 포함된다. 실제 Next production SSR/브라우저 전환은 이 단위회귀로 검증했다고 주장하지 않는다. `.next` 빌드와3100 재시작은 ops 소유다.

## 확정된 인수 범위와 PR 검증 기준

- 네 도감 목록/상세8경로×ko/en: JS 없이 최초 HTTP HTML의 html.lang 정확; hydration 이후에도 일치·경고0.
- LocaleSwitch, 내부 Link, 뒤로/앞으로, 직접진입, 새로고침 후 pathname/lang 일치. query 보존, 추가 full reload/remount 없음. EGO 수감자 섹션 내 등급→출시일→ID 정렬 불변.
- `/`307→/ko와 invalid locale·네 도감 invalid ID의 HTTP404를 유지한다. **초기 notFound 오류 HTML의 lang 정확성은 이번 정상 문서 인수의 통과 조건에서 제외하고 잔여 P1로 추적한다.** `/en/missing.html`처럼 root를 통과하는404와 오류 shell404를 구분해 기록한다. 위조 헤더·점 포함 문서·namespace 경계 회귀는 유지한다.
- 실제 `/media`200/304/없는파일404, 바이트·ETag·cache 동작 불변.
- 한국어 문구 누수/URL 필터/홈개수 및390px 모바일 미검증은 별도 잔여로 유지.

3100의 일시 연결 거부는 ops 재기동으로 해소됐다. 재접속 후 영어10616/20310 상세는1008px에서 정상이며 당시 기존 버전의 lang=ko를 재확인했다. 그 환경 이력을 현재 장애로 분류하지 않는다.


## 후속 실험 — 명시적 404 경계

ops production 검수에서 정상16경로 SSR 언어와 위조헤더 방어는 통과했다. 반면 `/ja/gifts` 및 `/en/{identities,egos,gifts,packs}/99999999`는 HTTP404이지만 `<html id="__next_error__">`에 lang이 없어 당시 전체 문서 인수 기준을 통과하지 못했다. 현재는 ops의 분리 인수 결정에 따라 잔여 P1로 추적한다. `/en/missing.html`은404+lang=en으로 정상이다. 설치 Next16.2.12의 app-render 초기 오류 경로가 root 대신 lang 없는 오류 seed를 구성하는 것을 소스에서 확인했다.

ops 승인으로 `app/not-found.tsx`와 `app/[locale]/not-found.tsx`를 **제한된 실험**으로 추가했다. root fallback은 기존 내부 요청 헤더와 localeFromPathname으로 언어를 결정하고404 제목과 최소 안내 본문만 반환한다. locale fallback은 이를 재사용한다. html/body 태그와 기존 notFound 호출·상태 코드는 변경하지 않는다. 웹 타입검사 종료0.

실험 결과 실패다. ops build 종료0 후에도 위5경로 모두 raw status404와 lang 없는 __next_error__ HTML이 동일하게 재현됐다. ops가 두 not-found 파일을 제거했다. 해당 실험은 종료됐으며 PR 준비 검증 대상은 기존4개 제품파일이다. Next 내부 변경·200 우회·hydration 경고 억제를 사용하지 않는다.

별도 client 검수는 새 빌드 browser120의 ko/en EGO 목록에서 LocaleSwitch와 history.back/forward 후 lang/query 일치, html/body 참조 및 performance.timeOrigin 유지, console/errors 비어 있음을 확인했다. cmux native back이 과거 빌드의 페이지를 BFCache에서 복원한 표본은 새 빌드 전환 검수에서 제외했다.


## 실패 실측과 현재 판정

근거 `/tmp/limbus-lang-404-experiment.json`을 design도 읽어 확인했다. `/ja/gifts`와 영어 네 도감 invalidID는404 + `<html id="__next_error__">`; `/en/missing.html`은404 + `<html lang="en">`; 정상 `/en/egos/20310`은200 + `<html lang="en">`이다. build 성공은404 언어 해결을 뜻하지 않는다. 제거된 실험 파일은 최종 변경 범위에 포함하지 않는다. 정상 SSR16경로·위조헤더 방어는 ops 검증, client ko↔en/history/query/html·body 참조 유지는 design 검증으로 구분한다.

## 확정 결정과 보류된 후속 범위

**확정 A: 정상 문서 수정만 분리 인수(ops 결정).** 기존4제품파일과 회귀만 유지하여 정상 문서 SSR 및 client navigation의 개선을 인수한다. 일반 미일치 URL404 중 정상 작동한 사례도 증거로 남기되 모든404가 해결됐다고 일반화하지 않는다. ops가 인수 범위를 정상 문서로 확정했으며, 초기 notFound 오류 문서의 접근성 P1은 별도 후속으로 남긴다. HTTP404·미상 ID 판정·페이지 데이터와 EGO 정렬은 그대로다. 오류 문서에서 브라우저/보조기술의 언어 판단이 불완전하다는 한계가 남으므로 전체 문서 언어 접근성 완료나 제품 QA 완료를 선언할 수 없다.

**보류 B: 오류 응답 소유 구조까지 확대(이번 PR 범위 밖).** 필요한 것은 일반 layout에 lang을 더 쓰는 일이 아니라 Next가 조기 notFound 오류 shell을 만들기 전에, 언어를 가진 완전한 HTTP404 응답을 애플리케이션이 생성할 수 있는 경로다. 이를 검토하려면 invalid locale 판단과 네 상세의 엔티티 존재 확인을 요청 전단에서 공유할 수 있어야 한다. 범위는 proxy/서버 라우팅, 공통 존재 판정 resolver, 명시적404 응답 경로, locale layout 및 네 상세와의 판정 일치 검증으로 넓어진다. 단순 Proxy DB 조회 복제는 조회중복·판정시점 차이·페이지와의 조건 불일치를 만들므로 최소안으로 즉시 채택하지 않는다. HTML 요청과 Next RSC 전환 요청의 처리 계약, status404/URL유지, query/캐시/이미지 namespace 비간섭, 조회 실패500과 실제 부재404 구분까지 설계·검증해야 한다. 이 방식도 현재 구현·검증되지 않았으며 별도 설계 승인이 필요하다.

프레임워크의 해당 early-abort 오류 shell 처리를 수정한 버전이 있는지 검토하는 것은 또 다른 경로다. 확인된 수정 버전은 현재 없으며 패키지 업그레이드만으로 해결된다고 제안하지 않는다. 채택하려면 동일5경로의 raw404/lang 재현과 전체 웹 회귀가 필요하다. Next 내부 직접 패치는 이번 범위에서 제외한다.

단순 root layout 이동, 동일 not-found 경계 재추가, global-not-found 설정 추가만으로는 현재 throw 경로의 해결 근거가 없다. Suspense로 먼저 정상 shell을 전송해 status200으로 바꾸거나, raw HTML/DOM을 사후 치환하거나, hydration 경고를 숨기는 방식은 인수 요구를 충족하지 않는다. 현재는 문서만 갱신하며 추가 구현을 시작하지 않는다.


## 2026-09-09 PR 준비 검증

정상 문서 분리 인수(A)의 최신 검증 기록이다. 제품 QA 전수 완료나 초기 오류 문서 lang 해결을 뜻하지 않는다.

| 검증 | 결과와 근거 | 수행/확인 |
| --- | --- | --- |
| 전체 회귀 |729 PASS, fail0, skip0, 종료0. `/tmp/limbus-lang-pr-tests.log` | ops 실행; design 로그 마지막 집계 확인 |
| 타입검사 | 종료0. `/tmp/limbus-lang-pr-types.log` | ops 보고 |
| production build | 종료0. `/tmp/limbus-lang-pr-build.log`; 이후3100 새 빌드 재기동 | ops 보고 |
| 정상 HTTP SSR | 네 도감 목록/상세8경로×ko/en의 lang 및 위조헤더 방어 PASS. `/tmp/limbus-lang-pr-http.log` | ops 실행; design HTTP 로그 확인 |
| 404 경계 | ko/en dotted404의 lang 정상. 기존 invalid5경로는404 유지·lang 누락 재확인 | ops 보고/HTTP 로그; 잔여 P1 유지 |
| 루트·media | root307. 실제 media 파일 바이트 동일, `Cache-Control: public, max-age=0, must-revalidate`,200/304/없는파일404 PASS | ops 보고/HTTP 로그 |
| 독립 코드 리뷰 | 신규 결함0 | data→ops 직접 보고; design의 독립 재리뷰 결과로 표현하지 않음 |

### 새 문서 client 재검수 — design 직접 수행

기존 browser120은 닫혀 있어 workspace21/pane38에 새 browser **surface123**을 생성했다. `http://localhost:3100/ko/egos?keyword=Combustion&qa=2026-09-09`로 직접 진입하여 document.readyState=complete, html.lang=ko 확인 후 html/body 객체와 performance.timeOrigin 참조를 보관했다.

| 단계 | URL locale / html.lang | query | html·body 객체 / timeOrigin |
| --- | --- | --- | --- |
| LocaleSwitch ko→en | en / en | keyword=Combustion&qa=2026-09-09 유지 | 전부 동일 |
| LocaleSwitch en→ko | ko / ko | 동일 | 전부 동일 |
| history.back() | en / en | 동일 | 전부 동일 |
| history.forward() | ko / ko | 동일 | 전부 동일 |

cmux console list와 errors list는 항목 없이 OK를 반환했다. hydration 관련 오류도 관측되지 않았다. 새 문서에서 수행했으므로 이전 빌드 BFCache 기록을 재사용하지 않았다. 브라우저가 비활성 상태라 innerWidth=0이었다. 이 결과는 DOM·hydration·전환·query·문서 참조 검증이며 시각 배치·페인트·모바일390px 검수 통과를 뜻하지 않는다.

이번 design 변경은 이 감사 문서뿐이다. 제품 코드·DB·빌드·서버·커밋·푸시·PR 생성은 변경/실행하지 않았다. 초기 notFound SSR lang 누락, 한국어 UI 문구·필터 URL·홈 집계와 모바일 미검증은 기존 잔여로 유지한다.
