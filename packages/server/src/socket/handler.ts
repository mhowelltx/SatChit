import type { Server, Socket } from 'socket.io';
import type { PrismaClient } from '@prisma/client';
import type {
  ServerToClientEvents,
  ClientToServerEvents,
  SessionJoinPayload,
  PlayerActionPayload,
  PlayerMovePayload,
} from '@satchit/shared';
import type { IAIProvider } from '../ai/index.js';
import { SessionService } from '../services/SessionService.js';
import { WorldGeneratorService } from '../services/WorldGeneratorService.js';
import { VedaService } from '../services/VedaService.js';
import slugify from 'slugify';

type AppSocket = Socket<ClientToServerEvents, ServerToClientEvents>;
type AppServer = Server<ClientToServerEvents, ServerToClientEvents>;

function zoneRoom(worldId: string, zoneSlug: string): string {
  return `world:${worldId}:zone:${zoneSlug}`;
}

export function registerSocketHandlers(
  io: AppServer,
  prisma: PrismaClient,
  ai: IAIProvider,
): void {
  const sessionService = new SessionService(prisma);
  const worldGenerator = new WorldGeneratorService(prisma, ai);
  const vedaService = new VedaService(prisma);

  io.on('connection', (socket: AppSocket) => {
    let activeSessionId: string | null = null;
    let activeWorldId: string | null = null;
    let activeZoneSlug: string | null = null;

    socket.on('session:join', async (payload: SessionJoinPayload) => {
      try {
        const { worldId, playerId } = payload;

        const world = await prisma.world.findUnique({ where: { id: worldId } });
        if (!world) {
          socket.emit('session:error', { code: 'WORLD_NOT_FOUND', message: 'World not found.' });
          return;
        }

        const session = await sessionService.create(worldId, playerId);
        activeSessionId = session.id;
        activeWorldId = worldId;

        // Place player in the first available starter zone
        const zones = await vedaService.listZones(worldId);
        const startZone = zones[0];

        if (startZone) {
          activeZoneSlug = startZone.slug;
          await sessionService.updateZone(session.id, startZone.id);
          socket.join(zoneRoom(worldId, startZone.slug));

          socket.emit('world:narration', {
            text: startZone.rawContent,
            zoneSlug: startZone.slug,
            sessionId: session.id,
            timestamp: new Date().toISOString(),
          });

          // Notify others in zone
          const user = await prisma.user.findUnique({ where: { id: playerId } });
          socket.to(zoneRoom(worldId, startZone.slug)).emit('player:joined', {
            playerId,
            username: user?.username ?? 'Unknown',
            zoneSlug: startZone.slug,
          });
        }
      } catch (err) {
        console.error('session:join error', err);
        socket.emit('session:error', {
          code: 'INTERNAL',
          message: 'Failed to join session.',
        });
      }
    });

    socket.on('player:action', async (payload: PlayerActionPayload) => {
      if (!activeSessionId || !activeWorldId || !activeZoneSlug) {
        socket.emit('session:error', { code: 'NO_SESSION', message: 'No active session.' });
        return;
      }

      try {
        const session = await sessionService.findById(payload.sessionId);
        if (!session || session.id !== activeSessionId) {
          socket.emit('session:error', { code: 'INVALID_SESSION', message: 'Invalid session.' });
          return;
        }

        const world = await prisma.world.findUnique({ where: { id: activeWorldId } });
        if (!world) return;

        const result = await worldGenerator.processAction(
          {
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
          },
          activeZoneSlug,
          payload.input,
          session.playerId,
        );

        await sessionService.recordAction(activeSessionId, payload.input, result.narration);
        await sessionService.updateZone(activeSessionId, result.zone.id);

        const narrationPayload = {
          text: result.narration,
          zoneSlug: result.zone.slug,
          sessionId: activeSessionId,
          timestamp: new Date().toISOString(),
        };

        // Send narration to everyone in the zone (including sender)
        io.to(zoneRoom(activeWorldId, activeZoneSlug)).emit('world:narration', narrationPayload);

        // If a new zone was discovered, broadcast veda update to the world
        if (result.isNewZone) {
          io.to(`world:${activeWorldId}`).emit('veda:update', {
            type: 'zone',
            data: result.zone,
          });
        }
      } catch (err) {
        console.error('player:action error', err);
        socket.emit('session:error', {
          code: 'INTERNAL',
          message: 'Failed to process action.',
        });
      }
    });

    socket.on('player:move', async (payload: PlayerMovePayload) => {
      if (!activeSessionId || !activeWorldId) {
        socket.emit('session:error', { code: 'NO_SESSION', message: 'No active session.' });
        return;
      }

      try {
        const session = await sessionService.findById(payload.sessionId);
        if (!session) return;

        const world = await prisma.world.findUnique({ where: { id: activeWorldId } });
        if (!world) return;

        const targetSlug = slugify(payload.targetZoneSlug, { lower: true, strict: true });
        const fromSlug = activeZoneSlug;
        const user = await prisma.user.findUnique({ where: { id: session.playerId } });

        // Leave current zone room
        if (fromSlug) {
          socket.leave(zoneRoom(activeWorldId, fromSlug));
          socket.to(zoneRoom(activeWorldId, fromSlug)).emit('player:moved', {
            playerId: session.playerId,
            username: user?.username ?? 'Unknown',
            fromZoneSlug: fromSlug,
            toZoneSlug: targetSlug,
          });
        }

        // Join new zone room
        socket.join(zoneRoom(activeWorldId, targetSlug));
        activeZoneSlug = targetSlug;

        // Check if zone exists in Veda or generate it
        let zone = await vedaService.getZone(activeWorldId, targetSlug);

        if (!zone) {
          const result = await worldGenerator.processAction(
            {
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
            },
            targetSlug,
            'enter',
            session.playerId,
          );
          zone = result.zone;

          // Broadcast new zone discovery
          io.to(`world:${activeWorldId}`).emit('veda:update', {
            type: 'zone',
            data: zone,
          });
        }

        await sessionService.updateZone(activeSessionId, zone.id);

        socket.emit('world:narration', {
          text: zone.rawContent,
          zoneSlug: zone.slug,
          sessionId: activeSessionId,
          timestamp: new Date().toISOString(),
        });

        // Notify others in new zone
        socket.to(zoneRoom(activeWorldId, targetSlug)).emit('player:joined', {
          playerId: session.playerId,
          username: user?.username ?? 'Unknown',
          zoneSlug: targetSlug,
        });
      } catch (err) {
        console.error('player:move error', err);
        socket.emit('session:error', {
          code: 'INTERNAL',
          message: 'Failed to move.',
        });
      }
    });

    socket.on('disconnect', async () => {
      if (activeSessionId) {
        await sessionService.end(activeSessionId).catch(console.error);
      }
    });
  });
}
