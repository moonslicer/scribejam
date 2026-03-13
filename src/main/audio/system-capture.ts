import type { AudioSource } from '../../shared/ipc';

export interface AudioFrame {
  source: AudioSource;
  seq: number;
  ts: number;
  frames: Int16Array;
}

export type SystemCaptureUnavailableReason =
  | 'forced_unavailable'
  | 'module_unavailable'
  | 'module_load_failed'
  | 'permission_denied'
  | 'start_failed';

export interface SystemCaptureUnavailableFailure {
  reason: SystemCaptureUnavailableReason;
  error?: Error;
  moduleName?: string;
}

export interface SystemCaptureCallbacks {
  onFrame: (frame: AudioFrame) => void;
  onUnavailable: (failure: SystemCaptureUnavailableFailure) => void;
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

interface AudioTeeResolution {
  ctor: AudioTeeCtor | null;
  failure?: SystemCaptureUnavailableFailure;
}

const CANDIDATE_MODULE_NAMES = ['audioteejs', 'audiotee'];
const importAtRuntime = new Function(
  'specifier',
  'return import(specifier);'
) as (specifier: string) => Promise<unknown>;

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
    if (process.env.SCRIBEJAM_FORCE_SYSTEM_UNAVAILABLE === '1') {
      callbacks.onUnavailable({ reason: 'forced_unavailable' });
      return;
    }

    const resolution = await this.resolveAudioTeeCtor();
    if (resolution.failure) {
      callbacks.onUnavailable(resolution.failure);
      return;
    }

    if (!resolution.ctor) {
      callbacks.onUnavailable({ reason: 'module_unavailable' });
      return;
    }

    try {
      const tee = new resolution.ctor({
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
    } catch (error) {
      callbacks.onUnavailable(classifyStartFailure(error));
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

  private async resolveAudioTeeCtor(): Promise<AudioTeeResolution> {
    for (const moduleName of CANDIDATE_MODULE_NAMES) {
      const resolution = await this.tryLoad(moduleName);
      if (resolution.failure) {
        return resolution;
      }
      if (resolution.ctor) {
        return resolution;
      }
    }

    return { ctor: null };
  }

  private async tryLoad(moduleName: string): Promise<AudioTeeResolution> {
    try {
      const imported: unknown = await importAtRuntime(moduleName);
      if (!imported || typeof imported !== 'object') {
        return { ctor: null };
      }

      const moduleLike = imported as Record<string, unknown>;
      if (typeof moduleLike.AudioTee === 'function') {
        return { ctor: moduleLike.AudioTee as AudioTeeCtor };
      }

      const defaultExport = moduleLike.default;
      if (defaultExport && typeof defaultExport === 'object') {
        const defaultLike = defaultExport as Record<string, unknown>;
        if (typeof defaultLike.AudioTee === 'function') {
          return { ctor: defaultLike.AudioTee as AudioTeeCtor };
        }
      }
    } catch (error) {
      if (isModuleNotFoundForCandidate(error, moduleName)) {
        return { ctor: null };
      }

      return {
        ctor: null,
        failure: {
          reason: 'module_load_failed',
          moduleName,
          error: normalizeError(error)
        }
      };
    }

    return { ctor: null };
  }
}

function classifyStartFailure(error: unknown): SystemCaptureUnavailableFailure {
  const normalized = normalizeError(error);
  const message = normalized.message.toLowerCase();

  if (
    message.includes('permission') ||
    message.includes('not permitted') ||
    message.includes('denied') ||
    message.includes('unauthorized') ||
    message.includes('system audio recording') ||
    message.includes('tcc')
  ) {
    return {
      reason: 'permission_denied',
      error: normalized
    };
  }

  return {
    reason: 'start_failed',
    error: normalized
  };
}

function normalizeError(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }

  return new Error(typeof error === 'string' ? error : 'Unknown system audio capture error.');
}

function isModuleNotFoundForCandidate(error: unknown, moduleName: string): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const withCode = error as Error & { code?: string };
  if (withCode.code === 'MODULE_NOT_FOUND') {
    return true;
  }

  return error.message.includes(`Cannot find module '${moduleName}'`) ||
    error.message.includes(`Cannot find package '${moduleName}'`);
}
