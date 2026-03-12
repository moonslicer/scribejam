export type AudioSource = "system" | "mic" | "mixed";
export type CaptureMode = "mock" | "audioteejs" | "unavailable";
export type MicMode = "mock" | "ipc" | "none";
export type SttMode = "mock" | "deepgram";

export interface AudioFrame {
  source: AudioSource;
  seq: number;
  tsMs: number;
  samples: Int16Array;
}

export interface TranscriptEvent {
  tsMs: number;
  text: string;
  latencyMs: number;
  isFinal: boolean;
}

export interface HarnessConfig {
  runId: string;
  scenarioId: string;
  outputDir: string;
  durationSec: number;
  sampleRateHz: number;
  frameSizeMs: number;
  mixCadenceMs: number;
  systemCaptureMode: CaptureMode;
  micCaptureMode: MicMode;
  sttMode: SttMode;
  micIpcPort: number;
}

export interface EventRecord {
  ts_iso: string;
  run_id: string;
  scenario_id: string;
  event_type: string;
  source: "system" | "mic" | "mixer" | "stt" | "app";
  seq?: number;
  lag_ms?: number;
  buffer_depth?: number;
  message: string;
}

export interface RunMetadata {
  run_id: string;
  timestamp_start_iso: string;
  timestamp_end_iso: string;
  scenario_id: string;
  config_id: string;
  config: {
    frame_size_ms: number;
    mix_cadence_ms: number;
    sample_rate_hz: number;
    channels: number;
    format: "PCM16";
  };
  environment: {
    macos_version: string;
    hardware_model: string;
    architecture: string;
    node_version: string;
    electron_version: string;
    audioteejs_version: string;
    deepgram_mode: string;
  };
  operator: string;
  commit_ref: string;
  notes: string;
}

export interface RunMetrics {
  run_id: string;
  duration_minutes: number;
  frame_stats: {
    total_frames_system: number;
    total_frames_mic: number;
    total_frames_mixed: number;
    dropped_frames_total: number;
    dropped_frame_rate_pct: number;
  };
  latency_ms: {
    p50: number;
    p95: number;
    max: number;
  };
  memory_mb: {
    start_rss: number;
    end_rss: number;
    growth_30m: number;
  };
  reliability: {
    deepgram_disconnects: number;
    deepgram_reconnect_attempts: number;
    deepgram_reconnect_successes: number;
    capture_stalls_gt_5s: number;
  };
  degradation: {
    network_drop_tested: boolean;
    network_drop_recovered: boolean;
    system_capture_unavailable_tested: boolean;
    mic_only_fallback_success: boolean;
  };
  privacy: {
    raw_audio_files_written: number;
  };
}

export interface FrameSink {
  onFrame: (frame: AudioFrame) => void;
  onDrop: (source: AudioSource, dropped: number) => void;
}

export interface CaptureAdapter {
  start: (sink: FrameSink) => Promise<void>;
  stop: () => Promise<void>;
}

export interface SttAdapter {
  start: () => Promise<void>;
  sendFrame: (frame: AudioFrame) => Promise<void>;
  stop: () => Promise<void>;
  onTranscript: (handler: (event: TranscriptEvent) => void) => void;
  onConnectionEvent: (
    handler: (evt: "disconnect" | "reconnect_attempt" | "reconnect_success") => void
  ) => void;
}
