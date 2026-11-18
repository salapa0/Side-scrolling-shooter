import { clamp, type Box } from './geom';

export interface Stamped {
  stamp: number;
}

/** Uniform grid for broad-phase collision. Rebuild each step with clear() + insert(). */
export class SpatialGrid<T extends Box & Stamped> {
  private readonly cols: number;
  private readonly rows: number;
  private readonly cells: T[][] = [];
  private queryId = 0;

  constructor(width: number, height: number, private readonly cellSize: number) {
    this.cols = Math.ceil(width / cellSize);
    this.rows = Math.ceil(height / cellSize);
    for (let i = 0; i < this.cols * this.rows; i++) this.cells.push([]);
  }

  clear(): void {
    for (let i = 0; i < this.cells.length; i++) this.cells[i].length = 0;
  }

  insert(item: T): void {
    const c0 = this.col(item.x - item.w / 2);
    const c1 = this.col(item.x + item.w / 2);
    const r0 = this.row(item.y - item.h / 2);
    const r1 = this.row(item.y + item.h / 2);
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) this.cells[r * this.cols + c].push(item);
    }
  }

  /** Empties `out`, then fills it with unique candidates from every cell the box touches. */
  query(box: Box, out: T[]): T[] {
    out.length = 0;
    const id = ++this.queryId;
    const c0 = this.col(box.x - box.w / 2);
    const c1 = this.col(box.x + box.w / 2);
    const r0 = this.row(box.y - box.h / 2);
    const r1 = this.row(box.y + box.h / 2);
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        const cell = this.cells[r * this.cols + c];
        for (let i = 0; i < cell.length; i++) {
          const item = cell[i];
          if (item.stamp === id) continue;
          item.stamp = id;
          out.push(item);
        }
      }
    }
    return out;
  }

  private col(x: number): number {
    return clamp(Math.floor(x / this.cellSize), 0, this.cols - 1);
  }

  private row(y: number): number {
    return clamp(Math.floor(y / this.cellSize), 0, this.rows - 1);
  }
}
