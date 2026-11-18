import { overlaps, type Box } from '../engine/geom';
import type { Drone, World } from './world';

// Reused every call so combat never allocates in the step loop.
const candidates: Drone[] = [];
const beamBox: Box = { x: 0, y: 0, w: 0, h: 0 };

function hurtPlayer(w: World): void {
  const p = w.player;
  p.hp -= 1;
  p.invuln = w.cfg.player.invulnTime;
  w.events.push({ type: 'playerHit', x: p.x, y: p.y });
  if (p.hp <= 0) w.events.push({ type: 'playerKilled', x: p.x, y: p.y });
}

function killDrone(w: World, i: number): void {
  const d = w.drones.get(i);
  w.events.push({ type: 'droneKilled', x: d.x, y: d.y });
  w.kills += 1;
  w.drones.releaseAt(i);
}

export function resolveCombat(w: World): void {
  if (w.status !== 'playing') return;

  w.grid.clear();
  for (let i = 0; i < w.drones.count; i++) w.grid.insert(w.drones.get(i));

  // Each bullet hits at most one target: drones first, then the boss.
  const bullets = w.playerBullets;
  for (let i = bullets.count - 1; i >= 0; i--) {
    const b = bullets.get(i);
    w.grid.query(b, candidates);
    let target: Drone | null = null;
    for (let j = 0; j < candidates.length; j++) {
      if (overlaps(b, candidates[j])) { target = candidates[j]; break; }
    }
    if (target) {
      target.hp -= b.damage;
      target.flash = w.cfg.fx.hitFlash;
      if (target.hp <= 0) {
        for (let k = w.drones.count - 1; k >= 0; k--) {
          if (w.drones.get(k) === target) { killDrone(w, k); break; }
        }
      }
      bullets.releaseAt(i);
    } else if (overlaps(b, w.boss)) {
      w.boss.hp = Math.max(0, w.boss.hp - b.damage);
      w.events.push({ type: 'bossHit', x: b.x, y: b.y });
      bullets.releaseAt(i);
    }
  }

  // While invulnerable, enemy fire and drones pass through without being used up.
  const p = w.player;
  const shots = w.enemyBullets;
  for (let i = shots.count - 1; i >= 0 && p.invuln <= 0; i--) {
    if (overlaps(shots.get(i), p)) {
      shots.releaseAt(i);
      hurtPlayer(w);
    }
  }
  for (let i = w.drones.count - 1; i >= 0 && p.invuln <= 0; i--) {
    if (overlaps(w.drones.get(i), p)) {
      w.drones.releaseAt(i);
      hurtPlayer(w);
    }
  }
}

export function fireBeam(w: World): void {
  const { player, beam, boss } = w;
  const cfg = w.cfg.player.beam;
  beam.x = player.x;
  beam.y = player.y;
  beam.time = cfg.duration;

  const right = w.cfg.view.width + 16;
  beamBox.x = (player.x + right) / 2;
  beamBox.y = player.y;
  beamBox.w = right - player.x;
  beamBox.h = cfg.height;

  if (overlaps(beamBox, boss)) {
    boss.hp = Math.max(0, boss.hp - w.stats.specialDamage);
    w.events.push({ type: 'bossHit', x: boss.x, y: boss.y });
  }
  for (let i = w.drones.count - 1; i >= 0; i--) {
    if (overlaps(beamBox, w.drones.get(i))) killDrone(w, i);
  }
  w.events.push({ type: 'beamFired', x: player.x, y: player.y });
}
