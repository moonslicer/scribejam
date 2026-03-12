import type { KeyValidationResult, RealtimeSttAdapter, SttConnectionEvent, SttTranscriptEvent } from './types';

export interface MockSttAdapterOptions {
  now?: () => number;
  reconnectDelayMs?: number;
  transcriptEveryNFrames?: number;
}

export class MockSttAdapter implements RealtimeSttAdapter {
  private readonly now: () => number;
  private readonly reconnectDelayMs: number;
  private readonly transcriptEveryNFrames: number;
  private transcriptListener: ((event: SttTranscriptEvent) => void) | null = null;
  private connectionListener: ((event: SttConnectionEvent) => void) | null = null;
  private frameCount = 0;
  private started = false;
  private disconnected = false;

  public constructor(options?: MockSttAdapterOptions) {
    this.now = options?.now ?? Date.now;
    this.reconnectDelayMs = options?.reconnectDelayMs ?? 500;
    this.transcriptEveryNFrames = options?.transcriptEveryNFrames ?? 10;
  }

  public onTranscript(listener: (event: SttTranscriptEvent) => void): void {
    this.transcriptListener = listener;
  }

  public onConnectionEvent(listener: (event: SttConnectionEvent) => void): void {
    this.connectionListener = listener;
  }

  public async start(): Promise<void> {
    this.started = true;
    this.disconnected = false;
    this.frameCount = 0;
  }

  public async sendAudio(_frames: Int16Array): Promise<void> {
    if (!this.started || this.disconnected) {
      return;
    }

    this.frameCount += 1;
    if (this.frameCount % this.transcriptEveryNFrames !== 0) {
      return;
    }

    this.transcriptListener?.({
      ts: this.now(),
      text: 'mock transcript token',
      isFinal: true,
      latencyMs: 200
    });
  }

  public async stop(): Promise<void> {
    this.started = false;
    this.disconnected = false;
  }

  public async validateKey(key: string): Promise<KeyValidationResult> {
    if (key.trim().length > 0) {
      return { valid: true };
    }
    return {
      valid: false,
      error: 'Mock key validation failed.'
    };
  }

  public simulateDisconnect(): void {
    if (!this.started || this.disconnected) {
      return;
    }

    this.disconnected = true;
    this.connectionListener?.('disconnect');
    this.connectionListener?.('reconnect_attempt');

    setTimeout(() => {
      this.disconnected = false;
      this.connectionListener?.('reconnect_success');
    }, this.reconnectDelayMs);
  }
}
