import type { Config } from '../config';
import type { Renderer } from '../engine/renderer';
import type { Rng } from '../engine/rng';

export interface Starfield { x: Float32Array; y: Float32Array; layer: Uint8Array }

export function createStarfield(rng: Rng, cfg: Config): Starfield {
  const total = cfg.stars.reduce((n, l) => n + l.count, 0);
  const s: Starfield = { x: new Float32Array(total), y: new Float32Array(total), layer: new Uint8Array(total) };
  let i = 0;
  cfg.stars.forEach((l, layer) => {
    for (let n = 0; n < l.count; n++, i++) {
      s.x[i] = rng() * cfg.view.width; s.y[i] = rng() * cfg.view.height; s.layer[i] = layer;
    }
  });
  return s;
}

/** Position is a pure function of time, so scrolling needs no per-frame state. */
export function drawStarfield(r: Renderer, s: Starfield, cfg: Config, time: number): void {
  const width = cfg.view.width;
  for (let i = 0; i < s.x.length; i++) {
    const l = cfg.stars[s.layer[i]];
    const x = (((s.x[i] - time * l.speed) % width) + width) % width;
    r.rect(x, s.y[i], l.size, l.size, l.color);
  }
}
