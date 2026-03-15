import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it } from 'vitest';
import { createStorageDatabase } from '../../src/main/storage/db';
import { MeetingRecordsService } from '../../src/main/storage/meeting-records-service';
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

function createService(dbPath: string): MeetingRecordsService {
  const db = createStorageDatabase({ dbPath });
  return new MeetingRecordsService(
    new MeetingsRepository(db),
    new MeetingArtifactsRepository(db),
    new TranscriptRepository(db)
  );
}

describe('MeetingRecordsService', () => {
  it('persists meeting start and stop metadata', () => {
    const dir = mkdtempSync(join(tmpdir(), 'scribejam-meeting-records-'));
    tempDirs.push(dir);
    const service = createService(join(dir, 'scribejam.sqlite'));

    service.recordMeetingStarted({
      state: 'recording',
      meetingId: 'meeting-1',
      title: 'Design review',
      startedAt: Date.parse('2026-03-12T18:00:00.000Z')
    });
    service.recordMeetingStopped({
      state: 'stopped',
      meetingId: 'meeting-1',
      title: 'Design review',
      startedAt: Date.parse('2026-03-12T18:00:00.000Z'),
      stoppedAt: Date.parse('2026-03-12T18:25:00.000Z')
    });

    const meeting = service.getMeeting('meeting-1');

    expect(meeting).toMatchObject({
      id: 'meeting-1',
      title: 'Design review',
      state: 'stopped',
      durationMs: 1500000,
      enhancedNoteContent: null
    });
  });

  it('persists transcript updates for the active meeting', () => {
    const dir = mkdtempSync(join(tmpdir(), 'scribejam-meeting-records-'));
    tempDirs.push(dir);
    const service = createService(join(dir, 'scribejam.sqlite'));

    service.recordMeetingStarted({
      state: 'recording',
      meetingId: 'meeting-1',
      title: 'Weekly sync',
      startedAt: Date.parse('2026-03-12T18:00:00.000Z')
    });
    service.appendTranscriptSegment('meeting-1', {
      text: 'Can you send the draft?',
      speaker: 'them',
      ts: 14.25,
      isFinal: true
    });

    const meeting = service.getMeeting('meeting-1');

    expect(meeting?.transcriptSegments).toEqual([
      {
        id: 1,
        speaker: 'them',
        text: 'Can you send the draft?',
        startTs: 14.25,
        endTs: 14.25,
        isFinal: true
      }
    ]);
  });

  it('persists only finalized transcript segments for the active meeting', () => {
    const dir = mkdtempSync(join(tmpdir(), 'scribejam-meeting-records-'));
    tempDirs.push(dir);
    const service = createService(join(dir, 'scribejam.sqlite'));

    service.recordMeetingStarted({
      state: 'recording',
      meetingId: 'meeting-1',
      title: 'Weekly sync',
      startedAt: Date.parse('2026-03-12T18:00:00.000Z')
    });
    service.appendTranscriptSegment('meeting-1', {
      text: 'Can you send',
      speaker: 'them',
      ts: 14,
      isFinal: false
    });
    service.appendTranscriptSegment('meeting-1', {
      text: 'Can you send the draft?',
      speaker: 'them',
      ts: 14.25,
      isFinal: true
    });

    const meeting = service.getMeeting('meeting-1');

    expect(meeting?.transcriptSegments).toEqual([
      {
        id: 1,
        speaker: 'them',
        text: 'Can you send the draft?',
        startTs: 14.25,
        endTs: 14.25,
        isFinal: true
      }
    ]);
  });

  it('persists enhancement lifecycle state changes', () => {
    const dir = mkdtempSync(join(tmpdir(), 'scribejam-meeting-records-'));
    tempDirs.push(dir);
    const service = createService(join(dir, 'scribejam.sqlite'));

    service.recordMeetingStarted({
      state: 'recording',
      meetingId: 'meeting-1',
      title: 'Weekly sync',
      startedAt: Date.parse('2026-03-12T18:00:00.000Z')
    });
    service.recordMeetingStopped({
      state: 'stopped',
      meetingId: 'meeting-1',
      title: 'Weekly sync',
      startedAt: Date.parse('2026-03-12T18:00:00.000Z'),
      stoppedAt: Date.parse('2026-03-12T18:25:00.000Z')
    });
    service.recordMeetingEnhancementStarted({
      state: 'enhancing',
      meetingId: 'meeting-1',
      title: 'Weekly sync',
      startedAt: Date.parse('2026-03-12T18:00:00.000Z'),
      stoppedAt: Date.parse('2026-03-12T18:25:00.000Z')
    });
    service.recordMeetingEnhancementCompleted({
      state: 'done',
      meetingId: 'meeting-1',
      title: 'Weekly sync',
      startedAt: Date.parse('2026-03-12T18:00:00.000Z'),
      stoppedAt: Date.parse('2026-03-12T18:25:00.000Z')
    });

    const meeting = service.getMeeting('meeting-1');

    expect(meeting?.state).toBe('done');
    expect(meeting?.durationMs).toBe(1500000);
  });

  it('returns the latest persisted editable enhanced document when loading a meeting', () => {
    const dir = mkdtempSync(join(tmpdir(), 'scribejam-meeting-records-'));
    tempDirs.push(dir);
    const dbPath = join(dir, 'scribejam.sqlite');
    const db = createStorageDatabase({ dbPath });
    const meetings = new MeetingsRepository(db);
    const artifacts = new MeetingArtifactsRepository(db);
    const transcript = new TranscriptRepository(db);
    const enhancedNoteDocuments = new EnhancedNoteDocumentsRepository(db);
    const service = new MeetingRecordsService(meetings, artifacts, transcript);

    meetings.create({
      id: 'meeting-1',
      title: 'Weekly sync',
      state: 'done',
      createdAt: '2026-03-12T18:00:00.000Z',
      updatedAt: '2026-03-12T18:25:00.000Z'
    });
    enhancedNoteDocuments.save({
      id: 'meeting-1-enhanced-note',
      meetingId: 'meeting-1',
      content:
        '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Edited enhanced note"}]}]}',
      updatedAt: '2026-03-12T18:26:00.000Z'
    });

    const meeting = service.getMeeting('meeting-1');

    expect(meeting?.enhancedNoteContent).toEqual({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: 'Edited enhanced note'
            }
          ]
        }
      ]
    });

    db.close();
  });

  it('accumulates duration when the same meeting is resumed and stopped again', () => {
    const dir = mkdtempSync(join(tmpdir(), 'scribejam-meeting-records-'));
    tempDirs.push(dir);
    const service = createService(join(dir, 'scribejam.sqlite'));

    service.recordMeetingStarted({
      state: 'recording',
      meetingId: 'meeting-1',
      title: 'Weekly sync',
      startedAt: Date.parse('2026-03-12T18:00:00.000Z')
    });
    service.recordMeetingStopped({
      state: 'stopped',
      meetingId: 'meeting-1',
      title: 'Weekly sync',
      startedAt: Date.parse('2026-03-12T18:00:00.000Z'),
      stoppedAt: Date.parse('2026-03-12T18:25:00.000Z')
    });
    service.recordMeetingResumed({
      state: 'recording',
      meetingId: 'meeting-1',
      title: 'Weekly sync',
      startedAt: Date.parse('2026-03-12T18:30:00.000Z')
    });
    service.recordMeetingStopped({
      state: 'stopped',
      meetingId: 'meeting-1',
      title: 'Weekly sync',
      startedAt: Date.parse('2026-03-12T18:30:00.000Z'),
      stoppedAt: Date.parse('2026-03-12T18:35:00.000Z')
    });

    const meeting = service.getMeeting('meeting-1');

    expect(meeting?.state).toBe('stopped');
    expect(meeting?.durationMs).toBe(1800000);
  });

  it('returns the latest persisted enhancement output when loading a meeting', () => {
    const dir = mkdtempSync(join(tmpdir(), 'scribejam-meeting-records-'));
    tempDirs.push(dir);
    const dbPath = join(dir, 'scribejam.sqlite');
    const db = createStorageDatabase({ dbPath });
    const meetings = new MeetingsRepository(db);
    const artifacts = new MeetingArtifactsRepository(db);
    const transcript = new TranscriptRepository(db);
    const enhancements = new EnhancedOutputsRepository(db);
    const service = new MeetingRecordsService(meetings, artifacts, transcript);

    meetings.create({
      id: 'meeting-1',
      title: 'Weekly sync',
      state: 'done',
      createdAt: '2026-03-12T18:00:00.000Z',
      updatedAt: '2026-03-12T18:25:00.000Z'
    });
    enhancements.save({
      meetingId: 'meeting-1',
      content:
        '{"blocks":[{"source":"human","content":"Follow up"},{"source":"ai","content":"AI expansion"}],"actionItems":[],"decisions":[],"summary":"Quick summary"}',
      createdAt: '2026-03-12T18:26:00.000Z'
    });

    const meeting = service.getMeeting('meeting-1');

    expect(meeting?.enhancedOutput).toEqual({
      blocks: [
        {
          source: 'human',
          content: 'Follow up'
        },
        {
          source: 'ai',
          content: 'AI expansion'
        }
      ],
      actionItems: [],
      decisions: [],
      summary: 'Quick summary'
    });

    db.close();
  });

  it('exposes template metadata and overwrite-confirmation timestamps for enhanced meetings', () => {
    const dir = mkdtempSync(join(tmpdir(), 'scribejam-meeting-records-'));
    tempDirs.push(dir);
    const dbPath = join(dir, 'scribejam.sqlite');
    const db = createStorageDatabase({ dbPath });
    const meetings = new MeetingsRepository(db);
    const artifacts = new MeetingArtifactsRepository(db);
    const transcript = new TranscriptRepository(db);
    const enhancements = new EnhancedOutputsRepository(db);
    const enhancedNoteDocuments = new EnhancedNoteDocumentsRepository(db);
    const service = new MeetingRecordsService(meetings, artifacts, transcript);

    meetings.create({
      id: 'meeting-3',
      title: '1:1',
      state: 'done',
      createdAt: '2026-03-12T18:00:00.000Z',
      updatedAt: '2026-03-12T18:25:00.000Z'
    });
    db.prepare(
      `
        UPDATE meetings
        SET last_template_id = ?, last_template_name = ?
        WHERE id = ?
      `
    ).run('one-on-one', '1:1 with Direct Report', 'meeting-3');
    enhancements.save({
      meetingId: 'meeting-3',
      content:
        '{"blocks":[{"source":"human","content":"Follow up"},{"source":"ai","content":"AI expansion"}],"actionItems":[],"decisions":[],"summary":"Quick summary"}',
      createdAt: '2026-03-12T18:26:00.000Z'
    });
    enhancedNoteDocuments.save({
      id: 'meeting-3-enhanced-note',
      meetingId: 'meeting-3',
      content:
        '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Edited enhanced note"}]}]}',
      updatedAt: '2026-03-12T18:27:00.000Z'
    });

    const meeting = service.getMeeting('meeting-3');

    expect(meeting).toMatchObject({
      lastTemplateId: 'one-on-one',
      lastTemplateName: '1:1 with Direct Report',
      enhancedOutputCreatedAt: '2026-03-12T18:26:00.000Z',
      enhancedNoteUpdatedAt: '2026-03-12T18:27:00.000Z'
    });

    db.close();
  });

  it('drops invalid stored template ids when hydrating a meeting', () => {
    const dir = mkdtempSync(join(tmpdir(), 'scribejam-meeting-records-'));
    tempDirs.push(dir);
    const dbPath = join(dir, 'scribejam.sqlite');
    const db = createStorageDatabase({ dbPath });
    const meetings = new MeetingsRepository(db);
    const artifacts = new MeetingArtifactsRepository(db);
    const transcript = new TranscriptRepository(db);
    const service = new MeetingRecordsService(meetings, artifacts, transcript);

    meetings.create({
      id: 'meeting-4',
      title: 'Weekly sync',
      state: 'done',
      createdAt: '2026-03-12T18:00:00.000Z',
      updatedAt: '2026-03-12T18:25:00.000Z'
    });
    db.prepare('UPDATE meetings SET last_template_id = ? WHERE id = ?').run('unknown-template', 'meeting-4');

    const meeting = service.getMeeting('meeting-4');

    expect(meeting?.lastTemplateId).toBeUndefined();

    db.close();
  });

  it('drops invalid persisted enhancement payloads instead of coercing them', () => {
    const dir = mkdtempSync(join(tmpdir(), 'scribejam-meeting-records-'));
    tempDirs.push(dir);
    const dbPath = join(dir, 'scribejam.sqlite');
    const db = createStorageDatabase({ dbPath });
    const meetings = new MeetingsRepository(db);
    const artifacts = new MeetingArtifactsRepository(db);
    const transcript = new TranscriptRepository(db);
    const enhancements = new EnhancedOutputsRepository(db);
    const service = new MeetingRecordsService(meetings, artifacts, transcript);

    meetings.create({
      id: 'meeting-2',
      title: 'Weekly sync',
      state: 'done',
      createdAt: '2026-03-12T18:00:00.000Z',
      updatedAt: '2026-03-12T18:25:00.000Z'
    });
    enhancements.save({
      meetingId: 'meeting-2',
      content:
        '{"blocks":[{"source":"robot","content":"bad source"}],"actionItems":[],"decisions":[],"summary":"Quick summary"}',
      createdAt: '2026-03-12T18:26:00.000Z'
    });

    const meeting = service.getMeeting('meeting-2');

    expect(meeting?.enhancedOutput).toBeNull();

    db.close();
  });

  it('lists meeting history summaries and filters by query', () => {
    const dir = mkdtempSync(join(tmpdir(), 'scribejam-meeting-records-'));
    tempDirs.push(dir);
    const dbPath = join(dir, 'scribejam.sqlite');
    const db = createStorageDatabase({ dbPath });
    const meetings = new MeetingsRepository(db);
    const artifacts = new MeetingArtifactsRepository(db);
    const transcript = new TranscriptRepository(db);
    const notes = new NotesRepository(db);
    const enhancedOutputs = new EnhancedOutputsRepository(db);
    const service = new MeetingRecordsService(meetings, artifacts, transcript);

    meetings.create({
      id: 'meeting-1',
      title: 'Roadmap review',
      state: 'stopped',
      createdAt: '2026-03-12T18:00:00.000Z',
      updatedAt: '2026-03-12T18:15:00.000Z'
    });
    notes.save({
      id: 'meeting-1-note',
      meetingId: 'meeting-1',
      content:
        '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Capture blockers"}]}]}',
      updatedAt: '2026-03-12T18:10:00.000Z'
    });

    meetings.create({
      id: 'meeting-2',
      title: 'Weekly sync',
      state: 'done',
      createdAt: '2026-03-12T19:00:00.000Z',
      updatedAt: '2026-03-12T19:20:00.000Z'
    });
    enhancedOutputs.save({
      meetingId: 'meeting-2',
      content:
        '{"blocks":[{"source":"ai","content":"QA signoff is blocking the beta launch."}],"actionItems":[],"decisions":[],"summary":"Beta launch remains blocked on QA."}',
      createdAt: '2026-03-12T19:21:00.000Z'
    });

    expect(service.listMeetingHistory()).toHaveLength(2);
    expect(service.listMeetingHistory()[0]).toMatchObject({
      id: 'meeting-2',
      title: 'Weekly sync',
      hasEnhancedOutput: true,
      previewText: 'Beta launch remains blocked on QA.'
    });
    expect(service.listMeetingHistory('roadmap')).toEqual([
      expect.objectContaining({
        id: 'meeting-1',
        title: 'Roadmap review'
      })
    ]);
    expect(service.listMeetingHistory('qa signoff')).toEqual([
      expect.objectContaining({
        id: 'meeting-2',
        title: 'Weekly sync'
      })
    ]);

    db.close();
  });
});
