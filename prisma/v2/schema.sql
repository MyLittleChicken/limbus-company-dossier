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

-- CreateEnum
CREATE TYPE "canonical"."Sin" AS ENUM ('wrath', 'lust', 'sloth', 'gluttony', 'gloom', 'pride', 'envy');

-- CreateEnum
CREATE TYPE "canonical"."GiftDomain" AS ENUM ('mirror_dungeon', 'story_dungeon');

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

-- CreateTable
CREATE TABLE "canonical"."pack" (
    "id" TEXT NOT NULL,
    "category" "canonical"."PackCategory" NOT NULL,
    "chapter" INTEGER,
    "variant" "canonical"."PackVariant",
    "sprite" TEXT NOT NULL,
    "overlay_sprite" TEXT,
    "superposition" BOOLEAN NOT NULL DEFAULT false,
    "extreme" BOOLEAN NOT NULL DEFAULT false,
    "bokgak" BOOLEAN NOT NULL DEFAULT false,
    "floor_length" INTEGER NOT NULL,
    "text_color" TEXT,
    "unlock_code" INTEGER,

    CONSTRAINT "pack_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "canonical"."pack_text" (
    "pack_id" TEXT NOT NULL,
    "locale" "canonical"."Locale" NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "pack_text_pkey" PRIMARY KEY ("pack_id","locale")
);

-- CreateTable
CREATE TABLE "canonical"."pack_tag" (
    "pack_id" TEXT NOT NULL,
    "tag" TEXT NOT NULL,

    CONSTRAINT "pack_tag_pkey" PRIMARY KEY ("pack_id","tag")
);

-- CreateTable
CREATE TABLE "canonical"."pack_category_path" (
    "pack_id" TEXT NOT NULL,
    "depth" INTEGER NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "pack_category_path_pkey" PRIMARY KEY ("pack_id","depth")
);

-- CreateTable
CREATE TABLE "canonical"."floor_pack" (
    "difficulty" "canonical"."Difficulty" NOT NULL,
    "floor_range" TEXT NOT NULL,
    "pack_id" TEXT NOT NULL,

    CONSTRAINT "floor_pack_pkey" PRIMARY KEY ("difficulty","floor_range","pack_id")
);

-- CreateTable
CREATE TABLE "canonical"."keyword" (
    "id" TEXT NOT NULL,

    CONSTRAINT "keyword_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "canonical"."keyword_text" (
    "keyword_id" TEXT NOT NULL,
    "locale" "canonical"."Locale" NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "keyword_text_pkey" PRIMARY KEY ("keyword_id","locale")
);

-- CreateTable
CREATE TABLE "canonical"."trigger" (
    "id" TEXT NOT NULL,

    CONSTRAINT "trigger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "canonical"."effect" (
    "id" TEXT NOT NULL,

    CONSTRAINT "effect_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "canonical"."gift" (
    "id" TEXT NOT NULL,
    "domain" "canonical"."GiftDomain" NOT NULL,
    "sin" "canonical"."Sin",
    "tier" INTEGER,
    "tier_label" TEXT,
    "cost" INTEGER,
    "keyword_id" TEXT,
    "hard_only" BOOLEAN NOT NULL DEFAULT false,
    "enhanceable" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "gift_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "canonical"."gift_stage" (
    "gift_id" TEXT NOT NULL,
    "level" INTEGER NOT NULL,

    CONSTRAINT "gift_stage_pkey" PRIMARY KEY ("gift_id","level")
);

-- CreateTable
CREATE TABLE "canonical"."gift_stage_text" (
    "gift_id" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "locale" "canonical"."Locale" NOT NULL,
    "name" TEXT NOT NULL,
    "desc" TEXT,

    CONSTRAINT "gift_stage_text_pkey" PRIMARY KEY ("gift_id","level","locale")
);

-- CreateTable
CREATE TABLE "canonical"."gift_effect" (
    "gift_id" TEXT NOT NULL,
    "effect_id" TEXT NOT NULL,

    CONSTRAINT "gift_effect_pkey" PRIMARY KEY ("gift_id","effect_id")
);

-- CreateTable
CREATE TABLE "canonical"."gift_trigger" (
    "gift_id" TEXT NOT NULL,
    "trigger_id" TEXT NOT NULL,

    CONSTRAINT "gift_trigger_pkey" PRIMARY KEY ("gift_id","trigger_id")
);

-- CreateTable
CREATE TABLE "canonical"."gift_pack" (
    "gift_id" TEXT NOT NULL,
    "pack_id" TEXT NOT NULL,

    CONSTRAINT "gift_pack_pkey" PRIMARY KEY ("gift_id","pack_id")
);

-- CreateTable
CREATE TABLE "canonical"."gift_exclusive_pack" (
    "gift_id" TEXT NOT NULL,
    "pack_id" TEXT NOT NULL,

    CONSTRAINT "gift_exclusive_pack_pkey" PRIMARY KEY ("gift_id","pack_id")
);

-- CreateTable
CREATE TABLE "canonical"."gift_requirement" (
    "gift_id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "value" JSONB NOT NULL,

    CONSTRAINT "gift_requirement_pkey" PRIMARY KEY ("gift_id","kind")
);

-- CreateTable
CREATE TABLE "canonical"."fusion_recipe" (
    "gift_id" TEXT NOT NULL,
    "index" INTEGER NOT NULL,

    CONSTRAINT "fusion_recipe_pkey" PRIMARY KEY ("gift_id","index")
);

-- CreateTable
CREATE TABLE "canonical"."fusion_slot" (
    "gift_id" TEXT NOT NULL,
    "recipe_idx" INTEGER NOT NULL,
    "slot_idx" INTEGER NOT NULL,
    "material_id" TEXT,
    "count" INTEGER,

    CONSTRAINT "fusion_slot_pkey" PRIMARY KEY ("gift_id","recipe_idx","slot_idx")
);

-- CreateTable
CREATE TABLE "canonical"."fusion_slot_option" (
    "gift_id" TEXT NOT NULL,
    "recipe_idx" INTEGER NOT NULL,
    "slot_idx" INTEGER NOT NULL,
    "material_id" TEXT NOT NULL,

    CONSTRAINT "fusion_slot_option_pkey" PRIMARY KEY ("gift_id","recipe_idx","slot_idx","material_id")
);

-- CreateTable
CREATE TABLE "canonical"."gift_locked_desc" (
    "gift_id" TEXT NOT NULL,
    "locale" "canonical"."Locale" NOT NULL,
    "text" TEXT NOT NULL,

    CONSTRAINT "gift_locked_desc_pkey" PRIMARY KEY ("gift_id","locale")
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

-- CreateIndex
CREATE INDEX "pack_category_idx" ON "canonical"."pack"("category");

-- CreateIndex
CREATE INDEX "pack_tag_tag_idx" ON "canonical"."pack_tag"("tag");

-- CreateIndex
CREATE INDEX "floor_pack_pack_id_idx" ON "canonical"."floor_pack"("pack_id");

-- CreateIndex
CREATE INDEX "gift_domain_idx" ON "canonical"."gift"("domain");

-- CreateIndex
CREATE INDEX "gift_sin_idx" ON "canonical"."gift"("sin");

-- CreateIndex
CREATE INDEX "gift_keyword_id_idx" ON "canonical"."gift"("keyword_id");

-- CreateIndex
CREATE INDEX "gift_effect_effect_id_idx" ON "canonical"."gift_effect"("effect_id");

-- CreateIndex
CREATE INDEX "gift_trigger_trigger_id_idx" ON "canonical"."gift_trigger"("trigger_id");

-- CreateIndex
CREATE INDEX "gift_pack_pack_id_idx" ON "canonical"."gift_pack"("pack_id");

-- CreateIndex
CREATE INDEX "gift_exclusive_pack_pack_id_idx" ON "canonical"."gift_exclusive_pack"("pack_id");

-- AddForeignKey
ALTER TABLE "raw"."snapshot_source" ADD CONSTRAINT "snapshot_source_snapshot_id_fkey" FOREIGN KEY ("snapshot_id") REFERENCES "raw"."snapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "raw"."raw_object" ADD CONSTRAINT "raw_object_snapshot_id_fkey" FOREIGN KEY ("snapshot_id") REFERENCES "raw"."snapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "raw"."raw_file" ADD CONSTRAINT "raw_file_snapshot_id_fkey" FOREIGN KEY ("snapshot_id") REFERENCES "raw"."snapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "canonical"."pack_text" ADD CONSTRAINT "pack_text_pack_id_fkey" FOREIGN KEY ("pack_id") REFERENCES "canonical"."pack"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "canonical"."pack_tag" ADD CONSTRAINT "pack_tag_pack_id_fkey" FOREIGN KEY ("pack_id") REFERENCES "canonical"."pack"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "canonical"."pack_category_path" ADD CONSTRAINT "pack_category_path_pack_id_fkey" FOREIGN KEY ("pack_id") REFERENCES "canonical"."pack"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "canonical"."floor_pack" ADD CONSTRAINT "floor_pack_pack_id_fkey" FOREIGN KEY ("pack_id") REFERENCES "canonical"."pack"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "canonical"."keyword_text" ADD CONSTRAINT "keyword_text_keyword_id_fkey" FOREIGN KEY ("keyword_id") REFERENCES "canonical"."keyword"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "canonical"."gift" ADD CONSTRAINT "gift_keyword_id_fkey" FOREIGN KEY ("keyword_id") REFERENCES "canonical"."keyword"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "canonical"."gift_stage" ADD CONSTRAINT "gift_stage_gift_id_fkey" FOREIGN KEY ("gift_id") REFERENCES "canonical"."gift"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "canonical"."gift_stage_text" ADD CONSTRAINT "gift_stage_text_gift_id_level_fkey" FOREIGN KEY ("gift_id", "level") REFERENCES "canonical"."gift_stage"("gift_id", "level") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "canonical"."gift_effect" ADD CONSTRAINT "gift_effect_gift_id_fkey" FOREIGN KEY ("gift_id") REFERENCES "canonical"."gift"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "canonical"."gift_effect" ADD CONSTRAINT "gift_effect_effect_id_fkey" FOREIGN KEY ("effect_id") REFERENCES "canonical"."effect"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "canonical"."gift_trigger" ADD CONSTRAINT "gift_trigger_gift_id_fkey" FOREIGN KEY ("gift_id") REFERENCES "canonical"."gift"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "canonical"."gift_trigger" ADD CONSTRAINT "gift_trigger_trigger_id_fkey" FOREIGN KEY ("trigger_id") REFERENCES "canonical"."trigger"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "canonical"."gift_pack" ADD CONSTRAINT "gift_pack_gift_id_fkey" FOREIGN KEY ("gift_id") REFERENCES "canonical"."gift"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "canonical"."gift_pack" ADD CONSTRAINT "gift_pack_pack_id_fkey" FOREIGN KEY ("pack_id") REFERENCES "canonical"."pack"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "canonical"."gift_exclusive_pack" ADD CONSTRAINT "gift_exclusive_pack_gift_id_fkey" FOREIGN KEY ("gift_id") REFERENCES "canonical"."gift"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "canonical"."gift_exclusive_pack" ADD CONSTRAINT "gift_exclusive_pack_pack_id_fkey" FOREIGN KEY ("pack_id") REFERENCES "canonical"."pack"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "canonical"."gift_requirement" ADD CONSTRAINT "gift_requirement_gift_id_fkey" FOREIGN KEY ("gift_id") REFERENCES "canonical"."gift"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "canonical"."fusion_recipe" ADD CONSTRAINT "fusion_recipe_gift_id_fkey" FOREIGN KEY ("gift_id") REFERENCES "canonical"."gift"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "canonical"."fusion_slot" ADD CONSTRAINT "fusion_slot_gift_id_recipe_idx_fkey" FOREIGN KEY ("gift_id", "recipe_idx") REFERENCES "canonical"."fusion_recipe"("gift_id", "index") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "canonical"."fusion_slot_option" ADD CONSTRAINT "fusion_slot_option_gift_id_recipe_idx_slot_idx_fkey" FOREIGN KEY ("gift_id", "recipe_idx", "slot_idx") REFERENCES "canonical"."fusion_slot"("gift_id", "recipe_idx", "slot_idx") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "canonical"."gift_locked_desc" ADD CONSTRAINT "gift_locked_desc_gift_id_fkey" FOREIGN KEY ("gift_id") REFERENCES "canonical"."gift"("id") ON DELETE CASCADE ON UPDATE CASCADE;

