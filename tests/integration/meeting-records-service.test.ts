import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it } from 'vitest';
import { createStorageDatabase } from '../../src/main/storage/db';
import { MeetingRecordsService } from '../../src/main/storage/meeting-records-service';
import {
  MeetingArtifactsRepository,
  MeetingsRepository,
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
      durationMs: 1500000
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
});
