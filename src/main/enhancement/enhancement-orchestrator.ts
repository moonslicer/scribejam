import type { EnhanceMeetingResponse } from '../../shared/ipc';
import { MeetingStateMachine } from '../meeting/state-machine';
import { MeetingRecordsService } from '../storage/meeting-records-service';
import {
  EnhancedOutputsRepository,
  MeetingArtifactsRepository
} from '../storage/repositories';
import { toEnhancementArtifacts } from './enhancement-artifacts';
import type { LlmClient } from './llm-client';

export class EnhancementOrchestrator {
  public constructor(
    private readonly stateMachine: MeetingStateMachine,
    private readonly meetingRecordsService: MeetingRecordsService,
    private readonly meetingArtifactsRepository: MeetingArtifactsRepository,
    private readonly enhancedOutputsRepository: EnhancedOutputsRepository,
    private readonly getLlmClient: () => LlmClient
  ) {}

  public async enhanceMeeting(meetingId: string): Promise<EnhanceMeetingResponse> {
    const beginSnapshot = this.stateMachine.beginEnhancement(meetingId);
    this.meetingRecordsService.recordMeetingEnhancementStarted(beginSnapshot);

    try {
      const artifacts = this.meetingArtifactsRepository.getMeetingWithArtifacts(meetingId);
      if (!artifacts) {
        throw new Error('Meeting not found for enhancement.');
      }

      const output = await this.getLlmClient().enhance(
        toEnhancementArtifacts(artifacts)
      );
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
      throw error;
    }
  }
}
