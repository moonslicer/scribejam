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
  private readonly inputFrameSamples: number;
  private readonly outputFrameSamples: number;
  private readonly framesPerMix: number;
  private readonly sink: FrameSink;
  private readonly mixCadenceMs: number;
  private nextMixedSeq = 0;
  private timer: NodeJS.Timeout | undefined;

  public constructor(options: MixerOptions) {
    this.systemFrames = new RingBuffer<AudioFrame>(options.maxBufferedFramesPerSource);
    this.micFrames = new RingBuffer<AudioFrame>(options.maxBufferedFramesPerSource);
    this.inputFrameSamples = Math.round((options.sampleRateHz * options.frameSizeMs) / 1000);
    this.outputFrameSamples = Math.round((options.sampleRateHz * options.mixCadenceMs) / 1000);
    this.framesPerMix = Math.max(1, Math.round(options.mixCadenceMs / options.frameSizeMs));
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
    const mixedSamples = new Int16Array(this.outputFrameSamples);
    const systemChunk = this.chunkFromSource(systemFrame, this.systemFrames);
    const micChunk = this.chunkFromSource(micFrame, this.micFrames);
    const hasSystem = systemChunk.hasSignal;
    const hasMic = micChunk.hasSignal;
    for (let i = 0; i < mixedSamples.length; i += 1) {
      const systemSample = systemChunk.samples[i] ?? 0;
      const micSample = micChunk.samples[i] ?? 0;
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

  private chunkFromSource(
    firstFrame: AudioFrame | undefined,
    queue: RingBuffer<AudioFrame>
  ): { samples: Int16Array; hasSignal: boolean } {
    const chunk = new Int16Array(this.outputFrameSamples);
    let hasSignal = false;
    for (let frameIdx = 0; frameIdx < this.framesPerMix; frameIdx += 1) {
      const frame = frameIdx === 0 ? firstFrame : queue.shift();
      if (!frame) {
        continue;
      }
      hasSignal = true;
      const offset = frameIdx * this.inputFrameSamples;
      for (let i = 0; i < this.inputFrameSamples; i += 1) {
        const pos = offset + i;
        if (pos >= chunk.length) {
          break;
        }
        chunk[pos] = frame.samples[i] ?? 0;
      }
    }
    return { samples: chunk, hasSignal };
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
