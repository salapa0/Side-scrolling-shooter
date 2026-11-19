import type { Config } from '../config';
import type { Color } from '../engine/color';
import type { World } from './world';

function burst(w: World, x: number, y: number, count: number, color: Color): void {
  const { particleLife, particleSpeed, particleSize } = w.cfg.fx;
  for (let i = 0; i < count; i++) {
    const p = w.particles.acquire();
    if (!p) return; // pool full: skip silently
    const a = w.rng() * Math.PI * 2;
    const speed = particleSpeed[0] + w.rng() * (particleSpeed[1] - particleSpeed[0]);
    p.x = x; p.y = y; p.vx = Math.cos(a) * speed; p.vy = Math.sin(a) * speed;
    p.life = p.maxLife = particleLife[0] + w.rng() * (particleLife[1] - particleLife[0]);
    p.size = particleSize[0] + w.rng() * (particleSize[1] - particleSize[0]);
    p.color = color;
  }
}

/** Simulation speed for a given slow-mo time left: held at slowMoScale, then a linear ramp back to 1. */
export function timeScaleFor(slowMo: number, fx: Config['fx']): number {
  if (slowMo <= 0) return 1;
  if (slowMo >= fx.slowMoRamp) return fx.slowMoScale;
  return fx.slowMoScale + (1 - fx.slowMoScale) * (1 - slowMo / fx.slowMoRamp);
}

export function updateEffects(w: World, dt: number): void {
  const { fx, colors } = w.cfg;
  const f = w.fx;
  for (const e of w.events) {
    switch (e.type) {
      case 'droneKilled':
        burst(w, e.x, e.y, fx.droneBurst, colors.droneBurst);
        f.shake = Math.max(f.shake, fx.shakeDrone);
        break;
      case 'bossHit':
        burst(w, e.x, e.y, fx.hitSparks, colors.hitFlash);
        w.boss.flash = fx.hitFlash;
        break;
      case 'playerHit':
        f.hitStop = Math.max(f.hitStop, fx.hitStopPlayerHit);
        f.shake = Math.max(f.shake, fx.shakePlayerHit);
        f.flash = Math.max(f.flash, fx.flashPlayerHit);
        break;
      case 'phaseChanged':
        f.hitStop = Math.max(f.hitStop, fx.hitStopPhase);
        f.shake = Math.max(f.shake, fx.shakePhase);
        f.flash = Math.max(f.flash, fx.flashPhase);
        burst(w, w.boss.x, w.boss.y, fx.phaseBurst, colors.bossBurst);
        break;
      case 'specialReady':
        f.readyFlash = fx.readyFlashTime;
        f.slowMo = fx.slowMoHold + fx.slowMoRamp;
        break;
      case 'powerUpCollected':
        burst(w, e.x, e.y, fx.powerUpBurst, colors.powerUp[e.kind]);
        break;
      case 'beamFired':
        f.shake = Math.max(f.shake, fx.shakeBeam);
        break;
      case 'bossKilled':
        burst(w, e.x, e.y, fx.bossBurst, colors.bossBurst);
        f.shake = Math.max(f.shake, fx.shakeBossKilled);
        f.flash = Math.max(f.flash, fx.flashBossKilled);
        break;
      case 'playerKilled':
        burst(w, e.x, e.y, fx.playerBurst, colors.playerBurst);
        f.shake = Math.max(f.shake, fx.shakePlayerHit);
        break;
    }
  }

  const drag = Math.exp(-fx.particleDrag * dt);
  for (let i = w.particles.count - 1; i >= 0; i--) {
    const p = w.particles.get(i);
    p.life -= dt;
    if (p.life <= 0) { w.particles.releaseAt(i); continue; }
    p.x += p.vx * dt; p.y += p.vy * dt;
    p.vx *= drag; p.vy *= drag;
  }
  f.shake *= Math.exp(-fx.shakeDecay * dt);
  f.flash = Math.max(0, f.flash - dt);
}
