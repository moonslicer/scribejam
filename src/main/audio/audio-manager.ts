import type { AudioLevelEvent, ErrorDisplayEvent } from '../../shared/ipc';
import { parseMicFramesPayload } from './mic-capture';
import { computeRms } from './level-meter';
import type { SourceAudioFrame } from './frame-types';
import type { AudioFrame } from './system-capture';
import { SystemCapture } from './system-capture';

export interface AudioManagerEvents {
  onAudioLevel: (event: AudioLevelEvent) => void;
  onErrorDisplay: (event: ErrorDisplayEvent) => void;
  onSourceFrame: (frame: SourceAudioFrame) => void;
}

export class AudioManager {
  private readonly systemCapture: SystemCapture;
  private readonly events: AudioManagerEvents;
  private isRecording = false;
  private micLastSeq = -1;

  public constructor(events: AudioManagerEvents, sampleRate = 16_000, frameSizeMs = 20) {
    this.events = events;
    this.systemCapture = new SystemCapture(sampleRate, frameSizeMs);
  }

  public async startRecording(): Promise<void> {
    this.isRecording = true;
    this.micLastSeq = -1;

    await this.systemCapture.start({
      onFrame: (frame) => this.ingestSystemFrame(frame),
      onUnavailable: () => {
        this.events.onErrorDisplay({
          message: 'System audio unavailable — recording microphone only.'
        });
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
