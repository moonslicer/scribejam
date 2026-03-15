# Templates Feature Proposal

_Scribejam — Design Document_

---

## 1. Context & Motivation

The enhancement prompt is hardcoded in `build-enhancement-prompt.ts`. Iterating on it requires a code change, a rebuild, and a full meeting recording to test. That is 5–15 minutes of friction per iteration. It also means every meeting gets the same treatment regardless of context — a 1:1 with a direct report and a technical design review are processed identically.

Templates solve both problems at once:

1. **Iteration speed**: A user-editable template is a prompt change that takes seconds, not minutes. It bypasses the rebuild cycle entirely.
2. **Meeting context**: Different meeting types have genuinely different useful outputs. Templates tell the AI what matters for this kind of meeting — which fields to populate, at what threshold, and how to structure the result.

Templates are already listed in `future-extensions.md` as a Tier 2 power feature. This proposal scopes and designs them specifically for where Scribejam is today. It does not change milestone order in `AGENTS.md` / `PLAN.md`; templates remain post-MVP unless explicitly reprioritized.

---

## 2. Guiding Principles

**Templates shape output within the current `EnhancedOutput` contract.** The `EnhancedOutput` type has four fields: `blocks`, `actionItems`, `decisions`, and `summary`. Templates can strongly direct `summary`, `actionItems`, and `decisions`, and they can guide the emphasis, ordering, and sectioning of `blocks`. In v1, templates do **not** replace the existing block contract or output schema — they steer the current enhancement prompt rather than invent a new renderer model.

**What templates cannot do.** Templates cannot change the output schema, add fields that don't exist, or instruct the AI to hallucinate content not supported by the transcript. The grounding rules in the base prompt — no fabrication, no inference beyond what was said — are non-negotiable. Templates narrow and redirect within those rules; they do not override them.

**Authorship semantics stay non-negotiable.** Scribejam's black/gray distinction is a product invariant. Templates must not blur who wrote what. If the system synthesizes a heading, summary, action item, or decision, that content remains AI-authored. Templates can change structure, but they cannot relabel AI-generated text as human-authored.

**Templates are prompts, not UI structure.** There is no special DSL, no per-section config toggles, and no structured form in v1. Natural language instructions go straight into the prompt. The AI does the interpretation. This is flexible and requires zero template parsing.

**Keep the happy path frictionless.** A user who never sets a template should experience zero change from today. Auto (the default) is the existing behavior, with no regression.

**Re-enhancement is the multiplier.** Templates are most valuable when paired with the ability to re-run enhancement on an already-recorded meeting. Record once, re-enhance with different templates, compare results. This should ship with templates, not after.

---

## 3. What We Take from Granola — and What We Don't

### What we take

**Templates are plain text.** Granola gives users a text area to describe what they want. That instruction goes straight into the prompt. This approach is (a) infinitely flexible, (b) requires zero parsing, and (c) is itself a fast iteration surface — tweak wording, re-enhance, see the difference immediately.

**Re-enhance in place.** Granola's `✨Auto` toggle lets you switch templates and regenerate on the spot. The output replaces the previous enhanced view without going back to square one. We want this same flow.

**A small set of meaningful built-ins.** Granola ships 29 templates. We ship 4. More built-ins add decision paralysis; the custom template path handles the long tail.

**Templates apply at enhancement time, not recording time.** You may not know what kind of meeting you are in until it has started, or even after. Locking in a template at recording start is wrong. The right moment is right before you hit Enhance — or afterward when you re-enhance.

### What we don't take

**No organizational template sharing.** Granola lets teams share templates. That requires auth, a backend, and user accounts. Scribejam is local-first. Templates stay on-device.

**No template browser.** 29 pre-built templates need a UI to browse. 4 built-ins and a custom slot fit in a simple dropdown.

**No mid-meeting template application.** Granola's "Ask Granola" can apply a lens mid-meeting. That is in Scribejam's roadmap as a separate "Contextual chat" feature and should not be entangled with templates now.

---

## 4. The Template Data Model

```typescript
interface Template {
  id: string;           // 'auto' | 'one-on-one' | 'standup' | 'tech-review' | 'custom'
  name: string;         // Display name shown in the picker
  instructions: string; // Free-text prompt instructions; empty string for 'auto'
}
```

**Why a single `instructions` field instead of Granola's three (purpose, length/style, structure)?**

Granola's three-field form is a UX scaffold to help users write good instructions — it is not technically distinct from a single text area. Underneath, all three fields compose into one prompt block. A single text area is simpler to build and simpler to understand. If user research shows people struggle to know what to write, we can add placeholder hints or decompose the field later.

**Why include `id`?**

We need a stable identifier to (a) persist which template was used per-meeting, and (b) identify built-ins for display purposes. The `auto` id is special — it means "no additional instructions."

---

## 5. Built-in Templates

Built-in templates are constants in code, not stored in the database or settings. They are immutable. If a user wants to modify a built-in, they write their own version into the custom template slot.

**Why constants instead of a seeded database table or bundled JSON?**

Built-ins never change at runtime. Storing them in the database adds migration complexity for no benefit. A constants file is the simplest honest representation.

---

**Auto** (id: `auto`)

No additional instructions. Uses the default enhancement behavior. This is the default — selecting it is equivalent to not having templates at all. It must always be present and always be first.

---

**1:1 with Direct Report** (id: `one-on-one`)

```
This is a 1:1 meeting between a manager and a direct report. If the relationship is not clear from the transcript, fall back gracefully to a general 1:1 structure without inventing roles.

Blocks — structure in this order, skipping any section with no meaningful content:
- Blockers and support needed: include blockers or requests for help that were stated clearly
- Growth, performance, or career: anything discussed about the direct report's development
- General updates
- Any other topics

Action items: include these — 1:1s often produce commitments from both sides. Attribute carefully:
distinguish between what the direct report owns vs. what the manager committed to do.

Decisions: rare in 1:1s — only include if something was explicitly agreed upon.

Summary: 2–3 sentences. Name the main themes and call out any commitments the manager made.
```

**Why this one?** 1:1s are among the most common recurring meetings. The default prompt surfaces topics but does not know to separate blockers from updates or surface manager commitments specifically.

---

**Team Standup** (id: `standup`)

```
This is a team standup — brief per-person status updates.

Blocks: each person who gave an update should become their own heading block. Under each person, capture:
- What they completed or are currently working on
- Any blockers they called out
Keep bullets to one line each. Skip anyone who had no substantive update.

Action items: usually empty in standups. Only include them if someone explicitly committed to follow-up work during the meeting; otherwise return an empty array.

Decisions: usually empty in standups. Only include them if an explicit decision was made; otherwise return an empty array.

Summary: one or two sentences. Name who is blocked and on what. Skip general topic overviews.
```

**Why this one?** Standups are structurally different from every other meeting type. The default prompt produces topic-based output that mangles per-person updates. Action items and decisions are almost never the output of a standup — the template should say so explicitly rather than leaving the AI to guess.

---

**Technical Design Review** (id: `tech-review`)

```
This is a technical design or architecture review.

Blocks — structure to capture:
- The design or proposal under review
- Technical objections or concerns raised (note who raised them)
- Trade-offs discussed
- Open questions not resolved — collect these into an explicit "Open Questions" block if any exist
- Decisions reached about the design

Action items: include follow-up research, design revisions, and investigation tasks when they were explicitly assigned or clearly accepted in the meeting.

Decisions: this meeting type often produces design decisions — include them when the meeting reaches an explicit conclusion or clearly stated agreement. Do not infer decisions from tone alone.

Summary: 2–3 sentences. Focus on what was decided, what remains open, and what the next step is.
```

**Why this one?** Design reviews produce open questions and deferred decisions as much as resolved ones. The default prompt does not model "unresolved" well. This template explicitly invites an open questions block while still keeping decisions grounded in what the meeting actually concluded.

---

## 6. Custom Templates

Each user gets one custom template slot saved through the existing settings infrastructure (`SettingsStore` / `settings.json`), alongside other non-secret app settings.

**Why one slot instead of unlimited?**

Unlimited custom templates require a CRUD UI: create, rename, reorder, delete. That is significant surface area for an edge case. One slot covers the primary use case — a recurring meeting type not covered by built-ins. If two types are needed, the user swaps the slot. If usage shows this is genuinely constraining, expanding to three named slots is a natural next step with lower UI cost than full CRUD.

**Custom template UI**

A "Templates" section in Settings contains: a name input (shown in the picker) and a multi-line text area for instructions. Saved alongside existing settings. Intentionally in Settings rather than the workspace — editing a template is a configuration task, not a per-meeting task. The user refines it over time, not on the fly during a meeting.

**Instructions length cap**

Custom template instructions are capped at 4000 characters. This limit is enforced at two layers: the text area in Settings (character counter + disable Save above the cap) and the `isEnhanceMeetingRequest` IPC validator. The cap prevents an oversized instruction from silently consuming a disproportionate fraction of the context window or triggering unexpected LLM truncation behavior. 4000 characters is approximately 1000 tokens — large enough for any practical template, small enough to be negligible relative to transcript length.

---

## 7. UX Flow

### Selecting a template before enhancing

When the meeting is in `stopped`, `enhance_failed`, or `done` state, a template picker appears near the Enhance button in `MeetingDock`. It defaults to whatever `defaultTemplateId` is set in settings (which defaults to `auto`).

Options in the picker: the 4 built-ins, a divider, "Custom: [name]" if a custom template has been saved, then "Edit templates…" which navigates to Settings.

If `defaultTemplateId` is `'custom'` but no custom template has been saved (e.g., settings partially migrated or template was cleared), the picker silently falls back to `'auto'` — it does not show a broken entry or block enhancement.

The selection lives in component state until the user enhances. When they hit Enhance, the selected template id and instructions are passed into `EnhanceMeetingRequest`.

**Why not persist the pending template selection per-meeting?**

Until enhancement runs, there is nothing to associate a template with. The selection is ephemeral UI state. Once enhancement completes, the template id is stored with the meeting.

### Re-enhancing with a different template

After enhancement (`done` state), the template picker remains visible. The user changes the template and clicks Enhance again (label becomes "Re-enhance"). The new output replaces the previous enhanced view immediately.

**Why allow re-enhancement from `done` state?**

This is the fast iteration loop. The user has a recording — they want to compare how two templates treat the same meeting. Re-enhance is the only way to do this without recording again.

This is not a one-line change. `done → enhancing` is blocked in three places that must all be updated together:

1. `MeetingStateMachine.beginEnhancement()` — currently guards `state !== 'stopped'`; must also accept `done`
2. `EnhancementOrchestrator.beginEnhancement()` — the `hasLoadedEnhancementCandidate` check only considers `stopped | enhance_failed`; must include `done`
3. `EnhancementOrchestrator.beginEnhancement()` — the persisted-meeting guard `meeting.state !== 'stopped' && meeting.state !== 'enhance_failed'` must also allow `done`

All three must change atomically. Patching only one or two will result in a state machine error at runtime.

### Re-enhancing from `enhance_failed`

The template picker is also visible in `enhance_failed` state. When the user changes the template and retries from this state, the orchestrator calls `retryEnhancement(meetingId)` (the existing `enhance_failed` branch). The `templateInstructions` must be threaded through the IPC call and into `buildEnhancementPrompt` identically to the initial enhancement path — the retry branch is not special-cased.

### Confirmation on re-enhance

Re-enhancing replaces the current enhanced notes, including any manual edits the user made in the enhanced notepad. The confirmation guard must execute in the **renderer, before the `meeting:enhance` IPC call is sent** — not inside the orchestrator. This matters because `EnhancementOrchestrator.enhanceMeeting()` calls `enhancedNoteDocumentsRepository.deleteByMeetingId(meetingId)` immediately upon entry, before any output is produced. By the time the orchestrator runs, it is too late to show a confirmation.

The confirmation check compares two timestamps: `enhancedOutputCreatedAt` (when the last enhancement completed) and `enhancedNoteUpdatedAt` (when the enhanced note document was last saved). If `enhancedNoteUpdatedAt > enhancedOutputCreatedAt`, the user has made manual edits and a confirmation is required: "Re-enhancing will replace your edited notes. Continue?" If not, proceed immediately with no prompt.

Both timestamps must be exposed in `MeetingDetails` — see IPC changes in Section 9.

### Template badge

After enhancement, a small badge near the notes heading shows which template was applied (e.g., "1:1 with Direct Report"). Informational only — helps the user understand why notes look the way they do and gives them a starting point for changing it.

---

## 8. Prompt Integration

Template instructions are injected into `buildEnhancementPrompt` as a **second parameter**, not as a field on `EnhancementArtifacts`.

```typescript
// Before
function buildEnhancementPrompt(artifacts: EnhancementArtifacts): EnhancementPrompt

// After
function buildEnhancementPrompt(
  artifacts: EnhancementArtifacts,
  templateInstructions?: string
): EnhancementPrompt
```

**Why a parameter rather than a field on `EnhancementArtifacts`?**

`EnhancementArtifacts` represents persisted meeting data: the transcript, user notes, and meeting title. That data is loaded from the database and is intrinsic to the meeting. Template instructions are a runtime invocation choice — a user decision made at enhancement time, not a property of the meeting itself. Mixing them into the same struct blurs that boundary and would require `toEnhancementArtifacts()` (the DB-to-domain converter) to know about templates, which it shouldn't. A separate parameter keeps the boundary clean.

When `templateInstructions` is present and non-empty, a block is appended to the system prompt after the existing quality bar:

```
MEETING TYPE — shape all output fields according to these instructions:
[templateInstructions]
```

**Why append rather than prepend?**

The existing system prompt establishes non-negotiable rules: schema compliance, grounding in transcript, authorship semantics, and the current block structure. Template instructions narrow and redirect within those rules. Appending means the base rules are stated first and the template customizes on top. The base quality bar still applies — a template cannot instruct the AI to fabricate content or relabel AI output as human-authored.

**Why the system prompt rather than the user prompt?**

The user prompt contains data about this specific meeting: title, notes, transcript. The template is a standing instruction about how to interpret a meeting type — it belongs with the other standing instructions.

**When `templateInstructions` is absent or empty (Auto):** no block is added. The existing prompt is unchanged. Zero regression.

**Important constraint:** because the current prompt already hardcodes a heading/content-pair pattern for `blocks`, built-in and custom templates should be written to steer that structure, not to fight it. If we later want templates to define fundamentally different block shapes, that should be a follow-on prompt/renderer proposal rather than being implied here.

---

## 9. What Needs to Change in the Architecture

### State machine

Add explicit support for `done` → `enhancing` in three locations (see Section 7). Re-enhancement should be treated as a first-class allowed transition rather than as an exception to the old flow.

`MeetingStateMachine.beginEnhancement()` currently guards:
```typescript
if (this.snapshot.state !== 'stopped' || this.snapshot.meetingId !== meetingId)
```
Must become:
```typescript
if ((this.snapshot.state !== 'stopped' && this.snapshot.state !== 'done') || this.snapshot.meetingId !== meetingId)
```

### IPC

```typescript
// EnhanceMeetingRequest — add optional template fields
interface EnhanceMeetingRequest {
  meetingId: string;
  templateId?: string;           // persisted to meetings table on completion
  templateInstructions?: string; // injected into buildEnhancementPrompt; max 4000 chars
}

// Settings — add template config
interface Settings {
  // ... existing ...
  defaultTemplateId?: string;                           // defaults to 'auto'
  customTemplate?: { name: string; instructions: string };
}

interface SettingsSaveRequest {
  // ... existing ...
  defaultTemplateId?: string;
  customTemplate?: { name: string; instructions: string };
}

// MeetingDetails — expose last applied template for badge display
// and the timestamps needed for the re-enhance overwrite confirmation
interface MeetingDetails {
  // ... existing ...
  lastTemplateId?: string;
  lastTemplateName?: string;
  enhancedOutputCreatedAt?: string;  // ISO timestamp of latest enhancement run
  enhancedNoteUpdatedAt?: string;    // ISO timestamp of latest manual edit to enhanced note
}
```

No new IPC channels. Templates are read from settings (already fetched on load) and passed through the existing `meetingEnhance` channel.

**Validators**

`isEnhanceMeetingRequest` must be updated to validate the new fields:
- `templateId`: optional string, must be one of `'auto' | 'one-on-one' | 'standup' | 'tech-review' | 'custom'` if present
- `templateInstructions`: optional string, must be ≤ 4000 characters if present

`isSettingsSaveRequest` must be updated for the new settings fields:
- `defaultTemplateId`: optional string, same allowed values as `templateId`
- `customTemplate`: optional object, must have `name: string` and `instructions: string` (both required if the object is present); `instructions` must be ≤ 4000 characters

### Database

```sql
ALTER TABLE meetings ADD COLUMN last_template_id TEXT;
ALTER TABLE meetings ADD COLUMN last_template_name TEXT;
```

Set when enhancement completes. Used for the template badge and for meeting history context. Nullable — meetings enhanced before this feature have no template id.

**Why store both `last_template_id` and `last_template_name`?**

`last_template_name` is stored resolved at enhancement time for all template types, including built-ins. For built-ins, the name is derivable from the id and storing it is technically redundant. We store it anyway because: (a) it keeps the display query simple — no in-app lookup table needed, (b) if a built-in is ever renamed or removed, historical meetings still display a truthful badge, and (c) for `'custom'`, it is essential — the user can rename or clear the custom template after enhancement, and the meeting must still display the name that was applied.

**Custom template provenance:** `last_template_id = 'custom'` alone is insufficient to explain historical output. Persisting the resolved `last_template_name` at enhancement time means old meetings display a truthful badge even after the custom template is later changed.

### Storage note

`EnhancedOutputsRepository.save` already INSERTs rather than upserts. Re-enhancement naturally appends a new row. `getLatestByMeetingId` uses `ORDER BY id DESC LIMIT 1` and always returns the most recent run. Re-enhancement is already partially supported in storage; the missing work is primarily around state transition rules, UI affordance, and overwrite protection.

---

## 10. Out of Scope

**Per-field UI toggles.** No checkboxes to "disable action items" or "require decisions." Templates handle this via natural language. If the user wants no action items, they write "return an empty array for action items."

**Template versioning.** Overwriting the custom template loses the previous version. Acceptable — the custom template is live configuration, not a versioned artifact.

**Multiple custom slots.** One slot to start. Expand only if usage shows the constraint is real.

**Cloud/team sync.** Scribejam is local-first. Templates stay on device.

**Template application during recording.** The AI processes the full transcript after recording ends. Mid-meeting template selection has no effect on the current session.

---

## 11. Open Questions

**Template picker location: MeetingDock or Notepad area?**

Near the Enhance button in MeetingDock is more discoverable for new users. But once enhanced (`done` state), the picker sitting in the Dock may feel detached from the notes it controls. Granola places the toggle at the bottom of the note view for this reason. Worth prototyping both.

**Should "Auto" be renamed?**

"Auto" matches Granola's terminology. Alternatives: "Default," "General." Fine for now.

**Do we want to preserve the current "human heading + AI bullets" block model for all templates?**

This proposal assumes yes for v1. That keeps authorship semantics and renderer changes small. If we want per-template block structures that are not heading/content pairs, that needs its own prompt + rendering design because it would change both authorship behavior and the current `EnhancedOutput` expectations.

---

## 12. Verification Requirements

This feature touches prompt construction, typed IPC, persisted settings, state transitions, and overwrite safety. It is not done without explicit verification.

Minimum checks:

1. `Auto` produces identical prompt/output behavior to the current implementation when no template instructions are supplied.
2. `done → enhancing → done` works from both an in-memory meeting and a reloaded saved meeting.
3. Re-enhancing after editing enhanced notes shows the overwrite confirmation based on persisted enhancement-vs-edit timestamps.
4. Re-enhancing **without** manual edits proceeds immediately with no confirmation prompt.
5. Built-in template selection is carried through the existing `meeting:enhance` IPC contract and the applied template badge renders correctly when the meeting is reloaded.
6. A custom template save/load round-trip works through the existing settings store and survives app restart.
7. Invalid or empty custom template state degrades safely to `auto` rather than breaking enhancement.
8. `defaultTemplateId = 'custom'` with no saved custom template silently falls back to `auto` in the picker — no error, no broken entry.
9. `templateInstructions` at exactly 4000 characters is accepted; at 4001 characters it is rejected at the IPC validator layer with a clear error, not silently truncated.
10. Re-enhancing from `enhance_failed` state with a new template uses the new template instructions — the retry path is not special-cased.

Recommended automated coverage:

- Unit tests for `buildEnhancementPrompt` with and without `templateInstructions`; confirm the system prompt is unchanged when instructions are absent
- Unit tests for `isEnhanceMeetingRequest` and `isSettingsSaveRequest` covering the new fields, including boundary values for the length cap
- State machine tests for `done → enhancing` and `enhance_failed → enhancing` transitions
- Orchestrator tests confirming `templateInstructions` is passed to `buildEnhancementPrompt` on both first enhancement and retry
- Integration test covering persisted custom-template badge display and overwrite confirmation behavior

---

## 13. Implementation Phases

### Phase 1 — Re-enhancement (prerequisite, ships standalone)

1. Update `MeetingStateMachine.beginEnhancement()` to accept `done` state
2. Update `EnhancementOrchestrator.beginEnhancement()` at both guard sites to accept `done` state
3. Add `last_template_id` and `last_template_name` columns to `meetings` via migration
4. Update `EnhanceMeetingRequest` to accept optional `templateId` and `templateInstructions`; update `isEnhanceMeetingRequest` validator with allowed values and 4000-char length cap
5. Add `templateInstructions` as a second parameter to `buildEnhancementPrompt`; update orchestrator to pass it through on both first-run and retry paths
6. Add `enhancedOutputCreatedAt` and `enhancedNoteUpdatedAt` to `MeetingDetails`; populate from the latest `enhanced_outputs` row and `enhanced_note_documents` row respectively
7. Update `MeetingDetails` to expose `lastTemplateId` and `lastTemplateName`
8. Add "Re-enhance" affordance in `MeetingDock` when state is `done`
9. Implement overwrite confirmation in the renderer using the two exposed timestamps — fire the confirmation check before sending the `meeting:enhance` IPC call

_Delivers: re-enhance any past meeting to test prompt changes without a code change or a new recording._

### Phase 2 — Template picker and built-ins

1. Define the 4 built-in templates as constants in `src/main/enhancement/templates.ts`
2. Add the template picker to `MeetingDock` — visible in `stopped`, `enhance_failed`, and `done` states; fall back to `auto` if `defaultTemplateId = 'custom'` and no custom template exists
3. Wire selected template through `onEnhanceAction` into `EnhanceMeetingRequest`
4. Show the template badge in the Notepad header area after enhancement
5. Add `defaultTemplateId` to `Settings` / `SettingsSaveRequest`; update `isSettingsSaveRequest` validator
6. Add a default template selector in `SettingsPanel`

_Delivers: users can pick from built-in templates and see the result immediately via re-enhance._

### Phase 3 — Custom template

1. Add `customTemplate` to `Settings` / `SettingsSaveRequest`; update `isSettingsSaveRequest` to validate the nested object shape and the 4000-char limit on `instructions`
2. Add a "Templates" section to `SettingsPanel` with name input and instructions text area; show character count and disable Save when over the limit
3. Surface "Custom: [name]" in the picker when a custom template exists
4. Add "Edit templates…" option in the picker that navigates to Settings

_Delivers: users can write and iterate on their own template instructions entirely from the UI._
