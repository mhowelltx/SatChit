import type { World, VedaZone, VedaLore } from '@satchit/shared';

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
