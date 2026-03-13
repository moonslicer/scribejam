import type Database from 'better-sqlite3';
import type {
  EnhancedOutputRecord,
  MeetingRecord,
  NoteRecord,
  PersistedMeetingArtifacts,
  PersistedMeetingState,
  TranscriptSegmentRecord
} from './models';

export interface CreateMeetingInput {
  id: string;
  title: string;
  state: PersistedMeetingState;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateMeetingStopInput {
  id: string;
  state: PersistedMeetingState;
  updatedAt: string;
  durationMs: number;
}

export interface SaveNotesInput {
  id: string;
  meetingId: string;
  content: string;
  updatedAt: string;
}

export interface AppendTranscriptSegmentInput {
  meetingId: string;
  speaker: 'you' | 'them';
  text: string;
  startTs: number;
  endTs?: number;
  isFinal: boolean;
}

export interface SaveEnhancedOutputInput {
  meetingId: string;
  content: string;
  createdAt: string;
}

interface MeetingRow {
  id: string;
  title: string;
  state: PersistedMeetingState;
  created_at: string;
  updated_at: string;
  duration_ms: number | null;
}

interface NoteRow {
  id: string;
  meeting_id: string;
  content: string;
  updated_at: string;
}

interface TranscriptSegmentRow {
  id: number;
  meeting_id: string;
  speaker: 'you' | 'them';
  text: string;
  start_ts: number;
  end_ts: number | null;
  is_final: number;
}

interface EnhancedOutputRow {
  id: number;
  meeting_id: string;
  content: string;
  created_at: string;
}

export class MeetingsRepository {
  public constructor(private readonly db: Database.Database) {}

  public create(input: CreateMeetingInput): MeetingRecord {
    this.db
      .prepare(
        `
          INSERT INTO meetings (id, title, state, created_at, updated_at, duration_ms)
          VALUES (@id, @title, @state, @createdAt, @updatedAt, NULL)
        `
      )
      .run(input);

    const meeting = this.getById(input.id);
    if (!meeting) {
      throw new Error('Meeting insert failed.');
    }
    return meeting;
  }

  public updateStopped(input: UpdateMeetingStopInput): MeetingRecord {
    this.db
      .prepare(
        `
          UPDATE meetings
          SET state = @state,
              updated_at = @updatedAt,
              duration_ms = @durationMs
          WHERE id = @id
        `
      )
      .run(input);

    const meeting = this.getById(input.id);
    if (!meeting) {
      throw new Error('Meeting update failed.');
    }
    return meeting;
  }

  public getById(id: string): MeetingRecord | null {
    const row = this.db
      .prepare(
        `
          SELECT id, title, state, created_at, updated_at, duration_ms
          FROM meetings
          WHERE id = ?
        `
      )
      .get(id) as MeetingRow | undefined;

    return row ? mapMeetingRow(row) : null;
  }
}

export class NotesRepository {
  public constructor(private readonly db: Database.Database) {}

  public save(input: SaveNotesInput): NoteRecord {
    this.db
      .prepare(
        `
          INSERT INTO notes (id, meeting_id, content, updated_at)
          VALUES (@id, @meetingId, @content, @updatedAt)
          ON CONFLICT(meeting_id) DO UPDATE SET
            id = excluded.id,
            content = excluded.content,
            updated_at = excluded.updated_at
        `
      )
      .run(input);

    const note = this.getByMeetingId(input.meetingId);
    if (!note) {
      throw new Error('Note save failed.');
    }
    return note;
  }

  public getByMeetingId(meetingId: string): NoteRecord | null {
    const row = this.db
      .prepare(
        `
          SELECT id, meeting_id, content, updated_at
          FROM notes
          WHERE meeting_id = ?
        `
      )
      .get(meetingId) as NoteRow | undefined;

    return row ? mapNoteRow(row) : null;
  }
}

export class TranscriptRepository {
  public constructor(private readonly db: Database.Database) {}

  public append(input: AppendTranscriptSegmentInput): TranscriptSegmentRecord {
    const result = this.db
      .prepare(
        `
          INSERT INTO transcript_segments (meeting_id, speaker, text, start_ts, end_ts, is_final)
          VALUES (@meetingId, @speaker, @text, @startTs, @endTs, @isFinal)
        `
      )
      .run({
        ...input,
        endTs: input.endTs ?? null,
        isFinal: input.isFinal ? 1 : 0
      });

    const row = this.db
      .prepare(
        `
          SELECT id, meeting_id, speaker, text, start_ts, end_ts, is_final
          FROM transcript_segments
          WHERE id = ?
        `
      )
      .get(result.lastInsertRowid) as TranscriptSegmentRow | undefined;

    if (!row) {
      throw new Error('Transcript insert failed.');
    }
    return mapTranscriptSegmentRow(row);
  }

  public listByMeetingId(meetingId: string): TranscriptSegmentRecord[] {
    const rows = this.db
      .prepare(
        `
          SELECT id, meeting_id, speaker, text, start_ts, end_ts, is_final
          FROM transcript_segments
          WHERE meeting_id = ?
          ORDER BY id ASC
        `
      )
      .all(meetingId) as TranscriptSegmentRow[];

    return rows.map(mapTranscriptSegmentRow);
  }
}

export class EnhancedOutputsRepository {
  public constructor(private readonly db: Database.Database) {}

  public save(input: SaveEnhancedOutputInput): EnhancedOutputRecord {
    const result = this.db
      .prepare(
        `
          INSERT INTO enhanced_outputs (meeting_id, content, created_at)
          VALUES (@meetingId, @content, @createdAt)
        `
      )
      .run(input);

    const row = this.db
      .prepare(
        `
          SELECT id, meeting_id, content, created_at
          FROM enhanced_outputs
          WHERE id = ?
        `
      )
      .get(result.lastInsertRowid) as EnhancedOutputRow | undefined;

    if (!row) {
      throw new Error('Enhanced output insert failed.');
    }

    return mapEnhancedOutputRow(row);
  }

  public getLatestByMeetingId(meetingId: string): EnhancedOutputRecord | null {
    const row = this.db
      .prepare(
        `
          SELECT id, meeting_id, content, created_at
          FROM enhanced_outputs
          WHERE meeting_id = ?
          ORDER BY id DESC
          LIMIT 1
        `
      )
      .get(meetingId) as EnhancedOutputRow | undefined;

    return row ? mapEnhancedOutputRow(row) : null;
  }
}

export class MeetingArtifactsRepository {
  private readonly meetings: MeetingsRepository;
  private readonly notes: NotesRepository;
  private readonly transcript: TranscriptRepository;
  private readonly enhancedOutputs: EnhancedOutputsRepository;

  public constructor(private readonly db: Database.Database) {
    this.meetings = new MeetingsRepository(db);
    this.notes = new NotesRepository(db);
    this.transcript = new TranscriptRepository(db);
    this.enhancedOutputs = new EnhancedOutputsRepository(db);
  }

  public getMeetingWithArtifacts(meetingId: string): PersistedMeetingArtifacts | null {
    const meeting = this.meetings.getById(meetingId);
    if (!meeting) {
      return null;
    }

    return {
      meeting,
      note: this.notes.getByMeetingId(meetingId),
      transcriptSegments: this.transcript.listByMeetingId(meetingId),
      enhancedOutput: this.enhancedOutputs.getLatestByMeetingId(meetingId)
    };
  }
}

function mapMeetingRow(row: MeetingRow): MeetingRecord {
  return {
    id: row.id,
    title: row.title,
    state: row.state,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    durationMs: row.duration_ms
  };
}

function mapNoteRow(row: NoteRow): NoteRecord {
  return {
    id: row.id,
    meetingId: row.meeting_id,
    content: row.content,
    updatedAt: row.updated_at
  };
}

function mapTranscriptSegmentRow(row: TranscriptSegmentRow): TranscriptSegmentRecord {
  return {
    id: row.id,
    meetingId: row.meeting_id,
    speaker: row.speaker,
    text: row.text,
    startTs: row.start_ts,
    endTs: row.end_ts,
    isFinal: row.is_final === 1
  };
}

function mapEnhancedOutputRow(row: EnhancedOutputRow): EnhancedOutputRecord {
  return {
    id: row.id,
    meetingId: row.meeting_id,
    content: row.content,
    createdAt: row.created_at
  };
}
