import type { Server, Socket } from 'socket.io';
import type { PrismaClient } from '@prisma/client';
import type {
  ServerToClientEvents,
  ClientToServerEvents,
  SessionJoinPayload,
  PlayerActionPayload,
  PlayerMovePayload,
  ZoneChatInputPayload,
  NameMention,
  FeatureConfirmResponsePayload,
  ZoneTravelConfirmResponsePayload,
} from '@satchit/shared';
import type { ProposedFeature } from '../services/WorldGeneratorService.js';
import type { IAIProvider } from '../ai/index.js';
import type { TransientNPC } from '../ai/types.js';
import { AnthropicAPIError } from '../ai/providers/anthropic.js';

function aiErrorMessage(err: unknown): string {
  if (err instanceof AnthropicAPIError) return err.message;
  if (err instanceof Error) return err.message;
  return 'An unexpected error occurred.';
}
import { SessionService } from '../services/SessionService.js';
import { WorldGeneratorService } from '../services/WorldGeneratorService.js';
import { VedaService } from '../services/VedaService.js';
import { NPCService } from '../services/NPCService.js';
import { WorldFeatureService } from '../services/WorldFeatureService.js';
import slugify from 'slugify';

type AppSocket = Socket<ClientToServerEvents, ServerToClientEvents>;
type AppServer = Server<ClientToServerEvents, ServerToClientEvents>;

function zoneRoom(worldId: string, zoneSlug: string): string {
  return `world:${worldId}:zone:${zoneSlug}`;
}

// ── Zone player registry ───────────────────────────────────────────────────────
// Shared across all socket connections — tracks who is in each zone room.
// Keyed by zoneRoom string; inner map keyed by socket.id so multiple tabs work.

interface ZonePlayer { playerId: string; username: string; characterName: string | null; }
const zoneRegistry = new Map<string, Map<string, ZonePlayer>>();

function regAdd(room: string, socketId: string, info: ZonePlayer) {
  if (!zoneRegistry.has(room)) zoneRegistry.set(room, new Map());
  zoneRegistry.get(room)!.set(socketId, info);
}

function regRemove(room: string, socketId: string) {
  const m = zoneRegistry.get(room);
  if (!m) return;
  m.delete(socketId);
  if (m.size === 0) zoneRegistry.delete(room);
}

function regPlayers(room: string): ZonePlayer[] {
  return Array.from(zoneRegistry.get(room)?.values() ?? []);
}

function regPurgeSocket(socketId: string) {
  for (const [room, m] of zoneRegistry) {
    m.delete(socketId);
    if (m.size === 0) zoneRegistry.delete(room);
  }
}

export function registerSocketHandlers(
  io: AppServer,
  prisma: PrismaClient,
  ai: IAIProvider,
): void {
  const sessionService = new SessionService(prisma);
  const worldGenerator = new WorldGeneratorService(prisma, ai);
  const vedaService = new VedaService(prisma);
  const npcService = new NPCService(prisma);
  const worldFeatureService = new WorldFeatureService(prisma);

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
    /** Transient (unintroduced) NPCs per zone slug — cleared only when session ends */
    const transientNPCsByZone = new Map<string, TransientNPC[]>();
    /** Whether this player is a Rishi (cross-world avatar) */
    let isRishi = false;
    let rishiName: string | null = null;
    /** Resolved player ID once session is joined */
    let resolvedPlayerId: string | null = null;
    /** Cached username to avoid repeated DB queries */
    let cachedUsername: string | null = null;
    /** Cached character name for zone presence payloads */
    let cachedCharacterName: string | null = null;
    /** Pending feature proposals awaiting player confirmation — keyed by pendingId */
    const pendingFeatures = new Map<string, { proposal: ProposedFeature; worldId: string }>();
    /** Pending zone travel proposals awaiting player confirmation — keyed by pendingTravelId */
    const pendingTravels = new Map<string, { destName: string; destSlug: string | null; isNewZone: boolean; execute: () => Promise<void> }>();

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
        cachedCharacterName = character?.name ?? null;

        const session = await sessionService.create(world.id, resolvedPlayerId, activeCharacterId ?? undefined);
        activeSessionId = session.id;
        activeWorldId = world.id;

        // Cache username once
        const user = await prisma.user.findUnique({ where: { id: resolvedPlayerId } });
        cachedUsername = user?.username ?? 'Unknown';

        // Resolve start zone
        const zones = await vedaService.listZones(world.id);
        const startZone = targetZoneSlug
          ? (zones.find(z => z.slug === targetZoneSlug) ?? zones[0])
          : zones[0];

        // Emit session info (world name, character name, karma score, full zone map) before narration
        const allEdges = await vedaService.listZoneEdges(world.id);
        socket.emit('session:info', {
          worldName: world.name,
          characterName: character?.name ?? null,
          karmaScore: character ? ((character as any).karmaScore ?? 0) : null,
          mapZones: zones.map(z => ({ slug: z.slug, name: z.name })),
          mapEdges: allEdges.map(e => ({ from: e.fromZoneSlug, to: e.toZoneSlug })),
        });

        if (startZone) {
          activeZoneSlug = startZone.slug;
          await sessionService.updateZone(session.id, startZone.id);

          const room = zoneRoom(world.id, startZone.slug);
          socket.join(room);
          _trackRecentZone(startZone.slug);

          // Send presence snapshot to joining player (who was already here)
          const others = regPlayers(room).filter(p => p.playerId !== resolvedPlayerId);
          if (others.length > 0) {
            socket.emit('zone:presence', { zoneSlug: startZone.slug, players: others });
          }

          // Register self after reading others
          regAdd(room, socket.id, { playerId: resolvedPlayerId, username: cachedUsername, characterName: cachedCharacterName });

          // Fetch NPCs for start zone with full detail fields for environment panel
          const startZoneNpcs = await npcService.listByZone(startZone.id);
          const startNpcsWithRel = await Promise.all(
            startZoneNpcs.map(async n => {
              const rel = await npcService.getRelationship(n.id, resolvedPlayerId!);
              const knownPlayer = resolvedPlayerId
                ? (n.knownCharacterIds as string[]).includes(resolvedPlayerId)
                : false;
              return {
                name: n.name,
                disposition: n.disposition,
                ...(rel ? { relationshipScore: rel.score } : {}),
                physicalDescription: n.physicalDescription ?? undefined,
                knownPlayer,
                ...(knownPlayer && {
                  traits: (n.traits as string[]) ?? [],
                  backstory: n.backstory ?? undefined,
                }),
              };
            }),
          );

          // Fetch features for start zone
          const startZoneFeatures = await worldFeatureService.findByZoneWithScripts(startZone.id);
          const startZoneFeaturesPayload = startZoneFeatures.map(f => ({
            id: f.id,
            name: f.name,
            featureType: f.featureType,
            description: f.description,
            narrative: (f as any).narrative ?? null,
            builtByCharacterName: (f as any).builtByCharacterName ?? null,
            interactionTriggers: ((f as any).interactionScripts ?? []).map((s: any) => s.trigger),
          }));

          const startZoneText = WorldGeneratorService.extractPlainText(startZone.rawContent ?? '');
          socket.emit('world:narration', {
            text: startZoneText,
            zoneSlug: startZone.slug,
            sessionId: session.id,
            timestamp: new Date().toISOString(),
            atmosphereTags: startZone.atmosphereTags,
            zoneNpcs: startNpcsWithRel,
            zoneDescription: startZoneText,
            ...(startZoneFeaturesPayload.length > 0 && { zoneFeatures: startZoneFeaturesPayload }),
          });

          // Notify others in zone
          socket.to(room).emit('player:joined', {
            playerId: resolvedPlayerId,
            username: cachedUsername,
            characterName: cachedCharacterName,
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

        // Echo a brief narrator-framed notification to zone-mates immediately (before AI responds)
        const echoDisplayName = cachedCharacterName ?? cachedUsername ?? 'Someone';
        const echoText = payload.mentionedEntityName && payload.mentionedEntityType === 'npc'
          ? `${echoDisplayName} speaks with ${payload.mentionedEntityName}...`
          : payload.mentionedEntityName && payload.mentionedEntityType === 'feature'
          ? `${echoDisplayName} interacts with ${payload.mentionedEntityName}...`
          : `${echoDisplayName} acts...`;
        socket.to(zoneRoom(activeWorldId, activeZoneSlug)).emit('player:action:echo', {
          playerId: resolvedPlayerId ?? session.playerId,
          username: cachedUsername ?? 'Unknown',
          input: echoText,
          zoneSlug: activeZoneSlug,
          timestamp: new Date().toISOString(),
          mentionedEntityName: payload.mentionedEntityName,
          mentionedEntityType: payload.mentionedEntityType,
        });

        // Capture prior count BEFORE incrementing (so first message = 0)
        const priorZoneCount = zoneMessageCounts.get(activeZoneSlug) ?? 0;
        zoneMessageCounts.set(activeZoneSlug, priorZoneCount + 1);
        sessionActionCount += 1;

        const zoneTransientNPCs = transientNPCsByZone.get(activeZoneSlug) ?? [];
        // Build list of other player characters present in the zone for NPC addressing context
        const currentPid = resolvedPlayerId ?? session.playerId;
        const otherCharactersPresent = regPlayers(zoneRoom(activeWorldId, activeZoneSlug))
          .filter(p => p.playerId !== currentPid)
          .map(p => ({ characterName: p.characterName ?? p.username, username: p.username }));

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
          zoneTransientNPCs,
          otherCharactersPresent,
          payload.mentionedEntityType,
          payload.mentionedEntityName,
        );

        // Persist the updated transient NPC list for this zone
        if (result.transientNPCsInZone) {
          transientNPCsByZone.set(activeZoneSlug, result.transientNPCsInZone);
        }

        // Persist the new mood for the next exchange
        if (result.nextMood) {
          currentMood = result.nextMood;
        }

        await sessionService.recordAction(activeSessionId, payload.input, result.narration);

        // Handle zone transition: player narrative travel moved them to a new zone.
        // Instead of moving immediately, propose the travel to the player for confirmation.
        if (result.nextZone && result.nextZone.slug !== activeZoneSlug) {
          const capturedNextZone = result.nextZone;
          const capturedIsNew = result.isNewNextZone ?? false;
          const fromSlug = activeZoneSlug;
          const toSlug = capturedNextZone.slug;
          const pid = resolvedPlayerId ?? session.playerId;
          const uname = cachedUsername ?? 'Unknown';
          const capturedSessionId = activeSessionId;
          const capturedWorldId = activeWorldId;

          const executeTravelFn = async () => {
            regRemove(zoneRoom(capturedWorldId!, fromSlug!), socket.id);
            socket.leave(zoneRoom(capturedWorldId!, fromSlug!));
            socket.to(zoneRoom(capturedWorldId!, fromSlug!)).emit('player:moved', {
              playerId: pid,
              username: uname,
              characterName: cachedCharacterName,
              fromZoneSlug: fromSlug,
              toZoneSlug: toSlug,
            });

            socket.join(zoneRoom(capturedWorldId!, toSlug));
            activeZoneSlug = toSlug;
            _trackRecentZone(toSlug);

            const newRoom = zoneRoom(capturedWorldId!, toSlug);
            const newRoomOthers = regPlayers(newRoom).filter(p => p.playerId !== pid);
            socket.emit('zone:presence', { zoneSlug: toSlug, players: newRoomOthers });
            regAdd(newRoom, socket.id, { playerId: pid, username: uname, characterName: cachedCharacterName });

            await sessionService.updateZone(capturedSessionId!, capturedNextZone.id);

            socket.to(zoneRoom(capturedWorldId!, toSlug)).emit('player:joined', {
              playerId: pid,
              username: uname,
              characterName: cachedCharacterName,
              zoneSlug: toSlug,
            });

            if (capturedIsNew) {
              io.to(`world:${capturedWorldId}`).emit('veda:update', {
                type: 'zone',
                data: capturedNextZone,
              });
            }

            const newEdge = await vedaService.saveZoneEdge(capturedWorldId!, fromSlug!, toSlug);
            if (newEdge) {
              io.to(`world:${capturedWorldId}`).emit('veda:update', {
                type: 'edge',
                data: newEdge,
              });
            }
          };

          const pendingTravelId = `travel-${Date.now()}-${Math.random().toString(36).slice(2)}`;
          pendingTravels.set(pendingTravelId, {
            destName: capturedNextZone.name,
            destSlug: toSlug,
            isNewZone: capturedIsNew,
            execute: executeTravelFn,
          });
          socket.emit('zone:travel:confirm', {
            pendingTravelId,
            sessionId: activeSessionId!,
            destinationZoneName: capturedNextZone.name,
            destinationZoneSlug: toSlug,
            isNewZone: capturedIsNew,
          });
          setTimeout(() => pendingTravels.delete(pendingTravelId), 5 * 60 * 1000);
        } else {
          await sessionService.updateZone(activeSessionId, result.zone.id);
        }

        // Build mentions list from known entity types
        const npcNames = (result.npcsPresent ?? []).map(n => (typeof n === 'string' ? n : n.name));
        const mentions = _buildMentions(
          npcNames,
          result.characterName,
          rishiName,
        );

        // Use the final zone (after possible transition)
        const finalZone = result.nextZone ?? result.zone;

        // Build enriched zoneNpcs payload from a fresh post-action DB query so any NPCs
        // just created by extraction (e.g. a named NPC who introduced themselves) are included.
        const freshZoneNpcs = await npcService.listByZone(finalZone.id);
        const persistedNpcsPayload = await Promise.all(
          freshZoneNpcs.map(async (n) => {
            const score = result.npcRelationshipScores?.[n.name];
            const knownPlayer = resolvedPlayerId
              ? (n.knownCharacterIds as string[]).includes(resolvedPlayerId)
              : false;
            return {
              name: n.name,
              disposition: n.disposition as string,
              ...(score !== undefined && { relationshipScore: score }),
              physicalDescription: n.physicalDescription ?? undefined,
              knownPlayer,
              ...(knownPlayer && {
                traits: (n.traits as string[]) ?? [],
                backstory: n.backstory ?? undefined,
              }),
            };
          }),
        );
        // Merge in transient NPCs (unnamed figures like "the hooded stranger") not yet in DB
        const transientForZone = transientNPCsByZone.get(activeZoneSlug) ?? [];
        const persistedNames = new Set(persistedNpcsPayload.map(n => n.name.toLowerCase()));
        const transientNpcsPayload = transientForZone
          .filter(t => !persistedNames.has(t.role.toLowerCase()))
          .map(t => ({
            name: t.role,
            disposition: (t.disposition ?? 'neutral') as string,
            knownPlayer: false,
            isTransient: true,
          }));
        const zoneNpcsPayload = [...persistedNpcsPayload, ...transientNpcsPayload];

        // Emit karma update to the acting player if karma changed
        if (result.karmaUpdate) {
          socket.emit('karma:update', result.karmaUpdate);
        }

        const basePayload = {
          zoneSlug: finalZone.slug,
          // NOTE: sessionId deliberately omitted here — it is added per-audience below.
          // Broadcasting the actor's sessionId to zone-mates causes observers to overwrite
          // their own sessionId, which breaks their subsequent player:action validation.
          timestamp: new Date().toISOString(),
          ...(mentions.length > 0 && { mentions }),
          ...(finalZone.atmosphereTags?.length && { atmosphereTags: finalZone.atmosphereTags }),
          zoneNpcs: zoneNpcsPayload,
          ...(result.zoneDescription && { zoneDescription: result.zoneDescription }),
          zoneFeatures: result.zoneFeatures ?? [],
          segments: result.segments,
        };

        // ── Per-audience narrative routing ───────────────────────────────────────
        // Split segments into narrator, internal, and npc_speech voices, then
        // deliver each to the appropriate audience.

        const segments = result.segments;
        const narratorText = segments
          .filter(s => s.type === 'narrator')
          .map(s => s.text)
          .join('\n\n');

        // NPC speech framed for observers (uses character name: "The Merchant says to Kiran:")
        const npcSpeechObserver = segments
          .filter(s => s.type === 'npc_speech')
          .map(s => {
            const target = s.addresseeCharacterName ? ` to ${s.addresseeCharacterName}` : '';
            return `${s.speakerName ?? 'Someone'}${target}: "${s.text}"`;
          })
          .join('\n');

        // NPC speech framed for the acting player (uses "you" when addressed directly)
        const npcSpeechActor = segments
          .filter(s => s.type === 'npc_speech')
          .map(s => {
            const isAddressee = s.addresseeCharacterName &&
              s.addresseeCharacterName === cachedCharacterName;
            const target = isAddressee
              ? ' to you'
              : s.addresseeCharacterName ? ` to ${s.addresseeCharacterName}` : '';
            return `${s.speakerName ?? 'Someone'}${target}: "${s.text}"`;
          })
          .join('\n');

        const internalText = segments
          .filter(s => s.type === 'internal')
          .map(s => s.text)
          .join('\n\n');

        const observerText = [narratorText, npcSpeechObserver].filter(Boolean).join('\n\n')
          || result.narration;

        // Determine whether a personal event will follow for the actor.
        // Suggestions must appear on the actor's LAST log entry, so they are withheld
        // from the narrator event and placed on the personal event instead when one follows.
        const personalText = [internalText, npcSpeechActor].filter(Boolean).join('\n\n');
        const hasPersonalContent = Boolean(personalText);
        const hasSuggestions = result.suggestions && result.suggestions.length > 0;

        // Zone-mates (not actor): narrator + observer-framed NPC speech + suggestions.
        // Observers don't receive a personal event, so suggestions go here directly.
        // No sessionId — observers must not have their own session ID overwritten.
        socket.to(zoneRoom(activeWorldId, activeZoneSlug)).emit('world:narration', {
          ...basePayload,
          text: observerText,
          ...(hasSuggestions && { suggestions: result.suggestions }),
        });

        // Actor: narrator only + sessionId.
        // If a personal event follows, suggestions are withheld here and sent there instead,
        // so they appear on the final log entry (narration-internal) rather than disappearing.
        socket.emit('world:narration', {
          ...basePayload,
          sessionId: activeSessionId,
          text: narratorText || result.narration,
          ...(!hasPersonalContent && hasSuggestions && { suggestions: result.suggestions }),
        });

        // Actor only: internal voice + actor-framed NPC speech, carrying the suggestions
        // so they anchor to this final log entry.
        if (hasPersonalContent) {
          socket.emit('world:narration:personal', {
            ...basePayload,
            sessionId: activeSessionId,
            text: personalText,
            ...(hasSuggestions && { suggestions: result.suggestions }),
          });
        }

        // If the origin zone was newly created, broadcast veda update
        if (result.isNewZone) {
          io.to(`world:${activeWorldId}`).emit('veda:update', {
            type: 'zone',
            data: result.zone,
          });
        }

        // If a new player-built feature was proposed, send to player for confirmation
        if (result.proposedFeature && activeWorldId) {
          const pendingId = `feat-${Date.now()}-${Math.random().toString(36).slice(2)}`;
          pendingFeatures.set(pendingId, { proposal: result.proposedFeature, worldId: activeWorldId });
          socket.emit('feature:confirm', {
            pendingId,
            sessionId: activeSessionId!,
            name: result.proposedFeature.name,
            featureType: result.proposedFeature.featureType as any,
            description: result.proposedFeature.description,
            narrative: result.proposedFeature.narrative,
          });
          setTimeout(() => pendingFeatures.delete(pendingId), 5 * 60 * 1000);
        }
      } catch (err) {
        console.error('player:action error', err);
        socket.emit('session:error', {
          code: err instanceof AnthropicAPIError ? `AI_${err.status}` : 'INTERNAL',
          message: aiErrorMessage(err),
        });
      }
    });

    socket.on('feature:confirm:response', async (payload: FeatureConfirmResponsePayload) => {
      const pending = pendingFeatures.get(payload.pendingId);
      if (!pending) return;
      pendingFeatures.delete(payload.pendingId);
      if (payload.action === 'cancel') return;

      try {
        const proposal = { ...pending.proposal };
        if (payload.action === 'edit') {
          if (payload.editedName) proposal.name = payload.editedName;
          if (payload.editedDescription) proposal.description = payload.editedDescription;
          if (payload.editedNarrative !== undefined) proposal.narrative = payload.editedNarrative;
        }

        const world = await prisma.world.findUnique({ where: { id: pending.worldId } });
        if (!world) return;

        const feature = await worldGenerator.persistConfirmedFeature(proposal, ai, {
          name: world.name,
          foundationalLaws: world.foundationalLaws as string[] ?? [],
          culturalTypologies: world.culturalTypologies as string[] ?? [],
        });
        io.to(`world:${pending.worldId}`).emit('veda:update', {
          type: 'feature',
          data: feature,
        });
      } catch (err) {
        console.error('feature:confirm:response error', err);
        socket.emit('session:error', {
          code: 'INTERNAL',
          message: 'Failed to record feature.',
        });
      }
    });

    socket.on('zone:travel:confirm:response', async (payload: ZoneTravelConfirmResponsePayload) => {
      const pending = pendingTravels.get(payload.pendingTravelId);
      if (!pending) return;
      pendingTravels.delete(payload.pendingTravelId);
      if (payload.action === 'confirm') {
        try {
          await pending.execute();
        } catch (err) {
          console.error('zone:travel:confirm:response error', err);
          socket.emit('session:error', {
            code: 'INTERNAL',
            message: 'Failed to complete zone travel.',
          });
        }
      }
    });

    socket.on('zone:chat', async (payload: ZoneChatInputPayload) => {
      if (!activeSessionId || !activeWorldId || !activeZoneSlug) return;
      const message = payload.message?.trim();
      if (!message) return;

      try {
        const session = await sessionService.findById(payload.sessionId);
        if (!session || session.id !== activeSessionId) return;

        // Broadcast to everyone in zone including sender (io.to, not socket.to)
        io.to(zoneRoom(activeWorldId, activeZoneSlug)).emit('zone:chat', {
          playerId: resolvedPlayerId ?? session.playerId,
          username: cachedUsername ?? 'Unknown',
          message,
          zoneSlug: activeZoneSlug,
          timestamp: new Date().toISOString(),
        });
      } catch (err) {
        console.error('zone:chat error', err);
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
        const pid = resolvedPlayerId ?? session.playerId;
        const uname = cachedUsername ?? 'Unknown';
        const capturedWorldId = activeWorldId;
        const capturedSessionId = activeSessionId;

        // Look up destination zone to get display name (may not exist yet for new zones)
        const existingZone = await vedaService.getZone(capturedWorldId, targetSlug);
        const destName = existingZone?.name ?? payload.targetZoneSlug;
        const isNewZone = !existingZone;

        const executeTravelFn = async () => {
          // Leave current zone room
          if (fromSlug) {
            regRemove(zoneRoom(capturedWorldId, fromSlug), socket.id);
            socket.leave(zoneRoom(capturedWorldId, fromSlug));
            socket.to(zoneRoom(capturedWorldId, fromSlug)).emit('player:moved', {
              playerId: pid,
              username: uname,
              characterName: cachedCharacterName,
              fromZoneSlug: fromSlug,
              toZoneSlug: targetSlug,
            });
          }

          // Join new zone room
          const newRoom = zoneRoom(capturedWorldId, targetSlug);
          socket.join(newRoom);
          activeZoneSlug = targetSlug;
          _trackRecentZone(targetSlug);

          const newRoomOthers = regPlayers(newRoom).filter(p => p.playerId !== pid);
          socket.emit('zone:presence', { zoneSlug: targetSlug, players: newRoomOthers });
          regAdd(newRoom, socket.id, { playerId: pid, username: uname, characterName: cachedCharacterName });

          // Check if zone exists in Veda or generate it
          let zone = await vedaService.getZone(capturedWorldId, targetSlug);

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
              pid,
              activeCharacterId ? await prisma.character.findUnique({ where: { id: activeCharacterId } }) as any : null,
              0,
              sessionActionCount,
              currentMood,
            );
            zone = result.zone;
            io.to(`world:${capturedWorldId}`).emit('veda:update', { type: 'zone', data: zone });
          }

          await sessionService.updateZone(capturedSessionId, zone.id);

          const moveZoneFeatures = await worldFeatureService.findByZoneWithScripts(zone.id).catch(() => []);
          const moveZoneFeaturesPayload = moveZoneFeatures.map(f => ({
            id: f.id,
            name: f.name,
            featureType: f.featureType,
            description: f.description,
            narrative: (f as any).narrative ?? null,
            builtByCharacterName: (f as any).builtByCharacterName ?? null,
            interactionTriggers: ((f as any).interactionScripts ?? []).map((s: any) => s.trigger),
          }));

          const moveZoneNpcs = await npcService.listByZone(zone.id).catch(() => []);
          const moveZoneNpcsPayload = await Promise.all(
            moveZoneNpcs.map(async n => {
              const rel = resolvedPlayerId
                ? await npcService.getRelationship(n.id, resolvedPlayerId).catch(() => null)
                : null;
              const knownPlayer = resolvedPlayerId
                ? (n.knownCharacterIds as string[]).includes(resolvedPlayerId)
                : false;
              return {
                name: n.name,
                disposition: n.disposition,
                ...(rel ? { relationshipScore: rel.score } : {}),
                physicalDescription: n.physicalDescription ?? undefined,
                knownPlayer,
                ...(knownPlayer && {
                  traits: (n.traits as string[]) ?? [],
                  backstory: n.backstory ?? undefined,
                }),
              };
            }),
          );

          const moveZoneText = WorldGeneratorService.extractPlainText(zone.rawContent ?? '');
          socket.emit('world:narration', {
            text: moveZoneText,
            zoneSlug: zone.slug,
            sessionId: capturedSessionId,
            timestamp: new Date().toISOString(),
            atmosphereTags: zone.atmosphereTags,
            zoneNpcs: moveZoneNpcsPayload,
            zoneDescription: moveZoneText,
            zoneFeatures: moveZoneFeaturesPayload,
          });

          socket.to(newRoom).emit('player:joined', {
            playerId: pid,
            username: uname,
            characterName: cachedCharacterName,
            zoneSlug: targetSlug,
          });
        };

        const pendingTravelId = `travel-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        pendingTravels.set(pendingTravelId, { destName, destSlug: targetSlug, isNewZone, execute: executeTravelFn });
        socket.emit('zone:travel:confirm', {
          pendingTravelId,
          sessionId: capturedSessionId,
          destinationZoneName: destName,
          destinationZoneSlug: targetSlug,
          isNewZone,
        });
        setTimeout(() => pendingTravels.delete(pendingTravelId), 5 * 60 * 1000);
      } catch (err) {
        console.error('player:move error', err);
        socket.emit('session:error', {
          code: err instanceof AnthropicAPIError ? `AI_${err.status}` : 'INTERNAL',
          message: aiErrorMessage(err),
        });
      }
    });

    socket.on('disconnect', async () => {
      regPurgeSocket(socket.id);

      // Notify zone-mates that this player left
      if (activeWorldId && activeZoneSlug && resolvedPlayerId) {
        socket.to(zoneRoom(activeWorldId, activeZoneSlug)).emit('player:left', {
          playerId: resolvedPlayerId,
          username: cachedUsername ?? 'Unknown',
        });
      }

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
