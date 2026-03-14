# Playwright Test Plan (Electron App)

Status: `In progress (Phase A implemented)`
Owner: `Scribejam engineering`
Source of truth: `AGENTS.md` + `PLAN.md`

## 1) Purpose

Define a reliable, milestone-aligned Playwright strategy for validating the Electron app end-to-end with focus on:
- notepad-first UX continuity
- privacy and security invariants
- graceful degradation under failures
- main/renderer IPC contract integrity

This plan complements unit tests (Vitest) and does not replace them.

## 2) Goals

1. Catch startup regressions early (blank window, preload bridge failures, renderer crashes).
2. Validate user-critical workflows through UI interactions and real Electron runtime behavior.
3. Enforce AGENTS invariants through explicit executable checks.
4. Provide deterministic CI signal with low flake and clear failure diagnostics.
5. Produce milestone evidence that maps directly to PLAN acceptance criteria.

## 3) Non-Goals

1. Audio quality benchmarking and long-duration performance profiling (owned by dedicated harness/spike flows).
2. Full cross-platform matrix in MVP (macOS first).
3. Replacing all manual exploratory QA.
4. End-to-end validation against third-party live providers in every PR (use controlled mock mode in CI).

## 4) Test Strategy

- Unit tests (Vitest): pure logic and boundary validation.
- Playwright Electron tests: app startup, preload bridge, UI state transitions, settings persistence, degradation UX.
- Selective provider integration tests: nightly/manual, not required on each PR.

### 4.1 Principles

1. Deterministic first: default to test mode with mocked provider/system dependencies.
2. Real process boundaries: test through Electron launch, not browser-only rendering.
3. Invariant-aware assertions: every suite checks at least one AGENTS rule.
4. Fail loud and localize quickly: assertions include clear cause and expected behavior.

## 5) Entry Criteria for Playwright Suites

Before a suite is enabled as required in CI:
1. The tested flow exists in current milestone scope.
2. Required test hooks/flags are implemented (`SCRIBEJAM_TEST_MODE`, dependency stubs, deterministic seed data).
3. Suite runtime on CI target is acceptable.
4. Flake rate under repeated runs is acceptable.

## 6) Exit Criteria (Quality Gates)

A Playwright stage is considered healthy when:
1. Required suite pass rate is high on `main`.
2. Known flake rate is low over recent runs.
3. No unresolved P0/P1 startup or workflow regressions in covered flows.
4. CI artifacts include trace/video/screenshot for failures.

## 7) Test Environments

### 7.1 Local (Developer)
- Run all fast smoke and core flow tests before merging risky app-shell changes.

### 7.2 CI PR Gate
- Run deterministic smoke + core M1/M2 workflows only.
- No external network/provider dependency.

### 7.3 Nightly/Manual Extended
- Optional provider-backed and permission-sensitive flows.
- Long-running degradation and recovery checks.

## 8) Proposed Playwright Suite Inventory

## S0 Startup and Shell Integrity (M1 required)

1. `startup-renders-main-shell`
- Verifies app window appears and critical root elements render (not blank canvas).

2. `startup-preload-bridge-available`
- Verifies `window.scribejam` API exists and expected methods are callable.

3. `startup-no-fatal-console-errors`
- Fails on uncaught exceptions and renderer fatal errors.

4. `meeting-start-stop-state-roundtrip`
- Click Start, assert `recording`, click Stop, assert `stopped`.

5. `audio-level-ui-receives-events`
- Inject synthetic level events in test mode; assert mic/system bars update.

6. `settings-save-and-reload-indicator`
- Save test key, relaunch app, assert `key configured: yes` indicators persist.

7. `degradation-system-unavailable-banner`
- Force system capture unavailable in test mode; assert mic-only banner appears and app remains usable.

## S1 Transcription Pipeline UX (M2)

1. `first-run-disclosure-required`
- Verify explicit provider data flow acknowledgement is required before STT start.

2. `live-transcript-renders-streaming-updates`
- Feed mocked transcript events; assert incremental rendering and finalization behavior.

3. `deepgram-disconnect-reconnect-status`
- Simulate disconnect/reconnect; assert user feedback transitions and resumed updates.

4. `invalid-key-blocks-only-stt`
- Invalid STT key should block STT but keep note-taking controls functional.

## S2 Editor and Persistence (M3)

1. `notes-edit-persist-reload`
- Type notes, stop, relaunch/open meeting, verify content roundtrip.

2. `meeting-list-load-and-open`
- Verify meeting records display and open correctly.

3. `state-machine-guards-via-ui`
- Invalid transitions are blocked by UI (for example, stopping when idle).

## S3 Enhancement and Authorship (M4)

1. `enhance-renders-human-vs-ai-distinct`
- Verify human text appears black and AI text gray.

2. `edit-ai-block-converts-to-human`
- Editing AI block removes AI authorship styling.

3. `enhance-failure-retry-flow`
- Simulate provider failure, assert retry path and preserved user notes.

## S4 Packaging and Release Smoke (M5)

1. `packaged-app-launches`
- Launch packaged artifact and verify shell readiness.

2. `core-loop-packaged-smoke`
- Start/Stop + basic settings verification on packaged build.

## 9) Required Test Hooks (Implementation Plan)

Add controlled hooks in app code only for test mode (`SCRIBEJAM_TEST_MODE=1`):
1. deterministic meeting id seed option
2. injectable audio-level event source
3. toggle for system capture unavailable simulation
4. mocked transcript event stream endpoint
5. mocked enhance response/error modes

Rules:
- test hooks must be isolated behind environment checks
- hooks must not weaken production security defaults
- hooks must never log secrets or raw audio payloads

## 10) CI Plan

### 10.1 Required on PR
1. Unit tests (`npm test`)
2. Electron startup smoke (`npm run smoke`)
3. Playwright S0 subset (`npm run smoke:playwright` once expanded)

### 10.2 Required on main/nightly
1. Full S0
2. S1 deterministic mocks
3. Selected S2 workflows
4. Flake detection reruns and report trend

## 11) Artifacts and Diagnostics

For any Playwright failure, store:
1. Playwright trace
2. screenshot at failure
3. video (for non-flaky repro-heavy flows)
4. Electron main/renderer logs (sanitized)

Artifacts should be attached to CI runs and referenced in milestone validation docs.

## 12) Mapping to AGENTS Invariants

- No meeting bot: ensure no bot-join assumptions in flows.
- Local capture only + raw audio in-memory: tests assert no raw audio files are written during covered flows.
- Human/AI visual distinction: explicit M4 style assertions.
- Explicit disclosure: first-run acknowledgement tests in M2.
- Graceful degradation: system unavailable/network/key error scenarios remain usable for note-taking.

## 13) Rollout Plan

1. Phase A (now, M1): stabilize S0 startup and start/stop/settings/degradation tests.
2. Phase B (M2): add transcript and reconnect tests using deterministic mock STT.
3. Phase C (M3-M4): add persistence and authorship tests.
4. Phase D (M5): packaged app smoke coverage.

## 14) Definition of Done for This Plan

This plan is considered implemented when:
1. S0 tests are fully automated and required in PR CI.
2. Each milestone adds its planned suite and updates this document with status.
3. Failure artifacts are consistently captured and actionable.
4. Test coverage supports milestone exit gates without relying on ad-hoc manual checks for core workflows.

## 15) Current Implementation Status

- Phase A (`S0`) is implemented in `tests/smoke/app-launch.spec.ts` and wired into CI.
- Covered now:
  - startup shell render (blank-canvas guard)
  - preload bridge availability
  - no fatal renderer errors during startup/core interactions
  - meeting start/stop state roundtrip
  - mic level UI reaction to injected frame events
  - settings indicator persistence across relaunch
  - forced system-unavailable degradation banner while app remains usable
- Phase C (`S3`) enhancement coverage is partially implemented in `tests/smoke/app-components.spec.ts`.
- Covered now:
  - enhancement disclosure is visible at the point of use
  - enhancement failure keeps note-taking available and supports retry recovery
  - editing AI-authored enhanced content removes the AI authorship marker
