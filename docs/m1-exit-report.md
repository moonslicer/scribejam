# M1: Foundation, Capture, and App Shell

`M1` turned the spike decisions into a usable Electron product shell. The goal was not “finish transcription.” It was to prove that Scribejam’s process boundaries, local capture model, settings flow, and degradation behavior worked in an actual app.

## Milestone Mapping

- Milestone: `M1`
- Acceptance criteria from `PLAN.md` covered:
  - Electron + React + TypeScript scaffold
  - typed preload bridge and shared IPC contracts
  - system audio intake in main
  - mic capture in renderer via AudioWorklet
  - settings infrastructure with secure secret storage
  - basic meeting controls and status UI
  - test and smoke infrastructure

## What Shipped

- A strict Electron split:
  - main process owns orchestration, native/audio integration, settings, and lifecycle
  - renderer owns presentation, interactions, and mic capture UX
- Typed IPC through preload instead of ad hoc renderer access to Node APIs.
- Local capture plumbing for both sources:
  - system audio handled in main
  - microphone frames captured in renderer and forwarded over IPC
- First-run/settings infrastructure with secure storage for provider keys.
- A usable shell with recording controls, status banners, and audio level feedback.

## Why It Matters

- It proves the app can stay “notepad first” while still handling real audio boundaries.
- It validates the privacy and reliability rules in `AGENTS.md` inside the product, not just inside the spike harness.
- It keeps the architecture boring in the right way: explicit ownership, typed contracts, and predictable degradation paths.

## Verification Steps Executed

1. Ran `npm run typecheck`.
2. Ran the project test suites with `npm run test`.
3. Ran startup smoke coverage with `npm run smoke`.
4. Ran Playwright app smoke coverage with `npm run smoke:playwright`.

## Residual Risks

- Hardware permission flows still benefit from manual checks on target release machines.
- Provider reconnect and cloud-failure behavior remain later-milestone work.
- The foundation was intentionally built before richer transcript/editor behavior, so later milestones still carry meaningful integration work.
