-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "raw";

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

-- CreateIndex
CREATE UNIQUE INDEX "snapshot_version_key" ON "raw"."snapshot"("version");

-- CreateIndex
CREATE INDEX "raw_object_entity_id_idx" ON "raw"."raw_object"("entity", "id");

-- CreateIndex
CREATE INDEX "raw_object_snapshot_id_source_idx" ON "raw"."raw_object"("snapshot_id", "source");

-- AddForeignKey
ALTER TABLE "raw"."snapshot_source" ADD CONSTRAINT "snapshot_source_snapshot_id_fkey" FOREIGN KEY ("snapshot_id") REFERENCES "raw"."snapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "raw"."raw_object" ADD CONSTRAINT "raw_object_snapshot_id_fkey" FOREIGN KEY ("snapshot_id") REFERENCES "raw"."snapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

