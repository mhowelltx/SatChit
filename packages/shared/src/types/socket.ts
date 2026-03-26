import type { VedaZone, VedaEntity, VedaEvent, VedaLore, WorldFeature } from './veda.js';

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
  sessionId: string;
  timestamp: string;
  /** Suggested player actions generated after this narration */
  suggestions?: string[];
  /** Named entities present in the narration, for colour-coded display */
  mentions?: NameMention[];
  /** Atmosphere/mood tags for the current zone */
  atmosphereTags?: string[];
}

export interface PlayerMovedPayload {
  playerId: string;
  username: string;
  fromZoneSlug: string | null;
  toZoneSlug: string;
}

export interface PlayerJoinedPayload {
  playerId: string;
  username: string;
  zoneSlug: string;
}

export interface PlayerLeftPayload {
  playerId: string;
  username: string;
}

export type VedaUpdateType = 'zone' | 'entity' | 'event' | 'lore' | 'feature';

export interface VedaUpdatePayload {
  type: VedaUpdateType;
  data: VedaZone | VedaEntity | VedaEvent | VedaLore | WorldFeature;
}

export interface ErrorPayload {
  code: string;
  message: string;
}

/** Snapshot of players currently in a zone — sent to a socket on zone entry */
export interface ZonePresencePayload {
  zoneSlug: string;
  players: Array<{ playerId: string; username: string }>;
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

export interface ServerToClientEvents {
  'world:narration': (payload: NarrationPayload) => void;
  'player:moved': (payload: PlayerMovedPayload) => void;
  'player:joined': (payload: PlayerJoinedPayload) => void;
  'player:left': (payload: PlayerLeftPayload) => void;
  'veda:update': (payload: VedaUpdatePayload) => void;
  'session:error': (payload: ErrorPayload) => void;
  'zone:presence': (payload: ZonePresencePayload) => void;
  'player:action:echo': (payload: PlayerActionEchoPayload) => void;
  'zone:chat': (payload: ZoneChatPayload) => void;
}

export interface ClientToServerEvents {
  'session:join': (payload: SessionJoinPayload) => void;
  'player:action': (payload: PlayerActionPayload) => void;
  'player:move': (payload: PlayerMovePayload) => void;
  'zone:chat': (payload: ZoneChatInputPayload) => void;
}
