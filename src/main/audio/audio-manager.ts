import type { AudioLevelEvent, ErrorDisplayEvent } from '../../shared/ipc';
import { parseMicFramesPayload } from './mic-capture';
import { computeRms } from './level-meter';
import type { AudioFrame } from './system-capture';
import { SystemCapture } from './system-capture';

const MAX_BUFFER_FRAMES = 250;

export interface AudioManagerEvents {
  onAudioLevel: (event: AudioLevelEvent) => void;
  onErrorDisplay: (event: ErrorDisplayEvent) => void;
}

interface SourceBuffer {
  frames: Int16Array[];
}

export class AudioManager {
  private readonly systemCapture: SystemCapture;
  private readonly events: AudioManagerEvents;
  private isRecording = false;
  private micLastSeq = -1;
  private readonly buffers: Record<'mic' | 'system', SourceBuffer> = {
    mic: { frames: [] },
    system: { frames: [] }
  };

  public constructor(events: AudioManagerEvents, sampleRate = 16_000, frameSizeMs = 20) {
    this.events = events;
    this.systemCapture = new SystemCapture(sampleRate, frameSizeMs);
  }

  public async startRecording(): Promise<void> {
    this.isRecording = true;
    this.micLastSeq = -1;
    this.buffers.mic.frames.length = 0;
    this.buffers.system.frames.length = 0;

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
    this.buffers.mic.frames.length = 0;
    this.buffers.system.frames.length = 0;
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
    this.pushFrame('mic', parsed.frames);
    this.emitLevel('mic', parsed.frames);
  }

  private ingestSystemFrame(frame: AudioFrame): void {
    if (!this.isRecording) {
      return;
    }

    this.pushFrame('system', frame.frames);
    this.emitLevel('system', frame.frames);
  }

  private pushFrame(source: 'mic' | 'system', frame: Int16Array): void {
    const queue = this.buffers[source].frames;
    queue.push(frame);
    if (queue.length > MAX_BUFFER_FRAMES) {
      queue.shift();
    }
  }

  private emitLevel(source: 'mic' | 'system', frame: Int16Array): void {
    this.events.onAudioLevel({ source, rms: computeRms(frame) });
  }
}
