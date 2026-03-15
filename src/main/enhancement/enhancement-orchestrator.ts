import type { EnhanceMeetingResponse, EnhanceProgressEvent } from '../../shared/ipc';
import { MeetingStateMachine } from '../meeting/state-machine';
import { MeetingRecordsService } from '../storage/meeting-records-service';
import {
  EnhancedNoteDocumentsRepository,
  EnhancedOutputsRepository,
  MeetingArtifactsRepository
} from '../storage/repositories';
import { toEnhancementArtifacts } from './enhancement-artifacts';
import {
  type EnhancementInvocationOptions,
  isRetryableEnhancementError,
  normalizeEnhancementError,
  type LlmClient
} from './llm-client';

export class EnhancementOrchestrator {
  private readonly retryDelayMs: number;
  private readonly sleep: (ms: number) => Promise<void>;

  public constructor(
    private readonly stateMachine: MeetingStateMachine,
    private readonly meetingRecordsService: MeetingRecordsService,
    private readonly meetingArtifactsRepository: MeetingArtifactsRepository,
    private readonly enhancedOutputsRepository: EnhancedOutputsRepository,
    private readonly enhancedNoteDocumentsRepository: EnhancedNoteDocumentsRepository,
    private readonly getLlmClient: () => LlmClient,
    options?: {
      retryDelayMs?: number;
      sleep?: (ms: number) => Promise<void>;
    },
    private readonly onProgress?: (event: EnhanceProgressEvent) => void
  ) {
    this.retryDelayMs = options?.retryDelayMs ?? 750;
    this.sleep = options?.sleep ?? defaultSleep;
  }

  public async enhanceMeeting(
    meetingId: string,
    options?: EnhancementInvocationOptions
  ): Promise<EnhanceMeetingResponse> {
    const artifacts = this.meetingArtifactsRepository.getMeetingWithArtifacts(meetingId);
    if (!artifacts) {
      throw new Error('Meeting not found for enhancement.');
    }

    const beginSnapshot = this.beginEnhancement(artifacts.meeting);
    this.meetingRecordsService.recordMeetingEnhancementStarted(beginSnapshot);
    this.emitProgress(meetingId, 'streaming', 'Preparing saved notes and transcript...');

    try {
      const llmClient = this.getLlmClient();
      const enhancementInput = toEnhancementArtifacts(artifacts);
      this.emitProgress(meetingId, 'streaming', 'Sending saved notes and transcript for enhancement...');
      const output = await this.runEnhancementWithRetry(llmClient, enhancementInput, options);
      const completedAt = new Date().toISOString();
      this.enhancedNoteDocumentsRepository.deleteByMeetingId(meetingId);
      this.enhancedOutputsRepository.save({
        meetingId,
        content: JSON.stringify(output),
        createdAt: completedAt
      });

      const completedSnapshot = this.stateMachine.completeEnhancement(meetingId);
      this.meetingRecordsService.recordMeetingEnhancementCompleted(completedSnapshot);
      this.emitProgress(meetingId, 'done', 'Enhanced notes are ready.');

      return {
        meetingId,
        output,
        completedAt
      };
    } catch (error) {
      const failedSnapshot = this.stateMachine.failEnhancement(meetingId);
      this.meetingRecordsService.recordMeetingEnhancementFailed(failedSnapshot);
      const normalized = normalizeEnhancementError(error);
      this.emitProgress(meetingId, 'error', 'Enhancement failed.');
      throw normalized;
    }
  }

  private beginEnhancement(meeting: {
    id: string;
    title: string;
    state: 'idle' | 'recording' | 'stopped' | 'enhancing' | 'enhance_failed' | 'done';
  }) {
    const snapshot = this.stateMachine.getSnapshot();
    const hasLoadedEnhancementCandidate =
      snapshot.meetingId === meeting.id &&
      (snapshot.state === 'stopped' || snapshot.state === 'enhance_failed' || snapshot.state === 'done');

    if (hasLoadedEnhancementCandidate) {
      return snapshot.state === 'enhance_failed'
        ? this.stateMachine.retryEnhancement(meeting.id)
        : this.stateMachine.beginEnhancement(meeting.id);
    }

    if (snapshot.state === 'recording' || snapshot.state === 'enhancing') {
      return this.stateMachine.beginEnhancement(meeting.id);
    }

    if (
      meeting.state !== 'stopped' &&
      meeting.state !== 'enhance_failed' &&
      meeting.state !== 'done'
    ) {
      throw new Error(`Cannot enhance meeting from ${meeting.state} state.`);
    }

    this.stateMachine.primeForResume({
      meetingId: meeting.id,
      title: meeting.title,
      state: meeting.state
    });

    return meeting.state === 'enhance_failed'
      ? this.stateMachine.retryEnhancement(meeting.id)
      : this.stateMachine.beginEnhancement(meeting.id);
  }

  private async runEnhancementWithRetry(
    llmClient: LlmClient,
    input: ReturnType<typeof toEnhancementArtifacts>,
    options?: EnhancementInvocationOptions
  ) {
    try {
      return await llmClient.enhance(input, options);
    } catch (error) {
      const normalized = normalizeEnhancementError(error);
      if (!isRetryableEnhancementError(normalized)) {
        throw normalized;
      }

      this.emitProgress(input.meetingId, 'streaming', 'Connection slow, retrying...');
      await this.sleep(this.retryDelayMs);

      try {
        return await llmClient.enhance(input, options);
      } catch (retryError) {
        throw normalizeEnhancementError(retryError, createRetryOptions(normalized));
      }
    }
  }

  private emitProgress(
    meetingId: string,
    status: EnhanceProgressEvent['status'],
    detail: string
  ): void {
    this.onProgress?.({
      meetingId,
      status,
      detail
    });
  }
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function createRetryOptions(error: { provider: string | undefined; message: string }) {
  return {
    fallbackMessage: error.message,
    ...(error.provider ? { provider: error.provider } : {})
  };
}
