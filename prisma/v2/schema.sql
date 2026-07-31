-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "canonical";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "raw";

-- CreateEnum
CREATE TYPE "canonical"."Locale" AS ENUM ('ko', 'en', 'ja');

-- CreateEnum
CREATE TYPE "canonical"."Difficulty" AS ENUM ('normal', 'hard');

-- CreateEnum
CREATE TYPE "canonical"."PackCategory" AS ENUM ('canto', 'event', 'walpurgis', 'railway', 'attack_type', 'sin', 'keyword', 'extreme');

-- CreateEnum
CREATE TYPE "canonical"."PackVariant" AS ENUM ('normal', 'mid', 'hard');

-- CreateTable
CREATE TABLE "raw"."snapshot" (
    "id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL,
    "game_anchor" TEXT,
    "note" TEXT,

    CONSTRAINT "snapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "raw"."snapshot_source" (
    "snapshot_id" TEXT NOT NULL,
    "source_id" TEXT NOT NULL,
    "repo" TEXT NOT NULL,
    "branch" TEXT NOT NULL,
    "commit" TEXT NOT NULL,
    "file_count" INTEGER NOT NULL,
    "status" TEXT NOT NULL,

    CONSTRAINT "snapshot_source_pkey" PRIMARY KEY ("snapshot_id","source_id")
);

-- CreateTable
CREATE TABLE "raw"."raw_object" (
    "snapshot_id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "src_path" TEXT NOT NULL,
    "id" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "payload" JSONB NOT NULL,

    CONSTRAINT "raw_object_pkey" PRIMARY KEY ("snapshot_id","source","src_path","id")
);

-- CreateTable
CREATE TABLE "raw"."raw_file" (
    "snapshot_id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "src_path" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "shape" TEXT NOT NULL,
    "object_count" INTEGER NOT NULL,

    CONSTRAINT "raw_file_pkey" PRIMARY KEY ("snapshot_id","source","src_path")
);

-- CreateTable
CREATE TABLE "canonical"."field_gap" (
    "entity" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "locale" TEXT NOT NULL DEFAULT '',
    "reason" TEXT NOT NULL,
    "evidence" TEXT NOT NULL,

    CONSTRAINT "field_gap_pkey" PRIMARY KEY ("entity","entity_id","field","locale")
);

-- CreateTable
CREATE TABLE "canonical"."field_source" (
    "entity" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "rule" TEXT NOT NULL,
    "sources" TEXT[],

    CONSTRAINT "field_source_pkey" PRIMARY KEY ("entity","entity_id","field")
);

-- CreateTable
CREATE TABLE "canonical"."tool_annotation" (
    "source" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "value" JSONB NOT NULL,

    CONSTRAINT "tool_annotation_pkey" PRIMARY KEY ("source","entity","entity_id","field")
);

-- CreateIndex
CREATE UNIQUE INDEX "snapshot_version_key" ON "raw"."snapshot"("version");

-- CreateIndex
CREATE INDEX "raw_object_entity_id_idx" ON "raw"."raw_object"("entity", "id");

-- CreateIndex
CREATE INDEX "raw_object_snapshot_id_source_idx" ON "raw"."raw_object"("snapshot_id", "source");

-- CreateIndex
CREATE INDEX "raw_file_snapshot_id_object_count_idx" ON "raw"."raw_file"("snapshot_id", "object_count");

-- CreateIndex
CREATE INDEX "field_gap_entity_field_idx" ON "canonical"."field_gap"("entity", "field");

-- CreateIndex
CREATE INDEX "field_source_entity_rule_idx" ON "canonical"."field_source"("entity", "rule");

-- CreateIndex
CREATE INDEX "tool_annotation_entity_entity_id_idx" ON "canonical"."tool_annotation"("entity", "entity_id");

-- AddForeignKey
ALTER TABLE "raw"."snapshot_source" ADD CONSTRAINT "snapshot_source_snapshot_id_fkey" FOREIGN KEY ("snapshot_id") REFERENCES "raw"."snapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "raw"."raw_object" ADD CONSTRAINT "raw_object_snapshot_id_fkey" FOREIGN KEY ("snapshot_id") REFERENCES "raw"."snapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "raw"."raw_file" ADD CONSTRAINT "raw_file_snapshot_id_fkey" FOREIGN KEY ("snapshot_id") REFERENCES "raw"."snapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

