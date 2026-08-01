# 변환 리포트가 산출물로 남지 않는다

> 상태: **신규 DB 해소** · 현행 미착수
> 데이터 마스터북 회차 3(`limbus-data-mj/skills.json`) 인터뷰에서 확인했다.

## 0. 신규 3스키마 DB 에서 해소됐다 (2026-08-01)

콘솔이 아니라 **DB 테이블과 문서** 둘로 나온다.

```
canonical.field_gap      결손 1,548건 — 계열·필드·로케일·사유·근거
canonical.field_source   판정 근거 11,000여 건 — 이 값이 어디서 어떤 규칙으로 왔나
build/gap-report.md      위를 작업 지시서로 (npm run v2:gap-report)
```

리포트가 **질의 가능한 데이터**가 됐다. 「이 값 왜 이렇지?」를 SQL 로 답한다.

현행 `public` 파이프라인의 `Report` 클래스는 그대로다. 아래는 그 설계 기록이다.

## 1. 무엇이 문제인가

ADR-02 원칙 1은 이렇게 정했다.

> 매핑되지 않은 입력은 버리지 않고 리포트한다. 변환이 조용히 성공하는 것보다
> 시끄럽게 실패하는 편이 낫다.

`Report` 는 두 갈래를 나눠 들고 있다.

| 갈래 | 뜻 | 빌드 판정 |
| --- | --- | --- |
| `unmapped` | 변환기가 처리하지 못한 입력. 표를 갱신해야 하는 종류 | `hasUnmapped` → `exitCode = 1` |
| `note` | 확인은 필요하나 정상일 수 있는 것. 원본 결손·원문 유지 의도 | 판정에 영향 없음 |

그런데 **둘 다 콘솔로만 나간다.**

```
src/convert.ts:126   console.log(report.format())
src/convert.ts:130   if (report.hasUnmapped) process.exitCode = 1
```

`build/data/` 에는 테이블 JSON만 떨어진다. 리포트는 CI 로그에 흘러가고 사라진다.

**결과** — `note` 로 잡힌 원본 결손·오타는 사람이 그 순간 로그를 읽지 않으면 없던 일이 된다.
개수가 늘었는지 줄었는지도 알 수 없다.

## 2. 실측 사례 — 이것 때문에 발견됐다

회차 3에서 스킬 설명 토큰 치환을 전수 검증했다.

```
치환표 크기          상태 4,426 + 발동 시점 = 4,497 (ko)
스킬 설명 토큰        265종 / 8,897회 치환 성공
미치환               1종 / 1회        커버리지 99.99%
Unity 마크업 잔존     0건
```

미치환 1건은 **원본 한국어 번역의 오타**다.

```
1121102 lv4  (그레고르 · 불주먹 사무소 계열)

descKo  "…\n[[FirePunchFuel]를 소모할 때…"      ← 여는 대괄호가 하나 더
desc    "…Coins that consumed [FirePunchFuel] deal…"   ← 영문은 정상

치환표   FirePunchFuel → "12구산 연료"           ← 표에는 정상적으로 있다
```

정규식이 `[[FirePunchFuel]` 를 토큰 `[FirePunchFuel` 로 읽어 표에서 못 찾는다.
화면에는 이렇게 나간다.

```
"…[12구산 연료를 소모할 때 해당 코인의 피해량 +15%…"
   ↑ 여는 대괄호가 남고 닫는 짝이 없다
```

`report.note('표에 없는 대괄호 표기(원문 유지)')` 가 기록되므로 **조용히 실패하지는 않는다.**
다만 그 기록이 남지 않는다.

## 3. 왜 `unmapped` 로 승격하지 않는가

`note` → `unmapped` 로 올리면 빌드가 즉시 실패한다. 그런데 **이 오타는 우리가 고칠 수 없다.**
원본 로컬라이즈 파일의 문제이고, 정본 값을 우리가 덮지 않는다는 원칙(02-data-model 원칙 6)이 있다.

승격하면 상류가 고칠 때까지 파이프라인이 막히고, 결국 예외 목록을 만들게 된다.
예외 목록은 시간이 지나면 아무도 관리하지 않는다.

**원본 오타는 "실패"가 아니라 "관측 대상"이다.** 막을 것이 아니라 세어야 한다.

## 4. 설계 — 리포트를 산출물로 뽑는다

### 4.1 `Report` 에 직렬화를 붙인다

```ts
// src/report.ts
interface ReportJson {
  generatedAt: string;          // 실행 시각
  snapshotDate: string;         // dataset.snapshot_date 와 같은 값
  counts: Record<string, number>;              // 테이블별 행 수
  failures: Record<string, BucketJson[]>;      // unmapped — 빌드를 세운다
  notes: Record<string, BucketJson[]>;         // note — 관측 대상
}

interface BucketJson {
  key: string;        // 걸린 입력 (토큰 이름 · id 등)
  count: number;      // 몇 번 걸렸나
  samples: string[];  // 대표 사례 (최대 8, 지금 MAX_SAMPLES 그대로)
}

toJSON(): ReportJson
```

`failures`·`notes`·`counts` 는 이미 `Map<string, Map<string, Bucket>>` 로 들고 있다.
**새로 세는 것이 없고 직렬화만 붙인다.**

### 4.2 산출 위치

```
build/report.json
```

`build/data/` 와 같은 곳에 둔다. 커밋하지 않는다(ADR-02 5절 원칙 2 — 산출물은 전체 재생성).
`.gitignore` 가 `build/` 를 이미 제외하는지 확인한다.

### 4.3 쓰는 시점

```ts
// src/convert.ts:126 근처
console.log(report.format());                                  // 기존 유지
writeFileSync('build/report.json', JSON.stringify(report.toJSON(), null, 2));
if (report.hasUnmapped) process.exitCode = 1;                   // 기존 유지
```

**판정 로직을 바꾸지 않는다.** `note` 는 여전히 빌드를 세우지 않는다.

### 4.4 무엇에 쓰나

| 용도 | 방법 |
| --- | --- |
| 스냅샷 간 변화 추적 | 이전 `report.json` 과 diff. `notes` 항목이 늘면 원본에 새 결손이 생긴 것 |
| CI 아티팩트 | 워크플로에서 업로드해 실패한 실행의 리포트를 나중에 볼 수 있게 한다 |
| 마스터북 근거 | 회차 문서에 "미치환 1건" 같은 수치를 손으로 적지 않고 산출물을 인용한다 |
| `verify` 연동 | 적재 후 검증이 `report.json` 의 `counts` 와 DB 실제 행 수를 대조할 수 있다 |

### 4.5 하지 않는 것

- **원본 보정을 넣지 않는다.** `[[X]` 를 `[X]` 로 고치는 특례는 1건짜리 하드코딩이며,
  원본이 고쳐지면 죽은 코드가 된다
- **`note` 를 실패로 올리지 않는다.** 3절 참조
- **리포트를 커밋하지 않는다.** 스냅샷마다 달라지는 산출물이다

## 5. 미룬 이유

인격 편 마스터북(회차 1–14) 진행 중이다. 회차마다 원본 결손을 계속 발견하고 있으므로
**구현은 인격 편을 마친 뒤 다른 코드 작업과 함께 한다.**

그때까지 발견한 결손은 각 회차 문서의 「함정」·「미해결」 절에 손으로 적는다.

## 6. 지금까지 쌓인 관측 대상

구현되면 산출물에서 확인할 것들이다. 회차가 진행되며 늘어난다.

| 사례 | 성격 | 회차 |
| --- | --- | --- |
| `1121102` lv4 `[[FirePunchFuel]` | 한국어 원문 대괄호 오타. 영문은 정상 | 3 |
| `20306` 전기울음 날짜 `2023-04-11` | **원본 오타.** mj·구버전 assets 가 `2023`, 현행 assets 만 `2024-04-11` | 1 |
| `10116` 차원찢개 `updatedDate` | 픽업 종료일이 출시일 자리에 들어옴 | 1 |
| `1041206` `skillTier` | mj `3` vs assets `4`. 슬롯 규칙상 mj 가 맞다 | 3 |
| 스킬 12개 누락 | `limbus-assets/identities.json` 이 공격 6 · 방어 6 을 빠뜨림 | 2 |
| 스킬 9건 수치 없음 | 분류만 있고 `levels` 가 빈 배열 | 3 |
| `name === nameKo` 13건 | 결손이 아니라 영문 고유명사(`Furioso-Replica` · `AEDD`) | 3 |
