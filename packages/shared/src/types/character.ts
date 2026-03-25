export interface Character {
  id: string;
  userId: string;
  worldId: string;
  name: string;
  species: string | null;
  race: string | null;
  gender: string | null;
  age: number | null;
  physicalDescription: string | null;
  traits: string[];
  skills: Record<string, number>;  // skill -> level
  abilities: string[];
  backstory: string | null;
  stats: Record<string, unknown>;        // health, mana, xp, etc.
  customAttributes: Record<string, unknown>; // world-specific fields from WorldCharacterTemplate
  createdAt: Date;
  updatedAt: Date;
}

export interface CharacterItem {
  id: string;
  characterId: string;
  itemId: string;
  quantity: number;
  isEquipped: boolean;
}

export type CreateCharacterInput = Pick<
  Character,
  'name' | 'species' | 'race' | 'gender' | 'age' | 'physicalDescription' | 'traits' | 'skills' | 'abilities' | 'backstory'
>;
