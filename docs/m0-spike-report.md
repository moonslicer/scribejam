# M0 Spike Report (Technical Validation Gate)

Status: `DRAFT (bootstrap evidence added)`
Decision: `NO-GO (pending real-device provider validation)`

## Milestone Mapping

- Milestone: `M0`
- Acceptance criteria from `PLAN.md`:
  - [ ] `audioteejs` system capture + mic capture + IPC framing validated on one target Mac
  - [ ] Deepgram mixed-input end-to-end transcription validated
  - [ ] Baseline metrics collected for 30-minute session
  - [ ] Chosen frame size + mix cadence recorded
  - [ ] Issues/risks and go/no-go decision recorded

## Environment

- Date: `2026-03-11` to `2026-03-12`
- Operator: `hao`
- Machine: local macOS host
- macOS: from run metadata (`os.release` in harness output)
- CPU architecture: from run metadata (`os.arch` in harness output)
- Node: `redacted`
- Electron: not yet integrated in harness
- `audioteejs`: adapter boundary only (not exercised with real package stream in this batch)
- Deepgram setup: adapter boundary only (mock STT mode in this batch)
- Commit/snapshot: local workspace

## Scenarios Executed

| Scenario | Config | Result | Run ID | Evidence Path |
|---|---|---|---|---|
| S1_system_only_10m | CFG-B (quick) | PASS | m0-20260312-s1-system-only-10m-cfg-b-batch-2026-03-12t05-15-56-096z | docs/m0/runs/m0-20260312-s1-system-only-10m-cfg-b-batch-2026-03-12t05-15-56-096z |
| S2_mic_only_10m | CFG-B (quick) | PASS | m0-20260312-s2-mic-only-10m-cfg-b-batch-2026-03-12t05-15-56-096z | docs/m0/runs/m0-20260312-s2-mic-only-10m-cfg-b-batch-2026-03-12t05-15-56-096z |
| S3_mixed_10m | CFG-B (quick) | PASS | m0-20260312-s3-mixed-10m-cfg-b-batch-2026-03-12t05-15-56-096z | docs/m0/runs/m0-20260312-s3-mixed-10m-cfg-b-batch-2026-03-12t05-15-56-096z |
| S4_mixed_soak_30m | CFG-B (quick) | PASS | m0-20260312-s4-mixed-soak-30m-cfg-b-batch-2026-03-12t05-15-56-096z | docs/m0/runs/m0-20260312-s4-mixed-soak-30m-cfg-b-batch-2026-03-12t05-15-56-096z |
| S5_network_drop | CFG-B (quick) | PASS | m0-20260312-s5-network-drop-cfg-b-batch-2026-03-12t05-15-56-096z | docs/m0/runs/m0-20260312-s5-network-drop-cfg-b-batch-2026-03-12t05-15-56-096z |
| S6_system_unavailable | CFG-B (quick) | PASS | m0-20260312-s6-system-unavailable-cfg-b-batch-2026-03-12t05-15-56-096z | docs/m0/runs/m0-20260312-s6-system-unavailable-cfg-b-batch-2026-03-12t05-15-56-096z |

## Baseline Metrics

| Metric | Threshold | Measured | Pass/Fail |
|---|---:|---:|---|
| Transcript latency p95 (ms) | <= 2500 | 710-902 across quick S1-S6 runs | PASS |
| Dropped frame rate (%) | < 1.0 | 0 in all quick runs | PASS |
| Memory growth over 30m (MB) | <= 250 | 5.45-9.34 observed in quick runs | PASS (non-30m quick runs) |
| Reconnect attempts per incident | <= 3 | 1 observed in S5 quick run | PASS |
| Raw audio files written | = 0 | 0 in all quick runs | PASS |

## Configuration Decision

- Selected frame size:
- Selected mix cadence:
- Why selected:
- Rejected alternatives and why:

## Reliability and Degradation Findings

- Network interruption behavior: mock S5 drill recovered with 1 reconnect attempt.
- Deepgram disconnect/reconnect behavior: exercised via mock adapter only.
- `audioteejs` unavailable behavior (mic-only fallback): exercised in S2/S6 with `system_capture_mode=unavailable`, fallback success true.
- Residual reliability risks:
  - real `audioteejs` stream API not yet wired/exercised in this report
  - real Deepgram websocket behavior not yet exercised in this report
  - quick run durations do not satisfy full soak requirements

## Privacy and Invariant Audit

- Raw audio persistence audit command:
- Result:
- Any invariant concerns:

## Issues and Mitigations

1. Real `audioteejs` capture integration is pending.
2. Real Deepgram streaming integration is pending.
3. Full-duration matrix and true 30-minute soak evidence is pending.

## Go/No-Go for M1

- Decision: `NO-GO`
- Rationale: only bootstrap mock-mode evidence is complete; gate requires real-device `audioteejs` + Deepgram validation with full-duration runs.
- Blockers (if NO-GO):
  - Implement and validate real `audioteejs` adapter path.
  - Implement and validate Deepgram websocket adapter path.
  - Execute `--mode full` scenario matrix on target Mac with provider keys.
- Owner and next action:
  - Owner: current implementation agent/user pair.
  - Next action: run real-provider integration tasks and rerun full matrix.

## Verification Steps Executed

1. Confirmed all required artifacts exist per run under `docs/m0/runs/`.
2. Confirmed metrics are sourced from run artifacts, not narrative estimates.
3. Confirmed explicit threshold comparison table is complete.
