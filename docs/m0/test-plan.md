# M0 Test Plan: Technical Spike Validation Gate

This document defines the M0 test contract for Scribejam.
No M0 claim is valid without the evidence artifacts listed here.

## Milestone Mapping

- Milestone: `M0`
- PLAN acceptance criteria covered:
  - Validate `audioteejs` system capture + microphone capture + IPC framing on one target Mac.
  - Validate end-to-end Deepgram streaming transcription with mixed audio input.
  - Measure baseline metrics: transcript latency p95, dropped-frame rate, memory growth over 30 minutes.
  - Produce `docs/m0-spike-report.md` with measured metrics, chosen frame size/mix cadence, issues, and go/no-go.
- AGENTS invariants reinforced:
  - No raw audio persisted to disk.
  - Reliability/degradation behavior must be explicit and measurable.

## Test Environment Contract

Record the following in every run artifact:

- macOS version
- hardware model + CPU architecture
- Node.js version
- Electron version (if used in harness)
- `audioteejs` version
- Deepgram SDK/API mode used
- Git commit or working snapshot identifier

## Required Metrics and Thresholds

All thresholds are pass/fail gates for M0 go/no-go.

- `transcript_latency_p95_ms <= 2500`
- `dropped_frame_rate_pct < 1.0` during 30-minute mixed-input soak
- `memory_growth_mb_30m <= 250`
- `deepgram_reconnect_attempts <= 3` per disconnect incident
- `raw_audio_files_written = 0`

## Scenario Matrix

Run IDs must match this matrix naming pattern: `m0-<date>-<scenario>-<config-id>`.

### Config Variants

- `CFG-A`: frame size `10ms`, mix cadence `50ms`
- `CFG-B`: frame size `20ms`, mix cadence `100ms`
- `CFG-C`: frame size `40ms`, mix cadence `200ms`

### Core Scenarios

1. `S1_system_only_10m`: system capture only, 10 minutes
2. `S2_mic_only_10m`: mic capture only, 10 minutes
3. `S3_mixed_10m`: system + mic mixed, 10 minutes
4. `S4_mixed_soak_30m`: system + mic mixed, 30 minutes
5. `S5_network_drop`: mixed session + network interruption drill
6. `S6_system_unavailable`: `audioteejs` unavailable/failure drill (expect mic-only degradation)

## Evidence Requirements

Each scenario must produce:

- `docs/m0/runs/<run-id>/metadata.json`
- `docs/m0/runs/<run-id>/metrics.json`
- `docs/m0/runs/<run-id>/events.ndjson`
- `docs/m0/runs/<run-id>/notes.md`

No raw PCM/audio files may be written under `docs/m0/runs/`.

## Pass/Fail Rules Per Task

### M0-03 System Audio Probe

- Pass:
  - monotonic `seq` and non-decreasing `ts`
  - sustained frame flow for full run duration
- Fail:
  - capture stalls > 5 seconds without recovery
  - non-monotonic frame metadata

### M0-04 Mic Probe

- Pass:
  - stable frame production for full run duration
  - IPC transfer continuity without queue runaway
- Fail:
  - sustained drop spikes > 5% in 1-minute window

### M0-05 Mixer + Buffers

- Pass:
  - bounded queue depth
  - oldest-frame drop behavior observed under stress
- Fail:
  - unbounded memory/queue growth

### M0-06 Deepgram E2E

- Pass:
  - transcript events received continuously in mixed scenario
  - p95 latency computed from captured samples
- Fail:
  - no transcript stream or missing latency dataset

### M0-07 Degradation Drills

- Pass:
  - network interruption does not stop local capture loop
  - system-capture failure degrades to mic-only mode
- Fail:
  - full pipeline collapse or unrecoverable recording state

### M0-08 30-minute Soak

- Pass:
  - meets all threshold gates in this document
- Fail:
  - any threshold breach or missing artifact file

## Decision Policy

- `GO` for M1 requires all required scenarios completed and thresholds met.
- `NO-GO` is mandatory if any threshold fails or evidence is incomplete.
- Any waived check must include explicit rationale and owner in `docs/m0-spike-report.md`.
