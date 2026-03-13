import type { JsonObject } from '../../shared/ipc';
import type { EnhancementArtifacts } from './enhancement-artifacts';

export interface EnhancementPrompt {
  systemPrompt: string;
  userPrompt: string;
}

export function buildEnhancementPrompt(
  artifacts: EnhancementArtifacts
): EnhancementPrompt {
  const noteAnchors = extractNoteAnchors(artifacts.noteContent);
  const transcriptLines = artifacts.transcriptSegments.map((segment) => {
    const ts = `${(segment.startTs / 1000).toFixed(2)}s`;
    const speaker = segment.speaker === 'you' ? 'You' : 'Them';
    return `[${ts}] ${speaker}: ${segment.text}`;
  });

  return {
    systemPrompt: [
      'You are a meeting note enhancer.',
      'Preserve every user note verbatim as a human-authored anchor.',
      'Add AI-authored context only when it is supported by the transcript.',
      'Do not overwrite, rewrite, or silently absorb user-authored notes into AI blocks.',
      'Do not fabricate action items, decisions, owners, or due dates.',
      'Return structured JSON that matches the EnhancedOutput contract.'
    ].join(' '),
    userPrompt: [
      `Meeting title: ${artifacts.meetingTitle || 'Untitled meeting'}`,
      '',
      'User notes (preserve verbatim as human anchors):',
      formatNoteAnchors(noteAnchors),
      '',
      'Transcript context:',
      formatTranscriptLines(transcriptLines),
      '',
      'Output requirements:',
      '- Keep original user note text exactly as written in human blocks.',
      '- Add AI blocks only for transcript-grounded expansions or missing important topics.',
      '- Provide summary, actionItems, and decisions in the final JSON.',
      '- If context is missing, return empty arrays rather than guessing.'
    ].join('\n')
  };
}

function formatNoteAnchors(noteAnchors: string[]): string {
  if (noteAnchors.length === 0) {
    return '- No user notes were captured.';
  }

  return noteAnchors.map((anchor) => `- ${anchor}`).join('\n');
}

function formatTranscriptLines(transcriptLines: string[]): string {
  if (transcriptLines.length === 0) {
    return '- No finalized transcript context was captured.';
  }

  return transcriptLines.map((line) => `- ${line}`).join('\n');
}

function extractNoteAnchors(noteContent: JsonObject | null): string[] {
  if (!noteContent) {
    return [];
  }

  const content = Array.isArray(noteContent.content) ? noteContent.content : [];
  const noteAnchors: string[] = [];

  for (const node of content) {
    if (!node || typeof node !== 'object' || Array.isArray(node)) {
      continue;
    }

    const text = collectText(node).trim();
    if (text.length > 0) {
      noteAnchors.push(text);
    }
  }

  return noteAnchors;
}

function collectText(node: unknown): string {
  if (!node || typeof node !== 'object') {
    return '';
  }

  if (Array.isArray(node)) {
    return node.map((child) => collectText(child)).join(' ').trim();
  }

  const candidate = node as {
    text?: unknown;
    content?: unknown;
  };
  const ownText = typeof candidate.text === 'string' ? candidate.text : '';
  const childText = Array.isArray(candidate.content)
    ? candidate.content.map((child) => collectText(child)).join(' ').trim()
    : '';

  return `${ownText} ${childText}`.trim();
}
