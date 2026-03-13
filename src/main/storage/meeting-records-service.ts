import type { TranscriptUpdateEvent } from '../../shared/ipc';
import type { MeetingSnapshot } from '../meeting/state-machine';
import type { MeetingDetails } from '../../shared/ipc';
import { MeetingArtifactsRepository, MeetingsRepository, TranscriptRepository } from './repositories';

export class MeetingRecordsService {
  public constructor(
    private readonly meetings: MeetingsRepository,
    private readonly artifacts: MeetingArtifactsRepository,
    private readonly transcript: TranscriptRepository
  ) {}

  public recordMeetingStarted(snapshot: MeetingSnapshot): void {
    if (!snapshot.meetingId || !snapshot.title || !snapshot.startedAt) {
      throw new Error('Meeting snapshot is missing persisted fields.');
    }

    const startedAt = new Date(snapshot.startedAt).toISOString();
    this.meetings.create({
      id: snapshot.meetingId,
      title: snapshot.title,
      state: snapshot.state,
      createdAt: startedAt,
      updatedAt: startedAt
    });
  }

  public recordMeetingStopped(snapshot: MeetingSnapshot): void {
    if (!snapshot.meetingId || !snapshot.startedAt || !snapshot.stoppedAt) {
      throw new Error('Meeting snapshot is missing stop metadata.');
    }

    this.meetings.updateStopped({
      id: snapshot.meetingId,
      state: snapshot.state,
      updatedAt: new Date(snapshot.stoppedAt).toISOString(),
      durationMs: Math.max(0, snapshot.stoppedAt - snapshot.startedAt)
    });
  }

  public recordMeetingEnhancementStarted(snapshot: MeetingSnapshot): void {
    if (!snapshot.meetingId) {
      throw new Error('Meeting snapshot is missing enhancement metadata.');
    }

    this.meetings.updateState({
      id: snapshot.meetingId,
      state: snapshot.state,
      updatedAt: new Date().toISOString()
    });
  }

  public recordMeetingEnhancementCompleted(snapshot: MeetingSnapshot): void {
    if (!snapshot.meetingId) {
      throw new Error('Meeting snapshot is missing enhancement metadata.');
    }

    this.meetings.updateState({
      id: snapshot.meetingId,
      state: snapshot.state,
      updatedAt: new Date().toISOString()
    });
  }

  public appendTranscriptSegment(meetingId: string | undefined, event: TranscriptUpdateEvent): void {
    if (!meetingId) {
      return;
    }

    this.transcript.append({
      meetingId,
      speaker: event.speaker,
      text: event.text,
      startTs: event.ts,
      ...(event.isFinal ? { endTs: event.ts } : {}),
      isFinal: event.isFinal
    });
  }

  public getMeeting(meetingId: string): MeetingDetails | null {
    const persisted = this.artifacts.getMeetingWithArtifacts(meetingId);
    if (!persisted) {
      return null;
    }

    return {
      id: persisted.meeting.id,
      title: persisted.meeting.title,
      state: persisted.meeting.state,
      createdAt: persisted.meeting.createdAt,
      updatedAt: persisted.meeting.updatedAt,
      durationMs: persisted.meeting.durationMs,
      noteContent: parseNoteContent(persisted.note?.content),
      transcriptSegments: persisted.transcriptSegments.map((segment) => ({
        id: segment.id,
        speaker: segment.speaker,
        text: segment.text,
        startTs: segment.startTs,
        endTs: segment.endTs,
        isFinal: segment.isFinal
      }))
    };
  }
}

function parseNoteContent(content: string | undefined): MeetingDetails['noteContent'] {
  if (!content) {
    return null;
  }

  try {
    const parsed = JSON.parse(content) as MeetingDetails['noteContent'];
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed;
    }
  } catch {
    return null;
  }

  return null;
}
