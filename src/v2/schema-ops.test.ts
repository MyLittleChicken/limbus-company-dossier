import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
	PLANS,
	appFkChecks,
	buildDiedMidwayMessage,
	emptyRequiredMessage,
	isRetargetableRelkind,
	renameSchema,
	extractCanonicalDdl,
	splitDdlBlocks,
	tallyCanonicalDdl,
	formatIds,
	rebindSql,
	retargetTypeSql,
	qualifiesSchema,
} from './schema-ops.js';

test('거부 메시지가 우회로를 알려 준다', () => {
	const m = emptyRequiredMessage();
	assert.match(m, /canonical/);
	// 테이블 개수가 아니라 "데이터가 있다"는 사실을 담는다 — hasAnyRow 와 짝
	assert.match(m, /행/);
	// 무엇을 하라는지 없으면 사람이 막힌다
	assert.match(m, /v2:build/);
});

test('스키마 이름 바꾸기 SQL', () => {
	assert.equal(renameSchema('canonical', 'wip'), 'ALTER SCHEMA "canonical" RENAME TO "wip"');
});

test('이름에 따옴표가 들어오면 거부한다 — 주입을 막는다', () => {
	assert.throws(() => renameSchema('a"b', 'c'), /식별자/);
});

// prisma/v2/schema.sql 의 실제 구조를 축약해 재현한다 — 헤더 블록 안에 빈 줄이
// 끼는 CREATE TABLE(컬럼 목록과 CONSTRAINT 사이)이 실측에서 나온 함정이다.
const FAKE_FULL_DDL = `-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "app";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "canonical";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "raw";

-- CreateEnum
CREATE TYPE "canonical"."Sin" AS ENUM ('wrath', 'lust');

-- CreateTable
CREATE TABLE "raw"."snapshot" (
    "id" TEXT NOT NULL,

    CONSTRAINT "snapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "canonical"."gift" (
    "id" TEXT NOT NULL,

    CONSTRAINT "gift_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app"."run_gift" (
    "id" TEXT NOT NULL,

    CONSTRAINT "run_gift_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "app"."run_gift" ADD CONSTRAINT "run_gift_gift_id_fkey" FOREIGN KEY ("gift_id") REFERENCES "canonical"."gift"("id");
`;

test('canonical DDL 만 걸러낸다 — raw·app 문장은 빠진다', () => {
	const statements = extractCanonicalDdl(FAKE_FULL_DDL);
	// CREATE SCHEMA canonical · CREATE TYPE Sin · CREATE TABLE gift — 3개만 남는다.
	// app.run_gift 의 FK 문장은 canonical.gift 를 참조하지만 app 문장이라 빠진다.
	assert.equal(statements.length, 3);
});

test('canonical DDL 걸러내기 — 정확히 무엇이 남는지', () => {
	const statements = extractCanonicalDdl(FAKE_FULL_DDL);
	const joined = statements.join('\n---\n');
	assert.match(joined, /CREATE SCHEMA IF NOT EXISTS "canonical"/);
	assert.match(joined, /CREATE TYPE "canonical"\."Sin"/);
	assert.match(joined, /CREATE TABLE "canonical"\."gift"/);
	// raw 문장은 전혀 없다 — raw 를 다시 만들려 들지 않는다
	assert.doesNotMatch(joined, /"raw"/);
	// app 문장은 없다 — canonical 참조가 섞인 FK 도 제외된다(app 재조준은 promote 몫)
	assert.doesNotMatch(joined, /"app"/);
	// CREATE TABLE 블록 안의 빈 줄(컬럼 목록과 CONSTRAINT 사이)이 문장을 반으로
	// 쪼개지 않았는지 — PRIMARY KEY 절이 살아 있어야 한다
	assert.match(joined, /CONSTRAINT "gift_pkey" PRIMARY KEY/);
});

test('canonical DDL 집계 — 원본과 걸러낸 것이 같다(정상 케이스)', () => {
	const statements = extractCanonicalDdl(FAKE_FULL_DDL);
	const original = tallyCanonicalDdl(FAKE_FULL_DDL);
	const filtered = tallyCanonicalDdl(statements.join('\n'));
	assert.deepEqual(original, filtered);
	// FAKE_FULL_DDL 에는 canonical 테이블 1개(gift)·타입 1개(Sin)뿐이다
	assert.equal(original['CREATE TABLE "canonical".'], 1);
	assert.equal(original['CREATE TYPE "canonical".'], 1);
	assert.equal(original['ALTER TABLE "canonical".'], 0);
});

// "canonical"."table" 은 항상 따옴표 바로 뒤에 마침표가 온다 — `\b` 로 재려던
// 첫 시도는 두 비단어 문자(`"`·`.`) 사이엔 단어 경계가 없어 매치가 0 이 되는
// 함정에 걸렸다(실측: 진짜 schema.sql 에서 85건인데 0건으로 셌다). 그 함정을
// 다시 안 밟도록 실제 FK 문장 모양으로 고정해 둔다.
test('canonical DDL 집계 — ALTER TABLE canonical 은 따옴표 뒤 마침표로 잡는다', () => {
	const sql = `-- AddForeignKey
ALTER TABLE "canonical"."pack_text" ADD CONSTRAINT "pack_text_pack_id_fkey" FOREIGN KEY ("pack_id") REFERENCES "canonical"."pack"("id");
`;
	assert.equal(tallyCanonicalDdl(sql)['ALTER TABLE "canonical".'], 1);
});

// 경계값 셋 — 잘리기 직전(19)·경계(20, limit 과 정확히 같음)·잘린 직후(21).
// v2:diff 의 개체 차·app 무결성 출력이 이 함수를 그대로 쓴다(리뷰 반영).
test('formatIds — limit 보다 하나 적으면 안 잘린다(19/20)', () => {
	const ids = Array.from({ length: 19 }, (_, i) => `id${i}`);
	const out = formatIds(ids);
	assert.doesNotMatch(out, /총/);
	assert.equal(out.split(', ').length, 19);
});

test('formatIds — 정확히 limit 이면 안 잘린다(20/20)', () => {
	const ids = Array.from({ length: 20 }, (_, i) => `id${i}`);
	const out = formatIds(ids);
	assert.doesNotMatch(out, /총/);
	assert.equal(out.split(', ').length, 20);
});

test('formatIds — limit 을 하나 넘으면 잘리고 총 건수를 붙인다(21/20)', () => {
	const ids = Array.from({ length: 21 }, (_, i) => `id${i}`);
	const out = formatIds(ids);
	assert.match(out, /… \(총 21건\)$/);
	// 잘린 목록엔 20개만 나열된다(21번째 id20 은 안 보인다)
	assert.equal(out.split(', ').length, 20);
	assert.doesNotMatch(out, /id20 …/);
});

// extractCanonicalDdl 은 블록 안에 `"app"` 이라는 **글자 그대로의 부분 문자열**이
// 있으면 통째로 버린다(스키마 한정 식별자를 걸러내는 조건이라 따옴표까지 본다).
// canonical 소유 문장이 어쩌다(예: 기본값 문자열 리터럴 안에) 그 부분 문자열을
// 물고 있으면 통째로 빠진다 — tallyCanonicalDdl 이 그 빠짐을 잡아내는지 확인한다.
// 이게 build-canonical.ts 의 실질적 방어선이다.
const DDL_WITH_ACCIDENTAL_APP_MENTION = `-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "canonical";

-- CreateTable
CREATE TABLE "canonical"."gift" (
    "id" TEXT NOT NULL,
    "note" TEXT NOT NULL DEFAULT 'literally contains "app" as text',

    CONSTRAINT "gift_pkey" PRIMARY KEY ("id")
);
`;

test('canonical DDL 집계 — 필터가 뭔가를 빠뜨리면 어긋난다(회귀 감지)', () => {
	const statements = extractCanonicalDdl(DDL_WITH_ACCIDENTAL_APP_MENTION);
	// 기본값 문자열 안의 `"app"` 때문에 gift 테이블 문장 전체가 걸러진다 —
	// extractCanonicalDdl 의 알려진 한계다
	assert.equal(statements.length, 1); // CREATE SCHEMA canonical 만 남는다
	const original = tallyCanonicalDdl(DDL_WITH_ACCIDENTAL_APP_MENTION);
	const filtered = tallyCanonicalDdl(statements.join('\n'));
	assert.equal(original['CREATE TABLE "canonical".'], 1);
	assert.equal(filtered['CREATE TABLE "canonical".'], 0);
	assert.notDeepEqual(original, filtered); // build-canonical.ts 는 이 어긋남을 보고 멈춘다
});

// ── v2:promote · v2:rollback 이 쓰는 SQL 조립 ────────────────────────────────
//
// 여기 있는 것은 전부 순수 함수다 — DB 없이 돌아야 한다(CI 는 DB 를 안 쓴다).
// 승격은 살아있는 152,399행이 걸린 자리라, SQL 을 만드는 규칙만이라도 DB 없이
// 고정해 둔다.

test('FK 재부착 SQL 을 정의문에서 만든다', () => {
	const sql = rebindSql([
		{
			table: 'run_gift',
			name: 'run_gift_gift_id_fkey',
			foreignSchema: 'canonical',
			def: 'FOREIGN KEY (gift_id) REFERENCES canonical.gift(id) ON UPDATE CASCADE ON DELETE RESTRICT',
		},
	]);
	assert.deepEqual(sql.drop, ['ALTER TABLE "app"."run_gift" DROP CONSTRAINT "run_gift_gift_id_fkey"']);
	assert.match(
		sql.add[0] ?? '',
		/ADD CONSTRAINT "run_gift_gift_id_fkey" FOREIGN KEY \(gift_id\) REFERENCES canonical\.gift\(id\)/,
	);
	// 옵션을 잃으면 삭제 동작이 바뀐다
	assert.match(sql.add[0] ?? '', /ON DELETE RESTRICT/);
});

// 떼는 순서와 붙이는 순서가 어긋나도 SQL 자체는 성립하지만, 사람이 로그를 읽을 때
// 짝을 못 맞춘다. 입력 순서를 그대로 유지하는지 고정해 둔다.
test('FK 재부착 SQL — 여러 개를 입력 순서 그대로 낸다', () => {
	const sql = rebindSql([
		{ table: 'run_floor', name: 'a_fkey', foreignSchema: 'canonical', def: 'FOREIGN KEY (pack_id) REFERENCES canonical.pack(id)' },
		{ table: 'run_gift', name: 'b_fkey', foreignSchema: 'canonical', def: 'FOREIGN KEY (gift_id) REFERENCES canonical.gift(id)' },
	]);
	assert.equal(sql.drop.length, 2);
	assert.equal(sql.add.length, 2);
	assert.match(sql.drop[0] ?? '', /"run_floor".*"a_fkey"/);
	assert.match(sql.add[1] ?? '', /"run_gift".*"b_fkey"/);
});

// app 이 canonical 을 아예 안 참조하는 상태(예: 앞선 승격이 FK 를 못 붙인 뒤)에도
// 조립은 조용히 빈 목록을 낸다 — 그 판정은 호출부(promote)가 한다.
test('FK 재부착 SQL — 빈 목록이면 빈 SQL', () => {
	assert.deepEqual(rebindSql([]), { drop: [], add: [] });
});

test('FK 재부착 SQL — 제약 이름에 따옴표가 들어오면 거부한다', () => {
	assert.throws(
		() => rebindSql([{ table: 'run_gift', name: 'a"b', foreignSchema: 'canonical', def: 'FOREIGN KEY (x) REFERENCES canonical.y(id)' }]),
		/식별자/,
	);
});

// 컬럼 타입 재지정. app.run 이 0행이어도 필요하다 — 컬럼이 옛 스키마의 타입을
// 가리키고 있으면 canonical_bak 을 나중에 못 지운다.
test('enum 재지정 SQL 을 format_type 결과 그대로 쓴다', () => {
	const sql = retargetTypeSql([
		{ table: 'run', column: 'difficulty', typeSchema: 'canonical', typeText: 'canonical."Difficulty"', relkind: 'r' },
	]);
	assert.deepEqual(sql, [
		'ALTER TABLE "app"."run" ALTER COLUMN "difficulty" TYPE canonical."Difficulty" ' +
			'USING "difficulty"::text::canonical."Difficulty"',
	]);
});

test('enum 재지정 SQL — 컬럼 이름에 따옴표가 들어오면 거부한다', () => {
	assert.throws(
		() =>
			retargetTypeSql([
				{ table: 'run', column: 'a"b', typeSchema: 'canonical', typeText: 'canonical."Difficulty"', relkind: 'r' },
			]),
		/식별자/,
	);
});

// appTypeColumns 는 outsideDependents 와 범위를 맞추느라 뷰·머티리얼라이즈드뷰까지
// 본다. 그것들엔 ALTER TABLE … ALTER COLUMN … TYPE 이 안 먹으므로 promote 가
// 재조준 대상에서 갈라내야 한다 — 그 갈래의 잣대를 여기 고정한다.
test('재조준 가능한 relkind 는 실제 테이블과 파티션 부모뿐이다', () => {
	assert.equal(isRetargetableRelkind('r'), true);
	assert.equal(isRetargetableRelkind('p'), true);
	assert.equal(isRetargetableRelkind('v'), false);
	assert.equal(isRetargetableRelkind('m'), false);
	assert.equal(isRetargetableRelkind('f'), false);
});

// 재부착의 전제 — 정의문이 스키마를 이름으로 한정하고 있어야 한다. 한정이 없으면
// search_path 로 풀리므로, 교체 뒤 다시 실행했을 때 어느 판을 가리킬지 알 수 없다.
test('스키마 한정 확인 — 한정된 정의문', () => {
	assert.equal(qualifiesSchema('FOREIGN KEY (gift_id) REFERENCES canonical.gift(id)', 'canonical'), true);
	assert.equal(qualifiesSchema('canonical."Difficulty"', 'canonical'), true);
});

// 이름에 대문자나 예약어가 섞이면 PostgreSQL 이 따옴표를 붙여 찍는다. 그것도
// 완벽하게 한정된 정의문이라 통과해야 한다 — 2차 리뷰에서 잡힌 것으로, 앞 문자
// 제외 목록에 `"` 가 있어 멀쩡한 정의문이 거부됐다.
test('스키마 한정 확인 — 따옴표 친 한정형도 통과한다', () => {
	assert.equal(qualifiesSchema('FOREIGN KEY (gift_id) REFERENCES "canonical".gift(id)', 'canonical'), true);
	assert.equal(qualifiesSchema('"canonical"."Difficulty"', 'canonical'), true);
	// 따옴표를 허용해도 접두사 착각은 여전히 막아야 한다
	assert.equal(qualifiesSchema('REFERENCES "canonical_bak".gift(id)', 'canonical'), false);
	// 앞 문자 검사가 노리던 것 — 여기는 그대로 막힌다
	assert.equal(qualifiesSchema('REFERENCES mycanonical.gift(id)', 'canonical'), false);
	assert.equal(qualifiesSchema('REFERENCES "mycanonical".gift(id)', 'canonical'), false);
});

test('스키마 한정 확인 — 한정이 없으면 거짓', () => {
	// search_path 에 canonical 이 들어 있으면 PostgreSQL 이 이렇게 찍는다
	assert.equal(qualifiesSchema('FOREIGN KEY (gift_id) REFERENCES gift(id)', 'canonical'), false);
	assert.equal(qualifiesSchema('"Difficulty"', 'canonical'), false);
});

// canonical_bak 은 canonical 로 시작하지만 다른 스키마다. 접두사만 보면 옛 판을
// 가리키는 정의문을 "한정됐다"고 잘못 통과시킨다.
test('스키마 한정 확인 — canonical_bak 을 canonical 로 착각하지 않는다', () => {
	assert.equal(qualifiesSchema('FOREIGN KEY (gift_id) REFERENCES canonical_bak.gift(id)', 'canonical'), false);
	assert.equal(qualifiesSchema('FOREIGN KEY (gift_id) REFERENCES canonical_bak.gift(id)', 'canonical_bak'), true);
});

// ── 선검사 목록을 정의문에서 유도한다 ────────────────────────────────────────
//
// 예전엔 run_gift·run_floor 둘을 상수로 박아 뒀는데, 같은 대상을 appDependencies 는
// 카탈로그에서 읽고 있었다 — 한 대상에 진실 원천이 둘. 셋째 FK 가 생기면 승격은
// 그것을 떼었다 붙이면서 선검사만 건너뛴다. 유도가 그 어긋남을 원리적으로 없앤다.

test('선검사 유도 — 지금 있는 FK 둘을 정의문에서 그대로 읽어낸다', () => {
	const { checks, unsupported } = appFkChecks([
		{
			table: 'run_floor',
			name: 'run_floor_pack_id_fkey',
			foreignSchema: 'canonical',
			def: 'FOREIGN KEY (pack_id) REFERENCES canonical.pack(id) ON UPDATE CASCADE ON DELETE RESTRICT',
		},
		{
			table: 'run_gift',
			name: 'run_gift_gift_id_fkey',
			foreignSchema: 'canonical',
			def: 'FOREIGN KEY (gift_id) REFERENCES canonical.gift(id) ON UPDATE CASCADE ON DELETE RESTRICT',
		},
	]);
	assert.deepEqual(unsupported, []);
	assert.deepEqual(checks, [
		{ table: 'run_floor', fkColumn: 'pack_id', targetTable: 'pack', targetColumn: 'id' },
		{ table: 'run_gift', fkColumn: 'gift_id', targetTable: 'gift', targetColumn: 'id' },
	]);
});

// 셋째가 생기는 것이 이 수정의 이유다 — 상수였다면 여기서 조용히 빠졌다.
test('선검사 유도 — FK 가 셋으로 늘면 검사도 셋이 된다', () => {
	const { checks } = appFkChecks([
		{ table: 'run_floor', name: 'a', foreignSchema: 'canonical', def: 'FOREIGN KEY (pack_id) REFERENCES canonical.pack(id)' },
		{ table: 'run_gift', name: 'b', foreignSchema: 'canonical', def: 'FOREIGN KEY (gift_id) REFERENCES canonical.gift(id)' },
		{ table: 'run_ego', name: 'c', foreignSchema: 'canonical', def: 'FOREIGN KEY (ego_id) REFERENCES canonical.ego(id)' },
	]);
	assert.equal(checks.length, 3);
	assert.deepEqual(checks[2], { table: 'run_ego', fkColumn: 'ego_id', targetTable: 'ego', targetColumn: 'id' });
});

// PostgreSQL 은 필요할 때만 따옴표를 붙인다. 둘 다 같은 뜻이므로 둘 다 읽어야 한다.
test('선검사 유도 — 따옴표가 붙은 정의문도 읽는다', () => {
	const { checks } = appFkChecks([
		{
			table: 'run_gift',
			name: 'x',
			foreignSchema: 'canonical',
			def: 'FOREIGN KEY ("gift_id") REFERENCES "canonical"."gift"("id")',
		},
	]);
	assert.deepEqual(checks, [
		{ table: 'run_gift', fkColumn: 'gift_id', targetTable: 'gift', targetColumn: 'id' },
	]);
});

// 대상 컬럼을 `id` 로 박아 두면 id 가 아닌 것을 가리키는 FK 가 생겼을 때 엉뚱한
// 컬럼을 재고도 "통과했다"고 찍는다 — 조용히 틀린 답이다.
test('선검사 유도 — 대상 컬럼이 id 가 아니어도 정의문 그대로 쓴다', () => {
	const { checks } = appFkChecks([
		{ table: 'run_floor', name: 'y', foreignSchema: 'canonical', def: 'FOREIGN KEY (pack_code) REFERENCES canonical.pack(code)' },
	]);
	assert.deepEqual(checks, [
		{ table: 'run_floor', fkColumn: 'pack_code', targetTable: 'pack', targetColumn: 'code' },
	]);
});

// 못 읽은 것을 버리면 「선검사가 통과했다」가 거짓이 된다. 버리지 않고 돌려준다.
test('선검사 유도 — 복합 FK 는 못 잰다고 말한다(조용히 빠지지 않는다)', () => {
	const { checks, unsupported } = appFkChecks([
		{ table: 'run_floor', name: 'z', foreignSchema: 'canonical', def: 'FOREIGN KEY (pack_id, floor) REFERENCES canonical.pack(id, floor)' },
	]);
	assert.deepEqual(checks, []);
	assert.equal(unsupported.length, 1);
	assert.match(unsupported[0] ?? '', /복합 FK/);
	assert.match(unsupported[0] ?? '', /run_floor/);
});

test('선검사 유도 — 모양이 다른 정의문도 못 읽었다고 말한다', () => {
	const { checks, unsupported } = appFkChecks([
		{ table: 'run', name: 'w', foreignSchema: 'canonical', def: 'CHECK (difficulty IS NOT NULL)' },
	]);
	assert.deepEqual(checks, []);
	assert.equal(unsupported.length, 1);
	assert.match(unsupported[0] ?? '', /못 읽었다/);
});

// ── PLANS — 역연산 불변식 ───────────────────────────────────────────────────
//
// 이 브랜치에서 결과가 가장 무거운 순수 데이터다. outgoingOccupied 의 drop/refuse 가
// 두 모드 사이에서 뒤바뀌면 v2:rollback 이 갓 구운 wip 을 말없이 DROP 한다 — 둘 다
// 'drop' | 'refuse' 라 타입 검사는 못 잡는다. 문서와 원장에만 있던 「역연산」 보장을
// DB 없이 여기서 지킨다.

test('PLANS — promote 와 rollback 은 서로의 역연산이다', () => {
	assert.equal(PLANS.promote.incoming, PLANS.rollback.outgoing);
	assert.equal(PLANS.promote.outgoing, PLANS.rollback.incoming);
	// 이름 자체도 못 박는다 — 위 둘만 보면 양쪽을 같이 뒤집었을 때 통과한다
	assert.equal(PLANS.promote.incoming, 'wip');
	assert.equal(PLANS.promote.outgoing, 'canonical_bak');
});

test('PLANS — 이름이 차 있을 때 지우는 것은 승격뿐이다', () => {
	// 결정 3 — 이전 판은 하나만 남긴다. 다음 승격이 이전 bak 을 지운다.
	assert.equal(PLANS.promote.outgoingOccupied, 'drop');
	// 되돌리기 중의 wip 은 아직 승격 안 한 새 판일 수 있다. 지울 물건이 아니다.
	assert.equal(PLANS.rollback.outgoingOccupied, 'refuse');
});

test('PLANS — incoming 이 없을 때 할 말이 무엇을 하라는지 담는다', () => {
	assert.match(PLANS.promote.missingIncoming.join('\n'), /v2:build/);
	assert.match(PLANS.rollback.missingIncoming.join('\n'), /canonical_bak/);
});

// ── build 가 중간에 죽은 상태의 안내 ────────────────────────────────────────
//
// v2:build 가 SIGINT·크래시로 죽으면 catch 가 안 돌아 build 의 복구 안내가 안 나온다.
// 그 상태(canonical 없음 · canonical_hold 살아있는 판 · wip 새 판)에서 promote·diff 가
// 「wip 을 canonical 로 올려라」고 안내하면 재앙이다.

test('build 중단 안내 — canonical_hold 를 먼저 복귀시키라고 말한다', () => {
	const m = buildDiedMidwayMessage().join('\n');
	assert.match(m, /canonical_hold/);
	assert.match(m, /ALTER SCHEMA "canonical_hold" RENAME TO "canonical"/);
	// wip 을 올리라고 말하면 안 된다 — 그 반대를 말해야 한다
	assert.match(m, /wip 을 canonical 로 올리지 마라/);
	assert.match(m, /v2:rollback/);
});

// ── 진짜 prisma/v2/schema.sql 을 fixture 로 ──────────────────────────────────
//
// 커밋돼 있고 DB 가 필요 없는 파일이다. 위의 축약 fixture 는 걸러내기 규칙의 함정
// (블록 안 빈 줄 · 문자열 리터럴의 "app")을 지키지만, **진짜 파일의 규모**는 안
// 지킨다 — extractCanonicalDdl 이 조용히 절반만 걸러도 축약 fixture 는 통과한다.
//
// 아래 수는 전부 이 파일에서 실제로 센 값이다(2026-08-04 기준, `npm run v2:schema:ddl`
// 산물). 스키마가 자라면 여기도 같이 고쳐야 한다 — 그 강제가 이 테스트의 목적이다.
const REAL_SCHEMA_SQL = readFileSync(new URL('../../prisma/v2/schema.sql', import.meta.url), 'utf8');

test('진짜 schema.sql — 블록 268개 중 235개가 순수 canonical', () => {
	// splitDdlBlocks 를 공유한다 — 사본을 들면 분할 규칙이 바뀔 때 이 268이 뜻을 잃는다
	//
	// 256 → 260 은 ADR-08 이었다.
	//   app.ref_exception · app.ego_granted_axis   +2   (canonical 밖)
	//   canonical.build_info                        +1
	//   field_source 의 snapshot_id 인덱스           +1
	//
	// 260 → 263 은 앱 전환이다. canonical 에 없던 유일한 결손을 메웠다.
	//   canonical.mirror_dungeon · mirror_dungeon_text   +2
	//   그 둘 사이의 FK                                   +1
	//
	// 263 → 268 은 축 부여·제한이다(ae2feb9, task-6 축 그래프).
	//   canonical.axis_restrict 표                  +1   (canonical, +3에 포함)
	//   axis_restrict 의 FK 둘(identity·axis)        +2   (canonical, +3에 포함)
	//   app.axis_grant 표                            +1   (canonical 밖)
	//   axis_grant 의 색인 하나                       +1   (app, canonical 밖)
	//
	// 268 → 275 는 기프트 능력이다(기프트 능력 모형 1단계).
	//   canonical.gift_ability · gift_ability_cond 표     +2   (canonical, +6에 포함)
	//   그 둘의 색인 둘(gift_id · ref_kind+ref_id)          +2   (canonical, +6에 포함)
	//   FK 둘(gift_ability→gift · cond→ability)           +2   (canonical, +6에 포함)
	//   app.gift_ability_authored 표                       +1   (canonical 밖)
	assert.equal(splitDdlBlocks(REAL_SCHEMA_SQL).length, 275);
	assert.equal(extractCanonicalDdl(REAL_SCHEMA_SQL).length, 241);
});

test('진짜 schema.sql — 종류별 집계가 실측과 같다', () => {
	const tally = tallyCanonicalDdl(REAL_SCHEMA_SQL);
	// 97 → 98 은 canonical.axis_restrict 다. app.axis_grant 는 canonical 밖이라 안 늘린다
	// 98 → 100 은 gift_ability · gift_ability_cond 다. app.gift_ability_authored 는 밖이다
	assert.equal(tally['CREATE TABLE "canonical".'], 100);
	// 37 → 39 는 gift_ability(gift_id) · gift_ability_cond(ref_kind, ref_id) 색인이다
	assert.equal(tally['CREATE INDEX ... ON "canonical"'], 39);
	// 86 → 88 은 axis_restrict 의 FK 둘(identity_id · axis_id)이다
	// 88 → 90 은 gift_ability→gift · gift_ability_cond→gift_ability FK 둘이다
	assert.equal(tally['ALTER TABLE "canonical".'], 90);
	assert.equal(tally['CREATE TYPE "canonical".'], 11);
});

// build-canonical.ts 의 실질적 방어선을 진짜 파일에 걸어 본다 — 걸러낸 것과 원본의
// 종류별 개수가 같아야 한다. 축약 fixture 로는 "규칙이 성립한다"만 보이고 "이 파일에서
// 성립한다"는 안 보인다.
test('진짜 schema.sql — 걸러낸 것과 원본의 집계가 같다', () => {
	const statements = extractCanonicalDdl(REAL_SCHEMA_SQL);
	assert.deepEqual(tallyCanonicalDdl(statements.join('\n')), tallyCanonicalDdl(REAL_SCHEMA_SQL));
});

// app 문장에 섞인 canonical 참조 3건(app.run.difficulty 컬럼 · run_floor·run_gift 의
// FK)은 걸러내기에서 빠져야 한다 — 그 재조준은 v2:promote 몫이다.
test('진짜 schema.sql — 걸러낸 것에 app·raw 가 한 글자도 없다', () => {
	const joined = extractCanonicalDdl(REAL_SCHEMA_SQL).join('\n');
	assert.doesNotMatch(joined, /"app"/);
	assert.doesNotMatch(joined, /"raw"/);
});
