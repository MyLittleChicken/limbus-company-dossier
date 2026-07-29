# 편성 편집과 덱 코드 구현 계획 (계획 A)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/squad` 에서 거울 던전 덱을 짜서 브라우저에 저장하고, 인게임 덱 코드와 주고받는다.

**Architecture:** 저장은 `localStorage` 이며 순수 함수 계층(`lib/storage`)이 `Storage` 인터페이스를 주입받아 브라우저 없이도 테스트된다. 덱 코드는 base64/gzip 파이프라인과 560비트 배치를 분리한 순수 함수(`lib/deck-code`)다. 화면은 기존 `/squad` 서버 컴포넌트가 `listSquad()` 로 받은 데이터를 클라이언트 편집기에 넘기는 형태이며, 조회 기능은 유지된다.

**Tech Stack:** TypeScript · Next.js 16 App Router · React 19 · `node:test` (러너는 `tsx --test`, 새 의존성 없음) · 웹 표준 `CompressionStream`/`btoa`

**gzip·base64 는 웹 표준 API 로 한다.** `node:zlib` 과 `Buffer` 는 Node 전용이라 클라이언트 컴포넌트에 들어가면 폴리필에 의존하게 된다. `CompressionStream`·`btoa`/`atob` 는 Node 22+ 와 모든 현행 브라우저에 전역으로 있어 **같은 구현이 양쪽에서 돌고 Node 로 테스트된다.** 실측으로 확인했다 — `CompressionStream` 출력이 gzip 매직(`1f 8b 08`)을 갖고 `node:zlib` 산출물과 상호운용되며, `btoa` 결과가 `Buffer.toString('base64')` 와 바이트 단위로 같다. 대신 압축이 비동기라 코덱 함수가 `Promise` 를 돌려준다.

## Global Constraints

- Node **>=22.9** (`package.json` engines). 이보다 낮은 API 를 가정하지 않는다.
- **`lib/engine/**` 을 수정하지 않는다.** 엔진 브랜치 소유다 (`docs/07-recommendation-system.md` 9절).
- **계산은 서버에서 한다** (`docs/adr/05-web-serving.md` 3.3). 다만 이 계획의 저장·덱코드는 순수 계산이라 클라이언트에서 돈다. 데이터베이스 질의는 서버 컴포넌트가 이미 한 것을 넘겨받아 쓴다.
- **결손을 지어내지 않는다** (`docs/02-data-model.md` 6절). 저장 실패·디코드 실패·참조 결손을 조용히 넘기지 않고 값으로 표현해 화면에 표기한다.
- 커밋 제목은 Conventional Commits, 한국어 명사구, 마침표 없음 (`README.md` 커밋 규약).
- 주석은 **왜** 를 적는다. 무엇을 하는지는 코드가 말한다. 기존 파일들의 밀도를 따른다.
- 새 npm 의존성을 추가하지 않는다.

## 파일 구조

| 파일 | 책임 |
| --- | --- |
| `lib/storage/kv.ts` | `Kv` 인터페이스와 `Result` 타입. 저장 실패를 예외가 아니라 값으로 |
| `lib/storage/schema.ts` | `SCHEMA_VERSION` · `StoredDeck` · `StoredRun` 타입과 검증 함수 |
| `lib/storage/decks.ts` | 덱 목록 읽기/쓰기. 최대 10, 스키마 버전 확인 |
| `lib/deck-code/bits.ts` | 바이트↔비트 문자열, 비트 구간 읽기/쓰기 |
| `lib/deck-code/layout.ts` | 46비트 블록 배치, id↔(수감자, 순번) |
| `lib/deck-code/bytes.ts` | 이식 가능한 base64·gzip (웹 표준) |
| `lib/deck-code/codec.ts` | 파이프라인 + `StoredDeck` 변환 |
| `components/deck-editor.tsx` | `'use client'` 편성 편집기 |
| `components/deck-code-io.tsx` | `'use client'` 덱 코드 입출력 |
| `app/[locale]/squad/page.tsx` | 기존 조회 유지 + 편집기 마운트 |
| `lib/queries/recommend.ts` | 편성과 출전을 나눠 받는다 (Task 9) |
| `package.json` | `test` 스크립트 추가 |
| `.github/workflows/ci.yml` | 테스트 단계 추가 |

`*.test.ts` 는 대상 파일 옆에 둔다.

---

### Task 1: 테스트 러너 배선

**Files:**
- Modify: `package.json`
- Modify: `.github/workflows/ci.yml`
- Create: `lib/storage/kv.ts`
- Test: `lib/storage/kv.test.ts`

**Interfaces:**
- Consumes: 없음
- Produces: `Kv` · `Result<T>` · `ok()` · `err()` — 이후 모든 저장·디코드 함수가 실패를 이 타입으로 돌려준다

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`lib/storage/kv.test.ts`:

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ok, err, memoryKv } from './kv';

test('ok 는 값을 담는다', () => {
	const r = ok(42);
	assert.equal(r.ok, true);
	if (r.ok) assert.equal(r.value, 42);
});

test('err 는 사유를 담는다', () => {
	const r = err('quota');
	assert.equal(r.ok, false);
	if (!r.ok) assert.equal(r.reason, 'quota');
});

test('memoryKv 는 쓴 값을 돌려준다', () => {
	const kv = memoryKv();
	assert.equal(kv.getItem('a'), null);
	kv.setItem('a', '1');
	assert.equal(kv.getItem('a'), '1');
});

test('memoryKv 는 던지도록 설정할 수 있다', () => {
	const kv = memoryKv({ throwOnSet: true });
	assert.throws(() => kv.setItem('a', '1'));
});
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npx tsx --test "lib/storage/kv.test.ts"`
Expected: FAIL — `Cannot find module './kv'`

- [ ] **Step 3: 최소 구현**

`lib/storage/kv.ts`:

```ts
/**
 * 저장소 접근과 실패 표현.
 *
 * localStorage 는 사파리 프라이빗 모드와 용량 초과에서 던진다. 던지는 것을 그대로
 * 흘리면 화면이 죽거나 조용히 삼키게 되는데, 둘 다 결손을 감추는 쪽이다
 * (02-data-model 6절). 실패를 값으로 만들어 호출부가 표기하도록 강제한다.
 *
 * `Kv` 로 좁혀 받는 이유는 브라우저 없이 테스트하기 위해서다.
 */

export interface Kv {
	getItem(key: string): string | null;
	setItem(key: string, value: string): void;
}

export type Result<T> = { ok: true; value: T } | { ok: false; reason: string };

export const ok = <T>(value: T): Result<T> => ({ ok: true, value });
export const err = <T = never>(reason: string): Result<T> => ({ ok: false, reason });

/** 테스트용. 실패 경로를 실제로 밟아 보기 위해 던지는 모드를 갖는다. */
export function memoryKv(options: { throwOnSet?: boolean } = {}): Kv {
	const map = new Map<string, string>();
	return {
		getItem: (k) => map.get(k) ?? null,
		setItem: (k, v) => {
			if (options.throwOnSet) throw new Error('quota exceeded');
			map.set(k, v);
		},
	};
}
```

- [ ] **Step 4: 통과를 확인한다**

Run: `npx tsx --test "lib/storage/kv.test.ts"`
Expected: PASS — tests 4 / pass 4

- [ ] **Step 5: npm script 와 CI 를 잇는다**

**엔진 브랜치(`feat/engine-deck-feature`)도 같은 배선을 한다.** `package.json` 의 같은 자리와 `ci.yml` 의 같은 단계라 그대로 두면 충돌한다. 먼저 올라가는 쪽이 배선을 가져가고 나중 쪽은 리베이스해 이 Task 를 건너뛴다 — 어느 쪽이 먼저인지는 착수 시점에 확인한다.

`package.json` scripts 에 추가 (`typecheck` 바로 아래):

```json
"test": "tsx --env-file-if-exists=.env --test \"lib/**/*.test.ts\"",
```

`--env-file-if-exists` 를 붙이는 이유는 다른 `tsx` 스크립트와 같다(커밋 16776cd). 이 계획의 테스트는 데이터베이스를 쓰지 않지만 글롭이 `lib/**` 전체라, 엔진 브랜치가 합류하면 `lib/db` 를 물고 오는 테스트가 들어오고 그때 `PrismaClient` 생성자가 `DATABASE_URL` 을 요구한다.

`.github/workflows/ci.yml` 의 `타입 검사` 단계 **앞**에 삽입한다. `Prisma Client 생성` 뒤여야 한다 — 생성된 타입 없이는 `lib/**` 임포트가 풀리지 않는다.

```yaml
      # 순수 함수 계층(저장·덱 코드)의 단위 테스트. 데이터베이스도 브라우저도 쓰지 않는다.
      - name: 단위 테스트
        run: npm test
```

- [ ] **Step 6: 전부 확인한다**

Run: `npm test && npm run typecheck`
Expected: 테스트 통과, 타입 오류 0

- [ ] **Step 7: 커밋**

```bash
git add package.json .github/workflows/ci.yml lib/storage/kv.ts lib/storage/kv.test.ts
git commit -m "test: 단위 테스트 러너 배선과 저장 실패 표현"
```

---

### Task 2: 저장 스키마와 검증

**Files:**
- Create: `lib/storage/schema.ts`
- Test: `lib/storage/schema.test.ts`

**Interfaces:**
- Consumes: 없음
- Produces: `SCHEMA_VERSION` · `EGO_RANKS` · `StoredDeck` · `DeckSlot` · `StoredRun` · `emptyDeck(name)` · `parseDeck(unknown): Result<StoredDeck>`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`lib/storage/schema.test.ts`:

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SCHEMA_VERSION, emptyDeck, parseDeck } from './schema';

test('스키마 버전은 1', () => {
	assert.equal(SCHEMA_VERSION, 1);
});

test('빈 덱은 수감자 12칸을 갖는다', () => {
	const d = emptyDeck('테스트');
	assert.equal(d.slots.length, 12);
	assert.deepEqual(d.slots.map((s) => s.sinnerId), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
	assert.equal(d.slots.every((s) => s.identityId === null), true);
	assert.deepEqual(d.deployed, []);
});

test('정상 덱을 통과시킨다', () => {
	const d = emptyDeck('a');
	d.slots[0]!.identityId = 10101;
	d.slots[0]!.egos.ZAYIN = 20101;
	d.deployed = [1];
	const r = parseDeck(JSON.parse(JSON.stringify(d)));
	assert.equal(r.ok, true);
});

test('칸 수가 12가 아니면 거부한다', () => {
	const d = emptyDeck('a');
	d.slots.pop();
	const r = parseDeck(JSON.parse(JSON.stringify(d)));
	assert.equal(r.ok, false);
});

test('출전이 7을 넘으면 거부한다', () => {
	const d = emptyDeck('a');
	d.deployed = [1, 2, 3, 4, 5, 6, 7, 8];
	const r = parseDeck(JSON.parse(JSON.stringify(d)));
	assert.equal(r.ok, false);
});

test('덱이 아닌 값을 거부한다', () => {
	assert.equal(parseDeck(null).ok, false);
	assert.equal(parseDeck({ name: 'x' }).ok, false);
});
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npx tsx --test "lib/storage/schema.test.ts"`
Expected: FAIL — `Cannot find module './schema'`

- [ ] **Step 3: 최소 구현**

`lib/storage/schema.ts`:

```ts
import { ok, err, type Result } from './kv';

/**
 * 브라우저에 저장하는 것의 모양.
 *
 * 버전을 박아두는 이유는 나중에 모양이 바뀔 때 **버리지 않고 알리기** 위해서다.
 * 조용히 폐기하면 사용자가 짜둔 덱이 사라진 줄도 모르고 없어진다(07-recommendation-system 4.2).
 */
export const SCHEMA_VERSION = 1;

/** 게임의 E.G.O 등급. ALEPH 는 슬롯만 있고 출시분이 없다 — 결손이 아니라 부재다. */
export const EGO_RANKS = ['ZAYIN', 'TETH', 'HE', 'WAW', 'ALEPH'] as const;
export type EgoRank = (typeof EGO_RANKS)[number];

export const SINNER_COUNT = 12;
export const DEPLOY_MAX = 7;
export const DECK_MAX = 10;

export interface DeckSlot {
	sinnerId: number;
	identityId: number | null;
	/** 등급당 하나. 레코드로 두면 위반이 표현 불가능해진다. */
	egos: Partial<Record<EgoRank, number>>;
}

export interface StoredDeck {
	id: string;
	name: string;
	slots: DeckSlot[];
	/** 출전 수감자 id. 순서가 곧 편성 순서다. */
	deployed: number[];
	updatedAt: string;
}

export interface StoredRun {
	deckId: string;
	difficulty: 'normal' | 'hard';
	floors: Array<{ floor: number; pickedPackId: string | null; gainedGiftIds: number[] }>;
	startedAt: string;
}

/**
 * 덱 id.
 *
 * `crypto.randomUUID` 는 브라우저에서 **보안 컨텍스트**(HTTPS · localhost)에서만 있다.
 * 배포 환경이 아직 미결이라(adr/05 3.5) 평문 HTTP 로 서비스될 가능성을 배제할 수 없고,
 * 그때 `emptyDeck` 이 던지면 편성 화면이 통째로 죽는다. 없으면 물러선다 — id 는 우리
 * 저장소 안에서만 유일하면 되고 암호학적 성질이 필요하지 않다.
 */
function newId(): string {
	if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
		return crypto.randomUUID();
	}
	return `deck-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function emptyDeck(name: string, id = newId()): StoredDeck {
	return {
		id,
		name,
		slots: Array.from({ length: SINNER_COUNT }, (_, i) => ({
			sinnerId: i + 1,
			identityId: null,
			egos: {},
		})),
		deployed: [],
		updatedAt: new Date().toISOString(),
	};
}

const isInt = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v);

export function parseDeck(raw: unknown): Result<StoredDeck> {
	if (typeof raw !== 'object' || raw === null) return err('덱이 객체가 아니다');
	const d = raw as Record<string, unknown>;
	if (typeof d['id'] !== 'string' || typeof d['name'] !== 'string') return err('id·name 이 없다');
	if (!Array.isArray(d['slots']) || d['slots'].length !== SINNER_COUNT) {
		return err(`칸이 ${SINNER_COUNT}개가 아니다`);
	}
	for (const s of d['slots'] as unknown[]) {
		if (typeof s !== 'object' || s === null) return err('칸이 객체가 아니다');
		const slot = s as Record<string, unknown>;
		if (!isInt(slot['sinnerId'])) return err('수감자 id 가 정수가 아니다');
		if (slot['identityId'] !== null && !isInt(slot['identityId'])) return err('인격 id 가 정수가 아니다');
		if (typeof slot['egos'] !== 'object' || slot['egos'] === null) return err('E.G.O 가 객체가 아니다');
	}
	if (!Array.isArray(d['deployed']) || d['deployed'].length > DEPLOY_MAX) {
		return err(`출전이 ${DEPLOY_MAX}명을 넘는다`);
	}
	if (typeof d['updatedAt'] !== 'string') return err('updatedAt 이 없다');
	return ok(raw as StoredDeck);
}
```

- [ ] **Step 4: 통과를 확인한다**

Run: `npx tsx --test "lib/storage/schema.test.ts"`
Expected: PASS — tests 6 / pass 6

- [ ] **Step 5: 커밋**

```bash
git add lib/storage/schema.ts lib/storage/schema.test.ts
git commit -m "feat(storage): 덱·런 저장 스키마와 검증"
```

---

### Task 3: 덱 목록 읽기와 쓰기

**Files:**
- Create: `lib/storage/decks.ts`
- Test: `lib/storage/decks.test.ts`

**Interfaces:**
- Consumes: `Kv` · `Result` · `ok` · `err` (Task 1) · `SCHEMA_VERSION` · `StoredDeck` · `parseDeck` · `emptyDeck` · `DECK_MAX` (Task 2)
- Produces: `KEY_SCHEMA` · `KEY_DECKS` · `readDecks(kv): Result<StoredDeck[]>` · `writeDecks(kv, decks): Result<void>`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`lib/storage/decks.test.ts`:

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { memoryKv } from './kv';
import { emptyDeck, SCHEMA_VERSION } from './schema';
import { readDecks, writeDecks, KEY_DECKS, KEY_SCHEMA } from './decks';

test('빈 저장소는 빈 목록', () => {
	const r = readDecks(memoryKv());
	assert.equal(r.ok, true);
	if (r.ok) assert.deepEqual(r.value, []);
});

test('쓴 것을 그대로 읽는다', () => {
	const kv = memoryKv();
	const decks = [emptyDeck('a', 'id-a')];
	assert.equal(writeDecks(kv, decks).ok, true);
	const r = readDecks(kv);
	assert.equal(r.ok, true);
	if (r.ok) assert.equal(r.value[0]?.name, 'a');
});

test('쓰기가 스키마 버전을 남긴다', () => {
	const kv = memoryKv();
	writeDecks(kv, []);
	assert.equal(kv.getItem(KEY_SCHEMA), String(SCHEMA_VERSION));
});

test('버전이 다르면 버리지 않고 실패로 알린다', () => {
	const kv = memoryKv();
	kv.setItem(KEY_SCHEMA, '99');
	kv.setItem(KEY_DECKS, '[]');
	const r = readDecks(kv);
	assert.equal(r.ok, false);
	if (!r.ok) assert.match(r.reason, /버전/);
});

test('깨진 JSON 을 실패로 알린다', () => {
	const kv = memoryKv();
	kv.setItem(KEY_SCHEMA, String(SCHEMA_VERSION));
	kv.setItem(KEY_DECKS, '{{{');
	assert.equal(readDecks(kv).ok, false);
});

test('10개를 넘으면 쓰지 않는다', () => {
	const kv = memoryKv();
	const many = Array.from({ length: 11 }, (_, i) => emptyDeck(`d${i}`, `id-${i}`));
	const r = writeDecks(kv, many);
	assert.equal(r.ok, false);
});

test('저장소가 던지면 실패로 돌려준다', () => {
	const r = writeDecks(memoryKv({ throwOnSet: true }), []);
	assert.equal(r.ok, false);
	if (!r.ok) assert.match(r.reason, /저장/);
});
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npx tsx --test "lib/storage/decks.test.ts"`
Expected: FAIL — `Cannot find module './decks'`

- [ ] **Step 3: 최소 구현**

`lib/storage/decks.ts`:

```ts
import { ok, err, type Kv, type Result } from './kv';
import { DECK_MAX, SCHEMA_VERSION, parseDeck, type StoredDeck } from './schema';

export const KEY_SCHEMA = 'limbus:schema';
export const KEY_DECKS = 'limbus:decks';

/**
 * 덱 목록 영속화.
 *
 * 읽기가 실패해도 **저장분을 지우지 않는다.** 버전이 다르거나 JSON 이 깨진 경우
 * 호출부가 사용자에게 알리고 판단을 넘긴다.
 */
export function readDecks(kv: Kv): Result<StoredDeck[]> {
	let rawSchema: string | null;
	let rawDecks: string | null;
	try {
		rawSchema = kv.getItem(KEY_SCHEMA);
		rawDecks = kv.getItem(KEY_DECKS);
	} catch (cause) {
		return err(`저장소를 읽지 못했다: ${(cause as Error).message}`);
	}

	if (rawDecks === null) return ok([]);
	if (rawSchema !== String(SCHEMA_VERSION)) {
		return err(`저장분의 스키마 버전(${rawSchema ?? '없음'})이 현재(${SCHEMA_VERSION})와 다르다`);
	}

	let parsed: unknown;
	try {
		parsed = JSON.parse(rawDecks);
	} catch {
		return err('저장분이 올바른 JSON 이 아니다');
	}
	if (!Array.isArray(parsed)) return err('저장분이 배열이 아니다');

	const out: StoredDeck[] = [];
	for (const item of parsed) {
		const d = parseDeck(item);
		if (!d.ok) return err(`덱을 읽지 못했다: ${d.reason}`);
		out.push(d.value);
	}
	return ok(out);
}

export function writeDecks(kv: Kv, decks: readonly StoredDeck[]): Result<void> {
	if (decks.length > DECK_MAX) return err(`덱은 ${DECK_MAX}개까지다`);
	try {
		kv.setItem(KEY_SCHEMA, String(SCHEMA_VERSION));
		kv.setItem(KEY_DECKS, JSON.stringify(decks));
	} catch (cause) {
		return err(`저장하지 못했다: ${(cause as Error).message}`);
	}
	return ok(undefined);
}
```

- [ ] **Step 4: 통과를 확인한다**

Run: `npx tsx --test "lib/storage/*.test.ts"`
Expected: PASS — pass 17 / fail 0

- [ ] **Step 5: 커밋**

```bash
git add lib/storage/decks.ts lib/storage/decks.test.ts
git commit -m "feat(storage): 덱 목록 읽기와 쓰기"
```

---

### Task 4: 비트 조작

**Files:**
- Create: `lib/deck-code/bits.ts`
- Test: `lib/deck-code/bits.test.ts`

**Interfaces:**
- Consumes: 없음
- Produces: `bytesToBits(Uint8Array): string` · `bitsToBytes(string): Uint8Array` · `readField(bits, start1, end1): number` · `writeField(bits, start1, end1, value): string`

`start1`·`end1` 은 **1-기준 포함 구간**이다. 덱 코드 가이드가 그 표기를 쓰므로 맞춘다.

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`lib/deck-code/bits.test.ts`:

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bytesToBits, bitsToBytes, readField, writeField } from './bits';

test('바이트를 8비트씩 편다', () => {
	assert.equal(bytesToBits(new Uint8Array([0b10000001, 0])), '1000000100000000');
});

test('비트를 바이트로 되돌린다', () => {
	assert.deepEqual([...bitsToBytes('1000000100000000')], [129, 0]);
});

test('왕복이 일치한다', () => {
	const src = new Uint8Array([0, 1, 127, 128, 255, 42]);
	assert.deepEqual([...bitsToBytes(bytesToBits(src))], [...src]);
});

test('1-기준 포함 구간을 읽는다', () => {
	//        위치 1234
	const bits = '0101';
	assert.equal(readField(bits, 1, 4), 0b0101);
	assert.equal(readField(bits, 2, 2), 1);
	assert.equal(readField(bits, 3, 4), 0b01);
});

test('구간에 값을 쓴다', () => {
	assert.equal(writeField('0000', 3, 4, 0b11), '0011');
	assert.equal(writeField('1111', 1, 2, 0), '0011');
});

test('쓰고 읽으면 같은 값', () => {
	const bits = writeField('0'.repeat(46), 2, 8, 16);
	assert.equal(readField(bits, 2, 8), 16);
});

test('구간을 넘는 값은 거부한다', () => {
	assert.throws(() => writeField('0000', 1, 2, 4));
});

test('문자열 밖을 쓰려 하면 거부한다', () => {
	// 조용히 짧아지면 뒤 블록이 통째로 밀린다
	assert.throws(() => writeField('0000', 3, 6, 0));
	assert.throws(() => writeField('0000', 0, 2, 0));
});
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npx tsx --test "lib/deck-code/bits.test.ts"`
Expected: FAIL — `Cannot find module './bits'`

- [ ] **Step 3: 최소 구현**

`lib/deck-code/bits.ts`:

```ts
/**
 * 비트 문자열 조작.
 *
 * 덱 코드 가이드가 비트 위치를 **1-기준 포함 구간**으로 적으므로 그 표기를 그대로 쓴다.
 * 0-기준으로 바꾸면 문서와 코드를 대조할 때마다 ±1 을 암산해야 하고 그게 곧 버그가 된다.
 */

export function bytesToBits(bytes: Uint8Array): string {
	let out = '';
	for (const b of bytes) out += b.toString(2).padStart(8, '0');
	return out;
}

export function bitsToBytes(bits: string): Uint8Array {
	if (bits.length % 8 !== 0) throw new Error(`비트 길이가 8의 배수가 아니다: ${bits.length}`);
	const out = new Uint8Array(bits.length / 8);
	for (let i = 0; i < out.length; i += 1) {
		out[i] = Number.parseInt(bits.slice(i * 8, i * 8 + 8), 2);
	}
	return out;
}

export function readField(bits: string, start1: number, end1: number): number {
	const slice = bits.slice(start1 - 1, end1);
	if (slice.length !== end1 - start1 + 1) throw new Error(`구간이 범위를 벗어난다: ${start1}-${end1}`);
	return Number.parseInt(slice, 2);
}

export function writeField(bits: string, start1: number, end1: number, value: number): string {
	// 범위를 넘겨도 slice 는 던지지 않고 짧은 문자열을 만든다. 길이가 조용히 바뀌면
	// 그 뒤 블록이 통째로 밀리고 왕복 테스트만 통과하는 코드가 된다. 여기서 막는다.
	if (start1 < 1 || end1 > bits.length || start1 > end1) {
		throw new Error(`구간이 범위를 벗어난다: ${start1}-${end1} (길이 ${bits.length})`);
	}
	const width = end1 - start1 + 1;
	if (value < 0 || value >= 2 ** width) {
		throw new Error(`값 ${value} 는 ${width}비트에 담기지 않는다`);
	}
	const encoded = value.toString(2).padStart(width, '0');
	return bits.slice(0, start1 - 1) + encoded + bits.slice(end1);
}
```

- [ ] **Step 4: 통과를 확인한다**

Run: `npx tsx --test "lib/deck-code/bits.test.ts"`
Expected: PASS — tests 7 / pass 7

- [ ] **Step 5: 커밋**

```bash
git add lib/deck-code/bits.ts lib/deck-code/bits.test.ts
git commit -m "feat(deck-code): 비트 문자열 조작"
```

---

### Task 5: 46비트 블록 배치

**Files:**
- Create: `lib/deck-code/layout.ts`
- Test: `lib/deck-code/layout.test.ts`

**Interfaces:**
- Consumes: `readField` · `writeField` (Task 4)
- Produces: `TOTAL_BITS` · `BLOCK_BITS` · `FIELD` · `sinnerOf(id)` · `indexOf(id)` · `identityId(sinner, index)` · `egoId(sinner, index)` · `readBlock(bits, sinnerId)` · `writeBlock(bits, sinnerId, block)` · `type Block`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`lib/deck-code/layout.test.ts`:

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
	TOTAL_BITS, BLOCK_BITS, FIELD,
	sinnerOf, indexOf, identityId, egoId,
	readBlock, writeBlock, emptyBits,
} from './layout';

test('560 = 46 × 12 + 8', () => {
	assert.equal(BLOCK_BITS, 46);
	assert.equal(TOTAL_BITS, 560);
	assert.equal(BLOCK_BITS * 12 + 8, TOTAL_BITS);
});

test('필드가 겹치지 않고 블록 안에 들어간다', () => {
	// 폭의 합(45)에 미사용 1비트를 더해 46이다. 합 자체가 배치의 근거는 아니며,
	// **겹치지 않는 것**이 근거다 — 겹치면 한 필드를 쓸 때 다른 필드가 망가진다.
	const spans = [...Object.values(FIELD)].sort((a, b) => a[0] - b[0]);
	assert.equal(spans[0]![0] >= 1, true);
	assert.equal(spans.at(-1)![1] <= BLOCK_BITS, true);
	for (let i = 1; i < spans.length; i += 1) {
		assert.equal(spans[i]![0] > spans[i - 1]![1], true, `${i}번째 필드가 앞 필드와 겹친다`);
	}
	assert.equal(spans.reduce((a, [s, e]) => a + e - s + 1, 0), 45);
});

test('id 에서 수감자와 순번을 뽑는다', () => {
	assert.equal(sinnerOf(10508), 5);
	assert.equal(indexOf(10508), 8);
	assert.equal(sinnerOf(20509), 5);
	assert.equal(indexOf(20509), 9);
	assert.equal(sinnerOf(11216), 12);
	assert.equal(indexOf(11216), 16);
});

test('수감자와 순번에서 id 를 만든다', () => {
	assert.equal(identityId(5, 8), 10508);
	assert.equal(identityId(12, 16), 11216);
	assert.equal(egoId(5, 9), 20509);
});

test('가이드 예시 블록을 읽는다', () => {
	// 가이드가 제시한 블록: 인격 1 · 미편성 · ZAYIN 1
	const block = '0000000100000000001000000000000000000000000000';
	assert.equal(block.length, BLOCK_BITS);
	const bits = block + '0'.repeat(TOTAL_BITS - BLOCK_BITS);
	const b = readBlock(bits, 1);
	assert.equal(b.identityIndex, 1);
	assert.equal(b.order, 0);
	assert.equal(b.egoIndex.ZAYIN, 1);
});

test('블록을 쓰고 읽으면 같다', () => {
	const b = {
		identityIndex: 16,
		order: 3,
		egoIndex: { ZAYIN: 1, TETH: 2, HE: 3, WAW: 4, ALEPH: 0 },
	};
	const bits = writeBlock(emptyBits(), 7, b);
	assert.deepEqual(readBlock(bits, 7), b);
});

test('블록끼리 침범하지 않는다', () => {
	let bits = emptyBits();
	bits = writeBlock(bits, 1, { identityIndex: 5, order: 1, egoIndex: {} });
	bits = writeBlock(bits, 2, { identityIndex: 9, order: 2, egoIndex: {} });
	assert.equal(readBlock(bits, 1).identityIndex, 5);
	assert.equal(readBlock(bits, 2).identityIndex, 9);
});
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npx tsx --test "lib/deck-code/layout.test.ts"`
Expected: FAIL — `Cannot find module './layout'`

- [ ] **Step 3: 최소 구현**

`lib/deck-code/layout.ts`:

```ts
import { readField, writeField } from './bits';
import { EGO_RANKS, type EgoRank } from '@/lib/storage/schema';

/**
 * 덱 코드의 560비트 배치.
 *
 * 560 = 46 × 12 + 8. 수감자마다 46비트이고 끝의 8비트는 더미다.
 *
 * **가이드는 인격을 4비트(5–8)로 적었지만 그것으로는 모자란다.** 우리 스냅샷에서
 * 그레고르·로쟈·이상·파우스트·히스클리프가 인격 16종이라 15를 넘는다. 가이드도 그 경우
 * 앞의 빈 비트로 넘어갈 것이라고 추정만 해뒀다.
 *
 * 그래서 앞의 빈 자리를 포함한 **넓은 필드**로 읽고 쓴다. 값 1–15 는 좁게 볼 때와 결과가
 * 같으므로 기존 코드를 해석하는 데 문제가 없고, 16 이상도 담긴다.
 *
 * **다만 이 배치는 가이드의 빈 자리를 앞 필드에 붙인 것일 뿐 확인된 것이 아니다.**
 * 폭의 합은 45이고 1비트가 남는다. 남는 자리를 `identity` 에 붙여 `[1, 8]` 로 잡으면
 * 합이 46이 되지만 그쪽이 더 옳다는 근거도 없다 — 어느 쪽이든 값이 15 이하인 동안은
 * 결과가 같고, 16 이상에서만 갈린다. 실물 코드로만 정해진다.
 *
 * **읽기가 이 해석에 기대는 전제가 하나 있다.** 넓게 읽어도 값이 같으려면 가이드가
 * 비워둔 자리(1 · 13–15 · 20–22 · 27–29 · 34–36)가 실제 코드에서도 0이어야 한다.
 * 거기에 다른 것이 들어 있으면 인격·E.G.O 인덱스를 잘못 읽는다. 이것도 실물 코드로만
 * 확인된다(07-recommendation-system 7.4).
 */
export const BLOCK_BITS = 46;
export const TOTAL_BITS = 560;

/** 1-기준 포함 구간. 비트 1은 미사용이다. */
export const FIELD = {
	identity: [2, 8],
	order: [9, 12],
	ZAYIN: [13, 19],
	TETH: [20, 26],
	HE: [27, 33],
	WAW: [34, 40],
	ALEPH: [41, 46],
} as const satisfies Record<string, readonly [number, number]>;

export interface Block {
	identityIndex: number;
	/** 편성 순서. 0 이면 미편성 */
	order: number;
	egoIndex: Partial<Record<EgoRank, number>>;
}

export const emptyBits = (): string => '0'.repeat(TOTAL_BITS);

const base = (sinnerId: number): number => (sinnerId - 1) * BLOCK_BITS;

/** id 는 `1|수감자(2)|순번(2)` 이다. 전수 검증으로 위반 0을 확인했다(07 7.2). */
export const sinnerOf = (id: number): number => Math.floor(id / 100) % 100;
export const indexOf = (id: number): number => id % 100;
export const identityId = (sinner: number, index: number): number => 10000 + sinner * 100 + index;
export const egoId = (sinner: number, index: number): number => 20000 + sinner * 100 + index;

export function readBlock(bits: string, sinnerId: number): Block {
	const b = base(sinnerId);
	const at = ([s, e]: readonly [number, number]) => readField(bits, b + s, b + e);
	const egoIndex: Partial<Record<EgoRank, number>> = {};
	for (const rank of EGO_RANKS) egoIndex[rank] = at(FIELD[rank]);
	return { identityIndex: at(FIELD.identity), order: at(FIELD.order), egoIndex };
}

export function writeBlock(bits: string, sinnerId: number, block: Block): string {
	const b = base(sinnerId);
	let out = bits;
	const put = ([s, e]: readonly [number, number], v: number) => {
		out = writeField(out, b + s, b + e, v);
	};
	put(FIELD.identity, block.identityIndex);
	put(FIELD.order, block.order);
	for (const rank of EGO_RANKS) put(FIELD[rank], block.egoIndex[rank] ?? 0);
	return out;
}
```

- [ ] **Step 4: 통과를 확인한다**

Run: `npx tsx --test "lib/deck-code/layout.test.ts"`
Expected: PASS — tests 7 / pass 7

가이드 예시 블록 테스트가 배치의 근거다. 실패하면 구현이 아니라 **배치 해석을 다시 본다.**

- [ ] **Step 5: 커밋**

```bash
git add lib/deck-code/layout.ts lib/deck-code/layout.test.ts
git commit -m "feat(deck-code): 560비트 배치와 id 인덱스 산출"
```

---

### Task 6a: 이식 가능한 base64 와 gzip

**Files:**
- Create: `lib/deck-code/bytes.ts`
- Test: `lib/deck-code/bytes.test.ts`

**Interfaces:**
- Consumes: 없음
- Produces: `toBase64(Uint8Array): string` · `fromBase64(string): Uint8Array` · `gzip(Uint8Array): Promise<Uint8Array>` · `gunzip(Uint8Array): Promise<Uint8Array>`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`lib/deck-code/bytes.test.ts`:

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toBase64, fromBase64, gzip, gunzip } from './bytes';

test('base64 바이너리 왕복', () => {
	const src = new Uint8Array([0, 1, 127, 128, 255, 0x1f, 0x8b]);
	assert.deepEqual([...fromBase64(toBase64(src))], [...src]);
});

test('base64 가 표준 결과와 같다', () => {
	const src = new Uint8Array([0x1f, 0x8b, 0x08, 0, 255, 42]);
	assert.equal(toBase64(src), Buffer.from(src).toString('base64'));
});

test('70바이트(560비트) 왕복', () => {
	const src = new Uint8Array(70).map((_, i) => (i * 37) % 256);
	assert.deepEqual([...fromBase64(toBase64(src))], [...src]);
});

test('gzip 왕복', async () => {
	const src = new TextEncoder().encode('hello deck code');
	assert.deepEqual([...(await gunzip(await gzip(src)))], [...src]);
});

test('gzip 매직 넘버를 갖는다', async () => {
	const out = await gzip(new TextEncoder().encode('x'));
	assert.deepEqual([...out.slice(0, 3)], [0x1f, 0x8b, 0x08]);
});

test('표준 gzip 산출물을 푼다', async () => {
	const { gzipSync } = await import('node:zlib');
	const z = new Uint8Array(gzipSync(Buffer.from('상호운용')));
	assert.equal(new TextDecoder().decode(await gunzip(z)), '상호운용');
});
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npx tsx --test "lib/deck-code/bytes.test.ts"`
Expected: FAIL — `Cannot find module './bytes'`

- [ ] **Step 3: 최소 구현**

`lib/deck-code/bytes.ts`:

```ts
/**
 * base64 와 gzip — 브라우저와 Node 양쪽에서 같은 구현으로 돈다.
 *
 * `node:zlib` 과 `Buffer` 를 쓰지 않는다. 이 코드가 클라이언트 컴포넌트에서 불리므로
 * Node 전용 모듈을 쓰면 번들러 폴리필에 의존하게 되고, 그 동작은 우리가 보증할 수 없다.
 * `CompressionStream` 과 `btoa`/`atob` 는 Node 22+ 와 현행 브라우저에 전역으로 있다.
 *
 * 실측 — `CompressionStream` 출력이 gzip 매직(1f 8b 08)을 갖고 `node:zlib` 산출물과
 * 상호운용되며, `btoa` 결과가 `Buffer.toString('base64')` 와 바이트 단위로 같다.
 */

/** 스프레드로 넘기면 인자 수 상한에 걸린다. 560비트는 70바이트라 여유가 있지만 청크로 나눈다. */
export function toBase64(bytes: Uint8Array): string {
	let binary = '';
	const CHUNK = 0x8000;
	for (let i = 0; i < bytes.length; i += CHUNK) {
		binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
	}
	return btoa(binary);
}

export function fromBase64(text: string): Uint8Array {
	return Uint8Array.from(atob(text), (c) => c.charCodeAt(0));
}

/**
 * 스트림 하나를 통과시킨다.
 *
 * **쓰기 쪽 프로미스를 버리면 안 된다.** 잘못된 gzip 을 넣으면 스트림이 에러 나고
 * `write()`·`close()` 가 거부되는데, 핸들러가 없으면 unhandled rejection 이 되어
 * **읽기 쪽에서 정상적으로 잡은 뒤에 프로세스가 죽는다.** 실측으로 확인했다 —
 * `void writer.write(...)` 로 두면 `Result` 는 제대로 돌아오고 그 다음 틱에 종료 코드 1.
 * 읽기 쪽이 같은 에러를 던져 주므로 쓰기 쪽 거부는 삼켜도 정보가 사라지지 않는다.
 */
async function through(stream: TransformStream<Uint8Array, Uint8Array>, bytes: Uint8Array) {
	const writer = stream.writable.getWriter();
	const swallow = () => {};
	writer.write(bytes).catch(swallow);
	writer.close().catch(swallow);
	return new Uint8Array(await new Response(stream.readable).arrayBuffer());
}

export const gzip = (bytes: Uint8Array): Promise<Uint8Array> =>
	through(new CompressionStream('gzip'), bytes);

export const gunzip = (bytes: Uint8Array): Promise<Uint8Array> =>
	through(new DecompressionStream('gzip'), bytes);
```

- [ ] **Step 4: 통과를 확인한다**

Run: `npx tsx --test "lib/deck-code/bytes.test.ts"`
Expected: PASS — tests 6 / pass 6

- [ ] **Step 5: 커밋**

```bash
git add lib/deck-code/bytes.ts lib/deck-code/bytes.test.ts
git commit -m "feat(deck-code): 브라우저와 Node 공용 base64·gzip"
```

---

### Task 6b: 덱 코드 인코드와 디코드

**Files:**
- Create: `lib/deck-code/codec.ts`
- Test: `lib/deck-code/codec.test.ts`

**Interfaces:**
- Consumes: `bytesToBits` · `bitsToBytes` (Task 4) · `readBlock` · `writeBlock` · `emptyBits` · `TOTAL_BITS` · `indexOf` · `identityId` · `egoId` (Task 5) · `toBase64` · `fromBase64` · `gzip` · `gunzip` (Task 6a) · `Result` · `ok` · `err` (Task 1) · `StoredDeck` · `emptyDeck` · `EGO_RANKS` (Task 2)
- Produces: `decodeDeckCode(code): Promise<Result<string>>` · `encodeDeckCode(bits): Promise<Result<string>>` · `deckFromCode(code, name): Promise<Result<StoredDeck>>` · `deckToCode(deck): Promise<Result<string>>` · `HEADER` · `unverifiedIndexes(deck): number[]`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`lib/deck-code/codec.test.ts`:

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyBits, writeBlock, TOTAL_BITS } from './layout';
import { decodeDeckCode, encodeDeckCode, deckFromCode, deckToCode, unverifiedIndexes } from './codec';
import { emptyDeck } from '@/lib/storage/schema';

function sampleBits(): string {
	let bits = emptyBits();
	bits = writeBlock(bits, 1, { identityIndex: 1, order: 1, egoIndex: { ZAYIN: 1 } });
	bits = writeBlock(bits, 5, { identityIndex: 8, order: 2, egoIndex: { TETH: 3 } });
	return bits;
}

test('인코드한 것을 디코드하면 같은 비트', async () => {
	const bits = sampleBits();
	const code = await encodeDeckCode(bits);
	assert.equal(code.ok, true);
	if (!code.ok) return;
	const back = await decodeDeckCode(code.value);
	assert.equal(back.ok, true);
	if (back.ok) assert.equal(back.value, bits);
});

test('디코드 결과는 560비트', async () => {
	const code = await encodeDeckCode(sampleBits());
	assert.equal(code.ok, true);
	if (!code.ok) return;
	const back = await decodeDeckCode(code.value);
	if (back.ok) assert.equal(back.value.length, TOTAL_BITS);
});

test('덱 왕복이 일치한다', async () => {
	const d = emptyDeck('원본', 'id-1');
	d.slots[0]!.identityId = 10101;
	d.slots[0]!.egos.ZAYIN = 20101;
	d.slots[4]!.identityId = 10508;
	d.slots[4]!.egos.TETH = 20503;
	d.deployed = [1, 5];

	const code = await deckToCode(d);
	assert.equal(code.ok, true);
	if (!code.ok) return;

	const back = await deckFromCode(code.value, '복원');
	assert.equal(back.ok, true);
	if (!back.ok) return;
	assert.equal(back.value.slots[0]?.identityId, 10101);
	assert.equal(back.value.slots[0]?.egos.ZAYIN, 20101);
	assert.equal(back.value.slots[4]?.identityId, 10508);
	assert.equal(back.value.slots[4]?.egos.TETH, 20503);
	assert.deepEqual(back.value.deployed, [1, 5]);
});

test('빈 칸은 null 로 돌아온다', async () => {
	const d = emptyDeck('빈 덱', 'id-2');
	const code = await deckToCode(d);
	if (!code.ok) return assert.fail(code.reason);
	const back = await deckFromCode(code.value, 'x');
	if (!back.ok) return assert.fail(back.reason);
	assert.equal(back.value.slots.every((s) => s.identityId === null), true);
	assert.deepEqual(back.value.deployed, []);
});

test('16번째 인격도 왕복한다', async () => {
	const d = emptyDeck('16번', 'id-3');
	d.slots[11]!.identityId = 11216;
	const code = await deckToCode(d);
	if (!code.ok) return assert.fail(code.reason);
	const back = await deckFromCode(code.value, 'x');
	if (!back.ok) return assert.fail(back.reason);
	assert.equal(back.value.slots[11]?.identityId, 11216);
});

test('16 이상 인격을 미검증으로 보고한다', () => {
	const d = emptyDeck('16번', 'id-4');
	d.slots[11]!.identityId = 11216;
	d.slots[0]!.identityId = 10101;
	assert.deepEqual(unverifiedIndexes(d), [11216]);
});

test('쓰레기 코드를 어느 단계에서 실패했는지와 함께 알린다', async () => {
	const notB64 = await decodeDeckCode('!!!not base64!!!');
	assert.equal(notB64.ok, false);
	if (!notB64.ok) assert.match(notB64.reason, /base64/);

	const notGzip = await decodeDeckCode('aGVsbG8='); // base64 는 되지만 gzip 이 아니다
	assert.equal(notGzip.ok, false);
	if (!notGzip.ok) assert.match(notGzip.reason, /gzip/);
});

test('디코드가 실패해도 프로세스가 죽지 않는다', async () => {
	// 스트림 쓰기 쪽 거부를 버리면 여기서 Result 는 정상인데 다음 틱에 프로세스가 죽는다.
	// 이 테스트는 assert 로 잡히지 않고 **러너가 종료 코드 1 로 죽는 것**으로 드러난다.
	await decodeDeckCode('aGVsbG8=');
	await new Promise((r) => setTimeout(r, 50));
});
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npx tsx --test "lib/deck-code/codec.test.ts"`
Expected: FAIL — `Cannot find module './codec'`

- [ ] **Step 3: 최소 구현**

`lib/deck-code/codec.ts`:

```ts
import { ok, err, type Result } from '@/lib/storage/kv';
import { EGO_RANKS, emptyDeck, type StoredDeck } from '@/lib/storage/schema';
import { bitsToBytes, bytesToBits } from './bits';
import { toBase64, fromBase64, gzip, gunzip } from './bytes';
import {
	TOTAL_BITS, emptyBits, readBlock, writeBlock,
	identityId, egoId, indexOf,
} from './layout';

/**
 * 인게임 덱 코드 변환.
 *
 * 파이프라인은 가이드 그대로다.
 *   디코드  base64 → gzip 해제 → base64 → 비트
 *   인코드  비트 → 바이트 → base64 → gzip → base64
 *
 * base64 가 두 번 나오는 것이 이상해 보이지만 가이드가 그렇게 적었고, 왕복 테스트가
 * 그 순서를 고정한다. 순서를 바꾸면 왕복은 여전히 맞지만 인게임 코드를 못 읽는다.
 */

/** 가이드가 알려준 인게임 헤더. 내용물이 같으면 헤더가 달라도 동작한다고 한다. */
export const HEADER = 'H4sIAAAAAAAACh';

const utf8 = new TextEncoder();
const decodeUtf8 = new TextDecoder();

/**
 * 어느 단계에서 실패했는지 밝힌다(`07-recommendation-system.md` 8절).
 *
 * **단계 이름은 우리가 붙인다.** 「`atob` 과 `DecompressionStream` 의 에러는 `message` 가
 * 비어 있다」를 근거로 적었으나 **실측하니 성립하지 않는다** — `atob` 은 `Invalid character`
 * 를 던진다. 그래도 쪼개는 이유는 그 문구가 사용자에게 base64 얘기인지 알려주지 않아서다.
 *
 * gzip 은 `try` 가 아니라 매직(`1f 8b`) 선검사로 가로챈다. 표기 때문만이 아니라 Task 6a 의
 * 미관측 프라미스가 처리되지 않은 거부로 새는 것을 막기 위해서다 — `DecompressionStream` 에
 * 잘못된 입력을 넣는 일 자체를 만들지 않는다.
 */
export async function decodeDeckCode(code: string): Promise<Result<string>> {
	let compressed: Uint8Array;
	try {
		compressed = fromBase64(code.trim());
	} catch {
		return err('덱 코드를 풀지 못했다: base64 가 아니다');
	}

	if (compressed.length < 2 || compressed[0] !== 0x1f || compressed[1] !== 0x8b) {
		return err('덱 코드를 풀지 못했다: gzip 매직이 아니다');
	}

	let bits: string;
	try {
		const inflated = await gunzip(compressed);
		// 「푼 내용이 base64 가 아님」은 gunzip 실패와 문구를 공유한다. 유효한 gzip 안에
		// 비-base64 가 들어 있어야 도달하므로 실제 덱 코드로는 나오지 않는다.
		bits = bytesToBits(fromBase64(decodeUtf8.decode(inflated)));
	} catch (cause) {
		return err(`덱 코드를 풀지 못했다: ${(cause as Error).message || 'gzip 으로 풀리지 않는다'}`);
	}

	if (bits.length !== TOTAL_BITS) {
		return err(`비트 길이가 ${TOTAL_BITS} 이 아니다: ${bits.length}`);
	}
	return ok(bits);
}

export async function encodeDeckCode(bits: string): Promise<Result<string>> {
	if (bits.length !== TOTAL_BITS) return err(`비트 길이가 ${TOTAL_BITS} 이 아니다: ${bits.length}`);
	try {
		const inner = toBase64(bitsToBytes(bits));
		return ok(toBase64(await gzip(utf8.encode(inner))));
	} catch (cause) {
		return err(`덱 코드를 만들지 못했다: ${(cause as Error).message}`);
	}
}

export async function deckFromCode(code: string, name: string): Promise<Result<StoredDeck>> {
	const decoded = await decodeDeckCode(code);
	if (!decoded.ok) return decoded;

	const deck = emptyDeck(name);
	const ordered: Array<{ order: number; sinnerId: number }> = [];

	for (const slot of deck.slots) {
		const block = readBlock(decoded.value, slot.sinnerId);
		if (block.identityIndex > 0) slot.identityId = identityId(slot.sinnerId, block.identityIndex);
		for (const rank of EGO_RANKS) {
			const idx = block.egoIndex[rank] ?? 0;
			if (idx > 0) slot.egos[rank] = egoId(slot.sinnerId, idx);
		}
		if (block.order > 0) ordered.push({ order: block.order, sinnerId: slot.sinnerId });
	}

	ordered.sort((a, b) => a.order - b.order);
	deck.deployed = ordered.map((o) => o.sinnerId);
	return ok(deck);
}

export function deckToCode(deck: StoredDeck): Promise<Result<string>> {
	let bits = emptyBits();
	for (const slot of deck.slots) {
		const order = deck.deployed.indexOf(slot.sinnerId);
		const egoIndex: Partial<Record<(typeof EGO_RANKS)[number], number>> = {};
		for (const rank of EGO_RANKS) {
			const id = slot.egos[rank];
			if (id !== undefined) egoIndex[rank] = indexOf(id);
		}
		bits = writeBlock(bits, slot.sinnerId, {
			identityIndex: slot.identityId === null ? 0 : indexOf(slot.identityId),
			order: order === -1 ? 0 : order + 1,
			egoIndex,
		});
	}
	return encodeDeckCode(bits);
}

/**
 * 인게임 검증이 안 된 인격들.
 *
 * 순번 16 이상은 가이드가 추정만 해둔 구간이라 내보낸 코드가 게임에서 동작하는지 모른다.
 * 화면이 이 목록으로 경고를 띄운다.
 */
export function unverifiedIndexes(deck: StoredDeck): number[] {
	return deck.slots
		.map((s) => s.identityId)
		.filter((id): id is number => id !== null && indexOf(id) > 15);
}
```

- [ ] **Step 4: 통과를 확인한다**

Run: `npx tsx --test "lib/**/*.test.ts"`
Expected: PASS — fail 0

- [ ] **Step 5: 실제 인격 id 로 왕복을 확인한다**

DB 를 띄우고 실제 id 로 왕복이 성립하는지 본다. 합성 id 만으로는 `identityId()` 의 역산이 맞는지 알 수 없다.

```bash
npm run db:up
npx tsx -e "
import { deckToCode, deckFromCode } from './lib/deck-code/codec';
import { emptyDeck } from './lib/storage/schema';
import { db } from './lib/db';
const rows = await db.identity.findMany({ orderBy: { id: 'asc' } });
const bySinner = new Map<number, number>();
for (const r of rows) if (!bySinner.has(r.sinnerId)) bySinner.set(r.sinnerId, r.id);
const d = emptyDeck('전수');
for (const s of d.slots) s.identityId = bySinner.get(s.sinnerId) ?? null;
const code = await deckToCode(d);
if (!code.ok) throw new Error(code.reason);
const back = await deckFromCode(code.value, 'x');
if (!back.ok) throw new Error(back.reason);
const same = d.slots.every((s, i) => s.identityId === back.value.slots[i]?.identityId);
console.log('왕복 일치:', same);
await db.\$disconnect();
"
npm run db:down
```

Expected: `왕복 일치: true`

- [ ] **Step 6: 커밋**

```bash
git add lib/deck-code/codec.ts lib/deck-code/codec.test.ts
git commit -m "feat(deck-code): 인게임 덱 코드 인코드와 디코드"
```

---

### Task 7: 편성 편집기

**Files:**
- Create: `components/deck-editor.tsx`
- Modify: `app/[locale]/squad/page.tsx`

**Interfaces:**
- Consumes: `readDecks` · `writeDecks` (Task 3) · `emptyDeck` · `EGO_RANKS` · `DEPLOY_MAX` · `DECK_MAX` · `StoredDeck` (Task 2) · `listSquad()` 반환값 (기존 `lib/queries/squad.ts`)
- Produces: `<DeckEditor squad={...} labels={...} />`

`listSquad()` 는 이미 수감자별 `identities[]`(id·rarity·text)와 `egos[]`(id·rank·text)를 준다. **새 질의를 만들지 않는다.**

- [ ] **Step 1: 편집기를 만든다**

`components/deck-editor.tsx`:

```tsx
'use client';

import { useEffect, useState } from 'react';
import { readDecks, writeDecks } from '@/lib/storage/decks';
import { DECK_MAX, DEPLOY_MAX, EGO_RANKS, emptyDeck, type StoredDeck } from '@/lib/storage/schema';
import type { SquadSinner } from '@/lib/queries/squad';

/**
 * 편성 편집.
 *
 * 수감자 12칸은 고정 축이다. 배열 인덱스가 곧 수감자라 한 수감자에 인격 둘이 들어가는
 * 상태를 만들 수 없다 — 현행 슬라이스 덱(11009·11013이 둘 다 수감자 10)이 그 실수였다.
 *
 * E.G.O 는 등급당 하나이며 **지금은 추천 점수에 반영되지 않는다.** 화면에 그 사실을 적는다.
 * 적지 않으면 입력해 두고 왜 안 바뀌냐는 오해가 남는다(07-recommendation-system 5.1).
 */
/**
 * 이 칸이 가리키는 것 중 우리 데이터에 없는 id.
 *
 * 저장분과 덱 코드는 우리 데이터베이스를 거치지 않고 들어온다. 패치 전에 만든 덱 코드나
 * 아직 적재되지 않은 인격을 가리킬 수 있고, 그때 화면이 조용히 빈칸으로 보이면 안 된다.
 */
function missingRefs(slot: StoredDeck['slots'][number], sinner: SquadSinner | undefined): string[] {
	const out: string[] = [];
	if (slot.identityId !== null && !sinner?.identities.some((i) => i.id === slot.identityId)) {
		out.push(`인격 ${slot.identityId}`);
	}
	for (const rank of EGO_RANKS) {
		const id = slot.egos[rank];
		if (id !== undefined && !sinner?.egos.some((e) => e.id === id)) out.push(`${rank} ${id}`);
	}
	return out;
}

export function DeckEditor({ squad, ko }: { squad: SquadSinner[]; ko: boolean }) {
	const [decks, setDecks] = useState<StoredDeck[]>([]);
	const [activeId, setActiveId] = useState<string | null>(null);
	const [notice, setNotice] = useState<string | null>(null);
	/**
	 * 읽기가 실패했는가.
	 *
	 * **이 상태에서는 쓰지 않는다.** 읽기에 실패하면 `decks` 는 빈 배열인데, 그 상태로
	 * 「새 덱」을 누르면 `writeDecks` 가 `limbus:decks` 를 통째로 덮어 **읽지 못한 저장분이
	 * 그 순간 사라진다.** 저장소 계층이 "읽기가 실패해도 지우지 않는다"를 지켜도 화면이
	 * 덮으면 소용이 없다(07-recommendation-system 4.2).
	 */
	const [locked, setLocked] = useState(false);

	useEffect(() => {
		const r = readDecks(window.localStorage);
		if (!r.ok) {
			setLocked(true);
			return setNotice(r.reason);
		}
		setDecks(r.value);
		setActiveId(r.value[0]?.id ?? null);
	}, []);

	const active = decks.find((d) => d.id === activeId) ?? null;

	function persist(next: StoredDeck[]) {
		if (locked) {
			return setNotice(
				ko
					? '저장분을 읽지 못해 편집을 잠갔습니다. 덮어쓰면 읽지 못한 덱이 사라집니다.'
					: 'Editing is locked because the saved data could not be read; writing would destroy it.',
			);
		}
		setDecks(next);
		const r = writeDecks(window.localStorage, next);
		setNotice(r.ok ? null : r.reason);
	}

	function update(fn: (d: StoredDeck) => void) {
		if (!active) return;
		const next = decks.map((d) => {
			if (d.id !== active.id) return d;
			const copy: StoredDeck = structuredClone(d);
			fn(copy);
			copy.updatedAt = new Date().toISOString();
			return copy;
		});
		persist(next);
	}

	function addDeck() {
		if (decks.length >= DECK_MAX) return setNotice(ko ? `덱은 ${DECK_MAX}개까지입니다` : `Max ${DECK_MAX} decks`);
		const d = emptyDeck(ko ? `덱 ${decks.length + 1}` : `Deck ${decks.length + 1}`);
		persist([...decks, d]);
		setActiveId(d.id);
	}

	function removeDeck(id: string) {
		const next = decks.filter((d) => d.id !== id);
		persist(next);
		if (activeId === id) setActiveId(next[0]?.id ?? null);
	}

	return (
		<section className="deck-editor">
			{notice && <p className="notice" role="status">{notice}</p>}

			<div className="filters">
				{decks.map((d) => (
					<button
						key={d.id}
						type="button"
						className="chip"
						aria-pressed={d.id === activeId}
						onClick={() => setActiveId(d.id)}
					>
						{d.name}
					</button>
				))}
				<button type="button" className="chip" onClick={addDeck} disabled={locked}>
					{ko ? '새 덱' : 'New'}
				</button>
				{active && (
					<button type="button" className="chip" onClick={() => removeDeck(active.id)} disabled={locked}>
						{ko ? '삭제' : 'Delete'}
					</button>
				)}
			</div>

			{!active ? (
				<p className="lede">{ko ? '덱을 만들어 편성을 시작합니다.' : 'Create a deck to begin.'}</p>
			) : (
				<>
					<label className="deck-name">
						<span>{ko ? '덱 이름' : 'Deck name'}</span>
						<input
							value={active.name}
							onChange={(e) => update((d) => { d.name = e.target.value; })}
						/>
					</label>

					<p className="lede">
						{ko
							? `출전 ${active.deployed.length}/${DEPLOY_MAX} · E.G.O는 현재 추천 점수에 반영되지 않습니다.`
							: `Deployed ${active.deployed.length}/${DEPLOY_MAX} · E.G.O does not affect scoring yet.`}
					</p>

					<ul className="plain deck-slots">
						{active.slots.map((slot) => {
							const sinner = squad.find((s) => s.id === slot.sinnerId);
							const deployed = active.deployed.includes(slot.sinnerId);
							const missing = missingRefs(slot, sinner);
							return (
								<li key={slot.sinnerId} className="deck-slot">
									<strong>{sinner?.text?.name ?? `#${slot.sinnerId}`}</strong>

									{/*
									  저장분이나 덱 코드가 우리 데이터에 없는 id 를 가리킬 수 있다 — 패치 전에 만든
									  코드이거나 아직 적재되지 않은 인격이다. `select` 는 매칭되는 `option` 이 없으면
									  그냥 빈칸으로 보이는데, 그러면 "고르지 않음"과 구별되지 않아 결손을 지어내는
									  쪽이 된다(02-data-model 6절 · 07-recommendation-system 8절).
									  칸에만 표기하고 런은 막지 않는다. 인격과 E.G.O 둘 다 본다.
									*/}
									{missing.length > 0 && (
										<em className="missing">
											{ko ? `데이터에 없음: ${missing.join(', ')}` : `Not in data: ${missing.join(', ')}`}
										</em>
									)}

									<select
										value={slot.identityId ?? ''}
										onChange={(e) =>
											update((d) => {
												const s = d.slots.find((x) => x.sinnerId === slot.sinnerId)!;
												s.identityId = e.target.value === '' ? null : Number(e.target.value);
											})
										}
									>
										<option value="">{ko ? '— 인격 —' : '— Identity —'}</option>
										{sinner?.identities.map((i) => (
											<option key={i.id} value={i.id}>{i.text?.name ?? i.id}</option>
										))}
									</select>

									<div className="ego-slots">
										{EGO_RANKS.map((rank) => {
											const options = sinner?.egos.filter((e) => e.rank === rank) ?? [];
											return (
												<select
													key={rank}
													aria-label={rank}
													disabled={options.length === 0}
													value={slot.egos[rank] ?? ''}
													onChange={(e) =>
														update((d) => {
															const s = d.slots.find((x) => x.sinnerId === slot.sinnerId)!;
															if (e.target.value === '') delete s.egos[rank];
															else s.egos[rank] = Number(e.target.value);
														})
													}
												>
													{/* 선택지가 없는 등급은 결손이 아니라 부재다. 칸은 남기고 비워 둔다. */}
													<option value="">{options.length === 0 ? `${rank} —` : rank}</option>
													{options.map((e) => (
														<option key={e.id} value={e.id}>{e.text?.name ?? e.id}</option>
													))}
												</select>
											);
										})}
									</div>

									<label className="deploy">
										<input
											type="checkbox"
											checked={deployed}
											onChange={() =>
												update((d) => {
													const at = d.deployed.indexOf(slot.sinnerId);
													if (at >= 0) d.deployed.splice(at, 1);
													else if (d.deployed.length < DEPLOY_MAX) d.deployed.push(slot.sinnerId);
												})
											}
										/>
										{ko ? '출전' : 'Deploy'}
									</label>
								</li>
							);
						})}
					</ul>
				</>
			)}
		</section>
	);
}
```

- [ ] **Step 2: 화면에 붙인다**

`app/[locale]/squad/page.tsx` — 기존 조회 목록은 그대로 두고, `SecLabel` 과 `lede` 문단 **다음**에 편집기를 넣는다.

임포트 추가:

```tsx
import { DeckEditor } from '@/components/deck-editor';
```

`lede` 문단 바로 아래에 삽입:

```tsx
			<DeckEditor squad={sinners} ko={ko} />
```

- [ ] **Step 3: 스타일을 더한다**

`app/globals.css` 끝에 추가한다. 기존 토큰과 클래스 이름 규칙을 따른다.

```css
/* 편성 편집 — 수감자 12칸 고정 축 */
.deck-editor { margin: 1.5rem 0; }
.deck-name { display: flex; gap: .5rem; align-items: center; margin: .5rem 0; }
.deck-name input { flex: 0 1 18rem; }
.deck-slots { display: grid; gap: .5rem; }
.deck-slot {
	display: grid;
	grid-template-columns: 8rem 12rem 1fr auto;
	gap: .5rem;
	align-items: center;
}
.ego-slots { display: flex; gap: .25rem; flex-wrap: wrap; }
.ego-slots select { max-width: 9rem; }
.deploy { display: flex; gap: .25rem; align-items: center; white-space: nowrap; }
.notice { padding: .5rem .75rem; border: 1px solid currentColor; border-radius: 4px; }
/* 참조가 데이터에 없을 때. 빈칸으로 두면 "고르지 않음"과 구별되지 않는다 */
.missing { font-size: .8rem; opacity: .75; }
@media (max-width: 900px) {
	.deck-slot { grid-template-columns: 1fr; }
}
```

- [ ] **Step 4: 타입과 빌드를 확인한다**

Run: `npm run typecheck && npm run build`
Expected: 오류 0 · Compiled successfully

- [ ] **Step 5: 브라우저로 확인한다**

```bash
npm run db:up && npm run dev
```

`http://localhost:3000/ko/squad` 에서 확인한다.

- 기존 수감자별 인격·E.G.O 조회 목록이 **그대로 보인다**
- 「새 덱」으로 덱을 만들면 수감자 12칸이 뜬다
- 인격을 고르면 그 수감자의 인격만 나온다
- ALEPH 칸은 비활성이고 선택지가 없다
- 출전을 8명째 체크하면 더 안 켜진다
- 새로고침해도 덱이 남아 있다

**읽기 실패가 저장분을 지우지 않는지 확인한다.** 이 경로를 실제로 밟아 봐야 한다.

```js
// 개발자 콘솔에서 — 저장분은 그대로 두고 버전만 어긋나게 만든다
localStorage.setItem('limbus:schema', '99');
location.reload();
```

- 스키마 버전이 다르다는 표기가 뜬다
- 「새 덱」·「삭제」가 **비활성**이다
- `localStorage.getItem('limbus:decks')` 가 **그대로 남아 있다**

```js
localStorage.setItem('limbus:schema', '1');   // 되돌린다
```

- [ ] **Step 6: 커밋**

```bash
git add components/deck-editor.tsx "app/[locale]/squad/page.tsx" app/globals.css
git commit -m "feat(web): 편성 편집 — 수감자 12칸과 출전 지정"
```

---

### Task 8: 덱 코드 입출력 화면

**Files:**
- Create: `components/deck-code-io.tsx`
- Modify: `components/deck-editor.tsx`

**Interfaces:**
- Consumes: `deckFromCode` · `deckToCode` · `unverifiedIndexes` (Task 6b) · `StoredDeck` (Task 2)
- Produces: `<DeckCodeIo deck={...} onImport={...} ko={...} />`

- [ ] **Step 1: 입출력 컴포넌트를 만든다**

`components/deck-code-io.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { deckFromCode, deckToCode, unverifiedIndexes } from '@/lib/deck-code/codec';
import type { StoredDeck } from '@/lib/storage/schema';

/**
 * 인게임 덱 코드 입출력.
 *
 * 내보내기에 경고가 붙는 경우가 있다 — 순번 16 이상 인격이 든 덱이다. 가이드가 그 구간의
 * 인코딩을 추정만 해뒀고 인게임에서 확인된 적이 없다(07-recommendation-system 7.4).
 * 되는 척하지 않고 미검증임을 밝힌다.
 */
export function DeckCodeIo({
	deck,
	onImport,
	ko,
}: {
	deck: StoredDeck | null;
	onImport: (deck: StoredDeck) => void;
	ko: boolean;
}) {
	const [input, setInput] = useState('');
	const [output, setOutput] = useState('');
	const [message, setMessage] = useState<string | null>(null);

	const unverified = deck ? unverifiedIndexes(deck) : [];

	async function importCode() {
		const r = await deckFromCode(input.trim(), ko ? '가져온 덱' : 'Imported deck');
		if (!r.ok) return setMessage(r.reason);
		setMessage(null);
		onImport(r.value);
	}

	async function exportCode() {
		if (!deck) return;
		const r = await deckToCode(deck);
		if (!r.ok) return setMessage(r.reason);
		setMessage(null);
		setOutput(r.value);
	}

	return (
		<div className="deck-code">
			<label>
				<span>{ko ? '덱 코드 가져오기' : 'Import deck code'}</span>
				<textarea rows={2} value={input} onChange={(e) => setInput(e.target.value)} />
			</label>
			<button type="button" className="chip" onClick={() => void importCode()} disabled={input.trim() === ''}>
				{ko ? '가져오기' : 'Import'}
			</button>

			<button type="button" className="chip" onClick={() => void exportCode()} disabled={deck === null}>
				{ko ? '덱 코드 만들기' : 'Export'}
			</button>
			{output !== '' && <textarea rows={2} readOnly value={output} />}

			{unverified.length > 0 && (
				<p className="notice" role="status">
					{ko
						? `인격 ${unverified.join(', ')} 는 캐릭터 내 16번째 이후라 내보낸 코드가 인게임에서 동작하는지 확인되지 않았습니다.`
						: `Identities ${unverified.join(', ')} are past the 16th for their sinner; the exported code is unverified in-game.`}
				</p>
			)}
			{message && <p className="notice" role="alert">{message}</p>}
		</div>
	);
}
```

- [ ] **Step 2: 편집기에 잇는다**

`components/deck-editor.tsx` 에 임포트를 추가한다.

```tsx
import { DeckCodeIo } from '@/components/deck-code-io';
```

덱 선택 `<div className="filters">` 블록 **바로 아래**에 넣는다.

```tsx
			<DeckCodeIo
				deck={active}
				ko={ko}
				onImport={(imported) => {
					if (decks.length >= DECK_MAX) return setNotice(ko ? `덱은 ${DECK_MAX}개까지입니다` : `Max ${DECK_MAX} decks`);
					persist([...decks, imported]);
					setActiveId(imported.id);
				}}
			/>
```

- [ ] **Step 3: 스타일을 더한다**

`app/globals.css` 의 편성 편집 블록 끝에 추가한다.

```css
.deck-code { display: flex; gap: .5rem; align-items: flex-start; flex-wrap: wrap; margin: .5rem 0; }
.deck-code label { display: flex; flex-direction: column; gap: .25rem; flex: 1 1 20rem; }
.deck-code textarea { width: 100%; font-family: monospace; font-size: .8rem; }
```

- [ ] **Step 4: 타입과 빌드를 확인한다**

Run: `npm test && npm run typecheck && npm run build`
Expected: 전부 통과

- [ ] **Step 5: 브라우저로 왕복을 확인한다**

`/ko/squad` 에서:

- 덱을 짜고 「덱 코드 만들기」 → 코드가 나온다
- 그 코드를 「덱 코드 가져오기」에 붙여 넣고 「가져오기」 → 같은 편성의 덱이 하나 더 생긴다
- 인격 16번째(예: 이상의 `LCE E.G.O:: 차원찢개`)를 넣으면 미검증 경고가 뜬다
- 아무 문자열이나 넣고 「가져오기」 → 어느 단계에서 실패했는지 메시지가 뜬다

- [ ] **Step 6: 커밋**

```bash
git add components/deck-code-io.tsx components/deck-editor.tsx app/globals.css
git commit -m "feat(web): 덱 코드 입출력"
```

---

### Task 9: 추천 질의가 편성과 출전을 나눠 받는다

**Files:**
- Modify: `lib/queries/recommend.ts`

**Interfaces:**
- Consumes: 기존 `recommendForDeck`
- Produces: `options.deployedIds` 추가. `RunState.deployed` 가 더 이상 `deck` 과 같지 않다

**엔진 브랜치의 작업이 이 한 줄에 달려 있다.** `feat/engine-deck-feature` 가 소속 조건의
판정 범위를 편성/출전으로 갈라 놓아도, 호출부가 `deployed: deck` 으로 두는 한 둘이 같은 값이라
**점수가 움직이지 않고 그쪽 작업이 관측되지 않는다.** 파일은 웹 소유이므로 여기서 가져간다
(`docs/07-recommendation-system.md` 9절).

`RunState` 는 이미 둘을 구분한다. **엔진 변경이 아니라 호출부 정정이다.**

- [ ] **Step 1: 옵션을 넓힌다**

```ts
export async function recommendForDeck(
	locale: Locale,
	options: {
		identityIds?: number[];
		/** 출전 인격 id. 비우면 편성 전체를 출전으로 본다(`RunState.deployed` 규약) */
		deployedIds?: number[];
		floor?: number;
		difficulty?: Difficulty;
		ownedIds?: number[];
	} = {},
): Promise<Recommendation> {
```

`state` 를 만드는 자리를 바꾼다. 인격을 다시 질의하지 않는다 — 이미 받아 온 `deck` 에서 고른다.

```ts
	// 편성 12 와 출전 7 은 다르다(06 2절 4항). 지금까지 호출부가 둘을 같게 두어
	// 소속 조건의 판정 범위 구분이 죽어 있었다.
	const deployedIds = new Set(options.deployedIds ?? []);
	const deployed = deployedIds.size > 0 ? deck.filter((i) => deployedIds.has(i.id)) : deck;
	const state: RunState = { deck, deployed, owned, floor };
```

- [ ] **Step 2: 화면이 전달하는지 확인한다**

`app/[locale]/recommend/page.tsx` 는 이 단계에서 여전히 슬라이스다(계획 B 가 새로 쓴다).
**질의 문자열로 출전을 받을 수 있게만 열어 둔다** — 없으면 지금과 동작이 같다.

- [ ] **Step 3: 구분이 실제로 갈리는지 확인한다**

```bash
npm run db:up && npm run dev
```

- `/ko/recommend` — 지금과 같은 결과 (출전 미지정이므로 편성 전체가 출전)
- `/ko/recommend?deployed=10216,11009,11216,10512` — 출전 4명. **덱 특성의 `affiliation.deployed`
  가 `affiliation.deck` 과 달라진다**

엔진 브랜치가 병합된 뒤라면 소속 조건의 근거 문자열에 `편성` 과 `출전` 이 갈려 나온다.
병합 전이라면 숫자만 갈리고 점수는 같다 — 그것이 정상이다.

- [ ] **Step 4: 확인하고 커밋**

Run: `npm run typecheck && npm run build && npm run engine:proof`
Expected: 전부 통과. **`engine:proof` 는 자기 상태를 직접 만들므로 이 변경과 무관하게 통과한다** —
실패하면 `deployed` 기본값이 예전과 달라진 것이니 되돌린다.

```bash
git add lib/queries/recommend.ts
git commit -m "fix(web): 추천 질의가 편성과 출전을 나눠 받는다"
```

---

### Task 10: 문서에 실측을 적고 마무리

**Files:**
- Modify: `docs/07-recommendation-system.md`
- Modify: `docs/superpowers/plans/2026-07-28-squad-deck-editor.md`

- [ ] **Step 1: CI 를 로컬에서 돌린다**

```bash
act pull_request -W .github/workflows/ci.yml -j check -P ubuntu-latest=catthehacker/ubuntu:act-latest
act pull_request -W .github/workflows/ci.yml -j guard -P ubuntu-latest=catthehacker/ubuntu:act-latest
```

Expected: 두 job 모두 `Job succeeded`. `단위 테스트` 단계가 목록에 보여야 한다.

- [ ] **Step 2: 문서를 실측으로 갱신한다**

`docs/07-recommendation-system.md` 7.4 의 미검증 다섯에 결과를 반영한다. 실물 코드를 아직 못 구했다면 표기를 그대로 두고, 구했다면 항목마다 갈린 결과를 적는다. 10절 검증표의 `덱 코드` 행에 왕복 일치 결과를 기록한다.

**7.0 의 출처 표도 함께 채운다.** 가이드 발췌를 `docs/reference/` 에 남기고 파일명과 확인 날짜를 적는다. 남기지 못했다면 그 사실을 12절 미결에 유지한다.

- [ ] **Step 3: 커밋하고 PR 을 연다**

```bash
git add docs/
git commit -m "docs: 편성·덱 코드 구현 실측 반영"
git push -u origin feat/recommendation-system
```

PR 제목: `feat(web): 편성 편집과 덱 코드 입출력`

---

## 자체 검토

**명세 대응** — `docs/07-recommendation-system.md` 중 이 계획이 덮는 범위:

| 명세 | 대응 |
| --- | --- |
| 4절 저장 모델 (`StoredDeck` · 스키마 버전) | Task 2·3 |
| 4.1 슬롯이 수감자 12 고정 · `deployed` 는 수감자 id | Task 2 (`emptyDeck`) · Task 7 |
| 4.1 `egos` 등급 키 레코드 · ALEPH 부재 | Task 2 · Task 7 (비활성 칸) |
| 4.2 버전 불일치 시 버리지 않음 | Task 3 (`readDecks` 테스트) · **Task 7 (`locked` — 화면이 덮지 않게)** |
| 5.1 편성 화면 · E.G.O 미반영 표기 | Task 7 |
| 6절 데이터 흐름 — `recommendForDeck` 이 편성·출전을 나눠 받음 | **Task 9** |
| 7.1 형식 · 7.2 id 인덱스 산출 | Task 5 · 6a · 6b |
| 7.3 16 이상 미검증 표기 | Task 5 (넓은 필드) · Task 6b (`unverifiedIndexes`) · Task 8 (경고) |
| 8절 오류 처리 — 저장 실패 · 스키마 불일치 · 디코드 실패(단계별) · 참조 결손 | Task 1·3·6b·7·8 |
| 10절 검증 — 타입·빌드·덱코드 왕복 | Task 6b·8·10 |

**이 계획이 덮지 않는 것** — `docs/07` 5.2 런 추적 · 6절의 Server Action 과 Route Handler · 9절 엔진 경계. 계획 B 와 엔진 브랜치의 몫이다. 6절 중 `recommendForDeck` 확장만 Task 9 로 가져오는데, 그것이 없으면 엔진 브랜치의 판정 범위 작업이 관측되지 않기 때문이다(`docs/07` 9절).

**타입 일관성** — `Result<T>`·`Kv`(Task 1)를 3·6이 그대로 쓴다. `StoredDeck`·`EGO_RANKS`·`emptyDeck`(Task 2)을 3·6·7·8이 쓴다. `readField`/`writeField`(Task 4)를 5가, `readBlock`/`writeBlock`/`emptyBits`(Task 5)와 `toBase64`/`gzip`(Task 6a)을 6b 가 쓴다. `indexOf`가 인격·E.G.O 양쪽에 쓰이는데 id 규칙이 같아 하나로 충분하다.

**미해결로 남기는 것** — `docs/07` 7.4 의 미검증 다섯이 전부 남는다. **왕복 테스트는 우리 인코더와 우리 디코더를 맞춰 볼 뿐이라 그중 어느 것도 잡지 못한다.** 특히 E.G.O 필드의 인덱스가 수감자 내 전체 순번인지(7.4 #4)와 가이드가 비워둔 자리가 실제로 0인지(7.4 #3)는 가져오기의 정확성에 직접 걸리는데, 지금 구조로는 통과하는 테스트만 쓸 수 있다. 실물 코드 확보 시 Task 10 에서 검증한다.

**가이드 자체가 저장소에 없다**(`docs/07` 7.0). 발췌를 `docs/reference/` 에 남기기 전까지 Task 5 의 「가이드 예시 블록」 테스트는 대조할 원본이 없는 오라클이다.

## 구현 뒤 실측

**Task 1 배선은 이 브랜치가 가져갔다.** `package.json` 의 `test` 와 `ci.yml` 의 「단위 테스트」
단계가 여기 있다. 엔진 브랜치(`feat/engine-deck-feature`)는 리베이스해 Task 1 을 건너뛴다.

**저장분 소실을 재현하고 막았다**(Task 3·7). 버전 0 저장분 위에서 `readDecks` 실패 → 화면
`decks` 가 빈 배열 → 「새 덱」 → `writeDecks` 가 통째로 덮는 경로를 실행해 확인했다. `locked`
로 쓰기를 막고, 소실 경로 자체는 `lib/storage/decks.test.ts` 가 회귀로 잠근다.
**화면의 잠금에는 단위 테스트가 없다** — 이 저장소에 DOM 테스트 배선이 없다.

**`crypto.randomUUID` 부재를 재현했다**(Task 2). 전역 `crypto` 를 지우면 `emptyDeck` 이
`crypto is not defined` 로 던져 편성 화면이 통째로 죽는다. `newId()` 폴백으로 물러서고,
`lib/storage/schema.test.ts` 가 이를 잠근다. 실제 도달 조건은 평문 HTTP 배포이며 현재
개발 환경(localhost)은 보안 컨텍스트라 도달하지 않는다.

**디코드 단계 구분의 근거 하나가 틀렸다**(Task 6b). 위 주석에 적은 대로 `atob` 의 `message`
는 비어 있지 않다. 단계 이름을 우리가 붙이는 것으로 근거를 바꿔 유지했다.

**참조 결손 표기는 실측 재현을 하지 않았다**(Task 7). `missingRefs` 가 인격·E.G.O 를 모두
보지만, 데이터에 없는 id 는 덱 코드 가져오기로만 들어온다.

**Task 9 는 숫자만 갈린다.** `?deployed=` 로 소속 패널의 인원이 편성과 갈리는 것까지가 지금
관측 가능한 전부다. 점수가 갈리는 것은 엔진 브랜치 병합 뒤이며, 그 전까지는 같은 것이 정상이다.
