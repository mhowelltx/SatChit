import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type { PrismaClient } from '@prisma/client';

export function createAuthRouter(prisma: PrismaClient): Router {
  const router = Router();
  const JWT_SECRET = process.env.JWT_SECRET ?? 'dev-secret';

  // Register
  router.post('/register', async (req, res) => {
    try {
      const { email, username, password } = req.body as {
        email: string;
        username: string;
        password: string;
      };

      if (!email || !username || !password) {
        return res.status(400).json({ error: 'email, username, and password are required.' });
      }

      const existing = await prisma.user.findFirst({
        where: { OR: [{ email }, { username }] },
      });
      if (existing) {
        return res.status(409).json({ error: 'Email or username already taken.' });
      }

      const passwordHash = await bcrypt.hash(password, 12);
      const user = await prisma.user.create({
        data: { email, username, passwordHash },
        select: { id: true, email: true, username: true, role: true, createdAt: true },
      });

      const token = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, {
        expiresIn: '7d',
      });

      res.status(201).json({ user, token });
    } catch (err) {
      res.status(500).json({ error: 'Registration failed.' });
    }
  });

  // Login
  router.post('/login', async (req, res) => {
    try {
      const { email, password } = req.body as { email: string; password: string };

      const user = await prisma.user.findUnique({ where: { email } });
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
      res.status(500).json({ error: 'Login failed.' });
    }
  });

  return router;
}
