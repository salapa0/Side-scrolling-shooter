import { clamp } from '../engine/geom';
import type { InputState } from '../engine/input';
import type { World } from './world';

export function updatePlayer(w: World, input: InputState, dt: number): void {
  const p = w.player;
  p.invuln = Math.max(0, p.invuln - dt);
  p.specialCd = Math.max(0, p.specialCd - dt);
  if (w.status !== 'playing') return;

  const cfg = w.cfg.player;
  let dx = (input.isDown('right') ? 1 : 0) - (input.isDown('left') ? 1 : 0);
  let dy = (input.isDown('down') ? 1 : 0) - (input.isDown('up') ? 1 : 0);
  if (dx !== 0 && dy !== 0) { dx *= Math.SQRT1_2; dy *= Math.SQRT1_2; }
  const { area } = cfg;
  p.x = clamp(p.x + dx * cfg.speed * dt, area.x, area.x + area.w);
  p.y = clamp(p.y + dy * cfg.speed * dt, area.y, area.y + area.h);

  p.fireTimer -= dt;
  while (p.fireTimer <= 0) {
    const b = w.playerBullets.acquire();
    if (b) {
      b.x = p.x + p.w / 2; b.y = p.y;
      b.vx = cfg.bulletSpeed; b.vy = 0;
      b.w = cfg.bulletW; b.h = cfg.bulletH;
      b.damage = w.stats.shotDamage;
    }
    p.fireTimer += 1 / cfg.fireRate;
  }
}
