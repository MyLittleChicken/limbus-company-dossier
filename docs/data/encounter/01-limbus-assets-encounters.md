# 회차 1 — `encounters/limbus-assets/*.json`

> **인카운터** · `limbus-assets` · **251개 파일** · 최상위 키 **6종**
> 출처 커밋 `774883d7` · 스냅샷 2026-07-25 · 정리 2026-07-31
> **인카운터 편(회차 1–4)의 첫 회차 · 마스터북 마지막 편**

## 파일 정체

전투 조우다. **파일명이 거울 던전 편 회차 4의 `콘텐츠|키` 체계**이며 `|` 를 `__` 로 바꿨다.

```
luxcavation__18-pierce.json   ↔   encounters.json 의 "luxcavation" → "18-pierce"
```

| 접두 | 파일 | 사전(`encounters.json`) |
| --- | ---: | ---: |
| `story` | 113 | 113 |
| `md` | **82** | 79 |
| `luxcavation` | 50 | 50 |
| `reflectrial` · `rr` | 3 + 3 | 3 + 3 |

```
파일 251 ↔ 사전 248        교집합 248 · 사전에만 0
파일에만 3   md|railway-5-a · md|railway-5-b · md|railway-5-c
```

**거울 던전 편 회차 4의 「md 79종 중 4종은 어느 팩도 참조하지 않는다」와 맞물린다.**
사전에 없는 3개는 굴절 열차 5층의 변형이다.

---

## 1. 최상위 4종이 **완전히 배타적**이다

```
targets  152   ·  waves 59  ·  battles 27  ·  phases 13        합 251
```

`name` · `siteId` 는 251건 전부 갖는다. 네 구조가 **한 파일에 하나씩만** 온다.

| 구조 | 뜻 |
| --- | --- |
| `targets` | 단일 전투 |
| `waves` | 웨이브 여러 개 |
| `battles` | 전투 여러 개(각각 `targets` 또는 `waves`) |
| `phases` | 단계 전환(보스) |

### `siteId` 가 1건 중복이다

```
a268e619-…   md__railway-5-a  ·  md__railway-5
```

UUID 250/251. **변형본이 원본의 id 를 그대로 가져갔다.**

## 2. `targets` — 1,337개 · 유일 이름 394

```
키   name 1337 · portrait 1337 · passives 1193 · skills 1180 · parts 1055
     num 393 · resists 287 · egoList 122 · identityOverride 122
```

### `resists` 는 **10축**이다

```
blunt · pierce · slash + wrath · lust · sloth · gluttony · gloom · pride · envy
287/287 전부 10축
```

> **적은 공격 타입과 죄악 저항을 둘 다 갖는다.**
> 인격은 공격 타입 3축, E.G.O 는 죄악 7축이었다(`docs/09-resistance.md`).

값이 10종으로 인격·E.G.O 보다 잘게 나뉜다.

```
1 : 2082 · 0.75 : 218 · 2 : 207 · 1.5 : 134 · 0.5 : 107 · 1.25 : 61
1.2 : 34 · 0.8 : 21 · 1.6 : 4 · 0.6 : 2
```

`0.6` · `0.8` · `1.2` · `1.6` 은 **인격·E.G.O 에 없던 값**이다.

### `identityOverride` 122건 — **인격이 적으로 나온다**

```
"Refracted Peccatulum Invidiae?"   identityOverride 10302 · 10703 · 10405 …
유일 69종 · 전부 인격 id (69/69)
```

굴절 열차의 **거울 속 수감자**다. 인격 데이터를 그대로 적 스탯으로 쓴다.

### `egoList` 122건 — E.G.O 83종

```
유일 83 · 전부 E.G.O id (83/83)
```

적이 쓰는 E.G.O 다. **참조 무결성이 완벽하다.**

### `parts` 1,055건 — 부위

```
길이 1개 922 · 2개 89 · 3개 18 · 4개 22 · 5개 4
키   partId · name · defCorrection(1262) · hp · resists · speed(1140) · breakSection(997)
partId 유일 894 · 부위 이름 유일 62
```

**`resists` 가 부위마다 또 있다**(1,140건 · 역시 10축). 몸통과 팔이 다른 저항을 갖는다.

`breakSection` 은 인격 편의 「흐트러짐」 축이다.

## 3. `portrait` — **타입이 섞여 있다**

```
정수 697 · 문자열 640        같은 값이 두 타입으로 온다
정수 유일 276 · 문자열 유일 331 · 합쳐서 유일 458
```

**같은 초상을 어떤 곳은 `1079`, 어떤 곳은 `"1079"` 로 쓴다.** 정규화 없이 조회하면 샌다.

### 애셋은 접미 `_portrait` 를 붙여야 찾는다

```
data/assets/encounters/limbus-assets/   506개 · 전부 {n}_portrait.webp
접미 뗀 유일 506

portrait 458 중 애셋 있는 것 456 · 없는 것 2       ← 1286 · 1307
```

> **여섯 편 만에 처음으로 애셋 결손이 나왔다.**
> 인격 712 · E.G.O 318 · 기프트 476 · 팩 155 · 상태 1,193 은 전부 결손 0이었다.

`1286` · `1307` 두 적의 초상이 없다. 애셋에만 있는 것은 48개다.

---

## 함정 요약

1. 최상위가 **`targets`/`waves`/`battles`/`phases` 배타 4종**이다. 하나만 가정하면 깨진다
2. `portrait` 이 **정수와 문자열로 섞인다**. 문자열로 정규화해야 한다
3. 애셋은 **`_portrait` 접미**가 붙는다. id 로 바로 못 찾는다
4. **`1286` · `1307` 초상이 없다** — 마스터북 첫 애셋 결손
5. `resists` 가 **10축**이다. 인격 3축·E.G.O 7축과 다르다
6. `siteId` 가 **1건 중복**이다(`md__railway-5` / `-a`)

## 미해결

없다. 251개 파일 전부 확정했다.

### 이월 확인 1건

- ✔ **거울 던전 편 회차 4** `encounters.json` 사전 248종 — **파일 251개와 248/248 대응**

## 근거 재현

```
data/entities/encounters/limbus-assets/*.json              251개 · 최상위 6종
data/entities/mirror-dungeon/limbus-assets/encounters.json 248종 대조
data/assets/encounters/limbus-assets/                      506개 · _portrait
data/entities/identities/limbus-data-mj/identities.json    identityOverride 69/69
data/entities/egos/limbus-assets/egos.json                 egoList 83/83
```
