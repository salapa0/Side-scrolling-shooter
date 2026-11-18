export type Color = readonly [r: number, g: number, b: number, a: number];

/** Parse '#rrggbb' into 0-1 channels. */
export function rgb(hex: string, alpha = 1): Color {
  const n = parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255, alpha];
}
