# M0 Evidence Pack

Use this folder to execute and audit Milestone 0.

## Files

- `test-plan.md`: threshold gates, scenario matrix, pass/fail contract
- `runbook.md`: reproducible run procedure
- `task-breakdown.md`: task-level work packets and evidence expectations
- `templates/`: seed files for each run artifact
- `schemas/`: JSON schemas for run artifacts
- `runs/`: per-run evidence folders

## Quick Start

1. Read `test-plan.md`.
2. Create a run directory in `runs/`.
3. Copy templates into that run directory.
4. Execute scenarios in `runbook.md`.
5. Validate run artifacts:

```bash
node scripts/m0/verify-run.mjs docs/m0/runs/<run-id>
```

6. Aggregate results in `docs/m0-spike-report.md`.
