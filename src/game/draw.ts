import type { Color } from '../engine/color';
import type { Renderer } from '../engine/renderer';
import { drawStarfield } from './background';
import { bossDefeated } from './enemies';
import type { World } from './world';

// Overwritten each frame so the fading beam colour never allocates.
const beamColor: [number, number, number, number] = [0, 0, 0, 1];
const particleColor: [number, number, number, number] = [0, 0, 0, 1];
const flashColor: [number, number, number, number] = [1, 1, 1, 0];
const readyColor: [number, number, number, number] = [0, 0, 0, 0];
const lowHpColor: [number, number, number, number] = [0, 0, 0, 0];

/** Last-heart warning strength. Driven by world time, so it holds still while paused. */
export function lowHpAlpha(w: World): number {
  if (w.status !== 'playing' || w.player.hp !== 1) return 0;
  const { lowHpAlpha: max, lowHpPulseHz: hz } = w.cfg.fx;
  return max * (0.5 + 0.5 * Math.sin(2 * Math.PI * hz * w.time));
}

const glyphColor: [number, number, number, number] = [0, 0, 0, 0];

/** The flashing E: on while the ready slow-mo runs, toggling every blinkInterval. */
export function readyGlyphVisible(w: World): boolean {
  const s = w.fx.slowMo;
  return s > 0 && Math.floor(s / w.cfg.fx.readyGlyph.blinkInterval) % 2 === 0;
}

/** A 5×7-cell pixel E centred on screen: a spine plus top, middle and bottom bars. */
function drawReadyGlyph(r: Renderer, w: World): void {
  const { cell, alpha } = w.cfg.fx.readyGlyph;
  const c: Color = w.cfg.colors.readyFlash;
  glyphColor[0] = c[0]; glyphColor[1] = c[1]; glyphColor[2] = c[2]; glyphColor[3] = alpha;
  const x = Math.round(w.cfg.view.width / 2 - 2.5 * cell);
  const y = Math.round(w.cfg.view.height / 2 - 3.5 * cell);
  r.rect(x, y, cell, 7 * cell, glyphColor);
  r.rect(x + cell, y, 4 * cell, cell, glyphColor);
  r.rect(x + cell, y + 3 * cell, 3 * cell, cell, glyphColor);
  r.rect(x + cell, y + 6 * cell, 4 * cell, cell, glyphColor);
}

/** Killing-shot freeze: stark two-tone frame, only the boss, the beam and the ship. */
function drawImpactFrame(r: Renderer, w: World): void {
  const { colors, player: pc } = w.cfg;
  const { boss, beam, player: p } = w;
  r.begin(colors.impactBg, 0, 0);
  r.rect(boss.x - boss.w / 2, boss.y - boss.h / 2, boss.w, boss.h, colors.impactInk);
  r.rect(beam.x, beam.y - pc.beam.height / 2, w.cfg.view.width - beam.x, pc.beam.height, colors.impactInk);
  r.rect(p.x - p.w / 2, p.y - p.h / 2, p.w, p.h, colors.impactInk);
  r.end();
}

export function drawWorld(r: Renderer, w: World): void {
  if (w.fx.impact > 0) {
    drawImpactFrame(r, w);
    return;
  }
  const { colors } = w.cfg;
  const shake = w.fx.shake;
  r.begin(colors.bg, (Math.random() * 2 - 1) * shake, (Math.random() * 2 - 1) * shake);
  drawStarfield(r, w.stars, w.cfg, w.time);

  const boss = w.boss;
  if (!bossDefeated(boss, w.cfg.boss.phases.length)) r.rect(boss.x - boss.w / 2, boss.y - boss.h / 2, boss.w, boss.h, boss.flash > 0 ? colors.hitFlash : colors.boss);

  for (let i = 0; i < w.drones.count; i++) {
    const d = w.drones.get(i);
    r.rect(d.x - d.w / 2, d.y - d.h / 2, d.w, d.h, d.flash > 0 ? colors.hitFlash : colors.drone);
  }

  const pu = w.cfg.powerUps;
  for (let i = 0; i < w.powerUps.count; i++) {
    const u = w.powerUps.get(i);
    // Blinking white outline so pickups read as rewards, not threats.
    if (Math.floor(u.age / pu.blinkInterval) % 2 === 0) r.rect(u.x - u.w / 2 - 1, u.y - u.h / 2 - 1, u.w + 2, u.h + 2, colors.hitFlash);
    r.rect(u.x - u.w / 2, u.y - u.h / 2, u.w, u.h, colors.powerUp[u.kind]);
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

  // E-ready tint goes under enemy fire, so the flash never hides a bullet.
  if (w.fx.readyFlash > 0) {
    const c: Color = colors.readyFlash;
    readyColor[0] = c[0]; readyColor[1] = c[1]; readyColor[2] = c[2];
    readyColor[3] = w.cfg.fx.readyFlashAlpha * (w.fx.readyFlash / w.cfg.fx.readyFlashTime);
    r.rect(0, 0, w.cfg.view.width, w.cfg.view.height, readyColor);
  }
  if (readyGlyphVisible(w)) drawReadyGlyph(r, w);

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

  const warn = lowHpAlpha(w);
  if (warn > 0) {
    const c: Color = colors.lowHp;
    lowHpColor[0] = c[0]; lowHpColor[1] = c[1]; lowHpColor[2] = c[2]; lowHpColor[3] = warn;
    const { width, height } = w.cfg.view;
    const e = w.cfg.fx.lowHpEdge;
    r.rect(0, 0, width, e, lowHpColor);
    r.rect(0, height - e, width, e, lowHpColor);
    r.rect(0, e, e, height - 2 * e, lowHpColor);
    r.rect(width - e, e, e, height - 2 * e, lowHpColor);
  }

  r.end();
}
