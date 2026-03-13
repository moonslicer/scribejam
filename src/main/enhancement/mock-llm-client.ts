import type { EnhancedOutput } from '../../shared/ipc';
import type { EnhancementArtifacts } from './enhancement-artifacts';
import type { LlmClient } from './llm-client';
import { MockEnhancementService } from './mock-enhancement-service';

export class MockLlmClient implements LlmClient {
  private readonly mockEnhancementService = new MockEnhancementService();

  public async enhance(input: EnhancementArtifacts): Promise<EnhancedOutput> {
    return this.mockEnhancementService.enhance(input);
  }
}
