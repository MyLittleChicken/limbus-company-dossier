import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyRequiredMessage, renameSchema, extractCanonicalDdl } from './schema-ops.js';

test('거부 메시지가 우회로를 알려 준다', () => {
	const m = emptyRequiredMessage(94);
	assert.match(m, /canonical/);
	assert.match(m, /94/);
	// 무엇을 하라는지 없으면 사람이 막힌다
	assert.match(m, /v2:build/);
});

test('스키마 이름 바꾸기 SQL', () => {
	assert.equal(renameSchema('canonical', 'wip'), 'ALTER SCHEMA "canonical" RENAME TO "wip"');
});

test('이름에 따옴표가 들어오면 거부한다 — 주입을 막는다', () => {
	assert.throws(() => renameSchema('a"b', 'c'), /스키마 이름/);
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
