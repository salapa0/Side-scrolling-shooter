import { clamp } from '../engine/geom';
import type { World } from './world';

/** Damage multiplier for playing close to the boss: ×1 at the back of the movement area, rising to player.closeBonus at the front. */
export function closeBonus(w: World): number {
  const { area, closeBonus: max } = w.cfg.player;
  if (area.w <= 0) return 1; // up/down-only mode: no forward position to reward
  return 1 + (max - 1) * clamp((w.player.x - area.x) / area.w, 0, 1);
}
