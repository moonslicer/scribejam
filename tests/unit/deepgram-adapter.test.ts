import { describe, expect, it } from 'vitest';
import { DeepgramAdapter, type DeepgramSocketLike } from '../../src/main/stt/deepgram-adapter';

class FakeSocket implements DeepgramSocketLike {
  private readonly handlers: {
    open: Array<() => void>;
    close: Array<(event: { code?: number }) => void>;
    message: Array<(message: unknown) => void>;
    error: Array<(error: Error) => void>;
  } = {
    open: [],
    close: [],
    message: [],
    error: []
  };

  public on(event: 'open', handler: () => void): void;
  public on(event: 'close', handler: (event: { code?: number }) => void): void;
  public on(event: 'message', handler: (message: unknown) => void): void;
  public on(event: 'error', handler: (error: Error) => void): void;
  public on(
    event: 'open' | 'close' | 'message' | 'error',
    handler: (() => void) | ((event: { code?: number }) => void) | ((message: unknown) => void) | ((error: Error) => void)
  ): void {
    if (event === 'open') {
      this.handlers.open.push(handler as () => void);
      return;
    }
    if (event === 'close') {
      this.handlers.close.push(handler as (event: { code?: number }) => void);
      return;
    }
    if (event === 'message') {
      this.handlers.message.push(handler as (message: unknown) => void);
      return;
    }
    this.handlers.error.push(handler as (error: Error) => void);
  }

  public connect(): void {
    this.emit('open');
  }

  public waitForOpen(): Promise<void> {
    return Promise.resolve();
  }

  public sendMedia(): void {
    // no-op
  }

  public close(): void {
    this.emit('close', { code: 1006 });
  }

  public emit(event: 'open' | 'close' | 'message' | 'error', payload?: unknown): void {
    if (event === 'open') {
      for (const listener of this.handlers.open) {
        listener();
      }
      return;
    }
    if (event === 'close') {
      for (const listener of this.handlers.close) {
        listener((payload as { code?: number }) ?? {});
      }
      return;
    }
    if (event === 'message') {
      for (const listener of this.handlers.message) {
        listener(payload);
      }
      return;
    }
    for (const listener of this.handlers.error) {
      listener((payload as Error) ?? new Error('test error'));
    }
  }
}

describe('DeepgramAdapter', () => {
  it('reconnects with bounded retry and emits lifecycle events', async () => {
    const timers: Array<() => void> = [];
    const sockets: FakeSocket[] = [];
    const events: string[] = [];

    const adapter = new DeepgramAdapter({
      getApiKey: () => 'dg-key',
      socketFactory: async () => {
        const socket = new FakeSocket();
        sockets.push(socket);
        return socket;
      },
      setTimeoutFn: (handler) => {
        timers.push(handler);
        return timers.length as unknown as NodeJS.Timeout;
      },
      clearTimeoutFn: () => {
        // no-op
      }
    });

    adapter.onConnectionEvent((event) => events.push(event));
    adapter.onTranscript(() => {
      // no-op
    });

    await adapter.start();
    expect(sockets.length).toBe(1);

    sockets[0]?.close();
    expect(events).toEqual(['disconnect', 'reconnect_attempt']);

    const reconnect = timers.shift();
    reconnect?.();
    await Promise.resolve();
    await Promise.resolve();

    expect(sockets.length).toBe(2);
    expect(events).toContain('reconnect_success');
  });

  it('reports reconnect_failed after max retries', async () => {
    const timers: Array<() => void> = [];
    const events: string[] = [];
    let connectCount = 0;

    const adapter = new DeepgramAdapter({
      getApiKey: () => 'dg-key',
      maxReconnectAttempts: 1,
      socketFactory: async () => {
        connectCount += 1;
        if (connectCount === 1) {
          return new FakeSocket();
        }
        throw new Error('connect failed');
      },
      setTimeoutFn: (handler) => {
        timers.push(handler);
        return timers.length as unknown as NodeJS.Timeout;
      },
      clearTimeoutFn: () => {
        // no-op
      }
    });

    adapter.onConnectionEvent((event) => events.push(event));
    adapter.onTranscript(() => {
      // no-op
    });

    await adapter.start();
    adapter.simulateDisconnect();

    const retry = timers.shift();
    retry?.();
    await Promise.resolve();
    await Promise.resolve();

    expect(events).toContain('reconnect_failed');
  });

  it('validates keys via Deepgram API endpoint', async () => {
    const adapter = new DeepgramAdapter({
      getApiKey: () => 'unused',
      fetchFn: async () =>
        ({
          ok: true,
          status: 200
        }) as Response,
      socketFactory: async () => new FakeSocket()
    });

    await expect(adapter.validateKey('abc')).resolves.toEqual({ valid: true });
  });
});
