import type { MixedAudioFrame, SourceAudioFrame } from './frame-types';
import { RingBuffer } from './ring-buffer';

interface SourceChunk {
  samples: Int16Array;
  hasSignal: boolean;
}

export interface MixerEvents {
  onMixedFrame: (frame: MixedAudioFrame) => void;
  onDrop: (source: 'mic' | 'system', dropped: number) => void;
}

export interface DeterministicMixerOptions {
  sampleRateHz: number;
  frameSizeMs: number;
  mixCadenceMs: number;
  maxBufferedFramesPerSource: number;
  events: MixerEvents;
}

export class DeterministicMixer {
  private readonly micFrames: RingBuffer<SourceAudioFrame>;
  private readonly systemFrames: RingBuffer<SourceAudioFrame>;
  private readonly inputFrameSamples: number;
  private readonly outputFrameSamples: number;
  private readonly framesPerMix: number;
  private readonly cadenceMs: number;
  private readonly events: MixerEvents;
  private nextMixedSeq = 0;
  private timer: NodeJS.Timeout | null = null;

  public constructor(options: DeterministicMixerOptions) {
    this.micFrames = new RingBuffer<SourceAudioFrame>(options.maxBufferedFramesPerSource);
    this.systemFrames = new RingBuffer<SourceAudioFrame>(options.maxBufferedFramesPerSource);
    this.inputFrameSamples = Math.round((options.sampleRateHz * options.frameSizeMs) / 1000);
    this.outputFrameSamples = Math.round((options.sampleRateHz * options.mixCadenceMs) / 1000);
    this.framesPerMix = Math.max(1, Math.round(options.mixCadenceMs / options.frameSizeMs));
    this.cadenceMs = options.mixCadenceMs;
    this.events = options.events;
  }

  public start(): void {
    if (this.timer) {
      return;
    }

    this.timer = setInterval(() => {
      this.tick();
    }, this.cadenceMs);
  }

  public stop(): void {
    if (!this.timer) {
      return;
    }

    clearInterval(this.timer);
    this.timer = null;
  }

  public reset(): void {
    this.stop();
    this.micFrames.clear();
    this.systemFrames.clear();
    this.nextMixedSeq = 0;
  }

  public ingest(frame: SourceAudioFrame): void {
    if (frame.source === 'mic') {
      const dropped = this.micFrames.push(frame);
      if (dropped) {
        this.events.onDrop('mic', 1);
      }
      return;
    }

    const dropped = this.systemFrames.push(frame);
    if (dropped) {
      this.events.onDrop('system', 1);
    }
  }

  public tick(now = Date.now()): MixedAudioFrame {
    const micChunk = this.takeChunk(this.micFrames);
    const systemChunk = this.takeChunk(this.systemFrames);
    const mixedSamples = new Int16Array(this.outputFrameSamples);

    for (let i = 0; i < this.outputFrameSamples; i += 1) {
      const mic = micChunk.samples[i] ?? 0;
      const system = systemChunk.samples[i] ?? 0;
      const divisor = micChunk.hasSignal && systemChunk.hasSignal ? 2 : 1;
      mixedSamples[i] = clampToInt16(divisor === 1 ? mic + system : Math.round((mic + system) / divisor));
    }

    const frame: MixedAudioFrame = {
      seq: this.nextMixedSeq,
      ts: now,
      frames: mixedSamples,
      activeSources: {
        mic: micChunk.hasSignal,
        system: systemChunk.hasSignal
      }
    };
    this.nextMixedSeq += 1;

    this.events.onMixedFrame(frame);
    return frame;
  }

  public getBufferDepths(): { mic: number; system: number } {
    return {
      mic: this.micFrames.size,
      system: this.systemFrames.size
    };
  }

  private takeChunk(queue: RingBuffer<SourceAudioFrame>): SourceChunk {
    const output = new Int16Array(this.outputFrameSamples);
    let hasSignal = false;

    for (let chunkIdx = 0; chunkIdx < this.framesPerMix; chunkIdx += 1) {
      const frame = queue.shift();
      if (!frame) {
        continue;
      }

      hasSignal = true;
      const offset = chunkIdx * this.inputFrameSamples;
      for (let i = 0; i < this.inputFrameSamples; i += 1) {
        const target = offset + i;
        if (target >= output.length) {
          break;
        }
        output[target] = frame.frames[i] ?? 0;
      }
    }

    return { samples: output, hasSignal };
  }
}

function clampToInt16(value: number): number {
  if (value > 32767) {
    return 32767;
  }
  if (value < -32768) {
    return -32768;
  }
  return value;
}
