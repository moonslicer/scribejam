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

    expect(
      prompt.userPrompt.indexOf(
        'User notes — these signal what the user found important; expand on these topics preferentially:'
      )
    ).toBeLessThan(prompt.userPrompt.indexOf('Transcript:'));
    expect(prompt.userPrompt).toContain('- Need launch checklist');
    expect(prompt.userPrompt).toContain('- [0.0s] Them: Please send the revised timeline.');
  });

  it('states that human notes are distilled into polished topic headings', () => {
    const prompt = buildEnhancementPrompt(createArtifacts());

    expect(prompt.systemPrompt).toContain('polished 2–6 word topic heading (source: "human")');
    expect(prompt.systemPrompt).toContain('Fix typos and grammar — capture the essence, do NOT copy the raw text verbatim.');
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

  it('keeps the system prompt unchanged when template instructions are absent or empty', () => {
    const baseline = buildEnhancementPrompt(createArtifacts());
    const withUndefined = buildEnhancementPrompt(createArtifacts(), undefined);
    const withEmpty = buildEnhancementPrompt(createArtifacts(), '   ');

    expect(withUndefined.systemPrompt).toBe(baseline.systemPrompt);
    expect(withEmpty.systemPrompt).toBe(baseline.systemPrompt);
  });

  it('appends template instructions to the system prompt when provided', () => {
    const prompt = buildEnhancementPrompt(
      createArtifacts(),
      'This is a technical design review. Collect open questions explicitly.'
    );

    expect(prompt.systemPrompt).toContain(
      'MEETING TYPE — shape all output fields according to these instructions:'
    );
    expect(prompt.systemPrompt).toContain(
      'This is a technical design review. Collect open questions explicitly.'
    );
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
