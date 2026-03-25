export type NPCDisposition = 'friendly' | 'neutral' | 'wary' | 'hostile' | 'unknown';

export interface NPCRelationship {
  id: string;
  worldId: string;
  npcId: string;
  playerId: string;
  score: number; // -100 (hostile) to +100 (devoted)
  notes: string[];
  lastInteraction: Date;
}

export interface NPC {
  id: string;
  worldId: string;
  vedaEntityId: string | null;
  currentZoneId: string | null;
  name: string;
  species: string | null;
  race: string | null;
  gender: string | null;
  age: number | null;
  physicalDescription: string | null;
  traits: string[];
  skills: Record<string, number>;
  abilities: string[];
  backstory: string | null;
  disposition: NPCDisposition;
  stats: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface NPCItem {
  id: string;
  npcId: string;
  itemId: string;
  quantity: number;
}
