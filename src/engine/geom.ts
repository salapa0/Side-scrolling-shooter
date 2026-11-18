/** Centre-based box: x, y is the centre, w, h the full size. */
export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Boxes that only touch do not overlap. */
export function overlaps(a: Box, b: Box): boolean {
  return Math.abs(a.x - b.x) * 2 < a.w + b.w && Math.abs(a.y - b.y) * 2 < a.h + b.h;
}

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}
