import OpenAI, {
  APIConnectionError,
  APIConnectionTimeoutError,
  AuthenticationError,
  RateLimitError
} from 'openai';
import type { ResponseCreateParamsNonStreaming } from 'openai/resources/responses/responses';
import type { EnhancedOutput } from '../../shared/ipc';
import { buildEnhancementPrompt } from './build-enhancement-prompt';
import type { EnhancementArtifacts } from './enhancement-artifacts';
import {
  EnhancementProviderError,
  normalizeEnhancementError,
  type LlmClient
} from './llm-client';
import { parseEnhancedOutput } from './parse-enhanced-output';

const DEFAULT_MODEL = 'gpt-5-mini';
const DEFAULT_TIMEOUT_MS = 30_000;

const ENHANCED_OUTPUT_RESPONSE_FORMAT: NonNullable<ResponseCreateParamsNonStreaming['text']> = {
  format: {
    type: 'json_schema',
    name: 'enhanced_output',
    description:
      'Structured enhancement output that preserves human note anchors and labels AI-generated content separately.',
    strict: true,
    schema: {
      type: 'object',
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
              source: {
                type: 'string',
                enum: ['human', 'ai']
              },
              content: {
                type: 'string'
              }
            }
          }
        },
        actionItems: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['owner', 'description'],
            properties: {
              owner: { type: 'string' },
              description: { type: 'string' },
              due: { type: 'string' }
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
        summary: {
          type: 'string'
        }
      }
    }
  }
};

interface OpenAIResponsesApi {
  create(
    body: ResponseCreateParamsNonStreaming
  ): Promise<{
    output_text: string;
    error: { message?: string } | null;
    incomplete_details: unknown | null;
  }>;
}

interface OpenAIClientLike {
  responses: OpenAIResponsesApi;
}

export interface OpenAIEnhancementClientOptions {
  apiKey: string;
  model?: string;
  timeoutMs?: number;
  client?: OpenAIClientLike;
}

export class OpenAIEnhancementClient implements LlmClient {
  private readonly client: OpenAIClientLike;
  private readonly model: string;

  public constructor(options: OpenAIEnhancementClientOptions) {
    if (options.apiKey.trim().length === 0) {
      throw new EnhancementProviderError(
        'invalid_api_key',
        'OpenAI API key is required for enhancement.',
        { provider: 'openai' }
      );
    }

    this.model = options.model ?? DEFAULT_MODEL;
    this.client =
      options.client ??
      new OpenAI({
        apiKey: options.apiKey,
        timeout: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
        maxRetries: 0
      });
  }

  public async enhance(input: EnhancementArtifacts): Promise<EnhancedOutput> {
    const prompt = buildEnhancementPrompt(input);

    try {
      const response = await this.client.responses.create({
        model: this.model,
        instructions: prompt.systemPrompt,
        input: prompt.userPrompt,
        temperature: 0.2,
        store: false,
        text: ENHANCED_OUTPUT_RESPONSE_FORMAT
      });

      if (response.error) {
        throw new EnhancementProviderError(
          'invalid_response',
          response.error.message ?? 'OpenAI returned an error response.',
          { provider: 'openai', cause: response.error }
        );
      }

      if (response.incomplete_details) {
        throw new EnhancementProviderError(
          'invalid_response',
          'OpenAI returned an incomplete enhancement response.',
          { provider: 'openai', cause: response.incomplete_details }
        );
      }

      return parseEnhancedOutput(response.output_text);
    } catch (error) {
      throw normalizeOpenAIError(error);
    }
  }
}

function normalizeOpenAIError(error: unknown): EnhancementProviderError {
  if (error instanceof EnhancementProviderError) {
    return error;
  }
  if (error instanceof AuthenticationError) {
    return new EnhancementProviderError('invalid_api_key', error.message, {
      provider: 'openai',
      cause: error
    });
  }
  if (error instanceof RateLimitError) {
    return new EnhancementProviderError('rate_limited', error.message, {
      provider: 'openai',
      cause: error
    });
  }
  if (error instanceof APIConnectionTimeoutError) {
    return new EnhancementProviderError('timeout', error.message, {
      provider: 'openai',
      cause: error
    });
  }
  if (error instanceof APIConnectionError) {
    return new EnhancementProviderError('network', error.message, {
      provider: 'openai',
      cause: error
    });
  }

  return normalizeEnhancementError(error, {
    provider: 'openai',
    fallbackMessage: 'OpenAI enhancement request failed.'
  });
}
