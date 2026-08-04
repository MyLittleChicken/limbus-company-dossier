-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "app";

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

-- CreateEnum
CREATE TYPE "canonical"."EgoRank" AS ENUM ('ZAYIN', 'TETH', 'HE', 'WAW', 'ALEPH');

-- CreateEnum
CREATE TYPE "canonical"."BuffType" AS ENUM ('Positive', 'Neutral', 'Negative');

-- CreateEnum
CREATE TYPE "canonical"."TargetKind" AS ENUM ('top', 'wave', 'phase', 'battle');

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
CREATE TABLE "canonical"."pack_boss_encounter" (
    "pack_id" TEXT NOT NULL,
    "encounter_id" TEXT NOT NULL,

    CONSTRAINT "pack_boss_encounter_pkey" PRIMARY KEY ("pack_id","encounter_id")
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
    "order" INTEGER,

    CONSTRAINT "keyword_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "canonical"."axis" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "note" TEXT,

    CONSTRAINT "axis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "canonical"."identity_axis" (
    "identity_id" TEXT NOT NULL,
    "axis_id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "ego_id" TEXT,

    CONSTRAINT "identity_axis_pkey" PRIMARY KEY ("identity_id","axis_id","source")
);

-- CreateTable
CREATE TABLE "canonical"."trigger_ref" (
    "trigger_id" TEXT NOT NULL,
    "ref_kind" TEXT NOT NULL,
    "ref_id" TEXT NOT NULL DEFAULT '',
    "resonance_mode" TEXT,
    "threshold" INTEGER,
    "evaluability" TEXT NOT NULL,

    CONSTRAINT "trigger_ref_pkey" PRIMARY KEY ("trigger_id","ref_kind","ref_id")
);

-- CreateTable
CREATE TABLE "canonical"."effect_ref" (
    "effect_id" TEXT NOT NULL,
    "ref_kind" TEXT NOT NULL,
    "ref_id" TEXT NOT NULL DEFAULT '',
    "mode" TEXT NOT NULL,

    CONSTRAINT "effect_ref_pkey" PRIMARY KEY ("effect_id","ref_kind","ref_id")
);

-- CreateTable
CREATE TABLE "canonical"."gift_trigger_param" (
    "gift_id" TEXT NOT NULL,
    "trigger_id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "value" TEXT,
    "slots" INTEGER[],
    "source" TEXT NOT NULL,

    CONSTRAINT "gift_trigger_param_pkey" PRIMARY KEY ("gift_id","trigger_id","kind")
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
    "sprite" TEXT,
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
    "desc_raw" TEXT,

    CONSTRAINT "gift_stage_text_pkey" PRIMARY KEY ("gift_id","level","locale")
);

-- CreateTable
CREATE TABLE "canonical"."gift_effect" (
    "gift_id" TEXT NOT NULL,
    "index" INTEGER NOT NULL,
    "effect_id" TEXT NOT NULL,

    CONSTRAINT "gift_effect_pkey" PRIMARY KEY ("gift_id","index")
);

-- CreateTable
CREATE TABLE "canonical"."gift_trigger" (
    "gift_id" TEXT NOT NULL,
    "index" INTEGER NOT NULL,
    "trigger_id" TEXT NOT NULL,

    CONSTRAINT "gift_trigger_pkey" PRIMARY KEY ("gift_id","index")
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
    "base_value" INTEGER,
    "coin_value" INTEGER,
    "atk_weight" INTEGER,
    "level_correction" INTEGER,
    "clashable" BOOLEAN,

    CONSTRAINT "skill_stage_pkey" PRIMARY KEY ("skill_id","uptie")
);

-- CreateTable
CREATE TABLE "canonical"."skill_stage_text" (
    "skill_id" TEXT NOT NULL,
    "uptie" INTEGER NOT NULL,
    "locale" "canonical"."Locale" NOT NULL,
    "name" TEXT NOT NULL,
    "desc" TEXT,
    "desc_raw" TEXT,

    CONSTRAINT "skill_stage_text_pkey" PRIMARY KEY ("skill_id","uptie","locale")
);

-- CreateTable
CREATE TABLE "canonical"."skill_coin" (
    "skill_id" TEXT NOT NULL,
    "uptie" INTEGER NOT NULL,
    "index" INTEGER NOT NULL,
    "locale" "canonical"."Locale" NOT NULL,
    "effects" TEXT[],
    "type" TEXT,

    CONSTRAINT "skill_coin_pkey" PRIMARY KEY ("skill_id","uptie","index","locale")
);

-- CreateTable
CREATE TABLE "canonical"."passive" (
    "id" TEXT NOT NULL,
    "conditions" TEXT[],
    "cond_type" TEXT,

    CONSTRAINT "passive_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "canonical"."passive_requirement" (
    "passive_id" TEXT NOT NULL,
    "index" INTEGER NOT NULL,
    "sin" "canonical"."Sin" NOT NULL,
    "value" INTEGER NOT NULL,

    CONSTRAINT "passive_requirement_pkey" PRIMARY KEY ("passive_id","index")
);

-- CreateTable
CREATE TABLE "canonical"."passive_text" (
    "passive_id" TEXT NOT NULL,
    "locale" "canonical"."Locale" NOT NULL,
    "name" TEXT NOT NULL,
    "desc" TEXT,
    "desc_raw" TEXT,

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
    "hp_level" DOUBLE PRECISION,
    "stagger" INTEGER[],
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
    "uptie" INTEGER NOT NULL,
    "min" INTEGER NOT NULL,
    "max" INTEGER NOT NULL,

    CONSTRAINT "identity_speed_pkey" PRIMARY KEY ("identity_id","uptie")
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

-- CreateTable
CREATE TABLE "canonical"."ego" (
    "id" TEXT NOT NULL,
    "sinner_id" INTEGER NOT NULL,
    "rank" "canonical"."EgoRank",
    "sin" "canonical"."Sin",
    "attack_type" "canonical"."AtkType",
    "season" INTEGER,
    "release_date" TEXT,
    "max_threadspin" INTEGER,
    "extractable" BOOLEAN NOT NULL DEFAULT false,
    "presentation_only" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ego_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "canonical"."ego_text" (
    "ego_id" TEXT NOT NULL,
    "locale" "canonical"."Locale" NOT NULL,
    "name" TEXT NOT NULL,
    "desc" TEXT,
    "desc_raw" TEXT,

    CONSTRAINT "ego_text_pkey" PRIMARY KEY ("ego_id","locale")
);

-- CreateTable
CREATE TABLE "canonical"."ego_resist" (
    "ego_id" TEXT NOT NULL,
    "sin" "canonical"."Sin" NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "ego_resist_pkey" PRIMARY KEY ("ego_id","sin")
);

-- CreateTable
CREATE TABLE "canonical"."ego_cost" (
    "ego_id" TEXT NOT NULL,
    "sin" "canonical"."Sin" NOT NULL,
    "count" INTEGER NOT NULL,

    CONSTRAINT "ego_cost_pkey" PRIMARY KEY ("ego_id","sin")
);

-- CreateTable
CREATE TABLE "canonical"."ego_corrosion" (
    "ego_id" TEXT NOT NULL,
    "index" INTEGER NOT NULL,
    "section" DOUBLE PRECISION NOT NULL,
    "probability" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "ego_corrosion_pkey" PRIMARY KEY ("ego_id","index")
);

-- CreateTable
CREATE TABLE "canonical"."ego_requirement" (
    "ego_id" TEXT NOT NULL,
    "attribute_type" TEXT NOT NULL,
    "num" INTEGER NOT NULL,

    CONSTRAINT "ego_requirement_pkey" PRIMARY KEY ("ego_id","attribute_type")
);

-- CreateTable
CREATE TABLE "canonical"."ego_skill" (
    "id" TEXT NOT NULL,
    "ego_id" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "ordinal" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ego_skill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "canonical"."ego_skill_stage" (
    "skill_id" TEXT NOT NULL,
    "uptie" INTEGER NOT NULL,
    "sp_cost" INTEGER,
    "base_value" INTEGER,
    "coin_value" INTEGER,
    "atk_weight" INTEGER,
    "level_correction" INTEGER,

    CONSTRAINT "ego_skill_stage_pkey" PRIMARY KEY ("skill_id","uptie")
);

-- CreateTable
CREATE TABLE "canonical"."ego_skill_stage_text" (
    "skill_id" TEXT NOT NULL,
    "uptie" INTEGER NOT NULL,
    "locale" "canonical"."Locale" NOT NULL,
    "name" TEXT NOT NULL,
    "desc" TEXT,
    "desc_raw" TEXT,
    "ab_name" TEXT,

    CONSTRAINT "ego_skill_stage_text_pkey" PRIMARY KEY ("skill_id","uptie","locale")
);

-- CreateTable
CREATE TABLE "canonical"."ego_skill_coin" (
    "skill_id" TEXT NOT NULL,
    "uptie" INTEGER NOT NULL,
    "index" INTEGER NOT NULL,
    "locale" "canonical"."Locale" NOT NULL,
    "effects" TEXT[],

    CONSTRAINT "ego_skill_coin_pkey" PRIMARY KEY ("skill_id","uptie","index","locale")
);

-- CreateTable
CREATE TABLE "canonical"."ego_passive" (
    "id" TEXT NOT NULL,

    CONSTRAINT "ego_passive_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "canonical"."ego_passive_text" (
    "passive_id" TEXT NOT NULL,
    "locale" "canonical"."Locale" NOT NULL,
    "name" TEXT NOT NULL,
    "desc" TEXT,
    "desc_raw" TEXT,

    CONSTRAINT "ego_passive_text_pkey" PRIMARY KEY ("passive_id","locale")
);

-- CreateTable
CREATE TABLE "canonical"."ego_passive_link" (
    "ego_id" TEXT NOT NULL,
    "passive_id" TEXT NOT NULL,

    CONSTRAINT "ego_passive_link_pkey" PRIMARY KEY ("ego_id","passive_id")
);

-- CreateTable
CREATE TABLE "canonical"."status" (
    "id" TEXT NOT NULL,
    "buff_type" "canonical"."BuffType" NOT NULL,
    "sprite" TEXT,

    CONSTRAINT "status_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "canonical"."status_text" (
    "status_id" TEXT NOT NULL,
    "locale" "canonical"."Locale" NOT NULL,
    "name" TEXT NOT NULL,
    "desc" TEXT,
    "desc_raw" TEXT,
    "summary" TEXT,

    CONSTRAINT "status_text_pkey" PRIMARY KEY ("status_id","locale")
);

-- CreateTable
CREATE TABLE "canonical"."status_category" (
    "status_id" TEXT NOT NULL,
    "category" TEXT NOT NULL,

    CONSTRAINT "status_category_pkey" PRIMARY KEY ("status_id","category")
);

-- CreateTable
CREATE TABLE "canonical"."sin_info" (
    "sin" "canonical"."Sin" NOT NULL,
    "attribute" TEXT NOT NULL,
    "order" INTEGER NOT NULL,

    CONSTRAINT "sin_info_pkey" PRIMARY KEY ("sin")
);

-- CreateTable
CREATE TABLE "canonical"."sin_text" (
    "sin" "canonical"."Sin" NOT NULL,
    "locale" "canonical"."Locale" NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "sin_text_pkey" PRIMARY KEY ("sin","locale")
);

-- CreateTable
CREATE TABLE "canonical"."term" (
    "id" TEXT NOT NULL,

    CONSTRAINT "term_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "canonical"."term_text" (
    "term_id" TEXT NOT NULL,
    "locale" "canonical"."Locale" NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "term_text_pkey" PRIMARY KEY ("term_id","locale")
);

-- CreateTable
CREATE TABLE "canonical"."coin_token" (
    "skill_id" TEXT NOT NULL,
    "uptie" INTEGER NOT NULL,
    "coin_idx" INTEGER NOT NULL,
    "ordinal" INTEGER NOT NULL,
    "token" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "amount" INTEGER,
    "status_id" TEXT,

    CONSTRAINT "coin_token_pkey" PRIMARY KEY ("skill_id","uptie","coin_idx","ordinal")
);

-- CreateTable
CREATE TABLE "canonical"."ego_status" (
    "ego_id" TEXT NOT NULL,
    "status_id" TEXT NOT NULL,

    CONSTRAINT "ego_status_pkey" PRIMARY KEY ("ego_id","status_id")
);

-- CreateTable
CREATE TABLE "canonical"."identity_status" (
    "identity_id" TEXT NOT NULL,
    "status_id" TEXT NOT NULL,

    CONSTRAINT "identity_status_pkey" PRIMARY KEY ("identity_id","status_id")
);

-- CreateTable
CREATE TABLE "canonical"."choice_event" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "illust_id" INTEGER,

    CONSTRAINT "choice_event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "canonical"."choice_event_text" (
    "event_id" TEXT NOT NULL,
    "locale" "canonical"."Locale" NOT NULL,
    "name" TEXT,
    "desc" TEXT,
    "desc_raw" TEXT,

    CONSTRAINT "choice_event_text_pkey" PRIMARY KEY ("event_id","locale")
);

-- CreateTable
CREATE TABLE "canonical"."choice_event_gift" (
    "event_id" TEXT NOT NULL,
    "gift_id" TEXT NOT NULL,

    CONSTRAINT "choice_event_gift_pkey" PRIMARY KEY ("event_id","gift_id")
);

-- CreateTable
CREATE TABLE "canonical"."choice_option" (
    "event_id" TEXT NOT NULL,
    "index" INTEGER NOT NULL,
    "message" TEXT NOT NULL,
    "results" JSONB NOT NULL,

    CONSTRAINT "choice_option_pkey" PRIMARY KEY ("event_id","index")
);

-- CreateTable
CREATE TABLE "canonical"."choice_option_text" (
    "event_id" TEXT NOT NULL,
    "index" INTEGER NOT NULL,
    "locale" "canonical"."Locale" NOT NULL,
    "message" TEXT NOT NULL,
    "desc" TEXT,

    CONSTRAINT "choice_option_text_pkey" PRIMARY KEY ("event_id","index","locale")
);

-- CreateTable
CREATE TABLE "canonical"."achievement" (
    "id" TEXT NOT NULL,
    "season" INTEGER NOT NULL,
    "category" TEXT NOT NULL,
    "points" INTEGER[],
    "hard_only" BOOLEAN[],
    "thresholds" JSONB,

    CONSTRAINT "achievement_pkey" PRIMARY KEY ("id","category","season")
);

-- CreateTable
CREATE TABLE "canonical"."achievement_text" (
    "id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "season" INTEGER NOT NULL,
    "locale" "canonical"."Locale" NOT NULL,
    "text" TEXT NOT NULL,

    CONSTRAINT "achievement_text_pkey" PRIMARY KEY ("id","category","season","locale")
);

-- CreateTable
CREATE TABLE "canonical"."reward" (
    "season" INTEGER NOT NULL,
    "level" INTEGER NOT NULL,
    "item" TEXT NOT NULL,
    "count" INTEGER NOT NULL,

    CONSTRAINT "reward_pkey" PRIMARY KEY ("season","level")
);

-- CreateTable
CREATE TABLE "canonical"."adversity" (
    "floor_range" TEXT NOT NULL,
    "index" INTEGER NOT NULL,
    "value" INTEGER NOT NULL,

    CONSTRAINT "adversity_pkey" PRIMARY KEY ("floor_range","index")
);

-- CreateTable
CREATE TABLE "canonical"."adversity_text" (
    "floor_range" TEXT NOT NULL,
    "index" INTEGER NOT NULL,
    "locale" "canonical"."Locale" NOT NULL,
    "name" TEXT NOT NULL,
    "desc" TEXT NOT NULL,

    CONSTRAINT "adversity_text_pkey" PRIMARY KEY ("floor_range","index","locale")
);

-- CreateTable
CREATE TABLE "canonical"."grace" (
    "id" TEXT NOT NULL,
    "index" INTEGER NOT NULL,
    "cost" INTEGER NOT NULL,

    CONSTRAINT "grace_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "canonical"."grace_text" (
    "grace_id" TEXT NOT NULL,
    "locale" "canonical"."Locale" NOT NULL,
    "name" TEXT NOT NULL,
    "descs" JSONB NOT NULL,

    CONSTRAINT "grace_text_pkey" PRIMARY KEY ("grace_id","locale")
);

-- CreateTable
CREATE TABLE "canonical"."start_gift" (
    "keyword_id" TEXT NOT NULL,
    "gift_id" TEXT NOT NULL,

    CONSTRAINT "start_gift_pkey" PRIMARY KEY ("keyword_id","gift_id")
);

-- CreateTable
CREATE TABLE "canonical"."encounter" (
    "id" TEXT NOT NULL,
    "group" TEXT,
    "name" TEXT NOT NULL,
    "site_id" TEXT NOT NULL,
    "waves" JSONB,
    "phases" JSONB,
    "battles" JSONB,

    CONSTRAINT "encounter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "canonical"."encounter_target" (
    "encounter_id" TEXT NOT NULL,
    "kind" "canonical"."TargetKind" NOT NULL,
    "group_index" INTEGER NOT NULL,
    "index" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "portrait" INTEGER,
    "num" INTEGER,

    CONSTRAINT "encounter_target_pkey" PRIMARY KEY ("encounter_id","kind","group_index","index")
);

-- CreateTable
CREATE TABLE "canonical"."encounter_target_part" (
    "encounter_id" TEXT NOT NULL,
    "kind" "canonical"."TargetKind" NOT NULL,
    "group_index" INTEGER NOT NULL,
    "target_index" INTEGER NOT NULL,
    "part_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "hp_base" DOUBLE PRECISION,
    "hp_level" DOUBLE PRECISION,
    "def_correction" INTEGER,
    "speed_min" INTEGER,
    "speed_max" INTEGER,

    CONSTRAINT "encounter_target_part_pkey" PRIMARY KEY ("encounter_id","kind","group_index","target_index","part_id")
);

-- CreateTable
CREATE TABLE "canonical"."encounter_part_resist" (
    "encounter_id" TEXT NOT NULL,
    "kind" "canonical"."TargetKind" NOT NULL,
    "group_index" INTEGER NOT NULL,
    "target_index" INTEGER NOT NULL,
    "part_id" TEXT NOT NULL,
    "axis" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "encounter_part_resist_pkey" PRIMARY KEY ("encounter_id","kind","group_index","target_index","part_id","axis")
);

-- CreateTable
CREATE TABLE "canonical"."enemy" (
    "id" TEXT NOT NULL,

    CONSTRAINT "enemy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "canonical"."enemy_part" (
    "id" TEXT NOT NULL,
    "enemy_id" TEXT NOT NULL,

    CONSTRAINT "enemy_part_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "canonical"."enemy_text" (
    "enemy_id" TEXT NOT NULL,
    "locale" "canonical"."Locale" NOT NULL,
    "name" TEXT NOT NULL,
    "role_label" TEXT,

    CONSTRAINT "enemy_text_pkey" PRIMARY KEY ("enemy_id","locale")
);

-- CreateTable
CREATE TABLE "canonical"."enemy_part_text" (
    "part_id" TEXT NOT NULL,
    "locale" "canonical"."Locale" NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "enemy_part_text_pkey" PRIMARY KEY ("part_id","locale")
);

-- CreateTable
CREATE TABLE "app"."field_override" (
    "entity" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "locale" TEXT NOT NULL DEFAULT '',
    "value" JSONB NOT NULL,
    "note" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "field_override_pkey" PRIMARY KEY ("entity","entity_id","field","locale")
);

-- CreateTable
CREATE TABLE "app"."account" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app"."setting" (
    "account_id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,

    CONSTRAINT "setting_pkey" PRIMARY KEY ("account_id","key")
);

-- CreateTable
CREATE TABLE "app"."run" (
    "id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "difficulty" "canonical"."Difficulty" NOT NULL,
    "started_at" TIMESTAMPTZ(3) NOT NULL,
    "ended_at" TIMESTAMPTZ(3),
    "floor" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "run_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app"."run_floor" (
    "run_id" TEXT NOT NULL,
    "floor" INTEGER NOT NULL,
    "pack_id" TEXT NOT NULL,

    CONSTRAINT "run_floor_pkey" PRIMARY KEY ("run_id","floor")
);

-- CreateTable
CREATE TABLE "app"."run_gift" (
    "run_id" TEXT NOT NULL,
    "gift_id" TEXT NOT NULL,
    "level" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "run_gift_pkey" PRIMARY KEY ("run_id","gift_id")
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
CREATE INDEX "pack_boss_encounter_encounter_id_idx" ON "canonical"."pack_boss_encounter"("encounter_id");

-- CreateIndex
CREATE INDEX "floor_pack_pack_id_idx" ON "canonical"."floor_pack"("pack_id");

-- CreateIndex
CREATE INDEX "identity_axis_axis_id_idx" ON "canonical"."identity_axis"("axis_id");

-- CreateIndex
CREATE INDEX "trigger_ref_ref_kind_ref_id_idx" ON "canonical"."trigger_ref"("ref_kind", "ref_id");

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

-- CreateIndex
CREATE INDEX "ego_sinner_id_idx" ON "canonical"."ego"("sinner_id");

-- CreateIndex
CREATE INDEX "ego_rank_idx" ON "canonical"."ego"("rank");

-- CreateIndex
CREATE INDEX "ego_skill_ego_id_idx" ON "canonical"."ego_skill"("ego_id");

-- CreateIndex
CREATE INDEX "ego_passive_link_passive_id_idx" ON "canonical"."ego_passive_link"("passive_id");

-- CreateIndex
CREATE INDEX "status_buff_type_idx" ON "canonical"."status"("buff_type");

-- CreateIndex
CREATE INDEX "status_category_category_idx" ON "canonical"."status_category"("category");

-- CreateIndex
CREATE INDEX "coin_token_token_idx" ON "canonical"."coin_token"("token");

-- CreateIndex
CREATE INDEX "coin_token_status_id_idx" ON "canonical"."coin_token"("status_id");

-- CreateIndex
CREATE INDEX "ego_status_status_id_idx" ON "canonical"."ego_status"("status_id");

-- CreateIndex
CREATE INDEX "identity_status_status_id_idx" ON "canonical"."identity_status"("status_id");

-- CreateIndex
CREATE INDEX "choice_event_gift_gift_id_idx" ON "canonical"."choice_event_gift"("gift_id");

-- CreateIndex
CREATE INDEX "achievement_category_idx" ON "canonical"."achievement"("category");

-- CreateIndex
CREATE INDEX "start_gift_gift_id_idx" ON "canonical"."start_gift"("gift_id");

-- CreateIndex
CREATE INDEX "encounter_group_idx" ON "canonical"."encounter"("group");

-- CreateIndex
CREATE INDEX "enemy_part_enemy_id_idx" ON "canonical"."enemy_part"("enemy_id");

-- CreateIndex
CREATE INDEX "field_override_entity_field_idx" ON "app"."field_override"("entity", "field");

-- CreateIndex
CREATE INDEX "run_account_id_idx" ON "app"."run"("account_id");

-- CreateIndex
CREATE INDEX "run_floor_pack_id_idx" ON "app"."run_floor"("pack_id");

-- CreateIndex
CREATE INDEX "run_gift_gift_id_idx" ON "app"."run_gift"("gift_id");

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
ALTER TABLE "canonical"."pack_boss_encounter" ADD CONSTRAINT "pack_boss_encounter_pack_id_fkey" FOREIGN KEY ("pack_id") REFERENCES "canonical"."pack"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "canonical"."pack_boss_encounter" ADD CONSTRAINT "pack_boss_encounter_encounter_id_fkey" FOREIGN KEY ("encounter_id") REFERENCES "canonical"."encounter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "canonical"."floor_pack" ADD CONSTRAINT "floor_pack_pack_id_fkey" FOREIGN KEY ("pack_id") REFERENCES "canonical"."pack"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "canonical"."identity_axis" ADD CONSTRAINT "identity_axis_identity_id_fkey" FOREIGN KEY ("identity_id") REFERENCES "canonical"."identity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "canonical"."identity_axis" ADD CONSTRAINT "identity_axis_axis_id_fkey" FOREIGN KEY ("axis_id") REFERENCES "canonical"."axis"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "canonical"."trigger_ref" ADD CONSTRAINT "trigger_ref_trigger_id_fkey" FOREIGN KEY ("trigger_id") REFERENCES "canonical"."trigger"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "canonical"."effect_ref" ADD CONSTRAINT "effect_ref_effect_id_fkey" FOREIGN KEY ("effect_id") REFERENCES "canonical"."effect"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "canonical"."gift_trigger_param" ADD CONSTRAINT "gift_trigger_param_gift_id_fkey" FOREIGN KEY ("gift_id") REFERENCES "canonical"."gift"("id") ON DELETE CASCADE ON UPDATE CASCADE;

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
ALTER TABLE "canonical"."passive_requirement" ADD CONSTRAINT "passive_requirement_passive_id_fkey" FOREIGN KEY ("passive_id") REFERENCES "canonical"."passive"("id") ON DELETE CASCADE ON UPDATE CASCADE;

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

-- AddForeignKey
ALTER TABLE "canonical"."ego" ADD CONSTRAINT "ego_sinner_id_fkey" FOREIGN KEY ("sinner_id") REFERENCES "canonical"."sinner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "canonical"."ego_text" ADD CONSTRAINT "ego_text_ego_id_fkey" FOREIGN KEY ("ego_id") REFERENCES "canonical"."ego"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "canonical"."ego_resist" ADD CONSTRAINT "ego_resist_ego_id_fkey" FOREIGN KEY ("ego_id") REFERENCES "canonical"."ego"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "canonical"."ego_cost" ADD CONSTRAINT "ego_cost_ego_id_fkey" FOREIGN KEY ("ego_id") REFERENCES "canonical"."ego"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "canonical"."ego_corrosion" ADD CONSTRAINT "ego_corrosion_ego_id_fkey" FOREIGN KEY ("ego_id") REFERENCES "canonical"."ego"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "canonical"."ego_requirement" ADD CONSTRAINT "ego_requirement_ego_id_fkey" FOREIGN KEY ("ego_id") REFERENCES "canonical"."ego"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "canonical"."ego_skill" ADD CONSTRAINT "ego_skill_ego_id_fkey" FOREIGN KEY ("ego_id") REFERENCES "canonical"."ego"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "canonical"."ego_skill_stage" ADD CONSTRAINT "ego_skill_stage_skill_id_fkey" FOREIGN KEY ("skill_id") REFERENCES "canonical"."ego_skill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "canonical"."ego_skill_stage_text" ADD CONSTRAINT "ego_skill_stage_text_skill_id_uptie_fkey" FOREIGN KEY ("skill_id", "uptie") REFERENCES "canonical"."ego_skill_stage"("skill_id", "uptie") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "canonical"."ego_skill_coin" ADD CONSTRAINT "ego_skill_coin_skill_id_uptie_fkey" FOREIGN KEY ("skill_id", "uptie") REFERENCES "canonical"."ego_skill_stage"("skill_id", "uptie") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "canonical"."ego_passive_text" ADD CONSTRAINT "ego_passive_text_passive_id_fkey" FOREIGN KEY ("passive_id") REFERENCES "canonical"."ego_passive"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "canonical"."ego_passive_link" ADD CONSTRAINT "ego_passive_link_ego_id_fkey" FOREIGN KEY ("ego_id") REFERENCES "canonical"."ego"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "canonical"."ego_passive_link" ADD CONSTRAINT "ego_passive_link_passive_id_fkey" FOREIGN KEY ("passive_id") REFERENCES "canonical"."ego_passive"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "canonical"."status_text" ADD CONSTRAINT "status_text_status_id_fkey" FOREIGN KEY ("status_id") REFERENCES "canonical"."status"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "canonical"."status_category" ADD CONSTRAINT "status_category_status_id_fkey" FOREIGN KEY ("status_id") REFERENCES "canonical"."status"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "canonical"."sin_text" ADD CONSTRAINT "sin_text_sin_fkey" FOREIGN KEY ("sin") REFERENCES "canonical"."sin_info"("sin") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "canonical"."term_text" ADD CONSTRAINT "term_text_term_id_fkey" FOREIGN KEY ("term_id") REFERENCES "canonical"."term"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "canonical"."coin_token" ADD CONSTRAINT "coin_token_status_id_fkey" FOREIGN KEY ("status_id") REFERENCES "canonical"."status"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "canonical"."ego_status" ADD CONSTRAINT "ego_status_ego_id_fkey" FOREIGN KEY ("ego_id") REFERENCES "canonical"."ego"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "canonical"."ego_status" ADD CONSTRAINT "ego_status_status_id_fkey" FOREIGN KEY ("status_id") REFERENCES "canonical"."status"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "canonical"."identity_status" ADD CONSTRAINT "identity_status_identity_id_fkey" FOREIGN KEY ("identity_id") REFERENCES "canonical"."identity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "canonical"."identity_status" ADD CONSTRAINT "identity_status_status_id_fkey" FOREIGN KEY ("status_id") REFERENCES "canonical"."status"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "canonical"."choice_event_text" ADD CONSTRAINT "choice_event_text_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "canonical"."choice_event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "canonical"."choice_event_gift" ADD CONSTRAINT "choice_event_gift_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "canonical"."choice_event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "canonical"."choice_event_gift" ADD CONSTRAINT "choice_event_gift_gift_id_fkey" FOREIGN KEY ("gift_id") REFERENCES "canonical"."gift"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "canonical"."choice_option" ADD CONSTRAINT "choice_option_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "canonical"."choice_event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "canonical"."choice_option_text" ADD CONSTRAINT "choice_option_text_event_id_index_fkey" FOREIGN KEY ("event_id", "index") REFERENCES "canonical"."choice_option"("event_id", "index") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "canonical"."achievement_text" ADD CONSTRAINT "achievement_text_id_category_season_fkey" FOREIGN KEY ("id", "category", "season") REFERENCES "canonical"."achievement"("id", "category", "season") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "canonical"."adversity_text" ADD CONSTRAINT "adversity_text_floor_range_index_fkey" FOREIGN KEY ("floor_range", "index") REFERENCES "canonical"."adversity"("floor_range", "index") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "canonical"."grace_text" ADD CONSTRAINT "grace_text_grace_id_fkey" FOREIGN KEY ("grace_id") REFERENCES "canonical"."grace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "canonical"."start_gift" ADD CONSTRAINT "start_gift_keyword_id_fkey" FOREIGN KEY ("keyword_id") REFERENCES "canonical"."keyword"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "canonical"."start_gift" ADD CONSTRAINT "start_gift_gift_id_fkey" FOREIGN KEY ("gift_id") REFERENCES "canonical"."gift"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "canonical"."encounter_target" ADD CONSTRAINT "encounter_target_encounter_id_fkey" FOREIGN KEY ("encounter_id") REFERENCES "canonical"."encounter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "canonical"."encounter_target_part" ADD CONSTRAINT "encounter_target_part_encounter_id_kind_group_index_target_fkey" FOREIGN KEY ("encounter_id", "kind", "group_index", "target_index") REFERENCES "canonical"."encounter_target"("encounter_id", "kind", "group_index", "index") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "canonical"."encounter_part_resist" ADD CONSTRAINT "encounter_part_resist_encounter_id_kind_group_index_target_fkey" FOREIGN KEY ("encounter_id", "kind", "group_index", "target_index", "part_id") REFERENCES "canonical"."encounter_target_part"("encounter_id", "kind", "group_index", "target_index", "part_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "canonical"."enemy_part" ADD CONSTRAINT "enemy_part_enemy_id_fkey" FOREIGN KEY ("enemy_id") REFERENCES "canonical"."enemy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "canonical"."enemy_text" ADD CONSTRAINT "enemy_text_enemy_id_fkey" FOREIGN KEY ("enemy_id") REFERENCES "canonical"."enemy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "canonical"."enemy_part_text" ADD CONSTRAINT "enemy_part_text_part_id_fkey" FOREIGN KEY ("part_id") REFERENCES "canonical"."enemy_part"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."setting" ADD CONSTRAINT "setting_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "app"."account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."run" ADD CONSTRAINT "run_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "app"."account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."run_floor" ADD CONSTRAINT "run_floor_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "app"."run"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."run_floor" ADD CONSTRAINT "run_floor_pack_id_fkey" FOREIGN KEY ("pack_id") REFERENCES "canonical"."pack"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."run_gift" ADD CONSTRAINT "run_gift_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "app"."run"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."run_gift" ADD CONSTRAINT "run_gift_gift_id_fkey" FOREIGN KEY ("gift_id") REFERENCES "canonical"."gift"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

