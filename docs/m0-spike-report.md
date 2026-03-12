# M0 Spike Report (Technical Validation Gate)

Status: `FINAL`
Decision: `GO (WAIVED)`

## Milestone Mapping

- Milestone: `M0`
- Acceptance criteria from `PLAN.md`:
  - [x] `audiotee` system capture path exercised on one target Mac
  - [ ] mic capture + IPC framing validated on target Mac (**waived for M1 start**)
  - [x] Deepgram mixed-input end-to-end transcription validated with real system + mic sources (mic source is harness mock, not renderer IPC)
  - [x] Baseline metrics collected for a real 30-minute mixed session
  - [x] Chosen frame size + mix cadence recorded (CFG-B)
  - [x] Issues/risks and go/no-go decision recorded

## Environment

- Date: `2026-03-11` to `2026-03-12`
- Operator: `hao`
- Machine: `redacted`
- CPU architecture: `arm64`
- macOS: `redacted`
- Node: `redacted`
- Electron: not integrated in harness
- Deepgram SDK: `@deepgram/sdk v5.0.0`
- Commit/snapshot: local workspace

## Scenarios Executed

| Scenario | Config | Capture | STT | Duration | Result | Run ID |
|---|---|---|---|---|---|---|
| S1_system_only_10m | CFG-B | real `audioteejs` + mic disabled | real Deepgram | 10m | PASS | `m0-20260312-s1-system-only-10m-cfg-b-batch-2026-03-12t18-21-54-937z` |
| S2_mic_only_10m | CFG-B | system unavailable + mock mic | real Deepgram | 10m | PASS | `m0-20260312-s2-mic-only-10m-cfg-b-batch-2026-03-12t18-21-54-937z` |
| S3_mixed_10m | CFG-B | real `audioteejs` + mock mic | real Deepgram | 10m | PASS | `m0-20260312-s3-mixed-10m-cfg-b-batch-2026-03-12t18-21-54-937z` |
| S4_mixed_soak_30m | CFG-B | real `audioteejs` + mock mic | real Deepgram | 30m | PASS | `m0-20260312-s4-mixed-soak-30m-cfg-b-batch-2026-03-12t18-21-54-937z` |
| S5_network_drop | CFG-B | real `audioteejs` + mock mic | real Deepgram | partial | INCOMPLETE ARTIFACT SET | `m0-20260312-s5-network-drop-cfg-b-batch-2026-03-12t18-21-54-937z` |
| S6_system_unavailable | CFG-B | not executed in this batch | n/a | n/a | NOT EXECUTED | n/a |

## Baseline Metrics (From Completed Full Real Runs)

| Metric | Threshold | Measured | Gate Status |
|---|---:|---:|---|
| Transcript latency p95 (ms) | <= 2500 | 98 (S1), 93 (S3), 90 (S4) | Pass |
| Dropped frame rate (%) | < 1.0 | 0 (S1/S3), 0.2193 (S4) | Pass |
| Memory growth over 30m (MB) | <= 250 | -39.23 (S4) | Pass |
| Reconnect attempts per incident | <= 3 | 0 (S1/S3/S4) | Partial evidence (no completed real drop drill) |
| Raw audio files written | = 0 | 0 (verified runs) | Pass |

## Configuration Decision

- Selected frame size: `20ms` (CFG-B)
- Selected mix cadence: `100ms` (CFG-B)
- Why selected: best full-run stability/latency evidence in current spike artifacts.

## Waivers (Explicit)

1. Mic IPC framing validation on target Mac is incomplete.
   - Rationale: user requested M0 pass to unblock progress; full renderer->main mic path can be validated in M1 implementation context.
   - Owner: implementation agent/user pair.
   - Carry-forward milestone: `M1`.
2. Real network-drop and reconnect drill evidence is incomplete for this gate decision.
   - Rationale: S5 run directory has only `events.ndjson` and fails artifact completeness verification.
   - Owner: implementation agent/user pair.
   - Carry-forward milestone: `M2`.
3. Real `system_unavailable` drill was not completed in the latest full run batch.
   - Rationale: degradation behavior already exercised in earlier quick-mode runs; full evidence deferred.
   - Owner: implementation agent/user pair.
   - Carry-forward milestone: `M1`.

## Privacy and Invariant Audit

- Verified completed full runs with:
  - `node scripts/m0/verify-run.mjs docs/m0/runs/<run-id>`
  - `find docs/m0/runs/<run-id> -type f \( -name "*.wav" -o -name "*.pcm" -o -name "*.raw" \)`
- Result: no raw audio-like files detected in verified run directories.
- Invariant concerns: none observed for raw-audio persistence.

## Go/No-Go for M1

- Decision: `GO (WAIVED)`
- Decision date: `2026-03-12`
- Basis:
  - full-duration real S1/S3/S4 runs completed with metrics inside thresholds
  - privacy invariant checks pass on verified runs
  - remaining evidence gaps are explicitly waived and moved into M1/M2 carry-forward tasks

## Carry-Forward Tasks (Mandatory)

1. Validate real mic capture via renderer IPC (not harness mock) and attach run artifacts.
2. Complete real-provider S5 network-drop drill with full artifact set (`metadata.json`, `metrics.json`, `events.ndjson`, `notes.md`).
3. Complete real-provider S6 `audioteejs` unavailable drill and confirm mic-only degradation behavior end-to-end.
4. Tighten `verify-run.mjs` to fail runs with missing transcript evidence for speech scenarios.

## Verification Steps Executed

1. Verified full-run metrics for S1/S3/S4 from `2026-03-12T18:21:54Z` batch artifacts.
2. Ran `verify-run.mjs` successfully on S1/S2/S3/S4 completed run directories.
3. Confirmed S5 run verification fails due missing required files (artifact incompleteness captured as waiver).
