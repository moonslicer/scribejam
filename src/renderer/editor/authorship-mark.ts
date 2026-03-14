import { Mark, mergeAttributes } from '@tiptap/core';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { Plugin } from '@tiptap/pm/state';
import type { EditorView } from '@tiptap/pm/view';

export interface AuthorshipAttributes {
  source: 'human' | 'ai';
}

export const AuthorshipMark = Mark.create<AuthorshipAttributes>({
  name: 'authorship',

  addAttributes() {
    return {
      source: {
        default: 'ai'
      }
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-authorship]'
      }
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const source = HTMLAttributes.source === 'human' ? 'human' : 'ai';
    return [
      'span',
      mergeAttributes(HTMLAttributes, {
        'data-authorship': source,
        class: source === 'ai' ? 'text-slate-500' : 'text-ink'
      }),
      0
    ];
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        props: {
          handleTextInput(view, from, to) {
            stripAiAuthorship(view, from, to);
            return false;
          },
          handlePaste(view) {
            const { from, to } = view.state.selection;
            stripAiAuthorship(view, from, to);
            return false;
          },
          handleKeyDown(view, event) {
            if (event.key !== 'Backspace' && event.key !== 'Delete') {
              return false;
            }

            const { from, to, empty } = view.state.selection;
            if (!empty) {
              stripAiAuthorship(view, from, to);
              return false;
            }

            if (event.key === 'Backspace' && from > 1) {
              stripAiAuthorship(view, from - 1, from);
            }

            if (event.key === 'Delete') {
              stripAiAuthorship(view, from, from + 1);
            }

            return false;
          }
        }
      })
    ];
  }
});

function stripAiAuthorship(view: EditorView, from: number, to: number): void {
  const markType = view.state.schema.marks.authorship;
  if (!markType) {
    return;
  }

  const aiMark = markType.create({ source: 'ai' });
  const ranges = collectAiRanges(view.state.doc, from, to);
  if (ranges.length === 0 && !view.state.storedMarks?.some((mark) => mark.eq(aiMark))) {
    return;
  }

  let tr = view.state.tr.removeStoredMark(markType);
  let changed = false;
  for (const range of ranges) {
    tr = tr.removeMark(range.from, range.to, aiMark);
    changed = true;
  }

  if (changed || view.state.storedMarks !== null) {
    view.dispatch(tr);
  }
}

function collectAiRanges(
  doc: ProseMirrorNode,
  from: number,
  to: number
): Array<{ from: number; to: number }> {
  const searchFrom = Math.max(0, Math.min(from, to) - (from === to ? 1 : 0));
  const searchTo = Math.min(doc.content.size, Math.max(from, to) + 1);
  const ranges: Array<{ from: number; to: number }> = [];

  doc.nodesBetween(searchFrom, searchTo, (node, pos) => {
    if (!node.isText || !node.marks.some((mark) => mark.type.name === 'authorship' && mark.attrs.source === 'ai')) {
      return;
    }

    ranges.push({
      from: pos,
      to: pos + node.nodeSize
    });
  });

  return mergeRanges(ranges);
}

function mergeRanges(
  ranges: Array<{ from: number; to: number }>
): Array<{ from: number; to: number }> {
  if (ranges.length <= 1) {
    return ranges;
  }

  const merged: Array<{ from: number; to: number }> = [];
  const sorted = [...ranges].sort((left, right) => left.from - right.from);

  for (const range of sorted) {
    const previous = merged[merged.length - 1];
    if (!previous || range.from > previous.to) {
      merged.push(range);
      continue;
    }

    previous.to = Math.max(previous.to, range.to);
  }

  return merged;
}
