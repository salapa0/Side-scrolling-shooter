import type { Renderer } from '../engine/renderer';
import type { World } from './world';

export function drawWorld(r: Renderer, w: World): void {
  const { colors } = w.cfg;
  r.begin(colors.bg);

  const bullets = w.playerBullets;
  for (let i = 0; i < bullets.count; i++) {
    const b = bullets.get(i);
    r.rect(b.x - b.w / 2, b.y - b.h / 2, b.w, b.h, colors.playerBullet);
  }

  const p = w.player;
  // Blink while invulnerable: hidden on alternate intervals.
  const hidden = p.invuln > 0 && Math.floor(p.invuln / w.cfg.player.blinkInterval) % 2 === 1;
  if (!hidden) r.rect(p.x - p.w / 2, p.y - p.h / 2, p.w, p.h, colors.player);

  r.end();
}
