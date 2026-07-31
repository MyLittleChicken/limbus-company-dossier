# 회차 7 — `loc-*` 의 거울 던전 UI · 버프 · 스킬 계열

> **UI·버프·스킬 문자열** · 3로케일 × **38파일** · **2,672건**(ko 기준)
> 출처 커밋 `774883d7` · 스냅샷 2026-07-25 · 정리 2026-07-31
> **거울 던전 편(회차 1–7)의 마지막 회차**

회차 6이 이벤트 계열 12파일을 가져갔고, 남은 38파일을 여기서 본다.

| 계열 | 파일 | 건수 |
| --- | ---: | ---: |
| `MirrorDungeonUI*` · `TutorialMirrorDungeon` | 12 | 1,141 |
| `Skills_Abnormality_Mirror*` · `Skills_Enemy_*` | 5 | 323 |
| `Bufs_Mirror*` | 5 | 261 |
| `BattleKeywords_Mirror*` | 5 | 261 |
| `DungeonStartBuffs*` | 3 | 116 |
| `UI_Mission_MirrorDungeon*Event` | 3 | 147 |
| 기타 이름·노드 5종 | 5 | 100 |

---

## 1. `Bufs_Mirror*` ↔ `BattleKeywords_Mirror*` — **같은 것을 두 번 담는다**

건수가 5쌍 모두 정확히 같다(45 · 47 · 71 · 74 · 24).

| 판 | id 집합 | 값 |
| --- | --- | --- |
| Mirror3 | 동일 | **1건 다름** |
| Mirror4 | 동일 | 동일 |
| Mirror5 | 동일 | 동일 |
| **Mirror6** | **다름** | 다름 |
| Mirror7 | 동일 | **5건 다름** |

### Mirror6 — id 오타 1건

```
Bufs             GiveMeCandy_LowMorale
BattleKeywords   GiveMeCandy_LowMoral      ← e 가 빠졌다
```

**같은 상태를 두 파일이 다른 id 로 부른다.** 어느 쪽이 정본인지 알 수 없다.

### 값이 다른 6건은 서술 차이다

```
MDHcFcBe   Bufs "코인 위력 증폭 I"        BattleKeywords "코인 위력 증폭"
GreatAesthetics
  Bufs  "- 더하기 코인 스킬의 코인 위력 +1, 빼기 코인 스킬의 기본 위력 +(4/코인 수)"
  BK    "- 더하기 코인 스킬의 코인 위력 +1\n- 빼기 코인 스킬의 기본 위력 +(4/코인 수)"
```

**줄바꿈과 로마 숫자 접미만 갈린다.** 뜻은 같다.

> 인격 편·E.G.O 편에서 본 `Bufs.json` ↔ `BattleKeywords.json` 관계가
> 거울 던전에도 그대로 있다. **중복 저장이며 완전히 동기화되지는 않는다.**

키 구성도 판마다 다르다 — Mirror3·4·5 는 `id`·`name`·`desc` 3종인데
Mirror6 은 `iconId`·`summary`·`undefined` 가, Mirror7 은 `flavor`·`summary`·`undefined` 가 붙는다.

**`undefined` 키**는 인격 편 회차 13에서 본 원본 버그와 같은 것이다.

## 2. `DungeonStartBuffs*` — 시작 버프 116건

```
DungeonStartBuffs.json      25      DungeonStartBuffs_MD6.json  44
DungeonStartBuffs_MD7.json  47      DungeonStartBuffs_2.json    (en 에만)
```

키가 `id` · `description` 둘뿐이다. **`loc-ko` 에 `DungeonStartBuffs_2.json` 이 없다** —
기프트 편 회차 7의 `EGOgift.json` 결손과 같은 종류의 로케일 비대칭이다.

회차 1의 `grace`(은총 10종)와는 다른 축이다. UI 문자열이 이를 확인한다.

```
mirror_dungeon_start_buffs_chip_name   "별빛"
mirror_dungeon_hard_require_condition_start_buf   "- 시작 버프 전체 활성화"
```

**「별빛」이 시작 버프의 화면 이름**이고, 하드 난이도가 이를 전체 활성화한다.

## 3. `MirrorDungeonUI*` — UI 문자열 1,141건

```
UI_4  295 · UI_2 234 · UI_5 138 · UI_6 130 · UI_3 75 · UI_7 59 · UI 42
UI_5_InfinityFloor 21 · UI_6_Achievement 9 · UI_7_Achievement 9
TutorialMirrorDungeon 432
```

키는 `id`(문자열) · `content` 다. **`TutorialMirrorDungeon.json` 432건이 가장 크다** —
E.G.O 편 회차 3에서 「환상 해석」 어휘를 찾은 파일이다.

`UI_5_InfinityFloor` 21건이 회차 1에서 본 하드 전용 `6-10` · `11-15` 층 구간의
화면 문자열이다.

`_Achievement` 접미 2파일(각 9건)이 회차 3의 업적 UI 다.

## 4. `Skills_Abnormality_Mirror*` — 환상체 스킬 323건

```
Skills_Abnormality_Mirror7-extreme  120   ← 가장 크다
Skills_Abnormality_Mirror            78
Skills_Abnormality_Mirror6           51
Skills_Enemy_Mirror7-extreme         38
Skills_Abnormality_Mirror7           36
```

구조가 **인격·E.G.O 스킬과 같다** — `id` · `levelList[{level, name, desc, coinlist}]`.

```
levelList 키   level 323 · name 323 · coinlist 321 · desc 295 · keywords 6 · coindescs 1
```

`keywords` 6건 · `coindescs` 1건은 **다른 스킬 파일에 없던 키**다.

`ja` 에만 `Skills_Enemy_Mirror7-nextupdate.json` 이 있다 — **다음 업데이트 미리 반영분**이다.

## 5. **BOM 이 붙은 파일 4종**

```
MirrorDungeonRentalName.json          MirrorDungeonRentalUI.json
UI_Mission_MirrorDungeon6Event.json   UI_Mission_MirrorDungeon7Event.json
```

**3로케일 전부** BOM(`EF BB BF`)이 붙어 있다. `json.load` 가 그대로 실패한다.

```
json.decoder.JSONDecodeError: Unexpected UTF-8 BOM (decode using utf-8-sig)
```

마스터북 전체에서 **BOM 이 나온 첫 사례**다. `utf-8-sig` 로 읽어야 한다.

## 6. 로케일 비대칭

```
ko 50파일 · en 51 · ja 53

en 에만   DungeonStartBuffs_2.json
ja 에만   MirrorDungeonEnemyBuffDesc.json · Skills_Enemy_Mirror7-nextupdate.json
```

---

## 함정 요약

1. **BOM 이 붙은 파일 4종**이 있다. `utf-8-sig` 로 읽어야 한다
2. `Bufs_Mirror6` 과 `BattleKeywords_Mirror6` 이 **`GiveMeCandy_LowMoral(e)` id 오타**로 갈린다
3. `Bufs`/`BattleKeywords` 는 **중복 저장이며 6건이 어긋난다**
4. `undefined` 키가 Mirror6·7 에 있다 — 인격 편 회차 13과 같은 원본 버그
5. 로케일마다 파일 수가 다르다(50 · 51 · 53)

## 미해결

없다. 38파일 × 3로케일 전부 확정했다.

## 근거 재현

```
data/entities/mirror-dungeon/loc-{ko,en,ja}/                    38파일 · 2,672건
data/entities/mirror-dungeon/limbus-assets/md__details.json     grace 대조
```
