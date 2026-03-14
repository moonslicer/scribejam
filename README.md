# Scribejam

Scribejam is a notepad-first AI meeting app for macOS. It captures system audio and microphone audio locally, streams transcript audio to a speech-to-text provider, and lets you enhance your typed notes after the meeting without sending raw audio to disk.

## Product Rules

These are hard project invariants:
- no meeting bot joins calls
- system audio + mic capture run locally on device
- raw audio stays in memory only
- human notes stay the anchor
- human and AI authorship remain visually distinct
- first-run setup must disclose provider data flow before cloud features are used

Authoritative project docs:
- product philosophy and invariants: [AGENTS.md](./AGENTS.md)
- milestone sequencing and implementation plan: [PLAN.md](./PLAN.md)
- local setup and permissions: [docs/setup.md](./docs/setup.md)
- contribution workflow: [CONTRIBUTING.md](./CONTRIBUTING.md)

## MVP Workflow

The current MVP path is:
1. Open the app and complete first-run disclosure
2. Add Deepgram and OpenAI keys if you want real provider-backed flows
3. Start a meeting manually
4. Type notes while transcript audio is processed
5. Stop the meeting
6. Run Enhance Notes to merge your notes with the transcript
7. Reopen saved meetings from history later

Scribejam is intentionally not a surveillance product. The app should feel like a fast notepad with optional AI augmentation, not like a hidden recorder.

## Data Flow and Privacy

Cloud-assisted MVP behavior:
- live meeting audio is streamed to Deepgram for transcription
- saved notes and transcript text are sent to OpenAI only when you explicitly trigger enhancement

Local persistence:
- meeting title and lifecycle metadata
- note content
- transcript text
- enhanced output
- settings

Not persisted:
- raw audio buffers
- provider API keys in plaintext

More setup detail is documented in [docs/setup.md](./docs/setup.md).

## Requirements

- macOS
- Node.js 22+
- npm
- Electron native build tooling available through the project dependencies

Optional for real provider-backed runs:
- Deepgram API key
- OpenAI API key
- macOS System Audio Recording permission
- macOS Microphone permission

## Install and Run

Install dependencies:

```bash
npm install
```

Run the desktop app in development:

```bash
npm run dev
```

Build the main and renderer bundles:

```bash
npm run build
```

Typecheck the workspace:

```bash
npm run typecheck
```

Run tests:

```bash
npm test
```

Run the startup smoke check:

```bash
npm run smoke
```

## Native Dependencies

This project depends on native Electron modules. After install and before packaging, rebuild native dependencies for the pinned Electron version:

```bash
npm run rebuild-native:electron
```

This is especially important for:
- `audiotee`
- `better-sqlite3`

## Project Layout

- `src/main/`: Electron main-process orchestration, storage, provider integration, native shell wiring
- `src/preload/`: typed `contextBridge` API
- `src/renderer/`: React UI, editor, history, transcript, settings
- `src/shared/`: IPC contracts and shared types
- `tests/`: unit, renderer, integration, and smoke coverage
- `docs/`: milestone evidence, setup notes, and verification artifacts
- `spike/m0-harness/`: the original M0 technical spike harness

## Milestone Status

The repo contains milestone work from:
- M0: technical spike and baseline validation
- M1: scaffold, capture shell, settings shell
- M2: transcription pipeline
- M3: persistence and notepad foundation
- M4: enhancement foundation
- M5: OpenAI-backed enhancement
- M6: enhancement UX and authorship behavior
- M7: polish and packaging work in progress

Milestone details and acceptance notes live in [PLAN.md](./PLAN.md).

## Verification References

Useful milestone evidence:
- [docs/m0-spike-report.md](./docs/m0-spike-report.md)
- [docs/m1-exit-report.md](./docs/m1-exit-report.md)
- [docs/m2-exit-report.md](./docs/m2-exit-report.md)
- [docs/m5-verification.md](./docs/m5-verification.md)

## M0 Harness

The original M0 harness is still available for low-level audio and STT validation. See:
- [spike/m0-harness/README.md](./spike/m0-harness/README.md)
- [docs/m0/runbook.md](./docs/m0/runbook.md)
- [docs/m0/test-plan.md](./docs/m0/test-plan.md)
