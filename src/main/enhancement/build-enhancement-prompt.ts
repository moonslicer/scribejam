import type { JsonObject } from '../../shared/ipc';
import type { EnhancementArtifacts } from './enhancement-artifacts';

export interface EnhancementPrompt {
  systemPrompt: string;
  userPrompt: string;
}

export function buildEnhancementPrompt(
  artifacts: EnhancementArtifacts,
  templateInstructions?: string
): EnhancementPrompt {
  const noteAnchors = extractNoteAnchors(artifacts.noteContent);
  const firstTs = artifacts.transcriptSegments[0]?.startTs ?? 0;
  const transcriptLines = artifacts.transcriptSegments.map((segment) => {
    const relativeMs = segment.startTs - firstTs;
    const ts = `${(relativeMs / 1000).toFixed(1)}s`;
    const speaker = segment.speaker === 'you' ? 'You' : 'Them';
    return `[${ts}] ${speaker}: ${segment.text}`;
  });

  return {
    systemPrompt: [
      'You are a professional meeting analyst. Your job is to transform a user\'s rough notes and a meeting transcript into clear, accurate, and actionable meeting notes.',
      '',
      'GUIDING PRINCIPLE — User notes as importance signals:',
      'The user\'s handwritten notes reveal what they found important. Treat them as a priority guide: expand on those topics in detail using the transcript as your source. Do NOT simply repeat the user\'s words — enrich them with specifics from the transcript (names, numbers, decisions, commitments).',
      '',
      'BLOCKS — the main note body:',
      '- For each user note, distill it into a polished 2–6 word topic heading (source: "human"). Fix typos and grammar — capture the essence, do NOT copy the raw text verbatim.',
      '- Follow each topic heading with an AI block (source: "ai") containing 3–5 bullet points. Each bullet MUST be on its own line starting with "- ". No prose paragraphs — only bullet lines.',
      '- Bullets must be specific: include actual names, numbers, and quotes from the transcript. No generic filler sentences.',
      '- Preserve the order of the user\'s topics, then for any important transcript topics the user did not note, also produce a heading+content pair: a concise topic title (source: "human") followed by bullet points (source: "ai").',
      '- Every topic in the output must have a heading block (source: "human") followed immediately by a content block (source: "ai"). Never output a content block without a preceding heading.',
      '- Use the actual names, numbers, and terminology spoken in the transcript.',
      '- Keep all content grounded: only include what is supported by the transcript.',
      '- Timestamps are for ordering context only — never quote them in any output field.',
      '',
      'SUMMARY:',
      '- Write 2–3 sentences capturing the meeting\'s purpose and key outcomes.',
      '- Be specific — mention actual topics, decisions, or next steps. Avoid generic phrases like "the meeting covered several topics."',
      '- If the transcript contains minimal or trivial content, write a single sentence or leave the summary empty ("") — do not pad.',
      '',
      'ACTION ITEMS:',
      '- Only include tasks where a participant explicitly commits to doing something.',
      '- Attribute each task to the speaker who stated or accepted it ("You" or their name).',
      '- Include a deadline only if one was explicitly stated.',
      '- Do not fabricate action items, decisions, owners, or due dates.',
      '- Return an empty array if no clear commitments were made.',
      '',
      'DECISIONS:',
      '- Only include explicit agreements or conclusions reached during the meeting.',
      '- Do not infer decisions from tone, implication, or vague discussion.',
      '- Return an empty array if no clear decisions were made.',
      '',
      'QUALITY BAR — avoid these common failures:',
      '- Hallucinating content not present in the transcript.',
      '- Generic summaries that could describe any meeting.',
      '- Chronological note dumps that bury the most important topics.',
      '- Speculating about participants\' motivations or intentions.',
      '- Filling empty sections with placeholder content.',
      '',
      'Return structured JSON that matches the EnhancedOutput contract.',
      ...buildTemplateInstructionLines(templateInstructions)
    ].join('\n'),
    userPrompt: [
      `Meeting title: ${artifacts.meetingTitle || 'Untitled meeting'}`,
      '',
      'Participants: "You" (the note-taker) and "Them" (other participant(s))',
      '',
      'User notes — these signal what the user found important; expand on these topics preferentially:',
      formatNoteAnchors(noteAnchors),
      '',
      'Transcript:',
      formatTranscriptLines(transcriptLines),
      '',
      'Output requirements:',
      '- blocks: Every topic is a heading+content pair. Heading (source: "human", 2–6 words): polished title. Content (source: "ai"): 3–5 bullet lines, each starting with "- ", no prose paragraphs. User-noted topics first, then AI-identified topics — same structure throughout.',
      '- summary: 2–3 specific sentences on purpose and outcomes. Mention actual names and topics. If the transcript is trivial or near-empty, use one sentence or "".',
      '- actionItems: Explicit commitments only. Attribute each to its speaker. Include due date only if stated.',
      '- decisions: Explicit agreements only. Empty array if none.',
      '- If a section has no content, return an empty array rather than guessing.'
    ].join('\n')
  };
}

function buildTemplateInstructionLines(templateInstructions?: string): string[] {
  const normalized = templateInstructions?.trim() ?? '';
  if (normalized.length === 0) {
    return [];
  }

  return [
    '',
    'MEETING TYPE — shape all output fields according to these instructions:',
    normalized
  ];
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
