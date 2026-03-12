export class RingBuffer<T> {
  private readonly capacity: number;
  private readonly items: T[];

  public constructor(capacity: number) {
    if (!Number.isFinite(capacity) || capacity <= 0) {
      throw new Error(`RingBuffer capacity must be > 0, got ${capacity}`);
    }

    this.capacity = Math.floor(capacity);
    this.items = [];
  }

  public push(item: T): T | undefined {
    if (this.items.length >= this.capacity) {
      const dropped = this.items.shift();
      this.items.push(item);
      return dropped;
    }

    this.items.push(item);
    return undefined;
  }

  public shift(): T | undefined {
    return this.items.shift();
  }

  public clear(): void {
    this.items.length = 0;
  }

  public get size(): number {
    return this.items.length;
  }
}
