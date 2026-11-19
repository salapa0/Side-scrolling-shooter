import { clamp } from '../engine/geom';
import { POWER_UP_KINDS, type PowerUpKind, type World } from './world';

const TAU = Math.PI * 2;

/** A kind is only offered when it would do something right now. */
function eligible(w: World, kind: PowerUpKind): boolean {
  switch (kind) {
    case 'health': return w.player.hp < w.cfg.player.hp;
    case 'charge': return w.player.specialCd > 0;
    default: return true;
  }
}

/** Weighted pick among eligible kinds; roll is in [0, 1). Rapid and Clear are always eligible. */
export function choosePowerUpKind(w: World, roll: number): PowerUpKind {
  const weights = w.cfg.powerUps.weights;
  let total = 0;
  for (let i = 0; i < POWER_UP_KINDS.length; i++) {
    const k = POWER_UP_KINDS[i];
    if (eligible(w, k)) total += weights[k];
  }
  const target = roll * total;
  let cumulative = 0;
  let last: PowerUpKind = 'clear';
  for (let i = 0; i < POWER_UP_KINDS.length; i++) {
    const k = POWER_UP_KINDS[i];
    if (!eligible(w, k)) continue;
    cumulative += weights[k];
    last = k;
    if (target < cumulative) return k;
  }
  return last;
}

/** Rolls the drop chance; a hit places a power-up at x, inside the ship's vertical reach. */
export function maybeDropPowerUp(w: World, x: number, y: number): void {
  const cfg = w.cfg.powerUps;
  if (w.rng() >= cfg.dropChance) return;
  const u = w.powerUps.acquire();
  if (!u) return;
  const { area } = w.cfg.player;
  u.x = x;
  u.y = u.baseY = clamp(y, area.y, area.y + area.h);
  u.w = u.h = cfg.size;
  u.age = 0;
  u.kind = choosePowerUpKind(w, w.rng());
}

export function updatePowerUps(w: World, dt: number): void {
  const cfg = w.cfg.powerUps;
  const p = w.player;
  for (let i = w.powerUps.count - 1; i >= 0; i--) {
    const u = w.powerUps.get(i);
    u.age += dt;
    const bob = Math.sin(u.age * cfg.bobFreq * TAU) * cfg.bobAmp;
    const dx = p.x - u.x, dy = p.y - u.y;
    const dist = Math.hypot(dx, dy);
    if (dist < cfg.magnetRadius) {
      const step = Math.min(dist, cfg.magnetSpeed * dt);
      if (dist > 0) { u.x += (dx / dist) * step; u.y += (dy / dist) * step; }
      u.baseY = u.y - bob; // drifting resumes from here, without a jump, if the ship moves away
    } else {
      u.x -= cfg.driftSpeed * dt;
      u.y = u.baseY + bob;
    }
    if (u.x < -cfg.size) w.powerUps.releaseAt(i);
  }
}
