import { describe, expect, it } from 'vitest';
import { RingBuffer } from '../../src/main/audio/ring-buffer';

describe('RingBuffer', () => {
  it('keeps insertion order and drops oldest item on overflow', () => {
    const buffer = new RingBuffer<number>(2);

    expect(buffer.push(1)).toBeUndefined();
    expect(buffer.push(2)).toBeUndefined();
    expect(buffer.push(3)).toBe(1);

    expect(buffer.shift()).toBe(2);
    expect(buffer.shift()).toBe(3);
    expect(buffer.shift()).toBeUndefined();
  });

  it('rejects invalid capacity', () => {
    expect(() => new RingBuffer<number>(0)).toThrowError();
  });
});
