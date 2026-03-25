export type EntityType = 'NPC' | 'CREATURE' | 'FACTION' | 'OBJECT';
export type LoreCategory = 'LAW' | 'CULTURE' | 'COSMOLOGY' | 'MYTH';

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

// Everything the Veda knows about a zone, used as AI generation context
export interface ZoneContext {
  zone: VedaZone;
  entities: VedaEntity[];
  recentEvents: VedaEvent[];
  worldLore: VedaLore[];
}
