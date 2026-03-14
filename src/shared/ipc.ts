export const IPC_CHANNELS = {
  meetingStart: 'meeting:start',
  meetingStop: 'meeting:stop',
  meetingReset: 'meeting:reset',
  meetingGet: 'meeting:get',
  meetingEnhance: 'meeting:enhance',
  meetingDismissEnhancementFailure: 'meeting:dismiss-enhancement-failure',
  enhanceProgress: 'enhance:progress',
  settingsGet: 'settings:get',
  settingsSave: 'settings:save',
  settingsValidateKey: 'settings:validate-key',
  notesSave: 'notes:save',
  enhancedNoteSave: 'enhanced-note:save',
  audioMicFrames: 'audio:mic-frames',
  meetingStateChanged: 'meeting:state-changed',
  audioLevel: 'audio:level',
  transcriptUpdate: 'transcript:update',
  transcriptionStatus: 'transcription:status',
  errorDisplay: 'error:display',
  testSimulateSttDisconnect: 'test:simulate-stt-disconnect'
} as const;

export type MeetingState =
  | 'idle'
  | 'recording'
  | 'stopped'
  | 'enhancing'
  | 'enhance_failed'
  | 'done';
export type AudioSource = 'mic' | 'system';
export type ErrorAction = 'open-settings' | 'retry';
export type LlmProvider = 'openai' | 'anthropic';
export type SttProvider = 'deepgram';
export type SettingsKeyProvider = SttProvider | 'openai';
export type CaptureSource = 'mixed' | 'mic' | 'system';
export type TranscriptSpeaker = 'you' | 'them';
export type TranscriptionStatus = 'idle' | 'connecting' | 'streaming' | 'reconnecting' | 'paused';

export interface MeetingStartRequest {
  title: string;
  meetingId?: string;
}

export interface MeetingStartResponse {
  meetingId: string;
  title: string;
}

export interface MeetingStopRequest {
  meetingId: string;
}

export interface MeetingResetResponse {
  state: Extract<MeetingState, 'idle'>;
}

export interface MeetingGetRequest {
  meetingId: string;
}

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonValue[];
export interface JsonObject {
  [key: string]: JsonValue;
}

export interface EnhancedBlock {
  source: 'human' | 'ai';
  content: string;
}

export interface EnhancedActionItem {
  owner: string;
  description: string;
  due?: string;
}

export interface EnhancedDecision {
  description: string;
  context: string;
}

export interface EnhancedOutput {
  blocks: EnhancedBlock[];
  actionItems: EnhancedActionItem[];
  decisions: EnhancedDecision[];
  summary: string;
}

export interface EnhanceMeetingRequest {
  meetingId: string;
}

export interface EnhanceMeetingResponse {
  meetingId: string;
  output: EnhancedOutput;
  completedAt: string;
}

export interface DismissEnhancementFailureRequest {
  meetingId: string;
}

export interface DismissEnhancementFailureResponse {
  meetingId: string;
  state: Extract<MeetingState, 'stopped'>;
}

export interface EnhanceProgressEvent {
  meetingId: string;
  status: 'streaming' | 'done' | 'error';
  detail: string;
}

export interface TranscriptSegment {
  id: number;
  speaker: TranscriptSpeaker;
  text: string;
  startTs: number;
  endTs: number | null;
  isFinal: boolean;
}

export interface MeetingDetails {
  id: string;
  title: string;
  state: MeetingState;
  createdAt: string;
  updatedAt: string;
  durationMs: number | null;
  noteContent: JsonObject | null;
  enhancedNoteContent: JsonObject | null;
  enhancedOutput: EnhancedOutput | null;
  transcriptSegments: TranscriptSegment[];
}

export interface NotesSaveRequest {
  meetingId: string;
  content: JsonObject;
}

export interface EnhancedNoteSaveRequest {
  meetingId: string;
  content: JsonObject;
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

export interface TranscriptUpdateEvent {
  text: string;
  speaker: TranscriptSpeaker;
  ts: number;
  isFinal: boolean;
}

export interface TranscriptionStatusEvent {
  status: TranscriptionStatus;
  detail?: string;
}

export interface Settings {
  firstRunAcknowledged: boolean;
  sttProvider: SttProvider;
  llmProvider: LlmProvider;
  captureSource: CaptureSource;
  deepgramApiKeySet: boolean;
  openaiApiKeySet: boolean;
  anthropicApiKeySet: boolean;
}

export interface SettingsSaveRequest {
  firstRunAcknowledged?: boolean;
  sttProvider?: SttProvider;
  llmProvider?: LlmProvider;
  captureSource?: CaptureSource;
  deepgramApiKey?: string;
  openaiApiKey?: string;
  anthropicApiKey?: string;
}

export interface SettingsValidateKeyRequest {
  provider: SettingsKeyProvider;
  key: string;
}

export interface SettingsValidateKeyResponse {
  valid: boolean;
  error?: string;
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
  if (
    candidate.captureSource !== undefined &&
    candidate.captureSource !== 'mixed' &&
    candidate.captureSource !== 'mic' &&
    candidate.captureSource !== 'system'
  ) {
    return false;
  }

  return (
    (candidate.deepgramApiKey === undefined || typeof candidate.deepgramApiKey === 'string') &&
    (candidate.openaiApiKey === undefined || typeof candidate.openaiApiKey === 'string') &&
    (candidate.anthropicApiKey === undefined || typeof candidate.anthropicApiKey === 'string')
  );
}

export function isSettingsValidateKeyRequest(value: unknown): value is SettingsValidateKeyRequest {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<SettingsValidateKeyRequest>;
  return (
    (candidate.provider === 'deepgram' || candidate.provider === 'openai') &&
    typeof candidate.key === 'string'
  );
}

export function isMeetingGetRequest(value: unknown): value is MeetingGetRequest {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<MeetingGetRequest>;
  return typeof candidate.meetingId === 'string' && candidate.meetingId.length > 0;
}

export function isNotesSaveRequest(value: unknown): value is NotesSaveRequest {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<NotesSaveRequest>;
  return (
    typeof candidate.meetingId === 'string' &&
    candidate.meetingId.length > 0 &&
    isJsonObject(candidate.content)
  );
}

export function isEnhancedNoteSaveRequest(value: unknown): value is EnhancedNoteSaveRequest {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<EnhancedNoteSaveRequest>;
  return (
    typeof candidate.meetingId === 'string' &&
    candidate.meetingId.length > 0 &&
    isJsonObject(candidate.content)
  );
}

export function isEnhanceMeetingRequest(value: unknown): value is EnhanceMeetingRequest {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<EnhanceMeetingRequest>;
  return typeof candidate.meetingId === 'string' && candidate.meetingId.length > 0;
}

export function isDismissEnhancementFailureRequest(
  value: unknown
): value is DismissEnhancementFailureRequest {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<DismissEnhancementFailureRequest>;
  return typeof candidate.meetingId === 'string' && candidate.meetingId.length > 0;
}

function isJsonObject(value: unknown): value is JsonObject {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
