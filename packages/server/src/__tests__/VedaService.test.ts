import { describe, it, expect, vi, beforeEach } from 'vitest';
import { VedaService } from '../services/VedaService.js';

function makePrismaMock() {
  return {
    vedaZone: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
      findMany: vi.fn(),
    },
    vedaEntity: {
      findFirst: vi.fn(),
      create: vi.fn(),
      findMany: vi.fn(),
    },
    vedaEvent: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
    vedaLore: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
  };
}

describe('VedaService', () => {
  let prisma: ReturnType<typeof makePrismaMock>;
  let vedaService: VedaService;

  beforeEach(() => {
    prisma = makePrismaMock();
    vedaService = new VedaService(prisma as any);
  });

  describe('getZone', () => {
    it('returns null on cache miss', async () => {
      prisma.vedaZone.findUnique.mockResolvedValue(null);
      const result = await vedaService.getZone('world-1', 'the-void');
      expect(result).toBeNull();
      expect(prisma.vedaZone.findUnique).toHaveBeenCalledWith({
        where: { worldId_slug: { worldId: 'world-1', slug: 'the-void' } },
      });
    });

    it('returns the zone on cache hit', async () => {
      const fakeZone = {
        id: 'zone-1',
        worldId: 'world-1',
        slug: 'the-void',
        name: 'The Void',
        description: 'Empty.',
        rawContent: 'Darkness.',
        discoveredById: null,
        discoveredAt: new Date(),
      };
      prisma.vedaZone.findUnique.mockResolvedValue(fakeZone);
      const result = await vedaService.getZone('world-1', 'the-void');
      expect(result).toEqual(fakeZone);
    });
  });

  describe('saveZone', () => {
    it('calls prisma.vedaZone.upsert with correct composite key', async () => {
      const zoneData = {
        worldId: 'world-1',
        name: 'The Void',
        slug: 'the-void',
        description: 'Dark.',
        rawContent: 'You see nothing.',
      };
      const savedZone = { id: 'zone-1', ...zoneData, discoveredById: null, discoveredAt: new Date() };
      prisma.vedaZone.upsert.mockResolvedValue(savedZone);

      const result = await vedaService.saveZone(zoneData);
      expect(prisma.vedaZone.upsert).toHaveBeenCalledWith({
        where: { worldId_slug: { worldId: 'world-1', slug: 'the-void' } },
        create: zoneData,
        update: {},
      });
      expect(result).toEqual(savedZone);
    });
  });

  describe('saveEntity', () => {
    it('creates entity with default empty attributes when none provided', async () => {
      const entityData = {
        worldId: 'world-1',
        name: 'The Elder',
        entityType: 'NPC' as const,
        description: 'An old one.',
      };
      const savedEntity = {
        id: 'entity-1',
        ...entityData,
        zoneId: null,
        attributes: {},
        discoveredAt: new Date(),
      };
      prisma.vedaEntity.create.mockResolvedValue(savedEntity);

      const result = await vedaService.saveEntity(entityData);
      expect(prisma.vedaEntity.create).toHaveBeenCalledWith({
        data: { ...entityData, attributes: {} },
      });
      expect(result).toEqual(savedEntity);
    });
  });

  describe('saveEvent', () => {
    it('creates event with empty participantIds by default', async () => {
      const eventData = { worldId: 'world-1', description: 'Something happened.' };
      const savedEvent = {
        id: 'event-1',
        ...eventData,
        participantIds: [],
        occurredAt: new Date(),
      };
      prisma.vedaEvent.create.mockResolvedValue(savedEvent);

      const result = await vedaService.saveEvent(eventData);
      expect(prisma.vedaEvent.create).toHaveBeenCalledWith({
        data: { worldId: 'world-1', description: 'Something happened.', participantIds: [] },
      });
      expect(result).toEqual(savedEvent);
    });

    it('creates event with provided participantIds', async () => {
      const eventData = {
        worldId: 'world-1',
        description: 'Battle.',
        participantIds: ['player-1', 'player-2'],
      };
      const savedEvent = { id: 'event-2', ...eventData, occurredAt: new Date() };
      prisma.vedaEvent.create.mockResolvedValue(savedEvent);

      await vedaService.saveEvent(eventData);
      expect(prisma.vedaEvent.create).toHaveBeenCalledWith({
        data: { worldId: 'world-1', description: 'Battle.', participantIds: ['player-1', 'player-2'] },
      });
    });
  });
});
