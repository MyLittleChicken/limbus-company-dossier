# 인격·E.G.O 데이터 최신성 감사 — 2026-09-08

**로컬 결론: 게임 업데이트 이후 새 인격·E.G.O를 추가 수집한 증거가 없으며, 현재 원본은 2026-07-25 고정 스냅샷 그대로다. `npm run fetch`는 최신 갱신 명령이 아니라 고정 재현 명령이다.** **상류 정본 assets HEAD와 대조하면 인격 1개·E.G.O 2개가 현재 로컬에 없다.** 이는 조회한 상류와의 차이이며 현재 게임 전체 추가 수를 보증하는 수치가 아니다.

## 로컬 증거

- manifest.generatedAt `2026-07-25`, coverage.snapshot `2026-07-25` / checkedAt `2026-07-26`.
- 현재 HEAD `2f945da5b7c1c79bdb5f3fe7003ed437a4118cab`(2026-08-31). `git log --all -- data/manifest.json`에서 manifest 변경은 `acb595e`와 `5fb2aea`(모두 2026-07-26)뿐이다. 이후 수집 대상/commit 갱신 이력 없음. 무시된 원본 디렉토리는 git 이력 자체로 추적할 수 없으므로 실제 바이트도 대조했다.
- 정본 `limbus-assets` pin: `774883d716e945d0b565ed27ad4b4123e0bea053` (`main`이라는 branch 이름이 있어도 URL은 commit 사용).
- 보강 mj pin `97c385678e3bc1d9013eb735c48203ef63f3ac51`, loc-ko `595947fc895d8fcdf8a303f013d11ae669ecb577`, loc-en `ccfff8e3dac0b29f6540705c00d2bc26b7c14d16`.

| 정본 원본 | 로컬 건수 | 원본 date 최대 | LF SHA-256(현 manifest와 일치) |
| --- | ---: | --- | --- |
| identities.json | 184 | 2026-07-23 | `fba1fa377f2dfa2c85032387714503d59673f5ab59ec3158c65277aa04c585a8` |
| egos.json | 110 | 2026-07-09 | `f6a9e9bf0527cd243469231581d46304f45dd9d8cdf70e98ecfdffe3c410d5f9` |

마지막 인격: 10116 이상 `LCE E.G.O:: Dimension Shredder` (2026-07-23). 마지막 E.G.O: 20109 이상 `Solemn Lament` (2026-07-09). 이름·날짜는 로컬 정본 필드 그대로다.

이전 ops 격리 DB 복원 실측도 인격 184 / 플레이 E.G.O 110(전체115 중 연출용5 제외)이다. 이번에는 DB를 변경하거나 재수집하지 않았다. 다른 기기의 작업·미공유 DB에는 결론을 확장하지 않는다.

## fetch의 의미

`src/fetch.ts:rawUrl()`은 `https://raw.githubusercontent.com/{repo}/{source.commit}/{sourcePath}`를 만든다. `main` HEAD를 찾지 않는다. `main()`은 기존 manifest.files의 파일만 받고 LF checksum을 대조한다. manifest 변경·신규 ID 탐색·새 파일 목록 생성은 없다. `--assets`는 이미지 범위를 추가하며 `--out`은 저장 위치만 바꾼다. 어느 옵션도 최신화하지 않는다.

따라서 fetch나 ETL을 다시 실행한 것, canonical.built_at이 새 날짜인 것, 검증이 통과한 것은 **게임 신규 인격/E.G.O 반영 증거가 아니다**. manifest의 승인된 다음 snapshot과 연관 상세/번역/이미지 데이터 갱신이 따로 필요하다. 이번 작업은 그 변경을 수행하지 않는다.

## 상류 HEAD 비교 결과

ops가 API와 원본 4파일을 받아 HTTP 200을 확인했다. data는 전달된 JSON을 로컬 원본과 **독립 재비교**했다. 로컬 4파일 모두 manifest.sha256Lf와 일치하여 pin의 기록된 내용 그대로임을 확인했고, 신규/삭제 집합도 ops diff와 전부 일치했다. 과거 pin 파일을 원격에서 다시 내려받는 추가 검증은 하지 않았다.

| 출처 | 현재 main HEAD | HEAD commit 시각(UTC) | 인격 pin/local → HEAD | E.G.O pin/local → HEAD |
| --- | --- | --- | ---: | ---: |
| 정본 assets | `0bb8b2be2ea4ccea1f7f7282f7712559bf5cb501` | 2026-09-06 16:42:29 | **184 → 185 (+1)** | **110 → 112 (+2)** |
| 보강 mj | `c4d31114c77f4f2223e8abe5e806be07f1e04d37` | 2026-07-27 14:11:47 | 184 → 184 (+0) | 110 → 110 (+0) |

정본 출처: [assets 인격 JSON](https://raw.githubusercontent.com/eldritchtools/limbus-assets/0bb8b2be2ea4ccea1f7f7282f7712559bf5cb501/data/identities.json), [assets E.G.O JSON](https://raw.githubusercontent.com/eldritchtools/limbus-assets/0bb8b2be2ea4ccea1f7f7282f7712559bf5cb501/data/egos.json).
보강 출처: [mj 인격 JSON](https://raw.githubusercontent.com/monthofjune/limbus_data/c4d31114c77f4f2223e8abe5e806be07f1e04d37/identities.json), [mj E.G.O JSON](https://raw.githubusercontent.com/monthofjune/limbus_data/c4d31114c77f4f2223e8abe5e806be07f1e04d37/egos.json).

### 현재 로컬에 없는 신규 ID

| 종류 | ID | 수감자 | 상류 영문 이름 | 상류 date |
| --- | --- | --- | --- | --- |
| 인격 | **10616** | 히스클리프 (6) | Cinq Assoc. East Section 3 | 2026-08-20 |
| E.G.O | **20310** | 돈키호테 (3) | I'll Go fer Scissors. How 'Bout You? | 2026-08-06 |
| E.G.O | **21210** | 그레고르 (12) | Move-in Reg. | 2026-09-03 |

네 파일 모두 기존 ID 삭제 0, 기존 ID의 이름 변경 0. assets의 기존 인격 3개·E.G.O 6개는 이름 이외 payload가 변경되었다. mj는 기존 payload 변경도 0이다. 따라서 개수만 같다는 것으로 필드 최신성을 보증해서는 안 된다.

### 증거·명령·한계

- 이력: `git log --all --format='%h %ad %s' --date=short -- data/manifest.json`; 현 manifest 및 원본 JSON 읽기. checksum은 `sha256(bytes.replace(b'\r\n', b'\n'))`와 manifest.sha256Lf 비교.
- 상류 HEAD API: `https://api.github.com/repos/eldritchtools/limbus-assets/commits/main`, `https://api.github.com/repos/monthofjune/limbus_data/commits/main`. ops가 얻은 SHA로 위 원본 URL을 고정하여 다운로드했다.
- ops 증거: `/tmp/limbus-freshness-heads.json`, `/tmp/limbus-freshness-files.json`(URL/상태), `/tmp/limbus-freshness-0.json`~`-3.json`(mj 인격/EGO, assets 인격/EGO 순), `/tmp/limbus-freshness-diff.json`.
- data 재검사: `/tmp/limbus-freshness-20260908/local-recheck.json`. 비교 규칙은 배열(mj)을 `{str(row.id): row}`, 객체(assets)를 기존 ID map으로 정규화한 뒤 `HEAD.keys - local.keys`, 역차집합, 교집합 payload/name 대조다.
- data가 처음 준비한 `/tmp/limbus-freshness-20260908/compare-upstream.py`는 **미실행**이다. ops 전달 파일로 검증을 마쳤고 추가 원격 조회하지 않았다. 웹 도구의 캐시된 raw main 응답은 HEAD 증거로 사용하지 않았다.
- **두 상류의 갱신 속도가 다르다.** mj의 '+0'을 게임 신규 추가 없음 또는 로컬 최신이라고 해석하면 안 된다. HEAD commit 시각도 각 파일의 최종 내용 수정 시각이나 게임 출시일과 동일하지 않다.
- 위 '+1/+2'는 **확인한 assets HEAD에 있으나 로컬에 없는 ID 수**다. 공식 게임 전체 출시 목록을 전수 대조하지 않았으므로 정확한 현재 게임 전체 추가/누락 수라고 보증하지 않는다. 신규 ID의 한국어 번역·스킬·상세 수치·이미지·최신 canonical 적재 가능성도 이번 조사 대상이 아니다.
- 원본·manifest·DB·기존 감사 문서는 불변. 이번 저장소 쓰기는 이 최신성 감사 문서뿐이며 다운로드·중간 산출물은 /tmp에 있다.
