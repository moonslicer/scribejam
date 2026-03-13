import { describe, expect, it, vi } from 'vitest';
import { EnhancementProviderError } from '../../src/main/enhancement/llm-client';
import type { EnhancementArtifacts } from '../../src/main/enhancement/enhancement-artifacts';
import { OpenAIEnhancementClient } from '../../src/main/enhancement/openai-enhancement-client';

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
