import { describe, expect, it } from 'vitest';
import type { EnhancedOutput } from '../../src/shared/ipc';
import type { EnhancementArtifacts } from '../../src/main/enhancement/enhancement-artifacts';
import {
  EnhancementProviderError,
  isRetryableEnhancementError,
  normalizeEnhancementError,
  type LlmClient
} from '../../src/main/enhancement/llm-client';

describe('llm-client contract', () => {
  it('can be mocked cleanly in orchestrator-style tests', async () => {
    const client: LlmClient = {
      enhance: async (
        _input: EnhancementArtifacts,
        options
      ): Promise<EnhancedOutput> => ({
        blocks: [{ source: 'ai', content: 'Structured summary' }],
        actionItems: [],
        decisions: [],
        summary: options?.templateId ? `Summary (${options.templateId})` : 'Summary'
      })
    };

    await expect(
      client.enhance(createArtifacts(), {
        templateId: 'standup',
        templateInstructions: 'Capture blockers only.'
      })
    ).resolves.toEqual({
      blocks: [{ source: 'ai', content: 'Structured summary' }],
      actionItems: [],
      decisions: [],
      summary: 'Summary (standup)'
    });
  });
});

describe('normalizeEnhancementError', () => {
  it('preserves typed provider errors', () => {
    const error = new EnhancementProviderError('timeout', 'Timed out.', {
      provider: 'openai'
    });

    expect(normalizeEnhancementError(error)).toBe(error);
  });

  it('normalizes unauthorized responses into invalid_api_key errors', () => {
    const error = normalizeEnhancementError(
      {
        status: 401,
        message: 'Unauthorized'
      },
      { provider: 'openai' }
    );

    expect(error).toBeInstanceOf(EnhancementProviderError);
    expect(error.code).toBe('invalid_api_key');
    expect(error.provider).toBe('openai');
    expect(isRetryableEnhancementError(error)).toBe(false);
  });

  it('normalizes rate limits, timeouts, and network failures as retryable', () => {
    const rateLimited = normalizeEnhancementError({
      status: 429,
      message: 'Too many requests'
    });
    const timedOut = normalizeEnhancementError({
      code: 'ETIMEDOUT',
      message: 'Timed out'
    });
    const network = normalizeEnhancementError({
      code: 'ECONNRESET',
      message: 'Socket reset'
    });

    expect(rateLimited.code).toBe('rate_limited');
    expect(timedOut.code).toBe('timeout');
    expect(network.code).toBe('network');
    expect(isRetryableEnhancementError(rateLimited)).toBe(true);
    expect(isRetryableEnhancementError(timedOut)).toBe(true);
    expect(isRetryableEnhancementError(network)).toBe(true);
  });

  it('falls back to unknown for unclassified failures', () => {
    const error = normalizeEnhancementError(new Error('Unexpected failure'), {
      fallbackMessage: 'Enhancement failed.'
    });

    expect(error.code).toBe('unknown');
    expect(error.message).toBe('Unexpected failure');
    expect(isRetryableEnhancementError(error)).toBe(false);
  });
});

function createArtifacts(): EnhancementArtifacts {
  return {
    meetingId: 'meeting-3',
    meetingTitle: 'Design review',
    noteContent: null,
    transcriptSegments: []
  };
}
