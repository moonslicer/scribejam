# M0 Harness Bootstrap

This harness is the executable bootstrap for `M0-04` in `docs/m0/task-breakdown.md`.

## Purpose

- Generate framed system/mic audio events (mock by default).
- Mix frames on deterministic cadence.
- Stream mixed frames to an STT adapter boundary.
- Emit run artifacts compatible with `docs/m0` verification:
  - `metadata.json`
  - `metrics.json`
  - `events.ndjson`
  - `notes.md`

## Modes

- `--system-capture-mode mock|audioteejs|unavailable`
- `--mic-capture-mode mock|ipc`
- `--stt-mode mock|deepgram`

`audioteejs` and Deepgram paths are bootstrap boundaries in this task.
Concrete provider wiring is expected during live M0 execution on target Mac.

## Usage

Install dependencies in this folder, then run:

```bash
npm install
npm run build
npm start -- \
  --run-id m0-20260311-S3-CFG-B \
  --scenario S3_mixed_10m \
  --duration-sec 120 \
  --frame-size-ms 20 \
  --mix-cadence-ms 100 \
  --system-capture-mode mock \
  --mic-capture-mode mock \
  --stt-mode mock
```

The run writes artifacts under `docs/m0/runs/<run-id>/`.

Validate artifacts:

```bash
node scripts/m0/verify-run.mjs docs/m0/runs/<run-id>
```

## Notes

- Raw audio payloads are processed in memory and not persisted.
- The harness intentionally prioritizes deterministic instrumentation over UI.
