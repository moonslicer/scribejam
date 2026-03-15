import React from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../../src/renderer/App';
import { useMeetingStore } from '../../src/renderer/stores/meeting-store';

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
  onMeetingStateChanged: vi.fn(() => () => {}),
  onEnhanceProgress: vi.fn(() => () => {}),
  onAudioLevel: vi.fn(() => () => {}),
  onTranscriptUpdate: vi.fn(() => () => {}),
  onTranscriptionStatus: vi.fn(() => () => {}),
  onErrorDisplay: vi.fn(() => () => {}),
  simulateSttDisconnect: vi.fn()
};

describe('App meeting title flow', () => {
  beforeEach(() => {
    useMeetingStore.setState({
      meetingState: 'idle',
      meetingId: null,
      meetingTitle: '',
      transcriptEntries: [],
      noteContent: null,
      enhancedNoteContent: null,
      editorContent: null,
      editorMode: 'notes',
      enhancedOutput: null,
      enhancementProgress: null,
      editorInstanceKey: 0,
      noteSaveState: 'idle'
    });

    api.startMeeting.mockReset();
    api.stopMeeting.mockReset();
    api.getMeeting.mockReset();
    api.enhanceMeeting.mockReset();
    api.dismissEnhancementFailure.mockReset();
    api.getSettings.mockReset();
    api.saveSettings.mockReset();
    api.saveNotes.mockReset();
    api.saveEnhancedNote.mockReset();
    api.validateSttKey.mockReset();
    api.sendMicFrames.mockReset();
    api.onMeetingStateChanged.mockClear();
    api.onEnhanceProgress.mockClear();
    api.onAudioLevel.mockClear();
    api.onTranscriptUpdate.mockClear();
    api.onTranscriptionStatus.mockClear();
    api.onErrorDisplay.mockClear();
    api.simulateSttDisconnect.mockReset();

    api.getSettings.mockResolvedValue({
      firstRunAcknowledged: true,
      sttProvider: 'deepgram',
      llmProvider: 'openai',
      deepgramApiKeySet: true,
      openaiApiKeySet: false,
      anthropicApiKeySet: false
    });
    api.startMeeting.mockResolvedValue({ meetingId: 'meeting-1', title: 'Design review' });
    api.getMeeting.mockResolvedValue(null);

    Object.defineProperty(window, 'scribejam', {
      value: api,
      configurable: true
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('starts the meeting with a generated title when the input is empty', async () => {
    const user = userEvent.setup();
    api.startMeeting.mockResolvedValue({ meetingId: 'meeting-1', title: 'Mar 12 09:07' });
    render(<App />);

    const button = await screen.findByTestId('meeting-primary-action');
    await waitFor(() => expect(button).toBeEnabled());
    await user.click(button);

    await waitFor(() =>
      expect(api.startMeeting).toHaveBeenCalledWith({
        title: ''
      })
    );
    expect(screen.getByDisplayValue('Mar 12 09:07')).toBeInTheDocument();
  });

  it('starts the meeting with the typed title', async () => {
    const user = userEvent.setup();
    render(<App />);

    const input = await screen.findByTestId('meeting-title-input');
    await waitFor(() => expect(input).toBeEnabled());
    await user.type(input, 'Design review');
    await user.click(screen.getByTestId('meeting-primary-action'));

    await waitFor(() =>
      expect(api.startMeeting).toHaveBeenCalledWith({
        title: 'Design review'
      })
    );
  });
});
