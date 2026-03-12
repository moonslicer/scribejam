#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const harnessDir = path.join(repoRoot, "spike", "m0-harness");
const runsRoot = path.join(repoRoot, "docs", "m0", "runs");

const args = parseArgs(process.argv.slice(2));
// --capture real --stt deepgram requires DEEPGRAM_API_KEY in environment
if (args.sttMode === "deepgram" && !process.env.DEEPGRAM_API_KEY) {
  process.stderr.write("Error: DEEPGRAM_API_KEY environment variable is required for --stt deepgram\n");
  process.exit(1);
}
const batchId = `batch-${timestampTag()}`;
const summary = {
  batch_id: batchId,
  mode: args.mode,
  started_at_iso: new Date().toISOString(),
  runs: []
};

ensurePath(harnessDir, "m0 harness directory");
fs.mkdirSync(runsRoot, { recursive: true });

runCommand("npm", ["run", "build"], { cwd: harnessDir });

const durations = args.mode === "full" ? fullDurations() : quickDurations();
const scenarios = scenarioPlan(args.configId, durations, args.captureMode, args.sttMode);

for (const scenario of scenarios) {
  const runId = makeRunId(scenario.scenarioId, scenario.configId, batchId);
  const runArgs = [
    "dist/cli.js",
    "--run-id",
    runId,
    "--scenario",
    scenario.scenarioId,
    "--duration-sec",
    String(scenario.durationSec),
    "--frame-size-ms",
    String(scenario.frameSizeMs),
    "--mix-cadence-ms",
    String(scenario.mixCadenceMs),
    "--system-capture-mode",
    scenario.systemCaptureMode,
    "--mic-capture-mode",
    scenario.micCaptureMode,
    "--stt-mode",
    scenario.sttMode,
    "--output-dir",
    runsRoot
  ];
  runCommand("node", runArgs, { cwd: harnessDir });

  runCommand("node", ["scripts/m0/verify-run.mjs", path.join("docs/m0/runs", runId)], { cwd: repoRoot });

  summary.runs.push({
    run_id: runId,
    scenario_id: scenario.scenarioId,
    config_id: scenario.configId,
    duration_sec: scenario.durationSec,
    system_capture_mode: scenario.systemCaptureMode,
    mic_capture_mode: scenario.micCaptureMode,
    stt_mode: scenario.sttMode,
    status: "PASS"
  });
}

summary.ended_at_iso = new Date().toISOString();
const summaryPath = path.join(runsRoot, `${batchId}-summary.json`);
fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2), "utf8");
process.stdout.write(`M0 matrix complete. Summary: ${summaryPath}\n`);

function parseArgs(argv) {
  const map = new Map();
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith("--")) {
      continue;
    }
    const value = argv[i + 1];
    if (value && !value.startsWith("--")) {
      map.set(token, value);
      i += 1;
    } else {
      map.set(token, "true");
    }
  }

  const mode = toEnum(map.get("--mode"), ["quick", "full"], "quick");
  const configId = toEnum(map.get("--config"), ["CFG-A", "CFG-B", "CFG-C"], "CFG-B");
  const captureMode = toEnum(map.get("--capture"), ["mock", "real"], "mock");
  const sttMode = toEnum(map.get("--stt"), ["mock", "deepgram"], "mock");
  return { mode, configId, captureMode, sttMode };
}

function scenarioPlan(configId, durations, captureMode, sttMode) {
  const cfg = configToFrames(configId);
  const sys = captureMode === "real" ? "audioteejs" : "mock";
  const stt = sttMode;
  return [
    {
      scenarioId: "S1_system_only_10m",
      configId,
      durationSec: durations.S1_system_only_10m,
      ...cfg,
      systemCaptureMode: sys,
      micCaptureMode: "mock",
      sttMode: stt
    },
    {
      scenarioId: "S2_mic_only_10m",
      configId,
      durationSec: durations.S2_mic_only_10m,
      ...cfg,
      systemCaptureMode: "unavailable",
      micCaptureMode: "mock",
      sttMode: stt
    },
    {
      scenarioId: "S3_mixed_10m",
      configId,
      durationSec: durations.S3_mixed_10m,
      ...cfg,
      systemCaptureMode: sys,
      micCaptureMode: "mock",
      sttMode: stt
    },
    {
      scenarioId: "S4_mixed_soak_30m",
      configId,
      durationSec: durations.S4_mixed_soak_30m,
      ...cfg,
      systemCaptureMode: sys,
      micCaptureMode: "mock",
      sttMode: stt
    },
    {
      scenarioId: "S5_network_drop",
      configId,
      durationSec: durations.S5_network_drop,
      ...cfg,
      systemCaptureMode: sys,
      micCaptureMode: "mock",
      sttMode: stt
    },
    {
      scenarioId: "S6_system_unavailable",
      configId,
      durationSec: durations.S6_system_unavailable,
      ...cfg,
      systemCaptureMode: "unavailable",
      micCaptureMode: "mock",
      sttMode: stt
    }
  ];
}

function quickDurations() {
  return {
    S1_system_only_10m: 15,
    S2_mic_only_10m: 15,
    S3_mixed_10m: 15,
    S4_mixed_soak_30m: 30,
    S5_network_drop: 20,
    S6_system_unavailable: 20
  };
}

function fullDurations() {
  return {
    S1_system_only_10m: 600,
    S2_mic_only_10m: 600,
    S3_mixed_10m: 600,
    S4_mixed_soak_30m: 1800,
    S5_network_drop: 300,
    S6_system_unavailable: 300
  };
}

function configToFrames(configId) {
  if (configId === "CFG-A") {
    return { frameSizeMs: 10, mixCadenceMs: 50 };
  }
  if (configId === "CFG-B") {
    return { frameSizeMs: 20, mixCadenceMs: 100 };
  }
  return { frameSizeMs: 40, mixCadenceMs: 200 };
}

function makeRunId(scenarioId, configId, batchId) {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const scenarioSlug = scenarioId.replace(/[^a-zA-Z0-9]+/g, "-").toLowerCase();
  const batchSlug = batchId.replace(/[^a-zA-Z0-9]+/g, "-").toLowerCase();
  return `m0-${date}-${scenarioSlug}-${configId.toLowerCase()}-${batchSlug}`;
}

function timestampTag() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function runCommand(command, args, options) {
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    encoding: "utf8",
    stdio: "pipe"
  });
  process.stdout.write(result.stdout ?? "");
  process.stderr.write(result.stderr ?? "");
  if (result.status !== 0) {
    const joined = [command, ...args].join(" ");
    throw new Error(`Command failed (${result.status}): ${joined}`);
  }
}

function ensurePath(targetPath, label) {
  if (!fs.existsSync(targetPath)) {
    throw new Error(`Missing ${label}: ${targetPath}`);
  }
}

function toEnum(raw, allowed, fallback) {
  if (!raw) {
    return fallback;
  }
  if (allowed.includes(raw)) {
    return raw;
  }
  return fallback;
}
