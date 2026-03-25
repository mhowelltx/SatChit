import http from 'http';
import express from 'express';
import cors from 'cors';
import { Server as SocketIOServer } from 'socket.io';
import { PrismaClient } from '@prisma/client';
import type { ServerToClientEvents, ClientToServerEvents } from '@satchit/shared';
import { createAIProvider } from './ai/index.js';
import { registerSocketHandlers } from './socket/handler.js';
import { createWorldsRouter } from './routes/worlds.js';
import { createAuthRouter } from './routes/auth.js';
import { createCharactersRouter } from './routes/characters.js';
import { createNPCsRouter } from './routes/npcs.js';
import { createAdminRouter } from './routes/admin.js';
import { bootstrapRishiAdmin } from './services/BootstrapService.js';

const PORT = parseInt(process.env.PORT ?? '3001', 10);
const CLIENT_URL = process.env.CLIENT_URL ?? 'http://localhost:3000';

async function main() {
  const prisma = new PrismaClient();
  await bootstrapRishiAdmin(prisma);
  const ai = createAIProvider();

  const app = express();
  const server = http.createServer(app);

  // ── Middleware ───────────────────────────────────────────────────────────────
  app.use(cors({ origin: CLIENT_URL, credentials: true }));
  app.use(express.json());

  // ── REST Routes ──────────────────────────────────────────────────────────────
  app.use('/api/auth', createAuthRouter(prisma));
  app.use('/api/worlds', createWorldsRouter(prisma, ai));
  app.use('/api/worlds', createNPCsRouter(prisma));
  app.use('/api/characters', createCharactersRouter(prisma));
  app.use('/api/admin', createAdminRouter(prisma));
  app.get('/health', (_req, res) => res.json({ status: 'ok' }));

  // ── Socket.io ────────────────────────────────────────────────────────────────
  const io = new SocketIOServer<ClientToServerEvents, ServerToClientEvents>(server, {
    cors: { origin: CLIENT_URL, credentials: true },
  });

  registerSocketHandlers(io, prisma, ai);

  // ── Start ────────────────────────────────────────────────────────────────────
  server.listen(PORT, () => {
    console.log(`SatChit server running on http://localhost:${PORT}`);
    console.log(`AI provider: ${process.env.AI_PROVIDER ?? 'stub'}`);
  });

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    await prisma.$disconnect();
    server.close(() => process.exit(0));
  });
}

main().catch((err) => {
  console.error('Fatal startup error:', err);
  process.exit(1);
});
