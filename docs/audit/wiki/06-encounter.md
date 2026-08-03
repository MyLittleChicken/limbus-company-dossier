# 인카운터·적 — 위키 조사 결과

> 조사 2026-08-03 · 대상 `docs/audit/06-encounter.md` §8 미확정 6건
> 1차 출처 `limbuscompany.wiki.gg` (신뢰도 높음). 위키 원문은 `?action=raw` 위키텍스트를 우선 인용했다.
> 위키 인용과 함께 리포 원본 JSON 실측을 병기한다. 실측은 `data/entities/` 직접 계수다.

**요약** — 6건 중 **5건 확정**, 1건(등장 수)만 위키로 불가.
그 과정에서 감사 문서의 전제 **2개가 틀렸음**이 드러났다.
`battles` 는 연속 전투가 아니라 **보스 후보 목록**이고,
`canonical.enemy` 1,342행 중 **472행은 적이 아니라 부위**다.

---

### 1. `portrait` 가 적 id 가 맞는가

**판정** 확정 — **아니다. `portrait` 는 초상화 이미지 id 이며 여러 적이 공유한다.**

**답** `portrait` 를 `enemy.id` 로 쓰면 안 된다. 이름 37건 불일치는 우리 데이터의 오류가 아니라
「한 초상화를 쓰는 서로 다른 적」을 하나로 접었기 때문이다. asset 쪽 `name` 이 정본이다.

**근거 1 — 위키가 초상화 파일을 id 로 이름 짓는다**

`The Dusk of Amber` 팩 문서가 렌더링하는 이미지 파일명:

> `BunBun-1369_portrait.png` · `BongBong-1366_portrait.png`
> — https://limbuscompany.wiki.gg/wiki/List_of_Floor_Themes/The_Dusk_of_Amber

그런데 같은 문서의 **위키텍스트가 참조하는 적 id 는 다르다.**

> ```
> |Enemy Wave <br> {{EnBox|1373}}
> |Reinforcements <br> {{EnMiniBox|1370}}
> ```
> — https://limbuscompany.wiki.gg/index.php?title=The_Dusk_of_Amber_Theme_Pack&action=raw

**1369·1366 은 초상화, 1373·1370 이 적이다.** 위키가 스스로 두 번호 공간을 분리해 쓴다.

**근거 2 — 한 초상화가 서로 다른 위키 문서 두 개에 걸린다**

우리 `md__canto-3-1.json` 은 `portrait: 90035` 를 두 이름에 쓴다
(`Scourging N Corp. Inquisitor`, `Interrogative N Corp. Inquisitor`).
위키에는 **둘 다 독립 문서로 존재한다.**

- https://limbuscompany.wiki.gg/wiki/Interrogative_N_Corp._Inquisitor
- https://limbuscompany.wiki.gg/wiki/Scourging_N_Corp._Inquisitor

`portrait: 90038` 도 `Joyous` / `Fearless` 두 이름에 걸린다. 1:1 이 아님이 확정된다.

**근거 3 — 위키가 「한 적의 변형들」을 한 문서에 모은다**

`portrait: 1224` 를 세 이름(`Heart-breaking / Heart-tearing / Heart-piercing Sword`)이 공유한다.
위키는 이 셋을 `Sword of a Forgotten Knight` 한 문서의 난이도 변형으로 적는다.

> Heart-breaking Sword (Hard Difficulty) — Slash: Ineff. [x0.1] / Pierce: Ineff. [x0.1] / Blunt: Fatal [x2]
> Heart-tearing Sword (Hard Difficulty) — Slash: Fatal [x2] / Pierce: Ineff. [x0.1] / Blunt: Ineff. [x0.1]
> Heart-piercing Sword (Hard Difficulty) — Slash: Ineff. [x0.1] / Pierce: Fatal [x2] / Blunt: Ineff. [x0.1]
> — https://limbuscompany.wiki.gg/wiki/Sword_of_a_Forgotten_Knight

우리 `md__walpu-6.json` 의 세 검 저항값과 **완전히 같다.** 이름도 위키 쪽이 우리 asset `name`
과 같고, loc 쪽 `Sword of a Forgotten Knight`(=대표 이름)와 다르다.

**근거 4 — `md__canto-1-1` 검증 (질문에서 지목한 건)**

> The Forgotten Theme Pack contains 6 nodes … The sole boss encounter features: **Old G Corp. Head Manager**
> Special Soldier Types: **Recollected Awry Soldier / Recollected Wallowing Soldier / Recollected Overtaken Soldier**
> — https://limbuscompany.wiki.gg/wiki/The_Forgotten_Theme_Pack
>
> `The Forgotten | 1F | 1F | 6 nodes | Old G Corp. Head Manager | —`
> — https://limbuscompany.wiki.gg/wiki/List_of_Floor_Themes (「Possible Bosses」 열)

**우리 데이터 4종과 이름·구성이 정확히 일치한다.** 즉 `md__canto-1-1` 은 문제가 없다.
한국어(`기억속 어긋난/절망하는/침식된 패잔병 · 옛 G사 부장`)도 이 4종의 번역으로 맞다.

**우리 데이터**

```
md__canto-1-1 targets  portrait 90014/90015/90016/91001
  → loc-en Enemies.json 에서 Recollected Awry/Wallowing/Overtaken Soldier · Old G Corp. Head Manager
  → 4/4 일치 (불일치 0)
전체 최상위 타깃 398건 중 portrait 로 이름이 갈리는 것 37건
  분류: 초상화 공유(다른 적) 9 · "Refracted " 접두 차 8 · 스포일러 "???" 4 ·
        대소문자 1 · 좌우/무기 라벨 뒤바뀜 5 · 기타 이름 개정 10
```

**해석 실패 7건의 정체** — 번호 공간 문제가 아니라 **로컬라이즈 스냅샷 결손**이다.

| portrait | 등장 인카운터 | asset 이름 | 판정 |
| --- | --- | --- | --- |
| 1277 / 1278 / 1279 | `story__8-5-11` | Heishou Pack - Si : Veilstriker / Shadestriker / Depthstriker | loc 파일에 행 없음 |
| 1307 | `story__9-10` | Ebony Queen's Apple | loc 파일에 행 없음 |
| 1336 | `story__9-43`, `md__hidden-ring` | The Ring Apprentice - Albina | loc 파일에 행 없음 |
| 1460 | `story__9-5-24` | (빈 문자열) | 원본 자체가 빈 이름 |
| 91016 | `story__6-33` | Dead Rabbits Boss | **`parts[0].partId=820401 → 8204` 로 풀린다** |

**조치**

- `encounter_target` 에 **`portrait`(초상화 이미지 id)와 `part_id`(부위 id)를 각각** 담는다.
  `portrait` 는 이미지 표시용이지 FK 가 아니다. FK 로 승격하면 37건이 **틀린 적에 붙는다.**
- 적 이름의 정본은 asset `targets[].name` 이다. loc 이름으로 덮어쓰면 안 된다.
- **다국어 복구는 `portrait` 조인으로 하면 안 된다.** `parts[].partId` 조인이 더 정확하지만
  이것도 만능이 아니다(아래 주의).

> **주의 — `partId // 100` 도 완전하지 않다.**
> `md__walpu-8` 은 `partId 137001/137101/137201/137301 → 적 1370/1371/1372/1373` 로 풀리고
> 위키의 `EnBox|1373` · `EnMiniBox|1370` 과 일치한다. `md__walpu-6` 도 `partId 123301 → 1233` 이고
> 위키 `Hatred and Despair Theme Pack` 의 `{{EnBox|1233}}` 와 일치한다.
> 그러나 `md__canto-2-3` 은 `partId 827301` → 8273 이 loc 어디에도 없다.
> 전수 실측: `partId//100` 이 loc-en 이름과 일치 386 · 불일치 26 · 미해석 690.
> **어느 한 키로 전부 풀리지 않는다. 두 키를 모두 담고 해석 실패는 명시적으로 남겨야 한다.**

---

### 2. `waves` · `phases` · `battles` 가 무엇인가

**판정** 확정 — 셋의 뜻이 **감사 문서의 추정과 다르다.**

**답**
- `battles` = **한 팩의 보스 「후보」 목록.** 연속 전투가 아니라 **서로 배타적인 대안**이다.
- `phases` = 보스 페이즈 전환. 맞다.
- `waves` = 한 전투 안의 증원 웨이브. 맞다.

**근거 A — `battles` = 보스 후보 (결정적)**

위키가 팩마다 **「Possible Bosses」** 열을 두고 여러 보스를 적는다.

> `! rowspan="2" | Possible Bosses` … `|{{EnBox|8001}}{{EnBox|8002}}{{EnBox|8094}}`
> — https://limbuscompany.wiki.gg/index.php?title=The_Outcast_Theme_Pack&action=raw
>
> **Focused Boss Encounter. Each Floor Theme Pack has its own pool of potential bosses.**
> — https://limbuscompany.wiki.gg/index.php?title=Mirror_Dungeon&action=raw (노드 종류 표)

우리 `md__canto-1-2.json`(= 팩 1002 The Outcast) 의 `battles` 3개는
`Ebony Queen's Apple` / `Doomsday Calendar` / `Golden Apple` 이다.
**위키의 「Possible Bosses」 목록과 이름·개수·순서가 그대로 같다.**

전수 대조(75팩):

```
len(encounter.battles)  ==  len(mj packs_detail[pid].mapGen.bossPool)
   →  75 / 75 일치 (불일치 0)
```

이름 대조 표본:

| 팩 | 위키 Possible Bosses | 우리 `battles` |
| --- | --- | --- |
| 1002 The Outcast | Ebony Queen's Apple, Doomsday Calendar, Golden Apple | 동일 3 |
| 1024 Charm, Wander, Doubt | Faelantern, Wayward Passenger, Shock Centipede, Ebony Queen's Apple | 동일 4 |
| 1007 Faith & Erosion | Four-Legged Beast, Slithering Inquisitor | 동일 2 |
| 1010 Falling Flowers | So That No One Will Cry, Drifting Fox, Dongbaek E.G.O::Spicebush | 동일 3 |
| 1014 Crawling Abyss | Ambling Pearl, Skin Prophet, Dream-Devouring Siltcurrent | 동일 3 |

**근거 B — `phases` = 페이즈 전환**

우리 `md__canto-1-2.json` `battles[2].phases` = `[Golden Apple(8008), Golden Apple(8009)]`,
loc 는 8009 를 `False Apple` 이라 적는다.

> Yuri was consumed by Golden Apple, causing it to **transform into its second form, False Apple**.
> 「the encounter features two distinct phases」
> — https://limbuscompany.wiki.gg/wiki/Golden_Apple

**근거 C — `waves` = 증원 웨이브**

위키가 보스 표기에 웨이브 수를 괄호로 적는다.

> `|{{EnMiniBox|1128}}<br>{{EnMiniBox|1129}}{{EnMiniBox|1130}}(2 Waves)`
> — https://limbuscompany.wiki.gg/index.php?title=Mirror_Dungeon&action=raw (Mirror of Immortality EXTREME Bosses)
>
> `|Enemy Wave <br> {{EnBox|1373}}` … `|Reinforcements <br> {{EnMiniBox|1370}}`
> — https://limbuscompany.wiki.gg/index.php?title=The_Dusk_of_Amber_Theme_Pack&action=raw

우리 `md__canto-2-3.json` `waves` 4개는 같은 적이 반복 등장하며 새 적이 더해지는 형태
(`Slumber-broken Neighbor` → +`Freezing Miner Slave` → +`Shivering Miner Slave`)로,
「증원」 서술과 맞는다.

**참고 — 「Chain battle」은 `battles` 가 아니다**

> Normal Encounter — **Chain battle encounter.**
> Risky Encounter — **Chain battle of Humanoid/Monsters at a higher Level.**
> — https://limbuscompany.wiki.gg/index.php?title=Mirror_Dungeon&action=raw

「연속 전투」는 **일반/위험 노드**의 성질이고, 그 정의는 `battlePool` 쪽에 있다(우리에겐 없다).
보스 인카운터의 `battles` 와는 무관하다. 이름이 비슷해 헷갈릴 자리다.

**우리 데이터**

```
encounter 251  ·  targets 152 / waves 59 / battles 27 / phases 13 (교집합 0)
보스 인카운터 75 의 모양   targets 31 · waves 26 · battles 16 · phases 2
75개 파일의 battles 총 항목 수 = 100  =  같은 75팩의 bossPool 합계 100
```

**조치 — 감사 §7.2 의 「986건을 펼치면 된다」를 그대로 하면 틀린 데이터가 된다**

- `battles[i]` 는 **서로 다른 보스전**이다. 한 인카운터의 타깃으로 평평하게 펼치면
  「이 보스전에 나오는 적」이 최대 4배로 부풀고 저항이 뒤섞인다.
  → `encounter` 를 팩당 N개(보스 후보 수)로 쪼개거나, `boss_option_index` 축을 새로 둔다.
- `waves[i]` / `phases[i]` 는 **같은 전투 안**이므로 `wave_index` / `phase_index` 축을 가진
  자식 행으로 펼치면 된다. 여기서는 「같은 적이 여러 번 세어지는」 걱정이 실재하므로
  (`md__canto-2-3` 은 `Slumber-broken Neighbor` 가 3개 웨이브에 반복 등장) 축을 꼭 남겨야 한다.
- 결론적으로 `encounter_target` 은 `(encounter_id, kind, group_index, index)` 4키가 필요하다.
  `kind ∈ {top, wave, phase, battle}`.

---

### 3. 인카운터 저항값의 해석

**판정** 확정 — 등급은 **구간**이고 값은 실수 배수다. `0.1` 은 실재한다.

**답** 인카운터 저항은 인격 저항과 같은 **곱셈 배수**이고, `docs/09-resistance.md` 의
`2 / 1 / 0.5` 3단은 **인격 공격 타입 저항에만 해당하는 특수 사례**다.
게임 전체의 저항 등급은 값의 **범위**로 정의된다.

**근거 — 위키 등급표**

> | Fatal | (x1.5, x2] |
> | Weak | (x1, x1.5] |
> | Normal | [x1] |
> | Endure | [x0.75, x1) |
> | Ineffective | (x0, x0.75) |
> | Immune | [x0] |
> — https://limbuscompany.wiki.gg/wiki/Battles (Resistances 절)
>
> Resistances are **multipliers factored on top of incoming damage**, determining the final amount
> of damage a unit takes. All characters have Resistance multipliers to both physical damage types
> (Slash, Pierce and Blunt) **and Sin Affinities.**
> — https://limbuscompany.wiki.gg/wiki/Battles

**근거 — `0.1` 이 실재한다는 직접 인용**

> Heart-breaking Sword (Hard Difficulty) — Slash: **Ineff. [x0.1]** / Pierce: **Ineff. [x0.1]** / Blunt: Fatal [x2]
> — https://limbuscompany.wiki.gg/wiki/Sword_of_a_Forgotten_Knight

우리 `md__walpu-6` 의 세 검 값과 **10축 전부 일치**한다. 실측 0.1 은 12건이고 전부 이 세 검이다.

**근거 — 부위별 저항이 별도로 존재한다**

> **All enemy units in Focused Encounters possess a minimum of 1 Core and 1 Part.**
> When a unit's Part takes HP damage, its Core also takes an equal amount of damage.
> Each part can possess **different Skills, Resistances and Passives.**
> — https://limbuscompany.wiki.gg/wiki/Battles (Parts 절)
>
> Destructible — 파괴되면 **physical resistances become Fatal [2x]** (부위는 계속 쓸 수 있다)
> Severable — 파괴되면 완전히 제거·조준 불가
> Indestructible & Unseverable — 파괴 불가, 0 이 되면 다음 턴 전부 회복
> — 같은 곳

**교차 검증 — 위키 개별 적 문서와 우리 값이 완전히 일치한다**

> BongBong [Orange] — Slash: Normal [x1] · Pierce: Weak [x1.5] · Blunt: Endure [x0.75] ·
> Wrath: Fatal [x2] · Lust: Weak [x1.2] · Sloth: Normal [x1] · Gluttony: Endure [x0.8] ·
> Gloom: Fatal [x2] · Pride: Endure [x0.8] · Envy: Normal [x1]
> — https://limbuscompany.wiki.gg/wiki/BongBong_(Orange)

우리 `md__walpu-8` `targets[0].parts[0].resists` 와 **10/10 일치.**
`1.2 → Weak`, `0.8 → Endure`, `0.1 → Ineffective` 로 위키 구간표에 전부 들어맞는다.

**우리 데이터** (`encounter_part_resist` 3,540건 전수)

```
0.1  12  |  0.2   2  |  0.5 371  |  0.6   2  |  0.7  16  |  0.75 698  |  0.8 136  |  0.9  10
1  1484  |  1.1   9  |  1.2 240  |  1.25 104  |  1.5 228  |  1.75  3  |  1.8   2  |  2  223

위키 구간으로 접으면:
  Ineffective (0, 0.75)  411   Endure [0.75, 1)  844   Normal [1]  1,484
  Weak (1, 1.5]          581   Fatal (1.5, 2]    223   Immune [0]      0
```

16종 값은 이상이 아니다. **정상이다.**

**조치**

- `docs/09-resistance.md` §2 를 고친다. 「값 체계는 `2/1/0.5` 3단」이 아니라
  **연속 실수 배수 + 6등급 구간**이며, 인격 3축이 `[0.5, 1, 2]` 고정인 것은 인격만의 설계다.
  위 구간표를 §2 에 그대로 싣는다.
- 화면 표기는 값이 아니라 **등급 라벨 + 값 병기**(`Ineffective ×0.1`)로 간다.
  위키가 정확히 그렇게 표기한다. 「×2 = 취약」 오해(§7 미해결 항목)가 이걸로 풀린다.
- `Immune [x0]` 은 우리 데이터에 0건이지만 스키마상 허용해야 한다.
- 「부위 파괴 시 물리 저항이 2배로 바뀐다」는 정적 저항값만으로는 계산할 수 없다.
  추천 엔진이 저항을 쓸 때 이 동적 변화를 무시한다는 점을 문서에 명시한다.

---

### 4. mj `bossPool` 204 와 assets `bossEncounters` 75 의 관계

**판정** 확정 — **같은 보스를 가리키는 두 표기가 아니다. `bossPool` 이 후보 목록이고
`bossEncounters` 는 「그 후보들을 담은 인카운터 파일」 1개를 가리킨다.**

**답** 팩의 보스는 **매번 다르다.** 팩마다 1~4종의 후보 중 하나가 뽑힌다.
우리가 아는 75건은 「대표 하나」가 아니라 **후보 전부를 담은 파일 75개**이고,
그 안을 열면 후보 100종이 나온다. 나머지 42팩(105종)은 원본에 없다.

**근거 — 위키가 「Possible Bosses」라고 적고 팩마다 여러 보스를 나열한다**

> **Focused Boss Encounter. Each Floor Theme Pack has its own pool of potential bosses.**
> — https://limbuscompany.wiki.gg/index.php?title=Mirror_Dungeon&action=raw
>
> 표 머리글: `Theme Pack | Normal | Hard | Floor Length | **Possible Bosses** | Unique Gifts`
> — https://limbuscompany.wiki.gg/wiki/List_of_Floor_Themes

여러 보스를 가진 팩(위키 발췌):

> The Outcast — Ebony Queen's Apple, Doomsday Calendar, Golden Apple
> Faith & Erosion — Four-Legged Beast, Slithering Inquisitor
> Falling Flowers — So That No One Will Cry, Drifting Fox, Dongbaek E.G.O::Spicebush
> Crawling Abyss — Ambling Pearl, Skin Prophet, Dream-Devouring Siltcurrent
> Dregs of the Manor — Josephine, Hindley, Dead Rabbits Boss
> The Infinite Procession — The Priest, The Barber, Dulcinea
> Charm, Wander, Doubt — Faelantern, Wayward Passenger, Shock Centipede, Ebony Queen's Apple
> — https://limbuscompany.wiki.gg/wiki/List_of_Floor_Themes

**우리 데이터 — 개수가 위키와 정확히 맞는다**

```
mj packs_detail[*].mapGen.bossPool 크기 분포 (117팩)
   1종 64팩 · 2종 21팩 · 3종 29팩 · 4종 3팩      →  합 205 (고유 204)

위키 대조
   The Forgotten (1001)        bossPool 1  ↔  위키 1종 (Old G Corp. Head Manager)
   The Outcast (1002)          bossPool 3  ↔  위키 3종
   Charm, Wander, Doubt (1024) bossPool 4  ↔  위키 4종
   Faith & Erosion (1007)      bossPool 2  ↔  위키 2종
   Crawling Abyss (1014)       bossPool 3  ↔  위키 3종
```

**assets 쪽 실체 (항목 2 와 연결)**

```
bossEncounters 를 가진 팩 75개 · 각 팩당 정확히 1건 (75/75)
그 인카운터 파일의 battles 항목 수 == 같은 팩 bossPool 크기   →  75/75 일치
75팩 합계: battles 항목 100  ==  bossPool 합계 100
전체 117팩 bossPool 합계 205 중 우리가 실제 내용을 아는 것 100 (48.8%)
```

**조치**

- 감사 §4.4 의 「같은 보스의 두 표기인데 개수가 안 맞는다」를 **정정**한다.
  개수는 어긋나지 않는다. `bossEncounters` 는 팩→파일 포인터이고,
  후보 열거는 그 파일 안 `battles` 에 있다. **75/75 완전 일치한다.**
- 화면에는 「보스: A 또는 B 또는 C (무작위)」로 내야 한다. 지금처럼 하나만 보이면 틀린 정보다.
- 채워지지 않는 것은 **42팩 · 후보 105종**이고, 이것은 `bossEncounters` 자체가 원본에 없어서다
  (감사 §3.2(a) 판정 그대로 유효). mj `bossPool` 의 7자리 id 를 인카운터에 잇는 표는 여전히 없다.

**병기해야 할 불일치 1건 — 팩 1005 The Unloving**

> `|{{EnBox|8023}}` (= `Baba Yaga`, loc-en `Enemies.json` id 8023)
> — https://limbuscompany.wiki.gg/index.php?title=The_Unloving_Theme_Pack&action=raw

`mj.bossPool` 크기도 1이라 **개수는 맞는다.** 그러나 우리 `md__canto-2-3.json` 의 4 웨이브는
`Slumber-broken Neighbor / Rearisen Neighbor / Freezing Miner Slave / Shivering Miner Slave`
뿐이고 **Baba Yaga 는 `data/entities/encounters/` 전역에 없다**(`grep -rl "Baba Yaga"` → 인카운터 asset 0건).
assets 스냅샷이 위키보다 오래되었거나 팩→인카운터 매핑이 갱신되지 않은 것으로 보인다.
**우리 데이터를 정본으로 삼지 말고 확인 대상으로 남긴다.**

---

### 5. `enemy_text.part` 의 정체

**판정** 확정 — 부위 이름이 아니다. 그리고 **`canonical.enemy` 테이블 자체가 두 종류를 섞고 있다.**

**답** `desc` 는 그 행이 **무엇인지 알려주는 역할 라벨**이다.
`Enemies*.json` 은 **적 행과 부위 행이 한 표에 섞인 평면 사전**이고, 둘의 `name`/`desc` 의미가 다르다.

**근거 — 위키가 Core/Part 를 게임의 구조 용어로 쓴다**

> **All enemy units in Focused Encounters possess a minimum of 1 Core and 1 Part.**
> When a unit's Part takes HP damage, its Core also takes an equal amount of damage.
> Most status effects are also applied only to the targeted Part rather than the Core …
> Each part can possess **different Skills, Resistances and Passives.**
> — https://limbuscompany.wiki.gg/wiki/Battles

부위에 이름이 붙는 것도 위키가 보여준다.

> BongBong [Orange] — **Core HP: 87 · Body Part HP: 94** · Speed 2~4 · Defense 47
> — https://limbuscompany.wiki.gg/wiki/BongBong_(Orange)
>
> Sword of a Forgotten Knight — **Parts: Body (Indestructible & Unseverable)**
> — https://limbuscompany.wiki.gg/wiki/Sword_of_a_Forgotten_Knight

**우리 데이터 — 원본 구조를 열어보니 이유가 드러난다**

`data/entities/encounters/loc-en/Enemies-walpu8.json` 원문:

```json
{"id": 1366,   "name": "BongBong [Orange]", "desc": "Dawn Ordeal - Swarm Movement Prep 1"}
{"id": 136601, "name": "Body",              "desc": "BongBong [Orange] Body"}
{"id": 1367,   "name": "BongBong [Orange]", "desc": "Dawn Ordeal - Swarm Movement Prep 2"}
{"id": 136701, "name": "Body",              "desc": "BongBong [Orange] Body"}
```

id 자릿수로 두 종류가 갈린다. 전수 실측:

| id 자릿수 | 행 수 | 정체 | `name` | `desc` |
| --- | ---: | --- | --- | --- |
| 4자리 | 532 | **적** | 적 이름 | 역할 라벨 또는 부제 |
| 5자리 | 338 | **적** | 적 이름 | 역할 라벨 또는 부제 |
| 6자리 | 472 | **부위** (= 적id × 100 + n) | **부위 이름** | 소유자 라벨 |
| | **1,342** | | | |

```
6자리(부위) 행의 name 분포
  Body 260 · Head 36 · Left Arm 27 · Right Arm 17 · Person 7 · Flower 7 ·
  Right Leg 6 · Left Leg 6 · Tail 6 · Telepole 6 · …

4·5자리(적) 행의 desc 분포
  Core 463 · Enemy Unit 173 · (빈) 85 · Unit 64 · (없음) 18 · Enemy Boss 10 · Boss 3 ·
  Fauvist Student 8 · Regular Enemy 5 · The Index Proselyte 4 · Dawn Ordeal - Swarm Movement Prep 1~3 …
```

**1,342 = 532 + 338 + 472. `canonical.enemy` 행 수와 정확히 같다.**
즉 **`canonical.enemy` 1,342행 중 472행(35.2%)은 적이 아니라 부위다.**
ETL 이 `name`→`enemy_text.name`, `desc`→`enemy_text.part` 로 무차별 적재했기 때문에
「적 이름이 `Body`, 부위가 `Part`」인 행 437건이 만들어졌다.

감사 §6.3 이 관측한 `Core 465 · Part 437 · Enemy Unit 175` 는 그래서 나온 것이다.
`Part 437` 은 **부위 행의 소유자 라벨**이고, `Core 465` 는 **적 행의 역할 라벨**이다.
두 값은 같은 축이 아니다.

**조치**

- **`canonical.enemy` 를 `enemy`(870행)와 `enemy_part`(472행)로 쪼갠다.**
  `enemy_part.enemy_id = id // 100` 으로 부모가 정확히 결정된다.
- `enemy_text.part` 컬럼명을 `desc` 또는 `role_label` 로 고친다. 부위 이름이 아니다.
  실제 부위 이름은 `enemy_part.name`(Body/Head/Left Arm/…)에 들어간다.
- ETL 주석 「`desc` 가 부위 이름이다」를 정정한다. 부위 행에서만 `name` 이 부위 이름이다.
- **「적 1,342종」이라는 마스터북·감사 수치를 870종으로 정정한다.**
- `enemy_text.part` NULL 109건은 이상이 아니다(적 행 중 `desc` 가 빈 것 85 + 없는 것 18 + 부위 6).
- 부수: `encounter_target_part.part_id` 는 이 6자리 id 와 같은 번호 공간이다.
  `encounter_target_part` ↔ `enemy_part` 가 곧바로 조인된다. 지금은 FK 가 없다.

---

### 6. `encounter_target` 중복 행의 의미

**판정** **혼합** — 「중복 행」 부분은 **확정**, 「등장 수」 부분은 **위키로 불가**.

**답 (1)** 중복이 아니다. **세 행은 서로 다른 적이다.**
`BongBong [Orange]` 라는 같은 이름을 가진 **세 변형**(Swarm Movement Prep 1/2/3)이고,
우리가 `name` 만 담았기 때문에 같아 보였을 뿐이다.

**답 (2)** 「봉봉이 몇 마리 나오는가」는 **위키가 적지 않는다.** `num` 도 동시 등장 수로 볼 수 없다.

**팩 특정** — `md__walpu-8` 은 팩 **1124 「호박색 어스름의 시련」(The Dusk of Amber)** 이다.

```sql
SELECT * FROM canonical.pack_boss_encounter WHERE encounter_id='md__walpu-8';   -- 1124|md__walpu-8
-- pack_text: ko 호박색 어스름의 시련 / en The Dusk of Amber / ja 琥珀の夕暮
```

**근거 — 세 행이 서로 다른 적임을 원본이 말한다**

`data/entities/encounters/limbus-assets/md__walpu-8.json` 실측:

```
idx  name                                portrait  parts[0].partId  num
 0   BongBong [Orange]                     1366        137001        7
 1   BongBong [Orange]                     1366        137101        8
 2   BongBong [Orange]                     1366        137201        5
 3   BunBun [Juicy Squeezer - Orange]      1369        137301        2
```

`portrait` 는 셋 다 1366(같은 그림)이지만 `partId` 가 다르고,
`partId // 100` 이 loc 의 세 적 행을 정확히 가리킨다.

```
1370  BongBong [Orange]  "Dawn Ordeal - Swarm Movement Prep 1"
1371  BongBong [Orange]  "Dawn Ordeal - Swarm Movement Prep 2"
1372  BongBong [Orange]  "Dawn Ordeal - Swarm Movement Prep 3"
1373  BunBun [Juicy Squeezer - Orange]  "Ordeal of Dusk"
```

**근거 — 위키도 같은 id 를 쓰고 같은 「Herd Migration」 구분을 한다**

> `|Enemy Wave <br> {{EnBox|1373}}`
> `|Reinforcements <br> {{EnMiniBox|1370}}`
> — https://limbuscompany.wiki.gg/index.php?title=The_Dusk_of_Amber_Theme_Pack&action=raw
>
> 렌더링된 링크: `BongBong (Orange)#**Mirror_Dungeon_(Herd_Migration_1)**`
> — https://limbuscompany.wiki.gg/wiki/List_of_Floor_Themes/The_Dusk_of_Amber

위키는 보스 `1373`(BunBun)과 증원 `1370`(Herd Migration 1)만 적고 **1371·1372 를 빠뜨렸다.**
**이 지점에서는 우리 데이터가 위키보다 완전하다.**

**근거 (부재) — 등장 수는 위키에 없다**

`The Dusk of Amber Theme Pack` 위키텍스트에 수량 파라미터가 **하나도 없다.**
`{{EnBox}}` · `{{EnMiniBox}}` 는 id 하나만 받는다.
`BongBong (Orange)` 개별 문서에도 「몇 마리 등장」 서술이 없다(레벨·HP·저항만 있다).

**`num` 이 동시 등장 수가 아니라는 반증 (우리 데이터)**

한 전투 그룹 안 `num` 합계(`num` 없으면 1)를 전수 계수했다.

```
합계 1: 174그룹 · 2: 63 · 3: 57 · 4: 45 · 5: 69   ← 여기까지는 화면 정원과 맞는다
합계 6: 13 · 7: 8 · 8: 9 · 9: 9 · 10: 15 · 12: 22 · 14: 9 · 22: 1 · 30: 3 · 40: 1 · 77: 2
```

`md__walpu-8` 은 7+8+5+2 = **22**, `luxcavation__48-*` 은 3×4 = **12**,
`md__canto-1-2` `battles[1]` 은 Doomsday Calendar + 7 + 8 = **16** 이다.
동시 등장 정원(최대 5)을 크게 넘는다. → `num` 은 **전투 전체에 걸쳐 등장할 수 있는 총량**
(소환·증원 포함)으로 보는 편이 자연스럽지만, **원본도 위키도 그렇게 명시하지 않는다.**

**조치**

- `encounter_target` 을 `name` 만으로 식별하지 말고 **`part_id`(또는 `partId//100`)를 담는다.**
  담는 순간 세 행은 「같은 봉봉 3마리」가 아니라 「Prep 1/2/3 세 변형」으로 올바르게 읽힌다.
- `num` 을 `count` 로 되살리되(감사 B6) **컬럼 주석에 「동시 등장 수가 아님. 의미 미확정」을 남긴다.**
  이 값으로 「몇 마리와 싸우나」를 화면에 쓰면 안 된다.
- **게임에서 보아야 갈리는 것 (구체안)**
  1. 거울 던전에서 팩 **「호박색 어스름의 시련」**(The Dusk of Amber, 팩 1124)을 골라 보스 노드에 들어간다.
  2. **전투 시작 시점**의 화면에 봉봉이 몇 마리 있는지 센다 → 이것이 「동시 등장 수」다.
     (예상: 5칸 정원이므로 5 이하)
  3. 전투가 끝날 때까지 **새로 나타난 봉봉을 누적**해 센다 → 이것이 `num` 합계(20)와 맞는지 본다.
     맞으면 `num` = 「전투 전체 등장 총량」으로 확정된다.
  4. 봉봉의 **체력·속도가 서로 다른 개체가 섞여 있는지** 본다. 다르면 Prep 1/2/3 이
     실제로 구분되는 개체임이 확정되고, 같으면 내부 구분일 뿐이다.
  5. 대조군으로 `md__canto-2-3`(팩 1005 The Unloving) 처럼 `num` 합이 5 이하인 전투에 들어가
     시작 시 정확히 그 수가 나오는지 본다. 나오면 「`num` = 동시 등장 수, 단 총량 상한도 겸함」.

---

## 부록 — 이 조사로 드러난 감사 문서 정정 목록

| 위치 | 감사 문서의 서술 | 정정 |
| --- | --- | --- |
| §3.2(d) · §6.1 B2 | 「`portrait` 390/398 이 `enemy.id` 로 해석되는데 버려졌다 → FK 로 쓰자」 | `portrait` 는 초상화 id 다. FK 로 쓰면 최소 37건이 **틀린 적**에 붙는다. `part_id` 를 함께 담아야 한다 |
| §7.2 · §6.1 B1 | 「`waves/phases/battles` 안 986건을 풀면 보스전 적을 아는 팩이 31→75가 된다」 | `battles` 는 **보스 후보**다. 평평하게 풀면 「이 보스전의 적」이 부풀고 저항이 섞인다. `boss_option_index` 축이 필요하다 |
| §4.4 | 「보스 표기가 둘인데 204 대 75로 맞지 않고 잇는 표가 없다」 | 맞지 않는 게 아니다. `bossEncounters`→파일→`battles` 가 후보를 담고 **75/75 · 100/100 정확히 일치**한다 |
| §6.3 | 「`enemy_text.part` 는 85%가 분류어다」 | 그 표는 **적 행과 부위 행이 섞인 것**이다. `canonical.enemy` 1,342 중 **472는 부위**다 |
| §5.4 | 「인카운터 저항 16종이 `docs/09-resistance.md` 와 어긋난다」 | 어긋나지 않는다. 게임의 등급은 **구간**이다. 09 문서 쪽이 인격에만 맞는 특수 사례를 일반화했다 |
| §2.4 | 「적 1,342종」 | 적 870종 + 부위 472 |

## 부록 — 참조 URL

- https://limbuscompany.wiki.gg/wiki/Battles — 저항 등급 구간표 · Core/Part 정의
- https://limbuscompany.wiki.gg/wiki/Mirror_Dungeon — 노드 종류 · boss pool 서술 · `(2 Waves)`
- https://limbuscompany.wiki.gg/wiki/Theme_Packs — 팩 목록 · boss pool 서술
- https://limbuscompany.wiki.gg/wiki/List_of_Floor_Themes — 「Possible Bosses」 표
- https://limbuscompany.wiki.gg/wiki/The_Forgotten_Theme_Pack — 항목 1 검증
- https://limbuscompany.wiki.gg/wiki/The_Outcast_Theme_Pack — 항목 2·4 검증
- https://limbuscompany.wiki.gg/wiki/The_Unloving_Theme_Pack — 항목 4 불일치
- https://limbuscompany.wiki.gg/wiki/The_Dusk_of_Amber_Theme_Pack — 항목 1·6 검증
- https://limbuscompany.wiki.gg/wiki/Hatred_and_Despair_Theme_Pack — 항목 1 (EnBox 1233)
- https://limbuscompany.wiki.gg/wiki/Sword_of_a_Forgotten_Knight — 항목 1·3 (x0.1)
- https://limbuscompany.wiki.gg/wiki/BongBong_(Orange) — 항목 3·6
- https://limbuscompany.wiki.gg/wiki/Golden_Apple — 항목 2 (페이즈)
- https://limbuscompany.wiki.gg/wiki/Interrogative_N_Corp._Inquisitor · .../Scourging_N_Corp._Inquisitor — 항목 1
- https://limbuscompany.wiki.gg/wiki/Damage_Formula — 저항이 곱해지는 위치
- https://limbuscompany.wiki.gg/wiki/List_of_Enemies — 적 목록 (부위 구분 없음, 수량 없음)

*(위키텍스트 인용은 모두 `?action=raw` 로 원문을 받은 것이다. `namu.wiki` 는 WebFetch 403 이라 쓰지 않았고, `fandom` 은 `wiki.gg` 로 전부 답이 나와 교차 확인이 필요하지 않았다.)*
