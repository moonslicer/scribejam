import { describe, expect, it } from 'vitest';
import { toEnhancementArtifacts } from '../../src/main/enhancement/enhancement-artifacts';
import type { PersistedMeetingArtifacts } from '../../src/main/storage/models';

describe('toEnhancementArtifacts', () => {
  it('maps persisted meeting artifacts into the internal enhancement input', () => {
    const artifacts: PersistedMeetingArtifacts = {
      meeting: {
        id: 'meeting-1',
        title: 'Weekly sync',
        state: 'stopped',
        createdAt: '2026-03-13T00:00:00.000Z',
        updatedAt: '2026-03-13T00:05:00.000Z',
        durationMs: 300000
      },
      note: {
        id: 'meeting-1-note',
        meetingId: 'meeting-1',
        content:
          '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Need a launch plan"}]}]}',
        updatedAt: '2026-03-13T00:04:00.000Z'
      },
      transcriptSegments: [
        {
          id: 1,
          meetingId: 'meeting-1',
          speaker: 'them',
          text: '  Share the revised timeline.  ',
          startTs: 10,
          endTs: 11,
          isFinal: true
        }
      ],
      enhancedOutput: null
    };

    expect(toEnhancementArtifacts(artifacts)).toEqual({
      meetingId: 'meeting-1',
      meetingTitle: 'Weekly sync',
      noteContent: {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Need a launch plan' }]
          }
        ]
      },
      transcriptSegments: [
        {
          id: 1,
          speaker: 'them',
          text: 'Share the revised timeline.',
          startTs: 10,
          endTs: 11,
          isFinal: true
        }
      ]
    });
  });

  it('drops malformed notes and sparse transcript entries while keeping a valid input', () => {
    const artifacts: PersistedMeetingArtifacts = {
      meeting: {
        id: 'meeting-2',
        title: 'Sparse meeting',
        state: 'stopped',
        createdAt: '2026-03-13T00:00:00.000Z',
        updatedAt: '2026-03-13T00:05:00.000Z',
        durationMs: 300000
      },
      note: {
        id: 'meeting-2-note',
        meetingId: 'meeting-2',
        content: '{not valid json',
        updatedAt: '2026-03-13T00:04:00.000Z'
      },
      transcriptSegments: [
        {
          id: 1,
          meetingId: 'meeting-2',
          speaker: 'you',
          text: '   ',
          startTs: 20,
          endTs: 21,
          isFinal: true
        },
        {
          id: 2,
          meetingId: 'meeting-2',
          speaker: 'you',
          text: 'Draft the recap',
          startTs: 22,
          endTs: null,
          isFinal: false
        }
      ],
      enhancedOutput: null
    };

    expect(toEnhancementArtifacts(artifacts)).toEqual({
      meetingId: 'meeting-2',
      meetingTitle: 'Sparse meeting',
      noteContent: null,
      transcriptSegments: []
    });
  });
});
