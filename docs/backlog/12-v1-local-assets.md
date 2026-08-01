# 매니페스트가 아는데 디스크에 없는 애셋 16건

> 상태: **확인만 완료** · 조치 미정 / 확인 2026-08-01
> 재현 시험(ADR-06 5.5) 중 드러났다.

## 1. 증상

`data/manifest.json` 이 6,486파일을 아는데 디스크에는 6,470개뿐이다.

```
매니페스트   assets 4,737
디스크       assets 4,721
차이               16
```

전부 출처가 `v1-local` 이다.

```
assets/icons/v1-local/Combo.png
assets/icons/v1-local/SupportAtk.png
assets/icons/v1-local/SupportDef.png
assets/misc/v1-local/blunt_outlined.png
assets/misc/v1-local/coin_excision.webp
assets/misc/v1-local/coin_unbreakable.png
…  16건
```

## 2. 왜 복원이 안 되나

`v1-local` 은 **원격 저장소가 아니다.**

```json
{
  "id": "v1-local",
  "repo": "local ../limbus-mirror-tracker-v1",
  "commit": "a31aff0c2686f4ca0c721372c6b802b3bda00e03",
  "status": "superseded"
}
```

프로젝트 이전 버전의 로컬 저장소이며 **지금 그 경로에 없다.** `npm run fetch` 는
원격만 받으므로 이 16건을 복원하지 못한다.

수집기가 「1,749개 전부 체크섬 일치」라 보고하는 이유도 여기 있다 — `v1-local` 을
받을 대상으로 세지 않는다.

## 3. 재현 시험이 원인이 아니다

시험 전 실측이 이미 4,721이었다. 시험은 `data/entities/` 만 지웠고 `data/assets/`
는 건드리지 않았다.

```
시험 전   data/assets 4,721
시험 후   data/assets 4,721
```

**언제부터 없었는지는 모른다.** 매니페스트가 만들어진 시점(2026-07-25)에는 있었다.

## 4. 영향

```
신규 3스키마 DB   없음.  v2 파이프라인이 data/assets/ 를 한 번도 읽지 않는다
현행 public       확인 필요.  lib/assets.ts 가 애셋 경로를 만든다
화면              확인 필요.  아이콘 6종이 깨질 수 있다
```

마스터북 애셋 결산은 「3,360개 중 결손 2건」이었다. 그 셈에 `v1-local` 이 안 들어가
있어 이 16건은 별도 사안이다.

## 5. 선택지

| | 방법 | 대가 |
| --- | --- | --- |
| A | 이전 저장소를 찾아 16건을 복원한다 | 저장소 위치를 모른다 |
| B | 매니페스트에서 `v1-local` 을 뺀다 | 「있었다」는 기록이 사라진다 |
| C | 매니페스트에 `status: missing` 을 달아 남긴다 | 수집기가 계속 무시한다 |
| D | 게임에서 다시 추출한다 | 16건이 무엇의 아이콘인지 확인이 필요하다 |

**C 를 권한다.** 결손을 지우지 않고 기록하는 것이 이 저장소의 규약이다
(`canonical.field_gap` 과 같은 원칙). 화면이 실제로 깨지는지부터 확인한 뒤
A·D 를 판단한다.

## 6. 먼저 확인할 것

```
lib/assets.ts 가 v1-local 경로를 만드나
그 아이콘 6종이 화면 어디에 쓰이나
지금 깨져 보이나
```
