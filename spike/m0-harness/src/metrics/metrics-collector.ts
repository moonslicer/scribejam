import type { AudioSource, RunMetrics } from "../types.js";

export class MetricsCollector {
  private readonly runId: string;
  private readonly startedAtMs: number;
  private readonly memoryStartMb: number;
  private frameCounts: Record<AudioSource, number> = {
    system: 0,
    mic: 0,
    mixed: 0
  };
  private droppedFramesTotal = 0;
  private latenciesMs: number[] = [];
  private deepgramDisconnects = 0;
  private deepgramReconnectAttempts = 0;
  private deepgramReconnectSuccesses = 0;
  private captureStallsGt5s = 0;
  private networkDropTested = false;
  private networkDropRecovered = false;
  private systemCaptureUnavailableTested = false;
  private micOnlyFallbackSuccess = false;

  public constructor(runId: string) {
    this.runId = runId;
    this.startedAtMs = Date.now();
    this.memoryStartMb = this.currentRssMb();
  }

  public recordFrame(source: AudioSource): void {
    this.frameCounts[source] += 1;
  }

  public recordDrop(count: number): void {
    this.droppedFramesTotal += count;
  }

  public recordLatencyMs(latencyMs: number): void {
    if (Number.isFinite(latencyMs) && latencyMs >= 0) {
      this.latenciesMs.push(latencyMs);
    }
  }

  public recordConnectionEvent(evt: "disconnect" | "reconnect_attempt" | "reconnect_success"): void {
    if (evt === "disconnect") {
      this.deepgramDisconnects += 1;
      return;
    }
    if (evt === "reconnect_attempt") {
      this.deepgramReconnectAttempts += 1;
      return;
    }
    this.deepgramReconnectSuccesses += 1;
  }

  public recordCaptureStallGt5s(): void {
    this.captureStallsGt5s += 1;
  }

  public setDegradationFlags(values: {
    networkDropTested?: boolean;
    networkDropRecovered?: boolean;
    systemCaptureUnavailableTested?: boolean;
    micOnlyFallbackSuccess?: boolean;
  }): void {
    if (typeof values.networkDropTested === "boolean") {
      this.networkDropTested = values.networkDropTested;
    }
    if (typeof values.networkDropRecovered === "boolean") {
      this.networkDropRecovered = values.networkDropRecovered;
    }
    if (typeof values.systemCaptureUnavailableTested === "boolean") {
      this.systemCaptureUnavailableTested = values.systemCaptureUnavailableTested;
    }
    if (typeof values.micOnlyFallbackSuccess === "boolean") {
      this.micOnlyFallbackSuccess = values.micOnlyFallbackSuccess;
    }
  }

  public toRunMetrics(): RunMetrics {
    const memoryEndMb = this.currentRssMb();
    const durationMin = (Date.now() - this.startedAtMs) / 60000;
    const totalFrames = this.frameCounts.system + this.frameCounts.mic + this.frameCounts.mixed;
    const droppedFrameRatePct = totalFrames === 0 ? 0 : (this.droppedFramesTotal / totalFrames) * 100;

    return {
      run_id: this.runId,
      duration_minutes: roundTo(durationMin, 3),
      frame_stats: {
        total_frames_system: this.frameCounts.system,
        total_frames_mic: this.frameCounts.mic,
        total_frames_mixed: this.frameCounts.mixed,
        dropped_frames_total: this.droppedFramesTotal,
        dropped_frame_rate_pct: roundTo(droppedFrameRatePct, 4)
      },
      latency_ms: {
        p50: percentile(this.latenciesMs, 0.5),
        p95: percentile(this.latenciesMs, 0.95),
        max: this.latenciesMs.length === 0 ? 0 : Math.max(...this.latenciesMs)
      },
      memory_mb: {
        start_rss: roundTo(this.memoryStartMb, 2),
        end_rss: roundTo(memoryEndMb, 2),
        growth_30m: roundTo(memoryEndMb - this.memoryStartMb, 2)
      },
      reliability: {
        deepgram_disconnects: this.deepgramDisconnects,
        deepgram_reconnect_attempts: this.deepgramReconnectAttempts,
        deepgram_reconnect_successes: this.deepgramReconnectSuccesses,
        capture_stalls_gt_5s: this.captureStallsGt5s
      },
      degradation: {
        network_drop_tested: this.networkDropTested,
        network_drop_recovered: this.networkDropRecovered,
        system_capture_unavailable_tested: this.systemCaptureUnavailableTested,
        mic_only_fallback_success: this.micOnlyFallbackSuccess
      },
      privacy: {
        raw_audio_files_written: 0
      }
    };
  }

  private currentRssMb(): number {
    const rssBytes = process.memoryUsage().rss;
    return rssBytes / (1024 * 1024);
  }
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) {
    return 0;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.floor((sorted.length - 1) * p)));
  return roundTo(sorted[index], 2);
}

function roundTo(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}
