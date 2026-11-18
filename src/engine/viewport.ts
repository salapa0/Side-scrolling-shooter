/** Where the scaled frame lands on the canvas, in device pixels; x, y measured from the top-left. */
export interface Viewport {
  x: number;
  y: number;
  width: number;
  height: number;
  scale: number;
}

export function computeViewport(canvasW: number, canvasH: number, baseW: number, baseH: number): Viewport {
  const fit = Math.min(canvasW / baseW, canvasH / baseH);
  // Whole-number scale keeps every pixel the same size; below 1x, shrinking beats cropping.
  const scale = fit >= 1 ? Math.floor(fit) : fit;
  const width = Math.round(baseW * scale);
  const height = Math.round(baseH * scale);
  return { x: Math.floor((canvasW - width) / 2), y: Math.floor((canvasH - height) / 2), width, height, scale };
}
