-- UNT3-16: PropertyController.getPagedPropertyList / getPictures.
--
-- 1. Trigram indexes so the SOQL `Name LIKE :pattern OR City__c LIKE :pattern OR Tags__c LIKE :pattern`
--    (ILIKE '%key%' in Postgres) is indexable, plus a composite index for the numeric filters / ORDER BY Price__c.
-- 2. The `files` table: ContentDocument + latest ContentVersion + ContentDocumentLink collapsed into one row
--    (docs/migration/mapping.yaml standardObject:ContentDocument/ContentVersion/ContentDocumentLink).
--    The body lives in S3 (s3_key); UNT3-18 (FileUtilities.createFile) writes it.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- CreateIndex
CREATE INDEX "properties_name_idx" ON "properties" USING GIN ("name" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "properties_city_idx" ON "properties" USING GIN ("city" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "properties_tags_idx" ON "properties" USING GIN ("tags" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "properties_price_beds_baths_idx" ON "properties"("price", "beds", "baths");

-- CreateTable
CREATE TABLE "files" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "sf_id" CHAR(18),
    "title" VARCHAR(255) NOT NULL,
    "file_type" VARCHAR(10) NOT NULL,
    "s3_key" VARCHAR(512) NOT NULL,
    "record_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" VARCHAR(128),

    CONSTRAINT "files_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "files_sf_id_key" ON "files"("sf_id");

-- CreateIndex
CREATE INDEX "files_record_id_file_type_created_at_idx" ON "files"("record_id", "file_type", "created_at");

-- AddForeignKey
ALTER TABLE "files" ADD CONSTRAINT "files_record_id_fkey" FOREIGN KEY ("record_id") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Hand-maintained part (Prisma does not model CHECK constraints).
ALTER TABLE "files" ADD CONSTRAINT "files_sf_id_format_check" CHECK ("sf_id" IS NULL OR "sf_id" ~ '^[A-Za-z0-9]{18}$');
ALTER TABLE "files" ADD CONSTRAINT "files_file_type_upper_check" CHECK ("file_type" = upper("file_type"));
