import type { AudioSource } from '../../shared/ipc';

export interface AudioFrame {
  source: AudioSource;
  seq: number;
  ts: number;
  frames: Int16Array;
}

export interface SystemCaptureCallbacks {
  onFrame: (frame: AudioFrame) => void;
  onUnavailable: () => void;
  onError: (error: Error) => void;
}

interface AudioTeeChunk {
  data: Buffer;
}

interface AudioTeeInstance {
  on(event: 'data', handler: (chunk: AudioTeeChunk) => void): void;
  on(event: 'error', handler: (error: Error) => void): void;
  removeAllListeners: () => void;
  start: () => Promise<void>;
  stop: () => Promise<void>;
}

interface AudioTeeCtor {
  new (options: { sampleRate: number; chunkDurationMs: number }): AudioTeeInstance;
}

const CANDIDATE_MODULE_NAMES = ['audioteejs', 'audiotee'];

export class SystemCapture {
  private readonly sampleRate: number;
  private readonly frameSizeMs: number;
  private seq = 0;
  private instance: AudioTeeInstance | null = null;

  public constructor(sampleRate: number, frameSizeMs: number) {
    this.sampleRate = sampleRate;
    this.frameSizeMs = frameSizeMs;
  }

  public async start(callbacks: SystemCaptureCallbacks): Promise<void> {
    const Ctor = await this.resolveAudioTeeCtor();
    if (!Ctor) {
      callbacks.onUnavailable();
      return;
    }

    try {
      const tee = new Ctor({
        sampleRate: this.sampleRate,
        chunkDurationMs: this.frameSizeMs
      });

      tee.on('data', (chunk) => {
        const samples = new Int16Array(
          chunk.data.buffer,
          chunk.data.byteOffset,
          Math.floor(chunk.data.byteLength / 2)
        );
        callbacks.onFrame({
          source: 'system',
          seq: this.seq,
          ts: Date.now(),
          frames: new Int16Array(samples)
        });
        this.seq += 1;
      });

      tee.on('error', (error) => {
        callbacks.onError(error);
      });

      await tee.start();
      this.instance = tee;
    } catch {
      callbacks.onUnavailable();
    }
  }

  public async stop(): Promise<void> {
    if (!this.instance) {
      return;
    }
    const active = this.instance;
    this.instance = null;
    active.removeAllListeners();
    await active.stop();
  }

  private async resolveAudioTeeCtor(): Promise<AudioTeeCtor | null> {
    for (const moduleName of CANDIDATE_MODULE_NAMES) {
      const Ctor = await this.tryLoad(moduleName);
      if (Ctor) {
        return Ctor;
      }
    }
    return null;
  }

  private async tryLoad(moduleName: string): Promise<AudioTeeCtor | null> {
    try {
      const imported: unknown = await import(moduleName);
      if (!imported || typeof imported !== 'object') {
        return null;
      }

      const moduleLike = imported as Record<string, unknown>;
      if (typeof moduleLike.AudioTee === 'function') {
        return moduleLike.AudioTee as AudioTeeCtor;
      }

      const defaultExport = moduleLike.default;
      if (defaultExport && typeof defaultExport === 'object') {
        const defaultLike = defaultExport as Record<string, unknown>;
        if (typeof defaultLike.AudioTee === 'function') {
          return defaultLike.AudioTee as AudioTeeCtor;
        }
      }
    } catch {
      return null;
    }

    return null;
  }
}
