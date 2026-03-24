import type { IAIProvider, GenerationContext } from '../types.js';

/**
 * Stub AI provider for development and testing.
 * Returns deterministic placeholder responses without calling any external API.
 */
export class StubProvider implements IAIProvider {
  async generate(prompt: string, context: GenerationContext): Promise<string> {
    const worldName = context.world.name;
    const zoneName = context.currentZone?.name ?? 'the unknown';
    const input = context.playerInput ?? '';

    return [
      `[STUB] You are in ${zoneName}, a place within the world of ${worldName}.`,
      input ? `You attempted: "${input}".` : '',
      `The air here carries the essence of the foundational laws: ${context.world.foundationalLaws.slice(0, 2).join('; ')}.`,
      `Something stirs — but this is only a stub response. Connect a real AI provider to experience the full world.`,
    ]
      .filter(Boolean)
      .join(' ');
  }

  async generateStructured<T>(
    prompt: string,
    context: GenerationContext,
    exampleShape: T,
  ): Promise<T | null> {
    // Return the example shape as-is for stub purposes
    return exampleShape;
  }
}
