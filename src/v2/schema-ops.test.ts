import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
	emptyRequiredMessage,
	renameSchema,
	extractCanonicalDdl,
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
		{ table: 'run', column: 'difficulty', typeSchema: 'canonical', typeText: 'canonical."Difficulty"' },
	]);
	assert.deepEqual(sql, [
		'ALTER TABLE "app"."run" ALTER COLUMN "difficulty" TYPE canonical."Difficulty" ' +
			'USING "difficulty"::text::canonical."Difficulty"',
	]);
});

test('enum 재지정 SQL — 컬럼 이름에 따옴표가 들어오면 거부한다', () => {
	assert.throws(
		() => retargetTypeSql([{ table: 'run', column: 'a"b', typeSchema: 'canonical', typeText: 'canonical."Difficulty"' }]),
		/식별자/,
	);
});

// 재부착의 전제 — 정의문이 스키마를 이름으로 한정하고 있어야 한다. 한정이 없으면
// search_path 로 풀리므로, 교체 뒤 다시 실행했을 때 어느 판을 가리킬지 알 수 없다.
test('스키마 한정 확인 — 한정된 정의문', () => {
	assert.equal(qualifiesSchema('FOREIGN KEY (gift_id) REFERENCES canonical.gift(id)', 'canonical'), true);
	assert.equal(qualifiesSchema('canonical."Difficulty"', 'canonical'), true);
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
