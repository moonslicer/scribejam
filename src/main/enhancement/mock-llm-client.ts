import type { EnhancedOutput } from '../../shared/ipc';
import type { EnhancementArtifacts } from './enhancement-artifacts';
import {
  EnhancementProviderError,
  type EnhancementInvocationOptions,
  type LlmClient
} from './llm-client';
import { MockEnhancementService } from './mock-enhancement-service';

export type MockEnhancementOutcome =
  | 'success'
  | 'invalid_api_key'
  | 'rate_limited'
  | 'timeout'
  | 'network';

const outcomeQueue: MockEnhancementOutcome[] = [];

export class MockLlmClient implements LlmClient {
  private readonly mockEnhancementService = new MockEnhancementService();

  public async enhance(
    input: EnhancementArtifacts,
    _options?: EnhancementInvocationOptions
  ): Promise<EnhancedOutput> {
    const outcome = outcomeQueue.shift() ?? 'success';
    if (outcome !== 'success') {
      throw createMockEnhancementError(outcome);
    }

    return this.mockEnhancementService.enhance(input);
  }
}

export function configureMockEnhancementOutcomes(outcomes: MockEnhancementOutcome[]): void {
  outcomeQueue.splice(0, outcomeQueue.length, ...outcomes);
}

function createMockEnhancementError(outcome: Exclude<MockEnhancementOutcome, 'success'>) {
  switch (outcome) {
    case 'invalid_api_key':
      return new EnhancementProviderError('invalid_api_key', 'Invalid OpenAI key.', {
        provider: 'openai'
      });
    case 'rate_limited':
      return new EnhancementProviderError('rate_limited', 'Enhancement delayed — retry when ready.', {
        provider: 'openai'
      });
    case 'timeout':
      return new EnhancementProviderError('timeout', 'Enhancement request timed out.', {
        provider: 'openai'
      });
    case 'network':
      return new EnhancementProviderError('network', 'Network interruption while contacting OpenAI.', {
        provider: 'openai'
      });
  }
}
