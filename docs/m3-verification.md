# M3 Verification

This document records the intended verification surface for the M3 notepad milestone.

## Automated Checks

Run:

```sh
npm test
npm run typecheck
npm run build
```

Coverage focus:

- storage bootstrap and repository CRUD
- meeting lifecycle persistence
- meeting state machine transition guards
- title entry flow
- split-pane workspace rendering
- notepad/editor rendering and authorship mark behavior
- note autosave debounce
- persisted meeting hydration back into the app

## Manual Smoke Checklist

Use this checklist when validating the desktop app interactively:

1. Launch the app and confirm the notepad/editor pane is visible beside the transcript pane.
2. Enter a meeting title and start recording.
3. Type notes while recording and confirm the note editor stays responsive.
4. Confirm transcript lines continue to appear in the transcript pane.
5. Stop the meeting and wait for note autosave to settle.
6. Restart the app or reload the meeting context and confirm:
   - the meeting title is preserved
   - note content is restored
   - transcript content is restored
7. Confirm no raw audio files were written as part of the flow.

## Residual Risks

- Tiptap editor behavior is covered by renderer tests, but rich desktop editing behavior should still be spot-checked manually.
- Meeting history UI is still out of scope for M3, so restored content currently depends on an active meeting id rather than a full history picker.
