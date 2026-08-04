import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
	emptyRequiredMessage,
	renameSchema,
	extractCanonicalDdl,
	tallyCanonicalDdl,
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
