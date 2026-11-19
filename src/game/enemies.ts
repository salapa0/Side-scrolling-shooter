import type { Boss, World } from './world';

// Off-screen culling distance for drones, not a gameplay value.
const DRONE_MARGIN = 16;
const TAU = Math.PI * 2;

/** The fight is won only when the final stage's bar is empty and no refill is under way. */
export function bossDefeated(b: Boss, stages: number): boolean {
  return b.phase === stages && b.hp <= 0 && b.charge <= 0;
}

/**
 * Damages the current stage. An emptied stage hands over to the next one, whose bar refills over
 * chargeTime; leftover damage is lost. Returns false (nothing changes) while refilling or once defeated.
 */
export function damageBoss(w: World, amount: number, x = w.boss.x, y = w.boss.y): boolean {
  const b = w.boss;
  const stages = w.cfg.boss.phases.length;
  if (b.charge > 0 || bossDefeated(b, stages)) return false;
  b.hp = Math.max(0, b.hp - amount);
  w.events.push({ type: 'bossHit', x, y });
  if (b.hp === 0 && b.phase < stages) {
    b.phase = (b.phase + 1) as 2 | 3;
    b.charge = w.cfg.boss.chargeTime;
    if (b.charge <= 0) b.hp = b.maxHp; // chargeTime 0 = no pause, but the new stage must still start full
    w.events.push({ type: 'phaseChanged', phase: b.phase, x: b.x, y: b.y });
  }
  return true;
}

export function fireBullet(w: World, x: number, y: number, angle: number, speed: number): void {
  const b = w.enemyBullets.acquire();
  if (!b) return;
  b.x = x; b.y = y;
  b.w = w.cfg.enemyBullet.w; b.h = w.cfg.enemyBullet.h;
  b.vx = Math.cos(angle) * speed; b.vy = Math.sin(angle) * speed;
  b.damage = 1;
}

function spawnDroneWave(w: World, count: number): void {
  const { drone } = w.cfg;
  const b = w.boss;
  for (let i = 0; i < count; i++) {
    const d = w.drones.acquire();
    if (!d) return;
    const y = b.y + (i - (count - 1) / 2) * drone.waveSpacing;
    d.x = b.x - b.w / 2; d.y = y; d.baseY = y;
    d.w = drone.w; d.h = drone.h; d.vx = 0; d.vy = 0;
    d.hp = drone.hp; d.age = 0; d.flash = 0;
    d.fireTimer = w.rng() * drone.fireInterval;
  }
}

export function updateBoss(w: World, dt: number): void {
  const b = w.boss;
  b.flash = Math.max(0, b.flash - dt);
  const cfg = w.cfg.boss;
  if (w.status !== 'playing' || bossDefeated(b, cfg.phases.length)) return;
  const p = cfg.phases[b.phase - 1];

  b.age += dt;
  const step = cfg.moveSpeed * dt;
  b.x += Math.max(-step, Math.min(step, p.x - b.x));
  b.y = cfg.centerY + Math.sin(b.age * p.bobSpeed * TAU) * p.bobAmp;

  // The new stage's bar fills up; no new attacks until it is full (a short breather).
  if (b.charge > 0) {
    b.charge = Math.max(0, b.charge - dt);
    b.hp = b.maxHp * (1 - b.charge / cfg.chargeTime);
    return;
  }

  // Interval <= 0 turns a pattern off (like spread and spiral) instead of looping forever.
  if (p.droneInterval > 0) {
    b.droneTimer -= dt;
    while (b.droneTimer <= 0) {
      spawnDroneWave(w, p.droneWave);
      b.droneTimer += p.droneInterval;
    }
  }

  if (p.spreadInterval > 0) {
    b.spreadTimer -= dt;
    while (b.spreadTimer <= 0) {
      const n = p.spreadCount;
      const aim = Math.atan2(w.player.y - b.y, w.player.x - (b.x - b.w / 2));
      for (let i = 0; i < n; i++) {
        const angle = n > 1 ? aim + (i / (n - 1) - 0.5) * p.spreadArc : aim;
        fireBullet(w, b.x - b.w / 2, b.y, angle, cfg.bulletSpeed);
      }
      b.spreadTimer += p.spreadInterval;
    }
  }

  if (p.spiralInterval > 0) {
    b.spiralTimer -= dt;
    while (b.spiralTimer <= 0) {
      fireBullet(w, b.x, b.y, b.spiralAngle, cfg.bulletSpeed);
      fireBullet(w, b.x, b.y, b.spiralAngle + Math.PI, cfg.bulletSpeed);
      b.spiralAngle += cfg.spiralTurn;
      b.spiralTimer += p.spiralInterval;
    }
  }
}

export function updateDrones(w: World, dt: number): void {
  const cfg = w.cfg.drone;
  const playing = w.status === 'playing';
  for (let i = w.drones.count - 1; i >= 0; i--) {
    const d = w.drones.get(i);
    d.age += dt;
    d.flash = Math.max(0, d.flash - dt);
    d.x -= cfg.speed * dt;
    d.y = d.baseY + Math.sin(d.age * cfg.wobbleFreq * TAU) * cfg.wobbleAmp;
    if (d.x < -DRONE_MARGIN) {
      w.drones.releaseAt(i);
      continue;
    }
    if (!playing) continue;
    if (cfg.fireInterval <= 0) continue;
    d.fireTimer -= dt;
    while (d.fireTimer <= 0) {
      fireBullet(w, d.x, d.y, Math.atan2(w.player.y - d.y, w.player.x - d.x), cfg.bulletSpeed);
      d.fireTimer += cfg.fireInterval;
    }
  }
}
