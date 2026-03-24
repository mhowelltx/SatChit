import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WorldGeneratorService } from '../services/WorldGeneratorService.js';
import type { World } from '@satchit/shared';

function makePrismaMock() {
  return {
    vedaZone: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
      findMany: vi.fn(),
    },
    vedaEntity: { create: vi.fn(), findMany: vi.fn(), findFirst: vi.fn() },
    vedaEvent: { create: vi.fn(), findMany: vi.fn() },
    vedaLore: { create: vi.fn(), findMany: vi.fn() },
  };
}

function makeAIMock() {
  return {
    generate: vi.fn().mockResolvedValue('[STUB] Narration text.'),
    generateStructured: vi.fn().mockResolvedValue({ zones: [] }),
  };
}

const testWorld: World = {
  id: 'world-1',
  creatorId: 'user-1',
  name: 'Test World',
  slug: 'test-world',
  description: 'A world for tests.',
  visibility: 'PUBLIC',
  foundationalLaws: ['Law of Testing', 'Law of Mocks'],
  culturalTypologies: ['Engineers', 'Testers'],
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('WorldGeneratorService.processAction', () => {
  let prisma: ReturnType<typeof makePrismaMock>;
  let ai: ReturnType<typeof makeAIMock>;
  let service: WorldGeneratorService;

  beforeEach(() => {
    prisma = makePrismaMock();
    ai = makeAIMock();
    prisma.vedaZone.findMany.mockResolvedValue([]);
    prisma.vedaLore.findMany.mockResolvedValue([]);
    prisma.vedaEvent.create.mockResolvedValue({
      id: 'event-1',
      worldId: 'world-1',
      description: '',
      participantIds: [],
      occurredAt: new Date(),
    });
    service = new WorldGeneratorService(prisma as any, ai as any);
  });

  it('returns cached zone without calling AI for zone generation (cache hit)', async () => {
    const cachedZone = {
      id: 'zone-1',
      worldId: 'world-1',
      slug: 'the-market',
      name: 'The Market',
      description: 'Busy.',
      rawContent: 'Stalls everywhere.',
      discoveredById: null,
      discoveredAt: new Date(),
    };
    prisma.vedaZone.findUnique.mockResolvedValue(cachedZone);

    const result = await service.processAction(testWorld, 'the-market', 'look around', 'player-1');

    // Zone upsert must NOT have been called (zone came from cache)
    expect(prisma.vedaZone.upsert).not.toHaveBeenCalled();
    // AI.generate is called exactly once — only for narration
    expect(ai.generate).toHaveBeenCalledTimes(1);
    expect(result.isNewZone).toBe(false);
    expect(result.zone).toEqual(cachedZone);
  });

  it('generates and persists a new zone on cache miss', async () => {
    prisma.vedaZone.findUnique.mockResolvedValue(null);
    const newZone = {
      id: 'zone-2',
      worldId: 'world-1',
      slug: 'the-ruins',
      name: 'The Ruins',
      description: 'Crumbling walls.',
      rawContent: 'Ancient stones surround you.',
      discoveredById: 'player-1',
      discoveredAt: new Date(),
    };
    prisma.vedaZone.upsert.mockResolvedValue(newZone);

    const result = await service.processAction(testWorld, 'the-ruins', 'enter', 'player-1');

    // Zone upsert MUST have been called with slug and playerId
    expect(prisma.vedaZone.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          slug: 'the-ruins',
          worldId: 'world-1',
          discoveredById: 'player-1',
        }),
      }),
    );
    // AI.generate called twice: zone description + narration
    expect(ai.generate).toHaveBeenCalledTimes(2);
    expect(result.isNewZone).toBe(true);
  });

  it('records the player action as a VedaEvent', async () => {
    const cachedZone = {
      id: 'zone-1',
      worldId: 'world-1',
      slug: 'plaza',
      name: 'Plaza',
      description: '',
      rawContent: '',
      discoveredById: null,
      discoveredAt: new Date(),
    };
    prisma.vedaZone.findUnique.mockResolvedValue(cachedZone);

    await service.processAction(testWorld, 'plaza', 'shout hello', 'player-42');

    expect(prisma.vedaEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          worldId: 'world-1',
          participantIds: ['player-42'],
        }),
      }),
    );
  });
});
