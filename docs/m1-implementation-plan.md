# M1 Detailed Implementation Plan (Junior Handoff)

Status: `Completed (2026-03-12)`
Milestone: `M1 - Project Scaffold & Audio Capture`
Source of truth: `AGENTS.md` + `PLAN.md`

## 1) Milestone Intent

M1 builds the product foundation:
- app scaffold and process boundaries
- local audio capture plumbing (system + mic)
- secure settings shell
- basic meeting controls/status UX
- test + CI baseline

Why this milestone exists:
- It de-risks architecture before transcription complexity (M2).
- It enforces privacy/reliability invariants early.
- It closes M0 carry-forward items needed to trust the pipeline.

## 2) Exit Criteria (M1 Done)

M1 is done only when all are true:

1. PLAN M1 scope items are implemented (`PLAN.md`, M1 items 1-8).
2. Milestone gates pass:
   - Invariant gate
   - Degradation gate
   - Architecture gate
   - Verification gate
3. M1 testing passes:
   - unit tests: audio frame protocol, settings storage, meeting state transitions
   - CI startup smoke test
4. M0 carry-forward closed for M1:
   - real mic capture via renderer IPC evidence
   - real `audioteejs` unavailable -> mic-only degradation evidence

## 3) Non-Goals (Do Not Pull Into M1)

Keep out of M1 unless explicitly approved:
- live transcript rendering (M2)
- Deepgram production streaming flow in app UI (M2)
- editor/persistence features (M3)
- enhancement engine (M4)

## 4) Required Invariants (Must Hold Throughout)

From `AGENTS.md`:
- no meeting bot
- capture local on-device
- raw audio never persisted to disk
- typed IPC through `contextBridge`
- main process owns orchestration/state/storage/network calls
- renderer owns interaction/presentation/mic capture worklet
- degraded behavior preferred over hard failure

## 5) Work Breakdown (Task / Deliverable / Verification)

## M1-01 Project Scaffold

- Task:
  - Initialize Electron + React + TypeScript + Vite + Tailwind + electron-builder.
  - Create baseline folder structure aligned to `PLAN.md` project structure.
- Deliverables:
  - `package.json` scripts: `dev`, `build`, `typecheck`, `test`, `smoke`, `rebuild-native`
  - `src/main/index.ts`, `src/preload/index.ts`, `src/renderer/App.tsx`
  - `electron-builder.yml`, `tsconfig*.json`, Vite config (`vite.config.mts`)
- Verification:
  - `npm run typecheck` passes
  - `npm run dev` opens app window
  - `npm run build` succeeds

## M1-02 Security Baseline + IPC Contract

- Task:
  - Enforce hardened BrowserWindow defaults (`contextIsolation`, no `nodeIntegration`).
  - Define typed IPC contract in one shared file.
  - Expose least-privilege preload API only.
- Deliverables:
  - `src/shared/ipc.ts` with request/response/event types
  - `src/preload/index.ts` typed API surface
  - `src/main/ipc-handlers.ts` handlers for `meeting:start`, `meeting:stop`, `settings:get`, `settings:save`, `audio:mic-frames`
- Verification:
  - Renderer compiles without direct `ipcRenderer` imports
  - TypeScript fails if IPC payload shape is broken
  - Manual: start/stop calls roundtrip successfully

## M1-03 Meeting State Skeleton (Main Authoritative)

- Task:
  - Implement minimal state machine for `idle -> recording -> stopped`.
  - Emit `meeting:state-changed` event to renderer.
- Deliverables:
  - `src/main/meeting/state-machine.ts`
  - state transition guards + explicit transition API
- Verification:
  - Unit test: valid transitions pass, invalid transitions reject
  - Manual: Start/Stop updates UI state predictably

## M1-04 System Audio Capture Adapter (Main)

- Task:
  - Add `audioteejs` adapter in main process.
  - Normalize to framed PCM16 mono metadata (`source`, `seq`, `ts`).
  - Handle permission/import failure by switching to mic-only mode.
- Deliverables:
  - `src/main/audio/audio-manager.ts`
  - `src/main/audio/system-capture.ts`
  - structured diagnostics (no secrets, no raw payload logs)
- Verification:
  - Manual: system capture frames increment monotonically while recording
  - Manual: deny/remove system capture and verify graceful mic-only fallback banner/event
  - Audit: no `.wav/.pcm/.raw` output files created

## M1-05 Mic Capture via AudioWorklet + IPC

- Task:
  - Capture mic in renderer via Web Audio API/AudioWorklet.
  - Convert to PCM16 mono frames and send over `audio:mic-frames`.
  - Include monotonic `seq` + timestamp.
- Deliverables:
  - `src/renderer/audio/mic-worklet.ts`
  - `src/renderer/audio/useMicCapture.ts` (or equivalent hook/module)
  - IPC sender integration in renderer
- Verification:
  - Unit test: frame encoder produces expected byte/sample sizes
  - Manual: mic permission granted -> frames received in main
  - Manual: mic permission denied -> user-visible error and app remains stable

## M1-06 Main Audio Intake + Level Meter Eventing

- Task:
  - Receive mic/system frames in main.
  - Validate IPC payload at boundary.
  - Compute RMS level and emit `audio:level` to renderer.
  - Keep bounded in-memory buffering only.
- Deliverables:
  - `src/main/audio/mic-capture.ts`
  - `src/main/audio/level-meter.ts`
  - `audio:level` event plumbing
- Verification:
  - Unit test: invalid frame payload rejected safely
  - Unit test: RMS computation deterministic for known sample input
  - Manual: level indicator responds to voice/system activity

## M1-07 Settings Infrastructure (`safeStorage`)

- Task:
  - Implement settings store with `safeStorage` encrypted key storage.
  - Provide settings get/save IPC and first-run flag persistence.
- Deliverables:
  - `src/main/settings/settings-store.ts`
  - `src/main/settings/secure-secrets.ts`
  - renderer settings shell page (fields can be placeholder except storage wiring)
- Verification:
  - Unit test: save/load roundtrip for settings
  - Unit test: secret stored/retrieved via secure wrapper (no plaintext logs)
  - Manual: restart app and confirm settings persist

## M1-08 Basic UX Shell (Notepad-First Control Layer)

- Task:
  - Build minimal UI with meeting controls and status.
  - Include:
    - Start/Stop button
    - current meeting state text
    - mic/system level indicators
    - error banner/toast for degradation
- Deliverables:
  - `src/renderer/components/MeetingBar.tsx`
  - `src/renderer/components/AudioLevel.tsx`
  - app-level status/error surface
- Verification:
  - Manual: Start -> Recording, Stop -> Stopped
  - Manual: level indicators update
  - Manual: fallback/degradation messages are visible and actionable

## M1-09 Native Dependency Discipline + CI Baseline

- Task:
  - Pin Electron version.
  - Add `@electron/rebuild` flow after install and before packaging.
  - Add CI startup smoke.
- Deliverables:
  - pinned Electron in `package.json`
  - `postinstall` / explicit `rebuild-native` script
  - CI workflow job for install, rebuild, startup smoke
- Verification:
  - Fresh clone install passes on target Mac
  - `npm run rebuild-native` succeeds
  - CI smoke job green

## M1-10 Automated Tests (Required by PLAN)

- Task:
  - Add test infrastructure and initial suites.
  - Required suites:
    - audio frame protocol
    - settings read/write
    - meeting state transitions
  - Add renderer smoke (Playwright or equivalent) for app launch.
- Deliverables:
  - test config files
  - unit tests under `tests/unit/*`
  - smoke test under `tests/smoke/*`
- Verification:
  - `npm test` passes
  - `npm run smoke` passes locally and in CI

## M1-11 M0 Carry-Forward Validation Evidence

- Task:
  - Produce M1 evidence artifacts for waived M0 items owned by M1:
    - real renderer mic IPC validation
    - real `audioteejs` unavailable degradation validation
- Deliverables:
  - `docs/m1/validation/mic-ipc-<date>.md`
  - `docs/m1/validation/system-unavailable-<date>.md`
  - include environment, steps, observed behavior, and pass/fail
- Verification:
  - each validation doc includes reproducible steps and outcomes
  - artifacts demonstrate no raw audio persistence

## M1-12 Milestone Wrap-Up

- Task:
  - Prepare milestone closeout note with residual risks and M2 handoff.
- Deliverables:
  - `docs/m1-exit-report.md`
  - updated `PLAN.md` checkboxes/status (if tracked there)
- Verification:
  - exit report explicitly maps each M1 acceptance item to evidence
  - residual risks are listed with owner and follow-up milestone

## 6) Suggested Execution Order

1. M1-01 scaffold
2. M1-02 IPC/security
3. M1-03 state machine
4. M1-04 system capture
5. M1-05 mic worklet + IPC
6. M1-06 level metering
7. M1-07 settings
8. M1-08 UI shell
9. M1-09 native/CI
10. M1-10 tests
11. M1-11 carry-forward evidence
12. M1-12 exit report

## 7) E2E Verifiable Outcome (What You Should See)

By end of M1, a reviewer can do this on a target Mac:

1. Launch app successfully.
2. Click Start Recording.
3. Speak into mic and play system audio.
4. Observe mic/system level indicators updating.
5. Confirm meeting state events transition correctly.
6. Simulate unavailable system capture and observe mic-only degradation (no crash).
7. Click Stop Recording cleanly.
8. Restart app and confirm settings persist.
9. Confirm no raw audio files are written to disk.

If all 9 steps pass and automated tests/smoke are green, M1 is complete.

## 8) Risks to Watch During Implementation

1. Native ABI mismatch (`audioteejs`) after Electron changes.
2. Renderer->main IPC throughput spikes causing dropped/late mic frames.
3. Overly broad preload API leaking privileged access.
4. Permission-denied edge cases causing dead UI states.

Mitigation: keep modules small, typed boundaries strict, and verify each task immediately after implementation.
