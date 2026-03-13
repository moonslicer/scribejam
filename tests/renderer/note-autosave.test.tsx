import React from 'react';
import { render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AUTOSAVE_DELAY_MS, useNoteAutosave } from '../../src/renderer/hooks/use-note-autosave';

function AutosaveHarness(props: {
  enabled: boolean;
  meetingId: string | null;
  noteContent: { type: string; content?: unknown[] } | null;
  noteSaveState: 'idle' | 'dirty' | 'saving' | 'saved';
  onSetState: (state: 'idle' | 'dirty' | 'saving' | 'saved') => void;
  onSave: (payload: { meetingId: string; content: { type: string; content?: unknown[] } }) => void;
  onError: (message: string) => void;
}): null {
  useNoteAutosave({
    enabled: props.enabled,
    meetingId: props.meetingId,
    noteContent: props.noteContent,
    noteSaveState: props.noteSaveState,
    setNoteSaveState: props.onSetState,
    saveNotes: props.onSave,
    onError: props.onError
  });
  return null;
}

describe('useNoteAutosave', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('debounces rapid note updates into one save', () => {
    vi.useFakeTimers();
    const onSave = vi.fn();
    const onError = vi.fn();
    let noteSaveState: 'idle' | 'dirty' | 'saving' | 'saved' = 'dirty';
    const onSetState = vi.fn((nextState: 'idle' | 'dirty' | 'saving' | 'saved') => {
      noteSaveState = nextState;
    });

    const { rerender } = render(
      <AutosaveHarness
        enabled
        meetingId="meeting-1"
        noteContent={{ type: 'doc' }}
        noteSaveState={noteSaveState}
        onSetState={onSetState}
        onSave={onSave}
        onError={onError}
      />
    );

    rerender(
      <AutosaveHarness
        enabled
        meetingId="meeting-1"
        noteContent={{ type: 'doc', content: [{ type: 'paragraph' }] }}
        noteSaveState="dirty"
        onSetState={onSetState}
        onSave={onSave}
        onError={onError}
      />
    );

    vi.advanceTimersByTime(AUTOSAVE_DELAY_MS - 1);
    expect(onSave).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith({
      meetingId: 'meeting-1',
      content: { type: 'doc', content: [{ type: 'paragraph' }] }
    });
    expect(onSetState).toHaveBeenCalledWith('saving');
    expect(onSetState).toHaveBeenCalledWith('saved');
  });

  it('does not autosave without an active meeting id', () => {
    vi.useFakeTimers();
    const onSave = vi.fn();

    render(
      <AutosaveHarness
        enabled
        meetingId={null}
        noteContent={{ type: 'doc' }}
        noteSaveState="dirty"
        onSetState={vi.fn()}
        onSave={onSave}
        onError={vi.fn()}
      />
    );

    vi.advanceTimersByTime(AUTOSAVE_DELAY_MS + 50);
    expect(onSave).not.toHaveBeenCalled();
  });
});
