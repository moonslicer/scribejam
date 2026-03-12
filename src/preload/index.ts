import { contextBridge, ipcRenderer } from 'electron';
import {
  IPC_CHANNELS,
  type AudioLevelEvent,
  type ErrorDisplayEvent,
  type MeetingStartRequest,
  type MeetingStartResponse,
  type MeetingStateChangedEvent,
  type MeetingStopRequest,
  type MicFramesPayload,
  type Settings,
  type SettingsSaveRequest
} from '../shared/ipc';

type Unsubscribe = () => void;

interface ScribejamApi {
  startMeeting: (payload: MeetingStartRequest) => Promise<MeetingStartResponse>;
  stopMeeting: (payload: MeetingStopRequest) => Promise<void>;
  getSettings: () => Promise<Settings>;
  saveSettings: (payload: SettingsSaveRequest) => Promise<void>;
  sendMicFrames: (payload: MicFramesPayload) => void;
  onMeetingStateChanged: (listener: (event: MeetingStateChangedEvent) => void) => Unsubscribe;
  onAudioLevel: (listener: (event: AudioLevelEvent) => void) => Unsubscribe;
  onErrorDisplay: (listener: (event: ErrorDisplayEvent) => void) => Unsubscribe;
}

const api: ScribejamApi = {
  startMeeting: (payload) => ipcRenderer.invoke(IPC_CHANNELS.meetingStart, payload),
  stopMeeting: (payload) => ipcRenderer.invoke(IPC_CHANNELS.meetingStop, payload),
  getSettings: () => ipcRenderer.invoke(IPC_CHANNELS.settingsGet),
  saveSettings: (payload) => ipcRenderer.invoke(IPC_CHANNELS.settingsSave, payload),
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
  onAudioLevel: (listener) => {
    const wrapped = (_event: Electron.IpcRendererEvent, payload: AudioLevelEvent) => {
      listener(payload);
    };
    ipcRenderer.on(IPC_CHANNELS.audioLevel, wrapped);
    return () => ipcRenderer.off(IPC_CHANNELS.audioLevel, wrapped);
  },
  onErrorDisplay: (listener) => {
    const wrapped = (_event: Electron.IpcRendererEvent, payload: ErrorDisplayEvent) => {
      listener(payload);
    };
    ipcRenderer.on(IPC_CHANNELS.errorDisplay, wrapped);
    return () => ipcRenderer.off(IPC_CHANNELS.errorDisplay, wrapped);
  }
};

contextBridge.exposeInMainWorld('scribejam', api);
