export type PersistedMeetingState =
  | 'idle'
  | 'recording'
  | 'stopped'
  | 'enhancing'
  | 'enhance_failed'
  | 'done';

export interface MeetingRecord {
  id: string;
  title: string;
  state: PersistedMeetingState;
  createdAt: string;
  updatedAt: string;
  durationMs: number | null;
}

export interface NoteRecord {
  id: string;
  meetingId: string;
  content: string;
  updatedAt: string;
}

export interface TranscriptSegmentRecord {
  id: number;
  meetingId: string;
  speaker: 'you' | 'them';
  text: string;
  startTs: number;
  endTs: number | null;
  isFinal: boolean;
}

export interface EnhancedOutputRecord {
  id: number;
  meetingId: string;
  content: string;
  createdAt: string;
}

export interface PersistedMeetingArtifacts {
  meeting: MeetingRecord;
  note: NoteRecord | null;
  transcriptSegments: TranscriptSegmentRecord[];
  enhancedOutput: EnhancedOutputRecord | null;
}
