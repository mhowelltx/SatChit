import { Router } from 'express';
import type { PrismaClient } from '@prisma/client';
import type { CreateCharacterInput } from '@satchit/shared';

export function createCharactersRouter(prisma: PrismaClient): Router {
  const router = Router();

  // Create a character for a user in a world
  // POST /api/characters  { userId, worldId, ...characterFields }
  router.post('/', async (req, res) => {
    try {
      const { userId, worldId, name, species, race, gender, age, physicalDescription, traits, skills, abilities, backstory } =
        req.body as { userId: string; worldId: string } & CreateCharacterInput;

      if (!userId || !worldId || !name) {
        return res.status(400).json({ error: 'userId, worldId, and name are required.' });
      }

      const character = await prisma.character.create({
        data: {
          userId,
          worldId,
          name,
          species: species ?? null,
          race: race ?? null,
          gender: gender ?? null,
          age: age ?? null,
          physicalDescription: physicalDescription ?? null,
          traits: traits ?? [],
          skills: (skills ?? {}) as object,
          abilities: abilities ?? [],
          backstory: backstory ?? null,
        },
      });

      res.status(201).json({ character });
    } catch (err: any) {
      if (err?.code === 'P2002') {
        return res.status(409).json({ error: 'A character with that name already exists in this world.' });
      }
      console.error('POST /characters error', err);
      res.status(500).json({ error: 'Failed to create character.' });
    }
  });

  // Get a single character by ID
  router.get('/:id', async (req, res) => {
    try {
      const character = await prisma.character.findUnique({
        where: { id: req.params.id },
        include: {
          inventory: { include: { item: true } },
          ownedZones: { select: { id: true, name: true, slug: true } },
        },
      });
      if (!character) return res.status(404).json({ error: 'Character not found.' });
      res.json({ character });
    } catch (err) {
      res.status(500).json({ error: 'Failed to fetch character.' });
    }
  });

  // List all characters for a user in a world
  // GET /api/characters?userId=&worldId=
  router.get('/', async (req, res) => {
    try {
      const { userId, worldId } = req.query as { userId?: string; worldId?: string };
      if (!userId && !worldId) {
        return res.status(400).json({ error: 'Provide userId and/or worldId query param.' });
      }

      const characters = await prisma.character.findMany({
        where: {
          ...(userId ? { userId } : {}),
          ...(worldId ? { worldId } : {}),
        },
        orderBy: { createdAt: 'asc' },
      });
      res.json({ characters });
    } catch (err) {
      res.status(500).json({ error: 'Failed to list characters.' });
    }
  });

  // Update a character
  router.patch('/:id', async (req, res) => {
    try {
      const { name, species, race, gender, age, physicalDescription, traits, skills, abilities, backstory, stats } =
        req.body as Partial<CreateCharacterInput> & { stats?: Record<string, unknown> };

      const character = await prisma.character.update({
        where: { id: req.params.id },
        data: {
          ...(name !== undefined && { name }),
          ...(species !== undefined && { species }),
          ...(race !== undefined && { race }),
          ...(gender !== undefined && { gender }),
          ...(age !== undefined && { age }),
          ...(physicalDescription !== undefined && { physicalDescription }),
          ...(traits !== undefined && { traits }),
          ...(skills !== undefined && { skills: skills as object }),
          ...(abilities !== undefined && { abilities }),
          ...(backstory !== undefined && { backstory }),
          ...(stats !== undefined && { stats: stats as object }),
        },
      });
      res.json({ character });
    } catch (err: any) {
      if (err?.code === 'P2025') return res.status(404).json({ error: 'Character not found.' });
      res.status(500).json({ error: 'Failed to update character.' });
    }
  });

  // Add item to character inventory
  router.post('/:id/inventory', async (req, res) => {
    try {
      const { itemId, quantity = 1, isEquipped = false } = req.body as {
        itemId: string;
        quantity?: number;
        isEquipped?: boolean;
      };
      if (!itemId) return res.status(400).json({ error: 'itemId is required.' });

      const entry = await prisma.characterItem.create({
        data: { characterId: req.params.id, itemId, quantity, isEquipped },
        include: { item: true },
      });
      res.status(201).json({ entry });
    } catch (err) {
      res.status(500).json({ error: 'Failed to add item.' });
    }
  });

  // Remove item from character inventory
  router.delete('/:id/inventory/:entryId', async (req, res) => {
    try {
      await prisma.characterItem.delete({ where: { id: req.params.entryId } });
      res.json({ ok: true });
    } catch (err: any) {
      if (err?.code === 'P2025') return res.status(404).json({ error: 'Inventory entry not found.' });
      res.status(500).json({ error: 'Failed to remove item.' });
    }
  });

  return router;
}
