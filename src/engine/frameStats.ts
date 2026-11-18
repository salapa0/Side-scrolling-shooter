const WINDOW = 60;

export class FrameStats {
  private readonly frames = new Float64Array(WINDOW);
  private next = 0;
  private count = 0;

  record(frameMs: number): void {
    this.frames[this.next] = frameMs;
    this.next = (this.next + 1) % WINDOW;
    if (this.count < WINDOW) this.count++;
  }

  get avgMs(): number {
    if (this.count === 0) return 0;
    let sum = 0;
    for (let i = 0; i < this.count; i++) sum += this.frames[i];
    return sum / this.count;
  }

  get fps(): number {
    const avg = this.avgMs;
    return avg > 0 ? 1000 / avg : 0;
  }

  get maxMs(): number {
    let max = 0;
    for (let i = 0; i < this.count; i++) if (this.frames[i] > max) max = this.frames[i];
    return max;
  }
}
