import { Router } from 'express';
import type { PrismaClient } from '@prisma/client';

export function createNPCsRouter(prisma: PrismaClient): Router {
  const router = Router();

  // List all NPCs in a world
  // GET /api/worlds/:slug/npcs
  router.get('/:slug/npcs', async (req, res) => {
    try {
      const world = await prisma.world.findUnique({ where: { slug: req.params.slug } });
      if (!world) return res.status(404).json({ error: 'World not found.' });

      const npcs = await prisma.nPC.findMany({
        where: { worldId: world.id },
        include: {
          currentZone: { select: { id: true, name: true, slug: true } },
          inventory: { include: { item: true } },
        },
        orderBy: { createdAt: 'asc' },
      });
      res.json({ npcs });
    } catch (err) {
      res.status(500).json({ error: 'Failed to fetch NPCs.' });
    }
  });

  // Get a single NPC
  router.get('/npcs/:id', async (req, res) => {
    try {
      const npc = await prisma.nPC.findUnique({
        where: { id: req.params.id },
        include: {
          currentZone: true,
          inventory: { include: { item: true } },
          vedaEntity: true,
        },
      });
      if (!npc) return res.status(404).json({ error: 'NPC not found.' });
      res.json({ npc });
    } catch (err) {
      res.status(500).json({ error: 'Failed to fetch NPC.' });
    }
  });

  return router;
}
