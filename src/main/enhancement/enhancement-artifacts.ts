import type { JsonObject, TranscriptSegment } from '../../shared/ipc';
import type { PersistedMeetingArtifacts } from '../storage/models';

export interface EnhancementArtifacts {
  meetingId: string;
  meetingTitle: string;
  noteContent: JsonObject | null;
  transcriptSegments: TranscriptSegment[];
}

export function toEnhancementArtifacts(
  persisted: PersistedMeetingArtifacts
): EnhancementArtifacts {
  return {
    meetingId: persisted.meeting.id,
    meetingTitle: persisted.meeting.title,
    noteContent: parseStoredNoteContent(persisted.note?.content),
    transcriptSegments: persisted.transcriptSegments
      .filter((segment) => segment.isFinal)
      .map((segment) => ({
        id: segment.id,
        speaker: segment.speaker,
        text: segment.text.trim(),
        startTs: segment.startTs,
        endTs: segment.endTs,
        isFinal: segment.isFinal
      }))
      .filter((segment) => segment.text.length > 0)
  };
}

function parseStoredNoteContent(content: string | undefined): JsonObject | null {
  if (!content) {
    return null;
  }

  try {
    const parsed = JSON.parse(content) as JsonObject;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed;
    }
  } catch {
    return null;
  }

  return null;
}
