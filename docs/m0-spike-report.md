# M0 Spike Report (Technical Validation Gate)

Status: `DRAFT`
Decision: `NO-GO`

## Milestone Mapping

- Milestone: `M0`
- Acceptance criteria from `PLAN.md`:
  - [x] `audiotee` system capture path exercised on one target Mac (S1 real-provider run; pre-fix wiring still included mic mock frames)
  - [ ] mic capture + IPC framing validated on target Mac (adapter exists, run evidence pending)
  - [ ] Deepgram mixed-input end-to-end transcription validated with real system+mic sources
  - [ ] Baseline metrics collected for a real 30-minute mixed session
  - [x] Chosen frame size + mix cadence recorded (provisional CFG-B)
  - [x] Issues/risks and go/no-go decision recorded

## Environment

- Date: `2026-03-11` to `2026-03-12`
- Operator: `hao`
- Machine: `redacted`
- CPU architecture: `arm64`
- macOS: `redacted`
- Node: `redacted`
- Electron: not yet integrated in harness
- `audiotee`: `v0.0.7`
- Deepgram: `@deepgram/sdk v5.0.0`
- Commit/snapshot: local workspace

## Scenarios Executed

| Scenario | Config | Capture | STT | Duration | Result | Run ID |
|---|---|---|---|---|---|---|
| S1_system_only_10m | CFG-B | real audiotee + mock mic (pre-fix wiring) | **real Deepgram** | 10m | PASS (non-conforming semantics) | m0-20260312-s1-system-only-10m-cfg-b-batch-2026-03-12t06-59-04-591z |
| S2_mic_only_10m | CFG-B | mock | mock | 15s (quick) | PASS | m0-20260312-s2-mic-only-10m-cfg-b-batch-2026-03-12t06-24-48-746z |
| S3_mixed_10m | CFG-B | mock | mock | 15s (quick) | PASS | m0-20260312-s3-mixed-10m-cfg-b-batch-2026-03-12t06-24-48-746z |
| S4_mixed_soak_30m | CFG-B | mock | mock | 30s (quick) | PASS | m0-20260312-s4-mixed-soak-30m-cfg-b-batch-2026-03-12t06-24-48-746z |
| S5_network_drop | CFG-B | mock | mock | 20s | PASS | m0-20260312-s5-network-drop-cfg-b-batch-2026-03-12t06-24-48-746z |
| S6_system_unavailable | CFG-B | mock/unavail | mock | 20s | PASS | m0-20260312-s6-system-unavailable-cfg-b-batch-2026-03-12t06-24-48-746z |

S1 was run with real system capture and real Deepgram WebSocket STT for 10 minutes, but the run predates strict system-only wiring and still included mic mock frames. S2-S6 runs were quick-mode mock validations and are non-gating for M1 go/no-go.

## Baseline Metrics

| Metric | Threshold | Measured | Gate Status |
|---|---:|---:|---|
| Transcript latency p95 (ms) | <= 2500 | 97 (S1 real), 858 (S4 quick) | Partial evidence |
| Dropped frame rate (%) | < 1.0 | 0 across recorded runs | Partial evidence |
| Memory growth over 30m (MB) | <= 250 | only 30s quick soak measured | Not met |
| Reconnect attempts per incident | <= 3 | 1 observed in S5 quick mock | Partial evidence |
| Raw audio files written | = 0 | 0 across verified runs | Pass |

## Configuration Decision

- Selected frame size: `20ms` (CFG-B, provisional)
- Selected mix cadence: `100ms` (CFG-B, provisional)
- Why selected: stable latency and zero dropped frames in current runs with simpler buffering than 10ms/50ms.
- Rejected alternatives and why: CFG-A and CFG-C have not been run with real-provider full-duration evidence yet.

## Reliability and Degradation Findings

- Network interruption behavior: recovered in mock S5 drill.
- `audiotee` unavailable behavior (mic-only fallback): exercised in S2/S6 mock runs.
- Deepgram reconnect metrics were patched on `2026-03-12` to avoid counting initial connect and normal shutdown as reconnect events.
- Residual reliability risks:
  - real mixed-input Deepgram behavior (S3/S4) not yet evidenced
  - mic IPC framing is not yet evidenced on target Mac
  - 30-minute mixed soak is still pending

## Privacy and Invariant Audit

- Raw audio persistence audit command:
  - `node scripts/m0/verify-run.mjs docs/m0/runs/<run-id>`
  - `find docs/m0/runs/<run-id> -type f \( -name "*.wav" -o -name "*.pcm" -o -name "*.raw" \)`
- Result: all checked runs reported `raw_audio_files_written: 0` and no persisted audio-like files.
- Any invariant concerns: none observed for raw-audio persistence.

## Issues and Mitigations

1. Full real-provider mixed scenarios (S3/S4) are missing.
2. Full-duration 30-minute mixed soak evidence is missing.
3. Mic IPC capture validation evidence is missing.

## Go/No-Go for M1

- Decision: `NO-GO`
- Rationale: current evidence is insufficient for M1 gate. Only S1 is real-provider and S3/S4 mixed real runs are not present.
- Blockers (if NO-GO):
  - Rerun `S1_system_only_10m` with mic disabled (`mic-capture-mode none`) after the scenario wiring fix.
  - Execute `--mode full --capture real --stt deepgram` matrix on target Mac.
  - Ensure S3/S4 are real mixed-input runs and S4 is full 30 minutes.
  - Run a dedicated mic IPC framing validation on target Mac and attach artifacts.
- Owner and next action:
  - Owner: current implementation agent/user pair.
  - Next action: rerun evidence with patched harness metrics and update this report.

## Verification Steps Executed

1. Confirmed required artifact files exist for referenced runs under `docs/m0/runs/`.
2. Cross-checked reported values against `metrics.json` and `metadata.json`.
3. Marked non-gating quick runs explicitly to avoid false `GO` interpretation.
