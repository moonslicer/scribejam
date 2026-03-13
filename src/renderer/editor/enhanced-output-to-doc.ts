import type { JSONContent } from '@tiptap/core';
import type { EnhancedOutput, JsonObject } from '../../shared/ipc';

export function enhancedOutputToDoc(output: EnhancedOutput): JsonObject {
  const content: JSONContent[] = [];

  for (const block of output.blocks) {
    content.push(createParagraph(block.content, block.source === 'ai'));
  }

  if (output.summary.trim().length > 0) {
    content.push(createHeading('Summary'));
    content.push(createParagraph(output.summary, true));
  }

  if (output.actionItems.length > 0) {
    content.push(createHeading('Action Items'));
    content.push({
      type: 'bulletList',
      content: output.actionItems.map((item) => ({
        type: 'listItem',
        content: [
          createParagraph(
            item.due ? `${item.owner}: ${item.description} (Due: ${item.due})` : `${item.owner}: ${item.description}`,
            true
          )
        ]
      }))
    });
  }

  if (output.decisions.length > 0) {
    content.push(createHeading('Decisions'));
    content.push({
      type: 'bulletList',
      content: output.decisions.map((decision) => ({
        type: 'listItem',
        content: [createParagraph(`${decision.description} (${decision.context})`, true)]
      }))
    });
  }

  return {
    type: 'doc',
    content
  };
}

function createHeading(text: string): JSONContent {
  return {
    type: 'heading',
    attrs: {
      level: 2
    },
    content: [createTextNode(text)]
  };
}

function createParagraph(text: string, aiAuthored: boolean): JSONContent {
  return {
    type: 'paragraph',
    content: text.length > 0 ? [createTextNode(text, aiAuthored)] : []
  };
}

function createTextNode(text: string, aiAuthored = false): JSONContent {
  return {
    type: 'text',
    text,
    ...(aiAuthored
      ? {
          marks: [
            {
              type: 'authorship',
              attrs: {
                source: 'ai'
              }
            }
          ]
        }
      : {})
  };
}
