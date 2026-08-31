# 순위 표본 다시 짜기 (v2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** 합법 편성 11덱을 짜고, 덱마다 기프트 30장을 **신호가 엇갈리는 것 위주로** 골라, 합성 관계를 명시한 판정 페이지를 낸다.

**Architecture:** v1 의 셈(`fit.ts`·`pairs.ts`·`grid.ts`)은 그대로 쓴다. 바뀌는 것은 **무엇을 보여 줄지** — 편성 짜기(`squad.ts`), 합성 관계(`fusion.ts`), 고르기(`pick.ts` 재작성), 그리고 페이지다.

**Tech Stack:** TypeScript · Prisma(PostgreSQL) · node:test · tsx · 자기완결 HTML

## 왜 다시 짜나

사용자가 v1 표본을 보고 세 가지를 잡았다. **셋 다 게임 규칙을 내가 안 넣어서 생긴 것이고, 표본을 못 쓰게 만든다.**

```
① 편성이 불가능하다
   수감자당 인격 하나인데 안 넣었다. 덱 C 는 이상이 10명이었다 — 덱이 아니다

② 합성 결과물을 「집으라」고 물었다
   진혼·달의 기억은 만드는 것이지 집는 것이 아니다. 둘 다 공통에 있었다
   하위를 집는 데엔 상위를 만들려는 목적이 있는데 그것이 화면에 없었다

③ 고르기가 쉬운 것만 낸다
   등급·키워드·전용·켜짐을 고르게 덮으니 대부분이 자명한 판정이라
   저울추가 안 좁혀진다
```

## Global Constraints

- **`lib/engine/v2` 를 한 줄도 고치지 않는다.** 읽고 부르는 것은 된다.
- **편성은 수감자당 인격 하나.** 12칸 = 서로 다른 수감자 12명. `canonical.identity.sinner_id` 로 판정한다.
- **합성 결과물 60건은 후보에서 뺀다.** `canonical.fusion_slot.gift_id` 에 있는 것들이다. 집을 수 없다.
- **재료 기프트는 무엇을 만드는지 함께 보인다.** 「▸ 진혼(4등급)의 재료 · 함께 필요: …」
- **덱마다 30장을 10/10/10 으로 나눈다** — 확실히 좋다 · 확실히 아니다 · 엇갈린다.
- **인격은 `title` + `name` 으로 적는다** — 「검계 살수 이상」. `name` 만 쓰면 수감자 이름이라 인격이 안 구별된다. `title` 안에 줄바꿈이 있으니 공백으로 바꾼다.
- `scripts/` 안에서는 값 import 도 `.js` 를 붙인다.
- 모든 주석·화면 문구·커밋 메시지는 한국어. 무엇을 하는지가 아니라 왜 그런지를 적는다.
- 들여쓰기는 탭.
- `package.json` 은 `scripts` 객체에 줄을 더하는 것 외에 건드리지 않는다.
- **타입 검사는 파일을 직접 지목한다** (`tsconfig.json` 의 `include` 가 `scripts/` 를 안 덮는다):
  `npx tsc --noEmit --strict --module nodenext --moduleResolution nodenext --target es2022 <파일들>`
- `npm test` 가 `scripts/rank/*.test.ts` 를 포함한다 — 새 검사도 자동으로 걸린다.

---

## 덱 열하나

| 덱 | 이름 | 주력 |
|---|---|---|
| 1~7 | 화상 · 열상 · 파열 · 호흡 · 진동 · 침잠 · 충전 | 그 축 |
| 8~10 | 참격 · 관통 · 타격 | 그 공격 타입 |
| 11 | 방향이 안 잡힌 편성 | 없음 — 1~2층 상태 |

축 일곱은 전부 12수감자를 채울 수 있고(충전 11), 공격 타입 셋도 12다(실측 2026-08-18).

**덱 11 이 「적합도가 없을 때 등급이 얼마나 말하는가」를 답한다.** v1 의 덱 C 자리인데, 이번엔 이름과 상황이 있다 — 실제 플레이에서 1~2층은 아직 방향이 안 잡힌 상태다.

---

### Task 1: 합법 편성 짜기

**Files:**
- Create: `scripts/rank/squad.ts`
- Test: `scripts/rank/squad.test.ts`

**Interfaces:**
- Produces:
  - `interface Identity { id: string; sinnerId: string; name: string; title: string }`
  - `buildSquad(pool: Identity[], prefer: (id: string) => number, size?: number): Identity[]`
  - `labelOf(i: Identity): string` — 「검계 살수 이상」

**규칙:** `prefer` 가 큰 인격부터 집되, **한 수감자에서 하나만** 집는다. 12명이 안 차면 나머지 수감자에서 `prefer` 가 가장 큰 인격으로 메운다. 무작위 금지 — 같은 입력이면 같은 답이어야 한다. 동점이면 `id` 순.

- [ ] **Step 1: 검사를 쓴다**

`scripts/rank/squad.test.ts` — 다음을 못 박는다.

```
같은 수감자를 두 번 안 넣는다      ← 가장 중요하다. v1 이 이걸 어겨 덱이 아니었다
prefer 가 큰 인격을 먼저 집는다
12명이 안 차면 남은 수감자로 메운다
못이 12수감자보다 작으면 있는 만큼만 낸다
같은 입력이면 같은 답이 나온다
labelOf 가 title 의 줄바꿈을 공백으로 바꾼다
```

고정물은 수감자 3~4명 × 인격 2~3개로 손수 만든다. **한 수감자에 인격이 여럿인 못**이어야 규칙이 검사된다.

- [ ] **Step 2: 실패를 확인한다** → `npx tsx --test scripts/rank/squad.test.ts`
- [ ] **Step 3: 구현한다**
- [ ] **Step 4: 통과를 확인한다**
- [ ] **Step 5: 되돌려 확인한다** — 수감자 중복 금지를 빼고 돌려 「같은 수감자를 두 번 안 넣는다」가 깨지는지 보고 되돌린다. `git diff` 로 되돌림을 확인한 뒤 커밋한다.
- [ ] **Step 6: 커밋**

---

### Task 2: 합성 관계

**Files:**
- Create: `scripts/rank/fusion.ts`
- Test: `scripts/rank/fusion.test.ts`

**Interfaces:**
- Produces:
  - `interface Recipe { result: string; slots: string[][] }` — 칸마다 후보 여럿(선택지형)
  - `interface FusionRole { madeOnly: boolean; makes: Array<{ result: string; withOthers: string[] }> }`
  - `fusionRolesOf(recipes: Recipe[]): Map<string, FusionRole>`

**규칙:**
- `madeOnly` — 이 기프트가 어떤 레시피의 **결과물**이면 참. **후보에서 뺀다.**
- `makes` — 이 기프트가 재료로 쓰이는 상위 기프트들. `withOthers` 는 그 레시피에서 **함께 필요한 다른 재료**들이다(자기 자신은 뺀다).
- 레시피가 여럿인 결과물(진혼은 2개)은 `makes` 에 여러 번 들어갈 수 있다 — 중복 결과물은 하나로 접되 `withOthers` 는 **첫 레시피 기준**으로 적고, 레시피가 여럿이라는 사실은 호출자가 알 수 있게 한다.

- [ ] **Step 1: 검사를 쓴다** — 손으로 만든 레시피 셋으로 다음을 못 박는다.

```
결과물은 madeOnly 다
재료는 makes 에 상위와 함께 필요한 것을 담는다
자기 자신은 withOthers 에 안 들어간다
선택지형 칸의 후보 전부가 재료로 잡힌다
재료이면서 동시에 결과물인 중간 기프트(요리 비법 전서 꼴)를 둘 다로 답한다
레시피가 없는 기프트는 madeOnly 거짓 · makes 빈 배열
```

- [ ] **Step 2~4: 실패 → 구현 → 통과**
- [ ] **Step 5: 커밋**

---

### Task 3: 고르기 다시 — 세 무더기

**Files:**
- Rewrite: `scripts/rank/pick.ts`
- Rewrite: `scripts/rank/pick.test.ts`

**Interfaces:**
- Consumes: Task 2 의 `FusionRole`, 기존 `fitOfKeyword`·`tierOf`·`inVocabulary`
- Produces:
  - `type Stratum = '확실히 좋다' | '확실히 아니다' | '엇갈린다'`
  - `interface Picked { card: GiftCard; stratum: Stratum; why: string }`
  - `pickThirty(pool: GiftCard[], supply: DeckSupply, roles: Map<string, FusionRole>, avoid: ReadonlySet<string>): Picked[]`

**갈래 판정** (`fit` 은 `fitOfKeyword`, `t` 는 `tierOf`):

```
확실히 좋다     fit ≥ 0.5 이고 t ≥ 0.75 이고 켜진다
확실히 아니다    fit = 0 이고 t ≤ 0.25
엇갈린다        아래 넷 중 하나
                 t ≥ 0.75 이고 fit = 0          고등급인데 축 불일치
                 t ≤ 0.25 이고 fit ≥ 0.5        저등급인데 축 일치
                 t ≤ 0.25 이고 상위 합성 재료다   재료를 집을 값어치가 있나
                 전용인데 t ≤ 0.25              전용 프리미엄이 실재하나
```

**규칙:**
- 무더기마다 10장. 한 무더기가 모자라면 **채우지 말고 있는 만큼** 내고, 호출자가 그 사실을 보고한다. **다른 무더기로 메우지 않는다** — 그러면 무더기의 뜻이 사라진다.
- 엇갈림 안에서는 **네 갈래를 돌아가며** 집는다(라운드 로빈). 한 갈래가 10장을 다 먹으면 안 된다.
- `avoid` 는 앞 덱들이 쓴 것. 피하되 없으면 그냥 쓴다(v1 과 같은 규칙).
- `why` 에 왜 그 무더기인지 한 줄로 적는다 — 페이지가 그대로 보여 준다.
- 무작위 금지. 같은 입력이면 같은 답.

- [ ] **Step 1: 검사를 쓴다**

```
무더기마다 10장을 낸다
한 무더기가 모자라면 있는 만큼만 낸다 — 다른 무더기로 안 메운다
엇갈림 네 갈래가 고르게 섞인다 (한 갈래가 7장을 넘지 않는다)
합성 결과물은 절대 안 들어간다
avoid 를 피한다 · 피할 것뿐이면 쓴다
같은 못이면 같은 답
「앞에서 서른을 집는 것」과 다르다
```

- [ ] **Step 2~4: 실패 → 구현 → 통과**
- [ ] **Step 5: 커밋**

---

### Task 4: 덱 열하나를 짜서 낸다

**Files:**
- Rewrite: `scripts/rank-deck.ts`

**하는 일:**
1. 인격·수감자·축·공격타입 공급을 DB 에서 읽는다.
2. 덱 열하나를 `buildSquad` 로 짠다. 축 덱은 그 축을 가진 인격을 `prefer` 로, 공격 타입 덱은 그 타입 스킬을 가진 인격을, 방향미정 덱은 **어느 축도 크지 않게** 고른다.
3. 합성 결과물을 후보에서 뺀다. `fusionRolesOf` 로 재료 정보를 붙인다.
4. 덱마다 `pickThirty` 로 30장을 고르고 `used` 로 겹침을 줄인다.
5. `src/v2/authored/gift-rank-candidates.json` 으로 낸다. 카드마다 `stratum`·`why`·`fusion` 을 담고, 덱마다 **출격 7인과 대기 5인의 이름**을 담는다.

**관문 — 스크립트가 스스로 세어 낸다:**

```
덱마다 서로 다른 수감자 12명           ← 어기면 덱이 아니다
덱마다 주력 키워드 공급이 1위다         방향미정 덱은 축 최댓값 ≤ 3
덱마다 무더기가 10/10/10 이다          모자라면 그 수와 이유를 찍는다
합성 결과물이 한 장도 안 들어갔다
덱 통틀어 서로 다른 기프트 수와 덱쌍 겹침
```

- [ ] **Step 1: 구현한다**
- [ ] **Step 2: `npm run rank:deck` 을 돌려 관문을 눈으로 확인하고 수치를 보고서에 적는다**
- [ ] **Step 3: 커밋**

**어긋나면 문턱을 낮추지 말고 수치와 함께 보고한다.** 특히 수감자 12명은 게임 규칙이라 타협할 수 없다.

---

### Task 5: 페이지 다시

**Files:**
- Modify: `scripts/rank-page.ts`

**바뀌는 것:**

1. **덱 머리에 인격 이름을 적는다.**
```
덱 3 · 파열 덱
출격  검계 살수 이상 · 새벽 사무소 해결사 파우스트 · …
대기  … (5명)
축 BURST 6 · LACERATION 2 …  |  공격 slash 4 · blunt 2 · pierce 1
```

2. **카드를 세 무더기로 나눠 보인다.** 「아직 안 정함」 칸 안에서 소제목으로 가른다.
```
확실히 좋아 보이는 것 10
애매한 것 10          ← 여기가 핵심입니다, 라고 화면에 적는다
확실히 아닌 것 10
```

3. **합성 재료면 카드에 적는다.**
```
재에서 재로            1등급 · 화상 · 공용
(설명문 전문)
▸ 진혼(4등급) 의 재료 · 함께 필요: 먼지에서 먼지로 · 요리 비법 전서
```

4. 머리글 안내를 고친다 — 30장 × 11덱 = 330판정, 합성 결과물은 애초에 안 나온다는 것, 애매한 무더기가 가장 중요하다는 것.

**그대로 두는 것:** 네 판정 칸과 sticky · 끌어놓기 · `localStorage` 저장·복원 · 내보내기 형식 · 자기완결(외부 요청 0).

- [ ] **Step 1: 구현한다**
- [ ] **Step 2: 만들어서 HTML 을 직접 읽어 확인한다**

```
덱 11 · 카드 330 · 덱마다 무더기 소제목 셋
인격 이름이 출격/대기로 나뉘어 보인다
합성 재료 카드에 ▸ 줄이 있다
합성 결과물 이름(진혼·달의 기억)이 카드로는 안 나온다
외부 요청 0 · None 0 · setData 1 · localStorage 있음
내보내기 형식이 {"deck":…,"giftId":…,"bucket":…} 그대로다
```

- [ ] **Step 3: 커밋**

---

### Task 6: 저울추 쪽 맞추기

**Files:**
- Modify: `scripts/fit-weights.ts`

**바뀌는 것:** 덱이 3개에서 11개가 되므로 갈래별 확인(leave-one-out)이 11갈래가 된다. 표를 그대로 두되 **무더기별 정확도**를 함께 낸다 — 「엇갈린 10장을 몇 개나 맞혔나」가 「전체 정확도」보다 훨씬 말이 된다.

```
갈래   맞춘 쪽    확인 쪽    동점    적합 몫    등급 몫    전용 몫
…
무더기별 정확도
  확실히 좋다    나/다
  확실히 아니다   나/다
  엇갈린다      나/다      ← 이 수가 이 표본의 값어치다
```

- [ ] **Step 1: 구현한다**
- [ ] **Step 2: 가짜 표본으로 돌려 무더기별 줄이 나오는지 확인한다**
- [ ] **Step 3: 커밋**

---

## 이 계획이 안 하는 것

- **`lib/engine/v2` 를 안 고친다.** 합성 재료 중복 획득 불가를 **추천 엔진에 반영하는 것**은 별도 회차다 — 지금은 표본에서만 다룬다.
- **저울추를 안 정한다.** 사람이 판정한 뒤다.
- v1 의 40판정(`src/v2/authored/gift-rank.jsonl`)은 **버린다.** 불가능한 편성에서 매긴 것이라 뜻이 없다. 파일은 비운다.
