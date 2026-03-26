import { Router } from 'express';
import slugify from 'slugify';
import type { PrismaClient } from '@prisma/client';
import type { IAIProvider } from '../ai/index.js';
import { WorldGeneratorService } from '../services/WorldGeneratorService.js';
import { VedaService } from '../services/VedaService.js';
import { WorldTemplateService } from '../services/WorldTemplateService.js';
import { WorldFeatureService } from '../services/WorldFeatureService.js';
import { requireRishi } from './admin.js';

export function createWorldsRouter(prisma: PrismaClient, ai: IAIProvider): Router {
  const router = Router();
  const worldGenerator = new WorldGeneratorService(prisma, ai);
  const vedaService = new VedaService(prisma);
  const worldTemplateService = new WorldTemplateService(prisma, ai);
  const worldFeatureService = new WorldFeatureService(prisma);
  const rishi = requireRishi(prisma);

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
      const { name, description, visibility, foundationalLaws, culturalTypologies, creatorId, anthropicApiKey } =
        req.body as {
          name: string;
          description: string;
          visibility: 'PUBLIC' | 'PRIVATE';
          foundationalLaws: string[];
          culturalTypologies: string[];
          creatorId: string;
          anthropicApiKey?: string;
        };

      if (!name || !description || !foundationalLaws?.length || !culturalTypologies?.length) {
        return res.status(400).json({ error: 'Missing required fields.' });
      }

      // @ts-ignore: slugify CJS/ESM interop issue with NodeNext
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
          anthropicApiKey: anthropicApiKey?.trim() || null,
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
        anthropicApiKey: world.anthropicApiKey,
        createdAt: world.createdAt,
        updatedAt: world.updatedAt,
      });

      res.status(201).json({ world, originSummary, starterZones });
    } catch (err) {
      console.error('POST /worlds error', err);
      res.status(500).json({ error: 'Failed to create world.' });
    }
  });

  // Get (or generate) the AI character template for a world
  // GET /api/worlds/:slug/character-template
  // ?regenerate=true forces a fresh AI generation
  router.get('/:slug/character-template', async (req, res) => {
    try {
      const world = await prisma.world.findUnique({ where: { slug: req.params.slug } });
      if (!world) return res.status(404).json({ error: 'World not found.' });

      const worldShape = {
        id: world.id,
        creatorId: world.creatorId,
        name: world.name,
        slug: world.slug,
        description: world.description,
        visibility: world.visibility as 'PUBLIC' | 'PRIVATE',
        foundationalLaws: world.foundationalLaws,
        culturalTypologies: world.culturalTypologies,
        anthropicApiKey: world.anthropicApiKey,
        createdAt: world.createdAt,
        updatedAt: world.updatedAt,
      };

      const template = req.query.regenerate === 'true'
        ? await worldTemplateService.generate(worldShape)
        : await worldTemplateService.getOrGenerate(worldShape);

      res.json({ template });
    } catch (err) {
      console.error('GET /worlds/:slug/character-template error', err);
      res.status(500).json({ error: 'Failed to get character template.' });
    }
  });

  // Get the Veda for a world (accepts slug) — Rishi only
  router.get('/:slug/veda', rishi, async (req, res) => {
    try {
      const world = await prisma.world.findUnique({ where: { slug: String(req.params['slug']) } });
      if (!world) return res.status(404).json({ error: 'World not found.' });

      const [zones, entities, lore, recentEvents] = await Promise.all([
        vedaService.listZones(world.id),
        vedaService.listEntities(world.id),
        vedaService.listLore(world.id),
        vedaService.listRecentEvents(world.id, 50),
      ]);
      res.json({ zones, entities, lore, recentEvents });
    } catch (err) {
      res.status(500).json({ error: 'Failed to fetch Veda.' });
    }
  });

  // List player-built features for a world — Rishi only
  router.get('/:slug/features', rishi, async (req, res) => {
    try {
      const world = await prisma.world.findUnique({ where: { slug: String(req.params['slug']) } });
      if (!world) return res.status(404).json({ error: 'World not found.' });

      const features = await worldFeatureService.findByWorld(world.id);
      res.json({ features });
    } catch (err) {
      res.status(500).json({ error: 'Failed to fetch features.' });
    }
  });

  // ── Veda Edit Endpoints (Rishi only) ────────────────────────────────────────

  // Update a zone
  router.patch('/:slug/veda/zones/:zoneSlug', rishi, async (req, res) => {
    try {
      const world = await prisma.world.findUnique({ where: { slug: String(req.params['slug']) } });
      if (!world) return res.status(404).json({ error: 'World not found.' });

      const { name, description, rawContent, atmosphereTags } = req.body as {
        name?: string;
        description?: string;
        rawContent?: string;
        atmosphereTags?: string[];
      };

      const zone = await prisma.vedaZone.update({
        where: { worldId_slug: { worldId: world.id, slug: String(req.params['zoneSlug']) } },
        data: {
          ...(name !== undefined && { name }),
          ...(description !== undefined && { description }),
          ...(rawContent !== undefined && { rawContent }),
          ...(atmosphereTags !== undefined && { atmosphereTags }),
        },
      });
      res.json({ zone });
    } catch (err: any) {
      if (err?.code === 'P2025') return res.status(404).json({ error: 'Zone not found.' });
      res.status(500).json({ error: 'Failed to update zone.' });
    }
  });

  // Update a Veda entity
  router.patch('/:slug/veda/entities/:entityId', rishi, async (req, res) => {
    try {
      const { name, description, entityType, attributes } = req.body as {
        name?: string;
        description?: string;
        entityType?: string;
        attributes?: Record<string, unknown>;
      };

      const entity = await prisma.vedaEntity.update({
        where: { id: String(req.params['entityId']) },
        data: {
          ...(name !== undefined && { name }),
          ...(description !== undefined && { description }),
          ...(entityType !== undefined && { entityType: entityType as any }),
          ...(attributes !== undefined && { attributes: attributes as object }),
        },
      });
      res.json({ entity });
    } catch (err: any) {
      if (err?.code === 'P2025') return res.status(404).json({ error: 'Entity not found.' });
      res.status(500).json({ error: 'Failed to update entity.' });
    }
  });

  // Update a Veda lore entry
  router.patch('/:slug/veda/lore/:loreId', rishi, async (req, res) => {
    try {
      const { title, category, content } = req.body as {
        title?: string;
        category?: string;
        content?: string;
      };

      const lore = await prisma.vedaLore.update({
        where: { id: String(req.params['loreId']) },
        data: {
          ...(title !== undefined && { title }),
          ...(category !== undefined && { category: category as any }),
          ...(content !== undefined && { content }),
        },
      });
      res.json({ lore });
    } catch (err: any) {
      if (err?.code === 'P2025') return res.status(404).json({ error: 'Lore not found.' });
      res.status(500).json({ error: 'Failed to update lore.' });
    }
  });

  // Update a Veda event
  router.patch('/:slug/veda/events/:eventId', rishi, async (req, res) => {
    try {
      const { description } = req.body as { description?: string };

      const event = await prisma.vedaEvent.update({
        where: { id: String(req.params['eventId']) },
        data: {
          ...(description !== undefined && { description }),
        },
      });
      res.json({ event });
    } catch (err: any) {
      if (err?.code === 'P2025') return res.status(404).json({ error: 'Event not found.' });
      res.status(500).json({ error: 'Failed to update event.' });
    }
  });

  // ── Veda Delete Endpoints (Rishi only) ───────────────────────────────────────

  // Delete a zone
  router.delete('/:slug/veda/zones/:zoneSlug', rishi, async (req, res) => {
    try {
      const world = await prisma.world.findUnique({ where: { slug: String(req.params['slug']) } });
      if (!world) return res.status(404).json({ error: 'World not found.' });
      await prisma.vedaZone.delete({
        where: { worldId_slug: { worldId: world.id, slug: String(req.params['zoneSlug']) } },
      });
      res.json({ ok: true });
    } catch (err: any) {
      if (err?.code === 'P2025') return res.status(404).json({ error: 'Zone not found.' });
      res.status(500).json({ error: 'Failed to delete zone.' });
    }
  });

  // Delete a Veda entity
  router.delete('/:slug/veda/entities/:entityId', rishi, async (req, res) => {
    try {
      await prisma.vedaEntity.delete({ where: { id: String(req.params['entityId']) } });
      res.json({ ok: true });
    } catch (err: any) {
      if (err?.code === 'P2025') return res.status(404).json({ error: 'Entity not found.' });
      res.status(500).json({ error: 'Failed to delete entity.' });
    }
  });

  // Delete a Veda lore entry
  router.delete('/:slug/veda/lore/:loreId', rishi, async (req, res) => {
    try {
      await prisma.vedaLore.delete({ where: { id: String(req.params['loreId']) } });
      res.json({ ok: true });
    } catch (err: any) {
      if (err?.code === 'P2025') return res.status(404).json({ error: 'Lore not found.' });
      res.status(500).json({ error: 'Failed to delete lore.' });
    }
  });

  // Delete a Veda event
  router.delete('/:slug/veda/events/:eventId', rishi, async (req, res) => {
    try {
      await prisma.vedaEvent.delete({ where: { id: String(req.params['eventId']) } });
      res.json({ ok: true });
    } catch (err: any) {
      if (err?.code === 'P2025') return res.status(404).json({ error: 'Event not found.' });
      res.status(500).json({ error: 'Failed to delete event.' });
    }
  });

  return router;
}
