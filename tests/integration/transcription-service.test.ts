import { describe, expect, it } from 'vitest';
import type { TranscriptUpdateEvent, TranscriptionStatusEvent } from '../../src/shared/ipc';
import type { SourceAudioFrame } from '../../src/main/audio/frame-types';
import { MockSttAdapter } from '../../src/main/stt/mock-stt-adapter';
import { TranscriptionService } from '../../src/main/transcription/transcription-service';

function frame(source: 'mic' | 'system', seq: number): SourceAudioFrame {
  return {
    source,
    seq,
    ts: Date.now() + seq,
    frames: new Int16Array(320).fill(source === 'mic' ? 1_000 : 2_000)
  };
}

describe('TranscriptionService', () => {
  it('streams transcript events and maps speaker labels from source activity', async () => {
    const transcriptEvents: TranscriptUpdateEvent[] = [];

    const service = new TranscriptionService({
      sttAdapter: new MockSttAdapter({ transcriptEveryNFrames: 1 }),
      mixCadenceMs: 20,
      events: {
        onTranscript: (event) => transcriptEvents.push(event),
        onStatus: () => {
          // no-op
        },
        onErrorDisplay: () => {
          // no-op
        }
      }
    });

    await service.start();
    service.ingestSourceFrame(frame('mic', 1));

    await new Promise((resolve) => setTimeout(resolve, 30));
    await service.stop();

    expect(transcriptEvents.length).toBeGreaterThan(0);
    expect(transcriptEvents[0]?.speaker).toBe('you');
  });

  it('emits reconnecting then streaming status during adapter recovery', async () => {
    const statusEvents: TranscriptionStatusEvent[] = [];

    const service = new TranscriptionService({
      sttAdapter: new MockSttAdapter({ reconnectDelayMs: 10, transcriptEveryNFrames: 10 }),
      mixCadenceMs: 20,
      events: {
        onTranscript: () => {
          // no-op
        },
        onStatus: (event) => statusEvents.push(event),
        onErrorDisplay: () => {
          // no-op
        }
      }
    });

    await service.start();
    service.simulateDisconnect();

    await new Promise((resolve) => setTimeout(resolve, 40));
    await service.stop();

    expect(statusEvents.some((event) => event.status === 'reconnecting')).toBe(true);
    expect(statusEvents.some((event) => event.status === 'streaming')).toBe(true);
  });
});
