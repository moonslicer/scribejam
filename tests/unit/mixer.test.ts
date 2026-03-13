import { describe, expect, it } from 'vitest';
import { DeterministicMixer } from '../../src/main/audio/mixer';
import type { SourceAudioFrame } from '../../src/main/audio/frame-types';

function makeFrame(source: 'mic' | 'system', seq: number, sample: number): SourceAudioFrame {
  return {
    source,
    seq,
    ts: seq,
    frames: new Int16Array(320).fill(sample)
  };
}

describe('DeterministicMixer', () => {
  it('mixes mic and system frames at a deterministic cadence', () => {
    const mixed: number[] = [];
    const mixer = new DeterministicMixer({
      sampleRateHz: 16_000,
      frameSizeMs: 20,
      mixCadenceMs: 100,
      maxBufferedFramesPerSource: 50,
      events: {
        onMixedFrame: (frame) => {
          mixed.push(frame.frames[0] ?? 0);
        },
        onDrop: () => {
          // no-op
        }
      }
    });

    for (let i = 0; i < 5; i += 1) {
      mixer.ingest(makeFrame('mic', i, 1_000));
      mixer.ingest(makeFrame('system', i, 3_000));
    }

    mixer.tick(1000);
    expect(mixed).toEqual([2_000]);
  });

  it('emits source activity flags', () => {
    let activeMic = false;
    let activeSystem = false;

    const mixer = new DeterministicMixer({
      sampleRateHz: 16_000,
      frameSizeMs: 20,
      mixCadenceMs: 100,
      maxBufferedFramesPerSource: 50,
      events: {
        onMixedFrame: (frame) => {
          activeMic = frame.activeSources.mic;
          activeSystem = frame.activeSources.system;
        },
        onDrop: () => {
          // no-op
        }
      }
    });

    for (let i = 0; i < 5; i += 1) {
      mixer.ingest(makeFrame('mic', i, 1_000));
    }

    mixer.tick(1000);
    expect(activeMic).toBe(true);
    expect(activeSystem).toBe(false);
  });

  it('drops oldest buffered frames under backpressure', () => {
    const drops: Array<'mic' | 'system'> = [];
    const mixer = new DeterministicMixer({
      sampleRateHz: 16_000,
      frameSizeMs: 20,
      mixCadenceMs: 100,
      maxBufferedFramesPerSource: 2,
      events: {
        onMixedFrame: () => {
          // no-op
        },
        onDrop: (source) => {
          drops.push(source);
        }
      }
    });

    mixer.ingest(makeFrame('mic', 0, 1));
    mixer.ingest(makeFrame('mic', 1, 1));
    mixer.ingest(makeFrame('mic', 2, 1));

    expect(drops).toEqual(['mic']);
  });
});
