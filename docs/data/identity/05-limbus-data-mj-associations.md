# 회차 5 — `limbus-data-mj/associations.json`

> **정본** · 조직 · **64건** · 5.0 KB · 최상위 **객체**(키 = 조직 코드) · 값 키 **2종**
> 출처 커밋 `97c38567` · 스냅샷 2026-07-25 · 정리 2026-07-30

## 파일 정체

인격 편에서 **가장 작은 파일**이고 구조도 가장 단순하다. 조직 코드를 키로 두고
영문·한국어 이름만 갖는다.

```
ATL                    기술해방연합    Technology Liberation Alliance
BLACK_BEAST_RABBIT     흑수 - 묘      Heishou Pack - Mao Branch
BLADE_LINEAGE          검계          Blade Lineage
DAWN                   새벽 사무소     Dawn Office
```

**적재되는 값이 하나도 없다.** `affiliation.id` 는 `limbus-assets` 의 영문 표기를 쓰고,
`affiliation_text.name` 은 `loc-*/AssociationName.json` 에서 온다. 이 파일은
**회차 1의 `associations` 필드가 가리키는 코드의 사전**이라 어휘 대조에만 쓰인다.

### 대조한 출처

| 출처 | 무엇을 대조했나 |
| --- | --- |
| `limbus-data-mj/identities.json` | `associations` 필드가 쓰는 코드 64종 |
| `limbus-assets/identity_tag_list.json` | 태그 95항목(마크업 제거 후 93종)과 어휘 차이 |
| `limbus-assets/identities.json` | `tags` — 계층 표현 방식 |
| `loc-*/AssociationName.json` | 표시 문자열의 실제 출처 |

---

## 조직 코드 (객체 키)

| | |
| --- | --- |
| 타입·실측 | `String` · 64건 · **전부 `UPPER_SNAKE`** · `_` 포함 49건 |
| 의미 | 조직 식별 코드 |
| 변환 | — |
| 적재 | **미적재** — `affiliation.id` 는 `limbus-assets` 의 영문 표기(`Blade Lineage`)를 쓴다 |
| 화면 | 미표시 |
| 함정 | 계층이 구조가 아니라 **접두사 문자열에만** 있고, 접두사로 자르면 틀린다 |

### 계층이 접두사에만 있다

```
접두사 그룹 (2개 이상)

BLACK (6)
  BLACK_BEAST_CHICKEN   흑수 - 유      Heishou Pack - You Branch
  BLACK_BEAST_HORSE     흑수 - 오      Heishou Pack - Wu Branch
  BLACK_BEAST_RABBIT    흑수 - 묘      Heishou Pack - Mao Branch
  BLACK_BEAST_SHEEP     흑수 - 미      Heishou Pack - Wei Branch
  BLACK_BEAST_SNAKE     흑수 - 사      Heishou Pack - Si Branch
  BLACK_CLOUD           흑운회        Kurokumo Clan          ← 무관한 조직

LIMBUS (6)
  LIMBUS_COMPANY        림버스 컴퍼니    ← 상위가 항목으로 있다
  LIMBUS_COMPANY_LCA/LCB/LCC/LCD/LCE

RING (4)
  RING_FINGER           약지          ← 상위가 항목으로 있다
  RING_FINGER_FAUVISM      야수파      School of Fauvism
  RING_FINGER_PHYSICAL     신체파      School of Corporism
  RING_FINGER_POINTILLISM  점묘파      School of Pointillism

N (2)     N_CORP  N사   ·  N_CORP_FNATIC  N사 광신도
OUFI (2)  OUFI  외우피 협회  ·  OUFI_COOP  협력 사무소 - 외우피   ← 상위 관계 아님
```

**접두사로 자르면 틀린다.**

| 접두사 | 상위가 항목으로 있나 | 판정 |
| --- | --- | --- |
| `LIMBUS` | `LIMBUS_COMPANY` 있음 | 계층 성립 |
| `RING` | `RING_FINGER` 있음 | 계층 성립 |
| `N` | `N_CORP` 있음 | 계층 성립 |
| `BLACK` | **없음** | 흑수 분파 5 + 무관한 흑운회 1 |
| `OUFI` | `OUFI` 있으나 | `OUFI_COOP` 는 하위가 아니라 별개 조직 |

**어느 출처도 계층 구조를 담지 않는다.** `limbus-assets` 는 인격마다 상위·하위 태그를
**둘 다 붙여** 표현하며(회차 1에서 12/12 쌍 전수 일치 확인), 그래서 축 분리가 불필요하다는
결론이 났다(`../../backlog/01-identity-tags.md`).

---

## `name` / `nameKo` — 조직명

| | |
| --- | --- |
| 타입·실측 | `name` **64/64** · `nameKo` **59/64** · `name === nameKo` **0건** |
| 마크업 | **0건** |
| 변환 | — |
| 적재 | **미적재** — `affiliation_text.name` 은 `loc-*/AssociationName.json` 에서 온다 |
| 화면 | 미표시 |
| 함정 | 없음 |

### `nameKo` 결손 5건은 결손이 아니다

```
LIMBUS_COMPANY_LCA   name="LCA"
LIMBUS_COMPANY_LCB   name="LCB"
LIMBUS_COMPANY_LCC   name="LCC"
LIMBUS_COMPANY_LCD   name="LCD"
LIMBUS_COMPANY_LCE   name="LCE"
```

**5건 전부 알파벳 약어**다. 한국판도 `LCB` 로 표기하므로 번역할 것이 없다.
회차 1의 `11215` `"LCE E.G.O:: AEDD"`, 회차 3의 `"AEDD"` · `"Furioso-Replica"` 와 같은 계열이다.

이 5개가 실제로 쓰이는 자리:

```
LCB   회차 1의 `LCB 수감자` 12명
LCE   `LCE E.G.O::` 계열 인격 (10111 초롱 · 10116 차원찢개 · 11215 AEDD 등)
LCD   10815 `LCD 현장추리팀`
```

### 마크업 0건 — 스포일러 처리를 하지 않는다

```
limbus-assets/identity_tag_list.json   "<color=#d40000><s>Great Sister</s></color>"   5건
limbus-data-mj/associations.json       0건
```

mj는 스포일러 취소선이 붙는 태그(`Great Sister` · `Jia Family` · `Maestro` ·
`Sottocapo` · `Le Sette Famiglie`)를 **애초에 담지 않는다.** 회차 1·2에서 확인한 것과 맞는다 —
mj의 64종은 순수 조직 목록이고, 계급·이력은 `identities_detail.json` 의 `unitKeywords` 에 있다.

---

## 함정 요약

1. **계층이 접두사 문자열에만 있고 구조가 없다.** 접두사로 자르면 `BLACK_CLOUD`(흑운회)가 흑수 분파로 묶인다
2. `nameKo` 결손 5건은 **알파벳 약어**라 정상이다
3. 이 파일의 값은 **하나도 적재되지 않는다.** 어휘 대조용이다
4. mj는 **스포일러 마크업을 담지 않는다** — 해당 태그 자체가 없다

## 미해결

없다. 64건 전부 확인했다.

## 근거 재현

```
data/entities/identities/limbus-data-mj/associations.json         조직 64건
data/entities/identities/limbus-data-mj/identities.json           associations 필드
data/entities/identities/limbus-assets/identity_tag_list.json     태그 95항목
data/entities/identities/loc-ko/AssociationName.json              표시 문자열 (회차 13)
```
