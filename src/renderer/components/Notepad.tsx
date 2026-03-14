import { useEffect, useRef } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import type { JsonObject } from '../../shared/ipc';
import { AuthorshipMark } from '../editor/authorship-mark';

export const EMPTY_NOTE_DOCUMENT: JsonObject = {
  type: 'doc',
  content: [
    {
      type: 'paragraph'
    }
  ]
};

interface NotepadProps {
  content: JsonObject | null;
  editable: boolean;
  editorMode?: 'notes' | 'enhanced';
  showViewToggle?: boolean;
  onShowOriginalNotes?: () => void;
  onShowEnhancedNotes?: () => void;
  onChange: (content: JsonObject) => void;
}

export function Notepad({
  content,
  editable,
  editorMode = 'notes',
  showViewToggle = false,
  onShowOriginalNotes,
  onShowEnhancedNotes,
  onChange
}: NotepadProps): JSX.Element {
  const editableRef = useRef(editable);

  useEffect(() => {
    editableRef.current = editable;
  }, [editable]);

  const editor = useEditor({
    extensions: [StarterKit, AuthorshipMark],
    content: content ?? EMPTY_NOTE_DOCUMENT,
    editorProps: {
      attributes: {
        class:
          'min-h-[18rem] rounded-xl border border-zinc-200 bg-white px-4 py-4 text-sm leading-6 text-ink shadow-sm outline-none focus-visible:border-zinc-400',
        'data-testid': 'notepad-editor-input'
      }
    },
    editable,
    onUpdate: ({ editor: currentEditor }) => {
      if (!editableRef.current) {
        return;
      }
      onChange(currentEditor.getJSON() as JsonObject);
    }
  });

  useEffect(() => {
    if (!editor) {
      return;
    }

    const serializedIncoming = JSON.stringify(content ?? EMPTY_NOTE_DOCUMENT);
    const serializedCurrent = JSON.stringify(editor.getJSON());
    if (serializedIncoming !== serializedCurrent) {
      editor.commands.setContent(content ?? EMPTY_NOTE_DOCUMENT, {
        emitUpdate: false
      });
    }
    editor.setEditable(editable);
  }, [content, editable, editor]);

  if (!editor) {
    return (
      <section
        data-testid="notepad-editor"
        className="rounded-xl border border-zinc-200 bg-white/85 p-4 shadow-sm"
      >
        Loading editor...
      </section>
    );
  }

  return (
    <section data-testid="notepad-editor" className="flex h-full flex-col gap-3">
      <header className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">Notes</p>
          <h2 className="text-lg font-semibold text-ink">Meeting notepad</h2>
        </div>
        <div className="flex items-center gap-3">
          {showViewToggle ? (
            <div
              className="inline-flex rounded-lg border border-zinc-200 bg-white p-1"
              data-testid="notepad-view-toggle"
            >
              <button
                type="button"
                data-testid="notepad-view-original"
                onClick={onShowOriginalNotes}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                  editorMode === 'notes'
                    ? 'bg-zinc-900 text-white'
                    : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'
                }`}
              >
                Original Notes
              </button>
              <button
                type="button"
                data-testid="notepad-view-enhanced"
                onClick={onShowEnhancedNotes}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                  editorMode === 'enhanced'
                    ? 'bg-zinc-900 text-white'
                    : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'
                }`}
              >
                Enhanced
              </button>
            </div>
          ) : null}
          <p className="text-xs text-zinc-500">{editable ? 'Typing enabled' : 'Read-only'}</p>
        </div>
      </header>
      <EditorContent editor={editor} />
    </section>
  );
}
