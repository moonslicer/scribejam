import type { TranscriptUpdateEvent } from '../../shared/ipc';
import type { MeetingSnapshot } from '../meeting/state-machine';
import type { EnhancedOutput, MeetingDetails } from '../../shared/ipc';
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

    return {
      id: persisted.meeting.id,
      title: persisted.meeting.title,
      state: persisted.meeting.state,
      createdAt: persisted.meeting.createdAt,
      updatedAt: persisted.meeting.updatedAt,
      durationMs: persisted.meeting.durationMs,
      noteContent: parseNoteContent(persisted.note?.content),
      enhancedOutput: parseEnhancedOutput(persisted.enhancedOutput?.content),
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

function parseEnhancedOutput(content: string | undefined): EnhancedOutput | null {
  if (!content) {
    return null;
  }

  try {
    const parsed = JSON.parse(content) as Partial<EnhancedOutput>;
    if (
      Array.isArray(parsed.blocks) &&
      Array.isArray(parsed.actionItems) &&
      Array.isArray(parsed.decisions) &&
      typeof parsed.summary === 'string'
    ) {
      return {
        blocks: parsed.blocks.map((block) => ({
          source: block?.source === 'human' ? 'human' : 'ai',
          content: typeof block?.content === 'string' ? block.content : ''
        })),
        actionItems: parsed.actionItems
          .filter(
            (item): item is { owner: string; description: string; due?: string } =>
              Boolean(item) && typeof item.owner === 'string' && typeof item.description === 'string'
          )
          .map((item) => ({
            owner: item.owner,
            description: item.description,
            ...(typeof item.due === 'string' ? { due: item.due } : {})
          })),
        decisions: parsed.decisions
          .filter(
            (decision): decision is { description: string; context: string } =>
              Boolean(decision) &&
              typeof decision.description === 'string' &&
              typeof decision.context === 'string'
          )
          .map((decision) => ({
            description: decision.description,
            context: decision.context
          })),
        summary: parsed.summary
      };
    }
  } catch {
    return null;
  }

  return null;
}
