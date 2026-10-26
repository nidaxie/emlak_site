-- CreateEnum
CREATE TYPE "ListingType" AS ENUM ('SALE', 'RENT');

-- CreateEnum
CREATE TYPE "PropertyType" AS ENUM ('APARTMENT', 'HOUSE', 'VILLA', 'LAND', 'WORKPLACE');

-- CreateEnum
CREATE TYPE "PropertyStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'SOLD', 'RENTED');

-- CreateEnum
CREATE TYPE "HeatingType" AS ENUM ('COMBI', 'CENTRAL', 'FLOOR_HEATING', 'STOVE', 'NONE', 'OTHER');

-- CreateEnum
CREATE TYPE "Currency" AS ENUM ('TRY');

-- CreateTable
CREATE TABLE "properties" (
    "id" UUID NOT NULL,
    "agentProfileId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "listingType" "ListingType" NOT NULL,
    "propertyType" "PropertyType" NOT NULL,
    "status" "PropertyStatus" NOT NULL DEFAULT 'ACTIVE',
    "price" DECIMAL(14,2) NOT NULL,
    "currency" "Currency" NOT NULL DEFAULT 'TRY',
    "grossAreaM2" DECIMAL(10,2) NOT NULL,
    "netAreaM2" DECIMAL(10,2),
    "rooms" INTEGER NOT NULL,
    "livingRooms" INTEGER NOT NULL,
    "buildingAge" INTEGER,
    "floor" INTEGER,
    "totalFloors" INTEGER,
    "heatingType" "HeatingType",
    "city" TEXT NOT NULL,
    "district" TEXT NOT NULL,
    "neighborhood" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "latitude" DECIMAL(9,6) NOT NULL,
    "longitude" DECIMAL(9,6) NOT NULL,
    "isFurnished" BOOLEAN NOT NULL DEFAULT false,
    "hasBalcony" BOOLEAN NOT NULL DEFAULT false,
    "hasElevator" BOOLEAN NOT NULL DEFAULT false,
    "hasParking" BOOLEAN NOT NULL DEFAULT false,
    "inSite" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "properties_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "properties_agentProfileId_createdAt_idx" ON "properties"("agentProfileId", "createdAt");

-- CreateIndex
CREATE INDEX "properties_status_deletedAt_createdAt_idx" ON "properties"("status", "deletedAt", "createdAt");

-- CreateIndex
CREATE INDEX "properties_status_price_idx" ON "properties"("status", "price");

-- CreateIndex
CREATE INDEX "properties_status_city_district_idx" ON "properties"("status", "city", "district");

-- CreateIndex
CREATE INDEX "properties_status_listingType_propertyType_idx" ON "properties"("status", "listingType", "propertyType");

-- CreateIndex
CREATE INDEX "properties_status_rooms_idx" ON "properties"("status", "rooms");

-- AddForeignKey
ALTER TABLE "properties" ADD CONSTRAINT "properties_agentProfileId_fkey" FOREIGN KEY ("agentProfileId") REFERENCES "agent_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
