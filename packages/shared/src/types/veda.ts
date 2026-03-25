export type EntityType = 'NPC' | 'CREATURE' | 'FACTION' | 'OBJECT';
export type LoreCategory = 'LAW' | 'CULTURE' | 'COSMOLOGY' | 'MYTH';
export type FeatureType = 'MONUMENT' | 'BUILDING' | 'ALTAR' | 'STRUCTURE' | 'MARKER' | 'OTHER';

// A location/area players can explore
export interface VedaZone {
  id: string;
  worldId: string;
  name: string;
  slug: string;
  description: string;
  rawContent: string;
  atmosphereTags: string[]; // AI-assigned mood/tone tags: e.g. "eerie", "serene", "tense"
  discoveredById: string | null;
  discoveredAt: Date;
}

// An entity (NPC, creature, faction, object) encountered in the world
export interface VedaEntity {
  id: string;
  worldId: string;
  zoneId: string | null;
  name: string;
  entityType: EntityType;
  description: string;
  attributes: Record<string, unknown>;
  discoveredAt: Date;
}

// A notable event that occurred in the world
export interface VedaEvent {
  id: string;
  worldId: string;
  description: string;
  participantIds: string[];
  occurredAt: Date;
}

// Fundamental lore: laws, cultures, cosmology, myths
export interface VedaLore {
  id: string;
  worldId: string;
  category: LoreCategory;
  title: string;
  content: string;
  createdAt: Date;
}

// A player-built or player-created physical feature in the world
export interface WorldFeature {
  id: string;
  worldId: string;
  zoneId: string | null;
  name: string;
  description: string;
  featureType: FeatureType;
  builtByCharacterId: string | null;
  builtByPlayerId: string | null;
  attributes: Record<string, unknown>;
  createdAt: Date;
  interactions?: FeatureInteraction[];
}

// A log entry of a player interacting with a world feature
export interface FeatureInteraction {
  id: string;
  featureId: string;
  playerId: string;
  characterId: string | null;
  action: string;
  timestamp: Date;
}

// Everything the Veda knows about a zone, used as AI generation context
export interface ZoneContext {
  zone: VedaZone;
  entities: VedaEntity[];
  recentEvents: VedaEvent[];
  worldLore: VedaLore[];
}
