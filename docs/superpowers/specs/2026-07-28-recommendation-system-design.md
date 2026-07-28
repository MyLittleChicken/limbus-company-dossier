# 추천 시스템 — 세션 작업 스펙

> **임시 문서다.** 이 브랜치의 작업을 이끌기 위한 것이며 작업이 끝나면 제거한다.
> 상세 설계의 정본은 [`docs/07-recommendation-system.md`](../../07-recommendation-system.md) 이다.
> 여기에는 정본에 담지 않는 것 — 작업 분할, 브랜치 운영, 확인해야 할 것 — 만 적는다.

작성 2026-07-28 · 대상 브랜치 `feat/recommendation-system`

## 1. 이번에 만드는 것

| # | 항목 | 화면 |
| --- | --- | --- |
| 1 | 저장 계층 (`limbus:schema` · `limbus:decks` · `limbus:run`) | — |
| 2 | 편성 편집 — 수감자 12 슬롯 · 인격 · E.G.O 등급별 1 · 출전 7 · 덱 최대 10 | `/squad` |
| 3 | 덱 코드 입출력 | `/squad` |
| 4 | 런 추적 — 덱 선택 · 층 루프 · 후보 팩 · 근거 · 되돌리기 | `/recommend` |
| 5 | 획득 기프트 기록 모달 — 한정/공용 분리 | `/recommend` |
| 6 | Server Action + `POST /api/recommend` | — |

## 2. 하지 않는 것

- 추천 알고리즘 변경 → 엔진 브랜치
- 인격·E.G.O 메카닉 저작, 특수 취급 7건 → 데이터 작업 + 엔진 브랜치
- 플레이 기록 서버 수집 → 이후 버전
- 기프트 선택 추천(`marginalValue`) → 팩 흐름이 자리잡은 뒤

**추천 결과가 이상해도 이번 범위에서는 문제가 아니다.** 흐름이 끝까지 도는 것이 기준이다.

## 3. 브랜치 운영

```
main
 ├─ docs/recommendation-system      이 문서 + docs/07  ← 선행
 ├─ feat/recommendation-system      웹.  현재 워크트리
 └─ feat/engine-deck-feature        엔진. ../limbus-engine 워크트리
```

### 3.1 워크트리 제약 (실측)

`compose.yaml` 이 `container_name: limbus-postgres` 와 포트 5432 를 고정한다.
두 워크트리가 동시에 `db:up` 하면 실패한다.

```
Error response from daemon: Conflict. The container name "/limbus-postgres" is already in use
```

**DB 하나를 공유한다.** 한쪽에서만 `db:up` 하고 양쪽 `.env` 가 같은 5432 를 본다.
둘 다 읽기 전용이고 `max_connections=100` 이라 여유가 있다.

워크트리에 따라오지 않는 것 — `node_modules`(618M) · `data`(42M) · `build` · `.env`.
`core.hooksPath` 는 `.git/config` 에 있어 공유되므로 훅은 양쪽에서 동작한다.

### 3.2 소유와 금지

| | 웹 | 엔진 |
| --- | --- | --- |
| 소유 | `app/**` `components/**` `lib/queries/**` `lib/storage/**` `lib/deck-code/**` | `lib/engine/**` `src/engine-proof.ts` `src/engine-golden.json` |
| 금지 | `lib/engine/**` 수정 | 공개 시그니처 변경 |

접점은 `loadIdentities` 의 `equipped` 인자와 `lib/queries/recommend.ts` 의 호출 한 줄.
둘 다 **엔진 쪽이 가져간다**(`docs/07` 9.1).

## 4. 구현 순서

의존이 있어 순서를 지킨다.

1. **저장 계층** — 타입 · 읽기/쓰기 · 스키마 버전 · 실패 표기. 화면 없이 단위로 확인
2. **편성 편집** — 저장 계층 위에. 덱 없이는 런을 시작할 수 없다
3. **덱 코드** — 편성 모델이 있어야 붙는다. 왕복 일치까지 확인
4. **추천 왕복** — Server Action + Route Handler. `curl` 로 `engine:proof` 슬라이스와 대조
5. **런 추적** — 4가 되어야 화면이 의미를 갖는다
6. **기프트 모달** — 5의 팩 선택이 선행

## 5. 착수 전 확인할 것

- [ ] `recommendForDeck` 이 `deck` 과 `deployed` 를 분리해 받도록 넓히기 — 엔진 변경 아님
- [ ] 덱 코드 실물 샘플 확보 여부 (없으면 16번 이상 인격은 미검증 표기로 진행)
- [ ] `/squad` 의 기존 조회 기능이 편집 추가 후에도 유지되는지

## 6. 완료 조건

- `npm run typecheck` · `npm run build` 통과, CI 그린
- `curl POST /api/recommend` 결과가 `engine:proof` 슬라이스 4와 일치
- 덱 코드 왕복 일치
- 브라우저로 완주 — 12명 편성 → 런 시작 → 3개 층 → 되돌리기 → 종료
- 층당 소요를 실측해 `docs/07` 10절에 기록

## 7. 이 문서를 지울 때

`feat/recommendation-system` 이 병합되고 `docs/07` 10절에 실측치가 들어간 시점.
