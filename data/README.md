# data — 원본 데이터 스냅샷

수집일 2026-07-25 (`차원찢개 이상` 출시 이후 시점) · 구조 확정 및 정리 2026-07-26.
**6,486 파일 / 228 MB / 깊이 3–4단계.** 수집 당시 20,714개에서 작업에 쓰지 않는 14,228개를 확인 후 제거했다.

**이 디렉토리는 저장소에 커밋하지 않는다.** `.gitignore`로 제외되어 있고 `README.md`·`manifest.json`·`coverage.json`만 추적한다.
Project Moon 저작물에서 유래한 데이터이며 재배포가 아니라 로컬 작업용 스냅샷이다(`docs/01-data-source.md` 7절).
수집 범위와 완전성 근거는 `docs/04-data-inventory.md`에 있다.

## 경로 규칙

```
<성격>/<분류>/<출처>/<파일>
```

**파일의 부모 디렉토리는 언제나 출처 id다.** 이 프로젝트는 출처 간 대조로 데이터를 검증하므로,
출처가 항상 같은 자리에 있어야 스크립트가 트리별로 분기하지 않는다. 6,486개 전부 이 규칙을 지킨다.

출처 내부의 중첩 경로는 파일명으로 평탄화하며 구분자는 `__`다.
원본 경로를 복원하려면 `manifest.json`의 `sourcePath`를 봐야 한다 — `data/` 같은 접두어를 제거했으므로
파일명만으로는 복원되지 않는다.

## 트리

```
data/
├── assets/                 4,737   이미지
│   statuses 1,193 · skills 984 · identities 712 · encounters 506 · gifts 476
│   egos 318 · choice-events 158 · packs 155 · announcers 62 · icons 57
│   skill-frames 44 · additional-icons 27 · misc 14 · sinners 12
│   apr-2026 8 · banners 6 · roadmaps 2 · upcoming 2 · supporters 1
│
├── entities/               1,666   엔티티 구조 데이터
│   encounters 380 · identity-details 347 · mechanics 260 · ego-details 215
│   mirror-dungeon 165 · identities 122 · gifts 98 · egos 72 · packs 7
│
├── meta/                      83   수집 메타 · 갱신 이력 · 로드맵
│
├── manifest.json                   출처 · 커밋 · 파일별 체크섬 · 원본 경로 (수집기의 레시피)
├── coverage.json                   완전성 검증 결과
└── README.md
```

## 출처

| id | 출처 | 커밋 | status |
| --- | --- | --- | --- |
| `limbus-assets` | github.com/eldritchtools/limbus-assets | `774883d7` | current |
| `limbus-data-mj` | github.com/monthofjune/limbus_data | `97c38567` | current |
| `loc-ko` / `loc-en` / `loc-ja` | github.com/x1bViolet/Limbus-Localization-Files | `595947fc` / `ccfff8e3` / `2f98ddb4` | current |
| `shared-library` | github.com/eldritchtools/limbus-shared-library | `2b0bfb6b` | superseded (280파일 잔존 — 인격 상세 163 · E.G.O 상세 105 · 집계 10 · 애셋 2) |
| `md-resource` | github.com/eldritchtools/limbus-mirror-dungeon-resource | `beeb89ea` | 거울 던전 DB 스키마 2개만 잔존 |
| `v1-local` | 로컬 `../limbus-mirror-tracker-v1` | `a31aff0c` | superseded (고유 애셋 16개만 잔존) |

제거된 출처 11개도 `manifest.json`의 `sources`에 커밋 해시와 함께 남아 있어 언제든 재수집할 수 있다.
두 주요 GitHub 저장소 모두 **라이선스 파일이 없다.**

## 제거 기록 (2026-07-26)

작업에 쓰지 않는 **14,228 파일 / 495 MB**를 확인 후 제거했다. 전부 커밋 해시로 재수집 가능하다.

| 대상 | 파일 | 확인 내용 |
| --- | --- | --- |
| `locale/` | 5,475 | 스토리 대사·음성·적 전투 텍스트. 엔티티 텍스트는 `entities/`에 별도 확보되어 있다. **삭제 전 거울 던전 관련 143개를 구조했다**(아래) |
| `reference/` | 3,712 | 2023년 게임 원본 덤프 2,574 · 도구 사이트 소스 1,043 · 수집 도구 95. 필요 시 저장소에서 직접 참조 |
| `assets/*/shared-library` | 2,272 | 인격 163종 시절. 엔티티 id가 현행에 완전히 포함되고 애셋도 파일명까지 일치 |
| `assets/*/v1-local` | 2,080 | 인격 183종 시절. 같은 상류에서 파생, 명명만 id 기반으로 다름 |
| `xcheck/` | 582 | 교차 검증용 팬 자료 4종. 대조 결과는 `coverage.json`에 남아 있다 |
| `reference/prior-project` · `md-resource-old` | 107 | v1 사본(원본은 `../limbus-mirror-tracker-v1`에 존재) · 구버전 앱 소스 |

### `locale/`에서 구조한 143개

`locale/`을 그대로 지우면 거울 던전 데이터가 함께 사라지는 것을 발견해 먼저 옮겼다.

| 파일 | 옮긴 곳 | 이유 |
| --- | --- | --- |
| `Enemies*.json` 129개 (43종 × 3언어) | `entities/encounters/` | **인카운터 데이터는 영문 이름만 갖는다.** 적의 한국어 이름은 여기에만 있고, 인카운터가 참조하는 id 중 652건이 이 파일들과 겹친다 |
| `DungeonStartBuffs*.json` 11개 | `entities/mirror-dungeon/` | 거울 던전 시작 버프(코스트 증가, 테마팩 목록 확장 등) 설명. MD6·MD7판 포함 |
| `ChoiceEventEffect.json` 3개 | `entities/mirror-dungeon/` | 선택 이벤트 결과 텍스트. `md_choice_events.json`에는 한국어가 없다 |

### 보존한 구버전 고유 애셋 18개

| 위치 | 파일 |
| --- | --- |
| `assets/icons/v1-local` | `Combo` · `SupportAtk` · `SupportDef` (연계 · 원호 공격 · 원호 방어) |
| `assets/misc/v1-local` | `uptie1`–`4` · `rarity-1`–`3` · `coin_unbreakable` · `coin_excision` · `offense-level` · `slash/pierce/blunt_outlined` |
| `assets/packs/shared-library` | `Collab_Pilgrimage` |
| `assets/statuses/shared-library` | `Circle_EmptyPart` |

## 애셋 파일명이 숫자와 영문으로 갈리는 이유

**파일명은 게임 내부의 스프라이트 키를 그대로 쓴 것이다.** 수집 과정에서 붙인 이름이 아니다.

| 요소 | 파일명 | 예 |
| --- | --- | --- |
| 인격 · 스킬 · E.G.O · 인카운터 | 숫자 (id 기반) | `10101_gacksung_profile.webp`, `1010101.webp` |
| 상태 · 팩 · 선택 이벤트 | 영문 (이름 기반) | `Ammo.webp`, `AF2_Extreme.webp` |
| **기프트** | **둘이 섞임** | `9207.webp` 와 `A Certain Philosophy.webp` |

기프트만 섞이는 이유는 게임 쪽 명명이 일관되지 않기 때문이다.
`gifts.json`의 `srcPath`가 스프라이트 키인데 456종 중 **75종만 값이 숫자**이고, 그것도 **id 9207–9283 구간에 몰려 있다.**
앞(9001–9206)과 뒤(9284–9995)는 모두 영문이다. 이 구간의 기프트는 팩 분류도 키워드도 제각각이라 내용상 공통점이 없다.
특정 시기에 추가된 배치에서 리소스 명명 규칙이 달랐던 것으로 보인다.

**애셋을 id로 추정해 찾으면 안 된다. 기프트는 `srcPath`, 팩은 `sprite` 필드를 봐야 한다.**
`assets/gifts/limbus-assets/9815.webp`는 `gifts.json`에 대응 레코드가 없는 고아 애셋이다.

## 그 밖의 취급 주의

- **디렉토리 이름은 내부 표준이다.** `assets/packs`는 상류에서 `theme_packs`, `assets/choice-events`는 `choice_events`였다. 원본 이름은 `manifest.json`의 `sourcePath`에 남아 있다.
- **BOM.** JSON 12개에 UTF-8 BOM이 있다. 파싱 전에 제거해야 한다.
- **계층별 신뢰도.** 게임에서 추출된 사실과 저장소 관리자가 붙인 분류를 구분해야 한다(`docs/03-data-provenance.md`).
- **인카운터는 영문, 적 이름은 한국어가 따로.** `entities/encounters/limbus-assets`는 영문 구조 데이터이고, 한국어 적 이름은 같은 디렉토리의 `loc-ko`에 있다.
- **E.G.O 스킬에는 스킬 아이콘이 없다.** 208종은 E.G.O 이미지를 사용한다.

## 재수집·검증

```
npm run fetch              # entities/ · meta/ 1,749개
npm run fetch -- --assets  # 이미지 4,721개까지
```

`manifest.json`의 커밋 해시로 동일 스냅샷을 재현하고 파일마다 체크섬을 대조한다.
받지 못했거나 어긋난 파일이 하나라도 있으면 종료 코드 1이다.
`coverage.json`에 엔티티·애셋·다국어 커버리지, 무결성, 깊이 분포가 기계 판독 가능한 형태로 들어 있다.

**대조 기준은 `sha256`이 아니라 `sha256Lf`다.** 최초 수집이 `core.autocrlf=true`인
Windows에서 이루어져 로컬 파일의 줄 끝이 CRLF로 바뀌었고, `sha256`은 그 변환된 바이트를
담고 있다. 즉 상류의 내용이 아니라 **수집한 기계의 산물**이라 다른 환경에서 재현되지 않는다
(1,749개 중 1,742개가 해당). `sha256Lf`는 줄 끝을 LF로 되돌린 내용의 체크섬이라
상류 저장소의 규약과 무관하게 일치한다. 수집기도 LF로 정규화해 저장한다.

`v1-local` 출처의 16개(`assets/icons` · `assets/misc`)는 원격이 아니라 이전 프로젝트에서
온 것이라 내려받을 수 없다. 수집기가 이를 제외하고 그 사실을 출력한다.
