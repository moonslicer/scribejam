import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../../src/renderer/App';

const api = {
  startMeeting: vi.fn(),
  stopMeeting: vi.fn(),
  listMeetings: vi.fn(),
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

describe('App layout', () => {
  beforeEach(() => {
    api.listMeetings.mockResolvedValue({
      items: []
    });
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
    expect(screen.getByTestId('meeting-history-panel')).toBeInTheDocument();
    expect(screen.getByTestId('meeting-history-search')).toBeInTheDocument();
    expect(screen.getByTestId('transcript-panel')).toBeInTheDocument();
    expect(screen.getByText('Meeting notepad')).toBeInTheDocument();
  });
});
