# 데이터 마스터북 (Data Masterbook)

> 상태: 진행 중 / 착수 2026-07-29 · 스냅샷 2026-07-25
> 설계는 `docs/superpowers/specs/2026-07-29-data-masterbook-design.md` 에 있다.

`data/` 에 수집한 원본 JSON의 **모든 프로퍼티**가 각각 무슨 뜻이고, 변환을 거쳐 어디에 적재되고,
화면에 어떤 레이블로 나타나는지를 필드 단위로 기록한다.

## 1. 다른 문서와의 경계

| 문서 | 다루는 것 |
| --- | --- |
| `docs/01-data-source.md` | 어떤 출처를 왜 골랐나 |
| `docs/02-data-model.md` | 우리가 만든 엔티티가 어떤 모양인가 |
| `docs/03-data-provenance.md` | 원본이 어떤 경로로 생성되었나 |
| `docs/04-data-inventory.md` | 빠짐없이 수집했다는 근거 |
| **여기** | **원본 필드 하나하나가 무슨 뜻이고 어디로 가는가** |

중복 서술 대신 링크한다.

## 2. 읽는 법

필드마다 표 하나가 붙는다. 칸의 뜻은 다음과 같다.

| 칸 | 내용 |
| --- | --- |
| 타입·실측 | 타입 + **실제로 세어본** 분포·범위·결손 건수. 추정치를 적지 않는다 |
| 의미 | 게임에서 무엇을 뜻하는지. 필요하면 위키 링크 |
| 변환 | `src/entities/*.ts` 의 어느 함수가 어떻게 다루는지. 통과·개명·계산·병합·폐기 |
| 적재 | `테이블.컬럼`, 또는 **미적재 + 사유** |
| 화면 | 화면 파일과 레이블 문자열, 또는 **미표시** |
| 함정 | 이름이 거짓말하거나 직관과 다른 점. 없으면 "없음" |

### 층을 섞지 않는다

같은 개념이 층마다 다른 값을 갖는다. 어느 층의 이야기인지 밝히지 않으면 잘못된 결론이 나온다.

```
척추   원본 JSON 필드          ← 이 문서의 기준
변환   src/entities/*.ts
적재   PostgreSQL 테이블
화면   app/[locale]/**/page.tsx
```

## 3. 방법

- **실측**: 회차마다 일회용 프로브를 돌려 집계한다. 프로브는 커밋하지 않고 숫자만 남긴다.
- **게임 지식**: 정본 위키는 [Limbus Company Wiki](https://limbuscompany.fandom.com) 다.
  한국어 표시 문자열은 위키 번역이 아니라 `loc-ko` 원문을 따른다.
- **미해결**: 위키로 풀리면 그 자리에서 각주를 단다. 어디에도 없으면 `❓ 미확인` 으로 남기고
  `docs/backlog/` 에 항목을 만든다.

## 4. 진행 현황

### 인격 (Identity) — 14회차

| # | 대상 | 상태 |
| --- | --- | --- |
| 1 | [`limbus-data-mj/identities.json`](identity/01-mj-identities.md) | **완료** 2026-07-29 · 키 23종 |
| 2 | `limbus-data-mj/identities_detail.json` | 미착수 |
| 3 | `limbus-data-mj/skills.json` | 미착수 |
| 4 | `limbus-data-mj/passives.json` | 미착수 |
| 5 | `limbus-data-mj/associations.json` | 미착수 |
| 6 | `limbus-assets/identities.json` | 미착수 |
| 7 | `limbus-assets/identities_mini.json` + `shared-library` 동형 2종 | 미착수 |
| 8 | `limbus-assets/passives.json` + `skill_tags.json` | 미착수 |
| 9 | assets 부속 4종 | 미착수 |
| 10 | `identity-details/limbus-assets/{id}.json` 184개 | 미착수 |
| 11 | `loc-*/Personalities*.json` + `Personality_Get_Condition.json` | 미착수 |
| 12 | `loc-*/Skills_personality-NN.json` + `Skills.json` | 미착수 |
| 13 | `loc-*/Passives*.json` + `UnitKeyword*.json` + `AssociationName.json` | 미착수 |
| 14 | `data/assets/` 인격 이미지 712개 | 미착수 |

### 그 밖의 엔티티

E.G.O · 기프트 · 테마 팩 · 거울 던전 · 상태 — **인격 편을 마친 뒤 착수한다.**

## 5. 회차에서 갈라져 나온 문서

인터뷰 중 발견이 커져 별도 문서가 된 것들이다.

| 문서 | 내용 | 나온 회차 |
| --- | --- | --- |
| [`../08-gimmick-keywords.md`](../08-gimmick-keywords.md) | 기믹 축이 인격·E.G.O·기프트 조합으로 정해지는 구조 | 1 |
| [`../09-resistance.md`](../09-resistance.md) | 저항의 두 축과 E.G.O 종속 관계 | 1 |
| [`../backlog/01-identity-tags.md`](../backlog/01-identity-tags.md) | 인격 태그의 이름이 틀렸다(→ `trait`) | 1 |
| [`../backlog/05-season-label.md`](../backlog/05-season-label.md) | 시즌 값이 원본 정수 그대로 화면에 나간다 | 1 |
| [`../backlog/06-atktypes-naming.md`](../backlog/06-atktypes-naming.md) | `atkTypes` 가 세 곳에서 다른 단위를 가리킨다 | 1 |
