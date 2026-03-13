import React from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Notepad } from '../../src/renderer/components/Notepad';

afterEach(() => {
  cleanup();
});

describe('Notepad', () => {
  it('renders initial content', async () => {
    render(
      <Notepad
        content={{
          type: 'doc',
          content: [
            {
              type: 'paragraph',
              content: [
                {
                  type: 'text',
                  text: 'Follow up next week'
                }
              ]
            }
          ]
        }}
        editable
        onChange={vi.fn()}
      />
    );

    expect(await screen.findByText('Follow up next week')).toBeInTheDocument();
  });

  it('renders authorship only when AI-marked content is present', async () => {
    const { rerender, container } = render(
      <Notepad
        content={{
          type: 'doc',
          content: [
            {
              type: 'paragraph',
              content: [
                {
                  type: 'text',
                  text: 'Plain human note'
                }
              ]
            }
          ]
        }}
        editable
        onChange={vi.fn()}
      />
    );

    await screen.findByText('Plain human note');
    expect(container.querySelector('[data-authorship="ai"]')).toBeNull();

    rerender(
      <Notepad
        content={{
          type: 'doc',
          content: [
            {
              type: 'paragraph',
              content: [
                {
                  type: 'text',
                  text: 'AI summary',
                  marks: [
                    {
                      type: 'authorship',
                      attrs: {
                        source: 'ai'
                      }
                    }
                  ]
                }
              ]
            }
          ]
        }}
        editable={false}
        onChange={vi.fn()}
      />
    );

    await waitFor(() => expect(container.querySelector('[data-authorship="ai"]')).not.toBeNull());
    expect(container.querySelector('[data-authorship="ai"]')).toHaveTextContent('AI summary');
  });
});
