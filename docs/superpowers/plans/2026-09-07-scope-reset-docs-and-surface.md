# 범위 재설정 A — 문서 현행화와 제품 표면 정리 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 문서가 「정보 사이트가 제품」이라고 말하고, nav 에 ① 의 화면만 남으며, 편성·추천·용어 화면이 `/lab` 밑에서 그대로 돈다.

**Architecture:** 코드 변경은 라우트 이동(`git mv`)과 nav 상수 축소뿐이다. 엔진·질의·컴포넌트는 한 줄도 안 바뀐다. 문서는 spec §2.4 의 처분표대로 — 00-product 는 다시 쓰고, README 는 낡은 수치를 걷고, 06/07 은 머리에 보류 표시만 얹는다.

**Tech Stack:** Next.js 16 App Router · TypeScript · `node:test` via `tsx --test`

**Spec:** `docs/superpowers/specs/2026-09-07-scope-reset-design.md`

## Global Constraints

- `lib/engine/**` · `lib/queries/**` · `components/**` · `src/**` · `prisma/**` 를 고치지 않는다 (spec §2.3 · §4).
- 문서의 수치는 실측만 적는다. 이 계획이 주는 값: 테이블 114(raw 4 · canonical 100 · app 10) · canonical 검증 222건 · 테스트 파일 56 · 화면 ① 11종.
- 삭제하는 문서 없음. 06 · 07 · backlog 는 머리와 상태만 바꾼다.
- 커밋 제목은 Conventional Commits, 한국어 명사구, 마침표 없음 (README 「커밋·PR 제목 규약」).
- 검증 명령: `npm run typecheck` · `npm test` · `npm run build`. DB 없이 typecheck 와 test 는 돈다. build 는 DB 가 필요 없다(요청 시점 렌더 · `force-dynamic`).
- 브랜치: `docs/scope-reset` 하나. PR 하나로 squash.

---

## 파일 지도

| 파일 | 작업 |
| --- | --- |
| `app/[locale]/squad/page.tsx` → `app/[locale]/lab/squad/page.tsx` | 이동 |
| `app/[locale]/recommend/page.tsx` → `app/[locale]/lab/recommend/page.tsx` | 이동. 내부 href 1곳 수정 |
| `app/[locale]/glossary/page.tsx` → `app/[locale]/lab/glossary/page.tsx` | 이동. 내부 base 1곳 수정 |
| `app/[locale]/lab/layout.tsx` | 신규. 「실험실 — 제품 아님」 머리띠 |
| `lib/ui-text.ts` | `nav` 에서 squad · recommend · glossary 제거. `NAV_SECONDARY` 축소. `LAB` 문자열 추가 |
| `app/[locale]/page.tsx` | 홈의 용어 카드(117~121행) 제거 |
| `rank.html` | 삭제 (untracked) |
| `docs/00-product.md` | v0.3 전면 |
| `README.md` | 머리 · 현재 상태 · 개발 단계 · M1–M7 · 낡은 수치 |
| `docs/05-ui-foundation.md` | §3 화면 목록 |
| `docs/06-recommendation-engine.md` · `docs/07-recommendation-system.md` | 머리 한 단락 |
| `docs/backlog/README.md` · `docs/backlog/13-frontend-data-debt.md` | 상태 |

---

### Task 1: 라우트를 `/lab` 밑으로 옮기고 nav 를 줄인다

**Files:**
- Move: `app/[locale]/squad/page.tsx` → `app/[locale]/lab/squad/page.tsx`
- Move: `app/[locale]/recommend/page.tsx` → `app/[locale]/lab/recommend/page.tsx`
- Move: `app/[locale]/glossary/page.tsx` → `app/[locale]/lab/glossary/page.tsx`
- Create: `app/[locale]/lab/layout.tsx`
- Modify: `lib/ui-text.ts:14-24` (nav 타입) · `:37-47` · `:57-67` (ko/en nav) · `:82-83` (NAV 상수)
- Modify: `app/[locale]/page.tsx:116-121`
- Modify: `app/[locale]/lab/recommend/page.tsx:104` · `app/[locale]/lab/glossary/page.tsx:83`
- Test: `lib/ui-text.test.ts` (신규)

**Interfaces:**
- Produces: `NAV_SECONDARY = ['floors', 'dungeon'] as const`, `LAB: Record<Locale, { title: string; note: string }>`
- `UiText['nav']` 에서 `squad` · `recommend` · `glossary` 키가 사라진다. 이 키를 읽는 곳은 `components/site-nav.tsx`(NAV 상수 경유) 와 홈 카드뿐이다 — 홈 카드는 이 태스크에서 지운다.

- [ ] **Step 1: nav 상수 테스트를 쓴다**

`lib/ui-text.test.ts`:

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NAV_PRIMARY, NAV_SECONDARY, UI, LAB } from './ui-text';

test('nav 에는 정보 사이트 화면만 있다 — squad · recommend · glossary 는 /lab', () => {
	const all = [...NAV_PRIMARY, ...NAV_SECONDARY];
	assert.deepEqual(all, ['identities', 'egos', 'gifts', 'packs', 'floors', 'dungeon']);
	for (const locale of ['ko', 'en'] as const) {
		for (const key of all) assert.ok(UI[locale].nav[key], `${locale}.nav.${key}`);
		assert.ok(LAB[locale].title);
		assert.ok(LAB[locale].note);
	}
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx tsx --test lib/ui-text.test.ts`
Expected: FAIL — `LAB` export 없음(타입 오류) 또는 deepEqual 불일치(`squad` 포함).

- [ ] **Step 3: `lib/ui-text.ts` 를 고친다**

`nav` 인터페이스(14~24행)에서 `squad: string;` · `recommend: string;` · `glossary: string;` 세 줄 삭제.
ko(37~47행) · en(57~67행) 의 `nav` 에서 같은 세 키 삭제.

82~83행을 다음으로 바꾼다:

```ts
export const NAV_PRIMARY = ['identities', 'egos', 'gifts', 'packs'] as const;
export const NAV_SECONDARY = ['floors', 'dungeon'] as const;

/**
 * /lab 머리띠. 편성 · 추천 · 용어는 제품 화면이 아니다 — 범위 재설정
 * (docs/superpowers/specs/2026-09-07-scope-reset-design.md §3.3). 링크하지 않고
 * 주소를 아는 사람만 간다. 코드는 살아 있어야 ④⑤ 재개 때 대조할 것이 있다.
 */
export const LAB: Record<Locale, { title: string; note: string }> = {
	ko: { title: '실험실', note: '제품 화면이 아닙니다. 편성·추천·용어는 범위 재설정으로 보류 중이며 이 주소는 개발 확인용입니다.' },
	en: { title: 'Lab', note: 'Not a product screen. Squad, recommend and glossary are on hold after the scope reset; this address is for development checks.' },
};
```

- [ ] **Step 4: 라우트를 옮긴다**

```bash
mkdir -p 'app/[locale]/lab'
git mv 'app/[locale]/squad' 'app/[locale]/lab/squad'
git mv 'app/[locale]/recommend' 'app/[locale]/lab/recommend'
git mv 'app/[locale]/glossary' 'app/[locale]/lab/glossary'
```

- [ ] **Step 5: 옮긴 화면 안의 자기 주소를 고친다**

`app/[locale]/lab/recommend/page.tsx:104`
```ts
href={`/${locale}/lab/recommend?difficulty=${difficulty}&floor=${f}`}
```

`app/[locale]/lab/glossary/page.tsx:83`
```ts
base={`/${locale}/lab/glossary`}
```

세 페이지가 `UI[locale].nav.squad` 류를 제목으로 읽고 있으면 typecheck 가 잡는다 — 그 자리는 `LAB[locale].title` 이 아니라 각 페이지 안에 한국어/영어 제목을 직접 둔다(예: `ko ? '편성' : 'Squad'`). 지금 그 세 값이 `nav` 에만 있었으므로 옮긴다.

- [ ] **Step 6: `/lab` 레이아웃을 만든다**

`app/[locale]/lab/layout.tsx`:

```tsx
import { notFound } from 'next/navigation';
import { isLocale } from '@/lib/locale';
import { LAB } from '@/lib/ui-text';

/**
 * 실험실 — 제품 표면이 아니다. nav 에서 링크하지 않는다.
 * 범위: docs/superpowers/specs/2026-09-07-scope-reset-design.md §3.3
 */
export default async function LabLayout({
	children,
	params,
}: {
	children: React.ReactNode;
	params: Promise<{ locale: string }>;
}) {
	const { locale } = await params;
	if (!isLocale(locale)) notFound();
	const t = LAB[locale];
	return (
		<>
			<aside className="notice" role="note" aria-label={t.title}>
				<strong>{t.title}</strong> — {t.note}
			</aside>
			{children}
		</>
	);
}
```

`className="notice"` 는 `app/globals.css` 에 이미 있는 고지 스타일을 쓴다. 없으면 `grep -n '\.notice' app/globals.css` 로 확인하고, 없을 때만 `.notice { padding: .75rem 1rem; border: 1px solid var(--line); margin-bottom: 1rem; }` 한 줄을 `globals.css` 끝에 더한다.

- [ ] **Step 7: 홈에서 용어 카드를 지운다**

`app/[locale]/page.tsx:116-121` 의 `<li>…glossary…</li>` 블록 삭제. `counts.statuses` 를 다른 곳에서 안 쓰면 그대로 둔다(`getCounts` 는 안 건드린다 — D0 의 몫).

- [ ] **Step 8: 검증**

Run: `npx tsx --test lib/ui-text.test.ts && npm run typecheck && npm test`
Expected: 전부 PASS. typecheck 가 `nav.squad` 참조 잔여를 잡으면 Step 5 로 돌아간다.

Run: `npm run build`
Expected: 성공. 라우트 목록에 `/[locale]/lab/squad` · `/[locale]/lab/recommend` · `/[locale]/lab/glossary` 가 있고 `/[locale]/squad` 류는 없다.

- [ ] **Step 9: rank.html 삭제와 커밋**

```bash
rm -f rank.html
git add -A 'app/[locale]' lib/ui-text.ts lib/ui-text.test.ts
git commit -m "refactor(web): 편성·추천·용어 화면을 /lab 밑으로 — nav 는 정보 화면만"
```

---

### Task 2: `00-product.md` v0.3

**Files:**
- Modify: `docs/00-product.md` (전면)

- [ ] **Step 1: 파일을 아래 내용으로 바꾼다**

```markdown
# 제품 정의 (Product Definition)

> 상태: v0.3 / 최종 수정 2026-09-07
> v0.2 까지는 팩 추천을 차별점으로 두었다. 2026-09-07 범위 재설정으로 **정보 사이트가 제품**이 됐다
> ([`superpowers/specs/2026-09-07-scope-reset-design.md`](superpowers/specs/2026-09-07-scope-reset-design.md)).
> 기술 선택은 `docs/adr/` 에서 정한다.

## 1. 한 줄 정의

림버스 컴퍼니 **거울 던전**의 인격 · E.G.O · E.G.O 기프트 · 테마 팩 · 층 구성을 게임 표기 그대로
조회·검색하는 정보 사이트. 덱 편성과 거울 던전 트래커는 그 위에 얹는 부가 기능이다.

## 2. 문제 인식

- 인격 · E.G.O · 기프트 · 팩의 정보는 위키와 커뮤니티에 흩어져 있고, 게임 표기와 어긋나거나
  패치를 따라오지 못한 채 남는 경우가 잦다.
- 기프트는 강화 단계(0 / + / ++)와 등장 팩, 팩은 전용 기프트와 층 구간이 함께 보여야 판단이 되는데
  그렇게 묶어 보여주는 곳이 없다.
- 이 프로젝트는 원본 데이터(정본 셋, ADR-04)에서 검증 가능하게 세운 데이터베이스를 갖고 있다
  (테이블 114 · 검증 222건 · 재현 바이트 일치). **그 데이터를 사람이 읽을 수 있는 화면으로 내는 것**이
  지금 제품이다.

## 3. 대상 사용자

거울 던전에 입장 가능한 모든 유저. 용어를 모르는 사용자를 전제하므로 **UI 표기는 게임 내 표기와
1:1 로 대응한다.** 값을 지어내지 않고 결손은 결손으로 표기한다(`02-data-model.md` 6절).

## 4. 제품 구조

```
        게임 패치
            │  (외부 입력 · 지금은 스냅샷 MD7 · 2026-07-25 고정)
            ▼
   ┌──────────────────┐
   │  ① 정보 사이트    │  인격 / E.G.O / 기프트 / 팩 / 거울 던전 / 층    ← 제품
   └────────┬─────────┘
            │ 정적 속성
            ▼
   ┌──────────────────┐
   │  ② 덱 편성        │  서버 저장 · 익명 식별 + Google OAuth 연동 · 덱 코드
   └────────┬─────────┘
            │
     ┌──────┴──────────┐
     ▼                 ▼
 ③ 덱 편성 추천    ④ 트래커 엔진 → ⑤ 거울 던전 트래커        ← 모양 미정
```

## 5. 단계별 범위

| 단계 | 내용 | 상태 |
| --- | --- | --- |
| ① 정보 사이트 | 화면 11종의 조회·검색. 화면 목록과 완료 기준은 `05-ui-foundation.md` 3절과 spec §3 | **진행 중** |
| ② 덱 편성 | 서버 저장 덱. 익명 식별(쿠키) 기본, Google OAuth 로그인은 유실 방지용이며 익명 → 계정 연동이 반드시 있다. 덱 코드 불러오기·복사 | 다음. 설계 전 |
| ③ 덱 편성 추천 | RAG 와 유저 편성 데이터 기반 | **미정** |
| ④ 트래커 엔진 | `lib/engine/v2`(절 단위 켜짐 판정 · 값 모형)가 출발점 | **미정** |
| ⑤ 거울 던전 트래커 | 런 진행 추적과 층별 팩 제시 | **미정** |

옛 단계와의 대응: 옛 1(데이터) 완료 → ① 에 흡수. 옛 2(웹) = ①. 옛 3(엔진) = ④. 옛 4(시스템) = ② + ⑤.

### 데이터 취급

정적 스냅샷(`MD7` · 2026-07-25)을 수동으로 관리한다. 자동 갱신 파이프라인은 범위 밖이다.

### 미정인 것을 지우지 않는다

③④⑤ 의 코드(`lib/engine/v2` · `lib/storage` · `lib/deck-code` · `/lab/*`)는 남긴다. 제품 표면에서만 뺐다.

### 하지 않을 것

- 소셜 기능
- 모바일 네이티브 앱
- 게임 이미지 리소스의 재배포 (`01-data-source.md` 7절)
- 그 외 이 문서에 정의되지 않은 모든 기능

## 6. 성공 기준

- **①**: `05-ui-foundation.md` 3절의 화면 11종이 전부 새 디자인이고, 화면 코드에 데이터층이 모르는 판정 표가 없으며
  (`backlog/13`), nav 에 ① 의 화면만 있다. 옛 2단계 기준 「구축된 데이터 전체를 웹에서 조회·검색할 수 있다」는 유지된다.
- **②**: 덱을 서버에 저장하고, 익명으로 만든 덱을 로그인 뒤 계정에 연동할 수 있으며, 덱 코드로 불러오고 복사할 수 있다.
- **③④⑤**: 정하지 않았다.

## 7. 핵심 리스크

1. **데이터 갱신** — 패치가 누적될수록 스냅샷이 낡는다. 갱신 비용은 ① 이 끝난 뒤 정한다.
2. **공개 서비스 부담** — 2차 창작 정책 · 서버 비용 · 배포 환경 미정(ADR-05 3.5).
3. **② 의 식별 연동** — 익명 → 계정 병합이 틀리면 남의 덱이 붙는다. ② 설계에서 먼저 다룬다.

## 8. 확인이 필요한 전제

- 층별 팩 구간은 데이터로 확인했다(hard 1 · 2 · 3 · 4 · 5 · 6–10 · 11–15, normal 1–5). 게임 클라이언트와 직접 대조하지는 않았다.
- 외부 커뮤니티 덱 코드가 게임 덱 코드와 호환된다는 것은 기대이지 검증된 사실이 아니다 — ② 에서 실물로 확인한다.
```

- [ ] **Step 2: 링크 확인**

Run: `grep -o '\](\.\./[^)]*\|\]([a-z0-9/_.-]*\.md[^)]*' docs/00-product.md | sed 's/^](//' | while read p; do [ -e "docs/$p" ] || echo "MISSING $p"; done`
Expected: 출력 없음.

- [ ] **Step 3: 커밋**

```bash
git add docs/00-product.md
git commit -m "docs(product): v0.3 — 정보 사이트가 제품이다"
```

---

### Task 3: README 현행화

**Files:**
- Modify: `README.md:1-9` · `:118-147` · 낡은 수치 줄

- [ ] **Step 1: 머리(1~4행)를 바꾼다**

```markdown
# limbus-company-dossier

림버스 컴퍼니 **거울 던전**의 인격 · E.G.O · E.G.O 기프트 · 테마 팩 · 층 구성을 게임 표기 그대로
조회·검색하는 정보 사이트. 덱 편성과 거울 던전 트래커는 그 위에 얹는 부가 기능이다.
```

- [ ] **Step 2: 「현재 상태」 첫 단락(8~9행)을 바꾼다**

```markdown
**정보 사이트가 제품이다** (2026-09-07 범위 재설정 —
[spec](docs/superpowers/specs/2026-09-07-scope-reset-design.md)). 데이터층은 끝났고 화면 11종 중 7종이
새 디자인이다. 편성·추천·용어 화면은 `/[locale]/lab/*` 에 남아 있으나 제품 표면이 아니다.
제품의 정의와 범위는 [docs/00-product.md](docs/00-product.md)에 있다.
```

- [ ] **Step 3: 「개발 단계」 절(118~127행)을 바꾼다**

```markdown
## 개발 단계

| 단계 | 내용 | 상태 |
| --- | --- | --- |
| ① 정보 사이트 | 화면 11종의 조회·검색 — 이것이 제품 | 진행 중 (7/11 새 디자인) |
| ② 덱 편성 | 서버 저장 · 익명 식별 + Google OAuth 연동 · 덱 코드 | 설계 전 |
| ③ 덱 편성 추천 · ④ 트래커 엔진 · ⑤ 거울 던전 트래커 | | 미정 |

옛 1~4단계(데이터 · 웹 · 엔진 · 시스템)와의 대응은 [docs/00-product.md](docs/00-product.md) 5절에 있다.
엔진(`lib/engine/v2`)은 절 단위 켜짐 판정과 값 모형(PR #37 · #39)까지 됐고 ④ 재개 때 출발점이다.
```

- [ ] **Step 4: 「데이터베이스 전환 단계 (M1–M7)」 절(129~147행)을 통째로 지우고 한 단락으로 대체**

```markdown
### 옛 M 로드맵

3스키마 전환을 M1–M7 로 부르던 축은 끝났다 — M1~M3 완료, M4 는 PR-A(#28) · PR-B(#39) 로 완료.
M5 는 정의가 없었고 M6(증분 파이프라인) · M7(Neo4j) 은 하지 않는다. 기록은 커밋 이력과
`docs/superpowers/specs/` 에 있다.
```

- [ ] **Step 5: 낡은 수치를 고친다**

`grep -n '52 테이블\|52/52\|40건\|98테이블\|PR-B 미착수' README.md` 로 위치를 찾아:
- 「스키마 | 완료 — 52 테이블」 → 「완료 — 114 테이블 (raw 4 · canonical 100 · app 10)」
- 「검증 스크립트 | 완료 — 40건 …」 → 「완료 — canonical 222건 · raw 13건」
- 표의 「98테이블」 → 「114테이블」
- 「3단계 (추천 엔진) | 기반 엔진과 슬라이스 5종 …」 행 → 「④ 트래커 엔진 (보류) | `lib/engine/v2` — 절 단위 켜짐 판정 · 값 모형 · 골든 1,957/2,437」
- 「2단계 (웹페이지 구축) | 조회·검색 화면 구현 — 화면 16종」 → 「① 정보 사이트 | 화면 11종 · 새 디자인 7 · `/lab` 3」
- 「위 표의 「검증 스크립트 40건」도 그때 수치다 …」 인용 단락 삭제

- [ ] **Step 6: 링크·커밋**

Run: `grep -o '](docs/[^)#]*' README.md | sed 's/^](//' | sort -u | while read p; do [ -e "$p" ] || echo "MISSING $p"; done`
Expected: 출력 없음.

```bash
git add README.md
git commit -m "docs(readme): 범위 재설정 반영 — 수치 현행화 · M 로드맵 정리"
```

---

### Task 4: 05 · 06 · 07 · backlog 상태

**Files:**
- Modify: `docs/05-ui-foundation.md:40-54`
- Modify: `docs/06-recommendation-engine.md:1-3` · `docs/07-recommendation-system.md:1-3`
- Modify: `docs/backlog/README.md:40` · `docs/backlog/13-frontend-data-debt.md:1-4`

- [ ] **Step 1: 05 §3 화면 목록**

`docs/05-ui-foundation.md` 40~54행의 표를 다음으로 바꾼다:

```markdown
## 3. 화면 목록

> 2026-09-07 범위 재설정 — ① 정보 사이트의 화면은 아래 11종이다. `/squad` · `/recommend` · `/glossary` 는
> `/lab/*` 로 옮겼고 제품 표면이 아니다 (spec §3.3).

| 경로 | 화면 | 주 엔티티 | 상태 (2026-09-07) |
| --- | --- | --- | --- |
| `/` | 홈 — 네 엔티티로의 진입과 통합 검색 | — | 구판 |
| `/identities` · `/identities/:id` | 인격 목록 · 상세 | Identity | 완성 |
| `/egos` · `/egos/:id` | E.G.O 목록 · 상세 | Ego | 완성 |
| `/gifts` · `/gifts/:id` | 기프트 목록 · 상세 | Gift | 목록 완성 · 상세 구판 (1순위) |
| `/packs` · `/packs/:id` | 팩 목록 · 상세 | Pack | 목록 완성 · 상세 구판 (2순위) |
| `/floors` | 층별 등장 팩 | FloorPack | 구판 |
| `/dungeon` | 거울 던전 구성 — 층 구조와 은총 | MirrorDungeon · GraceOption | 구판 |
| `/about` | 출처 크레딧과 고지 (10절) | Dataset | 구판 |
| `/lab/squad` · `/lab/recommend` · `/lab/glossary` | 실험실 — 제품 아님 | | 보류 |
```

- [ ] **Step 2: 06 · 07 머리**

두 파일 모두 1행(제목) 바로 아래에 다음 인용을 끼운다(기존 인용은 그대로 둔다):

```markdown
> **보류** (2026-09-07 범위 재설정) — 이 문서의 기능은 ④ 트래커 엔진 · ⑤ 트래커로 번호가 바뀌었고
> 모양이 미정이다. 재개 시 이 문서와 `superpowers/specs/2026-08-*` 를 다시 본다. 화면은 `/lab/*` 에 있다.
> spec: [`2026-09-07-scope-reset-design.md`](superpowers/specs/2026-09-07-scope-reset-design.md)
```

- [ ] **Step 3: backlog 13 승격**

`docs/backlog/README.md:40` 의 상태 칸 「기록 완료 · 이관 미착수」 → 「**① 작업 목록으로 승격** (2026-09-07) — spec §3.2 의 D 번호로 진행. 진척은 그 spec 이 갖는다」.

`docs/backlog/13-frontend-data-debt.md` 의 머리 인용(3행) 아래에 추가:

```markdown
> **2026-09-07 — 미룬 일이 아니라 ① 의 작업 목록이 됐다.** 항목별 번호 D 와 순서는
> [`superpowers/specs/2026-09-07-scope-reset-design.md`](../superpowers/specs/2026-09-07-scope-reset-design.md) §3.2.
> 3번(저주·축복 짝)은 원본 `loc/MirrorDungeonEgoGiftLockedDesc.json` 에 있었다 — 저작이 아니라 미적재였다.
```

- [ ] **Step 4: 커밋**

```bash
git add docs/05-ui-foundation.md docs/06-recommendation-engine.md docs/07-recommendation-system.md docs/backlog/README.md docs/backlog/13-frontend-data-debt.md
git commit -m "docs: 06·07 보류 표시 · 05 화면 목록 11종 · backlog 13 을 작업 목록으로"
```

---

### Task 5: PR

- [ ] **Step 1: 전체 검증**

Run: `npm run typecheck && npm test && npm run build`
Expected: 전부 PASS.

- [ ] **Step 2: PR**

```bash
git push -u origin docs/scope-reset
gh pr create --title "docs: 범위 재설정 — 정보 사이트가 제품이다 · 편성·추천·용어를 /lab 으로" --body "$(cat <<'EOF'
spec: docs/superpowers/specs/2026-09-07-scope-reset-design.md

- 00-product v0.3 · README 현행화 · 05 화면 목록 11종 · 06/07 보류 · backlog 13 승격
- /squad /recommend /glossary → /lab/* (코드 무수정, 라우트 이동) · nav 는 정보 화면만
- rank.html 삭제

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```
