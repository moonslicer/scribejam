import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it } from 'vitest';
import { EnhancementOrchestrator } from '../../src/main/enhancement/enhancement-orchestrator';
import { MockLlmClient } from '../../src/main/enhancement/mock-llm-client';
import { MeetingStateMachine } from '../../src/main/meeting/state-machine';
import { createStorageDatabase } from '../../src/main/storage/db';
import { MeetingRecordsService } from '../../src/main/storage/meeting-records-service';
import {
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

function createHarness() {
  const dir = mkdtempSync(join(tmpdir(), 'scribejam-enhancement-'));
  tempDirs.push(dir);
  const db = createStorageDatabase({ dbPath: join(dir, 'scribejam.sqlite') });
  const stateMachine = new MeetingStateMachine();
  const meetings = new MeetingsRepository(db);
  const transcript = new TranscriptRepository(db);
  const notes = new NotesRepository(db);
  const artifacts = new MeetingArtifactsRepository(db);
  const enhancedOutputs = new EnhancedOutputsRepository(db);
  const meetingRecords = new MeetingRecordsService(meetings, artifacts, transcript);
  const orchestrator = new EnhancementOrchestrator(
    stateMachine,
    meetingRecords,
    artifacts,
    enhancedOutputs,
    () => new MockLlmClient()
  );

  return {
    db,
    stateMachine,
    notes,
    transcript,
    artifacts,
    enhancedOutputs,
    meetingRecords,
    orchestrator
  };
}

describe('EnhancementOrchestrator', () => {
  it('enhances a stopped meeting and persists the result', async () => {
    const harness = createHarness();
    const started = harness.stateMachine.start('Weekly sync');
    harness.meetingRecords.recordMeetingStarted(started);
    harness.notes.save({
      id: `${started.meetingId}-note`,
      meetingId: started.meetingId ?? '',
      content:
        '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Follow up with design"}]}]}',
      updatedAt: '2026-03-12T18:05:00.000Z'
    });
    harness.transcript.append({
      meetingId: started.meetingId ?? '',
      speaker: 'them',
      text: 'Please send the revised mockups tomorrow.',
      startTs: 12,
      endTs: 12,
      isFinal: true
    });
    const stopped = harness.stateMachine.stop(started.meetingId ?? '');
    harness.meetingRecords.recordMeetingStopped(stopped);

    const response = await harness.orchestrator.enhanceMeeting(started.meetingId ?? '');
    const persistedMeeting = harness.meetingRecords.getMeeting(started.meetingId ?? '');
    const persistedEnhancement = harness.enhancedOutputs.getLatestByMeetingId(started.meetingId ?? '');

    expect(response.meetingId).toBe(started.meetingId);
    expect(response.output.blocks[0]).toEqual({
      source: 'human',
      content: 'Follow up with design'
    });
    expect(response.output.blocks[1]?.source).toBe('ai');
    expect(persistedMeeting?.state).toBe('done');
    expect(persistedEnhancement?.content).toContain('revised mockups tomorrow');

    harness.db.close();
  });

  it('rejects enhancement when the meeting is not stopped', async () => {
    const harness = createHarness();
    const started = harness.stateMachine.start('Weekly sync');
    harness.meetingRecords.recordMeetingStarted(started);

    await expect(harness.orchestrator.enhanceMeeting(started.meetingId ?? '')).rejects.toThrow(
      'Cannot begin enhancement from current state.'
    );

    harness.db.close();
  });

  it('enhances against compacted finalized transcript context', async () => {
    const harness = createHarness();
    const started = harness.stateMachine.start('Weekly sync');
    harness.meetingRecords.recordMeetingStarted(started);
    harness.transcript.append({
      meetingId: started.meetingId ?? '',
      speaker: 'you',
      text: 'I wanna be',
      startTs: 10,
      isFinal: false
    });
    harness.transcript.append({
      meetingId: started.meetingId ?? '',
      speaker: 'you',
      text: 'I wanna be the very best.',
      startTs: 11,
      endTs: 11,
      isFinal: true
    });
    harness.transcript.append({
      meetingId: started.meetingId ?? '',
      speaker: 'you',
      text: 'I wanna be the very best. The best there ever was.',
      startTs: 12,
      endTs: 12,
      isFinal: true
    });
    const stopped = harness.stateMachine.stop(started.meetingId ?? '');
    harness.meetingRecords.recordMeetingStopped(stopped);

    const response = await harness.orchestrator.enhanceMeeting(started.meetingId ?? '');

    expect(response.output.summary).toContain('Transcript captured 1 segment(s)');
    expect(response.output.blocks[0]?.content).toContain(
      'I wanna be the very best. The best there ever was.'
    );

    harness.db.close();
  });
});
