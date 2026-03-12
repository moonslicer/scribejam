import type { AudioTee } from "audiotee";
import type { CaptureAdapter, FrameSink } from "../types.js";
import { MockCapture } from "./mock-capture.js";

interface SystemCaptureFactoryOptions {
  mode: "mock" | "audioteejs" | "unavailable";
  sampleRateHz: number;
  frameSizeMs: number;
}

class AudioTeeCaptureAdapter implements CaptureAdapter {
  private readonly tee: AudioTee;
  private seq = 0;
  private sink: FrameSink | null = null;

  public constructor(tee: AudioTee) {
    this.tee = tee;
  }

  public async start(sink: FrameSink): Promise<void> {
    this.sink = sink;
    this.tee.on("data", (chunk) => {
      // chunk.data is a Buffer of raw PCM16 little-endian samples
      const samples = new Int16Array(chunk.data.buffer, chunk.data.byteOffset, chunk.data.byteLength / 2);
      this.sink?.onFrame({
        source: "system",
        seq: this.seq++,
        tsMs: Date.now(),
        samples
      });
    });
    this.tee.on("error", (err) => {
      process.stderr.write(`audiotee error: ${err.message}\n`);
      this.sink?.onDrop("system", 1);
    });
    await this.tee.start();
  }

  public async stop(): Promise<void> {
    await this.tee.stop();
    this.sink = null;
  }
}

export async function createSystemCapture(
  options: SystemCaptureFactoryOptions
): Promise<{ adapter: CaptureAdapter | null; fallbackToMicOnly: boolean }> {
  if (options.mode === "unavailable") {
    return { adapter: null, fallbackToMicOnly: true };
  }
  if (options.mode === "mock") {
    return {
      adapter: new MockCapture({
        source: "system",
        sampleRateHz: options.sampleRateHz,
        frameSizeMs: options.frameSizeMs,
        toneHz: 440
      }),
      fallbackToMicOnly: false
    };
  }

  try {
    const { AudioTee } = await import("audiotee");
    const tee = new AudioTee({
      sampleRate: options.sampleRateHz,
      chunkDurationMs: options.frameSizeMs
    });
    return { adapter: new AudioTeeCaptureAdapter(tee), fallbackToMicOnly: false };
  } catch {
    return { adapter: null, fallbackToMicOnly: true };
  }
}
