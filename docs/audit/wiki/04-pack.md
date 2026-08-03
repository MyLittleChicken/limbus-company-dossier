# 위키 조사 — 테마 팩(pack) 미확정 6건 판정

대상 문서: `docs/audit/04-pack.md` §8. 조사일 2026-08-03.
주 출처: `limbuscompany.wiki.gg`(신뢰도 최상 — 팩별 개별 문서와 층/난이도 표기가 우리 `floor_pack`
실측과 전 건 일치). 보조로 리포의 원본 애셋(`data/assets/packs/limbus-assets/**`) 직접 관찰.

**조사 중 얻은 구조적 발견을 먼저 적는다.** 1·2번 판정의 근거가 전부 여기서 나온다.

```
sprite  계열 파일 (AttackType_normal, Crimson_normal, Crimson_hard …)  →  380 x 690
overlay 계열 파일 (AttackTypeSlash_hard_boss, Crimson_normal_boss …)   →  391 x 432
```

`sprite` 는 **테마 팩 카드의 배경(빈 포장지)** 이고, `overlay_sprite` 는 **투명 배경의 적 일러스트
레이어**다. 실제로 눈으로 확인했다 — `AttackType_normal.webp` 는 갈색 비닐 포장지에 팔각형 틀만
있고 그림이 없다. `AttackTypeSlash_hard_boss.webp` 는 배경 없이 적 3체만 그려져 있다.
`Crimson_normal.webp`(붉은 비닐) · `Crimson_hard.webp`(붉은 WARNING 사슬)도 같은 구조다.
위키가 팩당 게시하는 카드 이미지는 380×700 한 장뿐이며, 이는 배경+오버레이가 **합성된 완성 카드**다.

> "380 × 700 pixels, file size: 380 KB" — <https://limbuscompany.wiki.gg/wiki/File:Slicers_%26_Dicers_MD5_Theme_Pack.png>

즉 **`overlay_sprite` 는 「보스 층 카드」가 아니라 「같은 카드의 위 레이어」다.**
현행 `lib/assets.ts:113` `packBossIcon` 이 이것을 별도의 「보스 층」 그림으로 취급해
figure 를 하나 더 그리는 것 자체가 잘못된 해석이다.

---

### 1. 팩 1201–1206 의 보스 층 카드가 실제로 무엇인가

**판정** 확정 (전제 자체가 틀렸다)

**답** 보스 층 전용 카드는 없다 — `AttackTypeSlash/Pierce/Blunt_hard_boss` 는 세 팩이 공유하는
빈 배경 `AttackType_normal` 위에 얹히는 **적 일러스트 오버레이**이고, 게임에서 세 팩의 카드는
합성 결과로 서로 다르게 보인다.

**근거**

우리 데이터의 팩 이름과 위키 문서가 1:1로 붙는다.

| id | ko | 위키 문서 |
| --- | --- | --- |
| 1201 | 가르고 베는 이들 | Slicers & Dicers Theme Pack |
| 1202 | 베어낼 것 | To be Cleaved Theme Pack |
| 1203 | 꿰고 뚫는 이들 | Piercers & Penetrators Theme Pack |
| 1204 | 꿰뚫을 것 | To be Pierced Theme Pack |
| 1205 | 부수고 깨뜨릴 이들 | Crushers & Breakers Theme Pack |
| 1206 | 바스라질 것 | To be Crushed Theme Pack |

층 배정이 위키와 완전히 일치한다.

> "It appears on Floor 5 in Normal mode, and Floor 4 in Hard mode of Mirror Dungeons."
> — <https://limbuscompany.wiki.gg/wiki/Slicers_%26_Dicers_Theme_Pack>
> 같은 문장이 <https://limbuscompany.wiki.gg/wiki/Piercers_%26_Penetrators_Theme_Pack> ·
> <https://limbuscompany.wiki.gg/wiki/Crushers_%26_Breakers_Theme_Pack> 에도 있다.

우리 `floor_pack` 실측: 1201·1203·1205 = `normal:5`, `hard:4`. **3팩 모두 동일. 일치.**

오버레이 그림의 내용이 각 팩의 **보스 목록과 정확히 일치**한다 — 이것이 오버레이가 "보스 미리보기
레이어"임을 증명한다.

| 팩 | 위키의 possible bosses | `overlay_sprite` 그림에서 관찰한 것 |
| --- | --- | --- |
| 1201 Slicers & Dicers | "Wayward Passenger / Distorted Bamboo-hatted Kim / The Barber" | 검은 후드+푸른 안광 1체, 붉은 도포에 해골 가면 1체, 붉은 다지류 1체 — 3체 |
| 1203 Piercers & Penetrators | "King Trash Crab / Drenched Gossypium" | 녹색 갑각 게 1체, 흰·붉은 꽃뭉치 1체 — 2체 |
| 1205 Crushers & Breakers | "Brazen Bull - Tearful / Blubbering Toad" | (동일 규격 오버레이) |

**우리 데이터**
- `sprite`: 1201·1203·1205 = `AttackType_normal`(동일) · 1202·1204·1206 = `AttackType_effective`(동일)
- `overlay_sprite`: 6종 전부 다름(`AttackTypeSlash/Pierce/Blunt` × `hard/effective` `_boss`)
- 애셋에 `AttackType_hard.webp` 도 있으나 **어느 팩도 `sprite` 로 쓰지 않는다**
- `pack_boss_encounter`: 1201·1203·1205 **0행** (§3.6 의 42팩에 포함)

**조치**
1. `sprite` 중복은 **원본이 맞다.** 배경이 공용이므로 고칠 것이 없다.
2. 상세 화면을 **「보스 층」 별도 figure → 한 장의 합성 카드**로 바꾼다.
   `packBossIcon` 의 `` `${sprite}_boss` `` 규칙을 폐기하고, `overlay_sprite` 를 `sprite` 위에
   겹쳐 그린다(배경 380×690, 오버레이 391×432 — 크기가 다르므로 원본 앵커 기준을 별도로
   확인해야 한다. 게임 스크린샷 1장으로 정렬 확인 필요).
3. 목록 화면에서 1201·1203·1205 가 같은 그림으로 보이던 문제(§7.1 곁들여 관측)는
   합성으로 자동 해소된다.
4. **부수 소득**: 위키가 1201·1203·1205 의 보스 명단을 준다. 우리 `pack_boss_encounter` 는
   이 3팩에 0행이므로 §3.6 의 「보스 없는 42팩」 중 일부를 위키로 메울 수 있다.

---

### 2. 팩 1302 의 보스 층 카드

**판정** 확정

**답** 1301(억눌린 분노 = Repressed Wrath)과 1302(해방된 분노 = Unbound Wrath)는 **보스 명단이
완전히 같은 노말/하드 변형**이므로 오버레이 파일 `Crimson_normal_boss` 를 공유하는 것이 정상이고,
배경만 `Crimson_normal`(붉은 비닐) ↔ `Crimson_hard`(붉은 WARNING 사슬)로 다르다.

**근거**

> Repressed Wrath — "Floors 4 and 5 in Normal mode, and Floors 3 and 4 in Hard mode"
> possible bosses: **Skin Prophet / Brazen Bull - Tearful / Ardor Blossom Moth**
> — <https://limbuscompany.wiki.gg/wiki/Repressed_Wrath_Theme_Pack>

> Unbound Wrath — "Floors 5 through 10 in Hard mode of Mirror Dungeons."
> possible bosses: **Skin Prophet / Brazen Bull - Tearful / Ardor Blossom Moth**
> — <https://limbuscompany.wiki.gg/wiki/Unbound_Wrath_Theme_Pack>

**보스 3체가 같은 이름·같은 순서다.** 그리고 `Crimson_normal_boss.webp` 를 직접 열어 보면
불타는 황소(Brazen Bull) · 붉은 얼굴이 달린 나무 형상(Skin Prophet) · 화염 나방(Ardor Blossom
Moth) 3체가 그려져 있다. **그림 = 보스 명단.** 같은 명단이므로 같은 파일을 쓴다.

위키는 두 팩을 별도 문서로 두고 Hard Mode 목록에 각각 실어 놓아 표면상 별개 테마처럼 보이지만,
층 배정(3·4 하드 ↔ 5–10 하드)과 보스 명단이 「같은 분노 테마의 저층판/고층판」임을 말한다.

**우리 데이터**
```
1301 억눌린 분노  sprite=Crimson_normal  overlay=Crimson_normal_boss  superposition=f
                  floor_pack: normal:4, normal:5, hard:3, hard:4          ← 위키와 일치
1302 해방된 분노  sprite=Crimson_hard    overlay=Crimson_normal_boss  superposition=t
                  floor_pack: hard:5, hard:6-10                          ← 위키와 일치
1303 감정에 짓눌리는 것 sprite=Crimson_effective overlay=Crimson_effective_boss
                  floor_pack: normal:3, hard:2
```
`Crimson_hard_boss` 라는 파일은 **애셋에 존재하지 않고, 원본도 요구하지 않는다.**
받다가 빠뜨린 것이 아니다.

**조치** 데이터 수정 없음. 화면만 1번과 같은 합성 방식으로 바꾸면 `/ko/packs/1302` 의
그림 누락이 해소된다. `overlay_sprite` 중복 1쌍은 **정상값**이므로 유일성 제약을 걸면 안 된다.

---

### 3. `extreme=true` · `category='railway'` 4종(1110·1111·1112·1118)의 등장성

**판정** 확정 — 현행 `availabilityOf` 의 `standard` 가 맞다

**답** 굴절 철도 테마 팩은 **하드 5–10층의 일반 순환에 정상적으로 등장**하고, 추가로 EXTREME
11–15층에도 나온다. 노말 모드에는 나오지 않는다.

**근거**

> Line 3 — "It appears on Floors 5 through 10 on Hard mode and Floors 11 through 15 on
> EXTREME mode in Mirror Dungeons." — <https://limbuscompany.wiki.gg/wiki/Line_3_Theme_Pack>

> Line 5 — Hard Mode "Floors 5 through 10" / Extreme Mode "11 through 15"
> — <https://limbuscompany.wiki.gg/wiki/Line_5_Theme_Pack>

대조군으로 Line 1(우리 1108, `extreme=false`):

> "5F 6F-10F" on "HARD". EXTREME 모드 언급 없음.
> — <https://limbuscompany.wiki.gg/wiki/Line_1_Theme_Pack>

EXTREME 자체의 정의:

> "Confirming extends the Mirror Dungeon run to 15 Floors, with Floors 11~15 featuring unique
> Long Battle Theme Packs, highly difficult Mounting Trials, and Mounting Adversities."
> — <https://limbuscompany.wiki.gg/wiki/Mirror_Dungeon>

> "All Refraction Railway Theme Packs are Long Battle Packs."
> — <https://limbuscompany.wiki.gg/wiki/Theme_Packs>

**우리 데이터** (`floor_pack` 실측)
```
1110 3호선 / 1111 4호선-3구간 / 1112 4호선-4구간 / 1118 5호선   →  hard:5, hard:6-10, hard:11-15
1108 1호선                                                     →  hard:5, hard:6-10        (extreme=f)
1109 2호선                                                     →  hard:4, hard:5, hard:6-10 (extreme=f)
1501–1520 (category='extreme')                                 →  hard:11-15 **만**
```
**`extreme=true` 의 의미가 데이터로 갈린다** — 「11–15층에도 나온다」이지 「11–15층 전용」이
아니다. 전용인 것은 `category='extreme'` 인 1501–1520 이고 이들만 `hard:11-15` 단독이다.
`pack_tag` 가 1110·1111·1112·1118 에 `Refraction Railway` 만 주고 `Extreme` 을 안 주는 것도
같은 이유로 **옳다.**

**조치**
- 등장성 규칙 변경 없음. `availabilityOf` 의 `standard` 유지.
- 다만 컬럼 이름 `extreme` 이 오해를 부른다. 실제 의미는 **`appearsInExtreme`**(EXTREME 층에도
  나오는가)이고, 「EXTREME 전용 팩」은 `category='extreme'` 으로 따로 표현된다.
  화면/스키마 주석에 이 구분을 적어 두는 편이 좋다.
- 등장성 판정은 `pack_tag` 조회(§5.2)로 옮겨도 안전하다 — 이 4종은 어차피 `Extreme` 태그가 없다.

---

### 4. `bokgak=true` 6종이 「복각」이 맞는가

**판정** 확정

**답** 맞다. 위키는 이 6종을 **Intervallo Rerun Events, 별칭 BokGak** 으로 명시하고 팩 문서
이름까지 `... BokGak Theme Pack` 으로 우리 데이터와 동일하게 적는다.

**근거**

> "Intervallo Rerun Events—also known as **BokGak**—are reruns of previous Intervallo Launch
> Events and function similarly to their original runs."
> — <https://limbuscompany.wiki.gg/wiki/Events>

위키가 열거하는 BokGak 이벤트는 **정확히 6종**이고 우리 `bokgak=true` 6종과 집합이 같다.

| id | 우리 en 이름 | 위키 문서 | 원본 팩(우리 id) |
| --- | --- | --- | --- |
| 1113 | Miracle in District 20 BokGak | Miracle in District 20 BokGak Theme Pack | **1103** 20번구의 기적 |
| 1116 | Yield My Flesh to Claim Their Bones BokGak | 〃 BokGak Theme Pack | 1104 육참골단 |
| 1120 | Timekilling Time BokGak | 〃 BokGak Theme Pack | 1105 시간살인시간 |
| 1123 | Murder on the WARP Express BokGak | 〃 BokGak Theme Pack | 1106 워프특급 살인사건 |
| 1125 | LCB Regular Check-up BokGak | 〃 BokGak Theme Pack | 1115 LCB 정기검진 |
| 1127 | Nocturnal Sweeping BokGak | 〃 BokGak Theme Pack | 1117 심야청소 |

> 감사 문서 §8-4 는 짝을 5쌍(1104↔1116, 1105↔1120, 1106↔1123, 1115↔1125, 1117↔1127)만
> 적었다. **1113 의 원본은 1103(20번구의 기적)이다** — 6쌍으로 고쳐야 한다.

**위키가 원본과 복각을 구분하는 방식** — 별도 문서를 파고 제목 끝에 ` BokGak` 을 붙인다.
스토리 문서는 `Miracle in District 20/BokGak` 처럼 하위 경로를, 팩 문서는
`Miracle in District 20 BokGak Theme Pack` 처럼 이름 접미사를 쓴다. 원본 문서에는
「debuted alongside the ... Event during Season N」, 복각 문서에는 「debuted alongside the
... **BokGak** Event during Season M」 으로 시즌만 다르게 적는다.

복각의 실질 차이도 적혀 있다 — 인터발로에 **하드 모드 스테이지**가 추가되고 스토리에
**음성**이 붙으며, 이미 얻은 고유 아이템(E.G.O·인격·프로필 장식)은 재구매 불가.

**우리 데이터로 이것이 뒷받침된다**
```
원본 1103·1104            floor_pack 에 normal 행이 있다 (normal:4 / normal:4,5)
복각 1113·1116·1120·1123·1125·1127   전부 hard:4, hard:5, hard:6-10 — normal 행 0
```
「복각은 하드 모드가 붙는다」는 위키 서술과 우리 층 배정이 정확히 맞물린다.
`superposition` 도 복각 6종 전부 `true` 다.

**조치** `bokgak` 컬럼의 의미 확정 — 「인터발로 복각(Intervallo Rerun / BokGak)」.
정의 변경 불필요. 감사 문서 §8-4 의 짝 목록에 **1103↔1113** 을 추가한다.
`pack_tag` 가 복각/원본 모두에 같은 인터발로 태그(`Miracle in District 20` 등)를 주므로
「원본과 복각 묶기」는 `bokgak` + 태그 조합으로 가능하다.

---

### 5. `text_color` 61건 결손 시 팩 카드 이름 색

**판정** 위키로 불가 → 제품 판단

**답** 위키는 테마 팩 카드의 **이름 색을 전혀 언급하지 않는다.** 팩 문서는 카드 이미지 1장과
층/보스/기프트 표만 싣고 타이포그래피에 대한 서술이 없다.

**근거**

> "The page does not describe what Theme Pack cards look like in the floor-selection screen.
> There is no information about card art, text color styling, or boss previews displayed on
> the cards." — <https://limbuscompany.wiki.gg/wiki/Theme_Packs> 조회 결과

개별 팩 문서도 같다 — Repressed Wrath / Unbound Wrath 문서 모두 색 서술 없음
(<https://limbuscompany.wiki.gg/wiki/Repressed_Wrath_Theme_Pack> ·
<https://limbuscompany.wiki.gg/wiki/Unbound_Wrath_Theme_Pack>).
위키가 올리는 카드 이미지는 **이름 텍스트가 찍히기 전의 배경 그림**이다(우리 `sprite` 와 같은
380×690 규격) — 즉 위키 이미지에서 이름 색을 역산할 수도 없다.

**우리 데이터** `text_color` 56/117(유일 28색), 결손 61종은 전부 1201 이후 id
(attack_type·sin·keyword·extreme 계열). 원본 결손 확정(§3.3).

**조치** 위키에서 얻을 것이 없다. 게임에서 확인하려면 — **거울 던전 층 선택 화면에서
`text_color` 가 있는 팩(예 1301)과 없는 팩(예 1201)의 카드를 나란히 놓고 이름 글자 색을
비교**해야 한다. 갈리는 지점: 결손 팩의 이름이 (a) 흰색 등 공통 기본색이면 → 원본이 기본색일 때
값을 생략한 것이므로 우리도 기본색 폴백이 정답. (b) 팩마다 다른 색이면 → 원본 결손이 아니라
우리가 못 받은 다른 출처가 있다는 뜻.
참고로 값이 있는 56종은 `shared-library/md_theme_packs.json` 커버 범위와 정확히 일치하므로
(a) 쪽 가능성이 높다 — 다만 이는 추정이고 위키 근거는 없다.

---

### 6. 팩 1122(선의의 순례)의 층 배정이 정말 없는가

**판정** 확정 — **`floor_pack` 결손이 맞다. 5행이 비어 있다.**

**답** 위키는 이 팩이 노말 4·5층, 하드 4–10층에 등장했다고 명시한다. 우리 `floor_pack` 은 0행이다.

**근거**

> "It features a variable layout and a bossfight against Mayors, the Yearning Flotsam,
> **appearing on Floor 4 and 5 in Normal mode and Floor 4 through 10 in Hard mode in Mirror
> Dungeons.** It was available from September 25th, 2025 until October 23rd."
> — <https://limbuscompany.wiki.gg/wiki/List_of_Floor_Themes/Pilgrimage_of_Compassion>

> "The 'Pilgrimage of Compassion' Theme Pack would not appear on Floor 5 if already chosen on
> Floor 4 of the Mirror Dungeon." — 같은 문서

**결손 행 수 추산 — 5행**

우리 `floor_pack` 의 구간 어휘는 `normal` = {1,2,3,4,5}, `hard` = {1,2,3,4,5,6-10,11-15} 이다.
위키 서술을 이 어휘로 옮기면:

```
normal:4 · normal:5 · hard:4 · hard:5 · hard:6-10   →  5행
```

같은 서술 형태를 가진 다른 팩의 실측과 대조하면 정확히 맞는다.

| 팩 | 위키/우리 서술 | `floor_pack` 실측 행 |
| --- | --- | ---: |
| 1105 시간살인시간 | 노말 4·5 / 하드 4–10 | `normal:4 normal:5 hard:4 hard:5 hard:6-10` = **5** |
| 1106 워프특급 살인사건 | 동일 | **5** |
| **1122 선의의 순례** | **동일** | **0** ← 결손 |

즉 1105·1106 과 완전히 같은 배정 패턴이며 **결손은 정확히 5행**이다.

**우리 데이터**
```
canonical.floor_pack WHERE pack_id='1122'  →  0행   (public 도 동일하게 0행)
canonical.pack 1122: category=event, tag=Collab, extreme=f, superposition=f,
                     unlock_code NULL(§3.4), sprite=Canto_Pilgrimage
pack_boss_encounter 는 있다 — 화면에 「보스전 등장 적」 패널이 뜬다
```
보스 인카운터는 있는데 층 배정만 없다. **원본 결손의 자리가 층 배정 쪽임이 좁혀진다.**

**조치**
1. `floor_pack` 에 5행을 보충한다(출처를 위키로 명시하고 `field_source` 에 기록).
   ```
   (1122, normal, '4') (1122, normal, '5') (1122, hard, '4') (1122, hard, '5') (1122, hard, '6-10')
   ```
2. 다만 **1122 는 2025-09-25 ~ 10-23 한정 콜라보 팩이고 복각이 없다**(확정 배경지식). 층을 채우면
   현행 `packIdsForFloor` 가 이 팩을 상시 후보로 올려 **추천이 틀어진다.** 층 보충과 동시에
   「기간 종료 팩」 플래그(또는 `availabilityOf` 에서 `Collab` 태그 → `limited`)를 넣어야 한다.
   지금 화면의 「일반 층 순환에 등장하지 않음」 문구는 **결과적으로 옳은 표시**다(이유는 층
   결손이 아니라 기간 종료지만).
3. 위키가 주는 추가 사실 2건 — 보스는 `Mayors, the Yearning Flotsam`,
   그리고 「4층에서 골랐으면 5층에 다시 안 나온다」는 배타 규칙. 후자는 우리 스키마에 자리가
   없다(원본 `exceptions` 배열 §3.5 가 이런 규칙을 담고 있을 가능성이 높다 — 재적재 시 확인).

---

## 부수 관측 (판정 항목 밖)

1. **위키 층 표기와 우리 `floor_pack` 이 조회한 8팩 전부 일치했다** — 1201·1203·1205·1301·1302·
   1108·1110·1118. `floor_pack` 288행은 신뢰할 만하다. 유일한 예외가 1122(0행)다.
2. **위키가 우리 `pack_boss_encounter` 공백 42팩 중 최소 5팩의 보스 명단을 준다** —
   1201(3체) · 1203(2체) · 1205(2체) · 1301(3체) · 1302(3체). §3.6 의 「숫자↔문자열 대응표 없음」
   문제를 위키로 우회할 수 있다.
3. **팩 이름 매칭이 en 로 100% 붙었다.** `pack_text.en` 이 위키 문서 제목과 글자 단위로 같아
   앞으로의 위키 대조 작업에 en 이름을 키로 쓸 수 있다.
4. **`AttackType_hard.webp` 는 애셋에 있으나 어느 팩도 `sprite` 로 참조하지 않는다**(고아 애셋).
   같은 방식으로 미참조 애셋을 훑어 보면 결손을 더 찾을 수 있다.
5. 위키 이미지 명명 규칙은 `<이름> Theme Pack.png`(구) 와 `<이름> MD5 Theme Pack.png`(신,
   2024-11-29 일괄 업로드)로 갈린다. MD5 = 거울 던전 5차 개편 아트로 보이며 **보스/일반의
   구분이 아니다.** 위키에 `_boss` 계열 이미지는 없다.
