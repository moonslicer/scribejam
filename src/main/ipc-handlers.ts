import type { BrowserWindow, IpcMainInvokeEvent } from 'electron';
import { ipcMain } from 'electron';
import {
  IPC_CHANNELS,
  isEnhanceMeetingRequest,
  isMeetingGetRequest,
  isNotesSaveRequest,
  isSettingsSaveRequest,
  isSettingsValidateKeyRequest,
  type EnhanceMeetingRequest,
  type ErrorDisplayEvent,
  type MeetingGetRequest,
  type MeetingStartRequest,
  type MeetingStateChangedEvent,
  type NotesSaveRequest,
  type SettingsSaveRequest,
  type SettingsValidateKeyRequest
} from '../shared/ipc';
import { AudioManager } from './audio/audio-manager';
import { EnhancementProviderError, isRetryableEnhancementError } from './enhancement/llm-client';
import { MeetingStateMachine } from './meeting/state-machine';
import { SettingsStore } from './settings/settings-store';
import { createSttAdapter } from './stt/create-stt-adapter';
import { EnhancementOrchestrator } from './enhancement/enhancement-orchestrator';
import { createLlmClient } from './enhancement/create-llm-client';
import { validateOpenAIApiKey } from './enhancement/openai-enhancement-client';
import { createStorageDatabase } from './storage/db';
import { MeetingRecordsService } from './storage/meeting-records-service';
import {
  EnhancedOutputsRepository,
  MeetingArtifactsRepository,
  MeetingsRepository,
  NotesRepository,
  TranscriptRepository
} from './storage/repositories';
import { TranscriptionService } from './transcription/transcription-service';

interface HandlerContext {
  window: BrowserWindow;
}

interface MainServices {
  stateMachine: MeetingStateMachine;
  settingsStore: SettingsStore;
  audioManager: AudioManager;
  transcriptionService: TranscriptionService;
  meetingRecordsService: MeetingRecordsService;
  notesRepository: NotesRepository;
  enhancementOrchestrator: EnhancementOrchestrator;
}

export function createMainServices(context: HandlerContext): MainServices {
  const emitError = (event: ErrorDisplayEvent): void => {
    context.window.webContents.send(IPC_CHANNELS.errorDisplay, event);
  };
  const settingsStore = new SettingsStore();
  const storageDb = createStorageDatabase();
  const meetingsRepository = new MeetingsRepository(storageDb);
  const transcriptRepository = new TranscriptRepository(storageDb);
  const notesRepository = new NotesRepository(storageDb);
  const meetingArtifactsRepository = new MeetingArtifactsRepository(storageDb);
  const enhancedOutputsRepository = new EnhancedOutputsRepository(storageDb);
  const stateMachine = new MeetingStateMachine();
  const sttAdapter = createSttAdapter({
    getDeepgramApiKey: () => settingsStore.getSecret('deepgramApiKey')
  });
  let transcriptionService!: TranscriptionService;
  const meetingRecordsService = new MeetingRecordsService(
    meetingsRepository,
    meetingArtifactsRepository,
    transcriptRepository
  );
  const enhancementOrchestrator = new EnhancementOrchestrator(
    stateMachine,
    meetingRecordsService,
    meetingArtifactsRepository,
    enhancedOutputsRepository,
    () =>
      createLlmClient({
        provider: settingsStore.getSettings().llmProvider,
        getOpenAIApiKey: () => settingsStore.getSecret('openaiApiKey')
      })
  );

  const audioManager = new AudioManager({
    onAudioLevel: (event) => {
      context.window.webContents.send(IPC_CHANNELS.audioLevel, event);
    },
    onErrorDisplay: emitError,
    onSourceFrame: (frame) => {
      transcriptionService.ingestSourceFrame(frame);
    }
  }, 16_000, 20, undefined, () => settingsStore.getSettings().captureSource);

  transcriptionService = new TranscriptionService({
    sttAdapter,
    events: {
      onTranscript: (event) => {
        meetingRecordsService.appendTranscriptSegment(stateMachine.getSnapshot().meetingId, event);
        context.window.webContents.send(IPC_CHANNELS.transcriptUpdate, event);
      },
      onStatus: (event) => {
        context.window.webContents.send(IPC_CHANNELS.transcriptionStatus, event);
      },
      onErrorDisplay: emitError
    }
  });

  return {
    stateMachine,
    settingsStore,
    audioManager,
    transcriptionService,
    meetingRecordsService,
    notesRepository,
    enhancementOrchestrator
  };
}

export function registerIpcHandlers(context: HandlerContext, services: MainServices): void {
  ipcMain.removeHandler(IPC_CHANNELS.meetingStart);
  ipcMain.removeHandler(IPC_CHANNELS.meetingStop);
  ipcMain.removeHandler(IPC_CHANNELS.meetingReset);
  ipcMain.removeHandler(IPC_CHANNELS.meetingGet);
  ipcMain.removeHandler(IPC_CHANNELS.meetingEnhance);
  ipcMain.removeHandler(IPC_CHANNELS.settingsGet);
  ipcMain.removeHandler(IPC_CHANNELS.settingsSave);
  ipcMain.removeHandler(IPC_CHANNELS.settingsValidateKey);
  ipcMain.removeHandler(IPC_CHANNELS.testSimulateSttDisconnect);
  ipcMain.removeAllListeners(IPC_CHANNELS.audioMicFrames);
  ipcMain.removeAllListeners(IPC_CHANNELS.notesSave);

  ipcMain.handle(IPC_CHANNELS.meetingStart, async (_event, payload: unknown) => {
    const validated = parseMeetingStart(payload);
    const snapshot =
      validated.meetingId !== undefined
        ? services.stateMachine.resume(validated.meetingId)
        : services.stateMachine.start(validated.title);
    if (!snapshot.meetingId) {
      throw new Error('Failed to create meeting id.');
    }
    await services.audioManager.startRecording();
    const currentSettings = services.settingsStore.getSettings();
    if (currentSettings.firstRunAcknowledged && currentSettings.deepgramApiKeySet) {
      await services.transcriptionService.start();
    } else {
      context.window.webContents.send(IPC_CHANNELS.transcriptionStatus, {
        status: 'paused',
        detail: 'Transcription paused — complete first-run setup.'
      });
      context.window.webContents.send(IPC_CHANNELS.errorDisplay, {
        message: 'Transcription is paused until first-run setup is complete.',
        action: 'open-settings'
      });
    }
    if (validated.meetingId !== undefined) {
      services.meetingRecordsService.recordMeetingResumed(snapshot);
    } else {
      services.meetingRecordsService.recordMeetingStarted(snapshot);
    }
    emitMeetingState(context.window, {
      state: snapshot.state,
      meetingId: snapshot.meetingId
    });

    return {
      meetingId: snapshot.meetingId,
      title: snapshot.title ?? validated.title
    };
  });

  ipcMain.handle(IPC_CHANNELS.meetingStop, async (_event, payload: unknown) => {
    const meetingId = parseMeetingStop(payload);
    const snapshot = services.stateMachine.stop(meetingId);
    await services.audioManager.stopRecording();
    await services.transcriptionService.stop();
    services.meetingRecordsService.recordMeetingStopped(snapshot);

    emitMeetingState(
      context.window,
      snapshot.meetingId
        ? {
            state: snapshot.state,
            meetingId: snapshot.meetingId
          }
        : {
            state: snapshot.state
          }
    );
  });

  ipcMain.handle(IPC_CHANNELS.meetingReset, async () => {
    const snapshot = services.stateMachine.resetToIdle();
    context.window.webContents.send(IPC_CHANNELS.transcriptionStatus, { status: 'idle' });
    emitMeetingState(context.window, { state: snapshot.state });

    return { state: snapshot.state };
  });

  ipcMain.handle(IPC_CHANNELS.meetingGet, async (_event, payload: unknown) => {
    if (!isMeetingGetRequest(payload)) {
      throw new Error('Invalid meeting get payload.');
    }

    return services.meetingRecordsService.getMeeting((payload as MeetingGetRequest).meetingId);
  });

  ipcMain.handle(IPC_CHANNELS.meetingEnhance, async (_event, payload: unknown) => {
    if (!isEnhanceMeetingRequest(payload)) {
      throw new Error('Invalid meeting enhancement payload.');
    }

    const meetingId = (payload as EnhanceMeetingRequest).meetingId;

    try {
      const response = await services.enhancementOrchestrator.enhanceMeeting(meetingId);
      emitMeetingState(context.window, {
        state: services.stateMachine.getSnapshot().state,
        meetingId
      });
      return response;
    } catch (error) {
      const snapshot = services.stateMachine.getSnapshot();
      if (snapshot.state === 'enhance_failed' && snapshot.meetingId === meetingId) {
        emitMeetingState(context.window, {
          state: snapshot.state,
          meetingId
        });
      }
      emitEnhancementError(context.window, error);
      throw error;
    }
  });

  ipcMain.handle(IPC_CHANNELS.settingsGet, async () => {
    return services.settingsStore.getSettings();
  });

  ipcMain.handle(
    IPC_CHANNELS.settingsSave,
    async (_event: IpcMainInvokeEvent, payload: unknown) => {
      if (!isSettingsSaveRequest(payload)) {
        throw new Error('Invalid settings payload.');
      }
      services.settingsStore.saveSettings(payload as SettingsSaveRequest);
    }
  );

  ipcMain.handle(IPC_CHANNELS.settingsValidateKey, async (_event, payload: unknown) => {
    if (!isSettingsValidateKeyRequest(payload)) {
      throw new Error('Invalid key validation payload.');
    }

    const request = payload as SettingsValidateKeyRequest;
    if (request.provider === 'deepgram') {
      return services.transcriptionService.validateDeepgramKey(request.key);
    }

    if (request.provider === 'openai') {
      return validateOpenAIApiKey(request.key);
    }

    return {
      valid: false,
      error: 'Unsupported provider.'
    };
  });

  ipcMain.handle(IPC_CHANNELS.testSimulateSttDisconnect, async () => {
    if (process.env.SCRIBEJAM_TEST_MODE !== '1') {
      throw new Error('Test hook unavailable.');
    }
    services.transcriptionService.simulateDisconnect();
  });

  ipcMain.on(IPC_CHANNELS.audioMicFrames, (_event, payload: unknown) => {
    services.audioManager.ingestMicPayload(payload);
  });

  ipcMain.on(IPC_CHANNELS.notesSave, (_event, payload: unknown) => {
    if (!isNotesSaveRequest(payload)) {
      throw new Error('Invalid notes save payload.');
    }

    const request = payload as NotesSaveRequest;
    const now = new Date().toISOString();
    services.notesRepository.save({
      id: `${request.meetingId}-note`,
      meetingId: request.meetingId,
      content: JSON.stringify(request.content),
      updatedAt: now
    });
  });

  emitMeetingState(context.window, { state: services.stateMachine.getSnapshot().state });
  context.window.webContents.send(IPC_CHANNELS.transcriptionStatus, { status: 'idle' });
}

function emitMeetingState(window: BrowserWindow, event: MeetingStateChangedEvent): void {
  window.webContents.send(IPC_CHANNELS.meetingStateChanged, event);
}

function emitEnhancementError(window: BrowserWindow, error: unknown): void {
  if (!(error instanceof EnhancementProviderError)) {
    window.webContents.send(IPC_CHANNELS.errorDisplay, {
      message: error instanceof Error ? error.message : 'Enhancement failed.'
    });
    return;
  }

  window.webContents.send(IPC_CHANNELS.errorDisplay, {
    message: error.message,
    ...(error.code === 'invalid_api_key'
      ? { action: 'open-settings' as const }
      : isRetryableEnhancementError(error)
        ? { action: 'retry' as const }
        : {})
  });
}

function parseMeetingStart(payload: unknown): MeetingStartRequest {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Invalid meeting start payload.');
  }
  const candidate = payload as Partial<MeetingStartRequest>;
  if (typeof candidate.title !== 'string') {
    throw new Error('Meeting title is required.');
  }
  if (candidate.meetingId !== undefined && (typeof candidate.meetingId !== 'string' || candidate.meetingId.length === 0)) {
    throw new Error('Meeting id must be a non-empty string when provided.');
  }
  return {
    title: candidate.title,
    ...(candidate.meetingId !== undefined ? { meetingId: candidate.meetingId } : {})
  };
}

function parseMeetingStop(payload: unknown): string {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Invalid meeting stop payload.');
  }
  const candidate = payload as { meetingId?: unknown };
  if (typeof candidate.meetingId !== 'string' || candidate.meetingId.length === 0) {
    throw new Error('Meeting id is required.');
  }
  return candidate.meetingId;
}
