import type { ErrorDisplayEvent, TranscriptUpdateEvent, TranscriptionStatusEvent } from '../../shared/ipc';
import type { SourceAudioFrame } from '../audio/frame-types';
import { DeterministicMixer } from '../audio/mixer';
import { isLikelyDeepgramAuthError, MissingDeepgramApiKeyError } from '../stt/deepgram-adapter';
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
      if (!this.running) {
        return;
      }

      this.events.onTranscript({
        text: event.text,
        speaker: event.speakerId !== undefined ? `speaker-${event.speakerId}` : 'speaker-0',
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

    this.events.onStatus({ status: 'connecting' });

    try {
      await this.sttAdapter.start();
      this.running = true;
      this.mixer.start();
      this.events.onStatus({ status: 'streaming' });
    } catch (error) {
      const isCredentialFailure =
        error instanceof MissingDeepgramApiKeyError || isLikelyDeepgramAuthError(error);

      this.running = false;
      this.events.onStatus({
        status: 'paused',
        detail: isCredentialFailure
          ? 'Transcription paused — add a valid Deepgram key in settings.'
          : 'Transcription paused — unable to connect to Deepgram.'
      });
      this.events.onErrorDisplay(
        isCredentialFailure
          ? {
              message: 'Transcription is unavailable. Add a valid Deepgram key in settings.',
              action: 'open-settings'
            }
          : {
              message: 'Transcription is unavailable. Check your Deepgram connection and try again.'
            }
      );
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
