import React from 'react';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../../src/renderer/App';
import { useMeetingStore } from '../../src/renderer/stores/meeting-store';

let stateListener:
  | ((event: { state: 'idle' | 'recording' | 'stopped' | 'enhancing' | 'done'; meetingId?: string }) => void)
  | null = null;

const api = {
  startMeeting: vi.fn(),
  stopMeeting: vi.fn(),
  getMeeting: vi.fn(),
  enhanceMeeting: vi.fn(),
  getSettings: vi.fn(),
  saveSettings: vi.fn(),
  saveNotes: vi.fn(),
  validateSttKey: vi.fn(),
  sendMicFrames: vi.fn(),
  onMeetingStateChanged: vi.fn(
    (
      listener: (event: {
        state: 'idle' | 'recording' | 'stopped' | 'enhancing' | 'done';
        meetingId?: string;
      }) => void
    ) => {
      stateListener = listener;
      return () => {
        stateListener = null;
      };
    }
  ),
  onAudioLevel: vi.fn(() => () => {}),
  onTranscriptUpdate: vi.fn(() => () => {}),
  onTranscriptionStatus: vi.fn(() => () => {}),
  onErrorDisplay: vi.fn(() => () => {}),
  simulateSttDisconnect: vi.fn()
};

describe('App enhancement flow', () => {
  beforeEach(() => {
    stateListener = null;
    useMeetingStore.setState({
      meetingState: 'idle',
      meetingId: null,
      meetingTitle: '',
      transcriptEntries: [],
      noteContent: null,
      editorContent: null,
      enhancedOutput: null,
      editorInstanceKey: 0,
      noteSaveState: 'idle'
    });

    api.startMeeting.mockReset();
    api.stopMeeting.mockReset();
    api.getMeeting.mockReset();
    api.enhanceMeeting.mockReset();
    api.getSettings.mockReset();
    api.saveSettings.mockReset();
    api.saveNotes.mockReset();
    api.validateSttKey.mockReset();
    api.sendMicFrames.mockReset();
    api.onMeetingStateChanged.mockClear();
    api.onAudioLevel.mockClear();
    api.onTranscriptUpdate.mockClear();
    api.onTranscriptionStatus.mockClear();
    api.onErrorDisplay.mockClear();
    api.simulateSttDisconnect.mockReset();

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
      enhancedOutput: null,
      transcriptSegments: []
    });
    api.enhanceMeeting.mockResolvedValue({
      meetingId: 'meeting-1',
      completedAt: '2026-03-12T18:21:00.000Z',
      output: {
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
      }
    });
    api.startMeeting.mockResolvedValue({
      meetingId: 'meeting-1',
      title: 'Weekly sync'
    });

    Object.defineProperty(window, 'scribejam', {
      value: api,
      configurable: true
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('enhances a stopped meeting and renders AI-authored content', async () => {
    const user = userEvent.setup();
    const { container } = render(<App />);

    await screen.findByTestId('meeting-bar');
    await act(async () => {
      stateListener?.({
        state: 'stopped',
        meetingId: 'meeting-1'
      });
    });

    await waitFor(() => expect(api.getMeeting).toHaveBeenCalledWith({ meetingId: 'meeting-1' }));
    expect(await screen.findByText('Follow up with design')).toBeInTheDocument();

    await user.click(screen.getByTestId('meeting-primary-action'));

    await waitFor(() => expect(api.enhanceMeeting).toHaveBeenCalledWith({ meetingId: 'meeting-1' }));
    expect(await screen.findByText('AI expansion')).toBeInTheDocument();
    expect(container.querySelector('[data-authorship="ai"]')).not.toBeNull();
    expect(screen.getByTestId('meeting-state-value')).toHaveTextContent('done');
  });

  it('resumes the same meeting from done state and restores raw notes for editing', async () => {
    const user = userEvent.setup();
    api.getMeeting.mockResolvedValue({
      id: 'meeting-1',
      title: 'Weekly sync',
      state: 'done',
      createdAt: '2026-03-12T18:00:00.000Z',
      updatedAt: '2026-03-12T18:21:00.000Z',
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
    render(<App />);

    await screen.findByTestId('meeting-bar');
    await act(async () => {
      stateListener?.({
        state: 'done',
        meetingId: 'meeting-1'
      });
    });

    await waitFor(() => expect(api.getMeeting).toHaveBeenCalledWith({ meetingId: 'meeting-1' }));
    expect(await screen.findByText('AI expansion')).toBeInTheDocument();

    await user.click(screen.getByTestId('meeting-primary-action'));

    await waitFor(() =>
      expect(api.startMeeting).toHaveBeenCalledWith({
        title: 'Weekly sync',
        meetingId: 'meeting-1'
      })
    );
    expect(screen.getByTestId('meeting-state-value')).toHaveTextContent('recording');
    await waitFor(() => expect(screen.queryByText('AI expansion')).not.toBeInTheDocument());
    expect(screen.getByText('Follow up with design')).toBeInTheDocument();
  });
});
