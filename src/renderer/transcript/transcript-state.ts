import type { TranscriptUpdateEvent } from '../../shared/ipc';

const MAX_TRANSCRIPT_ENTRIES = 200;

export interface TranscriptEntry {
  id: string;
  ts: number;
  text: string;
  speaker: 'you' | 'them';
  isFinal: boolean;
}

export function transcriptEntriesToText(entries: TranscriptEntry[]): string {
  return entries
    .map((entry) => {
      const normalized = normalizeText(entry.text);
      if (normalized.length === 0) {
        return '';
      }
      return `${entry.speaker.toUpperCase()}: ${normalized}`;
    })
    .filter((line) => line.length > 0)
    .join('\n');
}

export function applyTranscriptEvent(
  existing: TranscriptEntry[],
  event: TranscriptUpdateEvent
): TranscriptEntry[] {
  const trimmedText = normalizeText(event.text);
  if (trimmedText.length === 0) {
    return existing;
  }

  const next = [...existing];
  const last = next[next.length - 1];

  if (!event.isFinal) {
    if (last && !last.isFinal && last.speaker === event.speaker) {
      const unchanged = normalizeText(last.text) === trimmedText;
      if (unchanged && last.ts === event.ts) {
        return next;
      }
      next[next.length - 1] = {
        ...last,
        text: event.text,
        ts: event.ts
      };
      return trimTranscript(next);
    }

    next.push(createEntry(event));
    return trimTranscript(next);
  }

  if (last && !last.isFinal && last.speaker === event.speaker) {
    next[next.length - 1] = {
      ...last,
      id: buildEntryId(event),
      text: event.text,
      ts: event.ts,
      isFinal: true
    };
    return trimTranscript(next);
  }

  if (
    last &&
    last.isFinal &&
    last.speaker === event.speaker &&
    normalizeText(last.text) === trimmedText
  ) {
    return next;
  }

  next.push(createEntry(event));
  return trimTranscript(next);
}

function createEntry(event: TranscriptUpdateEvent): TranscriptEntry {
  return {
    id: buildEntryId(event),
    ts: event.ts,
    text: event.text,
    speaker: event.speaker,
    isFinal: event.isFinal
  };
}

function buildEntryId(event: TranscriptUpdateEvent): string {
  return `${event.ts}-${event.speaker}-${event.isFinal ? 'f' : 'l'}`;
}

function trimTranscript(entries: TranscriptEntry[]): TranscriptEntry[] {
  return entries.slice(-MAX_TRANSCRIPT_ENTRIES);
}

function normalizeText(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}
