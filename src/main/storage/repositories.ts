import type Database from 'better-sqlite3';
import type { MeetingHistoryItem } from '../../shared/ipc';
import {
  areTranscriptTextsLikelySameUtterance,
  normalizeTranscriptText
} from '../../shared/transcript';
import { safeParseEnhancedOutput } from '../enhancement/parse-enhanced-output';
import type {
  EnhancedNoteDocumentRecord,
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

export interface UpdateMeetingStateInput {
  id: string;
  state: PersistedMeetingState;
  updatedAt: string;
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

export interface SaveEnhancedNoteDocumentInput {
  id: string;
  meetingId: string;
  content: string;
  updatedAt: string;
}

interface MeetingRow {
  id: string;
  title: string;
  state: PersistedMeetingState;
  created_at: string;
  updated_at: string;
  duration_ms: number | null;
  archived_at: string | null;
  last_template_id: string | null;
  last_template_name: string | null;
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

interface EnhancedNoteDocumentRow {
  id: string;
  meeting_id: string;
  content: string;
  updated_at: string;
}

interface MeetingHistoryRow extends MeetingRow {
  note_content: string | null;
  enhanced_output_content: string | null;
}

const HISTORY_PREVIEW_MAX_LENGTH = 160;

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

  public updateState(input: UpdateMeetingStateInput): MeetingRecord {
    this.db
      .prepare(
        `
          UPDATE meetings
          SET state = @state,
              updated_at = @updatedAt
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

  public archiveMeeting(id: string, archivedAt: string): void {
    this.db
      .prepare(
        `
          UPDATE meetings
          SET archived_at = @archivedAt
          WHERE id = @id
        `
      )
      .run({ id, archivedAt });
  }

  public getById(id: string): MeetingRecord | null {
    const row = this.db
      .prepare(
        `
          SELECT id, title, state, created_at, updated_at, duration_ms, archived_at
               , last_template_id, last_template_name
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

    return compactTranscriptSegments(rows.map(mapTranscriptSegmentRow));
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

export class EnhancedNoteDocumentsRepository {
  public constructor(private readonly db: Database.Database) {}

  public save(input: SaveEnhancedNoteDocumentInput): EnhancedNoteDocumentRecord {
    this.db
      .prepare(
        `
          INSERT INTO enhanced_note_documents (id, meeting_id, content, updated_at)
          VALUES (@id, @meetingId, @content, @updatedAt)
          ON CONFLICT(meeting_id) DO UPDATE SET
            id = excluded.id,
            content = excluded.content,
            updated_at = excluded.updated_at
        `
      )
      .run(input);

    const document = this.getByMeetingId(input.meetingId);
    if (!document) {
      throw new Error('Enhanced note document save failed.');
    }

    return document;
  }

  public getByMeetingId(meetingId: string): EnhancedNoteDocumentRecord | null {
    const row = this.db
      .prepare(
        `
          SELECT id, meeting_id, content, updated_at
          FROM enhanced_note_documents
          WHERE meeting_id = ?
        `
      )
      .get(meetingId) as EnhancedNoteDocumentRow | undefined;

    return row ? mapEnhancedNoteDocumentRow(row) : null;
  }

  public deleteByMeetingId(meetingId: string): void {
    this.db
      .prepare(
        `
          DELETE FROM enhanced_note_documents
          WHERE meeting_id = ?
        `
      )
      .run(meetingId);
  }
}

export class MeetingArtifactsRepository {
  private readonly meetings: MeetingsRepository;
  private readonly notes: NotesRepository;
  private readonly transcript: TranscriptRepository;
  private readonly enhancedOutputs: EnhancedOutputsRepository;
  private readonly enhancedNoteDocuments: EnhancedNoteDocumentsRepository;

  public constructor(private readonly db: Database.Database) {
    this.meetings = new MeetingsRepository(db);
    this.notes = new NotesRepository(db);
    this.transcript = new TranscriptRepository(db);
    this.enhancedOutputs = new EnhancedOutputsRepository(db);
    this.enhancedNoteDocuments = new EnhancedNoteDocumentsRepository(db);
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
      enhancedOutput: this.enhancedOutputs.getLatestByMeetingId(meetingId),
      enhancedNoteDocument: this.enhancedNoteDocuments.getByMeetingId(meetingId)
    };
  }

  public listMeetingHistory(query?: string): MeetingHistoryItem[] {
    const rows = this.db
      .prepare(
        `
          SELECT
            m.id,
            m.title,
            m.state,
            m.created_at,
            m.updated_at,
            m.duration_ms,
            n.content AS note_content,
            eo.content AS enhanced_output_content
          FROM meetings m
          LEFT JOIN notes n
            ON n.meeting_id = m.id
          LEFT JOIN enhanced_outputs eo
            ON eo.id = (
              SELECT id
              FROM enhanced_outputs
              WHERE meeting_id = m.id
              ORDER BY id DESC
              LIMIT 1
            )
          WHERE m.archived_at IS NULL
          ORDER BY m.updated_at DESC, m.created_at DESC, m.id DESC
        `
      )
      .all() as MeetingHistoryRow[];

    const normalizedQuery = normalizeHistorySearchQuery(query);

    return rows
      .map((row) => buildMeetingHistoryProjection(row))
      .filter(
        ({ searchableText }) =>
          normalizedQuery === null || searchableText.includes(normalizedQuery)
      )
      .map(({ item }) => item);
  }
}

function mapMeetingRow(row: MeetingRow): MeetingRecord {
  return {
    id: row.id,
    title: row.title,
    state: row.state,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    durationMs: row.duration_ms,
    archivedAt: row.archived_at,
    lastTemplateId: row.last_template_id,
    lastTemplateName: row.last_template_name
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

function compactTranscriptSegments(
  segments: TranscriptSegmentRecord[]
): TranscriptSegmentRecord[] {
  const compacted: TranscriptSegmentRecord[] = [];

  for (const segment of segments) {
    const text = normalizeTranscriptText(segment.text);
    if (text.length === 0) {
      continue;
    }

    const normalizedSegment: TranscriptSegmentRecord = {
      ...segment,
      text,
      endTs: segment.endTs ?? (segment.isFinal ? segment.startTs : null)
    };
    const last = compacted[compacted.length - 1];

    if (!normalizedSegment.isFinal) {
      if (last && !last.isFinal && last.speaker === normalizedSegment.speaker) {
        compacted[compacted.length - 1] = normalizedSegment;
      } else {
        compacted.push(normalizedSegment);
      }
      continue;
    }

    if (last && last.speaker === normalizedSegment.speaker) {
      if (
        !last.isFinal ||
        areTranscriptTextsLikelySameUtterance(last.text, normalizedSegment.text)
      ) {
        compacted[compacted.length - 1] = {
          ...normalizedSegment,
          startTs: last.startTs,
          endTs: normalizedSegment.endTs ?? normalizedSegment.startTs
        };
        continue;
      }
    }

    compacted.push({
      ...normalizedSegment,
      endTs: normalizedSegment.endTs ?? normalizedSegment.startTs
    });
  }

  return compacted.filter((segment) => segment.isFinal);
}

function mapEnhancedOutputRow(row: EnhancedOutputRow): EnhancedOutputRecord {
  return {
    id: row.id,
    meetingId: row.meeting_id,
    content: row.content,
    createdAt: row.created_at
  };
}

function mapEnhancedNoteDocumentRow(
  row: EnhancedNoteDocumentRow
): EnhancedNoteDocumentRecord {
  return {
    id: row.id,
    meetingId: row.meeting_id,
    content: row.content,
    updatedAt: row.updated_at
  };
}

function buildMeetingHistoryProjection(row: MeetingHistoryRow): {
  item: MeetingHistoryItem;
  searchableText: string;
} {
  const noteText = extractDocumentPlainText(row.note_content);
  const enhancementText = extractEnhancedOutputText(row.enhanced_output_content);
  const previewSource =
    [enhancementText.summary, enhancementText.firstBlock, noteText].find(
      (value) => value.length > 0
    ) ?? '';

  return {
    item: {
      id: row.id,
      title: row.title,
      state: row.state,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      durationMs: row.duration_ms,
      hasEnhancedOutput: row.enhanced_output_content !== null,
      previewText: truncatePreview(previewSource)
    },
    searchableText: normalizeSearchText(
      [row.title, noteText, enhancementText.summary, enhancementText.blocks].join(' ')
    )
  };
}

function extractDocumentPlainText(content: string | null): string {
  if (!content) {
    return '';
  }

  try {
    return normalizeDisplayText(collectJsonText(JSON.parse(content) as unknown));
  } catch {
    return '';
  }
}

function collectJsonText(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((entry) => collectJsonText(entry)).join(' ');
  }
  if (!value || typeof value !== 'object') {
    return '';
  }

  const candidate = value as Record<string, unknown>;
  const parts: string[] = [];

  if (typeof candidate.text === 'string') {
    parts.push(candidate.text);
  }
  if (candidate.content !== undefined) {
    parts.push(collectJsonText(candidate.content));
  }

  return parts.join(' ');
}

function extractEnhancedOutputText(content: string | null): {
  summary: string;
  firstBlock: string;
  blocks: string;
} {
  const parsed = safeParseEnhancedOutput(content);
  if (!parsed) {
    return {
      summary: '',
      firstBlock: '',
      blocks: ''
    };
  }

  return {
    summary: normalizeDisplayText(parsed.summary),
    firstBlock: normalizeDisplayText(parsed.blocks[0]?.content ?? ''),
    blocks: normalizeDisplayText(parsed.blocks.map((block) => block.content).join(' '))
  };
}

function normalizeHistorySearchQuery(query: string | undefined): string | null {
  if (query === undefined) {
    return null;
  }

  const normalized = normalizeSearchText(query);
  return normalized.length > 0 ? normalized : null;
}

function normalizeSearchText(value: string): string {
  return normalizeDisplayText(value).toLowerCase();
}

function normalizeDisplayText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function truncatePreview(value: string): string | null {
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (normalized.length === 0) {
    return null;
  }
  if (normalized.length <= HISTORY_PREVIEW_MAX_LENGTH) {
    return normalized;
  }

  return `${normalized.slice(0, HISTORY_PREVIEW_MAX_LENGTH - 1).trimEnd()}…`;
}
