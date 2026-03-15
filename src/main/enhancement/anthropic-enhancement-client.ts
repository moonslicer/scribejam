import Anthropic, {
  APIConnectionError,
  APIConnectionTimeoutError,
  AuthenticationError,
  RateLimitError
} from '@anthropic-ai/sdk';
import type { EnhancedOutput } from '../../shared/ipc';
import { buildEnhancementPrompt } from './build-enhancement-prompt';
import type { EnhancementArtifacts } from './enhancement-artifacts';
import {
  EnhancementProviderError,
  normalizeEnhancementError,
  type LlmClient
} from './llm-client';
import { parseEnhancedOutput } from './parse-enhanced-output';

const DEFAULT_MODEL = 'claude-haiku-4-5-20251001';
const DEFAULT_TIMEOUT_MS = 60_000;
const ANTHROPIC_KEY_VALIDATION_MAX_TOKENS = 16;

const ENHANCED_OUTPUT_TOOL: Anthropic.Tool = {
  name: 'capture_enhanced_output',
  description: 'Captures the structured enhancement output.',
  input_schema: {
    type: 'object' as const,
    additionalProperties: false,
    required: ['blocks', 'actionItems', 'decisions', 'summary'],
    properties: {
      blocks: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['source', 'content'],
          properties: {
            source: { type: 'string', enum: ['human', 'ai'] },
            content: { type: 'string' }
          }
        }
      },
      actionItems: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['owner', 'description', 'due'],
          properties: {
            owner: { type: 'string' },
            description: { type: 'string' },
            due: { type: ['string', 'null'] }
          }
        }
      },
      decisions: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['description', 'context'],
          properties: {
            description: { type: 'string' },
            context: { type: 'string' }
          }
        }
      },
      summary: { type: 'string' }
    }
  }
};

export interface AnthropicEnhancementClientOptions {
  apiKey: string;
  model?: string;
  timeoutMs?: number;
  client?: Pick<Anthropic, 'messages'>;
}

export class AnthropicEnhancementClient implements LlmClient {
  private readonly client: Pick<Anthropic, 'messages'>;
  private readonly model: string;

  public constructor(options: AnthropicEnhancementClientOptions) {
    if (options.apiKey.trim().length === 0) {
      throw new EnhancementProviderError(
        'invalid_api_key',
        'Anthropic API key is required for enhancement.',
        { provider: 'anthropic' }
      );
    }

    this.model = options.model ?? DEFAULT_MODEL;
    this.client =
      options.client ??
      new Anthropic({
        apiKey: options.apiKey,
        timeout: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
        maxRetries: 0
      });
  }

  public async enhance(input: EnhancementArtifacts): Promise<EnhancedOutput> {
    const prompt = buildEnhancementPrompt(input);

    try {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 4096,
        system: prompt.systemPrompt,
        messages: [{ role: 'user', content: prompt.userPrompt }],
        tools: [ENHANCED_OUTPUT_TOOL],
        tool_choice: { type: 'tool', name: 'capture_enhanced_output' }
      });

      const toolUse = response.content.find(
        (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use'
      );

      if (!toolUse) {
        throw new EnhancementProviderError(
          'invalid_response',
          'Anthropic did not return a tool use block.',
          { provider: 'anthropic' }
        );
      }

      return parseEnhancedOutput(JSON.stringify(toolUse.input));
    } catch (error) {
      throw normalizeAnthropicError(error);
    }
  }
}

function normalizeAnthropicError(error: unknown): EnhancementProviderError {
  if (error instanceof EnhancementProviderError) {
    return error;
  }
  if (error instanceof AuthenticationError) {
    return new EnhancementProviderError('invalid_api_key', error.message, {
      provider: 'anthropic',
      cause: error
    });
  }
  if (error instanceof RateLimitError) {
    return new EnhancementProviderError('rate_limited', error.message, {
      provider: 'anthropic',
      cause: error
    });
  }
  if (error instanceof APIConnectionTimeoutError) {
    return new EnhancementProviderError('timeout', error.message, {
      provider: 'anthropic',
      cause: error
    });
  }
  if (error instanceof APIConnectionError) {
    return new EnhancementProviderError('network', error.message, {
      provider: 'anthropic',
      cause: error
    });
  }

  return normalizeEnhancementError(error, {
    provider: 'anthropic',
    fallbackMessage: 'Anthropic enhancement request failed.'
  });
}

export async function validateAnthropicApiKey(
  apiKey: string,
  clientOverride?: Pick<Anthropic, 'messages'>
): Promise<{ valid: boolean; error?: string }> {
  const trimmedKey = apiKey.trim();
  if (trimmedKey.length === 0) {
    return {
      valid: false,
      error: 'Anthropic API key is required.'
    };
  }

  if (process.env.SCRIBEJAM_TEST_MODE === '1') {
    return {
      valid: trimmedKey.startsWith('sk-ant-'),
      ...(trimmedKey.startsWith('sk-ant-')
        ? {}
        : { error: 'Anthropic test keys must start with sk-ant-.' })
    };
  }

  try {
    const client =
      clientOverride ??
      new Anthropic({
        apiKey: trimmedKey,
        timeout: 15_000,
        maxRetries: 0
      });

    await client.messages.create({
      model: DEFAULT_MODEL,
      max_tokens: ANTHROPIC_KEY_VALIDATION_MAX_TOKENS,
      messages: [{ role: 'user', content: 'Reply with OK.' }]
    });

    return { valid: true };
  } catch (error) {
    const normalized = normalizeAnthropicError(error);
    if (normalized.code === 'rate_limited') {
      return {
        valid: false,
        error:
          'Anthropic rejected the validation check because the API project is out of quota or rate-limited. You can continue setup and fix billing before using enhancement.'
      };
    }

    return {
      valid: false,
      error: normalized.message
    };
  }
}
