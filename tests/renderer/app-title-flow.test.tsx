import React from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../../src/renderer/App';

const api = {
  startMeeting: vi.fn(),
  stopMeeting: vi.fn(),
  getMeeting: vi.fn(),
  getSettings: vi.fn(),
  saveSettings: vi.fn(),
  saveNotes: vi.fn(),
  validateSttKey: vi.fn(),
  sendMicFrames: vi.fn(),
  onMeetingStateChanged: vi.fn(() => () => {}),
  onAudioLevel: vi.fn(() => () => {}),
  onTranscriptUpdate: vi.fn(() => () => {}),
  onTranscriptionStatus: vi.fn(() => () => {}),
  onErrorDisplay: vi.fn(() => () => {}),
  simulateSttDisconnect: vi.fn()
};

describe('App meeting title flow', () => {
  beforeEach(() => {
    api.startMeeting.mockReset();
    api.stopMeeting.mockReset();
    api.getMeeting.mockReset();
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
      deepgramApiKeySet: true,
      openaiApiKeySet: false,
      anthropicApiKeySet: false
    });
    api.startMeeting.mockResolvedValue({ meetingId: 'meeting-1' });
    api.getMeeting.mockResolvedValue(null);

    Object.defineProperty(window, 'scribejam', {
      value: api,
      configurable: true
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('blocks meeting start when the title is empty', async () => {
    const user = userEvent.setup();
    render(<App />);

    const button = await screen.findByTestId('meeting-primary-action');
    await waitFor(() => expect(button).toBeEnabled());
    await user.click(button);

    expect(api.startMeeting).not.toHaveBeenCalled();
    expect(screen.getByText('Meeting title is required.')).toBeInTheDocument();
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
