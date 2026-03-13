import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it } from 'vitest';
import { createStorageDatabase } from '../../src/main/storage/db';
import {
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

    const meeting = artifacts.getMeetingWithArtifacts('meeting-1');

    expect(meeting?.meeting.title).toBe('Weekly sync');
    expect(meeting?.note?.content).toContain('Follow up');
    expect(meeting?.transcriptSegments).toHaveLength(1);
    expect(meeting?.transcriptSegments[0]).toMatchObject({
      speaker: 'them',
      text: 'Ship the draft on Friday.',
      isFinal: true
    });

    db.close();
  });
});
