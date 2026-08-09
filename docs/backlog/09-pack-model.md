# 테마 팩 모델에 보강 필드가 없다

> 상태: **신규 DB 해소** · ~~현행 미착수~~ **현행 소멸** (2026-08-09 · PR #28)
> 데이터 마스터북 팩 편(회차 1–4)에서 확인했다.

## 0. 신규 3스키마 DB 에서 해소됐다 (2026-08-01)

보강 필드 6종 중 **5종이 담겼다.**

```
pack_tag            184연결 · 유일 47종
pack.unlock_code    115건 (2건 결손 → field_gap)
pack.bokgak         true 6건
pack.text_color     56건 (61건 결손 → field_gap)
pack.overlay_sprite 41건
pack_category_path  202원소 — assets 2단 계층까지 담았다
```

**`mapGen` 만 안 담았다.** 전투 풀 2,525종이 어느 출처에도 정의되지 않아
(`backlog/10`) 담아도 가리키는 곳이 없다.

4절의 **ADR-04 정정도 반영됐다** — ADR-04 2.1 표가 「거울 던전 은총」과
「거울 던전 구조」로 갈라졌다.

현행 `public` 스키마는 그대로다. 아래는 그 판정 기록이다.

## 0.1 정정 — 「모델이 없다」는 틀렸다

처음 이 항목을 「`Pack` 테이블이 없다」로 적었다. **실측하니 있다.**

```prisma
model Pack     { id String @id; category; chapter; variant; sprite;      // schema:615
                 superposition; extreme; floorLength }
model PackText { packId String; locale Locale; name }                    // schema:640
model GiftPack { giftId Int; packId String; pack Pack @relation(...) }   // FK 있다
```

`src/entities/packs.ts` 의 `buildPacks()` 가 `pack` · `pack_text` ·
`pack_boss_encounter` · `floor_pack` 넷을 만들고 `src/load.ts` 가 전부 적재한다.
`packId` 는 `Int` 가 아니라 `String` 이고 외래 키도 걸려 있어 **참조 무결성 검사도 된다.**

**남은 문제는 보강 필드다.** 아래 §1 이 그 목록이다.

## 1. 증상 — 원본에 있는데 안 담는 것 6종

| 개념 | 출처 | 실측 | 스키마 |
| --- | --- | ---: | --- |
| 태그 | assets `tags` 47종 | 117 | **없음** |
| 겹침 이미지 | assets `overlayImage` | 41 | **없음** |
| 해금 조건 | `packs_detail.unlock.unlockCode` 26종 | 115 | **없음** |
| 복각 여부 | `packs.bokgak` | 117 | **없음** |
| 텍스트 색 | `packs.textColor` | 56 (61건 결손) | **없음** |
| 맵 생성 규칙 | `packs_detail.mapGen`·`mapGenSequence` | 117 | **없음** |

앞의 넷은 바로 담을 수 있다. `textColor` 는 결손 61건을 안고 담아야 하고,
`mapGen` 은 전투 풀 2,525종이 정의되지 않아(`backlog/10`) 담아도 조인이 안 된다.

## 2. 이미 담고 있는 것

| 개념 | 출처 | 실측 | 컬럼 |
| --- | --- | ---: | --- |
| 이름(ko/en) | `packs.nameKo`·`name` · `loc-*` | 117 · 셋 다 일치 | `pack_text.name` |
| 분류 | `packs.category` 8종 | 117 | `pack.category` |
| 본편 장·난이도 | `packs.chapter`(1–9) · `variant`(normal/mid/hard) | 27 | `pack.chapter`·`variant` |
| 층 수 | `floorLength`(2–5) | 117 | `pack.floorLength` |
| 층 배정 | assets `md_floor_packs` | 218 | `floor_pack` |
| 중첩·극한 | `superposition`·`extreme` | 117 | `pack.superposition`·`extreme` |
| 기본 이미지 | `sprite` == assets `image` | 113 | `pack.sprite` |
| 보스 인카운터 | assets `bossEncounters` | 75 | `pack_boss_encounter` |

## 3. 제안 — 보강 필드만 얹는다

```prisma
model Pack {
  // 기존 유지
  bokgak        Boolean @default(false)   // 복각 여부
  overlaySprite String?                   // assets overlayImage 41건
  unlockCode    String?                   // packs_detail.unlock 26종 · 115건
  textColor     String?                   // 61건 결손 → null
  tags          PackTag[]                 // assets tags 47종
}

model PackTag { packId String; tag String; @@id([packId, tag]) }
```

`mapGen` 은 뺐다. 전투 풀 2,525종이 어느 출처에도 정의되지 않아
(`backlog/10`) 담아도 가리키는 곳이 없다.

## 4. 정본 배정을 다시 봐야 한다

`docs/adr/04-source-authority.md` 는 「거울 던전 구성 = `limbus-assets`」로 적었다.
팩 편 실측은 **반대**다.

```
단독 보유 개념   mj 6 · assets 2 · loc 1
```

| mj 단독 | assets 단독 |
| --- | --- |
| 기프트 목록(`gifts` 18–188개) | `tags` 47종 |
| 맵 생성 규칙(`mapGen`·`mapGenSequence`) | `overlayImage` 41건 |
| 해금 코드 · 층 배정 · 장/난이도 · 텍스트 색 | |

**`limbus-assets` 에는 기프트 목록도 맵 생성 규칙도 없다.** ADR 문장을
"거울 던전 **은총**은 assets, **구조**는 mj" 로 나눠 적어야 정확하다.

## 5. 미룬 이유

데이터 의미가 아니라 스키마 결정이다. 마스터북 진행 중에 컬럼을 추가하면
회차가 끊긴다. 거울 던전 편(다음)에서 은총·층 구조를 본 뒤 함께 설계한다.

### 왜 전제를 틀렸나

팩 편 회차 1에서 `GiftPack.packId` 만 보고 「팩 테이블이 없다」로 건너뛰었다.
`prisma/schema.prisma` 의 `model Pack`(615줄)과 `src/entities/packs.ts` 를
확인하지 않았다. **회차 문서가 「적재」 칸을 채울 때 스키마를 직접 열어야 한다**는
교훈이 여기서 나왔다.
