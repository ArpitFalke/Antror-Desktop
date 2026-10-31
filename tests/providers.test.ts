import { describe, it, expect, vi } from 'vitest';
import { AnthropicAdapter } from '../src/main/providers/anthropic';
import { GeminiAdapter } from '../src/main/providers/gemini';
import { OpenAICompatibleAdapter } from '../src/main/providers/openai-compatible';
import { StreamChunk } from '../src/shared/types';

describe('Provider Adapters', () => {
  it('AnthropicAdapter handles missing API key gracefully', async () => {
    const adapter = new AnthropicAdapter();
    const chunks: StreamChunk[] = [];
    await adapter.streamChat(
      {
        provider: 'anthropic',
        model: 'claude-3-7-sonnet-20250219',
        messages: [{ id: '1', chatId: 'c1', role: 'user', content: 'hello', createdAt: 1 }]
      },
      undefined, // No API key
      undefined,
      (c) => chunks.push(c)
    );

    expect(chunks.length).toBe(1);
    expect(chunks[0].type).toBe('error');
    expect((chunks[0] as any).error).toContain('Missing Anthropic API Key');
  });

  it('GeminiAdapter returns default models', () => {
    const adapter = new GeminiAdapter();
    expect(adapter.defaultModels.length).toBeGreaterThan(0);
    const flash = adapter.defaultModels.find(m => m.id === 'gemini-2.5-flash');
    expect(flash).toBeDefined();
    expect(flash?.supportsThinking).toBe(true);
  });

  it('OpenAICompatibleAdapter handles reasoning models', async () => {
    const adapter = new OpenAICompatibleAdapter(
      'deepseek',
      'DeepSeek',
      'https://api.deepseek.com',
      [{ id: 'deepseek-reasoner', name: 'DeepSeek R1', supportsThinking: true }]
    );
    expect(adapter.defaultModels[0].supportsThinking).toBe(true);
  });
});
