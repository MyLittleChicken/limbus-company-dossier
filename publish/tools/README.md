# 프로토타입 도구

프로토타입을 만들고 검증하는 데 쓴 스크립트다. **여기 있는 것은 산출물이 아니라 산출물을
만든 코드다** — `publish/js/pack-names.js` 의 값과 `publish/css/globals.css` 의 띠 좌표가 전부
이 스크립트들의 측정 결과이며, 코드가 없으면 애셋 스냅샷이 갱신될 때 값을 다시 뽑을 수 없다.

경로 규약은 셋이다.

| 이름 | 가리키는 곳 |
| --- | --- |
| `HERE` | 이 폴더 (`publish/tools`) |
| `ROOT` | 저장소 루트 |
| `CACHE` | `publish/tools/cache` — 중간 산출물과 내려받은 카드 |

**`cache/` 는 산출물이 아니다.** 위키에서 내려받은 게임 카드가 여기 쌓이며 권리상 배포물에
넣지 않는다(`publish/PACK-ART.md` 6절). 중간 JSON 넷(`wiki-survey` · `name-analyse` ·
`boss-alpha` · `pack-audit`)만 다시 돌리지 않고 대조할 수 있게 남겨 두었다.

**Chrome 작업 프로필도 여기 생기고 남기지 않는다.** 캡처 스크립트가 `--user-data-dir` 로
쓰는 자리이며 한 번 돌리면 수백 MB 가 된다(실측 382MB). 필요 없으면 지운다 — 다시 만들어진다.

## 값을 다시 뽑는 순서

애셋 스냅샷이 갱신되면 이 순서로 돌린다.

```
node publish/tools/wiki-survey.mts    # DB 의 영문명으로 위키 카드 실재를 전수 확인 → cache/wiki-survey.json
node publish/tools/wiki-fetch.mjs     # 위 목록의 카드를 받는다. 이미 있으면 건너뛴다 → cache/cards/
node publish/tools/name-analyse.cjs   # 카드와 봉지 애셋의 차분에서 이름 글자 색 → cache/name-analyse.json
node publish/tools/boss-centroid.cjs  # 보스 파일의 알파 가중 무게중심 → cache/boss-alpha.json
node publish/tools/emit-packart.cjs   # 위 둘을 합쳐 publish/js/pack-names.js 생성
```

`wiki-survey.mts` 는 DB 가 떠 있어야 한다(`npm run db:up`). 나머지는 파일만 읽는다.

띠 좌표는 자동 생성이 아니라 **측정 후 CSS 에 손으로 옮긴 값**이다.

```
node publish/tools/band-measure.cjs           # 애셋 114 개의 이름 띠 좌표를 전수 측정
node publish/tools/band-probe.cjs <파일...>    # 한 애셋의 행별 밝기·분산 프로파일을 본다
```

## 캡처와 검증

```
node publish/tools/publish-dump.mjs [화면...]  # 실행 중인 앱의 DOM 을 떠 publish/screens 로
node publish/tools/verify-publish.mjs          # 24 화면 × 1440·390px 구조 검증
node publish/tools/check-names.mjs             # 팩 카드의 이름 인쇄·보스 합성 집계
node publish/tools/review-sheet.mjs            # 전체를 한 장에 늘어놓는 컨택트 시트 → publish/review/
node publish/tools/shot-cdp.mjs <out.png> <path> [w] [h] [--seed deck.json]
```

`review-sheet.mjs` 는 `publish/review/` 에 썸네일 48 장과 목록 페이지를 만든다.
**산출물을 남겨 두지 않는다** — 화면이 바뀌면 곧 낡고 3MB 가 쌓인다. 볼 때 만들고 지운다.
`--desktop-only` 로 모바일 캡처를 건너뛸 수 있다.

`publish-dump.mjs` 는 dev 서버(`npm run dev`)가 떠 있어야 한다. 나머지는 정적 파일만 읽으므로
서버가 필요하지 않다.

`shot-cdp.mjs` 는 환경 변수로 조절한다 — `SHOT_ORIGIN`(기본 `http://localhost:3000`) ·
`SHOT_FULL=0`(뷰포트만) · `SHOT_WAIT`(대기 ms) · `SHOT_SCALE`(픽셀 밀도) · `SHOT_SCROLL`(스크롤 y).

편성 화면은 덱이 localStorage 에 있어 표본이 필요하다.

```
node publish/tools/pick-deck.mts > cache/deck.json        # 12 칸을 채운 표본 (DB 필요)
node publish/tools/make-partial-deck.mjs                  # 빈 칸이 섞인 표본
```

## 감사

```
node publish/tools/pack-audit.mts   # 팩 117 종의 스프라이트·보스 그림·구별 가능성 전수 대조
```

## 되풀이하지 말 것 — 실패한 접근

같은 함정을 다시 밟지 않도록 남긴다. 자세한 경위는 `publish/PACK-ART.md` 에 있다.

| 무엇 | 왜 실패했나 |
| --- | --- |
| 위키 카드와 봉지 애셋을 그냥 겹쳐 차분 | 카드가 700, 애셋이 690 이라 세로 1.4% 어긋나 모든 경계에서 차이가 나고 마스크가 창 전체를 채운다. **정렬 단계가 먼저다** |
| 애셋을 `resize({ width })` 로 축소해 띠를 찾기 | 세로까지 줄어 1~2px 괘선이 표본에서 빠진다. **폭만 줄이고 높이는 원본 그대로** 둔다 |
| 밝은 쪽 상위만 취해 글자 색 뽑기 | 어두운 글자에서 배경색이 나온다 |
| Otsu 로 두 무리를 갈라 작은 쪽을 글자로 | 판(어두워진 띠) 색이 나온다 |
| 차분 픽셀의 중앙값 | 안티에일리어싱과 섞여 중간색으로 끌린다. 크림색 글자가 갈색이 됐다 |
| 보스 그림을 알파 **절대 경계**로 중심 잡기 | 가장자리 잔여 픽셀 하나가 상자를 늘려 중심이 밀린다 |
| 보스 그림을 알파 **경계의 중점**으로 중심 잡기 | 한쪽으로 뻗은 불꽃·꼬리가 경계를 늘려 40 종 전부 왼쪽으로 치우친다(오차 ±5.5%). **무게중심을 쓴다** |
| 보스 그림 크기를 정규화 | 게임은 고정 사각형에 그린다. 큰 그림은 줄고 작은 그림은 커져 원작에서 멀어진다 |
| 이름 글자 크기에 컨테이너 질의(`cqi`) | `container-type: inline-size` 가 인라인 축 containment 를 걸어 내용으로 폭을 정할 수 없게 만든다. 통이 0 으로 붕괴했다 |
| 카드 형식을 `naturalWidth` 로 가르기 | 목록 그림이 `loading="lazy"` 라 화면 밖이면 치수가 0 이다. **파일명(`_Extreme`)으로 가른다** |
| 컨택트 시트를 `captureBeyondViewport` 전면 캡처로 | 뷰포트를 페이지 높이까지 늘리면 지연 로딩 이미지 수백 장이 한꺼번에 불린다. 3 화면에 10 분이 걸렸다. **필요한 위쪽만 찍는다** |
| 페이지 높이를 `documentElement.scrollHeight` 로 | 뷰포트로 하한이 잡힌다. 썸네일용으로 뷰포트를 늘려 두면 짧은 페이지가 전부 그 값으로 보고된다. **`body` 에서 읽는다** |
| 데스크톱·모바일 썸네일을 서로 다른 배율로 | 폭의 비가 실제 비가 아니게 되고, 긴 모바일 썸네일이 카드 높이를 끌어올려 짧은 화면 옆에 빈 공간이 크게 남는다 |

## 아직 없는 것

**게임 카드와 우리 렌더를 픽셀로 대조하는 도구가 없다.** 지금 검증은 구조(클래스 대응 ·
가로 넘침 · 콘솔 오류 · 깨진 이미지)까지이고, 좌표·색이 맞는지는 사람이 화면을 보고 판단했다.
필요성과 설계는 [`docs/backlog/05-pack-art-verification.md`](../../docs/backlog/05-pack-art-verification.md)
에 적어 두었다.
