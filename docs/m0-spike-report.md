# M0: Audio Spike and Product Boundary Decisions

`M0` was the technical spike that answered one question: can Scribejam capture local system + mic audio, mix it deterministically, and hand it to a cloud STT boundary without violating the product rules in `AGENTS.md`?

## Milestone Mapping

- Milestone: `M0`
- Acceptance criteria from `PLAN.md` covered:
  - `audiotee` system capture exercised on a target Mac
  - mixed-input Deepgram transcription validated
  - baseline latency, drop-rate, and memory metrics collected
  - frame size and mix cadence selected for the next milestone
  - explicit go/no-go decision recorded

## What We Proved

- The capture path can normalize sources to one PCM16 mono format and emit fixed framed audio with monotonic metadata.
- Deterministic mixing on a `100ms` cadence with `20ms` frames was stable enough to move into product implementation.
- The privacy boundary held during the spike: raw audio stayed in memory and run artifacts were structured metadata, metrics, and notes only.
- The architecture choice in `AGENTS.md` held up: low-level capture/orchestration belongs in the main process, while product UX can stay in the renderer.

## Key Results

- Real mixed-input runs met the latency and dropped-frame gates needed to proceed.
- The chosen default from the spike was:
  - frame size: `20ms`
  - mix cadence: `100ms`
- The app remained on a local-capture, cloud-assisted path rather than introducing any server-side meeting bot or raw-audio persistence.

## What M0 Did Not Finish

- Renderer mic IPC validation was deferred to `M1`.
- Full reconnect and network-drop hardening remained `M2` work.
- The spike harness was intentionally narrower than the product: it proved the audio and STT seam before the app shell existed.

## Verification Steps Executed

1. Ran full-duration real capture sessions for the core mixed-input scenarios.
2. Measured transcript latency, dropped-frame rate, memory growth, and raw-audio write count against the M0 gates in `PLAN.md`.
3. Audited generated evidence to confirm raw audio was not written to disk.

## Public Repo Note

Generated spike run artifacts are intentionally not committed to this repo. The public value is the decision record and the harness code, not a pile of local run outputs.
