import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type { PrismaClient } from '@prisma/client';

export function createAuthRouter(prisma: PrismaClient): Router {
  const router = Router();
  const JWT_SECRET = process.env.JWT_SECRET ?? 'dev-secret';

  // Register — username + password only, no email required
  router.post('/register', async (req, res) => {
    try {
      const { username, password } = req.body as {
        username: string;
        password: string;
      };

      if (!username || !password) {
        return res.status(400).json({ error: 'username and password are required.' });
      }
      if (password.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters.' });
      }

      const existing = await prisma.user.findUnique({ where: { username } });
      if (existing) {
        return res.status(409).json({ error: 'Username already taken.' });
      }

      const passwordHash = await bcrypt.hash(password, 12);
      const user = await prisma.user.create({
        data: { username, passwordHash },
        select: { id: true, email: true, username: true, role: true, createdAt: true },
      });

      const token = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, {
        expiresIn: '7d',
      });

      res.status(201).json({ user, token });
    } catch (err) {
      console.error('POST /auth/register error', err);
      res.status(500).json({ error: 'Registration failed.' });
    }
  });

  // Login — by username + password
  router.post('/login', async (req, res) => {
    try {
      const { username, password } = req.body as { username: string; password: string };

      if (!username || !password) {
        return res.status(400).json({ error: 'username and password are required.' });
      }

      const user = await prisma.user.findUnique({ where: { username } });
      if (!user) {
        return res.status(401).json({ error: 'Invalid credentials.' });
      }

      const valid = await bcrypt.compare(password, user.passwordHash);
      if (!valid) {
        return res.status(401).json({ error: 'Invalid credentials.' });
      }

      const token = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, {
        expiresIn: '7d',
      });

      res.json({
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          role: user.role,
          createdAt: user.createdAt,
        },
        token,
      });
    } catch (err) {
      console.error('POST /auth/login error', err);
      res.status(500).json({ error: 'Login failed.' });
    }
  });

  // Get current user by stored userId
  router.get('/me', async (req, res) => {
    try {
      const { userId } = req.query as { userId?: string };
      if (!userId) return res.status(400).json({ error: 'userId query param required.' });

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          username: true,
          role: true,
          createdAt: true,
          profile: true,
        },
      });
      if (!user) return res.status(404).json({ error: 'User not found.' });
      res.json({ user });
    } catch (err) {
      res.status(500).json({ error: 'Failed to fetch user.' });
    }
  });

  // Upsert user profile
  router.patch('/users/:id/profile', async (req, res) => {
    try {
      const { bio, avatarUrl } = req.body as { bio?: string; avatarUrl?: string };
      const profile = await prisma.userProfile.upsert({
        where: { userId: req.params.id },
        create: { userId: req.params.id, bio: bio ?? null, avatarUrl: avatarUrl ?? null },
        update: {
          ...(bio !== undefined && { bio }),
          ...(avatarUrl !== undefined && { avatarUrl }),
        },
      });
      res.json({ profile });
    } catch (err) {
      res.status(500).json({ error: 'Failed to update profile.' });
    }
  });

  return router;
}
