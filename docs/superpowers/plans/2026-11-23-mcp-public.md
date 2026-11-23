# 공개 MCP (조회 + 엔진 판정) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 로그인 없이 쓰는 MCP 서버를 사이트 안 `/mcp` 에 세운다 — 도감 조회 도구와 엔진 판정 도구(덱 코드·인격 목록 입력).

**Architecture:** 도구 정의는 Next.js 에 기대지 않는 `lib/mcp/` 에 두고(`createDossierServer()`), `app/mcp/route.ts` 가 Streamable HTTP(무상태)로 받는다. 도구 핸들러는 `lib/queries/canonical/*` 와 `lib/engine/v2` 만 부르고, `lib/mcp/shape.ts` 가 화면용 결과에서 이미지를 빼고 `siteUrl` 을 붙인다. 모든 응답은 `{ snapshotId, ... }` 봉투에 담긴다.

**Tech Stack:** Next.js 16 route handler · `@modelcontextprotocol/sdk` (TypeScript 공식) · `zod` · Prisma(canonical) · `node:test` + `tsx`.

**Spec:** `docs/superpowers/specs/2026-11-23-mcp-server-design.md` (§10 순서 1 만. §6.4 개인화 · §7 OAuth · §8 ② 는 이 계획 밖)

## Global Constraints

- canonical 읽기 전용. `raw` 스키마를 읽지 않는다. MCP 경로에 쓰기 없음.
- 응답에 이미지 URL · 스프라이트 · 아이콘 경로를 넣지 않는다. 대신 `siteUrl` = `${SITE_URL}/${locale}/<kind>/<id>` (`SITE_URL` 환경변수, 기본 `http://127.0.0.1:3100`).
- 모든 도구 응답 머리에 `snapshotId` (`getBuildInfo().snapshotId`, DB 에 없으면 `null`).
- 로케일 인자 `locale: 'ko' | 'en'`, 기본 `'ko'`. 폴백은 질의 함수의 `fellBack` 을 그대로 싣는다.
- 출력은 `structuredContent` (JSON) + `content[0].text` (사람이 읽을 한두 줄 요약). 도구마다 `outputSchema` 선언.
- 켜짐은 `'on' | 'possible' | 'off'` 세 값(§6.2). 판정은 강화 0단계 절만 — `check_gifts` 응답에 `stageNote` 로 적는다.
- `score_packs` 응답에 `provisional: true` 와 `provisionalReason: '저울추(적합 2 · 등급 3 · 전용 0.25)가 LLM 초안 표본에서 나왔고 사람 검토 전이다'`.
- 출격 = 편성 순서 1..min(7, 편성 인원), 나머지 대기. `deployedIds` 가 주어지면 우선.
- 축 두 층(`tag` · `skill`)을 섞지 않는다. 층 판정 출처는 엔진의 `Capability.affects`(gate `always`) 하나.
- 서버 `instructions` 문구에 출처 · 2차 창작 표시 · 면책을 담는다(01-data-source 7절).
- 화면(`/recommend` 등) 결과가 바뀌면 안 된다 — 기존 시험·골든이 지킨다.

## Review Focus

1. **편성이 7 미만인 덱 코드** (예: 5인) — 출격 = 전원, 대기 0. Task 2 시험이 잡는다.
2. **잘못된 덱 코드 문자열** — 도구가 throw 하지 않고 `isError: true` + 어느 단계에서 실패했는지(codec 의 문구) 돌려준다. Task 6 시험.
3. **없는 id** (`get_gift(999999)`) — `isError: true`, 「없는 id」 문구. 빈 객체를 성공으로 주지 않는다. Task 3 시험.
4. **판정 행이 없는 기프트** — `check_gifts` 가 `possible` + `reason: 'no-judgement-data'`. 화면처럼 `on` 으로 주지 않는다. Task 5 시험.
5. **DB 없음** — DB 의존 시험은 `canonicalReachable` 로 건너뛰고, 순수 함수 시험(덱 해석 · 켜짐 3값 · shape)은 DB 없이 돈다.

---

### Task 1: 뼈대 — 의존성 · 봉투 · `get_build_info`

**Files:**
- Modify: `package.json` (deps)
- Create: `lib/mcp/server.ts`, `lib/mcp/envelope.ts`, `lib/mcp/site-url.ts`, `lib/mcp/tools/meta.ts`
- Test: `lib/mcp/server.test.ts`, `lib/mcp/envelope.test.ts`

**Interfaces:**
- Produces:
  - `createDossierServer(): McpServer` — 모든 도구를 등록한 서버. 이후 task 가 `register*Tools(server)` 를 여기서 부른다.
  - `ok<T>(data: T, summary: string): Promise<CallToolResult>` — `snapshotId` 를 붙여 `{ structuredContent: { snapshotId, ...data }, content: [{ type: 'text', text: summary }] }`.
  - `fail(message: string): CallToolResult` — `{ isError: true, content: [{ type: 'text', text: message }] }`.
  - `siteUrl(locale: Locale, kind: 'identities'|'egos'|'gifts'|'packs', id: string|number): string`.
  - `SERVER_INSTRUCTIONS: string` (server.ts) — 출처 · 2차 창작 · 면책 · 「점수는 참고값, 판정은 강화 0단계」.
  - 시험 도우미 `connectInMemory(): Promise<Client>` (`lib/mcp/test-client.ts`) — SDK `InMemoryTransport` 로 서버와 `Client` 를 잇는다.

- [ ] **Step 1: 의존성 설치** — `npm install @modelcontextprotocol/sdk zod`. 설치된 SDK 판이 `McpServer.registerTool`(inputSchema/outputSchema) 과 웹 표준 Request 를 받는 Streamable HTTP 전송(`WebStandardStreamableHTTPServerTransport` 류)을 내보내는지 `node_modules/@modelcontextprotocol/sdk/package.json` exports 로 확인해 PR 설명에 판 번호를 적는다.
- [ ] **Step 2: 실패하는 시험**

```ts
// lib/mcp/envelope.test.ts
test('siteUrl 은 SITE_URL 위에 로케일·종류·id 를 붙인다', () => {
  process.env.SITE_URL = 'https://example.test';
  assert.equal(siteUrl('ko', 'gifts', 9001), 'https://example.test/ko/gifts/9001');
});
test('fail 은 isError 와 문구만 준다', () => {
  assert.deepEqual(fail('없는 id: 1'), { isError: true, content: [{ type: 'text', text: '없는 id: 1' }] });
});
// lib/mcp/server.test.ts
test('get_build_info 가 등록되고 snapshotId 와 출처 고지를 준다', { skip: reachable ? false : NO_DB }, async () => {
  const client = await connectInMemory();
  const names = (await client.listTools()).tools.map((t) => t.name);
  assert.ok(names.includes('get_build_info'));
  const r = await client.callTool({ name: 'get_build_info', arguments: {} });
  assert.equal(typeof (r.structuredContent as any).snapshotId, 'string');
  assert.match(JSON.stringify(r.structuredContent), /Project Moon/);
});
test('서버 instructions 에 면책과 참고값 고지가 있다', async () => {
  const client = await connectInMemory();
  assert.match(client.getInstructions() ?? '', /2차 창작/);
  assert.match(client.getInstructions() ?? '', /참고값/);
});
```

- [ ] **Step 3: 실패 확인** — `npx tsx --test lib/mcp/*.test.ts` → FAIL (모듈 없음).
- [ ] **Step 4: 구현** — `envelope.ts` 는 `getBuildInfo` 를 `cacheReference`(lib/query-cache.ts) 로 감싸 snapshotId 만 꺼낸다. `get_build_info` 는 `getBuildInfo()` 결과 + `{ source: '게임 클라이언트 데이터 — 저작권 Project Moon', notice: '<2차 창작 · 비공식 팬 사이트 문구>' }`. 서버 이름 `limbus-dossier`, 판은 `package.json` version.
- [ ] **Step 5: 통과 확인** — 같은 명령 → PASS. `npm run typecheck` 통과.
- [ ] **Step 6: Commit** — `git checkout -b feat/mcp-public` (첫 task 에서만), 설계 문서·이 계획과 함께 `git commit -m "feat(mcp): 서버 뼈대와 응답 봉투"`.

### Task 2: 덱 해석 — 덱 코드 출격 규칙

**Files:**
- Create: `lib/mcp/deck.ts`
- Modify: `lib/deck-code/codec.ts` (`deckFromCode` 가 `deployed` 를 채운다, 주석 교체), `lib/deck-code/codec.test.ts:54,77`
- Test: `lib/mcp/deck.test.ts`

**Interfaces:**
- Produces:
  - `type DeckInput = { deckCode: string } | { identityIds: number[]; egoIds?: number[]; deployedIds?: number[] }`
  - `interface ResolvedDeck { squad: Squad; order: number[] /* 인격 id, 편성 순서 */; field: number[]; waiting: number[]; egoIds: number[] }`
  - `resolveDeck(input: DeckInput): Promise<Result<ResolvedDeck>>` — `Result` 는 `lib/storage/kv` 의 것.
  - zod 스키마 `deckInputSchema` (도구들이 공유). `deployedIds` 는 deckCode 와도 함께 줄 수 있다.
- Consumes: `deckFromCode` (codec.ts), `Squad` (engine/v2/types.ts).

- [ ] **Step 1: 실패하는 시험** — 사용자 실물 덱 코드(편성 #24)를 고정값으로:

```ts
const CODE_24 = 'H4sIAAAAAAAAE3P1dkyv8Ex3DAx09nDNLHdyLPd0BAJnL8d0EO2f7gyiHEsyAiPDPR2djR0zgxwjHT3LIcKFENWuwY4ZYENcg11dndKdnAI98/29gBK2tgAHpASdYAAAAA==';
test('편성 #24: 순서 1–7 이 출격, 8–12 가 대기 (게임 캡처와 일치)', async () => {
  const r = await resolveDeck({ deckCode: CODE_24 });
  assert.ok(r.ok);
  assert.deepEqual(r.value.field, [11116, 11017, 10316, 10216, 11216, 10611, 10711]);
  assert.deepEqual(r.value.waiting, [10514, 10408, 10116, 10910, 10808]);
  assert.deepEqual(r.value.squad.field, r.value.field.map(String));
  assert.equal(r.value.squad.roster.length, 12);
});
test('E.G.O 장착이 roster 에 실린다', async () => {
  const r = await resolveDeck({ deckCode: CODE_24 });
  const otis = r.ok && r.value.squad.roster.find((s) => s.identityId === '11116');
  assert.deepEqual(otis && [...otis.egoIds].sort(), ['21104', '21106', '21108', '21109']);
});
test('5인 인격 목록: 전원 출격, 대기 없음', async () => {
  const r = await resolveDeck({ identityIds: [10101, 10201, 10301, 10401, 10501] });
  assert.ok(r.ok); assert.equal(r.value.field.length, 5); assert.deepEqual(r.value.waiting, []);
});
test('deployedIds 가 순서 규칙보다 우선한다', async () => {
  const ids = [10101,10201,10301,10401,10501,10601,10701,10801];
  const r = await resolveDeck({ identityIds: ids, deployedIds: [10801] });
  assert.ok(r.ok); assert.deepEqual(r.value.field, [10801]); assert.equal(r.value.waiting.length, 7);
});
test('deployedIds 가 편성 밖이면 실패', async () => {
  const r = await resolveDeck({ identityIds: [10101], deployedIds: [10201] });
  assert.equal(r.ok, false);
});
test('한 수감자에 인격 둘이면 실패 (편성은 수감자당 하나)', async () => {
  const r = await resolveDeck({ identityIds: [10101, 10102] });
  assert.equal(r.ok, false);
});
// codec.test.ts — 기존 두 단언을 바꾼다
//   deckFromCode 결과의 deployed 는 order 의 앞 7 (수감자 id)
```

- [ ] **Step 2: 실패 확인** — `npx tsx --test lib/mcp/deck.test.ts lib/deck-code/codec.test.ts` → FAIL.
- [ ] **Step 3: 구현** — `deckFromCode` 끝에서 `deck.deployed = deck.order.slice(0, DEPLOY_MAX)`; 주석은 「순서 1–7 이 출격 — 2026-11-23 게임 캡처 대조(설계 §6.2)」로. `resolveDeck` 은 덱 코드 → `deckFromCode` → 슬롯의 인격·E.G.O id 로, 인격 목록 → 목록 차례가 순서. 출격 = `deployedIds ?? order.slice(0, 7)`. 수감자 = `sinnerOf(id)` (deck-code/layout.ts).
- [ ] **Step 4: 통과 확인** — 같은 명령 → PASS. `npm test` 전체에서 `/squad` 관련 시험 회귀 없음.
- [ ] **Step 5: Commit** — `git commit -m "feat(mcp): 덱 해석 — 편성 순서 앞 7 이 출격"`.

### Task 3: 조회 도구 — 인격 · E.G.O · 검색 · 어휘

**Files:**
- Create: `lib/mcp/shape.ts`, `lib/mcp/axes.ts`, `lib/mcp/page.ts`, `lib/mcp/tools/catalog.ts`
- Test: `lib/mcp/shape.test.ts`, `lib/mcp/axes.test.ts`, `lib/mcp/tools/catalog.test.ts`

**Interfaces:**
- Consumes: `ok` · `fail` · `siteUrl` (Task 1).
- Produces:
  - `stripMedia<T>(value: T): T` — 키 `image` · `icon` · `sprite` · `art` · `href` 를 재귀적으로 뺀다 (shape.ts).
  - `identityAxes(capabilities: Capability[]): Map<string, { tag: string[]; skill: string[] }>` — gate `always` 행만, `affects` 가 `tag`·`both` → tag, `skill`·`both` → skill. 값은 `refKind:refId` (axes.ts). `loadEngineData` 를 `cacheReference` 로 감싸 `engineData()` 로 내보낸다 — Task 5·6 이 같은 것을 쓴다.
  - `paginate<T>(rows: T[], cursor?: string, size = 50): { items: T[]; nextCursor: string | null; total: number }` (page.ts).
  - `registerCatalogTools(server: McpServer): void` — 도구 `search`, `list_identities`, `get_identity`, `list_egos`, `get_ego`, `list_vocab`.
- 인자:
  - `list_identities { locale?, sinnerId?, star?, sin?, keyword?, axisLayer?: 'tag'|'skill' = 'tag', season?, cursor? }` — 요약 행 `{ id, sinnerId, name, star, season, sins, axes: { tag, skill }, siteUrl }`.
  - `list_egos { locale?, sinnerId?, rank?, sin?, cursor? }`.
  - `get_identity { id, locale? }` · `get_ego { id, locale? }` — 질의 함수 결과를 `stripMedia` 후 `siteUrl` 추가, 인격은 `axes` 도.
  - `search { query, locale? }` — `searchAll` 결과의 `href` → `siteUrl`.
  - `list_vocab { locale? }` — `{ sinners, keywords, sins, axisLabels }`.

- [ ] **Step 1: 실패하는 시험**

```ts
test('stripMedia 는 중첩된 image·icon 을 뺀다', () => {
  assert.deepEqual(stripMedia({ id: 1, image: 'x', skills: [{ icon: 'y', name: 'a' }] }), { id: 1, skills: [{ name: 'a' }] });
});
test('identityAxes: skill 전용 행은 tag 에 안 든다', () => {
  const m = identityAxes([
    { identityId: '10104', refKind: 'keyword', refId: 'VIBRATION', gateKind: 'always', gateRef: '', gateMin: null, affects: 'skill' },
    { identityId: '10104', refKind: 'keyword', refId: 'BURN', gateKind: 'always', gateRef: '', gateMin: null, affects: 'both' },
    { identityId: '10104', refKind: 'keyword', refId: 'BLEED', gateKind: 'ego_equipped', gateRef: '20101', gateMin: null, affects: 'both' },
  ]);
  assert.deepEqual(m.get('10104'), { tag: ['keyword:BURN'], skill: ['keyword:BURN', 'keyword:VIBRATION'] });
});
test('paginate 는 커서로 이어진다', () => {
  const a = paginate([1,2,3], undefined, 2); assert.deepEqual(a.items, [1,2]);
  const b = paginate([1,2,3], a.nextCursor!, 2); assert.deepEqual(b.items, [3]); assert.equal(b.nextCursor, null);
});
// catalog.test.ts (DB 필요 — canonicalReachable 로 skip)
test('10104 는 진동 tag 필터에 없고 skill 필터에 있다', async () => {
  const c = await connectInMemory();
  const ids = async (layer: string) => ((await c.callTool({ name: 'list_identities', arguments: { keyword: 'VIBRATION', axisLayer: layer } })).structuredContent as any).items.map((i: any) => i.id);
  assert.ok(!(await ids('tag')).includes('10104'));
  assert.ok((await ids('skill')).includes('10104'));
});
test('get_identity 응답에 이미지 경로가 없고 siteUrl 이 있다', async () => {
  const r = (await c.callTool({ name: 'get_identity', arguments: { id: 10101 } })).structuredContent as any;
  assert.doesNotMatch(JSON.stringify(r), /\.(png|webp|jpg)/);
  assert.match(r.siteUrl, /\/ko\/identities\/10101$/);
});
test('없는 id 는 isError', async () => {
  const r = await c.callTool({ name: 'get_identity', arguments: { id: 99999 } });
  assert.equal(r.isError, true);
});
```

- [ ] **Step 2: 실패 확인** — `npx tsx --env-file-if-exists=.env --test lib/mcp/*.test.ts lib/mcp/tools/*.test.ts` → FAIL.
- [ ] **Step 3: 구현** — 위 인터페이스대로. 목록 필터는 `listIdentitiesFull`/`listEgosFull` 결과를 메모리에서 거른다(화면과 같은 방식). 인격 목록의 `keyword` 필터는 `identityAxes` 의 해당 층으로 거른다.
- [ ] **Step 4: 통과 확인** — 같은 명령 → PASS.
- [ ] **Step 5: Commit** — `git commit -m "feat(mcp): 인격·E.G.O·검색 조회 도구"`.

### Task 4: 조회 도구 — 기프트 · 팩 · 층 · 던전 · 상태

**Files:**
- Create: `lib/mcp/tools/dungeon.ts`
- Test: `lib/mcp/tools/dungeon.test.ts`

**Interfaces:**
- Consumes: `ok` · `fail` · `siteUrl` · `stripMedia` · `paginate`.
- Produces: `registerDungeonTools(server: McpServer): void` — 도구:
  - `list_gifts { locale?, q?, tiers?: string[], keywords?: string[], enhanceable?, hardOnly?, pool?: 'exclusive'|'general', cursor? }` → `listGifts(locale, GiftFilter)` (GiftFilter 의 `page` 는 쓰지 않고 `listAllGifts` + 메모리 필터 또는 `listGifts` 페이지를 커서로 잇는다 — 둘 중 화면 결과와 같은 쪽).
  - `get_gift { id, locale? }` → `getGift` (강화 0/+/++ 단계 · 등장 팩 id · 저주/축복 짝).
  - `list_packs { locale?, q?, cursor? }` · `get_pack { id, locale? }` (기프트 풀 id · 등장 층).
  - `list_floor_packs { locale?, floor?, difficulty?: 'normal'|'hard' }`.
  - `get_dungeon { locale? }` · `list_statuses { locale?, q?, buffTypes?, cursor? }`.

- [ ] **Step 1: 실패하는 시험** (DB 필요)

```ts
test('get_gift 는 단계별 문구와 등장 팩 id 를 준다', async () => {
  const id = /* listAllGifts 에서 enhanceable 인 첫 기프트 */;
  const g = (await c.callTool({ name: 'get_gift', arguments: { id } })).structuredContent as any;
  assert.ok(g.stages.length >= 2);
  assert.ok(Array.isArray(g.packs ?? g.exclusivePacks));
  assert.doesNotMatch(JSON.stringify(g), /\.(png|webp|jpg)/);
});
test('get_pack 의 기프트 id 로 get_gift 를 부를 수 있다 (엮임)', async () => { /* pack → gifts[0].id → get_gift 성공 */ });
test('list_gifts 개수가 화면 목록과 같다 (456 — presentationOnly · 거울 던전 범위)', async () => {
  const r = (await c.callTool({ name: 'list_gifts', arguments: {} })).structuredContent as any;
  assert.equal(r.total, (await listAllGifts('ko')).length);
});
test('get_gift(999999) 는 isError', async () => { /* ... */ });
```

- [ ] **Step 2: 실패 확인** → FAIL.
- [ ] **Step 3: 구현.**
- [ ] **Step 4: 통과 확인** → PASS.
- [ ] **Step 5: Commit** — `git commit -m "feat(mcp): 기프트·팩·층·던전·상태 조회 도구"`.

### Task 5: 추천 질의에서 엔진 부분을 뗀다

**Files:**
- Modify: `lib/queries/canonical/recommend.ts`
- Test: `lib/queries/canonical/recommend.test.ts` (기존 + 추가)

**Interfaces:**
- Produces:
  - `recommendForSquad(locale: Locale, input: { squad: Squad; floor: number; difficulty: $Enums.Difficulty; heldGiftIds: string[] }): Promise<Recommendation>` — 지금 `recommendForDeck` 의 본체. `squad.roster[].egoIds` 를 존중한다.
  - `recommendForDeck` 은 기존 시그니처 그대로 두고 squad 를 만들어 `recommendForSquad` 를 부른다 (egoIds 는 지금처럼 `[]`).
  - `judgeGifts(input: { squad: Squad; heldGiftIds: string[] }): Promise<{ verdicts: Map<string, GiftVerdict>; chainDepth: Map<string, number> }>` — `engineData()` 캐시를 쓰는 판정 묶음. `recommendForSquad` 와 Task 6 `check_gifts` 가 공유.

- [ ] **Step 1: 실패하는 시험**

```ts
test('recommendForDeck(화진) 결과가 recommendForSquad 와 같다', async () => {
  const a = await recommendForDeck('ko', {});
  const b = await recommendForSquad('ko', { squad: { roster: HWAJIN_DECK.map((id) => ({ identityId: String(id), egoIds: [] })), field: HWAJIN_DECK.map(String) }, floor: 3, difficulty: 'hard', heldGiftIds: [] });
  assert.deepEqual(a, b);
});
```

- [ ] **Step 2: 실패 확인** → FAIL (`recommendForSquad` 없음). 그리고 손대기 전에 `npm run golden:capture` 로 기준을 뜬다.
- [ ] **Step 3: 구현** — 본체 이동만. 계산을 바꾸지 않는다.
- [ ] **Step 4: 통과 확인** — `npm test` 전체 PASS (특히 `rank-golden` · `golden` · `recommend.test`). `npm run golden:compare` 가 차이 0.
- [ ] **Step 5: Commit** — `git commit -m "refactor(recommend): 엔진 본체를 편성 입력 함수로 뗀다"`.

### Task 6: 엔진 판정 도구

**Files:**
- Create: `lib/mcp/fire.ts`, `lib/mcp/tools/engine.ts`
- Test: `lib/mcp/fire.test.ts`, `lib/mcp/tools/engine.test.ts`

**Interfaces:**
- Consumes: `resolveDeck` · `deckInputSchema` (Task 2), `identityAxes` · `engineData` (Task 3), `recommendForSquad` · `judgeGifts` (Task 5), `Profile` (engine/v2/profile.ts).
- Produces:
  - `fireState(v: GiftVerdict | undefined): { state: 'on'|'possible'|'off'; reason?: 'no-judgement-data' }` — `undefined` → possible + no-judgement-data; `!v.fireable` → off; `v.total > 0 && v.certain === v.total` → on; 그 외 possible.
  - `registerEngineTools(server: McpServer): void` — 도구:
    - `decode_deck_code { deckCode, locale? }` → `{ order: [{ position, identityId, name, sinnerId, egoIds, role: 'field'|'waiting' }] }`.
    - `analyze_deck { ...DeckInput, locale? }` → `{ field, waiting, supply: [{ refKind, refId, label, tag: { roster, field, waiting }, skill: { field } }] }` — tag 는 `Profile.count(kind, id, denom)`, skill 은 출격 인격 중 `identityAxes().skill` 에 든 수.
    - `check_gifts { ...DeckInput, giftIds: number[] (1–50), heldGiftIds?: number[], locale? }` → `{ stageNote: '판정은 강화 0단계 절 기준', gifts: [{ id, name, state, reason?, grade, decidable, satisfied, certain, total, reasons, chainDepth }] }`.
    - `score_packs { ...DeckInput, floor: 1–15, difficulty: 'normal'|'hard' = 'hard', heldGiftIds?, locale? }` → `{ provisional: true, provisionalReason, rankable, packs: [{ id, name, score, fit, live, fusion, siteUrl, topGifts: 상위 5 { id, name, state } }] }`.

- [ ] **Step 1: 실패하는 시험**

```ts
// fire.test.ts (DB 없음)
test('판정 없음 → possible + no-judgement-data', () => assert.deepEqual(fireState(undefined), { state: 'possible', reason: 'no-judgement-data' }));
test('fireable false → off', () => assert.equal(fireState(v({ fireable: false })).state, 'off'));
test('전부 확정 충족 → on', () => assert.equal(fireState(v({ fireable: true, total: 2, certain: 2, satisfied: 2 })).state, 'on'));
test('가능이 남으면 possible', () => assert.equal(fireState(v({ fireable: true, total: 2, certain: 1, satisfied: 2 })).state, 'possible'));
// engine.test.ts (DB 필요)
test('analyze_deck(편성 #24) 는 출격 7 · 대기 5', async () => { /* field.length 7, waiting.length 5 */ });
test('score_packs 는 provisional 표시를 단다', async () => { /* provisional === true, provisionalReason 일치 */ });
test('check_gifts 는 stageNote 를 단다', async () => { /* ... */ });
test('잘못된 덱 코드는 isError + 코덱 문구', async () => {
  const r = await c.callTool({ name: 'analyze_deck', arguments: { deckCode: 'not-a-code' } });
  assert.equal(r.isError, true); assert.match((r.content as any)[0].text, /덱 코드를 풀지 못했다/);
});
test('E.G.O 장착이 공급에 든다: ego_equipped 게이트 축이 E.G.O 를 빼면 줄어든다', async () => { /* 같은 identityIds, egoIds 유무로 analyze_deck 비교 — 게이트 행이 있는 인격 하나를 engineData().capabilities 에서 골라 쓴다 */ });
```

- [ ] **Step 2: 실패 확인** → FAIL.
- [ ] **Step 3: 구현.**
- [ ] **Step 4: 통과 확인** → PASS.
- [ ] **Step 5: Commit** — `git commit -m "feat(mcp): 엔진 판정 도구 — 덱 해석·축·켜짐·팩 점수"`.

### Task 7: `/mcp` 경로 · 호출 제한 · 실연결 확인

**Files:**
- Create: `app/mcp/route.ts`, `lib/mcp/rate-limit.ts`
- Modify: `proxy.ts` (matcher 에서 `mcp` 제외), `README.md` (MCP 절: 주소 · 연결법 · 도구 목록 · 공개 전 선행 조건 §3)
- Test: `lib/mcp/rate-limit.test.ts`

**Interfaces:**
- Consumes: `createDossierServer` (Task 1).
- Produces: `POST /mcp` (Streamable HTTP, 무상태 — 요청마다 서버·전송 생성, 세션 id 없음). `GET`·`DELETE` 는 405.
  - `takeToken(key: string, now = Date.now()): boolean` — 키당 토큰 버킷. 수치: 분당 60 회, 순간 20 (빌더 결정, 설계 §9). 키는 `x-forwarded-for` 첫 값 또는 `'local'`. 초과 시 429 + `Retry-After`.

- [ ] **Step 1: 실패하는 시험**

```ts
test('순간 20 회 뒤 21 번째는 거절, 1 분 뒤 회복', () => {
  const t0 = 0; for (let i = 0; i < 20; i++) assert.ok(takeToken('a', t0));
  assert.equal(takeToken('a', t0), false);
  assert.ok(takeToken('a', t0 + 60_000));
});
test('키끼리 섞이지 않는다', () => { /* 'a' 소진 후 'b' 는 true */ });
```

- [ ] **Step 2: 실패 확인** → FAIL.
- [ ] **Step 3: 구현** — Task 1 Step 1 에서 확인한 웹 표준 전송을 쓴다. 그런 전송이 없는 판이면 `mcp-handler` 패키지로 감싼다(그때 PR 설명에 이유).
- [ ] **Step 4: 통과 확인** — 시험 PASS, `npm run typecheck` · `npm run build` 통과.
- [ ] **Step 5: 실연결 확인** — `npm run dev -- --hostname 127.0.0.1 --port 3100` 후 `npx @modelcontextprotocol/inspector` 로 `http://127.0.0.1:3100/mcp` (Streamable HTTP) 연결. 기대: 도구 18개 목록(`get_build_info` 1 · 조회 6 · 던전 7 · 엔진 4), `analyze_deck` 에 편성 #24 코드 → 출격 7 · 대기 5. 결과를 PR 설명에 적는다.
- [ ] **Step 6: Commit** — `git commit -m "feat(mcp): /mcp 경로와 호출 제한"`.

### Task 8: 마무리 검증

- [ ] **Step 1:** `npm test` 전체 — 실패 0 (기존 765 통과 + 신규).
- [ ] **Step 2:** `npm run typecheck` · `npm run build` 통과.
- [ ] **Step 3:** 설계 문서 §10 순서 1 에 「구현됨 — PR #<n>」 한 줄.
- [ ] **Step 4:** Commit 후 PR (사용자 확인 뒤).
