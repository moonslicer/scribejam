import { EnhancementProviderError, type LlmClient } from './llm-client';
import { OpenAIEnhancementClient } from './openai-enhancement-client';
import { AnthropicEnhancementClient } from './anthropic-enhancement-client';
import { MockLlmClient } from './mock-llm-client';

export interface CreateLlmClientOptions {
  provider: 'openai' | 'anthropic';
  getOpenAIApiKey: () => string | undefined;
  getAnthropicApiKey: () => string | undefined;
}

export function createLlmClient(options: CreateLlmClientOptions): LlmClient {
  if (process.env.SCRIBEJAM_TEST_MODE === '1') {
    return new MockLlmClient();
  }

  if (options.provider === 'openai') {
    const apiKey = options.getOpenAIApiKey()?.trim() ?? '';
    if (apiKey.length === 0) {
      throw new EnhancementProviderError(
        'invalid_api_key',
        'OpenAI API key is required for enhancement.',
        { provider: 'openai' }
      );
    }

    return new OpenAIEnhancementClient({ apiKey });
  }

  if (options.provider === 'anthropic') {
    const apiKey = options.getAnthropicApiKey()?.trim() ?? '';
    if (apiKey.length === 0) {
      throw new EnhancementProviderError(
        'invalid_api_key',
        'Anthropic API key is required for enhancement.',
        { provider: 'anthropic' }
      );
    }

    return new AnthropicEnhancementClient({ apiKey });
  }

  throw new EnhancementProviderError(
    'unknown',
    `Unsupported enhancement provider: ${options.provider}.`,
    { provider: options.provider }
  );
}
