# `atkTypes` 라는 이름이 세 곳에서 다른 것을 가리킨다

> 상태: 미착수 / 확인 2026-07-29
> 데이터 마스터북 회차 1(`limbus-data-mj/identities.json`) 인터뷰에서 확인했다.
> **동작 오류는 아니다.** 읽는 사람이 단위를 오해할 여지와, 원본이 가진 정보를 버리는 지점이다.

## 1. 세 개의 `atkTypes`

| # | 자리 | 값 예 | 단위 |
| --- | --- | --- | --- |
| ① | `limbus-data-mj/identities.json` 원본 | `{"slash": 2, "pierce": 1}` | **스킬 개수** |
| ② | `lib/engine/load.ts:37` → `Identity.atkTypes` | `["slash", "pierce"]` | **타입 종류** |
| ③ | `lib/engine/state.ts:94` → `DeckFeature.atkTypes` | `{"slash": 3, "blunt": 2}` | **인격 수** |

①과 ③은 타입까지 같다(`Record<string, number>`). 모양으로는 구분되지 않는다.

같은 인격으로 보면 이렇다.

```
10101 LCB 수감자 (이상)
  ①  {slash: 2, pierce: 1}   참격 스킬 2개 · 관통 스킬 1개
  ②  ["slash", "pierce"]     참격도 쓰고 관통도 쓴다
  ③  slash 에 +1, pierce 에 +1 기여
```

## 2. 엔진 안에 이미 규칙이 있다

`DeckFeature` 의 형제 필드는 "인격 수"를 셀 때 `Supply` 접미사를 쓴다.

```ts
interface DeckFeature {
  statusSupply: Record<string, number>;   // 그 상태를 주는 인격 수
  sinSupply:    Record<string, number>;   // 그 죄악 스킬을 가진 인격 수
  atkTypes:     Record<string, number>;   // ← 같은 뜻인데 이름만 다르다
}
```

**`atkTypes` 만 규칙 밖이다.**

## 3. 고칠 것

| 자리 | 지금 | 바꾼 뒤 |
| --- | --- | --- |
| `DeckFeature` | `atkTypes` | **`atkTypeSupply`** — 형제 필드와 규칙 일치 |
| `Identity` | `atkTypes` | 그대로 (배열이라 혼동이 없다) |
| `dsl.ts:111` 근거 문구 | `` `${atkType} 스킬 ${n}명` `` | `` `${atkType} 인격 ${n}명` `` — `n` 이 인격 수인데 "스킬 n명"으로 읽힌다 |

`sins` / `sinSupply` 도 같은 쌍이므로 함께 확인한다.

## 4. 버려지는 정보 — 별개 사안

`load.ts:37` 이 `new Set` 으로 중복을 지운다. 그래서 다음 둘이 편성 판정에서 같아진다.

```
A 인격  {blunt: 3}             타격 스킬 3개
B 인격  {blunt: 1, slash: 2}   타격 스킬 1개

②  A → ["blunt"]   B → ["blunt", "slash"]
③  둘 다 blunt 에 +1
```

**원본 ①은 이 차이를 알고 있으나 우리는 버린다.**

지금은 문제가 없다. `ATTACK_TYPE_USED`(`dsl.ts:108`)가 "그 타입을 쓰는 인격이 있나"만 묻기
때문이다. **공격 타입의 횟수나 비중을 요구하는 기프트가 나오면** 그때 스킬 단위 집계가 필요해진다.

그 시점에는 ①을 적재할 필요가 없다 — `skill` 테이블에 `atkType` 이 이미 있으므로 조인으로
같은 수를 얻는다(원칙 2: 파생 값을 저장하지 않는다).

## 5. 미루는 이유

이름 변경은 동작을 바꾸지 않고, 지금 오작동도 없다. `affiliation → trait` 개명
(`01-identity-tags.md` 7.1)과 성격이 같으므로 **그 작업에 얹어 한 번에 처리한다.**
