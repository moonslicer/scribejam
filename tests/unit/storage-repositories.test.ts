import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it } from 'vitest';
import { createStorageDatabase } from '../../src/main/storage/db';
import {
  EnhancedNoteDocumentsRepository,
  EnhancedOutputsRepository,
  MeetingArtifactsRepository,
  MeetingsRepository,
  NotesRepository,
  TranscriptRepository
} from '../../src/main/storage/repositories';

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe('storage repositories', () => {
  it('creates and updates meetings', () => {
    const dir = mkdtempSync(join(tmpdir(), 'scribejam-storage-repos-'));
    tempDirs.push(dir);
    const db = createStorageDatabase({ dbPath: join(dir, 'scribejam.sqlite') });
    const meetings = new MeetingsRepository(db);

    const created = meetings.create({
      id: 'meeting-1',
      title: 'Sprint planning',
      state: 'recording',
      createdAt: '2026-03-12T17:00:00.000Z',
      updatedAt: '2026-03-12T17:00:00.000Z'
    });

    expect(created).toMatchObject({
      id: 'meeting-1',
      title: 'Sprint planning',
      state: 'recording',
      durationMs: null
    });

    const stopped = meetings.updateStopped({
      id: 'meeting-1',
      state: 'stopped',
      updatedAt: '2026-03-12T17:30:00.000Z',
      durationMs: 1800000
    });

    expect(stopped.state).toBe('stopped');
    expect(stopped.durationMs).toBe(1800000);

    const enhancing = meetings.updateState({
      id: 'meeting-1',
      state: 'enhancing',
      updatedAt: '2026-03-12T17:31:00.000Z'
    });

    expect(enhancing.state).toBe('enhancing');
    expect(enhancing.durationMs).toBe(1800000);

    db.close();
  });

  it('upserts notes per meeting instead of duplicating rows', () => {
    const dir = mkdtempSync(join(tmpdir(), 'scribejam-storage-repos-'));
    tempDirs.push(dir);
    const db = createStorageDatabase({ dbPath: join(dir, 'scribejam.sqlite') });
    const meetings = new MeetingsRepository(db);
    const notes = new NotesRepository(db);

    meetings.create({
      id: 'meeting-1',
      title: '1:1',
      state: 'recording',
      createdAt: '2026-03-12T17:00:00.000Z',
      updatedAt: '2026-03-12T17:00:00.000Z'
    });

    notes.save({
      id: 'note-1',
      meetingId: 'meeting-1',
      content: '{"type":"doc","content":[]}',
      updatedAt: '2026-03-12T17:05:00.000Z'
    });
    const updated = notes.save({
      id: 'note-2',
      meetingId: 'meeting-1',
      content: '{"type":"doc","content":[{"type":"paragraph"}]}',
      updatedAt: '2026-03-12T17:10:00.000Z'
    });

    expect(updated.id).toBe('note-2');
    expect(updated.content).toContain('paragraph');

    const count = db.prepare('SELECT COUNT(*) AS count FROM notes WHERE meeting_id = ?').get('meeting-1') as {
      count: number;
    };
    expect(count.count).toBe(1);

    db.close();
  });

  it('returns a meeting with notes and transcript artifacts together', () => {
    const dir = mkdtempSync(join(tmpdir(), 'scribejam-storage-repos-'));
    tempDirs.push(dir);
    const db = createStorageDatabase({ dbPath: join(dir, 'scribejam.sqlite') });
    const meetings = new MeetingsRepository(db);
    const notes = new NotesRepository(db);
    const transcript = new TranscriptRepository(db);
    const enhancedOutputs = new EnhancedOutputsRepository(db);
    const enhancedNoteDocuments = new EnhancedNoteDocumentsRepository(db);
    const artifacts = new MeetingArtifactsRepository(db);

    meetings.create({
      id: 'meeting-1',
      title: 'Weekly sync',
      state: 'stopped',
      createdAt: '2026-03-12T17:00:00.000Z',
      updatedAt: '2026-03-12T17:30:00.000Z'
    });
    notes.save({
      id: 'note-1',
      meetingId: 'meeting-1',
      content: '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Follow up"}]}]}',
      updatedAt: '2026-03-12T17:12:00.000Z'
    });
    transcript.append({
      meetingId: 'meeting-1',
      speaker: 'them',
      text: 'Ship the draft on Friday.',
      startTs: 12.5,
      endTs: 15.1,
      isFinal: true
    });
    enhancedOutputs.save({
      meetingId: 'meeting-1',
      content:
        '{"blocks":[{"source":"human","content":"Follow up"},{"source":"ai","content":"Draft is due Friday."}],"actionItems":[],"decisions":[],"summary":"Send the draft Friday."}',
      createdAt: '2026-03-12T17:31:00.000Z'
    });
    enhancedNoteDocuments.save({
      id: 'enhanced-note-1',
      meetingId: 'meeting-1',
      content:
        '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Edited enhanced note"}]}]}',
      updatedAt: '2026-03-12T17:32:00.000Z'
    });

    const meeting = artifacts.getMeetingWithArtifacts('meeting-1');

    expect(meeting?.meeting.title).toBe('Weekly sync');
    expect(meeting?.note?.content).toContain('Follow up');
    expect(meeting?.transcriptSegments).toHaveLength(1);
    expect(meeting?.transcriptSegments[0]).toMatchObject({
      speaker: 'them',
      text: 'Ship the draft on Friday.',
      isFinal: true
    });
    expect(meeting?.enhancedOutput?.content).toContain('Draft is due Friday.');
    expect(meeting?.enhancedNoteDocument?.content).toContain('Edited enhanced note');

    db.close();
  });

  it('compacts persisted transcript deltas into finalized utterances on read', () => {
    const dir = mkdtempSync(join(tmpdir(), 'scribejam-storage-repos-'));
    tempDirs.push(dir);
    const db = createStorageDatabase({ dbPath: join(dir, 'scribejam.sqlite') });
    const meetings = new MeetingsRepository(db);
    const transcript = new TranscriptRepository(db);

    meetings.create({
      id: 'meeting-1',
      title: 'Weekly sync',
      state: 'stopped',
      createdAt: '2026-03-12T17:00:00.000Z',
      updatedAt: '2026-03-12T17:30:00.000Z'
    });
    transcript.append({
      meetingId: 'meeting-1',
      speaker: 'you',
      text: 'I wanna be',
      startTs: 10,
      isFinal: false
    });
    transcript.append({
      meetingId: 'meeting-1',
      speaker: 'you',
      text: 'I wanna be the very best.',
      startTs: 11,
      endTs: 11,
      isFinal: true
    });
    transcript.append({
      meetingId: 'meeting-1',
      speaker: 'you',
      text: 'I wanna be the very best. The best there ever was.',
      startTs: 12,
      endTs: 12,
      isFinal: true
    });

    expect(transcript.listByMeetingId('meeting-1')).toEqual([
      {
        id: 3,
        meetingId: 'meeting-1',
        speaker: 'you',
        text: 'I wanna be the very best. The best there ever was.',
        startTs: 10,
        endTs: 12,
        isFinal: true
      }
    ]);

    db.close();
  });

  it('returns the latest enhancement for a meeting', () => {
    const dir = mkdtempSync(join(tmpdir(), 'scribejam-storage-repos-'));
    tempDirs.push(dir);
    const db = createStorageDatabase({ dbPath: join(dir, 'scribejam.sqlite') });
    const meetings = new MeetingsRepository(db);
    const enhancedOutputs = new EnhancedOutputsRepository(db);

    meetings.create({
      id: 'meeting-1',
      title: 'Weekly sync',
      state: 'stopped',
      createdAt: '2026-03-12T17:00:00.000Z',
      updatedAt: '2026-03-12T17:30:00.000Z'
    });

    enhancedOutputs.save({
      meetingId: 'meeting-1',
      content: '{"summary":"First summary","blocks":[],"actionItems":[],"decisions":[]}',
      createdAt: '2026-03-12T17:31:00.000Z'
    });
    const latest = enhancedOutputs.save({
      meetingId: 'meeting-1',
      content: '{"summary":"Latest summary","blocks":[],"actionItems":[],"decisions":[]}',
      createdAt: '2026-03-12T17:32:00.000Z'
    });

    expect(enhancedOutputs.getLatestByMeetingId('meeting-1')).toEqual(latest);

    db.close();
  });

  it('upserts editable enhanced note documents per meeting', () => {
    const dir = mkdtempSync(join(tmpdir(), 'scribejam-storage-repos-'));
    tempDirs.push(dir);
    const db = createStorageDatabase({ dbPath: join(dir, 'scribejam.sqlite') });
    const meetings = new MeetingsRepository(db);
    const enhancedNoteDocuments = new EnhancedNoteDocumentsRepository(db);

    meetings.create({
      id: 'meeting-1',
      title: 'Weekly sync',
      state: 'done',
      createdAt: '2026-03-12T17:00:00.000Z',
      updatedAt: '2026-03-12T17:30:00.000Z'
    });

    enhancedNoteDocuments.save({
      id: 'enhanced-note-1',
      meetingId: 'meeting-1',
      content: '{"type":"doc","content":[{"type":"paragraph"}]}',
      updatedAt: '2026-03-12T17:31:00.000Z'
    });
    const updated = enhancedNoteDocuments.save({
      id: 'enhanced-note-2',
      meetingId: 'meeting-1',
      content:
        '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Edited enhanced note"}]}]}',
      updatedAt: '2026-03-12T17:32:00.000Z'
    });

    expect(updated.id).toBe('enhanced-note-2');
    expect(updated.content).toContain('Edited enhanced note');

    db.close();
  });

  it('lists meeting history summaries in descending updated order', () => {
    const dir = mkdtempSync(join(tmpdir(), 'scribejam-storage-repos-'));
    tempDirs.push(dir);
    const db = createStorageDatabase({ dbPath: join(dir, 'scribejam.sqlite') });
    const meetings = new MeetingsRepository(db);
    const notes = new NotesRepository(db);
    const enhancedOutputs = new EnhancedOutputsRepository(db);
    const artifacts = new MeetingArtifactsRepository(db);

    meetings.create({
      id: 'meeting-1',
      title: 'Design review',
      state: 'stopped',
      createdAt: '2026-03-12T17:00:00.000Z',
      updatedAt: '2026-03-12T17:10:00.000Z'
    });
    notes.save({
      id: 'note-1',
      meetingId: 'meeting-1',
      content:
        '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Capture open questions"}]}]}',
      updatedAt: '2026-03-12T17:08:00.000Z'
    });

    meetings.create({
      id: 'meeting-2',
      title: 'Weekly sync',
      state: 'done',
      createdAt: '2026-03-12T18:00:00.000Z',
      updatedAt: '2026-03-12T18:30:00.000Z'
    });
    enhancedOutputs.save({
      meetingId: 'meeting-2',
      content:
        '{"blocks":[{"source":"human","content":"Follow up with Ops"},{"source":"ai","content":"Ship the draft Friday."}],"actionItems":[],"decisions":[],"summary":"Ship the draft on Friday."}',
      createdAt: '2026-03-12T18:31:00.000Z'
    });

    expect(artifacts.listMeetingHistory()).toEqual([
      {
        id: 'meeting-2',
        title: 'Weekly sync',
        state: 'done',
        createdAt: '2026-03-12T18:00:00.000Z',
        updatedAt: '2026-03-12T18:30:00.000Z',
        durationMs: null,
        hasEnhancedOutput: true,
        previewText: 'Ship the draft on Friday.'
      },
      {
        id: 'meeting-1',
        title: 'Design review',
        state: 'stopped',
        createdAt: '2026-03-12T17:00:00.000Z',
        updatedAt: '2026-03-12T17:10:00.000Z',
        durationMs: null,
        hasEnhancedOutput: false,
        previewText: 'Capture open questions'
      }
    ]);

    db.close();
  });

  it('filters meeting history by title and enhanced output content', () => {
    const dir = mkdtempSync(join(tmpdir(), 'scribejam-storage-repos-'));
    tempDirs.push(dir);
    const db = createStorageDatabase({ dbPath: join(dir, 'scribejam.sqlite') });
    const meetings = new MeetingsRepository(db);
    const enhancedOutputs = new EnhancedOutputsRepository(db);
    const artifacts = new MeetingArtifactsRepository(db);

    meetings.create({
      id: 'meeting-1',
      title: 'Roadmap planning',
      state: 'stopped',
      createdAt: '2026-03-12T17:00:00.000Z',
      updatedAt: '2026-03-12T17:10:00.000Z'
    });
    meetings.create({
      id: 'meeting-2',
      title: 'Weekly sync',
      state: 'done',
      createdAt: '2026-03-12T18:00:00.000Z',
      updatedAt: '2026-03-12T18:30:00.000Z'
    });
    enhancedOutputs.save({
      meetingId: 'meeting-2',
      content:
        '{"blocks":[{"source":"ai","content":"The beta launch depends on final QA signoff."}],"actionItems":[],"decisions":[],"summary":"Beta launch stays on track."}',
      createdAt: '2026-03-12T18:31:00.000Z'
    });

    expect(artifacts.listMeetingHistory('roadmap')).toHaveLength(1);
    expect(artifacts.listMeetingHistory('roadmap')[0]?.id).toBe('meeting-1');
    expect(artifacts.listMeetingHistory('qa signoff')).toHaveLength(1);
    expect(artifacts.listMeetingHistory('qa signoff')[0]?.id).toBe('meeting-2');

    db.close();
  });

  it('returns stable history results for meetings without notes or enhancement content', () => {
    const dir = mkdtempSync(join(tmpdir(), 'scribejam-storage-repos-'));
    tempDirs.push(dir);
    const db = createStorageDatabase({ dbPath: join(dir, 'scribejam.sqlite') });
    const meetings = new MeetingsRepository(db);
    const artifacts = new MeetingArtifactsRepository(db);

    meetings.create({
      id: 'meeting-1',
      title: 'Empty capture',
      state: 'stopped',
      createdAt: '2026-03-12T17:00:00.000Z',
      updatedAt: '2026-03-12T17:10:00.000Z'
    });

    expect(artifacts.listMeetingHistory()).toEqual([
      {
        id: 'meeting-1',
        title: 'Empty capture',
        state: 'stopped',
        createdAt: '2026-03-12T17:00:00.000Z',
        updatedAt: '2026-03-12T17:10:00.000Z',
        durationMs: null,
        hasEnhancedOutput: false,
        previewText: null
      }
    ]);
    expect(artifacts.listMeetingHistory('capture')[0]?.id).toBe('meeting-1');
    expect(artifacts.listMeetingHistory('missing')).toEqual([]);

    db.close();
  });
});
