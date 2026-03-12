import type { AudioFrame, CaptureAdapter, FrameSink } from "../types.js";

interface MockCaptureOptions {
  source: "system" | "mic";
  sampleRateHz: number;
  frameSizeMs: number;
  toneHz: number;
}

export class MockCapture implements CaptureAdapter {
  private readonly source: "system" | "mic";
  private readonly sampleRateHz: number;
  private readonly frameSizeMs: number;
  private readonly toneHz: number;
  private interval: NodeJS.Timeout | undefined;
  private seq = 0;
  private sampleCursor = 0;

  public constructor(options: MockCaptureOptions) {
    this.source = options.source;
    this.sampleRateHz = options.sampleRateHz;
    this.frameSizeMs = options.frameSizeMs;
    this.toneHz = options.toneHz;
  }

  public async start(sink: FrameSink): Promise<void> {
    if (this.interval) {
      return;
    }
    const samplesPerFrame = Math.round((this.sampleRateHz * this.frameSizeMs) / 1000);
    this.interval = setInterval(() => {
      const frame: AudioFrame = {
        source: this.source,
        seq: this.seq++,
        tsMs: Date.now(),
        samples: this.generateTone(samplesPerFrame)
      };
      sink.onFrame(frame);
    }, this.frameSizeMs);
  }

  public async stop(): Promise<void> {
    if (!this.interval) {
      return;
    }
    clearInterval(this.interval);
    this.interval = undefined;
  }

  private generateTone(sampleCount: number): Int16Array {
    const amplitude = 9000;
    const out = new Int16Array(sampleCount);
    for (let i = 0; i < sampleCount; i += 1) {
      const t = (this.sampleCursor + i) / this.sampleRateHz;
      out[i] = Math.round(amplitude * Math.sin(2 * Math.PI * this.toneHz * t));
    }
    this.sampleCursor += sampleCount;
    return out;
  }
}
