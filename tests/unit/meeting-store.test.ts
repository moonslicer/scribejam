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
      enhancedNoteContent: null,
      enhancedOutput: null,
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

  it('derives editor content from enhanced output while preserving raw notes', () => {
    const store = createMeetingStore();

    store.getState().hydrateMeeting({
      id: 'meeting-1',
      title: 'Design review',
      state: 'done',
      createdAt: '2026-03-12T18:00:00.000Z',
      updatedAt: '2026-03-12T18:25:00.000Z',
      durationMs: 1500000,
      noteContent: {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: 'Raw note'
              }
            ]
          }
        ]
      },
      enhancedNoteContent: null,
      enhancedOutput: {
        blocks: [
          {
            source: 'human',
            content: 'Raw note'
          },
          {
            source: 'ai',
            content: 'AI expansion'
          }
        ],
        actionItems: [],
        decisions: [],
        summary: 'Summary'
      },
      transcriptSegments: []
    });

    expect(store.getState().noteContent).toEqual({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: 'Raw note'
            }
          ]
        }
      ]
    });
    expect(store.getState().enhancedOutput?.summary).toBe('Summary');
    expect(store.getState().editorMode).toBe('enhanced');
    expect(store.getState().editorContent).toMatchObject({
      type: 'doc'
    });
  });

  it('restores raw notes into the editor when enhancement view is dismissed', () => {
    const store = createMeetingStore();

    store.getState().hydrateMeeting({
      id: 'meeting-1',
      title: 'Design review',
      state: 'done',
      createdAt: '2026-03-12T18:00:00.000Z',
      updatedAt: '2026-03-12T18:25:00.000Z',
      durationMs: 1500000,
      noteContent: {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: 'Raw note'
              }
            ]
          }
        ]
      },
      enhancedNoteContent: null,
      enhancedOutput: {
        blocks: [
          {
            source: 'human',
            content: 'Raw note'
          },
          {
            source: 'ai',
            content: 'AI expansion'
          }
        ],
        actionItems: [],
        decisions: [],
        summary: 'Summary'
      },
      transcriptSegments: []
    });

    store.getState().resumeEditingNotes();

    expect(store.getState().enhancedOutput?.summary).toBe('Summary');
    expect(store.getState().editorMode).toBe('notes');
    expect(store.getState().editorContent).toEqual(store.getState().noteContent);
    expect(store.getState().editorInstanceKey).toBe(1);
  });

  it('clears the active meeting when starting a fresh session from done', () => {
    const store = createMeetingStore();

    store.getState().hydrateMeeting({
      id: 'meeting-1',
      title: 'Design review',
      state: 'done',
      createdAt: '2026-03-12T18:00:00.000Z',
      updatedAt: '2026-03-12T18:25:00.000Z',
      durationMs: 1500000,
      noteContent: {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: 'Raw note'
              }
            ]
          }
        ]
      },
      enhancedNoteContent: null,
      enhancedOutput: {
        blocks: [
          {
            source: 'human',
            content: 'Raw note'
          },
          {
            source: 'ai',
            content: 'AI expansion'
          }
        ],
        actionItems: [],
        decisions: [],
        summary: 'Summary'
      },
      transcriptSegments: []
    });

    store.getState().clearMeeting();

    expect(store.getState()).toMatchObject({
      meetingState: 'idle',
      meetingId: null,
      meetingTitle: '',
      transcriptEntries: [],
      noteContent: null,
      enhancedNoteContent: null,
      editorContent: null,
      editorMode: 'notes',
      enhancedOutput: null,
      noteSaveState: 'idle'
    });
  });

  it('prefers a persisted editable enhanced document when hydrating done meetings', () => {
    const store = createMeetingStore();

    store.getState().hydrateMeeting({
      id: 'meeting-1',
      title: 'Design review',
      state: 'done',
      createdAt: '2026-03-12T18:00:00.000Z',
      updatedAt: '2026-03-12T18:25:00.000Z',
      durationMs: 1500000,
      noteContent: {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: 'Raw note'
              }
            ]
          }
        ]
      },
      enhancedNoteContent: {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: 'Edited enhanced note'
              }
            ]
          }
        ]
      },
      enhancedOutput: {
        blocks: [
          {
            source: 'human',
            content: 'Raw note'
          },
          {
            source: 'ai',
            content: 'AI expansion'
          }
        ],
        actionItems: [],
        decisions: [],
        summary: 'Summary'
      },
      transcriptSegments: []
    });

    expect(store.getState().editorMode).toBe('enhanced');
    expect(store.getState().editorContent).toEqual(store.getState().enhancedNoteContent);
  });
});
