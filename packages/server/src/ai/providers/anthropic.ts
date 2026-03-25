import type { IAIProvider, GenerationContext } from '../types.js';
import { buildSystemPrompt, buildUserPrompt } from '../prompts.js';

/** Structured error thrown when the Anthropic API returns a non-2xx response */
export class AnthropicAPIError extends Error {
  constructor(
    public readonly status: number,
    public readonly errorType: string,
    message: string,
  ) {
    super(message);
    this.name = 'AnthropicAPIError';
  }
}

function friendlyMessage(status: number, body: string): { type: string; message: string } {
  try {
    const parsed = JSON.parse(body) as { error?: { type?: string; message?: string } };
    const type = parsed.error?.type ?? 'unknown_error';
    const raw = parsed.error?.message ?? body;

    if (status === 401 || status === 403) {
      return { type, message: 'AI API key is invalid or unauthorised. Check the world\'s API key setting.' };
    }
    if (status === 429) {
      return { type, message: 'AI rate limit reached. Please wait a moment and try again.' };
    }
    if (raw.toLowerCase().includes('credit')) {
      return { type, message: 'AI credit balance exhausted. Add credits to your Anthropic account to continue.' };
    }
    if (status >= 500) {
      return { type, message: 'AI service is temporarily unavailable. Please try again shortly.' };
    }
    return { type, message: `AI error: ${raw}` };
  } catch {
    return { type: 'unknown_error', message: `AI error (${status}). Please try again.` };
  }
}

/**
 * Anthropic (Claude) AI provider.
 * Requires ANTHROPIC_API_KEY in the environment.
 */
export class AnthropicProvider implements IAIProvider {
  private apiKey: string;
  private model: string;

  constructor(apiKey: string, model = 'claude-haiku-4-5-20251001') {
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
        max_tokens: 600,
        system: buildSystemPrompt(context),
        messages: [{ role: 'user', content: buildUserPrompt(prompt, context) }],
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      const { type, message } = friendlyMessage(response.status, body);
      throw new AnthropicAPIError(response.status, type, message);
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
