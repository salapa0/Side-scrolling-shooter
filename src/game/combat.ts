import { overlaps, type Box } from '../engine/geom';
import { closeBonus } from './bonus';
import { damageBoss } from './enemies';
import { maybeDropPowerUp } from './powerups';
import type { Drone, World } from './world';

// Reused every call so combat never allocates in the step loop.
const candidates: Drone[] = [];
const beamBox: Box = { x: 0, y: 0, w: 0, h: 0 };
const hurtBox: Box = { x: 0, y: 0, w: 0, h: 0 };

function hurtPlayer(w: World, damage: number): void {
  const p = w.player;
  p.hp -= damage;
  p.invuln = w.cfg.player.invulnTime;
  w.events.push({ type: 'playerHit', x: p.x, y: p.y });
  if (p.hp <= 0) w.events.push({ type: 'playerKilled', x: p.x, y: p.y });
}

/** canDrop is false for Kill all, so one screen clear never chains into more power-ups. */
function killDrone(w: World, i: number, canDrop: boolean): void {
  const d = w.drones.get(i);
  w.events.push({ type: 'droneKilled', x: d.x, y: d.y });
  w.kills += 1;
  if (canDrop) maybeDropPowerUp(w, d.x, d.y);
  w.drones.releaseAt(i);
}

/** Kill all power-up: every drone dies (counted), all enemy fire vanishes, the boss is untouched. */
export function clearScreen(w: World): void {
  for (let i = w.drones.count - 1; i >= 0; i--) killDrone(w, i, false);
  w.enemyBullets.clear();
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
      if (candidates[j].hp > 0 && overlaps(b, candidates[j])) { target = candidates[j]; break; }
    }
    if (target) {
      target.hp -= b.damage;
      target.flash = w.cfg.fx.hitFlash;
      if (target.hp <= 0) {
        for (let k = w.drones.count - 1; k >= 0; k--) {
          if (w.drones.get(k) === target) { killDrone(w, k, true); break; }
        }
      }
      bullets.releaseAt(i);
    } else if (overlaps(b, w.boss)) {
      damageBoss(w, b.damage, b.x, b.y); // used up even while the bar refills
      bullets.releaseAt(i);
    }
  }

  // While invulnerable, enemy fire and drones pass through without being used up.
  const p = w.player;
  hurtBox.x = p.x; hurtBox.y = p.y; hurtBox.w = w.cfg.player.hitW; hurtBox.h = w.cfg.player.hitH;
  const hpBefore = p.hp;
  const shots = w.enemyBullets;
  for (let i = shots.count - 1; i >= 0 && p.invuln <= 0; i--) {
    if (overlaps(shots.get(i), hurtBox)) {
      const damage = shots.get(i).damage;
      shots.releaseAt(i);
      hurtPlayer(w, damage);
    }
  }
  for (let i = w.drones.count - 1; i >= 0 && p.invuln <= 0; i--) {
    if (overlaps(w.drones.get(i), hurtBox)) {
      w.drones.releaseAt(i);
      hurtPlayer(w, 1);
    }
  }
  // After the loops: releasing mid-loop would scramble their swap-remove indices.
  if (p.hp < hpBefore) clearShotsNear(w, p.x, p.y, w.cfg.player.hitClearRadius);
}

function clearShotsNear(w: World, x: number, y: number, radius: number): void {
  const shots = w.enemyBullets;
  const r2 = radius * radius;
  for (let i = shots.count - 1; i >= 0; i--) {
    const b = shots.get(i);
    const dx = b.x - x, dy = b.y - y;
    if (dx * dx + dy * dy <= r2) shots.releaseAt(i);
  }
}

/** Ends the special cooldown now and announces it; does nothing when E is already ready. */
export function readySpecial(w: World): void {
  const p = w.player;
  if (p.specialCd <= 0) return;
  p.specialCd = 0;
  w.events.push({ type: 'specialReady', x: p.x, y: p.y });
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
    const damage = w.stats.specialDamage * closeBonus(w);
    // Easter egg: a beam that finishes the final stage gets an impact frame. No hint is ever shown.
    if (boss.phase === w.cfg.boss.phases.length && boss.charge <= 0 && boss.hp > 0 && boss.hp <= damage) {
      w.events.push({ type: 'killingShot', x: boss.x, y: boss.y });
    }
    damageBoss(w, damage);
  }
  for (let i = w.drones.count - 1; i >= 0; i--) {
    if (overlaps(beamBox, w.drones.get(i))) killDrone(w, i, true);
  }
  w.events.push({ type: 'beamFired', x: player.x, y: player.y });
}
