# M1 Validation - System Capture Unavailable Degradation

Date: `2026-03-12`  
Milestone: `M1`  
Acceptance mapping: `PLAN.md` M1 items 4, 7, 8 and degradation gate

## Objective

Validate graceful fallback to mic-only mode when system capture is unavailable, without breaking recording controls.

## Steps Executed

1. Build and run Playwright M1 smoke suite:
   - `npm run smoke:playwright`
2. Degradation test executed as part of suite:
   - `tests/smoke/app-launch.spec.ts` test: `forced system unavailable shows degradation banner and remains usable`
3. Forced unavailable mode via test environment:
   - `SCRIBEJAM_FORCE_SYSTEM_UNAVAILABLE=1`
4. Start recording and verify:
   - meeting transitions to `recording`
   - user-visible degradation banner appears
   - stop action still succeeds and state transitions to `stopped`

## Observed Evidence

- System unavailability toggle:
  - `src/main/audio/system-capture.ts:46`
- Unavailable callback emits user-facing fallback message:
  - `src/main/audio/audio-manager.ts:41`
- Smoke assertion for fallback banner and usability:
  - `tests/smoke/app-launch.spec.ts:198`
  - message asserted: `System audio unavailable — recording microphone only.`

## Raw Audio Persistence Audit

- Source audit confirms no raw audio file writes in audio pipeline modules.
- Audio handling is in-memory frame ingestion/queueing:
  - `src/main/audio/audio-manager.ts:23`
  - `src/main/audio/system-capture.ts:63`
- File writes are confined to settings/secrets JSON:
  - `src/main/settings/settings-store.ts:94`
  - `src/main/settings/secure-secrets.ts:82`

## Result

`PASS` for graceful degradation to mic-only behavior with continued usability.

## Notes / Residual Risk

- This test validates fallback control flow deterministically.
- A manual OS-permission-denied drill on target release hardware remains recommended prior to M2 exit.
