import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MeetingHistoryItem } from '../../src/shared/ipc';
import { IPC_CHANNELS } from '../../src/shared/ipc';

const electronMocks = vi.hoisted(() => ({
  handle: vi.fn(),
  on: vi.fn(),
  removeAllListeners: vi.fn(),
  removeHandler: vi.fn()
}));

vi.mock('electron', () => ({
  ipcMain: {
    handle: electronMocks.handle,
    on: electronMocks.on,
    removeAllListeners: electronMocks.removeAllListeners,
    removeHandler: electronMocks.removeHandler
  }
}));

import { registerIpcHandlers } from '../../src/main/ipc-handlers';

describe('registerIpcHandlers', () => {
  const handlers = new Map<string, (event: unknown, payload: unknown) => Promise<unknown>>();

  beforeEach(() => {
    handlers.clear();
    electronMocks.handle.mockReset();
    electronMocks.on.mockReset();
    electronMocks.removeAllListeners.mockReset();
    electronMocks.removeHandler.mockReset();
    electronMocks.handle.mockImplementation((channel, handler) => {
      handlers.set(channel, handler);
    });
  });

  it('registers meeting:list and returns typed history items', async () => {
    const historyItems: MeetingHistoryItem[] = [
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
    ];
    const listMeetingHistory = vi.fn(() => historyItems);
    const send = vi.fn();

    registerIpcHandlers(
      {
        window: {
          webContents: {
            send
          }
        } as never
      },
      {
        stateMachine: {
          getSnapshot: () => ({ state: 'idle' })
        },
        settingsStore: {
          getSettings: vi.fn(),
          saveSettings: vi.fn()
        },
        audioManager: {
          ingestMicPayload: vi.fn()
        },
        transcriptionService: {
          validateDeepgramKey: vi.fn()
        },
        meetingRecordsService: {
          getMeeting: vi.fn(),
          listMeetingHistory
        },
        notesRepository: {
          save: vi.fn()
        },
        enhancedNoteDocumentsRepository: {
          save: vi.fn()
        },
        enhancementOrchestrator: {
          enhanceMeeting: vi.fn()
        }
      } as never
    );

    const handler = handlers.get(IPC_CHANNELS.meetingList);

    expect(handler).toBeTypeOf('function');
    await expect(handler?.({} as never, { query: 'roadmap' })).resolves.toEqual({
      items: historyItems
    });
    expect(listMeetingHistory).toHaveBeenCalledWith('roadmap');
    expect(send).toHaveBeenCalledWith(IPC_CHANNELS.transcriptionStatus, { status: 'idle' });
  });

  it('rejects invalid meeting:list payloads', async () => {
    registerIpcHandlers(
      {
        window: {
          webContents: {
            send: vi.fn()
          }
        } as never
      },
      {
        stateMachine: {
          getSnapshot: () => ({ state: 'idle' })
        },
        settingsStore: {
          getSettings: vi.fn(),
          saveSettings: vi.fn()
        },
        audioManager: {
          ingestMicPayload: vi.fn()
        },
        transcriptionService: {
          validateDeepgramKey: vi.fn()
        },
        meetingRecordsService: {
          getMeeting: vi.fn(),
          listMeetingHistory: vi.fn()
        },
        notesRepository: {
          save: vi.fn()
        },
        enhancedNoteDocumentsRepository: {
          save: vi.fn()
        },
        enhancementOrchestrator: {
          enhanceMeeting: vi.fn()
        }
      } as never
    );

    const handler = handlers.get(IPC_CHANNELS.meetingList);

    await expect(handler?.({} as never, { query: 123 })).rejects.toThrow(
      'Invalid meeting list payload.'
    );
  });

  it('hydrates a saved done meeting before resuming it', async () => {
    const send = vi.fn();
    const getSnapshot = vi.fn(() => ({ state: 'idle' }));
    const primeForResume = vi.fn();
    const resume = vi.fn(() => ({
      state: 'recording',
      meetingId: 'meeting-1',
      title: 'Weekly sync',
      startedAt: Date.now()
    }));
    const getMeeting = vi.fn(() => ({
      id: 'meeting-1',
      title: 'Weekly sync',
      state: 'done',
      createdAt: '2026-03-12T18:00:00.000Z',
      updatedAt: '2026-03-12T18:15:00.000Z',
      durationMs: 900000,
      noteContent: null,
      enhancedNoteContent: null,
      enhancedOutput: null,
      transcriptSegments: []
    }));
    const startRecording = vi.fn().mockResolvedValue(undefined);
    const startTranscription = vi.fn().mockResolvedValue(undefined);
    const recordMeetingResumed = vi.fn();

    registerIpcHandlers(
      {
        window: {
          webContents: {
            send
          }
        } as never
      },
      {
        stateMachine: {
          getSnapshot,
          primeForResume,
          resume
        },
        settingsStore: {
          getSettings: vi.fn(() => ({
            firstRunAcknowledged: true,
            deepgramApiKeySet: true
          })),
          saveSettings: vi.fn()
        },
        audioManager: {
          ingestMicPayload: vi.fn(),
          startRecording
        },
        transcriptionService: {
          start: startTranscription,
          validateDeepgramKey: vi.fn()
        },
        meetingRecordsService: {
          getMeeting,
          listMeetingHistory: vi.fn(),
          recordMeetingResumed
        },
        notesRepository: {
          save: vi.fn()
        },
        enhancedNoteDocumentsRepository: {
          save: vi.fn()
        },
        enhancementOrchestrator: {
          enhanceMeeting: vi.fn()
        }
      } as never
    );

    const handler = handlers.get(IPC_CHANNELS.meetingStart);

    await expect(
      handler?.({} as never, {
        title: 'Weekly sync',
        meetingId: 'meeting-1'
      })
    ).resolves.toEqual({
      meetingId: 'meeting-1',
      title: 'Weekly sync'
    });

    expect(getMeeting).toHaveBeenCalledWith('meeting-1');
    expect(primeForResume).toHaveBeenCalledWith({
      meetingId: 'meeting-1',
      title: 'Weekly sync',
      state: 'done'
    });
    expect(resume).toHaveBeenCalledWith('meeting-1');
    expect(startRecording).toHaveBeenCalledTimes(1);
    expect(startTranscription).toHaveBeenCalledTimes(1);
    expect(recordMeetingResumed).toHaveBeenCalledWith(
      expect.objectContaining({
        state: 'recording',
        meetingId: 'meeting-1'
      })
    );
  });

  it('treats a stale persisted recording as stopped before resuming it', async () => {
    const send = vi.fn();
    const getSnapshot = vi.fn(() => ({ state: 'idle' }));
    const primeForResume = vi.fn();
    const resume = vi.fn(() => ({
      state: 'recording',
      meetingId: 'meeting-2',
      title: 'Customer call',
      startedAt: Date.now()
    }));
    const getMeeting = vi.fn(() => ({
      id: 'meeting-2',
      title: 'Customer call',
      state: 'recording',
      createdAt: '2026-03-12T18:00:00.000Z',
      updatedAt: '2026-03-12T18:15:00.000Z',
      durationMs: 900000,
      noteContent: null,
      enhancedNoteContent: null,
      enhancedOutput: null,
      transcriptSegments: []
    }));
    const startRecording = vi.fn().mockResolvedValue(undefined);
    const startTranscription = vi.fn().mockResolvedValue(undefined);
    const recordMeetingResumed = vi.fn();

    registerIpcHandlers(
      {
        window: {
          webContents: {
            send
          }
        } as never
      },
      {
        stateMachine: {
          getSnapshot,
          primeForResume,
          resume
        },
        settingsStore: {
          getSettings: vi.fn(() => ({
            firstRunAcknowledged: true,
            deepgramApiKeySet: true
          })),
          saveSettings: vi.fn()
        },
        audioManager: {
          ingestMicPayload: vi.fn(),
          startRecording
        },
        transcriptionService: {
          start: startTranscription,
          validateDeepgramKey: vi.fn()
        },
        meetingRecordsService: {
          getMeeting,
          listMeetingHistory: vi.fn(),
          recordMeetingResumed
        },
        notesRepository: {
          save: vi.fn()
        },
        enhancedNoteDocumentsRepository: {
          save: vi.fn()
        },
        enhancementOrchestrator: {
          enhanceMeeting: vi.fn()
        }
      } as never
    );

    const handler = handlers.get(IPC_CHANNELS.meetingStart);

    await expect(
      handler?.({} as never, {
        title: 'Customer call',
        meetingId: 'meeting-2'
      })
    ).resolves.toEqual({
      meetingId: 'meeting-2',
      title: 'Customer call'
    });

    expect(getMeeting).toHaveBeenCalledWith('meeting-2');
    expect(primeForResume).toHaveBeenCalledWith({
      meetingId: 'meeting-2',
      title: 'Customer call',
      state: 'stopped'
    });
    expect(resume).toHaveBeenCalledWith('meeting-2');
    expect(startRecording).toHaveBeenCalledTimes(1);
    expect(startTranscription).toHaveBeenCalledTimes(1);
    expect(recordMeetingResumed).toHaveBeenCalledWith(
      expect.objectContaining({
        state: 'recording',
        meetingId: 'meeting-2'
      })
    );
  });

  it('persists stopped state before cleanup so stop still succeeds when teardown fails', async () => {
    const send = vi.fn();
    const stop = vi.fn(() => ({
      state: 'stopped',
      meetingId: 'meeting-3',
      title: 'Design review',
      startedAt: Date.now() - 5_000,
      stoppedAt: Date.now()
    }));
    const recordMeetingStopped = vi.fn();
    const stopRecording = vi.fn().mockRejectedValue(new Error('system stop failed'));
    const stopTranscription = vi.fn().mockResolvedValue(undefined);

    registerIpcHandlers(
      {
        window: {
          webContents: {
            send
          }
        } as never
      },
      {
        stateMachine: {
          getSnapshot: () => ({ state: 'recording', meetingId: 'meeting-3' }),
          stop
        },
        settingsStore: {
          getSettings: vi.fn(),
          saveSettings: vi.fn()
        },
        audioManager: {
          ingestMicPayload: vi.fn(),
          stopRecording
        },
        transcriptionService: {
          stop: stopTranscription,
          validateDeepgramKey: vi.fn()
        },
        meetingRecordsService: {
          getMeeting: vi.fn(),
          listMeetingHistory: vi.fn(),
          recordMeetingStopped
        },
        notesRepository: {
          save: vi.fn()
        },
        enhancedNoteDocumentsRepository: {
          save: vi.fn()
        },
        enhancementOrchestrator: {
          enhanceMeeting: vi.fn()
        }
      } as never
    );

    const handler = handlers.get(IPC_CHANNELS.meetingStop);

    await expect(handler?.({} as never, { meetingId: 'meeting-3' })).resolves.toBeUndefined();

    expect(stop).toHaveBeenCalledWith('meeting-3');
    expect(recordMeetingStopped).toHaveBeenCalledWith(
      expect.objectContaining({
        state: 'stopped',
        meetingId: 'meeting-3'
      })
    );
    expect(send).toHaveBeenCalledWith(IPC_CHANNELS.meetingStateChanged, {
      state: 'stopped',
      meetingId: 'meeting-3'
    });
    expect(send).toHaveBeenCalledWith(IPC_CHANNELS.errorDisplay, {
      message: 'Meeting stopped, but cleanup hit an issue: audio capture: system stop failed'
    });
  });

  it('treats meeting:reset as a safe no-op when the main state machine is already idle', async () => {
    const send = vi.fn();
    const resetToIdle = vi.fn(() => ({ state: 'idle' }));

    registerIpcHandlers(
      {
        window: {
          webContents: {
            send
          }
        } as never
      },
      {
        stateMachine: {
          getSnapshot: () => ({ state: 'idle' }),
          resetToIdle
        },
        settingsStore: {
          getSettings: vi.fn(),
          saveSettings: vi.fn()
        },
        audioManager: {
          ingestMicPayload: vi.fn()
        },
        transcriptionService: {
          validateDeepgramKey: vi.fn()
        },
        meetingRecordsService: {
          getMeeting: vi.fn(),
          listMeetingHistory: vi.fn()
        },
        notesRepository: {
          save: vi.fn()
        },
        enhancedNoteDocumentsRepository: {
          save: vi.fn()
        },
        enhancementOrchestrator: {
          enhanceMeeting: vi.fn()
        }
      } as never
    );

    const handler = handlers.get(IPC_CHANNELS.meetingReset);

    await expect(handler?.({} as never, undefined)).resolves.toEqual({ state: 'idle' });
    expect(resetToIdle).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith(IPC_CHANNELS.transcriptionStatus, { status: 'idle' });
    expect(send).toHaveBeenCalledWith(IPC_CHANNELS.meetingStateChanged, { state: 'idle' });
  });

  it('hydrates a saved failed enhancement before dismissing it for continued editing', async () => {
    const send = vi.fn();
    const getSnapshot = vi
      .fn()
      .mockReturnValueOnce({ state: 'idle' })
      .mockReturnValueOnce({ state: 'idle' });
    const primeForResume = vi.fn();
    const dismissEnhancementFailure = vi.fn(() => ({
      state: 'stopped',
      meetingId: 'meeting-1',
      title: 'Weekly sync'
    }));
    const recordMeetingEnhancementDismissed = vi.fn();
    const getMeeting = vi.fn(() => ({
      id: 'meeting-1',
      title: 'Weekly sync',
      state: 'enhance_failed',
      createdAt: '2026-03-12T18:00:00.000Z',
      updatedAt: '2026-03-12T18:15:00.000Z',
      durationMs: 900000,
      noteContent: null,
      enhancedNoteContent: null,
      enhancedOutput: null,
      transcriptSegments: []
    }));

    registerIpcHandlers(
      {
        window: {
          webContents: {
            send
          }
        } as never
      },
      {
        stateMachine: {
          getSnapshot,
          primeForResume,
          dismissEnhancementFailure
        },
        settingsStore: {
          getSettings: vi.fn(),
          saveSettings: vi.fn()
        },
        audioManager: {
          ingestMicPayload: vi.fn()
        },
        transcriptionService: {
          validateDeepgramKey: vi.fn()
        },
        meetingRecordsService: {
          getMeeting,
          listMeetingHistory: vi.fn(),
          recordMeetingEnhancementDismissed
        },
        notesRepository: {
          save: vi.fn()
        },
        enhancedNoteDocumentsRepository: {
          save: vi.fn()
        },
        enhancementOrchestrator: {
          enhanceMeeting: vi.fn()
        }
      } as never
    );

    const handler = handlers.get(IPC_CHANNELS.meetingDismissEnhancementFailure);

    await expect(handler?.({} as never, { meetingId: 'meeting-1' })).resolves.toEqual({
      meetingId: 'meeting-1',
      state: 'stopped'
    });
    expect(getMeeting).toHaveBeenCalledWith('meeting-1');
    expect(primeForResume).toHaveBeenCalledWith({
      meetingId: 'meeting-1',
      title: 'Weekly sync',
      state: 'enhance_failed'
    });
    expect(dismissEnhancementFailure).toHaveBeenCalledWith('meeting-1');
    expect(recordMeetingEnhancementDismissed).toHaveBeenCalledWith(
      expect.objectContaining({
        state: 'stopped',
        meetingId: 'meeting-1'
      })
    );
    expect(send).toHaveBeenCalledWith(IPC_CHANNELS.meetingStateChanged, {
      state: 'stopped',
      meetingId: 'meeting-1'
    });
  });
});
