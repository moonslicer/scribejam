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
  fetchFn?: typeof fetch;
  socketFactory?: (apiKey: string) => Promise<DeepgramSocketLike>;
}

export class DeepgramAdapter implements RealtimeSttAdapter {
  private readonly getApiKey: () => string | undefined;
  private readonly maxReconnectAttempts: number;
  private readonly baseReconnectDelayMs: number;
  private readonly now: () => number;
  private readonly setTimeoutFn: (handler: () => void, delayMs: number) => NodeJS.Timeout;
  private readonly clearTimeoutFn: (timer: NodeJS.Timeout) => void;
  private readonly fetchFn: typeof fetch;
  private readonly socketFactory: (apiKey: string) => Promise<DeepgramSocketLike>;

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
    this.fetchFn = options.fetchFn ?? fetch;
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
      const response = await this.fetchFn('https://api.deepgram.com/v1/projects', {
        method: 'GET',
        headers: {
          Authorization: `Token ${trimmed}`
        }
      });

      if (response.ok) {
        return { valid: true };
      }

      if (response.status === 401 || response.status === 403) {
        return {
          valid: false,
          error: 'Deepgram rejected the API key. Check the key and try again.'
        };
      }

      return {
        valid: false,
        error: `Deepgram validation failed (${response.status}).`
      };
    } catch {
      return {
        valid: false,
        error: 'Unable to reach Deepgram. Check your network connection.'
      };
    }
  }

  private async openSocket(): Promise<void> {
    if (this.opening) {
      return;
    }

    const apiKey = this.getApiKey()?.trim();
    if (!apiKey) {
      throw new Error('Deepgram API key is not configured.');
    }

    this.opening = true;

    try {
      const socket = await this.socketFactory(apiKey);
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

async function createDeepgramSocket(apiKey: string): Promise<DeepgramSocketLike> {
  const client = new DeepgramClient({ apiKey });
  return (await client.listen.v2.connect({
    model: 'flux-general-en',
    encoding: ListenV2Encoding.Linear16,
    sample_rate: 16000,
    Authorization: apiKey
  })) as unknown as DeepgramSocketLike;
}
