import type { IAIProvider, GenerationContext } from '../types.js';
import { buildSystemPrompt, buildUserPrompt } from '../prompts.js';

/**
 * OpenAI AI provider.
 * Requires OPENAI_API_KEY in the environment.
 */
export class OpenAIProvider implements IAIProvider {
  private apiKey: string;
  private model: string;

  constructor(apiKey: string, model = 'gpt-4o') {
    this.apiKey = apiKey;
    this.model = model;
  }

  async generate(prompt: string, context: GenerationContext): Promise<string> {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: 1024,
        messages: [
          { role: 'system', content: buildSystemPrompt(context) },
          { role: 'user', content: buildUserPrompt(prompt, context) },
        ],
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error ${response.status}: ${error}`);
    }

    const data = (await response.json()) as {
      choices: Array<{ message: { content: string } }>;
    };

    return data.choices[0]?.message.content ?? '';
  }

  async generateStructured<T>(
    prompt: string,
    context: GenerationContext,
    exampleShape: T,
  ): Promise<T | null> {
    const structuredPrompt = `${prompt}\n\nRespond ONLY with valid JSON matching this shape:\n${JSON.stringify(exampleShape, null, 2)}`;

    const raw = await this.generate(structuredPrompt, context);

    try {
      const cleaned = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
      return JSON.parse(cleaned) as T;
    } catch {
      return null;
    }
  }
}
