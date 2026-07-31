# 회차 2 — `limbus-data-mj` 메카닉 소파일 3종

> `keywords.json` 10종 · `sins.json` 7종 · `terms.json` **483종**
> 출처 커밋 `774883d7` · 스냅샷 2026-07-25 · 정리 2026-07-31

세 파일 다 작지만 **마스터북 전편이 계속 참조해 온 사전들**이다.

---

## 1. `keywords.json` — 기믹·공격 타입 10종

```json
{ "burn": { "name": "Burn", "order": 0 }, … "blunt": { "name": "Blunt", "order": 9 } }
```

```
order 0–9   burn · bleed · tremor · rupture · sinking · poise · charge · slash · pierce · blunt
```

**기프트 편 회차 1의 `keyword` 어휘와 집합이 정확히 같다**(예외 0).

```
기믹 7      burn bleed tremor rupture sinking poise charge      order 0–6
공격 타입 3  slash pierce blunt                                  order 7–9
```

`order` 가 **기믹 먼저, 공격 타입 나중**으로 정렬한다. 회차 7 로케일의 `EgoGiftCategory`
(기프트 편)가 여기에 `Random` · `None` 을 더해 12종이 됐다.

> `08-gimmick-keywords.md` 의 **기믹 축 10종**(`ammo` · `protection` · `bloodfeast` 포함)과
> 다르다. 이 파일이 **원본 어휘**이고, 08 문서의 10종은 우리가 세운 분류다.

**적재** — `Keyword` 테이블.

## 2. `sins.json` — 죄악 7종 + 색

```json
{ "wrath": { "name": "Wrath", "nameKo": "분노", "attribute": "CRIMSON", "order": 0 }, … }
```

마스터북에서 **가장 많이 쓴 사전**이다.

| 편 | 쓰임 |
| --- | --- |
| E.G.O 회차 2 | `requirements` 색 토큰 → 죄악 (110/110) |
| 기프트 회차 2 | `attributeType` → `sin` (441/441) |
| 기프트 회차 3 | assets `affinity` 되바꾸기 실패 4건 판정 |

`order` 0–6 은 `wrath · lust · sloth · gluttony · gloom · pride · envy` 로
**게임 UI 의 죄악 아이콘 순서**다(E.G.O 편 회차 3 화면 대조에서 확인).

## 3. `terms.json` — **한국어 토큰 사전 483종**

```json
{ "AlcoholKimPersonal": { "name": "Liferender", "nameKo": "절명" }, … }
```

키는 `name` · `nameKo` 둘뿐이며 **482/483 이 한국어를 갖는다**
(`TabExplain` 1건만 빈 객체).

### `statuses.json` 과의 관계

```
terms 483 = statuses 와 겹치는 435 + terms 에만 48
statuses 1,472 중 terms 가 덮는 것 435 (29.6 %)

영문명 일치   435 / 435      예외 0
```

**`limbus-assets/statuses.json` 은 영문만 갖고 `terms.json` 이 한국어를 준다.**
겹치는 435건의 영문명이 완전히 같아 두 사전이 어긋나지 않는다.

다만 **1,037종은 한국어가 없다**(70 %). 상태 이름을 한국어로 보여주려면
로케일 파일(회차 3–5)이 필요하다.

### `terms` 에만 있는 48건은 상태가 아니다

| 분류 | 건수 | 예 |
| --- | ---: | --- |
| 발동 시점 | 20 | `BeforeAttack` · `OnSucceedAttack` · `EndSkill` |
| 금지 | 3 | `CantIdentify` · `CantChangeTarget` · `CantDuel` |
| 기타 | 25 | `AllyKill` · `CriticalActivated` · `DefeatDuel` |

**`[OnSucceedAttack]` 처럼 스킬 설명에 박히는 토큰**이다. 인격 편 회차 3의 코인 효과
문자열, E.G.O 편 회차 7의 대괄호 토큰 169종이 여기서 표시명을 얻는다.

### `AlwaysUseEGOPassive` 가 여기 있다 — **E.G.O 편 회차 5 정정**

```
AlwaysUseEGOPassive2010911   "[로보토미 E.G.O::엄숙한 애도 이상 전용 상시 효과]"
AlwaysUseEGOPassive2050911   "[검계 우두머리 뫼르소 전용 상시 효과]"
WhenUseEGOPassive            "[사용 효과]"
```

E.G.O 편 회차 5에서 이 토큰을 보고 **"패시브 id 가 붙는 동적 토큰이라 고정 키
치환표로는 안 잡힌다"** 고 썼다. **틀렸다.**

> **동적 생성이 아니라 사전에 개별 항목으로 등재돼 있다.** 2건뿐이고 둘 다 있다.
> `substituteTokens` 가 정상적으로 치환하며 리포트에 뜨지 않는다.

E.G.O 편 회차 5에서 본 게임 화면의 「[검계 우두머리 뫼르소 전용 상시 효과]」가
바로 이 `nameKo` 다.

**적재** — 직접 적재하지 않고 `src/text.ts:160` 이 **토큰 치환표**로 읽는다.

```ts
const terms = readJson('mechanics','limbus-data-mj','terms.json');
const value = locale === 'ko' ? (terms[key]?.nameKo ?? en) : en;
```

---

## 함정 요약

1. `keywords.json` 10종은 **원본 어휘**다. `08-gimmick-keywords.md` 의 10종은 우리 분류이며 다르다
2. `terms.json` 은 `statuses.json` 의 **29.6 %만** 덮는다. 한국어 상태명 대부분이 없다
3. `terms` 에만 있는 48건은 **상태가 아니라 발동 시점·금지 토큰**이다
4. `TabExplain` 1건이 **빈 객체**다

## 미해결

없다. 3파일 전부 확정했다.

### 앞선 편 정정 1건

- ✘ **E.G.O 편 회차 5** "`AlwaysUseEGOPassive{패시브 id}` 는 동적 토큰이라 고정 키
  치환표로는 안 잡힌다" — **틀렸다.** `terms.json` 에 2건이 개별 등재돼 있다

## 근거 재현

```
data/entities/mechanics/limbus-data-mj/keywords.json    10종 · order 0–9
data/entities/mechanics/limbus-data-mj/sins.json         7종 · 색 치환표
data/entities/mechanics/limbus-data-mj/terms.json      483종 · nameKo 482
data/entities/mechanics/limbus-assets/statuses.json   1,472종 대조
data/entities/gifts/limbus-data-mj/gifts.json          keyword 어휘 일치
src/text.ts:160                                        토큰 치환표
```
