import type { AudioFrame, SttAdapter, TranscriptEvent } from "../types.js";

export class MockSttAdapter implements SttAdapter {
  private transcriptHandler: ((event: TranscriptEvent) => void) | null = null;
  private connectionHandler:
    | ((evt: "disconnect" | "reconnect_attempt" | "reconnect_success") => void)
    | null = null;
  private framesSeen = 0;
  private disconnected = false;

  public async start(): Promise<void> {
    return;
  }

  public async sendFrame(frame: AudioFrame): Promise<void> {
    if (this.disconnected) {
      return;
    }
    this.framesSeen += 1;
    if (this.framesSeen % 15 !== 0) {
      return;
    }
    const latencyMs = randomInt(200, 1000);
    setTimeout(() => {
      if (!this.transcriptHandler) {
        return;
      }
      this.transcriptHandler({
        tsMs: frame.tsMs + latencyMs,
        text: "mock transcript token",
        latencyMs,
        isFinal: true
      });
    }, latencyMs);
  }

  public async stop(): Promise<void> {
    return;
  }

  public onTranscript(handler: (event: TranscriptEvent) => void): void {
    this.transcriptHandler = handler;
  }

  public onConnectionEvent(
    handler: (evt: "disconnect" | "reconnect_attempt" | "reconnect_success") => void
  ): void {
    this.connectionHandler = handler;
  }

  public simulateDisconnectAndRecovery(): void {
    this.disconnected = true;
    this.connectionHandler?.("disconnect");
    this.connectionHandler?.("reconnect_attempt");
    setTimeout(() => {
      this.disconnected = false;
      this.connectionHandler?.("reconnect_success");
    }, 1200);
  }
}

function randomInt(min: number, max: number): number {
  const lo = Math.ceil(min);
  const hi = Math.floor(max);
  return Math.floor(Math.random() * (hi - lo + 1)) + lo;
}
