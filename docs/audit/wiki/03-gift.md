# E.G.O 기프트 — 위키 조사로 판정한 6건

조사일 2026-08-02. 주 출처는 `limbuscompany.wiki.gg`(영문 공식 팬위키). 위키 본문은 `action=raw`
로 위키텍스트 원문을 직접 받아 인용했다(렌더된 표는 WebFetch 가 제대로 못 읽는다).
DB 수치는 전부 이 시점 실측이다.

주의 하나 — `tcrf.net/Limbus_Company` 를 읽으려다 **페이지 본문에 프롬프트 인젝션이 심겨 있는 것을
발견했다**(파일 삭제·교체를 지시하는 문구). 따르지 않았고 이 문서의 어떤 판정에도 쓰지 않았다.
해당 사이트는 이 작업에서 출처로 쓰지 말 것.

---

### 1. `fusion_slot.count` 기본값이 1 인가

**판정** 확정

**답** 그렇다. 재료는 슬롯당 1개가 원칙이고, 수량 2를 요구하는 레시피는 게임 전체에서
**9083 달의 기억(Lunar Memory) 하나뿐**이다. canonical 의 NULL 178행은 전부 `1` 로 읽으면 된다.

**근거**

`List of E.G.O Gifts/Fusion` 의 위키텍스트는 모든 레시피를 **재료 1칸 = 기프트 1개**로 적는다.
수량 표기(`×2` 등)는 표 어디에도 없다. 예:

```
|{{GiftTT|Ashes to Ashes}}{{ItemHeader|wrath|Ashes to Ashes}}
|{{GiftTT|Dust to Dust}}{{ItemHeader|sloth|Dust to Dust}}
|{{GiftTT|Secret Cookbook}}{{ItemHeader|lust|Secret Cookbook}}
|style="border-left:2px solid #600000"|{{GiftTT|Soothe the Dead}}...
```
— https://limbuscompany.wiki.gg/wiki/List_of_E.G.O_Gifts/Fusion

같은 문서의 마지막 절이 예외를 명시한다.

> `==Super Shop Recipes==`
> `Currently, there is only one Fusion Recipe in the game that requires more than 3 Fused Gifts.`

그 유일한 레시피의 표는 `Sundered Memory` · `Punctured Memory` · `Crushed Memory` 에 더해
**`Sin Fragment*` 칸을 두 번** 두고, 각주를 붙인다.

> `The "Sin Fragments" used in this recipe can be any of the following 7 E.G.O Gifts:`
> `Fragment of Hellfire, Fragment of Allurement, Fragment of Inertia, Fragment of Desire,`
> `Fragment of Decay, Fragment of Conceit, Fragment of Friction.`

**우리 데이터** (실측)

```
canonical.fusion_slot  count=2 → 1행 / NULL → 178행 / count=1 → 0행
9083|recipe 0|slot 0|material_id NULL|count 2   ← 대체재 7종은 fusion_slot_option 에
9083|recipe 0|slot 1|9142 Sundered Memory |NULL
9083|recipe 0|slot 2|9147 Punctured Memory|NULL
9083|recipe 0|slot 3|9152 Crushed Memory  |NULL
public.fusion_slot     count=1 → 178행 / count=2 → 1행 / NULL 0
```

위키의 「Sin Fragment 칸 2개 + 7종 중 아무거나」와 canonical 의 「count=2 + option 7행」이
정확히 일치한다. 9083 만 2를 요구한다는 것도 일치한다.

**조치** canonical 적재 시 `fusion_slot.count` 를 `NOT NULL DEFAULT 1` 로 물질화한다.
또는 소비 측에서 `coalesce(count, 1)`. 게임 확인은 불필요하다.

---

### 2. `gift.hard_only` 6종이 실제로 하드 전용인가

**판정** 5건 확정(canonical 이 틀렸다) · 1건 확정(canonical 이 맞다)

**답** **9427 · 9428 · 9431 · 9212 · 9249 는 하드 전용이 아니다**(public=false 가 옳다).
**9841 만 하드 전용이 맞다**(canonical=true 가 옳다). 즉 정답은 116도 122도 아닌 **117**이다.

**근거**

위키는 거울 던전 기프트에 「하드 전용」 플래그를 기프트 단위로 적지 않는다
(`Module:EgoGiftList/data` 의 각 항목은 `gift` 와 `event` 뿐이다). 대신 **테마팩 페이지의
`normal=` / `hard=` 필드**가 그 팩이 어느 난이도 어느 층에 뜨는지를 명시하고,
`unique=` 가 그 팩 전용 기프트를 나열한다. 이것으로 갈린다.

`Mirror Dungeon` 본문이 하드 전용 기프트가 존재한다는 것 자체는 확인해 준다.

> `Hard Mode features additional E.G.O Gift/Mounting Trial choices after the Boss Fight,`
> `Super Shops, and exclusive Theme Packs and E.G.O Gifts.`
— https://limbuscompany.wiki.gg/wiki/Mirror_Dungeon

**9427 마을을 지킬 작살 · 9428 고래의 심장 — 하드 전용 아님**

> `{{ThemePackInfo |name=Crawling Abyss ... |normal=4F,5F |hard=3F,4F`
> `|unique=Town-protecting Harpoon;Cetacean Heart}}`
> `The '''Crawling Abyss''' Theme Pack ... It appears on Floors 4 and 5 on Normal mode,`
> `and Floors 3 and 4 on Hard mode of the Mirror Dungeons.`
— https://limbuscompany.wiki.gg/wiki/Crawling_Abyss_Theme_Pack

**9212 모든 악의 끝 — 하드 전용 아님**

같은 페이지의 Fusion Gifts 표: `Town-protecting Harpoon` + `Cetacean Heart` → `The End of all Evil`.
재료 둘 다 노멀에서 얻히고, 합성은 일반 상점의 기본 기능이다
(`Mirror Dungeon` 의 Shop Functions 표: `|Fuse Gifts | Fusing multiple E.G.O Gifts to produce a new E.G.O Gift. | Free`).
2개 합성이므로 슈퍼 상점도 필요 없다.

**9431 부서진 바이올린 — 하드 전용 아님**

> `{{ThemePackInfo |name=Dregs of the Manor ... |normal=3F |hard=1F`
> `|unique=Broken Violin; Manor-shaped Music Box}}`
> `... It appears on Floor 3 in normal mode and Floor 1 in hard mode of Mirror Dungeon.`
— https://limbuscompany.wiki.gg/wiki/Dregs_of_the_Manor_Theme_Pack

**9249 조그맣고 근사한 바이올린 — 하드 전용 아님**

레시피는 `Oil-gunked Spanner, Twinkling Scrap, and Broken Violin`(3개).
두 재료의 출처인 S.E.A. 팩도 노멀에 뜬다.

> `{{ThemePackInfo |name=S.E.A. ... |normal=2F |hard=2F,3F`
> `|unique=Oil-gunked Spanner;Trash Crab Brain Wine;Twinkling Scrap}}`
— https://limbuscompany.wiki.gg/wiki/S.E.A._Theme_Pack

3개 합성은 일반 상점 범위다(위 「3개를 넘는 레시피는 하나뿐」 문장의 반대 해석 + 슈퍼 상점의
차이가 `E.G.O Gift Fusion in Super Shops support up to 5 E.G.O Gifts being Fused` 로만 적힌다).

**9841 C형 정리 요원 장비 세트 — 하드 전용 맞다**

> `{ gift = "Cleanup Agent Gear Set C", event = "'''Fuse E.G.O Gifts:'''<br>W Corp. Standard`
> ` Issue Cap, E-Type Dimensional Dagger and Portable Barrier Battery" },`
> `{ gift = "W Corp. Standard Issue Cap", event = "Murder on the WARP Express BokGak" },`
— https://limbuscompany.wiki.gg/wiki/Module:EgoGiftList/data

그리고 그 BokGak 팩에는 `normal=` 이 아예 없다.

> `{{ThemePackInfo |name=Murder on the WARP Express BokGak ... |hard=4F,5F,6F-10F`
> ` |unique=... W Corp. Standard Issue Cap; ...}}`
— https://limbuscompany.wiki.gg/wiki/Murder_on_the_WARP_Express_BokGak_Theme_Pack

재료 하나가 하드 전용 테마팩 전용이므로 결과물도 하드에서만 만들 수 있다.
우리 DB 도 `9840 W Corp. Standard Issue Cap` 을 `hard_only=t` · 전용팩 = `Murder on the WARP
Express BokGak` 로 이미 갖고 있다. 두 출처 모두 9840 은 하드 전용으로 표시한다 —
**limbus-assets 가 9840→9841 의 파급만 놓친 것**이다.

**우리 데이터** (실측)

```
hard_only true:  public/limbus-assets 116 · limbus-data-mj 53 · canonical(합집합) 122
교집합 47 · assets 단독 69 · mj 단독 6 (= 문제의 9212·9249·9427·9428·9431·9841)
```

두 출처는 서로를 포함하지 않는다. **「합집합 122가 정답」이라는 기존 전제는 이 6건에서 깨진다** —
mj 단독 6건 중 5건이 위키와 모순한다.

부수 관측: 「하드 전용 테마팩 전용 기프트」 집합(116종)과 assets 의 `hardonly` 116종은 개수가
같지만 교집합이 68뿐이다. 즉 `hardonly` 는 팩 난이도만으로 유도되는 값이 아니며, assets 쪽도
9156~9184(합성 재료·결과물 21종)처럼 근거가 불분명한 항목을 갖고 있다. **`hard_only` 전량은
아직 신뢰할 수 없다.**

**조치**
1. canonical 의 `hard_only` 를 9212 · 9249 · 9427 · 9428 · 9431 → `false` 로 정정하고
   9841 은 `true` 유지. 합계 117.
2. 적재 규칙을 「합집합」에서 「출처별 병기 + 위키 대조」로 바꾼다. 최소한 `mj` 단독 6건은
   합집합에 넣지 않는다.
3. 남은 의심: assets 단독 69건 중 전용팩이 없는 21건(9156 Decamillennial Hearthflame ~
   9184 T-5 Perpetual Motion Machine). **게임에서 볼 것** — 노멀 난이도만으로 완주하며
   Gemstone Oscillator(9163) · Wobbling Keg(9164) · Cantabile(9172) 가 획득 후보에 뜨는지.
   뜨면 assets 의 `hardonly` 도 오염된 것이다.

---

### 3. story_dungeon 기프트 126종을 목록에 낼 것인가

**판정** 제품 판단 — 다만 **위키는 완전히 분리해 다룬다.** `domain` 필터의 근거가 된다.

**답** 위키는 거울 던전 기프트와 스토리 던전 기프트를 **다른 탭 · 다른 표 · 다른 컬럼 구성**으로
분리한다. 스토리 던전 표에는 등급·코스트·키워드 컬럼 자체가 없다 — 우리 canonical 에서 그 126종의
`tier`·`cost`·`keyword_id` 가 전부 NULL 인 것과 정확히 같은 모양이다.

**근거**

`List of E.G.O Gifts` 는 4탭 구조이고 스토리 던전이 별도 탭이다.

> `{{TabbedHeader |tab1 = Overview |tab2 = Fusion |tab3 = Enhance |tab4 = Story Dungeons`
> ` |tab1name = List of E.G.O Gifts |tab2name = Fusion E.G.O Gifts`
> ` |tab3name = Enhanceable E.G.O Gifts |tab4name = Story Dungeon Exclusive Gifts}}`

Overview 탭 본문은 거울 던전만 다룬다고 못박는다.

> `==[[Mirror Dungeon]]==`
> `The following is a comprehensive list of all E.G.O Gifts available in the Mirror Dungeon.`
— https://limbuscompany.wiki.gg/wiki/List_of_E.G.O_Gifts

거울 던전 표의 컬럼: `!Gift !Description !Tier !Cost !Keyword !Event`.
스토리 던전 표의 컬럼: `!Gift !Description !Event` — **Tier · Cost · Keyword 가 없다.**
그리고 챕터별로 쪼개 놓는다.

> `Each Story Dungeon has its own set of obtainable E.G.O Gifts, most being exclusive to that chapter.`
> `===[[Canto I: The Outcast]]===` … `===[[Intervallo VII: Mnestic Experience]]===`
— https://limbuscompany.wiki.gg/wiki/List_of_E.G.O_Gifts/Story_Dungeons

**우리 데이터** canonical.gift 582 = mirror_dungeon 456 + story_dungeon 126.
story_dungeon 126종은 `sin`·`cost`·`tier`·`keyword_id`·효과·발동·팩 전부 비어 있다.

**조치** 현행 화면(`/[locale]/gifts`)과 엔진은 `domain='mirror_dungeon'` 을 기본 필터로 강제한다.
스토리 던전 기프트를 내려면 **별도 화면 · 챕터별 그룹핑 · 등급/코스트/키워드 칼럼 없는 표**로
가야 한다. 같은 목록에 섞으면 위키가 30개 챕터에 걸쳐 나눠 놓은 것을 한 통에 붓는 셈이고,
카드 필드 4개가 빈 껍데기가 된다.

---

### 4. `gift_stage_text` en/ja 에 한국어가 든 6종

**판정** 5건 확정 · 1건 위키로 불가

**답** 이 기프트들은 **게임에 구현되지 않은 미사용(unused) 기프트**다. 게임 파일에만 있고
어떤 던전에서도 나오지 않으므로 **공식 영문/일문 이름이 애초에 없다.**
`loc-en/EGOgift.json` 이 낡은 것이 아니라 **원본 자체가 미번역**이며, 따라서 **결손이 아니다.**

**근거**

`List of E.G.O Gifts` 는 미획득 기프트를 별도 문서로 뺀다.

> `==Unobtainable E.G.O Gifts==`
> `A detailed list of removed and unused E.G.O Gifts can be found on [[List of E.G.O Gifts/Unobtainable|this page]].`

그 문서의 두 번째 절:

> `==Unused E.G.O Gifts==`
> `The following E.G.O Gifts are only visible through the game's files, and are entirely unimplemented.`

표에 실린 항목(원문 그대로):

> `Hopeful Eye` — `An unused E.G.O Gift from [[Branch J-03]], resembling an eye from [[Pink Shoes]]' possessed victims.`
> `Digging Scales` — `An unused E.G.O Gift from [[Branch K-02]], resembling one of the Coil-[[Corroded Inquisitors]]' snake heads.`
> `Severed Snake Head` — `An unused E.G.O Gift from [[Branch K-02]], resembling one of the Coil-[[Corroded Inquisitors]]' arms.`
> `Cured Flesh` — `An unused E.G.O Gift from [[Branch K-02]], resembling one of the Mimicry-[[Corroded Inquisitors]]' arms.`
> `Watchful Eye` — `An unused E.G.O Gift from [[Branch K-02]], resembling one of the Mimicry-[[Corroded Inquisitors]]' eyes.`
— https://limbuscompany.wiki.gg/wiki/List_of_E.G.O_Gifts/Unobtainable

대응(id 는 우리 것, 던전 위치도 일치한다):

| id | 우리 en/ja 문자열 | 위키 이름 | 위키가 말한 출처 | 우리 id 대역 |
| --- | --- | --- | --- | --- |
| 1017 | 희망찬 눈동자 | Hopeful Eye | Branch J-03 = Canto II | 1011–1018 (Canto II) ✔ |
| 1035 | 경화된 살점 | Cured Flesh | Branch K-02 = Canto III | 1031–1051 (Canto III) ✔ |
| 1036 | 경계하는 눈동자 | Watchful Eye | Branch K-02 | ✔ |
| 1045 | 파고드는 비늘 | Digging Scales | Branch K-02 | ✔ |
| 1047 | 잘린 뱀 머리 | Severed Snake Head | Branch K-02 | ✔ |
| **1031** | **용기의 조각** | **없음** | — | Canto III 대역 |

교차 확인: 이 5종은 위키의 Canto II / Canto III **획득 가능 목록에도 없다.**
Canto II 목록은 Toy Fist · Toy Foot · Toy Screw · Emergency Surgical Kit · Rainbow Mainspring ·
Rusty Mainspring · Writhing Ribbon 7종뿐이고 Hopeful Eye 가 없다. Canto III 목록 17종에도 없다.
— https://limbuscompany.wiki.gg/wiki/List_of_E.G.O_Gifts/Story_Dungeons

**1031 용기의 조각은 위키로 불가.** 위키의 미사용 목록에도, 챕터별 획득 목록에도 없다
(위키 미사용 표의 나머지 2행은 이름 없는 `???` 2건 — Dreaming Electric Sheep 관련,
Timekilling Time BokGak 관련이며 우리 1031 과 대역이 다르다).
위키의 영문 이름들(Hopeful Eye 등)이 **공식 번역인지 위키 편집자의 작명인지도 위키가 밝히지
않는다** — 미구현 기프트라 게임에 영문 문자열이 없으므로 후자일 가능성이 높다.

**우리 데이터** (실측)

```
canonical.field_gap  entity=gift · field=name · locale=ko → 1017·1031·1035·1036·1045·1047 (6건)
6종 모두 gift_stage_text 에 ko 행이 없고 en·ja 행에 한국어가 들어 있다.
raw: gifts/loc-en/EGOgift.json 75객체 · loc-ja 75객체 · loc-ko 해당 파일 없음
```

**추가로 찾은 것 — 대장에 없는 7번째 사례**

```
1015 | ko 녹슨 태엽 | en 녹슨 태엽 | ja 錆び付いたゼンマイ
```
1015 는 **위키에 `Rusty Mainspring` 으로 실려 있는 실제 획득 가능 기프트**다
(`{{EgoGift/Row|Rusty Mainspring|event=[[Branch J-03/Floor 2#Exhilarating Edutainment...]]}}`).
ja 는 번역돼 있는데 en 만 한국어다. `field_gap` 은 ko 슬롯만 보므로 이건 잡지 못했다.
**이건 진짜 en 결손이다.**

**조치**
1. 1017 · 1035 · 1036 · 1045 · 1047 → `field_gap` 의 사유를 `ko 표시명이 어느 출처에도 없다`
   에서 **`게임 미구현(unused) 기프트 — 로컬라이즈 자체가 없음`** 으로 바꾸고,
   `gift` 에 `unused`/`unimplemented` 플래그를 세워 목록·검색에서 제외한다.
   `nameOf` 의 `fellBack: true` 폴백 표기도 이 경우 붙이지 않는다.
2. 1031 은 미결. **게임/데이터에서 볼 것** — 스토리 던전 Canto III(Branch K-02)를 완주하며
   `용기의 조각` 이 실제로 획득되는지, 또는 게임 파일에서 이 id 가 어느 던전 테이블에도
   참조되지 않는지 확인한다. 참조가 없으면 위 5종과 같은 미구현 처리.
3. **1015 를 `field_gap` 에 `entity=gift · field=name · locale=en` 으로 추가**한다.
   ko 슬롯만 검사하는 결손 탐지 규칙을 「en/ja 값이 한글을 포함하면 그 로케일의 결손」으로
   확장해 전수 재검사할 것.

---

### 5. `canonical.keyword` 의 `Random` 키워드

**판정** 확정

**답** `Random` 은 **게임 자체의 기프트 카테고리 enum 값이 맞다**(우리가 만든 값이 아니다).
다만 **어떤 기프트에도 붙는 키워드가 아니다** — 합성/리롤 때 플레이어가 고르는
「무작위」 선택지다. 참조 0건은 정상이며, **화면의 키워드 필터 칩에서는 빼야 한다.**

**근거 1 — 게임 원본**

`Random` 은 게임의 로컬라이즈 파일 `EgoGiftCategory.json` 에 3로케일 모두 실려 있다.
이 파일은 12행이고 canonical.keyword 12종과 **완전히 일치**한다.

```
loc-en/EgoGiftCategory.json  {"id": "Random", "name": "Random"}
loc-ko/EgoGiftCategory.json  {"id": "Random", "name": "무작위"}
loc-ja/EgoGiftCategory.json  {"id": "Random", "name": "ランダム"}
```

**근거 2 — 위키의 전수 대조**

위키가 기프트에 붙이는 키워드(`category`)는 **정확히 10종**이다.
`Module:EgoGift/data` 638행 전수 집계:

```
Bleed 91 · Sinking 73 · Tremor 72 · Charge 69 · Burn 64 · Rupture 62
Poise 57 · Slash 43 · Blunt 39 · Pierce 29        (Random 0 · None 0)
```
— https://limbuscompany.wiki.gg/wiki/Module:EgoGift/data

키워드 없는 기프트는 값이 아니라 **부재**로 표현한다.

> `if EgoGift.name({args = {gift,'category'}}) == nil then OutputTable[#OutputTable+1]=' -'`
— https://limbuscompany.wiki.gg/wiki/Module:EgoGiftList

`Mirror Dungeon` 의 「Starting E.G.O Gift Choice」 표도 키워드 10행뿐이다
(Burn · Bleed · Tremor · Rupture · Sinking · Poise · Charge · Slash · Pierce · Blunt,
각 3종). 이는 canonical `start_gift` 30행 = 10키워드 × 3 과 정확히 맞는다.
— https://limbuscompany.wiki.gg/wiki/Mirror_Dungeon

**전수 대조표 (canonical 12 ↔ 위키)**

| canonical.id | ko | en | ja | 위키 category | 기프트 수 |
| --- | --- | --- | --- | --- | --- |
| Combustion | 화상 | Burn | 火傷 | Burn | 64 |
| Laceration | 출혈 | Bleed | 出血 | Bleed | 91 |
| Vibration | 진동 | Tremor | 振動 | Tremor | 72 |
| Burst | 파열 | Rupture | 破裂 | Rupture | 62 |
| Sinking | 침잠 | Sinking | 沈潜 | Sinking | 73 |
| Breath | 호흡 | Poise | 呼吸 | Poise | 57 |
| Charge | 충전 | Charge | 充電 | Charge | 69 |
| Slash | 참격 | Slash | 斬撃 | Slash | 43 |
| Penetrate | 관통 | Pierce | 貫通 | Pierce | 29 |
| Hit | 타격 | Blunt | 打撃 | Blunt | 39 |
| None | 범용 | Keywordless | 汎用 | (nil → `-` 로 렌더) | 120 |
| **Random** | **무작위** | **Random** | **ランダム** | **없음** | **0** |

12종 중 11종이 위키와 1:1로 대응한다. 어긋나는 것은 `Random` 하나뿐이고,
그것은 위키가 기프트 속성으로 다루지 않기 때문이다.

**위키가 말하지 않는 것** — 합성 UI 의 키워드 선택지에 「무작위」 버튼이 실제로 뜨는지는
위키에 적혀 있지 않다. 위키는 `The player first chooses a Keyword Category they would like to
obtain from the Fusion` 이라고만 쓴다. 다만 `Random` 이 게임의 카테고리 로컬라이즈 파일에
정식으로 들어 있으므로 UI 어딘가에서 쓰이는 것은 거의 확실하다.

**우리 데이터** `canonical.keyword` 12행. `Random` → 기프트 0건 · `start_gift` 0건.
raw 의 `limbus-assets.keyword`(11종) · `limbus-data-mj.keyword`(11종) 어디에도 `Random` 은 없다.

**조치**
1. `Random` 행은 **삭제하지 않는다**(게임 원본 enum 이다). 대신 `keyword` 에
   `is_gift_attribute bool` 같은 구분을 두거나, 화면의 필터 칩 쿼리에서
   `id <> 'Random'` 로 제외한다. 지금 그대로 옮기면 아무 기프트도 없는 「무작위」 칩이 뜬다.
2. `keyword.order` 결손(감사 3.6)은 위 표 순서
   (Burn·Bleed·Tremor·Rupture·Sinking·Poise·Charge·Slash·Pierce·Blunt)를 쓰면 된다 —
   위키의 「Starting E.G.O Gift Choice」 표 순서이자 게임 내 순서다. `None` 은 맨 뒤,
   `Random` 은 목록 밖.

---

### 6. 기프트 9001 의 발동 요건

**판정** 확정

**답** **완전 공명(Wrath Absolute Resonance)이 맞다.** `gift_requirement` 쪽이 틀렸다.
그리고 이건 9001 단독 오류가 아니라 **최소 6건짜리 계통 오류**다.

**근거**

위키의 9001 데이터는 강화 단계별 문장을 그대로 갖고 있고, 우리 텍스트와 **문자열 수준까지 일치**한다.

> `["Hellterfly’s Dream"] = { name = "Hellterfly’s Dream", desc = "... <br><br>When activating`
> ` **Wrath Absolute Resonance**, randomly inflict a total of 5 {{StatusEffect|Burn|d}} Potency`
> ` between all enemies at Combat Start.", sin = "wrath", tier = "II", cost = 198, category = "Burn" }`
>
> `["Hellterfly’s Dream+"] = { ... When activating **Wrath Absolute Resonance**, ... total of 6 ... }`
>
> `["Hellterfly’s Dream++"] = { ... When activating **Wrath Resonance**, ... total of 8 ... }`
— https://limbuscompany.wiki.gg/wiki/Module:EgoGift/data

즉 **0·1단계는 완전 공명, ++(2단계)만 일반 공명으로 완화된다.** 우리 `gift_stage_text` 도
ko/en/ja 3로케일 모두 이대로다(0·1 = 분노 완전 공명 / 憤怒完全共鳴, 2 = 분노 공명 / 憤怒共鳴).

`gift_requirement` 에는 단계 컬럼이 없다(`gift_id · kind · value` 뿐). 값은
`[{"mode":"activate","sins":["wrath"]}]` 로 `absolute` 가 없어, **가장 흔한 0단계 기준으로
읽으면 틀린 값**이다. 원본을 봐도 `limbus-data-mj` 의 `requires` 가 이미 그렇게 들어 있고,
같은 객체의 `desc`(0단계)는 `Wrath Absolute Resonance` 라고 쓴다 — **한 파일 안에서 모순**이다.

**계통 오류라는 증거** — `kind='resonance'` 23행 전수 검사:

| 구분 | 건수 | 판정 |
| --- | --- | --- |
| `absolute:true` 있음 | 12 | 전부 정상. 설명문이 `Absolute Resonance` 또는 축약 `A-Reson.` 이다 |
| `absolute` 없음 · 설명문도 일반 공명 | 5 | 정상 (9163 · 9416 · 9747 · 9828 · 9829) |
| **`absolute` 없음 · 0단계 설명문은 `Absolute Resonance`** | **6** | **오류** |

오류 6건:

```
9001 지옥나비의 꿈        Hellterfly’s Dream        "When activating Wrath Absolute Resonance, ..."
9043 사원증               Employee Card             "When activating Wrath Absolute Resonance or ..."
9049 가시밭길             Thorny Path               "When activating Gloom or Lust Absolute Resonance, ..."
9052 휴대용 배터리 소켓   Portable Battery Socket   "When activating Sloth Absolute Resonance, ..."
9053 재는 재로            Dust to Dust              "When activating Sloth Absolute Resonance, ..."
9066 네뷸라이저           Nebulizer                 "When activating Pride Absolute Resonance, ..."
```

대조군: `9011 햇살비(Sunshower)` 는 설명문이 `When activating Sloth Absolute Resonance` 이고
요건도 `[{"mode":"activate","sins":["sloth"],"absolute":true}]` 로 제대로 들어 있다.
플래그 자체는 의미 있게 쓰이고 있고, 위 6건만 빠진 것이다.

**우리 데이터** (실측)

```
canonical.gift_requirement  142행 / 126기프트. kind 분포 slots 60 · sinAffinity 46 ·
resonance 23 · skills 10 · teamWide 3
9001 → [{"mode": "activate", "sins": ["wrath"]}]        ← absolute 없음
9001 gift_trigger → "Wrath Absolute Resonance"          ← 완전 공명
9001 gift_stage_text ko lv0 → "분노 완전 공명을 발동하였다면 …"
9001 gift_stage_text ko lv2 → "분노 공명을 발동하였다면 …"
raw limbus-data-mj 9001.requires → {"resonance":[{"mode":"activate","sins":["wrath"]}]}
raw limbus-data-mj 9001.desc     → "... When activating Wrath Absolute Resonance, ..."
```

**조치**
1. 위 6건에 `"absolute": true` 를 넣는다. 원본을 못 고치면 적재 시 보정 규칙을 둔다 —
   **`kind='resonance'` 이고 0단계 en 설명문이 `Absolute Resonance` 또는 `A-Reson.` 를
   포함하면 `absolute:true` 로 강제**. 이 규칙으로 23행 전수를 재생성하면 위 표대로
   `absolute` 18행 · 일반 5행이 된다.
2. **더 큰 문제 — `gift_requirement` 에 강화 단계 축이 없다.** 9001 은 0·1단계와 2단계의
   요건이 실제로 다르다(완전 공명 → 공명). 지금 스키마로는 이걸 표현할 수 없다.
   `gift_requirement` 에 `level` 컬럼을 추가하거나, 「0단계 기준」임을 명시해야 한다.
3. 게임 확인은 **불필요**하다(위키 + 자기 설명문 + 발동 토큰이 모두 같은 답을 낸다).
   굳이 본다면 9001 을 **++까지 강화한 상태**로 분노 일반 공명만 띄웠을 때 효과가 켜지는지 —
   켜지면 위키의 ++ 문장(완화)까지 맞다는 확인이 된다.

---

## 요약표

| # | 항목 | 판정 | 답 |
| --- | --- | --- | --- |
| 1 | `fusion_slot.count` 기본값 | 확정 | 1. 예외는 9083 하나뿐 (위키 「3개 초과 레시피는 하나뿐」 + Sin Fragment 칸 2개) |
| 2 | `hard_only` 6종 | 확정 | 9427·9428·9431·9212·9249 는 하드 전용 **아님**, 9841 만 맞음 → 정답 **117** |
| 3 | story_dungeon 126종 | 제품 판단 | 위키는 별도 탭·별도 표·컬럼도 다름 → `domain` 필터 근거 충분 |
| 4 | en/ja 한국어 6종 | 5건 확정 | 게임 **미구현(unused)** 기프트. 결손 아님. 1031 은 위키로 불가. 별도로 **1015 en 결손** 발견 |
| 5 | `Random` 키워드 | 확정 | 게임의 `EgoGiftCategory.json` 정식 enum(무작위). 기프트 속성은 아니므로 필터 칩에서 제외 |
| 6 | 9001 발동 요건 | 확정 | **완전 공명**이 맞다. `gift_requirement` 오류이며 **6건짜리 계통 오류** |
