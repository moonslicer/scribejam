import type { MicFramesPayload } from '../../shared/ipc';
import { isMicFramesPayload } from '../../shared/ipc';

export interface ParsedMicFramesPayload extends Omit<MicFramesPayload, 'frames'> {
  frames: Int16Array;
}

export function parseMicFramesPayload(payload: unknown): ParsedMicFramesPayload | null {
  if (!isMicFramesPayload(payload)) {
    return null;
  }

  return {
    seq: payload.seq,
    ts: payload.ts,
    frames: payload.frames instanceof Int16Array ? payload.frames : Int16Array.from(payload.frames)
  };
}
