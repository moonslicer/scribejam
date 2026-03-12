export interface SourceAudioFrame {
  source: 'mic' | 'system';
  seq: number;
  ts: number;
  frames: Int16Array;
}

export interface MixedAudioFrame {
  seq: number;
  ts: number;
  frames: Int16Array;
  activeSources: {
    mic: boolean;
    system: boolean;
  };
}
