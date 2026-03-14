import { describe, expect, it } from 'vitest';
import { EnhancementProviderError } from '../../src/main/enhancement/llm-client';
import {
  parseEnhancedOutput,
  safeParseEnhancedOutput
} from '../../src/main/enhancement/parse-enhanced-output';

describe('parseEnhancedOutput', () => {
  it('parses a valid enhancement payload', () => {
    const output = parseEnhancedOutput(JSON.stringify({
      blocks: [
        { source: 'human', content: 'Follow up with design' },
        { source: 'ai', content: 'Design review context from transcript' }
      ],
      actionItems: [{ owner: 'You', description: 'Send recap', due: 'Friday' }],
      decisions: [{ description: 'Ship Friday', context: 'Agreed in the meeting' }],
      summary: 'Summary'
    }));

    expect(output).toEqual({
      blocks: [
        { source: 'human', content: 'Follow up with design' },
        { source: 'ai', content: 'Design review context from transcript' }
      ],
      actionItems: [{ owner: 'You', description: 'Send recap', due: 'Friday' }],
      decisions: [{ description: 'Ship Friday', context: 'Agreed in the meeting' }],
      summary: 'Summary'
    });
  });

  it('rejects malformed payloads with typed invalid_response errors', () => {
    expect(() =>
      parseEnhancedOutput('{"blocks":[],"actionItems":[],"decisions":[]}')
    ).toThrowError(EnhancementProviderError);

    try {
      parseEnhancedOutput('{"blocks":[],"actionItems":[],"decisions":[]}');
    } catch (error) {
      expect(error).toBeInstanceOf(EnhancementProviderError);
      expect((error as EnhancementProviderError).code).toBe('invalid_response');
    }
  });

  it('keeps ai blocks explicitly typed as ai-authored', () => {
    const output = parseEnhancedOutput({
      blocks: [{ source: 'ai', content: 'AI summary block' }],
      actionItems: [],
      decisions: [],
      summary: 'Summary'
    });

    expect(output.blocks[0]).toEqual({
      source: 'ai',
      content: 'AI summary block'
    });
  });

  it('accepts null due fields from structured output and omits them in the parsed result', () => {
    const output = parseEnhancedOutput({
      blocks: [],
      actionItems: [{ owner: 'You', description: 'Send recap', due: null }],
      decisions: [],
      summary: 'Summary'
    });

    expect(output.actionItems).toEqual([{ owner: 'You', description: 'Send recap' }]);
  });

  it('returns null for invalid persisted content through the safe parser', () => {
    expect(safeParseEnhancedOutput('{not json')).toBeNull();
  });
});
