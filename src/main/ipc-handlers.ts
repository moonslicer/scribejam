import type { BrowserWindow, IpcMainInvokeEvent } from 'electron';
import { ipcMain } from 'electron';
import {
  IPC_CHANNELS,
  isMeetingGetRequest,
  isNotesSaveRequest,
  isSettingsSaveRequest,
  isSettingsValidateKeyRequest,
  type ErrorDisplayEvent,
  type MeetingGetRequest,
  type MeetingStartRequest,
  type MeetingStateChangedEvent,
  type NotesSaveRequest,
  type SettingsSaveRequest,
  type SettingsValidateKeyRequest
} from '../shared/ipc';
import { AudioManager } from './audio/audio-manager';
import { MeetingStateMachine } from './meeting/state-machine';
import { SettingsStore } from './settings/settings-store';
import { createSttAdapter } from './stt/create-stt-adapter';
import { createStorageDatabase } from './storage/db';
import { MeetingRecordsService } from './storage/meeting-records-service';
import {
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

  const audioManager = new AudioManager({
    onAudioLevel: (event) => {
      context.window.webContents.send(IPC_CHANNELS.audioLevel, event);
    },
    onErrorDisplay: emitError,
    onSourceFrame: (frame) => {
      transcriptionService.ingestSourceFrame(frame);
    }
  });

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
    notesRepository
  };
}

export function registerIpcHandlers(context: HandlerContext, services: MainServices): void {
  ipcMain.removeHandler(IPC_CHANNELS.meetingStart);
  ipcMain.removeHandler(IPC_CHANNELS.meetingStop);
  ipcMain.removeHandler(IPC_CHANNELS.meetingGet);
  ipcMain.removeHandler(IPC_CHANNELS.settingsGet);
  ipcMain.removeHandler(IPC_CHANNELS.settingsSave);
  ipcMain.removeHandler(IPC_CHANNELS.settingsValidateKey);
  ipcMain.removeHandler(IPC_CHANNELS.testSimulateSttDisconnect);
  ipcMain.removeAllListeners(IPC_CHANNELS.audioMicFrames);
  ipcMain.removeAllListeners(IPC_CHANNELS.notesSave);

  ipcMain.handle(IPC_CHANNELS.meetingStart, async (_event, payload: unknown) => {
    const validated = parseMeetingStart(payload);
    const snapshot = services.stateMachine.start(validated.title);
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
    services.meetingRecordsService.recordMeetingStarted(snapshot);
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

  ipcMain.handle(IPC_CHANNELS.meetingGet, async (_event, payload: unknown) => {
    if (!isMeetingGetRequest(payload)) {
      throw new Error('Invalid meeting get payload.');
    }

    return services.meetingRecordsService.getMeeting((payload as MeetingGetRequest).meetingId);
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
    if (request.provider !== 'deepgram') {
      return {
        valid: false,
        error: 'Unsupported STT provider.'
      };
    }

    return services.transcriptionService.validateDeepgramKey(request.key);
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

function parseMeetingStart(payload: unknown): MeetingStartRequest {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Invalid meeting start payload.');
  }
  const candidate = payload as Partial<MeetingStartRequest>;
  if (typeof candidate.title !== 'string') {
    throw new Error('Meeting title is required.');
  }
  return { title: candidate.title };
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
