import { DeepgramAdapter } from './deepgram-adapter';
import { MockSttAdapter } from './mock-stt-adapter';
import type { RealtimeSttAdapter } from './types';

export interface CreateSttAdapterOptions {
  getDeepgramApiKey: () => string | undefined;
}

export function createSttAdapter(options: CreateSttAdapterOptions): RealtimeSttAdapter {
  if (process.env.SCRIBEJAM_TEST_MODE === '1') {
    return new MockSttAdapter();
  }

  return new DeepgramAdapter({
    getApiKey: options.getDeepgramApiKey
  });
}
