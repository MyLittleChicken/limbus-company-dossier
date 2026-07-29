# 인격 계열 지도 (Identity Overview)

> 상태: 초안 / 최종 수정 2026-07-29 · 스냅샷 2026-07-25
> 회차가 진행되며 계속 고쳐진다. 처음부터 완성하지 않는다.

## 1. 인격 id 체계

```
1 | 수감자(2자리) | 순번(2자리)

10101 = 수감자 01(이상)의 1번째 인격
11216 = 수감자 12(그레고르)의 16번째 인격
```

**184건 전부 이 규칙을 지킨다**(위반 0). 순번 범위는 1–16이며, 원본의 `slotId` 와 뒤 2자리가
184/184 일치한다.

E.G.O는 같은 자리에 `2` 를 쓴다 — `20509` = 수감자 05(뫼르소)의 9번째 E.G.O.

## 2. 수감자별 인격 수

```
1 이상 16 · 2 파우스트 16 · 3 료슈 14 · 4 돈키호테 15 · 5 뫼르소 15 · 6 홍루 15
7 히스클리프 16 · 8 이스마엘 15 · 9 로쟈 16 · 10 싱클레어 15 · 11 오티스 15 · 12 그레고르 16
```

료슈만 14로 가장 적다.

## 3. 원본 파일 16종

| 파일 | 회차 | 성격 |
| --- | --- | --- |
| `limbus-data-mj/identities.json` | 1 | **정본** · 인격 본체 184건 |
| `limbus-data-mj/identities_detail.json` | 2 | **정본** · 스탯·정신 조건 |
| `limbus-data-mj/skills.json` | 3 | **정본** · 스킬 |
| `limbus-data-mj/passives.json` | 4 | **정본** · 패시브 |
| `limbus-data-mj/associations.json` | 5 | **정본** · 조직 64종 |
| `limbus-assets/identities.json` | 6 | 관계의 정본 · 태그·상태 |
| `limbus-assets/identities_mini.json` | 7 | 요약판 |
| `shared-library/identities.json` · `identities_mini.json` | 7 | 구버전 대조 |
| `limbus-assets/passives.json` · `skill_tags.json` | 8 | 태그 사전 |
| `limbus-assets/alt_names.json` | 9 | 별칭 |
| `limbus-assets/identity_tag_list.json` | 9 | 태그 목록 95항목(마크업 제거 후 93종) |
| `limbus-assets/identity_header_offsets.json` | 9 | 이미지 표시 오프셋 |
| `limbus-assets/identity_keyword_modifiers.json` | 9 | **조건부 기믹 3건** |
| `identity-details/limbus-assets/{id}.json` | 10 | 인격별 상세 184개 |
| `loc-ko` · `loc-en` · `loc-ja` | 11–13 | 표시 문자열 |

## 4. DB 모델 10종

```
Sinner ─┬─ SinnerText
        └─ Identity ─┬─ IdentityText
                     ├─ IdentityResist    (atkType × 3)
                     ├─ IdentitySpeed     (uptie × 4)
                     ├─ IdentityAffiliation ─ Affiliation ─ AffiliationText
                     ├─ IdentityStatus ─ Status
                     ├─ Skill ─ SkillStage ─ SkillCoin
                     └─ IdentityPassive ─ Passive
```

## 5. 개념이 여러 파일에 흩어진 자리

| 개념 | 있는 곳 | 정본 |
| --- | --- | --- |
| 체력·저항·스태거 | mj `identities.json`(요약) · mj `identities_detail.json` · assets `identities.json` | **detail** — 요약본은 증가량·단계 정보가 없다 |
| 속도 | mj `identities.json`(만렙 요약 1쌍) · detail(단계별 4쌍) | **detail** |
| 소속·태그 | mj `associations`(조직 64) · assets `tags`(특성 키워드 93) | **assets** — 게임의 「특성 키워드」와 1:1 |
| 기믹 키워드 | mj `keywords` · assets `skillKeywordList` · assets `statuses` | **층이 다르다** — `../../08-gimmick-keywords.md` 4절 |
| 조건부 기믹 | mj `egoKeywords` · assets `identity_keyword_modifiers` | **합집합** — 어느 쪽도 단독으로 완전하지 않다 |

## 6. 화면

| 화면 | 파일 |
| --- | --- |
| 목록 | `app/[locale]/identities/page.tsx` |
| 상세 | `app/[locale]/identities/[id]/page.tsx` |
| 스킬 패널 | `components/uptie-skills.tsx` |
| 질의 | `lib/queries/identities.ts` |
