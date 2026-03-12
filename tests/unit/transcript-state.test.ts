import { describe, expect, it } from 'vitest';
import type { TranscriptUpdateEvent } from '../../src/shared/ipc';
import { applyTranscriptEvent, type TranscriptEntry } from '../../src/renderer/transcript/transcript-state';

function event(overrides: Partial<TranscriptUpdateEvent>): TranscriptUpdateEvent {
  return {
    text: 'hello',
    speaker: 'you',
    ts: 100,
    isFinal: false,
    ...overrides
  };
}

describe('applyTranscriptEvent', () => {
  it('creates one live row then updates it in place for partials', () => {
    let entries: TranscriptEntry[] = [];
    entries = applyTranscriptEvent(entries, event({ text: 'Why' }));
    entries = applyTranscriptEvent(entries, event({ text: 'Why not?' }));

    expect(entries).toHaveLength(1);
    expect(entries[0]?.text).toBe('Why not?');
    expect(entries[0]?.isFinal).toBe(false);
  });

  it('finalizes the active live row instead of appending duplicate text', () => {
    let entries: TranscriptEntry[] = [];
    entries = applyTranscriptEvent(entries, event({ text: 'Can you tell me', isFinal: false }));
    entries = applyTranscriptEvent(entries, event({ text: 'Can you tell me more?', isFinal: true, ts: 120 }));

    expect(entries).toHaveLength(1);
    expect(entries[0]?.text).toBe('Can you tell me more?');
    expect(entries[0]?.isFinal).toBe(true);
  });

  it('drops duplicate finalized events', () => {
    let entries: TranscriptEntry[] = [];
    entries = applyTranscriptEvent(entries, event({ text: 'Why not?', isFinal: true, ts: 100 }));
    entries = applyTranscriptEvent(entries, event({ text: 'Why not?', isFinal: true, ts: 101 }));

    expect(entries).toHaveLength(1);
  });

  it('starts a new live row when speaker changes', () => {
    let entries: TranscriptEntry[] = [];
    entries = applyTranscriptEvent(entries, event({ text: 'you sentence', speaker: 'you', isFinal: false }));
    entries = applyTranscriptEvent(entries, event({ text: 'them sentence', speaker: 'them', isFinal: false, ts: 101 }));

    expect(entries).toHaveLength(2);
    expect(entries[0]?.speaker).toBe('you');
    expect(entries[1]?.speaker).toBe('them');
  });
});
