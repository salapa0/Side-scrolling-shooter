import type { World } from './world';

// Off-screen culling distance for drones, not a gameplay value.
const DRONE_MARGIN = 16;
const TAU = Math.PI * 2;

export function phaseFor(hpFrac: number, thresholds: readonly number[]): 1 | 2 | 3 {
  if (hpFrac < thresholds[1]) return 3;
  if (hpFrac <= thresholds[0]) return 2;
  return 1;
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
  if (w.status !== 'playing' || b.hp <= 0) return;
  const cfg = w.cfg.boss;

  const phase = Math.max(b.phase, phaseFor(b.hp / b.maxHp, cfg.phaseThresholds)) as 1 | 2 | 3;
  if (phase !== b.phase) {
    b.phase = phase;
    if (phase !== 1) w.events.push({ type: 'phaseChanged', phase, x: b.x, y: b.y });
  }
  const p = cfg.phases[b.phase - 1];

  b.age += dt;
  const step = cfg.moveSpeed * dt;
  b.x += Math.max(-step, Math.min(step, p.x - b.x));
  b.y = cfg.centerY + Math.sin(b.age * p.bobSpeed * TAU) * p.bobAmp;

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
