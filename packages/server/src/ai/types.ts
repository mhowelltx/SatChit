import type { World, VedaZone, VedaLore } from '@satchit/shared';

export interface GenerationContext {
  world: Pick<World, 'name' | 'foundationalLaws' | 'culturalTypologies'>;
  currentZone?: VedaZone | null;
  nearbyZones?: VedaZone[];
  worldLore?: VedaLore[];
  playerInput?: string;
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
