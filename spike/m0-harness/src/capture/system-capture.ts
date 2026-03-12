import type { CaptureAdapter } from "../types.js";
import { MockCapture } from "./mock-capture.js";

interface SystemCaptureFactoryOptions {
  mode: "mock" | "audioteejs" | "unavailable";
  sampleRateHz: number;
  frameSizeMs: number;
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

  const audioteeAvailable = await canLoadAudiotee();
  if (!audioteeAvailable) {
    return { adapter: null, fallbackToMicOnly: true };
  }

  // The concrete audioteejs stream wiring is left as a focused integration step
  // once package API behavior is validated on target hardware.
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

async function canLoadAudiotee(): Promise<boolean> {
  try {
    await import("audioteejs");
    return true;
  } catch {
    return false;
  }
}
