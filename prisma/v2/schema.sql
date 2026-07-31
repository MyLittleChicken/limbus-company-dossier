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

-- CreateEnum
CREATE TYPE "canonical"."AtkType" AS ENUM ('slash', 'pierce', 'blunt');

-- CreateEnum
CREATE TYPE "canonical"."SkillKind" AS ENUM ('attack', 'guard', 'counter', 'evade', 'non_action');

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

-- CreateTable
CREATE TABLE "canonical"."sinner" (
    "id" INTEGER NOT NULL,

    CONSTRAINT "sinner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "canonical"."sinner_text" (
    "sinner_id" INTEGER NOT NULL,
    "locale" "canonical"."Locale" NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "sinner_text_pkey" PRIMARY KEY ("sinner_id","locale")
);

-- CreateTable
CREATE TABLE "canonical"."association" (
    "id" TEXT NOT NULL,

    CONSTRAINT "association_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "canonical"."association_text" (
    "association_id" TEXT NOT NULL,
    "locale" "canonical"."Locale" NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "association_text_pkey" PRIMARY KEY ("association_id","locale")
);

-- CreateTable
CREATE TABLE "canonical"."skill" (
    "id" TEXT NOT NULL,
    "sin" "canonical"."Sin",
    "attack_type" "canonical"."AtkType",
    "kind" "canonical"."SkillKind",
    "skill_tier" INTEGER,

    CONSTRAINT "skill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "canonical"."skill_stage" (
    "skill_id" TEXT NOT NULL,
    "uptie" INTEGER NOT NULL,
    "changed_here" BOOLEAN NOT NULL,

    CONSTRAINT "skill_stage_pkey" PRIMARY KEY ("skill_id","uptie")
);

-- CreateTable
CREATE TABLE "canonical"."skill_stage_text" (
    "skill_id" TEXT NOT NULL,
    "uptie" INTEGER NOT NULL,
    "locale" "canonical"."Locale" NOT NULL,
    "name" TEXT NOT NULL,
    "desc" TEXT,

    CONSTRAINT "skill_stage_text_pkey" PRIMARY KEY ("skill_id","uptie","locale")
);

-- CreateTable
CREATE TABLE "canonical"."skill_coin" (
    "skill_id" TEXT NOT NULL,
    "uptie" INTEGER NOT NULL,
    "index" INTEGER NOT NULL,
    "effects" TEXT[],

    CONSTRAINT "skill_coin_pkey" PRIMARY KEY ("skill_id","uptie","index")
);

-- CreateTable
CREATE TABLE "canonical"."passive" (
    "id" TEXT NOT NULL,
    "cost" INTEGER,

    CONSTRAINT "passive_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "canonical"."passive_text" (
    "passive_id" TEXT NOT NULL,
    "locale" "canonical"."Locale" NOT NULL,
    "name" TEXT NOT NULL,
    "desc" TEXT,

    CONSTRAINT "passive_text_pkey" PRIMARY KEY ("passive_id","locale")
);

-- CreateTable
CREATE TABLE "canonical"."identity" (
    "id" TEXT NOT NULL,
    "sinner_id" INTEGER NOT NULL,
    "star" INTEGER NOT NULL,
    "team_code_eligible" BOOLEAN NOT NULL DEFAULT true,
    "season" INTEGER,
    "hp" INTEGER,
    "stagger" INTEGER,
    "def_correction" INTEGER,
    "release_date" TEXT,

    CONSTRAINT "identity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "canonical"."identity_text" (
    "identity_id" TEXT NOT NULL,
    "locale" "canonical"."Locale" NOT NULL,
    "name" TEXT NOT NULL,
    "title" TEXT,

    CONSTRAINT "identity_text_pkey" PRIMARY KEY ("identity_id","locale")
);

-- CreateTable
CREATE TABLE "canonical"."identity_resist" (
    "identity_id" TEXT NOT NULL,
    "atk_type" "canonical"."AtkType" NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "identity_resist_pkey" PRIMARY KEY ("identity_id","atk_type")
);

-- CreateTable
CREATE TABLE "canonical"."identity_speed" (
    "identity_id" TEXT NOT NULL,
    "min" INTEGER NOT NULL,
    "max" INTEGER NOT NULL,

    CONSTRAINT "identity_speed_pkey" PRIMARY KEY ("identity_id")
);

-- CreateTable
CREATE TABLE "canonical"."identity_skill" (
    "identity_id" TEXT NOT NULL,
    "skill_id" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "ordinal" INTEGER NOT NULL,
    "slot" INTEGER,
    "copies" INTEGER,

    CONSTRAINT "identity_skill_pkey" PRIMARY KEY ("identity_id","skill_id","role")
);

-- CreateTable
CREATE TABLE "canonical"."identity_passive" (
    "identity_id" TEXT NOT NULL,
    "passive_id" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "level" INTEGER NOT NULL,

    CONSTRAINT "identity_passive_pkey" PRIMARY KEY ("identity_id","passive_id","role","level")
);

-- CreateTable
CREATE TABLE "canonical"."identity_association" (
    "identity_id" TEXT NOT NULL,
    "association_id" TEXT NOT NULL,

    CONSTRAINT "identity_association_pkey" PRIMARY KEY ("identity_id","association_id")
);

-- CreateTable
CREATE TABLE "canonical"."identity_keyword" (
    "identity_id" TEXT NOT NULL,
    "keyword_id" TEXT NOT NULL,
    "skill_slots" INTEGER[],

    CONSTRAINT "identity_keyword_pkey" PRIMARY KEY ("identity_id","keyword_id")
);

-- CreateTable
CREATE TABLE "canonical"."identity_unit_keyword" (
    "identity_id" TEXT NOT NULL,
    "keyword" TEXT NOT NULL,

    CONSTRAINT "identity_unit_keyword_pkey" PRIMARY KEY ("identity_id","keyword")
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

-- CreateIndex
CREATE INDEX "identity_sinner_id_idx" ON "canonical"."identity"("sinner_id");

-- CreateIndex
CREATE INDEX "identity_star_idx" ON "canonical"."identity"("star");

-- CreateIndex
CREATE INDEX "identity_skill_skill_id_idx" ON "canonical"."identity_skill"("skill_id");

-- CreateIndex
CREATE INDEX "identity_passive_passive_id_idx" ON "canonical"."identity_passive"("passive_id");

-- CreateIndex
CREATE INDEX "identity_association_association_id_idx" ON "canonical"."identity_association"("association_id");

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

-- AddForeignKey
ALTER TABLE "canonical"."sinner_text" ADD CONSTRAINT "sinner_text_sinner_id_fkey" FOREIGN KEY ("sinner_id") REFERENCES "canonical"."sinner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "canonical"."association_text" ADD CONSTRAINT "association_text_association_id_fkey" FOREIGN KEY ("association_id") REFERENCES "canonical"."association"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "canonical"."skill_stage" ADD CONSTRAINT "skill_stage_skill_id_fkey" FOREIGN KEY ("skill_id") REFERENCES "canonical"."skill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "canonical"."skill_stage_text" ADD CONSTRAINT "skill_stage_text_skill_id_uptie_fkey" FOREIGN KEY ("skill_id", "uptie") REFERENCES "canonical"."skill_stage"("skill_id", "uptie") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "canonical"."skill_coin" ADD CONSTRAINT "skill_coin_skill_id_uptie_fkey" FOREIGN KEY ("skill_id", "uptie") REFERENCES "canonical"."skill_stage"("skill_id", "uptie") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "canonical"."passive_text" ADD CONSTRAINT "passive_text_passive_id_fkey" FOREIGN KEY ("passive_id") REFERENCES "canonical"."passive"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "canonical"."identity" ADD CONSTRAINT "identity_sinner_id_fkey" FOREIGN KEY ("sinner_id") REFERENCES "canonical"."sinner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "canonical"."identity_text" ADD CONSTRAINT "identity_text_identity_id_fkey" FOREIGN KEY ("identity_id") REFERENCES "canonical"."identity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "canonical"."identity_resist" ADD CONSTRAINT "identity_resist_identity_id_fkey" FOREIGN KEY ("identity_id") REFERENCES "canonical"."identity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "canonical"."identity_speed" ADD CONSTRAINT "identity_speed_identity_id_fkey" FOREIGN KEY ("identity_id") REFERENCES "canonical"."identity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "canonical"."identity_skill" ADD CONSTRAINT "identity_skill_identity_id_fkey" FOREIGN KEY ("identity_id") REFERENCES "canonical"."identity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "canonical"."identity_skill" ADD CONSTRAINT "identity_skill_skill_id_fkey" FOREIGN KEY ("skill_id") REFERENCES "canonical"."skill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "canonical"."identity_passive" ADD CONSTRAINT "identity_passive_identity_id_fkey" FOREIGN KEY ("identity_id") REFERENCES "canonical"."identity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "canonical"."identity_passive" ADD CONSTRAINT "identity_passive_passive_id_fkey" FOREIGN KEY ("passive_id") REFERENCES "canonical"."passive"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "canonical"."identity_association" ADD CONSTRAINT "identity_association_identity_id_fkey" FOREIGN KEY ("identity_id") REFERENCES "canonical"."identity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "canonical"."identity_association" ADD CONSTRAINT "identity_association_association_id_fkey" FOREIGN KEY ("association_id") REFERENCES "canonical"."association"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "canonical"."identity_keyword" ADD CONSTRAINT "identity_keyword_identity_id_fkey" FOREIGN KEY ("identity_id") REFERENCES "canonical"."identity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "canonical"."identity_unit_keyword" ADD CONSTRAINT "identity_unit_keyword_identity_id_fkey" FOREIGN KEY ("identity_id") REFERENCES "canonical"."identity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

