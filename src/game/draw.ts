import type { Color } from '../engine/color';
import type { Renderer } from '../engine/renderer';
import { drawStarfield } from './background';
import type { World } from './world';

// Overwritten each frame so the fading beam colour never allocates.
const beamColor: [number, number, number, number] = [0, 0, 0, 1];
const particleColor: [number, number, number, number] = [0, 0, 0, 1];
const flashColor: [number, number, number, number] = [1, 1, 1, 0];

export function drawWorld(r: Renderer, w: World): void {
  const { colors } = w.cfg;
  const shake = w.fx.shake;
  r.begin(colors.bg, (Math.random() * 2 - 1) * shake, (Math.random() * 2 - 1) * shake);
  drawStarfield(r, w.stars, w.cfg, w.time);

  const boss = w.boss;
  if (boss.hp > 0) r.rect(boss.x - boss.w / 2, boss.y - boss.h / 2, boss.w, boss.h, boss.flash > 0 ? colors.hitFlash : colors.boss);

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
  // Infinite invuln (stress mode) stays solid: no blink phase exists.
  const hidden = p.invuln > 0 && Number.isFinite(p.invuln) && Math.floor(p.invuln / w.cfg.player.blinkInterval) % 2 === 1;
  if (!hidden && p.hp > 0) r.rect(p.x - p.w / 2, p.y - p.h / 2, p.w, p.h, colors.player);

  const beam = w.beam;
  if (beam.time > 0) {
    const c: Color = colors.beam;
    beamColor[0] = c[0]; beamColor[1] = c[1]; beamColor[2] = c[2];
    beamColor[3] = c[3] * (beam.time / w.cfg.player.beam.duration);
    const h = w.cfg.player.beam.height;
    r.rect(beam.x, beam.y - h / 2, w.cfg.view.width - beam.x, h, beamColor);
  }

  for (let i = 0; i < w.particles.count; i++) {
    const q = w.particles.get(i);
    const c: Color = q.color;
    particleColor[0] = c[0]; particleColor[1] = c[1]; particleColor[2] = c[2];
    particleColor[3] = c[3] * (q.life / q.maxLife);
    r.rect(q.x - q.size / 2, q.y - q.size / 2, q.size, q.size, particleColor);
  }

  // Enemy fire after particles so it stays readable over everything else.
  const shots = w.enemyBullets;
  for (let i = 0; i < shots.count; i++) {
    const b = shots.get(i);
    r.rect(b.x - b.w / 2, b.y - b.h / 2, b.w, b.h, colors.enemyBullet);
  }

  if (w.fx.flash > 0) {
    flashColor[3] = Math.min(1, w.fx.flash / w.cfg.fx.flashPhase) * 0.6;
    r.rect(0, 0, w.cfg.view.width, w.cfg.view.height, flashColor);
  }

  r.end();
}
