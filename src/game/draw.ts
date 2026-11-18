import type { Color } from '../engine/color';
import type { Renderer } from '../engine/renderer';
import type { World } from './world';

// Overwritten each frame so the fading beam colour never allocates.
const beamColor: [number, number, number, number] = [0, 0, 0, 1];

export function drawWorld(r: Renderer, w: World): void {
  const { colors } = w.cfg;
  r.begin(colors.bg);

  const boss = w.boss;
  r.rect(boss.x - boss.w / 2, boss.y - boss.h / 2, boss.w, boss.h, boss.flash > 0 ? colors.hitFlash : colors.boss);

  for (let i = 0; i < w.drones.count; i++) {
    const d = w.drones.get(i);
    r.rect(d.x - d.w / 2, d.y - d.h / 2, d.w, d.h, d.flash > 0 ? colors.hitFlash : colors.drone);
  }

  const bullets = w.playerBullets;
  for (let i = 0; i < bullets.count; i++) {
    const b = bullets.get(i);
    r.rect(b.x - b.w / 2, b.y - b.h / 2, b.w, b.h, colors.playerBullet);
  }

  const p = w.player;
  // Blink while invulnerable: hidden on alternate intervals.
  const hidden = p.invuln > 0 && Math.floor(p.invuln / w.cfg.player.blinkInterval) % 2 === 1;
  if (!hidden) r.rect(p.x - p.w / 2, p.y - p.h / 2, p.w, p.h, colors.player);

  const beam = w.beam;
  if (beam.time > 0) {
    const c: Color = colors.beam;
    beamColor[0] = c[0]; beamColor[1] = c[1]; beamColor[2] = c[2];
    beamColor[3] = c[3] * (beam.time / w.cfg.player.beam.duration);
    const h = w.cfg.player.beam.height;
    r.rect(beam.x, beam.y - h / 2, w.cfg.view.width - beam.x, h, beamColor);
  }

  // Enemy fire last so it stays readable over everything else.
  const shots = w.enemyBullets;
  for (let i = 0; i < shots.count; i++) {
    const b = shots.get(i);
    r.rect(b.x - b.w / 2, b.y - b.h / 2, b.w, b.h, colors.enemyBullet);
  }

  r.end();
}
