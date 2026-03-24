import { Router } from 'express';
import slugify from 'slugify';
import type { PrismaClient } from '@prisma/client';
import type { IAIProvider } from '../ai/index.js';
import { WorldGeneratorService } from '../services/WorldGeneratorService.js';
import { VedaService } from '../services/VedaService.js';

export function createWorldsRouter(prisma: PrismaClient, ai: IAIProvider): Router {
  const router = Router();
  const worldGenerator = new WorldGeneratorService(prisma, ai);
  const vedaService = new VedaService(prisma);

  // List public worlds
  router.get('/', async (req, res) => {
    try {
      const worlds = await prisma.world.findMany({
        where: { visibility: 'PUBLIC' },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          slug: true,
          description: true,
          visibility: true,
          creatorId: true,
          createdAt: true,
        },
      });
      res.json({ worlds });
    } catch (err) {
      res.status(500).json({ error: 'Failed to list worlds.' });
    }
  });

  // Get a single world by slug
  router.get('/:slug', async (req, res) => {
    try {
      const world = await prisma.world.findUnique({
        where: { slug: req.params.slug },
      });
      if (!world) return res.status(404).json({ error: 'World not found.' });
      res.json({ world });
    } catch (err) {
      res.status(500).json({ error: 'Failed to fetch world.' });
    }
  });

  // Create a new world
  router.post('/', async (req, res) => {
    try {
      const { name, description, visibility, foundationalLaws, culturalTypologies, creatorId } =
        req.body as {
          name: string;
          description: string;
          visibility: 'PUBLIC' | 'PRIVATE';
          foundationalLaws: string[];
          culturalTypologies: string[];
          creatorId: string;
        };

      if (!name || !description || !foundationalLaws?.length || !culturalTypologies?.length) {
        return res.status(400).json({ error: 'Missing required fields.' });
      }

      const slug = slugify(name, { lower: true, strict: true });

      const existing = await prisma.world.findUnique({ where: { slug } });
      if (existing) {
        return res.status(409).json({ error: 'A world with that name already exists.' });
      }

      const world = await prisma.world.create({
        data: {
          creatorId,
          name,
          slug,
          description,
          visibility: visibility ?? 'PUBLIC',
          foundationalLaws,
          culturalTypologies,
        },
      });

      // Bootstrap: generate origin summary + starter zones
      const { starterZones, originSummary } = await worldGenerator.bootstrapWorld({
        id: world.id,
        creatorId: world.creatorId,
        name: world.name,
        slug: world.slug,
        description: world.description,
        visibility: world.visibility as 'PUBLIC' | 'PRIVATE',
        foundationalLaws: world.foundationalLaws,
        culturalTypologies: world.culturalTypologies,
        createdAt: world.createdAt,
        updatedAt: world.updatedAt,
      });

      res.status(201).json({ world, originSummary, starterZones });
    } catch (err) {
      console.error('POST /worlds error', err);
      res.status(500).json({ error: 'Failed to create world.' });
    }
  });

  // Get the Veda for a world
  router.get('/:worldId/veda', async (req, res) => {
    try {
      const [zones, lore, recentEvents] = await Promise.all([
        vedaService.listZones(req.params.worldId),
        vedaService.listLore(req.params.worldId),
        vedaService.listRecentEvents(req.params.worldId, 20),
      ]);
      res.json({ zones, lore, recentEvents });
    } catch (err) {
      res.status(500).json({ error: 'Failed to fetch Veda.' });
    }
  });

  return router;
}
