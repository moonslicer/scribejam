export const IPC_CHANNELS = {
  meetingStart: 'meeting:start',
  meetingStop: 'meeting:stop',
  settingsGet: 'settings:get',
  settingsSave: 'settings:save',
  audioMicFrames: 'audio:mic-frames',
  meetingStateChanged: 'meeting:state-changed',
  audioLevel: 'audio:level',
  errorDisplay: 'error:display'
} as const;

export type MeetingState = 'idle' | 'recording' | 'stopped';
export type AudioSource = 'mic' | 'system';
export type ErrorAction = 'open-settings' | 'retry';
export type LlmProvider = 'openai' | 'anthropic';
export type SttProvider = 'deepgram';

export interface MeetingStartRequest {
  title: string;
}

export interface MeetingStartResponse {
  meetingId: string;
}

export interface MeetingStopRequest {
  meetingId: string;
}

export interface MicFramesPayload {
  frames: Int16Array | number[];
  seq: number;
  ts: number;
}

export interface MeetingStateChangedEvent {
  state: MeetingState;
  meetingId?: string;
}

export interface AudioLevelEvent {
  source: AudioSource;
  rms: number;
}

export interface ErrorDisplayEvent {
  message: string;
  action?: ErrorAction;
}

export interface Settings {
  firstRunAcknowledged: boolean;
  sttProvider: SttProvider;
  llmProvider: LlmProvider;
  deepgramApiKeySet: boolean;
  openaiApiKeySet: boolean;
  anthropicApiKeySet: boolean;
}

export interface SettingsSaveRequest {
  firstRunAcknowledged?: boolean;
  sttProvider?: SttProvider;
  llmProvider?: LlmProvider;
  deepgramApiKey?: string;
  openaiApiKey?: string;
  anthropicApiKey?: string;
}

export function isMicFramesPayload(value: unknown): value is MicFramesPayload {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const candidate = value as Partial<MicFramesPayload>;
  if (!Number.isInteger(candidate.seq) || (candidate.seq ?? -1) < 0) {
    return false;
  }
  if (!Number.isFinite(candidate.ts)) {
    return false;
  }
  if (candidate.frames instanceof Int16Array) {
    return true;
  }
  if (!Array.isArray(candidate.frames)) {
    return false;
  }
  return candidate.frames.every(
    (sample) => Number.isInteger(sample) && sample >= -32768 && sample <= 32767
  );
}

export function isSettingsSaveRequest(value: unknown): value is SettingsSaveRequest {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const candidate = value as Partial<SettingsSaveRequest>;

  if (
    candidate.firstRunAcknowledged !== undefined &&
    typeof candidate.firstRunAcknowledged !== 'boolean'
  ) {
    return false;
  }
  if (candidate.sttProvider !== undefined && candidate.sttProvider !== 'deepgram') {
    return false;
  }
  if (
    candidate.llmProvider !== undefined &&
    candidate.llmProvider !== 'openai' &&
    candidate.llmProvider !== 'anthropic'
  ) {
    return false;
  }

  return (
    (candidate.deepgramApiKey === undefined || typeof candidate.deepgramApiKey === 'string') &&
    (candidate.openaiApiKey === undefined || typeof candidate.openaiApiKey === 'string') &&
    (candidate.anthropicApiKey === undefined || typeof candidate.anthropicApiKey === 'string')
  );
}
