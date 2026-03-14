import { contextBridge, ipcRenderer } from 'electron';
import {
  IPC_CHANNELS,
  type AudioLevelEvent,
  type EnhanceMeetingRequest,
  type EnhanceProgressEvent,
  type EnhanceMeetingResponse,
  type ErrorDisplayEvent,
  type MeetingStartRequest,
  type MeetingStartResponse,
  type MeetingDetails,
  type MeetingGetRequest,
  type MeetingStateChangedEvent,
  type MeetingResetResponse,
  type MeetingStopRequest,
  type MicFramesPayload,
  type NotesSaveRequest,
  type Settings,
  type SettingsValidateKeyRequest,
  type SettingsValidateKeyResponse,
  type SettingsSaveRequest,
  type TranscriptUpdateEvent,
  type TranscriptionStatusEvent
} from '../shared/ipc';

type Unsubscribe = () => void;

interface ScribejamApi {
  startMeeting: (payload: MeetingStartRequest) => Promise<MeetingStartResponse>;
  stopMeeting: (payload: MeetingStopRequest) => Promise<void>;
  resetMeeting: () => Promise<MeetingResetResponse>;
  getMeeting: (payload: MeetingGetRequest) => Promise<MeetingDetails | null>;
  enhanceMeeting: (payload: EnhanceMeetingRequest) => Promise<EnhanceMeetingResponse>;
  getSettings: () => Promise<Settings>;
  saveSettings: (payload: SettingsSaveRequest) => Promise<void>;
  saveNotes: (payload: NotesSaveRequest) => void;
  validateProviderKey: (payload: SettingsValidateKeyRequest) => Promise<SettingsValidateKeyResponse>;
  validateSttKey: (payload: SettingsValidateKeyRequest) => Promise<SettingsValidateKeyResponse>;
  sendMicFrames: (payload: MicFramesPayload) => void;
  onMeetingStateChanged: (listener: (event: MeetingStateChangedEvent) => void) => Unsubscribe;
  onEnhanceProgress: (listener: (event: EnhanceProgressEvent) => void) => Unsubscribe;
  onAudioLevel: (listener: (event: AudioLevelEvent) => void) => Unsubscribe;
  onTranscriptUpdate: (listener: (event: TranscriptUpdateEvent) => void) => Unsubscribe;
  onTranscriptionStatus: (listener: (event: TranscriptionStatusEvent) => void) => Unsubscribe;
  onErrorDisplay: (listener: (event: ErrorDisplayEvent) => void) => Unsubscribe;
  simulateSttDisconnect: () => Promise<void>;
}

const api: ScribejamApi = {
  startMeeting: (payload) => ipcRenderer.invoke(IPC_CHANNELS.meetingStart, payload),
  stopMeeting: (payload) => ipcRenderer.invoke(IPC_CHANNELS.meetingStop, payload),
  resetMeeting: () => ipcRenderer.invoke(IPC_CHANNELS.meetingReset),
  getMeeting: (payload) => ipcRenderer.invoke(IPC_CHANNELS.meetingGet, payload),
  enhanceMeeting: (payload) => ipcRenderer.invoke(IPC_CHANNELS.meetingEnhance, payload),
  getSettings: () => ipcRenderer.invoke(IPC_CHANNELS.settingsGet),
  saveSettings: (payload) => ipcRenderer.invoke(IPC_CHANNELS.settingsSave, payload),
  saveNotes: (payload) => {
    ipcRenderer.send(IPC_CHANNELS.notesSave, payload);
  },
  validateProviderKey: (payload) => ipcRenderer.invoke(IPC_CHANNELS.settingsValidateKey, payload),
  validateSttKey: (payload) => ipcRenderer.invoke(IPC_CHANNELS.settingsValidateKey, payload),
  sendMicFrames: (payload) => {
    ipcRenderer.send(IPC_CHANNELS.audioMicFrames, payload);
  },
  onMeetingStateChanged: (listener) => {
    const wrapped = (_event: Electron.IpcRendererEvent, payload: MeetingStateChangedEvent) => {
      listener(payload);
    };
    ipcRenderer.on(IPC_CHANNELS.meetingStateChanged, wrapped);
    return () => ipcRenderer.off(IPC_CHANNELS.meetingStateChanged, wrapped);
  },
  onEnhanceProgress: (listener) => {
    const wrapped = (_event: Electron.IpcRendererEvent, payload: EnhanceProgressEvent) => {
      listener(payload);
    };
    ipcRenderer.on(IPC_CHANNELS.enhanceProgress, wrapped);
    return () => ipcRenderer.off(IPC_CHANNELS.enhanceProgress, wrapped);
  },
  onAudioLevel: (listener) => {
    const wrapped = (_event: Electron.IpcRendererEvent, payload: AudioLevelEvent) => {
      listener(payload);
    };
    ipcRenderer.on(IPC_CHANNELS.audioLevel, wrapped);
    return () => ipcRenderer.off(IPC_CHANNELS.audioLevel, wrapped);
  },
  onTranscriptUpdate: (listener) => {
    const wrapped = (_event: Electron.IpcRendererEvent, payload: TranscriptUpdateEvent) => {
      listener(payload);
    };
    ipcRenderer.on(IPC_CHANNELS.transcriptUpdate, wrapped);
    return () => ipcRenderer.off(IPC_CHANNELS.transcriptUpdate, wrapped);
  },
  onTranscriptionStatus: (listener) => {
    const wrapped = (_event: Electron.IpcRendererEvent, payload: TranscriptionStatusEvent) => {
      listener(payload);
    };
    ipcRenderer.on(IPC_CHANNELS.transcriptionStatus, wrapped);
    return () => ipcRenderer.off(IPC_CHANNELS.transcriptionStatus, wrapped);
  },
  onErrorDisplay: (listener) => {
    const wrapped = (_event: Electron.IpcRendererEvent, payload: ErrorDisplayEvent) => {
      listener(payload);
    };
    ipcRenderer.on(IPC_CHANNELS.errorDisplay, wrapped);
    return () => ipcRenderer.off(IPC_CHANNELS.errorDisplay, wrapped);
  },
  simulateSttDisconnect: () => ipcRenderer.invoke(IPC_CHANNELS.testSimulateSttDisconnect)
};

contextBridge.exposeInMainWorld('scribejam', api);
