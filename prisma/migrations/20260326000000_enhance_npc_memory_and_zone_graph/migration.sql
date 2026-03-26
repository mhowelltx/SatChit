-- AlterTable: Add NPC memory and social graph fields
ALTER TABLE "npcs" ADD COLUMN "memories" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "npcs" ADD COLUMN "knownNpcIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "npcs" ADD COLUMN "knownCharacterIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- CreateTable: Zone traversal adjacency graph
CREATE TABLE "zone_edges" (
    "id" TEXT NOT NULL,
    "worldId" TEXT NOT NULL,
    "fromZoneSlug" TEXT NOT NULL,
    "toZoneSlug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "zone_edges_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: Unique edge per world
CREATE UNIQUE INDEX "zone_edges_worldId_fromZoneSlug_toZoneSlug_key" ON "zone_edges"("worldId", "fromZoneSlug", "toZoneSlug");

-- AddForeignKey
ALTER TABLE "zone_edges" ADD CONSTRAINT "zone_edges_worldId_fkey" FOREIGN KEY ("worldId") REFERENCES "worlds"("id") ON DELETE CASCADE ON UPDATE CASCADE;
