import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

  it('renders the full-screen notepad workspace with a bottom meeting dock', async () => {
    render(<App />);

    expect(await screen.findByTestId('notepad-editor')).toBeInTheDocument();
    expect(screen.getByTestId('meetings-sidebar')).toBeInTheDocument();
    expect(screen.getByTestId('meeting-dock')).toBeInTheDocument();
    expect(screen.getByTestId('meeting-activity-toggle')).toBeInTheDocument();
    expect(screen.getByTestId('workspace-settings-button')).toBeInTheDocument();
    expect(screen.getByTestId('transcript-panel')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('New note')).toBeInTheDocument();
    expect(screen.queryByText('Me')).not.toBeInTheDocument();
    expect(screen.queryByText(/Add to folder/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Write follow up email/i)).not.toBeInTheDocument();
  });

  it('opens the settings page from the workspace chrome button', async () => {
    const user = userEvent.setup();

    render(<App />);

    await screen.findByTestId('notepad-editor');
    await user.click(screen.getByTestId('workspace-settings-button'));

    expect(screen.getByTestId('settings-page')).toBeInTheDocument();
    expect(screen.getByTestId('settings-panel')).toBeInTheDocument();
    expect(screen.getByTestId('app-shell-title')).toHaveTextContent('Settings');
  });
});
