import type { World, VedaZone, VedaLore } from '@satchit/shared';

/** An NPC that appeared in narration but whose name has NOT been revealed to the player. */
export interface TransientNPC {
  /** Role description ("a guard") or personal name if hasProperName but not yet revealed */
  role: string;
  hasProperName: boolean;
  disposition: string;
  physicalDescription?: string;
  traits: string[];
}

export interface GenerationContext {
  world: Pick<World, 'name' | 'foundationalLaws' | 'culturalTypologies'>;
  currentZone?: VedaZone | null;
  nearbyZones?: VedaZone[];
  worldLore?: VedaLore[];
  playerInput?: string;
  /** How many messages have been sent in the current zone this session (0-indexed). */
  zoneMessageCount?: number;
  /** Total actions taken in this session — used for narrative tension pacing. */
  sessionActionCount?: number;
  /** Brief summaries of past events in this zone for the current player. */
  zoneHistory?: string[];
  /** Carried ambient mood/tone from the previous narration, e.g. "tense", "melancholy". */
  currentMood?: string;
  /** Atmosphere tags for the current zone, e.g. ["eerie", "fog-shrouded"]. */
  atmosphereTags?: string[];
  /** NPC name → relationship score (-100 hostile … +100 devoted) for this player. */
  npcRelationships?: Record<string, number>;
  /** Known (Veda-registered) NPCs currently in this zone. */
  npcsPresent?: Array<{ name: string; disposition: string; traits: string[]; physicalDescription: string | null }>;
  /** Transient NPCs in zone this session — unnamed/unintroduced characters. */
  transientNPCs?: TransientNPC[];
  /** Name of the character performing the current action — used for narrator-voice segments. */
  actingCharacterName?: string;
  /** Other player characters present in the zone (for NPC addressing context). */
  otherCharactersPresent?: Array<{ characterName: string; username: string }>;
}

export interface IAIProvider {
  /**
   * Generate free-form narrative text given a prompt and world context.
   */
  generate(prompt: string, context: GenerationContext): Promise<string>;

  /**
   * Generate structured JSON output validated against a simple shape.
   * Returns null if parsing fails; callers should handle gracefully.
   */
  generateStructured<T>(
    prompt: string,
    context: GenerationContext,
    exampleShape: T,
  ): Promise<T | null>;
}

export type AIProviderName = 'anthropic' | 'openai' | 'stub';
