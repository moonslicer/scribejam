import type { BrowserWindow, IpcMainInvokeEvent } from 'electron';
import { ipcMain } from 'electron';
import {
  IPC_CHANNELS,
  isSettingsSaveRequest,
  isSettingsValidateKeyRequest,
  type ErrorDisplayEvent,
  type MeetingStartRequest,
  type MeetingStateChangedEvent,
  type SettingsSaveRequest,
  type SettingsValidateKeyRequest
} from '../shared/ipc';
import { AudioManager } from './audio/audio-manager';
import { MeetingStateMachine } from './meeting/state-machine';
import { SettingsStore } from './settings/settings-store';
import { createSttAdapter } from './stt/create-stt-adapter';
import { TranscriptionService } from './transcription/transcription-service';

interface HandlerContext {
  window: BrowserWindow;
}

interface MainServices {
  stateMachine: MeetingStateMachine;
  settingsStore: SettingsStore;
  audioManager: AudioManager;
  transcriptionService: TranscriptionService;
}

export function createMainServices(context: HandlerContext): MainServices {
  const emitError = (event: ErrorDisplayEvent): void => {
    context.window.webContents.send(IPC_CHANNELS.errorDisplay, event);
  };
  const settingsStore = new SettingsStore();
  const sttAdapter = createSttAdapter({
    getDeepgramApiKey: () => settingsStore.getSecret('deepgramApiKey')
  });
  let transcriptionService!: TranscriptionService;

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
        context.window.webContents.send(IPC_CHANNELS.transcriptUpdate, event);
      },
      onStatus: (event) => {
        context.window.webContents.send(IPC_CHANNELS.transcriptionStatus, event);
      },
      onErrorDisplay: emitError
    }
  });

  return {
    stateMachine: new MeetingStateMachine(),
    settingsStore,
    audioManager,
    transcriptionService
  };
}

export function registerIpcHandlers(context: HandlerContext, services: MainServices): void {
  ipcMain.removeHandler(IPC_CHANNELS.meetingStart);
  ipcMain.removeHandler(IPC_CHANNELS.meetingStop);
  ipcMain.removeHandler(IPC_CHANNELS.settingsGet);
  ipcMain.removeHandler(IPC_CHANNELS.settingsSave);
  ipcMain.removeHandler(IPC_CHANNELS.settingsValidateKey);
  ipcMain.removeHandler(IPC_CHANNELS.testSimulateSttDisconnect);
  ipcMain.removeAllListeners(IPC_CHANNELS.audioMicFrames);

  ipcMain.handle(IPC_CHANNELS.meetingStart, async (_event, payload: unknown) => {
    const validated = parseMeetingStart(payload);
    const snapshot = services.stateMachine.start(validated.title);
    if (!snapshot.meetingId) {
      throw new Error('Failed to create meeting id.');
    }
    await services.audioManager.startRecording();
    await services.transcriptionService.start();
    emitMeetingState(context.window, {
      state: snapshot.state,
      meetingId: snapshot.meetingId
    });

    return { meetingId: snapshot.meetingId };
  });

  ipcMain.handle(IPC_CHANNELS.meetingStop, async (_event, payload: unknown) => {
    const meetingId = parseMeetingStop(payload);
    const snapshot = services.stateMachine.stop(meetingId);
    await services.audioManager.stopRecording();
    await services.transcriptionService.stop();

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
