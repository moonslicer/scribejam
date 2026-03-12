import path from "node:path";
import { runHarness } from "./harness.js";
import type { CaptureMode, HarnessConfig, MicMode, SttMode } from "./types.js";

const DEFAULT_OUTPUT_DIR = path.resolve(process.cwd(), "docs/m0/runs");

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const config: HarnessConfig = {
    runId: args.runId,
    scenarioId: args.scenarioId,
    outputDir: args.outputDir,
    durationSec: args.durationSec,
    sampleRateHz: args.sampleRateHz,
    frameSizeMs: args.frameSizeMs,
    mixCadenceMs: args.mixCadenceMs,
    systemCaptureMode: args.systemCaptureMode,
    micCaptureMode: args.micCaptureMode,
    sttMode: args.sttMode,
    micIpcPort: args.micIpcPort
  };

  // eslint-disable-next-line no-console
  console.log(
    `Starting M0 harness run=${config.runId} scenario=${config.scenarioId} output=${path.join(config.outputDir, config.runId)}`
  );
  await runHarness(config);
  // eslint-disable-next-line no-console
  console.log("Harness run completed.");
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  // eslint-disable-next-line no-console
  console.error(`Harness run failed: ${message}`);
  process.exitCode = 1;
});

interface ParsedArgs {
  runId: string;
  scenarioId: string;
  outputDir: string;
  durationSec: number;
  sampleRateHz: number;
  frameSizeMs: number;
  mixCadenceMs: number;
  systemCaptureMode: CaptureMode;
  micCaptureMode: MicMode;
  sttMode: SttMode;
  micIpcPort: number;
}

function parseArgs(argv: string[]): ParsedArgs {
  const values = new Map<string, string>();
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith("--")) {
      continue;
    }
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) {
      values.set(token, "true");
      continue;
    }
    values.set(token, next);
    i += 1;
  }

  const runId = values.get("--run-id") ?? `m0-${new Date().toISOString().replace(/[:.]/g, "-")}`;
  const scenarioId = values.get("--scenario") ?? "S3_mixed_10m";
  const outputDir = path.resolve(values.get("--output-dir") ?? DEFAULT_OUTPUT_DIR);
  const durationSec = toPositiveInt(values.get("--duration-sec"), 60);
  const sampleRateHz = toPositiveInt(values.get("--sample-rate-hz"), 16000);
  const frameSizeMs = toPositiveInt(values.get("--frame-size-ms"), 20);
  const mixCadenceMs = toPositiveInt(values.get("--mix-cadence-ms"), 100);
  const systemCaptureMode = toEnum<CaptureMode>(
    values.get("--system-capture-mode"),
    ["mock", "audioteejs", "unavailable"],
    "mock"
  );
  const micCaptureMode = toEnum<MicMode>(values.get("--mic-capture-mode"), ["mock", "ipc", "none"], "mock");
  const sttMode = toEnum<SttMode>(values.get("--stt-mode"), ["mock", "deepgram"], "mock");
  const micIpcPort = toPositiveInt(values.get("--mic-ipc-port"), 33339);

  return {
    runId,
    scenarioId,
    outputDir,
    durationSec,
    sampleRateHz,
    frameSizeMs,
    mixCadenceMs,
    systemCaptureMode,
    micCaptureMode,
    sttMode,
    micIpcPort
  };
}

function toPositiveInt(raw: string | undefined, fallback: number): number {
  if (!raw) {
    return fallback;
  }
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) {
    return fallback;
  }
  return value;
}

function toEnum<T extends string>(raw: string | undefined, allowed: readonly T[], fallback: T): T {
  if (!raw) {
    return fallback;
  }
  if (allowed.includes(raw as T)) {
    return raw as T;
  }
  return fallback;
}
