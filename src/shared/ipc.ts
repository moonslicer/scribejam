export const IPC_CHANNELS = {
  meetingStart: 'meeting:start',
  meetingStop: 'meeting:stop',
  meetingReset: 'meeting:reset',
  meetingArchive: 'meeting:archive',
  meetingList: 'meeting:list',
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
  testSimulateSttDisconnect: 'test:simulate-stt-disconnect',
  testConfigureEnhancementMock: 'test:configure-enhancement-mock'
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
export type SettingsKeyProvider = SttProvider | 'openai' | 'anthropic';
export type TranscriptSpeaker = string;
export type TranscriptionStatus = 'idle' | 'connecting' | 'streaming' | 'reconnecting' | 'paused';
export const BUILT_IN_TEMPLATE_IDS = ['auto', 'one-on-one', 'standup', 'tech-review'] as const;
export type BuiltInTemplateId = (typeof BUILT_IN_TEMPLATE_IDS)[number];
/** Built-in template ID or an opaque custom-template ID such as `cust_lp0rkjf`. */
export type TemplateId = string;
/** @deprecated Use BUILT_IN_TEMPLATE_IDS */
export const TEMPLATE_IDS = BUILT_IN_TEMPLATE_IDS;
export const MAX_TEMPLATE_INSTRUCTIONS_LENGTH = 4000;
export type TestEnhancementOutcome =
  | 'success'
  | 'invalid_api_key'
  | 'rate_limited'
  | 'timeout'
  | 'network';

const MEETING_HISTORY_QUERY_MAX_LENGTH = 200;

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

export interface MeetingArchiveRequest {
  meetingId: string;
}

export interface MeetingArchiveResponse {
  meetingId: string;
}

export interface MeetingGetRequest {
  meetingId: string;
}

export interface MeetingListRequest {
  query?: string;
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
  templateId?: TemplateId;
  templateInstructions?: string;
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
  lastTemplateId?: TemplateId;
  lastTemplateName?: string;
  enhancedOutputCreatedAt?: string;
  enhancedNoteUpdatedAt?: string;
  transcriptSegments: TranscriptSegment[];
}

export interface MeetingHistoryItem {
  id: string;
  title: string;
  state: MeetingState;
  createdAt: string;
  updatedAt: string;
  durationMs: number | null;
  hasEnhancedOutput: boolean;
  previewText: string | null;
}

export interface MeetingListResponse {
  items: MeetingHistoryItem[];
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
  defaultTemplateId?: TemplateId;
  customTemplates?: CustomTemplateSettings[];
  deepgramApiKeySet: boolean;
  openaiApiKeySet: boolean;
  anthropicApiKeySet: boolean;
}

export interface CustomTemplateSettings {
  /** Stable opaque ID, e.g. `cust_lp0rkjf`. Generated client-side. */
  id: string;
  name: string;
  instructions: string;
}

export interface SettingsSaveRequest {
  firstRunAcknowledged?: boolean;
  sttProvider?: SttProvider;
  llmProvider?: LlmProvider;
  defaultTemplateId?: TemplateId;
  customTemplates?: CustomTemplateSettings[];
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

export interface TestConfigureEnhancementMockRequest {
  outcomes: TestEnhancementOutcome[];
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
  if (candidate.defaultTemplateId !== undefined && !isTemplateId(candidate.defaultTemplateId)) {
    return false;
  }
  if (candidate.customTemplates !== undefined) {
    if (!Array.isArray(candidate.customTemplates)) {
      return false;
    }
    for (const t of candidate.customTemplates) {
      if (!t || typeof t !== 'object') return false;
      const ct = t as Partial<CustomTemplateSettings>;
      if (
        typeof ct.id !== 'string' ||
        ct.id.length === 0 ||
        typeof ct.name !== 'string' ||
        typeof ct.instructions !== 'string' ||
        ct.instructions.length > MAX_TEMPLATE_INSTRUCTIONS_LENGTH
      ) {
        return false;
      }
    }
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
    (candidate.provider === 'deepgram' || candidate.provider === 'openai' || candidate.provider === 'anthropic') &&
    typeof candidate.key === 'string'
  );
}

export function isTestConfigureEnhancementMockRequest(
  value: unknown
): value is TestConfigureEnhancementMockRequest {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<TestConfigureEnhancementMockRequest>;
  if (!Array.isArray(candidate.outcomes)) {
    return false;
  }

  return candidate.outcomes.every(
    (outcome) =>
      outcome === 'success' ||
      outcome === 'invalid_api_key' ||
      outcome === 'rate_limited' ||
      outcome === 'timeout' ||
      outcome === 'network'
  );
}

export function isMeetingArchiveRequest(value: unknown): value is MeetingArchiveRequest {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<MeetingArchiveRequest>;
  return typeof candidate.meetingId === 'string' && candidate.meetingId.length > 0;
}

export function isMeetingGetRequest(value: unknown): value is MeetingGetRequest {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<MeetingGetRequest>;
  return typeof candidate.meetingId === 'string' && candidate.meetingId.length > 0;
}

export function isMeetingListRequest(value: unknown): value is MeetingListRequest {
  if (value === undefined) {
    return true;
  }
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<MeetingListRequest>;
  return (
    candidate.query === undefined ||
    (typeof candidate.query === 'string' &&
      candidate.query.length <= MEETING_HISTORY_QUERY_MAX_LENGTH)
  );
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
  return (
    typeof candidate.meetingId === 'string' &&
    candidate.meetingId.length > 0 &&
    (candidate.templateId === undefined || isTemplateId(candidate.templateId)) &&
    (candidate.templateInstructions === undefined ||
      (typeof candidate.templateInstructions === 'string' &&
        candidate.templateInstructions.length <= MAX_TEMPLATE_INSTRUCTIONS_LENGTH))
  );
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

function isTemplateId(value: unknown): value is TemplateId {
  return typeof value === 'string' && value.length > 0 && value.length <= 100;
}
