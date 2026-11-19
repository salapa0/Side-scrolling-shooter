import { clamp } from '../engine/geom';
import type { InputState } from '../engine/input';
import { closeBonus } from './bonus';
import { fireBeam, readySpecial } from './combat';
import type { World } from './world';

export function updatePlayer(w: World, input: InputState, dt: number): void {
  const p = w.player;
  p.invuln = Math.max(0, p.invuln - dt);
  p.rapid = Math.max(0, p.rapid - dt);
  // Crossing zero while playing announces E is ready; at round start E is already ready, so nothing fires.
  if (p.specialCd > 0 && p.specialCd - dt <= 0 && w.status === 'playing') readySpecial(w);
  else p.specialCd = Math.max(0, p.specialCd - dt);
  w.beam.time = Math.max(0, w.beam.time - dt);
  if (w.status !== 'playing') return;

  const cfg = w.cfg.player;
  let dx = (input.isDown('right') ? 1 : 0) - (input.isDown('left') ? 1 : 0);
  let dy = (input.isDown('down') ? 1 : 0) - (input.isDown('up') ? 1 : 0);
  if (dx !== 0 && dy !== 0) { dx *= Math.SQRT1_2; dy *= Math.SQRT1_2; }
  const { area } = cfg;
  p.x = clamp(p.x + dx * cfg.speed * dt, area.x, area.x + area.w);
  p.y = clamp(p.y + dy * cfg.speed * dt, area.y, area.y + area.h);

  const fireRate = cfg.fireRate * (p.rapid > 0 ? cfg.rapidMultiplier : 1);
  p.fireTimer -= dt;
  while (p.fireTimer <= 0) {
    const b = w.playerBullets.acquire();
    if (b) {
      b.x = p.x + p.w / 2; b.y = p.y;
      b.vx = cfg.bulletSpeed; b.vy = 0;
      b.w = cfg.bulletW; b.h = cfg.bulletH;
      b.damage = w.stats.shotDamage * closeBonus(w);
    }
    p.fireTimer += 1 / fireRate;
  }

  // consume() runs even on cooldown so early presses are never buffered.
  if (input.consume('special') && p.specialCd <= 0) {
    fireBeam(w);
    p.specialCd = w.stats.specialCooldown;
  }
}
