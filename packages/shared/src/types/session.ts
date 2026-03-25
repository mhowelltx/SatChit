export type SessionStatus = 'ACTIVE' | 'ENDED';

export interface GameSession {
  id: string;
  worldId: string;
  playerId: string;
  currentZoneId: string | null;
  status: SessionStatus;
  startedAt: Date;
}

export interface PlayerAction {
  id: string;
  sessionId: string;
  rawInput: string;
  aiResponse: string;
  timestamp: Date;
}
