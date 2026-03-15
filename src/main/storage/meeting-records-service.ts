import {
  TEMPLATE_IDS,
  type MeetingHistoryItem,
  type TemplateId,
  type TranscriptUpdateEvent
} from '../../shared/ipc';
import type { MeetingSnapshot } from '../meeting/state-machine';
import type { MeetingDetails } from '../../shared/ipc';
import { safeParseEnhancedOutput } from '../enhancement/parse-enhanced-output';
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

    const existing = this.meetings.getById(snapshot.meetingId);
    if (!existing) {
      throw new Error('Cannot stop a meeting that has not been persisted.');
    }

    const priorDurationMs = existing.durationMs ?? 0;
    const segmentDurationMs = Math.max(0, snapshot.stoppedAt - snapshot.startedAt);

    this.meetings.updateStopped({
      id: snapshot.meetingId,
      state: snapshot.state,
      updatedAt: new Date(snapshot.stoppedAt).toISOString(),
      durationMs: priorDurationMs + segmentDurationMs
    });
  }

  public recordMeetingResumed(snapshot: MeetingSnapshot): void {
    if (!snapshot.meetingId || !snapshot.startedAt) {
      throw new Error('Meeting snapshot is missing resume metadata.');
    }

    this.meetings.updateState({
      id: snapshot.meetingId,
      state: snapshot.state,
      updatedAt: new Date(snapshot.startedAt).toISOString()
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

  public recordMeetingEnhancementFailed(snapshot: MeetingSnapshot): void {
    if (!snapshot.meetingId) {
      throw new Error('Meeting snapshot is missing enhancement metadata.');
    }

    this.meetings.updateState({
      id: snapshot.meetingId,
      state: snapshot.state,
      updatedAt: new Date().toISOString()
    });
  }

  public recordMeetingEnhancementDismissed(snapshot: MeetingSnapshot): void {
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
    if (!meetingId || !event.isFinal) {
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

    const meeting: MeetingDetails = {
      id: persisted.meeting.id,
      title: persisted.meeting.title,
      state: persisted.meeting.state,
      createdAt: persisted.meeting.createdAt,
      updatedAt: persisted.meeting.updatedAt,
      durationMs: persisted.meeting.durationMs,
      noteContent: parseDocumentContent(persisted.note?.content),
      enhancedNoteContent: parseDocumentContent(persisted.enhancedNoteDocument?.content),
      enhancedOutput: safeParseEnhancedOutput(persisted.enhancedOutput?.content),
      transcriptSegments: persisted.transcriptSegments.map((segment) => ({
        id: segment.id,
        speaker: segment.speaker,
        text: segment.text,
        startTs: segment.startTs,
        endTs: segment.endTs,
        isFinal: segment.isFinal
      }))
    };

    if (
      persisted.meeting.lastTemplateId &&
      isTemplateId(persisted.meeting.lastTemplateId)
    ) {
      meeting.lastTemplateId = persisted.meeting.lastTemplateId;
    }
    if (persisted.meeting.lastTemplateName) {
      meeting.lastTemplateName = persisted.meeting.lastTemplateName;
    }
    if (persisted.enhancedOutput?.createdAt) {
      meeting.enhancedOutputCreatedAt = persisted.enhancedOutput.createdAt;
    }
    if (persisted.enhancedNoteDocument?.updatedAt) {
      meeting.enhancedNoteUpdatedAt = persisted.enhancedNoteDocument.updatedAt;
    }

    return meeting;
  }

  public archiveMeeting(meetingId: string): void {
    this.meetings.archiveMeeting(meetingId, new Date().toISOString());
  }

  public listMeetingHistory(query?: string): MeetingHistoryItem[] {
    return this.artifacts.listMeetingHistory(query);
  }
}

function isTemplateId(value: string): value is TemplateId {
  return (TEMPLATE_IDS as readonly string[]).includes(value);
}

function parseDocumentContent(content: string | undefined): MeetingDetails['noteContent'] {
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
