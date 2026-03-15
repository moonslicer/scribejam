import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../../src/renderer/App';
import { AUTOSAVE_DELAY_MS } from '../../src/renderer/hooks/use-note-autosave';
import { useMeetingStore } from '../../src/renderer/stores/meeting-store';
import { getBuiltInTemplateById } from '../../src/shared/templates';

let stateListener:
  | ((event: {
      state: 'idle' | 'recording' | 'stopped' | 'enhancing' | 'enhance_failed' | 'done';
      meetingId?: string;
    }) => void)
  | null = null;
let progressListener:
  | ((event: {
      meetingId: string;
      status: 'streaming' | 'done' | 'error';
      detail: string;
    }) => void)
  | null = null;
let errorListener:
  | ((event: { message: string; action?: 'open-settings' | 'retry' }) => void)
  | null = null;

const api = {
  startMeeting: vi.fn(),
  stopMeeting: vi.fn(),
  resetMeeting: vi.fn(),
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
    (
      listener: (event: {
        state: 'idle' | 'recording' | 'stopped' | 'enhancing' | 'enhance_failed' | 'done';
        meetingId?: string;
      }) => void
    ) => {
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
  onErrorDisplay: vi.fn((listener: (event: { message: string; action?: 'open-settings' | 'retry' }) => void) => {
    errorListener = listener;
    return () => {
      errorListener = null;
    };
  }),
  simulateSttDisconnect: vi.fn()
};

const AUTO_TEMPLATE_PAYLOAD = {
  meetingId: 'meeting-1',
  templateId: 'auto',
  templateInstructions: ''
};

describe('App enhancement flow', () => {
  beforeEach(() => {
    stateListener = null;
    progressListener = null;
    errorListener = null;
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
      lastTemplateId: null,
      lastTemplateName: null,
      enhancedOutputCreatedAt: null,
      enhancedNoteUpdatedAt: null,
      editorInstanceKey: 0,
      noteSaveState: 'idle',
      noteEditedAfterEnhancement: false
    });

    api.startMeeting.mockReset();
    api.stopMeeting.mockReset();
    api.resetMeeting.mockReset();
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
      defaultTemplateId: 'auto',
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
    api.resetMeeting.mockResolvedValue({
      state: 'idle'
    });
    api.dismissEnhancementFailure.mockResolvedValue({
      meetingId: 'meeting-1',
      state: 'stopped'
    });

    Object.defineProperty(window, 'scribejam', {
      value: api,
      configurable: true
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
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
    await waitFor(() => expect(screen.getByTestId('generate-notes-button')).toBeEnabled());
    await user.click(screen.getByTestId('generate-notes-button'));

    await waitFor(() => expect(api.enhanceMeeting).toHaveBeenCalledWith(AUTO_TEMPLATE_PAYLOAD));
    expect(await screen.findByText('AI expansion')).toBeInTheDocument();
    expect(container.querySelector('[data-authorship="ai"]')).not.toBeNull();
    expect(screen.getByTestId('meeting-state-value')).toHaveTextContent('done');
  });

  it('resumes recording from stopped state without triggering enhancement', async () => {
    const user = userEvent.setup();
    render(<App />);

    await screen.findByTestId('meeting-bar');
    await act(async () => {
      stateListener?.({
        state: 'stopped',
        meetingId: 'meeting-1'
      });
    });

    await waitFor(() => expect(api.getMeeting).toHaveBeenCalledWith({ meetingId: 'meeting-1' }));
    expect(screen.getByTestId('meeting-primary-action')).toHaveTextContent('Resume Recording');
    await waitFor(() => expect(screen.getByTestId('meeting-primary-action')).toBeEnabled());

    await user.click(screen.getByTestId('meeting-primary-action'));

    await waitFor(() =>
      expect(api.startMeeting).toHaveBeenCalledWith({
        title: 'Weekly sync',
        meetingId: 'meeting-1'
      })
    );
    expect(api.enhanceMeeting).not.toHaveBeenCalled();
    expect(screen.getByTestId('meeting-state-value')).toHaveTextContent('recording');
  });

  it('triggers enhancement from the Cmd/Ctrl+E shortcut when a meeting is stopped', async () => {
    render(<App />);

    await screen.findByTestId('meeting-bar');
    await act(async () => {
      stateListener?.({
        state: 'stopped',
        meetingId: 'meeting-1'
      });
    });

    await waitFor(() => expect(api.getMeeting).toHaveBeenCalledWith({ meetingId: 'meeting-1' }));

    fireEvent.keyDown(window, { key: 'e', ctrlKey: true });

    await waitFor(() => expect(api.enhanceMeeting).toHaveBeenCalledWith(AUTO_TEMPLATE_PAYLOAD));
  });

  it('ignores the Cmd/Ctrl+E shortcut while recording is in progress', async () => {
    api.getMeeting.mockResolvedValueOnce({
      id: 'meeting-1',
      title: 'Weekly sync',
      state: 'recording',
      createdAt: '2026-03-12T18:00:00.000Z',
      updatedAt: '2026-03-12T18:05:00.000Z',
      durationMs: null,
      noteContent: null,
      enhancedNoteContent: null,
      enhancedOutput: null,
      transcriptSegments: []
    });
    render(<App />);

    await screen.findByTestId('meeting-bar');
    await act(async () => {
      stateListener?.({
        state: 'recording',
        meetingId: 'meeting-1'
      });
    });

    fireEvent.keyDown(window, { key: 'e', metaKey: true });

    expect(api.enhanceMeeting).not.toHaveBeenCalled();
  });

  it('shows staged enhancement progress while enhancement is running', async () => {
    const user = userEvent.setup();
    api.enhanceMeeting.mockImplementation(
      () =>
        new Promise(() => {
          // Intentionally unresolved to keep the meeting in-progress for the UI assertion.
        })
    );

    render(<App />);

    await screen.findByTestId('meeting-bar');
    await act(async () => {
      stateListener?.({
        state: 'stopped',
        meetingId: 'meeting-1'
      });
    });

    await waitFor(() => expect(api.getMeeting).toHaveBeenCalledWith({ meetingId: 'meeting-1' }));
    await waitFor(() => expect(screen.getByTestId('generate-notes-button')).toBeEnabled());
    await user.click(screen.getByTestId('generate-notes-button'));

    await waitFor(() => expect(api.enhanceMeeting).toHaveBeenCalledWith(AUTO_TEMPLATE_PAYLOAD));
    await act(async () => {
      progressListener?.({
        meetingId: 'meeting-1',
        status: 'streaming',
        detail: 'Sending saved notes and transcript for enhancement...'
      });
    });

    expect(await screen.findByText('Sending saved notes and transcript for enhancement...')).toBeInTheDocument();
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
    await waitFor(() => expect(screen.getByTestId('meeting-primary-action')).toBeEnabled());

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

  it('lets the user toggle between enhanced output and original notes', async () => {
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

    await user.click(screen.getByTestId('notepad-view-original'));
    await waitFor(() => expect(screen.queryByText('AI expansion')).not.toBeInTheDocument());
    expect(screen.getByText('Follow up with design')).toBeInTheDocument();

    await user.click(screen.getByTestId('notepad-view-enhanced'));
    expect(await screen.findByText('AI expansion')).toBeInTheDocument();
  });

  it('moves the meeting into enhance_failed when enhancement rejects', async () => {
    const user = userEvent.setup();
    api.enhanceMeeting.mockRejectedValueOnce(new Error('Invalid OpenAI key.'));
    render(<App />);

    await screen.findByTestId('meeting-bar');
    await act(async () => {
      stateListener?.({
        state: 'stopped',
        meetingId: 'meeting-1'
      });
    });

    await waitFor(() => expect(api.getMeeting).toHaveBeenCalledWith({ meetingId: 'meeting-1' }));
    await waitFor(() => expect(screen.getByTestId('generate-notes-button')).toBeEnabled());
    await user.click(screen.getByTestId('generate-notes-button'));

    await waitFor(() => expect(api.enhanceMeeting).toHaveBeenCalledWith(AUTO_TEMPLATE_PAYLOAD));
    expect(screen.getByTestId('meeting-state-value')).toHaveTextContent('enhance_failed');
    expect(screen.getByText('Invalid OpenAI key.')).toBeInTheDocument();
  });

  it('retries enhancement from the failure banner action', async () => {
    const user = userEvent.setup();
    api.enhanceMeeting
      .mockRejectedValueOnce(new Error('Enhancement delayed.'))
      .mockResolvedValueOnce({
        meetingId: 'meeting-1',
        completedAt: '2026-03-12T18:22:00.000Z',
        output: {
          blocks: [{ source: 'ai', content: 'Recovered enhancement' }],
          actionItems: [],
          decisions: [],
          summary: 'Recovered'
        }
      });

    render(<App />);

    await screen.findByTestId('meeting-bar');
    await act(async () => {
      stateListener?.({
        state: 'stopped',
        meetingId: 'meeting-1'
      });
    });

    await waitFor(() => expect(api.getMeeting).toHaveBeenCalledWith({ meetingId: 'meeting-1' }));
    await waitFor(() => expect(screen.getByTestId('generate-notes-button')).toBeEnabled());
    await user.click(screen.getByTestId('generate-notes-button'));

    await waitFor(() => expect(api.enhanceMeeting).toHaveBeenCalledTimes(1));
    await act(async () => {
      errorListener?.({
        message: 'Enhancement delayed — retry when ready.',
        action: 'retry'
      });
    });

    expect(await screen.findByTestId('status-banner-action')).toHaveTextContent('Retry');
    await user.click(screen.getByTestId('status-banner-action'));

    await waitFor(() => expect(api.enhanceMeeting).toHaveBeenCalledTimes(2));
    expect(await screen.findByText('Recovered enhancement')).toBeInTheDocument();
    expect(screen.getByTestId('meeting-state-value')).toHaveTextContent('done');
  });

  it('uses the selected built-in template for enhancement and shows its badge after completion', async () => {
    const user = userEvent.setup();
    const standupTemplate = getBuiltInTemplateById('standup');
    if (!standupTemplate) {
      throw new Error('Expected standup template to exist.');
    }

    render(<App />);

    await screen.findByTestId('meeting-bar');
    await act(async () => {
      stateListener?.({
        state: 'stopped',
        meetingId: 'meeting-1'
      });
    });

    await waitFor(() => expect(api.getMeeting).toHaveBeenCalledWith({ meetingId: 'meeting-1' }));
    await user.selectOptions(screen.getByTestId('meeting-template-select'), 'standup');
    await user.click(screen.getByTestId('generate-notes-button'));

    await waitFor(() =>
      expect(api.enhanceMeeting).toHaveBeenCalledWith({
        meetingId: 'meeting-1',
        templateId: 'standup',
        templateInstructions: standupTemplate.instructions
      })
    );
    expect(await screen.findByTestId('notepad-template-badge')).toHaveTextContent('Team Standup');
  });

  it('initializes the enhancement picker from the saved default template', async () => {
    api.getSettings.mockResolvedValueOnce({
      firstRunAcknowledged: true,
      sttProvider: 'deepgram',
      llmProvider: 'openai',
      defaultTemplateId: 'tech-review',
      deepgramApiKeySet: true,
      openaiApiKeySet: false,
      anthropicApiKeySet: false
    });

    render(<App />);

    await screen.findByTestId('meeting-bar');
    await act(async () => {
      stateListener?.({
        state: 'stopped',
        meetingId: 'meeting-1'
      });
    });

    await waitFor(() =>
      expect(screen.getByTestId('meeting-template-select')).toHaveValue('tech-review')
    );
  });

  it('falls back to auto when settings contain the future custom template id', async () => {
    api.getSettings.mockResolvedValueOnce({
      firstRunAcknowledged: true,
      sttProvider: 'deepgram',
      llmProvider: 'openai',
      defaultTemplateId: 'custom',
      deepgramApiKeySet: true,
      openaiApiKeySet: false,
      anthropicApiKeySet: false
    });

    render(<App />);

    await screen.findByTestId('meeting-bar');
    await act(async () => {
      stateListener?.({
        state: 'stopped',
        meetingId: 'meeting-1'
      });
    });

    await waitFor(() => expect(screen.getByTestId('meeting-template-select')).toHaveValue('auto'));
  });

  it('shows the saved custom template in the picker and uses its instructions', async () => {
    const user = userEvent.setup();
    api.getSettings.mockResolvedValueOnce({
      firstRunAcknowledged: true,
      sttProvider: 'deepgram',
      llmProvider: 'openai',
      defaultTemplateId: 'custom',
      customTemplate: {
        name: 'Customer interview',
        instructions: 'Focus on pain points and requests.'
      },
      deepgramApiKeySet: true,
      openaiApiKeySet: false,
      anthropicApiKeySet: false
    });

    render(<App />);

    await screen.findByTestId('meeting-bar');
    await act(async () => {
      stateListener?.({
        state: 'stopped',
        meetingId: 'meeting-1'
      });
    });

    await waitFor(() => expect(screen.getByTestId('meeting-template-select')).toHaveValue('custom'));
    expect(screen.getByRole('option', { name: 'Custom: Customer interview' })).toBeInTheDocument();

    await user.click(screen.getByTestId('generate-notes-button'));

    await waitFor(() =>
      expect(api.enhanceMeeting).toHaveBeenCalledWith({
        meetingId: 'meeting-1',
        templateId: 'custom',
        templateInstructions: 'Focus on pain points and requests.'
      })
    );
  });

  it('opens settings when the picker edit option is selected', async () => {
    const user = userEvent.setup();
    render(<App />);

    await screen.findByTestId('meeting-bar');
    await act(async () => {
      stateListener?.({
        state: 'stopped',
        meetingId: 'meeting-1'
      });
    });

    await user.selectOptions(screen.getByTestId('meeting-template-select'), '__edit_templates__');

    expect(await screen.findByTestId('settings-page')).toBeInTheDocument();
  });

  it('confirms before re-enhancing when a persisted enhanced note was edited after enhancement', async () => {
    const user = userEvent.setup();
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    api.getMeeting.mockResolvedValueOnce({
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
            content: [{ type: 'text', text: 'Follow up with design' }]
          }
        ]
      },
      enhancedNoteContent: {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Edited enhanced note' }]
          }
        ]
      },
      enhancedOutput: {
        blocks: [{ source: 'ai', content: 'AI expansion' }],
        actionItems: [],
        decisions: [],
        summary: 'Quick summary'
      },
      lastTemplateId: 'standup',
      lastTemplateName: 'Team Standup',
      enhancedOutputCreatedAt: '2026-03-12T18:21:00.000Z',
      enhancedNoteUpdatedAt: '2026-03-12T18:25:00.000Z',
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
    expect(await screen.findByTestId('generate-notes-button')).toHaveTextContent('Re-enhance');
    await user.click(screen.getByTestId('generate-notes-button'));

    expect(confirmSpy).toHaveBeenCalledWith('Re-enhancing will replace your edited notes. Continue?');
    expect(api.enhanceMeeting).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });

  it('confirms before re-enhancing when the enhanced note was edited in the current session', async () => {
    const user = userEvent.setup();
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    api.getMeeting.mockResolvedValueOnce({
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
            content: [{ type: 'text', text: 'Follow up with design' }]
          }
        ]
      },
      enhancedNoteContent: null,
      enhancedOutput: {
        blocks: [{ source: 'ai', content: 'AI expansion' }],
        actionItems: [],
        decisions: [],
        summary: 'Quick summary'
      },
      lastTemplateId: 'auto',
      lastTemplateName: 'Auto',
      enhancedOutputCreatedAt: '2026-03-12T18:21:00.000Z',
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
    act(() => {
      useMeetingStore.getState().setEnhancedNoteContent({
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Edited enhanced note' }]
          }
        ]
      });
      useMeetingStore.getState().setNoteEditedAfterEnhancement(true);
    });

    await user.click(screen.getByTestId('generate-notes-button'));

    expect(confirmSpy).toHaveBeenCalled();
    expect(api.enhanceMeeting).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });

  it('re-enhances without confirmation when the enhanced note was not edited', async () => {
    const user = userEvent.setup();
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const techReviewTemplate = getBuiltInTemplateById('tech-review');
    if (!techReviewTemplate) {
      throw new Error('Expected tech-review template to exist.');
    }

    api.getMeeting.mockResolvedValueOnce({
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
            content: [{ type: 'text', text: 'Follow up with design' }]
          }
        ]
      },
      enhancedNoteContent: null,
      enhancedOutput: {
        blocks: [{ source: 'ai', content: 'AI expansion' }],
        actionItems: [],
        decisions: [],
        summary: 'Quick summary'
      },
      lastTemplateId: 'tech-review',
      lastTemplateName: 'Technical Design Review',
      enhancedOutputCreatedAt: '2026-03-12T18:21:00.000Z',
      enhancedNoteUpdatedAt: '2026-03-12T18:21:00.000Z',
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
    expect(screen.getByTestId('meeting-template-select')).toHaveValue('tech-review');
    await user.click(screen.getByTestId('generate-notes-button'));

    await waitFor(() =>
      expect(api.enhanceMeeting).toHaveBeenCalledWith({
        meetingId: 'meeting-1',
        templateId: 'tech-review',
        templateInstructions: techReviewTemplate.instructions
      })
    );
    expect(confirmSpy).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });

  it('keeps the notepad editable after enhancement failure and lets the user dismiss back to stopped', async () => {
    const user = userEvent.setup();
    api.getMeeting.mockResolvedValueOnce({
      id: 'meeting-1',
      title: 'Weekly sync',
      state: 'enhance_failed',
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
      transcriptSegments: []
    });
    render(<App />);

    await screen.findByTestId('meeting-bar');
    await act(async () => {
      stateListener?.({
        state: 'enhance_failed',
        meetingId: 'meeting-1'
      });
    });

    await waitFor(() => expect(api.getMeeting).toHaveBeenCalledWith({ meetingId: 'meeting-1' }));
    expect(screen.getByTestId('notepad-editor-input')).toHaveAttribute('contenteditable', 'true');

    await user.click(screen.getByTestId('meeting-secondary-action'));

    await waitFor(() =>
      expect(api.dismissEnhancementFailure).toHaveBeenCalledWith({
        meetingId: 'meeting-1'
      })
    );
    expect(screen.getByTestId('meeting-state-value')).toHaveTextContent('stopped');
  });

  it('offers an open-settings recovery action for invalid-key failures', async () => {
    const user = userEvent.setup();
    render(<App />);

    await screen.findByTestId('meeting-bar');

    await act(async () => {
      errorListener?.({
        message: 'Invalid OpenAI key.',
        action: 'open-settings'
      });
    });

    expect(await screen.findByTestId('status-banner-action')).toHaveTextContent('Open Settings');
    await user.click(screen.getByTestId('status-banner-action'));

    expect(await screen.findByTestId('settings-page')).toBeInTheDocument();
    expect(screen.getByTestId('settings-panel')).toBeInTheDocument();
  });

  it('autosaves edited enhanced content separately from raw notes', async () => {
    api.getMeeting.mockResolvedValueOnce({
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

    render(<App />);

    await screen.findByTestId('meeting-bar');
    await act(async () => {
      stateListener?.({
        state: 'done',
        meetingId: 'meeting-1'
      });
    });

    await waitFor(() => expect(api.getMeeting).toHaveBeenCalledWith({ meetingId: 'meeting-1' }));
    vi.useFakeTimers();
    act(() => {
      useMeetingStore.getState().setEnhancedNoteContent({
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
      });
    });

    await act(async () => {
      // Allow the autosave effect to observe the dirty enhanced document before the timer advances.
    });

    act(() => {
      vi.advanceTimersByTime(AUTOSAVE_DELAY_MS + 1);
    });

    expect(api.saveEnhancedNote).toHaveBeenCalledTimes(1);
    expect(api.saveNotes).not.toHaveBeenCalled();
    expect(JSON.stringify(api.saveEnhancedNote.mock.calls[0]?.[0]?.content)).toContain(
      'Edited enhanced note'
    );
    expect(JSON.stringify(api.saveEnhancedNote.mock.calls[0]?.[0]?.content)).not.toContain(
      '"authorship"'
    );
  });

  it('offers a new meeting action from done state and clears the completed meeting view', async () => {
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
    render(<App />);

    await screen.findByTestId('meeting-bar');
    await act(async () => {
      stateListener?.({
        state: 'done',
        meetingId: 'meeting-1'
      });
    });

    expect(await screen.findByText('AI expansion')).toBeInTheDocument();
    await user.click(screen.getByTestId('meeting-secondary-action'));

    await waitFor(() => expect(api.resetMeeting).toHaveBeenCalledTimes(1));
    expect(screen.getByTestId('meeting-state-value')).toHaveTextContent('idle');
    expect(screen.getByTestId('meeting-title-input')).toHaveValue('');
    await waitFor(() => expect(screen.queryByText('AI expansion')).not.toBeInTheDocument());
    expect(screen.getByTestId('meeting-primary-action')).toHaveTextContent('Start Recording');
  });

  it('disables the meeting action while stop is in flight to avoid duplicate stop requests', async () => {
    const user = userEvent.setup();
    let resolveStop: (() => void) | null = null;
    api.getMeeting.mockResolvedValue({
      id: 'meeting-1',
      title: 'Weekly sync',
      state: 'recording',
      createdAt: '2026-03-12T18:00:00.000Z',
      updatedAt: '2026-03-12T18:05:00.000Z',
      durationMs: null,
      noteContent: null,
      enhancedNoteContent: null,
      enhancedOutput: null,
      transcriptSegments: []
    });
    api.stopMeeting.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveStop = resolve;
        })
    );

    render(<App />);
    await screen.findByTestId('meeting-bar');

    await act(async () => {
      stateListener?.({
        state: 'recording',
        meetingId: 'meeting-1'
      });
    });

    await waitFor(() => expect(api.getMeeting).toHaveBeenCalledWith({ meetingId: 'meeting-1' }));

    const button = screen.getByTestId('meeting-primary-action');
    await user.click(button);

    expect(api.stopMeeting).toHaveBeenCalledTimes(1);
    expect(button).toBeDisabled();

    await user.click(button);
    expect(api.stopMeeting).toHaveBeenCalledTimes(1);

    resolveStop?.();
    await waitFor(() => expect(button).not.toBeDisabled());
  });
});
