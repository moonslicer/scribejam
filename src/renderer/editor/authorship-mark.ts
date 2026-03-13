import { Mark, mergeAttributes } from '@tiptap/core';

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
  }
});
