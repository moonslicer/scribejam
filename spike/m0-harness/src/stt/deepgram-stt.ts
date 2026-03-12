import { DeepgramClient, ListenV2Encoding } from "@deepgram/sdk";
import type { AudioFrame, SttAdapter, TranscriptEvent } from "../types.js";

// Minimal structural interface — avoids importing V2Socket from a non-exported path.
interface V2SocketLike {
  on(event: "open", handler: () => void): void;
  on(event: "close", handler: (event: { code: number }) => void): void;
  on(event: "message", handler: (msg: { type?: string; transcript?: string; event?: string }) => void): void;
  on(event: "error", handler: (err: Error) => void): void;
  sendMedia(data: ArrayBufferView): void;
  connect(): void;
  close(): void;
  waitForOpen(): Promise<unknown>;
}

export class DeepgramSttAdapter implements SttAdapter {
  private transcriptHandler: ((event: TranscriptEvent) => void) | null = null;
  private connectionHandler:
    | ((evt: "disconnect" | "reconnect_attempt" | "reconnect_success") => void)
    | null = null;
  private socket: V2SocketLike | null = null;
  private lastSendMs = 0;
  private pendingReconnect = false;
  private stopping = false;
  private readonly apiKey: string;

  public constructor() {
    const key = process.env.DEEPGRAM_API_KEY;
    if (!key) {
      throw new Error("DEEPGRAM_API_KEY environment variable is required for --stt-mode deepgram");
    }
    this.apiKey = key;
  }

  public async start(): Promise<void> {
    this.stopping = false;
    this.pendingReconnect = false;
    const client = new DeepgramClient({ apiKey: this.apiKey });
    // CustomDeepgramClient creates the socket with startClosed:true — register
    // handlers first, then call socket.connect() to initiate the connection.
    const socket = (await client.listen.v2.connect({
      model: "flux-general-en",
      encoding: ListenV2Encoding.Linear16,
      sample_rate: 16000,
      Authorization: this.apiKey  // required by type; auth actually comes from DeepgramClient({ apiKey })
    })) as unknown as V2SocketLike;

    socket.on("open", () => {
      if (this.pendingReconnect) {
        this.connectionHandler?.("reconnect_success");
        this.pendingReconnect = false;
      }
    });

    socket.on("close", () => {
      if (this.stopping) {
        return;
      }
      this.pendingReconnect = true;
      this.connectionHandler?.("disconnect");
      this.connectionHandler?.("reconnect_attempt");
    });

    socket.on("message", (msg) => {
      if (msg.type === "TurnInfo" && msg.transcript) {
        const latencyMs = this.lastSendMs > 0 ? Date.now() - this.lastSendMs : 0;
        this.transcriptHandler?.({
          tsMs: Date.now(),
          text: msg.transcript,
          latencyMs,
          isFinal: msg.event === "EndOfTurn" || msg.event === "EagerEndOfTurn"
        });
      }
    });

    socket.on("error", (err) => {
      process.stderr.write(`deepgram socket error: ${err.message}\n`);
    });

    this.socket = socket;
    socket.connect();
    await socket.waitForOpen();
  }

  public async sendFrame(frame: AudioFrame): Promise<void> {
    if (!this.socket) {
      return;
    }
    this.lastSendMs = Date.now();
    this.socket.sendMedia(frame.samples);
  }

  public async stop(): Promise<void> {
    this.stopping = true;
    this.pendingReconnect = false;
    this.socket?.close();
    this.socket = null;
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
