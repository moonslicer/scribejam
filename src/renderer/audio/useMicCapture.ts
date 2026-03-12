import { useEffect, useRef } from 'react';
import { MIC_WORKLET_PROCESSOR_SOURCE } from './mic-worklet';

interface UseMicCaptureOptions {
  enabled: boolean;
  onError: (message: string) => void;
}

interface CaptureRefs {
  stream?: MediaStream;
  context?: AudioContext;
  source?: MediaStreamAudioSourceNode;
  node?: AudioWorkletNode;
  muteGain?: GainNode;
  workletUrl?: string;
  seq: number;
}

const SAMPLE_RATE = 16_000;

function float32ToInt16(input: Float32Array): Int16Array {
  const result = new Int16Array(input.length);
  for (let i = 0; i < input.length; i += 1) {
    const sample = Math.max(-1, Math.min(1, input[i] ?? 0));
    result[i] = sample < 0 ? Math.round(sample * 32768) : Math.round(sample * 32767);
  }
  return result;
}

export function useMicCapture({ enabled, onError }: UseMicCaptureOptions): void {
  const refs = useRef<CaptureRefs>({ seq: 0 });

  useEffect(() => {
    let cancelled = false;

    const start = async (): Promise<void> => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            channelCount: 1,
            sampleRate: SAMPLE_RATE
          }
        });

        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        const context = new AudioContext({ sampleRate: SAMPLE_RATE });
        const source = context.createMediaStreamSource(stream);

        const workletBlob = new Blob([MIC_WORKLET_PROCESSOR_SOURCE], {
          type: 'application/javascript'
        });
        const workletUrl = URL.createObjectURL(workletBlob);
        await context.audioWorklet.addModule(workletUrl);
        const node = new AudioWorkletNode(context, 'scribejam-mic-worklet');
        const muteGain = context.createGain();
        muteGain.gain.value = 0;

        node.port.onmessage = (event: MessageEvent<Float32Array>) => {
          const frames = float32ToInt16(event.data);
          window.scribejam.sendMicFrames({
            seq: refs.current.seq,
            ts: Date.now(),
            frames
          });
          refs.current.seq += 1;
        };

        source.connect(node);
        node.connect(muteGain);
        muteGain.connect(context.destination);

        refs.current = {
          stream,
          context,
          source,
          node,
          muteGain,
          workletUrl,
          seq: 0
        };
      } catch {
        onError('Microphone permission denied or unavailable.');
      }
    };

    const stop = async (): Promise<void> => {
      refs.current.node?.port.close();
      refs.current.source?.disconnect();
      refs.current.node?.disconnect();
      refs.current.muteGain?.disconnect();
      refs.current.stream?.getTracks().forEach((track) => track.stop());
      if (refs.current.context && refs.current.context.state !== 'closed') {
        await refs.current.context.close();
      }
      if (refs.current.workletUrl) {
        URL.revokeObjectURL(refs.current.workletUrl);
      }
      refs.current = { seq: 0 };
    };

    if (enabled) {
      void start();
    } else {
      void stop();
    }

    return () => {
      cancelled = true;
      void stop();
    };
  }, [enabled, onError]);
}
