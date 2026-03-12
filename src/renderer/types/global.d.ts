import type {
  AudioLevelEvent,
  ErrorDisplayEvent,
  MeetingStartRequest,
  MeetingStartResponse,
  MeetingStateChangedEvent,
  MeetingStopRequest,
  MicFramesPayload,
  Settings,
  SettingsSaveRequest
} from '../../shared/ipc';

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

declare global {
  interface Window {
    scribejam: ScribejamApi;
  }
}

export {};
