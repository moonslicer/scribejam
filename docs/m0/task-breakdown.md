# M0 Task Breakdown

This is the executable work breakdown for M0.
Each task is complete only when its listed evidence exists.

## M0-01 Test Contract Lock

- Goal: freeze thresholds, scenarios, and artifact requirements.
- Inputs: `PLAN.md`, `AGENTS.md`.
- Outputs:
  - `docs/m0/test-plan.md`
- Verifiable checks:
  - threshold table present
  - scenario matrix present
  - go/no-go policy present
- Status: `DONE`

## M0-02 Reproducible Runbook

- Goal: enforce consistent run execution and post-run audits.
- Outputs:
  - `docs/m0/runbook.md`
- Verifiable checks:
  - pre-run checklist present
  - post-run artifact and raw-audio audit commands present
- Status: `DONE`

## M0-03 Evidence Templates + Schemas

- Goal: prevent inconsistent or non-machine-readable run outputs.
- Outputs:
  - `docs/m0/templates/metadata.template.json`
  - `docs/m0/templates/metrics.template.json`
  - `docs/m0/templates/notes.template.md`
  - `docs/m0/schemas/metadata.schema.json`
  - `docs/m0/schemas/metrics.schema.json`
  - `docs/m0/schemas/event.schema.json`
- Verifiable checks:
  - templates and schemas load as valid JSON
  - required keys align to M0 metrics
- Status: `DONE`

## M0-04 Spike Harness Bootstrap

- Goal: minimal runnable harness for system+mic capture, IPC framing, and structured metrics output.
- Outputs:
  - `spike/m0-harness/` (to be implemented)
- Verifiable checks:
  - harness launches on target Mac
  - emits framed events with `source`, `ts`, `seq`
  - no raw audio persisted to disk
- Status: `TODO`

## M0-05 Scenario Execution

- Goal: run S1-S6 matrix across config variants and collect artifacts.
- Outputs:
  - `docs/m0/runs/<run-id>/*`
- Verifiable checks:
  - all required files present for each completed run
  - metric thresholds evaluated per run
- Status: `TODO`

## M0-06 Final Gate Report

- Goal: produce formal M1 go/no-go decision.
- Outputs:
  - `docs/m0-spike-report.md`
- Verifiable checks:
  - metrics table complete with threshold comparison
  - selected frame size/mix cadence documented
  - decision explicitly set to `GO` or `NO-GO`
- Status: `IN_PROGRESS` (template created, data pending)
