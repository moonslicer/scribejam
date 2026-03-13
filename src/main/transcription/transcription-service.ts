import type { ErrorDisplayEvent, TranscriptUpdateEvent, TranscriptionStatusEvent } from '../../shared/ipc';
import type { SourceAudioFrame } from '../audio/frame-types';
import { DeterministicMixer } from '../audio/mixer';
import type { RealtimeSttAdapter, SttConnectionEvent } from '../stt/types';

export interface TranscriptionServiceEvents {
  onTranscript: (event: TranscriptUpdateEvent) => void;
  onStatus: (event: TranscriptionStatusEvent) => void;
  onErrorDisplay: (event: ErrorDisplayEvent) => void;
}

export interface TranscriptionServiceOptions {
  sttAdapter: RealtimeSttAdapter;
  sampleRateHz?: number;
  frameSizeMs?: number;
  mixCadenceMs?: number;
  maxBufferedFramesPerSource?: number;
  events: TranscriptionServiceEvents;
}

export class TranscriptionService {
  private readonly sttAdapter: RealtimeSttAdapter;
  private readonly mixer: DeterministicMixer;
  private readonly events: TranscriptionServiceEvents;
  private running = false;
  private lastMicFrameTs = -1;
  private lastSystemFrameTs = -1;

  public constructor(options: TranscriptionServiceOptions) {
    this.sttAdapter = options.sttAdapter;
    this.events = options.events;

    this.mixer = new DeterministicMixer({
      sampleRateHz: options.sampleRateHz ?? 16_000,
      frameSizeMs: options.frameSizeMs ?? 20,
      mixCadenceMs: options.mixCadenceMs ?? 100,
      maxBufferedFramesPerSource: options.maxBufferedFramesPerSource ?? 250,
      events: {
        onMixedFrame: (frame) => {
          if (!this.running) {
            return;
          }
          void this.sttAdapter.sendAudio(frame.frames).catch(() => {
            this.events.onStatus({
              status: 'paused',
              detail: 'Transcription paused — check network'
            });
          });
        },
        onDrop: (source) => {
          this.events.onErrorDisplay({
            message: `Audio pipeline backpressure: dropped oldest ${source} frame. Continuing capture.`
          });
        }
      }
    });

    this.sttAdapter.onTranscript((event) => {
      this.events.onTranscript({
        text: event.text,
        speaker: this.lastMicFrameTs >= this.lastSystemFrameTs ? 'you' : 'them',
        ts: event.ts,
        isFinal: event.isFinal
      });
    });

    this.sttAdapter.onConnectionEvent((event) => {
      this.onConnectionEvent(event);
    });
  }

  public async start(): Promise<void> {
    if (this.running) {
      return;
    }

    this.lastMicFrameTs = -1;
    this.lastSystemFrameTs = -1;
    this.events.onStatus({ status: 'connecting' });

    try {
      await this.sttAdapter.start();
      this.running = true;
      this.mixer.start();
      this.events.onStatus({ status: 'streaming' });
    } catch {
      this.running = false;
      this.events.onStatus({
        status: 'paused',
        detail: 'Transcription paused — add a valid Deepgram key in settings.'
      });
      this.events.onErrorDisplay({
        message: 'Transcription is unavailable. Add a valid Deepgram key in settings.',
        action: 'open-settings'
      });
    }
  }

  public async stop(): Promise<void> {
    this.running = false;
    this.mixer.reset();
    await this.sttAdapter.stop();
    this.events.onStatus({ status: 'idle' });
  }

  public ingestSourceFrame(frame: SourceAudioFrame): void {
    if (!this.running) {
      return;
    }

    if (frame.source === 'mic') {
      this.lastMicFrameTs = frame.ts;
    } else {
      this.lastSystemFrameTs = frame.ts;
    }

    this.mixer.ingest(frame);
  }

  public async validateDeepgramKey(key: string): Promise<{ valid: boolean; error?: string }> {
    return this.sttAdapter.validateKey(key);
  }

  public simulateDisconnect(): void {
    this.sttAdapter.simulateDisconnect?.();
  }

  private onConnectionEvent(event: SttConnectionEvent): void {
    if (event === 'disconnect' || event === 'reconnect_attempt') {
      this.events.onStatus({
        status: 'reconnecting',
        detail: 'Transcription reconnecting...'
      });
      return;
    }

    if (event === 'reconnect_success') {
      this.events.onStatus({ status: 'streaming' });
      return;
    }

    this.events.onStatus({
      status: 'paused',
      detail: 'Transcription paused — check network'
    });
  }
}
