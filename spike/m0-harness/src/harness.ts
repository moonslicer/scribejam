import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { DeterministicMixer } from "./audio/mixer.js";
import { MockCapture } from "./capture/mock-capture.js";
import { MicIpcCapture } from "./capture/mic-ipc-capture.js";
import { createSystemCapture } from "./capture/system-capture.js";
import { JsonlLogger } from "./logging/jsonl-logger.js";
import { MetricsCollector } from "./metrics/metrics-collector.js";
import { DeepgramSttAdapter } from "./stt/deepgram-stt.js";
import { MockSttAdapter } from "./stt/mock-stt.js";
import type { AudioFrame, CaptureAdapter, FrameSink, HarnessConfig, RunMetadata, SttAdapter } from "./types.js";

export async function runHarness(config: HarnessConfig): Promise<void> {
  const runDir = path.resolve(config.outputDir, config.runId);
  fs.mkdirSync(runDir, { recursive: true });
  const logger = new JsonlLogger(path.join(runDir, "events.ndjson"));
  const metrics = new MetricsCollector(config.runId);
  const startIso = new Date().toISOString();

  const stt = createSttAdapter(config.sttMode);
  stt.onTranscript((event) => {
    metrics.recordLatencyMs(event.latencyMs);
    logger.write({
      ts_iso: new Date().toISOString(),
      run_id: config.runId,
      scenario_id: config.scenarioId,
      event_type: "transcript",
      source: "stt",
      lag_ms: event.latencyMs,
      message: event.text
    });
  });
  stt.onConnectionEvent((evt) => {
    metrics.recordConnectionEvent(evt);
    logger.write({
      ts_iso: new Date().toISOString(),
      run_id: config.runId,
      scenario_id: config.scenarioId,
      event_type: `stt_${evt}`,
      source: "stt",
      message: `stt ${evt}`
    });
  });

  const mixer = new DeterministicMixer({
    frameSizeMs: config.frameSizeMs,
    mixCadenceMs: config.mixCadenceMs,
    sampleRateHz: config.sampleRateHz,
    maxBufferedFramesPerSource: 250,
    sink: {
      onFrame: (frame) => {
        metrics.recordFrame("mixed");
        void stt.sendFrame(frame);
        logger.write({
          ts_iso: new Date().toISOString(),
          run_id: config.runId,
          scenario_id: config.scenarioId,
          event_type: "mixed_frame",
          source: "mixer",
          seq: frame.seq,
          buffer_depth: mixer.getBufferDepths().system + mixer.getBufferDepths().mic,
          message: "mixed frame emitted"
        });
      },
      onDrop: (source, dropped) => {
        metrics.recordDrop(dropped);
        logger.write({
          ts_iso: new Date().toISOString(),
          run_id: config.runId,
          scenario_id: config.scenarioId,
          event_type: "buffer_drop",
          source: "mixer",
          message: `dropped ${dropped} frame(s) from ${source}`
        });
      }
    }
  });

  const micCapture: CaptureAdapter =
    config.micCaptureMode === "ipc"
      ? new MicIpcCapture({ port: config.micIpcPort })
      : new MockCapture({
          source: "mic",
          sampleRateHz: config.sampleRateHz,
          frameSizeMs: config.frameSizeMs,
          toneHz: 180
        });
  const systemCaptureOutcome = await createSystemCapture({
    mode: config.systemCaptureMode,
    sampleRateHz: config.sampleRateHz,
    frameSizeMs: config.frameSizeMs
  });
  if (systemCaptureOutcome.fallbackToMicOnly) {
    metrics.setDegradationFlags({
      systemCaptureUnavailableTested: config.systemCaptureMode === "unavailable",
      micOnlyFallbackSuccess: true
    });
    logger.write({
      ts_iso: new Date().toISOString(),
      run_id: config.runId,
      scenario_id: config.scenarioId,
      event_type: "fallback_mic_only",
      source: "app",
      message: "system capture unavailable, mic-only mode enabled"
    });
  }

  const frameSink: FrameSink = {
    onFrame: (frame: AudioFrame) => {
      if (frame.source !== "system" && frame.source !== "mic") {
        return;
      }
      metrics.recordFrame(frame.source);
      mixer.addFrame(frame);
      logger.write({
        ts_iso: new Date().toISOString(),
        run_id: config.runId,
        scenario_id: config.scenarioId,
        event_type: "capture_frame",
        source: frame.source,
        seq: frame.seq,
        message: "capture frame received"
      });
    },
    onDrop: (source, dropped) => {
      metrics.recordDrop(dropped);
      logger.write({
        ts_iso: new Date().toISOString(),
        run_id: config.runId,
        scenario_id: config.scenarioId,
        event_type: "capture_drop",
        source: "app",
        message: `capture drop from ${source} count=${dropped}`
      });
    }
  };

  await stt.start();
  await micCapture.start(frameSink);
  if (systemCaptureOutcome.adapter) {
    await systemCaptureOutcome.adapter.start(frameSink);
  }
  mixer.start();

  logger.write({
    ts_iso: new Date().toISOString(),
    run_id: config.runId,
    scenario_id: config.scenarioId,
    event_type: "run_started",
    source: "app",
    message: "harness run started"
  });

  if (config.scenarioId === "S5_network_drop" && stt instanceof MockSttAdapter) {
    metrics.setDegradationFlags({ networkDropTested: true });
    setTimeout(() => {
      stt.simulateDisconnectAndRecovery();
      metrics.setDegradationFlags({ networkDropRecovered: true });
    }, Math.min(5000, Math.max(1000, Math.floor((config.durationSec * 1000) / 3))));
  }

  await waitMs(config.durationSec * 1000);

  mixer.stop();
  if (systemCaptureOutcome.adapter) {
    await systemCaptureOutcome.adapter.stop();
  }
  await micCapture.stop();
  await stt.stop();

  logger.write({
    ts_iso: new Date().toISOString(),
    run_id: config.runId,
    scenario_id: config.scenarioId,
    event_type: "run_completed",
    source: "app",
    message: "harness run completed"
  });
  await logger.close();

  const endIso = new Date().toISOString();
  const metadata = toRunMetadata(config, startIso, endIso);
  const runMetrics = metrics.toRunMetrics();
  writeJson(path.join(runDir, "metadata.json"), metadata);
  writeJson(path.join(runDir, "metrics.json"), runMetrics);
  const notes = [
    `# Run Notes: ${config.runId}`,
    "",
    "## Scenario Summary",
    `- Scenario: ${config.scenarioId}`,
    `- Config: frame=${config.frameSizeMs}ms cadence=${config.mixCadenceMs}ms`,
    `- Start: ${startIso}`,
    `- End: ${endIso}`,
    "",
    "## Observations",
    "- Generated by m0 harness bootstrap run."
  ].join("\n");
  fs.writeFileSync(path.join(runDir, "notes.md"), `${notes}\n`, "utf8");
}

function toRunMetadata(config: HarnessConfig, startIso: string, endIso: string): RunMetadata {
  return {
    run_id: config.runId,
    timestamp_start_iso: startIso,
    timestamp_end_iso: endIso,
    scenario_id: config.scenarioId,
    config_id: configId(config.frameSizeMs, config.mixCadenceMs),
    config: {
      frame_size_ms: config.frameSizeMs,
      mix_cadence_ms: config.mixCadenceMs,
      sample_rate_hz: config.sampleRateHz,
      channels: 1,
      format: "PCM16"
    },
    environment: {
      macos_version: os.release(),
      hardware_model: os.hostname(),
      architecture: os.arch(),
      node_version: process.version,
      electron_version: "",
      audioteejs_version: "",
      deepgram_mode: config.sttMode
    },
    operator: process.env.USER ?? "",
    commit_ref: process.env.GIT_COMMIT ?? "",
    notes: "Generated by spike/m0-harness bootstrap."
  };
}

function configId(frameSizeMs: number, mixCadenceMs: number): string {
  if (frameSizeMs === 10 && mixCadenceMs === 50) {
    return "CFG-A";
  }
  if (frameSizeMs === 20 && mixCadenceMs === 100) {
    return "CFG-B";
  }
  if (frameSizeMs === 40 && mixCadenceMs === 200) {
    return "CFG-C";
  }
  return `CFG-${frameSizeMs}-${mixCadenceMs}`;
}

function createSttAdapter(mode: "mock" | "deepgram"): SttAdapter {
  if (mode === "mock") {
    return new MockSttAdapter();
  }
  return new DeepgramSttAdapter();
}

async function waitMs(ms: number): Promise<void> {
  await new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

function writeJson(filePath: string, value: unknown): void {
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2), "utf8");
}
