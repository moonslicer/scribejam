import { RingBuffer } from "./ring-buffer.js";
import type { AudioFrame, FrameSink } from "../types.js";

export interface MixerOptions {
  frameSizeMs: number;
  mixCadenceMs: number;
  sampleRateHz: number;
  maxBufferedFramesPerSource: number;
  sink: FrameSink;
}

export class DeterministicMixer {
  private readonly systemFrames: RingBuffer<AudioFrame>;
  private readonly micFrames: RingBuffer<AudioFrame>;
  private readonly frameSamples: number;
  private readonly sink: FrameSink;
  private readonly mixCadenceMs: number;
  private nextMixedSeq = 0;
  private timer: NodeJS.Timeout | undefined;

  public constructor(options: MixerOptions) {
    this.systemFrames = new RingBuffer<AudioFrame>(options.maxBufferedFramesPerSource);
    this.micFrames = new RingBuffer<AudioFrame>(options.maxBufferedFramesPerSource);
    this.frameSamples = Math.round((options.sampleRateHz * options.frameSizeMs) / 1000);
    this.sink = options.sink;
    this.mixCadenceMs = options.mixCadenceMs;
  }

  public addFrame(frame: AudioFrame): void {
    if (frame.source === "system") {
      const dropped = this.systemFrames.push(frame);
      if (dropped) {
        this.sink.onDrop("system", 1);
      }
      return;
    }
    if (frame.source === "mic") {
      const dropped = this.micFrames.push(frame);
      if (dropped) {
        this.sink.onDrop("mic", 1);
      }
      return;
    }
  }

  public getBufferDepths(): { system: number; mic: number } {
    return {
      system: this.systemFrames.size,
      mic: this.micFrames.size
    };
  }

  public start(): void {
    if (this.timer) {
      return;
    }
    this.timer = setInterval(() => {
      const systemFrame = this.systemFrames.shift();
      const micFrame = this.micFrames.shift();
      const mixed = this.mix(systemFrame, micFrame);
      this.sink.onFrame(mixed);
    }, this.mixCadenceMs);
  }

  public stop(): void {
    if (!this.timer) {
      return;
    }
    clearInterval(this.timer);
    this.timer = undefined;
  }

  private mix(systemFrame: AudioFrame | undefined, micFrame: AudioFrame | undefined): AudioFrame {
    const mixedSamples = new Int16Array(this.frameSamples);
    const hasSystem = !!systemFrame;
    const hasMic = !!micFrame;
    for (let i = 0; i < mixedSamples.length; i += 1) {
      const systemSample = hasSystem ? systemFrame.samples[i] ?? 0 : 0;
      const micSample = hasMic ? micFrame.samples[i] ?? 0 : 0;
      const divisor = hasSystem && hasMic ? 2 : 1;
      const mixedValue = divisor === 1 ? systemSample + micSample : Math.round((systemSample + micSample) / divisor);
      mixedSamples[i] = clampToInt16(mixedValue);
    }
    return {
      source: "mixed",
      seq: this.nextMixedSeq++,
      tsMs: Date.now(),
      samples: mixedSamples
    };
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
