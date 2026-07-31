# 테마 팩이 모델 없이 정수 id 로만 남아 있다

> 상태: 미착수 / 확인 2026-07-31
> 데이터 마스터북 팩 편(회차 1–4)에서 확인했다.

## 1. 증상

거울 던전 테마 팩 **117종**이 DB 에 이름조차 없다.

```prisma
model GiftPack          { giftId Int; packId Int }      // packId 만 있다
model GiftExclusivePack { giftId Int; packId Int }
```

`Pack` 테이블이 없어 **`packId` 가 무엇을 가리키는지 DB 안에서 알 수 없다.**

게임 화면은 기프트 상세에 「하드 난이도, '검과 작품' 한정」처럼 **테마 이름을 쓴다**
(기프트 편 회차 1에서 게임 대조). 우리는 `1026` 이라는 숫자만 갖고 있다.

## 2. 원본에 있는 것

| 개념 | 출처 | 실측 |
| --- | --- | --- |
| 이름(ko/en) | `packs.nameKo`·`name` · `loc-*` | 117 · 셋 다 일치 |
| 분류 | `packs.category` 8종 · assets `category` 2단 배열 | 117 |
| 본편 장·난이도 | `packs.chapter`(1–9) · `variant`(normal/mid/hard) | 27 |
| 층 수·층 배정 | `floorLength`(2–5) · `normalFloors` · `hardFloors` | 117 |
| 태그 | assets `tags` 47종 | 117 |
| 이미지 | `sprite` == assets `image` | 113 + overlay 40 |
| 해금 조건 | `packs_detail.unlock.unlockCode` 26종 | 115 |

**전부 다 있다.** 적재하지 않았을 뿐이다.

## 3. 제안

```prisma
model Pack {
  id           Int     @id
  category     String          // canto · sin · keyword · attack_type · event · railway · walpurgis · extreme
  chapter      Int?            // canto 27건만
  variant      String?         // normal · mid · hard
  floorLength  Int
  superposition Boolean
  extreme      Boolean
  bokgak       Boolean
  sprite       String
  overlaySprite String?
  texts        PackText[]
  tags         PackTag[]
  gifts        GiftPack[]
  exclusives   GiftExclusivePack[]
}

model PackText { packId Int; locale Locale; name String }
model PackTag  { packId Int; tag String }
```

`GiftPack.packId` · `GiftExclusivePack.packId` 에 외래 키를 건다.
지금은 **참조 무결성 검사가 불가능**하다.

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

데이터 의미가 아니라 스키마 결정이다. 마스터북 진행 중에 모델을 추가하면
회차가 끊긴다. 거울 던전 편(다음)에서 은총·층 구조를 본 뒤 함께 설계한다.
