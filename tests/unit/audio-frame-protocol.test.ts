import { describe, expect, it } from 'vitest';
import { parseMicFramesPayload } from '../../src/main/audio/mic-capture';

describe('parseMicFramesPayload', () => {
  it('accepts typed array frames', () => {
    const payload = parseMicFramesPayload({
      seq: 3,
      ts: Date.now(),
      frames: new Int16Array([1, -2, 3])
    });

    expect(payload).not.toBeNull();
    expect(payload?.frames).toBeInstanceOf(Int16Array);
    expect(payload?.frames.length).toBe(3);
  });

  it('accepts number[] and converts to Int16Array', () => {
    const payload = parseMicFramesPayload({
      seq: 7,
      ts: Date.now(),
      frames: [10, -20, 30]
    });

    expect(payload).not.toBeNull();
    expect(payload?.frames).toBeInstanceOf(Int16Array);
    expect(Array.from(payload?.frames ?? [])).toEqual([10, -20, 30]);
  });

  it('rejects invalid payloads', () => {
    expect(parseMicFramesPayload({ seq: -1, ts: 0, frames: [] })).toBeNull();
    expect(parseMicFramesPayload({ seq: 0, ts: 0, frames: [40000] })).toBeNull();
    expect(parseMicFramesPayload('bad')).toBeNull();
  });
});
