import { EnhancementProviderError, type LlmClient } from './llm-client';
import { OpenAIEnhancementClient } from './openai-enhancement-client';

export interface CreateLlmClientOptions {
  provider: 'openai' | 'anthropic';
  getOpenAIApiKey: () => string | undefined;
}

export function createLlmClient(options: CreateLlmClientOptions): LlmClient {
  if (options.provider === 'openai') {
    const apiKey = options.getOpenAIApiKey()?.trim() ?? '';
    if (apiKey.length === 0) {
      throw new EnhancementProviderError(
        'invalid_api_key',
        'OpenAI API key is required for enhancement.',
        { provider: 'openai' }
      );
    }

    return new OpenAIEnhancementClient({
      apiKey
    });
  }

  throw new EnhancementProviderError(
    'unknown',
    `Unsupported enhancement provider: ${options.provider}.`,
    { provider: options.provider }
  );
}
