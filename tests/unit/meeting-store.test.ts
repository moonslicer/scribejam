import { describe, expect, it } from 'vitest';
import { createMeetingStore } from '../../src/renderer/stores/meeting-store';

describe('meeting store', () => {
  it('updates meeting identity fields', () => {
    const store = createMeetingStore();

    store.getState().setMeetingState('recording');
    store.getState().setMeetingId('meeting-1');
    store.getState().setMeetingTitle('Weekly sync');

    expect(store.getState()).toMatchObject({
      meetingState: 'recording',
      meetingId: 'meeting-1',
      meetingTitle: 'Weekly sync'
    });
  });

  it('applies transcript updates through the shared transcript reducer', () => {
    const store = createMeetingStore();

    store.getState().applyTranscriptUpdate({
      text: 'Kickoff tomorrow at 10.',
      speaker: 'them',
      ts: 12,
      isFinal: true
    });

    expect(store.getState().transcriptEntries).toHaveLength(1);
    expect(store.getState().transcriptEntries[0]).toMatchObject({
      speaker: 'them',
      text: 'Kickoff tomorrow at 10.',
      isFinal: true
    });
  });

  it('hydrates a persisted meeting payload into store state', () => {
    const store = createMeetingStore();

    store.getState().hydrateMeeting({
      id: 'meeting-1',
      title: 'Design review',
      state: 'stopped',
      createdAt: '2026-03-12T18:00:00.000Z',
      updatedAt: '2026-03-12T18:25:00.000Z',
      durationMs: 1500000,
      noteContent: {
        type: 'doc'
      },
      transcriptSegments: [
        {
          id: 2,
          speaker: 'you',
          text: 'I will send the draft.',
          startTs: 20,
          endTs: 20,
          isFinal: true
        }
      ]
    });

    expect(store.getState()).toMatchObject({
      meetingState: 'stopped',
      meetingId: 'meeting-1',
      meetingTitle: 'Design review',
      noteSaveState: 'saved'
    });
    expect(store.getState().transcriptEntries[0]?.text).toBe('I will send the draft.');
  });
});
