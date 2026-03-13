import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../../src/renderer/App';

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
  onMeetingStateChanged: vi.fn(() => () => {}),
  onAudioLevel: vi.fn(() => () => {}),
  onTranscriptUpdate: vi.fn(() => () => {}),
  onTranscriptionStatus: vi.fn(() => () => {}),
  onErrorDisplay: vi.fn(() => () => {}),
  simulateSttDisconnect: vi.fn()
};

describe('App layout', () => {
  beforeEach(() => {
    api.getSettings.mockResolvedValue({
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

  it('renders the split-pane notepad and transcript workspace', async () => {
    render(<App />);

    expect(await screen.findByTestId('notepad-editor')).toBeInTheDocument();
    expect(screen.getByTestId('transcript-panel')).toBeInTheDocument();
    expect(screen.getByText('Meeting notepad')).toBeInTheDocument();
  });
});
