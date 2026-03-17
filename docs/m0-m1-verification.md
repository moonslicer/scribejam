# M0-M1 Verification Notes

This note summarizes the public verification story for the first two milestones without dragging along the internal planning scaffolding that produced it.

## Milestone Mapping

- Milestone coverage: `M0` and `M1`
- Acceptance criteria from `PLAN.md` covered:
  - audio capture + mixing feasibility
  - baseline latency/drop/memory checks
  - app-shell capture flow and typed IPC
  - degradation behavior when system capture is unavailable

## Privacy and Reliability Checks

- Raw audio was kept in memory; generated run artifacts were metadata and metrics only.
- The system-capture-unavailable path degraded to mic-only behavior instead of collapsing the meeting flow.
- The renderer-to-main microphone path was exercised through the typed preload bridge rather than direct renderer Node access.

## Evidence Sources

- M0 audio spike and decision record: `docs/m0-spike-report.md`
- M1 app foundation and milestone closeout: `docs/m1-exit-report.md`
- Smoke and unit coverage in:
  - `tests/smoke/app-launch.spec.ts`
  - `tests/unit/audio-manager.test.ts`
  - `tests/unit/audio-frame-protocol.test.ts`
  - `tests/unit/settings-store.test.ts`
  - `tests/unit/meeting-state-machine.test.ts`

## What We Intentionally Do Not Commit

- raw audio
- provider secrets
- host-identifying local environment details
- bulky local run outputs that can be regenerated from the harness/scripts

That keeps the public repo focused on the engineering decisions and the product code rather than local build debris.
