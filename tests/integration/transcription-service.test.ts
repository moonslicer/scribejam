import { describe, expect, it } from 'vitest';
import type { TranscriptUpdateEvent, TranscriptionStatusEvent } from '../../src/shared/ipc';
import type { SourceAudioFrame } from '../../src/main/audio/frame-types';
import { MockSttAdapter } from '../../src/main/stt/mock-stt-adapter';
import type {
  KeyValidationResult,
  RealtimeSttAdapter,
  SttConnectionEvent,
  SttTranscriptEvent
} from '../../src/main/stt/types';
import { TranscriptionService } from '../../src/main/transcription/transcription-service';

function frame(source: 'mic' | 'system', seq: number): SourceAudioFrame {
  return {
    source,
    seq,
    ts: Date.now() + seq,
    frames: new Int16Array(320).fill(source === 'mic' ? 1_000 : 2_000)
  };
}

class ScriptedSttAdapter implements RealtimeSttAdapter {
  private transcriptListener: ((event: SttTranscriptEvent) => void) | null = null;
  private connectionListener: ((event: SttConnectionEvent) => void) | null = null;

  public async start(): Promise<void> {
    // no-op
  }

  public async sendAudio(_frames: Int16Array): Promise<void> {
    // no-op
  }

  public async stop(): Promise<void> {
    // no-op
  }

  public async validateKey(_key: string): Promise<KeyValidationResult> {
    return { valid: true };
  }

  public onTranscript(listener: (event: SttTranscriptEvent) => void): void {
    this.transcriptListener = listener;
  }

  public onConnectionEvent(listener: (event: SttConnectionEvent) => void): void {
    this.connectionListener = listener;
  }

  public emitTranscript(event: SttTranscriptEvent): void {
    this.transcriptListener?.(event);
  }
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

  it('keeps speaker attribution stable for one utterance across partial updates', async () => {
    const transcriptEvents: TranscriptUpdateEvent[] = [];
    const sttAdapter = new ScriptedSttAdapter();
    const service = new TranscriptionService({
      sttAdapter,
      mixCadenceMs: 10,
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

    service.ingestSourceFrame(frame('system', 1));
    await new Promise((resolve) => setTimeout(resolve, 15));

    sttAdapter.emitTranscript({
      ts: 100,
      text: 'So',
      isFinal: false,
      latencyMs: 10
    });

    service.ingestSourceFrame(frame('mic', 2));
    await new Promise((resolve) => setTimeout(resolve, 15));

    sttAdapter.emitTranscript({
      ts: 120,
      text: 'System prompt.',
      isFinal: true,
      latencyMs: 10
    });

    service.ingestSourceFrame(frame('mic', 3));
    await new Promise((resolve) => setTimeout(resolve, 15));

    sttAdapter.emitTranscript({
      ts: 140,
      text: 'I can take that.',
      isFinal: true,
      latencyMs: 10
    });

    await service.stop();

    expect(transcriptEvents).toHaveLength(3);
    expect(transcriptEvents[0]?.speaker).toBe('them');
    expect(transcriptEvents[1]?.speaker).toBe('them');
    expect(transcriptEvents[2]?.speaker).toBe('you');
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
