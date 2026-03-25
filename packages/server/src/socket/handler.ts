import type { Server, Socket } from 'socket.io';
import type { PrismaClient } from '@prisma/client';
import type {
  ServerToClientEvents,
  ClientToServerEvents,
  SessionJoinPayload,
  PlayerActionPayload,
  PlayerMovePayload,
  NameMention,
} from '@satchit/shared';
import type { IAIProvider } from '../ai/index.js';
import { AnthropicAPIError } from '../ai/providers/anthropic.js';

function aiErrorMessage(err: unknown): string {
  if (err instanceof AnthropicAPIError) return err.message;
  if (err instanceof Error) return err.message;
  return 'An unexpected error occurred.';
}
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
    let activeCharacterId: string | null = null;

    // ── New per-socket state for enhanced features ───────────────────────────
    /** Message count per zone slug — resets implicitly when moving to unseen zone */
    const zoneMessageCounts = new Map<string, number>();
    /** Total player actions in this session — drives narrative tension */
    let sessionActionCount = 0;
    /** Carried ambient mood from last narration */
    let currentMood: string | undefined;
    /** Recent zone slugs for breadcrumb trail (newest last) */
    const recentZones: string[] = [];
    /** Whether this player is a Rishi (cross-world avatar) */
    let isRishi = false;
    let rishiName: string | null = null;
    /** Resolved player ID once session is joined */
    let resolvedPlayerId: string | null = null;

    socket.on('session:join', async (payload: SessionJoinPayload) => {
      try {
        const { worldId, worldSlug, playerId, characterId, targetZoneSlug } = payload;

        const world = worldSlug
          ? await prisma.world.findUnique({ where: { slug: worldSlug } })
          : await prisma.world.findUnique({ where: { id: worldId } });
        if (!world) {
          socket.emit('session:error', { code: 'WORLD_NOT_FOUND', message: 'World not found.' });
          return;
        }

        // Fall back to world creator when auth is not yet implemented
        resolvedPlayerId =
          playerId && playerId !== 'placeholder-player-id' ? playerId : world.creatorId;

        // Check if this player is a Rishi (has an AvatarCharacter record)
        const avatarCharacter = await prisma.avatarCharacter.findUnique({
          where: { userId: resolvedPlayerId },
          select: { name: true },
        });
        isRishi = avatarCharacter !== null;
        rishiName = avatarCharacter?.name ?? null;

        // Optionally resolve character
        const character = characterId
          ? await prisma.character.findUnique({ where: { id: characterId } })
          : null;
        activeCharacterId = character?.id ?? null;

        const session = await sessionService.create(world.id, resolvedPlayerId, activeCharacterId ?? undefined);
        activeSessionId = session.id;
        activeWorldId = world.id;

        // Resolve start zone
        const zones = await vedaService.listZones(world.id);
        const startZone = targetZoneSlug
          ? (zones.find(z => z.slug === targetZoneSlug) ?? zones[0])
          : zones[0];

        if (startZone) {
          activeZoneSlug = startZone.slug;
          await sessionService.updateZone(session.id, startZone.id);
          socket.join(zoneRoom(world.id, startZone.slug));
          _trackRecentZone(startZone.slug);

          socket.emit('world:narration', {
            text: startZone.rawContent,
            zoneSlug: startZone.slug,
            sessionId: session.id,
            timestamp: new Date().toISOString(),
            atmosphereTags: startZone.atmosphereTags,
          });

          // Notify others in zone
          const user = await prisma.user.findUnique({ where: { id: resolvedPlayerId } });
          socket.to(zoneRoom(world.id, startZone.slug)).emit('player:joined', {
            playerId: resolvedPlayerId,
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

        // Capture prior count BEFORE incrementing (so first message = 0)
        const priorZoneCount = zoneMessageCounts.get(activeZoneSlug) ?? 0;
        zoneMessageCounts.set(activeZoneSlug, priorZoneCount + 1);
        sessionActionCount += 1;

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
            anthropicApiKey: world.anthropicApiKey,
            createdAt: world.createdAt,
            updatedAt: world.updatedAt,
          },
          activeZoneSlug,
          payload.input,
          resolvedPlayerId ?? session.playerId,
          activeCharacterId ? await prisma.character.findUnique({ where: { id: activeCharacterId } }) as any : null,
          priorZoneCount,
          sessionActionCount,
          currentMood,
        );

        // Persist the new mood for the next exchange
        if (result.nextMood) {
          currentMood = result.nextMood;
        }

        await sessionService.recordAction(activeSessionId, payload.input, result.narration);
        await sessionService.updateZone(activeSessionId, result.zone.id);

        // Build mentions list from known entity types
        const mentions = _buildMentions(
          result.npcsPresent ?? [],
          result.characterName,
          rishiName,
        );

        const narrationPayload = {
          text: result.narration,
          zoneSlug: result.zone.slug,
          sessionId: activeSessionId,
          timestamp: new Date().toISOString(),
          ...(result.suggestions && result.suggestions.length > 0 && { suggestions: result.suggestions }),
          ...(mentions.length > 0 && { mentions }),
          ...(result.zone.atmosphereTags?.length && { atmosphereTags: result.zone.atmosphereTags }),
        };

        // Send narration to everyone in the zone (including sender)
        io.to(zoneRoom(activeWorldId, activeZoneSlug)).emit('world:narration', narrationPayload);

        // If a new zone was discovered, broadcast veda update
        if (result.isNewZone) {
          io.to(`world:${activeWorldId}`).emit('veda:update', {
            type: 'zone',
            data: result.zone,
          });
        }
      } catch (err) {
        console.error('player:action error', err);
        socket.emit('session:error', {
          code: err instanceof AnthropicAPIError ? `AI_${err.status}` : 'INTERNAL',
          message: aiErrorMessage(err),
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

        // @ts-ignore: slugify CJS/ESM interop issue with NodeNext
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
        _trackRecentZone(targetSlug);

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
              anthropicApiKey: world.anthropicApiKey,
              createdAt: world.createdAt,
              updatedAt: world.updatedAt,
            },
            targetSlug,
            'enter',
            resolvedPlayerId ?? session.playerId,
            activeCharacterId ? await prisma.character.findUnique({ where: { id: activeCharacterId } }) as any : null,
            0, // first visit to this zone
            sessionActionCount,
            currentMood,
          );
          zone = result.zone;

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
          atmosphereTags: zone.atmosphereTags,
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
          code: err instanceof AnthropicAPIError ? `AI_${err.status}` : 'INTERNAL',
          message: aiErrorMessage(err),
        });
      }
    });

    socket.on('disconnect', async () => {
      if (activeSessionId) {
        await sessionService.end(activeSessionId).catch(console.error);
      }
    });

    // ── Helpers ──────────────────────────────────────────────────────────────

    function _trackRecentZone(slug: string) {
      const idx = recentZones.indexOf(slug);
      if (idx !== -1) recentZones.splice(idx, 1);
      recentZones.push(slug);
      if (recentZones.length > 5) recentZones.shift();
    }

    function _buildMentions(
      npcNames: string[],
      characterName: string | undefined,
      rishiNameVal: string | null,
    ): NameMention[] {
      const mentions: NameMention[] = [];
      for (const name of npcNames) {
        mentions.push({ name, type: 'npc' });
      }
      if (characterName) {
        mentions.push({ name: characterName, type: 'pc' });
      }
      if (rishiNameVal) {
        mentions.push({ name: rishiNameVal, type: 'rishi' });
      }
      return mentions;
    }
  });
}
