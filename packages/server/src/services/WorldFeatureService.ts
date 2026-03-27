import type { PrismaClient } from '@prisma/client';
import type { WorldFeature, FeatureInteractionScript } from '@satchit/shared';

type CreateFeatureData = {
  worldId: string;
  zoneId?: string;
  name: string;
  description: string;
  narrative?: string;
  featureType?: string;
  builtByPlayerId?: string;
  builtByCharacterId?: string;
  builtByCharacterName?: string;
  attributes?: Record<string, unknown>;
};

export class WorldFeatureService {
  constructor(private prisma: PrismaClient) {}

  async create(data: CreateFeatureData): Promise<WorldFeature> {
    const feature = await this.prisma.worldFeature.create({
      data: {
        worldId: data.worldId,
        zoneId: data.zoneId ?? null,
        name: data.name,
        description: data.description,
        narrative: data.narrative ?? null,
        featureType: (data.featureType as any) ?? 'OTHER',
        builtByPlayerId: data.builtByPlayerId ?? null,
        builtByCharacterId: data.builtByCharacterId ?? null,
        builtByCharacterName: data.builtByCharacterName ?? null,
        attributes: (data.attributes ?? {}) as any,
      },
    });
    return feature as unknown as WorldFeature;
  }

  async findByZone(zoneId: string): Promise<WorldFeature[]> {
    const features = await this.prisma.worldFeature.findMany({
      where: { zoneId },
      orderBy: { createdAt: 'asc' },
    });
    return features as unknown as WorldFeature[];
  }

  async findByZoneWithScripts(zoneId: string): Promise<WorldFeature[]> {
    const features = await this.prisma.worldFeature.findMany({
      where: { zoneId },
      orderBy: { createdAt: 'asc' },
      include: {
        interactionScripts: { orderBy: { createdAt: 'asc' } },
      },
    });
    return features as unknown as WorldFeature[];
  }

  async findByWorld(worldId: string): Promise<WorldFeature[]> {
    const features = await this.prisma.worldFeature.findMany({
      where: { worldId },
      orderBy: { createdAt: 'asc' },
      include: {
        zone: { select: { name: true, slug: true } },
        interactions: { orderBy: { timestamp: 'desc' }, take: 5 },
        interactionScripts: { orderBy: { createdAt: 'asc' } },
      },
    });
    return features as unknown as WorldFeature[];
  }

  async findByName(worldId: string, name: string): Promise<WorldFeature | null> {
    const feature = await this.prisma.worldFeature.findFirst({
      where: { worldId, name: { equals: name, mode: 'insensitive' } },
      include: { interactionScripts: { orderBy: { createdAt: 'asc' } } },
    });
    return feature as unknown as WorldFeature | null;
  }

  async addInteraction(
    featureId: string,
    playerId: string,
    characterId: string | null,
    action: string,
  ): Promise<void> {
    await this.prisma.featureInteraction.create({
      data: { featureId, playerId, characterId, action },
    });
  }

  async addInteractionScript(
    featureId: string,
    trigger: string,
    outcome: string,
  ): Promise<FeatureInteractionScript> {
    const script = await this.prisma.featureInteractionScript.create({
      data: { featureId, trigger, outcome },
    });
    return script as unknown as FeatureInteractionScript;
  }

  async getInteractionScripts(featureId: string): Promise<FeatureInteractionScript[]> {
    const scripts = await this.prisma.featureInteractionScript.findMany({
      where: { featureId },
      orderBy: { createdAt: 'asc' },
    });
    return scripts as unknown as FeatureInteractionScript[];
  }
}
