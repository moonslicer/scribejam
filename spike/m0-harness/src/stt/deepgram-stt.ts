import type { AudioFrame, SttAdapter, TranscriptEvent } from "../types.js";

export class DeepgramSttAdapter implements SttAdapter {
  private transcriptHandler: ((event: TranscriptEvent) => void) | null = null;
  private connectionHandler:
    | ((evt: "disconnect" | "reconnect_attempt" | "reconnect_success") => void)
    | null = null;

  public async start(): Promise<void> {
    // Intentional bootstrap placeholder:
    // M0-04 establishes the adapter boundary and harness wiring.
    // M0 execution on target Mac wires actual Deepgram WebSocket behavior.
    this.connectionHandler?.("reconnect_success");
  }

  public async sendFrame(_frame: AudioFrame): Promise<void> {
    return;
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
}
