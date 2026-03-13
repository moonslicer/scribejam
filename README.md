# Scribejam

Scribejam is a notepad-first AI meeting assistant for macOS.

Core product rules:
- no meeting bot joins your calls
- system audio + mic capture happen locally on device
- raw audio is in-memory only (not written to disk)
- human notes stay the anchor; AI augments later

Authoritative docs:
- product and invariants: [AGENTS.md](./AGENTS.md)
- milestone plan: [PLAN.md](./PLAN.md)
- M0 evidence and report: [docs/m0](./docs/m0), [docs/m0-spike-report.md](./docs/m0-spike-report.md)
- M1 implementation handoff: [docs/m1-implementation-plan.md](./docs/m1-implementation-plan.md)
- M1 closure evidence: [docs/m1/validation](./docs/m1/validation), [docs/m1-exit-report.md](./docs/m1-exit-report.md)
- M2 closure evidence: [docs/m2-exit-report.md](./docs/m2-exit-report.md)

## Current Repo Status

The repository now contains:
- M0 technical spike harness under `spike/m0-harness/`
- M1 Electron scaffold in `src/` with typed IPC, audio capture shell, settings shell, and smoke/unit tests
- M2 real-time transcription flow with first-run disclosure wizard, deterministic mixer pipeline, Deepgram STT integration, and live transcript panel

Milestone closure details and verification are documented in `docs/m1-exit-report.md` and `docs/m2-exit-report.md`.

## Prerequisites

- macOS (Apple Silicon tested)
- Node.js `v22+`
- npm
- optional for real STT runs: `DEEPGRAM_API_KEY`
- optional for real system capture runs: macOS "System Audio Recording" permission

## Build and Run (M0 Harness)

### 1) Install harness dependencies

```bash
cd spike/m0-harness
npm install
```

### 2) Build harness

```bash
npm run build
```

### 3) Run one harness scenario

```bash
npm start -- \
  --run-id m0-local-s3-cfg-b \
  --scenario S3_mixed_10m \
  --duration-sec 120 \
  --frame-size-ms 20 \
  --mix-cadence-ms 100 \
  --system-capture-mode mock \
  --mic-capture-mode mock \
  --stt-mode mock
```

Run artifacts are written to:
- `docs/m0/runs/<run-id>/metadata.json`
- `docs/m0/runs/<run-id>/metrics.json`
- `docs/m0/runs/<run-id>/events.ndjson`
- `docs/m0/runs/<run-id>/notes.md`

### 4) Verify artifacts

From repo root:

```bash
node scripts/m0/verify-run.mjs docs/m0/runs/<run-id>
```

## Run Matrix Helpers

From repo root:

Quick sanity matrix:

```bash
node scripts/m0/run-matrix.mjs --mode quick --config CFG-B
```

Full-duration mock matrix:

```bash
node scripts/m0/run-matrix.mjs --mode full --config CFG-B
```

Real-provider matrix (requires key + macOS permission):

```bash
DEEPGRAM_API_KEY=<key> node scripts/m0/run-matrix.mjs --mode full --config CFG-B --capture real --stt deepgram
```

## Build Philosophy

Scribejam prioritizes:
- reliability over cleverness
- explicit typed contracts between renderer/main
- graceful degradation (mic-only fallback, resilient state handling)
- privacy by default

See [AGENTS.md](./AGENTS.md) for full constraints.
