export type SttConnectionEvent = 'disconnect' | 'reconnect_attempt' | 'reconnect_success' | 'reconnect_failed';

export interface SttTranscriptEvent {
  ts: number;
  text: string;
  isFinal: boolean;
  latencyMs: number;
  speakerId?: number;
}

export interface KeyValidationResult {
  valid: boolean;
  error?: string;
}

export interface RealtimeSttAdapter {
  start: () => Promise<void>;
  sendAudio: (frames: Int16Array) => Promise<void>;
  stop: () => Promise<void>;
  validateKey: (key: string) => Promise<KeyValidationResult>;
  onTranscript: (listener: (event: SttTranscriptEvent) => void) => void;
  onConnectionEvent: (listener: (event: SttConnectionEvent) => void) => void;
  simulateDisconnect?: () => void;
}
