import type {
  AudioLevelEvent,
  ErrorDisplayEvent,
  MeetingStartRequest,
  MeetingStartResponse,
  MeetingStateChangedEvent,
  MeetingStopRequest,
  MicFramesPayload,
  Settings,
  SettingsValidateKeyRequest,
  SettingsValidateKeyResponse,
  SettingsSaveRequest,
  TranscriptUpdateEvent,
  TranscriptionStatusEvent
} from '../../shared/ipc';

type Unsubscribe = () => void;

interface ScribejamApi {
  startMeeting: (payload: MeetingStartRequest) => Promise<MeetingStartResponse>;
  stopMeeting: (payload: MeetingStopRequest) => Promise<void>;
  getSettings: () => Promise<Settings>;
  saveSettings: (payload: SettingsSaveRequest) => Promise<void>;
  validateSttKey: (payload: SettingsValidateKeyRequest) => Promise<SettingsValidateKeyResponse>;
  sendMicFrames: (payload: MicFramesPayload) => void;
  onMeetingStateChanged: (listener: (event: MeetingStateChangedEvent) => void) => Unsubscribe;
  onAudioLevel: (listener: (event: AudioLevelEvent) => void) => Unsubscribe;
  onTranscriptUpdate: (listener: (event: TranscriptUpdateEvent) => void) => Unsubscribe;
  onTranscriptionStatus: (listener: (event: TranscriptionStatusEvent) => void) => Unsubscribe;
  onErrorDisplay: (listener: (event: ErrorDisplayEvent) => void) => Unsubscribe;
  simulateSttDisconnect: () => Promise<void>;
}

declare global {
  interface Window {
    scribejam: ScribejamApi;
  }
}

export {};
