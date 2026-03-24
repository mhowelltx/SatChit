import type { IAIProvider, AIProviderName } from './types.js';
import { StubProvider } from './providers/stub.js';
import { AnthropicProvider } from './providers/anthropic.js';
import { OpenAIProvider } from './providers/openai.js';

export type { IAIProvider, GenerationContext, AIProviderName } from './types.js';

export function createAIProvider(): IAIProvider {
  const providerName = (process.env.AI_PROVIDER ?? 'stub') as AIProviderName;

  switch (providerName) {
    case 'anthropic': {
      const key = process.env.ANTHROPIC_API_KEY;
      if (!key) throw new Error('ANTHROPIC_API_KEY is required when AI_PROVIDER=anthropic');
      return new AnthropicProvider(key);
    }
    case 'openai': {
      const key = process.env.OPENAI_API_KEY;
      if (!key) throw new Error('OPENAI_API_KEY is required when AI_PROVIDER=openai');
      return new OpenAIProvider(key);
    }
    case 'stub':
    default:
      return new StubProvider();
  }
}
