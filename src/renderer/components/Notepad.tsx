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
  templateBadgeLabel?: string;
  onShowOriginalNotes?: () => void;
  onShowEnhancedNotes?: () => void;
  onChange: (content: JsonObject) => void;
}

export function Notepad({
  content,
  editable,
  editorMode = 'notes',
  showViewToggle = false,
  templateBadgeLabel,
  onShowOriginalNotes,
  onShowEnhancedNotes,
  onChange
}: NotepadProps): JSX.Element {
  const editableRef = useRef(editable);
  const isEmptyDocument = !content || JSON.stringify(content) === JSON.stringify(EMPTY_NOTE_DOCUMENT);

  useEffect(() => {
    editableRef.current = editable;
  }, [editable]);

  const editor = useEditor({
    extensions: [StarterKit, AuthorshipMark],
    content: content ?? EMPTY_NOTE_DOCUMENT,
    editorProps: {
      attributes: {
        class:
          'min-h-[18rem] bg-transparent px-6 pb-10 pt-2 text-[1.08rem] leading-[1.9] text-ink outline-none',
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
    editor.setEditable(editable, false);
  }, [content, editable, editor]);

  if (!editor) {
    return (
      <section
        data-testid="notepad-editor"
        className="flex h-full items-center justify-center px-6 py-10 text-[#6b6257]"
      >
        Loading editor...
      </section>
    );
  }

  return (
    <section data-testid="notepad-editor" className="relative flex h-full flex-col">
      {templateBadgeLabel ? (
        <div
          data-testid="notepad-template-badge"
          className="absolute left-6 top-0 z-10 inline-flex rounded-full border border-[#d7cdbd] bg-[#f7f1e7] px-3 py-1 text-xs font-medium text-[#6b6257] shadow-[0_12px_24px_rgba(57,47,37,0.08)]"
        >
          {templateBadgeLabel}
        </div>
      ) : null}
      {showViewToggle ? (
        <div
          className="absolute right-6 top-0 z-10 inline-flex rounded-full border border-[#d9cfbf] bg-[#f8f3ea] p-1 shadow-[0_12px_24px_rgba(57,47,37,0.08)]"
          data-testid="notepad-view-toggle"
        >
          <button
            type="button"
            data-testid="notepad-view-original"
            onClick={onShowOriginalNotes}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
              editorMode === 'notes'
                ? 'bg-[#2d2926] text-white'
                : 'text-[#6b6257] hover:bg-[#eee7d9] hover:text-ink'
            }`}
          >
            Original
          </button>
          <button
            type="button"
            data-testid="notepad-view-enhanced"
            onClick={onShowEnhancedNotes}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
              editorMode === 'enhanced'
                ? 'bg-[#2d2926] text-white'
                : 'text-[#6b6257] hover:bg-[#eee7d9] hover:text-ink'
            }`}
          >
            Enhanced
          </button>
        </div>
      ) : null}

      {isEmptyDocument ? (
        <p className="pointer-events-none absolute left-6 top-4 text-[1.08rem] text-[#8f877c]">
          Write notes...
        </p>
      ) : null}

      <EditorContent editor={editor} className="min-h-0 flex-1 overflow-y-auto" />
    </section>
  );
}
