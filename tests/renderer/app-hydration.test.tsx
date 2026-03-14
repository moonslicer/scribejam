import React from 'react';
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../../src/renderer/App';

let stateListener:
  | ((event: { state: 'idle' | 'recording' | 'stopped' | 'done'; meetingId?: string }) => void)
  | null = null;
let progressListener:
  | ((event: {
      meetingId: string;
      status: 'streaming' | 'done' | 'error';
      detail: string;
    }) => void)
  | null = null;

const api = {
  startMeeting: vi.fn(),
  stopMeeting: vi.fn(),
  getMeeting: vi.fn(),
  enhanceMeeting: vi.fn(),
  dismissEnhancementFailure: vi.fn(),
  getSettings: vi.fn(),
  saveSettings: vi.fn(),
  saveNotes: vi.fn(),
  saveEnhancedNote: vi.fn(),
  validateSttKey: vi.fn(),
  sendMicFrames: vi.fn(),
  onMeetingStateChanged: vi.fn(
    (listener: (event: { state: 'idle' | 'recording' | 'stopped' | 'done'; meetingId?: string }) => void) => {
      stateListener = listener;
      return () => {
        stateListener = null;
      };
    }
  ),
  onEnhanceProgress: vi.fn(
    (
      listener: (event: {
        meetingId: string;
        status: 'streaming' | 'done' | 'error';
        detail: string;
      }) => void
    ) => {
      progressListener = listener;
      return () => {
        progressListener = null;
      };
    }
  ),
  onAudioLevel: vi.fn(() => () => {}),
  onTranscriptUpdate: vi.fn(() => () => {}),
  onTranscriptionStatus: vi.fn(() => () => {}),
  onErrorDisplay: vi.fn(() => () => {}),
  simulateSttDisconnect: vi.fn()
};

describe('App hydration', () => {
  beforeEach(() => {
    stateListener = null;
    progressListener = null;
    api.getSettings.mockResolvedValue({
      firstRunAcknowledged: true,
      sttProvider: 'deepgram',
      llmProvider: 'openai',
      captureSource: 'mixed',
      deepgramApiKeySet: true,
      openaiApiKeySet: false,
      anthropicApiKeySet: false
    });
    api.getMeeting.mockResolvedValue({
      id: 'meeting-1',
      title: 'Weekly sync',
      state: 'stopped',
      createdAt: '2026-03-12T18:00:00.000Z',
      updatedAt: '2026-03-12T18:20:00.000Z',
      durationMs: 1200000,
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
      enhancedNoteContent: null,
      enhancedOutput: null,
      transcriptSegments: [
        {
          id: 1,
          speaker: 'them',
          text: 'Please send the revised mockups.',
          startTs: 12,
          endTs: 12,
          isFinal: true
        }
      ]
    });

    Object.defineProperty(window, 'scribejam', {
      value: api,
      configurable: true
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('hydrates persisted notes and transcript when a meeting id becomes active', async () => {
    render(<App />);
    await screen.findByTestId('meeting-bar');

    await act(async () => {
      stateListener?.({
        state: 'stopped',
        meetingId: 'meeting-1'
      });
    });

    await waitFor(() => expect(api.getMeeting).toHaveBeenCalledWith({ meetingId: 'meeting-1' }));
    expect(await screen.findByText('Follow up with design')).toBeInTheDocument();
    expect(screen.getByText('Please send the revised mockups.')).toBeInTheDocument();
    expect(within(screen.getByTestId('transcript-panel')).getByText(/System audio/i)).toBeInTheDocument();
  });

  it('hydrates persisted enhanced output into the editor when available', async () => {
    api.getMeeting.mockResolvedValueOnce({
      id: 'meeting-1',
      title: 'Weekly sync',
      state: 'done',
      createdAt: '2026-03-12T18:00:00.000Z',
      updatedAt: '2026-03-12T18:25:00.000Z',
      durationMs: 1200000,
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
      enhancedNoteContent: null,
      enhancedOutput: {
        blocks: [
          {
            source: 'human',
            content: 'Follow up with design'
          },
          {
            source: 'ai',
            content: 'AI expansion'
          }
        ],
        actionItems: [],
        decisions: [],
        summary: 'Quick summary'
      },
      transcriptSegments: []
    });

    const { container } = render(<App />);
    await screen.findByTestId('meeting-bar');

    await act(async () => {
      stateListener?.({
        state: 'done',
        meetingId: 'meeting-1'
      });
    });

    await waitFor(() => expect(api.getMeeting).toHaveBeenCalledWith({ meetingId: 'meeting-1' }));
    expect(await screen.findByText('AI expansion')).toBeInTheDocument();
    expect(screen.getByText('Quick summary')).toBeInTheDocument();
    expect(container.querySelector('[data-authorship="ai"]')).not.toBeNull();
  });

  it('hydrates a persisted editable enhanced document ahead of the raw enhancement output', async () => {
    api.getMeeting.mockResolvedValueOnce({
      id: 'meeting-1',
      title: 'Weekly sync',
      state: 'done',
      createdAt: '2026-03-12T18:00:00.000Z',
      updatedAt: '2026-03-12T18:25:00.000Z',
      durationMs: 1200000,
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
            content: 'Follow up with design'
          },
          {
            source: 'ai',
            content: 'AI expansion'
          }
        ],
        actionItems: [],
        decisions: [],
        summary: 'Quick summary'
      },
      transcriptSegments: []
    });

    const { container } = render(<App />);
    await screen.findByTestId('meeting-bar');

    await act(async () => {
      stateListener?.({
        state: 'done',
        meetingId: 'meeting-1'
      });
    });

    await waitFor(() => expect(api.getMeeting).toHaveBeenCalledWith({ meetingId: 'meeting-1' }));
    expect(await screen.findByText('Edited enhanced note')).toBeInTheDocument();
    expect(screen.queryByText('AI expansion')).not.toBeInTheDocument();
    expect(container.querySelector('[data-authorship="ai"]')).toBeNull();
  });
});
