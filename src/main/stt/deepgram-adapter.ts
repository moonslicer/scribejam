import { DeepgramClient, ListenV2Encoding } from '@deepgram/sdk';
import type { KeyValidationResult, RealtimeSttAdapter, SttConnectionEvent, SttTranscriptEvent } from './types';

export interface DeepgramSocketLike {
  on(event: 'open', handler: () => void): void;
  on(event: 'close', handler: (event: { code?: number }) => void): void;
  on(event: 'message', handler: (message: unknown) => void): void;
  on(event: 'error', handler: (error: Error) => void): void;
  sendMedia(data: ArrayBufferView): void;
  connect(): void;
  close(): void;
  waitForOpen(): Promise<unknown>;
}

interface DeepgramMessage {
  type?: string;
  transcript?: string;
  event?: string;
}

export interface DeepgramAdapterOptions {
  getApiKey: () => string | undefined;
  maxReconnectAttempts?: number;
  baseReconnectDelayMs?: number;
  now?: () => number;
  setTimeoutFn?: (handler: () => void, delayMs: number) => NodeJS.Timeout;
  clearTimeoutFn?: (timer: NodeJS.Timeout) => void;
  socketFactory?: (options: DeepgramSocketConnectOptions) => Promise<DeepgramSocketLike>;
}

export interface DeepgramSocketConnectOptions {
  apiKey: string;
  authorization: string;
}

export class MissingDeepgramApiKeyError extends Error {
  public constructor() {
    super('Deepgram API key is not configured.');
    this.name = 'MissingDeepgramApiKeyError';
  }
}

export class DeepgramAdapter implements RealtimeSttAdapter {
  private readonly getApiKey: () => string | undefined;
  private readonly maxReconnectAttempts: number;
  private readonly baseReconnectDelayMs: number;
  private readonly now: () => number;
  private readonly setTimeoutFn: (handler: () => void, delayMs: number) => NodeJS.Timeout;
  private readonly clearTimeoutFn: (timer: NodeJS.Timeout) => void;
  private readonly socketFactory: (options: DeepgramSocketConnectOptions) => Promise<DeepgramSocketLike>;

  private transcriptListener: ((event: SttTranscriptEvent) => void) | null = null;
  private connectionListener: ((event: SttConnectionEvent) => void) | null = null;
  private socket: DeepgramSocketLike | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private reconnectAttempts = 0;
  private stopping = false;
  private opening = false;
  private lastSendTs = 0;

  public constructor(options: DeepgramAdapterOptions) {
    this.getApiKey = options.getApiKey;
    this.maxReconnectAttempts = options.maxReconnectAttempts ?? 3;
    this.baseReconnectDelayMs = options.baseReconnectDelayMs ?? 500;
    this.now = options.now ?? Date.now;
    this.setTimeoutFn = options.setTimeoutFn ?? setTimeout;
    this.clearTimeoutFn = options.clearTimeoutFn ?? clearTimeout;
    this.socketFactory = options.socketFactory ?? createDeepgramSocket;
  }

  public onTranscript(listener: (event: SttTranscriptEvent) => void): void {
    this.transcriptListener = listener;
  }

  public onConnectionEvent(listener: (event: SttConnectionEvent) => void): void {
    this.connectionListener = listener;
  }

  public async start(): Promise<void> {
    this.stopping = false;
    this.reconnectAttempts = 0;
    this.clearReconnectTimer();
    await this.openSocket();
  }

  public async sendAudio(frames: Int16Array): Promise<void> {
    if (!this.socket) {
      return;
    }

    this.lastSendTs = this.now();
    this.socket.sendMedia(frames);
  }

  public async stop(): Promise<void> {
    this.stopping = true;
    this.clearReconnectTimer();
    this.reconnectAttempts = 0;
    this.socket?.close();
    this.socket = null;
  }

  public simulateDisconnect(): void {
    this.socket?.close();
  }

  public async validateKey(key: string): Promise<KeyValidationResult> {
    const trimmed = key.trim();
    if (trimmed.length === 0) {
      return {
        valid: false,
        error: 'Deepgram API key is required.'
      };
    }

    try {
      const socket = await this.socketFactory(buildDeepgramSocketConnectOptions(trimmed));
      socket.connect();
      await socket.waitForOpen();
      socket.close();
      return { valid: true };
    } catch (error) {
      if (isLikelyDeepgramAuthError(error)) {
        return {
          valid: false,
          error: 'Deepgram rejected the API key. Check the key and try again.'
        };
      }

      return {
        valid: false,
        error: 'Unable to reach Deepgram realtime transcription. Check your network connection.'
      };
    }
  }

  private async openSocket(): Promise<void> {
    if (this.opening) {
      return;
    }

    const apiKey = this.getApiKey()?.trim();
    if (!apiKey) {
      throw new MissingDeepgramApiKeyError();
    }

    this.opening = true;

    try {
      const socket = await this.socketFactory(buildDeepgramSocketConnectOptions(apiKey));
      this.bindSocket(socket);
      this.socket = socket;
      socket.connect();
      await socket.waitForOpen();

      if (this.reconnectAttempts > 0) {
        this.connectionListener?.('reconnect_success');
      }
      this.reconnectAttempts = 0;
    } finally {
      this.opening = false;
    }
  }

  private bindSocket(socket: DeepgramSocketLike): void {
    socket.on('close', () => {
      void this.handleSocketDisconnected();
    });

    socket.on('error', () => {
      void this.handleSocketDisconnected();
    });

    socket.on('message', (message) => {
      const payload = parseDeepgramMessage(message);
      if (!payload || payload.type !== 'TurnInfo' || !payload.transcript) {
        return;
      }

      const latencyMs = this.lastSendTs > 0 ? Math.max(0, this.now() - this.lastSendTs) : 0;
      this.transcriptListener?.({
        ts: this.now(),
        text: payload.transcript,
        isFinal: payload.event === 'EndOfTurn' || payload.event === 'EagerEndOfTurn',
        latencyMs
      });
    });
  }

  private async handleSocketDisconnected(): Promise<void> {
    if (this.stopping) {
      return;
    }

    this.socket = null;
    this.connectionListener?.('disconnect');

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.connectionListener?.('reconnect_failed');
      return;
    }

    this.reconnectAttempts += 1;
    const attempt = this.reconnectAttempts;
    const delayMs = this.baseReconnectDelayMs * 2 ** (attempt - 1);
    this.connectionListener?.('reconnect_attempt');

    this.clearReconnectTimer();
    this.reconnectTimer = this.setTimeoutFn(() => {
      this.reconnectTimer = null;
      void this.openSocket().catch(() => {
        void this.handleSocketDisconnected();
      });
    }, delayMs);
  }

  private clearReconnectTimer(): void {
    if (!this.reconnectTimer) {
      return;
    }

    this.clearTimeoutFn(this.reconnectTimer);
    this.reconnectTimer = null;
  }
}

export function isLikelyDeepgramAuthError(error: unknown): boolean {
  const message = getDeepgramErrorMessage(error);
  if (!message) {
    return false;
  }

  return /\b(401|403)\b|unauthori[sz]ed|forbidden|invalid api key|authentication/i.test(message);
}

function getDeepgramErrorMessage(error: unknown): string | undefined {
  if (error instanceof Error) {
    return error.message;
  }

  if (!error || typeof error !== 'object') {
    return undefined;
  }

  if ('message' in error && typeof error.message === 'string' && error.message.trim().length > 0) {
    return error.message;
  }

  if (
    'error' in error &&
    error.error &&
    typeof error.error === 'object' &&
    'message' in error.error &&
    typeof error.error.message === 'string' &&
    error.error.message.trim().length > 0
  ) {
    return error.error.message;
  }

  return undefined;
}

function parseDeepgramMessage(message: unknown): DeepgramMessage | null {
  if (!message || typeof message !== 'object') {
    return null;
  }

  const candidate = message as DeepgramMessage;
  if (
    (candidate.type !== undefined && typeof candidate.type !== 'string') ||
    (candidate.transcript !== undefined && typeof candidate.transcript !== 'string') ||
    (candidate.event !== undefined && typeof candidate.event !== 'string')
  ) {
    return null;
  }

  return candidate;
}

function formatDeepgramAuthorizationHeader(apiKey: string): string {
  const trimmed = apiKey.trim();
  if (/^(Token|Bearer)\s/i.test(trimmed)) {
    return trimmed;
  }
  return `Token ${trimmed}`;
}

function buildDeepgramSocketConnectOptions(apiKey: string): DeepgramSocketConnectOptions {
  return {
    apiKey,
    authorization: formatDeepgramAuthorizationHeader(apiKey)
  };
}

async function createDeepgramSocket(options: DeepgramSocketConnectOptions): Promise<DeepgramSocketLike> {
  const client = new DeepgramClient({ apiKey: options.apiKey });
  return (await client.listen.v2.connect({
    model: 'flux-general-en',
    encoding: ListenV2Encoding.Linear16,
    sample_rate: 16000,
    Authorization: options.authorization
  })) as unknown as DeepgramSocketLike;
}
