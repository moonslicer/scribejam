import net from "node:net";
import type { AudioFrame, CaptureAdapter, FrameSink } from "../types.js";

interface MicIpcCaptureOptions {
  port: number;
}

interface MicIpcFramePayload {
  seq: number;
  tsMs: number;
  samples: number[];
}

export class MicIpcCapture implements CaptureAdapter {
  private readonly port: number;
  private server: net.Server | undefined;

  public constructor(options: MicIpcCaptureOptions) {
    this.port = options.port;
  }

  public async start(sink: FrameSink): Promise<void> {
    if (this.server) {
      return;
    }
    await new Promise<void>((resolve, reject) => {
      const server = net.createServer((socket) => {
        let pending = "";
        socket.setEncoding("utf8");
        socket.on("data", (chunk) => {
          pending += chunk;
          for (;;) {
            const idx = pending.indexOf("\n");
            if (idx === -1) {
              break;
            }
            const line = pending.slice(0, idx).trim();
            pending = pending.slice(idx + 1);
            if (line.length === 0) {
              continue;
            }
            const payload = parseFramePayload(line);
            if (!payload) {
              continue;
            }
            sink.onFrame({
              source: "mic",
              seq: payload.seq,
              tsMs: payload.tsMs,
              samples: Int16Array.from(payload.samples)
            });
          }
        });
      });
      server.on("error", (error) => reject(error));
      server.listen(this.port, "127.0.0.1", () => resolve());
      this.server = server;
    });
  }

  public async stop(): Promise<void> {
    if (!this.server) {
      return;
    }
    const server = this.server;
    this.server = undefined;
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
  }
}

function parseFramePayload(line: string): MicIpcFramePayload | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(line);
  } catch {
    return null;
  }
  if (!isFramePayload(parsed)) {
    return null;
  }
  return parsed;
}

function isFramePayload(value: unknown): value is MicIpcFramePayload {
  if (!value || typeof value !== "object") {
    return false;
  }
  const maybe = value as Partial<MicIpcFramePayload>;
  if (!Number.isInteger(maybe.seq) || !Number.isFinite(maybe.tsMs)) {
    return false;
  }
  if (!Array.isArray(maybe.samples)) {
    return false;
  }
  return maybe.samples.every((sample) => Number.isFinite(sample));
}
