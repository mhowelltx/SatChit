import type { VedaZone, VedaEntity, VedaEvent, VedaLore } from './veda.js';

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

// ── Server → Client ──────────────────────────────────────────────────────────

export interface NarrationPayload {
  text: string;
  zoneSlug: string;
  sessionId: string;
  timestamp: string;
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

export type VedaUpdateType = 'zone' | 'entity' | 'event' | 'lore';

export interface VedaUpdatePayload {
  type: VedaUpdateType;
  data: VedaZone | VedaEntity | VedaEvent | VedaLore;
}

export interface ErrorPayload {
  code: string;
  message: string;
}

// ── Typed event maps (for socket.io generics) ─────────────────────────────────

export interface ServerToClientEvents {
  'world:narration': (payload: NarrationPayload) => void;
  'player:moved': (payload: PlayerMovedPayload) => void;
  'player:joined': (payload: PlayerJoinedPayload) => void;
  'player:left': (payload: PlayerLeftPayload) => void;
  'veda:update': (payload: VedaUpdatePayload) => void;
  'session:error': (payload: ErrorPayload) => void;
}

export interface ClientToServerEvents {
  'session:join': (payload: SessionJoinPayload) => void;
  'player:action': (payload: PlayerActionPayload) => void;
  'player:move': (payload: PlayerMovePayload) => void;
}
