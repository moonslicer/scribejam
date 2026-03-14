import type {
  AudioLevelEvent,
  EnhanceMeetingRequest,
  EnhanceProgressEvent,
  EnhanceMeetingResponse,
  ErrorDisplayEvent,
  MeetingStartRequest,
  MeetingStartResponse,
  MeetingDetails,
  MeetingGetRequest,
  MeetingResetResponse,
  MeetingStateChangedEvent,
  MeetingStopRequest,
  MicFramesPayload,
  NotesSaveRequest,
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

declare global {
  interface Window {
    scribejam: ScribejamApi;
  }
}

export {};
