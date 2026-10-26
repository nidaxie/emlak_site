-- CreateEnum
CREATE TYPE "FileVisibility" AS ENUM ('PUBLIC', 'PRIVATE');

-- CreateEnum
CREATE TYPE "FileCategory" AS ENUM ('AGENT_LOGO', 'AGENT_TAX_DOCUMENT', 'AGENT_AUTHORIZATION_DOCUMENT', 'PROPERTY_IMAGE');

-- CreateEnum
CREATE TYPE "AgentDocumentType" AS ENUM ('TAX_CERTIFICATE', 'AUTHORIZATION_CERTIFICATE');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('AGENT_APPLICATION_APPROVED', 'AGENT_APPLICATION_REJECTED', 'USER_ACTIVATED', 'USER_DEACTIVATED', 'AGENT_PROFILE_ACTIVATED', 'AGENT_PROFILE_DEACTIVATED', 'PROPERTY_DEACTIVATED_BY_ADMIN', 'PROPERTY_DELETED_BY_ADMIN', 'AGENT_DOCUMENT_UPLOADED', 'AGENT_DOCUMENT_REPLACED', 'PROPERTY_IMAGE_DELETED_BY_ADMIN');

-- CreateTable
CREATE TABLE "stored_files" (
    "id" UUID NOT NULL,
    "storageKey" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "visibility" "FileVisibility" NOT NULL,
    "category" "FileCategory" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "stored_files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_application_documents" (
    "id" UUID NOT NULL,
    "applicationId" UUID NOT NULL,
    "fileId" UUID NOT NULL,
    "documentType" "AgentDocumentType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_application_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "property_images" (
    "id" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "fileId" UUID NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "isCover" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "property_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cities" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,

    CONSTRAINT "cities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "districts" (
    "id" UUID NOT NULL,
    "cityId" UUID NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "districts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "neighborhoods" (
    "id" UUID NOT NULL,
    "districtId" UUID NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "neighborhoods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "actorUserId" UUID NOT NULL,
    "action" "AuditAction" NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" UUID NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "stored_files_storageKey_key" ON "stored_files"("storageKey");

-- CreateIndex
CREATE INDEX "stored_files_category_idx" ON "stored_files"("category");

-- CreateIndex
CREATE UNIQUE INDEX "agent_application_documents_fileId_key" ON "agent_application_documents"("fileId");

-- CreateIndex
CREATE UNIQUE INDEX "agent_application_documents_applicationId_documentType_key" ON "agent_application_documents"("applicationId", "documentType");

-- CreateIndex
CREATE UNIQUE INDEX "property_images_fileId_key" ON "property_images"("fileId");

-- CreateIndex
CREATE INDEX "property_images_propertyId_sortOrder_idx" ON "property_images"("propertyId", "sortOrder");

-- One live cover image per property. Prisma cannot model this predicate.
CREATE UNIQUE INDEX "property_images_one_live_cover" ON "property_images"("propertyId") WHERE "isCover" = true AND "deletedAt" IS NULL;

-- CreateIndex
CREATE UNIQUE INDEX "cities_name_key" ON "cities"("name");

-- CreateIndex
CREATE UNIQUE INDEX "cities_code_key" ON "cities"("code");

-- CreateIndex
CREATE INDEX "districts_cityId_idx" ON "districts"("cityId");

-- CreateIndex
CREATE UNIQUE INDEX "districts_cityId_name_key" ON "districts"("cityId", "name");

-- CreateIndex
CREATE INDEX "neighborhoods_districtId_idx" ON "neighborhoods"("districtId");

-- CreateIndex
CREATE UNIQUE INDEX "neighborhoods_districtId_name_key" ON "neighborhoods"("districtId", "name");

-- CreateIndex
CREATE INDEX "audit_logs_entityType_entityId_idx" ON "audit_logs"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "audit_logs_actorUserId_idx" ON "audit_logs"("actorUserId");

-- CreateIndex
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");

-- Existing listing text is copied into master data before the string columns go away.
INSERT INTO "cities" ("id", "name")
SELECT gen_random_uuid(), existing.city
FROM (SELECT DISTINCT "city" FROM "properties") AS existing;

INSERT INTO "districts" ("id", "cityId", "name")
SELECT gen_random_uuid(), cities."id", existing.district
FROM (SELECT DISTINCT "city", "district" FROM "properties") AS existing
JOIN "cities" ON "cities"."name" = existing.city;

INSERT INTO "neighborhoods" ("id", "districtId", "name")
SELECT gen_random_uuid(), districts."id", existing.neighborhood
FROM (SELECT DISTINCT "city", "district", "neighborhood" FROM "properties") AS existing
JOIN "cities" ON "cities"."name" = existing.city
JOIN "districts" ON "districts"."cityId" = "cities"."id" AND "districts"."name" = existing.district;

-- DropIndex
DROP INDEX "properties_status_city_district_idx";

-- AlterTable
ALTER TABLE "properties" ADD COLUMN "cityId" UUID,
ADD COLUMN "districtId" UUID,
ADD COLUMN "neighborhoodId" UUID,
ADD COLUMN "location" geography(Point, 4326) NOT NULL DEFAULT ST_SetSRID(ST_MakePoint(0, 0), 4326)::geography;

UPDATE "properties" AS property
SET "cityId" = cities."id",
    "districtId" = districts."id",
    "neighborhoodId" = neighborhoods."id"
FROM "cities"
JOIN "districts" ON "districts"."cityId" = "cities"."id"
JOIN "neighborhoods" ON "neighborhoods"."districtId" = "districts"."id"
WHERE property."city" = "cities"."name"
  AND property."district" = "districts"."name"
  AND property."neighborhood" = "neighborhoods"."name";

ALTER TABLE "properties" ALTER COLUMN "cityId" SET NOT NULL,
ALTER COLUMN "districtId" SET NOT NULL,
ALTER COLUMN "neighborhoodId" SET NOT NULL;

ALTER TABLE "properties" DROP COLUMN "city",
DROP COLUMN "district",
DROP COLUMN "neighborhood";

CREATE OR REPLACE FUNCTION properties_sync_location()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.location := ST_SetSRID(
    ST_MakePoint(NEW.longitude::double precision, NEW.latitude::double precision),
    4326
  )::geography;
  RETURN NEW;
END;
$$;

CREATE TRIGGER properties_sync_location
BEFORE INSERT OR UPDATE OF latitude, longitude, location
ON properties
FOR EACH ROW
EXECUTE FUNCTION properties_sync_location();

UPDATE "properties" SET latitude = latitude;

-- CreateIndex
CREATE INDEX "properties_status_cityId_districtId_idx" ON "properties"("status", "cityId", "districtId");

-- CreateIndex
CREATE INDEX "properties_location_gist" ON "properties" USING GIST ("location");

-- AlterTable
ALTER TABLE "agent_profiles" DROP COLUMN "logoUrl",
ADD COLUMN "logoFileId" UUID;

-- CreateIndex
CREATE UNIQUE INDEX "agent_profiles_logoFileId_key" ON "agent_profiles"("logoFileId");

-- AddForeignKey
ALTER TABLE "agent_profiles" ADD CONSTRAINT "agent_profiles_logoFileId_fkey" FOREIGN KEY ("logoFileId") REFERENCES "stored_files"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "properties" ADD CONSTRAINT "properties_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "cities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "properties" ADD CONSTRAINT "properties_districtId_fkey" FOREIGN KEY ("districtId") REFERENCES "districts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "properties" ADD CONSTRAINT "properties_neighborhoodId_fkey" FOREIGN KEY ("neighborhoodId") REFERENCES "neighborhoods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_application_documents" ADD CONSTRAINT "agent_application_documents_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "agent_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_application_documents" ADD CONSTRAINT "agent_application_documents_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "stored_files"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "property_images" ADD CONSTRAINT "property_images_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "property_images" ADD CONSTRAINT "property_images_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "stored_files"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "districts" ADD CONSTRAINT "districts_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "cities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "neighborhoods" ADD CONSTRAINT "neighborhoods_districtId_fkey" FOREIGN KEY ("districtId") REFERENCES "districts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE OR REPLACE FUNCTION audit_logs_immutable()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs are immutable';
END;
$$;

CREATE TRIGGER audit_logs_immutable
BEFORE UPDATE OR DELETE ON audit_logs
FOR EACH ROW
EXECUTE FUNCTION audit_logs_immutable();
