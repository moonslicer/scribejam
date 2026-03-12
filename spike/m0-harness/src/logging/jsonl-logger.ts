import fs from "node:fs";
import path from "node:path";
import type { EventRecord } from "../types.js";

export class JsonlLogger {
  private readonly stream: fs.WriteStream;

  public constructor(filePath: string) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    this.stream = fs.createWriteStream(filePath, { flags: "w", encoding: "utf8" });
  }

  public write(event: EventRecord): void {
    this.stream.write(`${JSON.stringify(event)}\n`);
  }

  public close(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.stream.end(() => resolve());
      this.stream.on("error", (error) => reject(error));
    });
  }
}
