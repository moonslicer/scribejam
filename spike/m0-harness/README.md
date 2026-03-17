# M0 Harness Bootstrap

This harness is the executable bootstrap that powered the original `M0` audio spike.

## Purpose

- Generate framed system/mic audio events (mock by default).
- Mix frames on deterministic cadence.
- Stream mixed frames to an STT adapter boundary.
- Emit local run artifacts for audit/debugging:
  - `metadata.json`
  - `metrics.json`
  - `events.ndjson`
  - `notes.md`

## Modes

- `--system-capture-mode mock|audioteejs|unavailable`
- `--mic-capture-mode mock|ipc|none`
- `--stt-mode mock|deepgram`

`audioteejs` and Deepgram paths are bootstrap boundaries in this task.
Concrete provider wiring is expected during live M0 execution on target Mac.

`none` is used for true system-only scenarios where mic input must be disabled.

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
Generated run artifacts are intentionally not committed to the public repository.

Validate artifacts:

```bash
node scripts/m0/verify-run.mjs docs/m0/runs/<run-id>
```

## Notes

- Raw audio payloads are processed in memory and not persisted.
- The harness intentionally prioritizes deterministic instrumentation over UI.
