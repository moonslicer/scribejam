import { describe, expect, it } from 'vitest';
import { buildEnhancementPrompt } from '../../src/main/enhancement/build-enhancement-prompt';
import type { EnhancementArtifacts } from '../../src/main/enhancement/enhancement-artifacts';

describe('buildEnhancementPrompt', () => {
  it('places user notes before transcript context in the prompt', () => {
    const prompt = buildEnhancementPrompt({
      meetingId: 'meeting-1',
      meetingTitle: 'Roadmap review',
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
          text: 'Please send the revised timeline.',
          startTs: 1200,
          endTs: 1800,
          isFinal: true
        }
      ]
    });

    expect(prompt.userPrompt.indexOf('User notes (preserve verbatim as human anchors):')).toBeLessThan(
      prompt.userPrompt.indexOf('Transcript context:')
    );
    expect(prompt.userPrompt).toContain('- Need launch checklist');
    expect(prompt.userPrompt).toContain('- [1.20s] Them: Please send the revised timeline.');
  });

  it('states that human notes remain verbatim anchors', () => {
    const prompt = buildEnhancementPrompt(createArtifacts());

    expect(prompt.systemPrompt).toContain('Preserve every user note verbatim as a human-authored anchor.');
    expect(prompt.systemPrompt).toContain(
      'Do not overwrite, rewrite, or silently absorb user-authored notes into AI blocks.'
    );
  });

  it('handles empty notes and transcript with explicit fallback language', () => {
    const prompt = buildEnhancementPrompt({
      ...createArtifacts(),
      noteContent: null,
      transcriptSegments: []
    });

    expect(prompt.userPrompt).toContain('- No user notes were captured.');
    expect(prompt.userPrompt).toContain('- No finalized transcript context was captured.');
  });
});

function createArtifacts(): EnhancementArtifacts {
  return {
    meetingId: 'meeting-2',
    meetingTitle: 'Weekly sync',
    noteContent: {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Confirm owners' }]
        }
      ]
    },
    transcriptSegments: [
      {
        id: 2,
        speaker: 'you',
        text: 'We agreed to ship the draft on Friday.',
        startTs: 2000,
        endTs: 2400,
        isFinal: true
      }
    ]
  };
}
