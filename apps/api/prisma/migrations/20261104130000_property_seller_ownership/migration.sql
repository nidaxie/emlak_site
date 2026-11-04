-- Individual listings share the properties table with agent listings.
-- Existing rows are agent inventory and stay attached to agent_profiles.

CREATE TYPE "PropertySellerType" AS ENUM ('INDIVIDUAL', 'AGENT');

ALTER TABLE "properties" ADD COLUMN "sellerType" "PropertySellerType";
ALTER TABLE "properties" ADD COLUMN "ownerUserId" UUID;

UPDATE "properties"
SET "sellerType" = 'AGENT'
WHERE "sellerType" IS NULL;

ALTER TABLE "properties" ALTER COLUMN "agentProfileId" DROP NOT NULL;
ALTER TABLE "properties" ALTER COLUMN "sellerType" SET NOT NULL;

ALTER TABLE "properties" ADD CONSTRAINT "properties_seller_ownership_check" CHECK (
  (
    "sellerType" = 'INDIVIDUAL'
    AND "ownerUserId" IS NOT NULL
    AND "agentProfileId" IS NULL
  )
  OR (
    "sellerType" = 'AGENT'
    AND "agentProfileId" IS NOT NULL
    AND "ownerUserId" IS NULL
  )
);

ALTER TABLE "properties"
ADD CONSTRAINT "properties_ownerUserId_fkey"
FOREIGN KEY ("ownerUserId") REFERENCES "users"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "properties_ownerUserId_deletedAt_idx"
ON "properties"("ownerUserId", "deletedAt");

CREATE INDEX "properties_sellerType_status_deletedAt_idx"
ON "properties"("sellerType", "status", "deletedAt");
