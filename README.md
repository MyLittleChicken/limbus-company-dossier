# limbus-mirror-tracker

림버스 컴퍼니 **거울 던전** 플레이어가 현재 자신의 런 상황(파티 구성, 보유 E.G.O 기프트)을 기준으로
다음 층에서 어떤 팩을 고를지 판단할 수 있게 돕는 정보·추천 서비스.

## 현재 상태

**1단계(데이터베이스 구축) 완료.** 제품의 정의와 범위는 [docs/00-product.md](docs/00-product.md)에 있다.

| 항목 | 상태 |
| --- | --- |
| 원본 데이터 수집 | 완료 — 6,486 파일, 체크섬 전수 검증 |
| 수집기 (원격 → 원본) | 완료 — 빈 상태에서 1,749 파일 복원 · 체크섬 전수 대조 |
| 의사결정 기록 | 완료 — ADR 4건 |
| 데이터베이스 스키마 | 완료 — 52 테이블 |
| 변환기 (원본 → 정규화 JSON) | 완료 — 52/52 테이블 · 미분류 입력 0 |
| 적재기 (JSON → PostgreSQL) | 완료 — 52,781행 적재 |
| 검증 스크립트 | 완료 — 40건 전부 실행 · 40건 통과 |
| 2단계 (웹페이지 구축) | 조회·검색 화면 구현 — 화면 16종, 로컬 실행 |
| 3단계 (추천 엔진) | 기반 엔진과 슬라이스 5종 — 화상·진동 덱으로 증명 |

값의 정확성은 원본과 전수 대조해 스칼라 필드 불일치 0을 확인했다.
인격 184 · E.G.O 110 · 기프트 456 · 팩 117이 수집 시점 실측(`data/coverage.json`)과 일치하고,
기준 버전(`MD7` · 스냅샷 `2026-07-25`)을 함께 기록했다.

`docs/00-product.md` 6절의 1단계 성공 기준인 "누락 없이 구축"을 충족한다. 인격에 배정된
스킬 836종이 모두 적재되고, 원본이 수치를 갖지 않는 6종은 분류만 담아 **0으로 지어내지 않는다.**
어느 출처에도 없는 값은 비워 두고 리포트에 남긴다.

### 알려진 한계

- **기프트–팩 관계 10,115행은 대조할 출처가 없다.** 전체 관계의 81%다([adr/04](docs/adr/04-source-authority.md) 2.3).
- **원본을 게임 클라이언트와 대조한 적이 없다**([04-data-inventory.md](docs/04-data-inventory.md) 10절).
- 원본 결손으로 채울 수 없는 것 — 소속 한국어 7종 · 상태 이름 자리표시자 7종 ·
  스킬 이름 3종(동기화 1단계) · 스킬 수치 6종 · 스킬 이름과 코인 설명의 한국어 3종(영문 노출).
- 스킬 6종의 정의를 갱신 중단된 과거 스냅샷에서 받는다([adr/04](docs/adr/04-source-authority.md) 2.3).
- 코인 918행은 어느 언어로도 설명이 없다. 효과 없는 코인이라 결손이 아니다.
- 기프트 15종은 색 속성(`attributeType`)이 비어 있다. 보강 출처에 없으며 지어내지 않는다.
- **소속 93종은 소속만 담고 있지 않다.** 원본 필드가 `tags` 이고 조직·계급·종족·메타가 섞여 있다
  ([backlog/01](docs/backlog/01-identity-tags.md)).
- **한국어 폴백이 화면에 표기되지 않는다.** 파이프라인이 `ko` 행에 영문을 채우기 때문이다
  ([backlog/02](docs/backlog/02-locale-fallback.md)).
- 추천에 필요한 효과 분해와 조건 정의는 이 단계에 없다. 3단계의 저작 대상이다.

## 무엇을 만드는가

거울 던전 컨텐츠를 어려워하는 유저와 숙련된 유저 모두를 대상으로 하며, 네 개의 구성요소로 이루어진다.

| 구성요소 | 역할 |
| --- | --- |
| 정보 제공 | 인격 / E.G.O / E.G.O 기프트 / 팩 데이터의 조회·검색 |
| 런 상태 입력 | 진행 중인 런의 파티 구성, 보유 기프트, 현재 층 입력 |
| 추천 | 입력된 상황과 데이터를 매칭해 층별 팩 선택지를 점수화하고 근거를 제시 |
| 피드백 루프 | 종료된 런의 결과를 집계해 추천 가중치를 갱신 (이후 버전) |

## 개발 단계

| 단계 | 내용 |
| --- | --- |
| 1 | 데이터베이스 구축 (인격 / E.G.O / E.G.O 기프트 / 팩) |
| 2 | 웹페이지 구축 — 화면 구조, 디자인 기반, 데이터 조회 UI |
| 3 | 추천 엔진 구축 — 엔티티 간 관계와 메카닉 정의, 점수화 로직 |
| 4 | 추천 시스템 구축 — 런 상황 입력, 엔진 매칭, 추천과 근거 제시 |

이후 버전에서 플레이 기록 수집과 로그 기반 가중치 개선, 로그인 계정, 데이터 갱신 파이프라인을 다룬다.

## 문서

`docs/` 아래에 번호 순으로 누적한다. 각 문서는 대응하는 단계의 구현에 선행한다 — 문서 없이 해당 단계를 시작하지 않는다.

| 문서 | 내용 | 작성 시점 | 상태 |
| --- | --- | --- | --- |
| [00-product.md](docs/00-product.md) | 제품 정의 — 문제 인식, 대상 사용자, 제품 구조, 단계별 범위, 성공 기준, 리스크 | 전체 착수 전 | 작성됨 |
| [01-data-source.md](docs/01-data-source.md) | 데이터 소스 — 인격·E.G.O·기프트·팩 데이터의 출처, 확보 범위, IP 준수 사항 | 1단계 착수 전 | 작성됨 |
| [02-data-model.md](docs/02-data-model.md) | 엔티티 스키마와 관계 정의 | 1단계 착수 전 | 작성됨 |
| [03-data-provenance.md](docs/03-data-provenance.md) | 데이터 출처 분석 — 추출 데이터와 저작 데이터의 구분, 계층별 신뢰도 | 1단계 착수 전 | 작성됨 |
| [04-data-inventory.md](docs/04-data-inventory.md) | 데이터 수집 완전성 근거 — 출처 19종, 교차 대조 결과, 갭 규명 | 1단계 착수 전 | 작성됨 |
| [05-ui-foundation.md](docs/05-ui-foundation.md) | 화면 구조와 디자인 기반 — 화면 목록, 필터 축, 로케일·결손 표기, 이미지 애셋 정책 | 2단계 착수 전 | 작성됨 |
| [06-recommendation-engine.md](docs/06-recommendation-engine.md) | 추천 엔진 설계 — 어휘 사전, 조건 평가, 한계 효용, 팩 점수, 슬라이스 증명 | 3단계 착수 전 | 작성됨 |
| `docs/07-recommendation-system.md` | 런 상태 입력 흐름과 추천·근거 제시 방식 설계 | 4단계 착수 전 | 예정 |

### 백로그

확인했으나 지금 단계에서 처리하지 않기로 한 것은 [`docs/backlog/`](docs/backlog/README.md)에 남긴다.
ADR이 내린 결정을 기록한다면 백로그는 미룬 일을 기록한다. 둘 다 판단의 근거를 잃지 않기 위한 것이다.

### 아키텍처 결정 기록 (ADR)

기술 스택, 데이터 저장 방식, 배포 환경처럼 되돌리기 어려운 결정은 `docs/adr/`에 남긴다.
결정이 필요한 시점마다 `01`부터 순번을 붙여 파일을 하나씩 추가하며, 위 문서 번호와는 독립적인 체계다.

| ADR | 결정 | 상태 |
| --- | --- | --- |
| [01-data-storage.md](docs/adr/01-data-storage.md) | 데이터 저장 형식 — 정규화 JSON으로 정리하고 PostgreSQL에 적재·검증 | 채택 |
| [02-pipeline.md](docs/adr/02-pipeline.md) | 변환·적재 파이프라인 — TypeScript, Prisma(마이그레이션 러너 미사용) | 채택 |
| [03-localized-text.md](docs/adr/03-localized-text.md) | 다국어 표시 문자열 — 로케일별 행 분리, 한국어·영어, 빌드 시점 토큰 치환 | 채택 |
| [04-source-authority.md](docs/adr/04-source-authority.md) | 출처 권위 — 엔티티별 정본 하나, 정본에 없는 필드만 보강 | 채택 |
| [05-web-serving.md](docs/adr/05-web-serving.md) | 웹 서빙 — Next.js(App Router), 요청 시점 서버 렌더, 서버 계산, 배포 환경 미정 | 채택 |

## 개발 환경 설정

클론 후 한 번 실행한다.

```
git config core.hooksPath .githooks
```

`.githooks/pre-commit`이 `data/` 아래 파일의 커밋을 막는다. 이 디렉토리는 Project Moon 저작물에서
유래한 로컬 스냅샷이라 재배포하지 않으며, 추적하는 파일은 `README.md` · `manifest.json` · `coverage.json` 셋뿐이다.
`.gitignore`가 1차 방어이고 훅은 `git add -f`로 무시 규칙을 넘긴 경우를 잡는 2차 방어다.

### 데이터 파이프라인

클론 직후 `data/`에는 원본이 없다(커밋하지 않는다). 아래를 순서대로 실행하면 원격에서
원본을 받아 데이터베이스까지 채운다.

```
npm install
cp .env.example .env

npm run fetch                  # 원격 5곳 → data/entities/*.json (1,749개)
npm run db:up                  # PostgreSQL 컨테이너 기동 (준비될 때까지 대기)
npm run db:ddl < prisma/schema.sql
npm run convert                # 원본 → build/data/*.json (52개)
npm run load                   # JSON → PostgreSQL
npm run verify                 # coverage.json 과 대조
npm run engine:proof           # 추천 엔진 슬라이스 5종 증명
```

### 웹 애플리케이션

데이터베이스가 채워진 뒤에 실행한다. 결정 근거는 [adr/05](docs/adr/05-web-serving.md)에 있다.

```
npm run fetch -- --assets      # 이미지 4,737개 포함 (204 MB) — 기본 fetch 에서 빠져 있다
npm run assets                 # public/assets → data/assets 연결
npm run generate               # Prisma Client 생성
npm run dev                    # http://localhost:3000
```

`npm run assets`는 복사가 아니라 링크를 만든다. 204 MB를 두 벌 두지 않기 위해서이며,
링크를 만들 수 없는 환경에서만 복사로 물러난다. `public/assets`는 커밋하지 않는다.

**배포 환경은 정하지 않았다**([adr/05](docs/adr/05-web-serving.md) 3.5). 2단계는 로컬 실행까지다.

컨테이너는 **Docker**로 띄운다. 컨테이너 설정은 `compose.yaml` 하나에만 있고 `db:up` · `db:ddl`도
그것을 거친다 — 설정을 npm script와 compose 양쪽에 두면 로케일 같은 항목이 조용히 어긋난다.
`npm run db:up`은 `--wait`로 healthcheck 통과까지 기다리므로 곧바로 `db:ddl`을 이어 실행해도 된다.

`npm run fetch`는 `data/manifest.json`이 파일마다 기록한 출처·경로·체크섬대로 내려받고
**1,749개 전부의 체크섬을 대조한다.** 하나라도 어긋나거나 받지 못하면 종료 코드 1이다.
커밋을 고정해 받으므로 최신 데이터가 아니라 **검증된 스냅샷**이 그대로 재현된다.
이미지 4,737개는 변환기가 읽지 않아 기본에서 빠지며 `npm run fetch -- --assets`로 포함한다.

`build/`는 추출 파생 데이터라 커밋하지 않는다([adr/01](docs/adr/01-data-storage.md) 6절).
`prisma/schema.sql`은 `prisma migrate diff` 산출물이며, 마이그레이션 러너를 쓰지 않으므로
데이터베이스에 관리 테이블이 생기지 않는다([adr/02](docs/adr/02-pipeline.md) 3.2).

## 커밋·PR 제목 규약

[Conventional Commits](https://www.conventionalcommits.org/)를 따른다.
`main`은 squash 병합만 허용하므로 **PR 제목이 곧 `main`의 커밋 제목**이 된다.

```
type(scope): 설명
```

| type | 용도 |
| --- | --- |
| `feat` | 기능 추가 |
| `fix` | 버그 수정 |
| `docs` | 문서 |
| `refactor` | 동작 변경 없는 코드 정리 |
| `test` | 테스트 |
| `chore` | 빌드·설정·도구 |

scope는 선택이며 `adr` · `data` · `pipeline` · `web`처럼 대상 영역을 적는다.
설명은 한국어 명사구로 쓰고 마침표를 붙이지 않는다.

브랜치 이름도 `type/설명` 형태를 쓴다 (예: `docs/adr-data-layer`).

## 라이선스

이 저장소의 **코드와 문서**는 [MIT License](LICENSE.md)를 따른다. 상업적 이용을 포함해 자유롭게 사용·수정·재배포할 수 있다.

Limbus Company와 Project Moon의 저작물(게임 데이터·텍스트·이미지·명칭)에는 적용되지 않는다.
그 권리는 Project Moon에 있고 이 프로젝트에는 재라이선스 권한이 없다. 게임에서 유래한 데이터는 저장소에 포함하지 않는다.

## 고지

비공식 팬 프로젝트이며 Project Moon과 제휴·승인 관계가 없다.
이 프로젝트는 비영리로 운영하며 서비스로 수익을 얻지 않는다.
권리자의 요청이 있으면 해당 자료를 제거한다.

Project Moon은 2차 창작 가이드라인을 공표하고 있으며 **게임 이미지 리소스의 사용을 제한한다.**
공개 배포 전에 원문을 확인하고 준수 여부를 판단해야 한다(`docs/01-data-source.md` 7절).
