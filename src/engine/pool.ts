/** Fixed-capacity pool: all objects are created up front so hot loops never allocate. */
export class Pool<T> {
  count = 0;
  readonly capacity: number;
  private readonly items: T[];

  constructor(capacity: number, create: () => T) {
    this.capacity = capacity;
    this.items = [];
    for (let i = 0; i < capacity; i++) this.items.push(create());
  }

  acquire(): T | null {
    if (this.count >= this.capacity) return null;
    return this.items[this.count++];
  }

  /** Swap-remove: the last active item moves into slot i, so iterate backwards when releasing. */
  releaseAt(i: number): void {
    const last = --this.count;
    const released = this.items[i];
    this.items[i] = this.items[last];
    this.items[last] = released;
  }

  /** Only valid for i < count. */
  get(i: number): T {
    return this.items[i];
  }

  clear(): void {
    this.count = 0;
  }
}
