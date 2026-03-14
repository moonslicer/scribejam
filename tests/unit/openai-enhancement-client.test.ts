import { describe, expect, it, vi } from 'vitest';
import {
  EnhancementProviderError,
  EnhancementProviderError as ProviderError
} from '../../src/main/enhancement/llm-client';
import type { EnhancementArtifacts } from '../../src/main/enhancement/enhancement-artifacts';
import {
  OpenAIEnhancementClient,
  validateOpenAIApiKey
} from '../../src/main/enhancement/openai-enhancement-client';

describe('OpenAIEnhancementClient', () => {
  it('sends a structured response request and parses the result', async () => {
    const create = vi.fn().mockResolvedValue({
      output_text: JSON.stringify({
        blocks: [{ source: 'ai', content: 'AI expansion' }],
        actionItems: [],
        decisions: [],
        summary: 'Summary'
      }),
      error: null,
      incomplete_details: null
    });

    const client = new OpenAIEnhancementClient({
      apiKey: 'sk-openai-test',
      client: {
        responses: { create }
      }
    });

    await expect(client.enhance(createArtifacts())).resolves.toEqual({
      blocks: [{ source: 'ai', content: 'AI expansion' }],
      actionItems: [],
      decisions: [],
      summary: 'Summary'
    });

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'gpt-5-mini',
        store: false,
        text: expect.objectContaining({
          format: expect.objectContaining({
            type: 'json_schema',
            name: 'enhanced_output'
          })
        })
      })
    );
  });

  it('fails fast when the api key is missing', () => {
    expect(
      () =>
        new OpenAIEnhancementClient({
          apiKey: '   '
        })
    ).toThrowError(EnhancementProviderError);
  });

  it('normalizes unauthorized OpenAI failures into invalid_api_key errors', async () => {
    const client = new OpenAIEnhancementClient({
      apiKey: 'sk-openai-test',
      client: {
        responses: {
          create: vi.fn().mockRejectedValue({
            status: 401,
            message: 'Unauthorized'
          })
        }
      }
    });

    await expect(client.enhance(createArtifacts())).rejects.toMatchObject({
      code: 'invalid_api_key',
      provider: 'openai'
    });
  });

  it('uses an OpenAI-compatible max_output_tokens value during key validation', async () => {
    const create = vi.fn().mockResolvedValue({
      output_text: 'OK',
      error: null,
      incomplete_details: null
    });

    await expect(
      validateOpenAIApiKey('sk-openai-test', {
        responses: { create }
      })
    ).resolves.toEqual({ valid: true });

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'gpt-5-mini',
        input: 'Reply with OK.',
        max_output_tokens: 16,
        store: false
      })
    );
  });

  it('returns a clearer message when key validation hits quota limits', async () => {
    await expect(
      validateOpenAIApiKey('sk-openai-test', {
        responses: {
          create: vi.fn().mockRejectedValue(
            new ProviderError('rate_limited', '429 You exceeded your current quota.', {
              provider: 'openai'
            })
          )
        }
      })
    ).resolves.toEqual({
      valid: false,
      error:
        'OpenAI rejected the validation check because the API project is out of quota or rate-limited. You can continue setup and fix billing before using enhancement.'
    });
  });
});

function createArtifacts(): EnhancementArtifacts {
  return {
    meetingId: 'meeting-4',
    meetingTitle: 'Launch prep',
    noteContent: {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Need launch checklist' }]
        }
      ]
    },
    transcriptSegments: [
      {
        id: 1,
        speaker: 'them',
        text: 'Please send the revised checklist tomorrow.',
        startTs: 1200,
        endTs: 1500,
        isFinal: true
      }
    ]
  };
}
