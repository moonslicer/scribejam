# M0 Spike Report (Technical Validation Gate)

Status: `DRAFT`
Decision: `TBD`

## Milestone Mapping

- Milestone: `M0`
- Acceptance criteria from `PLAN.md`:
  - [ ] `audioteejs` system capture + mic capture + IPC framing validated on one target Mac
  - [ ] Deepgram mixed-input end-to-end transcription validated
  - [ ] Baseline metrics collected for 30-minute session
  - [ ] Chosen frame size + mix cadence recorded
  - [ ] Issues/risks and go/no-go decision recorded

## Environment

- Date:
- Operator:
- Machine:
- macOS:
- CPU architecture:
- Node:
- Electron:
- `audioteejs`:
- Deepgram setup:
- Commit/snapshot:

## Scenarios Executed

| Scenario | Config | Result | Run ID | Evidence Path |
|---|---|---|---|---|
| S1_system_only_10m |  |  |  |  |
| S2_mic_only_10m |  |  |  |  |
| S3_mixed_10m |  |  |  |  |
| S4_mixed_soak_30m |  |  |  |  |
| S5_network_drop |  |  |  |  |
| S6_system_unavailable |  |  |  |  |

## Baseline Metrics

| Metric | Threshold | Measured | Pass/Fail |
|---|---:|---:|---|
| Transcript latency p95 (ms) | <= 2500 |  |  |
| Dropped frame rate (%) | < 1.0 |  |  |
| Memory growth over 30m (MB) | <= 250 |  |  |
| Reconnect attempts per incident | <= 3 |  |  |
| Raw audio files written | = 0 |  |  |

## Configuration Decision

- Selected frame size:
- Selected mix cadence:
- Why selected:
- Rejected alternatives and why:

## Reliability and Degradation Findings

- Network interruption behavior:
- Deepgram disconnect/reconnect behavior:
- `audioteejs` unavailable behavior (mic-only fallback):
- Residual reliability risks:

## Privacy and Invariant Audit

- Raw audio persistence audit command:
- Result:
- Any invariant concerns:

## Issues and Mitigations

1.
2.
3.

## Go/No-Go for M1

- Decision: `GO` or `NO-GO`
- Rationale:
- Blockers (if NO-GO):
- Owner and next action:

## Verification Steps Executed

1. Confirmed all required artifacts exist per run under `docs/m0/runs/`.
2. Confirmed metrics are sourced from run artifacts, not narrative estimates.
3. Confirmed explicit threshold comparison table is complete.
