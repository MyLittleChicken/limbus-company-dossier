-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Sin" AS ENUM ('wrath', 'lust', 'sloth', 'gluttony', 'gloom', 'pride', 'envy');

-- CreateEnum
CREATE TYPE "AtkType" AS ENUM ('slash', 'pierce', 'blunt');

-- CreateEnum
CREATE TYPE "DefType" AS ENUM ('attack', 'guard', 'evade', 'counter');

-- CreateEnum
CREATE TYPE "EgoRank" AS ENUM ('ZAYIN', 'TETH', 'HE', 'WAW', 'ALEPH');

-- CreateEnum
CREATE TYPE "Locale" AS ENUM ('ko', 'en');

-- CreateEnum
CREATE TYPE "Difficulty" AS ENUM ('normal', 'hard');

-- CreateEnum
CREATE TYPE "BuffType" AS ENUM ('Positive', 'Negative', 'Neutral');

-- CreateTable
CREATE TABLE "dataset" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "gameVersion" TEXT NOT NULL,
    "mdVersion" TEXT,
    "snapshotDate" DATE NOT NULL,
    "sourceAnchor" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dataset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sinner" (
    "id" INTEGER NOT NULL,

    CONSTRAINT "sinner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sinner_text" (
    "sinnerId" INTEGER NOT NULL,
    "locale" "Locale" NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "sinner_text_pkey" PRIMARY KEY ("sinnerId","locale")
);

-- CreateTable
CREATE TABLE "identity" (
    "id" INTEGER NOT NULL,
    "sinnerId" INTEGER NOT NULL,
    "rarity" INTEGER NOT NULL,
    "season" INTEGER NOT NULL,
    "releaseDate" DATE NOT NULL,
    "hpBase" INTEGER NOT NULL,
    "hpPerLevel" DOUBLE PRECISION NOT NULL,
    "defCorrection" INTEGER NOT NULL,
    "breakSection" INTEGER[],

    CONSTRAINT "identity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "identity_text" (
    "identityId" INTEGER NOT NULL,
    "locale" "Locale" NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "identity_text_pkey" PRIMARY KEY ("identityId","locale")
);

-- CreateTable
CREATE TABLE "identity_resist" (
    "identityId" INTEGER NOT NULL,
    "atkType" "AtkType" NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "identity_resist_pkey" PRIMARY KEY ("identityId","atkType")
);

-- CreateTable
CREATE TABLE "identity_speed" (
    "identityId" INTEGER NOT NULL,
    "uptie" INTEGER NOT NULL,
    "min" INTEGER NOT NULL,
    "max" INTEGER NOT NULL,

    CONSTRAINT "identity_speed_pkey" PRIMARY KEY ("identityId","uptie")
);

-- CreateTable
CREATE TABLE "affiliation" (
    "id" TEXT NOT NULL,

    CONSTRAINT "affiliation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "affiliation_text" (
    "affiliationId" TEXT NOT NULL,
    "locale" "Locale" NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "affiliation_text_pkey" PRIMARY KEY ("affiliationId","locale")
);

-- CreateTable
CREATE TABLE "identity_affiliation" (
    "identityId" INTEGER NOT NULL,
    "affiliationId" TEXT NOT NULL,

    CONSTRAINT "identity_affiliation_pkey" PRIMARY KEY ("identityId","affiliationId")
);

-- CreateTable
CREATE TABLE "identity_status" (
    "identityId" INTEGER NOT NULL,
    "statusId" TEXT NOT NULL,

    CONSTRAINT "identity_status_pkey" PRIMARY KEY ("identityId","statusId")
);

-- CreateTable
CREATE TABLE "skill" (
    "id" INTEGER NOT NULL,
    "identityId" INTEGER NOT NULL,
    "deckCount" INTEGER NOT NULL,
    "affinity" "Sin",
    "atkType" "AtkType",
    "defType" "DefType" NOT NULL,
    "tier" INTEGER NOT NULL,

    CONSTRAINT "skill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "skill_stage" (
    "skillId" INTEGER NOT NULL,
    "uptie" INTEGER NOT NULL,
    "baseValue" INTEGER NOT NULL,
    "coinValue" INTEGER NOT NULL,
    "atkWeight" INTEGER,
    "levelCorrection" INTEGER,

    CONSTRAINT "skill_stage_pkey" PRIMARY KEY ("skillId","uptie")
);

-- CreateTable
CREATE TABLE "skill_coin" (
    "skillId" INTEGER NOT NULL,
    "uptie" INTEGER NOT NULL,
    "index" INTEGER NOT NULL,
    "type" TEXT NOT NULL,

    CONSTRAINT "skill_coin_pkey" PRIMARY KEY ("skillId","uptie","index")
);

-- CreateTable
CREATE TABLE "skill_stage_text" (
    "skillId" INTEGER NOT NULL,
    "uptie" INTEGER NOT NULL,
    "locale" "Locale" NOT NULL,
    "name" TEXT NOT NULL,
    "desc" TEXT NOT NULL,
    "descRaw" TEXT NOT NULL,

    CONSTRAINT "skill_stage_text_pkey" PRIMARY KEY ("skillId","uptie","locale")
);

-- CreateTable
CREATE TABLE "skill_coin_text" (
    "skillId" INTEGER NOT NULL,
    "uptie" INTEGER NOT NULL,
    "index" INTEGER NOT NULL,
    "locale" "Locale" NOT NULL,
    "desc" TEXT NOT NULL,
    "descRaw" TEXT NOT NULL,

    CONSTRAINT "skill_coin_text_pkey" PRIMARY KEY ("skillId","uptie","index","locale")
);

-- CreateTable
CREATE TABLE "passive" (
    "id" TEXT NOT NULL,
    "condType" TEXT,

    CONSTRAINT "passive_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "passive_requirement" (
    "passiveId" TEXT NOT NULL,
    "index" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "value" INTEGER NOT NULL,

    CONSTRAINT "passive_requirement_pkey" PRIMARY KEY ("passiveId","index")
);

-- CreateTable
CREATE TABLE "passive_text" (
    "passiveId" TEXT NOT NULL,
    "locale" "Locale" NOT NULL,
    "name" TEXT NOT NULL,
    "desc" TEXT NOT NULL,
    "descRaw" TEXT NOT NULL,

    CONSTRAINT "passive_text_pkey" PRIMARY KEY ("passiveId","locale")
);

-- CreateTable
CREATE TABLE "identity_passive" (
    "identityId" INTEGER NOT NULL,
    "passiveId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "uptie" INTEGER NOT NULL,

    CONSTRAINT "identity_passive_pkey" PRIMARY KEY ("identityId","passiveId","kind")
);

-- CreateTable
CREATE TABLE "ego" (
    "id" INTEGER NOT NULL,
    "sinnerId" INTEGER NOT NULL,
    "rank" "EgoRank" NOT NULL,
    "season" INTEGER NOT NULL,
    "releaseDate" DATE NOT NULL,
    "awakenAffinity" "Sin" NOT NULL,
    "awakenAtkType" "AtkType" NOT NULL,
    "corrosionAffinity" "Sin",
    "corrosionAtkType" "AtkType",
    "extractable" BOOLEAN NOT NULL DEFAULT false,
    "maxThreadspin" INTEGER,

    CONSTRAINT "ego_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ego_text" (
    "egoId" INTEGER NOT NULL,
    "locale" "Locale" NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "ego_text_pkey" PRIMARY KEY ("egoId","locale")
);

-- CreateTable
CREATE TABLE "ego_cost" (
    "egoId" INTEGER NOT NULL,
    "sin" "Sin" NOT NULL,
    "amount" INTEGER NOT NULL,

    CONSTRAINT "ego_cost_pkey" PRIMARY KEY ("egoId","sin")
);

-- CreateTable
CREATE TABLE "ego_resist" (
    "egoId" INTEGER NOT NULL,
    "sin" "Sin" NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "ego_resist_pkey" PRIMARY KEY ("egoId","sin")
);

-- CreateTable
CREATE TABLE "ego_status" (
    "egoId" INTEGER NOT NULL,
    "statusId" TEXT NOT NULL,

    CONSTRAINT "ego_status_pkey" PRIMARY KEY ("egoId","statusId")
);

-- CreateTable
CREATE TABLE "ego_passive" (
    "egoId" INTEGER NOT NULL,
    "index" INTEGER NOT NULL,

    CONSTRAINT "ego_passive_pkey" PRIMARY KEY ("egoId","index")
);

-- CreateTable
CREATE TABLE "ego_passive_text" (
    "egoId" INTEGER NOT NULL,
    "index" INTEGER NOT NULL,
    "locale" "Locale" NOT NULL,
    "name" TEXT NOT NULL,
    "desc" TEXT NOT NULL,
    "descRaw" TEXT NOT NULL,

    CONSTRAINT "ego_passive_text_pkey" PRIMARY KEY ("egoId","index","locale")
);

-- CreateTable
CREATE TABLE "gift" (
    "id" INTEGER NOT NULL,
    "tier" TEXT NOT NULL,
    "keywordId" TEXT,
    "attributeType" TEXT,
    "enhanceable" BOOLEAN NOT NULL DEFAULT false,
    "hardOnly" BOOLEAN NOT NULL DEFAULT false,
    "mdCost" INTEGER,
    "sprite" TEXT NOT NULL,

    CONSTRAINT "gift_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gift_text" (
    "giftId" INTEGER NOT NULL,
    "locale" "Locale" NOT NULL,
    "enhanceLevel" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "desc" TEXT NOT NULL,
    "descRaw" TEXT NOT NULL,

    CONSTRAINT "gift_text_pkey" PRIMARY KEY ("giftId","locale","enhanceLevel")
);

-- CreateTable
CREATE TABLE "gift_token" (
    "giftId" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "index" INTEGER NOT NULL,
    "token" TEXT NOT NULL,

    CONSTRAINT "gift_token_pkey" PRIMARY KEY ("giftId","kind","index")
);

-- CreateTable
CREATE TABLE "gift_pack" (
    "giftId" INTEGER NOT NULL,
    "packId" TEXT NOT NULL,

    CONSTRAINT "gift_pack_pkey" PRIMARY KEY ("giftId","packId")
);

-- CreateTable
CREATE TABLE "gift_exclusive_pack" (
    "giftId" INTEGER NOT NULL,
    "packId" TEXT NOT NULL,

    CONSTRAINT "gift_exclusive_pack_pkey" PRIMARY KEY ("giftId","packId")
);

-- CreateTable
CREATE TABLE "fusion_recipe" (
    "id" TEXT NOT NULL,
    "resultGiftId" INTEGER NOT NULL,
    "index" INTEGER NOT NULL,

    CONSTRAINT "fusion_recipe_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fusion_slot" (
    "recipeId" TEXT NOT NULL,
    "index" INTEGER NOT NULL,
    "count" INTEGER NOT NULL,

    CONSTRAINT "fusion_slot_pkey" PRIMARY KEY ("recipeId","index")
);

-- CreateTable
CREATE TABLE "fusion_slot_option" (
    "recipeId" TEXT NOT NULL,
    "slotIndex" INTEGER NOT NULL,
    "giftId" INTEGER NOT NULL,

    CONSTRAINT "fusion_slot_option_pkey" PRIMARY KEY ("recipeId","slotIndex","giftId")
);

-- CreateTable
CREATE TABLE "pack" (
    "id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "chapter" TEXT,
    "variant" TEXT,
    "sprite" TEXT NOT NULL,
    "superposition" BOOLEAN NOT NULL DEFAULT false,
    "extreme" BOOLEAN NOT NULL DEFAULT false,
    "floorLength" INTEGER,

    CONSTRAINT "pack_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pack_text" (
    "packId" TEXT NOT NULL,
    "locale" "Locale" NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "pack_text_pkey" PRIMARY KEY ("packId","locale")
);

-- CreateTable
CREATE TABLE "pack_boss_encounter" (
    "packId" TEXT NOT NULL,
    "encounterId" TEXT NOT NULL,

    CONSTRAINT "pack_boss_encounter_pkey" PRIMARY KEY ("packId","encounterId")
);

-- CreateTable
CREATE TABLE "encounter" (
    "id" TEXT NOT NULL,

    CONSTRAINT "encounter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "encounter_target" (
    "encounterId" TEXT NOT NULL,
    "index" INTEGER NOT NULL,
    "count" INTEGER,

    CONSTRAINT "encounter_target_pkey" PRIMARY KEY ("encounterId","index")
);

-- CreateTable
CREATE TABLE "encounter_target_text" (
    "encounterId" TEXT NOT NULL,
    "index" INTEGER NOT NULL,
    "locale" "Locale" NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "encounter_target_text_pkey" PRIMARY KEY ("encounterId","index","locale")
);

-- CreateTable
CREATE TABLE "floor_pack" (
    "difficulty" "Difficulty" NOT NULL,
    "floorRange" TEXT NOT NULL,
    "packId" TEXT NOT NULL,

    CONSTRAINT "floor_pack_pkey" PRIMARY KEY ("difficulty","floorRange","packId")
);

-- CreateTable
CREATE TABLE "status" (
    "id" TEXT NOT NULL,
    "buffType" "BuffType" NOT NULL,
    "sprite" TEXT,

    CONSTRAINT "status_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "status_text" (
    "statusId" TEXT NOT NULL,
    "locale" "Locale" NOT NULL,
    "name" TEXT NOT NULL,
    "desc" TEXT NOT NULL,
    "descRaw" TEXT NOT NULL,

    CONSTRAINT "status_text_pkey" PRIMARY KEY ("statusId","locale")
);

-- CreateTable
CREATE TABLE "sin_info" (
    "sin" "Sin" NOT NULL,
    "order" INTEGER NOT NULL,
    "attribute" TEXT NOT NULL,

    CONSTRAINT "sin_info_pkey" PRIMARY KEY ("sin")
);

-- CreateTable
CREATE TABLE "sin_text" (
    "sin" "Sin" NOT NULL,
    "locale" "Locale" NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "sin_text_pkey" PRIMARY KEY ("sin","locale")
);

-- CreateTable
CREATE TABLE "keyword" (
    "id" TEXT NOT NULL,
    "order" INTEGER NOT NULL,

    CONSTRAINT "keyword_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "keyword_text" (
    "keywordId" TEXT NOT NULL,
    "locale" "Locale" NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "keyword_text_pkey" PRIMARY KEY ("keywordId","locale")
);

-- CreateTable
CREATE TABLE "mirror_dungeon" (
    "version" TEXT NOT NULL,
    "totalFloors" INTEGER NOT NULL,
    "baseFloors" INTEGER NOT NULL,

    CONSTRAINT "mirror_dungeon_pkey" PRIMARY KEY ("version")
);

-- CreateTable
CREATE TABLE "mirror_dungeon_text" (
    "version" TEXT NOT NULL,
    "locale" "Locale" NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "mirror_dungeon_text_pkey" PRIMARY KEY ("version","locale")
);

-- CreateTable
CREATE TABLE "grace_option" (
    "id" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "index" INTEGER NOT NULL,
    "cost" INTEGER NOT NULL,

    CONSTRAINT "grace_option_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "grace_option_text" (
    "graceId" TEXT NOT NULL,
    "locale" "Locale" NOT NULL,
    "name" TEXT NOT NULL,
    "descs" TEXT[],

    CONSTRAINT "grace_option_text_pkey" PRIMARY KEY ("graceId","locale")
);

-- CreateIndex
CREATE INDEX "identity_sinnerId_idx" ON "identity"("sinnerId");

-- CreateIndex
CREATE INDEX "identity_affiliation_affiliationId_idx" ON "identity_affiliation"("affiliationId");

-- CreateIndex
CREATE INDEX "identity_status_statusId_idx" ON "identity_status"("statusId");

-- CreateIndex
CREATE INDEX "skill_identityId_idx" ON "skill"("identityId");

-- CreateIndex
CREATE INDEX "identity_passive_passiveId_idx" ON "identity_passive"("passiveId");

-- CreateIndex
CREATE INDEX "ego_sinnerId_idx" ON "ego"("sinnerId");

-- CreateIndex
CREATE INDEX "ego_status_statusId_idx" ON "ego_status"("statusId");

-- CreateIndex
CREATE INDEX "gift_keywordId_idx" ON "gift"("keywordId");

-- CreateIndex
CREATE INDEX "gift_attributeType_idx" ON "gift"("attributeType");

-- CreateIndex
CREATE INDEX "gift_token_token_idx" ON "gift_token"("token");

-- CreateIndex
CREATE INDEX "gift_pack_packId_idx" ON "gift_pack"("packId");

-- CreateIndex
CREATE INDEX "gift_exclusive_pack_packId_idx" ON "gift_exclusive_pack"("packId");

-- CreateIndex
CREATE UNIQUE INDEX "fusion_recipe_resultGiftId_index_key" ON "fusion_recipe"("resultGiftId", "index");

-- CreateIndex
CREATE INDEX "fusion_slot_option_giftId_idx" ON "fusion_slot_option"("giftId");

-- CreateIndex
CREATE INDEX "pack_category_idx" ON "pack"("category");

-- CreateIndex
CREATE INDEX "pack_boss_encounter_encounterId_idx" ON "pack_boss_encounter"("encounterId");

-- CreateIndex
CREATE INDEX "floor_pack_packId_idx" ON "floor_pack"("packId");

-- AddForeignKey
ALTER TABLE "sinner_text" ADD CONSTRAINT "sinner_text_sinnerId_fkey" FOREIGN KEY ("sinnerId") REFERENCES "sinner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "identity" ADD CONSTRAINT "identity_sinnerId_fkey" FOREIGN KEY ("sinnerId") REFERENCES "sinner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "identity_text" ADD CONSTRAINT "identity_text_identityId_fkey" FOREIGN KEY ("identityId") REFERENCES "identity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "identity_resist" ADD CONSTRAINT "identity_resist_identityId_fkey" FOREIGN KEY ("identityId") REFERENCES "identity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "identity_speed" ADD CONSTRAINT "identity_speed_identityId_fkey" FOREIGN KEY ("identityId") REFERENCES "identity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affiliation_text" ADD CONSTRAINT "affiliation_text_affiliationId_fkey" FOREIGN KEY ("affiliationId") REFERENCES "affiliation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "identity_affiliation" ADD CONSTRAINT "identity_affiliation_identityId_fkey" FOREIGN KEY ("identityId") REFERENCES "identity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "identity_affiliation" ADD CONSTRAINT "identity_affiliation_affiliationId_fkey" FOREIGN KEY ("affiliationId") REFERENCES "affiliation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "identity_status" ADD CONSTRAINT "identity_status_identityId_fkey" FOREIGN KEY ("identityId") REFERENCES "identity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "identity_status" ADD CONSTRAINT "identity_status_statusId_fkey" FOREIGN KEY ("statusId") REFERENCES "status"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skill" ADD CONSTRAINT "skill_identityId_fkey" FOREIGN KEY ("identityId") REFERENCES "identity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skill_stage" ADD CONSTRAINT "skill_stage_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "skill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skill_coin" ADD CONSTRAINT "skill_coin_skillId_uptie_fkey" FOREIGN KEY ("skillId", "uptie") REFERENCES "skill_stage"("skillId", "uptie") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skill_stage_text" ADD CONSTRAINT "skill_stage_text_skillId_uptie_fkey" FOREIGN KEY ("skillId", "uptie") REFERENCES "skill_stage"("skillId", "uptie") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skill_coin_text" ADD CONSTRAINT "skill_coin_text_skillId_uptie_index_fkey" FOREIGN KEY ("skillId", "uptie", "index") REFERENCES "skill_coin"("skillId", "uptie", "index") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "passive_requirement" ADD CONSTRAINT "passive_requirement_passiveId_fkey" FOREIGN KEY ("passiveId") REFERENCES "passive"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "passive_text" ADD CONSTRAINT "passive_text_passiveId_fkey" FOREIGN KEY ("passiveId") REFERENCES "passive"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "identity_passive" ADD CONSTRAINT "identity_passive_identityId_fkey" FOREIGN KEY ("identityId") REFERENCES "identity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "identity_passive" ADD CONSTRAINT "identity_passive_passiveId_fkey" FOREIGN KEY ("passiveId") REFERENCES "passive"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ego" ADD CONSTRAINT "ego_sinnerId_fkey" FOREIGN KEY ("sinnerId") REFERENCES "sinner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ego_text" ADD CONSTRAINT "ego_text_egoId_fkey" FOREIGN KEY ("egoId") REFERENCES "ego"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ego_cost" ADD CONSTRAINT "ego_cost_egoId_fkey" FOREIGN KEY ("egoId") REFERENCES "ego"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ego_resist" ADD CONSTRAINT "ego_resist_egoId_fkey" FOREIGN KEY ("egoId") REFERENCES "ego"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ego_status" ADD CONSTRAINT "ego_status_egoId_fkey" FOREIGN KEY ("egoId") REFERENCES "ego"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ego_status" ADD CONSTRAINT "ego_status_statusId_fkey" FOREIGN KEY ("statusId") REFERENCES "status"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ego_passive" ADD CONSTRAINT "ego_passive_egoId_fkey" FOREIGN KEY ("egoId") REFERENCES "ego"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ego_passive_text" ADD CONSTRAINT "ego_passive_text_egoId_index_fkey" FOREIGN KEY ("egoId", "index") REFERENCES "ego_passive"("egoId", "index") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gift" ADD CONSTRAINT "gift_keywordId_fkey" FOREIGN KEY ("keywordId") REFERENCES "keyword"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gift_text" ADD CONSTRAINT "gift_text_giftId_fkey" FOREIGN KEY ("giftId") REFERENCES "gift"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gift_token" ADD CONSTRAINT "gift_token_giftId_fkey" FOREIGN KEY ("giftId") REFERENCES "gift"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gift_pack" ADD CONSTRAINT "gift_pack_giftId_fkey" FOREIGN KEY ("giftId") REFERENCES "gift"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gift_pack" ADD CONSTRAINT "gift_pack_packId_fkey" FOREIGN KEY ("packId") REFERENCES "pack"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gift_exclusive_pack" ADD CONSTRAINT "gift_exclusive_pack_giftId_fkey" FOREIGN KEY ("giftId") REFERENCES "gift"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gift_exclusive_pack" ADD CONSTRAINT "gift_exclusive_pack_packId_fkey" FOREIGN KEY ("packId") REFERENCES "pack"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fusion_recipe" ADD CONSTRAINT "fusion_recipe_resultGiftId_fkey" FOREIGN KEY ("resultGiftId") REFERENCES "gift"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fusion_slot" ADD CONSTRAINT "fusion_slot_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "fusion_recipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fusion_slot_option" ADD CONSTRAINT "fusion_slot_option_recipeId_slotIndex_fkey" FOREIGN KEY ("recipeId", "slotIndex") REFERENCES "fusion_slot"("recipeId", "index") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fusion_slot_option" ADD CONSTRAINT "fusion_slot_option_giftId_fkey" FOREIGN KEY ("giftId") REFERENCES "gift"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pack_text" ADD CONSTRAINT "pack_text_packId_fkey" FOREIGN KEY ("packId") REFERENCES "pack"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pack_boss_encounter" ADD CONSTRAINT "pack_boss_encounter_packId_fkey" FOREIGN KEY ("packId") REFERENCES "pack"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pack_boss_encounter" ADD CONSTRAINT "pack_boss_encounter_encounterId_fkey" FOREIGN KEY ("encounterId") REFERENCES "encounter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "encounter_target" ADD CONSTRAINT "encounter_target_encounterId_fkey" FOREIGN KEY ("encounterId") REFERENCES "encounter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "encounter_target_text" ADD CONSTRAINT "encounter_target_text_encounterId_index_fkey" FOREIGN KEY ("encounterId", "index") REFERENCES "encounter_target"("encounterId", "index") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "floor_pack" ADD CONSTRAINT "floor_pack_packId_fkey" FOREIGN KEY ("packId") REFERENCES "pack"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "status_text" ADD CONSTRAINT "status_text_statusId_fkey" FOREIGN KEY ("statusId") REFERENCES "status"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sin_text" ADD CONSTRAINT "sin_text_sin_fkey" FOREIGN KEY ("sin") REFERENCES "sin_info"("sin") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "keyword_text" ADD CONSTRAINT "keyword_text_keywordId_fkey" FOREIGN KEY ("keywordId") REFERENCES "keyword"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mirror_dungeon_text" ADD CONSTRAINT "mirror_dungeon_text_version_fkey" FOREIGN KEY ("version") REFERENCES "mirror_dungeon"("version") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grace_option" ADD CONSTRAINT "grace_option_version_fkey" FOREIGN KEY ("version") REFERENCES "mirror_dungeon"("version") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grace_option_text" ADD CONSTRAINT "grace_option_text_graceId_fkey" FOREIGN KEY ("graceId") REFERENCES "grace_option"("id") ON DELETE CASCADE ON UPDATE CASCADE;

