import type { PrismaClient } from '@prisma/client';
import type { VedaZone, VedaEntity, VedaEvent, VedaLore, EntityType, LoreCategory } from '@satchit/shared';

export class VedaService {
  constructor(private prisma: PrismaClient) {}

  // ── Zones ───────────────────────────────────────────────────────────────────

  async getZone(worldId: string, zoneSlug: string): Promise<VedaZone | null> {
    const zone = await this.prisma.vedaZone.findUnique({
      where: { worldId_slug: { worldId, slug: zoneSlug } },
    });
    return zone as VedaZone | null;
  }

  async saveZone(data: {
    worldId: string;
    name: string;
    slug: string;
    description: string;
    rawContent: string;
    atmosphereTags?: string[];
    discoveredById?: string;
  }): Promise<VedaZone> {
    const zone = await this.prisma.vedaZone.upsert({
      where: { worldId_slug: { worldId: data.worldId, slug: data.slug } },
      create: data,
      update: {},
    });
    return zone as VedaZone;
  }

  async updateAtmosphereTags(zoneId: string, tags: string[]): Promise<void> {
    await this.prisma.vedaZone.update({
      where: { id: zoneId },
      data: { atmosphereTags: tags },
    });
  }

  async listZones(worldId: string): Promise<VedaZone[]> {
    const zones = await this.prisma.vedaZone.findMany({ where: { worldId } });
    return zones as VedaZone[];
  }

  // ── Entities ────────────────────────────────────────────────────────────────

  async getEntity(worldId: string, name: string): Promise<VedaEntity | null> {
    const entity = await this.prisma.vedaEntity.findFirst({
      where: { worldId, name },
    });
    return entity as VedaEntity | null;
  }

  async saveEntity(data: {
    worldId: string;
    zoneId?: string;
    name: string;
    entityType: EntityType;
    description: string;
    attributes?: Record<string, unknown>;
  }): Promise<VedaEntity> {
    const entity = await this.prisma.vedaEntity.create({
      data: {
        ...data,
        attributes: (data.attributes ?? {}) as object,
      },
    });
    return entity as VedaEntity;
  }

  async listEntities(worldId: string): Promise<VedaEntity[]> {
    const entities = await this.prisma.vedaEntity.findMany({ where: { worldId } });
    return entities as VedaEntity[];
  }

  async listEntitiesInZone(zoneId: string): Promise<VedaEntity[]> {
    const entities = await this.prisma.vedaEntity.findMany({ where: { zoneId } });
    return entities as VedaEntity[];
  }

  // ── Events ──────────────────────────────────────────────────────────────────

  async saveEvent(data: {
    worldId: string;
    description: string;
    participantIds?: string[];
  }): Promise<VedaEvent> {
    const event = await this.prisma.vedaEvent.create({
      data: {
        worldId: data.worldId,
        description: data.description,
        participantIds: data.participantIds ?? [],
      },
    });
    return event as VedaEvent;
  }

  async listRecentEvents(worldId: string, limit = 10): Promise<VedaEvent[]> {
    const events = await this.prisma.vedaEvent.findMany({
      where: { worldId },
      orderBy: { occurredAt: 'desc' },
      take: limit,
    });
    return events as VedaEvent[];
  }

  /** Returns recent events in a zone that involved a specific player. */
  async listZoneEventsForPlayer(worldId: string, zoneName: string, playerId: string, limit = 3): Promise<VedaEvent[]> {
    const events = await this.prisma.vedaEvent.findMany({
      where: {
        worldId,
        description: { contains: zoneName },
        participantIds: { has: playerId },
      },
      orderBy: { occurredAt: 'desc' },
      take: limit,
    });
    return events as VedaEvent[];
  }

  // ── Lore ────────────────────────────────────────────────────────────────────

  async saveLore(data: {
    worldId: string;
    category: LoreCategory;
    title: string;
    content: string;
  }): Promise<VedaLore> {
    const lore = await this.prisma.vedaLore.create({ data });
    return lore as VedaLore;
  }

  async listLore(worldId: string): Promise<VedaLore[]> {
    const lore = await this.prisma.vedaLore.findMany({ where: { worldId } });
    return lore as VedaLore[];
  }
}
