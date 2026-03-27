-- AlterTable: Add karma score to characters (primary game score, -100 to +100)
ALTER TABLE "characters" ADD COLUMN "karmaScore" INTEGER NOT NULL DEFAULT 0;

-- AlterTable: Add narrative and builtByCharacterName to world_features
ALTER TABLE "world_features" ADD COLUMN "narrative" TEXT;
ALTER TABLE "world_features" ADD COLUMN "builtByCharacterName" TEXT;

-- CreateTable: Feature interaction scripts (predetermined outcomes authored by creating character)
CREATE TABLE "feature_interaction_scripts" (
    "id" TEXT NOT NULL,
    "featureId" TEXT NOT NULL,
    "trigger" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "feature_interaction_scripts_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "feature_interaction_scripts" ADD CONSTRAINT "feature_interaction_scripts_featureId_fkey" FOREIGN KEY ("featureId") REFERENCES "world_features"("id") ON DELETE CASCADE ON UPDATE CASCADE;
