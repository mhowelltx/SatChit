import { describe, it, expect, vi, afterEach } from 'vitest';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe('createAIProvider', () => {
  it('returns StubProvider when AI_PROVIDER=stub', async () => {
    vi.stubEnv('AI_PROVIDER', 'stub');
    const { createAIProvider } = await import('../ai/index.js');
    const provider = createAIProvider();
    expect(provider.constructor.name).toBe('StubProvider');
  });

  it('returns StubProvider by default when AI_PROVIDER is unset', async () => {
    vi.stubEnv('AI_PROVIDER', '');
    const { createAIProvider } = await import('../ai/index.js');
    const provider = createAIProvider();
    expect(provider.constructor.name).toBe('StubProvider');
  });

  it('throws when AI_PROVIDER=anthropic and ANTHROPIC_API_KEY is missing', async () => {
    vi.stubEnv('AI_PROVIDER', 'anthropic');
    vi.stubEnv('ANTHROPIC_API_KEY', '');
    const { createAIProvider } = await import('../ai/index.js');
    expect(() => createAIProvider()).toThrow('ANTHROPIC_API_KEY is required');
  });

  it('throws when AI_PROVIDER=openai and OPENAI_API_KEY is missing', async () => {
    vi.stubEnv('AI_PROVIDER', 'openai');
    vi.stubEnv('OPENAI_API_KEY', '');
    const { createAIProvider } = await import('../ai/index.js');
    expect(() => createAIProvider()).toThrow('OPENAI_API_KEY is required');
  });

  it('returns AnthropicProvider when ANTHROPIC_API_KEY is present', async () => {
    vi.stubEnv('AI_PROVIDER', 'anthropic');
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-ant-test-key');
    const { createAIProvider } = await import('../ai/index.js');
    const provider = createAIProvider();
    expect(provider.constructor.name).toBe('AnthropicProvider');
  });
});
