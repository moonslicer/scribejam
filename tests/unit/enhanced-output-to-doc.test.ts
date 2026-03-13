import { describe, expect, it } from 'vitest';
import { enhancedOutputToDoc } from '../../src/renderer/editor/enhanced-output-to-doc';

describe('enhancedOutputToDoc', () => {
  it('renders human blocks without the authorship mark', () => {
    const doc = enhancedOutputToDoc({
      blocks: [
        {
          source: 'human',
          content: 'Follow up with design'
        }
      ],
      actionItems: [],
      decisions: [],
      summary: ''
    });

    const content = (doc.content ?? []) as Array<{ content?: Array<{ marks?: unknown[]; text?: string }> }>;
    const paragraph = content[0]!;
    expect(paragraph.content?.[0]?.text).toBe('Follow up with design');
    expect(paragraph.content?.[0]?.marks).toBeUndefined();
  });

  it('renders AI blocks with the authorship mark', () => {
    const doc = enhancedOutputToDoc({
      blocks: [
        {
          source: 'ai',
          content: 'Transcript context'
        }
      ],
      actionItems: [],
      decisions: [],
      summary: ''
    });

    const content = (doc.content ?? []) as Array<{
      content?: Array<{ marks?: Array<{ type: string; attrs: { source: string } }> }>;
    }>;
    const paragraph = content[0]!;
    expect(paragraph.content?.[0]?.marks).toEqual([
      {
        type: 'authorship',
        attrs: {
          source: 'ai'
        }
      }
    ]);
  });

  it('appends summary, action items, and decisions in order', () => {
    const doc = enhancedOutputToDoc({
      blocks: [
        {
          source: 'human',
          content: 'Anchor note'
        }
      ],
      actionItems: [
        {
          owner: 'You',
          description: 'Send the draft',
          due: 'Friday'
        }
      ],
      decisions: [
        {
          description: 'Ship on Friday',
          context: 'Them said ship on Friday'
        }
      ],
      summary: 'Meeting summary'
    });

    const content = (doc.content ?? []) as Array<{ type?: string; content?: unknown[] }>;
    const nodeTypes = content.map((node) => node.type);
    expect(nodeTypes).toEqual([
      'paragraph',
      'heading',
      'paragraph',
      'heading',
      'bulletList',
      'heading',
      'bulletList'
    ]);

    const summaryParagraph = content[2] as { content?: Array<{ text?: string }> };
    const actionItemsList = content[4] as {
      content?: Array<{ content?: Array<{ content?: Array<{ text?: string }> }> }>;
    };
    const decisionsList = content[6] as {
      content?: Array<{ content?: Array<{ content?: Array<{ text?: string }> }> }>;
    };

    expect(summaryParagraph.content?.[0]?.text).toBe('Meeting summary');
    expect(actionItemsList.content?.[0]?.content?.[0]?.content?.[0]?.text).toBe(
      'You: Send the draft (Due: Friday)'
    );
    expect(decisionsList.content?.[0]?.content?.[0]?.content?.[0]?.text).toBe(
      'Ship on Friday (Them said ship on Friday)'
    );
  });
});
