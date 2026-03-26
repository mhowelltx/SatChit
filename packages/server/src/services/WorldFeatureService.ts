import type { PrismaClient } from '@prisma/client';
import type { WorldFeature } from '@satchit/shared';

type CreateFeatureData = {
  worldId: string;
  zoneId?: string;
  name: string;
  description: string;
  featureType?: string;
  builtByPlayerId?: string;
  builtByCharacterId?: string;
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
        featureType: (data.featureType as any) ?? 'OTHER',
        builtByPlayerId: data.builtByPlayerId ?? null,
        builtByCharacterId: data.builtByCharacterId ?? null,
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

  async findByWorld(worldId: string): Promise<WorldFeature[]> {
    const features = await this.prisma.worldFeature.findMany({
      where: { worldId },
      orderBy: { createdAt: 'asc' },
      include: {
        zone: { select: { name: true, slug: true } },
        interactions: { orderBy: { timestamp: 'desc' }, take: 5 },
      },
    });
    return features as unknown as WorldFeature[];
  }

  async findByName(worldId: string, name: string): Promise<WorldFeature | null> {
    const feature = await this.prisma.worldFeature.findFirst({
      where: { worldId, name: { equals: name, mode: 'insensitive' } },
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
}
