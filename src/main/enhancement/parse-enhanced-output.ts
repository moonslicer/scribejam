import type { EnhancedOutput } from '../../shared/ipc';
import { EnhancementProviderError } from './llm-client';

export function parseEnhancedOutput(value: unknown): EnhancedOutput {
  const parsed = typeof value === 'string' ? parseJson(value) : value;

  if (!isRecord(parsed)) {
    throw new EnhancementProviderError(
      'invalid_response',
      'Enhancement response must be a JSON object.',
      { cause: value }
    );
  }

  const { blocks, actionItems, decisions, summary } = parsed;

  if (!Array.isArray(blocks) || !Array.isArray(actionItems) || !Array.isArray(decisions) || typeof summary !== 'string') {
    throw new EnhancementProviderError(
      'invalid_response',
      'Enhancement response is missing required top-level fields.',
      { cause: value }
    );
  }

  return {
    blocks: blocks.map(parseEnhancedBlock),
    actionItems: actionItems.map(parseActionItem),
    decisions: decisions.map(parseDecision),
    summary
  };
}

export function safeParseEnhancedOutput(value: unknown): EnhancedOutput | null {
  try {
    return parseEnhancedOutput(value);
  } catch {
    return null;
  }
}

function parseJson(value: string): unknown {
  try {
    return JSON.parse(value) as unknown;
  } catch (error) {
    throw new EnhancementProviderError(
      'invalid_response',
      'Enhancement response was not valid JSON.',
      { cause: error }
    );
  }
}

function parseEnhancedBlock(value: unknown): EnhancedOutput['blocks'][number] {
  if (!isRecord(value) || (value.source !== 'human' && value.source !== 'ai') || typeof value.content !== 'string') {
    throw new EnhancementProviderError(
      'invalid_response',
      'Enhancement blocks must include a valid source and string content.'
    );
  }

  return {
    source: value.source,
    content: value.content
  };
}

function parseActionItem(value: unknown): EnhancedOutput['actionItems'][number] {
  if (!isRecord(value) || typeof value.owner !== 'string' || typeof value.description !== 'string') {
    throw new EnhancementProviderError(
      'invalid_response',
      'Action items must include owner and description strings.'
    );
  }

  if (value.due !== undefined && value.due !== null && typeof value.due !== 'string') {
    throw new EnhancementProviderError(
      'invalid_response',
      'Action item due values must be strings when provided.'
    );
  }

  return {
    owner: value.owner,
    description: value.description,
    ...(typeof value.due === 'string' ? { due: value.due } : {})
  };
}

function parseDecision(value: unknown): EnhancedOutput['decisions'][number] {
  if (!isRecord(value) || typeof value.description !== 'string' || typeof value.context !== 'string') {
    throw new EnhancementProviderError(
      'invalid_response',
      'Decisions must include description and context strings.'
    );
  }

  return {
    description: value.description,
    context: value.context
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
