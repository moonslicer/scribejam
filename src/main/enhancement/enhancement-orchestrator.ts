import type { EnhanceMeetingResponse } from '../../shared/ipc';
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
    }
  ) {
    this.retryDelayMs = options?.retryDelayMs ?? 750;
    this.sleep = options?.sleep ?? defaultSleep;
  }

  public async enhanceMeeting(meetingId: string): Promise<EnhanceMeetingResponse> {
    const beginSnapshot = this.stateMachine.beginEnhancement(meetingId);
    this.meetingRecordsService.recordMeetingEnhancementStarted(beginSnapshot);

    try {
      const artifacts = this.meetingArtifactsRepository.getMeetingWithArtifacts(meetingId);
      if (!artifacts) {
        throw new Error('Meeting not found for enhancement.');
      }

      const llmClient = this.getLlmClient();
      const enhancementInput = toEnhancementArtifacts(artifacts);
      const output = await this.runEnhancementWithRetry(llmClient, enhancementInput);
      const completedAt = new Date().toISOString();
      this.enhancedOutputsRepository.save({
        meetingId,
        content: JSON.stringify(output),
        createdAt: completedAt
      });

      const completedSnapshot = this.stateMachine.completeEnhancement(meetingId);
      this.meetingRecordsService.recordMeetingEnhancementCompleted(completedSnapshot);

      return {
        meetingId,
        output,
        completedAt
      };
    } catch (error) {
      const failedSnapshot = this.stateMachine.failEnhancement(meetingId);
      this.meetingRecordsService.recordMeetingEnhancementFailed(failedSnapshot);
      throw normalizeEnhancementError(error);
    }
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

      await this.sleep(this.retryDelayMs);

      try {
        return await llmClient.enhance(input);
      } catch (retryError) {
        throw normalizeEnhancementError(retryError, createRetryOptions(normalized));
      }
    }
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
