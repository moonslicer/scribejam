import type {
  EnhancedBlock,
  EnhancedDecision,
  EnhancedOutput,
  JsonObject,
  TranscriptSegment
} from '../../shared/ipc';
import type { EnhancementArtifacts } from './enhancement-artifacts';

export class MockEnhancementService {
  public enhance(input: EnhancementArtifacts): EnhancedOutput {
    const noteAnchors = extractNoteAnchors(input.noteContent);
    const transcriptLines = input.transcriptSegments
      .map((segment) => `${formatSpeaker(segment.speaker)}: ${segment.text.trim()}`)
      .filter((line) => line.length > 0);

    const blocks: EnhancedBlock[] = noteAnchors.map((content) => ({
      source: 'human',
      content
    }));

    if (transcriptLines.length > 0) {
      blocks.push({
        source: 'ai',
        content: buildTranscriptContextBlock(transcriptLines)
      });
    } else {
      blocks.push({
        source: 'ai',
        content: 'Transcript context was unavailable for this meeting.'
      });
    }

    return {
      blocks,
      actionItems: buildActionItems(input.transcriptSegments),
      decisions: buildDecisions(input.transcriptSegments),
      summary: buildSummary(noteAnchors, transcriptLines)
    };
  }
}

function extractNoteAnchors(noteContent: JsonObject | null): string[] {
  if (!noteContent) {
    return [];
  }

  const paragraphs: string[] = [];
  const content = Array.isArray(noteContent.content) ? noteContent.content : [];

  for (const node of content) {
    if (!node || typeof node !== 'object' || Array.isArray(node)) {
      continue;
    }

    const paragraphText = collectText(node).trim();
    if (paragraphText.length > 0) {
      paragraphs.push(paragraphText);
    }
  }

  return paragraphs;
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

function buildTranscriptContextBlock(transcriptLines: string[]): string {
  const excerpt = transcriptLines.slice(0, 3);
  return ['Transcript context:', ...excerpt.map((line) => `- ${line}`)].join('\n');
}

function buildActionItems(transcriptSegments: TranscriptSegment[]): EnhancedOutput['actionItems'] {
  return transcriptSegments
    .filter((segment) => ACTION_ITEM_PATTERN.test(segment.text))
    .slice(0, 5)
    .map((segment) => ({
      owner: formatSpeaker(segment.speaker),
      description: segment.text.trim()
    }));
}

function buildDecisions(transcriptSegments: TranscriptSegment[]): EnhancedDecision[] {
  return transcriptSegments
    .filter((segment) => DECISION_PATTERN.test(segment.text))
    .slice(0, 5)
    .map((segment) => ({
      description: segment.text.trim(),
      context: `${formatSpeaker(segment.speaker)} said: ${segment.text.trim()}`
    }));
}

function buildSummary(noteAnchors: string[], transcriptLines: string[]): string {
  const noteSummary =
    noteAnchors.length > 0 ? `User notes captured ${noteAnchors.length} anchor point(s).` : 'No user note anchors were captured.';
  const transcriptSummary =
    transcriptLines.length > 0
      ? `Transcript captured ${transcriptLines.length} segment(s) for enhancement context.`
      : 'Transcript context was unavailable.';

  return `${noteSummary} ${transcriptSummary}`;
}

function formatSpeaker(speaker: TranscriptSegment['speaker']): string {
  return speaker === 'you' ? 'You' : 'Them';
}

const ACTION_ITEM_PATTERN = /\b(send|share|follow up|ship|review|draft|action|next step)\b/i;
const DECISION_PATTERN = /\b(decided|agreed|approved|plan|will)\b/i;
