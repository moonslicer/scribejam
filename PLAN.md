# Scribejam — Open-Source AI Meeting Notepad

## Governance (AGENTS-First)

- `AGENTS.md` is authoritative for product philosophy and non-negotiable invariants.
- This `PLAN.md` file is an implementation plan derived from those principles.
- If a plan detail conflicts with `AGENTS.md`, update the plan to match `AGENTS.md` (unless the user explicitly changes the philosophy).
- Every milestone task should map back to at least one core principle:
  - notepad-first UX
  - human notes are the anchor
  - privacy and explicit data disclosure
  - graceful degradation under provider/network failures
  - simple, explicit Electron architecture

## Context

Inspired by the AI meeting notepad category (Granola, Otter, Fireflies), Scribejam is an open-source AI-powered meeting notepad that captures audio invisibly (no bot joins your call) and enhances your typed notes with AI-generated summaries. The key innovation: your sparse notes during a meeting guide the AI, creating a human-AI hybrid document. The goal is to build this as an open-source project for learning and community sharing.

## Key Value Props

### 1. No Meeting Bot (THE differentiator)
- Captures system audio + mic locally on-device
- No bot avatar joins the call — zero social friction
- Works with any app that produces audio (Zoom, Meet, Teams, etc.)

### 2. Human-AI Hybrid Notes (Core UX Innovation)
- User types sparse notes during the meeting (signals what matters)
- After meeting ends, click "Enhance" — AI merges user notes with full transcript
- Visual distinction: **black text** = human-authored, **gray text** = AI-generated

### 3. Privacy & Data Transparency (Two Modes)
- **Mode A — Cloud-assisted (MVP default)**: live audio is sent to Deepgram for STT and transcript+notes are sent to OpenAI for enhancement.
- **Mode B — Local-only (deferred)**: STT and enhancement run locally; no meeting content is sent to third-party APIs.
- No audio/video persisted locally by default — raw audio is processed in-memory and discarded after transcription.
- Meeting artifacts (title, notes, transcript, enhanced notes) persist locally in SQLite; no Scribejam cloud sync in MVP.
- First-run settings must clearly disclose active mode, provider data flow, and retention implications.

### 4. Notepad-First UX
- Feels like opening a notepad, not a surveillance tool

## MVP Features (Tier 1 — Core Loop)

| Feature | Description |
|---------|-------------|
| **System audio capture** | Capture desktop audio + mic without joining the call |
| **Real-time transcription** | STT via Deepgram (cloud-assisted MVP); local Whisper fallback is deferred |
| **Notepad editor** | Simple editor where user types notes during meeting |
| **AI enhancement** | Post-meeting merge of user notes + transcript into structured doc |
| **Visual authorship** | Black/gray text distinction for human vs AI content |
| **Manual start/stop** | User clicks Start/Stop Recording and types meeting title manually |

> Tier 2 (Power Features) and Tier 3 (Team & Integration) are documented in `future-extensions.md`.

## Decisions

- **Stack**: Full Electron (Node.js only)
  - Single runtime (Node.js), simplest packaging and contributor onboarding
  - `audioteejs` for macOS system audio (bundles its own Swift binary internally)
  - No custom native code authored in this repo; native dependencies still require Electron ABI/rebuild handling
- **MVP Scope**: Tier 1 (audio capture, transcription, notepad, AI enhancement, manual start/stop)
- **State management**: Zustand in renderer for UI state; main process state is authoritative (renderer subscribes via IPC events)
- **Dev workflow**: Vite dev server for renderer hot-reload + Electron main process with `--inspect` flag; `npm run dev` starts both
- **Project**: Standalone repo at ~/Projects/scribejam

## Principle-to-Plan Mapping

| AGENTS principle | Concrete plan commitment |
|------------------|--------------------------|
| Notepad-first product | Split-pane notepad/transcript flow, manual start/stop, typed-note continuity even during cloud failures |
| Human notes are anchor | Merge prompt preserves user notes verbatim as `source: "human"` blocks |
| Privacy + transparency | In-memory audio only, first-run disclosure, settings-visible provider data flow |
| Reliability over cleverness | Reconnect, fallback, and mic-only degradation paths with clear user status |
| Simple explicit architecture | Electron main orchestrates pipeline/state/storage; renderer focuses on UX + mic capture; typed IPC via `contextBridge` |

## Technical Architecture

```
┌─────────────────────────────────────────────────┐
│                  Electron App                    │
│  ┌───────────────────────────────────────────┐  │
│  │          React Frontend (Renderer)         │  │
│  │  ┌─────────┐ ┌──────────┐ ┌───────────┐  │  │
│  │  │Notepad  │ │Meeting   │ │Enhanced   │  │  │
│  │  │Editor   │ │Status Bar│ │Notes View │  │  │
│  │  │(Tiptap) │ │& Timer   │ │(black/gray│  │  │
│  │  └─────────┘ └──────────┘ └───────────┘  │  │
│  └──────────────────┬────────────────────────┘  │
│                     │ IPC (contextBridge)        │
│  ┌──────────────────┴────────────────────────┐  │
│  │           Electron Main Process            │  │
│  │  ┌──────────┐ ┌───────────┐ ┌──────────┐  │  │
│  │  │Window    │ │Audio      │ │STT       │  │  │
│  │  │Manager   │ │Manager    │ │Engine    │  │  │
│  │  └──────────┘ └─────┬─────┘ └──────────┘  │  │
│  │  ┌──────────┐ ┌─────┴─────┐ ┌──────────┐  │  │
│  │  │SQLite    │ │audioteejs │ │OpenAI    │  │  │
│  │  │(better-  │ │(npm pkg,  │ │Enhancement│  │  │
│  │  │ sqlite3) │ │CoreAudio) │ │Client    │  │  │
│  │  └──────────┘ └───────────┘ └──────────┘  │  │
│  └───────────────────────────────────────────┘  │
└─────────────────────────────────────────────────┘
```

### Frontend (Electron Renderer — React)
- **Electron** v30+ for desktop shell
- **React 18** + TypeScript for renderer
- **Tiptap** (ProseMirror-based) for the rich-text notepad editor
  - Custom marks for authorship tracking (human vs AI)
- **TailwindCSS** for styling
- IPC via `contextBridge` to main process

### Backend (Electron Main Process — Node.js)
Everything runs in the Electron main process — no separate backend service:
- **Audio manager**: Uses `audioteejs` to receive PCM chunks via EventEmitter
- **STT engine**: Feeds audio chunks to Deepgram (MVP default) with optional whisper-node fallback
- **LLM client**: `openai` package for GPT-5/GPT-4-class enhancement models
- **Storage**: `better-sqlite3` for local persistence
- **Meeting state machine**: idle → recording → stopped → enhancing → done (see state machine definition below)

### IPC Contract (contextBridge)

All IPC goes through `contextBridge` with typed payloads. No direct `ipcRenderer` access in renderer.

**Renderer → Main (invoke/send):**

| Channel | Direction | Payload | Response | Milestone |
|---------|-----------|---------|----------|-----------|
| `meeting:start` | invoke | `{ title: string }` | `{ meetingId: string }` | M1 |
| `meeting:stop` | invoke | `{ meetingId: string }` | `void` | M1 |
| `meeting:enhance` | invoke | `{ meetingId: string }` | `EnhancedOutput` | M4 |
| `meeting:list` | invoke | `void` | `Meeting[]` | M7 |
| `meeting:get` | invoke | `{ meetingId: string }` | `Meeting` | M3 |
| `notes:save` | send | `{ meetingId: string, content: JSONContent }` | — (fire-and-forget) | M3 |
| `audio:mic-frames` | send | `{ frames: Int16Array, seq: number, ts: number }` | — (fire-and-forget) | M1 |
| `settings:get` | invoke | `void` | `Settings` | M1 |
| `settings:save` | invoke | `Partial<Settings>` | `void` | M1 |
| `settings:validate-key` | invoke | `{ provider: string, key: string }` | `{ valid: boolean, error?: string }` | M2 |

**Main → Renderer (events):**

| Channel | Payload | Milestone |
|---------|---------|-----------|
| `meeting:state-changed` | `{ state: MeetingState, meetingId?: string }` | M1 |
| `transcript:update` | `{ text: string, speaker: 'you' \| 'them', ts: number, isFinal: boolean }` | M2 |
| `audio:level` | `{ source: 'mic' \| 'system', rms: number }` | M1 |
| `enhance:progress` | `{ status: 'streaming' \| 'done' \| 'error', partial?: EnhancedOutput }` | M6 |
| `error:display` | `{ message: string, action?: 'open-settings' \| 'retry' }` | M1 |

### Audio Capture
- **macOS system audio**: `audioteejs` npm package (wraps CoreAudio Taps API, macOS 14.2+)
  - `npm install audioteejs` — no custom native code authored by Scribejam
  - Emits raw PCM chunks via EventEmitter in main process
  - Only requests "System Audio Recording" permission (no purple screen indicator)
  - Pre-mixer audio capture (unaffected by system volume)
- **Microphone**: Web Audio API via `navigator.mediaDevices.getUserMedia()` in renderer
  - Captured via AudioWorklet and sent as framed PCM batches over IPC to main for mixing
- **Cross-platform fallback** (future): `electron-audio-loopback` for Windows/Linux
- No audio persisted to disk — processed in-memory only

### Meeting State Machine

```
idle ──[user clicks Start]──▶ recording
recording ──[user clicks Stop]──▶ stopped
stopped ──[user clicks Enhance]──▶ enhancing
stopped ──[user clicks Start]──▶ recording       (re-record / new segment)
enhancing ──[LLM returns]──▶ done
enhancing ──[LLM fails]──▶ enhance_failed
enhance_failed ──[user clicks Retry]──▶ enhancing
enhance_failed ──[user dismisses]──▶ stopped      (keeps raw notes + transcript)
done ──[user clicks New Meeting]──▶ idle
```

**Transition rules:**
- Only `recording` state starts/continues audio capture and STT streaming.
- `stopped` persists notes + transcript to SQLite immediately.
- `enhancing` is non-blocking for note editing — user can still view/edit notes while waiting.
- All transitions are triggered by explicit user actions or system events (LLM response/failure); no implicit timer-based transitions.
- State is authoritative in main process; renderer receives state via IPC events.

### Audio Pipeline Strategy (MVP)
Pipeline rules follow AGENTS.md §6 (Audio Pipeline Rules). Implementation-specific parameters:
- **Sample rate**: 16kHz PCM16 mono (Deepgram's preferred input format)
- **Frame size**: 20ms frames (640 samples) as provisional M0 default (CFG-B)
- **Mix cadence**: 100ms as provisional M0 default (CFG-B)
- **Ring buffer depth**: 5 seconds per source (bounded; oldest frames dropped under backpressure)
- No raw audio persisted to disk — in-memory only per AGENTS invariant.

### Speech-to-Text
- **Primary (MVP)**: Deepgram streaming STT API
  - Real-time WebSocket API, configured via `DEEPGRAM_API_KEY`
  - Best accuracy/latency tradeoff for live meetings
- **Optional fallback**: `whisper-node` (Node.js bindings to whisper.cpp) for local/offline mode
  - Native module: must be rebuilt/pinned for target Electron version and architecture

### AI Enhancement (Note-Transcript Merge)
- **MVP provider**: `openai` package (OpenAI models)
- **Architecture rule**: Keep OpenAI behind an internal enhancement client interface owned by the main process so another provider can be plugged in later without changing renderer code or core orchestration

#### Merge Prompt Design

The prompt receives two inputs and produces structured JSON:

**Inputs:**
1. `user_notes` — the user's raw typed notes (sparse, freeform)
2. `transcript` — the full meeting transcript with source labels/timestamps today, and speaker IDs later if diarization is enabled

**System prompt (draft):**
```
You are a meeting note enhancer. You receive a user's handwritten meeting notes
and a full transcript. Your job is to produce enhanced notes that:

1. PRESERVE every user note verbatim as an anchor point (these are "human" blocks)
2. EXPAND each user note with relevant context from the transcript (these are "ai" blocks)
3. ADD any important topics from the transcript that the user didn't note (as "ai" blocks)
4. EXTRACT action items and decisions into dedicated sections (as "ai" blocks)

Output format: JSON array of blocks, each with "source" ("human" | "ai") and "content" (markdown string).
The user's original notes must appear exactly as written with source "human".
AI-generated content must have source "ai" and should reference transcript context.
```

**Output schema:**
```typescript
interface EnhancedOutput {
  blocks: Array<{
    source: 'human' | 'ai';
    content: string;  // markdown
  }>;
  action_items: Array<{
    owner: string;      // extracted from transcript
    description: string;
    due?: string;       // if mentioned
  }>;
  decisions: Array<{
    description: string;
    context: string;    // brief quote/reference from transcript
  }>;
  summary: string;      // 2-3 sentence meeting summary
}
```

**Rendering rule:** `source: "human"` renders in black text, `source: "ai"` renders in gray text. If the user edits an AI block, it flips to `source: "human"` (black).

### Local Storage
- **`better-sqlite3`** — synchronous and fast; native module requiring Electron ABI compatibility
- Local persistence by default; Deepgram handles STT requests and OpenAI handles enhancement requests in cloud-assisted mode
- Schema migrations: version-tracked with a `schema_version` pragma; each milestone that changes schema ships a migration

**SQLite Schema (MVP):**

```sql
-- meetings: one row per meeting session
CREATE TABLE meetings (
  id            TEXT PRIMARY KEY,   -- uuid
  title         TEXT NOT NULL,
  state         TEXT NOT NULL DEFAULT 'idle',  -- MeetingState enum
  created_at    TEXT NOT NULL,      -- ISO 8601
  updated_at    TEXT NOT NULL,
  duration_ms   INTEGER             -- set on stop
);

-- notes: Tiptap JSONContent, saved on each auto-save
CREATE TABLE notes (
  id            TEXT PRIMARY KEY,
  meeting_id    TEXT NOT NULL REFERENCES meetings(id),
  content       TEXT NOT NULL,      -- JSON (Tiptap doc)
  updated_at    TEXT NOT NULL
);

-- transcript_segments: individual STT results
CREATE TABLE transcript_segments (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  meeting_id    TEXT NOT NULL REFERENCES meetings(id),
  speaker       TEXT NOT NULL,      -- internal source hint ('you' | 'them'), rendered as source-based labels in MVP
  text          TEXT NOT NULL,
  start_ts      REAL NOT NULL,      -- seconds from meeting start
  end_ts        REAL,
  is_final      INTEGER NOT NULL DEFAULT 1
);

-- enhanced_outputs: result of LLM enhancement
CREATE TABLE enhanced_outputs (
  id            TEXT PRIMARY KEY,
  meeting_id    TEXT NOT NULL UNIQUE REFERENCES meetings(id),
  output        TEXT NOT NULL,      -- JSON (EnhancedOutput)
  provider      TEXT NOT NULL,      -- 'openai' for MVP; future adapters may add others
  model         TEXT NOT NULL,
  created_at    TEXT NOT NULL
);

-- settings stored via safeStorage for keys; this table is for non-secret prefs
CREATE TABLE settings (
  key           TEXT PRIMARY KEY,
  value         TEXT NOT NULL       -- JSON
);
```

### API Key Onboarding & Settings
- **First-run flow (implemented in M2)**: On first launch, a setup wizard collects:
  1. Deepgram API key (required for MVP transcription)
  2. Data flow disclosure acknowledgement (audio is sent to Deepgram in cloud-assisted mode)
  3. Explicit consent checkbox before recording/transcription can begin
- **LLM key onboarding**: deferred to M5 OpenAI integration and settings enhancements.
- **Storage**: API keys stored in Electron `safeStorage` (OS keychain-backed encryption)
- **Settings page**: temporary inline panel in M2; move to a dedicated settings surface in later milestones.
- **Validation**: Keys are tested on save (small API call) with clear error messages for invalid/expired keys

### Cloud Provider Data Flow (MVP Default)
- Live audio chunks are sent to Deepgram for STT; transcript text is returned to the app.
- User notes + transcript are sent to OpenAI for enhancement.
- API keys are user-provided and stored via Electron `safeStorage` (OS keychain-backed).
- Scribejam does not run its own backend or team sync service in MVP.

### Local-Only Data Flow (Deferred)
- Audio is transcribed locally via `whisper-node`; no transcript API calls are made.
- Note enhancement runs on-device via a local model runtime.
- Notes/transcript/enhanced output remain local in SQLite, matching cloud-assisted storage behavior.

### Dependency Risk: `audioteejs`
- **Current state**: ~66 GitHub stars, 33 commits, solo maintainer (`makeusabrew`). Small but focused package.
- **Risk**: If the maintainer abandons the project, we lose macOS system audio capture.
- **Mitigations**:
  1. **Vendor the Swift binary**: `audioteejs` bundles a pre-compiled `AudioTee` Swift binary (~600KB). If the npm package breaks, we can vendor this binary directly and spawn it ourselves — it's a standalone executable that streams PCM to stdout.
  2. **Fork threshold**: If the package goes >6 months without updates or breaks on a new macOS version, fork the repo and maintain our own version.
  3. **Alternative path**: `electron-audio-loopback` works on macOS too (via Chromium's ScreenCaptureKit integration). Worse UX (purple indicator, "Screen Recording" permission) but zero native dependencies. This is a viable hot-swap fallback.
  4. **M0 spike validates**: The technical spike (M0) will confirm audioteejs works reliably on target hardware before we commit to it in M1.
- **License**: MIT — safe to vendor or fork.

### Native Module Handling (Required)
- `audioteejs`, `whisper-node`, and `better-sqlite3` are native dependencies even though we do not author custom native code.
- Pin Electron version and run native rebuild (`@electron/rebuild`) after install and before packaging.
- CI must validate startup and a smoke test on target architecture(s) to catch ABI mismatch early.

## Project Structure

```
scribejam/
├── src/
│   ├── main/                        # Electron main process
│   │   ├── index.ts                 # App entry, window management
│   │   ├── ipc-handlers.ts          # IPC channel definitions
│   │   ├── audio/
│   │   │   ├── audio-manager.ts     # capture + level + source frame ingest
│   │   │   ├── frame-types.ts       # typed mic/system/mixed frame contracts
│   │   │   ├── level-meter.ts       # audio RMS level computation
│   │   │   ├── mic-capture.ts       # mic frame payload parsing/validation
│   │   │   ├── mixer.ts             # deterministic cadence mixer
│   │   │   ├── ring-buffer.ts       # bounded ring buffer primitive
│   │   │   └── system-capture.ts    # audioteejs system capture adapter
│   │   ├── stt/
│   │   │   ├── create-stt-adapter.ts
│   │   │   ├── deepgram-adapter.ts
│   │   │   ├── mock-stt-adapter.ts
│   │   │   └── types.ts
│   │   ├── transcription/
│   │   │   └── transcription-service.ts
│   │   └── meeting/
│   │       └── state-machine.ts     # Meeting state: idle→recording→stopped
│   ├── renderer/                    # React frontend
│   │   ├── App.tsx
│   │   ├── audio/
│   │   │   ├── mic-worklet.ts
│   │   │   └── useMicCapture.ts
│   │   ├── components/
│   │   │   ├── AudioLevel.tsx
│   │   │   ├── MeetingBar.tsx
│   │   │   ├── SettingsPanel.tsx
│   │   │   ├── SetupWizard.tsx
│   │   │   ├── StatusBanner.tsx
│   │   │   └── TranscriptPanel.tsx
│   │   └── transcript/
│   │       └── transcript-state.ts  # transcript event coalescing + copy formatter
│   └── preload/
│       └── index.ts                 # contextBridge API exposure
├── tests/
│   ├── integration/
│   ├── smoke/
│   └── unit/
├── package.json
├── tsconfig.json
├── electron-builder.yml             # Build/packaging config
├── PLAN.md
├── future-extensions.md
├── README.md
├── LICENSE                          # MIT
└── .github/
    └── workflows/
        └── ci.yml
```

## Implementation Milestones

### Milestone Exit Gates (Must Pass for Every Milestone)
1. **Invariant gate**: No violation of AGENTS product invariants (no bot, no raw audio persistence, authorship distinction, explicit disclosure).
2. **Degradation gate**: Relevant failure modes are handled without collapsing note-taking.
3. **Architecture gate**: Changes preserve main/renderer separation and typed IPC boundaries.
4. **Verification gate**: Acceptance evidence is recorded (tests, smoke checks, or measurable manual validation for spike work).

### M0: Technical Spike (Single-Mac Validation Gate)
1. Validate `audioteejs` system capture + microphone capture + IPC framing on one target Mac.
2. Validate end-to-end Deepgram streaming transcription with mixed audio input.
3. Measure baseline metrics: transcript latency p95, dropped-frame rate, memory growth over 30 minutes.
4. Produce spike report (markdown in repo root: `docs/m0-spike-report.md`) that records: measured metrics, chosen frame size and mix cadence, any audioteejs issues, and go/no-go decision for M1. M1 cannot start until this report is reviewed.
- **M0 gate interpretation**:
  - `S1_system_only_10m` must be true system-only (mic disabled)
  - `S3_mixed_10m` and `S4_mixed_soak_30m` must be validated as real mixed-input Deepgram runs for `GO`
- **Testing**: Manual validation only. Report must include reproducible test steps and measured results.

### M1: Project Scaffold & Audio Capture
1. Initialize Electron + React + TypeScript project with electron-builder
2. Set up Vite for renderer bundling, TailwindCSS
3. Add native module pipeline: pin Electron, configure `@electron/rebuild`, add CI/startup smoke check
4. Install `audioteejs`, implement `audio-manager.ts` — receive PCM chunks via EventEmitter
5. Implement mic capture via AudioWorklet in renderer, send timestamped PCM frames to main via IPC
6. Implement settings infrastructure: `safeStorage` read/write for API keys, settings page shell (empty form), first-run detection flag (M2 builds the actual wizard UI on top of this)
7. Basic UI: window with Start/Stop Recording button + audio level indicator
8. Set up test infrastructure: Vitest for unit/integration tests, Playwright for renderer smoke tests
- **Testing (M1)**: Unit tests for audio frame protocol, settings read/write, and meeting state machine transitions. CI startup smoke test (app launches without crash).

### M2: Real-Time Transcription
1. Build first-run setup wizard UI on M1 settings infrastructure: Deepgram API key input, key validation, data flow disclosure with explicit acknowledgement
2. Integrate Deepgram streaming STT as default backend
3. Implement timestamped frame protocol + bounded ring buffers for mic/system sources
4. Align/mix frames deterministically, then stream to Deepgram WebSocket
5. Display live transcript in TranscriptPanel (scrolling text)
6. ~~`whisper-node` local fallback~~ — deferred to post-MVP (local-only mode)
7. Source-based transcript labeling for MVP: system audio and mic remain visually distinct without claiming true speaker identity (per-speaker diarization within system audio is deferred to post-MVP)
- **Testing (M2)**: Unit tests for ring buffer, frame alignment/mixing, and Deepgram reconnect logic. Integration test: mock WebSocket validates transcript event flow end-to-end.

**M2 implementation decisions (as-built):**
- Deepgram reconnect policy uses bounded retries with exponential backoff (max 3 attempts, base 500ms) and explicit renderer status events.
- Frame defaults use M0-selected CFG-B values: 16kHz PCM16 mono, 20ms frame size, 100ms mix cadence, 250-frame bounded source buffers.
- Internal `you/them` source hints use recent single-source activity as a heuristic and keep attribution stable for an utterance across interim/final updates; the renderer presents them as source-based labels (`Mic`, `System audio`) so MVP does not overclaim speaker identity.
- If diarization is added later, transcript presentation can switch from source-based labels to provider speaker IDs or similarly neutral diarized labels.
- Renderer transcript handling coalesces live partial updates into one active line per speaker and only appends finalized segments.
- Transcript panel includes one-click full-text copy for fast handoff/sharing.
- First-run wizard is mandatory for cloud transcription activation; if bypassed at IPC level, transcription remains paused and meeting controls stay stable.

**M2 closure artifacts:**
- `docs/m2-exit-report.md`
- `tests/unit/ring-buffer.test.ts`
- `tests/unit/mixer.test.ts`
- `tests/unit/deepgram-adapter.test.ts`
- `tests/integration/transcription-service.test.ts`
- `tests/smoke/app-launch.spec.ts` (S1 scenarios)

### M3: Notepad Editor
1. Integrate Tiptap editor with custom `authorship` mark (human vs AI)
2. Split-pane layout: notepad (left) + live transcript (right)
3. User types notes freely during recording mode
4. Notes auto-saved to SQLite via `better-sqlite3`
5. Implement meeting state machine per the state machine definition above (including `enhance_failed` state and re-record transition)
6. Meeting title input field on start
7. Move the temporary inline settings panel to a dedicated settings surface (menu/modal/page), keeping meeting view focused on notes + transcript
- **Testing (M3)**: Unit tests for SQLite CRUD operations, note auto-save debounce, state machine transition guards. Renderer test: Tiptap editor renders and persists content round-trip.

#### M3 Delivery Breakdown (Junior-Friendly)

Goal: turn the current capture/transcript shell into a real notepad-first meeting workspace where the user can title a meeting, type notes during recording, and trust that notes and transcript persist locally for later recovery and future enhancement.

##### Task 1: Define the M3 data model and storage boundaries
- **Why this task exists**: Before changing UI, we need a clear definition of what a persisted meeting contains so title, notes, and transcript save consistently.
- **How it fits the larger picture**: This creates the local-first foundation for M3 note persistence, M4-M6 enhancement work, and M7 meeting history.
- **Implementation**:
  - Define TypeScript models for `Meeting`, `Note`, and `TranscriptSegment`
  - Define the minimum SQLite schema for `meetings`, `notes`, and `transcript_segments`
  - Keep raw audio out of storage entirely
- **Acceptance focus**:
  - Schema supports title, lifecycle timestamps/state, notes content, and transcript segments
  - No schema persists raw audio
- **Verification**:
  - Unit test that schema bootstrap succeeds on an empty database
  - Unit test that reopening the database does not destroy existing data

##### Task 2: Build the SQLite storage module and repositories
- **Why this task exists**: M3 requires note autosave to SQLite, and SQL should live behind explicit main-process interfaces rather than inside IPC handlers.
- **How it fits the larger picture**: This keeps persistence simple and debuggable, matching the AGENTS architecture rules.
- **Implementation**:
  - Add a storage bootstrap module in `src/main/storage`
  - Add repository methods for `createMeeting`, `updateMeetingStop`, `saveNotes`, `appendTranscriptSegment`, and `getMeetingWithArtifacts`
  - Keep `better-sqlite3` usage in main process only
- **Acceptance focus**:
  - Repositories support the M3 flows without leaking SQL into UI or IPC code
  - Saving notes updates the current note row instead of duplicating it
- **Verification**:
  - Unit tests for repository CRUD behavior
  - Unit test that repeated note saves update the existing record
  - Unit test that fetching a meeting returns notes and transcript together

##### Task 3: Extend the shared IPC contract for M3 persistence
- **Why this task exists**: The renderer needs a typed way to save notes and load a meeting while keeping process boundaries explicit.
- **How it fits the larger picture**: This becomes the stable contract for M3 note editing and later for M7 history views.
- **Implementation**:
  - Add `meeting:get`
  - Add `notes:save`
  - Add shared request/response types for persisted meeting payloads
  - Expose these APIs through preload only
- **Acceptance focus**:
  - IPC remains typed and minimal
  - Renderer never talks to SQLite directly
- **Verification**:
  - Unit tests for IPC type guards and payload validation
  - Update preload typing tests or contract tests as needed

##### Task 4: Persist meeting lifecycle events in the main process
- **Why this task exists**: Starting and stopping a meeting should create durable records immediately, not just update in-memory state.
- **How it fits the larger picture**: This makes M3 recoverable after app restarts and gives M4-M6 stored notes/transcript artifacts to work from.
- **Implementation**:
  - On `meeting:start`, create a meeting row with title and start time
  - On transcript events, append transcript segments
  - On `meeting:stop`, persist stop time and duration
  - Implement `meeting:get` using the repositories
- **Acceptance focus**:
  - Meetings, notes, and transcript are persisted locally
  - Raw audio remains in-memory only
- **Verification**:
  - Unit/integration test that start creates a meeting record
  - Unit/integration test that stop finalizes duration and state
  - Unit/integration test that transcript updates persist as text segments

##### Task 5: Expand the meeting state machine to match the planned lifecycle
- **Why this task exists**: M3 explicitly calls for the fuller state machine, and lifecycle rules should remain authoritative in main.
- **How it fits the larger picture**: This prevents lifecycle logic from scattering across the app and prepares the codebase for M4-M6 enhancement without redesigning state later.
- **Implementation**:
  - Extend states to include `enhancing`, `enhance_failed`, and `done`
  - Add explicit transition methods with guardrails
  - Preserve the existing recording flow
  - Support the re-record/new-meeting transitions cleanly
- **Acceptance focus**:
  - Invalid transitions fail fast
  - The state machine remains the single authority for lifecycle changes
- **Verification**:
  - Unit tests for each valid transition
  - Unit tests for invalid transitions and guard behavior

##### Task 6: Add a meeting title draft flow in the renderer
- **Why this task exists**: M3 requires a title input on start, and the current app hardcodes `"Untitled Meeting"`.
- **How it fits the larger picture**: The title becomes part of each meeting's durable identity and later powers history/search UX.
- **Implementation**:
  - Add a title input near the primary start action
  - If the title is blank on start, generate a default title from the local start timestamp
  - Show the active title while recording or stopped
- **Acceptance focus**:
  - Starting a meeting with no typed title uses a readable timestamp title
  - Renderer no longer hardcodes meeting titles
- **Verification**:
  - Renderer test that empty title starts with a generated title
  - Renderer test that the typed title is sent to `meeting:start`

##### Task 7: Introduce a small renderer meeting store
- **Why this task exists**: Autosave, active meeting hydration, transcript, title draft, and editor content are becoming too coordinated for local component state.
- **How it fits the larger picture**: This aligns the implementation with the planned renderer architecture and keeps `App.tsx` from becoming a control blob.
- **Implementation**:
  - Add a small meeting store (planned default: Zustand)
  - Store active meeting id/state/title, transcript entries, editor content, and dirty/saving status
  - Move orchestration out of `App.tsx` where practical
- **Acceptance focus**:
  - Renderer state has one clear home
  - Meeting/editor state is easier to test in isolation
- **Verification**:
  - Unit tests for store updates from meeting and transcript events

##### Task 8: Build the Tiptap notepad component with a minimal authorship mark
- **Why this task exists**: The notepad is the core M3 deliverable.
- **How it fits the larger picture**: Adding the authorship mark now gives M4-M6 a compatible editor foundation for AI-authored blocks.
- **Implementation**:
  - Add Tiptap dependencies
  - Build `Notepad.tsx`
  - Define the `authorship` mark in the editor schema
  - Default user-authored content to the human style
- **Acceptance focus**:
  - User can type notes freely during recording
  - The editor stores structured content that M4-M6 can build on
- **Verification**:
  - Renderer test that the editor renders initial content
  - Renderer/unit test that content serializes to JSON and back
  - Test that normal user typing does not incorrectly get AI styling

##### Task 9: Move the renderer to a split-pane layout
- **Why this task exists**: M3 is specifically a note editor beside the live transcript, not just a generic text area added to the current shell.
- **How it fits the larger picture**: This is the core notepad-first workspace the user uses during the meeting.
- **Implementation**:
  - Place the notepad on the left and transcript on the right
  - Keep controls/status visible without dominating the layout
  - Preserve note-taking during degraded transcription/cloud states
- **Acceptance focus**:
  - Both note editor and transcript are visible in the main workspace
  - The note editor is the primary focus of the screen
- **Verification**:
  - Renderer layout test confirming both panes render
  - Existing transcript rendering tests continue to pass

##### Task 10: Add debounced note autosave
- **Why this task exists**: Without autosave, the product fails the notepad-first reliability goal and misses a core M3 acceptance criterion.
- **How it fits the larger picture**: M4-M6 enhancement and M7 history both depend on trustworthy saved notes.
- **Implementation**:
  - Watch editor content changes
  - Debounce saves before sending `notes:save`
  - Persist editor JSON only
  - Track `dirty` and `saving` state if useful for UX
- **Acceptance focus**:
  - Frequent typing does not cause excessive writes
  - The latest editor content is what gets persisted
- **Verification**:
  - Unit test for debounce behavior
  - Unit/integration test that rapid edits collapse into one final save
  - Unit/integration test that saves are scoped to the active meeting

##### Task 11: Hydrate saved notes when loading or returning to a meeting
- **Why this task exists**: Autosave is only useful if persisted data can be restored back into the editor.
- **How it fits the larger picture**: This closes the persistence loop for M3 and ensures M4-M6 enhancement reads durable artifacts rather than transient UI state.
- **Implementation**:
  - Load meeting data through `meeting:get`
  - Populate transcript and note content from stored values
  - Keep stopped meetings viewable/editable if that remains the chosen M3 behavior
- **Acceptance focus**:
  - Notes and transcript survive reload/reopen
  - Stored content round-trips cleanly back into the UI
- **Verification**:
  - Renderer round-trip test: type notes, save, reload, restore same content

##### Task 12: Tighten M3 verification and manual flow checks
- **Why this task exists**: M3 touches persistence, state, and renderer behavior together, so we need a final pass that verifies the whole flow.
- **How it fits the larger picture**: This reduces risk before M4-M6 builds enhancement logic on top of the saved meeting artifacts.
- **Implementation**:
  - Add missing repository/state/editor tests
  - Run typecheck and test suite
  - Execute a short manual smoke flow
- **Acceptance focus**:
  - M3 acceptance criteria have direct verification evidence
  - Regressions are caught before the next milestone
- **Verification**:
  - Manual smoke flow:
    - enter title
    - start meeting
    - type notes while transcript updates
    - stop meeting
    - reload app and confirm notes/transcript still exist

#### Suggested Build Order
1. Task 1: Define the M3 data model and storage boundaries
2. Task 2: Build the SQLite storage module and repositories
3. Task 3: Extend the shared IPC contract for M3 persistence
4. Task 4: Persist meeting lifecycle events in the main process
5. Task 5: Expand the meeting state machine to match the planned lifecycle
6. Task 6: Add a meeting title draft flow in the renderer
7. Task 7: Introduce a small renderer meeting store
8. Task 8: Build the Tiptap notepad component with a minimal authorship mark
9. Task 9: Move the renderer to a split-pane layout
10. Task 10: Add debounced note autosave
11. Task 11: Hydrate saved notes when loading or returning to a meeting
12. Task 12: Tighten M3 verification and manual flow checks

#### Step-Back Review: How This Plan Matches M3
- **M3.1 Tiptap editor with authorship mark** is covered by Task 8
- **M3.2 Split-pane layout** is covered by Task 9
- **M3.3 User types notes during recording** is covered by Tasks 8 and 9
- **M3.4 Notes auto-saved to SQLite** is covered by Tasks 1, 2, 3, 4, and 10
- **M3.5 Expanded meeting state machine** is covered by Task 5
- **M3.6 Meeting title input on start** is covered by Task 6
- **M3 testing expectations** are covered by Tasks 2, 5, 8, 10, 11, and 12

This plan intentionally stays inside M3 scope:
- It does not introduce a meeting history panel yet; that remains M7 scope
- It does not implement enhancement UI or LLM orchestration yet; that remains M4-M6 scope
- It preserves the AGENTS invariants by keeping raw audio in-memory only and keeping storage/main-process authority explicit

Implementation note:
- Keep Task 5 modest. Define the future-ready lifecycle states and guards now, but do not pull full enhancement behavior forward from M4-M6 unless it is required to complete a transition contract.

The original M4 enhancement scope was too broad for one milestone, so it is split across M4-M6:
- M4 proves the end-to-end enhancement loop with local persistence and deterministic/mock orchestration
- M5 adds real OpenAI-backed enhancement and settings integration while keeping a future provider seam in code
- M6 tightens authorship semantics, progress, retry UX, and disclosure polish

### M4: Enhancement Foundation
1. Define the shared enhancement contract:
   - `EnhancedOutput` schema
   - `meeting:enhance` request/response types
   - persisted enhancement model shape
2. Add `enhanced_outputs` SQLite persistence and meeting-state persistence needed for enhancement lifecycle
3. Implement a mock enhancement service in the main process that reads saved notes + transcript and returns deterministic `EnhancedOutput`
4. Add the first `Enhance Notes` user flow:
   - stopped meeting -> enhance action
   - enhancement request runs through typed IPC
   - successful result is persisted locally
5. Render enhanced output in the editor with black (human) / gray (AI) visual distinction:
   - Transform `EnhancedOutput.blocks[]` into Tiptap `JSONContent` nodes
   - `source: 'human'` stays unmarked/black
   - `source: 'ai'` uses the `authorship` mark/gray
   - `action_items`, `decisions`, and `summary` render as appended AI-authored sections
- **Testing (M4)**: Unit tests for schema/repository changes and `EnhancedOutput` JSON→Tiptap doc transform. Integration test: full enhance flow with a mocked enhancement service.

#### M4 Delivery Breakdown (Junior-Friendly)

Goal: prove the first end-to-end enhancement loop without taking on real provider complexity yet. A stopped meeting with saved notes and transcript should be enhancable through a typed main-process flow, the result should persist locally, and the editor should render human and AI authorship distinctly.

##### Task 1: Define the M4 enhancement contract in shared types
- **Why this task exists**: Before wiring UI or storage, we need one explicit shape for what enhancement produces and how renderer and main agree on requests/responses.
- **How it fits the larger picture**: This becomes the stable seam that M5 provider integrations and M6 UX improvements build on without reworking the renderer contract.
- **Implementation**:
  - Add `EnhancedOutput` shared types
  - Add `EnhanceMeetingRequest` and `EnhanceMeetingResponse`
  - Define the persisted enhancement record shape used by main/storage
  - Extend the hydrated meeting payload only as much as needed to surface the latest enhancement
- **Acceptance focus**:
  - Enhancement payloads are typed centrally rather than inferred ad hoc
  - Renderer and main agree on one enhancement response shape
- **Verification**:
  - Unit tests for enhancement payload guards/validation if runtime guards are added
  - Update IPC contract tests to cover the new channel/types

##### Task 2: Add enhancement storage schema and repository methods
- **Why this task exists**: M4 requires local persistence of enhancement output, and persistence should stay behind explicit repositories instead of spreading SQL into orchestration code.
- **How it fits the larger picture**: This gives M4 durable enhancement artifacts and later supports M7 meeting history without changing the enhancement contract.
- **Implementation**:
  - Add an `enhanced_outputs` table to SQLite
  - Store the structured `EnhancedOutput` JSON, creation timestamp, and meeting linkage
  - Add repository methods to save the latest enhancement and fetch enhancement records for a meeting
  - Keep existing notes and transcript tables unchanged except where a migration/version bump is required
- **Acceptance focus**:
  - Enhancement output is stored locally and linked to a meeting
  - Schema changes do not persist raw audio or broaden stored data beyond meeting artifacts
- **Verification**:
  - Unit test that database migration creates the enhancement table cleanly
  - Unit test that an enhancement record can be saved and fetched by meeting id
  - Unit test that reopening an upgraded database preserves prior meeting/note/transcript data

##### Task 3: Add meeting-state persistence helpers for the enhancement lifecycle
- **Why this task exists**: The in-memory state machine already knows about `enhancing` and `done`, but M4 needs those transitions reflected in stored meeting records too.
- **How it fits the larger picture**: This keeps lifecycle state authoritative and durable, which M6 retry/failure UX will rely on later.
- **Implementation**:
  - Add repository/service methods to update meeting state outside the stop transition
  - Persist `enhancing` when an enhancement begins
  - Persist `done` when enhancement completes successfully
  - Keep the transition rules owned by the existing state machine
- **Acceptance focus**:
  - Stored meeting state matches the authoritative lifecycle after enhancement starts/completes
  - Lifecycle persistence remains centralized in main-process services
- **Verification**:
  - Unit test that meeting state updates from `stopped` to `enhancing`
  - Unit test that successful completion updates state to `done`

##### Task 4: Build a deterministic mock enhancement service in the main process
- **Why this task exists**: We need to prove the enhancement loop now without coupling M4 to real OpenAI work, timeouts, or key management.
- **How it fits the larger picture**: This creates the provider abstraction seam that M5 can swap behind without changing the renderer or storage format.
- **Implementation**:
  - Add a small enhancement service module in main
  - Read saved note content and transcript for a meeting
  - Produce deterministic `EnhancedOutput` based on those artifacts
  - Keep provider-specific logic out of renderer-facing code
- **Acceptance focus**:
  - Enhancement runs entirely from persisted artifacts
  - The service is deterministic enough for repeatable tests
- **Verification**:
  - Unit test that the mock service returns the expected output for a fixed note/transcript fixture
  - Unit test that it handles empty or sparse notes without crashing

##### Task 5: Add the main-process enhancement orchestration flow
- **Why this task exists**: M4 needs one place where the enhancement request is validated, the state machine is advanced, persisted artifacts are read, the enhancer runs, and the result is stored.
- **How it fits the larger picture**: This becomes the core enhancement pipeline that M5 and M6 can extend with real providers, retries, and progress events.
- **Implementation**:
  - Add `meeting:enhance` IPC handling in main
  - Validate the request and require a stopped meeting before enhancement begins
  - Advance the state machine to `enhancing`
  - Call the mock enhancement service
  - Persist the resulting `EnhancedOutput`
  - Complete the state machine to `done`
  - Return the persisted enhancement payload to the renderer
- **Acceptance focus**:
  - Enhancement flow stays in main process
  - Invalid lifecycle transitions fail fast and do not corrupt persisted state
- **Verification**:
  - Integration test that a stopped meeting can be enhanced end-to-end through the handler
  - Integration test that enhancement is rejected for an invalid state such as `recording`

##### Task 6: Expose the enhancement IPC surface through preload only
- **Why this task exists**: The renderer needs a typed way to trigger enhancement, but AGENTS requires minimal, explicit `contextBridge` APIs instead of broad renderer access.
- **How it fits the larger picture**: This preserves the process boundary as enhancement functionality expands in later milestones.
- **Implementation**:
  - Add the `meeting:enhance` channel constant
  - Expose an `enhanceMeeting()` preload API
  - Keep the renderer limited to typed request/response calls
- **Acceptance focus**:
  - Renderer can trigger enhancement without direct access to storage or main-process internals
  - The new IPC surface is minimal and typed
- **Verification**:
  - Update preload/IPC contract tests to cover the exposed enhancement API

##### Task 7: Build a pure `EnhancedOutput` to Tiptap document transformer
- **Why this task exists**: The enhancement result needs to render in the existing editor, and that conversion should be deterministic and testable outside the UI.
- **How it fits the larger picture**: This isolates authorship rendering semantics now and gives M6 a clear place to evolve edit-to-human transitions later.
- **Implementation**:
  - Add a renderer utility that transforms `EnhancedOutput` into Tiptap `JSONContent`
  - Render `blocks` in order
  - Leave `source: 'human'` content unmarked
  - Add the `authorship` mark for `source: 'ai'`
  - Append summary, action items, and decisions as AI-authored sections
- **Acceptance focus**:
  - Human and AI content remain visually distinct
  - Transformation logic is pure and independent from React component lifecycle
- **Verification**:
  - Unit test that human blocks render without the authorship mark
  - Unit test that AI blocks receive the authorship mark
  - Unit test that summary/action items/decisions append in the expected order

##### Task 8: Decide and implement the renderer source-of-truth for enhanced content
- **Why this task exists**: Once enhancement completes, the app needs a clear rule for what the editor shows and what remains the durable raw note anchor.
- **How it fits the larger picture**: This prevents M4 from muddying the distinction between original user notes and AI-generated augmentation, which is central to the product philosophy.
- **Implementation**:
  - Keep the original user note JSON persisted in `notes`
  - Treat `EnhancedOutput` as a separate persisted artifact
  - When a meeting with an enhancement is loaded, derive the displayed editor document from the saved enhancement output
  - Fall back to raw notes when no enhancement exists yet
- **Acceptance focus**:
  - Original user notes remain durable and recoverable
  - Enhanced rendering does not overwrite the raw note artifact behind the scenes
- **Verification**:
  - Unit/integration test that a meeting without enhancement hydrates raw notes
  - Unit/integration test that a meeting with enhancement hydrates the derived enhanced document

##### Task 9: Add the first renderer enhancement action
- **Why this task exists**: M4 needs a visible user path from a stopped meeting to enhancement; without it, the main-process work is unreachable.
- **How it fits the larger picture**: This is the first user-facing enhancement loop that M6 will later refine with progress and retry states.
- **Implementation**:
  - Change the stopped-state primary action from “start new recording” to “enhance notes”
  - Invoke the new preload enhancement API when the active meeting is stopped
  - After success, update renderer state so the editor shows the enhanced result
  - Keep enhancement non-editable or minimally editable if that is the safer M4 choice
- **Acceptance focus**:
  - The user can trigger enhancement from the stopped state
  - Successful enhancement updates the workspace without starting a new recording
- **Verification**:
  - Renderer test that the stopped-state CTA triggers `enhanceMeeting`
  - Renderer test that successful enhancement causes AI-styled content to appear

##### Task 10: Add meeting hydration support for persisted enhancement results
- **Why this task exists**: M4 is not complete if enhanced output only appears immediately after a run and disappears on reload.
- **How it fits the larger picture**: This closes the persistence loop for enhancement the same way M3 closed it for notes and transcript.
- **Implementation**:
  - Extend meeting fetch/hydration to include the latest saved enhancement artifact
  - On load, derive the editor document from enhancement when present
  - Preserve transcript hydration alongside the enhanced note view
- **Acceptance focus**:
  - Enhanced meetings survive reload/reopen
  - Transcript and original meeting metadata still hydrate correctly
- **Verification**:
  - Renderer/integration test that a persisted enhancement reloads into the editor after app hydration

##### Task 11: Tighten M4 verification and manual smoke flow
- **Why this task exists**: M4 crosses typed contracts, persistence, lifecycle, and renderer rendering, so it needs one explicit verification pass before M5 builds on top.
- **How it fits the larger picture**: This reduces risk before real provider work adds network and secret-management complexity.
- **Implementation**:
  - Fill any remaining gaps in repository, transformer, and renderer tests
  - Run typecheck and full test suite
  - Execute a short manual stopped-meeting-to-enhanced-meeting flow
- **Acceptance focus**:
  - M4 acceptance criteria have direct evidence
  - The enhancement foundation is stable enough for provider-backed work
- **Verification**:
  - Manual smoke flow:
    - start a meeting
    - type a few notes
    - allow transcript entries to persist
    - stop the meeting
    - click enhance
    - confirm AI-authored content renders gray and human anchors remain black
    - reload app and confirm the enhanced view persists

#### Suggested Build Order
1. Task 1: Define the M4 enhancement contract in shared types
2. Task 2: Add enhancement storage schema and repository methods
3. Task 3: Add meeting-state persistence helpers for the enhancement lifecycle
4. Task 4: Build a deterministic mock enhancement service in the main process
5. Task 5: Add the main-process enhancement orchestration flow
6. Task 6: Expose the enhancement IPC surface through preload only
7. Task 7: Build a pure `EnhancedOutput` to Tiptap document transformer
8. Task 8: Decide and implement the renderer source-of-truth for enhanced content
9. Task 9: Add the first renderer enhancement action
10. Task 10: Add meeting hydration support for persisted enhancement results
11. Task 11: Tighten M4 verification and manual smoke flow

#### Step-Back Review: How This Plan Matches M4
- **M4.1 Shared enhancement contract** is covered by Tasks 1 and 6
- **M4.2 Enhancement persistence and lifecycle storage** is covered by Tasks 2 and 3
- **M4.3 Mock enhancement service** is covered by Task 4
- **M4.4 First Enhance Notes flow** is covered by Tasks 5, 6, and 9
- **M4.5 Authorship-aware rendering in the editor** is covered by Tasks 7, 8, 9, and 10
- **M4 testing expectations** are covered by Tasks 2, 4, 5, 7, 9, 10, and 11

This plan intentionally stays inside M4 scope:
- It does not add real OpenAI enhancement yet; that remains M5 scope
- It does not add progress streaming, retry UX, or edit-to-human authorship flipping yet; that remains M6 scope
- It preserves the AGENTS invariants by keeping raw audio in-memory only, keeping enhancement orchestration in the main process, and maintaining explicit human/AI visual distinction

Implementation notes:
- Keep the mock enhancement service deterministic and fixture-friendly. M4 is about proving the contract and persistence loop, not about prompt quality.
- Prefer storing `EnhancedOutput` separately from raw notes rather than overwriting the `notes` record. That keeps human notes as the anchor and makes the system easier to debug.

### M5: OpenAI-Backed Enhancement
1. Build the note-transcript merge prompt as a pure module
2. Implement `llm-client.ts` as a small enhancement client interface owned by the main process
3. Add an OpenAI enhancement client behind that interface
4. Add OpenAI API key input/validation to setup wizard / settings
5. Add timeout, retry, and feature-scoped failure handling for enhancement requests
6. Keep provider-specific logic isolated so a second adapter can be added later without changing renderer code or core orchestration
- **Testing (M5)**: Unit tests for prompt construction, OpenAI client behavior, and the enhancement client abstraction with mocked responses. Integration test: enhancement orchestration with a mocked OpenAI adapter.

### M6: Authorship Semantics & Enhancement UX
1. Stream or stage enhancement progress to the renderer via `enhance:progress`
2. Add retry and failure UX for enhancement without blocking note-taking
3. When user edits AI-marked content, remove the `authorship` mark so the edited content becomes human-authored
4. Tighten OpenAI disclosure copy so enhancement data flow is explicit in-product
5. Add renderer/store coverage for enhancement progress, retry, and authorship transitions
- **Testing (M6)**: Renderer tests for progress/failure/retry flows and editor tests that confirm edited AI content flips to human-authored rendering.

### M7: Polish & Packaging
1. Meeting history view (past enhanced notes, searchable)
2. Keyboard shortcuts (Cmd/Ctrl+E for enhance)
3. App icon, system tray / menu bar presence
4. README, setup docs, contributing guide
5. electron-builder packaging for macOS only (.dmg)
- **Testing (M7)**: End-to-end smoke test: packaged .dmg installs, launches, and completes a mock meeting flow. Meeting history search test.

## Error Handling & Degradation Modes

| Failure | Detection | Response | User Feedback |
|---------|-----------|----------|---------------|
| **Deepgram WebSocket disconnects** | `close`/`error` event on WS | Auto-reconnect with exponential backoff (max 3 retries). Keep capture active with bounded in-memory buffering during reconnect window. If reconnect fails, pause transcription and preserve meeting flow. | Toast: "Transcription reconnecting..." → "Transcription paused — check network" |
| **LLM API rate-limit / timeout** | HTTP 429 or timeout >30s | Retry once after delay. If second attempt fails, save raw notes+transcript and let user retry enhancement later. | Toast: "Enhancement delayed — will retry" with manual "Retry" button |
| **audioteejs permission denied** | Error on `start()` call | Show a guided permission flow: open System Settings > Privacy > System Audio Recording. Cannot proceed without permission. | Modal with step-by-step macOS permission instructions |
| **audioteejs crashes / unavailable** | Process exit or import failure | Degrade to mic-only mode (no system audio). User can still capture their own voice and type notes. | Banner: "System audio unavailable — recording microphone only" |
| **Network drops mid-meeting** | Deepgram WS close + fetch failures | Audio capture and note-taking continue uninterrupted. Transcript pauses. On reconnect, resume from last timestamp. Raw audio is NOT buffered to disk (privacy). | Status indicator: green → yellow → red |
| **Invalid/expired API key** | API returns 401/403 | Block the affected feature (transcription or enhancement). Prompt user to update key in settings. | Settings page opens with error highlight on the invalid key field |
| **Out of memory (long meeting)** | Ring buffer overflow, process memory >threshold | Backpressure: drop oldest unprocessed frames, emit diagnostic counter. If memory exceeds hard limit, gracefully stop recording and save what we have. | Toast: "Recording stopped — meeting saved" |

**Design principle**: Audio capture and note-taking NEVER stop due to cloud provider failures. The user can always type notes. Transcription and enhancement degrade gracefully with clear status indicators.

This is a hard AGENTS-derived invariant for all milestone work.

## Future: Cross-Platform Audio Capture (Deferred)

Current implementation scope is macOS only. MVP uses `audioteejs` (CoreAudio Taps API, macOS 14.2+).

Future cross-platform support can use `electron-audio-loopback` as a fallback. The `audio-manager.ts` can use platform detection to select capture methods:

```typescript
// audio-manager.ts — platform plugin pattern
function createAudioCapture() {
  if (process.platform === 'darwin') {
    return new AudioTeeCapture(); // audioteejs — best macOS UX
  }
  return new LoopbackCapture();   // electron-audio-loopback — cross-platform fallback
}
```

## Key Technical Challenges

1. **Renderer→main audio pipeline** — Keep IPC throughput stable with bounded buffers and deterministic frame alignment
2. **Deepgram streaming resilience** — Handle websocket reconnects, jitter, and transcript continuity during long meetings
3. **Note-transcript merge prompt** — Prompt engineering to intelligently blend sparse notes with verbose transcript
4. **Tiptap authorship marks** — Custom ProseMirror mark to track and render human vs AI text origin
5. **Audio capture permissions** — macOS requires "System Audio Recording" permission; need clean permission flow UX
6. **OpenAI privacy disclosure** — Ensure explicit UX disclosure for off-device processing and provider-level retention controls

## Verification

- [ ] Can capture system audio from a Zoom/Meet call without a bot
- [ ] Live transcript appears in real-time during a meeting
- [ ] User can type notes in the notepad during recording
- [ ] "Enhance Notes" merges user notes + transcript via LLM
- [ ] Enhanced output shows black (human) vs gray (AI) text
- [ ] If user edits an AI block, it becomes human-authored (black)
- [ ] Manual start/stop recording with user-entered meeting title
- [ ] Meeting notes persist in SQLite and are searchable
- [ ] Raw audio is never persisted to disk (validated via storage/path audit)
- [ ] First-run settings clearly disclose Deepgram/OpenAI off-device processing
- [ ] API keys are stored via Electron `safeStorage` (not plaintext config)
- [ ] Cloud/STT/LLM failure does not block note-taking flow
- [ ] `audioteejs` unavailability degrades cleanly to mic-only mode
- [ ] 60-minute session completes without unbounded buffer growth, drift, or process crashes
- [ ] App packages as a distributable .dmg for macOS

## Success Metrics (MVP Exit Criteria)

- **Transcript latency**: p95 end-to-end latency (audio captured to rendered transcript token) <= 2.5s on target Mac + stable broadband.
- **Enhancement latency**: p95 "Enhance Notes" completion time <= 20s for a 60-minute meeting transcript.
- **Crash-free sessions**: >= 99% of 30-minute sessions complete without app crash or forced restart.
- **Meeting-length stress**: 60-minute continuous session with no unbounded buffer growth and < 1% dropped audio frames.
