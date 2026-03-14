import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../../src/renderer/App';
import { useHistoryStore } from '../../src/renderer/stores/history-store';

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

describe('App meeting history', () => {
  beforeEach(() => {
    useHistoryStore.setState({
      items: [],
      isLoading: false,
      errorMessage: null,
      searchQuery: '',
      selectedMeetingId: null
    });

    api.listMeetings.mockReset();
    api.listMeetings
      .mockResolvedValueOnce({
        items: [
          {
            id: 'meeting-1',
            title: 'Roadmap review',
            state: 'done',
            createdAt: '2026-03-12T18:00:00.000Z',
            updatedAt: '2026-03-12T18:15:00.000Z',
            durationMs: 900000,
            hasEnhancedOutput: true,
            previewText: 'Roadmap approved for beta.'
          }
        ]
      })
      .mockResolvedValueOnce({
        items: [
          {
            id: 'meeting-1',
            title: 'Roadmap review',
            state: 'done',
            createdAt: '2026-03-12T18:00:00.000Z',
            updatedAt: '2026-03-12T18:15:00.000Z',
            durationMs: 900000,
            hasEnhancedOutput: true,
            previewText: 'Roadmap approved for beta.'
          }
        ]
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

  it('loads saved meetings and re-queries when the history search changes', async () => {
    render(<App />);

    expect(await screen.findByText('Roadmap review')).toBeInTheDocument();
    expect(api.listMeetings).toHaveBeenCalledWith(undefined);

    fireEvent.change(screen.getByTestId('meeting-history-search'), {
      target: { value: 'roadmap' }
    });

    await waitFor(() => expect(api.listMeetings).toHaveBeenLastCalledWith({ query: 'roadmap' }));
  });
});
