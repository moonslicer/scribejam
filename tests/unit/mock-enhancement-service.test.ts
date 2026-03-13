import { describe, expect, it } from 'vitest';
import { MockEnhancementService } from '../../src/main/enhancement/mock-enhancement-service';

describe('MockEnhancementService', () => {
  it('builds deterministic enhancement output from notes and transcript', () => {
    const service = new MockEnhancementService();

    const output = service.enhance({
      meetingId: 'meeting-1',
      meetingTitle: 'Weekly sync',
      noteContent: {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: 'Follow up with design'
              }
            ]
          }
        ]
      },
      transcriptSegments: [
        {
          id: 1,
          speaker: 'them',
          text: 'Please send the revised mockups tomorrow.',
          startTs: 12,
          endTs: 12,
          isFinal: true
        },
        {
          id: 2,
          speaker: 'you',
          text: 'We agreed to ship the draft on Friday.',
          startTs: 18,
          endTs: 18,
          isFinal: true
        }
      ]
    });

    expect(output).toEqual({
      blocks: [
        {
          source: 'human',
          content: 'Follow up with design'
        },
        {
          source: 'ai',
          content: [
            'Transcript context:',
            '- Them: Please send the revised mockups tomorrow.',
            '- You: We agreed to ship the draft on Friday.'
          ].join('\n')
        }
      ],
      actionItems: [
        {
          owner: 'Them',
          description: 'Please send the revised mockups tomorrow.'
        },
        {
          owner: 'You',
          description: 'We agreed to ship the draft on Friday.'
        }
      ],
      decisions: [
        {
          description: 'We agreed to ship the draft on Friday.',
          context: 'You said: We agreed to ship the draft on Friday.'
        }
      ],
      summary: 'User notes captured 1 anchor point(s). Transcript captured 2 segment(s) for enhancement context.'
    });
  });

  it('handles missing notes and transcript gracefully', () => {
    const service = new MockEnhancementService();

    const output = service.enhance({
      meetingId: 'meeting-2',
      meetingTitle: 'No context',
      noteContent: null,
      transcriptSegments: []
    });

    expect(output.blocks).toEqual([
      {
        source: 'ai',
        content: 'Transcript context was unavailable for this meeting.'
      }
    ]);
    expect(output.actionItems).toEqual([]);
    expect(output.decisions).toEqual([]);
    expect(output.summary).toBe('No user note anchors were captured. Transcript context was unavailable.');
  });
});
