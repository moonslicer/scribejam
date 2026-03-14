import type { EnhanceMeetingResponse, EnhanceProgressEvent } from '../../shared/ipc';
import { MeetingStateMachine } from '../meeting/state-machine';
import { MeetingRecordsService } from '../storage/meeting-records-service';
import {
  EnhancedOutputsRepository,
  MeetingArtifactsRepository
} from '../storage/repositories';
import { toEnhancementArtifacts } from './enhancement-artifacts';
import {
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

  public async enhanceMeeting(meetingId: string): Promise<EnhanceMeetingResponse> {
    const beginSnapshot = this.beginEnhancement(meetingId);
    this.meetingRecordsService.recordMeetingEnhancementStarted(beginSnapshot);
    this.emitProgress(meetingId, 'streaming', 'Preparing saved notes and transcript...');

    try {
      const artifacts = this.meetingArtifactsRepository.getMeetingWithArtifacts(meetingId);
      if (!artifacts) {
        throw new Error('Meeting not found for enhancement.');
      }

      const llmClient = this.getLlmClient();
      const enhancementInput = toEnhancementArtifacts(artifacts);
      this.emitProgress(meetingId, 'streaming', 'Sending saved notes and transcript for enhancement...');
      const output = await this.runEnhancementWithRetry(llmClient, enhancementInput);
      const completedAt = new Date().toISOString();
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

  private beginEnhancement(meetingId: string) {
    const snapshot = this.stateMachine.getSnapshot();
    if (snapshot.state === 'enhance_failed' && snapshot.meetingId === meetingId) {
      return this.stateMachine.retryEnhancement(meetingId);
    }

    return this.stateMachine.beginEnhancement(meetingId);
  }

  private async runEnhancementWithRetry(
    llmClient: LlmClient,
    input: ReturnType<typeof toEnhancementArtifacts>
  ) {
    try {
      return await llmClient.enhance(input);
    } catch (error) {
      const normalized = normalizeEnhancementError(error);
      if (!isRetryableEnhancementError(normalized)) {
        throw normalized;
      }

      this.emitProgress(input.meetingId, 'streaming', 'Temporary provider issue. Retrying enhancement...');
      await this.sleep(this.retryDelayMs);

      try {
        return await llmClient.enhance(input);
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
