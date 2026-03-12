# M0 Runbook

This runbook defines a reproducible execution flow for M0 spike sessions.
Use it with `docs/m0/test-plan.md`.

## Milestone Mapping

- Milestone: `M0`
- Acceptance criteria from `PLAN.md`:
  - single-Mac validation of capture + IPC framing
  - Deepgram mixed-input transcription validation
  - 30-minute baseline metrics collection
  - report-based go/no-go decision for M1

## Pre-Run Checklist

1. Confirm target Mac OS/hardware is recorded.
2. Confirm Deepgram API key is available in environment.
3. Confirm no debug path writes raw PCM/audio to disk.
4. Create run directory:

```bash
mkdir -p docs/m0/runs/<run-id>
```

5. Initialize metadata and notes files from templates:

```bash
cp docs/m0/templates/metadata.template.json docs/m0/runs/<run-id>/metadata.json
cp docs/m0/templates/notes.template.md docs/m0/runs/<run-id>/notes.md
```

## Execution Steps

1. Start spike harness with selected config (`CFG-A|CFG-B|CFG-C`).
2. Execute scenario steps from the test plan matrix.
3. Capture structured events to `events.ndjson`.
4. Write aggregated metrics to `metrics.json`.
5. Complete notes with observed anomalies and degradation behavior.

Optional scripted matrix execution (quick validation mode):

```bash
node scripts/m0/run-matrix.mjs --mode quick --config CFG-B
```

Quick mode is a harness sanity pass only; it is not a substitute for full M0 gate evidence.

Full-duration scripted matrix (mock capture + STT, no provider keys):

```bash
node scripts/m0/run-matrix.mjs --mode full --config CFG-B
```

Real-provider gating matrix (requires macOS 14.2+, System Audio Recording permission, `DEEPGRAM_API_KEY`):

```bash
DEEPGRAM_API_KEY=<key> node scripts/m0/run-matrix.mjs --mode full --config CFG-B --capture real --stt deepgram
```

`--capture real` activates the `audiotee` system audio adapter.
`--stt deepgram` activates the Deepgram v2 WebSocket adapter.
Both flags are independent — e.g. `--capture real --stt mock` validates audio capture in isolation.

## Required Event Fields

Every line in `events.ndjson` should include:

- `ts_iso`
- `run_id`
- `scenario_id`
- `event_type`
- `source` (`system|mic|mixer|stt|app`)
- `seq` (if frame event)
- `lag_ms` (if measurable)
- `buffer_depth` (if applicable)
- `message` (short, non-sensitive)

Never log:

- raw audio payloads
- API keys or secrets
- full sensitive transcript dumps

## Post-Run Checks

1. Validate artifact completeness:

```bash
test -f docs/m0/runs/<run-id>/metadata.json
test -f docs/m0/runs/<run-id>/metrics.json
test -f docs/m0/runs/<run-id>/events.ndjson
test -f docs/m0/runs/<run-id>/notes.md
```

2. Audit for raw audio persistence:

```bash
find docs/m0/runs/<run-id> -type f \( -name "*.wav" -o -name "*.pcm" -o -name "*.raw" \)
```

Expected result: no files returned.

3. Compare metrics against threshold gates in `docs/m0/test-plan.md`.

4. Run automated gate check:

```bash
node scripts/m0/verify-run.mjs docs/m0/runs/<run-id>
```

Expected result: `Run verification passed.`

## Verification Steps Executed (for this runbook artifact)

1. Verified checklist maps directly to M0 acceptance criteria.
2. Verified privacy checks include explicit no-audio-persistence audit.
