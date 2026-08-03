# 결손 대장 — 채워야 하는 것

> 스냅샷 `2026-07-25` · 결손 **1,137건**
> 이 파일은 생성물이다. `npm run v2:gap-report` 로 다시 만든다.

## 채우는 법

1. 게임에서 값을 확인한다
2. `app.field_override` 에 넣는다

```sql
INSERT INTO app.field_override (entity, entity_id, field, locale, value, note)
VALUES ('status', 'FullCharon', 'name', 'ko', '"완전한 카론"'::jsonb,
        '게임에서 직접 확인 2026-08-02');
```

3. `npm run v2:canonical` 을 다시 돌린다

**보정은 재적재에 살아남는다.** `app` 스키마는 `TRUNCATE` 범위 밖이다.
덮은 값은 `canonical.field_source.rule = 'manual'` 로 기록된다.

## 요약

| 계열 | 필드 | 로케일 | 건수 |
| --- | --- | --- | ---: |
| `reward` | `item` | ko | 200 |
| `reward` | `item` | ja | 200 |
| `achievement` | `text` | ko | 183 |
| `achievement` | `text` | ja | 183 |
| `encounter_target_part` | `resists` | — | 122 |
| `pack` | `textColor` | — | 61 |
| `choice_event` | `text` | ko | 56 |
| `choice_event` | `text` | ja | 56 |
| `encounter` | `bossPool` | — | 42 |
| `skill` | `levels` | — | 9 |
| `gift` | `name` | ko | 6 |
| `enemy_part` | `enemy_id` | — | 6 |
| `passive` | `name` | — | 6 |
| `encounter_target` | `name` | — | 2 |
| `pack` | `unlockCode` | — | 2 |
| `association` | `name` | ja | 2 |
| `encounter` | `battlePool` | — | 1 |

## `reward.item` (ko) — 200건

> ko 아이템 이름이 없다
> 근거 `docs/data/mirror-dungeon/00-overview.md`

| id |
| --- |
| `6#1` |
| `6#10` |
| `6#100` |
| `6#11` |
| `6#12` |
| `6#13` |
| `6#14` |
| `6#15` |
| `6#16` |
| `6#17` |
| `6#18` |
| `6#19` |
| `6#2` |
| `6#20` |
| `6#21` |
| `6#22` |
| `6#23` |
| `6#24` |
| `6#25` |
| `6#26` |
| `6#27` |
| `6#28` |
| `6#29` |
| `6#3` |
| `6#30` |
| `6#31` |
| `6#32` |
| `6#33` |
| `6#34` |
| `6#35` |

… 그 밖 170건. 전량은 SQL 로 본다.

```sql
SELECT entity_id FROM canonical.field_gap
WHERE entity = 'reward' AND field = 'item' AND locale = 'ko';
```

## `reward.item` (ja) — 200건

> ja 아이템 이름이 없다
> 근거 `docs/data/mirror-dungeon/00-overview.md`

| id |
| --- |
| `6#1` |
| `6#10` |
| `6#100` |
| `6#11` |
| `6#12` |
| `6#13` |
| `6#14` |
| `6#15` |
| `6#16` |
| `6#17` |
| `6#18` |
| `6#19` |
| `6#2` |
| `6#20` |
| `6#21` |
| `6#22` |
| `6#23` |
| `6#24` |
| `6#25` |
| `6#26` |
| `6#27` |
| `6#28` |
| `6#29` |
| `6#3` |
| `6#30` |
| `6#31` |
| `6#32` |
| `6#33` |
| `6#34` |
| `6#35` |

… 그 밖 170건. 전량은 SQL 로 본다.

```sql
SELECT entity_id FROM canonical.field_gap
WHERE entity = 'reward' AND field = 'item' AND locale = 'ja';
```

## `achievement.text` (ko) — 183건

> ko 표시 문자열이 어느 출처에도 없다
> 근거 `docs/data/mirror-dungeon/00-overview.md`

| id |
| --- |
| `adv_barrier#6` |
| `adv_barrier#7` |
| `adv_brut#6` |
| `adv_brut#7` |
| `adv_ego#6` |
| `adv_ego#7` |
| `adv_frail#6` |
| `adv_frail#7` |
| `adv_inf#6` |
| `adv_inf#7` |
| `adv_lvl#6` |
| `adv_lvl#7` |
| `adv_mark#6` |
| `adv_mark#7` |
| `adv_mental#6` |
| `adv_mental#7` |
| `adv_nerve#6` |
| `adv_nerve#7` |
| `adv_no_lunar#7` |
| `adv_score#6` |
| `adv_score#7` |
| `adv_sp#6` |
| `adv_sp#7` |
| `adv_vit#6` |
| `adv_vit#7` |
| `clr_any_count#6` |
| `clr_any_count#7` |
| `clr_floor10#6` |
| `clr_floor10#7` |
| `clr_floors#6` |

… 그 밖 153건. 전량은 SQL 로 본다.

```sql
SELECT entity_id FROM canonical.field_gap
WHERE entity = 'achievement' AND field = 'text' AND locale = 'ko';
```

## `achievement.text` (ja) — 183건

> ja 표시 문자열이 어느 출처에도 없다
> 근거 `docs/data/mirror-dungeon/00-overview.md`

| id |
| --- |
| `adv_barrier#6` |
| `adv_barrier#7` |
| `adv_brut#6` |
| `adv_brut#7` |
| `adv_ego#6` |
| `adv_ego#7` |
| `adv_frail#6` |
| `adv_frail#7` |
| `adv_inf#6` |
| `adv_inf#7` |
| `adv_lvl#6` |
| `adv_lvl#7` |
| `adv_mark#6` |
| `adv_mark#7` |
| `adv_mental#6` |
| `adv_mental#7` |
| `adv_nerve#6` |
| `adv_nerve#7` |
| `adv_no_lunar#7` |
| `adv_score#6` |
| `adv_score#7` |
| `adv_sp#6` |
| `adv_sp#7` |
| `adv_vit#6` |
| `adv_vit#7` |
| `clr_any_count#6` |
| `clr_any_count#7` |
| `clr_floor10#6` |
| `clr_floor10#7` |
| `clr_floors#6` |

… 그 밖 153건. 전량은 SQL 로 본다.

```sql
SELECT entity_id FROM canonical.field_gap
WHERE entity = 'achievement' AND field = 'text' AND locale = 'ja';
```

## `encounter_target_part.resists` — 122건

> 원본에 resists 키 자체가 없다 (부위 저항 결측)
> 근거 `docs/data/encounter/00-overview.md`

| id |
| --- |
| `md__railway-4-s3#wave#0#0#831101` |
| `md__railway-4-s3#wave#0#1#830401` |
| `md__railway-4-s3#wave#0#10#831501` |
| `md__railway-4-s3#wave#0#11#831301` |
| `md__railway-4-s3#wave#0#2#830601` |
| `md__railway-4-s3#wave#0#3#831001` |
| `md__railway-4-s3#wave#0#4#831201` |
| `md__railway-4-s3#wave#0#5#830901` |
| `md__railway-4-s3#wave#0#6#831401` |
| `md__railway-4-s3#wave#0#7#830801` |
| `md__railway-4-s3#wave#0#8#830501` |
| `md__railway-4-s3#wave#0#9#830701` |
| `md__railway-4-s4#wave#0#0#831601` |
| `md__railway-4-s4#wave#0#1#831701` |
| `md__railway-4-s4#wave#0#10#832601` |
| `md__railway-4-s4#wave#0#11#832701` |
| `md__railway-4-s4#wave#0#2#831801` |
| `md__railway-4-s4#wave#0#3#831901` |
| `md__railway-4-s4#wave#0#4#832001` |
| `md__railway-4-s4#wave#0#5#832101` |
| `md__railway-4-s4#wave#0#6#832201` |
| `md__railway-4-s4#wave#0#7#832301` |
| `md__railway-4-s4#wave#0#8#832401` |
| `md__railway-4-s4#wave#0#9#832501` |
| `md__railway-5#battle#1#0#865301` |
| `md__railway-5#battle#1#1#865401` |
| `md__railway-5#battle#1#10#866301` |
| `md__railway-5#battle#1#11#866401` |
| `md__railway-5#battle#1#12#866501` |
| `md__railway-5#battle#1#13#866601` |

… 그 밖 92건. 전량은 SQL 로 본다.

```sql
SELECT entity_id FROM canonical.field_gap
WHERE entity = 'encounter_target_part' AND field = 'resists' AND locale = '';
```

## `pack.textColor` — 61건

> mj packs.json 에 값이 없다 (56/117 만 보유)
> 근거 `docs/data/pack/00-overview.md`

| id |
| --- |
| `1201` |
| `1202` |
| `1203` |
| `1204` |
| `1205` |
| `1206` |
| `1301` |
| `1302` |
| `1303` |
| `1304` |
| `1305` |
| `1306` |
| `1307` |
| `1308` |
| `1309` |
| `1310` |
| `1311` |
| `1312` |
| `1313` |
| `1314` |
| `1315` |
| `1316` |
| `1317` |
| `1318` |
| `1319` |
| `1320` |
| `1321` |
| `1401` |
| `1402` |
| `1403` |

… 그 밖 31건. 전량은 SQL 로 본다.

```sql
SELECT entity_id FROM canonical.field_gap
WHERE entity = 'pack' AND field = 'textColor' AND locale = '';
```

## `choice_event.text` (ko) — 56건

> ko 표시 문자열이 없다
> 근거 `docs/data/mirror-dungeon/00-overview.md`

| id |
| --- |
| `971027` |
| `971028` |
| `971029` |
| `971030` |
| `971031` |
| `971032` |
| `971033` |
| `971034` |
| `971035` |
| `971036` |
| `971037` |
| `971038` |
| `971039` |
| `971040` |
| `971041` |
| `971042` |
| `971043` |
| `971044` |
| `971045` |
| `971046` |
| `971047` |
| `971048` |
| `971049` |
| `971050` |
| `971051` |
| `971052` |
| `971053` |
| `971054` |
| `971060` |
| `971061` |

… 그 밖 26건. 전량은 SQL 로 본다.

```sql
SELECT entity_id FROM canonical.field_gap
WHERE entity = 'choice_event' AND field = 'text' AND locale = 'ko';
```

## `choice_event.text` (ja) — 56건

> ja 표시 문자열이 없다
> 근거 `docs/data/mirror-dungeon/00-overview.md`

| id |
| --- |
| `971027` |
| `971028` |
| `971029` |
| `971030` |
| `971031` |
| `971032` |
| `971033` |
| `971034` |
| `971035` |
| `971036` |
| `971037` |
| `971038` |
| `971039` |
| `971040` |
| `971041` |
| `971042` |
| `971043` |
| `971044` |
| `971045` |
| `971046` |
| `971047` |
| `971048` |
| `971049` |
| `971050` |
| `971051` |
| `971052` |
| `971053` |
| `971054` |
| `971060` |
| `971061` |

… 그 밖 26건. 전량은 SQL 로 본다.

```sql
SELECT entity_id FROM canonical.field_gap
WHERE entity = 'choice_event' AND field = 'text' AND locale = 'ja';
```

## `encounter.bossPool` — 42건

> mj bossPool 의 숫자 id 와 assets 조우 이름표를 잇는 표가 원본에 없다
> 근거 `docs/superpowers/specs/2026-08-03-encounter-redesign-design.md`

| id |
| --- |
| `1201` |
| `1202` |
| `1203` |
| `1204` |
| `1205` |
| `1206` |
| `1301` |
| `1302` |
| `1303` |
| `1304` |
| `1305` |
| `1306` |
| `1307` |
| `1308` |
| `1309` |
| `1310` |
| `1311` |
| `1312` |
| `1313` |
| `1314` |
| `1315` |
| `1316` |
| `1317` |
| `1318` |
| `1319` |
| `1320` |
| `1321` |
| `1401` |
| `1402` |
| `1403` |

… 그 밖 12건. 전량은 SQL 로 본다.

```sql
SELECT entity_id FROM canonical.field_gap
WHERE entity = 'encounter' AND field = 'bossPool' AND locale = '';
```

## `skill.levels` — 9건

> levels 가 비어 있어 단계를 만들 수 없다
> 근거 `docs/data/identity/03-limbus-data-mj-skills.md`

| id |
| --- |
| `1021207` |
| `1071506` |
| `1071507` |
| `1081405` |
| `1101205` |
| `1101206` |
| `1111510` |
| `1111511` |
| `1121607` |

## `gift.name` (ko) — 6건

> ko 표시명이 어느 출처에도 없다 (단계 0)
> 근거 `docs/data/gift/00-overview.md`

| id |
| --- |
| `1017` |
| `1031` |
| `1035` |
| `1036` |
| `1045` |
| `1047` |

## `enemy_part.enemy_id` — 6건

> 부모 적 1243 가 loc 에 없다
> 근거 `docs/data/encounter/00-overview.md`

| id |
| --- |
| `124301` |
| `124302` |
| `811401` |
| `811501` |
| `811601` |
| `813501` |

## `passive.name` — 6건

> 이름이 어느 출처에도 없다 — 마스터북의 「유령」 (회차 4·10·13 세 번 확인)
> 근거 `docs/data/identity/00-overview.md`

| id |
| --- |
| `1011003` |
| `1021202` |
| `1031102` |
| `1050803` |
| `1051102` |
| `1100903` |

## `encounter_target.name` — 2건

> 적 이름이 비어 있다 (원본 결함)
> 근거 `docs/data/encounter/00-overview.md`

| id |
| --- |
| `reflectrial__9-5-2#phase#0#3` |
| `story__9-5-24#top#0#3` |

## `pack.unlockCode` — 2건

> packs_detail.unlock 에 값이 없다
> 근거 `docs/data/pack/00-overview.md`

| id |
| --- |
| `1122` |
| `3001` |

## `association.name` (ja) — 2건

> 일본어 표시명이 어느 출처에도 없다
> 근거 `docs/data/identity/00-overview.md`

| id |
| --- |
| `FIREPUNCH_OFFICE` |
| `L_CORP` |

## `encounter.battlePool` — 1건

> mj packs_detail 의 전투 풀 2,525종과 assets 조우 251개를 잇는 표가 리포에 없다
> 근거 `docs/backlog/10-encounter-linkage.md`

| id |
| --- |
| `*` |

