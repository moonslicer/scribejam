import type { AudioLevelEvent, ErrorDisplayEvent } from '../../shared/ipc';
import { parseMicFramesPayload } from './mic-capture';
import { computeRms } from './level-meter';
import type { SourceAudioFrame } from './frame-types';
import type {
  AudioFrame,
  SystemCaptureCallbacks,
  SystemCaptureUnavailableFailure
} from './system-capture';
import { SystemCapture } from './system-capture';

export interface AudioManagerEvents {
  onAudioLevel: (event: AudioLevelEvent) => void;
  onErrorDisplay: (event: ErrorDisplayEvent) => void;
  onSourceFrame: (frame: SourceAudioFrame) => void;
}

export interface SystemCaptureAdapter {
  start: (callbacks: SystemCaptureCallbacks) => Promise<void>;
  stop: () => Promise<void>;
}

export class AudioManager {
  private readonly systemCapture: SystemCaptureAdapter;
  private readonly events: AudioManagerEvents;
  private isRecording = false;
  private micLastSeq = -1;

  public constructor(
    events: AudioManagerEvents,
    sampleRate = 16_000,
    frameSizeMs = 20,
    systemCapture: SystemCaptureAdapter = new SystemCapture(sampleRate, frameSizeMs)
  ) {
    this.events = events;
    this.systemCapture = systemCapture;
  }

  public async startRecording(): Promise<void> {
    this.isRecording = true;
    this.micLastSeq = -1;

    await this.systemCapture.start({
      onFrame: (frame) => this.ingestSystemFrame(frame),
      onUnavailable: (failure) => {
        this.events.onErrorDisplay(mapSystemCaptureUnavailableFailure(failure));
      },
      onError: () => {
        this.events.onErrorDisplay({
          message: 'System audio capture error. Continuing in microphone-only mode.'
        });
      }
    });
  }

  public async stopRecording(): Promise<void> {
    this.isRecording = false;
    await this.systemCapture.stop();
  }

  public ingestMicPayload(payload: unknown): void {
    if (!this.isRecording) {
      return;
    }
    const parsed = parseMicFramesPayload(payload);
    if (!parsed) {
      this.events.onErrorDisplay({
        message: 'Invalid microphone frame payload rejected.'
      });
      return;
    }

    if (parsed.seq <= this.micLastSeq) {
      return;
    }

    this.micLastSeq = parsed.seq;
    this.events.onSourceFrame({
      source: 'mic',
      seq: parsed.seq,
      ts: parsed.ts,
      frames: parsed.frames
    });
    this.emitLevel('mic', parsed.frames);
  }

  private ingestSystemFrame(frame: AudioFrame): void {
    if (!this.isRecording) {
      return;
    }

    this.events.onSourceFrame(frame);
    this.emitLevel('system', frame.frames);
  }

  private emitLevel(source: 'mic' | 'system', frame: Int16Array): void {
    this.events.onAudioLevel({ source, rms: computeRms(frame) });
  }
}

function mapSystemCaptureUnavailableFailure(
  failure: SystemCaptureUnavailableFailure
): ErrorDisplayEvent {
  if (failure.reason === 'permission_denied') {
    return {
      message:
        'System audio permission denied. Allow Scribejam in System Settings > Privacy & Security > System Audio Recording, or continue recording microphone only.',
      action: 'open-settings'
    };
  }

  if (failure.reason === 'start_failed') {
    return {
      message:
        'System audio failed to start. Check System Audio Recording permission and macOS compatibility. Recording microphone only.'
    };
  }

  if (failure.reason === 'module_load_failed') {
    const moduleLabel = failure.moduleName ? ` (${failure.moduleName})` : '';
    const detail = failure.error ? ` ${summarizeModuleLoadError(failure.error.message)}` : '';
    return {
      message: `System audio module failed to load${moduleLabel}. Recording microphone only.${detail}`
    };
  }

  return {
    message: 'System audio unavailable — recording microphone only.'
  };
}

function summarizeModuleLoadError(message: string): string {
  const sanitized = redactFileSystemPaths(message).replace(/\s+/g, ' ').trim();
  if (sanitized.length === 0) {
    return 'Check Electron/native module compatibility and rebuild native dependencies.';
  }

  const suffix = sanitized.endsWith('.') ? sanitized : `${sanitized}.`;
  return `Detail: ${suffix}`;
}

function redactFileSystemPaths(message: string): string {
  return message
    .replace(/\/(?:Users|home)\/[^\s'"]+/g, '<path>')
    .replace(/[A-Za-z]:\\[^\s'"]+/g, '<path>');
}
