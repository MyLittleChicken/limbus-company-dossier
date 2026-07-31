# 회차 11 — `loc-*/Personalities*.json` + `Personality_Get_Condition.json`

> **표시 문자열의 원본** · 로케일 3종 · `loc-ko` 4파일 · `loc-en` 3파일 · `loc-ja` 4파일
> `Personalities.json` 186항목 · `Personality_Get_Condition.json` 344항목
> 출처 커밋 `595947fc`(ko) · `ccfff8e3`(en) · `2f98ddb4`(ja) · 스냅샷 2026-07-25 · 정리 2026-07-30

## 파일 정체

**로케일 회차의 첫 번째다.** 인격명·설명·해금 조건 문구를 담는다.

```
                                     ko      en      ja
Personalities.json                186항목  186항목  186항목    인격명 본체
Personality_Get_Condition.json    344항목  344항목  344항목    해금 조건 문구
Personalities-x1p1c1.json          12항목   12항목   12항목    이벤트 유닛
Personalities-a1c9p2.json           0항목      —      0항목    빈 파일
```

**`loc-en` 에는 `a1c9p2` 가 없다.** ko·ja 에만 있고 그것도 빈 파일이라 패치 잔재로 보인다.

세 로케일의 **id 집합이 완전히 같다**(186/186, 차집합 0).

### 대조한 출처

| 출처 | 무엇을 대조했나 |
| --- | --- |
| `limbus-data-mj/identities.json` | `titleKo` ↔ `loc-ko` 의 `title` — 줄바꿈 정규화 |
| `limbus-assets/identities.json` | 인격 184건 대응 · 인격 아닌 2건 |
| `loc-en` · `loc-ja` | 로케일 간 id 집합·줄바꿈 |

---

## `Personalities.json` — 인격명 본체

| | |
| --- | --- |
| 타입·실측 | `{dataList: [...]}` · **186항목** · 유일 id 186 |
| 원소 키 | `id` · `title` · `name` · `nameWithTitle` · `desc` **186/186** · `skinItemTitle`·`skinItemDesc` **1/186** |
| 인격 대응 | **184건 전부 있다**(누락 0) |
| 변환 | **쓰이지 않는다** — mj `titleKo` 를 쓴다 |
| 적재 | 미적재 |
| 화면 | 간접 (mj 경유) |

### 인격이 아닌 2건

```
9999   title="붉은시선"  name="베르길리우스"   nameWithTitle="" desc=""
40501  title="고향을 떠나야 했던 어느 밤"  name="뫼르소"
       skinItemTitle="[외형 투영] 고향을 떠나야 했던 어느 밤"
       desc="사영 전투][투전 영사 - 경험기억 한정 보상으로 획득"
```

**`9999` 는 베르길리우스** — 플레이어가 편성하는 인격이 아니라 조력 유닛이다.

**`40501` 은 외형(스킨)** 이다. `skinItem*` 필드를 가진 유일한 항목이며 `4xxxx` 대역이다.

**id 대역이 넷으로 갈린다.**

```
1xxxx     인격 (5자리)          184건
4xxxx     외형/스킨 (5자리)       1건 — 40501
4xxxxx    이벤트 유닛 (6자리)     12건 — x1p1c1 파일
9999      조력 유닛              1건
```

`nameWithTitle` 은 **184건에서 `name` 과 같고** 이 2건만 빈 문자열이다. 사실상 중복 필드다.

`40501` 의 `desc` 에 **대괄호가 깨져 있다** — `"사영 전투][투전 영사"` 에서 `]` 가 짝 없이
등장한다. 회차 3의 `[[FirePunchFuel]` 과 같은 계열의 원본 오타다.

### `title` 에 줄바꿈이 있다

```
ko  title 에 \n 있는 것   166/186
en  title 에 \n 있는 것   159/186

10101  "LCB\n수감자"
```

**mj `titleKo` 는 이 줄바꿈을 공백으로 바꾼 것과 100% 일치한다.**

```
mj titleKo 대조 (184건)
  완전 일치        18건      원래 줄바꿈이 없는 것
  줄바꿈만 다름     166건     "LCB\n수감자" → "LCB 수감자"
  그 외             0건
```

**두 출처가 같은 문자열이고 mj가 정규화만 했다.** 우리는 mj를 쓰므로 이미 정규화된 값이 들어온다.

**함정 — `loc` 을 직접 쓰면 줄바꿈이 화면에 나간다.** 회차 13에서 `loc` 이 척추가 될 때
같은 처리가 필요하다. `stripMarkup` 은 Unity 태그만 지우고 `\n` 은 건드리지 않는다.

### ko·en 이 같은 1건

```
11215  "LCE E.G.O::\nAEDD"      ko · en 동일
```

**회차 1의 `titleKo` 결손 1건이 여기서도 확인된다.** 한국판이 영문 표기를 그대로 쓰므로
정상이며, 회차 3의 `"AEDD"`·`"Furioso-Replica"` 와 같은 계열이다.

### `desc` — 인격 순번 설명

```
ko  "이상의 첫번째 인격"   12건 (기본 인격)  ·  "이상의 두번째 인격" …  174건
en  "Yi Sang's 1st Identity" …
```

**수감자별 순번을 문장으로 적은 것**이다. `id` 뒤 2자리·`slotId` 와 같은 정보이며 **파생**이다.
`40501`(스킨)만 예외로 획득 조건이 들어 있다.

---

## `Personalities-x1p1c1.json` — 이벤트 유닛 12종

| | |
| --- | --- |
| 타입·실측 | 12항목 · id `400025`–`400036` · **6자리** |
| 대응 | **수감자 12명 전원** |
| 변환 | 쓰이지 않는다 |

```
400025  "병아리반 반장"     이상        400031  "병아리반 수감생"   히스클리프
400026  "코끼리반 반장"     파우스트     400032  "병아리반 수감생"   이스마엘
400027  "코끼리반 수감생"   돈키호테     400033  "펭귄반 수감생"    로쟈
400028  "코끼리반 수감생"   료슈        400034  "병아리반 수감생"   싱클레어
400029  "펭귄반 수감생"    뫼르소       400035  "펭귄반 반장"     오티스
400030  "코끼리반 수감생"   홍루        400036  "펭귄반 수감생"    그레고르
```

**유치원 컨셉 이벤트 전용 유닛**이다. 반이 셋(병아리·코끼리·펭귄)이고 각 반에 반장이 하나씩
있다. 인격 편 범위 밖이며 **어떤 엔티티로도 적재되지 않는다.**

파일명 `x1p1c1` 은 이벤트 식별자로 보인다. 같은 접미가 `Skills_personality-x1p1c1.json`
(회차 12) · `UnitKeyword-x1p1c1.json`(회차 13)에도 있다.

---

## `Personality_Get_Condition.json` — 해금 조건 문구

| | |
| --- | --- |
| 타입·실측 | **344항목** · 원소 키 `id`·`content` **둘뿐** |
| id 형식 | `{인격id}_getCondition_{normal\|gacksung}` |
| 접미 | `normal` 172 · `gacksung` 172 — **정확히 반반** |
| 유일 인격 id | **172** (인격 184 중 12건 없음) |
| 변환 | **쓰이지 않는다** |
| 적재 | 미적재 |

```
10102_getCondition_normal      "남부 세븐 협회 6과 이상 획득 시"
10102_getCondition_gacksung    "남부 세븐 협회 6과 이상 동기화 3단계 달성"
```

**`gacksung` = 각성**이다. 회차 3·4의 `CheckAwakenLevel` 과 같은 어휘이며, `content` 가
"동기화 3단계 달성"이라 **동기화 3 = 각성**임을 확인해준다.

**획득 조건이 아니라 이야기 해금 조건**으로 읽힌다 — 인격을 얻거나 동기화 3을 달성하면
무언가(스토리·대사)가 열린다는 뜻이다. 회차 6의 `event`/`eventReward`(실제 획득 경로)와
다른 축이다.

**없는 12건이 기본 인격**이다(`LCB 수감자` 12명). 처음부터 갖고 있으므로 해금 조건이 없다.

---

## 함정 요약

1. **`title` 에 줄바꿈이 있다**(ko 166/186). mj가 공백으로 정규화한 값을 우리가 쓴다
2. `Personalities.json` 186항목 중 **2건이 인격이 아니다** — 베르길리우스(`9999`)와 스킨(`40501`)
3. **id 대역이 넷**이다 — `1xxxx` 인격 · `4xxxx` 스킨 · `4xxxxx` 이벤트 유닛 · `9999` 조력
4. `nameWithTitle` 은 사실상 `name` 의 중복이다
5. `40501` 의 `desc` 에 대괄호가 깨져 있다 — 원본 오타
6. `loc-en` 에 `Personalities-a1c9p2.json` 이 없다 (ko·ja 는 빈 파일)
7. `Personality_Get_Condition` 은 **획득 조건이 아니라 이야기 해금 조건**이다

## 미해결

없다. 4파일 × 3로케일 전부 확정했다.

### 우리가 쓰지 않는 것

```
Personalities.json          mj titleKo 를 쓰므로 미사용
Personality_Get_Condition   전량 미사용 — 담을 자리가 없다
Personalities-x1p1c1        미사용 — 이벤트 유닛은 엔티티 밖
Personalities-a1c9p2        빈 파일
```

## 근거 재현

```
data/entities/identities/loc-ko/Personalities.json                 186항목
data/entities/identities/loc-ko/Personality_Get_Condition.json     344항목
data/entities/identities/loc-ko/Personalities-x1p1c1.json          12항목
data/entities/identities/loc-en/** · loc-ja/**                     로케일 대조
data/entities/identities/limbus-data-mj/identities.json            titleKo 정규화 확인
data/entities/identities/limbus-assets/identities.json             인격 184 대응
```
