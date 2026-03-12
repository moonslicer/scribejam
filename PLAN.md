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
- **Mode A — Cloud-assisted (MVP default)**: live audio is sent to Deepgram for STT and transcript+notes are sent to Claude/OpenAI for enhancement.
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
│  │  │SQLite    │ │audioteejs │ │LLM Client│  │  │
│  │  │(better-  │ │(npm pkg,  │ │(Anthropic│  │  │
│  │  │ sqlite3) │ │CoreAudio) │ │ /OpenAI) │  │  │
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
- **LLM client**: `@anthropic-ai/sdk` for Claude, `openai` for GPT-4o
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
| `meeting:list` | invoke | `void` | `Meeting[]` | M5 |
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
| `enhance:progress` | `{ status: 'streaming' \| 'done' \| 'error', partial?: EnhancedOutput }` | M4 |
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
- **Providers**: `@anthropic-ai/sdk` (Claude) and `openai` package (OpenAI models)
- Configurable via `LLM_PROVIDER` (default) plus model-specific setting/env vars

#### Merge Prompt Design

The prompt receives two inputs and produces structured JSON:

**Inputs:**
1. `user_notes` — the user's raw typed notes (sparse, freeform)
2. `transcript` — the full meeting transcript with speaker labels and timestamps

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
- Local persistence by default; transcription/enhancement requests are processed by configured external providers
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
  speaker       TEXT NOT NULL,      -- 'you' | 'them'
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
  provider      TEXT NOT NULL,      -- 'claude' | 'openai'
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
- **First-run flow**: On first launch, a setup wizard collects:
  1. Deepgram API key (required for MVP transcription)
  2. LLM provider choice (Claude or OpenAI) + API key
  3. Data flow disclosure: clear explanation that audio goes to Deepgram, notes+transcript go to LLM provider
  4. User must explicitly acknowledge before proceeding
- **Storage**: API keys stored in Electron `safeStorage` (OS keychain-backed encryption)
- **Settings page**: Accessible anytime to change keys, switch providers, view data flow info
- **Validation**: Keys are tested on save (small API call) with clear error messages for invalid/expired keys

### Cloud Provider Data Flow (MVP Default)
- Live audio chunks are sent to Deepgram for STT; transcript text is returned to the app.
- User notes + transcript are sent to the selected LLM provider (Claude or OpenAI) for enhancement.
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
│   │   │   ├── audio-manager.ts     # audioteejs integration, manage audio streams
│   │   │   └── mic-capture.ts       # Microphone capture via IPC from renderer
│   │   ├── stt/
│   │   │   ├── stt-engine.ts        # STT interface + factory
│   │   │   ├── whisper-local.ts     # whisper-node integration
│   │   │   └── deepgram-api.ts      # Deepgram streaming (optional)
│   │   ├── enhance/
│   │   │   ├── merger.ts            # Note-transcript merge orchestration
│   │   │   ├── prompts.ts           # Enhancement prompt templates
│   │   │   └── llm-client.ts        # Claude/GPT client abstraction
│   │   ├── storage/
│   │   │   ├── db.ts                # better-sqlite3 operations
│   │   │   └── models.ts            # TypeScript types (Meeting, Note, Transcript)
│   │   └── meeting/
│   │       └── state-machine.ts     # Meeting state: idle→recording→enhancing→done
│   ├── renderer/                    # React frontend
│   │   ├── App.tsx
│   │   ├── components/
│   │   │   ├── Notepad.tsx          # Tiptap editor with authorship marks
│   │   │   ├── MeetingBar.tsx       # Start/stop button, timer, status
│   │   │   ├── EnhancedView.tsx     # Post-meeting enhanced notes
│   │   │   ├── MeetingList.tsx      # Past meetings sidebar
│   │   │   └── TranscriptPanel.tsx  # Live transcript display
│   │   ├── hooks/
│   │   │   ├── useMeeting.ts        # Meeting state management
│   │   │   └── useTranscript.ts     # Real-time transcript updates
│   │   └── stores/
│   │       └── meeting-store.ts     # Zustand for app state
│   └── preload/
│       └── index.ts                 # contextBridge API exposure
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
7. Binary speaker labeling: system audio = "them", mic = "you" (per-speaker diarization within system audio is deferred to post-MVP)
- **Testing (M2)**: Unit tests for ring buffer, frame alignment/mixing, and Deepgram reconnect logic. Integration test: mock WebSocket validates transcript event flow end-to-end.

### M3: Notepad Editor
1. Integrate Tiptap editor with custom `authorship` mark (human vs AI)
2. Split-pane layout: notepad (left) + live transcript (right)
3. User types notes freely during recording mode
4. Notes auto-saved to SQLite via `better-sqlite3`
5. Implement meeting state machine per the state machine definition above (including `enhance_failed` state and re-record transition)
6. Meeting title input field on start
- **Testing (M3)**: Unit tests for SQLite CRUD operations, note auto-save debounce, state machine transition guards. Renderer test: Tiptap editor renders and persists content round-trip.

### M4: AI Enhancement Engine
1. Add LLM provider selection + API key input to setup wizard / settings page
2. Build note-transcript merge prompt (the core AI feature)
3. Implement `llm-client.ts` with `@anthropic-ai/sdk` (streaming response)
4. "Enhance Notes" button: sends user notes + transcript to LLM
5. Render enhanced output with black (human) / gray (AI) visual distinction:
   - Transform `EnhancedOutput.blocks[]` into Tiptap `JSONContent` nodes, applying the custom `authorship` mark (`source: 'human'` → no mark/black, `source: 'ai'` → mark/gray)
   - `action_items`, `decisions`, and `summary` render as AI-authored sections appended after the block content
   - When user edits any AI-marked node, the `authorship` mark is removed (flips to human/black)
6. Support `openai` npm package as alternative LLM backend
- **Testing (M4)**: Unit tests for LLM client abstraction (mock provider responses), EnhancedOutput JSON→Tiptap doc transform, and authorship mark rendering. Integration test: full enhance flow with mocked LLM.

### M5: Polish & Packaging
1. Meeting history view (past enhanced notes, searchable)
2. Keyboard shortcuts (Cmd/Ctrl+E for enhance)
3. App icon, system tray / menu bar presence
4. README, setup docs, contributing guide
5. electron-builder packaging for macOS only (.dmg)
- **Testing (M5)**: End-to-end smoke test: packaged .dmg installs, launches, and completes a mock meeting flow. Meeting history search test.

## Error Handling & Degradation Modes

| Failure | Detection | Response | User Feedback |
|---------|-----------|----------|---------------|
| **Deepgram WebSocket disconnects** | `close`/`error` event on WS | Auto-reconnect with exponential backoff (max 3 retries). Buffer audio frames during reconnect window. If reconnect fails, fall back to whisper-node if available, else pause transcription. | Toast: "Transcription reconnecting..." → "Transcription paused — check network" |
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
6. **Provider privacy disclosure** — Ensure explicit UX disclosure for off-device processing and provider-level retention controls

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
- [ ] First-run settings clearly disclose Deepgram/Claude/OpenAI off-device processing
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
