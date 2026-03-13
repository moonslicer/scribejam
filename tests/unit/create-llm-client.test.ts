import { describe, expect, it, vi } from 'vitest';
import { EnhancementProviderError } from '../../src/main/enhancement/llm-client';
import { createLlmClient } from '../../src/main/enhancement/create-llm-client';
import { OpenAIEnhancementClient } from '../../src/main/enhancement/openai-enhancement-client';

describe('createLlmClient', () => {
  it('creates an OpenAI client when the provider and key are configured', () => {
    const client = createLlmClient({
      provider: 'openai',
      getOpenAIApiKey: () => 'sk-openai-test'
    });

    expect(client).toBeInstanceOf(OpenAIEnhancementClient);
  });

  it('fails with invalid_api_key when the OpenAI key is missing', () => {
    expect(() =>
      createLlmClient({
        provider: 'openai',
        getOpenAIApiKey: () => ''
      })
    ).toThrowError(EnhancementProviderError);

    try {
      createLlmClient({
        provider: 'openai',
        getOpenAIApiKey: () => ''
      });
    } catch (error) {
      expect((error as EnhancementProviderError).code).toBe('invalid_api_key');
    }
  });

  it('fails clearly for unsupported providers', () => {
    expect(() =>
      createLlmClient({
        provider: 'anthropic',
        getOpenAIApiKey: vi.fn()
      })
    ).toThrowError('Unsupported enhancement provider: anthropic.');
  });
});
