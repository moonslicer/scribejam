import React from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../../src/renderer/App';
import { useMeetingStore } from '../../src/renderer/stores/meeting-store';

const api = {
  startMeeting: vi.fn(),
  stopMeeting: vi.fn(),
  resetMeeting: vi.fn(),
  getMeeting: vi.fn(),
  enhanceMeeting: vi.fn(),
  getSettings: vi.fn(),
  saveSettings: vi.fn(),
  saveNotes: vi.fn(),
  validateProviderKey: vi.fn(),
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

describe('App settings flow', () => {
  beforeEach(() => {
    useMeetingStore.setState({
      meetingState: 'idle',
      meetingId: null,
      meetingTitle: '',
      transcriptEntries: [],
      noteContent: null,
      editorContent: null,
      enhancedOutput: null,
      enhancementProgress: null,
      editorInstanceKey: 0,
      noteSaveState: 'idle'
    });

    api.startMeeting.mockReset();
    api.stopMeeting.mockReset();
    api.resetMeeting.mockReset();
    api.getMeeting.mockReset();
    api.enhanceMeeting.mockReset();
    api.getSettings.mockReset();
    api.saveSettings.mockReset();
    api.saveNotes.mockReset();
    api.validateProviderKey.mockReset();
    api.validateSttKey.mockReset();
    api.sendMicFrames.mockReset();
    api.onMeetingStateChanged.mockClear();
    api.onEnhanceProgress.mockClear();
    api.onAudioLevel.mockClear();
    api.onTranscriptUpdate.mockClear();
    api.onTranscriptionStatus.mockClear();
    api.onErrorDisplay.mockClear();
    api.simulateSttDisconnect.mockReset();

    api.getSettings
      .mockResolvedValueOnce({
        firstRunAcknowledged: false,
        sttProvider: 'deepgram',
        llmProvider: 'openai',
        captureSource: 'mixed',
        deepgramApiKeySet: true,
        openaiApiKeySet: false,
        anthropicApiKeySet: false
      })
      .mockResolvedValue({
        firstRunAcknowledged: true,
        sttProvider: 'deepgram',
        llmProvider: 'openai',
        captureSource: 'mixed',
        deepgramApiKeySet: true,
        openaiApiKeySet: false,
        anthropicApiKeySet: false
      });

    Object.defineProperty(window, 'scribejam', {
      value: api,
      configurable: true
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('acknowledges first-run disclosure without clearing an already stored Deepgram key', async () => {
    const user = userEvent.setup();
    render(<App />);

    await screen.findByTestId('setup-wizard');
    await user.click(screen.getByTestId('setup-disclosure-ack'));
    await waitFor(() => expect(screen.getByTestId('setup-continue-button')).toBeEnabled());
    await user.click(screen.getByTestId('setup-continue-button'));

    await waitFor(() =>
      expect(api.saveSettings).toHaveBeenCalledWith({
        firstRunAcknowledged: true
      })
    );
  });
});
