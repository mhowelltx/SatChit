import { Router } from 'express';
import type { PrismaClient } from '@prisma/client';
import { requireRishi } from './admin.js';

export function createNPCsRouter(prisma: PrismaClient): Router {
  const router = Router();
  const rishi = requireRishi(prisma);

  // List all NPCs in a world — Rishi only
  // GET /api/worlds/:slug/npcs
  router.get('/:slug/npcs', rishi, async (req, res) => {
    try {
      const slug = String(req.params['slug']);
      const world = await prisma.world.findUnique({ where: { slug } });
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

  // Get a single NPC — Rishi only
  router.get('/npcs/:id', rishi, async (req, res) => {
    try {
      const npc = await prisma.nPC.findUnique({
        where: { id: String(req.params['id']) },
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

  // Delete an NPC — Rishi only
  // DELETE /api/worlds/:slug/npcs/:id
  router.delete('/:slug/npcs/:id', rishi, async (req, res) => {
    try {
      await prisma.nPC.delete({ where: { id: String(req.params['id']) } });
      res.json({ ok: true });
    } catch (err: any) {
      if (err?.code === 'P2025') return res.status(404).json({ error: 'NPC not found.' });
      res.status(500).json({ error: 'Failed to delete NPC.' });
    }
  });

  // Update an NPC — Rishi only
  // PATCH /api/worlds/:slug/npcs/:id
  router.patch('/:slug/npcs/:id', rishi, async (req, res) => {
    try {
      const { name, physicalDescription, traits, disposition, backstory, skills, abilities, memories } =
        req.body as {
          name?: string;
          physicalDescription?: string;
          traits?: string[];
          disposition?: string;
          backstory?: string;
          skills?: Record<string, number>;
          abilities?: string[];
          memories?: string[];
        };

      const npc = await prisma.nPC.update({
        where: { id: String(req.params['id']) },
        data: {
          ...(name !== undefined && { name }),
          ...(physicalDescription !== undefined && { physicalDescription }),
          ...(traits !== undefined && { traits }),
          ...(disposition !== undefined && { disposition }),
          ...(backstory !== undefined && { backstory }),
          ...(skills !== undefined && { skills: skills as object }),
          ...(abilities !== undefined && { abilities }),
          ...(memories !== undefined && { memories }),
        },
      });
      res.json({ npc });
    } catch (err: any) {
      if (err?.code === 'P2025') return res.status(404).json({ error: 'NPC not found.' });
      res.status(500).json({ error: 'Failed to update NPC.' });
    }
  });

  return router;
}
