# AGENTS.md

This file defines Scribejam's agent philosophy and execution rules.
`AGENTS.md` is authoritative for principles and invariants.
`PLAN.md` is an execution document that must conform to this file.

## 1) Philosophy
- Build a notepad-first product, not a surveillance product.
- Human notes are the anchor; AI augments, never overrides user intent.
- Privacy and data transparency are product features, not legal footnotes.
- Reliability beats cleverness: degraded behavior is better than broken behavior.
- Keep architecture simple, explicit, and debuggable.

## 2) Product Invariants (Do Not Violate)
- No meeting bot joins calls.
- System audio + mic capture run locally on-device.
- Raw audio is in-memory only; do not persist raw audio to disk.
- Human/AI authorship must stay visually distinct:
  - human: black
  - ai: gray
- First-run setup must explicitly disclose provider data flow and require acknowledgement.
- MVP is macOS-first and cloud-assisted by default.

## 3) Source of Truth and Scope
- `AGENTS.md` is canonical for product philosophy, invariants, and decision principles.
- `PLAN.md` is canonical for current milestone sequencing and implementation details only when it does not conflict with `AGENTS.md`.
- If there is any conflict, update `PLAN.md` to match `AGENTS.md` unless the user explicitly asks to change the philosophy.
- `future-extensions.md` is out of MVP scope unless the user explicitly asks for it.
- Do not silently reinterpret principles to fit implementation convenience.

## 4) Architecture Defaults (Electron + Node)
- Main process owns orchestration:
  - audio pipeline and mixing
  - STT provider integration
  - enhancement orchestration
  - SQLite persistence
  - meeting state machine
- Renderer owns UX:
  - editor + transcript UI
  - meeting controls/status
  - mic capture via Web Audio API/AudioWorklet
- IPC must go through `contextBridge` with typed, minimal contracts.

## 5) Milestone-First Delivery
Work in milestone order unless user overrides:
1. M0: technical spike and baseline metrics
2. M1: scaffold + capture + settings shell
3. M2: transcription pipeline
4. M3: editor + state + persistence
5. M4: enhancement foundation
6. M5: OpenAI-backed enhancement
7. M6: authorship semantics + enhancement UX
8. M7: polish + packaging

For each task, state:
- milestone mapping
- acceptance criteria from `PLAN.md`
- verification steps executed

## 6) Audio Pipeline Rules
- Normalize sources to PCM16 mono at one STT sample rate.
- Use fixed-size framed audio with monotonic metadata (`source`, `ts`, `seq`).
- Maintain bounded per-source ring buffers.
- Mix on deterministic cadence (no ad-hoc chunk forwarding).
- Apply backpressure by dropping oldest unprocessed frames.
- Emit diagnostics for dropped frames, lag, reconnects, and memory pressure.

## 7) Failure Handling and Degradation
- Deepgram disconnect: reconnect with bounded retries.
- Key invalid/expired: block only the affected feature and route to settings.
- `audioteejs` unavailable: degrade to mic-only mode.
- Network interruption: continue note-taking and local workflow; resume cloud features when possible.
- Memory pressure: enforce buffer limits and stop gracefully before crash.

Design rule: capture/note-taking should continue even when cloud services fail.

## 8) Security and Data Handling
- Store provider API keys via Electron `safeStorage`.
- Never log raw audio payloads, API keys, or full sensitive transcripts in debug output.
- Never commit personal or host-identifying metadata in repo artifacts:
  - no usernames, hostnames, absolute local paths, or workstation labels
  - no exact local OS/build versions or other machine fingerprint details in committed docs/artifacts
  - use redacted or generic environment labels in validation evidence unless the user explicitly requests otherwise
- Persist only meeting artifacts needed by product behavior:
  - meeting metadata
  - notes
  - transcript
  - enhanced output
  - settings

## 9) Native Dependency Discipline
- Pin Electron version.
- Rebuild native modules with `@electron/rebuild` after install and before packaging.
- Treat ABI compatibility as a release gate for:
  - `audioteejs`
  - `better-sqlite3`
  - `whisper-node` (if enabled)
- Keep CI smoke checks that catch startup/ABI breakage early.

## 10) Engineering Quality Bar
- Prefer small, composable modules and explicit interfaces.
- Keep provider SDK usage behind abstractions.
- Add/adjust tests for behavior-significant changes.
- Validate critical flows, not just isolated units:
  - start/stop meeting lifecycle
  - live transcript rendering
  - note persistence
  - enhance flow with authorship styling
- If tests cannot run, state exactly what was not verified.

## 11) Practical Collaboration Rules
- Do not run destructive commands without explicit user approval.
- Do not revert or overwrite unrelated user changes.
- If unexpected workspace changes appear, pause and ask.
- Use the smallest safe change that satisfies the requested outcome.

## 12) Definition of Done
A change is done only when it:
- meets milestone acceptance criteria
- preserves product invariants and privacy rules
- includes or updates relevant tests/verification
- documents any behavior/contract change
- reports residual risks clearly

## 13) Node + TypeScript Architectural Principles
- TypeScript strictness is required:
  - keep `strict` mode enabled
  - avoid `any` on public/module boundary types
  - validate untrusted runtime input at boundaries (IPC, storage, provider responses)
- Process boundaries are explicit:
  - Electron main process owns orchestration, lifecycle state, storage, and provider/network calls
  - renderer owns presentation, interaction, and local UI state only
- IPC is a typed contract, not an ad-hoc transport:
  - define request/response/event payload types centrally
  - treat breaking IPC shape changes as versioned contract changes
  - expose least-privilege APIs through preload `contextBridge`
- State transitions must be authoritative:
  - meeting lifecycle transitions occur only through the state machine module
  - avoid scattered state mutation across unrelated modules
- External providers must be isolated behind interfaces:
  - Deepgram/Anthropic/OpenAI implementations stay behind provider adapters
  - renderer and domain logic should depend on internal interfaces, not SDK-specific types
- Async/network behavior must be bounded:
  - set explicit timeouts
  - define retry/backoff and stop conditions
  - support cancellation where user actions can invalidate in-flight work
- Observability is required for pipeline health:
  - structured logs around state transitions and failures
  - counters/metrics for latency, reconnects, dropped frames, and memory pressure
- Security defaults are non-optional:
  - keep renderer isolation hardening enabled
  - do not expose broad Node capabilities to renderer
  - never log secrets or raw sensitive payloads
