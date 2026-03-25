-- CreateEnum
CREATE TYPE "FeatureType" AS ENUM ('MONUMENT', 'BUILDING', 'ALTAR', 'STRUCTURE', 'MARKER', 'OTHER');

-- CreateTable
CREATE TABLE "world_features" (
    "id" TEXT NOT NULL,
    "worldId" TEXT NOT NULL,
    "zoneId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "featureType" "FeatureType" NOT NULL DEFAULT 'OTHER',
    "builtByCharacterId" TEXT,
    "builtByPlayerId" TEXT,
    "attributes" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "world_features_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feature_interactions" (
    "id" TEXT NOT NULL,
    "featureId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "characterId" TEXT,
    "action" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "feature_interactions_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "world_features" ADD CONSTRAINT "world_features_worldId_fkey" FOREIGN KEY ("worldId") REFERENCES "worlds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "world_features" ADD CONSTRAINT "world_features_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "veda_zones"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feature_interactions" ADD CONSTRAINT "feature_interactions_featureId_fkey" FOREIGN KEY ("featureId") REFERENCES "world_features"("id") ON DELETE CASCADE ON UPDATE CASCADE;
