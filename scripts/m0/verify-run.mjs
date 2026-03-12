#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const AUDIO_EXTENSIONS = new Set([".wav", ".pcm", ".raw"]);
const REQUIRED_FILES = ["metadata.json", "metrics.json", "events.ndjson", "notes.md"];
const REQUIRED_METADATA_KEYS = [
  "run_id",
  "timestamp_start_iso",
  "timestamp_end_iso",
  "scenario_id",
  "config_id",
  "config",
  "environment"
];
const REQUIRED_METRICS_KEYS = [
  "run_id",
  "duration_minutes",
  "frame_stats",
  "latency_ms",
  "memory_mb",
  "reliability",
  "degradation",
  "privacy"
];
const THRESHOLDS = {
  transcriptLatencyP95MsMax: 2500,
  droppedFrameRatePctMax: 1.0,
  memoryGrowthMb30mMax: 250,
  reconnectAttemptsPerIncidentMax: 3,
  rawAudioFilesWritten: 0
};

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    throw new Error(`Invalid JSON at ${filePath}: ${error.message}`);
  }
}

function assertKeys(name, obj, keys) {
  const missing = keys.filter((key) => !(key in obj));
  if (missing.length > 0) {
    throw new Error(`${name} missing keys: ${missing.join(", ")}`);
  }
}

function findAudioFiles(dirPath) {
  const results = [];
  const stack = [dirPath];
  while (stack.length > 0) {
    const current = stack.pop();
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(full);
      } else if (AUDIO_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
        results.push(full);
      }
    }
  }
  return results;
}

function formatCheck(label, pass, value) {
  const status = pass ? "PASS" : "FAIL";
  return `[${status}] ${label}: ${value}`;
}

function main() {
  const runDir = process.argv[2];
  if (!runDir) {
    console.error("Usage: node scripts/m0/verify-run.mjs <run-directory>");
    process.exit(1);
  }

  const resolvedRunDir = path.resolve(runDir);
  if (!fs.existsSync(resolvedRunDir) || !fs.statSync(resolvedRunDir).isDirectory()) {
    console.error(`Run directory not found: ${resolvedRunDir}`);
    process.exit(1);
  }

  const failures = [];
  const checks = [];

  for (const file of REQUIRED_FILES) {
    const filePath = path.join(resolvedRunDir, file);
    const exists = fs.existsSync(filePath);
    checks.push(formatCheck(`required file ${file}`, exists, exists ? "present" : "missing"));
    if (!exists) {
      failures.push(`Missing required file: ${filePath}`);
    }
  }

  if (failures.length > 0) {
    for (const check of checks) {
      console.log(check);
    }
    for (const failure of failures) {
      console.error(failure);
    }
    process.exit(1);
  }

  const metadata = readJson(path.join(resolvedRunDir, "metadata.json"));
  const metrics = readJson(path.join(resolvedRunDir, "metrics.json"));
  assertKeys("metadata.json", metadata, REQUIRED_METADATA_KEYS);
  assertKeys("metrics.json", metrics, REQUIRED_METRICS_KEYS);

  const p95 = Number(metrics?.latency_ms?.p95 ?? Number.NaN);
  const dropRate = Number(metrics?.frame_stats?.dropped_frame_rate_pct ?? Number.NaN);
  const growth = Number(metrics?.memory_mb?.growth_30m ?? Number.NaN);
  const reconnectAttempts = Number(metrics?.reliability?.deepgram_reconnect_attempts ?? Number.NaN);
  const rawWritten = Number(metrics?.privacy?.raw_audio_files_written ?? Number.NaN);

  const thresholdChecks = [
    {
      label: "transcript latency p95 <= 2500ms",
      pass: Number.isFinite(p95) && p95 <= THRESHOLDS.transcriptLatencyP95MsMax,
      value: p95
    },
    {
      label: "dropped frame rate < 1.0%",
      pass: Number.isFinite(dropRate) && dropRate < THRESHOLDS.droppedFrameRatePctMax,
      value: dropRate
    },
    {
      label: "memory growth over 30m <= 250MB",
      pass: Number.isFinite(growth) && growth <= THRESHOLDS.memoryGrowthMb30mMax,
      value: growth
    },
    {
      label: "reconnect attempts <= 3",
      pass: Number.isFinite(reconnectAttempts) && reconnectAttempts <= THRESHOLDS.reconnectAttemptsPerIncidentMax,
      value: reconnectAttempts
    },
    {
      label: "reported raw audio files written == 0",
      pass: Number.isFinite(rawWritten) && rawWritten === THRESHOLDS.rawAudioFilesWritten,
      value: rawWritten
    }
  ];

  for (const check of thresholdChecks) {
    checks.push(formatCheck(check.label, check.pass, check.value));
    if (!check.pass) {
      failures.push(`Threshold failed: ${check.label} (value=${check.value})`);
    }
  }

  const audioFiles = findAudioFiles(resolvedRunDir);
  const noAudioFiles = audioFiles.length === 0;
  checks.push(formatCheck("no persisted raw audio-like files", noAudioFiles, noAudioFiles ? 0 : audioFiles.length));
  if (!noAudioFiles) {
    failures.push(`Raw audio-like files found:\n${audioFiles.join("\n")}`);
  }

  for (const check of checks) {
    console.log(check);
  }

  if (failures.length > 0) {
    for (const failure of failures) {
      console.error(failure);
    }
    process.exit(1);
  }

  console.log("Run verification passed.");
}

main();
