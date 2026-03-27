import type { VedaZone, VedaEntity, VedaEvent, VedaLore, WorldFeature, VedaZoneEdge, FeatureType } from './veda.js';

// ── Narration segment voices ──────────────────────────────────────────────────

export type NarrationSegmentType = 'narrator' | 'internal' | 'npc_speech';

/**
 * A discrete "voice" unit within an AI narration response.
 * - narrator:   Third-person, visible to all players in the zone.
 * - internal:   Second-person inner experience, delivered only to the acting player.
 * - npc_speech: Direct NPC dialogue, framed differently for the addressee vs observers.
 */
export interface NarrationSegment {
  type: NarrationSegmentType;
  text: string;
  /** npc_speech only: name of the speaking NPC */
  speakerName?: string;
  /** npc_speech only: character name being addressed, or null if addressing the group */
  addresseeCharacterName?: string | null;
}

// ── Client → Server ──────────────────────────────────────────────────────────

export interface SessionJoinPayload {
  worldId: string;
  worldSlug?: string;
  playerId: string;
  characterId?: string;
  targetZoneSlug?: string; // Rishi avatar: join a specific zone directly
}

export interface PlayerActionPayload {
  sessionId: string;
  input: string;
}

export interface PlayerMovePayload {
  sessionId: string;
  targetZoneSlug: string;
}

export interface ZoneChatInputPayload {
  sessionId: string;
  /** Direct speech message (leading " already stripped by client) */
  message: string;
}

// ── Server → Client ──────────────────────────────────────────────────────────

/** Identifies a named entity in narration text for colour-coding in the client */
export interface NameMention {
  name: string;
  type: 'npc' | 'pc' | 'rishi';
}

export interface NarrationPayload {
  text: string;
  zoneSlug: string;
  /** Present only on payloads addressed to the acting player; omitted from zone-wide observer broadcasts. */
  sessionId?: string;
  timestamp: string;
  /** Suggested player actions generated after this narration */
  suggestions?: string[];
  /** Named entities present in the narration, for colour-coded display */
  mentions?: NameMention[];
  /** Atmosphere/mood tags for the current zone */
  atmosphereTags?: string[];
  /** Known NPCs currently in this zone, for the environment panel */
  zoneNpcs?: Array<{
    name: string;
    disposition: string;
    relationshipScore?: number;
    physicalDescription?: string;
    knownPlayer?: boolean;
    traits?: string[];
    backstory?: string;
  }>;
  /** Full rawContent description of the current/destination zone on zone entry/transition */
  zoneDescription?: string;
  /** World features present in the current zone, for the environment panel */
  zoneFeatures?: Array<{
    id: string;
    name: string;
    featureType: FeatureType;
    description: string;
    narrative?: string | null;
    builtByCharacterName?: string | null;
    interactionTriggers?: string[]; // trigger keywords only (not outcomes)
  }>;
  /** Structured voice segments from the AI; present when perspective-split narration is active */
  segments?: NarrationSegment[];
}

/** Sent once after session:join with world/character identity and the full discovered zone graph */
export interface SessionInfoPayload {
  worldName: string;
  characterName: string | null;
  karmaScore: number | null; // null when no character is embodied
  mapZones: Array<{ slug: string; name: string }>;
  mapEdges: Array<{ from: string; to: string }>;
}

export interface PlayerMovedPayload {
  playerId: string;
  username: string;
  characterName?: string | null;
  fromZoneSlug: string | null;
  toZoneSlug: string;
}

export interface PlayerJoinedPayload {
  playerId: string;
  username: string;
  characterName?: string | null;
  zoneSlug: string;
}

export interface PlayerLeftPayload {
  playerId: string;
  username: string;
}

export type VedaUpdateType = 'zone' | 'entity' | 'event' | 'lore' | 'feature' | 'edge';

export interface VedaUpdatePayload {
  type: VedaUpdateType;
  data: VedaZone | VedaEntity | VedaEvent | VedaLore | WorldFeature | VedaZoneEdge;
}

export interface ErrorPayload {
  code: string;
  message: string;
}

/** Snapshot of players currently in a zone — sent to a socket on zone entry */
export interface ZonePresencePayload {
  zoneSlug: string;
  players: Array<{ playerId: string; username: string; characterName?: string | null }>;
}

/** Broadcast to zone-mates when a player submits an action (before AI narration arrives) */
export interface PlayerActionEchoPayload {
  playerId: string;
  username: string;
  input: string;
  zoneSlug: string;
  timestamp: string;
}

/** Direct zone chat message — no AI involved */
export interface ZoneChatPayload {
  playerId: string;
  username: string;
  message: string;
  zoneSlug: string;
  timestamp: string;
}

// ── Typed event maps (for socket.io generics) ─────────────────────────────────

export interface KarmaUpdatePayload {
  characterId: string;
  karmaScore: number; // new clamped score
  delta: number;      // change applied this action
  reason: string;     // one-sentence explanation
}

export interface ServerToClientEvents {
  'world:narration': (payload: NarrationPayload) => void;
  /** Actor-only: internal voice (feelings, thoughts) + personalized NPC speech ("to you") */
  'world:narration:personal': (payload: NarrationPayload) => void;
  'player:moved': (payload: PlayerMovedPayload) => void;
  'player:joined': (payload: PlayerJoinedPayload) => void;
  'player:left': (payload: PlayerLeftPayload) => void;
  'veda:update': (payload: VedaUpdatePayload) => void;
  'session:error': (payload: ErrorPayload) => void;
  'session:info': (payload: SessionInfoPayload) => void;
  'zone:presence': (payload: ZonePresencePayload) => void;
  'player:action:echo': (payload: PlayerActionEchoPayload) => void;
  'zone:chat': (payload: ZoneChatPayload) => void;
  /** Actor-only: karma score update after an action is evaluated against world laws */
  'karma:update': (payload: KarmaUpdatePayload) => void;
}

export interface ClientToServerEvents {
  'session:join': (payload: SessionJoinPayload) => void;
  'player:action': (payload: PlayerActionPayload) => void;
  'player:move': (payload: PlayerMovePayload) => void;
  'zone:chat': (payload: ZoneChatInputPayload) => void;
}
