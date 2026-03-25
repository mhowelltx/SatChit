import { Router, type Request, type Response, type NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import type { PrismaClient } from '@prisma/client';
import { EntityType, LoreCategory } from '@prisma/client';

function hdr(req: Request, name: string): string | undefined {
  const v = req.headers[name];
  return Array.isArray(v) ? v[0] : v;
}

function pid(req: Request): string {
  return req.params['id'] as string;
}

// ── Middleware ─────────────────────────────────────────────────────────────────

function requireRishi(prisma: PrismaClient) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const rishiId = hdr(req, 'x-rishi-id');
    if (!rishiId) return res.status(403).json({ error: 'Rishi access required.' });

    const user = await prisma.user.findUnique({
      where: { id: rishiId },
      select: { role: true },
    });
    if (!user || user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Rishi access required.' });
    }
    next();
  };
}

// ── Role display ──────────────────────────────────────────────────────────────

function displayRole(role: string): string {
  if (role === 'ADMIN') return 'Rishi';
  if (role === 'CREATOR') return 'Creator';
  return 'Player';
}

// ── Router ────────────────────────────────────────────────────────────────────

export function createAdminRouter(prisma: PrismaClient): Router {
  const router = Router();
  const rishi = requireRishi(prisma);

  // ── Avatar ─────────────────────────────────────────────────────────────────

  // Get calling Rishi's avatar
  router.get('/avatar', rishi, async (req, res) => {
    const rishiId = hdr(req, 'x-rishi-id')!;
    const avatar = await prisma.avatarCharacter.findUnique({ where: { userId: rishiId } });
    res.json({ avatar });
  });

  // Create or update calling Rishi's avatar
  router.post('/avatar', rishi, async (req, res) => {
    const rishiId = hdr(req, 'x-rishi-id')!;
    const { name, description, traits } = req.body as {
      name: string;
      description?: string;
      traits?: string[];
    };
    if (!name) return res.status(400).json({ error: 'name is required.' });
    const avatar = await prisma.avatarCharacter.upsert({
      where: { userId: rishiId },
      create: { userId: rishiId, name, description: description ?? null, traits: traits ?? [] },
      update: { name, description: description ?? null, traits: traits ?? [] },
    });
    res.json({ avatar });
  });

  // ── Sessions ───────────────────────────────────────────────────────────────

  // List all active player sessions
  router.get('/sessions', rishi, async (req, res) => {
    try {
      const sessions = await prisma.gameSession.findMany({
        where: { status: 'ACTIVE' },
        include: {
          player: { select: { id: true, username: true, role: true } },
          world: { select: { id: true, name: true, slug: true } },
          currentZone: { select: { id: true, name: true, slug: true } },
          character: { select: { id: true, name: true } },
        },
        orderBy: { startedAt: 'desc' },
      });
      res.json({ sessions });
    } catch {
      res.status(500).json({ error: 'Failed to load sessions.' });
    }
  });

  // ── Users ──────────────────────────────────────────────────────────────────

  // List all users
  router.get('/users', rishi, async (req, res) => {
    try {
      const users = await prisma.user.findMany({
        orderBy: { createdAt: 'asc' },
        select: { id: true, username: true, email: true, role: true, createdAt: true },
      });
      res.json({ users: users.map(u => ({ ...u, displayRole: displayRole(u.role) })) });
    } catch {
      res.status(500).json({ error: 'Failed to list users.' });
    }
  });

  // Create a user
  router.post('/users', rishi, async (req, res) => {
    try {
      const { username, password, role = 'PLAYER' } = req.body as {
        username: string;
        password: string;
        role?: string;
      };
      if (!username || !password) {
        return res.status(400).json({ error: 'username and password are required.' });
      }
      if (!['PLAYER', 'CREATOR', 'ADMIN'].includes(role)) {
        return res.status(400).json({ error: 'Invalid role.' });
      }
      const existing = await prisma.user.findUnique({ where: { username } });
      if (existing) return res.status(409).json({ error: 'Username already taken.' });

      const passwordHash = await bcrypt.hash(password, 12);
      const user = await prisma.user.create({
        data: { username, passwordHash, role: role as 'PLAYER' | 'CREATOR' | 'ADMIN' },
        select: { id: true, username: true, email: true, role: true, createdAt: true },
      });
      res.status(201).json({ user: { ...user, displayRole: displayRole(user.role) } });
    } catch (err: any) {
      if (err?.code === 'P2002') return res.status(409).json({ error: 'Username already taken.' });
      res.status(500).json({ error: 'Failed to create user.' });
    }
  });

  // Update a user's username or role
  router.patch('/users/:id', rishi, async (req, res) => {
    try {
      const { username, role } = req.body as { username?: string; role?: string };
      if (role && !['PLAYER', 'CREATOR', 'ADMIN'].includes(role)) {
        return res.status(400).json({ error: 'Invalid role.' });
      }
      const user = await prisma.user.update({
        where: { id: pid(req) },
        data: {
          ...(username !== undefined && { username }),
          ...(role !== undefined && { role: role as 'PLAYER' | 'CREATOR' | 'ADMIN' }),
        },
        select: { id: true, username: true, email: true, role: true, createdAt: true },
      });
      res.json({ user: { ...user, displayRole: displayRole(user.role) } });
    } catch (err: any) {
      if (err?.code === 'P2025') return res.status(404).json({ error: 'User not found.' });
      res.status(500).json({ error: 'Failed to update user.' });
    }
  });

  // Delete a user (prevent self-deletion)
  router.delete('/users/:id', rishi, async (req, res) => {
    try {
      const rishiId = hdr(req, 'x-rishi-id');
      if (pid(req) === rishiId) {
        return res.status(400).json({ error: 'Cannot delete your own account.' });
      }
      await prisma.user.delete({ where: { id: pid(req) } });
      res.json({ ok: true });
    } catch (err: any) {
      if (err?.code === 'P2025') return res.status(404).json({ error: 'User not found.' });
      res.status(500).json({ error: 'Failed to delete user.' });
    }
  });

  // Reset a user's password
  router.post('/users/:id/reset-password', rishi, async (req, res) => {
    try {
      const { password } = req.body as { password: string };
      if (!password || password.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters.' });
      }
      const passwordHash = await bcrypt.hash(password, 12);
      await prisma.user.update({
        where: { id: pid(req) },
        data: { passwordHash },
      });
      res.json({ ok: true });
    } catch (err: any) {
      if (err?.code === 'P2025') return res.status(404).json({ error: 'User not found.' });
      res.status(500).json({ error: 'Failed to reset password.' });
    }
  });

  // ── Worlds ─────────────────────────────────────────────────────────────────

  // List all worlds (including private)
  router.get('/worlds', rishi, async (req, res) => {
    try {
      const worlds = await prisma.world.findMany({
        orderBy: { createdAt: 'desc' },
        select: {
          id: true, name: true, slug: true, description: true,
          visibility: true, foundationalLaws: true, culturalTypologies: true,
          creatorId: true, createdAt: true,
          creator: { select: { username: true } },
        },
      });
      res.json({ worlds });
    } catch {
      res.status(500).json({ error: 'Failed to list worlds.' });
    }
  });

  // Edit world
  router.patch('/worlds/:id', rishi, async (req, res) => {
    try {
      const { name, description, foundationalLaws, culturalTypologies, visibility } = req.body as {
        name?: string;
        description?: string;
        foundationalLaws?: string[];
        culturalTypologies?: string[];
        visibility?: 'PUBLIC' | 'PRIVATE';
      };
      const world = await prisma.world.update({
        where: { id: pid(req) },
        data: {
          ...(name !== undefined && { name }),
          ...(description !== undefined && { description }),
          ...(foundationalLaws !== undefined && { foundationalLaws }),
          ...(culturalTypologies !== undefined && { culturalTypologies }),
          ...(visibility !== undefined && { visibility }),
        },
      });
      res.json({ world });
    } catch (err: any) {
      if (err?.code === 'P2025') return res.status(404).json({ error: 'World not found.' });
      res.status(500).json({ error: 'Failed to update world.' });
    }
  });

  // Delete world (cascades via Prisma schema)
  router.delete('/worlds/:id', rishi, async (req, res) => {
    try {
      await prisma.world.delete({ where: { id: pid(req) } });
      res.json({ ok: true });
    } catch (err: any) {
      if (err?.code === 'P2025') return res.status(404).json({ error: 'World not found.' });
      res.status(500).json({ error: 'Failed to delete world.' });
    }
  });

  // ── Veda ───────────────────────────────────────────────────────────────────

  // Edit zone
  router.patch('/veda/zones/:id', rishi, async (req, res) => {
    try {
      const { name, description, rawContent } = req.body as {
        name?: string;
        description?: string;
        rawContent?: string;
      };
      const zone = await prisma.vedaZone.update({
        where: { id: pid(req) },
        data: {
          ...(name !== undefined && { name }),
          ...(description !== undefined && { description }),
          ...(rawContent !== undefined && { rawContent }),
        },
      });
      res.json({ zone });
    } catch (err: any) {
      if (err?.code === 'P2025') return res.status(404).json({ error: 'Zone not found.' });
      res.status(500).json({ error: 'Failed to update zone.' });
    }
  });

  router.delete('/veda/zones/:id', rishi, async (req, res) => {
    try {
      await prisma.vedaZone.delete({ where: { id: pid(req) } });
      res.json({ ok: true });
    } catch (err: any) {
      if (err?.code === 'P2025') return res.status(404).json({ error: 'Zone not found.' });
      res.status(500).json({ error: 'Failed to delete zone.' });
    }
  });

  // Edit entity
  router.patch('/veda/entities/:id', rishi, async (req, res) => {
    try {
      const { name, description, entityType, attributes } = req.body as {
        name?: string;
        description?: string;
        entityType?: string;
        attributes?: Record<string, unknown>;
      };
      const entity = await prisma.vedaEntity.update({
        where: { id: pid(req) },
        data: {
          ...(name !== undefined && { name }),
          ...(description !== undefined && { description }),
          ...(entityType !== undefined && { entityType: entityType as EntityType }),
          ...(attributes !== undefined && { attributes: attributes as object }),
        },
      });
      res.json({ entity });
    } catch (err: any) {
      if (err?.code === 'P2025') return res.status(404).json({ error: 'Entity not found.' });
      res.status(500).json({ error: 'Failed to update entity.' });
    }
  });

  router.delete('/veda/entities/:id', rishi, async (req, res) => {
    try {
      await prisma.vedaEntity.delete({ where: { id: pid(req) } });
      res.json({ ok: true });
    } catch (err: any) {
      if (err?.code === 'P2025') return res.status(404).json({ error: 'Entity not found.' });
      res.status(500).json({ error: 'Failed to delete entity.' });
    }
  });

  // Edit lore
  router.patch('/veda/lore/:id', rishi, async (req, res) => {
    try {
      const { title, content, category } = req.body as {
        title?: string;
        content?: string;
        category?: string;
      };
      const lore = await prisma.vedaLore.update({
        where: { id: pid(req) },
        data: {
          ...(title !== undefined && { title }),
          ...(content !== undefined && { content }),
          ...(category !== undefined && { category: category as LoreCategory }),
        },
      });
      res.json({ lore });
    } catch (err: any) {
      if (err?.code === 'P2025') return res.status(404).json({ error: 'Lore not found.' });
      res.status(500).json({ error: 'Failed to update lore.' });
    }
  });

  router.delete('/veda/lore/:id', rishi, async (req, res) => {
    try {
      await prisma.vedaLore.delete({ where: { id: pid(req) } });
      res.json({ ok: true });
    } catch (err: any) {
      if (err?.code === 'P2025') return res.status(404).json({ error: 'Lore not found.' });
      res.status(500).json({ error: 'Failed to delete lore.' });
    }
  });

  // ── Characters ─────────────────────────────────────────────────────────────

  // List characters (filter by userId or worldId)
  router.get('/characters', rishi, async (req, res) => {
    try {
      const { userId, worldId } = req.query as { userId?: string; worldId?: string };
      const characters = await prisma.character.findMany({
        where: {
          ...(userId ? { userId } : {}),
          ...(worldId ? { worldId } : {}),
        },
        include: {
          user: { select: { username: true } },
          world: { select: { name: true, slug: true } },
        },
        orderBy: { createdAt: 'asc' },
      });
      res.json({ characters });
    } catch {
      res.status(500).json({ error: 'Failed to list characters.' });
    }
  });

  // Create a character for any user
  router.post('/characters', rishi, async (req, res) => {
    try {
      const { userId, worldId, name, species, race, gender, age, physicalDescription, traits, backstory } =
        req.body as {
          userId: string; worldId: string; name: string;
          species?: string; race?: string; gender?: string; age?: number;
          physicalDescription?: string; traits?: string[]; backstory?: string;
        };
      if (!userId || !worldId || !name) {
        return res.status(400).json({ error: 'userId, worldId, and name are required.' });
      }
      const character = await prisma.character.create({
        data: {
          userId, worldId, name,
          species: species ?? null, race: race ?? null,
          gender: gender ?? null, age: age ?? null,
          physicalDescription: physicalDescription ?? null,
          traits: traits ?? [], backstory: backstory ?? null,
        },
      });
      res.status(201).json({ character });
    } catch (err: any) {
      if (err?.code === 'P2002') return res.status(409).json({ error: 'Character name already exists in this world.' });
      res.status(500).json({ error: 'Failed to create character.' });
    }
  });

  // Edit any character
  router.patch('/characters/:id', rishi, async (req, res) => {
    try {
      const { name, species, race, gender, age, physicalDescription, traits, backstory, stats, customAttributes } =
        req.body as {
          name?: string; species?: string; race?: string; gender?: string; age?: number;
          physicalDescription?: string; traits?: string[]; backstory?: string;
          stats?: Record<string, unknown>; customAttributes?: Record<string, unknown>;
        };
      const character = await prisma.character.update({
        where: { id: pid(req) },
        data: {
          ...(name !== undefined && { name }),
          ...(species !== undefined && { species }),
          ...(race !== undefined && { race }),
          ...(gender !== undefined && { gender }),
          ...(age !== undefined && { age }),
          ...(physicalDescription !== undefined && { physicalDescription }),
          ...(traits !== undefined && { traits }),
          ...(backstory !== undefined && { backstory }),
          ...(stats !== undefined && { stats: stats as object }),
          ...(customAttributes !== undefined && { customAttributes: customAttributes as object }),
        },
      });
      res.json({ character });
    } catch (err: any) {
      if (err?.code === 'P2025') return res.status(404).json({ error: 'Character not found.' });
      res.status(500).json({ error: 'Failed to update character.' });
    }
  });

  // Delete any character
  router.delete('/characters/:id', rishi, async (req, res) => {
    try {
      await prisma.character.delete({ where: { id: pid(req) } });
      res.json({ ok: true });
    } catch (err: any) {
      if (err?.code === 'P2025') return res.status(404).json({ error: 'Character not found.' });
      res.status(500).json({ error: 'Failed to delete character.' });
    }
  });

  return router;
}
