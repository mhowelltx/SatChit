import type { IAIProvider, GenerationContext } from '../types.js';
import { buildSystemPrompt, buildUserPrompt } from '../prompts.js';

/**
 * Anthropic (Claude) AI provider.
 * Requires ANTHROPIC_API_KEY in the environment.
 */
export class AnthropicProvider implements IAIProvider {
  private apiKey: string;
  private model: string;

  constructor(apiKey: string, model = 'claude-sonnet-4-6') {
    this.apiKey = apiKey;
    this.model = model;
  }

  async generate(prompt: string, context: GenerationContext): Promise<string> {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: 1024,
        system: buildSystemPrompt(context),
        messages: [{ role: 'user', content: buildUserPrompt(prompt, context) }],
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Anthropic API error ${response.status}: ${error}`);
    }

    const data = (await response.json()) as {
      content: Array<{ type: string; text: string }>;
    };

    return data.content.find((c) => c.type === 'text')?.text ?? '';
  }

  async generateStructured<T>(
    prompt: string,
    context: GenerationContext,
    exampleShape: T,
  ): Promise<T | null> {
    const structuredPrompt = `${prompt}\n\nRespond ONLY with valid JSON matching this shape:\n${JSON.stringify(exampleShape, null, 2)}`;

    const raw = await this.generate(structuredPrompt, context);

    try {
      // Strip markdown code fences if present
      const cleaned = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
      return JSON.parse(cleaned) as T;
    } catch {
      return null;
    }
  }
}
