import { useEffect } from 'react';
import type { JsonObject } from '../../shared/ipc';
import type { NoteSaveState } from '../stores/meeting-store';

const AUTOSAVE_DELAY_MS = 400;

interface UseNoteAutosaveOptions {
  enabled: boolean;
  meetingId: string | null;
  noteContent: JsonObject | null;
  noteSaveState: NoteSaveState;
  setNoteSaveState: (state: NoteSaveState) => void;
  saveNotes: (payload: { meetingId: string; content: JsonObject }) => void;
  onError: (message: string) => void;
}

export function useNoteAutosave({
  enabled,
  meetingId,
  noteContent,
  noteSaveState,
  setNoteSaveState,
  saveNotes,
  onError
}: UseNoteAutosaveOptions): void {
  useEffect(() => {
    if (!enabled || !meetingId || !noteContent || noteSaveState !== 'dirty') {
      return;
    }

    const timer = window.setTimeout(() => {
      try {
        setNoteSaveState('saving');
        saveNotes({
          meetingId,
          content: noteContent
        });
        setNoteSaveState('saved');
      } catch {
        setNoteSaveState('dirty');
        onError('Could not save notes locally.');
      }
    }, AUTOSAVE_DELAY_MS);

    return () => {
      window.clearTimeout(timer);
    };
  }, [enabled, meetingId, noteContent, noteSaveState, onError, saveNotes, setNoteSaveState]);
}

export { AUTOSAVE_DELAY_MS };
